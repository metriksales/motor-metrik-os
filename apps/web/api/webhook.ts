import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createProductionDeps, handleInbound } from "./_bundled/runtime.mjs";
import {
  extrairSegredoEntrada,
  getAgentEstado,
  getContatoEstado,
  getDatabaseUrl,
  resolverEntrada,
} from "./_bundled/control.mjs";

// Porta de ENTRADA de mensagem (webhook do canal: uazapi/GHL/IG).
//
// Lei (S-004): FAIL-CLOSED. Sem segredo de entrada válido, não passa — e o
// segredo é POR CONEXÃO, não global. A conta e o agente saem dele, resolvidos
// no servidor; o corpo da requisição não escolhe tenant.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "use POST" });
  if (!getDatabaseUrl()) {
    return res.status(503).json({ error: "banco não configurado" });
  }

  const achado = extrairSegredoEntrada({ headers: req.headers, query: req.query });
  if (!achado) return res.status(401).json({ error: "entrada não autenticada" });

  const destino = await resolverEntrada(achado.segredo);
  if (!destino) return res.status(401).json({ error: "entrada não autenticada" });

  if (achado.viaQuery) {
    // O segredo veio na URL e portanto aparece no log de acesso. Aceitamos
    // porque vários provedores não mandam header, mas fica registrado.
    console.warn(`[webhook] segredo na query (conexão ${destino.connectionId}) — prefira header`);
  }

  const { orgId, agentId } = destino;
  const b = (req.body ?? {}) as Record<string, unknown>;
  const contactId = String(b.contactId ?? "");
  if (!contactId) return res.status(400).json({ error: "falta contactId no corpo" });

  // PAUSE do cliente é honrado AQUI, antes de qualquer resposta.
  // TODO(S-020): isto ainda é fail-open — se a leitura do estado falhar, o
  // agente pausado volta a responder. Vira fail-closed junto com a parada de
  // emergência.
  try {
    const { estado } = await getAgentEstado({ orgId, actor: "webhook", role: "admin" }, agentId);
    if (estado === "pausado") {
      return res.json({ ok: true, pausado: true, skipped: "agente pausado pelo cliente — não respondi" });
    }
  } catch (e) {
    console.error("[webhook] falha ao ler estado do agente:", e);
  }

  // ASSUMIR honrado AQUI: humano assumiu ESTE contato = a IA cala só nesta conversa.
  try {
    const { estado } = await getContatoEstado({ orgId, actor: "webhook", role: "admin" }, agentId, contactId);
    if (estado === "humano") {
      return res.json({ ok: true, assumido: true, skipped: "conversa assumida por um humano — a IA não respondeu" });
    }
  } catch (e) {
    console.error("[webhook] falha ao ler estado do contato:", e);
  }

  // Composição de produção. TODO(S-025): injetar o cofre (token do CRM por conta).
  const deps = createProductionDeps({ openaiApiKey: process.env.OPENAI_API_KEY });

  try {
    const canal = b.canal === "instagram" || b.canal === "whatsapp" ? b.canal : "webhook";
    const out = await handleInbound(
      { orgId, agentId, canal, contactId, texto: typeof b.texto === "string" ? b.texto : undefined, raw: b.raw },
      deps,
    );
    return res.json({ ok: true, ...out });
  } catch (e) {
    // Mensagem interna não volta pro chamador (achado A5 da auditoria).
    console.error("[webhook] falha ao processar entrada:", e);
    return res.status(500).json({ error: "falha ao processar a mensagem" });
  }
}
