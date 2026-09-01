export type { CrmAdapter } from "./adapter";
import type { CrmAdapter } from "./adapter";
import { GhlAdapter } from "./ghl";
import { KommoAdapter } from "./kommo";

/** cria o adapter certo pro CRM do tenant. o token vem do VAULT, nunca do browser. */
export function makeAdapter(kind: "ghl" | "kommo", token: string, meta?: Record<string, unknown>): CrmAdapter {
  return kind === "ghl" ? new GhlAdapter(token, meta) : new KommoAdapter(token, meta);
}

export { GhlAdapter, KommoAdapter };
