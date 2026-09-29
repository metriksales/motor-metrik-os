// Envio real pela uazapi (S-026) — o único lugar que fala `POST /send/text`.
//
// POR QUE EXISTE. O transporte da uazapi devolvia `{ ok: true }` sem enviar
// nada ("stub"). O painel mostraria sucesso sem nenhuma mensagem chegar — a
// cicatriz mais cara da casa. Agora o sucesso vem de um CAMPO da resposta, não
// do HTTP 200 (regra medida na skill uazapi): precisa haver `messageid`, e o
// `status` da mensagem não pode ser de falha.
//
// As frases de erro aparecem na tela (Ao vivo, teste de envio): seguem a skill
// `texto-de-tela`.
import type { SendResult } from "@motor/core";

export type Fetch = typeof fetch;

/** Quanto se espera pelo envio. Mais que o teste de status: a uazapi fala com o WhatsApp antes de responder. */
export const ESPERA_ENVIO_MS = 8000;

export interface EnvioUazapi {
  /** endereço da instância, ex.: https://minha.uazapi.com */
  base: string | undefined;
  /** token da instância — vem do cofre, nunca do código */
  token: string;
  /** número em formato internacional (só dígitos) ou JID */
  numero: string;
  texto: string;
}

/** "https://x.uazapi.com/" → "https://x.uazapi.com"; recusa o que não é https. */
export function enderecoHttps(v: unknown): string | undefined {
  if (typeof v !== "string" || !v.trim()) return undefined;
  const semBarra = v.trim().replace(/\/+$/, "");
  return /^https:\/\/[^\s/]+$/i.test(semBarra) ? semBarra : undefined;
}

function hostDe(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Estados da mensagem que querem dizer "não foi". */
const FALHOU = /^(failed|canceled|cancelled|error)$/i;

export async function enviarTextoUazapi(http: Fetch, envio: EnvioUazapi): Promise<SendResult> {
  const base = enderecoHttps(envio.base);
  if (!base) return { ok: false, error: "Falta o endereço da instância." };
  const url = `${base}/send/text`;

  let res: Response;
  try {
    res = await http(url, {
      method: "POST",
      headers: { token: envio.token, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ number: envio.numero, text: envio.texto }),
      signal: AbortSignal.timeout(ESPERA_ENVIO_MS),
    });
  } catch (e) {
    const nome = e instanceof Error ? e.name : "";
    if (nome === "TimeoutError" || nome === "AbortError") {
      return { ok: false, error: `Sem resposta de ${hostDe(url)} em ${ESPERA_ENVIO_MS / 1000} s.` };
    }
    return { ok: false, error: `Falha ao conectar a ${hostDe(url)}.` };
  }

  let corpo: Record<string, unknown> = {};
  try {
    const t = await res.text();
    const lido: unknown = t ? JSON.parse(t) : {};
    if (lido && typeof lido === "object" && !Array.isArray(lido)) corpo = lido as Record<string, unknown>;
  } catch {
    corpo = {};
  }

  if (res.status === 401) return { ok: false, error: "A uazapi recusou o token da instância." };
  if (res.status === 429) return { ok: false, error: "Limite de envios da uazapi atingido. Aguarde alguns minutos." };
  if (res.status !== 200) {
    const erro = typeof corpo.error === "string" ? corpo.error : "";
    // 463: a CONTA do cliente está restrita pelo WhatsApp — não é erro nosso
    if (/\b463\b/.test(erro)) return { ok: false, error: "O WhatsApp restringiu temporariamente novas conversas nesta conta." };
    return { ok: false, error: `A uazapi recusou o envio (HTTP ${res.status}).` };
  }

  // HTTP 200 não basta: quem decide é a mensagem que voltou
  const messageid = typeof corpo.messageid === "string" && corpo.messageid.trim() ? corpo.messageid.trim() : undefined;
  const status = typeof corpo.status === "string" ? corpo.status : "";
  const resposta = corpo.response && typeof corpo.response === "object" ? (corpo.response as Record<string, unknown>) : {};
  if (typeof resposta.status === "string" && resposta.status !== "success") {
    return { ok: false, error: "A uazapi não confirmou o envio." };
  }
  if (FALHOU.test(status)) return { ok: false, error: "O WhatsApp não aceitou a mensagem." };
  if (!messageid) return { ok: false, error: "A uazapi não confirmou o envio." };
  return { ok: true, providerId: messageid };
}
