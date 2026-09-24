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
    // com o RLS ligado, agente só nasce dentro da conta dele (S-011)
    await bd.comConta(orgA.id, () =>
      bd.db.insert(bd.agents).values({ orgId: orgA.id, name: "Agente de A", tipo: "resposta" }),
    );
    await bd.comConta(orgB.id, () =>
      bd.db.insert(bd.agents).values({ orgId: orgB.id, name: "Agente de B", tipo: "resposta" }),
    );

    const ctxA = { orgId: orgA.id, actor: "teste", role: "owner", via: "sessao" };
    const { token } = await bd.comConta(orgA.id, () =>
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
    const { token } = await control.criarMachineToken(ctx, { name: "só log", scopes: ["log"] });

    const r = await chamar({ action: "agents", token });
    expect(r.status).toBe(403);
    expect(String((r.corpo as { error: string }).error)).toMatch(/escopo/);
  });

  test("ação de escrita por GET é recusada", async () => {
    const [org] = await bd.db.insert(bd.organizations).values({ name: `e2e-post-${Date.now()}` }).returning();
    const ctx = { orgId: org.id, actor: "teste", role: "owner", via: "sessao" };
    const { token } = await bd.comConta(org.id, () =>
      control.criarMachineToken(ctx, { name: "e2e", scopes: ["admin"] }),
    );

    const r = await chamar({ action: "createAgent", token, metodo: "GET" });
    expect(r.status).toBe(405);
  });

  test("ação desconhecida vira 400, não 500", async () => {
    const [org] = await bd.db.insert(bd.organizations).values({ name: `e2e-404-${Date.now()}` }).returning();
    const ctx = { orgId: org.id, actor: "teste", role: "owner", via: "sessao" };
    const { token } = await bd.comConta(org.id, () =>
      control.criarMachineToken(ctx, { name: "e2e", scopes: ["admin"] }),
    );

    const r = await chamar({ action: "inventada", token });
    expect(r.status).toBe(400);
  });

  test("a escrita passa pela transação da conta e persiste depois do commit", async () => {
    const [org] = await bd.db.insert(bd.organizations).values({ name: `e2e-commit-${Date.now()}` }).returning();
    const ctx = { orgId: org.id, actor: "teste", role: "owner", via: "sessao" };
    const { token } = await bd.comConta(org.id, () =>
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
    const achados = await bd.comConta(org.id, () => control.listAgents(ctx));
    expect((achados as { name: string }[]).map((a) => a.name)).toContain(nome);
  });

  test("toda resposta carrega o id de correlação", async () => {
    const r = await chamar({ action: "agents" });
    expect(r.cabecalhos["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
