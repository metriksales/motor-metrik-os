// @motor/messaging — as PEÇAS PLUGÁVEIS de mensagem.
// Sender = MONTA a mensagem · Transport = ENTREGA a mensagem.
// Duas peças de cada, mesma interface: prova de que o motor não é engessado.
import type { Sender, Transport, LlmPort, CrmPort } from "@motor/core";
import { MetaTemplateSender, LlmFreeformSender } from "./senders";
import {
  GhlNativeTransport,
  UazapiMultiInstanceTransport,
  type UazapiInstancia,
  type UazapiHttp,
} from "./transports";

// Re-exporta as peças concretas + tipos auxiliares.
export { MetaTemplateSender, LlmFreeformSender } from "./senders";
export {
  GhlNativeTransport,
  UazapiMultiInstanceTransport,
} from "./transports";
export type { UazapiInstancia, UazapiHttp } from "./transports";

/** Dependências injetáveis para montar um Sender. */
export interface SenderDeps {
  llm?: LlmPort;
}

/** Dependências injetáveis para montar um Transport. */
export interface TransportDeps {
  crm?: CrmPort;
  instancias?: UazapiInstancia[];
  http?: UazapiHttp;
}

/** Fábrica de Senders: escolhe COMO a mensagem é montada, por kind. */
export function makeSender(kind: string, deps?: SenderDeps): Sender {
  switch (kind) {
    case "meta-template":
      return new MetaTemplateSender();
    case "llm-freeform":
      return new LlmFreeformSender(deps?.llm);
    default:
      throw new Error(`Sender desconhecido: "${kind}" (use meta-template | llm-freeform)`);
  }
}

/** Fábrica de Transports: escolhe COMO a mensagem é entregue, por kind. */
export function makeTransport(kind: string, deps?: TransportDeps): Transport {
  switch (kind) {
    case "ghl-native":
      return new GhlNativeTransport(deps?.crm);
    case "uazapi-multi":
      return new UazapiMultiInstanceTransport(deps?.instancias ?? [], deps?.http);
    default:
      throw new Error(`Transport desconhecido: "${kind}" (use ghl-native | uazapi-multi)`);
  }
}
