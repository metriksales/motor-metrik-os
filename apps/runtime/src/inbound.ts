// @motor/runtime — Data Plane. Roda 24/7, FORA do CRM.
// Fluxo: webhook → identifica tenant+agente → carrega spec PUBLICADO (cache) →
//        casa motores (registry) → cada motor roda com ports injetados → loga.
// NÃO depende do control plane por mensagem: lê a última config publicada (cache).
// O adapter de CRM / LLM / envio entram pelos PORTS do RuntimeDeps (injeção),
// nunca importados aqui direto — é o que mantém o Data Plane plugável.
import type { AgentSpec, MotorResult, RuntimeEvent } from "@motor/core";
import { runEvent } from "./pipeline";
import { createMemoryDeps } from "./deps";
import type { RuntimeDeps } from "./deps";

/** O evento cru que o canal entrega (webhook do WhatsApp/IG). */
export interface InboundEvent {
  orgId: string;
  agentId: string;
  canal: "whatsapp" | "instagram" | "webhook";
  contactId: string;
  texto?: string;
  raw?: unknown;
}

/**
 * handleInbound — porta de entrada de mensagem.
 * Mapeia InboundEvent → RuntimeEvent(tipo:"inbound") e delega pro pipeline.
 * O payload cru vai em meta.raw pra rastreio; toda a lógica vive no runEvent.
 */
export async function handleInbound(
  evt: InboundEvent,
  deps: RuntimeDeps,
): Promise<{ ran: string[]; results: MotorResult[] }> {
  const event: RuntimeEvent = {
    orgId: evt.orgId,
    agentId: evt.agentId,
    tipo: "inbound",
    canal: evt.canal,
    contactId: evt.contactId,
    texto: evt.texto,
    at: new Date().toISOString(),
    meta: evt.raw !== undefined ? { raw: evt.raw } : undefined,
  };
  return runEvent(event, deps);
}

export { runEvent, createMemoryDeps };
export type { AgentSpec, RuntimeDeps, RuntimeEvent, MotorResult };
