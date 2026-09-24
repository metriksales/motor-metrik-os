/**
 * As tabelas de identidade sob RLS (S-046), contra um Postgres DE VERDADE.
 *
 * A S-011 protegeu tudo que tem `org_id` e parou nas quatro tabelas do login:
 * `users`, `login_codes`, `sessions`, `organizations`. Ficou como dívida
 * escrita, e este arquivo é a cobrança.
 *
 * O QUE ESTES TESTES ATACAM. Não é "a consulta certa devolve a linha certa" —
 * isso o resto da suíte já faz. É o contrário: com a conexão no papel da
 * aplicação, tentar ver o que não é seu. Código de entrada de outra pessoa,
 * conta de outro cliente, sessão alheia. Política de segurança que nunca foi
 * atacada num teste é política que ninguém conferiu.
 *
 * Pulado sem banco (a CI sempre roda).
 */
import { beforeAll, describe, expect, test } from "vitest";
import type { EmailPort, Mensagem } from "./email.js";

const urlDeTeste = process.env.TEST_DATABASE_URL;
const temBanco = Boolean(urlDeTeste);

/* eslint-disable @typescript-eslint/no-explicit-any */
let bd: any;
let control: any;
let drizzleSql: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

beforeAll(async () => {
  if (!temBanco) return;
  process.env.DATABASE_URL = urlDeTeste;
  process.env.DB_DRIVER = "pg";
  bd = await import("@motor/db");
  control = await import("./index.js");
  ({ sql: drizzleSql } = await import("drizzle-orm"));
});

function caixaDeEntrada(): EmailPort & { ultima(): Mensagem | undefined; codigo(): string } {
  const enviadas: Mensagem[] = [];
  return {
    modo: "seco",
    async enviar(msg: Mensagem) {
      enviadas.push(msg);
      return { ok: true, id: "teste" };
    },
    ultima: () => enviadas.at(-1),
    codigo: () => enviadas.at(-1)?.texto.match(/\b(\d{6})\b/)?.[1] ?? "",
  };
}

/** Põe a pessoa na plataforma com conta própria. Roda como dona do banco. */
async function fundar(email: string) {
  const [pessoa] = await bd.db.insert(bd.users).values({ email }).returning();
  const [org] = await bd.db
    .insert(bd.organizations)
    .values({ name: email.split("@")[0] })
    .returning();
  await bd.comConta(org.id, () =>
    bd.db.insert(bd.memberships).values({ orgId: org.id, userId: pessoa.id, role: "owner" }),
  );
  return { userId: pessoa.id as string, orgId: org.id as string, email };
}

/** Entra de verdade: pede o código, lê da caixa, troca por sessão. */
async function entrar(email: string) {
  const caixa = caixaDeEntrada();
  await control.pedirCodigo({ email, enviarEmail: caixa });
  return control.entrarComCodigo({ email, codigo: caixa.codigo() });
}

const marca = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * O motivo REAL de um erro de banco, e não o embrulho.
 *
 * O drizzle troca a mensagem do Postgres por `Failed query: <sql> params: …` e
 * guarda a original em `cause`. Quem usar `toThrow(/permissão/)` direto está
 * conferindo o embrulho, não o motivo — e o teste passa ou falha pelo texto
 * errado. Esta função junta a corrente inteira.
 */
function motivo(e: unknown): string {
  const partes: string[] = [];
  let atual = e as { message?: string; cause?: unknown } | undefined;
  while (atual) {
    if (atual.message) partes.push(atual.message);
    atual = atual.cause as typeof atual;
  }
  return partes.join(" | ");
}

/** Roda e devolve o erro, em vez de deixá-lo subir. */
async function oQueQuebra(corpo: () => Promise<unknown>): Promise<unknown> {
  return corpo().then(
    () => null,
    (e: unknown) => e,
  );
}

describe.skipIf(!temBanco)("sem contexto nenhum, no papel da aplicação", () => {
  // `comContexto({})` é a conexão da aplicação SEM declarar quem é: o papel
  // vira `metrik_app` e os dois parâmetros ficam vazios. É o estado de uma
  // consulta que esqueceu de declarar a conta — e é aqui que o RLS trabalha.

  test("código de entrada não é legível NEM com o e-mail em mãos", async () => {
    const email = `alvo-${marca()}@metrik.test`;
    await fundar(email);
    await control.pedirCodigo({ email, enviarEmail: caixaDeEntrada() });

    // roda como dona: o código existe mesmo
    const existe = await bd.db.execute(
      drizzleSql`select count(*)::int as n from login_codes where email = ${email}`,
    );
    expect((existe.rows ?? existe)[0].n).toBeGreaterThan(0);

    // no papel da aplicação, some — é a tabela sem política nenhuma
    await bd.comContexto({}, async () => {
      const r = await bd.db.execute(
        drizzleSql`select count(*)::int as n from login_codes where email = ${email}`,
      );
      expect((r.rows ?? r)[0].n).toBe(0);
    });
  });

  test("escrever código à mão é recusado pelo banco", async () => {
    const erro = await oQueQuebra(() =>
      bd.comContexto({}, () =>
        bd.db.execute(
          drizzleSql`insert into login_codes (email, code_hash, expires_at)
                     values ('invasor@metrik.test', 'x', now() + interval '10 minutes')`,
        ),
      ),
    );
    expect(motivo(erro)).toMatch(/row-level security|violates/i);
  });

  test("nenhuma pessoa e nenhuma conta aparecem", async () => {
    await fundar(`ninguem-${marca()}@metrik.test`);
    await bd.comContexto({}, async () => {
      const p = await bd.db.execute(drizzleSql`select count(*)::int as n from users`);
      const o = await bd.db.execute(drizzleSql`select count(*)::int as n from organizations`);
      const s = await bd.db.execute(drizzleSql`select count(*)::int as n from sessions`);
      expect((p.rows ?? p)[0].n).toBe(0);
      expect((o.rows ?? o)[0].n).toBe(0);
      expect((s.rows ?? s)[0].n).toBe(0);
    });
  });
});

