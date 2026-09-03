// Motor de Recuperação / Follow-up — a ESTRELA da biblioteca.
// Cadência real: lê estado (passo + último envio), calcula se já é a hora do
// próximo toque, respeita a janela de horário comercial, monta (Sender) e
// entrega (Transport), incrementa o passo e, ao esgotar, marca o lead.
//
// "Follow-up pros humanos" = ESTE MESMO motor, só que com config.publico="humanos"
// e um canal interno (ex.: uazapi da linha da Metrik / grupo do time). O que muda
// é o PÚBLICO e o CANAL, não a lógica: cobra o vendedor em vez do lead. Por isso
// não existe um "motor de cobrança do time" separado — é o follow-up reconfigurado.

import type {
  MotorEngine,
  MotorManifest,
  MotorPorts,
  MotorResult,
  MotorRunInput,
  FollowupStep,
  LeadRef,
  ConfigField,
} from "@motor/core";

// ── Estado persistido por contato (Redis/Upstash via ports.get/setState) ──
interface FollowupState {
  passo: number;            // índice do PRÓXIMO toque a enviar (0-based)
  ultimoEnvioISO?: string;  // quando o último toque saiu (base do próximo atraso)
}

const CHAVE = (contactId: string) => `fup:${contactId}`;

// Cadência padrão em horas desde o toque anterior (1h, 1d, 3d, 7d…).
const CADENCIA_PADRAO_HORAS = [1, 24, 72, 168];

// ── Coerções seguras de config (o cliente digita; a gente não confia cego) ──
function comoTexto(v: unknown, padrao: string): string {
  return typeof v === "string" && v.trim() ? v : padrao;
}
function comoNumero(v: unknown, padrao: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : padrao;
}
function comoBool(v: unknown, padrao: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "sim" || v === "1";
  return padrao;
}

/** Monta a lista de passos: usa config.passos se vier bem-formada, senão a padrão. */
function resolverCadencia(config: Record<string, unknown> | undefined, maxToques: number): FollowupStep[] {
  const bruto = config?.passos;
  if (Array.isArray(bruto) && bruto.length > 0) {
    const passos = bruto
      .filter((p): p is FollowupStep => !!p && typeof (p as FollowupStep).atrasoHoras === "number")
      .map((p, i) => ({ ...p, indice: typeof p.indice === "number" ? p.indice : i }));
    if (passos.length > 0) return passos.slice(0, maxToques);
  }
  // Cadência padrão, esticada até maxToques (repete o último intervalo se precisar).
  const passos: FollowupStep[] = [];
  for (let i = 0; i < maxToques; i++) {
    const atrasoHoras = CADENCIA_PADRAO_HORAS[i] ?? CADENCIA_PADRAO_HORAS[CADENCIA_PADRAO_HORAS.length - 1];
    passos.push({ indice: i, atrasoHoras });
  }
  return passos;
}

/** "HH:MM" → minutos do dia; -1 se inválido. */
function minutosDoDia(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return -1;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return -1;
  return h * 60 + min;
}

/** True se `agora` está dentro da janela comercial configurada (dias úteis + horário). */
function dentroDaJanela(
  agora: Date,
  cfg: { diasUteis: boolean; janelaInicio: string; janelaFim: string },
): boolean {
  if (cfg.diasUteis) {
    const dia = agora.getDay(); // 0=domingo, 6=sábado
    if (dia === 0 || dia === 6) return false;
  }
  const inicio = minutosDoDia(cfg.janelaInicio);
  const fim = minutosDoDia(cfg.janelaFim);
  // Janela mal configurada → não bloqueia (fail-open no horário, nunca trava o cliente).
  if (inicio < 0 || fim < 0 || inicio >= fim) return true;
  const nowMin = agora.getHours() * 60 + agora.getMinutes();
  return nowMin >= inicio && nowMin <= fim;
}

