// @motor/control — Control API (camada de serviço, sem framework).
// A porta ÚNICA de mudança: front, Claude Code, Codex e API usam ISTO.
// Regra de ouro: org_id SEMPRE vem do servidor (Ctx), nunca do cliente.
import { and, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { db, agents, agentSpecs, changeSets, connections, releases, auditLog, organizations, memberships, runtimeLogs, contactStates, machineTokens } from "@motor/db";
import { FakeBrain, makeBrain } from "@motor/llm";
import { runEvals } from "@motor/evals";
import { kitParaAgente } from "@motor/samples";
import type { AgentSpec, AgentTipo, ChangeOrigin, ConnKind } from "@motor/core";
import {
  type Escopo,
  ehTokenDeMaquina,
  hashToken,
  normalizarEscopos,
  novoToken,
  papelDoToken,
} from "./tokens.js";

import { ehSegredoEntrada, hashSegredo, novoSegredoEntrada } from "./webhooks.js";
import { Conflito, EntradaInvalida, NaoEncontrado, SemPermissao } from "./erros.js";
import { exigirPermissao } from "./permissoes.js";

export * from "./tokens.js";
export * from "./webhooks.js";
export * from "./erros.js";
export * from "./permissoes.js";

/**
 * Confere que o agente é DESTA conta e devolve a linha (S-006). Toda função que
 * recebe `agentId` de fora passa por aqui: sem isso, era possível propor
 * mudança e gravar execução em agente de outra conta sabendo só o id.
 */
async function exigirAgenteDaConta(ctx: Ctx, agentId: string) {
  if (!agentId) throw new EntradaInvalida("falta o agentId");
  const [agente] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.orgId, ctx.orgId)));
  if (!agente) throw new NaoEncontrado("agente");
  return agente;
}

// ═══ ENTRADA DE MENSAGEM (S-004) — conta e agente saem do segredo ═══

/** Quem atende o que entrar por esta conexão. Devolve o segredo UMA vez. */
export async function criarSegredoDeEntrada(
  ctx: Ctx,
  input: { connectionId: string; agentId: string },
): Promise<{ segredo: string }> {
  exigirPermissao(ctx, "gerenciar");
  const [agente] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, input.agentId), eq(agents.orgId, ctx.orgId)));
  if (!agente) throw new NaoEncontrado("agente");

  const { segredo, hash } = novoSegredoEntrada();
  const [row] = await db
    .update(connections)
    .set({ inboundSecretHash: hash, agentId: input.agentId })
    .where(and(eq(connections.id, input.connectionId), eq(connections.orgId, ctx.orgId)))
    .returning();
  if (!row) throw new NaoEncontrado("conexão");

  await audit(ctx, "connection.inbound_secret", row.id, { agentId: input.agentId });
  return { segredo };
}

/**
 * Resolve o segredo de entrada em (conta, agente, conexão). É daqui que o
 * webhook tira o tenant — nunca do corpo da requisição.
 */
export async function resolverEntrada(
  segredo: string,
): Promise<{ orgId: string; agentId: string; connectionId: string; kind: string } | null> {
  if (!ehSegredoEntrada(segredo)) return null;
  const [row] = await db
    .select()
    .from(connections)
    .where(eq(connections.inboundSecretHash, hashSegredo(segredo)));
  if (!row || !row.agentId) return null;
  return { orgId: row.orgId, agentId: row.agentId, connectionId: row.id, kind: row.kind };
}

// re-export pros hosts (guards das functions usam sem importar @motor/db direto)
export { getDatabaseUrl } from "@motor/db";

export interface Ctx {
  orgId: string;
  actor: string;
  role: "owner" | "admin" | "operator" | "viewer";
  /** por onde entrou: sessão de pessoa ou token de máquina */
  via?: "sessao" | "maquina";
  /** escopos do token de máquina (vazio quando é sessão de pessoa) */
  scopes?: Escopo[];
}

// ═══ TOKENS DE MÁQUINA (S-003) — a conta vem do token, nunca de header ═══

/**
 * Cria um token de máquina para a conta do contexto. Devolve o valor em claro
 * UMA vez — depois disso só existe o hash. Quem cria precisa ser admin/owner.
 */
export async function criarMachineToken(
  ctx: Ctx,
  input: { name: string; scopes?: Escopo[] },
): Promise<{ token: string; id: string; prefix: string; scopes: Escopo[] }> {
  exigirPermissao(ctx, "gerenciar");
  const scopes = normalizarEscopos(input.scopes ?? ["log"]);
  if (scopes.length === 0) throw new EntradaInvalida("escopos inválidos");
  const { token, hash, prefix } = novoToken();
  const [row] = await db
    .insert(machineTokens)
    .values({
      orgId: ctx.orgId,
      name: input.name,
      tokenHash: hash,
      prefix,
      scopes,
      createdBy: ctx.actor,
    })
    .returning();
  await audit(ctx, "machine_token.create", row.id, { name: input.name, scopes });
  return { token, id: row.id, prefix, scopes };
}

/** Tokens da conta (sem o valor, que não existe mais em lugar nenhum). */
export function listarMachineTokens(ctx: Ctx) {
  return db
    .select({
      id: machineTokens.id,
      name: machineTokens.name,
      prefix: machineTokens.prefix,
      scopes: machineTokens.scopes,
      createdBy: machineTokens.createdBy,
      createdAt: machineTokens.createdAt,
      lastUsedAt: machineTokens.lastUsedAt,
      revokedAt: machineTokens.revokedAt,
    })
    .from(machineTokens)
    .where(eq(machineTokens.orgId, ctx.orgId))
    .orderBy(desc(machineTokens.createdAt));
}

