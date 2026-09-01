import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as control from "@motor/control";
import type { Ctx } from "@motor/control";

// AUTH TEMPORÁRIA: service token + org no header. Clerk substitui (org_id da SESSÃO, nunca do cliente).
function ctxFrom(req: VercelRequest): Ctx | null {
  if (req.headers["x-motor-token"] !== process.env.CONTROL_PLANE_SECRET) return null;
  const orgId = String(req.headers["x-org-id"] ?? "");
  if (!orgId) return null;
  return { orgId, actor: String(req.headers["x-actor"] ?? "api"), role: "admin" };
}

// Porta única: front, Claude Code, Codex e API batem AQUI.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = ctxFrom(req);
  if (!ctx) return res.status(401).json({ error: "não autorizado" });
  const action = String(req.query.action ?? "");
  const body = (req.body ?? {}) as any;
  try {
    switch (action) {
      case "agents":
        return res.json(await control.listAgents(ctx));
      case "createAgent":
        return res.json(await control.createAgent(ctx, body));
      case "propor":
        return res.json(await control.proporMudanca(ctx, body));
      case "changesets":
        return res.json(await control.listChangeSets(ctx, String(req.query.agentId ?? "")));
      case "aprovar":
        return res.json(await control.aprovarMudanca(ctx, body.changeSetId));
      case "publicar":
        return res.json(await control.publicar(ctx, body));
      default:
        return res.status(400).json({ error: "ação desconhecida" });
    }
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "erro" });
  }
}
