// Testes de conexão (S-019) — a pergunta que o sistema sabia fazer e nunca fez.
//
// Uma conexão só está "ok" porque o PROVEDOR disse isso há pouco. Este arquivo
// é a lista de como se pergunta a cada um, e do que se responde ao cliente.
//
// AS FRASES DAQUI APARECEM NA TELA. Seguem a skill `texto-de-tela`: sujeito e
// verbo, maiúscula inicial, ponto no fim, impessoais, sem travessão, sem nome
// interno. "O que aconteceu. O que fazer." Os testes conferem o texto exato.
//
// A rede entra por injeção (`Http`): os testes desta pasta exercitam cada
// resposta documentada sem tocar em provedor nenhum. A chamada real é a mesma
// função, com o `fetch` do Node.
//
// REGRA MEDIDA NO PROJETO (skill uazapi): HTTP 200 não quer dizer que o
// provedor confirmou nada — é um CAMPO da resposta que decide. Aqui, cada
// testador diz qual.
import type { ConnKind } from "@motor/core";

export type Http = typeof fetch;

/** O que o cliente lê. `dados` é o que a tela pode mostrar além da frase. */
export interface Veredito {
  ok: boolean;
  detalhe: string;
  dados?: Record<string, unknown>;
}

/** O que sai do cofre para o testador: o segredo e o meta NÃO secreto. */
export interface EntradaDoTeste {
  segredo: string;
  meta: Record<string, unknown>;
}

export type Testador = (entrada: EntradaDoTeste, http: Http) => Promise<Veredito>;

/**
 * Quanto se espera por cada chamada. O teste roda dentro da transação da
 * conta (o segredo não sai do pacote), então a espera é curta de propósito:
 * o pior caso de um testador — uma chamada e depois duas em paralelo — fica
 * abaixo do tempo de uma função serverless.
 */
export const ESPERA_MS = 4000;

// ── utilitários ────────────────────────────────────────────────────────────