export async function revogarMachineToken(ctx: Ctx, id: string) {
  exigirPermissao(ctx, "gerenciar");
  const [row] = await db
    .update(machineTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(machineTokens.id, id), eq(machineTokens.orgId, ctx.orgId), isNull(machineTokens.revokedAt)))
    .returning();
  if (!row) throw new NaoEncontrado("token");
  await audit(ctx, "machine_token.revoke", id, {});
  return { ok: true };
}

/**
 * Resolve o token de máquina em contexto. A CONTA sai daqui — do banco, pelo
 * hash do token — e não de `x-org-id`. Token revogado ou inexistente = null.
 */
export async function resolverMachineToken(tokenEmClaro: string): Promise<Ctx | null> {
  if (!ehTokenDeMaquina(tokenEmClaro)) return null;
  const hash = hashToken(tokenEmClaro);
  const [row] = await db
    .select()
    .from(machineTokens)
    .where(and(eq(machineTokens.tokenHash, hash), isNull(machineTokens.revokedAt)));
  if (!row) return null;

  const scopes = normalizarEscopos(row.scopes);
  await db.update(machineTokens).set({ lastUsedAt: new Date() }).where(eq(machineTokens.id, row.id));

  return {
    orgId: row.orgId,
    actor: `token:${row.name}`,
    role: papelDoToken(scopes),
    via: "maquina",
    scopes,
  };
}

/**
 * ensureOrgForClerk — a PONTE Clerk↔tenant. Dado o org da sessão Clerk, acha o
 * nosso tenant (por clerk_org_id) ou PROVISIONA um na hora (org + membership do
 * usuário como owner). Idempotente. Retorna o org_id INTERNO (uuid) — é ele que
 * escopa tudo no banco. Chamado pelo resolveCtx quando o Clerk está ligado.
 */
export async function ensureOrgForClerk(input: {
  clerkOrgId: string;
  clerkUserId: string;
  name?: string;
  role?: Ctx["role"];
}): Promise<{ orgId: string; role: Ctx["role"] }> {
  const role = input.role ?? "owner";
  const [existing] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.clerkOrgId, input.clerkOrgId));

  if (existing) {
    await db
      .insert(memberships)
      .values({ orgId: existing.id, userId: input.clerkUserId, role })
      .onConflictDoNothing({ target: [memberships.orgId, memberships.userId] });
    return { orgId: existing.id, role };
  }

  const [org] = await db
    .insert(organizations)
    .values({ clerkOrgId: input.clerkOrgId, name: input.name?.trim() || "Minha operação" })
    .returning();
  await db.insert(memberships).values({ orgId: org.id, userId: input.clerkUserId, role });
  await db.insert(auditLog).values({ orgId: org.id, actor: input.clerkUserId, action: "org.provision", target: input.clerkOrgId });
  return { orgId: org.id, role };
}

/** carteira de agentes do tenant */
export function listAgents(ctx: Ctx) {
  return db.select().from(agents).where(eq(agents.orgId, ctx.orgId));
}

/** um agente do tenant (org_id + id sempre juntos — isolamento multi-tenant) */
export async function getAgent(ctx: Ctx, agentId: string) {
  const [a] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.orgId, ctx.orgId)));
  return a ?? null;
}

export async function createAgent(ctx: Ctx, input: { name: string; tipo: AgentTipo }) {
  exigirPermissao(ctx, "ajustar");
  if (!input.name?.trim()) throw new EntradaInvalida("falta o nome do agente");
  const [a] = await db
    .insert(agents)
    .values({ orgId: ctx.orgId, name: input.name, tipo: input.tipo })
    .returning();
  await audit(ctx, "agent.create", a.id);
  return a;
}

/** propor uma mudança = criar ChangeSet (rascunho). De qualquer porta. */
export async function proporMudanca(
  ctx: Ctx,
  input: { agentId: string; origin: ChangeOrigin; intent: string; patch: unknown }
) {
  exigirPermissao(ctx, "ajustar");
  await exigirAgenteDaConta(ctx, input.agentId);
  const [cs] = await db
    .insert(changeSets)
    .values({
      orgId: ctx.orgId,
      agentId: input.agentId,
      origin: input.origin,
      actor: ctx.actor,
      intent: input.intent,
      patch: input.patch,
      status: "draft",
    })
    .returning();
  await audit(ctx, "changeset.create", cs.id);
  return cs;
}

/** o histórico único — tudo que mudou, de qualquer porta */
export function listChangeSets(ctx: Ctx, agentId: string) {
  return db
    .select()
    .from(changeSets)
    .where(and(eq(changeSets.orgId, ctx.orgId), eq(changeSets.agentId, agentId)))
    .orderBy(desc(changeSets.createdAt));
}

/**
 * PENDÊNCIAS do tenant: mudanças que já passaram no porteiro (status
 * "evaluated") e esperam SÓ o cliente aprovar. Alimenta o sino — o pedido do
 * cliente ganha um motivo concreto de voltar amanhã (fechar o ciclo que ele
 * mesmo abriu). Junta o nome do agente pra mostrar direto no aviso.
 */
export async function listPendencias(ctx: Ctx) {
  const rows = await db
    .select({
      id: changeSets.id,
      agentId: changeSets.agentId,
      agentName: agents.name,
      intent: changeSets.intent,
      impact: changeSets.impact,
      createdAt: changeSets.createdAt,
    })
    .from(changeSets)
    // o join TAMBÉM filtra por conta: sem isso, o sino podia mostrar o nome de
    // um agente de outro tenant (achado A4 da auditoria)
    .innerJoin(agents, and(eq(agents.id, changeSets.agentId), eq(agents.orgId, ctx.orgId)))
    .where(and(eq(changeSets.orgId, ctx.orgId), eq(changeSets.status, "evaluated")))
    .orderBy(desc(changeSets.createdAt));
  return rows;
}

