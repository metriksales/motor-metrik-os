import { describe, expect, test } from "vitest";
import { FERRAMENTAS_CRM, type CrmPort, type LlmTurn, type MotorPorts, type RuntimeEvent } from "@motor/core";
import { atendimentoMotor } from "./atendimento.js";

// CRM de mentira que só anota o que foi chamado — é o que queremos inspecionar.
function crmEspiao() {
  const chamadas: { metodo: string; args: unknown[] }[] = [];
  const crm: CrmPort = {
    kind: "espiao",
    async moverEtapa(oppId, stageId) {
      chamadas.push({ metodo: "moverEtapa", args: [oppId, stageId] });
    },
    async preencherCampo(contactId, field, value) {
      chamadas.push({ metodo: "preencherCampo", args: [contactId, field, value] });
    },
    async criarTarefa(contactId, titulo, quando) {
      chamadas.push({ metodo: "criarTarefa", args: [contactId, titulo, quando] });
    },
    async agendar(input) {
      chamadas.push({ metodo: "agendar", args: [input] });
      return { eventId: "ev-1" };
    },
    async addTag(contactId, tag) {
      chamadas.push({ metodo: "addTag", args: [contactId, tag] });
    },
    async removerTag(contactId, tag) {
      chamadas.push({ metodo: "removerTag", args: [contactId, tag] });
    },
    async criarOportunidade(contactId, funilId) {
      chamadas.push({ metodo: "criarOportunidade", args: [contactId, funilId] });
      return { oppId: "opp-nova" };
    },
    async enviarMensagem(contactId, texto) {
      chamadas.push({ metodo: "enviarMensagem", args: [contactId, texto] });
    },
    async handoff(contactId) {
      chamadas.push({ metodo: "handoff", args: [contactId] });
    },
  };
  return { crm, chamadas };
}

/** Roda o motor com um cérebro que devolve exatamente o turno pedido. */
async function rodar(turn: LlmTurn, event: Partial<RuntimeEvent> = {}) {
  const { crm, chamadas } = crmEspiao();
  const logs: unknown[] = [];
  const ports = {
    llm: { async responder() { return turn; } },
    crm,
    log: (l: unknown) => logs.push(l),
    now: () => new Date("2026-09-23T12:00:00Z"),
  } as unknown as MotorPorts;

  const resultado = await atendimentoMotor.run(
    {
      orgId: "conta-1",
      agentId: "agente-1",
      spec: { cerebro: { identidade: "Bia", regras: [] } } as never,
      event: { orgId: "conta-1", agentId: "agente-1", tipo: "inbound", contactId: "contato-do-lead", texto: "oi", ...event } as RuntimeEvent,
    },
    ports,
  );
  return { resultado, chamadas, logs };
}

describe("o alvo é sempre o contato da conversa", () => {
  test("ignora o contactId que o cérebro mandar (injeção pelo lead)", async () => {
    const { resultado, chamadas } = await rodar({
      toolCalls: [{ tool: "addTag", args: { contactId: "contato-de-outra-pessoa", tag: "vip" } }],
    });

    expect(resultado.ok).toBe(true);
    expect(chamadas).toEqual([{ metodo: "addTag", args: ["contato-do-lead", "vip"] }]);
  });

  test("preencherCampo também grava só no contato da conversa", async () => {
    const { chamadas } = await rodar({
      toolCalls: [{ tool: "preencherCampo", args: { contactId: "vitima", field: "cpf", value: "x" } }],
    });
    expect(chamadas[0].args[0]).toBe("contato-do-lead");
  });
});

describe("moverEtapa só em oportunidade conhecida deste contato", () => {
  test("recusa oppId arbitrário e a execução não fica ok", async () => {
    const { resultado, chamadas } = await rodar({
      toolCalls: [{ tool: "moverEtapa", args: { oppId: "opp-de-outro-cliente", stageId: "ganho" } }],
    });

    expect(chamadas).toEqual([]);
    expect(resultado.ok).toBe(false);
    expect(resultado.error).toContain("não pertence a este contato");
  });

  test("aceita a oportunidade que veio no evento", async () => {
    const { resultado, chamadas } = await rodar(
      { toolCalls: [{ tool: "moverEtapa", args: { oppId: "opp-do-lead", stageId: "qualificado" } }] },
      { meta: { oppId: "opp-do-lead" } },
    );

    expect(resultado.ok).toBe(true);
    expect(chamadas).toEqual([{ metodo: "moverEtapa", args: ["opp-do-lead", "qualificado"] }]);
  });
});

describe("outras travas", () => {
  test("enviarMensagem não é executada nem oferecida ao cérebro", async () => {
    const { resultado, chamadas } = await rodar({
      toolCalls: [{ tool: "enviarMensagem", args: { contactId: "terceiro", texto: "spam" } }],
    });

    expect(chamadas).toEqual([]);
    expect(resultado.ok).toBe(false);
    expect(FERRAMENTAS_CRM.map((f) => f.name)).not.toContain("enviarMensagem");
  });

  test("argumento obrigatório faltando vira erro, não string vazia", async () => {
    const { resultado, chamadas } = await rodar({ toolCalls: [{ tool: "addTag", args: {} }] });
    expect(chamadas).toEqual([]);
    expect(resultado.error).toContain("tag");
  });

  test("agendar sem quando não marca reunião para agora", async () => {
    const { resultado, chamadas } = await rodar({ toolCalls: [{ tool: "agendar", args: {} }] });
    expect(chamadas).toEqual([]);
    expect(resultado.ok).toBe(false);
  });

  test("toda ferramenta do catálogo declara schema sem contactId", () => {
    for (const f of FERRAMENTAS_CRM) {
      expect(Object.keys(f.parameters.properties)).not.toContain("contactId");
      expect(f.parameters.additionalProperties).toBe(false);
      expect(f.description.length).toBeGreaterThan(10);
    }
  });
});
