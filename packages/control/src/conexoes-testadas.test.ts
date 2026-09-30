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
    expect(r.ultimoTesteDetalhe).toBe('Nenhuma credencial guardada no cofre para esta conexão (rótulo "linha-1").');
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
    expect(r.ok.ultimoTesteDetalhe).toBe("Conectado como Metrik (+5521981740018).");
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
    ).rejects.toMatchObject({ status: 400, message: 'Conexões do tipo "gcal" ainda não têm teste.' });
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

describe.skipIf(!temBanco)("mensagem de teste (S-026)", () => {
  /** Um provedor que confirma o envio e anota o que recebeu. */
  function uazapiQueEnvia() {
    const pedidos: { url: string; token: string; corpo: unknown }[] = [];
    const http: Http = async (url, init) => {
      pedidos.push({
        url: String(url),
        token: (init?.headers as Record<string, string>).token,
        corpo: JSON.parse(String(init?.body)),
      });
      return new Response(JSON.stringify({ messageid: "3EB0ABC", status: "Sent" }), { status: 200 });
    };
    return { http, pedidos };
  }

  test("envia pela instância com o token do cofre, e a auditoria guarda só o final do número", async () => {
    const { orgId, ctx } = await conta();
    const { http, pedidos } = uazapiQueEnvia();
    const r = await bd.comConta(orgId, async () => {
      await control.guardarCredencial(ctx, {
        kind: "whatsapp",
        segredo: "token-da-linha",
        meta: { baseUrl: "https://metrik.uazapi.com" },
      });
      const c = await control.upsertConnection(ctx, { kind: "whatsapp" });
      const envio = await control.enviarMensagemDeTeste(ctx, { id: c.id, numero: "+55 (61) 99184-0065" }, { http });
      const trilha = await control.listarAuditoria(ctx);
      return { envio, trilha };
    });
    expect(r.envio).toEqual({ ok: true, detalhe: "Mensagem enviada. A uazapi confirmou o envio." });
    expect(pedidos).toEqual([
      {
        url: "https://metrik.uazapi.com/send/text",
        token: "token-da-linha",
        corpo: { number: "5561991840065", text: "Mensagem de teste do Metrik-OS." },
      },
    ]);
    const linha = r.trilha.find((l: { action: string }) => l.action === "connection.mensagem_teste");
    expect(linha.data).toEqual({ final: "0065", ok: true });
    // o número inteiro não fica em lugar nenhum da trilha
    expect(JSON.stringify(r.trilha)).not.toContain("5561991840065");
    expect(JSON.stringify(r)).not.toContain("token-da-linha");
  });

  test("a frase do provedor chega inteira quando o envio falha", async () => {
    const { orgId, ctx } = await conta();
    const recusa: Http = async () => new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
    const r = await bd.comConta(orgId, async () => {
      await control.guardarCredencial(ctx, { kind: "whatsapp", segredo: "x", meta: { baseUrl: "https://m.uazapi.com" } });
      const c = await control.upsertConnection(ctx, { kind: "whatsapp" });
      return control.enviarMensagemDeTeste(ctx, { id: c.id, numero: "5561991840065" }, { http: recusa });
    });
    expect(r).toEqual({ ok: false, detalhe: "A uazapi recusou o token da instância." });
  });

  test("número inválido, conexão que não é WhatsApp e operador: recusados antes de enviar", async () => {
    const { orgId, ctx } = await conta();
    const { http, pedidos } = uazapiQueEnvia();
    const [whats, kommo] = await bd.comConta(orgId, async () => [
      await control.upsertConnection(ctx, { kind: "whatsapp" }),
      await control.upsertConnection(ctx, { kind: "kommo" }),
    ]);
    await expect(
      bd.comConta(orgId, () => control.enviarMensagemDeTeste(ctx, { id: whats.id, numero: "123" }, { http })),
    ).rejects.toMatchObject({ status: 400, message: "Número inválido. Use o formato internacional, com DDI e DDD." });
    await expect(
      bd.comConta(orgId, () => control.enviarMensagemDeTeste(ctx, { id: kommo.id, numero: "5561991840065" }, { http })),
    ).rejects.toMatchObject({ status: 400, message: "Mensagem de teste só existe para conexões de WhatsApp." });
    await expect(
      bd.comConta(orgId, () =>
        control.enviarMensagemDeTeste({ ...ctx, role: "operator" }, { id: whats.id, numero: "5561991840065" }, { http }),
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(pedidos).toHaveLength(0);
  });

  test("o teste de conexão guarda para onde a instância manda os eventos — só o host", async () => {
    const { orgId, ctx } = await conta();
    const http: Http = async (url) =>
      String(url).endsWith("/webhook")
        ? new Response(JSON.stringify([{ enabled: true, url: "https://sistema.test/api/group-reader?secret=abc123", events: ["messages"] }]), { status: 200 })
        : new Response(JSON.stringify(CONECTADA), { status: 200 });
    const r = await bd.comConta(orgId, () =>
      control.cadastrarConexao(
        ctx,
        { kind: "whatsapp", segredo: "t", meta: { baseUrl: "https://m.uazapi.com" } },
        { http, nossosHosts: ["sistema.test"] },
      ),
    );
    expect(r.ultimoTesteDados.webhooks).toEqual([{ host: "sistema.test", ativo: true, destino: "grupos", eventos: ["messages"] }]);
    expect(JSON.stringify(r)).not.toContain("abc123");
  });
});

describe.skipIf(!temBanco)("conectar o WhatsApp pela plataforma", () => {
  const QR = `data:image/png;base64,${"Q".repeat(120)}`;

  async function whatsappComToken(ctx: Ctx, orgId: string) {
    return bd.comConta(orgId, async () => {
      await control.guardarCredencial(ctx, { kind: "whatsapp", segredo: "tok-linha", meta: { baseUrl: "https://m.uazapi.com" } });
      return control.upsertConnection(ctx, { kind: "whatsapp" });
    });
  }

  /** Uma uazapi falsa que responde o status dado e anota cada chamada. */
  function uazapi(status: unknown, statusHttp = 200) {
    const chamadas: { url: string; metodo: string; token: string }[] = [];
    const http: Http = async (url, init) => {
      chamadas.push({ url: String(url), metodo: init?.method ?? "GET", token: (init?.headers as Record<string, string>).token });
      if (String(url).endsWith("/instance/connect")) {
        return new Response(JSON.stringify({ connected: false, instance: { status: "connecting", qrcode: QR, name: "metrik-01" } }), { status: 200 });
      }
      if (String(url).endsWith("/webhook")) return new Response("[]", { status: 200 });
      return new Response(JSON.stringify(status), { status: statusHttp });
    };
    return { http, chamadas, conectou: () => chamadas.some((c) => c.url.endsWith("/instance/connect")) };
  }

  test("CICATRIZ 30/09: instância CONECTADA — nada é pedido à uazapi, o cartão só é atualizado", async () => {
    const { orgId, ctx } = await conta();
    const c = await whatsappComToken(ctx, orgId);
    // o registro velho diz "fora do ar" — era isso que fazia o botão aparecer
    const u = uazapi(CONECTADA);
    const r = await bd.comConta(orgId, async () => {
      const estado = await control.conectarWhatsApp(ctx, { id: c.id }, { http: u.http });
      const trilha = await control.listarAuditoria(ctx);
      return { estado, trilha };
    });
    expect(u.conectou()).toBe(false);
    expect(r.estado.conectado).toBe(true);
    expect(r.estado.detalhe).toBe("A instância já está conectada. Nada foi alterado.");
    expect(r.estado.conexao.status).toBe("ok");
    expect(r.estado.qrcode).toBeUndefined();
    const pedido = r.trilha.find((l: { action: string }) => l.action === "connection.conectar");
    expect(pedido.data).toEqual({ modo: "qrcode", conectado: true, acionou: false });
  });

  test("desconectada: consulta, depois pede o QR — e nem o QR nem o token ficam na auditoria", async () => {
    const { orgId, ctx } = await conta();
    const c = await whatsappComToken(ctx, orgId);
    const u = uazapi({ instance: { status: "disconnected", name: "metrik-01" }, status: { connected: false } });
    const r = await bd.comConta(orgId, async () => {
      const estado = await control.conectarWhatsApp(ctx, { id: c.id }, { http: u.http });
      const trilha = await control.listarAuditoria(ctx);
      return { estado, trilha };
    });
    expect(u.chamadas.map((x) => `${x.metodo} ${x.url.replace("https://m.uazapi.com", "")}`)).toEqual([
      "GET /instance/status",
      "POST /instance/connect",
    ]);
    expect(u.chamadas.every((x) => x.token === "tok-linha")).toBe(true);
    expect(r.estado.qrcode).toBe(QR);
    const pedido = r.trilha.find((l: { action: string }) => l.action === "connection.conectar");
    expect(pedido.data).toEqual({ modo: "qrcode", conectado: false, acionou: true });
    expect(JSON.stringify(r.trilha)).not.toContain("QQQQ");
    expect(JSON.stringify(r.trilha)).not.toContain("tok-linha");
  });

  test("já em conexão com QR vigente: devolve o mesmo QR, sem reiniciar nada", async () => {
    const { orgId, ctx } = await conta();
    const c = await whatsappComToken(ctx, orgId);
    const u = uazapi({ instance: { status: "connecting", qrcode: QR }, status: { connected: false } });
    const r = await bd.comConta(orgId, () => control.conectarWhatsApp(ctx, { id: c.id }, { http: u.http }));
    expect(u.conectou()).toBe(false);
    expect(r.qrcode).toBe(QR);
  });

  test("estado desconhecido (token recusado): não arrisca e diz que nada foi alterado", async () => {
    const { orgId, ctx } = await conta();
    const c = await whatsappComToken(ctx, orgId);
    const u = uazapi({ error: "Invalid token" }, 401);
    const r = await bd.comConta(orgId, () => control.conectarWhatsApp(ctx, { id: c.id }, { http: u.http }));
    expect(u.conectou()).toBe(false);
    expect(r).toEqual({ conectado: false, detalhe: "A uazapi recusou o token da instância. Nada foi alterado." });
  });

  test("quando a instância conecta, o acompanhamento grava 'ok' e devolve a conexão testada", async () => {
    const { orgId, ctx } = await conta();
    const c = await whatsappComToken(ctx, orgId);
    const conectada: Http = async (url) =>
      String(url).endsWith("/webhook")
        ? new Response("[]", { status: 200 })
        : new Response(JSON.stringify(CONECTADA), { status: 200 });
    const aguardando: Http = async () =>
      new Response(JSON.stringify({ instance: { status: "connecting", qrcode: QR } }), { status: 200 });

    const antes = await bd.comConta(orgId, () => control.acompanharWhatsApp(ctx, { id: c.id }, { http: aguardando }));
    expect(antes.conectado).toBe(false);
    expect(antes.conexao).toBeUndefined();

    const depois = await bd.comConta(orgId, () => control.acompanharWhatsApp(ctx, { id: c.id }, { http: conectada }));
    expect(depois.conectado).toBe(true);
    expect(depois.conexao.status).toBe("ok");
    expect(depois.conexao.ultimoTesteDados.numero).toBe("5521981740018");
    const [gravada] = await bd.comConta(orgId, () => control.listConnections(ctx));
    expect(gravada.status).toBe("ok");
  });

  test("operador não conecta; conexão que não é WhatsApp e telefone inválido são recusados", async () => {
    const { orgId, ctx } = await conta();
    const c = await whatsappComToken(ctx, orgId);
    const kommo = await bd.comConta(orgId, () => control.upsertConnection(ctx, { kind: "kommo" }));
    const http: Http = async () => new Response("{}", { status: 200 });
    await expect(
      bd.comConta(orgId, () => control.conectarWhatsApp({ ...ctx, role: "operator" }, { id: c.id }, { http })),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      bd.comConta(orgId, () => control.conectarWhatsApp(ctx, { id: kommo.id }, { http })),
    ).rejects.toMatchObject({ status: 400, message: "Só conexões de WhatsApp se conectam por QR code." });
    await expect(
      bd.comConta(orgId, () => control.conectarWhatsApp(ctx, { id: c.id, telefone: "123" }, { http })),
    ).rejects.toMatchObject({ status: 400, message: "Número inválido. Use o formato internacional, com DDI e DDD." });
  });
});