export async function aprovarMudanca(ctx: Ctx, changeSetId: string) {
  // aprovar é o que solta a mudança para o ar → exige publicar, não "ajustar"
  exigirPermissao(ctx, "publicar");
  const [cs] = await db
    .update(changeSets)
    .set({ status: "approved", approvedBy: ctx.actor })
    .where(and(eq(changeSets.id, changeSetId), eq(changeSets.orgId, ctx.orgId)))
    .returning();
  // antes, aprovar um id inexistente (ou de outra conta) gravava audit mesmo
  // sem ter atualizado nada
  if (!cs) throw new NaoEncontrado("mudança");
  await audit(ctx, "changeset.approve", changeSetId);
  return cs;
}

/**
 * publicar = nova versão de spec + release IMUTÁVEL.
 * TODO: transação + compare-and-swap por current_spec_version; empurrar config pro cache do runtime.
 */
export async function publicar(
  ctx: Ctx,
  input: { agentId: string; spec: AgentSpec; changeSetId: string; runtimeVersion: string }
) {
  exigirPermissao(ctx, "publicar");
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, input.agentId), eq(agents.orgId, ctx.orgId)));
  if (!agent) throw new NaoEncontrado("agente");
  const atual = agent.currentSpecVersion ?? null;
  const nextVer = (atual ?? 0) + 1;

  // CAS: bump condicional de current_spec_version ANTES de gravar a spec.
  // Quem perder a corrida vê 0 linhas e aborta — sem spec órfã e sem
  // db.transaction (o driver neon-http pode não suportar transação interativa).
  // atual === null exige isNull: em SQL `= NULL` nunca casa.
  const cond = atual === null ? isNull(agents.currentSpecVersion) : eq(agents.currentSpecVersion, atual);
  const bumped = await db
    .update(agents)
    .set({ currentSpecVersion: nextVer })
    .where(and(eq(agents.id, input.agentId), eq(agents.orgId, ctx.orgId), cond))
    .returning();
  if (bumped.length === 0) throw new Conflito("conflito de versão — recarregue e tente de novo");

  const [spec] = await db
    .insert(agentSpecs)
    .values({
      orgId: ctx.orgId,
      agentId: input.agentId,
      version: nextVer,
      spec: input.spec,
      status: "published",
      origin: "hub_visual",
      createdBy: ctx.actor,
    })
    .returning();

  const [rel] = await db
    .insert(releases)
    .values({
      orgId: ctx.orgId,
      agentId: input.agentId,
      specVersion: nextVer,
      runtimeVersion: input.runtimeVersion,
      promotedBy: ctx.actor,
    })
    .returning();

  // com filtro de conta: sem ele, o admin de uma conta marcava como publicada
  // a mudança de outra, sabendo só o id (achado A4 da auditoria)
  await db
    .update(changeSets)
    .set({ status: "published" })
    .where(and(eq(changeSets.id, input.changeSetId), eq(changeSets.orgId, ctx.orgId)));
  await audit(ctx, "release.publish", rel.id, { version: nextVer });
  return { spec, release: rel };
}

/** releases (imutáveis) de um agente, mais novas primeiro */
export function listReleases(ctx: Ctx, agentId: string) {
  return db
    .select()
    .from(releases)
    .where(and(eq(releases.orgId, ctx.orgId), eq(releases.agentId, agentId)))
    .orderBy(desc(releases.promotedAt));
}

/**
 * reverter = "restaurar avançando": copia o conteúdo de uma versão antiga
 * para uma NOVA versão (nextVer = current+1), publica e cria release nova.
 * Nunca mexe no passado — a linha do tempo só cresce (auditável).
 * Mesmo CAS de publicar (sem transação interativa no neon-http).
 */
export async function reverter(ctx: Ctx, input: { agentId: string; toSpecVersion: number }) {
  exigirPermissao(ctx, "publicar");
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, input.agentId), eq(agents.orgId, ctx.orgId)));
  if (!agent) throw new NaoEncontrado("agente");

  // a spec-alvo tem que ser DESTE tenant (org_id + agent_id + version)
  const [alvo] = await db
    .select()
    .from(agentSpecs)
    .where(
      and(
        eq(agentSpecs.orgId, ctx.orgId),
        eq(agentSpecs.agentId, input.agentId),
        eq(agentSpecs.version, input.toSpecVersion)
      )
    );
  if (!alvo) throw new NaoEncontrado("versão de spec");

  const atual = agent.currentSpecVersion ?? null;
  const nextVer = (atual ?? 0) + 1;

  const cond = atual === null ? isNull(agents.currentSpecVersion) : eq(agents.currentSpecVersion, atual);
  const bumped = await db
    .update(agents)
    .set({ currentSpecVersion: nextVer })
    .where(and(eq(agents.id, input.agentId), eq(agents.orgId, ctx.orgId), cond))
    .returning();
  if (bumped.length === 0) throw new Conflito("conflito de versão — recarregue e tente de novo");

  const [spec] = await db
    .insert(agentSpecs)
    .values({
      orgId: ctx.orgId,
      agentId: input.agentId,
      version: nextVer,
      spec: alvo.spec, // copia o conteúdo da versão-alvo
      status: "published",
      origin: "metrik",
      createdBy: ctx.actor,
    })
    .returning();

  // runtimeVersion é notNull: reusa o da release da versão-alvo; senão a mais
  // recente; senão marca "revert" (nenhuma release ainda). TODO: amarrar
  // eval_run/git_sha quando a esteira de release estiver ligada.
  const rels = await db
    .select()
    .from(releases)
    .where(and(eq(releases.orgId, ctx.orgId), eq(releases.agentId, input.agentId)))
    .orderBy(desc(releases.promotedAt));
  const runtimeVersion =
    rels.find((r) => r.specVersion === input.toSpecVersion)?.runtimeVersion ?? rels[0]?.runtimeVersion ?? "revert";

  const [rel] = await db
    .insert(releases)
    .values({
      orgId: ctx.orgId,
      agentId: input.agentId,
      specVersion: nextVer,
      runtimeVersion,
      promotedBy: ctx.actor,
    })
    .returning();

  await audit(ctx, "release.revert", rel.id, { from: input.toSpecVersion, to: nextVer });
  return { spec, release: rel };
}

