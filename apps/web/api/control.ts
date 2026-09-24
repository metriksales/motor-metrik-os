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
  // O cofre (S-025) é sempre `admin`. Note que NÃO existe ação para LER o
  // segredo: ele sai em um único lugar, `usarCredencial`, que é interno e não
  // está no despacho. Um token de máquina comprometido não extrai credencial
  // de cliente — ele nem tem por onde pedir.
  credenciais: "admin",
  guardarCredencial: "admin",
  revogarCredencial: "admin",
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
    /**
     * TODA ação roda dentro da transação da conta (S-011). É aqui, e só aqui,
     * que o banco fica sabendo de quem é a query — `comConta` declara a conta
     * em `app.org_id`, que é o que as políticas de RLS leem.
     *
     * A resposta sai DEPOIS do commit, de propósito: com `res.json` dentro da
     * transação, um erro no commit chegaria tarde demais, com o cliente já
     * tendo lido 200 para uma escrita que não aconteceu.
     */
    const resultado = await control.comConta(ctx.orgId, async () => {
      switch (action) {
      case "criarToken":
        return await control.criarMachineToken(ctx, body);
      case "tokens":
        return await control.listarMachineTokens(ctx);
      case "revogarToken":
        return await control.revogarMachineToken(ctx, String(body.id ?? ""));
      case "agents":
        return await control.listAgents(ctx);
      case "getAgent":
        return await control.getAgent(ctx, String(req.query.agentId ?? ""));
      case "spec":
        return await control.loadPublishedSpec(ctx, String(req.query.agentId ?? ""));
      case "createAgent":
        return await control.createAgent(ctx, body);
      case "propor":
        return await control.proporMudanca(ctx, body);
      case "changesets":
        return await control.listChangeSets(ctx, String(req.query.agentId ?? ""));
      case "aprovar":
        return await control.aprovarMudanca(ctx, body.changeSetId);
      case "avaliar":
        return await control.avaliarMudanca(ctx, body.changeSetId);
      case "publicarMudanca":
        return await control.publicarMudanca(ctx, body.changeSetId);
      case "testar":
        return await control.testarConversa(ctx, { agentId: body.agentId, historico: body.historico ?? [], modo: body.modo, changeSetId: body.changeSetId });
      case "rodando":
        return await control.specRodando(ctx, String(req.query.agentId ?? ""));
      case "rodarTestes":
        return await control.rodarTestes(ctx, String(body.agentId ?? req.query.agentId ?? ""), body.modoTeste === "ensaio" ? "ensaio" : "ar", body.changeSetId);
      case "members":
        return await control.listMembers(ctx);
      case "setEstado":
        return await control.setAgentEstado(ctx, { agentId: body.agentId, estado: body.estado });
      case "assumirContato":
        return await control.assumirContato(ctx, { agentId: body.agentId, contato: body.contato });
      case "devolverContato":
        return await control.devolverContato(ctx, { agentId: body.agentId, contato: body.contato });
      case "assumidos":
        return await control.listAssumidos(ctx, req.query.agentId ? String(req.query.agentId) : undefined);
      case "publicar":
        return await control.publicar(ctx, body);
      case "releases":
        return await control.listReleases(ctx, String(req.query.agentId ?? ""));
      case "reverter":
        return await control.reverter(ctx, body);
      case "log":
        return await control.registrarLog(ctx, body);
      case "logs":
        return (
          await control.listLogs(
            ctx,
            req.query.agentId ? String(req.query.agentId) : undefined,
            lerLimite(req.query.limit)
          )
        );
      case "stats":
        return await control.statsHoje(ctx);
      case "pendencias":
        return await control.listPendencias(ctx);
      case "connections":
        return await control.listConnections(ctx);
      case "upsertConnection":
        return await control.upsertConnection(ctx, body);
      case "credenciais":
        return await control.listarCredenciais(ctx);
      case "guardarCredencial":
        return await control.guardarCredencial(ctx, body);
      case "revogarCredencial":
        return await control.revogarCredencial(ctx, String(body.id ?? ""));
      default:
        throw new control.EntradaInvalida("ação desconhecida");
      }
    });
    return res.json(resultado);
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
  "guardarCredencial", "revogarCredencial",
]);

function lerLimite(valor: unknown): number | undefined {
  if (valor === undefined) return undefined;
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(Math.floor(n), 200);
}
