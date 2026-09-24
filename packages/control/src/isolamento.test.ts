/**
 * Isolamento entre contas, contra um Postgres DE VERDADE (S-006).
 *
 * É o teste que a auditoria pediu: ele não confere tipos, confere que uma conta
 * não lê nem escreve na outra. Precisa de banco, então roda na CI (serviço
 * postgres do workflow) e é PULADO na máquina de quem não tem um.
 *
 *   TEST_DATABASE_URL=postgres://... npm test
 */
import { beforeAll, describe, expect, test } from "vitest";

const urlDeTeste = process.env.TEST_DATABASE_URL;
const temBanco = Boolean(urlDeTeste);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let control: any;
let contaA = "";
let contaB = "";
let agenteDeA = "";
let agenteDeB = "";

const ctxA = () => ({ orgId: contaA, actor: "teste-a", role: "owner" as const });
const ctxB = () => ({ orgId: contaB, actor: "teste-b", role: "owner" as const });

/**
 * Chama o control JÁ dentro da conta do próprio ctx.
 *
 * Com o RLS ligado (S-011) nenhuma ação enxerga nada sem declarar de quem é a
 * requisição, e o ctx que cada teste monta já diz qual conta é. O proxy evita
 * embrulhar as trinta chamadas deste arquivo à mão — e, de quebra, deixa claro
 * que a partir de agora "chamar o control" é sempre chamar dentro de uma conta.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const app: any = new Proxy(
  {},
  {
    get:
      (_alvo, nome: string) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (...args: any[]) => {
        const ctx = args[0] as { orgId?: string } | undefined;
        return ctx?.orgId
          ? control.comConta(ctx.orgId, () => control[nome](...args))
          : control[nome](...args);
      },
  },
);

beforeAll(async () => {
  if (!temBanco) return;
  process.env.DATABASE_URL = urlDeTeste;
  process.env.DB_DRIVER = "pg";

  control = await import("./index.js");
  const { db, organizations } = await import("@motor/db");

  const [a] = await db.insert(organizations).values({ name: "Conta A" }).returning();
  const [b] = await db.insert(organizations).values({ name: "Conta B" }).returning();
  contaA = a.id;
  contaB = b.id;

  agenteDeA = (await app.createAgent(ctxA(), { name: "SDR da A", tipo: "resposta" })).id;
  agenteDeB = (await app.createAgent(ctxB(), { name: "SDR da B", tipo: "resposta" })).id;
});

describe.skipIf(!temBanco)("uma conta não alcança a outra", () => {
  test("listar agentes devolve só os da própria conta", async () => {
    const daA = await app.listAgents(ctxA());
    const ids = daA.map((x: { id: string }) => x.id);
    expect(ids).toContain(agenteDeA);
    expect(ids).not.toContain(agenteDeB);
  });

  test("ler agente da outra conta não encontra (404, não 403 — não confirma existência)", async () => {
    await expect(app.getAgent(ctxA(), agenteDeB)).resolves.toBeFalsy();
  });

  test("propor mudança em agente de outra conta é recusado", async () => {
    await expect(
      app.proporMudanca(ctxA(), {
        agentId: agenteDeB,
        origin: "api",
        intent: "mexer no agente alheio",
        patch: {},
      }),
    ).rejects.toThrow(/não encontrado nesta conta/);
  });

  test("gravar execução em agente de outra conta é recusado", async () => {
    await expect(
      app.registrarLog(ctxA(), { agentId: agenteDeB, ok: true, resumo: "log injetado" }),
    ).rejects.toThrow(/não encontrado nesta conta/);
  });

  test("pausar agente de outra conta é recusado", async () => {
    await expect(
      app.setAgentEstado(ctxA(), { agentId: agenteDeB, estado: "pausado" }),
    ).rejects.toThrow(/não encontrado nesta conta/);
  });

  test("aprovar mudança de outra conta é recusado", async () => {
    const cs = await app.proporMudanca(ctxB(), {
      agentId: agenteDeB,
      origin: "api",
      intent: "mudança da conta B",
      patch: {},
    });
    await expect(app.aprovarMudanca(ctxA(), cs.id)).rejects.toThrow(/não encontrado nesta conta/);
    // e a mudança continua intocada na conta dona
    const daB = await app.listChangeSets(ctxB(), agenteDeB);
    expect(daB.find((x: { id: string }) => x.id === cs.id)?.status).toBe("draft");
  });

  test("token de máquina de uma conta resolve só para ela", async () => {
    const { token } = await app.criarMachineToken(ctxA(), { name: "teste", scopes: ["log"] });
    const ctx = await app.resolverMachineToken(token);
    expect(ctx.orgId).toBe(contaA);
    expect(ctx.orgId).not.toBe(contaB);
    expect(ctx.via).toBe("maquina");

    // revogado deixa de valer
    const [t] = await app.listarMachineTokens(ctxA());
    await app.revogarMachineToken(ctxA(), t.id);
    expect(await app.resolverMachineToken(token)).toBeNull();
  });

  test("o sino de pendências não mostra agente de outra conta", async () => {
    const pendencias = await app.listPendencias(ctxA());
    for (const p of pendencias) {
      expect(p.agentName).not.toBe("SDR da B");
    }
  });
});
