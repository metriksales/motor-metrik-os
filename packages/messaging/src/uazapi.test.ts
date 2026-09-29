/**
 * Envio pela uazapi (S-026), sem rede.
 *
 * O caso que motivou: o transporte devolvia `{ ok: true }` com um id inventado
 * e não enviava nada. Aqui o sucesso só existe quando a resposta TRAZ a
 * mensagem (`messageid`) e o estado dela não é de falha — o HTTP 200 sozinho
 * não basta (regra medida na skill uazapi).
 */
import { describe, expect, test } from "vitest";
import { ESPERA_ENVIO_MS, enviarTextoUazapi, type Fetch } from "./uazapi";
import { UazapiMultiInstanceTransport } from "./transports";

function rede(resposta: { status: number; body?: unknown } | Error) {
  const chamadas: { url: string; init: RequestInit }[] = [];
  const http: Fetch = async (entrada, init) => {
    chamadas.push({ url: String(entrada), init: init ?? {} });
    if (resposta instanceof Error) throw resposta;
    return new Response(resposta.body === undefined ? "" : JSON.stringify(resposta.body), {
      status: resposta.status,
      headers: { "content-type": "application/json" },
    });
  };
  return { http, chamadas };
}

const ENVIO = { base: "https://metrik.uazapi.com/", token: "tok-9", numero: "5561991840065", texto: "Oi." };

describe("enviarTextoUazapi", () => {
  test("200 com messageid: ok, com o id do provedor — e o pedido vai do jeito documentado", async () => {
    const { http, chamadas } = rede({
      status: 200,
      body: { messageid: "3EB0538DA65A59F6D8A251", status: "Sent", response: { status: "success" } },
    });
    const r = await enviarTextoUazapi(http, ENVIO);
    expect(r).toEqual({ ok: true, providerId: "3EB0538DA65A59F6D8A251" });
    expect(chamadas[0].url).toBe("https://metrik.uazapi.com/send/text");
    expect(chamadas[0].init.method).toBe("POST");
    expect((chamadas[0].init.headers as Record<string, string>).token).toBe("tok-9");
    expect(JSON.parse(String(chamadas[0].init.body))).toEqual({ number: "5561991840065", text: "Oi." });
  });

  test("HTTP 200 SEM messageid não é envio", async () => {
    const { http } = rede({ status: 200, body: { response: { status: "success" } } });
    expect(await enviarTextoUazapi(http, ENVIO)).toEqual({ ok: false, error: "A uazapi não confirmou o envio." });
  });

  test("status da mensagem de falha, ou response.status diferente de success", async () => {
    const a = rede({ status: 200, body: { messageid: "x", status: "Failed" } });
    expect(await enviarTextoUazapi(a.http, ENVIO)).toEqual({ ok: false, error: "O WhatsApp não aceitou a mensagem." });
    const b = rede({ status: 200, body: { messageid: "x", response: { status: "error" } } });
    expect(await enviarTextoUazapi(b.http, ENVIO)).toEqual({ ok: false, error: "A uazapi não confirmou o envio." });
  });

  test("401, 429, 463 e outros códigos têm frase própria", async () => {
    const casos: [number, unknown, string][] = [
      [401, { error: "Invalid token" }, "A uazapi recusou o token da instância."],
      [429, { error: "Rate limit exceeded" }, "Limite de envios da uazapi atingido. Aguarde alguns minutos."],
      [500, { error: "WhatsApp server error 463: restricted" }, "O WhatsApp restringiu temporariamente novas conversas nesta conta."],
      [500, { error: "boom" }, "A uazapi recusou o envio (HTTP 500)."],
      [400, { error: "Missing number or text" }, "A uazapi recusou o envio (HTTP 400)."],
    ];
    for (const [status, body, frase] of casos) {
      const { http } = rede({ status, body });
      expect(await enviarTextoUazapi(http, ENVIO)).toEqual({ ok: false, error: frase });
    }
  });

  test("sem endereço, ou com http://, não chama ninguém", async () => {
    const { http, chamadas } = rede({ status: 200, body: { messageid: "x" } });
    expect(await enviarTextoUazapi(http, { ...ENVIO, base: undefined })).toEqual({ ok: false, error: "Falta o endereço da instância." });
    expect(await enviarTextoUazapi(http, { ...ENVIO, base: "http://metrik.uazapi.com" })).toEqual({ ok: false, error: "Falta o endereço da instância." });
    expect(chamadas).toHaveLength(0);
  });

  test("rede fora e tempo esgotado viram frase, nunca exceção", async () => {
    const fora = rede(Object.assign(new Error("ENOTFOUND"), { name: "TypeError" }));
    expect(await enviarTextoUazapi(fora.http, ENVIO)).toEqual({ ok: false, error: "Falha ao conectar a metrik.uazapi.com." });
    const lenta = rede(Object.assign(new Error("timeout"), { name: "TimeoutError" }));
    expect(await enviarTextoUazapi(lenta.http, ENVIO)).toEqual({
      ok: false,
      error: `Sem resposta de metrik.uazapi.com em ${ESPERA_ENVIO_MS / 1000} s.`,
    });
  });
});

