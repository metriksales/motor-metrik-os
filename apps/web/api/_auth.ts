import type { VercelRequest } from "@vercel/node";
import type { Ctx } from "@motor/control";

// Resolve o contexto (org + ator) de forma SEGURA: org_id SEMPRE vem do servidor.
// - Se CLERK_SECRET_KEY existe → valida a sessão do Clerk (org da sessão).
// - Senão → auth temporária por service token (só pra testar antes do Clerk).
export async function resolveCtx(req: VercelRequest): Promise<Ctx | null> {
  const clerkKey = process.env.CLERK_SECRET_KEY;

  if (clerkKey) {
    const auth = req.headers["authorization"];
    const token = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return null;
    try {
      const { verifyToken } = await import("@clerk/backend");
      const claims = (await verifyToken(token, { secretKey: clerkKey })) as Record<string, any>;
      const orgId = claims.org_id ?? claims.o?.id;
      if (!orgId) return null; // sem organização ativa na sessão
      return {
        orgId: String(orgId),
        actor: String(claims.sub ?? "user"),
        role: mapRole(claims.org_role ?? claims.o?.rol),
      };
    } catch {
      return null;
    }
  }

  // Fallback TEMPORÁRIO (pré-Clerk): service token + org no header.
  const secret = process.env.CONTROL_PLANE_SECRET;
  if (secret && req.headers["x-motor-token"] === secret) {
    const orgId = String(req.headers["x-org-id"] ?? "");
    if (!orgId) return null;
    return { orgId, actor: String(req.headers["x-actor"] ?? "api"), role: "admin" };
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
