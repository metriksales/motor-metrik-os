// @motor/control — Control API (camada de serviço, sem framework).
// A porta ÚNICA de mudança: front, Claude Code, Codex e API usam ISTO.
// Regra de ouro: org_id SEMPRE vem do servidor (Ctx), nunca do cliente.
import { and, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { db, agents, agentSpecs, changeSets, connections, releases, auditLog, organizations, memberships, runtimeLogs, contactStates, machineTokens, users, sessions, loginCodes, invites } from "@motor/db";
import { FakeBrain, makeBrain } from "@motor/llm";
import { runEvals } from "@motor/evals";
import { kitParaAgente } from "@motor/samples";
import {
  aplicarPlanoDeMudanca,
  criarProvaOperacional,
  planejarMudanca,
  type AgentSpec,
  type AgentTipo,
  type ChangeOrigin,
  type ConnKind,
  type OperationalProof,
} from "@motor/core";
import {
  type Escopo,
  ehTokenDeMaquina,
  hashToken,
  normalizarEscopos,
  novoToken,
  papelDoToken,
} from "./tokens.js";

import { ehSegredoEntrada, hashSegredo, novoSegredoEntrada } from "./webhooks.js";
import { Conflito, EntradaInvalida, ErroDeDominio, NaoEncontrado, SemPermissao } from "./erros.js";
import {
  CODIGO_MINUTOS,
  CODIGO_TENTATIVAS,
  CONVITE_DIAS,
  SESSAO_DIAS,
  expiraEm,
  expirou,
  emailValido,
  hash,
  iguais,
  normalizarEmail,
  novoCodigo,
  novoTokenOpaco,
} from "./sessao.js";
import { criarEmail, textoDoCodigo, textoDoConvite, type EmailPort } from "./email.js";
import { exigirPermissao } from "./permissoes.js";

export * from "./tokens.js";
export * from "./webhooks.js";
export * from "./erros.js";
export * from "./permissoes.js";
export * from "./sessao.js";
export * from "./email.js";

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
export { getDatabaseUrl, comContexto, comConta, comPessoa, contaEmCurso, pessoaEmCurso } from "@motor/db";

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

/** COMPILA o pedido na peça certa: conversa no cérebro, automação no motor. */
function compilarSpec(specAtual: AgentSpec, pedido: string): AgentSpec {
  return aplicarPlanoDeMudanca(specAtual, planejarMudanca(pedido));
}

function placarOperacional(prova: OperationalProof) {
  const total = prova.checks.length;
  const passaram = prova.checks.filter((check) => check.passou).length;
  return {
    total,
    passaram,
    falharam: total - passaram,
    taxa: total === 0 ? 0 : passaram / total,
    aprovado: prova.aprovado,
    limiar: 1,
    casos: prova.checks.map((check) => ({
      caseId: check.id,
      nome: check.rotulo,
      passou: check.passou,
      falhas: check.passou ? [] : ["configuração não aplicada"],
      entrada: {},
      criterios: [],
    })),
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
  const plano = planejarMudanca(pedido);

  // spec ATUAL (a publicada; senão a semente da vertical) e a spec COM a mudança
  const specAtual = (await loadPublishedSpec(ctx, cs.agentId)) ?? kit.spec;
  const specNovo = aplicarPlanoDeMudanca(specAtual, plano);

  // Automação é provada como automação: config aplicada, cadência exata e
  // cérebro intacto. Não usamos uma resposta de chat como evidência falsa.
  if (plano.kind === "motor") {
    const prova = criarProvaOperacional(specAtual, specNovo, plano);
    const evals = placarOperacional(prova);
    const ensaio = { modo: "operacional" as const, ...prova };
    const [updated] = await db
      .update(changeSets)
      .set({
        status: "evaluated",
        before: prova.antes,
        after: prova.agora,
        impact: { tipo: "motor", plano, evals, suite: `motor.${plano.motorId}.config.v1`, ensaio },
      })
      .where(and(eq(changeSets.id, changeSetId), eq(changeSets.orgId, ctx.orgId)))
      .returning();
    await audit(ctx, "changeset.evaluate", changeSetId, {
      tipo: "motor",
      motor: plano.motorId,
      aprovado: prova.aprovado,
      suite: `motor.${plano.motorId}.config.v1`,
    });
    return { changeSet: updated, evals, ensaio, plano };
  }

  if (plano.kind === "documento" || plano.kind === "ferramenta") {
    throw new Error(
      plano.kind === "ferramenta"
        ? "conexões são feitas na área Conexões — não alterei a conversa do agente"
        : "documentos precisam de revisão antes de entrar na base",
    );
  }

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
    .set({ status: "evaluated", impact: { tipo: "conversa", plano, evals, suite: kit.id, ensaio } })
    .where(and(eq(changeSets.id, changeSetId), eq(changeSets.orgId, ctx.orgId)))
    .returning();
  await audit(ctx, "changeset.evaluate", changeSetId, { taxa: evals.taxa, aprovado: evals.aprovado, suite: kit.id, ensaio: ensaio.modo });
  return { changeSet: updated, evals, ensaio, plano };
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
export async function rodarTestes(ctx: Ctx, agentId: string, modoTeste: "ar" | "ensaio" = "ar", changeSetId?: string) {
  // gasta chamada de IA → exige permissão de ajustar (S-006)
  exigirPermissao(ctx, "ajustar");
  const [ag] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.orgId, ctx.orgId)));
  if (!ag) throw new NaoEncontrado("agente");
  const kit = kitParaAgente(ag.name ?? "");
  const publicada = await loadPublishedSpec(ctx, agentId);
  let spec = publicada ?? kit.spec;
  const base: "publicada" | "semente" = publicada ? "publicada" : "semente";
  let mudanca: { id: string; intent: string } | null = null;

  if (modoTeste === "ensaio") {
    const baseQuery = db
      .select()
      .from(changeSets)
      .where(and(
        eq(changeSets.agentId, agentId),
        eq(changeSets.orgId, ctx.orgId),
        sql`${changeSets.status} in ('draft','evaluated','approved')`,
        ...(changeSetId ? [eq(changeSets.id, changeSetId)] : []),
      ));
    const [cs] = changeSetId ? await baseQuery.limit(1) : await baseQuery.orderBy(desc(changeSets.createdAt)).limit(1);
    if (cs) {
      const pedido = String((cs.patch as any)?.pedido ?? cs.intent ?? "").trim();
      if (pedido) {
        spec = compilarSpec(spec, pedido);
        mudanca = { id: cs.id, intent: cs.intent ?? pedido };
      }
    }
  }

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
  await audit(ctx, "agente.testes", agentId, { modo, modoTeste, base, mudancaId: mudanca?.id ?? null, taxa: evals.taxa, passaram: evals.passaram, total: evals.total });
  return { modo, modoTeste, base, mudanca, evals, ms, duracaoMs: Date.now() - t0, suite: kit.id };
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
  input: { agentId: string; historico: { role: "user" | "assistant"; content: string }[]; modo?: "ar" | "ensaio"; changeSetId?: string },
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
    const baseQuery = db
      .select()
      .from(changeSets)
      .where(and(
        eq(changeSets.agentId, input.agentId),
        eq(changeSets.orgId, ctx.orgId),
        sql`${changeSets.status} in ('draft','evaluated','approved')`,
        ...(input.changeSetId ? [eq(changeSets.id, input.changeSetId)] : []),
      ));
    const [cs] = input.changeSetId ? await baseQuery.limit(1) : await baseQuery.orderBy(desc(changeSets.createdAt)).limit(1);
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
  const plano = planejarMudanca(pedido);
  if (plano.kind === "documento" || plano.kind === "ferramenta") {
    throw new Error(plano.kind === "ferramenta" ? "use a área Conexões para ligar uma ferramenta" : "documento ainda precisa de revisão");
  }
  const impact = (cs.impact ?? {}) as any;
  if (cs.status !== "evaluated" && cs.status !== "approved") {
    throw new Error("rode o teste antes de publicar");
  }
  if (impact?.evals?.aprovado !== true) {
    throw new Error("o guardião não aprovou esta mudança");
  }
  if (plano.kind === "conversa" && impact?.ensaio?.modo !== "real") {
    throw new Error("a conversa precisa de um ensaio real antes de publicar");
  }
  const specAtual = (await loadPublishedSpec(ctx, cs.agentId)) ?? kit.spec;
  const specNovo = aplicarPlanoDeMudanca(specAtual, plano);
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
/**
 * Quem acessa esta conta. O vínculo guarda `user_id` como TEXTO, e nem todo
 * texto ali é uma pessoa: as linhas da época do Clerk apontam para
 * identidades que não existem mais (`user_2abc…`) e não abrem nada. Por isso
 * o join com `users` e o campo `viva` — sem ele a tela mostra id cru e a
 * pessoa não se reconhece na própria lista.
 */
export function listMembers(ctx: Ctx) {
  return db
    .select({
      userId: memberships.userId,
      role: memberships.role,
      createdAt: memberships.createdAt,
      email: users.email,
      nome: users.name,
    })
    .from(memberships)
    .leftJoin(users, eq(sql<string>`${users.id}::text`, memberships.userId))
    .where(eq(memberships.orgId, ctx.orgId))
    .orderBy(desc(memberships.createdAt));
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

// ═══ AUTENTICAÇÃO PRÓPRIA (S-045) — sem Clerk, sem senha ═══

/**
 * QUEM PODE ENTRAR (S-045). A plataforma é fechada: a tela de entrada está na
 * internet aberta, e sem esta porteira qualquer endereço do mundo pedia um
 * código, recebia e virava dono de uma conta nova.
 *
 * Três caminhos legítimos, e só eles:
 *  - "conhecida": a pessoa já existe em `users` (alguém já a colocou aqui);
 *  - "convite":   existe convite pendente e no prazo para este e-mail;
 *  - "fundador":  o banco não tem NENHUMA pessoa ainda e o e-mail é o que
 *                 `DONO_INICIAL` nomeia — é assim que uma instalação nova
 *                 ganha o primeiro acesso sem deixar a porta aberta.
 *
 * Devolve `null` quando nenhum caminho serve.
 */
export async function comoPodeEntrar(email: string): Promise<"conhecida" | "convite" | "fundador" | null> {
  const [pessoa] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (pessoa) return "conhecida";

  const [convite] = await db
    .select({ id: invites.id })
    .from(invites)
    .where(and(eq(invites.email, email), isNull(invites.acceptedAt), gte(invites.expiresAt, new Date())))
    .limit(1);
  if (convite) return "convite";

  const dono = normalizarEmail(process.env.DONO_INICIAL ?? "");
  if (dono && dono === email) {
    const [alguem] = await db.select({ id: users.id }).from(users).limit(1);
    if (!alguem) return "fundador";
  }

  return null;
}

/**
 * Convites pendentes deste e-mail viram vínculo. Idempotente: rodar de novo
 * não duplica nem rebaixa papel. Um convite vencido é ignorado, não apagado —
 * quem convidou ainda precisa ver que ele existiu.
 */
async function consumirConvites(userId: string, email: string) {
  const pendentes = await db
    .select()
    .from(invites)
    .where(and(eq(invites.email, email), isNull(invites.acceptedAt)));

  for (const convite of pendentes) {
    if (expirou(convite.expiresAt)) continue;
    await db
      .insert(memberships)
      .values({ orgId: convite.orgId, userId, role: convite.role })
      .onConflictDoUpdate({
        target: [memberships.orgId, memberships.userId],
        set: { role: convite.role },
      });
    await db.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, convite.id));
  }
}

