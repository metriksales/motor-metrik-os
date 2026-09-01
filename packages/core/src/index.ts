// @motor/core — contratos compartilhados do Motor Metrik OS.
// A taxonomia (agente|módulo|feature|integração|regra) vem de ARQUITETURA.md.
// O motor de verdade é a skill `agente-ia-metrik-completo`; aqui só o formato.

export type Role = "owner" | "admin" | "operator" | "viewer";
export type AgentTipo = "resposta" | "acao";
export type AgentState = "ativo" | "idle" | "pausado";
export type WorkKind = "agenda" | "followups" | "contratos" | "conhecimento" | "acoes" | "lista";
export type ConnKind = "ghl" | "kommo" | "whatsapp" | "advbox" | "zapsign" | "gcal";
export type RiskZone = "verde" | "amarelo" | "vermelho";
export type ChangeOrigin = "hub_chat" | "hub_visual" | "claude_code" | "codex" | "api" | "metrik";
export type SpecStatus = "draft" | "published" | "archived";

/** A configuração viva de um agente (o que o runtime lê pra rodar). */
export interface AgentSpec {
  name: string;
  tipo: AgentTipo;
  /** identidade + regras de conversa/comportamento (o "cérebro") */
  cerebro: {
    identidade: string;
    oferta?: string;
    tom?: string;
    regras: string[]; // travas (regra/trava)
  };
  /** motores/órgãos: atendimento, crm, agenda, follow-up, ttl, sla, handoff... */
  motores: Motor[];
  /** módulos ligados (upgrades assinados) */
  modulos: ModuloInstalado[];
  /** integrações externas usadas (advbox, zapsign, gcal...) */
  integracoes: ConnKind[];
  /** superfície de trabalho principal (o que o cliente vê) */
  work?: { kind: WorkKind; label: string };
  /** o núcleo blindado: partes que o cliente nunca edita direto */
  blindado: string[];
}

export interface Motor {
  id: string;
  nome: string;
  on: boolean;
  quando: string; // gatilho
  faz: string; // ação
}

export interface ModuloInstalado {
  id: string;
  nome: string;
  /** onde caiu (qual motor/comportamento mudou) */
  onde: string;
  config?: Record<string, string>;
  risco: RiskZone;
}

/** Toda mudança vira um ChangeSet auditável — de qualquer porta. */
export interface ChangeSet {
  id: string;
  orgId: string;
  agentId: string;
  origin: ChangeOrigin;
  actor: string;
  intent?: string;
  patch?: unknown;
  before?: unknown;
  after?: unknown;
  risco: RiskZone;
  status: "draft" | "evaluated" | "approved" | "published" | "ignored" | "rejected";
  createdAt: string;
}

/** Release imutável: amarra spec + runtime + evals. */
export interface Release {
  id: string;
  orgId: string;
  agentId: string;
  specVersion: number;
  runtimeVersion: string;
  evalRun?: string;
  gitSha?: string;
  promotedAt: string;
}

/** O cardápio de ações que o adapter de CRM expõe (uma língua, dois CRMs). */
export type CrmTool =
  | "moverEtapa"
  | "preencherCampo"
  | "criarTarefa"
  | "agendar"
  | "addTag"
  | "removerTag"
  | "criarOportunidade"
  | "enviarMensagem"
  | "handoff";
