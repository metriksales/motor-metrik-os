// @motor/runtime · host — a composição de PRODUÇÃO (o que o webhook/cron usam).
// Monta um RuntimeDeps real: spec do Neon (versão publicada), cérebro (OpenAI/
// Fake), mãos (CRM via vault) e canal (sender/transport por config). O que ainda
// depende de infra externa (token por org = vault; estado = Redis) entra por PORT
// injetado — sem fingir que existe. Sem vault → o CRM fica off (fail-open honesto).
import { and, eq } from "drizzle-orm";
import { db, agents, agentSpecs, runtimeLogs } from "@motor/db";
import { makeBrain } from "@motor/llm";
import {
  makeSender,
  makeTransport,
  type UazapiInstancia,
  type UazapiHttp,
} from "@motor/messaging";
import { defaultRegistry } from "@motor/motors";
import { makeAdapter } from "@motor/crm";
import type {
  AgentSpec,
  ConnKind,
  CrmPort,
  LlmPort,
  MotorPorts,
  MotorRegistry,
  RuntimeLog,
} from "@motor/core";
import type { RuntimeDeps } from "./deps";

/** Vault por org: resolve o token do CRM daquele tenant (o segredo NUNCA no código). */
export interface VaultPort {
  resolveCrm(orgId: string): Promise<{ kind: ConnKind; token: string; meta?: Record<string, unknown> } | null>;
}

export interface ProductionEnv {
  registry?: MotorRegistry;
  /** sem vault → o agente responde/loga, mas não escreve no CRM (fail-open). */
  vault?: VaultPort;
  /** sem key → FakeBrain (não é produção de verdade, mas não quebra). */
  openaiApiKey?: string;
  model?: string;
  uazapi?: { instancias: UazapiInstancia[]; http?: UazapiHttp };
  onLog?: (l: RuntimeLog) => void;
  now?: () => Date;
}

const CANAIS = new Set(["ghl-native", "uazapi-multi"]);
const SENDERS = new Set(["meta-template", "llm-freeform"]);

/** Config do follow-up a partir do spec (os "botões" do cliente). */
function configFollowup(spec: AgentSpec): Record<string, unknown> {
  const cfg: Record<string, unknown> = {};
  for (const m of spec.modulos ?? []) {
    if (m.onde === "followup" && m.config) Object.assign(cfg, m.config);
  }
  return cfg;
}

/**
 * createProductionDeps — RuntimeDeps de produção.
 * - loadSpec: lê o agentSpecs PUBLICADO (version = agents.currentSpecVersion) do Neon.
 * - portsFor: cérebro (llm) + mãos (crm via vault) + canal (sender/transport por config).
 *   Estado ainda em memória — TODO: Redis/Upstash com TTL por org (anti-eco, pausa do lead).
 */
export function createProductionDeps(env: ProductionEnv): RuntimeDeps {
  const registry = env.registry ?? defaultRegistry;
  const llm: LlmPort = makeBrain({ apiKey: env.openaiApiKey, model: env.model });
  const estado = new Map<string, unknown>(); // TODO: Upstash Redis (TTL por org).
  const now = env.now ?? (() => new Date());
  // Flight Recorder: toda execução vira linha em runtime_logs (fire-and-forget —
  // gravar log NUNCA derruba o motor). env.onLog continua recebendo em paralelo.
  const log = (l: RuntimeLog) => {
    env.onLog?.(l);
    void db
      .insert(runtimeLogs)
      .values({
        orgId: l.orgId,
        agentId: l.agentId,
        motor: l.motor,
        ok: l.ok,
        resumo: l.resumo,
        did: l.did,
        erro: l.erro,
        meta: l.meta,
      })
      .catch(() => {});
  };

  async function loadSpec(orgId: string, agentId: string): Promise<AgentSpec | null> {
    const [agent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.orgId, orgId)));
    const ver = agent?.currentSpecVersion ?? null;
    if (ver == null) return null;
    const [row] = await db
      .select()
      .from(agentSpecs)
      .where(and(eq(agentSpecs.orgId, orgId), eq(agentSpecs.agentId, agentId), eq(agentSpecs.version, ver)));
    return (row?.spec as AgentSpec | undefined) ?? null;
  }

  return {
    loadSpec,
    async portsFor(orgId, agentId) {
      const spec = await loadSpec(orgId, agentId);
      const cfg = spec ? configFollowup(spec) : {};

      // Mãos no CRM: só se o vault entregar o token do tenant.
      let crm: CrmPort | undefined;
      if (env.vault) {
        const conn = await env.vault.resolveCrm(orgId);
        if (conn) {
          const kind = conn.kind === "kommo" ? "kommo" : "ghl";
          crm = makeAdapter(kind, conn.token, conn.meta);
        }
      }

      // Canal e montagem: escolhidos pela CONFIG do agente (os "botões").
      const canalCfg = typeof cfg.canal === "string" ? cfg.canal : "";
      const canal = CANAIS.has(canalCfg)
        ? canalCfg
        : cfg.publico === "humanos"
          ? "uazapi-multi"
          : "ghl-native";
      const senderCfg =
        typeof cfg.sender === "string" && SENDERS.has(cfg.sender) ? cfg.sender : "meta-template";

      const ports: MotorPorts = {
        now,
        log,
        crm,
        llm,
        sender: makeSender(senderCfg, { llm }),
        transport: makeTransport(canal, {
          crm,
          instancias: env.uazapi?.instancias ?? [],
          http: env.uazapi?.http,
        }),
        getState: async (k) => estado.get(k),
        setState: async (k, v) => {
          estado.set(k, v);
        },
      };
      return ports;
    },
    registry,
    log,
  };
}
