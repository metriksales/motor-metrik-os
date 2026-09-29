/**
 * Testadores de conexão (S-019), sem rede.
 *
 * Cada resposta documentada pelo provedor vira um caso, e o que se confere é a
 * FRASE que o cliente lê — não o código HTTP. A regra medida na skill da
 * uazapi ("HTTP 200 não quer dizer que aceitou; um campo decide") é o primeiro
 * teste, porque foi o erro que já custou uma acusação falsa noutro projeto.
 *
 * As frases seguem a skill `texto-de-tela`, e por isso vários casos conferem o
 * texto EXATO: maiúscula, ponto, sem travessão, "o que aconteceu, o que fazer".
 */
import { describe, expect, test } from "vitest";
import { ESPERA_MS, TESTADORES, testarGhl, testarKommo, testarUazapi, testavel, type Http } from "./conexoes.js";

/** Um `fetch` de mentira: responde por URL e anota o que recebeu. */
function rede(respostas: Record<string, { status: number; body?: unknown } | Error>) {
  const chamadas: { url: string; headers: Record<string, string> }[] = [];
  const http: Http = async (entrada, init) => {
    const url = String(entrada);
    chamadas.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const chave = Object.keys(respostas).find((k) => url.includes(k));
    const r = chave ? respostas[chave] : { status: 404 };
    if (r instanceof Error) throw r;
    return new Response(r.body === undefined ? "" : JSON.stringify(r.body), {
      status: r.status,
      headers: { "content-type": "application/json" },
    });
  };
  return { http, chamadas };
}

const uazapiOk = {
  instance: {
    id: "r1",
    name: "linha-1",
    status: "connected",
    profileName: "Metrik",
    profilePicUrl: "https://pps.whatsapp.net/v/t61/foto.jpg",
  },
  status: { connected: true, loggedIn: true, jid: { user: "5521981740018", server: "s.whatsapp.net" } },
};

