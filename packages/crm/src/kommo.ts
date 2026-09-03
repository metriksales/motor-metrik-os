import type { CrmAdapter } from "./adapter";

// KommoAdapter — as "mãos" no Kommo (API REST v4).
// A base depende do subdomínio do tenant → vem em meta.baseUrl (ex:
// https://minhaempresa.kommo.com). Auth = Bearer (token de integração/long-lived).
//
// MODELO KOMMO ≠ GHL: aqui LEAD (negócio) e CONTATO são entidades separadas.
//  - moverEtapa/criarOportunidade operam no LEAD (o "deal").
//  - preencherCampo cai no CONTATO por padrão (dados pessoais moram lá).
//  - tags/tarefa/agenda/mensagem/handoff caem no LEAD por padrão (o funil de venda),
//    mas dá pra trocar por meta.entityType / meta.fieldEntityType.
//
// SAÍDA DE MENSAGEM É HÍBRIDA: no Kommo o WhatsApp real sai por uazapi (Transport),
// não por um endpoint REST limpo. Ver memória `kommo_hybrid_transport`. Aqui a
// enviarMensagem só deixa RASTRO no timeline (nota) e NÃO quebra o fluxo.

type EntityType = "leads" | "contacts";

interface KommoMeta {
  /** OBRIGATÓRIO: base do tenant, ex https://minhaempresa.kommo.com */
  baseUrl?: string;
  /** entidade padrão p/ tags/tarefa/agenda/mensagem/handoff (default "leads") */
  entityType?: EntityType;
  /** entidade p/ preencherCampo (default "contacts") */
  fieldEntityType?: EntityType;
  /** pipeline (funil) padrão p/ moverEtapa/criarOportunidade */
  pipelineId?: string;
  /** status (etapa) inicial ao criar lead */
  defaultStatusId?: string;
  /** task_type_id de tarefa comum (default 1) e de reunião (default 2) */
  taskTypeId?: number;
  meetingTaskTypeId?: number;
  /** tags do gate de atendimento (doutrina handoff sem revelar IA) */
  tagIa?: string;
  tagHumano?: string;
}

/** Forma mínima de uma entidade Kommo com tags embutidas (o que lemos de volta). */
interface KommoEntity {
  id: number;
  _embedded?: { tags?: { id?: number; name?: string }[] };
}

export class KommoAdapter implements CrmAdapter {
  readonly kind = "kommo" as const;
  private meta: KommoMeta;

  constructor(private token: string, meta?: Record<string, unknown>) {
    this.meta = (meta ?? {}) as KommoMeta;
  }

  /** Base do tenant (sem barra final) ou erro claro. */
  private base(op: string): string {
    const b = this.meta.baseUrl;
    if (!b) {
      throw new Error(
        `KommoAdapter.${op}: falta meta.baseUrl (ex https://<subdominio>.kommo.com)`,
      );
    }
    return b.replace(/\/+$/, "");
  }

