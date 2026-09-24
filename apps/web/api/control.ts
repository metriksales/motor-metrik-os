import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
// bundle pré-compilado (scripts/bundle-api.mjs) — em runtime o Node não carrega
// os workspaces .ts; o esbuild inlina tudo neste .mjs no build.
import * as control from "./_bundled/control.mjs";
import { resolveCtx } from "./_auth.js";

/** ação → escopo mínimo de um token de máquina. O que não estiver aqui exige `admin`. */
const ESCOPO_POR_ACAO: Record<string, "log" | "leitura" | "mudanca" | "admin"> = {
  // ingestão do Flight Recorder: é para isso que existe o escopo mais estreito
  log: "log",
  // leitura
  agents: "leitura",
  getAgent: "leitura",
  spec: "leitura",
  changesets: "leitura",
  rodando: "leitura",
  members: "leitura",
  assumidos: "leitura",
  releases: "leitura",
  logs: "leitura",
  stats: "leitura",
  pendencias: "leitura",
  connections: "leitura",
  tokens: "leitura",
  // propõe e testa, mas não publica
  createAgent: "mudanca",
  propor: "mudanca",
  avaliar: "mudanca",
  testar: "mudanca",
  rodarTestes: "mudanca",
  setEstado: "mudanca",
  assumirContato: "mudanca",
  devolverContato: "mudanca",
  // publica, reverte, mexe em conexão e em token → só `admin`
  aprovar: "admin",
  publicarMudanca: "admin",
  publicar: "admin",
  reverter: "admin",
  upsertConnection: "admin",
  criarToken: "admin",
  revogarToken: "admin",
};

