/**
 * O rastreador de erros contra um Postgres DE VERDADE (S-012).
 *
 * O que se prova: o mesmo erro agrupa numa linha; o aviso sai uma vez por
 * assinatura, e o erro de teste força outro; o erro que ABORTOU a transação da
 * conta ainda assim é gravado (é para isso que existe `foraDoContexto`); a
 * tabela é invisível para a conexão da aplicação; e só operador da plataforma
 * lê a lista.
 *
 * Pulado sem banco (a CI sempre roda).
 */
import { randomBytes } from "node:crypto";
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
  process.env.COFRE_CHAVE = `1:${randomBytes(32).toString("base64")}`;
  bd = await import("@motor/db");
  control = await import("./index.js");
  ({ sql: drizzleSql } = await import("drizzle-orm"));
});

const OPERADORA = "operadora@metrik.test";
const ENV = { OPERADORES_DA_PLATAFORMA: OPERADORA } as NodeJS.ProcessEnv;

function caixa(): EmailPort & { enviadas: Mensagem[] } {
  const enviadas: Mensagem[] = [];
  return {
    modo: "resend",
    enviadas,
    async enviar(msg: Mensagem) {
      enviadas.push(msg);
      return { ok: true, id: "teste" };
    },
  };
}

const marca = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** A linha do erro, lida como dona do banco (a aplicação não enxerga a tabela). */
async function linhaDoErro(onde: string) {
  const r = await bd.db.execute(drizzleSql`select * from erros where onde = ${onde}`);
  const linhas = Array.isArray(r) ? r : r.rows;
  return linhas;
}

async function conta() {
  const [org] = await bd.db.insert(bd.organizations).values({ name: `erros-${marca()}` }).returning();
  return org.id as string;
}

