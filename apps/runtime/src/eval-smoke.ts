// @motor/runtime · eval-smoke — prova o PORTEIRO rodando OFFLINE (sem token).
// biaEvals (@motor/samples) × FakeBrain (@motor/llm) × runEvals (@motor/evals).
// Mostra a taxa e o aprovado — é o gate que segura custom no sandbox.
//   npx tsx apps/runtime/src/eval-smoke.ts
import type { AgentRunner, LlmTurn } from "@motor/core";
import { biaEvals, biaSDR } from "@motor/samples";
import { FakeBrain } from "@motor/llm";
import { runEvals } from "@motor/evals";

// System a partir do cérebro da Bia (identidade + oferta + tom + travas).
function montarSystem(): string {
  const c = biaSDR.cerebro;
  return [
    c.identidade,
    c.oferta ? `Oferta: ${c.oferta}` : "",
    c.tom ? `Tom: ${c.tom}` : "",
    ...c.regras.map((r) => `- ${r}`),
  ]
    .filter(Boolean)
    .join("\n");
}

// Cérebro fake calibrado pras regras da Bia (respostas que RESPEITAM as travas).
const brain = new FakeBrain({
  regras: [
    {
      quando: /pre[çc]o|valor|quanto custa/i,
      responder: (): LlmTurn => ({
        texto: "Claro! Pra te passar certinho, me conta: qual o tamanho da sua operação hoje?",
      }),
    },
    {
      quando: /marcar|reuni|hor[áa]rio|agenda/i,
      responder: (): LlmTurn => ({
        texto: "Perfeito, vou marcar nossa reunião!",
        toolCalls: [{ tool: "agendar", args: { quando: "2026-09-05T14:00:00Z" } }],
      }),
    },
    {
      quando: /rob[ôo]|\bia\b|intelig[êe]ncia/i,
      responder: (): LlmTurn => ({
        texto: "Sou a Bia, da Vega 😊 tô aqui pra te ajudar. Como posso ajudar hoje?",
      }),
    },
  ],
  textoPadrao: "Que bom que você chegou! O que te chamou atenção pra falar com a gente?",
});

const system = montarSystem();

// Runner sob teste: o cérebro decide; mapeamos o turno pro formato do eval.
const runner: AgentRunner = async (entrada) => {
  const turn = await brain.responder({ system, historico: [{ role: "user", content: entrada.texto ?? "" }] });
  const moved = turn.toolCalls?.find((t) => t.tool === "moverEtapa");
  return {
    texto: turn.texto,
    toolCalls: turn.toolCalls,
    movedStage: moved ? String(moved.args.stageId ?? "") : undefined,
  };
};

async function main() {
  const res = await runEvals(biaEvals, runner, 0.75);
  console.log("\n=== EVALS da Bia (porteiro, offline) ===");
  for (const c of res.casos) {
    console.log(`   ${c.passou ? "✓" : "✗"} ${c.nome}${c.falhas.length ? " — " + c.falhas.join("; ") : ""}`);
  }
  console.log(
    `\n   taxa: ${(res.taxa * 100).toFixed(0)}% (${res.passaram}/${res.total}) · limiar ${(res.limiar * 100).toFixed(0)}% · ${res.aprovado ? "APROVADO ✅ (custom liberado)" : "REPROVADO ❌ (fica no sandbox)"}`,
  );
  process.exit(res.aprovado ? 0 : 1);
}

main().catch((e) => {
  console.error("eval-smoke falhou:", e);
  process.exit(1);
});
