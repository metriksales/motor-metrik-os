import type { CrmAdapter } from "./adapter";

// TODO: ligar nas libs `ghl/` da skill agente-ia-metrik-completo.
// Token (PIT/OAuth) faz 100% do dado; app do marketplace é opcional.
const TODO = (m: string): never => {
  throw new Error(`GhlAdapter.${m} — TODO: usar a lib ghl/ da skill agente-ia-metrik-completo`);
};

export class GhlAdapter implements CrmAdapter {
  readonly kind = "ghl" as const;
  constructor(private token: string, private meta?: Record<string, unknown>) {}
  async moverEtapa(_oppId: string, _stageId: string) { TODO("moverEtapa"); }
  async preencherCampo(_c: string, _f: string, _v: unknown) { TODO("preencherCampo"); }
  async criarTarefa(_c: string, _t: string, _q?: string) { TODO("criarTarefa"); }
  async agendar(_i: { contactId: string; quando: string; calendarId?: string }): Promise<{ eventId: string }> { return TODO("agendar"); }
  async addTag(_c: string, _t: string) { TODO("addTag"); }
  async removerTag(_c: string, _t: string) { TODO("removerTag"); }
  async criarOportunidade(_c: string, _f: string, _v?: number): Promise<{ oppId: string }> { return TODO("criarOportunidade"); }
  async enviarMensagem(_c: string, _t: string) { TODO("enviarMensagem"); }
  async handoff(_c: string) { TODO("handoff"); }
}
