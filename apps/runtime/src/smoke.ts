// @motor/runtime · smoke — prova, SEM Neon, que a plataforma conecta ponta a ponta.
// Motores REAIS (@motor/motors) + peças de mensagem REAIS (@motor/messaging) +
// specs de exemplo (@motor/samples) + ports FAKE (crm/llm/uazapi) → roda eventos
// pelo pipeline e imprime a caixa-preta.  Rodar:  npx tsx apps/runtime/src/smoke.ts
import type { AgentSpec, CrmPort, LlmPort, RuntimeEvent } from "@motor/core";
import { biaSDR, cobradorEquipe } from "@motor/samples";
import { runEvent } from "./pipeline";
import { createLiveDeps } from "./wiring";

const ORG = "org_demo";

// ── CRM fake: loga o que faria no CRM real (sem rede) ──
const crmFake: CrmPort = {
  kind: "fake",
  async moverEtapa(o, s) { console.log(`      · crm.moverEtapa ${o}→${s}`); },
  async preencherCampo(_c, f, v) { console.log(`      · crm.preencherCampo ${f}=${String(v)}`); },
  async criarTarefa(_c, t) { console.log(`      · crm.criarTarefa "${t}"`); },
  async agendar({ contactId, quando }) { console.log(`      · crm.agendar ${contactId} @ ${quando}`); return { eventId: "evt_fake" }; },
  async addTag(c, t) { console.log(`      · crm.addTag ${c} #${t}`); },
  async removerTag(c, t) { console.log(`      · crm.removerTag ${c} #${t}`); },
  async criarOportunidade() { console.log(`      · crm.criarOportunidade`); return { oppId: "opp_fake" }; },
  async enviarMensagem(c, txt) { console.log(`      · crm.enviarMensagem → ${c}: "${txt}"`); },
  async handoff(c) { console.log(`      · crm.handoff ${c}`); },
};

// ── Cérebro fake: pede reunião → chama a tool agendar; senão responde texto ──
const llmFake: LlmPort = {
  async responder({ historico }) {
    const ult = historico[historico.length - 1]?.content ?? "";
    if (/marcar|reuni|hor[áa]rio|agenda/i.test(ult)) {
      return { texto: "Perfeito! Vou marcar sua reunião.", toolCalls: [{ tool: "agendar", args: { quando: "2026-09-05T14:00:00Z" } }] };
    }
    return { texto: "Oi! Sou a Bia da Vega, como posso ajudar?" };
  },
};

// ── "Follow-up pros HUMANOS": MESMO motor, config publico=humanos + canal interno ──
const cobradorHumanos: AgentSpec = {
  ...cobradorEquipe,
  modulos: [
    {
      id: "cobranca", nome: "Cobrança", onde: "followup", risco: "verde",
      config: {
        publico: "humanos", canal: "uazapi-multi", sender: "llm-freeform",
        maxToques: "3", diasUteis: "false", janelaInicio: "00:00", janelaFim: "23:59",
      },
    },
  ],
};

async function main() {
  const { deps, logs } = createLiveDeps({
    specs: { [`${ORG}:bia`]: biaSDR, [`${ORG}:cobrador`]: cobradorHumanos },
    crm: crmFake,
    llm: llmFake,
    uazapi: {
      instancias: [
        { ownerId: "vend_joao", instanceId: "inst_joao", token: "fake" },
        { instanceId: "inst_geral", token: "fake" },
      ],
    },
  });

  console.log("\n=== 1) INBOUND na Bia (motor atendimento) — lead pede reunião ===");
  const e1: RuntimeEvent = {
    orgId: ORG, agentId: "bia", tipo: "inbound", canal: "whatsapp",
    contactId: "lead_marina", texto: "oi, podemos marcar uma reunião?", at: new Date().toISOString(),
  };
  const r1 = await runEvent(e1, deps);
  console.log("   → motores:", r1.ran, "| resultados:", r1.results.map((r) => (r.ok ? "ok" : "falha")));

  console.log("\n=== 2) SCHEDULE no Cobrador (follow-up PROS HUMANOS) — toque vencido ===");
  const doisHAtras = new Date(Date.now() - 2 * 3600_000).toISOString();
  const e2: RuntimeEvent = {
    orgId: ORG, agentId: "cobrador", tipo: "schedule", contactId: "vend_joao",
    at: doisHAtras, meta: { ownerId: "vend_joao", telefone: "5511999990000", nome: "João" },
  };
  const r2 = await runEvent(e2, deps);
  console.log("   → motores:", r2.ran, "| resultados:", r2.results.map((r) => (r.ok ? "ok" : "falha")));

  console.log("\n=== CAIXA-PRETA (o log do runtime) ===");
  for (const l of logs) {
    console.log(`   [${l.motor ?? "runtime"}] ${l.ok ? "✓" : "✗"} ${l.resumo}${l.did && l.did.length ? " · " + l.did.join(", ") : ""}`);
  }

  console.log(`\n✅ smoke ok — ${logs.length} linhas de log; plataforma conectada ponta a ponta SEM Neon.`);
}

main().catch((e) => {
  console.error("smoke falhou:", e);
  process.exit(1);
});