// ── Manifesto: a TELA se desenha sozinha a partir daqui (botões verdes) ──
const config: ConfigField[] = [
  {
    key: "publico",
    label: "Para quem cobra",
    tipo: "opcoes",
    opcoes: [
      { value: "leads", label: "Leads (recuperação)" },
      { value: "humanos", label: "Time interno (cobrança)" },
    ],
    default: "leads",
    zona: "verde",
    ajuda: "Mesmo motor: 'leads' persegue o contato; 'humanos' cobra o vendedor por um canal interno.",
  },
  {
    key: "canal",
    label: "Canal de envio",
    tipo: "opcoes",
    opcoes: [
      { value: "ghl-native", label: "WhatsApp nativo do GHL" },
      { value: "uazapi-multi", label: "uazapi multi-instância (por vendedor)" },
    ],
    default: "ghl-native",
    zona: "verde",
    ajuda: "uazapi-multi roteia pela linha do dono do lead (ownerId).",
  },
  {
    key: "sender",
    label: "Como monta a mensagem",
    tipo: "opcoes",
    opcoes: [
      { value: "meta-template", label: "Template Meta aprovado" },
      { value: "llm-freeform", label: "IA escreve na hora" },
    ],
    default: "meta-template",
    zona: "verde",
    ajuda: "Fora da janela de 24h da Meta, use template aprovado.",
  },
  {
    key: "maxToques",
    label: "Máximo de toques",
    tipo: "numero",
    default: 4,
    zona: "verde",
    ajuda: "Depois do último toque sem resposta, o lead é abandonado.",
  },
  {
    key: "janelaInicio",
    label: "Início do horário comercial",
    tipo: "horario",
    default: "08:00",
    zona: "verde",
  },
  {
    key: "janelaFim",
    label: "Fim do horário comercial",
    tipo: "horario",
    default: "18:00",
    zona: "verde",
  },
  {
    key: "diasUteis",
    label: "Só em dias úteis",
    tipo: "toggle",
    default: true,
    zona: "verde",
    ajuda: "Sábado e domingo o toque é adiado pro próximo dia útil.",
  },
];

const manifest: MotorManifest = {
  id: "followup",
  titulo: "Recuperação / Follow-up",
  descricao:
    "Persegue quem ghosteou com uma cadência de toques até responder ou esgotar. " +
    "O mesmo motor cobra o time interno quando o público é 'humanos'.",
  work: "followups",
  zona: "verde",
  config,
};

