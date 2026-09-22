import assert from "node:assert/strict";
import test from "node:test";
import {
  aplicarPlanoDeMudanca,
  criarProvaOperacional,
  planejarMudanca,
  resolveMotorConfig,
  type AgentSpec,
} from "../src/index";

const spec: AgentSpec = {
  name: "Bia",
  tipo: "resposta",
  cerebro: {
    identidade: "Bia, SDR da Metrik",
    regras: ["não inventa preço"],
  },
  motores: [
    {
      id: "followup",
      nome: "Follow-up",
      on: false,
      quando: "lead para de responder",
      faz: "retoma o contato",
    },
  ],
  modulos: [],
  integracoes: ["whatsapp"],
  blindado: ["identidade"],
};

test("understands a follow-up request as an automation with an exact cadence", () => {
  const plan = planejarMudanca("Quando o lead sumir, espera 1 dia e manda só 1 follow");

  assert.equal(plan.kind, "motor");
  assert.equal(plan.motorId, "followup");
  if (plan.kind !== "motor") return;
  assert.equal(plan.configPatch.maxToques, 1);
  assert.deepEqual(plan.configPatch.passos, [{ indice: 0, atrasoHoras: 24 }]);
});

test("applies an automation to the motor without polluting conversation rules", () => {
  const plan = planejarMudanca("Quando o lead sumir, espera 1 dia e manda só 1 follow");
  const changed = aplicarPlanoDeMudanca(spec, plan);

  assert.deepEqual(changed.cerebro.regras, spec.cerebro.regras);
  assert.equal(changed.motores[0].on, true);
  assert.equal(resolveMotorConfig(changed, "followup").maxToques, 1);
  assert.deepEqual(resolveMotorConfig(changed, "followup").passos, [
    { indice: 0, atrasoHoras: 24 },
  ]);
});

test("proves an automation with operational checks instead of chat responses", () => {
  const plan = planejarMudanca("Quando o lead sumir, espera 1 dia e manda só 1 follow");
  const changed = aplicarPlanoDeMudanca(spec, plan);
  const proof = criarProvaOperacional(spec, changed, plan);

  assert.equal(proof.kind, "motor");
  assert.equal(proof.aprovado, true);
  assert.equal(proof.agora.espera, "1 dia");
  assert.equal(proof.agora.quantidade, "1 mensagem");
  assert.ok(proof.checks.every((check) => check.passou));
});

test("keeps conversation, tools and documents as different change classes", () => {
  assert.equal(planejarMudanca("Fala num tom mais próximo").kind, "conversa");
  assert.equal(planejarMudanca("Conecta o WhatsApp da empresa").kind, "ferramenta");
  assert.equal(planejarMudanca("Usa o PDF que anexei como base").kind, "documento");
});

