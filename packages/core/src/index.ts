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
  /** configuração própria da peça; módulos podem sobrescrever estes valores */
  config?: Record<string, unknown>;
}

export interface ModuloInstalado {
  id: string;
  nome: string;
  /** onde caiu (qual motor/comportamento mudou) */
  onde: string;
  config?: Record<string, unknown>;
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

// ═══════════════════════════════════════════════════════════════
// PORTS & CONTRATOS DE RUNTIME — a plataforma "pronta pra trabalhar".
// Regra: pacotes concretos (messaging/motors/evals/runtime) dependem
// SÓ de @motor/core; a infra entra por PORTS injetados (sem dep
// circular, sem infra dentro do motor). É o que mantém plugável.
// ═══════════════════════════════════════════════════════════════

/** Referência de um lead/contato (alvo de uma mensagem). */
export interface LeadRef {
  contactId: string;
  nome?: string;
  telefone?: string;
  ownerId?: string; // vendedor dono → roteia multi-instância
  estado?: Record<string, unknown>;
}

/** Um passo de cadência de follow-up. */
export interface FollowupStep {
  indice: number;
  atrasoHoras: number; // desde o passo anterior / do gatilho
  texto?: string;      // texto base (quando não é template/LLM)
  templateId?: string; // quando o sender é meta-template
  objetivo?: string;   // instrução p/ o LLM freeform gerar
}

/** Mensagem pronta pra sair (o Sender MONTA, o Transport ENTREGA). */
export type OutgoingMessage =
  | { kind: "text"; text: string }
  | { kind: "template"; templateId: string; variables: Record<string, string>; fallbackText?: string }
  | { kind: "media"; mediaType: "image" | "audio" | "video" | "document"; url: string; caption?: string };

export interface SendResult { ok: boolean; providerId?: string; error?: string; }

/** COMO a mensagem é MONTADA (template Meta aprovado vs LLM gera na hora). */
export interface Sender {
  readonly kind: string; // "meta-template" | "llm-freeform"
  build(input: { lead: LeadRef; step: FollowupStep; ctx?: Record<string, unknown> }): Promise<OutgoingMessage>;
}

/** COMO a mensagem é ENTREGUE (canal). Multi-instância roteia por vendedor. */
export interface Transport {
  readonly kind: string; // "ghl-native" | "uazapi-multi"
  send(input: { orgId: string; to: string; message: OutgoingMessage; ownerId?: string }): Promise<SendResult>;
}

/** Chamada de ferramenta que o cérebro (LLM) pede. */
export interface ToolCall { tool: string; args: Record<string, unknown>; }
export interface LlmTurn { texto?: string; toolCalls?: ToolCall[]; }
/** O "cérebro" — a skill agente-ia-metrik-completo por trás. Injetado como port. */
export interface LlmPort {
  responder(input: {
    system: string;
    historico: { role: "user" | "assistant" | "tool"; content: string }[];
    tools?: string[];
  }): Promise<LlmTurn>;
}

/** Port de CRM (mesma forma do CrmAdapter em @motor/crm; evita dep circular). */
export interface CrmPort {
  readonly kind: string;
  moverEtapa(oppId: string, stageId: string): Promise<void>;
  preencherCampo(contactId: string, field: string, value: unknown): Promise<void>;
  criarTarefa(contactId: string, titulo: string, quando?: string): Promise<void>;
  agendar(input: { contactId: string; quando: string; calendarId?: string }): Promise<{ eventId: string }>;
  addTag(contactId: string, tag: string): Promise<void>;
  removerTag(contactId: string, tag: string): Promise<void>;
  criarOportunidade(contactId: string, funilId: string, valor?: number): Promise<{ oppId: string }>;
  enviarMensagem(contactId: string, texto: string): Promise<void>;
  handoff(contactId: string): Promise<void>;
}

/** Evento que entra/roda no runtime. */
export interface RuntimeEvent {
  id?: string;
  orgId: string;
  agentId: string;
  tipo: "inbound" | "stage" | "schedule" | "manual";
  canal?: string;
  contactId?: string;
  texto?: string;
  at?: string;
  meta?: Record<string, unknown>;
}

/** Linha de log de execução (a caixa-preta do agente). */
export interface RuntimeLog {
  orgId: string;
  agentId: string;
  motor?: string;
  ok: boolean;
  resumo: string;
  did?: string[];
  erro?: string;
  at: string;
  meta?: Record<string, unknown>;
}

/** Gatilho de um motor. */
export type MotorTrigger =
  | { type: "inbound"; canal?: string }
  | { type: "stage"; stageId?: string }
  | { type: "schedule"; cron?: string }
  | { type: "manual" };

/** Um "botão" seguro — campo de config que o cliente pode mexer. */
export interface ConfigField {
  key: string;
  label: string;
  tipo: "texto" | "numero" | "toggle" | "opcoes" | "horario";
  opcoes?: { value: string; label: string }[];
  default?: string | number | boolean;
  zona: RiskZone; // verde = cliente mexe na hora
  ajuda?: string;
}

/** O manifesto que a TELA usa pra se desenhar sozinha (contrato de render). */
export interface MotorManifest {
  id: string;
  titulo: string;
  descricao: string;
  work: WorkKind;
  zona: RiskZone;
  config: ConfigField[];
}

/** Infra injetada no motor (o motor não conhece nada concreto). */
export interface MotorPorts {
  now: () => Date;
  log: (l: RuntimeLog) => void;
  crm?: CrmPort;
  sender?: Sender;
  transport?: Transport;
  llm?: LlmPort;
  getState?: (key: string) => Promise<unknown>;
  setState?: (key: string, value: unknown, ttlSec?: number) => Promise<void>;
}

export interface MotorRunInput {
  orgId: string;
  agentId: string;
  spec: AgentSpec;
  event: RuntimeEvent;
  config?: Record<string, unknown>;
}

export interface MotorResult { ok: boolean; did: string[]; error?: string; }

/** Um MOTOR = função reutilizável (follow-up, agenda, atendimento). */
export interface MotorEngine {
  readonly id: string;
  readonly nome: string;
  readonly trigger: MotorTrigger[];
  readonly manifest: MotorManifest;
  run(input: MotorRunInput, ports: MotorPorts): Promise<MotorResult>;
}

/** Registro de motores disponíveis (a biblioteca de peças). */
export interface MotorRegistry {
  get(id: string): MotorEngine | undefined;
  all(): MotorEngine[];
  match(event: RuntimeEvent, spec: AgentSpec): MotorEngine[];
}

export * from "./change-plan";

// ── Evals — o porteiro (custom só sai do sandbox se a taxa ≥ limiar) ──
export interface EvalCase {
  id: string;
  nome: string;
  entrada: { texto?: string; estado?: Record<string, unknown> };
  espera: EvalAssertion[];
  tags?: string[];
}
export type EvalAssertion =
  | { tipo: "contem"; valor: string }
  | { tipo: "nao_contem"; valor: string }
  | { tipo: "chamou_tool"; tool: string }
  | { tipo: "moveu_etapa"; stageId: string }
  | { tipo: "regex"; padrao: string };

export interface AgentUnderTestOutput { texto?: string; toolCalls?: ToolCall[]; movedStage?: string; }
export type AgentRunner = (entrada: EvalCase["entrada"]) => Promise<AgentUnderTestOutput>;

export interface EvalCheckResult {
  tipo: EvalAssertion["tipo"];
  rotulo: string;
  esperado: string;
  passou: boolean;
  falha?: string;
}
export interface EvalCaseResult {
  caseId: string;
  nome: string;
  passou: boolean;
  falhas: string[];
  entrada: EvalCase["entrada"];
  saida?: AgentUnderTestOutput;
  criterios: EvalCheckResult[];
}
export interface EvalRunResult {
  total: number;
  passaram: number;
  falharam: number;
  taxa: number;      // 0..1
  aprovado: boolean; // taxa ≥ limiar
  limiar: number;
  casos: EvalCaseResult[];
}
