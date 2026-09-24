// Tokens de MÁQUINA — parte pura (sem banco), para poder ser testada sozinha.
// Regra da casa (S-003): a CONTA vem do token, nunca de header. O token em
// claro é mostrado uma única vez; o banco guarda só o sha256.
import { createHash, randomBytes } from "node:crypto";

/** O que um token pode fazer. `admin` implica todos os outros. */
export const ESCOPOS = ["log", "leitura", "mudanca", "admin"] as const;
export type Escopo = (typeof ESCOPOS)[number];

const PREFIXO = "mos_";

/** Gera um token novo: valor em claro, hash para guardar e prefixo para exibir. */
export function novoToken(): { token: string; hash: string; prefix: string } {
  const token = PREFIXO + randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token), prefix: token.slice(0, PREFIXO.length + 6) };
}

/** sha256 em hex. Token tem 256 bits de entropia, então hash rápido serve. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Lê o token do pedido: aceita `Authorization: Bearer mos_…` ou o header
 * `x-motor-token`. Devolve null se não parecer um token de máquina — assim a
 * sessão de usuário (que também usa Bearer) segue o próprio caminho.
 */
export function extrairToken(headers: {
  authorization?: string | string[];
  "x-motor-token"?: string | string[];
}): string | null {
  const bruto = primeiro(headers["x-motor-token"]);
  if (bruto && ehTokenDeMaquina(bruto)) return bruto;

  const auth = primeiro(headers.authorization);
  if (auth?.startsWith("Bearer ")) {
    const valor = auth.slice(7).trim();
    if (ehTokenDeMaquina(valor)) return valor;
  }
  return null;
}

export function ehTokenDeMaquina(valor: string): boolean {
  return valor.startsWith(PREFIXO) && valor.length > PREFIXO.length + 20;
}

/** `admin` abre tudo; fora isso, o escopo pedido tem que estar na lista. */
export function escopoPermite(escopos: readonly string[], exigido: Escopo): boolean {
  if (escopos.includes("admin")) return true;
  return escopos.includes(exigido);
}

/** Normaliza o que veio do banco (jsonb) numa lista de escopos válidos. */
export function normalizarEscopos(valor: unknown): Escopo[] {
  if (!Array.isArray(valor)) return [];
  const validos = valor.filter((e): e is Escopo => ESCOPOS.includes(e as Escopo));
  return [...new Set(validos)];
}

/**
 * Papel equivalente ao conjunto de escopos. Enquanto as permissões finas da
 * S-022 não existem, é isto que limita o que um token alcança nas funções do
 * control plane.
 */
export function papelDoToken(escopos: readonly string[]): "admin" | "operator" | "viewer" {
  if (escopos.includes("admin")) return "admin";
  if (escopos.includes("mudanca")) return "operator";
  return "viewer";
}

function primeiro(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
