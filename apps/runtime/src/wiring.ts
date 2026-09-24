// @motor/runtime · wiring — a composição REAL (a raiz de montagem).
// Aqui (e SÓ aqui) o runtime importa os motores concretos e as peças de
// mensagem, montando um RuntimeDeps de verdade. É a "tomada" onde a
// biblioteca (motors) e as peças (messaging) se ligam ao Data Plane —
// mantendo o pipeline plugável (ele só conhece os contratos do core).
import {
  resolveMotorConfig,
  type AgentSpec,
  type CrmPort,
  type LlmPort,
  type MotorPorts,
  type MotorRegistry,
  type RuntimeLog,
} from "@motor/core";
import { defaultRegistry } from "@motor/motors";
import {
  makeSender,
  makeTransport,
  type UazapiInstancia,
  type UazapiHttp,
} from "@motor/messaging";
import type { RuntimeDeps } from "./deps";

const CANAIS = new Set(["ghl-native", "uazapi-multi"]);
const SENDERS = new Set(["meta-template", "llm-freeform"]);

export interface LiveDepsOptions {
  /** specs publicados, indexados por "orgId:agentId". */
  specs: Record<string, AgentSpec>;
  /** biblioteca de motores (default = defaultRegistry com follow-up/agenda/atendimento). */
  registry?: MotorRegistry;
  /** portas de infra reais (injetadas pelo host; no dev entram fakes). */
  crm?: CrmPort;
  llm?: LlmPort;
  uazapi?: { instancias: UazapiInstancia[]; http?: UazapiHttp };
  /** observador de log (além do buffer retornado). */
  onLog?: (l: RuntimeLog) => void;
}

/**
 * createLiveDeps — RuntimeDeps com motores REAIS + peças de mensagem REAIS.
 * O portsFor escolhe sender/transport pela CONFIG do agente (os "botões" que o
 * cliente mexe): canal → Transport, sender → como monta. Trocar de canal/sender
 * é trocar a peça, sem tocar no motor. Estado em memória (Map) — em produção, Redis.
 */
export function createLiveDeps(opts: LiveDepsOptions): { deps: RuntimeDeps; logs: RuntimeLog[] } {
  const logs: RuntimeLog[] = [];
  const estado = new Map<string, unknown>();
  const registry = opts.registry ?? defaultRegistry;
  const emit = (l: RuntimeLog) => {
    logs.push(l);
    opts.onLog?.(l);
  };

  const deps: RuntimeDeps = {
    async loadSpec(orgId, agentId) {
      return opts.specs[`${orgId}:${agentId}`] ?? null;
    },
    async portsFor(orgId, agentId) {
      const spec = opts.specs[`${orgId}:${agentId}`];
      const cfg = spec ? resolveMotorConfig(spec, "followup") : {};

      // canal (config) → qual Transport; fallback: humanos→uazapi, senão GHL nativo.
      const canalCfg = typeof cfg.canal === "string" ? cfg.canal : "";
      const canal = CANAIS.has(canalCfg)
        ? canalCfg
        : cfg.publico === "humanos"
          ? "uazapi-multi"
          : "ghl-native";
      // sender (config) → como a mensagem é montada.
      const senderCfg =
        typeof cfg.sender === "string" && SENDERS.has(cfg.sender) ? cfg.sender : "meta-template";

      const transport = makeTransport(canal, {
        crm: opts.crm,
        instancias: opts.uazapi?.instancias ?? [],
        http: opts.uazapi?.http,
      });
      const sender = makeSender(senderCfg, { llm: opts.llm });

      const ports: MotorPorts = {
        now: () => new Date(),
        log: emit,
        crm: opts.crm,
        sender,
        transport,
        llm: opts.llm,
        getState: async (k) => estado.get(k),
        setState: async (k, v) => {
          estado.set(k, v);
        },
      };
      return ports;
    },
    registry,
    log: emit,
  };

  return { deps, logs };
}
