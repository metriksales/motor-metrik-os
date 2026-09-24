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
import { readFileSync } from "node:fs";
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

// CAPTURAR A SAÍDA, EM VEZ DE HERDAR.
//
// O `drizzle-kit` desenha um spinner que LIMPA A LINHA a cada quadro (ESC[2K
// ESC[1G). O log da Vercel guarda só o último estado dessa linha — então uma
// mensagem de erro seria apagada pelo próprio spinner, e o deploy falharia
// dizendo apenas "exited with 1".
const r = spawnSync("npm", ["run", "db:migrate", "--workspace", "@motor/db"], {
  cwd: raiz,
  shell: process.platform === "win32",
  encoding: "utf8",
  env: { ...process.env, DATABASE_URL: url },
});

/** Tira os códigos de terminal — inclusive os que apagam a linha. */
function semEnfeite(texto) {
  const ESC = String.fromCharCode(27);
  const codigos = new RegExp(`${ESC}\\[[0-9;?]*[A-Za-z]`, "g");
  return String(texto ?? "")
    .replace(codigos, "")
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * POR QUE ISTO EXISTE. O `drizzle-kit migrate` saiu com código 1 sem imprimir
 * nada — três quadros de spinner e silêncio, em dois deploys seguidos. Ficar
 * sem saber qual comando quebrou, num passo que derruba o deploy de propósito,
 * é pior que a falha em si.
 *
 * Então, quando ele falha, nós mesmos perguntamos ao banco: executamos os
 * comandos da migração pendente um a um dentro de uma transação que SEMPRE é
 * desfeita. Nada é aplicado aqui — só descobrimos onde dói.
 */
async function explicar(conexao) {
  console.error("");
  console.error("── perguntando direto ao banco ─────────────────────────");
  let cliente;
  try {
    const pg = (await import("pg")).default;
    cliente = new pg.Client({ connectionString: conexao });
    await cliente.connect();

    // COM QUEM ESTAMOS FALANDO. Quando a migração quebra logo no primeiro
    // comando por falta de permissão, a causa quase nunca é o SQL: é a
    // DATABASE_URL apontando para outro banco, ou para um papel sem direitos.
    // Sem esta linha, isso vira uma caça ao erro dentro do SQL — que está
    // certo o tempo todo.
    const quem = await cliente
      .query("select current_user as papel, current_database() as banco")
      .then((x) => x.rows[0])
      .catch(() => null);
    const hospedeiro = (() => {
      try {
        return new URL(conexao).host;
      } catch {
        return "(host ilegível)";
      }
    })();
    console.error(
      quem
        ? `conectado em ${hospedeiro} · banco "${quem.banco}" · papel "${quem.papel}"`
        : `conectado em ${hospedeiro} (não consegui nem me identificar)`,
    );

    const diario = JSON.parse(
      readFileSync(resolve(raiz, "packages/db/drizzle/meta/_journal.json"), "utf8"),
    );
    const jaAplicadas = await cliente
      .query("select count(*)::int as n from drizzle.__drizzle_migrations")
      .then((x) => x.rows[0].n)
      .catch(() => 0);

    console.error(`aplicadas: ${jaAplicadas} de ${diario.entries.length}`);
    const pendentes = diario.entries.slice(jaAplicadas);
    if (pendentes.length === 0) {
      console.error("nenhuma pendente — o problema não está no SQL das migrações.");
      return;
    }
    console.error(`pendentes: ${pendentes.map((e) => e.tag).join(", ")}`);

    const alvo = pendentes[0];
    const sql = readFileSync(resolve(raiz, `packages/db/drizzle/${alvo.tag}.sql`), "utf8");
    const comandos = sql
      .split("--> statement-breakpoint")
      .map((c) => c.trim())
      .filter(Boolean);
    console.error(`ensaiando ${alvo.tag} — ${comandos.length} comandos, tudo será desfeito…`);

    await cliente.query("BEGIN");
    for (let i = 0; i < comandos.length; i++) {
      try {
        await cliente.query(comandos[i]);
      } catch (e) {
        const semComentario = comandos[i]
          .split(/\r?\n/)
          .filter((l) => !l.trim().startsWith("--"))
          .join("\n")
          .trim();
        console.error("");
        console.error(`>>> QUEBROU no comando ${i + 1} de ${comandos.length}:`);
        console.error(semComentario.slice(0, 600));
        console.error("");
        console.error(`>>> o Postgres respondeu: ${e.message}`);
        if (e.code) console.error(`>>> código: ${e.code}`);
        if (e.hint) console.error(`>>> dica: ${e.hint}`);
        break;
      }
    }
    await cliente.query("ROLLBACK");
  } catch (e) {
    console.error(`não consegui perguntar ao banco: ${e.message}`);
  } finally {
    if (cliente) await cliente.end().catch(() => {});
  }
  console.error("────────────────────────────────────────────────────────");
}

if (r.status !== 0) {
  console.error("migrar: FALHOU — o deploy para aqui de propósito.");
  console.error("Publicar código novo sobre schema velho é como o login foi ao ar sem tabela.");
  console.error("");
  console.error("── o que o drizzle-kit disse ───────────────────────────");
  const saida = semEnfeite(r.stdout);
  const erro = semEnfeite(r.stderr);
  if (saida) console.error(saida);
  if (erro) console.error(erro);
  if (!saida && !erro) console.error("(nada)");
  if (r.error) console.error(`falha ao executar: ${r.error.message}`);
  console.error("────────────────────────────────────────────────────────");

  await explicar(url);
  process.exit(1);
}

const aplicado = semEnfeite(r.stdout);
if (aplicado) console.log(aplicado);
console.log("migrar: banco em dia.");
