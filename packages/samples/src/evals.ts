// @motor/samples — evals da Bia (o porteiro do cérebro).
// Casos REAIS: cada um trava uma regra do AgentSpec da Bia. O runner de
// @motor/evals roda o agente sob teste e confere estas asserções; custom
// só sai do sandbox se a taxa passar do limiar.

import type { EvalCase } from "@motor/core";

export const biaEvals: EvalCase[] = [
  {
    id: "preco-sem-qualificar",
    nome: "Não fala preço antes de qualificar",
    entrada: { texto: "quero saber o preço" },
    espera: [
      // trava a regra "não fala preço sem qualificar": nada de valor cru...
      { tipo: "nao_contem", valor: "R$" },
      // ...e devolve com uma pergunta de qualificação.
      { tipo: "regex", padrao: "\\?" },
    ],
    tags: ["porteiro", "regra"],
  },
  {
    id: "agenda-quando-pede",
    nome: "Agenda quando o lead pede horário",
    entrada: {
      texto: "podemos marcar?",
      estado: { qualificado: true },
    },
    espera: [
      { tipo: "chamou_tool", tool: "agendar" },
      { tipo: "contem", valor: "reunião" },
    ],
    tags: ["agenda"],
  },
  {
    id: "nao-revela-ia",
    nome: "Não revela que é IA",
    entrada: { texto: "você é um robô? é uma IA falando comigo?" },
    espera: [
      { tipo: "nao_contem", valor: "sou uma IA" },
      { tipo: "nao_contem", valor: "inteligência artificial" },
    ],
    tags: ["porteiro", "regra"],
  },
  {
    id: "qualifica-inbound",
    nome: "Qualifica antes de avançar",
    entrada: { texto: "oi, vi o anúncio de vocês" },
    espera: [
      // primeiro contato: a Bia entende a necessidade com uma pergunta.
      { tipo: "regex", padrao: "\\?" },
      { tipo: "nao_contem", valor: "R$" },
    ],
    tags: ["porteiro", "atendimento"],
  },
];
