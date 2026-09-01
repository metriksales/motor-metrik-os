import { Radio, Check, X, Loader2, ArrowRight } from "lucide-react";
import { AGENTS, STATS, type LiveRow } from "../data";
import { Reveal, cx } from "../ui";
import { Robot } from "../Robot";

type FeedRow = LiveRow & { agente: string; color: string; id: string };

const FEED: FeedRow[] = AGENTS.flatMap((a) =>
  a.live.map((r, i) => ({ ...r, agente: a.name, color: a.color, id: `${a.id}-${i}` }))
).sort((x, y) => (x.status === "run" ? -1 : 0) - (y.status === "run" ? -1 : 0));

const statusMeta = {
  ok: { icon: Check, color: "#34d399", label: "acerto" },
  erro: { icon: X, color: "#fb7185", label: "erro" },
  run: { icon: Loader2, color: "#8b7cff", label: "rodando" },
} as const;

export default function AoVivo({ onOpen }: { onOpen: (id: string) => void }) {
  const ativos = AGENTS.filter((a) => a.state === "ativo");

  return (
    <div className="space-y-6">
      {/* counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STATS.map((s, i) => (
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
              <span className="pill"><span className="live-dot" style={{ width: 6, height: 6 }} /> tempo real</span>
            </div>
            <ul className="space-y-1">
              {FEED.map((r, i) => {
                const st = statusMeta[r.status];
                return (
                  <li key={r.id} className={cx("flex items-center gap-3 py-2.5", i !== FEED.length - 1 && "border-b border-[var(--line)]")}>
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
                    <span className="tick flex-none">{r.t}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </Reveal>

        {/* trabalhando agora */}
        <Reveal delay={0.1}>
          <div className="card p-5 h-full">
            <div className="mono-label mb-4">Trabalhando agora</div>
            <div className="space-y-2.5">
              {ativos.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onOpen(a.id)}
                  className="w-full text-left rounded-xl border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-2)] hover:border-[var(--line-hi)] transition-all p-2.5 flex items-center gap-3 group"
                >
                  <Robot state={a.state} color={a.color} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium">{a.name}</span>
                      <Typing color={a.color} />
                    </div>
                    <div className="text-[11.5px] text-[var(--txt-3)] truncate mt-0.5">{a.agora}</div>
                  </div>
                  <ArrowRight size={15} className="text-[var(--txt-4)] flex-none opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[var(--line)] text-[11.5px] text-[var(--txt-4)]">
              <Radio size={13} /> clique num robô pra ver por dentro
            </div>
          </div>
        </Reveal>
      </div>
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
