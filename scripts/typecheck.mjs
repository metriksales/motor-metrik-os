// Typecheck de TODOS os projetos do monorepo — a verdade é `tsc --noEmit` por
// projeto (o build do front não typa os pacotes). Roda tudo e só falha no fim,
// para uma rodada mostrar todos os erros, não só o primeiro.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const projetos = [
  "packages/core",
  "packages/db", // define o schema: se ele não typa, nada abaixo vale
  "packages/crm",
  "packages/llm",
  "packages/messaging",
  "packages/motors",
  "packages/evals",
  "packages/samples",
  "packages/control",
  "apps/runtime",
  "apps/web", // front (src)
  "apps/web/api", // funções serverless
];

// Projetos com tsconfig de nome próprio (vite.config, server/, tests/, scripts/)
const avulsos = [["apps/web", "tsconfig.node.json"]];

const tsc = resolve(raiz, "node_modules", "typescript", "bin", "tsc");
let falhou = false;

const alvos = [
  ...projetos.map((p) => [p, "tsconfig.json"]),
  ...avulsos,
];

for (const [projeto, arquivo] of alvos) {
  const config = resolve(raiz, projeto, arquivo);
  if (!existsSync(config)) {
    console.error(`✗ ${projeto}/${arquivo} — não existe`);
    falhou = true;
    continue;
  }
  const r = spawnSync(process.execPath, [tsc, "-p", config, "--noEmit"], {
    stdio: "inherit",
    cwd: raiz,
  });
  if (r.status === 0) {
    console.log(`✓ ${projeto}/${arquivo}`);
  } else {
    console.error(`✗ ${projeto}/${arquivo}`);
    falhou = true;
  }
}

process.exit(falhou ? 1 : 0);
