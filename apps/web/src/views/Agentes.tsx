import { Plus, ArrowRight, Radio, Plug, Database } from "lucide-react";
import { STATE_META, type Agent, type ViewId } from "../data";
import { useAgents } from "../lib/agents";
import { useLive } from "../lib/live";
import { useMotorAuth } from "../lib/auth";
import { Reveal, Pill, SectionHeader, SkeletonCard } from "../ui";
import { Robot } from "../Robot";

/** telemetria do dia por agente: real (Flight Recorder) quando existe. */
type Vivo = { execucoes: number; acerto: number } | null;

export default function Agentes({
  onOpen,
  go,
}: {
  onOpen: (id: string) => void;
  go: (v: ViewId) => void;
}) {
  const { agents, source, loading } = useAgents();
  const { stats } = useLive();
  const auth = useMotorAuth();
  const carregandoReal = !auth.demo && loading && agents.length === 0;
  const ativos = agents.filter((a) => a.state === "ativo").length;

  // stats REAIS por agente (só quando o agente veio do banco e tem execução hoje)
  const vivoDe = (a: Agent): Vivo => {
    const p = a.real ? stats?.porAgente?.[a.id] : undefined;
    if (!p) return null;
    return { execucoes: p.execucoes, acerto: Math.round((p.acertos / Math.max(1, p.execucoes)) * 100) };
  };

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="grad-border overflow-hidden">
          <div className="relative p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="aurora !h-[70%] !opacity-30" />
            <div className="relative max-w-xl">
              <div className="mono-label mb-2">A frota que trabalha por você</div>
              <h2 className="font-display text-[21px] md:text-[24px] font-semibold tracking-tight">
                Cada robô é uma habilidade nossa, <span className="grad-text">já pronta e blindada</span>.
              </h2>
              <p className="text-[13.5px] text-[var(--txt-2)] mt-2 leading-relaxed">
                Você liga, observa e afina. Quando estão trabalhando, eles mexem; parados, ficam quietos.
                O que roda por dentro é com a Metrik.
              </p>
            </div>
            <div className="relative flex flex-col items-start md:items-end gap-2">
              <Pill color={source === "neon" ? "#e0a44a" : "#83879a"}>
                <Database size={12} /> {source === "neon" ? "dados reais ✓" : "Demo"}
              </Pill>
              <Pill color="#34d399"><span className="live-dot" style={{ width: 7, height: 7 }} /> {ativos} trabalhando agora</Pill>
            </div>
          </div>
        </div>
      </Reveal>

      <div>
        <SectionHeader label="Sua frota" title={<>Agentes <span className="text-[var(--txt-3)] font-normal">· {agents.length}</span></>} />
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {carregandoReal
            ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} lines={2} h={210} />)
            : agents.map((a, i) => (
                <Reveal key={a.id} delay={0.04 * i}>
                  <AgentCard a={a} vivo={vivoDe(a)} onOpen={() => onOpen(a.id)} />
                </Reveal>
              ))}

          <Reveal delay={0.04 * agents.length}>
            <button
              onClick={() => go("conexoes")}
              className="w-full h-full min-h-[210px] text-left rounded-[18px] p-5 flex flex-col justify-center items-start gap-3"
              style={{ border: "1.5px dashed var(--line-hi)" }}
            >
              <span className="grid place-items-center rounded-[13px]" style={{ width: 42, height: 42, background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                <Plus size={20} style={{ color: "#e0a44a" }} />
              </span>
              <div>
                <div className="font-display font-semibold text-[15px] mb-1">Novo agente</div>
                <p className="text-[12.5px] text-[var(--txt-3)] leading-snug">
                  Instale uma habilidade da loja ou traga a sua pelo Claude Code — vira um robô seu.
                </p>
              </div>
              <span className="text-[12.5px] flex items-center gap-1.5 mt-1" style={{ color: "#e0a44a" }}>
                <Plug size={13} /> Conectar <ArrowRight size={13} />
              </span>
            </button>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function AgentCard({ a, vivo, onOpen }: { a: Agent; vivo: Vivo; onOpen: () => void }) {
  const sm = STATE_META[a.state];
  // real com movimento hoje → números do Flight Recorder; senão o do template/demo
  const execucoes = vivo ? vivo.execucoes : a.metrics.execucoes;
  const acerto = vivo ? vivo.acerto : Math.round((a.metrics.acertos / Math.max(1, a.metrics.execucoes)) * 100);
  const semMovimento = a.real && !vivo;
  return (
    <button onClick={onOpen} className="card card-hover p-5 h-full text-left w-full flex flex-col">
      <div className="flex items-start gap-3.5 mb-4">
        <div className="rounded-2xl p-1.5 flex-none" style={{ background: a.state === "ativo" ? `${a.color}10` : "transparent", border: `1px solid ${a.state === "ativo" ? a.color + "26" : "transparent"}` }}>
          <Robot state={a.state} color={a.color} size={58} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display font-semibold text-[16px] leading-tight">{a.name}</div>
          <p className="text-[12.5px] text-[var(--txt-3)] mt-1 leading-snug">{a.papel}</p>
          <div className="flex items-center gap-1.5 mt-2">
            {a.state === "ativo" ? (
              <span className="live-dot" style={{ width: 7, height: 7, background: sm.color }} />
            ) : (
              <span className="dot" style={{ background: sm.color }} />
            )}
            <span className="text-[11.5px]" style={{ color: sm.color }}>{sm.label}</span>
            {a.tipo && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ color: a.tipo === "acao" ? "#edc074" : "#58aae4", background: (a.tipo === "acao" ? "#edc074" : "#58aae4") + "14", border: `1px solid ${(a.tipo === "acao" ? "#edc074" : "#58aae4")}30` }}>
                {a.tipo === "acao" ? "Ação" : "Resposta"}
              </span>
            )}
          </div>
        </div>
      </div>

      {a.state === "ativo" && (
        <div className="flex items-center gap-2 text-[12px] text-[var(--txt-2)] mb-4 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] px-2.5 py-1.5">
          <Radio size={12} style={{ color: a.color }} className="flex-none" />
          <span className="truncate">{a.agora}</span>
        </div>
      )}

      {semMovimento ? (
        <div className="mt-auto pt-3 border-t border-[var(--line)] text-[12px] text-[var(--txt-3)]">
          de plantão — nenhum atendimento ainda hoje
        </div>
      ) : (
        <div className="mt-auto grid grid-cols-3 gap-2 pt-3 border-t border-[var(--line)]">
          <Metric label="hoje" value={String(execucoes)} />
          <Metric label="acertos" value={`${acerto}%`} />
          <Metric label="custo" value={a.metrics.custo.replace("R$ ", "R$")} />
        </div>
      )}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="num text-[17px] leading-none">{value}</div>
      <div className="mono-label !text-[9px] mt-1">{label}</div>
    </div>
  );
}
