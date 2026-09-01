// A "língua única" que o agente fala. Cada CRM (GHL/Kommo) implementa isto.
export interface CrmAdapter {
  readonly kind: "ghl" | "kommo";
  moverEtapa(oppId: string, stageId: string): Promise<void>;
  preencherCampo(contactId: string, field: string, value: unknown): Promise<void>;
  criarTarefa(contactId: string, titulo: string, quando?: string): Promise<void>;
  agendar(input: { contactId: string; quando: string; calendarId?: string }): Promise<{ eventId: string }>;
  addTag(contactId: string, tag: string): Promise<void>;
  removerTag(contactId: string, tag: string): Promise<void>;
  criarOportunidade(contactId: string, funilId: string, valor?: number): Promise<{ oppId: string }>;
  enviarMensagem(contactId: string, texto: string): Promise<void>;
  handoff(contactId: string): Promise<void>;
}
