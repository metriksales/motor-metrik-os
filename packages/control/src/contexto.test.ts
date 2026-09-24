/**
 * O contexto de conta por requisição (S-011), contra um Postgres DE VERDADE.
 *
 * `comConta` é o ponto único por onde o control plane declara ao banco de quem
 * é a query. Enquanto o RLS não está ligado ele não muda nada visível — mas se
 * estiver errado agora, o dia em que as políticas entrarem ele derruba tudo ou,
 * pior, mistura contas. Por isso ele é exercitado desde já.
 *
 * O teste que mais importa é o do vazamento entre chamadas simultâneas: numa
 * função serverless duas requisições convivem no mesmo processo, e um contexto
 * global comum entregaria a conta de uma para a query da outra — sem erro
 * nenhum, só com o dado errado.
 *
 * Pulado sem banco (a CI sempre roda).
 */
import { beforeAll, describe, expect, test } from "vitest";

const urlDeTeste = process.env.TEST_DATABASE_URL;
const temBanco = Boolean(urlDeTeste);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let bd: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let drizzleSql: any;

beforeAll(async () => {
  if (!temBanco) return;
  process.env.DATABASE_URL = urlDeTeste;
  process.env.DB_DRIVER = "pg";
  bd = await import("@motor/db");
  ({ sql: drizzleSql } = await import("drizzle-orm"));
});

/**
 * O que o banco diz que é a conta da sessão agora.
 *
 * CUIDADO COM O VAZIO. `current_setting(nome, true)` devolve NULL só enquanto
 * o parâmetro nunca existiu naquela sessão; depois que uma transação o definiu
 * e terminou, ele volta ao padrão, que é STRING VAZIA. Como a conexão é
 * reaproveitada do pool, a segunda requisição vê `''`, não NULL.
 *
 * É por isso que a política de RLS precisa ser
 * `nullif(current_setting('app.org_id', true), '')::uuid`: sem o `nullif`, o
 * cast de `''` para uuid estoura.
 */
async function contaSegundoOBanco(): Promise<string | null> {
  const r = await bd.db.execute(drizzleSql`select current_setting('app.org_id', true) as conta`);
  const linhas = r.rows ?? r;
  const valor = linhas[0]?.conta;
  return valor ? valor : null; // NULL e '' significam a mesma coisa: conta nenhuma
}

async function novaConta(nome: string): Promise<string> {
  const [org] = await bd.db.insert(bd.organizations).values({ name: nome }).returning();
  return org.id as string;
}

describe.skipIf(!temBanco)("contexto de conta", () => {
  test("fora de comConta, o banco não sabe de conta nenhuma", async () => {
    expect(await contaSegundoOBanco()).toBeNull();
    expect(bd.contaEmCurso()).toBeNull();
  });

  test("o valor cru depois de uma transação é string vazia, não NULL", async () => {
    // A política de RLS depende disto: sem `nullif`, o cast de '' para uuid
    // estoura, e a mensagem não diria que o problema é falta de contexto.
    const orgId = await novaConta(`ctx-vazio-${Date.now()}`);
    await bd.comConta(orgId, async () => {});

    const r = await bd.db.execute(drizzleSql`select current_setting('app.org_id', true) as conta`);
    const cru = (r.rows ?? r)[0]?.conta;
    expect(cru === "" || cru === null).toBe(true);
    expect(cru).not.toBe(orgId);
  });

  test("dentro de comConta, o banco sabe exatamente qual é", async () => {
    const orgId = await novaConta(`ctx-${Date.now()}`);
    await bd.comConta(orgId, async () => {
      expect(await contaSegundoOBanco()).toBe(orgId);
      expect(bd.contaEmCurso()).toBe(orgId);
    });
  });

  test("a declaração morre junto com a requisição", async () => {
    const orgId = await novaConta(`ctx-fim-${Date.now()}`);
    await bd.comConta(orgId, async () => {
      expect(bd.contaEmCurso()).toBe(orgId);
    });
    // `set_config(..., true)` é local à transação: a próxima chamada recomeça limpa
    expect(await contaSegundoOBanco()).toBeNull();
    expect(bd.contaEmCurso()).toBeNull();
  });

  test("duas contas ao mesmo tempo não se misturam", async () => {
    // o caso real: duas requisições vivas no mesmo processo serverless
    const a = await novaConta(`ctx-a-${Date.now()}`);
    const b = await novaConta(`ctx-b-${Date.now()}`);

    const espia = async (esperado: string, atraso: number) =>
      bd.comConta(esperado, async () => {
        await new Promise((r) => setTimeout(r, atraso));
        const visto = await contaSegundoOBanco();
        return { esperado, visto, emMemoria: bd.contaEmCurso() };
      });

    // atrasos cruzados forçam as duas a se intercalarem de verdade
    const [ra, rb] = await Promise.all([espia(a, 40), espia(b, 10)]);

    expect(ra.visto).toBe(a);
    expect(ra.emMemoria).toBe(a);
    expect(rb.visto).toBe(b);
    expect(rb.emMemoria).toBe(b);
  });

  test("é transação de verdade: erro desfaz o que foi escrito", async () => {
    const orgId = await novaConta(`ctx-rollback-${Date.now()}`);
    const nome = `agente-${Date.now()}`;

    await expect(
      bd.comConta(orgId, async () => {
        await bd.db.insert(bd.agents).values({ orgId, name: nome, tipo: "resposta" });
        throw new Error("algo deu errado no meio da ação");
      }),
    ).rejects.toThrow(/algo deu errado/);

    const sobrou = await bd.db.select().from(bd.agents).where(drizzleSql`name = ${nome}`);
    expect(sobrou).toHaveLength(0);
  });
});