/**
 * Passo 1: a pessoa pede um código. Sempre respondemos a mesma coisa, exista
 * a conta ou não — dizer "este e-mail não tem cadastro" entrega quem é cliente.
 *
 * Quem não pode entrar recebe a MESMA resposta, e nenhum e-mail. Não mandamos
 * aviso de "você não tem conta": isso transformaria a tela de entrada num
 * disparador de e-mail para qualquer endereço que alguém digitasse.
 */
export async function pedirCodigo(input: { email: string; enviarEmail?: EmailPort }) {
  const email = normalizarEmail(input.email);
  if (!emailValido(email)) throw new EntradaInvalida("e-mail inválido");

  // trava de força bruta: poucos pedidos por e-mail em janela curta
  const desde = new Date(Date.now() - 15 * 60_000);
  const recentes = await db
    .select({ id: loginCodes.id })
    .from(loginCodes)
    .where(and(eq(loginCodes.email, email), gte(loginCodes.createdAt, desde)));
  if (recentes.length >= 5) {
    throw new ErroDeDominio("muitos pedidos de código; tente de novo em alguns minutos", 429, "muitos_pedidos");
  }

  const email_ = input.enviarEmail ?? criarEmail();

  if (!(await comoPodeEntrar(email))) {
    // Fica no log do servidor, que é onde o operador procura "por que fulano
    // não recebeu o código". A resposta ao cliente não muda.
    console.info(`[auth] código negado para ${email}: sem cadastro e sem convite`);
    return { enviado: true, modo: email_.modo };
  }

  const { codigo, hash: codeHash } = novoCodigo();
  await db.insert(loginCodes).values({
    email,
    codeHash,
    expiresAt: expiraEm(CODIGO_MINUTOS),
  });

  const r = await email_.enviar({
    para: email,
    assunto: "Seu código de entrada no Metrik-OS",
    texto: textoDoCodigo(codigo, CODIGO_MINUTOS),
  });
  if (!r.ok) throw new ErroDeDominio("não consegui enviar o código agora", 503, "email_indisponivel");

  return { enviado: true, modo: email_.modo };
}

