// Aplica as migrações pendentes ANTES de publicar (S-045).
//
// Por que no build: sem isto, cada mudança de schema depende de alguém lembrar
// de rodar a migração à mão no banco de produção. Foi exatamente o que
// aconteceu em 24/09 — o login foi ao ar sem a tabela `login_codes`, e a tela
// respondia "erro interno" para quem tentava entrar.
//
// `drizzle-kit migrate` é idempotente: ele guarda no banco o que já aplicou.
// Sem DATABASE_URL (preview de branch, máquina de alguém), não faz nada.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const url =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_DATABASE_URL ||
  process.env.STORAGE_DATABASE_URL ||
  "";

if (!url) {
  console.log("migrar: sem DATABASE_URL — nada a aplicar (isto é o esperado fora de produção)");
  process.exit(0);
}

console.log("migrar: aplicando migrações pendentes…");
const r = spawnSync("npm", ["run", "db:migrate", "--workspace", "@motor/db"], {
  stdio: "inherit",
  cwd: raiz,
  shell: process.platform === "win32",
  env: { ...process.env, DATABASE_URL: url },
});

if (r.status !== 0) {
  console.error("migrar: FALHOU — o deploy para aqui de propósito.");
  console.error("Publicar código novo sobre schema velho é como o login foi ao ar sem tabela.");
  process.exit(1);
}

console.log("migrar: banco em dia.");