/** conexões (integrações) do tenant */
export function listConnections(ctx: Ctx) {
  return db.select().from(connections).where(eq(connections.orgId, ctx.orgId));
}

/**
 * grava/atualiza uma conexão do tenant. Só a REFERÊNCIA do vault entra aqui
 * (vaultRef) — NUNCA o segredo em claro. O token real fica no vault; aqui só o
 * ponteiro. Upsert manual por (org_id, kind): não há unique index no schema.
 */
export async function upsertConnection(
  ctx: Ctx,
  input: { kind: ConnKind; ref: string; meta?: Record<string, unknown> }
) {
  exigirPermissao(ctx, "gerenciar");
  const [existing] = await db
    .select()
    .from(connections)
    .where(and(eq(connections.orgId, ctx.orgId), eq(connections.kind, input.kind)));

  let row;
  if (existing) {
    [row] = await db
      .update(connections)
      .set({ vaultRef: input.ref, status: "connected", meta: input.meta ?? existing.meta })
      .where(and(eq(connections.id, existing.id), eq(connections.orgId, ctx.orgId)))
      .returning();
  } else {
    [row] = await db
      .insert(connections)
      .values({ orgId: ctx.orgId, kind: input.kind, vaultRef: input.ref, status: "connected", meta: input.meta })
      .returning();
  }
  await audit(ctx, "connection.upsert", row.id, { kind: input.kind });
  return row;
}

/**
 * loadPublishedSpec — a config VIVA do agente (a versão publicada atual).
 * É o que o runtime lê pra rodar; o front pode ler pra mostrar o estado real.
 * null = sem versão publicada ainda.
 */
export async function loadPublishedSpec(ctx: Ctx, agentId: string): Promise<AgentSpec | null> {
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.orgId, ctx.orgId)));
  const ver = agent?.currentSpecVersion ?? null;
  if (ver == null) return null;
  const [row] = await db
    .select()
    .from(agentSpecs)
    .where(
      and(eq(agentSpecs.orgId, ctx.orgId), eq(agentSpecs.agentId, agentId), eq(agentSpecs.version, ver))
    );
  return (row?.spec as AgentSpec | undefined) ?? null;
}

// ═══ ESCOLA / PORTEIRO — o pedido do cliente vira mudança testada ═══

/** o system-prompt (cérebro) a partir da spec — identidade + oferta + regras. */
function systemDe(spec: AgentSpec): string {
  const c = spec.cerebro;
  return [c.identidade, c.oferta ?? "", c.tom ? `Tom: ${c.tom}` : "", ...c.regras.map((r) => `- ${r}`)]
    .filter(Boolean)
    .join("\n");
}

/**
 * COMPILA o pedido do cliente (texto livre) numa nova AgentSpec: a mudança
 * entra como uma NOVA regra no cérebro. Não remove nem edita as regras
 * blindadas existentes (o guardião confere que continuam valendo) — só
 * ACRESCENTA a instrução do cliente. É o caminho sancionado do "cliente muda
 * sozinho": adicionar comportamento, nunca quebrar o núcleo.
 */
function compilarSpec(specAtual: AgentSpec, pedido: string): AgentSpec {
  const regra = pedido.trim();
  return {
    ...specAtual,
    cerebro: { ...specAtual.cerebro, regras: [...specAtual.cerebro.regras, regra] },
  };
}

/** situações representativas pro ENSAIO: as entradas da suíte da vertical. */
function situacoesDoKit(kit: ReturnType<typeof kitParaAgente>, n = 3) {
  return kit.evals.slice(0, n).map((e) => ({ nome: e.nome, pergunta: e.entrada.texto ?? "" }));
}

/**
 * avaliarMudanca — o PORTEIRO (guardião) + o ENSAIO num passo só.
 *  1) GUARDIÃO: roda a suíte de evals da vertical contra a spec JÁ com a
 *     mudança aplicada e grava a prova (impact.evals) — status "evaluated".
 *  2) ENSAIO: com o cérebro real (OPENAI_API_KEY) ligado, roda a mesma
 *     situação ANTES (spec atual) e AGORA (spec + pedido) e devolve as duas
 *     respostas lado a lado — a simulação claríssima que o cliente lê pra
 *     decidir "é isso que eu quero?". Sem cérebro, o ensaio avisa honesto
 *     ("conecte o cérebro") em vez de mostrar teatro.
 */