/**
 * Passo 2: o código vira sessão. O código é de uso único; errar queima
 * tentativas. Quem entra pela primeira vez ganha usuário — e, se não tiver
 * conta nenhuma, uma conta própria (é dono dela).
 */
export async function entrarComCodigo(input: { email: string; codigo: string; userAgent?: string }) {
  const email = normalizarEmail(input.email);
  const [registro] = await db
    .select()
    .from(loginCodes)
    .where(and(eq(loginCodes.email, email), isNull(loginCodes.usedAt)))
    .orderBy(desc(loginCodes.createdAt))
    .limit(1);

  // Mesma resposta para "não existe", "expirou" e "errado": não dá pistas.
  const recusa = () => new ErroDeDominio("código inválido ou expirado", 401, "codigo_invalido");
  if (!registro) throw recusa();
  if (expirou(registro.expiresAt)) throw recusa();
  if (registro.attempts >= CODIGO_TENTATIVAS) throw recusa();

  if (!iguais(hash(String(input.codigo ?? "")), registro.codeHash)) {
    await db
      .update(loginCodes)
      .set({ attempts: registro.attempts + 1 })
      .where(eq(loginCodes.id, registro.id));
    throw recusa();
  }

  await db.update(loginCodes).set({ usedAt: new Date() }).where(eq(loginCodes.id, registro.id));

  // Confere de novo quem pode entrar: o código sozinho não é autorização. Um
  // convite pode ter sido revogado ou expirado entre o pedido e a digitação.
  const via = await comoPodeEntrar(email);
  if (!via) throw new ErroDeDominio("este e-mail não tem acesso à plataforma", 403, "sem_acesso");

  let [pessoa] = await db.select().from(users).where(eq(users.email, email));
  if (!pessoa) {
    [pessoa] = await db.insert(users).values({ email }).returning();
  }
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, pessoa.id));

  // Convite pendente vira vínculo aqui: é o que permite alguém de fora entrar
  // pela primeira vez. Sem isto, convidado nenhum conseguiria abrir a conta —
  // aceitar convite exige estar dentro, e ele ainda está do lado de fora.
  await consumirConvites(pessoa.id, email);

  const vinculos = await db
    .select({ orgId: memberships.orgId })
    .from(memberships)
    .where(eq(memberships.userId, pessoa.id));

  let orgId = vinculos[0]?.orgId ?? null;
  if (!orgId) {
    // Conta nova só nasce para o fundador da instalação. Antes, qualquer
    // primeiro acesso criava uma — foi assim que a plataforma ficou aberta.
    const dono = normalizarEmail(process.env.DONO_INICIAL ?? "");
    if (via !== "fundador" && dono !== email) {
      throw new ErroDeDominio("você ainda não faz parte de nenhuma conta", 403, "sem_conta");
    }
    const [org] = await db.insert(organizations).values({ name: email.split("@")[0] }).returning();
    await db.insert(memberships).values({ orgId: org.id, userId: pessoa.id, role: "owner" });
    orgId = org.id;
  }

  const sessao = novoTokenOpaco();
  const csrf = novoTokenOpaco();
  await db.insert(sessions).values({
    userId: pessoa.id,
    tokenHash: sessao.hash,
    orgId,
    expiresAt: expiraEm(SESSAO_DIAS * 24 * 60),
    userAgent: input.userAgent?.slice(0, 300),
  });

  return { token: sessao.token, csrf: csrf.token, userId: pessoa.id, orgId };
}