describe("uazapi (WhatsApp)", () => {
  test("HTTP 200 com connected=false NÃO é ok — o campo decide, não o status", async () => {
    const { http } = rede({
      "/instance/status": {
        status: 200,
        body: { instance: { status: "disconnected" }, status: { connected: false, loggedIn: false } },
      },
    });
    const v = await testarUazapi({ segredo: "tok", meta: { baseUrl: "https://x.uazapi.com" } }, http);
    expect(v.ok).toBe(false);
    expect(v.detalhe).toBe("Instância desconectada. Leia o QR code no painel da uazapi.");
  });

  test("conectada: diz com quem, e manda o token no header certo", async () => {
    const { http, chamadas } = rede({ "/instance/status": { status: 200, body: uazapiOk } });
    const v = await testarUazapi({ segredo: "tok-123", meta: { baseUrl: "https://x.uazapi.com/" } }, http);
    expect(v.ok).toBe(true);
    expect(v.detalhe).toBe("Conectado como Metrik (+5521981740018).");
    expect(chamadas[0].url).toBe("https://x.uazapi.com/instance/status");
    expect(chamadas[0].headers.token).toBe("tok-123");
    // o segredo nunca vai parar na frase
    expect(v.detalhe).not.toContain("tok-123");
    // o que o provedor contou, para a tela mostrar — só chaves presentes
    expect(v.dados).toEqual({
      estado: "connected",
      nome: "Metrik",
      numero: "5521981740018",
      foto: "https://pps.whatsapp.net/v/t61/foto.jpg",
    });
  });

  test("sem jid, o número vem do owner da instância; foto que não é https fica de fora", async () => {
    const { http } = rede({
      "/instance/status": {
        status: 200,
        body: {
          instance: { status: "connected", owner: "5521981740018", profilePicUrl: "data:image/png;base64,AAAA" },
          status: { connected: true, loggedIn: true, jid: null },
        },
      },
    });
    const v = await testarUazapi({ segredo: "t", meta: { baseUrl: "https://x.uazapi.com" } }, http);
    expect(v.ok).toBe(true);
    expect(v.detalhe).toBe("Conectado (+5521981740018).");
    expect(v.dados).toEqual({ estado: "connected", numero: "5521981740018" });
  });

  test("sem nome nem número: 'Conectado.'", async () => {
    const { http } = rede({
      "/instance/status": { status: 200, body: { instance: { status: "connected", owner: "user@example.com" }, status: { connected: true, loggedIn: true } } },
    });
    const v = await testarUazapi({ segredo: "t", meta: { baseUrl: "https://x.uazapi.com" } }, http);
    expect(v.detalhe).toBe("Conectado.");
    expect(v.dados).toEqual({ estado: "connected" });
  });

  test("sem os booleanos, vale o estado da instância", async () => {
    const { http } = rede({ "/instance/status": { status: 200, body: { instance: { status: "connecting" } } } });
    const v = await testarUazapi({ segredo: "t", meta: { baseUrl: "https://x.uazapi.com" } }, http);
    expect(v.ok).toBe(false);
    expect(v.detalhe).toBe("Instância aguardando a leitura do QR code.");
  });

  test("401 é token recusado; 404 é instância inexistente; outro código vem com o número", async () => {
    const a = rede({ "/instance/status": { status: 401, body: { error: "instance info not found" } } });
    expect((await testarUazapi({ segredo: "t", meta: { baseUrl: "https://x.uazapi.com" } }, a.http)).detalhe).toBe("A uazapi recusou o token da instância.");
    const b = rede({ "/instance/status": { status: 404 } });
    expect((await testarUazapi({ segredo: "t", meta: { baseUrl: "https://x.uazapi.com" } }, b.http)).detalhe).toBe("Instância não encontrada nesse endereço.");
    const c = rede({ "/instance/status": { status: 503 } });
    expect((await testarUazapi({ segredo: "t", meta: { baseUrl: "https://x.uazapi.com" } }, c.http)).detalhe).toBe("A uazapi respondeu com erro (HTTP 503).");
  });

  test("sem baseUrl (ou com http://) não chama ninguém e explica o que falta, sem nome interno", async () => {
    const { http, chamadas } = rede({});
    const v1 = await testarUazapi({ segredo: "t", meta: {} }, http);
    const v2 = await testarUazapi({ segredo: "t", meta: { baseUrl: "http://x.uazapi.com" } }, http);
    expect(v1.ok).toBe(false);
    expect(v1.detalhe).toBe("Falta o endereço da instância.");
    expect(v2.ok).toBe(false);
    expect(chamadas).toHaveLength(0);
  });

  test("rede fora e tempo esgotado viram frase, nunca exceção", async () => {
    const fora = rede({ "/instance/status": Object.assign(new Error("getaddrinfo ENOTFOUND"), { name: "TypeError" }) });
    const v1 = await testarUazapi({ segredo: "t", meta: { baseUrl: "https://nao-existe.uazapi.com" } }, fora.http);
    expect(v1.ok).toBe(false);
    expect(v1.detalhe).toBe("Falha ao conectar a nao-existe.uazapi.com.");

    const lenta = rede({ "/instance/status": Object.assign(new Error("timeout"), { name: "TimeoutError" }) });
    const v2 = await testarUazapi({ segredo: "t", meta: { baseUrl: "https://x.uazapi.com" } }, lenta.http);
    expect(v2.detalhe).toBe(`Sem resposta de x.uazapi.com em ${ESPERA_MS / 1000} s.`);
  });
});

const ghlLoc = { status: 200, body: { location: { id: "loc1", name: "Clínica Sorriso" } } };
const ghlFunis = {
  status: 200,
  body: {
    pipelines: [
      { id: "p1", name: "Vendas", stages: [{ id: "s1", name: "Novo" }, { id: "s2", name: "Qualificado" }] },
      { id: "p2", name: "Pós-venda", stages: [{ id: "s9", name: "Entregue" }] },
    ],
  },
};
const ghlCals = { status: 200, body: { calendars: [{ id: "c1", name: "Consultas" }] } };

