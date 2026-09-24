/**
 * As invariantes da S-010, exercitadas contra um Postgres DE VERDADE.
 *
 * Restrição que ninguém tenta violar não é restrição: é comentário. Cada teste
 * aqui tenta fazer exatamente a coisa errada e exige que o BANCO recuse — não
 * o código de aplicação, que é justamente o que já falhou na auditoria.
 *
 * Tudo roda em transação desfeita no fim, para não sujar o banco compartilhado.
 * Pulado sem banco (a CI sempre roda).
 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const urlDeTeste = process.env.TEST_DATABASE_URL;
const temBanco = Boolean(urlDeTeste);

let cliente: pg.Client;

beforeAll(async () => {
  if (!temBanco) return;
  cliente = new pg.Client({ connectionString: urlDeTeste });
  await cliente.connect();
});

afterAll(async () => {
  if (cliente) await cliente.end();
});

/** Roda o corpo numa transação que SEMPRE volta atrás. */
async function emTransacao(corpo: () => Promise<void>) {
  await cliente.query("BEGIN");
  try {
    await corpo();
  } finally {
    await cliente.query("ROLLBACK");
  }
}

/**
 * Espera que o banco recuse — e devolve a transação ao estado usável.
 *
 * No Postgres, um comando que falha aborta a transação inteira: sem o
 * savepoint, o comando SEGUINTE morreria com "current transaction is aborted"
 * e o teste passaria pelo motivo errado, mascarando a invariante que ele
 * deveria estar provando.
 */
async function deveRecusar(motivo: RegExp, tentativa: () => Promise<unknown>) {
  await cliente.query("SAVEPOINT tentativa");
  await expect(tentativa()).rejects.toThrow(motivo);
  await cliente.query("ROLLBACK TO SAVEPOINT tentativa");
}

/** Uma conta com um agente dentro, para pendurar as linhas do teste. */
async function cenario() {
  const org = await cliente.query(`INSERT INTO organizations (name) VALUES ($1) RETURNING id`, [
    `integridade-${Date.now()}-${Math.random()}`,
  ]);
  const orgId: string = org.rows[0].id;
  const agente = await cliente.query(
    `INSERT INTO agents (org_id, name, tipo) VALUES ($1, 'Agente', 'resposta') RETURNING id`,
    [orgId],
  );
  return { orgId, agentId: agente.rows[0].id as string };
}

describe.skipIf(!temBanco)("chaves estrangeiras de conta", () => {
  test("não se cria linha para conta que não existe", async () => {
    await emTransacao(async () => {
      const { agentId } = await cenario();
      await deveRecusar(/violates foreign key constraint/, () =>
        cliente.query(
          `INSERT INTO runtime_logs (org_id, agent_id, ok, resumo) VALUES ($1, $2, true, 'teste')`,
          [randomUUID(), agentId],
        ),
      );
    });
  });

  test("não se registra auditoria para conta que não existe", async () => {
    await emTransacao(async () => {
      await deveRecusar(/violates foreign key constraint/, () =>
        cliente.query(`INSERT INTO audit_log (org_id, action) VALUES ($1, 'teste')`, [randomUUID()]),
      );
    });
  });

  test("auditoria sem conta continua valendo — nem todo evento tem dono", async () => {
    await emTransacao(async () => {
      const r = await cliente.query(
        `INSERT INTO audit_log (org_id, action) VALUES (NULL, 'evento.de.plataforma') RETURNING id`,
      );
      expect(r.rowCount).toBe(1);
    });
  });
});