/**
 * Resolve a sessão do cookie em contexto. É o coração do `resolveCtx`: a conta
 * e o papel saem do banco, nunca do navegador.
 */
export async function resolverSessao(token: string): Promise<(Ctx & { userId: string; email: string }) | null> {
  if (!token) return null;
  const [linha] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, hash(token)), isNull(sessions.revokedAt)));
  if (!linha || expirou(linha.expiresAt)) return null;

  const [pessoa] = await db.select().from(users).where(eq(users.id, linha.userId));
  if (!pessoa) return null;

  if (!linha.orgId) return null;
  const [vinculo] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.orgId, linha.orgId), eq(memberships.userId, pessoa.id)));
  // perdeu o acesso à conta desde o último uso → sessão não vale mais para ela
  if (!vinculo) return null;

  await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, linha.id));

  return {
    orgId: linha.orgId,
    actor: pessoa.email,
    role: vinculo.role,
    via: "sessao",
    userId: pessoa.id,
    email: pessoa.email,
  };
}

export async function sairDaSessao(token: string) {
  if (!token) return { ok: true };
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, hash(token)));
  return { ok: true };
}

/** Contas de que a pessoa participa — alimenta o seletor de contas. */
export async function contasDaPessoa(userId: string) {
  return db
    .select({ orgId: organizations.id, nome: organizations.name, role: memberships.role })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.orgId))
    .where(eq(memberships.userId, userId));
}

