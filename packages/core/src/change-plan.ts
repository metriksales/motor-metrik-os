import type { AgentSpec, Motor } from "./index";

export type ChangePlan =
  | {
      kind: "conversa";
      subtipo: "fato" | "regra";
      pedido: string;
      regra: string;
      titulo: string;
      descricao: string;
    }
  | MotorChangePlan
  | {
      kind: "ferramenta";
      pedido: string;
      ferramenta: "whatsapp" | "crm" | "agenda" | "desconhecida";
      titulo: string;
      descricao: string;
    }
  | {
      kind: "documento";
      pedido: string;
      titulo: string;
      descricao: string;
    };

export interface MotorChangePlan {
  kind: "motor";
  pedido: string;
  motorId: "followup";
  titulo: string;
  descricao: string;
  quando: string;
  faz: string;
  configPatch: Record<string, unknown>;
}

export interface OperationalSnapshot {
  ligado: boolean;
  gatilho: string;
  espera: string;
  quantidade: string;
  acao: string;
  canal: string;
}

export interface OperationalProof {
  kind: "motor";
  motorId: string;
  titulo: string;
  antes: OperationalSnapshot;
  agora: OperationalSnapshot;
  checks: { id: string; rotulo: string; passou: boolean }[];
  aprovado: boolean;
}

const DOCUMENTO_RE = /\.pdf|\.docx?|documento|p[áa]gina|em anexo|conte[uú]do longo|arquivo que anexei|pdf que anexei/i;
const FOLLOWUP_RE = /follow(?:[ -]?ups?)?|acompanhamento|voltar a chamar|cham(?:a|ar) de novo|quem sumir|lead sumir|sumiu|par(?:ar|ou) de responder|sem resposta/i;
const FERRAMENTA_RE = /conect(?:a|ar|e)|integr(?:a|ar|e)|vincul(?:a|ar|e)|autentic(?:a|ar|e)|login|token/i;
const FATO_RE = /r\$|\d+ ?(?:reais|%)|custa|pre[çc]o|hor[áa]rio|\b\d{1,2}h\b|link|site|endere[çc]o|telefone|pix|parcel|prazo de/i;

