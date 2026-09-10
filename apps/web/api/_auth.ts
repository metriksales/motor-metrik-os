import type { VercelRequest } from "@vercel/node";
import type { Ctx } from "@motor/control";

// Resolve o contexto (org + ator) de forma SEGURA: org_id SEMPRE vem do servidor.
// - Se CLERK_SECRET_KEY existe → valida a sessão do Clerk (org da sessão).
// - Senão → auth temporária por service token (só pra testar antes do Clerk).
export async function resolveCtx(req: VercelRequest): Promise<Ctx | null> {
  // Auth de MÁQUINA (permanente, convive com o Clerk): agentes reais ingerindo
  // execuções (Flight Recorder), Claude Code/Codex e automações server↔server.
  // Exige o segredo EXATO; nunca vai pro browser.
  const secret = process.env.CONTROL_PLANE_SECRET;
  if (secret && req.headers["x-motor-token"] === secret) {
    const orgId = String(req.headers["x-org-id"] ?? "");
    if (!orgId) return null;
    return { orgId, actor: String(req.headers["x-actor"] ?? "maquina"), role: "admin" };
  }

  const clerkKey = process.env.CLERK_SECRET_KEY;

  if (clerkKey) {
    const auth = req.headers["authorization"];
    const token = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return null;
    // 401 legítimo = SÓ token inválido. Erro da ponte (Neon/migração/corrida)
    // PROPAGA pro handler virar 500 com a causa — senão o primeiro debug em
    // produção vira um 401 mudo indistinguível de "chave errada".
    let claims: Record<string, any>;
    try {
      const { verifyToken } = await import("@clerk/backend");
      claims = (await verifyToken(token, { secretKey: clerkKey })) as Record<string, any>;
    } catch (e) {
      console.error("[auth] token Clerk inválido:", e instanceof Error ? e.message : e);
      return null;
    }
    const clerkOrgId = claims.org_id ?? claims.o?.id;
    if (!clerkOrgId) {
      console.error("[auth] sessão Clerk válida porém SEM organização ativa (claims sem org)");
      return null;
    }
    const clerkUserId = String(claims.sub ?? "user");
    const role = mapRole(claims.org_role ?? claims.o?.rol);
    const rawName = claims.org_slug ?? claims.o?.slg ?? claims.org_name;
    // PONTE: mapeia (ou provisiona) o tenant interno a partir do org do Clerk.
    const { ensureOrgForClerk } = await import("./_bundled/control.mjs");
    const mapped = await ensureOrgForClerk({
      clerkOrgId: String(clerkOrgId),
      clerkUserId,
      name: typeof rawName === "string" ? rawName : undefined,
      role,
    });
    return { orgId: mapped.orgId, actor: clerkUserId, role: mapped.role };
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
