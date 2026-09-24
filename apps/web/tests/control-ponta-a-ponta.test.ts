/**
 * O handler da Control API inteiro, contra um Postgres DE VERDADE.
 *
 * POR QUE ELE EXISTE. Até aqui nada exercitava despacho, permissão e contexto
 * de conta JUNTOS — cada peça tinha teste, a costura não tinha nenhum. Na
 * prática isso significava depender de alguém abrir o app e clicar para saber
 * se a porta única ainda funcionava, o que não é verificação, é esperança.
 *
 * O teste importa o BUNDLE (`api/_bundled/control.mjs`), que é o artefato que
 * a Vercel executa — não a fonte TypeScript. Se o empacotamento quebrar, é
 * aqui que aparece, e não em produção.
 *
 * Pulado sem banco (a CI sempre roda).
 */
import { randomBytes } from "node:crypto";
import { sql as drizzleSql } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";

const urlDeTeste = process.env.TEST_DATABASE_URL;
const temBanco = Boolean(urlDeTeste);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let control: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let bd: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let handler: any;

/** Uma resposta da Vercel de mentira, que guarda o que foi respondido. */
function resposta() {
  const estado = { status: 200, corpo: undefined as unknown, cabecalhos: {} as Record<string, string> };
  const res = {
    status(c: number) {
      estado.status = c;
      return res;
    },
    json(corpo: unknown) {
      estado.corpo = corpo;
      return res;
    },
    setHeader(nome: string, valor: string) {
      estado.cabecalhos[nome] = valor;
    },
  };
  return { res, estado };
}

/** Uma requisição autenticada por token de máquina — é o caminho testável de fora. */
function requisicao(opts: { action: string; token?: string; metodo?: string; body?: unknown; query?: Record<string, string> }) {
  return {
    method: opts.metodo ?? "GET",
    query: { action: opts.action, ...(opts.query ?? {}) },
    body: opts.body,
    headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
  };
}

async function chamar(opts: Parameters<typeof requisicao>[0]) {
  const { res, estado } = resposta();
  await handler(requisicao(opts), res);
  return estado;
}

beforeAll(async () => {
  if (!temBanco) return;
  process.env.DATABASE_URL = urlDeTeste;
  process.env.DB_DRIVER = "pg";
  // chave só deste teste — o cofre recusa subir sem uma (S-025)
  process.env.COFRE_CHAVE = `1:${Buffer.from(randomBytes(32)).toString("base64")}`;
  // o mesmo bundle que vai para produção
  control = await import("../api/_bundled/control.mjs");
  bd = await import("@motor/db");
  handler = (await import("../api/control.js")).default;
});

