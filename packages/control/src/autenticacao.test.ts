/**
 * Autenticação própria contra um Postgres DE VERDADE (S-045).
 *
 * Testa o comportamento que importa: código de uso único, expiração, trava de
 * tentativas, sessão revogável e convite que só o dono do e-mail aceita.
 * Pulado sem banco (a CI sempre roda).
 */
import { beforeAll, describe, expect, test } from "vitest";
import type { EmailPort, Mensagem } from "./email.js";

const urlDeTeste = process.env.TEST_DATABASE_URL;
const temBanco = Boolean(urlDeTeste);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let control: any;

/** E-mail de mentira que guarda o que "enviou" — é daqui que lemos o código. */
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

beforeAll(async () => {
  if (!temBanco) return;
  process.env.DATABASE_URL = urlDeTeste;
  process.env.DB_DRIVER = "pg";
  control = await import("./index.js");
});

describe.skipIf(!temBanco)("entrar sem senha", () => {
  test("primeiro acesso cria pessoa, conta e sessão", async () => {
    const caixa = caixaDeEntrada();
    const email = `novo-${Date.now()}@metrik.test`;

    await control.pedirCodigo({ email, enviarEmail: caixa });
    expect(caixa.ultima()?.para).toBe(email);

    const sessao = await control.entrarComCodigo({ email, codigo: caixa.codigo() });
    expect(sessao.token).toBeTruthy();

    const ctx = await control.resolverSessao(sessao.token);
    expect(ctx.email).toBe(email);
    expect(ctx.role).toBe("owner"); // é dono da própria conta
    expect(ctx.via).toBe("sessao");
  });

  test("o código só serve uma vez", async () => {
    const caixa = caixaDeEntrada();
    const email = `unico-${Date.now()}@metrik.test`;
    await control.pedirCodigo({ email, enviarEmail: caixa });
    const codigo = caixa.codigo();

    await control.entrarComCodigo({ email, codigo });
    await expect(control.entrarComCodigo({ email, codigo })).rejects.toThrow(/inválido ou expirado/);
  });

  test("código errado não entra, e a mensagem não diz o que estava errado", async () => {
    const caixa = caixaDeEntrada();
    const email = `errado-${Date.now()}@metrik.test`;
    await control.pedirCodigo({ email, enviarEmail: caixa });

    await expect(control.entrarComCodigo({ email, codigo: "000000" })).rejects.toThrow(
      /código inválido ou expirado/,
    );
    // e-mail sem pedido nenhum recebe a MESMA resposta (não revela cadastro)
    await expect(
      control.entrarComCodigo({ email: `ninguem-${Date.now()}@metrik.test`, codigo: "123456" }),
    ).rejects.toThrow(/código inválido ou expirado/);
  });

  test("errar demais queima o código", async () => {
    const caixa = caixaDeEntrada();
    const email = `forca-${Date.now()}@metrik.test`;
    await control.pedirCodigo({ email, enviarEmail: caixa });
    const codigo = caixa.codigo();

    for (let i = 0; i < 5; i++) {
      await expect(control.entrarComCodigo({ email, codigo: "999999" })).rejects.toThrow();
    }
    // mesmo com o código CERTO, não entra mais
    await expect(control.entrarComCodigo({ email, codigo })).rejects.toThrow(/inválido ou expirado/);
  });

  test("pedir código demais é barrado", async () => {
    const caixa = caixaDeEntrada();
    const email = `flood-${Date.now()}@metrik.test`;
    for (let i = 0; i < 5; i++) await control.pedirCodigo({ email, enviarEmail: caixa });
    await expect(control.pedirCodigo({ email, enviarEmail: caixa })).rejects.toThrow(/muitos pedidos/);
  });
});

describe.skipIf(!temBanco)("sessão", () => {
  test("sair revoga de verdade — a mesma sessão não volta", async () => {
    const caixa = caixaDeEntrada();
    const email = `sair-${Date.now()}@metrik.test`;
    await control.pedirCodigo({ email, enviarEmail: caixa });
    const { token } = await control.entrarComCodigo({ email, codigo: caixa.codigo() });

    expect(await control.resolverSessao(token)).toBeTruthy();
    await control.sairDaSessao(token);
    expect(await control.resolverSessao(token)).toBeNull();
  });

  test("token inventado não vira sessão", async () => {
    expect(await control.resolverSessao("token-que-nunca-existiu")).toBeNull();
    expect(await control.resolverSessao("")).toBeNull();
  });
});

