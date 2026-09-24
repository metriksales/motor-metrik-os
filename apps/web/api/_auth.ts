import type { VercelRequest } from "@vercel/node";
import type { Ctx } from "@motor/control";

// Resolve o contexto (conta + ator) de forma SEGURA.
// Lei do projeto: a CONTA vem sempre do servidor — do token de máquina ou da
// sessão — e NUNCA de um header enviado pelo cliente.
//
// Dois caminhos:
// 1. Sessão de PESSOA: cookie httpOnly com token opaco (S-045), com CSRF e
//    conferência de origem em toda escrita.
// 2. Token de MÁQUINA (`mos_…`): agentes ingerindo execuções, Claude Code/Codex,
//    automações. A conta e os escopos saem do banco, pelo hash do token.
export async function resolveCtx(req: VercelRequest): Promise<Ctx | null> {
  const {
    extrairToken,
    resolverMachineToken,
    resolverSessao,
    lerCookies,
    COOKIE_SESSAO,
    COOKIE_CSRF,
    HEADER_CSRF,
    csrfValido,
    origemConfere,
  } = await import("./_bundled/control.mjs");

  // 1. Sessão própria (S-045) — o caminho das pessoas. Cookie httpOnly com
  // token opaco; a conta e o papel saem do banco.
  const cookies = lerCookies(req.headers.cookie);
  const tokenDeSessao = cookies[COOKIE_SESSAO];
  if (tokenDeSessao) {
    // Cookie viaja sozinho, então toda escrita confere origem e CSRF — é a
    // superfície que aparece ao trocar header por cookie.
    if (req.method !== "GET" && req.method !== "HEAD") {
      if (!origemConfere({ origin: req.headers.origin, host: req.headers.host })) return null;
      if (!csrfValido({ metodo: req.method ?? "", cookie: cookies[COOKIE_CSRF], header: req.headers[HEADER_CSRF] })) {
        return null;
      }
    }
    return await resolverSessao(tokenDeSessao);
  }

  const tokenDeMaquina = extrairToken({
    authorization: req.headers["authorization"],
    "x-motor-token": req.headers["x-motor-token"],
  });
  if (tokenDeMaquina) {
    // Token inválido/revogado = 401. Não há atalho por header: `x-org-id` e
    // `x-actor` são ignorados de propósito (eram a falha crítica da auditoria).
    return await resolverMachineToken(tokenDeMaquina);
  }

  return null;
}
