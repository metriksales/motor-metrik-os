// Gera execuções REAIS no Flight Recorder (runtime_logs no Neon): roda os
// MOTORES DE VERDADE (atendimento + followup) com cérebro fake offline e grava
// cada execução. É exatamente o que os agentes reais (Bia etc.) farão via
// POST /api/control?action=log — aqui, direto no banco, pra acender a tela.
//   DATABASE_URL='...' npx tsx apps/runtime/src/live-run.ts
import { db, runtimeLogs } from "@motor/db";
import { followupMotor, atendimentoMotor } from "@motor/motors";
import { FakeBrain } from "@motor/llm";
import { makeSender, makeTransport } from "@motor/messaging";
import { biaSDR } from "@motor/samples";
import type { CrmPort, LlmTurn, MotorPorts, RuntimeEvent, RuntimeLog } from "@motor/core";

// TRAVA (S-007): este script grava execuções SINTÉTICAS no Flight Recorder.
// Rodado contra o banco de produção, ele inventa atendimento e dinheiro na
// conta de um cliente. Só roda com a confirmação explícita:
//   PERMITIR_DADO_SINTETICO=1 DATABASE_URL='...' npx tsx apps/runtime/src/live-run.ts
if (process.env.PERMITIR_DADO_SINTETICO !== "1") {
  console.error(
    "live-run gera execuções sintéticas e não deve tocar banco de cliente.\n" +
      "Rode com PERMITIR_DADO_SINTETICO=1 e um DATABASE_URL de desenvolvimento.",
  );
  process.exit(1);
}

const ORG = "9cece617-ccf0-4cdf-b187-2323afe8f90d"; // Vega Consultoria (seed)
const ATENDENTE = "3cc1d9f9-e166-4ba7-856b-096001a5b651"; // agente real no banco

// CRM fake silencioso (as "mãos" reais entram com o vault; o MOTOR é o real).
const crm: CrmPort = {
  kind: "fake",
  async moverEtapa() {},
  async preencherCampo() {},
  async criarTarefa() {},
  async agendar() {
    return { eventId: "evt_" + Math.random().toString(36).slice(2, 8) };
  },
  async addTag() {},
  async removerTag() {},
  async criarOportunidade() {
    return { oppId: "opp_x" };
  },
  async enviarMensagem() {},
  async handoff() {},
};

const brain = new FakeBrain({
  regras: [
    {
      quando: /marcar|reuni|hor[áa]rio|agenda|sexta/i,
      responder: (): LlmTurn => ({
        texto: "Perfeito! Vou marcar sua reunião.",
        toolCalls: [{ tool: "agendar", args: { quando: "2026-09-11T14:00:00Z" } }],
      }),
    },
    {
      quando: /pre[çc]o|valor|quanto custa/i,
      responder: (): LlmTurn => ({ texto: "Claro! Me conta rapidinho: qual o tamanho da sua operação hoje?" }),
    },
  ],
  textoPadrao: "Que bom que você chegou! O que te chamou atenção pra falar com a gente?",
});

const estado = new Map<string, unknown>();
let gravadas = 0;

const ports: MotorPorts = {
  now: () => new Date(),
  log: (l: RuntimeLog) => {
    // reunião marcada → Radar de Dinheiro (valor estimado por reunião: R$ 1.500)
    const marcouReuniao = l.did?.some((d) => d.startsWith("agendar"));
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
        meta: { ...((l.meta as object) ?? {}), origem: "live-run" },
        valorCentavos: marcouReuniao ? 150000 : undefined,
      })
      .then(() => {
        gravadas++;
      })
      .catch((e: Error) => console.error("log falhou:", e.message));
  },
  crm,
  llm: brain,
  sender: makeSender("llm-freeform", { llm: brain }),
  transport: makeTransport("uazapi-multi", { instancias: [{ instanceId: "inst_metrik", token: "x" }] }),
  getState: async (k) => estado.get(k),
  setState: async (k, v) => {
    estado.set(k, v);
  },
};

async function main() {
  const entradas = [
    { contato: "lead_marina", texto: "oi, podemos marcar uma reunião?" },
    { contato: "lead_rodrigo", texto: "quero saber o preço de vocês" },
    { contato: "lead_julia", texto: "vi o anúncio de vocês no Instagram" },
    { contato: "lead_vega", texto: "tem horário na sexta de manhã?" },
    { contato: "lead_carlos", texto: "quanto custa o plano?" },
  ];
  for (const e of entradas) {
    const evt: RuntimeEvent = {
      orgId: ORG,
      agentId: ATENDENTE,
      tipo: "inbound",
      canal: "whatsapp",
      contactId: e.contato,
      texto: e.texto,
      at: new Date().toISOString(),
    };
    const r = await atendimentoMotor.run({ orgId: ORG, agentId: ATENDENTE, spec: biaSDR, event: evt }, ports);
    console.log(`atendimento ${e.contato}: ${r.ok ? "ok" : "falha"} · ${r.did.join(", ")}`);
  }

  // Follow-up REAL: toques vencidos pra 2 leads que sumiram.
  for (const contato of ["lead_beatriz", "lead_prado"]) {
    const evt: RuntimeEvent = {
      orgId: ORG,
      agentId: ATENDENTE,
      tipo: "schedule",
      contactId: contato,
      at: new Date(Date.now() - 2 * 3600_000).toISOString(),
      meta: { telefone: "5511999990000" },
    };
    const r = await followupMotor.run(
      {
        orgId: ORG,
        agentId: ATENDENTE,
        spec: biaSDR,
        event: evt,
        config: { diasUteis: "false", janelaInicio: "00:00", janelaFim: "23:59", sender: "llm-freeform", canal: "uazapi-multi" },
      },
      ports
    );
    console.log(`followup ${contato}: ${r.ok ? "ok" : "falha"} · ${r.did.join(", ")}`);
  }

  await new Promise((res) => setTimeout(res, 2500)); // inserts fire-and-forget terminarem
  console.log(`\n✅ ${gravadas} execuções REAIS gravadas no Flight Recorder (runtime_logs).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
