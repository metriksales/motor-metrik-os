// @motor/samples — exemplos REAIS de AgentSpec.
// A tese que estes três provam: os motores são PEÇAS reutilizáveis.
// O mesmo motor `followup` serve pra reaquecer LEAD (Bia) e pra cobrar
// VENDEDOR HUMANO (Cobrador) — muda a config, não se recria o motor.
// Nada aqui inventa infra: é só a configuração viva que o runtime lê.

import type { AgentSpec } from "@motor/core";

// ═══════════════════════════════════════════════════════════════
// 1) biaSDR — agente de RESPOSTA (conversa no WhatsApp, qualifica).
//    Usa o motor `followup` no papel clássico: reaquecer o LEAD frio.
// ═══════════════════════════════════════════════════════════════
export const biaSDR: AgentSpec = {
  name: "Bia SDR",
  tipo: "resposta",
  cerebro: {
    identidade: "Bia, SDR da Vega",
    oferta: "Implantação de CRM + agente de IA que qualifica e agenda pela Vega",
    tom: "consultivo",
    regras: [
      "não fala preço sem qualificar",
      "não revela que é IA",
    ],
  },
  motores: [
    {
      id: "atendimento",
      nome: "Atendimento",
      on: true,
      quando: "lead responde",
      faz: "qualifica e responde",
    },
    {
      id: "agenda",
      nome: "Agenda",
      on: true,
      quando: "lead qualificado quer horário",
      faz: "oferece slots e marca a reunião",
    },
    {
      // MESMO motor `followup` — aqui na config clássica: público = LEAD.
      id: "followup",
      nome: "Recuperação",
      on: true,
      quando: "lead esfria",
      faz: "reaquece",
    },
  ],
  modulos: [],
  integracoes: ["ghl", "whatsapp", "gcal"],
  work: { kind: "conhecimento", label: "Base + conversa" },
  blindado: ["identidade", "regras", "porteiro-eval"],
};

// ═══════════════════════════════════════════════════════════════
// 2) cobradorEquipe — A PROVA da doutrina "mesmo motor, config diferente".
//
//    É o MESMO motor `followup` da Bia. NÃO é um motor novo: a cadência,
//    a checagem de "quem falou por último" e o disparo são exatamente os
//    mesmos da peça reutilizável. O que muda é a CONFIG:
//      • publico  = "humanos"  (o alvo do toque é o VENDEDOR, não o lead)
//      • canal    = "interno"  (sai pela linha interna da equipe, não pro lead)
//      • objetivo = cobrar tarefa parada, não reaquecer venda
//    Por isso o motor segue `id: "followup"` — o Motor é DESCRITOR; a
//    variação vive na config (representada abaixo como módulo instalado,
//    o kit que repluga o followup no papel de cobrança). Recriar um motor
//    "cobranca" separado seria duplicar a peça — exatamente o que a
//    arquitetura proíbe (uma peça, várias configs).
// ═══════════════════════════════════════════════════════════════
export const cobradorEquipe: AgentSpec = {
  name: "Cobrador de Equipe",
  tipo: "acao",
  cerebro: {
    identidade: "Cobrador interno da Vega",
    tom: "direto e respeitoso",
    regras: [
      "nunca fala com o lead — só com o time",
      "respeita o horário comercial do vendedor",
      "não cobra tarefa já concluída",
    ],
  },
  motores: [
    {
      // MESMO id do motor da Bia: é a MESMA peça `followup`, outra config.
      id: "followup",
      nome: "Cobrança de equipe",
      on: true,
      quando: "tarefa sem resposta",
      faz: "cobra o vendedor humano",
    },
  ],
  // A config que transforma o followup de "reaquecer lead" em "cobrar time".
  // Mesmo motor (onde: "followup"), knobs diferentes — não é motor novo.
  modulos: [
    {
      id: "cobranca-interna",
      nome: "Cobrança pros humanos",
      onde: "followup",
      config: { publico: "humanos", canal: "interno", objetivo: "cobrar-tarefa" },
      risco: "verde",
    },
  ],
  integracoes: ["ghl", "whatsapp"],
  work: { kind: "followups", label: "Cobrança de equipe" },
  blindado: ["identidade", "regras", "publico-interno"],
};

// ═══════════════════════════════════════════════════════════════
// 3) peticoes — agente de AÇÃO (executa no CRM, disparado por etapa).
//    Motor de ação próprio + integração externa (AdvBox) como tomada.
// ═══════════════════════════════════════════════════════════════
export const peticoes: AgentSpec = {
  name: "Petições",
  tipo: "acao",
  cerebro: {
    identidade: "Motor de Petições da Vega Jurídico",
    tom: "formal",
    regras: [
      "não protocola sem documento validado",
      "não altera o mérito da peça",
    ],
  },
  motores: [
    {
      id: "peticao",
      nome: "Petições",
      on: true,
      quando: "card entra na etapa 'protocolar'",
      faz: "monta a peça e protocola via AdvBox",
    },
  ],
  modulos: [],
  integracoes: ["advbox"],
  work: { kind: "acoes", label: "Petições" },
  blindado: ["identidade", "regras", "peca-modelo"],
};

/** Os três exemplos, prontos pra iterar (vitrine/testes). */
export const agentesExemplo: AgentSpec[] = [biaSDR, cobradorEquipe, peticoes];
