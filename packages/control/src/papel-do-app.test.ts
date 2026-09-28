/**
 * A aplicação conectada como `metrik_app` (S-046 parte 2).
 *
 * POR QUE ESTE ARQUIVO EXISTE SEPARADO. O resto da suíte conecta como DONA do
 * banco — e dono atravessa RLS. Isso é conveniente para montar cenário, mas
 * significa que nenhum dos outros testes prova que o sistema FUNCIONA quando a
 * conexão é a restrita. Essa é a pergunta inteira da parte 2: o RLS vira o
 * padrão da conexão, e aí ou os caminhos declaram a conta ou eles quebram.
 *
 * Aqui a conexão é a do papel restrito, e os fluxos exercitados são os de
 * verdade: entrar, resolver sessão, listar contas, guardar credencial no cofre.
 * O cenário é montado por um cliente separado, de dono — igual à produção, onde
 * quem migra é o dono e quem serve requisição é o `metrik_app`.
 *
 * Pulado quando falta `TEST_DATABASE_URL_APP` (a CI sempre roda).
 */
import { beforeAll, describe, expect, test } from "vitest";
import type { EmailPort, Mensagem } from "./email.js";

const urlDono = process.env.TEST_DATABASE_URL;
const urlApp = process.env.TEST_DATABASE_URL_APP;
const temAmbas = Boolean(urlDono && urlApp);

/* eslint-disable @typescript-eslint/no-explicit-any */
let bd: any;
let control: any;
let dono: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

beforeAll(async () => {
  if (!temAmbas) return;
  // ESTA LINHA É O TESTE. `DATABASE_URL_APP` é o que faz o client conectar
  // pelo papel restrito; precisa existir ANTES do import do @motor/db, porque
  // a conexão é criada na carga do módulo.
  process.env.DATABASE_URL_APP = urlApp;
  process.env.DATABASE_URL = urlDono;
  process.env.DB_DRIVER = "pg";
  bd = await import("@motor/db");
  control = await import("./index.js");

  // cliente de DONO, só para montar cenário — o que a migração faz na produção
  const pg = (await import("pg")).default;
  dono = new pg.Client({ connectionString: urlDono });
  await dono.connect();
});

function caixaDeEntrada(): EmailPort & { codigo(): string } {
  const enviadas: Mensagem[] = [];
  return {
    modo: "seco",
    async enviar(msg: Mensagem) {
      enviadas.push(msg);
      return { ok: true, id: "teste" };
    },
    codigo: () => enviadas.at(-1)?.texto.match(/\b(\d{6})\b/)?.[1] ?? "",
  };
}

const marca = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** Põe a pessoa na plataforma. Roda pelo cliente de DONO, como a produção. */
async function fundarComoDono(email: string) {
  const p = await dono.query("insert into users (email) values ($1) returning id::text", [email]);
  const o = await dono.query("insert into organizations (name) values ($1) returning id::text", [
    email.split("@")[0],
  ]);
  await dono.query("insert into memberships (org_id, user_id, role) values ($1, $2, 'owner')", [
    o.rows[0].id,
    p.rows[0].id,
  ]);
  return { userId: p.rows[0].id as string, orgId: o.rows[0].id as string, email };
}

describe.skipIf(!temAmbas)("a conexão é mesmo a restrita", () => {
  test("o banco confirma que quem fala é metrik_app", async () => {
    const r = await bd.db.execute(
      (await import("drizzle-orm")).sql`select current_user as papel, session_user as sessao`,
    );
    const linha = (r.rows ?? r)[0];
    expect(linha.papel).toBe("metrik_app");
    // `session_user` também: não é troca de papel, é a conexão de verdade
    expect(linha.sessao).toBe("metrik_app");
  });

  test("sem declarar conta, não enxerga NADA — e agora isto é o padrão", async () => {
    const email = `padrao-${marca()}@metrik.test`;
    await fundarComoDono(email);

    const { sql } = await import("drizzle-orm");
    for (const tabela of ["users", "organizations", "agents", "credentials", "login_codes"]) {
      const r = await bd.db.execute(sql.raw(`select count(*)::int as n from ${tabela}`));
      expect((r.rows ?? r)[0].n, `${tabela} deveria estar invisível`).toBe(0);
    }

    // e o dono, na mesma base, enxerga — é o controle que torna o zero acima
    // uma prova de RLS, e não de banco vazio
    const doDono = await dono.query("select count(*)::int as n from users");
    expect(doDono.rows[0].n).toBeGreaterThan(0);
  });
});

