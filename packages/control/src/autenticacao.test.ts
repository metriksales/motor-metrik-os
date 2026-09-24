/**
 * Autenticação própria contra um Postgres DE VERDADE (S-045).
 *
 * Testa o comportamento que importa: quem pode entrar, código de uso único,
 * expiração, trava de tentativas, sessão revogável e convite que só o dono do
 * e-mail aceita. Pulado sem banco (a CI sempre roda).
 */
import { beforeAll, describe, expect, test } from "vitest";
import type { EmailPort, Mensagem } from "./email.js";

const urlDeTeste = process.env.TEST_DATABASE_URL;
const temBanco = Boolean(urlDeTeste);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let control: any;

/** E-mail de mentira que guarda o que "enviou" — é daqui que lemos o código. */
function caixaDeEntrada(): EmailPort & { ultima(): Mensagem | undefined; codigo(): string; quantas(): number } {
  const enviadas: Mensagem[] = [];
  return {
    modo: "seco",
    async enviar(msg: Mensagem) {
      enviadas.push(msg);
      return { ok: true, id: "teste" };
    },
    ultima: () => enviadas.at(-1),
    quantas: () => enviadas.length,
    codigo: () => enviadas.at(-1)?.texto.match(/\b(\d{6})\b/)?.[1] ?? "",
  };
}

/**
 * Põe a pessoa na plataforma com uma conta própria — o que a Metrik faz ao
 * assinar um cliente. A entrada é fechada: sem este passo (ou sem convite),
 * ninguém entra, e é justamente isso que os testes abaixo exercitam.
 */
async function fundar(email: string) {
  const { db, users, organizations, memberships, comPessoa } = await import("@motor/db");
  const [pessoa] = await db.insert(users).values({ email }).returning();
  const [org] = await db
    .insert(organizations)
    .values({ name: email.split("@")[0] })
    .returning();
  // `memberships` tem RLS (S-011): o vínculo só entra declarando de quem é
  await comPessoa(pessoa.id, () =>
    db.insert(memberships).values({ orgId: org.id, userId: pessoa.id, role: "owner" }),
  );
  return { userId: pessoa.id, orgId: org.id };
}

beforeAll(async () => {
  if (!temBanco) return;
  process.env.DATABASE_URL = urlDeTeste;
  process.env.DB_DRIVER = "pg";
  control = await import("./index.js");
});

describe.skipIf(!temBanco)("quem pode entrar", () => {
  test("e-mail desconhecido não recebe código e não entra", async () => {
    const caixa = caixaDeEntrada();
    const email = `estranho-${Date.now()}@metrik.test`;

    const r = await control.pedirCodigo({ email, enviarEmail: caixa });
    // a resposta é a MESMA de quem tem cadastro: não dá para enumerar clientes
    expect(r.enviado).toBe(true);
    // mas nada saiu, e sem código não há entrada possível
    expect(caixa.quantas()).toBe(0);

    await expect(control.entrarComCodigo({ email, codigo: "123456" })).rejects.toThrow(
      /código inválido ou expirado/,
    );
  });

  test("quem já está na plataforma entra", async () => {
    const caixa = caixaDeEntrada();
    const email = `conhecida-${Date.now()}@metrik.test`;
    const { orgId } = await fundar(email);

    await control.pedirCodigo({ email, enviarEmail: caixa });
    expect(caixa.ultima()?.para).toBe(email);

    const sessao = await control.entrarComCodigo({ email, codigo: caixa.codigo() });
    const ctx = await control.resolverSessao(sessao.token);
    expect(ctx.email).toBe(email);
    expect(ctx.orgId).toBe(orgId);
    expect(ctx.role).toBe("owner");
    expect(ctx.via).toBe("sessao");
  });

  test("pessoa sem conta nenhuma não vira dona de uma conta nova", async () => {
    // era isto que deixava a plataforma aberta: todo primeiro acesso criava org
    const { db, users } = await import("@motor/db");
    const email = `avulsa-${Date.now()}@metrik.test`;
    await db.insert(users).values({ email });

    const caixa = caixaDeEntrada();
    await control.pedirCodigo({ email, enviarEmail: caixa });
    await expect(control.entrarComCodigo({ email, codigo: caixa.codigo() })).rejects.toThrow(
      /não faz parte de nenhuma conta/,
    );
  });

  test("a porta do fundador só abre com o banco vazio", async () => {
    await fundar(`gente-${Date.now()}@metrik.test`); // garante que há alguém
    const candidato = `fundador-${Date.now()}@metrik.test`;
    process.env.DONO_INICIAL = candidato;
    try {
      expect(await control.comoPodeEntrar(candidato)).toBeNull();
    } finally {
      delete process.env.DONO_INICIAL;
    }
  });
});

describe.skipIf(!temBanco)("entrar sem senha", () => {
  test("o código só serve uma vez", async () => {
    const caixa = caixaDeEntrada();
    const email = `unico-${Date.now()}@metrik.test`;
    await fundar(email);
    await control.pedirCodigo({ email, enviarEmail: caixa });
    const codigo = caixa.codigo();

    await control.entrarComCodigo({ email, codigo });
    await expect(control.entrarComCodigo({ email, codigo })).rejects.toThrow(/inválido ou expirado/);
  });

  test("código errado não entra, e a mensagem não diz o que estava errado", async () => {
    const caixa = caixaDeEntrada();
    const email = `errado-${Date.now()}@metrik.test`;
    await fundar(email);
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
    await fundar(email);
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
    await fundar(email);
    for (let i = 0; i < 5; i++) await control.pedirCodigo({ email, enviarEmail: caixa });
    await expect(control.pedirCodigo({ email, enviarEmail: caixa })).rejects.toThrow(/muitos pedidos/);
  });
});

