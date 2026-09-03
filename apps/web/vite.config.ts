import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";

// Dev-only: serve /api/control local chamando @motor/control direto (stack
// completo no `npm run dev`, sem precisar de `vercel dev`). NÃO afeta o build de
// produção (apply:"serve" → só roda no dev server). Autentica por x-org-id (dev).
function localControlApi(): PluginOption {
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
          const orgId = String(req.headers["x-org-id"] ?? "");
          if (!orgId) return send(401, { error: "sem x-org-id (dev)" });
          const ctx = { orgId, actor: "dev", role: "admin" as const };

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

export default defineConfig({
  plugins: [react(), localControlApi()],
  server: { port: 5175, host: true },
});
