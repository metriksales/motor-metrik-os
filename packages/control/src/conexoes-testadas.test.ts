/**
 * Conexões com status verdadeiro (S-019), contra um Postgres DE VERDADE.
 *
 * O que se prova aqui não é "o testador devolve a frase certa" (isso é o
 * conexoes.test.ts, sem banco). É o contrato com o banco: o status só muda
 * por um teste, todo teste deixa data e motivo, o cadastro volta ao zero, e
 * o banco recusa "connected" por qualquer caminho — inclusive o SQL direto
 * que nenhum código atual escreve.
 *
 * O provedor é falso (`http` injetado). Pulado sem banco (a CI sempre roda).
 */
import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, test } from "vitest";
import type { Http } from "./conexoes.js";

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
  // o cofre precisa abrir: sem chave, guardar credencial nem começa
  process.env.COFRE_CHAVE = `1:${randomBytes(32).toString("base64")}`;
  bd = await import("@motor/db");
  control = await import("./index.js");
  ({ sql: drizzleSql } = await import("drizzle-orm"));
});

type Ctx = { orgId: string; actor: string; role: "owner" | "admin" | "operator" | "viewer" };

/** Uma conta nova, como dona do banco (é o que a migração/seed faz). */
async function conta(): Promise<{ orgId: string; ctx: Ctx }> {
  const [org] = await bd.db
    .insert(bd.organizations)
    .values({ name: `s019-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })
    .returning();
  return { orgId: org.id, ctx: { orgId: org.id, actor: "teste", role: "owner" } };
}

/** Um provedor que responde sempre a mesma coisa. */
function provedor(body: unknown, status = 200): Http {
  return async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const CONECTADA = {
  instance: { status: "connected", profileName: "Metrik", profilePicUrl: "https://pps.whatsapp.net/foto.jpg" },
  status: { connected: true, loggedIn: true, jid: { user: "5521981740018" } },
};
const DESCONECTADA = { instance: { status: "disconnected" }, status: { connected: false, loggedIn: false } };

/** O motivo real de um erro do banco (o drizzle embrulha; o original está em `cause`). */
function motivo(e: unknown): string {
  const partes: string[] = [];
  let atual: unknown = e;
  while (atual && partes.length < 6) {
    partes.push(atual instanceof Error ? atual.message : String(atual));
    atual = atual instanceof Error ? atual.cause : undefined;
  }
  return partes.join(" ← ");
}

describe.skipIf(!temBanco)("conexões testadas (S-019)", () => {
  test("cadastrar nasce 'nao_testada', sem data — nunca 'connected'", async () => {
    const { orgId, ctx } = await conta();
    const c = await bd.comConta(orgId, () => control.upsertConnection(ctx, { kind: "whatsapp", ref: "linha-1" }));
    expect(c.status).toBe("nao_testada");
    expect(c.ultimoTesteEm).toBeNull();
    expect(c.ultimoTesteDetalhe).toBeNull();
    expect(c.vaultRef).toBe("linha-1");
    expect(c.testavel).toBe(true);
    // o que a tela vê não inclui o hash do segredo de entrada
    expect(Object.keys(c)).not.toContain("inboundSecretHash");
  });

  test("o banco recusa 'connected' por qualquer caminho, e status de teste sem data", async () => {
    const { orgId, ctx } = await conta();
    const c = await bd.comConta(orgId, () => control.upsertConnection(ctx, { kind: "kommo" }));
    await expect(
      bd.db.execute(drizzleSql`update connections set status = 'connected' where id = ${c.id}`),
    ).rejects.toSatisfy((e: unknown) => /connections_status_vem_de_teste/.test(motivo(e)));
    await expect(
      bd.db.execute(drizzleSql`update connections set status = 'ok' where id = ${c.id}`),
    ).rejects.toSatisfy((e: unknown) => /connections_teste_tem_data/.test(motivo(e)));
  });

  test("sem credencial no cofre: 'sem_credencial', com data e com a frase", async () => {
    const { orgId, ctx } = await conta();
    const agora = new Date("2026-09-28T20:00:00.000Z");
    const r = await bd.comConta(orgId, async () => {
      const c = await control.upsertConnection(ctx, { kind: "whatsapp", ref: "linha-1" });
      return control.testarConexao(ctx, { id: c.id }, { http: provedor(CONECTADA), agora: () => agora });
    });
    expect(r.status).toBe("sem_credencial");
    expect(r.ultimoTesteEm.toISOString()).toBe(agora.toISOString());
    expect(r.ultimoTesteDetalhe).toBe('nenhuma credencial "linha-1" do tipo whatsapp guardada no cofre desta conta');
  });

  test("com credencial: o status é o que o provedor disse, e muda quando ele muda", async () => {
    const { orgId, ctx } = await conta();
    const r = await bd.comConta(orgId, async () => {
      await control.guardarCredencial(ctx, {
        kind: "whatsapp",
        rotulo: "linha-1",
        segredo: "token-da-instancia",
        meta: { baseUrl: "https://metrik.uazapi.com" },
      });
      const c = await control.upsertConnection(ctx, { kind: "whatsapp", ref: "linha-1" });
      const ok = await control.testarConexao(ctx, { id: c.id }, { http: provedor(CONECTADA) });
      const caiu = await control.testarConexao(ctx, { id: c.id }, { http: provedor(DESCONECTADA) });
      const lista = await control.listConnections(ctx);
      const trilha = await control.listarAuditoria(ctx);
      return { ok, caiu, lista, trilha };
    });
    expect(r.ok.status).toBe("ok");
    expect(r.ok.ultimoTesteDetalhe).toBe("WhatsApp conectado como Metrik · +5521981740018");
    expect(r.ok.ultimoTesteDados).toEqual({
      estado: "connected",
      nome: "Metrik",
      numero: "5521981740018",
      foto: "https://pps.whatsapp.net/foto.jpg",
    });
    expect(r.caiu.status).toBe("falha");
    expect(r.caiu.ultimoTesteDetalhe).toMatch(/desconectada.*QR code/);
    expect(r.caiu.ultimoTesteDados).toEqual({ estado: "disconnected" });
    expect(r.caiu.ultimoTesteEm.getTime()).toBeGreaterThanOrEqual(r.ok.ultimoTesteEm.getTime());
    // a lista mostra o que o último teste disse — inclusive o que o provedor
    // contou, que é o que a tela precisa no PRÓXIMO carregamento
    expect(r.lista).toHaveLength(1);
    expect(r.lista[0].status).toBe("falha");
    expect(r.lista[0].ultimoTesteDados).toEqual({ estado: "disconnected" });
    // cada teste usou a credencial (registrado) e deixou o próprio rastro
    const acoes = r.trilha.map((l: { action: string }) => l.action);
    expect(acoes.filter((a: string) => a === "credencial.usada")).toHaveLength(2);
    expect(acoes.filter((a: string) => a === "connection.testada")).toHaveLength(2);
    // e o segredo não aparece em lugar nenhum do que voltou
    expect(JSON.stringify(r)).not.toContain("token-da-instancia");
  });

  test("recadastrar apaga o que se sabia: volta a 'nao_testada'", async () => {
    const { orgId, ctx } = await conta();
    const r = await bd.comConta(orgId, async () => {
      await control.guardarCredencial(ctx, { kind: "kommo", segredo: "x", meta: { baseUrl: "https://n.kommo.com" } });
      const c = await control.upsertConnection(ctx, { kind: "kommo" });
      await control.testarConexao(ctx, { id: c.id }, { http: provedor({ id: 1, name: "Norte" }) });
      return control.upsertConnection(ctx, { kind: "kommo" });
    });
    expect(r.status).toBe("nao_testada");
    expect(r.ultimoTesteEm).toBeNull();
    expect(r.ultimoTesteDetalhe).toBeNull();
    expect(r.ultimoTesteDados).toBeNull();
  });

  test("conexão de outra conta: 404, e nada é gravado nela", async () => {
    const a = await conta();
    const b = await conta();
    const c = await bd.comConta(a.orgId, () => control.upsertConnection(a.ctx, { kind: "ghl" }));
    await expect(
      bd.comConta(b.orgId, () => control.testarConexao(b.ctx, { id: c.id }, { http: provedor({}) })),
    ).rejects.toMatchObject({ status: 404 });
    // id que nem é uuid recebe a mesma resposta, sem virar erro de banco
    await expect(
      bd.comConta(b.orgId, () => control.testarConexao(b.ctx, { id: "abc" }, { http: provedor({}) })),
    ).rejects.toMatchObject({ status: 404 });
    const [intacta] = await bd.comConta(a.orgId, () => control.listConnections(a.ctx));
    expect(intacta.status).toBe("nao_testada");
  });

  test("quem pode o quê: leitor não testa, operador testa, só gerente cadastra", async () => {
    const { orgId, ctx } = await conta();
    const c = await bd.comConta(orgId, () => control.upsertConnection(ctx, { kind: "whatsapp" }));
    const leitor: Ctx = { ...ctx, role: "viewer" };
    const operador: Ctx = { ...ctx, role: "operator" };
    await expect(
      bd.comConta(orgId, () => control.testarConexao(leitor, { id: c.id }, { http: provedor({}) })),
    ).rejects.toMatchObject({ status: 403 });
    const r = await bd.comConta(orgId, () => control.testarConexao(operador, { id: c.id }, { http: provedor({}) }));
    expect(r.status).toBe("sem_credencial");
    await expect(
      bd.comConta(orgId, () => control.cadastrarConexao(operador, { kind: "whatsapp", segredo: "t" })),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      bd.comConta(orgId, () => control.upsertConnection(operador, { kind: "ghl" })),
    ).rejects.toMatchObject({ status: 403 });
  });

  test("cadastrarConexao: cofre + conexão + teste numa tacada, e o segredo não volta", async () => {
    const { orgId, ctx } = await conta();
    const r = await bd.comConta(orgId, async () => {
      const cadastro = await control.cadastrarConexao(
        ctx,
        { kind: "whatsapp", rotulo: "vendas", segredo: "tok-vendas", meta: { baseUrl: "https://v.uazapi.com" } },
        { http: provedor(CONECTADA) },
      );
      const credenciais = await control.listarCredenciais(ctx);
      return { cadastro, credenciais };
    });
    expect(r.cadastro.status).toBe("ok");
    expect(r.cadastro.vaultRef).toBe("vendas");
    expect(r.credenciais).toHaveLength(1);
    expect(r.credenciais[0]).toMatchObject({ kind: "whatsapp", rotulo: "vendas" });
    expect(JSON.stringify(r)).not.toContain("tok-vendas");
  });

  test("tipo sem teste: 400 com a frase, e o status fica como estava", async () => {
    const { orgId, ctx } = await conta();
    const c = await bd.comConta(orgId, () => control.upsertConnection(ctx, { kind: "gcal" }));
    expect(c.testavel).toBe(false);
    await expect(
      bd.comConta(orgId, () => control.testarConexao(ctx, { id: c.id }, { http: provedor({}) })),
    ).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/ainda não existe teste.*gcal/) });
    const [depois] = await bd.comConta(orgId, () => control.listConnections(ctx));
    expect(depois.status).toBe("nao_testada");
    // e tipo inventado nem entra
    await expect(
      bd.comConta(orgId, () => control.upsertConnection(ctx, { kind: "telegram" })),
    ).rejects.toMatchObject({ status: 400 });
  });

  test("dois WhatsApp com rótulos diferentes são duas conexões; o mesmo rótulo é uma só", async () => {
    const { orgId, ctx } = await conta();
    const lista = await bd.comConta(orgId, async () => {
      await control.upsertConnection(ctx, { kind: "whatsapp", ref: "vendas" });
      await control.upsertConnection(ctx, { kind: "whatsapp", ref: "suporte" });
      await control.upsertConnection(ctx, { kind: "whatsapp", ref: "vendas" });
      await control.upsertConnection(ctx, { kind: "whatsapp" });
      await control.upsertConnection(ctx, { kind: "whatsapp" });
      return control.listConnections(ctx);
    });
    expect(lista.map((c: { vaultRef: string }) => c.vaultRef).sort()).toEqual(["padrao", "suporte", "vendas"]);
  });
});