// Porta ÚNICA de mudança: front, Claude Code, Codex e API batem AQUI.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Id de correlação: vai no cabeçalho da resposta e no log do erro, para dar
  // para ligar "deu erro na tela" a uma linha de log (S-006/S-012).
  const requestId = randomUUID();
  res.setHeader("x-request-id", requestId);

  // guard do banco ANTES da auth: sem Neon, o fluxo Clerk (que provisiona org
  // no banco) responderia 401/500 confuso em vez deste 503 claro.
  if (!control.getDatabaseUrl()) {
    return res.status(503).json({ error: "banco não configurado — falta DATABASE_URL (Neon)" });
  }
  let ctx;
  try {
    ctx = await resolveCtx(req);
  } catch (e) {
    // erro da PONTE org↔banco (não é token inválido): detalhe no log, não no corpo.
    console.error(`[auth] ponte de organização falhou (req ${requestId}):`, e);
    return res.status(500).json({ error: "falha ao resolver a conta", requestId });
  }
  if (!ctx) return res.status(401).json({ error: "não autorizado" });

  const action = String(req.query.action ?? "");

  if (SOMENTE_POST.has(action) && req.method !== "POST") {
    return res.status(405).json({ error: "esta ação exige POST" });
  }

  // Escopo exigido por ação. Vale para TOKEN DE MÁQUINA (S-003): um token de
  // ingestão (escopo `log`) não alcança leitura, mudança nem publicação.
  // Sessão de pessoa não passa por aqui — quem manda nela é o papel.
  if (ctx.via === "maquina") {
    const exigido = ESCOPO_POR_ACAO[action] ?? "admin";
    if (!control.escopoPermite(ctx.scopes ?? [], exigido)) {
      return res.status(403).json({ error: `token sem escopo "${exigido}" para esta ação` });
    }
  }

  const body = (req.body ?? {}) as any;
  try {
    switch (action) {
      case "criarToken":
        return res.json(await control.criarMachineToken(ctx, body));
      case "tokens":
        return res.json(await control.listarMachineTokens(ctx));
      case "revogarToken":
        return res.json(await control.revogarMachineToken(ctx, String(body.id ?? "")));
      case "agents":
        return res.json(await control.listAgents(ctx));
      case "getAgent":
        return res.json(await control.getAgent(ctx, String(req.query.agentId ?? "")));
      case "spec":
        return res.json(await control.loadPublishedSpec(ctx, String(req.query.agentId ?? "")));
      case "createAgent":
        return res.json(await control.createAgent(ctx, body));
      case "propor":
        return res.json(await control.proporMudanca(ctx, body));
      case "changesets":
        return res.json(await control.listChangeSets(ctx, String(req.query.agentId ?? "")));
      case "aprovar":
        return res.json(await control.aprovarMudanca(ctx, body.changeSetId));
      case "avaliar":
        return res.json(await control.avaliarMudanca(ctx, body.changeSetId));
      case "publicarMudanca":
        return res.json(await control.publicarMudanca(ctx, body.changeSetId));
      case "testar":
        return res.json(await control.testarConversa(ctx, { agentId: body.agentId, historico: body.historico ?? [], modo: body.modo, changeSetId: body.changeSetId }));
      case "rodando":
        return res.json(await control.specRodando(ctx, String(req.query.agentId ?? "")));
      case "rodarTestes":
        return res.json(await control.rodarTestes(ctx, String(body.agentId ?? req.query.agentId ?? ""), body.modoTeste === "ensaio" ? "ensaio" : "ar", body.changeSetId));
      case "members":
        return res.json(await control.listMembers(ctx));
      case "setEstado":
        return res.json(await control.setAgentEstado(ctx, { agentId: body.agentId, estado: body.estado }));
      case "assumirContato":
        return res.json(await control.assumirContato(ctx, { agentId: body.agentId, contato: body.contato }));
      case "devolverContato":
        return res.json(await control.devolverContato(ctx, { agentId: body.agentId, contato: body.contato }));
      case "assumidos":
        return res.json(await control.listAssumidos(ctx, req.query.agentId ? String(req.query.agentId) : undefined));
      case "publicar":
        return res.json(await control.publicar(ctx, body));
      case "releases":
        return res.json(await control.listReleases(ctx, String(req.query.agentId ?? "")));
      case "reverter":
        return res.json(await control.reverter(ctx, body));
      case "log":
        return res.json(await control.registrarLog(ctx, body));
      case "logs":
        return res.json(
          await control.listLogs(
            ctx,
            req.query.agentId ? String(req.query.agentId) : undefined,
            lerLimite(req.query.limit)
          )
        );
      case "stats":
        return res.json(await control.statsHoje(ctx));
      case "pendencias":
        return res.json(await control.listPendencias(ctx));
      case "connections":
        return res.json(await control.listConnections(ctx));
      case "upsertConnection":
        return res.json(await control.upsertConnection(ctx, body));
      default:
        return res.status(400).json({ error: "ação desconhecida" });
    }
  } catch (e) {
    // Erro de domínio vira 4xx com a mensagem que a pessoa precisa ler.
    if (control.ehErroDeDominio(e)) {
      return res.status(e.status).json({ error: e.message, codigo: e.codigo });
    }
    // Qualquer outra coisa é falha nossa: o detalhe fica no log do servidor com
    // o id da requisição; o cliente recebe mensagem genérica. Antes, o erro do
    // drizzle voltava no corpo — e ele carrega o SQL e os parâmetros.
    console.error(`[control] ${action} falhou (req ${requestId}):`, e);
    return res.status(500).json({ error: "erro interno", requestId });
  }
}

/** Ações que mudam estado: só por POST (GET é para leitura). */
const SOMENTE_POST = new Set([
  "createAgent", "propor", "aprovar", "avaliar", "publicarMudanca", "publicar", "reverter",
  "setEstado", "assumirContato", "devolverContato", "upsertConnection", "log",
  "criarToken", "revogarToken", "testar", "rodarTestes",
]);

function lerLimite(valor: unknown): number | undefined {
  if (valor === undefined) return undefined;
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(Math.floor(n), 200);
}