describe.skipIf(!temBanco)("sessão", () => {
  test("sair revoga de verdade — a mesma sessão não volta", async () => {
    const caixa = caixaDeEntrada();
    const email = `sair-${Date.now()}@metrik.test`;
    await fundar(email);
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
  test("o convite é a porta de entrada de quem vem de fora", async () => {
    const emailDona = `dona-${Date.now()}@metrik.test`;
    const caixaDona = caixaDeEntrada();
    const dona = await fundar(emailDona);
    await control.pedirCodigo({ email: emailDona, enviarEmail: caixaDona });
    const sessaoDona = await control.entrarComCodigo({ email: emailDona, codigo: caixaDona.codigo() });
    const ctxDona = await control.resolverSessao(sessaoDona.token);

    const caixaConvite = caixaDeEntrada();
    const emailConvidado = `convidado-${Date.now()}@metrik.test`;

    // antes do convite, este e-mail não passa da porta
    const caixaAntes = caixaDeEntrada();
    await control.pedirCodigo({ email: emailConvidado, enviarEmail: caixaAntes });
    expect(caixaAntes.quantas()).toBe(0);

    await control.convidar(ctxDona, { email: emailConvidado, role: "operator", enviarEmail: caixaConvite });
    const tokenConvite = (caixaConvite.ultima()?.texto ?? "").match(/convite\?t=([\w-]+)/)?.[1] ?? "";
    expect(tokenConvite).toBeTruthy();

    // agora o código sai, e a primeira entrada já cai DENTRO da conta certa:
    // aceitar convite exigiria estar logado, e ele ainda está do lado de fora
    const caixaEntrada = caixaDeEntrada();
    await control.pedirCodigo({ email: emailConvidado, enviarEmail: caixaEntrada });
    expect(caixaEntrada.quantas()).toBe(1);
    const convidado = await control.entrarComCodigo({
      email: emailConvidado,
      codigo: caixaEntrada.codigo(),
    });
    const ctxConvidado = await control.resolverSessao(convidado.token);
    expect(ctxConvidado.orgId).toBe(dona.orgId);
    expect(ctxConvidado.role).toBe("operator");

    // e o convite não serve de novo
    await expect(
      control.aceitarConvite({ token: tokenConvite, userId: ctxConvidado.userId }),
    ).rejects.toThrow(/inválido ou expirado/);
  });

  test("convite de outro e-mail não é aceito por quem não é o dono dele", async () => {
    const emailDona = `dona2-${Date.now()}@metrik.test`;
    const caixaDona = caixaDeEntrada();
    await fundar(emailDona);
    await control.pedirCodigo({ email: emailDona, enviarEmail: caixaDona });
    const sessaoDona = await control.entrarComCodigo({ email: emailDona, codigo: caixaDona.codigo() });
    const ctxDona = await control.resolverSessao(sessaoDona.token);

    const caixaConvite = caixaDeEntrada();
    await control.convidar(ctxDona, {
      email: `alvo-${Date.now()}@metrik.test`,
      role: "operator",
      enviarEmail: caixaConvite,
    });
    const tokenConvite = (caixaConvite.ultima()?.texto ?? "").match(/convite\?t=([\w-]+)/)?.[1] ?? "";

    const emailIntrusa = `intrusa-${Date.now()}@metrik.test`;
    const caixaIntrusa = caixaDeEntrada();
    await fundar(emailIntrusa);
    await control.pedirCodigo({ email: emailIntrusa, enviarEmail: caixaIntrusa });
    const intrusa = await control.entrarComCodigo({ email: emailIntrusa, codigo: caixaIntrusa.codigo() });
    const ctxIntrusa = await control.resolverSessao(intrusa.token);

    await expect(
      control.aceitarConvite({ token: tokenConvite, userId: ctxIntrusa.userId }),
    ).rejects.toThrow(/de outro e-mail/);
  });

  test("quem não gerencia não convida", async () => {
    const caixa = caixaDeEntrada();
    const email = `viewer-${Date.now()}@metrik.test`;
    await fundar(email);
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
    await fundar(email);
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

describe.skipIf(!temBanco)("quem acessa a conta", () => {
  test("a lista traz o e-mail da pessoa, e marca a identidade morta do Clerk", async () => {
    const caixa = caixaDeEntrada();
    const email = `lista-${Date.now()}@metrik.test`;
    const { orgId } = await fundar(email);
    await control.pedirCodigo({ email, enviarEmail: caixa });
    const s = await control.entrarComCodigo({ email, codigo: caixa.codigo() });
    const ctx = await control.resolverSessao(s.token);

    // vínculo da época do Clerk: texto que não corresponde a pessoa nenhuma
    const { db, memberships, comConta } = await import("@motor/db");
    const idMorto = `user_2clerk${Date.now()}`;
    await comConta(orgId, () =>
      db.insert(memberships).values({ orgId, userId: idMorto, role: "admin" }),
    );

    const linhas = await control.listMembers(ctx);
    expect(linhas).toHaveLength(2);

    // sem o join, aqui vinha um uuid cru e o dono não se reconhecia na lista
    const eu = linhas.find((l: { userId: string }) => l.userId === ctx.userId);
    expect(eu.email).toBe(email);
    expect(eu.role).toBe("owner");

    const morto = linhas.find((l: { userId: string }) => l.userId === idMorto);
    expect(morto.email).toBeNull();
  });
});