describe("GoHighLevel", () => {
  test("token + subconta + mapa de IDs inteiro: duas frases, com os nomes", async () => {
    const { http, chamadas } = rede({ "/locations/loc1": ghlLoc, "/opportunities/pipelines": ghlFunis, "/calendars/": ghlCals });
    const v = await testarGhl(
      { segredo: "pit", meta: { locationId: "loc1", pipelineId: "p1", defaultStageId: "s2", defaultCalendarId: "c1" } },
      http,
    );
    expect(v.ok).toBe(true);
    expect(v.detalhe).toBe("Subconta Clínica Sorriso confirmada. Funil Vendas, etapa Qualificado e calendário Consultas existem.");
    expect(chamadas[0].headers.Authorization).toBe("Bearer pit");
    expect(chamadas[0].headers.Version).toBe("2021-07-28");
  });

  test("mapa de IDs quebrado: diz qual id, e o que existe no lugar", async () => {
    const { http } = rede({ "/locations/loc1": ghlLoc, "/opportunities/pipelines": ghlFunis, "/calendars/": ghlCals });
    const v = await testarGhl(
      { segredo: "pit", meta: { locationId: "loc1", pipelineId: "p1", defaultStageId: "s9", defaultCalendarId: "c-sumiu" } },
      http,
    );
    expect(v.ok).toBe(false);
    // s9 existe, mas no OUTRO funil — o teste olha dentro do funil configurado
    expect(v.detalhe).toContain("A etapa s9 não existe no funil Vendas. Existem: Novo, Qualificado.");
    expect(v.detalhe).toContain("O calendário c-sumiu não existe nesta subconta. Existem: Consultas.");
  });

  test("só a subconta, sem ids configurados: uma chamada e uma frase", async () => {
    const { http, chamadas } = rede({ "/locations/loc1": ghlLoc });
    const v = await testarGhl({ segredo: "pit", meta: { locationId: "loc1" } }, http);
    expect(v.ok).toBe(true);
    expect(v.detalhe).toBe("Subconta Clínica Sorriso confirmada.");
    expect(chamadas).toHaveLength(1);
  });

  test("só o funil confere: 'Funil Vendas existe.'", async () => {
    const { http } = rede({ "/locations/loc1": ghlLoc, "/opportunities/pipelines": ghlFunis });
    const v = await testarGhl({ segredo: "pit", meta: { locationId: "loc1", pipelineId: "p1" } }, http);
    expect(v.detalhe).toBe("Subconta Clínica Sorriso confirmada. Funil Vendas existe.");
  });

  test("401/403/404 na subconta, e a lista de funis fora do escopo", async () => {
    for (const [status, frase] of [
      [401, "O GHL recusou o token."],
      [403, "O token não tem acesso a essa subconta."],
      [404, "Subconta não encontrada no GHL."],
    ] as const) {
      const { http } = rede({ "/locations/loc1": { status } });
      const v = await testarGhl({ segredo: "pit", meta: { locationId: "loc1" } }, http);
      expect(v.ok).toBe(false);
      expect(v.detalhe).toBe(frase);
    }
    const { http } = rede({ "/locations/loc1": ghlLoc, "/opportunities/pipelines": { status: 403 } });
    const v = await testarGhl({ segredo: "pit", meta: { locationId: "loc1", pipelineId: "p1" } }, http);
    expect(v.ok).toBe(false);
    expect(v.detalhe).toBe("Não foi possível conferir os funis (HTTP 403).");
  });

  test("sem locationId não chama ninguém", async () => {
    const { http, chamadas } = rede({});
    const v = await testarGhl({ segredo: "pit", meta: {} }, http);
    expect(v.ok).toBe(false);
    expect(v.detalhe).toBe("Falta o id da subconta.");
    expect(chamadas).toHaveLength(0);
  });
});

const kommoConta = { status: 200, body: { id: 1, name: "Imobiliária Norte", subdomain: "norte" } };
const kommoFunis = {
  status: 200,
  body: {
    _embedded: {
      pipelines: [
        { id: 100, name: "Locação", _embedded: { statuses: [{ id: 1001, name: "Contato" }, { id: 1002, name: "Visita" }] } },
      ],
    },
  },
};

