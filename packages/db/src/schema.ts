// @motor/db — schema multi-tenant. TUDO por org_id (+ RLS na migração).
// Reflete BACKEND.md. Fonte de verdade durável; Redis é só hot path.
import { sql } from "drizzle-orm";
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

/**
 * PESSOAS (S-045) — autenticação própria, sem Clerk.
 *
 * Entrada sem senha: a pessoa pede um código, ele chega por e-mail e vira
 * sessão. Nada de hash de senha para vazar, nada de fluxo de redefinição.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** guardado em minúsculas; é a identidade da pessoa */
    email: text("email").notNull(),
    name: text("name"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

/** Código de entrada de uso único: guardamos só o hash, e ele expira rápido. */
export const loginCodes = pgTable(
  "login_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    /** tentativas erradas neste código — trava força bruta */
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("login_codes_email_idx").on(t.email, t.createdAt)],
);

/** Sessão em cookie: token opaco, guardado em hash, revogável de verdade. */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    /** conta ativa da sessão (a pessoa troca sem sair) */
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: text("user_agent"),
  },
  (t) => [
    uniqueIndex("sessions_token_unique").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
  ],
);

/** Convite para uma conta: aceite cria (ou vincula) a pessoa com as permissões. */
export const invites = pgTable(
  "invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: roleEnum("role").notNull().default("operator"),
    tokenHash: text("token_hash").notNull(),
    invitedBy: text("invited_by").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("invites_token_unique").on(t.tokenHash),
    index("invites_org_idx").on(t.orgId),
  ],
);

/**
 * Tokens de MÁQUINA — o que agentes, Claude Code/Codex e automações usam para
 * falar com a Control API. Um token pertence a UMA conta e carrega escopos; a
 * conta NUNCA vem de header (S-003). Guardamos só o hash: o valor em claro é
 * mostrado uma única vez, na criação.
 */
export const machineTokens = pgTable(
  "machine_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** sha256 do token em claro, em hex */
    tokenHash: text("token_hash").notNull(),
    /** início do token, só para a pessoa reconhecer na lista */
    prefix: text("prefix").notNull(),
    /** escopos: log | leitura | mudanca | admin */
    scopes: jsonb("scopes").notNull().default(["log"]),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("machine_tokens_hash_unique").on(t.tokenHash),
    index("machine_tokens_org_idx").on(t.orgId),
  ],
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
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
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
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
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
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
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
    /** agente que atende o que entra por esta conexão (S-004) */
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    /** sha256 do segredo de entrada desta conexão; o valor em claro só aparece na criação */
    inboundSecretHash: text("inbound_secret_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("connections_org").on(t.orgId),
    uniqueIndex("connections_inbound_secret_unique").on(t.inboundSecretHash),
    /**
     * Uma conexão por tipo, por conta — MENOS WhatsApp. Duas contas de CRM na
     * mesma conta deixariam "para qual CRM eu escrevo?" ambíguo. Já dois
     * números de WhatsApp no mesmo cliente é caso real, e ali a desambiguação
     * é o `agent_id`.
     */
    uniqueIndex("connections_org_kind")
      .on(t.orgId, t.kind)
      .where(sql`kind <> 'whatsapp'`),
  ]
);

/** release imutável: amarra spec + runtime + evals */
export const releases = pgTable(
  "releases",
  {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  specVersion: integer("spec_version").notNull(),
  runtimeVersion: text("runtime_version").notNull(),
  evalRun: text("eval_run"),
  gitSha: text("git_sha"),
  promotedBy: text("promoted_by"),
  promotedAt: timestamp("promoted_at", { withTimezone: true }).defaultNow().notNull(),
},
(t) => [uniqueIndex("releases_agent_spec").on(t.agentId, t.specVersion)]);

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
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
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

/**
 * COFRE (S-025) — onde mora a credencial de CADA cliente.
 *
 * Com tudo hospedado, a Metrik guarda o token do CRM, do WhatsApp e da IA de
 * todos os assinantes. O valor em claro NUNCA fica aqui: o que se guarda é o
 * resultado do AES-256-GCM, com a chave derivada por conta. Vazar este banco
 * sem a chave-mestra não entrega credencial nenhuma.
 *
 * `dica` são os últimos caracteres do segredo — o bastante para a pessoa
 * reconhecer qual token é, e insuficiente para usar. É o que a tela mostra,
 * porque a tela nunca mostra o valor.
 */
export const credentials = pgTable(
  "credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    /** nome dado pela pessoa; permite duas credenciais do mesmo tipo */
    rotulo: text("rotulo").notNull().default("padrao"),
    /** iv + tag + texto cifrado, em base64 */
    segredoCifrado: text("segredo_cifrado").notNull(),
    /** token de renovação do OAuth, quando houver — cifrado igual */
    renovacaoCifrada: text("renovacao_cifrada"),
    /** qual chave-mestra cifrou; é o que torna a rotação possível */
    chaveVersao: integer("chave_versao").notNull().default(1),
    /** últimos caracteres do segredo, para reconhecer sem revelar */
    dica: text("dica"),
    /** dados NÃO secretos: id da subconta, base url, escopos */
    meta: jsonb("meta"),
    expiraEm: timestamp("expira_em", { withTimezone: true }),
    criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow().notNull(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).defaultNow().notNull(),
    ultimoUsoEm: timestamp("ultimo_uso_em", { withTimezone: true }),
    revogadaEm: timestamp("revogada_em", { withTimezone: true }),
  },
  (t) => [
    index("credentials_org").on(t.orgId),
    uniqueIndex("credentials_org_kind_rotulo").on(t.orgId, t.kind, t.rotulo),
  ],
);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  actor: text("actor"),
  action: text("action").notNull(),
  target: text("target"),
  data: jsonb("data"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Piloto de leitura de grupos internos. Somente captura: não responde no
 * WhatsApp e não cria demanda até uma segunda fase explicitamente aprovada.
 * O JID completo do remetente não é persistido; guardamos HMAC + últimos 4.
 */
export const groupReaderEvents = pgTable(
  "group_reader_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: text("message_id").notNull(),
    groupJid: text("group_jid").notNull(),
    groupName: text("group_name"),
    senderHash: text("sender_hash"),
    senderLast4: text("sender_last4"),
    senderName: text("sender_name"),
    messageType: text("message_type").notNull().default("unknown"),
    messageText: text("message_text").notNull(),
    fromMe: boolean("from_me").notNull().default(false),
    sentByApi: boolean("sent_by_api").notNull().default(false),
    eventName: text("event_name").notNull().default("messages"),
    source: text("source").notNull().default("uazapi"),
    status: text("status").notNull().default("captured"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => [
    uniqueIndex("group_reader_events_group_message_unique").on(t.groupJid, t.messageId),
    index("group_reader_events_received_at_idx").on(t.receivedAt),
    index("group_reader_events_group_received_idx").on(t.groupJid, t.receivedAt),
  ],
);