function numeroEm(texto: string): number | undefined {
  if (/^(?:um|uma)$/i.test(texto)) return 1;
  const n = Number(texto);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function atrasoEmHoras(pedido: string): number | undefined {
  const achou = pedido.match(/\b(\d+(?:[.,]\d+)?|um|uma)\s*(minutos?|mins?|horas?|hrs?|h|dias?)\b/i);
  if (!achou) return undefined;
  const numero = numeroEm(achou[1].replace(",", "."));
  if (!numero) return undefined;
  const unidade = achou[2].toLowerCase();
  if (unidade.startsWith("min")) return numero / 60;
  if (unidade.startsWith("dia")) return numero * 24;
  return numero;
}

function quantidadeDeToques(pedido: string): number | undefined {
  const achou = pedido.match(/(?:s[oó]|apenas|somente|m[aá]ximo(?:\s+de)?)?\s*(\d+|um|uma)\s*(?:follow(?:[ -]?ups?)?|toques?|mensagens?)/i);
  return achou ? numeroEm(achou[1]) : undefined;
}

function ferramentaDo(pedido: string): "whatsapp" | "crm" | "agenda" | "desconhecida" {
  if (/whats(?:app)?|wpp/i.test(pedido)) return "whatsapp";
  if (/crm|ghl|go\s*high\s*level|kommo/i.test(pedido)) return "crm";
  if (/agenda|calendar|calend[aá]rio/i.test(pedido)) return "agenda";
  return "desconhecida";
}

/**
 * Traduz o pedido humano para a peça certa. A taxonomia é interna: o cliente
 * descreve o resultado e o produto separa conversa, automação e ferramenta.
 */
export function planejarMudanca(texto: string): ChangePlan {
  const pedido = texto.trim();

  if (DOCUMENTO_RE.test(pedido)) {
    return {
      kind: "documento",
      pedido,
      titulo: "Adicionar material de referência",
      descricao: "O conteúdo vai para a base de conhecimento depois da revisão.",
    };
  }

  // A automação vem antes da ferramenta: “mandar follow-up no WhatsApp” ainda
  // é uma mudança de cadência; WhatsApp é só o canal usado para executá-la.
  if (FOLLOWUP_RE.test(pedido)) {
    const atrasoHoras = atrasoEmHoras(pedido);
    const maxToques = quantidadeDeToques(pedido);
    const configPatch: Record<string, unknown> = {};
    if (maxToques) configPatch.maxToques = maxToques;
    if (atrasoHoras) {
      const total = maxToques ?? 1;
      configPatch.passos = Array.from({ length: total }, (_, indice) => ({ indice, atrasoHoras }));
    }
    return {
      kind: "motor",
      pedido,
      motorId: "followup",
      titulo: "Acompanhar quem parar de responder",
      descricao: "A automação espera o tempo definido e retoma o contato pelo canal conectado.",
      quando: "lead para de responder",
      faz: "espera e envia uma mensagem de acompanhamento",
      configPatch,
    };
  }

  if (FERRAMENTA_RE.test(pedido) && /whats(?:app)?|wpp|crm|ghl|go\s*high\s*level|kommo|agenda|calendar|calend[aá]rio/i.test(pedido)) {
    const ferramenta = ferramentaDo(pedido);
    const nome = ferramenta === "whatsapp" ? "WhatsApp" : ferramenta === "crm" ? "CRM" : ferramenta === "agenda" ? "agenda" : "ferramenta";
    return {
      kind: "ferramenta",
      pedido,
      ferramenta,
      titulo: `Conectar ${nome}`,
      descricao: "Isso exige uma conexão segura; não altera a fala nem a automação do agente.",
    };
  }

  const fato = FATO_RE.test(pedido);
  return {
    kind: "conversa",
    subtipo: fato ? "fato" : "regra",
    pedido,
    regra: fato && !/^fato:/i.test(pedido) ? `Fato: ${pedido}` : pedido,
    titulo: fato ? "Ensinar uma informação" : "Mudar como o agente conversa",
    descricao: fato
      ? "O agente passa a usar essa informação quando ela for necessária na conversa."
      : "O agente passa a seguir essa orientação nas próximas conversas.",
  };
}

/** Config efetiva: a peça define a base e módulos instalados podem sobrescrevê-la. */
export function resolveMotorConfig(spec: AgentSpec, engineId: string): Record<string, unknown> {
  const motor = spec.motores.find((item) => item.id === engineId);
  const config: Record<string, unknown> = { ...(motor?.config ?? {}) };
  for (const modulo of spec.modulos ?? []) {
    if (modulo.onde === engineId && modulo.config) Object.assign(config, modulo.config);
  }
  return config;
}

/** Aplica somente na peça planejada; automação nunca vaza para o prompt. */
export function aplicarPlanoDeMudanca(specAtual: AgentSpec, plano: ChangePlan): AgentSpec {
  if (plano.kind === "conversa") {
    return {
      ...specAtual,
      cerebro: {
        ...specAtual.cerebro,
        regras: [...specAtual.cerebro.regras, plano.regra],
      },
    };
  }

  if (plano.kind !== "motor") return specAtual;

  let encontrou = false;
  const motores = specAtual.motores.map((motor): Motor => {
    if (motor.id !== plano.motorId) return motor;
    encontrou = true;
    return {
      ...motor,
      on: true,
      quando: plano.quando,
      faz: plano.faz,
      config: { ...(motor.config ?? {}), ...plano.configPatch },
    };
  });

  if (!encontrou) {
    motores.push({
      id: plano.motorId,
      nome: "Follow-up",
      on: true,
      quando: plano.quando,
      faz: plano.faz,
      config: { ...plano.configPatch },
    });
  }

  return { ...specAtual, motores };
}

function plural(valor: number, singular: string, pluralLabel: string): string {
  return `${valor} ${valor === 1 ? singular : pluralLabel}`;
}

function tempo(atrasoHoras: unknown): string {
  if (typeof atrasoHoras !== "number" || !Number.isFinite(atrasoHoras)) return "cadência padrão";
  if (atrasoHoras < 1) return plural(Math.round(atrasoHoras * 60), "minuto", "minutos");
  if (atrasoHoras % 24 === 0) return plural(atrasoHoras / 24, "dia", "dias");
  return plural(atrasoHoras, "hora", "horas");
}

function snapshot(spec: AgentSpec, motorId: string): OperationalSnapshot {
  const motor = spec.motores.find((item) => item.id === motorId);
  const config = resolveMotorConfig(spec, motorId);
  const passos = Array.isArray(config.passos) ? config.passos : [];
  const primeiro = passos[0] as { atrasoHoras?: unknown } | undefined;
  const maxToques = typeof config.maxToques === "number" ? config.maxToques : Number(config.maxToques ?? 4);
  const canal = typeof config.canal === "string"
    ? config.canal
    : spec.integracoes.includes("whatsapp")
      ? "WhatsApp conectado"
      : "canal conectado";
  return {
    ligado: motor?.on === true,
    gatilho: motor?.quando ?? "não configurado",
    espera: tempo(primeiro?.atrasoHoras ?? 1),
    quantidade: plural(Number.isFinite(maxToques) ? maxToques : 4, "mensagem", "mensagens"),
    acao: motor?.faz ?? "não configurada",
    canal,
  };
}

/** Prova proporcional ao risco: valida config e roteamento, não inventa um chat. */
export function criarProvaOperacional(specAntes: AgentSpec, specAgora: AgentSpec, plano: ChangePlan): OperationalProof {
  if (plano.kind !== "motor") throw new Error("prova operacional exige um plano de motor");
  const antes = snapshot(specAntes, plano.motorId);
  const agora = snapshot(specAgora, plano.motorId);
  const config = resolveMotorConfig(specAgora, plano.motorId);
  const esperadoToques = plano.configPatch.maxToques;
  const esperadoPassos = plano.configPatch.passos;
  const regrasIntactas = JSON.stringify(specAntes.cerebro.regras) === JSON.stringify(specAgora.cerebro.regras);
  const checks = [
    { id: "motor-on", rotulo: "automação ligada", passou: agora.ligado },
    {
      id: "cadencia",
      rotulo: "tempo de espera configurado",
      passou: esperadoPassos === undefined || JSON.stringify(config.passos) === JSON.stringify(esperadoPassos),
    },
    {
      id: "limite",
      rotulo: "limite de mensagens configurado",
      passou: esperadoToques === undefined || Number(config.maxToques) === Number(esperadoToques),
    },
    { id: "separacao", rotulo: "conversa não foi alterada", passou: regrasIntactas },
  ];
  return {
    kind: "motor",
    motorId: plano.motorId,
    titulo: plano.titulo,
    antes,
    agora,
    checks,
    aprovado: checks.every((check) => check.passou),
  };
}