  /** Request real: checa status, devolve JSON (ou {} em corpo vazio). */
  private async request<T = unknown>(
    op: string,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.base(op)}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const detalhe = await res.text().catch(() => "");
      throw new Error(
        `Kommo ${method} ${path} falhou (HTTP ${res.status}): ${detalhe.slice(0, 500)}`,
      );
    }
    const texto = await res.text();
    return (texto ? JSON.parse(texto) : {}) as T;
  }

  /** Converte id string→number do Kommo (tudo numérico) com erro claro. */
  private num(valor: string, campo: string): number {
    const n = Number(valor);
    if (!Number.isFinite(n)) {
      throw new Error(`KommoAdapter: "${campo}" precisa ser numérico no Kommo (recebi "${valor}")`);
    }
    return n;
  }

  private entity(): EntityType {
    return this.meta.entityType ?? "leads";
  }

  /** Move o LEAD de etapa: PATCH /api/v4/leads/{id} { status_id, pipeline_id? }. */
  async moverEtapa(oppId: string, stageId: string): Promise<void> {
    const body: Record<string, unknown> = { status_id: this.num(stageId, "stageId") };
    if (this.meta.pipelineId) body.pipeline_id = this.num(this.meta.pipelineId, "pipelineId");
    await this.request("moverEtapa", "PATCH", `/api/v4/leads/${this.num(oppId, "oppId")}`, body);
  }

  /**
   * Preenche custom field: PATCH /api/v4/{fieldEntity}/{id}
   * { custom_fields_values:[{ field_id, values:[{ value }] }] }.
   */
  async preencherCampo(contactId: string, field: string, value: unknown): Promise<void> {
    const entity = this.meta.fieldEntityType ?? "contacts";
    await this.request(
      "preencherCampo",
      "PATCH",
      `/api/v4/${entity}/${this.num(contactId, "contactId")}`,
      {
        custom_fields_values: [
          { field_id: this.num(field, "field"), values: [{ value }] },
        ],
      },
    );
  }

  /**
   * Cria tarefa: POST /api/v4/tasks [{ text, complete_till, entity_id, entity_type }].
   * complete_till é UNIX (segundos). Sem `quando`, +24h.
   */
  async criarTarefa(contactId: string, titulo: string, quando?: string): Promise<void> {
    const completeTill = this.paraUnix(quando, 24);
    await this.request("criarTarefa", "POST", "/api/v4/tasks", [
      {
        text: titulo,
        complete_till: completeTill,
        entity_id: this.num(contactId, "contactId"),
        entity_type: this.entity(),
        task_type_id: this.meta.taskTypeId ?? 1,
      },
    ]);
  }

  /**
   * Agenda: o Kommo NÃO tem endpoint de appointments/calendário como o GHL.
   * O equivalente real é uma TAREFA de REUNIÃO (task_type_id de reunião) com
   * complete_till no horário marcado. calendarId é ignorado (não existe no Kommo).
   * eventId = id da tarefa criada.
   */
  async agendar(input: {
    contactId: string;
    quando: string;
    calendarId?: string;
  }): Promise<{ eventId: string }> {
    const completeTill = this.paraUnix(input.quando, 1);
    const resp = await this.request<{ _embedded?: { tasks?: { id?: number }[] } }>(
      "agendar",
      "POST",
      "/api/v4/tasks",
      [
        {
          text: "Reunião agendada pela IA",
          complete_till: completeTill,
          entity_id: this.num(input.contactId, "contactId"),
          entity_type: this.entity(),
          task_type_id: this.meta.meetingTaskTypeId ?? 2, // 2 = reunião no Kommo
        },
      ],
    );
    const id = resp._embedded?.tasks?.[0]?.id;
    if (id === undefined) {
      throw new Error("KommoAdapter.agendar: resposta sem id da tarefa/reunião");
    }
    return { eventId: String(id) };
  }

  /** Adiciona tag preservando as existentes (Kommo SOBRESCREVE o array no PATCH). */
  async addTag(contactId: string, tag: string): Promise<void> {
    const entity = this.entity();
    const id = this.num(contactId, "contactId");
    const atuais = await this.lerTags(entity, id);
    if (atuais.some((t) => t.toLowerCase() === tag.toLowerCase())) return; // já tem
    const tags = [...atuais, tag].map((name) => ({ name }));
    await this.request("addTag", "PATCH", `/api/v4/${entity}/${id}`, {
      _embedded: { tags },
    });
  }

  /** Remove tag reescrevendo o array sem ela (mesma pegadinha do SOBRESCREVE). */
  async removerTag(contactId: string, tag: string): Promise<void> {
    const entity = this.entity();
    const id = this.num(contactId, "contactId");
    const atuais = await this.lerTags(entity, id);
    const restantes = atuais.filter((t) => t.toLowerCase() !== tag.toLowerCase());
    if (restantes.length === atuais.length) return; // não tinha a tag
    await this.request("removerTag", "PATCH", `/api/v4/${entity}/${id}`, {
      _embedded: { tags: restantes.map((name) => ({ name })) },
    });
  }

  /**
   * Cria oportunidade = cria LEAD: POST /api/v4/leads
   * [{ name, price?, pipeline_id, status_id?, _embedded:{ contacts:[{id}] } }].
   */
  async criarOportunidade(
    contactId: string,
    funilId: string,
    valor?: number,
  ): Promise<{ oppId: string }> {
    const lead: Record<string, unknown> = {
      name: `Oportunidade ${contactId}`,
      pipeline_id: this.num(funilId, "funilId"), // funilId = pipeline no Kommo
      _embedded: { contacts: [{ id: this.num(contactId, "contactId") }] },
    };
    if (this.meta.defaultStatusId) lead.status_id = this.num(this.meta.defaultStatusId, "defaultStatusId");
    if (typeof valor === "number") lead.price = Math.round(valor);
    const resp = await this.request<{ _embedded?: { leads?: { id?: number }[] } }>(
      "criarOportunidade",
      "POST",
      "/api/v4/leads",
      [lead],
    );
    const id = resp._embedded?.leads?.[0]?.id;
    if (id === undefined) {
      throw new Error("KommoAdapter.criarOportunidade: resposta sem id do lead");
    }
    return { oppId: String(id) };
  }

  /**
   * Envia mensagem — HÍBRIDO. O WhatsApp real do Kommo sai por uazapi (Transport),
   * não por REST. Aqui só gravamos uma NOTA no timeline como rastro do que a IA
   * mandou, pra não quebrar o fluxo. // TODO transporte híbrido (ver memória
   * kommo_hybrid_transport) — a entrega de verdade é responsabilidade do Transport.
   */
  async enviarMensagem(contactId: string, texto: string): Promise<void> {
    const entity = this.entity();
    const id = this.num(contactId, "contactId");
    // POST /api/v4/{entity}/{id}/notes [{ note_type:"common", params:{ text } }]
    await this.request("enviarMensagem", "POST", `/api/v4/${entity}/${id}/notes`, [
      { note_type: "common", params: { text: texto } },
    ]);
  }

  /**
   * Handoff sem revelar a IA (doutrina Metrik): tira a tag "ia" (silencia o agente)
   * e põe "atendimento-humano". No Kommo o gate costuma viver no LEAD (meta.entityType).
   * Nomes override por meta.tagIa/tagHumano.
   */
  async handoff(contactId: string): Promise<void> {
    const tagIa = this.meta.tagIa ?? "ia";
    const tagHumano = this.meta.tagHumano ?? "atendimento-humano";
    await this.removerTag(contactId, tagIa);
    await this.addTag(contactId, tagHumano);
  }

  // ── helpers ──────────────────────────────────────────────────────────

  /** Lê as tags atuais da entidade (GET traz `_embedded.tags`). */
  private async lerTags(entity: EntityType, id: number): Promise<string[]> {
    const ent = await this.request<KommoEntity>("lerTags", "GET", `/api/v4/${entity}/${id}`);
    const tags = ent._embedded?.tags ?? [];
    return tags.map((t) => t.name).filter((n): n is string => typeof n === "string");
  }

  /** ISO/epoch → UNIX em segundos; sem valor, agora + `horasPadrao`. */
  private paraUnix(quando: string | undefined, horasPadrao: number): number {
    if (!quando) {
      return Math.floor((Date.now() + horasPadrao * 60 * 60 * 1000) / 1000);
    }
    const ms = Date.parse(quando);
    if (Number.isNaN(ms)) {
      throw new Error(`KommoAdapter: "quando" inválido (esperado ISO 8601, recebi "${quando}")`);
    }
    return Math.floor(ms / 1000);
  }
}
