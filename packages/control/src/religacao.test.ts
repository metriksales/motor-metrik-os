/**
 * A migração 0008 religa as contas que a saída do Clerk deixou sem dono.
 *
 * Este teste lê o ARQUIVO da migração e o executa — não uma cópia do SQL, que
 * poderia divergir sem ninguém notar. Tudo roda dentro de uma transação que é
 * desfeita no fim, para não sujar o banco nem atrapalhar os outros testes.
 *
 * O que precisa ficar provado:
 *  - a conta cujo único vínculo é uma identidade morta do Clerk volta a ter dono;
 *  - a conta que já tem alguém vivo NÃO é tocada (nada de dar acesso de bandeja);
 *  - a religação fica registrada na auditoria.
 *
 * Pulado sem banco (a CI sempre roda).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const urlDeTeste = process.env.TEST_DATABASE_URL;
const temBanco = Boolean(urlDeTeste);

/** O e-mail está fixo na migração: é o dono da plataforma. */
const DONO = "contatosalesmetrik@gmail.com";

const sqlDaMigracao = readFileSync(
  fileURLToPath(new URL("../../db/drizzle/0008_religar_contas_orfas.sql", import.meta.url)),
  "utf8",
);

let cliente: pg.Client;

beforeAll(async () => {
  if (!temBanco) return;
  cliente = new pg.Client({ connectionString: urlDeTeste });
  await cliente.connect();
});

afterAll(async () => {
  if (cliente) await cliente.end();
});

describe.skipIf(!temBanco)("migração 0008 — religar contas órfãs", () => {
  test("devolve a conta abandonada ao dono, e só ela", async () => {
    const marca = `religa-${Date.now()}`;
    await cliente.query("BEGIN");
    try {
      // a pessoa que a autenticação própria criou (uuid novo)
      const pessoa = await cliente.query(
        `INSERT INTO users (email) VALUES ($1)
         ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
         RETURNING id`,
        [DONO],
      );
      const donoId: string = pessoa.rows[0].id;

      // conta antiga: o único vínculo aponta para um id do Clerk, que não
      // existe em `users` — ninguém consegue abrir
      const antiga = await cliente.query(`INSERT INTO organizations (name) VALUES ($1) RETURNING id`, [
        `${marca}-antiga`,
      ]);
      const antigaId: string = antiga.rows[0].id;
      await cliente.query(`INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, 'owner')`, [
        antigaId,
        `user_2clerk${marca}`,
      ]);

      // conta de outra pessoa, viva: não pode ser tocada
      const outraPessoa = await cliente.query(`INSERT INTO users (email) VALUES ($1) RETURNING id`, [
        `${marca}@metrik.test`,
      ]);
      const alheia = await cliente.query(`INSERT INTO organizations (name) VALUES ($1) RETURNING id`, [
        `${marca}-alheia`,
      ]);
      const alheiaId: string = alheia.rows[0].id;
      await cliente.query(`INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, 'owner')`, [
        alheiaId,
        outraPessoa.rows[0].id,
      ]);

      await cliente.query(sqlDaMigracao);

      const naAntiga = await cliente.query(`SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2`, [
        antigaId,
        donoId,
      ]);
      expect(naAntiga.rowCount).toBe(1);
      expect(naAntiga.rows[0].role).toBe("owner");

      const naAlheia = await cliente.query(`SELECT 1 FROM memberships WHERE org_id = $1 AND user_id = $2`, [
        alheiaId,
        donoId,
      ]);
      expect(naAlheia.rowCount).toBe(0);

      const auditoria = await cliente.query(
        `SELECT action, target FROM audit_log WHERE org_id = $1 AND action = 'conta.religada'`,
        [antigaId],
      );
      expect(auditoria.rowCount).toBe(1);
      expect(auditoria.rows[0].target).toBe(DONO);
    } finally {
      await cliente.query("ROLLBACK");
    }
  });

  test("rodar de novo não duplica vínculo", async () => {
    const marca = `duplica-${Date.now()}`;
    await cliente.query("BEGIN");
    try {
      await cliente.query(
        `INSERT INTO users (email) VALUES ($1)
         ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email`,
        [DONO],
      );
      const org = await cliente.query(`INSERT INTO organizations (name) VALUES ($1) RETURNING id`, [marca]);
      await cliente.query(`INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, 'owner')`, [
        org.rows[0].id,
        `user_2clerk${marca}`,
      ]);

      await cliente.query(sqlDaMigracao);
      await cliente.query(sqlDaMigracao);

      const vinculos = await cliente.query(
        `SELECT COUNT(*)::int AS n FROM memberships m
         JOIN users u ON u.id::text = m.user_id
         WHERE m.org_id = $1 AND u.email = $2`,
        [org.rows[0].id, DONO],
      );
      expect(vinculos.rows[0].n).toBe(1);
    } finally {
      await cliente.query("ROLLBACK");
    }
  });
});
