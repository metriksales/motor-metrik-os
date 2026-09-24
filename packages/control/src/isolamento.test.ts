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

  agenteDeA = (await control.createAgent(ctxA(), { name: "SDR da A", tipo: "resposta" })).id;
  agenteDeB = (await control.createAgent(ctxB(), { name: "SDR da B", tipo: "resposta" })).id;
});

describe.skipIf(!temBanco)("uma conta não alcança a outra", () => {
  test("listar agentes devolve só os da própria conta", async () => {
    const daA = await control.listAgents(ctxA());
    const ids = daA.map((x: { id: string }) => x.id);
    expect(ids).toContain(agenteDeA);
    expect(ids).not.toContain(agenteDeB);
  });

  test("ler agente da outra conta não encontra (404, não 403 — não confirma existência)", async () => {
    await expect(control.getAgent(ctxA(), agenteDeB)).resolves.toBeFalsy();
  });

  test("propor mudança em agente de outra conta é recusado", async () => {
    await expect(
      control.proporMudanca(ctxA(), {
        agentId: agenteDeB,
        origin: "api",
        intent: "mexer no agente alheio",
        patch: {},
      }),
    ).rejects.toThrow(/não encontrado nesta conta/);
  });

  test("gravar execução em agente de outra conta é recusado", async () => {
    await expect(
      control.registrarLog(ctxA(), { agentId: agenteDeB, ok: true, resumo: "log injetado" }),
    ).rejects.toThrow(/não encontrado nesta conta/);
  });

  test("pausar agente de outra conta é recusado", async () => {
    await expect(
      control.setAgentEstado(ctxA(), { agentId: agenteDeB, estado: "pausado" }),
    ).rejects.toThrow(/não encontrado nesta conta/);
  });

  test("aprovar mudança de outra conta é recusado", async () => {
    const cs = await control.proporMudanca(ctxB(), {
      agentId: agenteDeB,
      origin: "api",
      intent: "mudança da conta B",
      patch: {},
    });
    await expect(control.aprovarMudanca(ctxA(), cs.id)).rejects.toThrow(/não encontrado nesta conta/);
    // e a mudança continua intocada na conta dona
    const daB = await control.listChangeSets(ctxB(), agenteDeB);
    expect(daB.find((x: { id: string }) => x.id === cs.id)?.status).toBe("draft");
  });

  test("token de máquina de uma conta resolve só para ela", async () => {
    const { token } = await control.criarMachineToken(ctxA(), { name: "teste", scopes: ["log"] });
    const ctx = await control.resolverMachineToken(token);
    expect(ctx.orgId).toBe(contaA);
    expect(ctx.orgId).not.toBe(contaB);
    expect(ctx.via).toBe("maquina");

    // revogado deixa de valer
    const [t] = await control.listarMachineTokens(ctxA());
    await control.revogarMachineToken(ctxA(), t.id);
    expect(await control.resolverMachineToken(token)).toBeNull();
  });

  test("o sino de pendências não mostra agente de outra conta", async () => {
    const pendencias = await control.listPendencias(ctxA());
    for (const p of pendencias) {
      expect(p.agentName).not.toBe("SDR da B");
    }
  });
});
