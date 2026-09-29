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
import {
  resolveMotorConfig,
  type AgentSpec,
  type ConnKind,
  type CrmPort,
  type LlmPort,
  type MotorPorts,
  type MotorRegistry,
  type RuntimeLog,
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
  /**
   * Para onde vai uma falha do próprio runtime (S-012) — hoje, a linha do
   * Flight Recorder que não gravou. O webhook liga isto ao rastreador de
   * erros; sem gancho, fica só a linha no log do servidor.
   */
  aoFalhar?: (onde: string, erro: unknown, extra: { orgId?: string }) => Promise<unknown> | unknown;
}

const CANAIS = new Set(["ghl-native", "uazapi-multi"]);
const SENDERS = new Set(["meta-template", "llm-freeform"]);

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
  // Flight Recorder: cada execução vira UMA linha em runtime_logs (S-012).
  //
  // Fire-and-forget de propósito — gravar log NUNCA derruba o motor — mas com
  // duas garantias que não existiam:
  //  1. a gravação NÃO É ENGOLIDA. Era `.catch(() => {})`, e foi assim que uma
  //     recusa de RLS (o runtime escrevendo sem contexto de conta, por carregar
  //     a própria cópia de @motor/db) ficou invisível: o Flight Recorder parou
  //     de gravar e ninguém soube. Agora a recusa vira linha no log do servidor.
  //  2. a gravação PODE SER ESPERADA. Numa função serverless o processo congela
  //     assim que a resposta sai; uma linha ainda em voo some. `flush()` espera
  //     o que está pendente — o webhook chama antes de responder.
  const pendentes = new Set<Promise<void>>();
  const log = (l: RuntimeLog) => {
    env.onLog?.(l);
    const gravacao: Promise<void> = db
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
      .then(() => undefined)
      .catch(async (e: unknown) => {
        const motivo = e instanceof Error ? e.message : String(e);
        console.error(`[runtime] log NÃO gravado org=${l.orgId} agent=${l.agentId} motor=${l.motor ?? "-"}: ${motivo}`);
        // o aviso também é aguardado pelo flush: faz parte da mesma gravação
        try {
          await env.aoFalhar?.("runtime:flight-recorder", e, { orgId: l.orgId });
        } catch {
          /* o rastreador nunca derruba o motor */
        }
      })
      .finally(() => pendentes.delete(gravacao));
    pendentes.add(gravacao);
  };
  async function flush() {
    await Promise.allSettled([...pendentes]);
  }

  // O que o MOTOR registra por conta própria ("tool X falhou", "cérebro
  // falhou") é detalhe: vai para o log do servidor e para env.onLog, não para o
  // banco. Antes ia para o banco também, e cada execução virava duas linhas —
  // a do motor e a do pipeline, com o mesmo conteúdo. A linha da execução é
  // uma, escrita pelo pipeline, com o resumo que o motor devolve no resultado.
  const detalhe = (l: RuntimeLog) => {
    env.onLog?.(l);
    console.info(`[motor:${l.motor ?? "-"}] ${l.ok ? "ok" : "FALHA"} ${l.resumo}${l.erro ? ` — ${l.erro}` : ""}`);
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
      const cfg = spec ? resolveMotorConfig(spec, "followup") : {};

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
        log: detalhe,
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
    flush,
  };
}