export async function avaliarMudanca(ctx: Ctx, changeSetId: string) {
  exigirPermissao(ctx, "ajustar");
  const [cs] = await db
    .select()
    .from(changeSets)
    .where(and(eq(changeSets.id, changeSetId), eq(changeSets.orgId, ctx.orgId)));
  if (!cs) throw new NaoEncontrado("mudança");

  const [ag] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, cs.agentId), eq(agents.orgId, ctx.orgId)));
  const kit = kitParaAgente(ag?.name ?? "");
  const pedido = String((cs.patch as any)?.pedido ?? cs.intent ?? "").trim();

  // spec ATUAL (a publicada; senão a semente da vertical) e a spec COM a mudança
  const specAtual = (await loadPublishedSpec(ctx, cs.agentId)) ?? kit.spec;
  const specNovo = compilarSpec(specAtual, pedido);

  const apiKey = process.env.OPENAI_API_KEY;
  const temCerebro = !!apiKey;

  // ── GUARDIÃO: testa a spec NOVA contra as travas da vertical ──
  const runner = temCerebro
    ? (() => {
        const brain = makeBrain({ apiKey, reasoningEffort: "low" });
        const system = systemDe(specNovo);
        return async (entrada: { texto?: string }) => {
          const turn = await brain.responder({ system, historico: [{ role: "user", content: entrada.texto ?? "" }] });
          const moved = turn.toolCalls?.find((t) => t.tool === "moverEtapa");
          return { texto: turn.texto, toolCalls: turn.toolCalls, movedStage: moved ? String(moved.args.stageId ?? "") : undefined };
        };
      })()
    : (() => {
        // sem cérebro: FakeBrain roteirizado da vertical (confere as travas base)
        const brain = new FakeBrain({
          regras: kit.roteiro.map((r) => ({ quando: new RegExp(r.quando, "i"), responder: () => ({ texto: r.texto, toolCalls: r.tool ? [r.tool] : undefined }) })),
          textoPadrao: kit.textoPadrao,
        });
        const system = systemDe(specNovo);
        return async (entrada: { texto?: string }) => {
          const turn = await brain.responder({ system, historico: [{ role: "user", content: entrada.texto ?? "" }] });
          const moved = turn.toolCalls?.find((t) => t.tool === "moverEtapa");
          return { texto: turn.texto, toolCalls: turn.toolCalls, movedStage: moved ? String(moved.args.stageId ?? "") : undefined };
        };
      })();
  const evals = await runEvals(kit.evals, runner, 0.75);

  // ── ENSAIO: antes vs agora (só com cérebro real; senão, honesto) ──
  // As situações são DERIVADAS DO PEDIDO (o ensaio prova a SUA mudança, não um
  // kit genérico) + 1 do kit como guarda-chuva. Se a geração falhar, cai no kit.
  let ensaio: { modo: "real" | "sem-cerebro"; situacoes: { nome: string; pergunta: string; antes: string; agora: string }[] };
  if (temCerebro) {
    const brain = makeBrain({ apiKey, reasoningEffort: "low" });
    const sysAntes = systemDe(specAtual);
    const sysAgora = systemDe(specNovo);
    let doPedido: { nome: string; pergunta: string }[] = [];
    try {
      const gen = await brain.responder({
        system:
          "Você gera mensagens de teste para um simulador de atendimento no WhatsApp. Responda APENAS com as mensagens pedidas, uma por linha, sem numeração, sem aspas e sem comentários.",
        historico: [
          {
            role: "user",
            content: `A dona do negócio pediu esta mudança na IA de atendimento: "${pedido}". Escreva 2 mensagens curtas e naturais que um lead mandaria no WhatsApp e que fariam essa mudança aparecer na resposta da IA.`,
          },
        ],
      });
      doPedido = (gen.texto ?? "")
        .split("\n")
        .map((s) => s.replace(/^[\s\-\d.)"“”]+|["“”\s]+$/g, ""))
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => ({ nome: "do seu pedido", pergunta: p }));
    } catch {
      /* sem gerador → só o kit */
    }
    const todas = [...doPedido, ...situacoesDoKit(kit, doPedido.length > 0 ? 1 : 3)];
    const situacoes = await Promise.all(
      todas.map(async (s) => {
        const [antes, agora] = await Promise.all([
          brain.responder({ system: sysAntes, historico: [{ role: "user", content: s.pergunta }] }),
          brain.responder({ system: sysAgora, historico: [{ role: "user", content: s.pergunta }] }),
        ]);
        return { nome: s.nome, pergunta: s.pergunta, antes: antes.texto ?? "—", agora: agora.texto ?? "—" };
      }),
    );
    ensaio = { modo: "real", situacoes };
  } else {
    ensaio = { modo: "sem-cerebro", situacoes: [] };
  }

  const [updated] = await db
    .update(changeSets)
    .set({ status: "evaluated", impact: { evals, suite: kit.id, ensaio } })
    .where(and(eq(changeSets.id, changeSetId), eq(changeSets.orgId, ctx.orgId)))
    .returning();
  await audit(ctx, "changeset.evaluate", changeSetId, { taxa: evals.taxa, aprovado: evals.aprovado, suite: kit.id, ensaio: ensaio.modo });
  return { changeSet: updated, evals, ensaio };
}

/**
 * specRodando — "o que está rodando AGORA", direto do motor: a spec publicada
 * (ou a semente da vertical, sinalizado), a versão e o "no ar desde". É a
 * FONTE da tela Como funciona pra agente real — nada de vitrine vestida.
 */
