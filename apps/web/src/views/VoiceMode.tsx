import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Mic, Sparkles, Check, ShieldCheck } from "lucide-react";
import type { Agent } from "../data";
import { Robot } from "../Robot";

type Fase = "pronto" | "ouvindo" | "pensando" | "falando";

const ROUNDS: { voce: string; ele: string; verdict: { custo: string; viavel: string; loucura: string } | null }[] = [
  {
    voce: "Quero deixar o follow-up mais leve, tá insistente demais.",
    ele: "Boa ideia. Dá pra baixar de 3 pra 2 toques e suavizar o segundo. Antes de aplicar: é barato e seguro, não é loucura nenhuma. Quer que eu prepare?",
    verdict: { custo: "~R$ 0,02 por lead", viavel: "sim, tranquilo", loucura: "não — ajuste seguro" },
  },
  {
    voce: "Pode fazer.",
    ele: "Fechado. Preparei o rascunho — é só simular, testar e aprovar. Nada foi pro ar ainda.",
    verdict: null,
  },
];

const EMO: Record<Fase, { color: string; label: string }> = {
  pronto: { color: "#8b7cff", label: "toque pra falar" },
  ouvindo: { color: "#22d3ee", label: "te ouvindo…" },
  pensando: { color: "#a78bfa", label: "entendendo…" },
  falando: { color: "#34d399", label: "respondendo" },
};

export default function VoiceMode({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const [fase, setFase] = useState<Fase>("pronto");
  const [round, setRound] = useState(0);
  const [turnos, setTurnos] = useState<{ from: "voce" | "ele"; text: string }[]>([]);
  const [verdict, setVerdict] = useState<ROUNDS_VERDICT>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      timers.current.forEach((t) => clearTimeout(t));
    };
  }, [onClose]);

  const emo = EMO[fase];
  const ativo = fase === "ouvindo" || fase === "falando";

  const falar = () => {
    if (fase !== "pronto" || round >= ROUNDS.length) return;
    const r = ROUNDS[round];
    setVerdict(null);
    setFase("ouvindo");
    timers.current.push(window.setTimeout(() => {
      setTurnos((t) => [...t, { from: "voce", text: r.voce }]);
      setFase("pensando");
    }, 2000));
    timers.current.push(window.setTimeout(() => {
      setFase("falando");
      setTurnos((t) => [...t, { from: "ele", text: r.ele }]);
    }, 3200));
    timers.current.push(window.setTimeout(() => {
      setFase("pronto");
      if (r.verdict) setVerdict(r.verdict);
      setRound((n) => n + 1);
    }, 6400));
  };

  return (
    <motion.div className="fixed inset-0 z-[60] flex flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0" style={{ background: "rgba(4,4,8,.86)", backdropFilter: "blur(14px)" }} onClick={onClose} />
      <div className="absolute left-1/2 top-[36%] -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-full" style={{ width: 520, height: 520, filter: "blur(64px)", opacity: ativo ? 0.5 : 0.26, background: `radial-gradient(circle, ${emo.color}, transparent 70%)`, transition: "opacity .4s, background .5s" }} />

      <div className="relative flex-1 flex flex-col items-center justify-center px-5 max-w-[560px] mx-auto w-full">
        <div className="absolute top-5 left-0 right-0 flex items-center justify-between">
          <div>
            <div className="mono-label">modo voz</div>
            <div className="font-display font-semibold text-[15px]">{agent.name}</div>
          </div>
          <button onClick={onClose} className="btn btn-ghost !p-2" aria-label="Fechar"><X size={18} /></button>
        </div>

        {/* robô reativo */}
        <div className="relative grid place-items-center mb-3" style={{ width: 220, height: 220 }}>
          <div className="absolute rounded-full" style={{ width: 200, height: 200, border: `1px solid ${emo.color}30`, boxShadow: ativo ? `0 0 60px -4px ${emo.color}` : "none", transition: ".4s" }} />
          <Robot state="ativo" color={emo.color} size={148} speaking={fase === "falando"} />
        </div>

        {/* waveform */}
        <div className={`vwave ${ativo ? "on" : ""}`} style={{ ["--wc" as any]: emo.color }}>
          {Array.from({ length: 28 }).map((_, i) => (
            <span key={i} className="vbar" style={{ animationDelay: `${(i % 7) * 0.08}s` }} />
          ))}
        </div>

        <div className="mono-label mt-3" style={{ color: emo.color }}>{emo.label}</div>

        {/* transcript */}
        <div className="w-full mt-4 space-y-2 max-h-[24vh] overflow-y-auto scroll-thin">
          {turnos.slice(-4).map((t, i) => (
            <div key={i} className={t.from === "voce" ? "flex justify-end" : "flex justify-start"}>
              <div className="max-w-[82%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed" style={t.from === "ele" ? { background: `${emo.color}14`, border: `1px solid ${emo.color}2e` } : { background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                {t.text}
              </div>
            </div>
          ))}
        </div>

        {/* verdict: custo / viável / é loucura — ANTES de aplicar */}
        {verdict && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full mt-3 card p-4" style={{ borderColor: "#8b7cff2e" }}>
            <div className="flex items-center gap-2 mb-2.5"><Sparkles size={15} style={{ color: "#8b7cff" }} /><span className="font-display font-semibold text-[13.5px]">Antes de mexer</span></div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <VItem label="custo" v={verdict.custo} c="#34d399" />
              <VItem label="viável?" v={verdict.viavel} c="#34d399" />
              <VItem label="é loucura?" v={verdict.loucura} c="#8b7cff" />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary btn-sm flex-1" onClick={() => setVerdict(null)}><Check size={14} /> Pode fazer</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setVerdict(null)}>Espera</button>
            </div>
          </motion.div>
        )}
      </div>

      {/* mic */}
      <div className="relative pb-8 pt-2 flex flex-col items-center gap-2">
        <button onClick={falar} disabled={fase !== "pronto"} className="grid place-items-center rounded-full transition-all focus-ring" style={{ width: 66, height: 66, background: fase === "ouvindo" ? emo.color : "var(--grad)", boxShadow: `0 12px 40px -8px ${emo.color}`, opacity: fase !== "pronto" ? 0.7 : 1 }} aria-label="Falar">
          <Mic size={25} style={{ color: "#0a0714" }} />
        </button>
        <div className="text-[11px] text-[var(--txt-4)] flex items-center gap-1.5 text-center px-6">
          <ShieldCheck size={12} style={{ color: "#34d399" }} className="flex-none" /> a voz custa mais que texto — sessão curta, e ele avisa o custo antes de mexer
        </div>
      </div>

      <style>{`
        .vwave{ display:flex; align-items:center; gap:3px; height:32px; }
        .vwave .vbar{ width:3px; height:6px; border-radius:99px; background:var(--wc); opacity:.4; transition:opacity .3s; }
        .vwave.on .vbar{ animation: vwave .7s ease-in-out infinite; opacity:.9; }
        @keyframes vwave{ 0%,100%{ height:6px } 50%{ height:26px } }
        @media (prefers-reduced-motion: reduce){ .vwave.on .vbar{ animation:none } }
      `}</style>
    </motion.div>
  );
}

type ROUNDS_VERDICT = { custo: string; viavel: string; loucura: string } | null;

function VItem({ label, v, c }: { label: string; v: string; c: string }) {
  return (
    <div className="rounded-lg p-2.5" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
      <div className="mono-label !text-[8.5px] mb-1">{label}</div>
      <div className="text-[12px] font-medium leading-snug" style={{ color: c }}>{v}</div>
    </div>
  );
}
