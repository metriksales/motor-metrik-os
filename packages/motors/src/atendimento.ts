// Motor de Atendimento — o cérebro conversando. Gatilho: inbound (lead escreveu).
// Monta o system a partir do spec.cerebro, chama o LlmPort e, se o cérebro pedir
// ferramentas, executa cada uma via CrmPort; senão, devolve a resposta pro lead.

import type {
  MotorEngine,
  MotorManifest,
  MotorPorts,
  MotorResult,
  MotorRunInput,
  CrmPort,
  CrmTool,
  ToolCall,
  AgentSpec,
} from "@motor/core";

// Ferramentas que o cérebro pode pedir (mesma língua do CrmPort/CrmAdapter).
const FERRAMENTAS: CrmTool[] = [
  "moverEtapa",
  "preencherCampo",
  "criarTarefa",
  "agendar",
  "addTag",
  "removerTag",
  "criarOportunidade",
  "enviarMensagem",
  "handoff",
];

/** Compila o "cérebro" (identidade + oferta + tom + travas) no system prompt. */
function montarSystem(spec: AgentSpec): string {
  const c = spec.cerebro;
  const linhas: string[] = [c.identidade];
  if (c.oferta) linhas.push(`\nOferta: ${c.oferta}`);
  if (c.tom) linhas.push(`Tom: ${c.tom}`);
  if (c.regras.length) {
    linhas.push("\nRegras (travas que você NUNCA quebra):");
    for (const r of c.regras) linhas.push(`- ${r}`);
  }
  return linhas.join("\n");
}

/** Executa UMA tool pedida pelo cérebro, mapeando nome→método do CrmPort. */
async function executarTool(crm: CrmPort, tc: ToolCall, contactId: string): Promise<string> {
  const a = tc.args ?? {};
  const alvo = (typeof a.contactId === "string" && a.contactId) || contactId;
  switch (tc.tool) {
    case "moverEtapa":
      await crm.moverEtapa(String(a.oppId ?? ""), String(a.stageId ?? ""));
      return `moverEtapa→${a.stageId ?? "?"}`;
    case "preencherCampo":
      await crm.preencherCampo(alvo, String(a.field ?? ""), a.value);
      return `preencherCampo:${a.field ?? "?"}`;
    case "criarTarefa":
      await crm.criarTarefa(alvo, String(a.titulo ?? "tarefa"), a.quando ? String(a.quando) : undefined);
      return `criarTarefa:${a.titulo ?? "tarefa"}`;
    case "agendar": {
      const { eventId } = await crm.agendar({
        contactId: alvo,
        quando: String(a.quando ?? new Date().toISOString()),
        calendarId: a.calendarId ? String(a.calendarId) : undefined,
      });
      return `agendar→${eventId}`;
    }
    case "addTag":
      await crm.addTag(alvo, String(a.tag ?? ""));
      return `addTag:${a.tag ?? "?"}`;
    case "removerTag":
      await crm.removerTag(alvo, String(a.tag ?? ""));
      return `removerTag:${a.tag ?? "?"}`;
    case "criarOportunidade": {
      const { oppId } = await crm.criarOportunidade(
        alvo,
        String(a.funilId ?? ""),
        typeof a.valor === "number" ? a.valor : undefined,
      );
      return `criarOportunidade→${oppId}`;
    }
    case "enviarMensagem":
      await crm.enviarMensagem(alvo, String(a.texto ?? ""));
      return "enviarMensagem";
    case "handoff":
      await crm.handoff(alvo);
      return "handoff";
    default:
      return `tool ignorada (desconhecida): ${tc.tool}`;
  }
}

const manifest: MotorManifest = {
  id: "atendimento",
  titulo: "Atendimento",
  descricao: "O cérebro atende o lead que escreveu: responde e executa ações no CRM quando decide.",
  work: "acoes",
  zona: "vermelho", // fala com o lead em nome do cliente → maior risco
  config: [],
};

export const atendimentoMotor: MotorEngine = {
  id: "atendimento",
  nome: "Atendimento",
  trigger: [{ type: "inbound" }],
  manifest,

  async run(input: MotorRunInput, ports: MotorPorts): Promise<MotorResult> {
    const { orgId, agentId, spec, event } = input;
    const agora = ports.now();

    const contactId = event.contactId;
    if (!contactId) {
      return { ok: false, did: [], error: "sem contactId no evento inbound" };
    }
    // Fallback seguro sem cérebro: não inventa resposta, só reporta honestamente.
    if (!ports.llm) {
      return { ok: false, did: [], error: "llm indisponível — atendimento precisa do cérebro" };
    }

    const system = montarSystem(spec);
    const historico = [{ role: "user" as const, content: event.texto ?? "" }];

    let turn;
    try {
      turn = await ports.llm.responder({
        system,
        historico,
        tools: ports.crm ? FERRAMENTAS : undefined,
      });
    } catch (e) {
      const erro = (e as Error).message;
      ports.log({
        orgId, agentId, motor: "atendimento", ok: false,
        resumo: "cérebro (llm) falhou", erro, at: agora.toISOString(), meta: { contactId },
      });
      return { ok: false, did: [], error: erro };
    }

    const did: string[] = [];

    // O cérebro pediu ferramentas → executa cada uma via CRM.
    if (turn.toolCalls && turn.toolCalls.length > 0) {
      if (!ports.crm) {
        return { ok: false, did: [], error: "cérebro pediu tools, mas crm indisponível" };
      }
      for (const tc of turn.toolCalls) {
        try {
          did.push(await executarTool(ports.crm, tc, contactId));
        } catch (e) {
          const erro = (e as Error).message;
          did.push(`falhou ${tc.tool}: ${erro}`);
          ports.log({
            orgId, agentId, motor: "atendimento", ok: false,
            resumo: `tool ${tc.tool} falhou`, erro, at: agora.toISOString(), meta: { contactId },
          });
        }
      }
    } else if (turn.texto && turn.texto.trim()) {
      // Sem tools → devolve a resposta pro lead: CRM nativo, ou Transport como canal.
      if (ports.crm) {
        await ports.crm.enviarMensagem(contactId, turn.texto);
        did.push("respondeu (crm)");
      } else if (ports.transport) {
        const to =
          (typeof event.meta?.telefone === "string" && (event.meta.telefone as string)) || contactId;
        const r = await ports.transport.send({
          orgId, to, message: { kind: "text", text: turn.texto },
        });
        if (!r.ok) {
          ports.log({
            orgId, agentId, motor: "atendimento", ok: false,
            resumo: "falha ao entregar resposta", erro: r.error ?? "transport ok:false",
            at: agora.toISOString(), meta: { contactId },
          });
          return { ok: false, did: [], error: r.error ?? "envio falhou" };
        }
        did.push("respondeu (transport)");
      } else {
        return { ok: false, did: [], error: "sem canal de resposta (crm/transport)" };
      }
    } else {
      did.push("cérebro sem texto e sem tools — nada a fazer");
    }

    ports.log({
      orgId, agentId, motor: "atendimento", ok: true,
      resumo: `atendeu inbound de ${contactId}`, did,
      at: agora.toISOString(), meta: { contactId, tools: turn.toolCalls?.length ?? 0 },
    });
    return { ok: true, did };
  },
};
