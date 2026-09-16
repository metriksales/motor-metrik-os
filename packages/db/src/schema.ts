// @motor/db — schema multi-tenant. TUDO por org_id (+ RLS na migração).
// Reflete BACKEND.md. Fonte de verdade durável; Redis é só hot path.
import { pgTable, uuid, text, timestamp, jsonb, integer, boolean, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["owner", "admin", "operator", "viewer"]);
export const agentTipoEnum = pgEnum("agent_tipo", ["resposta", "acao"]);
export const agentStateEnum = pgEnum("agent_state", ["ativo", "idle", "pausado"]);
export const specStatusEnum = pgEnum("spec_status", ["draft", "published", "archived"]);
export const changeOriginEnum = pgEnum("change_origin", ["hub_chat", "hub_visual", "claude_code", "codex", "api", "metrik"]);
export const changeStatusEnum = pgEnum("change_status", ["draft", "evaluated", "approved", "published", "ignored", "rejected"]);
export const connKindEnum = pgEnum("conn_kind", ["ghl", "kommo", "whatsapp", "advbox", "zapsign", "gcal"]);

/** tenant */
export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  // mapeia a Organization do Clerk → nosso tenant (provisionado no 1º login).
  clerkOrgId: text("clerk_org_id").unique(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("autonomo"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(), // Clerk user id
    role: roleEnum("role").notNull().default("operator"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("memberships_org_user").on(t.orgId, t.userId)]
);

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tipo: agentTipoEnum("tipo").notNull(),
    state: agentStateEnum("state").notNull().default("idle"),
    currentSpecVersion: integer("current_spec_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("agents_org").on(t.orgId)]
);

/** ASSUMIR — pausa por CONTATO: o humano assumiu ESTA conversa; a IA cala só
 *  ali e segue atendendo o resto. O webhook lê antes de responder. */
export const contactStates = pgTable(
  "contact_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull(),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    contato: text("contato").notNull(),
    /** "humano" = assumido (IA de fora); linha ausente = IA no comando */
    estado: text("estado").notNull().default("humano"),
    assumidoPor: text("assumido_por"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("contact_states_agent_contato").on(t.agentId, t.contato),
    index("contact_states_org").on(t.orgId),
  ]
);

/** config viva versionada (o AgentSpec de @motor/core) */
export const agentSpecs = pgTable(
  "agent_specs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull(),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    spec: jsonb("spec").notNull(),
    status: specStatusEnum("status").notNull().default("draft"),
    origin: changeOriginEnum("origin").notNull().default("metrik"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("agent_specs_agent_version").on(t.agentId, t.version)]
);

/** ledger — append-only, toda mudança de qualquer porta */
export const changeSets = pgTable(
  "change_sets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull(),
    agentId: uuid("agent_id").notNull(),
    origin: changeOriginEnum("origin").notNull(),
    actor: text("actor").notNull(),
    intent: text("intent"),
    patch: jsonb("patch"),
    before: jsonb("before"),
    after: jsonb("after"),
    impact: jsonb("impact"),
    status: changeStatusEnum("status").notNull().default("draft"),
    approvedBy: text("approved_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("change_sets_org_agent").on(t.orgId, t.agentId)]
);

/** conexões — o token nunca aqui em texto: só a ref pro vault */
export const connections = pgTable(
  "connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    kind: connKindEnum("kind").notNull(),
    status: text("status").notNull().default("disconnected"),
    vaultRef: text("vault_ref"),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("connections_org").on(t.orgId)]
);

/** release imutável: amarra spec + runtime + evals */
export const releases = pgTable("releases", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull(),
  agentId: uuid("agent_id").notNull(),
  specVersion: integer("spec_version").notNull(),
  runtimeVersion: text("runtime_version").notNull(),
  evalRun: text("eval_run"),
  gitSha: text("git_sha"),
  promotedBy: text("promoted_by"),
  promotedAt: timestamp("promoted_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * A CAIXA-PRETA REAL (Flight Recorder): cada execução de agente vira uma linha.
 * É daqui que nascem "Ao vivo", os contadores da Home e o Radar de Dinheiro —
 * a diferença entre demo bonita e produto. Ingestão: agentes reais fazem POST
 * em /api/control?action=log (token de máquina). Sem FK em agent_id de propósito:
 * o log sobrevive a qualquer reorganização da frota.
 */
export const runtimeLogs = pgTable(
  "runtime_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull(),
    agentId: uuid("agent_id"),
    motor: text("motor"),
    ok: boolean("ok").notNull(),
    resumo: text("resumo").notNull(),
    did: jsonb("did"),
    erro: text("erro"),
    /** valor em R$ ligado à execução (reunião marcada, lead recuperado) — o Radar de Dinheiro */
    valorCentavos: integer("valor_centavos"),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
    meta: jsonb("meta"),
  },
  (t) => [index("runtime_logs_org_at").on(t.orgId, t.at)]
);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id"),
  actor: text("actor"),
  action: text("action").notNull(),
  target: text("target"),
  data: jsonb("data"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