describe("Kommo", () => {
  test("conta + funil + etapa, ids numéricos comparados como texto", async () => {
    const { http, chamadas } = rede({ "/api/v4/account": kommoConta, "/api/v4/leads/pipelines": kommoFunis });
    const v = await testarKommo(
      { segredo: "ll", meta: { baseUrl: "https://norte.kommo.com/", pipelineId: "100", defaultStatusId: "1002" } },
      http,
    );
    expect(v.ok).toBe(true);
    expect(v.detalhe).toBe("Conta Imobiliária Norte confirmada. Funil Locação e etapa Visita existem.");
    expect(chamadas[0].url).toBe("https://norte.kommo.com/api/v4/account");
    expect(chamadas[0].headers.Authorization).toBe("Bearer ll");
  });

  test("etapa que não existe no funil", async () => {
    const { http } = rede({ "/api/v4/account": kommoConta, "/api/v4/leads/pipelines": kommoFunis });
    const v = await testarKommo({ segredo: "ll", meta: { baseUrl: "https://norte.kommo.com", pipelineId: "100", defaultStatusId: "42" } }, http);
    expect(v.ok).toBe(false);
    expect(v.detalhe).toBe("A etapa 42 não existe no funil Locação. Existem: Contato, Visita.");
  });

  test("401 e 402 têm frase própria; sem baseUrl não chama", async () => {
    const a = rede({ "/api/v4/account": { status: 401 } });
    expect((await testarKommo({ segredo: "ll", meta: { baseUrl: "https://n.kommo.com" } }, a.http)).detalhe).toBe("O Kommo recusou o token.");
    const b = rede({ "/api/v4/account": { status: 402 } });
    expect((await testarKommo({ segredo: "ll", meta: { baseUrl: "https://n.kommo.com" } }, b.http)).detalhe).toBe("A assinatura do Kommo está suspensa.");
    const c = rede({});
    const v = await testarKommo({ segredo: "ll", meta: {} }, c.http);
    expect(v.detalhe).toBe("Falta o endereço da conta.");
    expect(c.chamadas).toHaveLength(0);
  });
});

describe("texto de tela", () => {
  test("toda frase começa em maiúscula, termina em ponto e não tem travessão", async () => {
    const casos: Promise<{ detalhe: string }>[] = [
      testarUazapi({ segredo: "t", meta: {} }, rede({}).http),
      testarUazapi({ segredo: "t", meta: { baseUrl: "https://x.uazapi.com" } }, rede({ "/instance/status": { status: 200, body: uazapiOk } }).http),
      testarUazapi({ segredo: "t", meta: { baseUrl: "https://x.uazapi.com" } }, rede({ "/instance/status": { status: 200, body: { instance: { status: "hibernated" } } } }).http),
      testarGhl({ segredo: "p", meta: { locationId: "loc1", pipelineId: "p9" } }, rede({ "/locations/loc1": ghlLoc, "/opportunities/pipelines": ghlFunis }).http),
      testarKommo({ segredo: "l", meta: { baseUrl: "https://n.kommo.com", pipelineId: "100", defaultStatusId: "1002" } }, rede({ "/api/v4/account": kommoConta, "/api/v4/leads/pipelines": kommoFunis }).http),
    ];
    for (const v of await Promise.all(casos)) {
      expect(v.detalhe, v.detalhe).toMatch(/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/);
      expect(v.detalhe, v.detalhe).toMatch(/\.$/);
      expect(v.detalhe, v.detalhe).not.toMatch(/[—;…!]/);
    }
  });
});

describe("registro", () => {
  test("whatsapp, ghl e kommo têm teste; os outros tipos não fingem", () => {
    expect(testavel("whatsapp")).toBe(true);
    expect(testavel("ghl")).toBe(true);
    expect(testavel("kommo")).toBe(true);
    expect(testavel("gcal")).toBe(false);
    expect(testavel("advbox")).toBe(false);
    expect(Object.keys(TESTADORES).sort()).toEqual(["ghl", "kommo", "whatsapp"]);
  });
});
