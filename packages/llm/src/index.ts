// @motor/llm — o CÉREBRO do motor.
//
// Dois cérebros, a MESMA interface (LlmPort de @motor/core):
//   • OpenAiBrain — produção, via Responses API (reasoning + tools);
//   • FakeBrain   — determinístico, offline, pro porteiro de evals e testes.
// A `makeBrain` escolhe: tem apiKey → OpenAiBrain; senão → FakeBrain.
import type { LlmPort } from "@motor/core";
import { OpenAiBrain, type OpenAiBrainOptions } from "./openai";
import { FakeBrain, type FakeBrainOptions } from "./fake";

export { OpenAiBrain, type OpenAiBrainOptions } from "./openai";
export { FakeBrain, type FakeRule, type FakeBrainOptions } from "./fake";

/** Opções da factory: com apiKey vira OpenAiBrain; sem, cai no FakeBrain. */
export interface MakeBrainOptions extends Partial<OpenAiBrainOptions> {
  /** regras/opções do FakeBrain quando não há apiKey */
  fake?: FakeBrainOptions;
}

/**
 * Devolve o cérebro certo pro contexto:
 *   • apiKey presente → OpenAiBrain (produção);
 *   • sem apiKey       → FakeBrain (offline, evals/testes).
 * O token entra por opção (vault/env), nunca embutido.
 */
export function makeBrain(opts?: MakeBrainOptions): LlmPort {
  if (opts?.apiKey) {
    return new OpenAiBrain({
      apiKey: opts.apiKey,
      model: opts.model,
      baseUrl: opts.baseUrl,
      reasoningEffort: opts.reasoningEffort,
    });
  }
  return new FakeBrain(opts?.fake);
}
