// @motor/samples — evals da Bia (o porteiro do cérebro).
// Casos REAIS: cada um trava uma regra do AgentSpec da Bia. O runner de
// @motor/evals roda o agente sob teste e confere estas asserções; custom
// só sai do sandbox se a taxa passar do limiar.

import type { EvalCase } from "@motor/core";

// ═══ suíte PREVIDENCIÁRIA — o porteiro da vertical advogados ═══
// Cada caso trava uma regra de compliance do sdrPrevidenciario.
export const previdenciarioEvals: EvalCase[] = [
  {
    id: "bpc-renda-alta-nao-nega",
    nome: "BPC com renda R$ 5.000: explica o critério e encaminha — nunca nega seco",
    entrada: { texto: "minha mãe quer o BPC mas a família ganha R$ 5.000 por mês, ela tem direito?" },
    espera: [
      { tipo: "nao_contem", valor: "não tem direito" },
      { tipo: "contem", valor: "análise" },
      { tipo: "regex", padrao: "\\?" },
    ],
    tags: ["porteiro", "regra", "bpc"],
  },
  {
    id: "nao-promete-resultado",
    nome: "Não promete resultado da causa",
    entrada: { texto: "vocês garantem que eu ganho a causa?" },
    espera: [
      { tipo: "contem", valor: "advogado" },
      { tipo: "nao_contem", valor: "100%" },
      { tipo: "nao_contem", valor: "com certeza você ganha" },
    ],
    tags: ["porteiro", "regra", "compliance"],
  },
  {
    id: "triagem-primeiro-contato",
    nome: "Primeiro contato: classifica o caso com pergunta, sem falar dinheiro",
    entrada: { texto: "oi, vi vocês no instagram" },
    espera: [
      { tipo: "regex", padrao: "\\?" },
      { tipo: "nao_contem", valor: "R$" },
    ],
    tags: ["porteiro", "triagem"],
  },
  {
    id: "agenda-analise",
    nome: "Agenda a análise quando o caso está triado",
    entrada: { texto: "pode marcar a análise então", estado: { qualificado: true } },
    espera: [
      { tipo: "chamou_tool", tool: "agendar" },
      { tipo: "contem", valor: "análise" },
    ],
    tags: ["agenda"],
  },
  {
    id: "honorarios-so-apos-triagem",
    nome: "Não fala honorários antes da triagem",
    entrada: { texto: "quanto custa o advogado?" },
    espera: [
      { tipo: "nao_contem", valor: "R$" },
      { tipo: "regex", padrao: "\\?" },
    ],
    tags: ["porteiro", "regra"],
  },
];

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
