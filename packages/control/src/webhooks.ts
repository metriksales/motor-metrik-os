// Entrada de mensagem — parte pura (sem banco), testável sozinha.
//
// Lei (S-004): a CONTA e o AGENTE saem do segredo da conexão, resolvidos no
// servidor. O corpo da requisição não decide tenant nenhum. Sem segredo
// configurado, a porta fica FECHADA — nunca aberta "porque ainda não configurei".
import { createHash, randomBytes } from "node:crypto";

const PREFIXO = "mws_";

/** Segredo de entrada de uma conexão: valor em claro (uma vez) e hash. */
export function novoSegredoEntrada(): { segredo: string; hash: string } {
  const segredo = PREFIXO + randomBytes(24).toString("base64url");
  return { segredo, hash: hashSegredo(segredo) };
}

export function hashSegredo(segredo: string): string {
  return createHash("sha256").update(segredo, "utf8").digest("hex");
}

export function ehSegredoEntrada(valor: string): boolean {
  return valor.startsWith(PREFIXO) && valor.length > PREFIXO.length + 16;
}

/**
 * Lê o segredo do pedido.
 *
 * O header é o caminho preferido. A query é aceita porque vários provedores de
 * WhatsApp só deixam configurar uma URL, sem header — e aí o segredo aparece no
 * log de acesso. Quem usa esse caminho recebe `viaQuery: true` para o handler
 * poder avisar, e a rotação do segredo é por conexão.
 */
export function extrairSegredoEntrada(entrada: {
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
}): { segredo: string; viaQuery: boolean } | null {
  const doHeader = primeiro(entrada.headers?.["x-webhook-secret"]);
  if (doHeader && ehSegredoEntrada(doHeader)) return { segredo: doHeader, viaQuery: false };

  const daQuery = primeiro(entrada.query?.s) ?? primeiro(entrada.query?.secret);
  if (daQuery && ehSegredoEntrada(daQuery)) return { segredo: daQuery, viaQuery: true };

  return null;
}

function primeiro(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