function texto(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** "https://x.uazapi.com/" → "https://x.uazapi.com"; recusa o que não é https. */
function enderecoBase(v: unknown): string | undefined {
  const t = texto(v);
  if (!t) return undefined;
  const semBarra = t.replace(/\/+$/, "");
  return /^https:\/\/[^\s/]+$/i.test(semBarra) ? semBarra : undefined;
}

interface Resposta {
  status: number;
  json: Record<string, unknown> | null;
}

/** Resultado de uma chamada: a resposta, ou a razão (uma frase) de não ter havido uma. */
type Chamada = { resposta: Resposta } | { falha: string };

/**
 * Faz UMA chamada com tempo limite e devolve o que o cliente precisa saber.
 * Nunca lança: rede fora, DNS errado e tempo esgotado viram frase.
 */
async function chamar(http: Http, url: string, init: RequestInit): Promise<Chamada> {
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();
  let res: Response;
  try {
    res = await http(url, { ...init, signal: AbortSignal.timeout(ESPERA_MS) });
  } catch (e) {
    const nome = e instanceof Error ? e.name : "";
    if (nome === "TimeoutError" || nome === "AbortError") {
      return { falha: `Sem resposta de ${host} em ${ESPERA_MS / 1000} s.` };
    }
    return { falha: `Falha ao conectar a ${host}.` };
  }
  let json: Record<string, unknown> | null = null;
  try {
    const corpo = await res.text();
    const lido: unknown = corpo ? JSON.parse(corpo) : null;
    json = lido && typeof lido === "object" && !Array.isArray(lido) ? (lido as Record<string, unknown>) : null;
  } catch {
    json = null;
  }
  return { resposta: { status: res.status, json } };
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function lista(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.map(obj) : [];
}

/** A frase que segue "não existe": " Existem: Vendas, Pós-venda." — ou nada. */
function existem(itens: Record<string, unknown>[]): string {
  const ns = itens.map((i) => texto(i.name)).filter((n): n is string => !!n);
  if (!ns.length) return "";
  return ` Existem: ${ns.slice(0, 6).join(", ")}${ns.length > 6 ? " e outros" : ""}.`;
}

/** "Funil Vendas, etapa Qualificado e calendário Consultas existem." */
function confirmados(partes: string[]): string {
  if (!partes.length) return "";
  const frase = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
  return ` ${frase.charAt(0).toUpperCase()}${frase.slice(1)} ${partes.length === 1 ? "existe" : "existem"}.`;
}

/** Só dígitos, do tamanho de um número de telefone. */
function numeroDeTelefone(v: unknown): string | undefined {
  const t = texto(v)?.replace(/\D/g, "");
  return t && t.length >= 8 && t.length <= 15 ? t : undefined;
}

// ── uazapi (WhatsApp) ──────────────────────────────────────────────────────

const ESTADO_UAZAPI: Record<string, string> = {
  disconnected: "Instância desconectada. Leia o QR code no painel da uazapi.",
  connecting: "Instância aguardando a leitura do QR code.",
  hibernated: "Sessão hibernada. Reconecte a instância no painel da uazapi.",
};

/**
 * `GET /instance/status` com o token da instância no header `token`.
 * O que decide é `status.connected` + `status.loggedIn` (e, na falta deles,
 * `instance.status === "connected"`); o HTTP 200 sozinho não diz nada.
 */
export const testarUazapi: Testador = async ({ segredo, meta }, http) => {
  const base = enderecoBase(meta.baseUrl);
  if (!base) return { ok: false, detalhe: "Falta o endereço da instância." };
  const r = await chamar(http, `${base}/instance/status`, {
    method: "GET",
    headers: { token: segredo, accept: "application/json" },
  });
  if ("falha" in r) return { ok: false, detalhe: r.falha };
  const { status, json } = r.resposta;
  if (status === 401) return { ok: false, detalhe: "A uazapi recusou o token da instância." };
  if (status === 404) return { ok: false, detalhe: "Instância não encontrada nesse endereço." };
  if (status !== 200) return { ok: false, detalhe: `A uazapi respondeu com erro (HTTP ${status}).` };

  const inst = obj(json?.instance);
  const st = obj(json?.status);
  const estado = texto(inst.status);
  const conectado =
    typeof st.connected === "boolean" ? st.connected && st.loggedIn !== false : estado === "connected";
  const nome = texto(inst.profileName) ?? texto(inst.name);
  // o número vem no jid; quando ele falta, o `owner` da instância costuma ser o telefone
  const numero = numeroDeTelefone(obj(st.jid).user) ?? numeroDeTelefone(inst.owner);
  // a foto é uma URL do CDN do WhatsApp; a tela a mostra e cai no ícone se vencer
  const foto = texto(inst.profilePicUrl);
  if (conectado) {
    const dados: Record<string, unknown> = { estado: estado ?? "connected" };
    if (nome) dados.nome = nome;
    if (numero) dados.numero = numero;
    if (foto && /^https:\/\//i.test(foto)) dados.foto = foto;
    // "Conectado como Luã (+55…)." / "Conectado como Luã." / "Conectado (+55…)." / "Conectado."
    const detalhe = nome
      ? `Conectado como ${nome}${numero ? ` (+${numero})` : ""}.`
      : numero
        ? `Conectado (+${numero}).`
        : "Conectado.";
    return { ok: true, detalhe, dados };
  }
  return {
    ok: false,
    detalhe: (estado && ESTADO_UAZAPI[estado]) ?? `Instância não conectada (estado: ${estado ?? "desconhecido"}).`,
    dados: { estado },
  };
};

// ── GoHighLevel ────────────────────────────────────────────────────────────

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

/**
 * 1) `GET /locations/{id}` prova token + subconta.
 * 2) Se a config cita funil/etapa/calendário, confere que EXISTEM na subconta
 *    viva — é o "mapa de IDs" que quebra quando alguém mexe no CRM.
 */
export const testarGhl: Testador = async ({ segredo, meta }, http) => {
  const locationId = texto(meta.locationId);
  if (!locationId) return { ok: false, detalhe: "Falta o id da subconta." };
  const cab = { Authorization: `Bearer ${segredo}`, Version: GHL_VERSION, Accept: "application/json" };

  const loc = await chamar(http, `${GHL_BASE}/locations/${encodeURIComponent(locationId)}`, { method: "GET", headers: cab });
  if ("falha" in loc) return { ok: false, detalhe: loc.falha };
  const { status } = loc.resposta;
  if (status === 401) return { ok: false, detalhe: "O GHL recusou o token." };
  if (status === 403) return { ok: false, detalhe: "O token não tem acesso a essa subconta." };
  if (status === 404) return { ok: false, detalhe: "Subconta não encontrada no GHL." };
  if (status !== 200) return { ok: false, detalhe: `O GHL respondeu com erro (HTTP ${status}).` };
  const subconta = texto(obj(loc.resposta.json?.location).name) ?? locationId;

  const pipelineId = texto(meta.pipelineId);
  const stageId = texto(meta.defaultStageId);
  const calendarId = texto(meta.defaultCalendarId);
  const problemas: string[] = [];
  const partes: string[] = [];

  const conferirFunis = async () => {
    if (!pipelineId && !stageId) return;
    const r = await chamar(http, `${GHL_BASE}/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`, { method: "GET", headers: cab });
    if ("falha" in r) return problemas.push(`Não foi possível conferir os funis. ${r.falha}`);
    if (r.resposta.status !== 200) return problemas.push(`Não foi possível conferir os funis (HTTP ${r.resposta.status}).`);
    const funis = lista(r.resposta.json?.pipelines);
    const funil = pipelineId ? funis.find((f) => String(f.id) === pipelineId) : undefined;
    if (pipelineId && !funil) {
      problemas.push(`O funil ${pipelineId} não existe nesta subconta.${existem(funis)}`);
    } else if (funil) {
      partes.push(`funil ${texto(funil.name) ?? pipelineId}`);
    }
    if (stageId) {
      const onde = funil ? [funil] : funis;
      const etapas = onde.flatMap((f) => lista(f.stages));
      const etapa = etapas.find((s) => String(s.id) === stageId);
      if (!etapa) {
        problemas.push(`A etapa ${stageId} não existe ${funil ? `no funil ${texto(funil.name) ?? pipelineId}` : "em nenhum funil"}.${existem(etapas)}`);
      } else {
        partes.push(`etapa ${texto(etapa.name) ?? stageId}`);
      }
    }
  };

  const conferirCalendario = async () => {
    if (!calendarId) return;
    const r = await chamar(http, `${GHL_BASE}/calendars/?locationId=${encodeURIComponent(locationId)}`, { method: "GET", headers: cab });
    if ("falha" in r) return problemas.push(`Não foi possível conferir os calendários. ${r.falha}`);
    if (r.resposta.status !== 200) return problemas.push(`Não foi possível conferir os calendários (HTTP ${r.resposta.status}).`);
    const cals = lista(r.resposta.json?.calendars);
    const cal = cals.find((c) => String(c.id) === calendarId);
    if (!cal) problemas.push(`O calendário ${calendarId} não existe nesta subconta.${existem(cals)}`);
    else partes.push(`calendário ${texto(cal.name) ?? calendarId}`);
  };

  // duas listas independentes; o GHL não tem a restrição de soquete único da uazapi
  await Promise.all([conferirFunis(), conferirCalendario()]);

  return problemas.length
    ? { ok: false, detalhe: problemas.join(" "), dados: { subconta } }
    : { ok: true, detalhe: `Subconta ${subconta} confirmada.${confirmados(partes)}`, dados: { subconta } };
};

// ── Kommo ──────────────────────────────────────────────────────────────────

/**
 * 1) `GET /api/v4/account` prova token + subdomínio.
 * 2) Se a config cita funil/etapa, confere em `GET /api/v4/leads/pipelines`.
 */
export const testarKommo: Testador = async ({ segredo, meta }, http) => {
  const base = enderecoBase(meta.baseUrl);
  if (!base) return { ok: false, detalhe: "Falta o endereço da conta." };
  const cab = { Authorization: `Bearer ${segredo}`, Accept: "application/json" };

  const conta = await chamar(http, `${base}/api/v4/account`, { method: "GET", headers: cab });
  if ("falha" in conta) return { ok: false, detalhe: conta.falha };
  const { status } = conta.resposta;
  if (status === 401) return { ok: false, detalhe: "O Kommo recusou o token." };
  if (status === 402) return { ok: false, detalhe: "A assinatura do Kommo está suspensa." };
  if (status !== 200) return { ok: false, detalhe: `O Kommo respondeu com erro (HTTP ${status}).` };
  const nome = texto(conta.resposta.json?.name) ?? texto(conta.resposta.json?.subdomain) ?? base;

  const pipelineId = texto(meta.pipelineId);
  const statusId = texto(meta.defaultStatusId);
  const partes: string[] = [];
  const problemas: string[] = [];

  if (pipelineId || statusId) {
    const r = await chamar(http, `${base}/api/v4/leads/pipelines`, { method: "GET", headers: cab });
    if ("falha" in r) problemas.push(`Não foi possível conferir os funis. ${r.falha}`);
    else if (r.resposta.status !== 200) problemas.push(`Não foi possível conferir os funis (HTTP ${r.resposta.status}).`);
    else {
      const funis = lista(obj(r.resposta.json?._embedded).pipelines);
      const funil = pipelineId ? funis.find((f) => String(f.id) === pipelineId) : undefined;
      if (pipelineId && !funil) problemas.push(`O funil ${pipelineId} não existe nesta conta.${existem(funis)}`);
      else if (funil) partes.push(`funil ${texto(funil.name) ?? pipelineId}`);
      if (statusId) {
        const onde = funil ? [funil] : funis;
        const etapas = onde.flatMap((f) => lista(obj(f._embedded).statuses));
        const etapa = etapas.find((s) => String(s.id) === statusId);
        if (!etapa) problemas.push(`A etapa ${statusId} não existe ${funil ? `no funil ${texto(funil.name) ?? pipelineId}` : "em nenhum funil"}.${existem(etapas)}`);
        else partes.push(`etapa ${texto(etapa.name) ?? statusId}`);
      }
    }
  }

  return problemas.length
    ? { ok: false, detalhe: problemas.join(" "), dados: { conta: nome } }
    : { ok: true, detalhe: `Conta ${nome} confirmada.${confirmados(partes)}`, dados: { conta: nome } };
};

// ── registro ───────────────────────────────────────────────────────────────

/** Como se testa cada tipo. Tipo fora daqui ainda não tem teste — e a tela diz isso. */
export const TESTADORES: Partial<Record<ConnKind, Testador>> = {
  whatsapp: testarUazapi,
  ghl: testarGhl,
  kommo: testarKommo,
};

export function testavel(kind: string): kind is keyof typeof TESTADORES {
  return kind in TESTADORES;
}