describe.skipIf(!temBanco)("índices únicos", () => {
  test("a mesma versão de spec não é publicada duas vezes", async () => {
    await emTransacao(async () => {
      const { orgId, agentId } = await cenario();
      const publicar = () =>
        cliente.query(
          `INSERT INTO releases (org_id, agent_id, spec_version, runtime_version) VALUES ($1, $2, 3, 'v1')`,
          [orgId, agentId],
        );

      await publicar();
      await deveRecusar(/duplicate key value|releases_agent_spec/, publicar);
    });
  });

  test("duas conexões do mesmo CRM na mesma conta são recusadas", async () => {
    await emTransacao(async () => {
      const { orgId } = await cenario();
      const conectar = () =>
        cliente.query(`INSERT INTO connections (org_id, kind) VALUES ($1, 'kommo')`, [orgId]);

      await conectar();
      await deveRecusar(/duplicate key value|connections_org_kind/, conectar);
    });
  });

  test("mas dois números de WhatsApp na mesma conta passam", async () => {
    await emTransacao(async () => {
      const { orgId } = await cenario();
      await cliente.query(`INSERT INTO connections (org_id, kind) VALUES ($1, 'whatsapp')`, [orgId]);
      const segundo = await cliente.query(
        `INSERT INTO connections (org_id, kind) VALUES ($1, 'whatsapp') RETURNING id`,
        [orgId],
      );
      expect(segundo.rowCount).toBe(1);
    });
  });
});

describe.skipIf(!temBanco)("livro-razão append-only", () => {
  test("release publicado não se altera", async () => {
    await emTransacao(async () => {
      const { orgId, agentId } = await cenario();
      const r = await cliente.query(
        `INSERT INTO releases (org_id, agent_id, spec_version, runtime_version)
         VALUES ($1, $2, 1, 'v1') RETURNING id`,
        [orgId, agentId],
      );

      await deveRecusar(/livro-razão/, () =>
        cliente.query(`UPDATE releases SET runtime_version = 'v2' WHERE id = $1`, [r.rows[0].id]),
      );
    });
  });

  test("linha de auditoria não se altera nem some por acidente", async () => {
    await emTransacao(async () => {
      const { orgId } = await cenario();
      const r = await cliente.query(
        `INSERT INTO audit_log (org_id, action) VALUES ($1, 'agente.publicado') RETURNING id`,
        [orgId],
      );
      const id = r.rows[0].id;

      await deveRecusar(/livro-razão/, () =>
        cliente.query(`UPDATE audit_log SET action = 'nada aconteceu' WHERE id = $1`, [id]),
      );
      await deveRecusar(/expurgo explícito/, () =>
        cliente.query(`DELETE FROM audit_log WHERE id = $1`, [id]),
      );
    });
  });

  test("a conta não some enquanto o livro-razão dela estiver trancado", async () => {
    await emTransacao(async () => {
      const { orgId } = await cenario();
      await cliente.query(`INSERT INTO audit_log (org_id, action) VALUES ($1, 'algo')`, [orgId]);

      // a cascata de `organizations` esbarra no gatilho do livro-razão
      await deveRecusar(/expurgo explícito/, () =>
        cliente.query(`DELETE FROM organizations WHERE id = $1`, [orgId]),
      );
    });
  });

  test("com o expurgo ligado, a conta vai embora inteira — é o direito ao esquecimento", async () => {
    await emTransacao(async () => {
      const { orgId, agentId } = await cenario();
      await cliente.query(`INSERT INTO audit_log (org_id, action) VALUES ($1, 'dado.pessoal')`, [orgId]);
      await cliente.query(
        `INSERT INTO runtime_logs (org_id, agent_id, ok, resumo) VALUES ($1, $2, true, 'conversa')`,
        [orgId, agentId],
      );

      await cliente.query(`SET LOCAL app.expurgo = 'on'`);
      await cliente.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);

      for (const tabela of ["audit_log", "runtime_logs", "agents"]) {
        const sobrou = await cliente.query(`SELECT 1 FROM ${tabela} WHERE org_id = $1`, [orgId]);
        expect(sobrou.rowCount, `${tabela} deveria estar vazia`).toBe(0);
      }
    });
  });

  test("a chave do expurgo não fica encostada depois da transação", async () => {
    // `SET LOCAL` morre no COMMIT/ROLLBACK: a transação seguinte recomeça trancada
    await emTransacao(async () => {
      await cliente.query(`SET LOCAL app.expurgo = 'on'`);
    });
    await emTransacao(async () => {
      const { orgId } = await cenario();
      const r = await cliente.query(
        `INSERT INTO audit_log (org_id, action) VALUES ($1, 'teste') RETURNING id`,
        [orgId],
      );
      await deveRecusar(/expurgo explícito/, () =>
        cliente.query(`DELETE FROM audit_log WHERE id = $1`, [r.rows[0].id]),
      );
    });
  });
});
