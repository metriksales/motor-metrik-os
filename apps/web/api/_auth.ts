import type { VercelRequest } from "@vercel/node";
import type { Ctx } from "@motor/control";

// Resolve o contexto (conta + ator) de forma SEGURA.
// Lei do projeto: a CONTA vem sempre do servidor — do token de máquina ou da
// sessão — e NUNCA de um header enviado pelo cliente.
//
// Dois caminhos:
// 1. Token de MÁQUINA (`mos_…`): agentes ingerindo execuções, Claude Code/Codex,
//    automações. A conta e os escopos saem do banco, pelo hash do token.
// 2. Sessão de PESSOA (Clerk, enquanto a autenticação própria da S-045 não
//    existe): a conta sai da organização da sessão.
export async function resolveCtx(req: VercelRequest): Promise<Ctx | null> {
  const { extrairToken, resolverMachineToken } = await import("./_bundled/control.mjs");

  const tokenDeMaquina = extrairToken({
    authorization: req.headers["authorization"],
    "x-motor-token": req.headers["x-motor-token"],
  });
  if (tokenDeMaquina) {
    // Token inválido/revogado = 401. Não há atalho por header: `x-org-id` e
    // `x-actor` são ignorados de propósito (eram a falha crítica da auditoria).
    return await resolverMachineToken(tokenDeMaquina);
  }

  const clerkKey = process.env.CLERK_SECRET_KEY;

  if (clerkKey) {
    const auth = req.headers["authorization"];
    const token = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return null;
    // 401 legítimo = SÓ token inválido. Erro da ponte (Neon/migração/corrida)
    // PROPAGA pro handler virar 500 com a causa — senão o primeiro debug em
    // produção vira um 401 mudo indistinguível de "chave errada".
    let claims: Record<string, unknown>;
    try {
      const { verifyToken } = await import("@clerk/backend");
      claims = (await verifyToken(token, { secretKey: clerkKey })) as Record<string, unknown>;
    } catch (e) {
      console.error("[auth] token Clerk inválido:", e instanceof Error ? e.message : e);
      return null;
    }
    const o = claims.o as { id?: string; rol?: string; slg?: string } | undefined;
    const clerkOrgId = claims.org_id ?? o?.id;
    if (!clerkOrgId) {
      console.error("[auth] sessão Clerk válida porém SEM organização ativa (claims sem org)");
      return null;
    }
    const clerkUserId = String(claims.sub ?? "user");
    const role = mapRole(claims.org_role ?? o?.rol);
    const rawName = claims.org_slug ?? o?.slg ?? claims.org_name;
    // PONTE: mapeia (ou provisiona) o tenant interno a partir do org do Clerk.
    const { ensureOrgForClerk } = await import("./_bundled/control.mjs");
    const mapped = await ensureOrgForClerk({
      clerkOrgId: String(clerkOrgId),
      clerkUserId,
      name: typeof rawName === "string" ? rawName : undefined,
      role,
    });
    return { orgId: mapped.orgId, actor: clerkUserId, role: mapped.role, via: "sessao" };
  }

  return null;
}

function mapRole(r: unknown): Ctx["role"] {
  const s = String(r ?? "").toLowerCase();
  if (s.includes("owner")) return "owner";
  if (s.includes("admin")) return "admin";
  if (s.includes("member") || s.includes("operator")) return "operator";
  return "viewer";
}
