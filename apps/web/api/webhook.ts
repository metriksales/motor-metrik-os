import type { VercelRequest, VercelResponse } from "@vercel/node";
import { idDaRequisicao, registrarFalha } from "./_observabilidade.js";
import { createProductionDeps, handleInbound } from "./_bundled/motor.mjs";
import {
  comConta,
  extrairSegredoEntrada,
  getAgentEstado,
  getContatoEstado,
  getDatabaseUrl,
  resolverEntrada,
} from "./_bundled/motor.mjs";

// Porta de ENTRADA de mensagem (webhook do canal: uazapi/GHL/IG).
//
// Lei (S-004): FAIL-CLOSED. Sem segredo de entrada válido, não passa — e o
// segredo é POR CONEXÃO, não global. A conta e o agente saem dele, resolvidos
// no servidor; o corpo da requisição não escolhe tenant.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = idDaRequisicao(req, res);
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

  // Daqui para baixo, tudo dentro da conta resolvida (S-011). Esta é a entrada
  // com o pior modo de falha do produto: se o contexto faltar quando o RLS
  // entrar, o agente não erra — ele simplesmente para de responder lead, em
  // silêncio. A resolução do segredo acima é cruzada de propósito: é ela que
  // DESCOBRE a conta, e por isso não pode estar dentro dela.
  return comConta(orgId, () => atender({ req, res, requestId, orgId, agentId, contactId, b }));
}

async function atender({
  res,
  requestId,
  orgId,
  agentId,
  contactId,
  b,
}: {
  req: VercelRequest;
  res: VercelResponse;
  requestId: string;
  orgId: string;
  agentId: string;
  contactId: string;
  b: Record<string, unknown>;
}) {

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
    await registrarFalha("webhook:estado-do-agente", requestId, e, { orgId });
  }

  // ASSUMIR honrado AQUI: humano assumiu ESTE contato = a IA cala só nesta conversa.
  try {
    const { estado } = await getContatoEstado({ orgId, actor: "webhook", role: "admin" }, agentId, contactId);
    if (estado === "humano") {
      return res.json({ ok: true, assumido: true, skipped: "conversa assumida por um humano — a IA não respondeu" });
    }
  } catch (e) {
    await registrarFalha("webhook:estado-do-contato", requestId, e, { orgId });
  }

  // Composição de produção. TODO(S-025): injetar o cofre (token do CRM por conta).
  const deps = createProductionDeps({
    openaiApiKey: process.env.OPENAI_API_KEY,
    // linha do Flight Recorder que não gravou vira erro rastreado (S-012)
    aoFalhar: (onde, erro, extra) => registrarFalha(onde, requestId, erro, { orgId: extra.orgId ?? orgId }),
  });

  try {
    const canal = b.canal === "instagram" || b.canal === "whatsapp" ? b.canal : "webhook";
    const out = await handleInbound(
      { orgId, agentId, canal, contactId, texto: typeof b.texto === "string" ? b.texto : undefined, raw: b.raw },
      deps,
    );
    // O Flight Recorder grava sem bloquear o motor — mas a resposta só sai
    // depois que a linha chegou ao banco. Numa função serverless o processo
    // congela assim que respondemos; uma gravação ainda em voo se perde (S-012).
    await deps.flush?.();
    return res.json({ ok: true, ...out });
  } catch (e) {
    // Mensagem interna não volta pro chamador (achado A5 da auditoria).
    await registrarFalha("webhook:atender", requestId, e, { orgId });
    return res.status(500).json({ error: "falha ao processar a mensagem" });
  }
}
