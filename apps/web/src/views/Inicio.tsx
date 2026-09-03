import { CheckCircle2, AlertCircle, Wallet, ArrowRight, Sparkles, Radio } from "lucide-react";
import { STATS, type ViewId } from "../data";
import { useAgents } from "../lib/agents";
import { Reveal, Delta, cx } from "../ui";
import { Robot } from "../Robot";

export default function Inicio({ go, onOpen }: { go: (v: ViewId) => void; onOpen: (id: string) => void }) {
  const { agents } = useAgents();
  const ativos = agents.filter((a) => a.state === "ativo").length;
  const feed = agents.filter((a) => a.state === "ativo").slice(0, 4);

  return (
    <div className="space-y-6">
      {/* HERO */}
      <Reveal>
        <div className="grad-border overflow-hidden">
          <div className="relative p-6 md:p-8">
            <div className="aurora !opacity-40" />
            <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="max-w-xl">
                <div className="flex items-center gap-2 mb-3">
                  <span className="live-dot" />
                  <span className="mono-label !text-[var(--emerald)]">{ativos} de {agents.length} agentes trabalhando</span>
                </div>
                <h1 className="font-display text-[29px] md:text-[37px] font-semibold tracking-tight leading-[1.08]">
                  Sua operação está <span className="grad-text">trabalhando sozinha</span>.
                </h1>
                <p className="text-[var(--txt-2)] mt-3 text-[14.5px] leading-relaxed">
                  Uma frota de robôs atende, qualifica, agenda, recupera e rastreia — cada um blindado.
                  Você só observa e, quando quiser, pede uma melhoria.
                </p>
                <div className="flex gap-2 mt-4">
                  <button className="btn btn-primary btn-sm" onClick={() => go("aovivo")}><Radio size={14} /> Ver ao vivo</button>
                  <button className="btn btn-sm" onClick={() => go("agentes")}>Abrir a frota</button>
                </div>
              </div>

              {/* fleet strip */}
              <div className="flex-none">
                <div className="mono-label mb-2.5">A frota</div>
                <div className="flex gap-2">
                  {agents.map((a) => (
                    <button key={a.id} onClick={() => onOpen(a.id)} title={a.name} className="rounded-xl p-1.5 border card-hover" style={{ borderColor: a.state === "ativo" ? `${a.color}30` : "var(--line)", background: a.state === "ativo" ? `${a.color}0d` : "var(--surface)" }}>
                      <Robot state={a.state} color={a.color} size={38} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STATS.map((s, i) => (
          <Reveal key={s.label} delay={0.04 * i}>
            <div className="card card-hover p-4">
              <div className="text-[12.5px] text-[var(--txt-3)] mb-2">{s.label}</div>
              <div className="flex items-end justify-between">
                <div className="num text-[26px] leading-none">{s.value}</div>
                <Delta up={s.up}>{s.delta}</Delta>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      {/* decisões */}
      <div className="grid md:grid-cols-3 gap-4">
        <Reveal delay={0.05}>
          <Decision icon={CheckCircle2} color="#34d399" titulo="Aconteceu" linhas={["774 execuções hoje", "99,3% de acerto", "5 reuniões marcadas"]} />
        </Reveal>
        <Reveal delay={0.1}>
          <div className="card card-hover p-5 h-full" style={{ borderColor: "#fbbf2433", background: "linear-gradient(160deg, rgba(251,191,36,.07), var(--surface))" }}>
            <div className="flex items-center gap-2.5 mb-3">
              <AlertCircle size={18} style={{ color: "#fbbf24" }} />
              <span className="font-display font-semibold text-[15px]">Precisa de você</span>
            </div>
            <ul className="space-y-2 text-[13.5px] text-[var(--txt-2)]">
              <li className="flex gap-2"><b className="text-[var(--txt)]">Recuperador</b> bateu no limite de toques 1×</li>
              <li className="flex gap-2"><b className="text-[var(--txt)]">Contratos</b> está pausado</li>
            </ul>
            <button className="btn btn-sm mt-4 w-full justify-between" onClick={() => go("agentes")}>Abrir a frota <ArrowRight size={15} /></button>
          </div>
        </Reveal>
        <Reveal delay={0.15}>
          <Decision icon={Wallet} color="#8b7cff" titulo="Rendeu" linhas={["R$ 18.400 em oportunidades", "R$ 13,97 de custo no dia", "margem tranquila"]} />
        </Reveal>
      </div>

      {/* ao vivo preview + pedir melhoria */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Reveal delay={0.05} className="lg:col-span-2">
          <div className="card p-5 h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="mono-label">Ao vivo</div>
              <button className="text-[12px] flex items-center gap-1" style={{ color: "#8b7cff" }} onClick={() => go("aovivo")}>ver tudo <ArrowRight size={13} /></button>
            </div>
            <ul className="space-y-1">
              {feed.map((a, i) => (
                <li key={a.id} className={cx("flex items-center gap-3 py-2.5", i !== feed.length - 1 && "border-b border-[var(--line)]")}>
                  <Robot state={a.state} color={a.color} size={30} />
                  <div className="min-w-0 flex-1">
                    <span className="text-[13.5px] text-[var(--txt)]">{a.name}</span>{" "}
                    <span className="text-[13.5px] text-[var(--txt-2)]">{a.agora}</span>
                  </div>
                  <span className="live-dot flex-none" style={{ width: 6, height: 6, background: a.color }} />
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="grad-border h-full">
            <div className="relative p-5 h-full flex flex-col">
              <div className="aurora !h-[40%] !opacity-30" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={17} style={{ color: "#8b7cff" }} />
                  <span className="font-display font-semibold text-[15px]">Quer mudar algo?</span>
                </div>
                <p className="text-[13.5px] text-[var(--txt-2)] leading-relaxed">
                  Escolha um robô e peça em português. A Metrik simula, testa de verdade e te mostra a prova
                  antes de qualquer coisa ir pro ar.
                </p>
              </div>
              <button className="btn btn-primary mt-auto w-full" onClick={() => go("agentes")}>Escolher um agente <ArrowRight size={16} /></button>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

function Decision({ icon: Icon, color, titulo, linhas }: { icon: any; color: string; titulo: string; linhas: string[] }) {
  return (
    <div className="card card-hover p-5 h-full">
      <div className="flex items-center gap-2.5 mb-3">
        <Icon size={18} style={{ color }} />
        <span className="font-display font-semibold text-[15px]">{titulo}</span>
      </div>
      <ul className="space-y-2 text-[13.5px] text-[var(--txt-2)]">
        {linhas.map((l) => (
          <li key={l} className="flex items-start gap-2"><span className="dot mt-1.5" style={{ background: color }} />{l}</li>
        ))}
      </ul>
    </div>
  );
}
