// CONVERSAS — o KIT DO AGENTE (mora DENTRO do robô de resposta, não no app).
// As conversas DESTE agente: logs reais com did.lead/did.ia agrupados por
// contato, chip "com você" nas assumidas, e a ConversaDrawer — onde vive o
// botão de emergência "Assumir a conversa". Leitura + 1 ação de emergência.
import { useEffect, useMemo, useState } from "react";
import { MessageCircleHeart, Headphones, Database } from "lucide-react";
import { type Agent } from "../data";
import { useLive, tempoRelativo, type LogReal } from "../lib/live";
import { useMotorAuth } from "../lib/auth";
import { api } from "../lib/api";
import { Reveal, Pill } from "../ui";
import ConversaDrawer, { type ConversaAberta } from "./ConversaDrawer";

type Fio = {
  chave: string;
  contato: string;
  agentId: string | null;
  agente: string;
  cor: string;
  snippet: string;
  at: string;
  log: LogReal;
  comVoce: boolean;
};

const DEMO_FIOS: { contato: string; snippet: string; quando: string }[] = [
  { contato: "Marina Duarte", snippet: "IA: Pra te passar o valor certo: hoje o atendimento é você mesma ou tem equipe?", quando: "há 2 min" },
  { contato: "Beatriz Nunes", snippet: "reunião marcada pra quinta, 14h — confirmação enviada", quando: "há 40 min" },
  { contato: "Dona Cléia", snippet: "IA: Seu caso tem tudo pra seguir! Já deixo um horário reservado com a doutora.", quando: "há 1 h" },
];

export default function Conversas({ agent }: { agent: Agent }) {
  const auth = useMotorAuth();
  const { logs } = useLive();
  const [aberta, setAberta] = useState<ConversaAberta | null>(null);
  const [assumidos, setAssumidos] = useState<Set<string>>(new Set());

  // quem está COM VOCÊ agora (assumidos DESTE agente) — falha não derruba
  useEffect(() => {
    if (auth.demo || !agent.real) return;
    let vivo = true;
    (api.listAssumidos(agent.id, auth.getToken) as Promise<{ agentId: string; contato: string }[]>)
      .then((rows) => {
        if (vivo && Array.isArray(rows)) setAssumidos(new Set(rows.map((r) => `${r.agentId}:${r.contato}`)));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.demo, agent.id, aberta]);

  // agrupa os logs REAIS DESTE agente por conversa (contactId, ou o nome espelhado)
  const fios: Fio[] = useMemo(() => {
    const out = new Map<string, Fio>();
    for (const l of logs ?? []) {
      if (l.agentId !== agent.id) continue; // o kit é DO agente
      const did = (l.did ?? null) as { contato?: string; lead?: string; ia?: string } | null;
      // conversa DE VERDADE = tem fala espelhada (lead/ia). Erros e ações sem
      // texto moram no Diário/Ao vivo — aqui é só o que dá pra LER.
      const temConversa = !!(did && (did.lead || did.ia));
      if (!temConversa) continue;
      const contactId = l.meta?.contactId ?? null;
      const contato = did?.contato || "lead";
      const chave = `${l.agentId ?? "?"}:${contactId ?? contato}`;
      if (out.has(chave)) continue; // logs vêm do mais novo pro mais velho
      out.set(chave, {
        chave,
        contato,
        agentId: l.agentId,
        agente: agent.name,
        cor: agent.color,
        snippet: did?.ia ? `IA: ${did.ia}` : did?.lead ? `Lead: ${did.lead}` : l.resumo,
        at: l.at,
        log: l,
        comVoce: contactId != null && assumidos.has(`${l.agentId}:${contactId}`),
      });
    }
    return Array.from(out.values());
  }, [logs, assumidos, agent.id, agent.name, agent.color]);

  const real = fios.length > 0;
  const semNada = !real && !auth.demo;

  return (
    <div className="space-y-4">
      {semNada ? (
        <Reveal>
          <div className="card p-8 text-center">
            <MessageCircleHeart size={26} className="mx-auto mb-3" style={{ color: "var(--txt-4)" }} />
            <p className="text-[13.5px] text-[var(--txt)] font-medium">Ainda sem conversas espelhadas.</p>
            <p className="text-[12px] text-[var(--txt-3)] mt-1.5 max-w-md mx-auto leading-relaxed">
              Assim que este robô atender, cada conversa aparece aqui — palavra por palavra, com o botão de assumir quando você precisar.
            </p>
          </div>
        </Reveal>
      ) : (
        <Reveal>
          <div className="card">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--line)]">
              <span className="mono-label !text-[9px]">Conversas — toque pra ler por dentro</span>
              <Pill color={real ? "var(--emerald)" : undefined}>
                {real ? <Database size={11} /> : <span className="live-dot" style={{ width: 6, height: 6 }} />}
                {real ? "dado real ✓" : "demo"}
              </Pill>
            </div>
            <ul>
              {(real
                ? fios.map((f) => ({
                    key: f.chave,
                    contato: f.contato,
                    agente: f.agente,
                    cor: f.cor,
                    snippet: f.snippet,
                    quando: `há ${tempoRelativo(f.at)}`,
                    comVoce: f.comVoce,
                    abrir: () => setAberta({ tipo: "real", log: f.log, agente: f.agente, cor: f.cor }),
                  }))
                : DEMO_FIOS.map((f, i) => ({
                    key: `demo-${i}`,
                    contato: f.contato,
                    agente: agent.name,
                    cor: agent.color,
                    snippet: f.snippet,
                    quando: f.quando,
                    comVoce: false,
                    abrir: () => setAberta({ tipo: "demo", agente: agent.name, cor: agent.color }),
                  }))
              ).map((f) => (
                <li key={f.key} className="border-b border-[var(--line)] last:border-0">
                  <button onClick={f.abrir} className="w-full text-left flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--surface-2)] transition-colors">
                    <span
                      className="grid place-items-center rounded-full flex-none font-medium text-[14px]"
                      style={{ width: 40, height: 40, background: `${f.cor}14`, color: f.cor, border: `1px solid ${f.cor}30` }}
                    >
                      {f.contato.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <b className="text-[13.5px] font-semibold truncate">{f.contato}</b>
                        {f.comVoce && (
                          <span className="inline-flex items-center gap-1 text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full flex-none" style={{ color: "#fbbf24", background: "rgba(251,191,36,.1)", border: "1px solid rgba(251,191,36,.3)" }}>
                            <Headphones size={9} /> com você
                          </span>
                        )}
                      </span>
                      <span className="block text-[11.5px] text-[var(--txt-3)] truncate mt-0.5">{f.snippet}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1 flex-none">
                      <span className="tick">{f.quando}</span>
                      <span className="text-[9.5px] text-[var(--txt-4)]">{f.agente}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      )}

      <ConversaDrawer aberta={aberta} onClose={() => setAberta(null)} />
    </div>
  );
}
