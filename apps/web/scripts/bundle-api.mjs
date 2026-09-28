// Compila a CAMADA DE SERVIÇO (workspaces TS) num .mjs pronto pro runtime das
// serverless functions. Motivo: o Vercel deixa imports "@motor/*" externos e o
// main deles aponta pra .ts — Node em produção não carrega (ERR_MODULE_NOT_FOUND).
// Aqui o esbuild resolve os workspaces e INLINA tudo; só pacotes npm reais
// (drizzle, neon) ficam externos — esses o Vercel traça normal.
//
// UM PACOTE SÓ, DE PROPÓSITO. Já foram dois (control.mjs e runtime.mjs), e cada
// um carregava a própria cópia de `@motor/db` — dois contextos de conta, dois
// pools. O `comConta` de um não chegava ao `db` do outro, e sob o papel
// restrito o webhook parou de achar a spec do agente sem dizer nada. A entrada
// única (motor-entrada.ts) garante UMA cópia de tudo que tem estado.
import { build } from "esbuild";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const saida = resolve(aqui, "..", "api", "_bundled");
mkdirSync(saida, { recursive: true });

// Os artefatos antigos não podem sobrar no disco: um import esquecido de
// `control.mjs` voltaria a carregar uma segunda cópia do banco, em silêncio.
for (const velho of ["control.mjs", "runtime.mjs"]) {
  rmSync(resolve(saida, velho), { force: true });
}

await build({
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
  entryPoints: [{ in: resolve(aqui, "motor-entrada.ts"), out: "motor" }],
});

console.log("✓ api/_bundled/motor.mjs pronto (control + runtime, uma cópia do banco)");
