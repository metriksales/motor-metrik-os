/**
 * Control e runtime dividem UMA cópia do banco (regressão da S-046).
 *
 * O QUE ACONTECEU. O `api/_bundled/` era gerado em dois pacotes, cada um com a
 * própria cópia de `@motor/db` — dois AsyncLocalStorage, dois pools. O
 * `comConta` do control não transportava contexto para o `db` do runtime. Sob a
 * conexão de dona isso passava (dona vê tudo); sob o papel restrito, `loadSpec`
 * devolvia null e o webhook respondia "ok" ao canal sem fazer nada. O Flight
 * Recorder engolia a recusa. Reproduzido com os pacotes reais sobre uma cópia
 * de produção. A regra 12 do AGENTS.md já descrevia a armadilha — em prosa.
 * Este arquivo é a versão que falha.
 *
 * Roda com a conexão RESTRITA, como a produção: se o contexto não atravessar,
 * o RLS devolve zero linhas e o teste cai. Pulado sem `TEST_DATABASE_URL_APP`
 * (a CI sempre roda).
 */
import { beforeAll, describe, expect, test } from "vitest";

const urlDono = process.env.TEST_DATABASE_URL;
const urlApp = process.env.TEST_DATABASE_URL_APP;
const temAmbas = Boolean(urlDono && urlApp);

/* eslint-disable @typescript-eslint/no-explicit-any */
let motor: any;
let dono: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

beforeAll(async () => {
  if (!temAmbas) return;
  // o pacote lê o ambiente ao carregar: a variável precisa existir ANTES do import
  process.env.DATABASE_URL_APP = urlApp;
  process.env.DATABASE_URL = urlDono;
  process.env.DB_DRIVER = "pg";
  // O ARTEFATO, não a fonte. É o .mjs que a Vercel executa, e o defeito morava
  // na forma como ele era gerado — testar a fonte não pegaria.
  motor = await import("../api/_bundled/motor.mjs");

  const pg = (await import("pg")).default;
  dono = new pg.Client({ connectionString: urlDono });
  await dono.connect();
});

const marca = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** Um agente com spec publicada, montado como DONA — o que a migração faria. */
async function agenteComSpec() {
  const org = (await dono.query("insert into organizations (name) values ($1) returning id::text", [`pu-${marca()}`])).rows[0].id;
  const agent = (
    await dono.query(
      "insert into agents (org_id, name, tipo, current_spec_version) values ($1, 'Bia de teste', 'resposta', 1) returning id::text",
      [org],
    )
  ).rows[0].id;
  await dono.query("insert into agent_specs (org_id, agent_id, version, spec) values ($1, $2, 1, $3::jsonb)", [
    org,
    agent,
    JSON.stringify({ nome: "Bia de teste", motores: [] }),
  ]);
  return { org, agent };
}

describe.skipIf(!temAmbas)("um pacote, uma cópia do banco", () => {
  test("o pacote expõe control E runtime — não existe mais 'o outro .mjs'", () => {
    expect(typeof motor.comConta).toBe("function"); // control
    expect(typeof motor.createProductionDeps).toBe("function"); // runtime
    expect(typeof motor.handleInbound).toBe("function"); // runtime
  });

  test("o contexto declarado pelo control CHEGA ao loadSpec do runtime", async () => {
    // É a linha que falhava: comConta(control) → loadSpec(runtime) = NULL.
    const { org, agent } = await agenteComSpec();
    const deps = motor.createProductionDeps({ openaiApiKey: "nao-usada" });

    const spec = await motor.comConta(org, () => deps.loadSpec(org, agent));
    expect(spec).not.toBeNull();
    expect(spec.nome).toBe("Bia de teste");
  });

  test("e SEM contexto o runtime continua não vendo nada — a restrição ficou", async () => {
    // Se isto passasse a achar, o conserto teria sido afrouxar o RLS, não
    // unificar o pacote. As duas coisas precisam ser verdade ao mesmo tempo.
    const { org, agent } = await agenteComSpec();
    const deps = motor.createProductionDeps({ openaiApiKey: "nao-usada" });
    expect(await deps.loadSpec(org, agent)).toBeNull();
  });

  test("o Flight Recorder grava dentro do contexto — e não engole recusa", async () => {
    const { org, agent } = await agenteComSpec();
    const deps = motor.createProductionDeps({ openaiApiKey: "nao-usada" });
    const resumo = `pacote-unico-${marca()}`;

    await motor.comConta(org, async () => {
      deps.log({ orgId: org, agentId: agent, motor: "teste", ok: true, resumo, at: new Date().toISOString() });
      // fire-and-forget: dá à escrita a chance de acontecer ainda dentro da transação
      await new Promise((r) => setTimeout(r, 300));
    });

    // como dona: a linha existe mesmo
    let n = 0;
    for (let i = 0; i < 20 && n === 0; i++) {
      n = (await dono.query("select count(*)::int as n from runtime_logs where resumo = $1", [resumo])).rows[0].n;
      if (n === 0) await new Promise((r) => setTimeout(r, 150));
    }
    expect(n).toBe(1);
  });
});
