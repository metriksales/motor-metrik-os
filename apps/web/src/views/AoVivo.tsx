import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Radio, Loader2, ArrowRight, Database, MessageSquareText } from "lucide-react";
import { AGENTS, STATS, type LiveRow, SELO_META, conferir } from "../data";
import { useAgents } from "../lib/agents";
import { useLive, tempoRelativo, reais, kpiDinheiro, type LogReal } from "../lib/live";
import { useMotorAuth } from "../lib/auth";
import { Reveal, Skeleton, cx } from "../ui";
import { Robot } from "../Robot";
import ConversaDrawer, { type ConversaAberta } from "./ConversaDrawer";

type FeedRow = LiveRow & { agente: string; color: string; id: string; valorCentavos?: number | null; raw?: LogReal };

const FEED: FeedRow[] = AGENTS.flatMap((a) =>
  a.live.map((r, i) => ({ ...r, agente: a.name, color: a.color, id: `${a.id}-${i}` }))
).sort((x, y) => (x.status === "run" ? -1 : 0) - (y.status === "run" ? -1 : 0));

/** minutos desde o log — pros pontinhos de "digitando" só piscarem se é AGORA */
function minutosDesde(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 60_000;
}

export default function AoVivo({ onOpen }: { onOpen: (id: string) => void }) {
  const { agents } = useAgents();
  const { logs, stats, carregando } = useLive();
  const auth = useMotorAuth();
  const ativos = agents.filter((a) => a.state === "ativo");
  const real = logs !== null;
  const carregandoReal = !auth.demo && carregando && logs === null;

  // só linha NOVA (chegou num poll depois do 1º paint) ganha entrada animada —
  // a recompensa variável é ver o trabalho ENTRAR, não a lista inteira piscar.
  const vistos = useRef<Set<string> | null>(null);
  const [conversa, setConversa] = useState<ConversaAberta | null>(null);

  // Feed REAL (Flight Recorder no Neon) quando existe; senão o demo — com selo.
  const feed: FeedRow[] = logs
    ? logs.slice(0, 14).map((l) => {
        const a = agents.find((x) => x.id === l.agentId);
        return {
          t: tempoRelativo(l.at),
          acao: l.resumo,
          status: l.ok ? ("ok" as const) : ("erro" as const),
          detalhe: l.erro ?? undefined,
          valorCentavos: l.valorCentavos,
          agente: a?.name ?? l.motor ?? "motor",
          color: a?.color ?? "#3b82f6",
          id: l.id,
          raw: l,
        };
      })
    : FEED;

  // último trabalho REAL por agente — mata a "Marina" congelada do mock
  const ultimoPorAgente = new Map<string, LogReal>();
  for (const l of logs ?? []) {
    if (l.agentId && !ultimoPorAgente.has(l.agentId)) ultimoPorAgente.set(l.agentId, l);
  }

  // marca o que já foi visto DEPOIS do paint — o 1º render nunca anima em massa
  useEffect(() => {
    if (vistos.current === null) vistos.current = new Set();
    for (const r of feed) vistos.current.add(r.id);
  });

  const dinheiro = stats ? kpiDinheiro(stats) : null;
  const tiles: { label: string; value: string }[] = stats && dinheiro
    ? [
        { label: "Agentes no ar", value: String(ativos.length) },
        { label: "Atendimentos hoje", value: String(stats.execucoes) },
        { label: "Acertos", value: stats.taxa != null ? `${Math.round(stats.taxa * 100)}%` : "—" },
        { label: dinheiro.label, value: dinheiro.value },
      ]
    : STATS;

  return (
    <div className="space-y-6">
      {/* counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {carregandoReal
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-4">
                <Skeleton style={{ width: "55%", height: 11 }} />
                <Skeleton className="mt-3" style={{ width: "40%", height: 24 }} />
              </div>
            ))
          : tiles.map((s, i) => (
              <Reveal key={s.label} delay={0.04 * i}>
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {i === 0 && <span className="live-dot" style={{ width: 7, height: 7 }} />}
                    <span className="text-[12px] text-[var(--txt-3)]">{s.label}</span>
                  </div>
                  <div className="num text-[26px] leading-none">{s.value}</div>
                </div>
              </Reveal>
            ))}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
        {/* fluxo */}
        <Reveal delay={0.05}>
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="mono-label mb-1">Fluxo ao vivo</div>
                <div className="font-display font-semibold text-[15px]">O que a frota fez agora</div>
              </div>
              <span className="pill" style={real ? { color: "var(--emerald)" } : undefined}>
                {real ? <Database size={11} /> : <span className="live-dot" style={{ width: 6, height: 6 }} />}
                {real ? "dado real ✓" : "demo"}
              </span>
            </div>
            {carregandoReal ? (
              <ul className="space-y-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <li key={i} className="flex items-center gap-3 py-2.5">
                    <Skeleton className="!rounded-lg" style={{ width: 28, height: 28 }} />
                    <div className="flex-1">
                      <Skeleton style={{ width: `${70 - i * 6}%`, height: 12 }} />
                      <Skeleton className="mt-1.5" style={{ width: 90, height: 9 }} />
                    </div>
                    <Skeleton style={{ width: 34, height: 9 }} />
                  </li>
                ))}
              </ul>
            ) : (
            <ul className="space-y-1">
              {feed.map((r, i) => {
                  const conf = conferir(r);
                  const st = r.status === "run" ? { icon: Loader2, color: "#3b82f6" } : { icon: SELO_META[conf.veredito].icon, color: SELO_META[conf.veredito].cor };
                  const dinheiroLinha = (r.valorCentavos ?? 0) > 0;
                  const nova = vistos.current !== null && !vistos.current.has(r.id);
                  const abrir = () =>
                    setConversa(
                      r.raw
                        ? { tipo: "real", log: r.raw, agente: r.agente, cor: r.color, conf: r.conferencia }
                        : { tipo: "demo", agente: r.agente, cor: r.color, conf: r.conferencia }
                    );
                  return (
                    <motion.li
                      key={r.id}
                      onClick={abrir}
                      role="button"
                      initial={nova ? { opacity: 0, y: -12, backgroundColor: "rgba(59,130,246,.14)" } : false}
                      animate={{ opacity: 1, y: 0, backgroundColor: "rgba(0,0,0,0)" }}
                      transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1], backgroundColor: { duration: 2 } }}
                      className={cx(
                        "group flex items-center gap-3 py-2.5 rounded-lg px-1 -mx-1 cursor-pointer hover:bg-[var(--surface-2)] transition-colors",
                        i !== feed.length - 1 && "border-b border-[var(--line)]"
                      )}
                      style={dinheiroLinha ? { boxShadow: "inset 3px 0 0 var(--emerald)" } : undefined}
                    >
                      <span className="grid place-items-center rounded-lg flex-none" style={{ width: 28, height: 28, background: `${st.color}16`, border: `1px solid ${st.color}30` }}>
                        <st.icon size={14} style={{ color: st.color }} className={r.status === "run" ? "animate-spin" : ""} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] text-[var(--txt)] truncate">{r.acao}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="dot" style={{ width: 6, height: 6, background: r.color }} />
                          <span className="text-[11px] text-[var(--txt-3)]">{r.agente}</span>
                          {r.detalhe && <span className="text-[11px] text-[var(--txt-4)]">· {r.detalhe}</span>}
                        </div>
                      </div>
                      {dinheiroLinha && (
                        <span
                          className="flex-none text-[11.5px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ color: "var(--emerald)", background: "rgba(63,185,80,.12)", border: "1px solid rgba(63,185,80,.3)", boxShadow: "0 0 14px -4px rgba(63,185,80,.5)" }}
                        >
                          +{reais(r.valorCentavos)}
                        </span>
                      )}
                      <MessageSquareText size={13} className="flex-none text-[var(--txt-4)] opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className="tick flex-none">{r.t}</span>
                    </motion.li>
                  );
                })}
            </ul>
            )}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--line)] text-[11.5px] text-[var(--txt-4)]">
              <MessageSquareText size={13} /> clique numa linha pra ler a conversa que a IA teve
            </div>
          </div>
        </Reveal>

        {/* trabalhando agora */}
        <Reveal delay={0.1}>
          <div className="card p-5 h-full">
            <div className="mono-label mb-4">Trabalhando agora</div>
            <div className="space-y-2.5">
              {ativos.map((a) => {
                const ultimo = ultimoPorAgente.get(a.id);
                // real: fala do último trabalho DE VERDADE; sem log = de plantão.
                const linha = real
                  ? ultimo
                    ? `há ${tempoRelativo(ultimo.at)} — ${ultimo.resumo}`
                    : "de plantão — aguardando o próximo lead"
                  : a.agora;
                const digitando = real ? (ultimo ? minutosDesde(ultimo.at) < 10 : false) : true;
                return (
                  <button
                    key={a.id}
                    onClick={() => onOpen(a.id)}
                    className="w-full text-left rounded-xl border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-2)] hover:border-[var(--line-hi)] transition-all p-2.5 flex items-center gap-3 group"
                  >
                    <Robot state={a.state} color={a.color} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium">{a.name}</span>
                        {digitando && <Typing color={a.color} />}
                      </div>
                      <div className="text-[11.5px] text-[var(--txt-3)] truncate mt-0.5">{linha}</div>
                    </div>
                    <ArrowRight size={15} className="text-[var(--txt-4)] flex-none opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[var(--line)] text-[11.5px] text-[var(--txt-4)]">
              <Radio size={13} /> clique num robô pra ver por dentro
            </div>
          </div>
        </Reveal>
      </div>

      <ConversaDrawer aberta={conversa} onClose={() => setConversa(null)} />
    </div>
  );
}

function Typing({ color }: { color: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="rounded-full animate-pulse" style={{ width: 3.5, height: 3.5, background: color, animationDelay: `${i * 0.18}s` }} />
      ))}
    </span>
  );
}
