import { defineConfig, loadEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Dev-only: serve /api/control local chamando @motor/control direto (stack
// completo no `npm run dev`, sem precisar de `vercel dev`). NÃO afeta o build de
// produção (apply:"serve" → só roda no dev server).
// Auth em dev: com Authorization Bearer + CLERK_SECRET_KEY no .env.local, roda o
// MESMO caminho de produção (verifyToken → ensureOrgForClerk) — o primeiro login
// vira testável ANTES do Vercel. Sem Bearer, atalho x-org-id como sempre.
function localControlApi(clerkSecretKey: string | undefined): PluginOption {
  return {
    name: "local-control-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/control", async (req, res) => {
        const send = (code: number, body: unknown) => {
          res.statusCode = code;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(body));
        };
        try {
          const control = (await server.ssrLoadModule("@motor/control")) as Record<string, any>;
          const url = new URL(req.url ?? "", "http://localhost");
          const action = url.searchParams.get("action") ?? "";

          let ctx: { orgId: string; actor: string; role: "admin" };
          const authHeader = String(req.headers["authorization"] ?? "");
          if (authHeader.startsWith("Bearer ") && clerkSecretKey) {
            // caminho REAL do primeiro login (idêntico ao api/_auth.ts de prod)
            const { verifyToken } = await import("@clerk/backend");
            const claims = (await verifyToken(authHeader.slice(7), { secretKey: clerkSecretKey })) as Record<string, any>;
            const clerkOrgId = claims.org_id ?? claims.o?.id;
            if (!clerkOrgId) return send(401, { error: "sessão Clerk sem organização ativa (dev)" });
            const rawName = claims.org_slug ?? claims.o?.slg ?? claims.org_name;
            const mapped = await control.ensureOrgForClerk({
              clerkOrgId: String(clerkOrgId),
              clerkUserId: String(claims.sub ?? "user"),
              name: typeof rawName === "string" ? rawName : undefined,
              role: "owner",
            });
            ctx = { orgId: mapped.orgId, actor: String(claims.sub ?? "user"), role: "admin" };
          } else {
            const orgId = String(req.headers["x-org-id"] ?? "");
            if (!orgId) return send(401, { error: "sem x-org-id (dev)" });
            ctx = { orgId, actor: "dev", role: "admin" };
          }

          let body: any = {};
          if (req.method === "POST") {
            const chunks: Buffer[] = [];
            for await (const c of req) chunks.push(c as Buffer);
            body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
          }

          switch (action) {
            case "agents":
              return send(200, await control.listAgents(ctx));
            case "getAgent":
              return send(200, await control.getAgent(ctx, url.searchParams.get("agentId") ?? ""));
            case "spec":
              return send(200, await control.loadPublishedSpec(ctx, url.searchParams.get("agentId") ?? ""));
            case "createAgent":
              return send(200, await control.createAgent(ctx, body));
            case "logs":
              return send(
                200,
                await control.listLogs(
                  ctx,
                  url.searchParams.get("agentId") ?? undefined,
                  url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined
                )
              );
            case "stats":
              return send(200, await control.statsHoje(ctx));
            case "pendencias":
              return send(200, await control.listPendencias(ctx));
            case "log":
              return send(200, await control.registrarLog(ctx, body));
            case "propor":
              return send(200, await control.proporMudanca(ctx, body));
            case "changesets":
              return send(200, await control.listChangeSets(ctx, url.searchParams.get("agentId") ?? ""));
            case "aprovar":
              return send(200, await control.aprovarMudanca(ctx, body.changeSetId));
            case "avaliar":
              return send(200, await control.avaliarMudanca(ctx, body.changeSetId));
            case "publicarMudanca":
              return send(200, await control.publicarMudanca(ctx, body.changeSetId));
            case "testar":
              return send(200, await control.testarConversa(ctx, { agentId: body.agentId, historico: body.historico ?? [], modo: body.modo, changeSetId: body.changeSetId }));
            case "rodando":
              return send(200, await control.specRodando(ctx, url.searchParams.get("agentId") ?? ""));
            case "rodarTestes":
              return send(200, await control.rodarTestes(ctx, String(body.agentId ?? url.searchParams.get("agentId") ?? ""), body.modoTeste === "ensaio" ? "ensaio" : "ar", body.changeSetId));
            case "members":
              return send(200, await control.listMembers(ctx));
            case "setEstado":
              return send(200, await control.setAgentEstado(ctx, { agentId: body.agentId, estado: body.estado }));
            case "assumirContato":
              return send(200, await control.assumirContato(ctx, { agentId: body.agentId, contato: body.contato }));
            case "devolverContato":
              return send(200, await control.devolverContato(ctx, { agentId: body.agentId, contato: body.contato }));
            case "assumidos":
              return send(200, await control.listAssumidos(ctx, url.searchParams.get("agentId") ?? undefined));
            default:
              return send(400, { error: `ação '${action}' não suportada no dev middleware` });
          }
        } catch (e: any) {
          send(500, { error: e?.message ?? "erro no dev middleware" });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // .env/.env.local inteiros (sem filtro VITE_) — o middleware dev precisa de
  // CLERK_SECRET_KEY e DATABASE_URL, que nunca vão pro bundle do browser.
  const env = loadEnv(mode, process.cwd(), "");
  for (const k of ["CLERK_SECRET_KEY", "DATABASE_URL"]) {
    if (env[k] && !process.env[k]) process.env[k] = env[k];
  }
  // Trava de segurança (S-003): segredo NUNCA vai pro bundle. Qualquer VITE_*
  // com cara de token derruba o build antes de publicar.
  const proibidas = Object.keys(env).filter(
    (k) => k.startsWith("VITE_") && /TOKEN|SECRET|KEY|PASSWORD|SENHA/i.test(k) && k !== "VITE_CLERK_PUBLISHABLE_KEY",
  );
  if (proibidas.length > 0) {
    throw new Error(
      `variável de ambiente com segredo exposta ao browser: ${proibidas.join(", ")}. ` +
        "Tudo com prefixo VITE_ é embutido no JavaScript público — use uma env de servidor.",
    );
  }

  // Aviso alto no build de produção sem login (S-007). Não derruba o build de
  // propósito: a chave pode não estar configurada no projeto da Vercel, e
  // quebrar o deploy às cegas seria pior. Quando ela estiver confirmada lá,
  // troque este aviso por um `throw` — a tela já recusa abrir em demo.
  if (mode === "production" && !env.VITE_CLERK_PUBLISHABLE_KEY && env.VITE_ALLOW_DEMO !== "1") {
    console.warn(
      "\n⚠️  build de produção SEM VITE_CLERK_PUBLISHABLE_KEY.\n" +
        "   O app vai recusar abrir (tela \"login não configurado\") em vez de mostrar a maquete.\n" +
        "   Configure a chave, ou publique a vitrine de propósito com VITE_ALLOW_DEMO=1.\n",
    );
  }

  return {
    plugins: [react(), localControlApi(env.CLERK_SECRET_KEY)],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    // localhost de propósito: o middleware de dev é uma porta admin sem sessão;
    // com host:true ele ficava exposto na rede local (achado M8 da auditoria).
    server: { port: 5175, host: "localhost" },
  };
});
