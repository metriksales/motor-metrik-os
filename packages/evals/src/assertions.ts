// @motor/evals — asserções puras (o "acerto/erro" de cada caso).
// Cada asserção olha a saída do agente-sob-teste e diz: passou (null)
// ou por que falhou (string). Lógica 100% pura — sem rede, sem estado.
import type { AgentUnderTestOutput, EvalAssertion } from "@motor/core";

/**
 * Checa UMA asserção contra a saída do agente.
 * Retorna `null` quando passa, ou uma string com o motivo da falha.
 */
export function checkAssertion(a: EvalAssertion, out: AgentUnderTestOutput): string | null {
  const texto = out.texto ?? "";
  switch (a.tipo) {
    case "contem": {
      // texto deve INCLUIR o valor (case-insensitive)
      const ok = texto.toLowerCase().includes(a.valor.toLowerCase());
      return ok ? null : `esperava texto contendo "${a.valor}", mas não achou`;
    }
    case "nao_contem": {
      // texto NÃO pode incluir o valor (case-insensitive)
      const achou = texto.toLowerCase().includes(a.valor.toLowerCase());
      return achou ? `texto continha "${a.valor}" (não deveria)` : null;
    }
    case "chamou_tool": {
      // alguma toolCall com o tool esperado
      const chamou = (out.toolCalls ?? []).some((t) => t.tool === a.tool);
      return chamou ? null : `esperava chamada da tool "${a.tool}", mas não chamou`;
    }
    case "moveu_etapa": {
      // moveu o card exatamente pra etapa esperada
      const ok = out.movedStage === a.stageId;
      return ok
        ? null
        : `esperava mover pra etapa "${a.stageId}", mas moveu pra "${out.movedStage ?? "(nenhuma)"}"`;
    }
    case "regex": {
      // padrão bate no texto (RegExp cru, sem flags)
      let re: RegExp;
      try {
        re = new RegExp(a.padrao);
      } catch (e) {
        return `regex inválida "${a.padrao}": ${(e as Error).message}`;
      }
      return re.test(texto) ? null : `esperava texto casando /${a.padrao}/, mas não casou`;
    }
    default: {
      // exaustividade: se um novo tipo entrar em @motor/core, o TS acusa aqui
      const _never: never = a;
      return `asserção desconhecida: ${JSON.stringify(_never)}`;
    }
  }
}