describe.skipIf(!temBanco)("rastreador de erros no banco (S-012)", () => {
  test("o mesmo erro agrupa numa linha, e o aviso sai uma vez só", async () => {
    const onde = `teste:agrupa-${marca()}`;
    const email = caixa();
    const r1 = await control.registrarErro(
      { onde, erro: new Error("registro 3f9a2b1c-0000-4000-8000-000000000001 não encontrado"), requestId: "req-aaaaaaaa1" },
      { email, env: ENV },
    );
    const r2 = await control.registrarErro(
      { onde, erro: new Error("registro 71bc0000-1111-4222-8333-444444444444 não encontrado"), requestId: "req-bbbbbbbb2" },
      { email, env: ENV },
    );
    expect(r1).toEqual({ registrado: true, avisado: true, ocorrencias: 1 });
    expect(r2).toEqual({ registrado: true, avisado: false, ocorrencias: 2 });
    const linhas = await linhaDoErro(onde);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].ocorrencias).toBe(2);
    expect(linhas[0].ultimo_request_id).toBe("req-bbbbbbbb2");
    expect(email.enviadas).toHaveLength(1);
    expect(email.enviadas[0].para).toBe(OPERADORA);
    expect(email.enviadas[0].assunto).toBe(`[Metrik-OS] Erro em ${onde}`);
  });

  test("sem operador configurado, registra e não avisa ninguém", async () => {
    const onde = `teste:sem-operador-${marca()}`;
    const email = caixa();
    const r = await control.registrarErro({ onde, erro: new Error("x") }, { email, env: {} as NodeJS.ProcessEnv });
    expect(r.registrado).toBe(true);
    expect(email.enviadas).toHaveLength(0);
  });

  test("o erro que abortou a transação da conta é gravado mesmo assim", async () => {
    const orgId = await conta();
    const onde = `teste:transacao-abortada-${marca()}`;
    const resultado = await bd
      .comConta(orgId, async () => {
        try {
          await bd.db.execute(drizzleSql`select * from tabela_que_nao_existe`);
        } catch (e) {
          // a transação está abortada aqui (25P02 para qualquer coisa nela)
          const r = await control.registrarErro({ onde, erro: e, orgId }, { email: caixa(), env: ENV });
          throw Object.assign(new Error("propaga"), { registro: r });
        }
      })
      .catch((e: { registro?: unknown }) => e.registro);
    expect(resultado).toMatchObject({ registrado: true });
    const [linha] = await linhaDoErro(onde);
    expect(linha.org_id).toBe(orgId);
    expect(linha.mensagem).toContain("tabela_que_nao_existe");
    expect(linha.mensagem).toContain("42P01");
  });

  test("nada de segredo nem de parâmetro chega à tabela", async () => {
    const onde = `teste:limpeza-${marca()}`;
    const causa = Object.assign(new Error("valor inválido para fulano@cliente.com"), { code: "22P02" });
    const embrulho = new Error("Failed query: select 1 where email = $1\nparams: fulano@cliente.com,npg_SEGREDOSEGREDO", { cause: causa });
    await control.registrarErro({ onde, erro: embrulho }, { email: caixa(), env: ENV });
    const [linha] = await linhaDoErro(onde);
    const tudo = JSON.stringify(linha);
    expect(tudo).not.toContain("fulano@cliente.com");
    expect(tudo).not.toContain("npg_SEGREDO");
    expect(linha.mensagem).toContain("(22P02)");
  });

  test("a tabela é invisível para a conexão da aplicação: nem lê, nem escreve direto", async () => {
    const orgId = await conta();
    await control.registrarErro({ onde: `teste:rls-${marca()}`, erro: new Error("visível só para a dona") }, { email: caixa(), env: ENV });
    const contagem = await bd.comConta(orgId, () => bd.db.execute(drizzleSql`select count(*)::int as n from erros`));
    const n = (Array.isArray(contagem) ? contagem : contagem.rows)[0].n;
    expect(n).toBe(0);
    await expect(
      bd.comConta(orgId, () =>
        bd.db.execute(drizzleSql`insert into erros (assinatura, onde, mensagem) values ('x', 'forjado', 'forjado')`),
      ),
    ).rejects.toBeTruthy();
  });

  test("só operador da plataforma lê a lista; token de máquina nunca", async () => {
    const orgId = await conta();
    const onde = `teste:lista-${marca()}`;
    await control.registrarErro({ onde, erro: new Error("para a lista") }, { email: caixa(), env: ENV });
    const antes = process.env.OPERADORES_DA_PLATAFORMA;
    process.env.OPERADORES_DA_PLATAFORMA = OPERADORA;
    try {
      const operadora = { orgId, actor: OPERADORA, role: "owner", via: "sessao" };
      const lista = await bd.comConta(orgId, () => control.listarErros(operadora));
      expect(lista.some((e: { onde: string }) => e.onde === onde)).toBe(true);

      const outraPessoa = { orgId, actor: "dono-de-conta@cliente.test", role: "owner", via: "sessao" };
      await expect(bd.comConta(orgId, () => control.listarErros(outraPessoa))).rejects.toMatchObject({ status: 403 });

      const maquina = { orgId, actor: OPERADORA, role: "admin", via: "maquina" };
      await expect(bd.comConta(orgId, () => control.listarErros(maquina))).rejects.toMatchObject({ status: 403 });
    } finally {
      process.env.OPERADORES_DA_PLATAFORMA = antes;
    }
  });

  test("o erro de teste força o aviso mesmo logo depois de outro, e diz o modo do e-mail", async () => {
    const orgId = await conta();
    const operadora = { orgId, actor: OPERADORA, role: "owner", via: "sessao" };
    const antes = process.env.OPERADORES_DA_PLATAFORMA;
    process.env.OPERADORES_DA_PLATAFORMA = OPERADORA;
    try {
      const email = caixa();
      const r1 = await bd.comConta(orgId, () => control.registrarErroDeTeste(operadora, {}, { email, env: ENV }));
      const r2 = await bd.comConta(orgId, () => control.registrarErroDeTeste(operadora, {}, { email, env: ENV }));
      expect(r1).toEqual({ registrado: true, avisado: true, destinatarios: 1, email: "resend" });
      expect(r2.avisado).toBe(true);
      expect(email.enviadas).toHaveLength(2);
      await expect(
        bd.comConta(orgId, () => control.registrarErroDeTeste({ ...operadora, actor: "outra@cliente.test" }, {}, { email, env: ENV })),
      ).rejects.toMatchObject({ status: 403 });
    } finally {
      process.env.OPERADORES_DA_PLATAFORMA = antes;
    }
  });

  test("erro da tela entra com a página, sem a query", async () => {
    const orgId = await conta();
    const pessoa = { orgId, actor: "qualquer@cliente.test", role: "viewer", via: "sessao" };
    const texto = `Cannot read properties of undefined ${marca()}`;
    const r = await bd.comConta(orgId, () =>
      control.registrarErroDaTela(pessoa, { mensagem: texto, pagina: "/agentes/abc?token=segredo#x" }, "req-tela-00001"),
    );
    expect(r).toEqual({ registrado: true });
    const [linha] = await linhaDoErro("tela").then((ls: { mensagem: string }[]) => ls.filter((l) => l.mensagem.includes(texto.slice(-10))));
    expect(linha.mensagem).toContain("página /agentes/abc");
    expect(linha.mensagem).not.toContain("segredo");
  });
});
