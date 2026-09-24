// Inspeciona e religa contas — ferramenta de operação, não de aplicação.
//
// POR QUE ELA EXISTE
// A saída do Clerk (S-045) deixou um buraco de identidade. As linhas antigas de
// `memberships` guardam um `user_id` do Clerk (texto, tipo `user_2abc…`); a
// autenticação própria cria uma pessoa em `users` com um uuid novo. São
// identificadores de mundos diferentes, e nada os liga.
//
// Consequência: quem entra pela primeira vez não é encontrado em nenhuma conta,
// e `entrarComCodigo` cria uma conta vazia para a pessoa. Os agentes antigos
// continuam intactos na conta antiga — só que sem ninguém que consiga abri-la.
//
// Esta ferramenta mostra o estado real e religa uma pessoa a uma conta. Ela NÃO
// apaga nada: só lê e insere vínculo. É de linha de comando de propósito —
// religar conta é ato de operador, não rota de API.
//
//   node scripts/contas.mjs --ver
//   node scripts/contas.mjs --ligar <orgId> <email> [owner|admin|operator|viewer]
//
// DATABASE_URL vem do ambiente ou de packages/db/.env.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function urlDoBanco() {
  const doAmbiente =
    process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_DATABASE_URL;
  if (doAmbiente) return doAmbiente;
  for (const caminho of [`${raiz}/packages/db/.env`, `${raiz}/.env`, `${raiz}/.env.local`]) {
    try {
      const texto = readFileSync(caminho, "utf8");
      const achado = texto.match(/^\s*(?:DATABASE_URL|POSTGRES_URL)\s*=\s*["']?([^"'\r\n]+)/m);
      if (achado) return achado[1];
    } catch {
      /* arquivo não existe — segue */
    }
  }
  return "";
}

const url = urlDoBanco();
if (!url) {
  console.error(
    "falta DATABASE_URL.\n" +
      "Crie packages/db/.env com a linha DATABASE_URL=… (a mesma da Vercel/Neon),\n" +
      "ou rode com DATABASE_URL=… node scripts/contas.mjs --ver",
  );
  process.exit(1);
}

const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const cliente = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: true } });

/** Conta linhas de uma tabela por org, tolerando tabela que ainda não existe. */
async function contarPorOrg(tabela) {
  try {
    const r = await cliente.query(`select org_id, count(*)::int as n from "${tabela}" group by org_id`);
    return new Map(r.rows.map((l) => [l.org_id, l.n]));
  } catch {
    return new Map();
  }
}

async function ver() {
  const orgs = await cliente.query(
    `select id, name, clerk_org_id, plan, status, created_at from organizations order by created_at asc`,
  );
  const agentes = await contarPorOrg("agents");
  const conexoes = await contarPorOrg("connections");
  const mudancas = await contarPorOrg("change_sets");
  const auditoria = await contarPorOrg("audit_log");

  const vinculos = await cliente.query(`select org_id, user_id, role from memberships order by created_at asc`);
  const porOrg = new Map();
  for (const v of vinculos.rows) {
    if (!porOrg.has(v.org_id)) porOrg.set(v.org_id, []);
    porOrg.get(v.org_id).push(v);
  }

  let pessoas = { rows: [] };
  try {
    pessoas = await cliente.query(`select id, email, last_login_at from users order by created_at asc`);
  } catch {
    /* tabela nova pode não existir em banco velho */
  }
  const emailPorId = new Map(pessoas.rows.map((p) => [p.id, p.email]));

  console.log(`\n${orgs.rowCount} conta(s) no banco:\n`);
  for (const o of orgs.rows) {
    const n = (m) => m.get(o.id) ?? 0;
    const carga = n(agentes) + n(conexoes) + n(mudancas) + n(auditoria);
    console.log(`  ${carga > 0 ? "●" : "○"} ${o.name}`);
    console.log(`    id          ${o.id}`);
    console.log(`    criada em   ${new Date(o.created_at).toISOString().slice(0, 16).replace("T", " ")}`);
    console.log(`    origem      ${o.clerk_org_id ? `Clerk (${o.clerk_org_id})` : "criada pela entrada própria"}`);
    console.log(
      `    conteúdo    ${n(agentes)} agente(s) · ${n(conexoes)} conexão(ões) · ${n(mudancas)} mudança(s) · ${n(auditoria)} linha(s) de auditoria`,
    );
    const vs = porOrg.get(o.id) ?? [];
    if (vs.length === 0) {
      console.log(`    quem acessa NINGUÉM`);
    } else {
      for (const v of vs) {
        const quem = emailPorId.get(v.user_id);
        console.log(
          `    quem acessa ${v.role.padEnd(8)} ${quem ?? v.user_id}${quem ? "" : "   ← identidade do Clerk, morta: não abre mais a conta"}`,
        );
      }
    }
    console.log("");
  }

  const orfas = orgs.rows.filter((o) => {
    const vs = porOrg.get(o.id) ?? [];
    return vs.length > 0 && vs.every((v) => !emailPorId.has(v.user_id));
  });
  if (orfas.length > 0) {
    console.log("Contas sem nenhum acesso vivo (só vínculos do Clerk):");
    for (const o of orfas) console.log(`  node scripts/contas.mjs --ligar ${o.id} <seu-email> owner`);
    console.log("");
  }
}

async function ligar(orgId, email, papel = "owner") {
  const alvo = String(email ?? "").trim().toLowerCase();
  if (!alvo.includes("@")) throw new Error("informe um e-mail válido");
  if (!["owner", "admin", "operator", "viewer"].includes(papel)) {
    throw new Error("papel deve ser owner, admin, operator ou viewer");
  }

  const org = await cliente.query(`select id, name from organizations where id = $1`, [orgId]);
  if (org.rowCount === 0) throw new Error(`conta ${orgId} não existe`);

  let pessoa = await cliente.query(`select id from users where email = $1`, [alvo]);
  if (pessoa.rowCount === 0) {
    pessoa = await cliente.query(`insert into users (email) values ($1) returning id`, [alvo]);
    console.log(`pessoa ${alvo} criada`);
  }
  const userId = pessoa.rows[0].id;

  // idempotente: rodar duas vezes não duplica nem rebaixa sem querer
  await cliente.query(
    `insert into memberships (org_id, user_id, role) values ($1, $2, $3)
     on conflict (org_id, user_id) do update set role = excluded.role`,
    [orgId, userId, papel],
  );
  console.log(`✓ ${alvo} agora é ${papel} de "${org.rows[0].name}"`);
  console.log(`  Entre de novo (ou troque de conta no seletor) para a sessão enxergar.`);
}

const [comando, ...args] = process.argv.slice(2);
await cliente.connect();
try {
  if (comando === "--ligar") await ligar(args[0], args[1], args[2]);
  else await ver();
} catch (e) {
  console.error(`erro: ${e.message}`);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
