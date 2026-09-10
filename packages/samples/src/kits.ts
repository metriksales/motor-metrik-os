// @motor/samples — KITS DE PORTEIRO por vertical.
// Um kit amarra: o AgentSpec-semente da vertical + a suíte de evals que trava
// as regras dele + o roteiro offline (dados puros) que o porteiro usa pra
// simular o agente sem cérebro real. O control escolhe o kit pelo NOME do
// agente — assim o porteiro do jurídico testa regra de jurídico, não da Bia.
// Roteiro é dado puro (regex em string) pra este pacote seguir dependendo
// só de @motor/core; quem constrói o FakeBrain é o control.

import type { AgentSpec, EvalCase } from "@motor/core";
import { biaSDR, sdrPrevidenciario } from "./agents";
import { biaEvals, previdenciarioEvals } from "./evals";

export interface RoteiroFala {
  /** regex (source, case-insensitive) sobre o texto do lead */
  quando: string;
  texto: string;
  tool?: { tool: string; args: Record<string, unknown> };
}

export interface PorteiroKit {
  id: string;
  /** regex (source, case-insensitive) sobre o NOME do agente */
  match: string;
  spec: AgentSpec;
  evals: EvalCase[];
  roteiro: RoteiroFala[];
  textoPadrao: string;
}

const kitBia: PorteiroKit = {
  id: "sdr-comercial",
  match: "bia|atendente|sdr",
  spec: biaSDR,
  evals: biaEvals,
  roteiro: [
    { quando: "pre[çc]o|valor|quanto custa", texto: "Claro! Pra te passar certinho, me conta: qual o tamanho da sua operação hoje?" },
    {
      quando: "marcar|reuni|hor[áa]rio|agenda",
      texto: "Perfeito, vou marcar nossa reunião!",
      tool: { tool: "agendar", args: { quando: "2026-09-12T14:00:00Z" } },
    },
    { quando: "rob[ôo]|\\bia\\b|intelig[êe]ncia", texto: "Sou a Bia, da Vega 😊 tô aqui pra te ajudar. Como posso ajudar hoje?" },
  ],
  textoPadrao: "Que bom que você chegou! O que te chamou atenção pra falar com a gente?",
};

const kitPrevidenciario: PorteiroKit = {
  id: "sdr-previdenciario",
  match: "previdenci|jur[ií]dic|peti[çc]|advo[gc]|bpc|triagem",
  spec: sdrPrevidenciario,
  evals: previdenciarioEvals,
  roteiro: [
    {
      quando: "quanto custa|honor[áa]rio|pre[çc]o",
      texto:
        "Isso a gente combina depois da triagem, porque depende do tipo de caso — e em muitos benefícios só há cobrança se der certo. Antes me conta: qual benefício você está buscando?",
    },
    {
      quando: "garant|ganho a causa|certeza",
      texto:
        "Vou ser honesta: ninguém pode prometer resultado — cada caso é único e quem avalia as chances é o advogado, na análise. O que eu faço agora é organizar seu caso direitinho pra essa análise. Me conta: qual benefício você busca?",
    },
    {
      quando: "marcar|agendar|hor[áa]rio",
      texto: "Perfeito! Vou marcar sua análise com o advogado.",
      tool: { tool: "agendar", args: { quando: "2026-09-15T14:00:00Z" } },
    },
    {
      quando: "bpc|loas|presta[çc][ãa]o continuada",
      texto:
        "Entendi! O BPC olha a renda POR PESSOA da casa e outras condições — e mesmo acima do limite existem situações que a Justiça aceita, então eu não descarto nada por aqui: quem bate o martelo é a análise do advogado. Quantas pessoas moram na casa e como está a saúde dela?",
    },
  ],
  textoPadrao:
    "Que bom ter você aqui! Pra eu te direcionar certinho: seu caso é sobre aposentadoria, BPC/LOAS ou auxílio-maternidade?",
};

export const porteiroKits: PorteiroKit[] = [kitPrevidenciario, kitBia];

/** escolhe o kit pelo nome do agente; sem match cai no comercial (Bia). */
export function kitParaAgente(nomeAgente: string): PorteiroKit {
  return porteiroKits.find((k) => new RegExp(k.match, "i").test(nomeAgente)) ?? kitBia;
}
