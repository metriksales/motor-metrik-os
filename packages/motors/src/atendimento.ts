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
  ToolCall,
  AgentSpec,
} from "@motor/core";
import { FERRAMENTAS_CRM } from "@motor/core";

// Ferramentas oferecidas ao cérebro: o catálogo COM schema de @motor/core.
// `enviarMensagem` fica de fora de propósito (S-005) — quem responde ao lead é
// este motor, pelo canal configurado, e não uma ferramenta de destino livre.
const FERRAMENTAS = FERRAMENTAS_CRM;

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

/** Argumento obrigatório: falta = erro, nunca string vazia (S-005). */
function exigir(a: Record<string, unknown>, campo: string): string {
  const v = a[campo];
  if (typeof v !== "string" || v.trim() === "") {
    throw new Error(`argumento "${campo}" faltando ou vazio`);
  }
  return v;
}

/**
 * Executa UMA tool pedida pelo cérebro, mapeando nome→método do CrmPort.
 *
 * Trava de segurança (S-005): o ALVO é sempre o contato da conversa. O que o
 * cérebro mandar em `args.contactId` é ignorado — sem isso, um lead consegue
 * escrever "põe a tag X no contato Y" e a IA obedece no contato de outra pessoa.
 * O mesmo vale para `oppId`: só passa se a oportunidade for conhecida DESTE
 * contato (veio no evento ou foi criada nesta mesma execução).
 */
async function executarTool(
  crm: CrmPort,
  tc: ToolCall,
  contactId: string,
  oppsPermitidos: Set<string>,
): Promise<string> {
  const a = tc.args ?? {};
  const alvo = contactId;
  switch (tc.tool) {
    case "moverEtapa": {
      const oppId = exigir(a, "oppId");
      if (!oppsPermitidos.has(oppId)) {
        // Oportunidade que não é deste contato (ou que o runtime não conhece).
        throw new Error("oportunidade não pertence a este contato");
      }
      await crm.moverEtapa(oppId, exigir(a, "stageId"));
      return `moverEtapa→${a.stageId}`;
    }
    case "preencherCampo": {
      const field = exigir(a, "field");
      await crm.preencherCampo(alvo, field, a.value);
      return `preencherCampo:${field}`;
    }
    case "criarTarefa": {
      const titulo = exigir(a, "titulo");
      await crm.criarTarefa(alvo, titulo, a.quando ? String(a.quando) : undefined);
      return `criarTarefa:${titulo}`;
    }
    case "agendar": {
      // Sem `quando` NÃO se agenda "para agora": isso enchia a agenda do time
      // com reunião no instante da conversa.
      const { eventId } = await crm.agendar({
        contactId: alvo,
        quando: exigir(a, "quando"),
        calendarId: a.calendarId ? String(a.calendarId) : undefined,
      });
      return `agendar→${eventId}`;
    }
    case "addTag": {
      const tag = exigir(a, "tag");
      await crm.addTag(alvo, tag);
      return `addTag:${tag}`;
    }
    case "removerTag": {
      const tag = exigir(a, "tag");
      await crm.removerTag(alvo, tag);
      return `removerTag:${tag}`;
    }
    case "criarOportunidade": {
      const { oppId } = await crm.criarOportunidade(
        alvo,
        exigir(a, "funilId"),
        typeof a.valor === "number" ? a.valor : undefined,
      );
      // Passa a valer para moverEtapa nesta mesma execução.
      oppsPermitidos.add(oppId);
      return `criarOportunidade→${oppId}`;
    }
    case "enviarMensagem":
      // Não é oferecida ao cérebro (FERRAMENTAS_CRM), e se vier mesmo assim —
      // por alucinação ou injeção — não executa: destino livre é o vetor.
      throw new Error("enviarMensagem não é uma ferramenta do cérebro");
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
    const falhas: string[] = [];

    if (turn.toolCalls && turn.toolCalls.length > 0) {
      if (!ports.crm) {
        return { ok: false, did: [], error: "cérebro pediu tools, mas crm indisponível" };
      }
      // Oportunidades que ESTE contato pode mexer: a que veio no evento, mais
      // as criadas nesta execução.
      const oppsPermitidos = new Set<string>();
      if (typeof event.meta?.oppId === "string") oppsPermitidos.add(event.meta.oppId);

      for (const tc of turn.toolCalls) {
        try {
          did.push(await executarTool(ports.crm, tc, contactId, oppsPermitidos));
        } catch (e) {
          const erro = (e as Error).message;
          did.push(`falhou ${tc.tool}: ${erro}`);
          falhas.push(`${tc.tool}: ${erro}`);
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

    // Tool que falhou não vira execução bem-sucedida (achado A5 da auditoria):
    // antes, o painel mostrava sucesso com o CRM intocado.
    const ok = falhas.length === 0;
    ports.log({
      orgId, agentId, motor: "atendimento", ok,
      resumo: ok ? `atendeu inbound de ${contactId}` : `atendeu com ${falhas.length} falha(s) de ferramenta`,
      did,
      erro: ok ? undefined : falhas.join(" · "),
      at: agora.toISOString(), meta: { contactId, tools: turn.toolCalls?.length ?? 0 },
    });
    return ok ? { ok: true, did } : { ok: false, did, error: falhas.join(" · ") };
  },
};
