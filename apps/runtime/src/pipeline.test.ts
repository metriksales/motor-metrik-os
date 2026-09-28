/**
 * Uma linha de log por execução (S-012).
 *
 * O Flight Recorder é a caixa-preta: quando um cliente pergunta "o que o agente
 * fez com o meu lead às 15h?", a resposta sai daqui. Duas linhas por execução
 * — a do motor e a do pipeline, com o mesmo conteúdo — fazem a lista parecer
 * ter o dobro de atividade e escondem a linha que importa entre repetições.
 *
 * A regra: o MOTOR devolve o resumo no resultado; o PIPELINE grava a linha.
 * O que o motor registra por `ports.log` no meio do caminho é detalhe, e não
 * vai para a caixa-preta. Estes testes rodam sem banco: é só a fiação.
 */
import { describe, expect, test } from "vitest";
import type { AgentSpec, MotorEngine, MotorPorts, MotorRegistry, MotorResult, RuntimeLog } from "@motor/core";
import { createMemoryDeps } from "./deps";
import { handleInbound } from "./inbound";

const ORG = "11111111-1111-4111-8111-111111111111";
const AGENT = "22222222-2222-4222-8222-222222222222";

// spec mínima: o registry de teste casa qualquer evento, então o conteúdo não importa
const SPEC = { nome: "Bia de teste", motores: [] } as unknown as AgentSpec;

/** Um motor de mentira que se comporta como os de verdade: loga no caminho e devolve resumo. */
function motor(id: string, run: (ports: MotorPorts) => Promise<MotorResult>): MotorEngine {
  return {
    id,
    nome: id,
    trigger: [{ type: "inbound" }],
    manifest: {} as MotorEngine["manifest"],
    run: (_input, ports) => run(ports),
  };
}

function registryCom(...motores: MotorEngine[]): MotorRegistry {
  return {
    get: (id) => motores.find((m) => m.id === id),
    all: () => motores,
    match: () => motores,
  };
}

/** deps em memória com a linha da execução capturada — é o que iria ao banco. */
function palco(registry: MotorRegistry) {
  const deps = createMemoryDeps({ specs: { [`${ORG}:${AGENT}`]: SPEC }, registry });
  const gravadas: RuntimeLog[] = [];
  deps.log = (l) => gravadas.push(l);
  return { deps, gravadas };
}

const evento = { orgId: ORG, agentId: AGENT, canal: "whatsapp" as const, contactId: "c-1", texto: "oi" };

describe("uma linha por execução", () => {
  test("o motor loga três vezes no caminho e devolve resumo; a caixa-preta recebe UMA linha, com o resumo do motor", async () => {
    const m = motor("atendimento", async (ports) => {
      const base = { orgId: ORG, agentId: AGENT, motor: "atendimento", at: new Date().toISOString() };
      ports.log({ ...base, ok: false, resumo: "tool X falhou", erro: "timeout" });
      ports.log({ ...base, ok: false, resumo: "tool Y falhou", erro: "500" });
      ports.log({ ...base, ok: true, resumo: "atendeu com 2 falha(s)" });
      return { ok: false, did: ["falhou X", "falhou Y"], error: "X: timeout · Y: 500", resumo: "atendeu com 2 falha(s) de ferramenta" };
    });
    const { deps, gravadas } = palco(registryCom(m));

    const out = await handleInbound(evento, deps);

    expect(out.ran).toEqual(["atendimento"]);
    expect(gravadas).toHaveLength(1);
    expect(gravadas[0]).toMatchObject({
      motor: "atendimento",
      ok: false,
      resumo: "atendeu com 2 falha(s) de ferramenta",
      did: ["falhou X", "falhou Y"],
      erro: "X: timeout · Y: 500",
    });
  });

  test("dois motores no mesmo evento → duas linhas, uma por motor, na ordem", async () => {
    const a = motor("followup", async () => ({ ok: true, did: ["enviado toque 1/3"], resumo: "toque 1 enviado (leads)" }));
    const b = motor("agenda", async () => ({ ok: true, did: ["agendado: amanhã"], resumo: "reunião agendada (amanhã)" }));
    const { deps, gravadas } = palco(registryCom(a, b));

    await handleInbound(evento, deps);

    expect(gravadas.map((l) => [l.motor, l.resumo])).toEqual([
      ["followup", "toque 1 enviado (leads)"],
      ["agenda", "reunião agendada (amanhã)"],
    ]);
  });

  test("motor sem resumo: a linha usa o que foi feito — nunca fica vazia", async () => {
    const feito = motor("m1", async () => ({ ok: true, did: ["tag: quente", "moveu: qualificado"] }));
    const nada = motor("m2", async () => ({ ok: true, did: [] }));
    const falhou = motor("m3", async () => ({ ok: false, did: [], error: "CRM fora do ar" }));
    const { deps, gravadas } = palco(registryCom(feito, nada, falhou));

    await handleInbound(evento, deps);

    expect(gravadas.map((l) => l.resumo)).toEqual(["tag: quente; moveu: qualificado", "executou", "CRM fora do ar"]);
    expect(gravadas.every((l) => l.resumo.length > 0)).toBe(true);
  });

  test("motor que ESTOURA vira uma linha de falha, e os outros motores ainda rodam", async () => {
    const bomba = motor("bomba", async () => {
      throw new Error("NPE no motor");
    });
    const seguinte = motor("seguinte", async () => ({ ok: true, did: [], resumo: "passou" }));
    const { deps, gravadas } = palco(registryCom(bomba, seguinte));

    const out = await handleInbound(evento, deps);

    expect(out.ran).toEqual(["bomba", "seguinte"]);
    expect(gravadas).toHaveLength(2);
    expect(gravadas[0]).toMatchObject({ motor: "bomba", ok: false, resumo: "motor estourou: NPE no motor", erro: "NPE no motor" });
    expect(gravadas[1]).toMatchObject({ motor: "seguinte", ok: true, resumo: "passou" });
  });

  test("sem spec publicada: uma linha dizendo isso, e nenhum motor roda", async () => {
    const m = motor("nunca", async () => ({ ok: true, did: [], resumo: "não deveria rodar" }));
    const deps = createMemoryDeps({ registry: registryCom(m) }); // sem specs
    const gravadas: RuntimeLog[] = [];
    deps.log = (l) => gravadas.push(l);

    const out = await handleInbound(evento, deps);

    expect(out.ran).toEqual([]);
    expect(gravadas).toHaveLength(1);
    expect(gravadas[0]).toMatchObject({ ok: false, resumo: "spec não encontrada" });
  });

  test("todo deps tem flush, e o host pode chamá-lo sem perguntar", async () => {
    const { deps } = palco(registryCom());
    expect(typeof deps.flush).toBe("function");
    await expect(deps.flush!()).resolves.toBeUndefined();
  });
});
