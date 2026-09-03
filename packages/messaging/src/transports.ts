// Transports — COMO a mensagem é ENTREGUE (o canal).
// Mesma interface (Transport de @motor/core): trocar canal nativo do GHL
// pela malha multi-instância uazapi é só trocar a peça — motor não muda.
import type { Transport, OutgoingMessage, SendResult, CrmPort } from "@motor/core";

/**
 * GhlNativeTransport — entrega pelo canal nativo do CRM (GHL), via CrmPort.
 * Só sabe entregar TEXTO pelo canal nativo; template/mídia ficam pro
 * transporte próprio (uazapi) enquanto o canal Meta não está ligado.
 */
export class GhlNativeTransport implements Transport {
  readonly kind = "ghl-native";

  constructor(private crm?: CrmPort) {}

  async send(input: {
    orgId: string;
    to: string;
    message: OutgoingMessage;
    ownerId?: string;
  }): Promise<SendResult> {
    const { to, message } = input;

    if (!this.crm) {
      return { ok: false, error: "sem crm" };
    }

    if (message.kind === "text") {
      // to = contactId no GHL; o canal nativo cuida do transporte real.
      await this.crm.enviarMensagem(to, message.text);
      return { ok: true };
    }

    // TODO GHL template: enviar HSM/mídia pelo canal nativo exige a API de
    // templates (Meta) do LeadConnector — por ora, roteie via uazapi-multi.
    return {
      ok: false,
      error: `canal ghl-native só entrega texto (recebeu "${message.kind}")`,
    };
  }
}

/** Uma instância uazapi (linha de WhatsApp) opcionalmente amarrada a um vendedor. */
export interface UazapiInstancia {
  ownerId?: string;
  instanceId: string;
  token: string;
}

/** Injetável: faz o POST real (a peça de rede fica FORA do motor). */
export type UazapiHttp = (
  url: string,
  body: unknown,
  token: string,
) => Promise<{ ok: boolean; id?: string }>;

/** Hash simples e determinístico de string (djb2) — p/ round-robin estável. */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    // h * 33 + char, mantido em inteiro sem sinal de 32 bits.
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * UazapiMultiInstanceTransport — malha de linhas de WhatsApp (uazapi).
 * ROTEIA por vendedor: a mensagem sai da linha do dono do lead (ownerId).
 * Sem dono conhecido, cai num round-robin DETERMINÍSTICO por hash do
 * destino — o mesmo `to` sempre bate na mesma linha (conversa não pula).
 */
export class UazapiMultiInstanceTransport implements Transport {
  readonly kind = "uazapi-multi";

  constructor(
    private instancias: UazapiInstancia[],
    private http?: UazapiHttp,
  ) {}

  /** Escolhe a linha: dono exato > round-robin estável por hash do destino. */
  private escolher(to: string, ownerId?: string): UazapiInstancia | undefined {
    if (this.instancias.length === 0) return undefined;
    if (ownerId) {
      const doDono = this.instancias.find((i) => i.ownerId === ownerId);
      if (doDono) return doDono;
    }
    const idx = hashString(to) % this.instancias.length;
    return this.instancias[idx];
  }

  async send(input: {
    orgId: string;
    to: string;
    message: OutgoingMessage;
    ownerId?: string;
  }): Promise<SendResult> {
    const { to, message, ownerId } = input;

    const inst = this.escolher(to, ownerId);
    if (!inst) {
      return { ok: false, error: "sem instância uazapi configurada" };
    }

    // Corpo genérico; o formato exato (/send/text, /send/media) mora na skill.
    const body = { number: to, instanceId: inst.instanceId, message };

    if (this.http) {
      const r = await this.http("/send/text", body, inst.token);
      return { ok: r.ok, providerId: r.id };
    }

    // TODO: POST real uazapi /send/text (ligar em UazapiHttp / skill
    // agente-ia-metrik-completo). Token NUNCA embutido aqui — vem por instância.
    return { ok: true, providerId: "stub-" + inst.instanceId };
  }
}
