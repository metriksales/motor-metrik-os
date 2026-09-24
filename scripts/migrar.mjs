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

// SÓ A PRODUÇÃO MIGRA. Um build de preview roda o código de uma branch
// qualquer, mas a DATABASE_URL da Vercel aponta para o MESMO banco: sem esta
// trava, uma migração meio pronta chega ao banco real antes de qualquer
// revisão — e chega ANTES do deploy de produção, porque o preview sai primeiro.
// Fora da Vercel não existe VERCEL_ENV e seguimos em frente: é na CI, contra o
// Postgres de teste, que a migração precisa ser exercitada.
const ambiente = process.env.VERCEL_ENV;
if (ambiente && ambiente !== "production") {
  console.log(`migrar: ambiente "${ambiente}" — não migro daqui, o banco é o mesmo da produção.`);
  process.exit(0);
}

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