/** Troca a conta ativa da sessão, conferindo que a pessoa participa dela. */
export async function trocarConta(input: { token: string; userId: string; orgId: string }) {
  const [vinculo] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.orgId, input.orgId), eq(memberships.userId, input.userId)));
  if (!vinculo) throw new NaoEncontrado("conta");
  await db
    .update(sessions)
    .set({ orgId: input.orgId })
    .where(and(eq(sessions.tokenHash, hash(input.token)), isNull(sessions.revokedAt)));
  return { orgId: input.orgId, role: vinculo.role };
}

/** Convite: quem gerencia convida por e-mail; o aceite vincula à conta. */
export async function convidar(
  ctx: Ctx,
  input: { email: string; role?: "owner" | "admin" | "operator" | "viewer"; baseUrl?: string; enviarEmail?: EmailPort },
) {
  exigirPermissao(ctx, "gerenciar");
  const email = normalizarEmail(input.email);
  if (!emailValido(email)) throw new EntradaInvalida("e-mail inválido");

  const { token, hash: tokenHash } = novoTokenOpaco();
  const [convite] = await db
    .insert(invites)
    .values({
      orgId: ctx.orgId,
      email,
      role: input.role ?? "operator",
      tokenHash,
      invitedBy: ctx.actor,
      expiresAt: expiraEm(CONVITE_DIAS * 24 * 60),
    })
    .returning();

  const [org] = await db.select().from(organizations).where(eq(organizations.id, ctx.orgId));
  const link = `${input.baseUrl ?? ""}/convite?t=${token}`;
  const email_ = input.enviarEmail ?? criarEmail();
  await email_.enviar({
    para: email,
    assunto: `Convite para a conta ${org?.name ?? "Metrik-OS"}`,
    texto: textoDoConvite({ conta: org?.name ?? "Metrik-OS", quemConvidou: ctx.actor, link, dias: CONVITE_DIAS }),
  });

  await audit(ctx, "invite.create", convite.id, { email, role: convite.role });
  return { id: convite.id, email, role: convite.role };
}

/** Aceite do convite — precisa de sessão: a pessoa entra e então aceita. */
export async function aceitarConvite(input: { token: string; userId: string }) {
  const [convite] = await db
    .select()
    .from(invites)
    .where(and(eq(invites.tokenHash, hash(input.token)), isNull(invites.acceptedAt)));
  if (!convite || expirou(convite.expiresAt)) throw new ErroDeDominio("convite inválido ou expirado", 401, "convite_invalido");

  const [pessoa] = await db.select().from(users).where(eq(users.id, input.userId));
  if (!pessoa) throw new NaoEncontrado("usuário");
  // o convite é para um e-mail: quem aceita precisa ser aquela pessoa
  if (pessoa.email !== convite.email) {
    throw new ErroDeDominio("este convite é de outro e-mail", 403, "convite_de_outro");
  }

  await db
    .insert(memberships)
    .values({ orgId: convite.orgId, userId: pessoa.id, role: convite.role })
    .onConflictDoUpdate({
      target: [memberships.orgId, memberships.userId],
      set: { role: convite.role },
    });
  await db.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, convite.id));

  return { orgId: convite.orgId, role: convite.role };
}

/** Convites pendentes da conta. */
export function listarConvites(ctx: Ctx) {
  exigirPermissao(ctx, "gerenciar");
  return db
    .select({ id: invites.id, email: invites.email, role: invites.role, createdAt: invites.createdAt, expiresAt: invites.expiresAt })
    .from(invites)
    .where(and(eq(invites.orgId, ctx.orgId), isNull(invites.acceptedAt)))
    .orderBy(desc(invites.createdAt));
}
