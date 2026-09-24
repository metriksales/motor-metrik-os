// Autenticação própria — parte pura (S-045), sem banco e sem framework.
//
// Desenho, e o porquê de cada escolha:
// • SEM SENHA. A entrada é por código de 6 dígitos no e-mail. Não guardamos
//   hash de senha (não há o que vazar), não existe fluxo de redefinição, e
//   ninguém reusa aqui a senha que já vazou noutro site.
// • Sessão em COOKIE `httpOnly`, com token OPACO guardado em hash. Não é JWT:
//   com JWT não dá para revogar de verdade antes de expirar.
// • Cookie traz CSRF junto, porque sair de "token no header" para cookie cria
//   essa superfície — o header some, o navegador manda sozinho.
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const COOKIE_SESSAO = "mos_sessao";
export const COOKIE_CSRF = "mos_csrf";
export const HEADER_CSRF = "x-csrf-token";

/** 30 dias: longo o bastante para não irritar, curto para limitar roubo. */
export const SESSAO_DIAS = 30;
/** O código morre rápido — ele é a chave da conta enquanto vale. */
export const CODIGO_MINUTOS = 10;
/** Erros no mesmo código antes de queimá-lo. */
export const CODIGO_TENTATIVAS = 5;
/** Convite vale uma semana. */
export const CONVITE_DIAS = 7;

export function hash(valor: string): string {
  return createHash("sha256").update(valor, "utf8").digest("hex");
}

/** Token opaco de sessão/convite: 32 bytes, e só o hash vai para o banco.
 *  (`novoToken` de `tokens.ts` é o de MÁQUINA — nomes distintos de propósito.) */
export function novoTokenOpaco(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hash(token) };
}

/** Código de 6 dígitos. `randomInt` é sorteio criptográfico, não `Math.random`. */
export function novoCodigo(): { codigo: string; hash: string } {
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
  return { codigo, hash: hash(codigo) };
}

/**
 * Compara em tempo constante. Aqui vale a pena de verdade: o código tem só 6
 * dígitos, então vazar tempo por caractere reduz o espaço de busca.
 */
export function iguais(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** E-mail normalizado: minúsculo e sem espaço em volta. */
export function normalizarEmail(email: string): string {
  return String(email ?? "").trim().toLowerCase();
}

export function emailValido(email: string): boolean {
  const e = normalizarEmail(email);
  // simples de propósito: quem valida de verdade é o e-mail que chega (ou não)
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254;
}

export function expiraEm(minutos: number, agora = new Date()): Date {
  return new Date(agora.getTime() + minutos * 60_000);
}

export function expirou(quando: Date | string, agora = new Date()): boolean {
  return new Date(quando).getTime() <= agora.getTime();
}

/** Cabeçalho `Set-Cookie` da sessão. `SameSite=Lax` + `httpOnly` + `Secure`. */
export function cookieDeSessao(token: string, opts: { segura?: boolean; dias?: number } = {}): string {
  const dias = opts.dias ?? SESSAO_DIAS;
  const partes = [
    `${COOKIE_SESSAO}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${dias * 24 * 60 * 60}`,
  ];
  if (opts.segura !== false) partes.push("Secure");
  return partes.join("; ");
}

/** Cookie de CSRF: legível pelo JavaScript de propósito (dupla submissão). */
export function cookieDeCsrf(token: string, opts: { segura?: boolean } = {}): string {
  const partes = [`${COOKIE_CSRF}=${token}`, "Path=/", "SameSite=Lax", `Max-Age=${SESSAO_DIAS * 24 * 60 * 60}`];
  if (opts.segura !== false) partes.push("Secure");
  return partes.join("; ");
}

export function cookiesDeSaida(opts: { segura?: boolean } = {}): string[] {
  const fim = "Path=/; Max-Age=0" + (opts.segura === false ? "" : "; Secure");
  return [`${COOKIE_SESSAO}=; HttpOnly; SameSite=Lax; ${fim}`, `${COOKIE_CSRF}=; SameSite=Lax; ${fim}`];
}

/** Lê os cookies de um cabeçalho `Cookie:` cru. */
export function lerCookies(cabecalho: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const parte of String(cabecalho ?? "").split(";")) {
    const i = parte.indexOf("=");
    if (i < 1) continue;
    const nome = parte.slice(0, i).trim();
    const valor = parte.slice(i + 1).trim();
    if (nome) out[nome] = decodeURIComponent(valor);
  }
  return out;
}

/**
 * Dupla submissão: o mesmo valor precisa estar no cookie e no header. Um site
 * hostil consegue fazer o navegador mandar o cookie, mas não consegue LER o
 * cookie para repetir o valor no header.
 */
export function csrfValido(input: {
  metodo: string;
  cookie: string | undefined;
  header: string | string[] | undefined;
}): boolean {
  const metodo = String(input.metodo ?? "").toUpperCase();
  if (metodo === "GET" || metodo === "HEAD" || metodo === "OPTIONS") return true;
  const doCookie = input.cookie ?? "";
  const doHeader = Array.isArray(input.header) ? input.header[0] : input.header ?? "";
  if (!doCookie || !doHeader) return false;
  return iguais(doCookie, doHeader);
}

/** Origem esperada: bloqueia pedido vindo de outro site. */
export function origemConfere(input: {
  origin?: string | string[];
  host?: string | string[];
}): boolean {
  const origin = Array.isArray(input.origin) ? input.origin[0] : input.origin;
  const host = Array.isArray(input.host) ? input.host[0] : input.host;
  if (!origin) return true; // muitos clientes legítimos não mandam Origin
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
