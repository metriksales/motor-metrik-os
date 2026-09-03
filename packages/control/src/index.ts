// @motor/control — Control API (camada de serviço, sem framework).
// A porta ÚNICA de mudança: front, Claude Code, Codex e API usam ISTO.
// Regra de ouro: org_id SEMPRE vem do servidor (Ctx), nunca do cliente.
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, agents, agentSpecs, changeSets, connections, releases, auditLog } from "@motor/db";
import type { AgentSpec, AgentTipo, ChangeOrigin, ConnKind } from "@motor/core";

export interface Ctx {
  orgId: string;
  actor: string;
  role: "owner" | "admin" | "operator" | "viewer";
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

export async function aprovarMudanca(ctx: Ctx, changeSetId: string) {
  if (ctx.role === "viewer") throw new Error("sem permissão pra aprovar");
  const [cs] = await db
    .update(changeSets)
    .set({ status: "approved", approvedBy: ctx.actor })
    .where(and(eq(changeSets.id, changeSetId), eq(changeSets.orgId, ctx.orgId)))
    .returning();
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
  if (ctx.role === "viewer" || ctx.role === "operator") throw new Error("sem permissão pra publicar");
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, input.agentId), eq(agents.orgId, ctx.orgId)));
  if (!agent) throw new Error("agente não encontrado neste tenant");
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
  if (bumped.length === 0) throw new Error("conflito de versão — recarregue e tente de novo");

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

  await db.update(changeSets).set({ status: "published" }).where(eq(changeSets.id, input.changeSetId));
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
  if (ctx.role === "viewer" || ctx.role === "operator") throw new Error("sem permissão pra reverter");
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, input.agentId), eq(agents.orgId, ctx.orgId)));
  if (!agent) throw new Error("agente não encontrado neste tenant");

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
  if (!alvo) throw new Error("versão de spec não encontrada neste tenant");

  const atual = agent.currentSpecVersion ?? null;
  const nextVer = (atual ?? 0) + 1;

  const cond = atual === null ? isNull(agents.currentSpecVersion) : eq(agents.currentSpecVersion, atual);
  const bumped = await db
    .update(agents)
    .set({ currentSpecVersion: nextVer })
    .where(and(eq(agents.id, input.agentId), eq(agents.orgId, ctx.orgId), cond))
    .returning();
  if (bumped.length === 0) throw new Error("conflito de versão — recarregue e tente de novo");

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
  if (ctx.role === "viewer" || ctx.role === "operator") throw new Error("sem permissão pra conectar");
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

async function audit(ctx: Ctx, action: string, target?: string, data?: unknown) {
  await db.insert(auditLog).values({ orgId: ctx.orgId, actor: ctx.actor, action, target, data });
}
