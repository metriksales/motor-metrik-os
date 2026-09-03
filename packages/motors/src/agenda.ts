// Motor de Agenda — marca a reunião no CRM/calendário do tenant.
// Gatilhos: manual (o vendedor/IA pede) ou stage (entrou numa etapa que agenda).

import type {
  MotorEngine,
  MotorManifest,
  MotorPorts,
  MotorResult,
  MotorRunInput,
  ConfigField,
} from "@motor/core";

function comoTexto(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}
function comoNumero(v: unknown, padrao: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : padrao;
}

const config: ConfigField[] = [
  {
    key: "calendarId",
    label: "Calendário de destino",
    tipo: "texto",
    zona: "amarelo", // mexe em recurso externo (agenda real) → risco médio
    ajuda: "ID do calendário no GHL/GCal onde o evento é criado.",
  },
  {
    key: "antecedenciaHoras",
    label: "Lembrete (horas antes)",
    tipo: "numero",
    default: 1,
    zona: "verde",
    ajuda: "Cria uma tarefa de lembrete X horas antes da reunião.",
  },
];

const manifest: MotorManifest = {
  id: "agenda",
  titulo: "Agenda",
  descricao: "Marca a reunião no calendário do tenant e deixa um lembrete pro dono do lead.",
  work: "agenda",
  zona: "amarelo",
  config,
};

export const agendaMotor: MotorEngine = {
  id: "agenda",
  nome: "Agenda",
  trigger: [{ type: "manual" }, { type: "stage" }],
  manifest,

  async run(input: MotorRunInput, ports: MotorPorts): Promise<MotorResult> {
    const { orgId, agentId, event } = input;
    const agora = ports.now();
    const cfg = input.config ?? {};

    const contactId = event.contactId;
    if (!contactId) {
      return { ok: false, did: [], error: "sem contactId no evento" };
    }
    if (!ports.crm) {
      return { ok: false, did: [], error: "crm indisponível — não dá pra agendar" };
    }

    // `quando` vem da config (ex.: horário escolhido pelo lead); senão, agora.
    const quando = comoTexto(cfg.quando) ?? agora.toISOString();
    const calendarId = comoTexto(cfg.calendarId);
    const antecedenciaHoras = comoNumero(cfg.antecedenciaHoras, 1);

    try {
      const { eventId } = await ports.crm.agendar({ contactId, quando, calendarId });
      const did = [`agendado: ${quando}`, `evento: ${eventId}`];

      // Lembrete antes da reunião (não bloqueia o agendamento se falhar).
      if (antecedenciaHoras > 0) {
        const lembreteISO = new Date(new Date(quando).getTime() - antecedenciaHoras * 3600_000).toISOString();
        try {
          await ports.crm.criarTarefa(contactId, "Lembrete: reunião agendada", lembreteISO);
          did.push(`lembrete: ${antecedenciaHoras}h antes`);
        } catch (e) {
          ports.log({
            orgId, agentId, motor: "agenda", ok: false,
            resumo: "agendou mas falhou o lembrete",
            erro: (e as Error).message, at: agora.toISOString(), meta: { contactId, eventId },
          });
        }
      }

      ports.log({
        orgId, agentId, motor: "agenda", ok: true,
        resumo: `reunião agendada (${quando})`, did,
        at: agora.toISOString(), meta: { contactId, eventId, calendarId },
      });
      return { ok: true, did };
    } catch (e) {
      const erro = (e as Error).message;
      ports.log({
        orgId, agentId, motor: "agenda", ok: false,
        resumo: "falha ao agendar", erro, at: agora.toISOString(), meta: { contactId },
      });
      return { ok: false, did: [], error: erro };
    }
  },
};