export async function specRodando(ctx: Ctx, agentId: string) {
  const [ag] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.orgId, ctx.orgId)));
  if (!ag) throw new NaoEncontrado("agente");
  const kit = kitParaAgente(ag.name ?? "");
  const publicada = await loadPublishedSpec(ctx, agentId);
  const [rel] = await db
    .select()
    .from(releases)
    .where(and(eq(releases.agentId, agentId), eq(releases.orgId, ctx.orgId)))
    .orderBy(desc(releases.promotedAt))
    .limit(1);
  return {
    base: publicada ? ("publicada" as const) : ("semente" as const),
    versao: (ag as any).currentSpecVersion ?? rel?.specVersion ?? 0,
    desde: rel?.promotedAt ?? null,
    spec: publicada ?? kit.spec,
  };
}

/**
 * rodarTestes — a RODADA de testes sob demanda (Estúdio): roda a suíte da
 * vertical contra a spec que está NO AR (publicada ?? semente), caso a caso,
 * com o tempo de cada um. Com OPENAI_API_KEY é a IA de verdade respondendo
 * cada ataque; sem, o FakeBrain roteirizado confere as travas base — e o
 * resultado vem SINALIZADO (modo) pra UI nunca vender roteiro como real.
 */
export async function rodarTestes(ctx: Ctx, agentId: string) {
  exigirPermissao(ctx, "ajustar");
  const [ag] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.orgId, ctx.orgId)));
  if (!ag) throw new NaoEncontrado("agente");
  const kit = kitParaAgente(ag.name ?? "");
  const publicada = await loadPublishedSpec(ctx, agentId);
  const spec = publicada ?? kit.spec;
  const base: "publicada" | "semente" = publicada ? "publicada" : "semente";

  const apiKey = process.env.OPENAI_API_KEY;
  const modo: "real" | "roteiro" = apiKey ? "real" : "roteiro";
  const brain = apiKey
    ? makeBrain({ apiKey, reasoningEffort: "low" })
    : new FakeBrain({
        regras: kit.roteiro.map((r) => ({ quando: new RegExp(r.quando, "i"), responder: () => ({ texto: r.texto, toolCalls: r.tool ? [r.tool] : undefined }) })),
        textoPadrao: kit.textoPadrao,
      });
  const system = systemDe(spec);
  const ms: number[] = [];
  const runner = async (entrada: { texto?: string }) => {
    const t0 = Date.now();
    try {
      const turn = await brain.responder({ system, historico: [{ role: "user", content: entrada.texto ?? "" }] });
      const moved = turn.toolCalls?.find((t) => t.tool === "moverEtapa");
      return { texto: turn.texto, toolCalls: turn.toolCalls, movedStage: moved ? String(moved.args.stageId ?? "") : undefined };
    } finally {
      ms.push(Date.now() - t0);
    }
  };
  const t0 = Date.now();
  const evals = await runEvals(kit.evals, runner, 0.75);
  await audit(ctx, "agente.testes", agentId, { modo, base, taxa: evals.taxa, passaram: evals.passaram, total: evals.total });
  return { modo, base, evals, ms, duracaoMs: Date.now() - t0, suite: kit.id };
}

/**
 * testarConversa — a CONVERSA DE TESTE (aba Testar): o cliente fala como se
 * fosse um lead com o MESMO cérebro do ar. SANDBOX POR CONSTRUÇÃO: o LlmPort
 * roda SEM tools e sem CrmPort — não existe caminho pra tocar o CRM, o estado
 * ou o WhatsApp. Nada entra no flight recorder (não é atendimento) — só audit.
 *  • modo "ar": a spec publicada (ou a semente da vertical, sinalizado).
 *  • modo "ensaio": aplica por cima o último pedido em preparo (draft/
 *    evaluated/approved) — o cliente prova a mudança ANTES de publicar.
 *  • sem OPENAI_API_KEY: { modo: "sem-cerebro" } — honesto, sem teatro.
 * A proveniência ("usou: X") é o próprio cérebro dizendo qual regra/fato usou,
 * numa linha [fonte: …] que a gente extrai da resposta.
 */
export async function testarConversa(
  ctx: Ctx,
  input: { agentId: string; historico: { role: "user" | "assistant"; content: string }[]; modo?: "ar" | "ensaio" },
) {
  // gasta chamada de IA → não é leitura
  exigirPermissao(ctx, "ajustar");
  const [ag] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, input.agentId), eq(agents.orgId, ctx.orgId)));
  if (!ag) throw new NaoEncontrado("agente");

  const kit = kitParaAgente(ag.name ?? "");
  const publicada = await loadPublishedSpec(ctx, input.agentId);
  let spec = publicada ?? kit.spec;
  const base: "publicada" | "semente" = publicada ? "publicada" : "semente";

  // "com o ensaio": o último pedido em preparo entra por cima, como no avaliar
  let ensaioAplicado: string | null = null;
  if (input.modo === "ensaio") {
    const [cs] = await db
      .select()
      .from(changeSets)
      .where(and(eq(changeSets.agentId, input.agentId), eq(changeSets.orgId, ctx.orgId), sql`${changeSets.status} in ('draft','evaluated','approved')`))
      .orderBy(desc(changeSets.createdAt))
      .limit(1);
    if (cs) {
      const pedido = String((cs.patch as any)?.pedido ?? cs.intent ?? "").trim();
      if (pedido) {
        spec = compilarSpec(spec, pedido);
        ensaioAplicado = cs.intent ?? pedido;
      }
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    await audit(ctx, "agente.testar", input.agentId, { modo: "sem-cerebro" });
    return { modo: "sem-cerebro" as const, base, ensaioAplicado };
  }

  const brain = makeBrain({ apiKey, reasoningEffort: "low" });
  const system =
    systemDe(spec) +
    "\n\nDepois da sua resposta, escreva UMA última linha isolada no formato [fonte: <qual regra, fato ou parte da oferta você usou, em até 6 palavras — ou \"conversa geral\">].";
  const historico = input.historico.slice(-12); // conversa de teste é curta; corta cauda
  const turn = await brain.responder({ system, historico }); // SEM tools: sandbox
  let texto = (turn.texto ?? "").trim();
  let fonte: string | null = null;
  const m = texto.match(/\[fonte:\s*([^\]]+)\]\s*$/i);
  if (m) {
    fonte = m[1].trim();
    texto = texto.slice(0, m.index).trim();
  }
  await audit(ctx, "agente.testar", input.agentId, { modo: input.modo ?? "ar", msgs: historico.length, base });
  return { modo: "real" as const, texto: texto || "…", fonte, base, ensaioAplicado };
}

