// Senders — COMO a mensagem é MONTADA (o Sender monta, o Transport entrega).
// Duas peças plugáveis com a MESMA interface (Sender de @motor/core):
// trocar template Meta ↔ LLM freeform é só trocar a peça, sem tocar no motor.
import type {
  Sender,
  LeadRef,
  FollowupStep,
  OutgoingMessage,
  LlmPort,
} from "@motor/core";

/**
 * MetaTemplateSender — monta um template Meta aprovado (HSM).
 * Puro: deriva as variáveis do lead + passo, sem rede. O envio do
 * template real acontece no Transport (ex.: canal WhatsApp Cloud API).
 */
export class MetaTemplateSender implements Sender {
  readonly kind = "meta-template";

  async build(input: {
    lead: LeadRef;
    step: FollowupStep;
    ctx?: Record<string, unknown>;
  }): Promise<OutgoingMessage> {
    const { lead, step } = input;
    // Variáveis posicionais do template Meta ({{1}}, {{2}}...).
    // Convenção mínima: {"1"} = nome do lead (fallback amigável).
    const variables: Record<string, string> = {
      "1": lead.nome ?? "tudo bem",
    };
    return {
      kind: "template",
      templateId: step.templateId ?? "generico",
      variables,
      fallbackText: step.texto,
    };
  }
}

/**
 * LlmFreeformSender — o "cérebro" (skill agente-ia-metrik-completo) escreve
 * a mensagem na hora, a partir do objetivo do passo. Se não houver LlmPort
 * injetado, cai no texto base do passo (degrada honesto, nunca quebra).
 */
export class LlmFreeformSender implements Sender {
  readonly kind = "llm-freeform";

  constructor(private llm?: LlmPort) {}

  async build(input: {
    lead: LeadRef;
    step: FollowupStep;
    ctx?: Record<string, unknown>;
  }): Promise<OutgoingMessage> {
    const { step } = input;
    const fallback = step.texto ?? step.objetivo ?? "Oi! Tudo certo por aí?";

    if (this.llm) {
      // TODO: ligar no cérebro real (skill agente-ia-metrik-completo via LlmPort).
      const turn = await this.llm.responder({
        system: step.objetivo ?? step.texto ?? "",
        historico: [{ role: "user", content: step.objetivo ?? step.texto ?? "" }],
      });
      return { kind: "text", text: turn.texto ?? fallback };
    }

    return { kind: "text", text: fallback };
  }
}
