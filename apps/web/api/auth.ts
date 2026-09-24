import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as control from "./_bundled/control.mjs";

// Autenticação própria (S-045). Sem senha: pede código → entra → cookie.
//
// POST /api/auth?acao=pedirCodigo   { email }
// POST /api/auth?acao=entrar        { email, codigo }
// POST /api/auth?acao=sair
// GET  /api/auth?acao=eu
// GET  /api/auth?acao=contas
// POST /api/auth?acao=trocarConta   { orgId }
// POST /api/auth?acao=aceitarConvite { token }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = randomUUID();
  res.setHeader("x-request-id", requestId);

  if (!control.getDatabaseUrl()) {
    return res.status(503).json({ error: "banco não configurado" });
  }

  const acao = String(req.query.acao ?? "");
  const body = (req.body ?? {}) as Record<string, unknown>;
  const cookies = control.lerCookies(req.headers.cookie);
  const tokenSessao = cookies[control.COOKIE_SESSAO] ?? "";
  // produção sempre com Secure; em http://localhost o cookie não pegaria
  const segura = (req.headers["x-forwarded-proto"] ?? "https") !== "http";

  // Pedido que muda estado: confere origem e o par cookie/header de CSRF.
  const mutacao = req.method === "POST";
  if (mutacao) {
    if (!control.origemConfere({ origin: req.headers.origin, host: req.headers.host })) {
      return res.status(403).json({ error: "origem não confere" });
    }
    // as duas primeiras ações acontecem ANTES de existir sessão/CSRF
    const precisaCsrf = acao !== "pedirCodigo" && acao !== "entrar";
    if (
      precisaCsrf &&
      !control.csrfValido({
        metodo: req.method ?? "",
        cookie: cookies[control.COOKIE_CSRF],
        header: req.headers[control.HEADER_CSRF],
      })
    ) {
      return res.status(403).json({ error: "token de CSRF ausente ou inválido" });
    }
  }

  // CONTEXTO DE CONTA (S-011), e onde ele legitimamente não existe.
  //
  // `pedirCodigo` e `entrar` acontecem ANTES de haver qualquer autenticado: a
  // busca é por e-mail e por hash de código, e não há conta nem pessoa a
  // declarar. É limite real, não atalho — e por isso essas duas só tocam
  // tabelas de identidade (`users`, `login_codes`), que não têm `org_id`.
  //
  // O resto já sabe quem é, e declara: ver `comPessoa` abaixo.
  try {
    switch (acao) {
      case "pedirCodigo": {
        if (!mutacao) return res.status(405).json({ error: "use POST" });
        const r = await control.pedirCodigo({ email: String(body.email ?? "") });
        // a resposta NÃO diz se o e-mail existe — só que, se existir, chegou
        return res.json({ enviado: true, modoSeco: r.modo === "seco" });
      }

      case "entrar": {
        if (!mutacao) return res.status(405).json({ error: "use POST" });
        const r = await control.entrarComCodigo({
          email: String(body.email ?? ""),
          codigo: String(body.codigo ?? ""),
          userAgent: String(req.headers["user-agent"] ?? ""),
        });
        res.setHeader("Set-Cookie", [
          control.cookieDeSessao(r.token, { segura }),
          control.cookieDeCsrf(r.csrf, { segura }),
        ]);
        return res.json({ ok: true, orgId: r.orgId });
      }

      case "sair": {
        if (!mutacao) return res.status(405).json({ error: "use POST" });
        await control.sairDaSessao(tokenSessao);
        res.setHeader("Set-Cookie", control.cookiesDeSaida({ segura }));
        return res.json({ ok: true });
      }

      case "eu": {
        const ctx = await control.resolverSessao(tokenSessao);
        if (!ctx) return res.status(401).json({ error: "não autorizado" });
        return res.json({ email: ctx.email, orgId: ctx.orgId, role: ctx.role, userId: ctx.userId });
      }

      case "contas": {
        const ctx = await control.resolverSessao(tokenSessao);
        if (!ctx) return res.status(401).json({ error: "não autorizado" });
        // trabalho da PESSOA, que atravessa contas: é por isso que o contexto
        // tem `app.user_id` além de `app.org_id` (S-011)
        return res.json(await control.comPessoa(ctx.userId, () => control.contasDaPessoa(ctx.userId)));
      }

      case "trocarConta": {
        if (!mutacao) return res.status(405).json({ error: "use POST" });
        const ctx = await control.resolverSessao(tokenSessao);
        if (!ctx) return res.status(401).json({ error: "não autorizado" });
        const r = await control.comPessoa(ctx.userId, () =>
          control.trocarConta({
            token: tokenSessao,
            userId: ctx.userId,
            orgId: String(body.orgId ?? ""),
          }),
        );
        return res.json(r);
      }

      case "aceitarConvite": {
        if (!mutacao) return res.status(405).json({ error: "use POST" });
        const ctx = await control.resolverSessao(tokenSessao);
        if (!ctx) return res.status(401).json({ error: "entre primeiro para aceitar o convite" });
        const r = await control.comPessoa(ctx.userId, () =>
          control.aceitarConvite({ token: String(body.token ?? ""), userId: ctx.userId }),
        );
        return res.json(r);
      }

      default:
        return res.status(400).json({ error: "ação desconhecida" });
    }
  } catch (e) {
    if (control.ehErroDeDominio(e)) {
      return res.status(e.status).json({ error: e.message, codigo: e.codigo });
    }
    console.error(`[auth] ${acao} falhou (req ${requestId}):`, e);
    return res.status(500).json({ error: "erro interno", requestId });
  }
}
