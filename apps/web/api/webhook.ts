import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createProductionDeps, handleInbound } from "./_bundled/runtime.mjs";
import { getDatabaseUrl, getAgentEstado } from "./_bundled/control.mjs";

// Porta de ENTRADA de mensagem (webhook do canal: uazapi/GHL/IG).
// Autentica pelo SEGREDO do canal (x-webhook-secret), não por sessão de usuário.
// Sem Neon → 503. Sem vault ligado, o cérebro responde mas as mãos no CRM ficam
// off (fail-open honesto) — é o que falta pra ir 100% ao vivo.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "use POST" });
  if (!getDatabaseUrl()) {
    return res.status(503).json({ error: "banco não configurado — falta DATABASE_URL (Neon)" });
  }

  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.headers["x-webhook-secret"] !== secret) {
    return res.status(401).json({ error: "assinatura do webhook inválida" });
  }

  const b = (req.body ?? {}) as Record<string, unknown>;
  const orgId = String(b.orgId ?? "");
  const agentId = String(b.agentId ?? "");
  const contactId = String(b.contactId ?? "");
  if (!orgId || !agentId || !contactId) {
    return res.status(400).json({ error: "faltam orgId/agentId/contactId no corpo" });
  }

  // PAUSE do cliente é honrado AQUI, antes de qualquer resposta: agente pausado
  // = a IA não fala com o lead (a ação de emergência do cliente vale de verdade).
  try {
    const { estado } = await getAgentEstado({ orgId, actor: "webhook", role: "admin" }, agentId);
    if (estado === "pausado") {
      return res.json({ ok: true, pausado: true, skipped: "agente pausado pelo cliente — não respondi" });
    }
  } catch {
    // falha ao ler estado não pode derrubar a entrada; segue (fail-open no atendimento)
  }

  // Composição de produção. TODO: injetar o vault (token do CRM por org) e o Redis.
  const deps = createProductionDeps({ openaiApiKey: process.env.OPENAI_API_KEY });

  try {
    const canal = b.canal === "instagram" || b.canal === "whatsapp" ? b.canal : "webhook";
    const out = await handleInbound(
      { orgId, agentId, canal, contactId, texto: typeof b.texto === "string" ? b.texto : undefined, raw: b.raw },
      deps,
    );
    return res.json({ ok: true, ...out });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "erro" });
  }
}
