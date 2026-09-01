// @motor/runtime — Data Plane. Roda 24/7, FORA do CRM.
// Fluxo: webhook → identifica tenant+agente → carrega spec PUBLICADO (cache) →
//        LLM + tools (a skill) → adapter escreve no CRM → loga execução.
// NÃO depende do control plane por mensagem: lê a última config publicada (cache).
import { makeAdapter } from "@motor/crm";
import type { AgentSpec } from "@motor/core";

export interface InboundEvent {
  orgId: string;
  agentId: string;
  canal: "whatsapp" | "instagram" | "webhook";
  contactId: string;
  texto?: string;
  raw?: unknown;
}

export async function handleInbound(evt: InboundEvent): Promise<void> {
  // 1. carregar spec publicado do cache (Redis/edge) por orgId+agentId   — TODO
  // 2. checar pausa do lead (Redis TTL), fail-open                        — TODO
  // 3. LLM + tools da skill agente-ia-metrik-completo                     — TODO
  // 4. escrever no CRM via adapter (token do vault por org)               — TODO
  //    const adapter = makeAdapter(conn.kind, tokenDoVault);
  // 5. logExec (triagem determinística zero-token alimenta o log)         — TODO
  void makeAdapter;
  void evt;
  throw new Error("handleInbound — TODO: ligar na skill agente-ia-metrik-completo (common/ghl/kommo)");
}

export type { AgentSpec };