describe("UazapiMultiInstanceTransport", () => {
  test("nunca mais devolve sucesso sem enviar: o envio vai para quem envia de verdade", async () => {
    const enviados: unknown[] = [];
    const t = new UazapiMultiInstanceTransport(
      [{ instanceId: "i1", token: "tok-1", baseUrl: "https://a.uazapi.com" }],
      async (e) => {
        enviados.push(e);
        return { ok: false, error: "A uazapi recusou o token da instância." };
      },
    );
    const r = await t.send({ orgId: "o", to: "5561991840065", message: { kind: "text", text: "Oi." } });
    expect(r).toEqual({ ok: false, error: "A uazapi recusou o token da instância." });
    expect(enviados).toEqual([{ base: "https://a.uazapi.com", token: "tok-1", numero: "5561991840065", texto: "Oi." }]);
  });

  test("sem endereço da instância e sem envio injetado: falha dizendo o que falta, sem rede", async () => {
    const t = new UazapiMultiInstanceTransport([{ instanceId: "i1", token: "tok-1" }]);
    const r = await t.send({ orgId: "o", to: "5561991840065", message: { kind: "text", text: "Oi." } });
    expect(r).toEqual({ ok: false, error: "Falta o endereço da instância." });
  });

  test("template e mídia dizem que ainda não existem; sem instância também diz", async () => {
    const t = new UazapiMultiInstanceTransport([{ instanceId: "i1", token: "t", baseUrl: "https://a.uazapi.com" }], async () => ({ ok: true }));
    expect(await t.send({ orgId: "o", to: "1", message: { kind: "template", templateId: "x", variables: {} } })).toEqual({
      ok: false,
      error: "Envio de template pela uazapi ainda não existe.",
    });
    expect(await t.send({ orgId: "o", to: "1", message: { kind: "media", mediaType: "image", url: "https://x/y.jpg" } })).toEqual({
      ok: false,
      error: "Envio de mídia pela uazapi ainda não existe.",
    });
    const vazio = new UazapiMultiInstanceTransport([]);
    expect(await vazio.send({ orgId: "o", to: "1", message: { kind: "text", text: "a" } })).toEqual({
      ok: false,
      error: "Nenhuma instância da uazapi configurada.",
    });
  });

  test("a linha do dono do lead é a escolhida", async () => {
    const tokens: string[] = [];
    const t = new UazapiMultiInstanceTransport(
      [
        { instanceId: "geral", token: "tok-geral", baseUrl: "https://g.uazapi.com" },
        { ownerId: "joao", instanceId: "joao", token: "tok-joao", baseUrl: "https://j.uazapi.com" },
      ],
      async (e) => {
        tokens.push(e.token);
        return { ok: true, providerId: "m1" };
      },
    );
    const r = await t.send({ orgId: "o", to: "5511999999999", ownerId: "joao", message: { kind: "text", text: "a" } });
    expect(r).toEqual({ ok: true, providerId: "m1" });
    expect(tokens).toEqual(["tok-joao"]);
  });
});