describe.skipIf(!temBanco)("convite", () => {
  test("só o dono do e-mail convidado aceita, e ele entra na conta certa", async () => {
    const caixaDona = caixaDeEntrada();
    const emailDona = `dona-${Date.now()}@metrik.test`;
    await control.pedirCodigo({ email: emailDona, enviarEmail: caixaDona });
    const dona = await control.entrarComCodigo({ email: emailDona, codigo: caixaDona.codigo() });
    const ctxDona = await control.resolverSessao(dona.token);

    const caixaConvite = caixaDeEntrada();
    const emailConvidado = `convidado-${Date.now()}@metrik.test`;
    await control.convidar(ctxDona, { email: emailConvidado, role: "operator", enviarEmail: caixaConvite });
    const link = caixaConvite.ultima()?.texto ?? "";
    const tokenConvite = link.match(/convite\?t=([\w-]+)/)?.[1] ?? "";
    expect(tokenConvite).toBeTruthy();

    // outra pessoa, com sessão própria, tenta aceitar
    const caixaIntrusa = caixaDeEntrada();
    const emailIntrusa = `intrusa-${Date.now()}@metrik.test`;
    await control.pedirCodigo({ email: emailIntrusa, enviarEmail: caixaIntrusa });
    const intrusa = await control.entrarComCodigo({ email: emailIntrusa, codigo: caixaIntrusa.codigo() });
    const ctxIntrusa = await control.resolverSessao(intrusa.token);
    await expect(
      control.aceitarConvite({ token: tokenConvite, userId: ctxIntrusa.userId }),
    ).rejects.toThrow(/de outro e-mail/);

    // o convidado aceita e cai na conta da dona, com o papel do convite
    const caixaEntrada = caixaDeEntrada();
    await control.pedirCodigo({ email: emailConvidado, enviarEmail: caixaEntrada });
    const convidado = await control.entrarComCodigo({ email: emailConvidado, codigo: caixaEntrada.codigo() });
    const ctxConvidado = await control.resolverSessao(convidado.token);
    const r = await control.aceitarConvite({ token: tokenConvite, userId: ctxConvidado.userId });
    expect(r.orgId).toBe(ctxDona.orgId);
    expect(r.role).toBe("operator");

    // e o convite não serve de novo
    await expect(
      control.aceitarConvite({ token: tokenConvite, userId: ctxConvidado.userId }),
    ).rejects.toThrow(/inválido ou expirado/);
  });

  test("quem não gerencia não convida", async () => {
    const caixa = caixaDeEntrada();
    const email = `viewer-${Date.now()}@metrik.test`;
    await control.pedirCodigo({ email, enviarEmail: caixa });
    const s = await control.entrarComCodigo({ email, codigo: caixa.codigo() });
    const ctx = await control.resolverSessao(s.token);

    await expect(
      control.convidar({ ...ctx, role: "viewer" }, { email: "alguem@metrik.test", enviarEmail: caixa }),
    ).rejects.toThrow(/permissão/);
  });
});

describe.skipIf(!temBanco)("trocar de conta", () => {
  test("só troca para conta de que a pessoa participa", async () => {
    const caixa = caixaDeEntrada();
    const email = `troca-${Date.now()}@metrik.test`;
    await control.pedirCodigo({ email, enviarEmail: caixa });
    const s = await control.entrarComCodigo({ email, codigo: caixa.codigo() });
    const ctx = await control.resolverSessao(s.token);

    const { db, organizations } = await import("@motor/db");
    const [alheia] = await db.insert(organizations).values({ name: "Conta de outra pessoa" }).returning();

    await expect(
      control.trocarConta({ token: s.token, userId: ctx.userId, orgId: alheia.id }),
    ).rejects.toThrow(/não encontrad/);

    const contas = await control.contasDaPessoa(ctx.userId);
    expect(contas).toHaveLength(1);
    expect(contas[0].orgId).toBe(ctx.orgId);
  });
});
