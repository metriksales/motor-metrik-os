// @motor/runtime — superfície pública do Data Plane.
// O host (webhook/cron/worker) importa DAQUI.
export { handleInbound, runEvent, createMemoryDeps } from "./inbound";
export type { InboundEvent } from "./inbound";
export { createLiveDeps, type LiveDepsOptions } from "./wiring";
export { createProductionDeps, type ProductionEnv, type VaultPort } from "./host";
export type { RuntimeDeps, MemoryDepsOptions } from "./deps";
