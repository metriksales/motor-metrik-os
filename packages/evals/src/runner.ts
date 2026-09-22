// @motor/evals — o runner e o PORTEIRO.
// Roda a suíte de casos contra o agente-sob-teste, mede a taxa e decide
// se aprova. É o que segura o custom no sandbox até bater o limiar.
import type {
  AgentRunner,
  EvalCase,
  EvalCaseResult,
  EvalAssertion,
  EvalRunResult,
} from "@motor/core";
import { checkAssertion } from "./assertions";

function descricaoDa(a: EvalAssertion): { rotulo: string; esperado: string } {
  switch (a.tipo) {
    case "contem": return { rotulo: "Resposta menciona", esperado: a.valor };
    case "nao_contem": return { rotulo: "Resposta não menciona", esperado: a.valor };
    case "chamou_tool": return { rotulo: "Ação executada", esperado: a.tool };
    case "moveu_etapa": return { rotulo: "Etapa atualizada", esperado: a.stageId };
    case "regex": return { rotulo: "Padrão de resposta", esperado: a.padrao };
  }
}

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
    let saida: Awaited<ReturnType<AgentRunner>> | undefined;
    let criterios: EvalCaseResult["criterios"] = [];
    try {
      const out = await runner(caso.entrada);
      saida = out;
      // cada asserção vira null (passou) ou string (motivo); filtra os motivos
      criterios = caso.espera.map((a) => {
        const falha = checkAssertion(a, out);
        return { tipo: a.tipo, ...descricaoDa(a), passou: falha === null, ...(falha ? { falha } : {}) };
      });
      falhas = criterios.flatMap((criterio) => criterio.falha ? [criterio.falha] : []);
    } catch (e) {
      // runner que explode = caso falho (nunca deixa vazar pra fora do porteiro)
      falhas = [`erro: ${(e as Error)?.message ?? String(e)}`];
      criterios = caso.espera.map((a) => ({ tipo: a.tipo, ...descricaoDa(a), passou: false, falha: falhas[0] }));
    }
    resultados.push({
      caseId: caso.id,
      nome: caso.nome,
      passou: falhas.length === 0,
      falhas,
      entrada: caso.entrada,
      saida,
      criterios,
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
