// FakeBrain — cérebro DETERMINÍSTICO, sem rede.
//
// Serve pro porteiro de evals rodar OFFLINE (sem gastar token nem depender
// da OpenAI) e pra testes de motores. A ideia: um conjunto de regras
// { quando: RegExp; responder: (texto) => LlmTurn }. O `responder()` pega o
// ÚLTIMO conteúdo do histórico e aplica a PRIMEIRA regra que casar; se
// nenhuma casar, devolve um texto genérico.
import type { LlmPort, LlmTurn, ToolSpec } from "@motor/core";

/** Uma regra determinística: casa o último texto e devolve um turno fixo. */
export interface FakeRule {
  quando: RegExp;
  responder: (texto: string) => LlmTurn;
}

export interface FakeBrainOptions {
  /** regras avaliadas em ordem; a primeira que casar vence */
  regras?: FakeRule[];
  /** texto genérico quando nenhuma regra casa (default abaixo) */
  textoPadrao?: string;
}

export class FakeBrain implements LlmPort {
  readonly kind = "fake";
  private readonly regras: FakeRule[];
  private readonly textoPadrao: string;

  constructor(opts?: FakeBrainOptions) {
    this.regras = opts?.regras ?? [];
    this.textoPadrao = opts?.textoPadrao ?? "ok";
  }

  async responder(input: {
    system: string;
    historico: { role: "user" | "assistant" | "tool"; content: string }[];
    tools?: ToolSpec[];
  }): Promise<LlmTurn> {
    // último conteúdo do histórico (o que "chegou agora"); vazio se não houver
    const ultimo = input.historico.length > 0 ? input.historico[input.historico.length - 1].content : "";

    // primeira regra que casar com o último texto
    for (const regra of this.regras) {
      if (regra.quando.test(ultimo)) {
        return regra.responder(ultimo);
      }
    }

    // fallback determinístico
    return { texto: this.textoPadrao };
  }
}
