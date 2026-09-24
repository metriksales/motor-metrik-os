// Compila a CAMADA DE SERVIÇO (workspaces TS) em .mjs prontos pro runtime das
// serverless functions. Motivo: o Vercel deixa imports "@motor/*" externos e o
// main deles aponta pra .ts — Node em produção não carrega (ERR_MODULE_NOT_FOUND).
// Aqui o esbuild resolve os workspaces e INLINA tudo; só pacotes npm reais
// (drizzle, neon) ficam externos — esses o Vercel traça normal.
import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, "..", "..", "..");
const saida = resolve(aqui, "..", "api", "_bundled");
mkdirSync(saida, { recursive: true });

const comum = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outdir: saida,
  outExtension: { ".js": ".mjs" },
  // npm de verdade fica externo (o trace do Vercel os leva como JS normal)
  // `pg` é externo de propósito: só o caminho de TESTE (DB_DRIVER=pg) o usa.
  external: ["@neondatabase/serverless", "drizzle-orm", "pg"],
  logLevel: "warning",
};

await build({
  ...comum,
  entryPoints: [
    { in: resolve(raiz, "packages", "control", "src", "index.ts"), out: "control" },
    { in: resolve(raiz, "apps", "runtime", "src", "index.ts"), out: "runtime" },
  ],
});

console.log("✓ api/_bundled: control.mjs + runtime.mjs prontos");