describe.skipIf(!temBanco)("porta única da Control API", () => {
  test("sem credencial nenhuma, não passa", async () => {
    const r = await chamar({ action: "agents" });
    expect(r.status).toBe(401);
  });

  test("com token da conta, a ação roda e enxerga só a conta dele", async () => {
    const [orgA] = await bd.db.insert(bd.organizations).values({ name: `e2e-a-${Date.now()}` }).returning();
    const [orgB] = await bd.db.insert(bd.organizations).values({ name: `e2e-b-${Date.now()}` }).returning();
    // Com o RLS ligado, agente só nasce dentro da conta dele (S-011) — e o
    // contexto TEM que vir do bundle: ele carrega a própria cópia de @motor/db,
    // com outro AsyncLocalStorage e outro pool. Misturar os dois foi o que
    // derrubou este teste na primeira rodada, e o sintoma não dizia isso.
    const ctxA = { orgId: orgA.id, actor: "teste", role: "owner", via: "sessao" };
    const ctxB = { orgId: orgB.id, actor: "teste", role: "owner", via: "sessao" };
    await control.comConta(orgA.id, () => control.createAgent(ctxA, { name: "Agente de A", tipo: "resposta" }));
    await control.comConta(orgB.id, () => control.createAgent(ctxB, { name: "Agente de B", tipo: "resposta" }));

    const { token } = await control.comConta(orgA.id, () =>
      control.criarMachineToken(ctxA, { name: "e2e", scopes: ["admin"] }),
    );

    const r = await chamar({ action: "agents", token });
    expect(r.status).toBe(200);

    const nomes = (r.corpo as { name: string }[]).map((a) => a.name);
    expect(nomes).toContain("Agente de A");
    expect(nomes).not.toContain("Agente de B"); // a conta do vizinho não aparece
  });

  test("o escopo do token é respeitado pela porta", async () => {
    const [org] = await bd.db.insert(bd.organizations).values({ name: `e2e-escopo-${Date.now()}` }).returning();
    const ctx = { orgId: org.id, actor: "teste", role: "owner", via: "sessao" };
    // token de ingestão: o mais estreito que existe
    const { token } = await control.comConta(org.id, () =>
      control.criarMachineToken(ctx, { name: "só log", scopes: ["log"] }),
    );

    const r = await chamar({ action: "agents", token });
    expect(r.status).toBe(403);
    expect(String((r.corpo as { error: string }).error)).toMatch(/escopo/);
  });

  test("ação de escrita por GET é recusada", async () => {
    const [org] = await bd.db.insert(bd.organizations).values({ name: `e2e-post-${Date.now()}` }).returning();
    const ctx = { orgId: org.id, actor: "teste", role: "owner", via: "sessao" };
    const { token } = await control.comConta(org.id, () =>
      control.criarMachineToken(ctx, { name: "e2e", scopes: ["admin"] }),
    );

    const r = await chamar({ action: "createAgent", token, metodo: "GET" });
    expect(r.status).toBe(405);
  });

  test("ação desconhecida vira 400, não 500", async () => {
    const [org] = await bd.db.insert(bd.organizations).values({ name: `e2e-404-${Date.now()}` }).returning();
    const ctx = { orgId: org.id, actor: "teste", role: "owner", via: "sessao" };
    const { token } = await control.comConta(org.id, () =>
      control.criarMachineToken(ctx, { name: "e2e", scopes: ["admin"] }),
    );

    const r = await chamar({ action: "inventada", token });
    expect(r.status).toBe(400);
  });

  test("a escrita passa pela transação da conta e persiste depois do commit", async () => {
    const [org] = await bd.db.insert(bd.organizations).values({ name: `e2e-commit-${Date.now()}` }).returning();
    const ctx = { orgId: org.id, actor: "teste", role: "owner", via: "sessao" };
    const { token } = await control.comConta(org.id, () =>
      control.criarMachineToken(ctx, { name: "e2e", scopes: ["admin"] }),
    );

    const nome = `Agente criado pela porta ${Date.now()}`;
    const r = await chamar({
      action: "createAgent",
      token,
      metodo: "POST",
      body: { name: nome, tipo: "resposta" },
    });
    expect(r.status).toBe(200);

    // a resposta só sai depois do commit — então o dado TEM que estar no banco
    const achados = await control.comConta(org.id, () => control.listAgents(ctx));
    expect((achados as { name: string }[]).map((a) => a.name)).toContain(nome);
  });

  test("toda resposta carrega o id de correlação", async () => {
    const r = await chamar({ action: "agents" });
    expect(r.cabecalhos["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe.skipIf(!temBanco)("cofre pela porta única (S-025)", () => {
  const SEGREDO = "pit-9f3a-token-do-crm-do-cliente";

  async function contaComToken(marca: string) {
    const [org] = await bd.db.insert(bd.organizations).values({ name: `${marca}-${Date.now()}` }).returning();
    const ctx = { orgId: org.id, actor: "teste", role: "owner", via: "sessao" };
    const { token } = await control.comConta(org.id, () =>
      control.criarMachineToken(ctx, { name: "cofre", scopes: ["admin"] }),
    );
    return { orgId: org.id as string, ctx, token };
  }

  test("guardar não devolve o segredo, e listar também não", async () => {
    const { token } = await contaComToken("cofre-a");

    const guardou = await chamar({
      action: "guardarCredencial",
      token,
      metodo: "POST",
      body: { kind: "ghl", segredo: SEGREDO, meta: { subconta: "abc" } },
    });
    expect(guardou.status).toBe(200);

    // a varredura é no JSON INTEIRO: o segredo não pode estar em campo nenhum,
    // nem num que alguém acrescente sem pensar depois
    expect(JSON.stringify(guardou.corpo)).not.toContain(SEGREDO);
    expect((guardou.corpo as { dica: string }).dica).toBe("…ente");

    const lista = await chamar({ action: "credenciais", token });
    expect(lista.status).toBe(200);
    expect(JSON.stringify(lista.corpo)).not.toContain(SEGREDO);
    expect((lista.corpo as unknown[]).length).toBe(1);
  });

  test("não existe ação para ler o segredo", async () => {
    const { token } = await contaComToken("cofre-b");
    await chamar({
      action: "guardarCredencial",
      token,
      metodo: "POST",
      body: { kind: "kommo", segredo: SEGREDO },
    });

    // as tentativas óbvias de quem procura o valor pela API
    for (const acao of ["usarCredencial", "lerCredencial", "credencial", "segredo"]) {
      const r = await chamar({ action: acao, token });
      expect(r.status, `a ação "${acao}" não deveria existir`).toBe(400);
    }
  });

  test("o cofre de uma conta não aparece na outra", async () => {
    const a = await contaComToken("cofre-c");
    const b = await contaComToken("cofre-d");

    await chamar({
      action: "guardarCredencial",
      token: a.token,
      metodo: "POST",
      body: { kind: "uazapi", segredo: SEGREDO },
    });

    const daOutra = await chamar({ action: "credenciais", token: b.token });
    expect(daOutra.corpo).toEqual([]);
  });

  test("por dentro, o segredo volta inteiro — e o uso fica na auditoria", async () => {
    const { orgId, ctx, token } = await contaComToken("cofre-e");
    await chamar({
      action: "guardarCredencial",
      token,
      metodo: "POST",
      body: { kind: "ghl", segredo: SEGREDO },
    });

    const usado = await control.comConta(orgId, () => control.usarCredencial(ctx, { kind: "ghl" }));
    expect(usado.segredo).toBe(SEGREDO);

    const trilha = await control.comConta(orgId, () =>
      bd.db.select().from(bd.auditLog).where(drizzleSql`org_id = ${orgId}::uuid`),
    );
    const acoes = trilha.map((l: { action: string }) => l.action);
    expect(acoes).toContain("credencial.guardada");
    expect(acoes).toContain("credencial.usada");
    // e a trilha não guarda o valor, só o fato
    expect(JSON.stringify(trilha)).not.toContain(SEGREDO);
  });
});
