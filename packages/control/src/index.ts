// @motor/control — Control API (camada de serviço, sem framework).
// A porta ÚNICA de mudança: front, Claude Code, Codex e API usam ISTO.
// Regra de ouro: org_id SEMPRE vem do servidor (Ctx), nunca do cliente.
import { and, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { db, agents, agentSpecs, changeSets, connections, releases, auditLog, organizations, memberships, runtimeLogs, contactStates } from "@motor/db";
import { FakeBrain, makeBrain } from "@motor/llm";
import { runEvals } from "@motor/evals";
import { kitParaAgente } from "@motor/samples";
import type { AgentSpec, AgentTipo, ChangeOrigin, ConnKind } from "@motor/core";

// re-export pros hosts (guards das functions usam sem importar @motor/db direto)
export { getDatabaseUrl } from "@motor/db";

export interface Ctx {
  orgId: string;
  actor: string;
  role: "owner" | "admin" | "operator" | "viewer";
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
    .innerJoin(agents, eq(agents.id, changeSets.agentId))
    .where(and(eq(changeSets.orgId, ctx.orgId), eq(changeSets.status, "evaluated")))
    .orderBy(desc(changeSets.createdAt));
  return rows;
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
  const [cs] = await db
    .select()
    .from(changeSets)
    .where(and(eq(changeSets.id, changeSetId), eq(changeSets.orgId, ctx.orgId)));
  if (!cs) throw new Error("mudança não encontrada neste tenant");

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
  let ensaio: { modo: "real" | "sem-cerebro"; situacoes: { nome: string; pergunta: string; antes: string; agora: string }[] };
  if (temCerebro) {
    const brain = makeBrain({ apiKey, reasoningEffort: "low" });
    const sysAntes = systemDe(specAtual);
    const sysAgora = systemDe(specNovo);
    const sits = situacoesDoKit(kit, 3);
    const situacoes = [];
    for (const s of sits) {
      const [antes, agora] = await Promise.all([
        brain.responder({ system: sysAntes, historico: [{ role: "user", content: s.pergunta }] }),
        brain.responder({ system: sysAgora, historico: [{ role: "user", content: s.pergunta }] }),
      ]);
      situacoes.push({ nome: s.nome, pergunta: s.pergunta, antes: antes.texto ?? "—", agora: agora.texto ?? "—" });
    }
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
  if (!cs) throw new Error("mudança não encontrada neste tenant");
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
  if (ctx.role === "viewer") throw new Error("sem permissão pra pausar/ligar");
  const [row] = await db
    .update(agents)
    .set({ state: input.estado })
    .where(and(eq(agents.id, input.agentId), eq(agents.orgId, ctx.orgId)))
    .returning();
  if (!row) throw new Error("agente não encontrado neste tenant");
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
  if (ctx.role === "viewer") throw new Error("sem permissão pra assumir");
  const [ag] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, input.agentId), eq(agents.orgId, ctx.orgId)));
  if (!ag) throw new Error("agente não encontrado neste tenant");
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
  if (ctx.role === "viewer") throw new Error("sem permissão pra devolver");
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
