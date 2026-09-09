import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as control from "@motor/control";
import { getDatabaseUrl } from "@motor/db";
import { resolveCtx } from "./_auth";

// Porta ÚNICA de mudança: front, Claude Code, Codex e API batem AQUI.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = await resolveCtx(req);
  if (!ctx) return res.status(401).json({ error: "não autorizado" });
  if (!getDatabaseUrl()) {
    return res.status(503).json({ error: "banco não configurado — falta DATABASE_URL (Neon)" });
  }

  const action = String(req.query.action ?? "");
  const body = (req.body ?? {}) as any;
  try {
    switch (action) {
      case "agents":
        return res.json(await control.listAgents(ctx));
      case "getAgent":
        return res.json(await control.getAgent(ctx, String(req.query.agentId ?? "")));
      case "spec":
        return res.json(await control.loadPublishedSpec(ctx, String(req.query.agentId ?? "")));
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
      case "releases":
        return res.json(await control.listReleases(ctx, String(req.query.agentId ?? "")));
      case "reverter":
        return res.json(await control.reverter(ctx, body));
      case "log":
        return res.json(await control.registrarLog(ctx, body));
      case "logs":
        return res.json(
          await control.listLogs(
            ctx,
            req.query.agentId ? String(req.query.agentId) : undefined,
            req.query.limit ? Number(req.query.limit) : undefined
          )
        );
      case "stats":
        return res.json(await control.statsHoje(ctx));
      case "connections":
        return res.json(await control.listConnections(ctx));
      case "upsertConnection":
        return res.json(await control.upsertConnection(ctx, body));
      default:
        return res.status(400).json({ error: "ação desconhecida" });
    }
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "erro" });
  }
}