export const followupMotor: MotorEngine = {
  id: "followup",
  nome: "Recuperação / Follow-up",
  trigger: [{ type: "schedule" }, { type: "manual" }],
  manifest,

  async run(input: MotorRunInput, ports: MotorPorts): Promise<MotorResult> {
    const { orgId, agentId, event } = input;
    const agora = ports.now();
    const cfg = input.config ?? {};

    // ── Guardas de ports/entrada: fallback seguro, nunca crasha ──
    const contactId = event.contactId;
    if (!contactId) {
      return { ok: false, did: [], error: "sem contactId no evento" };
    }
    if (!ports.getState || !ports.setState) {
      return { ok: false, did: [], error: "estado indisponível (getState/setState) — não dá pra manter a cadência" };
    }
    if (!ports.sender) {
      return { ok: false, did: [], error: "sender indisponível — não monta a mensagem" };
    }
    if (!ports.transport) {
      return { ok: false, did: [], error: "transport indisponível — não entrega a mensagem" };
    }

    const publico = comoTexto(cfg.publico, "leads");
    const maxToques = Math.max(1, Math.floor(comoNumero(cfg.maxToques, 4)));
    const janela = {
      diasUteis: comoBool(cfg.diasUteis, true),
      janelaInicio: comoTexto(cfg.janelaInicio, "08:00"),
      janelaFim: comoTexto(cfg.janelaFim, "18:00"),
    };

    // ── Lê o estado da cadência deste contato ──
    let estado: FollowupState;
    try {
      const bruto = (await ports.getState(CHAVE(contactId))) as FollowupState | undefined | null;
      estado = bruto && typeof bruto.passo === "number" ? bruto : { passo: 0 };
    } catch (e) {
      return { ok: false, did: [], error: `falha lendo estado: ${(e as Error).message}` };
    }

    const cadencia = resolverCadencia(cfg, maxToques);
    const limite = Math.min(maxToques, cadencia.length);

    // ── Esgotou: já mandamos todos os toques e ninguém respondeu ──
    if (estado.passo >= limite) {
      const did = ["esgotou follow-up"];
      // Só o ESGOTAMENTO do follow abandona o lead (cicatriz: nada mais fecha sozinho).
      // Para 'humanos' (cobrança do time) não faz sentido "abandonar" o contato.
      if (ports.crm && publico !== "humanos") {
        try {
          await ports.crm.addTag(contactId, "abandonado");
          did.push("tag: abandonado");
        } catch (e) {
          ports.log({
            orgId, agentId, motor: "followup", ok: false,
            resumo: "esgotou mas falhou ao marcar abandonado",
            erro: (e as Error).message, at: agora.toISOString(),
          });
        }
      }
      ports.log({
        orgId, agentId, motor: "followup", ok: true,
        resumo: `follow-up esgotado após ${limite} toques`,
        did, at: agora.toISOString(), meta: { contactId, publico },
      });
      return { ok: true, did };
    }

    // ── Passo atual e checagem de "já é a hora?" ──
    const step = cadencia[estado.passo];
    const baseISO = estado.ultimoEnvioISO ?? event.at ?? agora.toISOString();
    const base = new Date(baseISO);
    const vencimento = new Date(base.getTime() + step.atrasoHoras * 3600_000);

    if (agora < vencimento) {
      const faltamMin = Math.round((vencimento.getTime() - agora.getTime()) / 60000);
      return { ok: true, did: [`aguardando: toque ${estado.passo + 1} vence em ~${faltamMin}min`] };
    }

    // ── É a hora, mas fora da janela comercial → adia ──
    if (!dentroDaJanela(agora, janela)) {
      return { ok: true, did: ["adiado: fora da janela"] };
    }

    // ── Monta (Sender) e entrega (Transport) ──
    const lead: LeadRef = {
      contactId,
      nome: typeof event.meta?.nome === "string" ? (event.meta.nome as string) : undefined,
      telefone: typeof event.meta?.telefone === "string" ? (event.meta.telefone as string) : undefined,
      ownerId: typeof event.meta?.ownerId === "string" ? (event.meta.ownerId as string) : undefined,
      estado: { passo: estado.passo, publico },
    };

    try {
      const message = await ports.sender.build({ lead, step });
      const to = lead.telefone ?? contactId;
      const resultado = await ports.transport.send({ orgId, to, message, ownerId: lead.ownerId });

      if (!resultado.ok) {
        ports.log({
          orgId, agentId, motor: "followup", ok: false,
          resumo: `falha ao enviar toque ${estado.passo + 1}`,
          erro: resultado.error ?? "transport retornou ok:false",
          at: agora.toISOString(), meta: { contactId },
        });
        return { ok: false, did: [], error: resultado.error ?? "envio falhou" };
      }

      // Envio ok → avança a cadência.
      const novo: FollowupState = { passo: estado.passo + 1, ultimoEnvioISO: agora.toISOString() };
      await ports.setState(CHAVE(contactId), novo);

      const did = [`enviado toque ${estado.passo + 1}/${limite}`];
      ports.log({
        orgId, agentId, motor: "followup", ok: true,
        resumo: `toque ${estado.passo + 1} enviado (${publico})`,
        did, at: agora.toISOString(),
        meta: { contactId, providerId: resultado.providerId, publico },
      });
      return { ok: true, did };
    } catch (e) {
      const erro = (e as Error).message;
      ports.log({
        orgId, agentId, motor: "followup", ok: false,
        resumo: "erro montando/enviando follow-up", erro,
        at: agora.toISOString(), meta: { contactId },
      });
      return { ok: false, did: [], error: erro };
    }
  },
};