describe.skipIf(!temAmbas)("os fluxos de verdade, no papel restrito", () => {
  test("entrar funciona inteiro — código, sessão, conta", async () => {
    // É o caminho mais exposto da mudança: acontece ANTES de existir contexto,
    // e toca `login_codes`, que não tem política nenhuma. Se as funções
    // SECURITY DEFINER não bastassem, é aqui que quebraria.
    const email = `entrada-${marca()}@metrik.test`;
    const conta = await fundarComoDono(email);

    const caixa = caixaDeEntrada();
    await control.pedirCodigo({ email, enviarEmail: caixa });
    expect(caixa.codigo()).toMatch(/^\d{6}$/);

    const sessao = await control.entrarComCodigo({ email, codigo: caixa.codigo() });
    const ctx = await control.resolverSessao(sessao.token);

    expect(ctx).not.toBeNull();
    expect(ctx.orgId).toBe(conta.orgId);
    expect(ctx.role).toBe("owner");
    expect(ctx.email).toBe(email);
  });

  test("o seletor de contas lista as minhas, e só as minhas", async () => {
    const minha = await fundarComoDono(`seletor-${marca()}@metrik.test`);
    const alheia = await fundarComoDono(`alheia-${marca()}@metrik.test`);

    const contas = await bd.comPessoa(minha.userId, () => control.contasDaPessoa(minha.userId));
    const ids = contas.map((c: { orgId: string }) => c.orgId);
    expect(ids).toContain(minha.orgId);
    expect(ids).not.toContain(alheia.orgId);
  });

  test("o cofre guarda e devolve, dentro da conta", async () => {
    // O cofre é o que tem mais a perder: se a conexão restrita não conseguisse
    // escrever em `credentials`, a S-025 pararia de funcionar em produção no
    // instante em que a variável fosse ligada.
    process.env.COFRE_CHAVE = `1:${Buffer.from(
      new Uint8Array(32).map((_, i) => (i * 7 + 13) % 256),
    ).toString("base64")}`;

    const conta = await fundarComoDono(`cofre-${marca()}@metrik.test`);
    const ctx = { orgId: conta.orgId, actor: conta.email, role: "owner", via: "sessao" };

    await bd.comConta(conta.orgId, () =>
      control.guardarCredencial(ctx, { kind: "uazapi", segredo: "token-secreto-de-teste-123" }),
    );

    const lista = await bd.comConta(conta.orgId, () => control.listarCredenciais(ctx));
    expect(lista).toHaveLength(1);
    expect(lista[0].kind).toBe("uazapi");
    // a listagem NUNCA devolve o segredo
    expect(JSON.stringify(lista)).not.toContain("token-secreto-de-teste-123");

    const aberto = await bd.comConta(conta.orgId, () =>
      control.usarCredencial(ctx, { kind: "uazapi" }),
    );
    expect(aberto.segredo).toBe("token-secreto-de-teste-123");
  });

  test("a conta de um cliente não aparece para o outro, nem sem filtro", async () => {
    const a = await fundarComoDono(`vizinha-a-${marca()}@metrik.test`);
    const b = await fundarComoDono(`vizinha-b-${marca()}@metrik.test`);
    await dono.query("insert into agents (org_id, name, tipo) values ($1, $2, 'resposta')", [b.orgId, "agente da B"]);

    const { sql } = await import("drizzle-orm");
    const vistos = await bd.comConta(a.orgId, async () => {
      const r = await bd.db.execute(sql`select count(*)::int as n from agents`);
      return (r.rows ?? r)[0].n;
    });
    expect(vistos).toBe(0); // a conta A não tem agente, e não vê o da B
  });
});
