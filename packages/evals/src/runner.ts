// @motor/evals — o runner e o PORTEIRO.
// Roda a suíte de casos contra o agente-sob-teste, mede a taxa e decide
// se aprova. É o que segura o custom no sandbox até bater o limiar.
import type {
  AgentRunner,
  EvalCase,
  EvalCaseResult,
  EvalRunResult,
} from "@motor/core";
import { checkAssertion } from "./assertions";

/**
 * Roda todos os casos e devolve o placar.
 * @param casos  a suíte de evals
 * @param runner o agente-sob-teste (recebe a entrada, devolve a saída)
 * @param limiar taxa mínima de aprovação (0..1), default 0.9
 */
export async function runEvals(
  casos: EvalCase[],
  runner: AgentRunner,
  limiar = 0.9
): Promise<EvalRunResult> {
  const resultados: EvalCaseResult[] = [];

  for (const caso of casos) {
    let falhas: string[] = [];
    try {
      const out = await runner(caso.entrada);
      // cada asserção vira null (passou) ou string (motivo); filtra os motivos
      falhas = caso.espera
        .map((a) => checkAssertion(a, out))
        .filter((m): m is string => m !== null);
    } catch (e) {
      // runner que explode = caso falho (nunca deixa vazar pra fora do porteiro)
      falhas = [`erro: ${(e as Error)?.message ?? String(e)}`];
    }
    resultados.push({
      caseId: caso.id,
      nome: caso.nome,
      passou: falhas.length === 0,
      falhas,
    });
  }

  const total = resultados.length;
  const passaram = resultados.filter((r) => r.passou).length;
  const falharam = total - passaram;
  const taxa = total === 0 ? 0 : passaram / total;
  const aprovado = taxa >= limiar;

  return { total, passaram, falharam, taxa, aprovado, limiar, casos: resultados };
}

/** O eval-porteiro: custom só sai do sandbox se o run aprovou. */
export function gate(res: EvalRunResult): boolean {
  return res.aprovado;
}
