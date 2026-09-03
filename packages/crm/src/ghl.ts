import type { CrmAdapter } from "./adapter";

// GhlAdapter — as "mãos" no GoHighLevel / LeadConnector (API v2 pública).
// O token (PIT ou OAuth) faz 100% do dado; o app do marketplace é opcional.
// Base oficial documentada: services.leadconnectorhq.com (mirror interno = backend.*).
// Toda escrita exige o header Version: 2021-07-28 além do Bearer.
const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

/**
 * Campos opcionais que o tenant injeta por `meta` (vêm do VAULT / config do agente,
 * NUNCA hard-coded aqui). IDs de pipeline/stage/calendar/location são do cliente.
 */
interface GhlMeta {
  /** location (subconta) — exigido por opportunities e appointments */
  locationId?: string;
  /** pipeline padrão (ajuda em moverEtapa/criarOportunidade quando a API pede) */
  pipelineId?: string;
  /** stage inicial ao criar oportunidade (senão a API usa o 1º do pipeline) */
  defaultStageId?: string;
  /** calendário padrão p/ agendar quando o input não trouxer calendarId */
  defaultCalendarId?: string;
  /** canal da mensagem no conversations/messages (SMS | WhatsApp | Email ...) */
  messageType?: string;
  /** tags do gate de atendimento (doutrina handoff sem revelar IA) */
  tagIa?: string;
  tagHumano?: string;
}

export class GhlAdapter implements CrmAdapter {
  readonly kind = "ghl" as const;
  private meta: GhlMeta;

  constructor(private token: string, meta?: Record<string, unknown>) {
    // guarda o meta já tipado (só leitura de strings simples)
    this.meta = (meta ?? {}) as GhlMeta;
  }

  /** Faz a request real, checa o status e devolve o JSON (ou {} em corpo vazio). */
  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${GHL_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Version: GHL_VERSION,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      // erro claro com o corpo (truncado) pra depurar payload/escopo
      const detalhe = await res.text().catch(() => "");
      throw new Error(
        `GHL ${method} ${path} falhou (HTTP ${res.status}): ${detalhe.slice(0, 500)}`,
      );
    }
    const texto = await res.text();
    return (texto ? JSON.parse(texto) : {}) as T;
  }

  /** Exige um campo do meta (ex: locationId) ou explode com mensagem clara. */
  private exigirLocation(op: string): string {
    if (!this.meta.locationId) {
      throw new Error(`GhlAdapter.${op}: falta meta.locationId (subconta do tenant)`);
    }
    return this.meta.locationId;
  }

  /** Move a oportunidade de etapa: PUT /opportunities/{id} { pipelineStageId }. */
  async moverEtapa(oppId: string, stageId: string): Promise<void> {
    const body: Record<string, unknown> = { pipelineStageId: stageId };
    // alguns tenants exigem o pipelineId junto no update — manda se conhecido
    if (this.meta.pipelineId) body.pipelineId = this.meta.pipelineId;
    await this.request("PUT", `/opportunities/${encodeURIComponent(oppId)}`, body);
  }

  /** Preenche custom field no CONTATO: PUT /contacts/{id} { customFields:[{id,value}] }. */
  async preencherCampo(contactId: string, field: string, value: unknown): Promise<void> {
    // `field` = id do custom field no GHL (v2 aceita {id,value} ou {key,value})
    await this.request("PUT", `/contacts/${encodeURIComponent(contactId)}`, {
      customFields: [{ id: field, value }],
    });
  }

  /** Cria tarefa no contato: POST /contacts/{id}/tasks { title, dueDate, completed }. */
  async criarTarefa(contactId: string, titulo: string, quando?: string): Promise<void> {
    // dueDate é obrigatório no GHL; sem `quando`, agenda p/ +24h (ISO 8601)
    const dueDate = quando ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await this.request("POST", `/contacts/${encodeURIComponent(contactId)}/tasks`, {
      title: titulo,
      dueDate,
      completed: false,
    });
  }

  /** Agenda: POST /calendars/events/appointments — retorna o id do evento. */
  async agendar(input: {
    contactId: string;
    quando: string;
    calendarId?: string;
  }): Promise<{ eventId: string }> {
    const locationId = this.exigirLocation("agendar");
    const calendarId = input.calendarId ?? this.meta.defaultCalendarId;
    if (!calendarId) {
      throw new Error(
        "GhlAdapter.agendar: falta calendarId (no input ou meta.defaultCalendarId)",
      );
    }
    // conferir endpoint: create appointment do LeadConnector v2
    const resp = await this.request<{ id?: string; appointment?: { id?: string } }>(
      "POST",
      "/calendars/events/appointments",
      {
        calendarId,
        locationId,
        contactId: input.contactId,
        startTime: input.quando, // ISO 8601 com timezone
      },
    );
    const eventId = resp.id ?? resp.appointment?.id;
    if (!eventId) {
      throw new Error("GhlAdapter.agendar: resposta sem id do appointment");
    }
    return { eventId };
  }

  /** Adiciona tag ao contato: POST /contacts/{id}/tags { tags:[tag] }. */
  async addTag(contactId: string, tag: string): Promise<void> {
    await this.request("POST", `/contacts/${encodeURIComponent(contactId)}/tags`, {
      tags: [tag],
    });
  }

  /** Remove tag do contato: DELETE /contacts/{id}/tags { tags:[tag] }. */
  async removerTag(contactId: string, tag: string): Promise<void> {
    await this.request("DELETE", `/contacts/${encodeURIComponent(contactId)}/tags`, {
      tags: [tag],
    });
  }

  /** Cria oportunidade: POST /opportunities { pipelineId, locationId, contactId, ... }. */
  async criarOportunidade(
    contactId: string,
    funilId: string,
    valor?: number,
  ): Promise<{ oppId: string }> {
    const locationId = this.exigirLocation("criarOportunidade");
    const body: Record<string, unknown> = {
      pipelineId: funilId, // funilId = pipeline no GHL
      locationId,
      contactId,
      name: `Oportunidade ${contactId}`,
      status: "open",
    };
    // stage inicial (se o tenant definiu um); senão a API cai no 1º do pipeline
    if (this.meta.defaultStageId) body.pipelineStageId = this.meta.defaultStageId;
    if (typeof valor === "number") body.monetaryValue = valor;
    const resp = await this.request<{ id?: string; opportunity?: { id?: string } }>(
      "POST",
      "/opportunities/",
      body,
    );
    const oppId = resp.id ?? resp.opportunity?.id;
    if (!oppId) {
      throw new Error("GhlAdapter.criarOportunidade: resposta sem id da oportunidade");
    }
    return { oppId };
  }

  /** Envia mensagem: POST /conversations/messages { type, contactId, message }. */
  async enviarMensagem(contactId: string, texto: string): Promise<void> {
    // type: SMS (universal) por padrão; WhatsApp exige canal Meta ligado no tenant.
    const type = this.meta.messageType ?? "SMS";
    await this.request("POST", "/conversations/messages", {
      type,
      contactId,
      message: texto,
    });
  }

  /**
   * Handoff sem revelar a IA (doutrina Metrik): tira a tag "ia" (silencia o agente)
   * e põe "atendimento-humano". Nomes das tags são override por meta.tagIa/tagHumano.
   */
  async handoff(contactId: string): Promise<void> {
    const tagIa = this.meta.tagIa ?? "ia";
    const tagHumano = this.meta.tagHumano ?? "atendimento-humano";
    await this.removerTag(contactId, tagIa);
    await this.addTag(contactId, tagHumano);
  }
}