/**
 * publicarMudanca — o "PRO AR" self-service do cliente: pega o pedido do
 * ChangeSet, COMPILA na spec nova (compilarSpec) e PUBLICA de verdade (nova
 * versão + release imutável, o runtime passa a ler). Fecha o ciclo que era
 * a maior trava: a mudança do cliente vai pro ar SEM a Metrik escrever spec.
 */
export async function publicarMudanca(ctx: Ctx, changeSetId: string) {
  const [cs] = await db
    .select()
    .from(changeSets)
    .where(and(eq(changeSets.id, changeSetId), eq(changeSets.orgId, ctx.orgId)));
  if (!cs) throw new NaoEncontrado("mudança");
  const [ag] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, cs.agentId), eq(agents.orgId, ctx.orgId)));
  const kit = kitParaAgente(ag?.name ?? "");
  const pedido = String((cs.patch as any)?.pedido ?? cs.intent ?? "").trim();
  const specAtual = (await loadPublishedSpec(ctx, cs.agentId)) ?? kit.spec;
  const specNovo = compilarSpec(specAtual, pedido);
  return publicar(ctx, { agentId: cs.agentId, spec: specNovo, changeSetId, runtimeVersion: "web-1" });
}

/**
 * PAUSAR/LIGAR um agente de verdade — persiste o estado no banco (não é
 * toggle cosmético). O runtime (handleInbound) confere isto ANTES de responder:
 * pausado = a IA não fala com o lead. É a ação de emergência do cliente.
 */
export async function setAgentEstado(ctx: Ctx, input: { agentId: string; estado: "ativo" | "pausado" }) {
  exigirPermissao(ctx, "operar");
  const [row] = await db
    .update(agents)
    .set({ state: input.estado })
    .where(and(eq(agents.id, input.agentId), eq(agents.orgId, ctx.orgId)))
    .returning();
  if (!row) throw new NaoEncontrado("agente");
  await audit(ctx, "agent.estado", input.agentId, { estado: input.estado });
  return { id: row.id, state: row.state };
}

/** o estado atual (ativo/idle/pausado) de um agente — o runtime lê pra decidir. */
export async function getAgentEstado(ctx: Ctx, agentId: string) {
  const [row] = await db
    .select({ state: agents.state })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.orgId, ctx.orgId)));
  return { estado: row?.state ?? "idle" };
}

// ═══ ASSUMIR A CONVERSA — pausa por CONTATO (o botão de emergência do cliente) ═══

/** o humano assume ESTE contato: a IA cala só ali, segue atendendo o resto. */
export async function assumirContato(ctx: Ctx, input: { agentId: string; contato: string }) {
  exigirPermissao(ctx, "operar");
  const [ag] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, input.agentId), eq(agents.orgId, ctx.orgId)));
  if (!ag) throw new NaoEncontrado("agente");
  const [row] = await db
    .insert(contactStates)
    .values({ orgId: ctx.orgId, agentId: input.agentId, contato: input.contato, estado: "humano", assumidoPor: ctx.actor })
    .onConflictDoUpdate({
      target: [contactStates.agentId, contactStates.contato],
      set: { estado: "humano", assumidoPor: ctx.actor, updatedAt: sql`now()` },
    })
    .returning();
  await audit(ctx, "contato.assumir", input.agentId, { contato: input.contato });
  return { id: row.id, estado: row.estado };
}

/** devolve o contato pra IA — apaga a linha; ausência = IA no comando. */
export async function devolverContato(ctx: Ctx, input: { agentId: string; contato: string }) {
  exigirPermissao(ctx, "operar");
  await db
    .delete(contactStates)
    .where(and(eq(contactStates.orgId, ctx.orgId), eq(contactStates.agentId, input.agentId), eq(contactStates.contato, input.contato)));
  await audit(ctx, "contato.devolver", input.agentId, { contato: input.contato });
  return { estado: "ia" as const };
}

/** o webhook lê ANTES de responder: "humano" = assumido, a IA não fala. */
export async function getContatoEstado(ctx: Ctx, agentId: string, contato: string) {
  const [row] = await db
    .select({ estado: contactStates.estado })
    .from(contactStates)
    .where(and(eq(contactStates.orgId, ctx.orgId), eq(contactStates.agentId, agentId), eq(contactStates.contato, contato)));
  return { estado: (row?.estado ?? "ia") as "ia" | "humano" };
}

/** quem está com humano agora (pro front marcar as conversas assumidas). */
export function listAssumidos(ctx: Ctx, agentId?: string) {
  const cond = agentId
    ? and(eq(contactStates.orgId, ctx.orgId), eq(contactStates.agentId, agentId))
    : eq(contactStates.orgId, ctx.orgId);
  return db
    .select({ agentId: contactStates.agentId, contato: contactStates.contato, assumidoPor: contactStates.assumidoPor, updatedAt: contactStates.updatedAt })
    .from(contactStates)
    .where(cond)
    .orderBy(desc(contactStates.updatedAt));
}

