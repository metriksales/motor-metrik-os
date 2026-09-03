// @motor/runtime · deps — as dependências injetadas no Data Plane.
// Tudo plugável: o runtime não conhece nada concreto (CRM/LLM/canal/DB).
// Quem monta as portas de verdade é o host (edge/worker); aqui vive só o
// contrato + uma implementação EM MEMÓRIA pra dev/teste sem rede.
import type {
  AgentSpec,
  MotorPorts,
  MotorRegistry,
  RuntimeLog,
} from "@motor/core";

/** As portas de infra que o pipeline precisa pra rodar um evento. */
export interface RuntimeDeps {
  /** carrega o spec PUBLICADO do tenant+agente (cache/edge). null = não achou. */
  loadSpec(orgId: string, agentId: string): Promise<AgentSpec | null>;
  /** monta os ports (now/log/state/crm/sender/transport/llm) do par org+agente. */
  portsFor(orgId: string, agentId: string): Promise<MotorPorts>;
  /** biblioteca de motores disponível — INJETADA (runtime não importa os motores). */
  registry: MotorRegistry;
  /** caixa-preta: cada execução do runtime vira uma linha de log. */
  log(l: RuntimeLog): void;
}

export interface MemoryDepsOptions {
  /** specs pré-carregadas, indexadas por chave "orgId:agentId". */
  specs?: Record<string, AgentSpec>;
  /** registry de motores a usar; default = registry vazio (nenhum motor casa). */
  registry?: MotorRegistry;
}

/** Registry sem nenhum motor — default do modo memória (o host injeta o real). */
const REGISTRY_VAZIO: MotorRegistry = {
  get: () => undefined,
  all: () => [],
  match: () => [],
};

/**
 * createMemoryDeps — deps EM MEMÓRIA pra dev/teste (sem Redis/DB/rede).
 * - loadSpec: busca no mapa por `${orgId}:${agentId}` (null se não achar).
 * - portsFor: MotorPorts com now=new Date(), log num buffer, getState/setState
 *   num Map local; crm/sender/transport/llm ficam undefined — o motor trata a
 *   ausência (stub honesto; o host de produção liga as portas de verdade).
 * - registry: vem de opts.registry, senão o REGISTRY_VAZIO.
 * O mesmo buffer recebe tanto o log do runtime quanto o log dos ports.
 */
export function createMemoryDeps(opts: MemoryDepsOptions = {}): RuntimeDeps {
  const specs = opts.specs ?? {};
  const registry = opts.registry ?? REGISTRY_VAZIO;
  const logs: RuntimeLog[] = [];
  const estado = new Map<string, unknown>();

  return {
    async loadSpec(orgId, agentId) {
      return specs[`${orgId}:${agentId}`] ?? null;
    },
    async portsFor(_orgId, _agentId) {
      const ports: MotorPorts = {
        now: () => new Date(),
        log: (l) => {
          logs.push(l);
        },
        getState: async (key) => estado.get(key),
        setState: async (key, value) => {
          // TTL ignorado em memória (dev); em produção usa Redis com ttlSec.
          estado.set(key, value);
        },
        // crm/sender/transport/llm ficam undefined em memória — o motor trata.
        // TODO: ligar crm em @motor/crm (makeAdapter(kind, tokenDoVault)).
        // TODO: ligar sender/transport em @motor/messaging.
        // TODO: ligar llm na skill agente-ia-metrik-completo.
      };
      return ports;
    },
    registry,
    log: (l) => {
      logs.push(l);
    },
  };
}