describe.skipIf(!temBanco)("declarando a pessoa", () => {
  test("vejo a mim mesma, não a vizinha", async () => {
    const eu = await fundar(`eu-${marca()}@metrik.test`);
    const outra = await fundar(`outra-${marca()}@metrik.test`);

    await bd.comPessoa(eu.userId, async () => {
      const r = await bd.db.execute(drizzleSql`select id::text from users`);
      const ids = (r.rows ?? r).map((l: { id: string }) => l.id);
      expect(ids).toContain(eu.userId);
      expect(ids).not.toContain(outra.userId);
    });
  });

  test("vejo as minhas contas, não a conta da vizinha", async () => {
    const eu = await fundar(`dona-${marca()}@metrik.test`);
    const outra = await fundar(`alheia-${marca()}@metrik.test`);

    const contas = await bd.comPessoa(eu.userId, () => control.contasDaPessoa(eu.userId));
    const ids = contas.map((c: { orgId: string }) => c.orgId);
    expect(ids).toContain(eu.orgId);
    expect(ids).not.toContain(outra.orgId);
  });

  test("a sessão de outra pessoa não é minha para revogar", async () => {
    const eu = await fundar(`revoga-${marca()}@metrik.test`);
    const alvo = await fundar(`alvo2-${marca()}@metrik.test`);
    await entrar(alvo.email);

    await bd.comPessoa(eu.userId, async () => {
      const r = await bd.db.execute(
        drizzleSql`update sessions set revoked_at = now()
                   where user_id = ${alvo.userId}::uuid returning id`,
      );
      expect((r.rows ?? r).length).toBe(0); // não deu erro: simplesmente não havia linha minha
    });

    // e a sessão dela continua viva
    const viva = await bd.db.execute(
      drizzleSql`select count(*)::int as n from sessions
                 where user_id = ${alvo.userId}::uuid and revoked_at is null`,
    );
    expect((viva.rows ?? viva)[0].n).toBe(1);
  });
});

describe.skipIf(!temBanco)("declarando a conta", () => {
  test("a tela de membros enxerga quem divide a conta", async () => {
    const dona = await fundar(`membros-${marca()}@metrik.test`);
    const fora = await fundar(`fora-${marca()}@metrik.test`);

    const membros = await bd.comConta(dona.orgId, () =>
      control.listMembers({ orgId: dona.orgId, actor: dona.email, role: "owner", via: "sessao" }),
    );
    const emails = membros.map((m: { email?: string }) => m.email);
    expect(emails).toContain(dona.email);
    expect(emails).not.toContain(fora.email);
  });
});

describe.skipIf(!temBanco)("aceitar convite estando logado", () => {
  // REGRESSÃO. Desde a S-011 este caminho estava QUEBRADO e nenhum teste
  // pegou, porque só existia teste das recusas: o aceite roda dentro de
  // `comPessoa`, que declara a pessoa mas não a conta, e a política de escrita
  // de `memberships` exige a conta. O banco recusava o vínculo.
  test("quem já está dentro consegue entrar numa segunda conta pelo convite", async () => {
    const dona = await fundar(`anfitria-${marca()}@metrik.test`);
    const visita = await fundar(`visita-${marca()}@metrik.test`);

    // a visita entra ANTES de existir convite — senão o login já o consumiria
    const sessao = await entrar(visita.email);
    const ctx = await control.resolverSessao(sessao.token);
    expect(ctx.orgId).toBe(visita.orgId);

    const caixaConvite = caixaDeEntrada();
    await bd.comConta(dona.orgId, () =>
      control.convidar(
        { orgId: dona.orgId, actor: dona.email, role: "owner", via: "sessao" },
        { email: visita.email, role: "operator", enviarEmail: caixaConvite },
      ),
    );
    const token = (caixaConvite.ultima()?.texto ?? "").match(/convite\?t=([\w-]+)/)?.[1] ?? "";
    expect(token).toBeTruthy();

    const r = await bd.comPessoa(ctx.userId, () =>
      control.aceitarConvite({ token, userId: ctx.userId }),
    );
    expect(r.orgId).toBe(dona.orgId);
    expect(r.role).toBe("operator");

    // e o vínculo existe mesmo — é o que o banco recusava antes
    const contas = await bd.comPessoa(ctx.userId, () => control.contasDaPessoa(ctx.userId));
    expect(contas.map((c: { orgId: string }) => c.orgId)).toContain(dona.orgId);
  });

  test("o convite alheio dá a MESMA recusa de convite inexistente", async () => {
    const dona = await fundar(`anfitria2-${marca()}@metrik.test`);
    const intrusa = await fundar(`intrusa-${marca()}@metrik.test`);

    const caixaConvite = caixaDeEntrada();
    await bd.comConta(dona.orgId, () =>
      control.convidar(
        { orgId: dona.orgId, actor: dona.email, role: "owner", via: "sessao" },
        { email: `terceiro-${marca()}@metrik.test`, role: "operator", enviarEmail: caixaConvite },
      ),
    );
    const token = (caixaConvite.ultima()?.texto ?? "").match(/convite\?t=([\w-]+)/)?.[1] ?? "";

    await expect(
      bd.comPessoa(intrusa.userId, () =>
        control.aceitarConvite({ token, userId: intrusa.userId }),
      ),
      // a mensagem não confirma que o convite existe: antes, o 403 "é de outro
      // e-mail" entregava isso a quem estivesse testando tokens
    ).rejects.toThrow(/inválido ou expirado/);
  });
});