/** usuários/membros do tenant (Admin) — quem tem login nesta organização. */
export function listMembers(ctx: Ctx) {
  return db.select().from(memberships).where(eq(memberships.orgId, ctx.orgId)).orderBy(desc(memberships.createdAt));
}

// ═══ FLIGHT RECORDER — a caixa-preta REAL (o que separa produto de demo) ═══

/** grava UMA execução de agente. Ingerido pelos agentes reais via action=log. */
export async function registrarLog(
  ctx: Ctx,
  input: {
    agentId?: string;
    motor?: string;
    ok: boolean;
    resumo: string;
    did?: unknown;
    erro?: string;
    /** R$ ligado à execução em centavos (reunião marcada, lead recuperado) — Radar de Dinheiro */
    valorCentavos?: number;
    meta?: unknown;
  }
) {
  // Quem ingere é o runtime, com token de escopo `log` (a API já conferiu o
  // escopo). Pessoa precisa de permissão de operar: antes, um `viewer` gravava
  // execução com valor em R$ e inflava o Radar de Dinheiro.
  if (ctx.via !== "maquina") exigirPermissao(ctx, "operar");
  if (input.agentId) await exigirAgenteDaConta(ctx, input.agentId);
  if (input.valorCentavos !== undefined) {
    if (!Number.isInteger(input.valorCentavos) || input.valorCentavos < 0) {
      throw new EntradaInvalida("valorCentavos precisa ser inteiro não negativo");
    }
  }
  const [row] = await db
    .insert(runtimeLogs)
    .values({
      orgId: ctx.orgId,
      agentId: input.agentId,
      motor: input.motor,
      ok: input.ok,
      resumo: input.resumo,
      did: input.did,
      erro: input.erro,
      valorCentavos: input.valorCentavos,
      meta: input.meta,
    })
    .returning();
  return row;
}

/** a caixa-preta, mais novo primeiro (opcionalmente por agente). */
export function listLogs(ctx: Ctx, agentId?: string, limit = 50) {
  const cond = agentId
    ? and(eq(runtimeLogs.orgId, ctx.orgId), eq(runtimeLogs.agentId, agentId))
    : eq(runtimeLogs.orgId, ctx.orgId);
  return db
    .select()
    .from(runtimeLogs)
    .where(cond)
    .orderBy(desc(runtimeLogs.at))
    .limit(Math.min(Math.max(1, limit), 200));
}

/** os números REAIS do dia (Home/Ao vivo): execuções, acertos e o R$ do Radar. */
export async function statsHoje(ctx: Ctx) {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const rows = await db
    .select()
    .from(runtimeLogs)
    .where(and(eq(runtimeLogs.orgId, ctx.orgId), gte(runtimeLogs.at, inicio)))
    .limit(2000);

  const execucoes = rows.length;
  const acertos = rows.filter((r) => r.ok).length;
  const valorCentavos = rows.reduce((s, r) => s + (r.valorCentavos ?? 0), 0);
  const porAgente: Record<string, { execucoes: number; acertos: number }> = {};
  for (const r of rows) {
    const k = r.agentId ?? "geral";
    porAgente[k] = porAgente[k] ?? { execucoes: 0, acertos: 0 };
    porAgente[k].execucoes++;
    if (r.ok) porAgente[k].acertos++;
  }
  // Radar de Dinheiro nunca abre em zero: acumuladores + o último R$ que a
  // frota fez (a tela mostra "último: reunião com X · +R$ 1.500 · há 2 dias"
  // num dia parado, em vez de um R$ 0 gigante).
  const [acum] = await db
    .select({
      total: sql<number>`coalesce(sum(${runtimeLogs.valorCentavos}), 0)`,
      d7: sql<number>`coalesce(sum(${runtimeLogs.valorCentavos}) filter (where ${runtimeLogs.at} >= now() - interval '7 days'), 0)`,
      d30: sql<number>`coalesce(sum(${runtimeLogs.valorCentavos}) filter (where ${runtimeLogs.at} >= now() - interval '30 days'), 0)`,
      // total de "momentos de dinheiro" (reuniões marcadas etc.) — degraus dos marcos
      reunioes: sql<number>`count(*)`,
    })
    .from(runtimeLogs)
    .where(and(eq(runtimeLogs.orgId, ctx.orgId), isNotNull(runtimeLogs.valorCentavos)));
  const [ultimo] = await db
    .select()
    .from(runtimeLogs)
    .where(and(eq(runtimeLogs.orgId, ctx.orgId), isNotNull(runtimeLogs.valorCentavos)))
    .orderBy(desc(runtimeLogs.at))
    .limit(1);

  return {
    execucoes,
    acertos,
    erros: execucoes - acertos,
    taxa: execucoes ? acertos / execucoes : null,
    valorCentavos,
    valor7dCentavos: Number(acum?.d7 ?? 0),
    valor30dCentavos: Number(acum?.d30 ?? 0),
    valorTotalCentavos: Number(acum?.total ?? 0),
    reunioesTotal: Number(acum?.reunioes ?? 0),
    ultimoValor: ultimo
      ? { resumo: ultimo.resumo, valorCentavos: ultimo.valorCentavos ?? 0, at: ultimo.at }
      : null,
    porAgente,
  };
}

async function audit(ctx: Ctx, action: string, target?: string, data?: unknown) {
  await db.insert(auditLog).values({ orgId: ctx.orgId, actor: ctx.actor, action, target, data });
}
