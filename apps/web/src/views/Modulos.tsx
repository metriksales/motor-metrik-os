import { useMemo, useState } from "react";
import { ArrowRight, Zap, Blocks, Bot, Plug, Check } from "lucide-react";
import { MODULOS, type Modulo, type ViewId } from "../data";
import { Reveal, IconBox, Pill, SectionHeader, cx } from "../ui";

type Filtro = "todos" | "instalados" | "novos";
type Sub = "trabalho" | "aovivo" | "estrutura" | "melhorar";

// pra QUAL agente cada módulo encaixa (o sistema já deixa certo — nada liga no lugar errado)
const COMPAT: Record<string, { id: string; label: string }> = {
  m1: { id: "atendente", label: "Atendente" },
  m2: { id: "recuperador", label: "Recuperador" },
  m3: { id: "atendente", label: "Atendente" },
  m4: { id: "qualificador", label: "Qualificador" },
  m5: { id: "contratos", label: "Contratos" },
  m6: { id: "rastreador", label: "Rastreador" },
  m7: { id: "auditor", label: "Auditor de Funil" },
  m8: { id: "atendente", label: "Atendente" },
};

export default function Modulos({
  go,
  onOpen,
}: {
  go: (v: ViewId) => void;
  onOpen: (id: string, sub?: Sub) => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const lista = useMemo(() => {
    if (filtro === "instalados") return MODULOS.filter((m) => m.installed);
    if (filtro === "novos") return MODULOS.filter((m) => m.tag === "novo");
    return MODULOS;
  }, [filtro]);

  const instaladas = MODULOS.filter((m) => m.installed).length;
  const filtros: { id: Filtro; label: string }[] = [
    { id: "todos", label: "Todas" },
    { id: "instalados", label: `Em uso · ${instaladas}` },
    { id: "novos", label: "Novidades" },
  ];

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="grad-border overflow-hidden">
          <div className="relative p-5 md:p-6">
            <div className="aurora !h-[70%] !opacity-30" />
            <div className="relative flex items-start gap-3">
              <Blocks size={20} style={{ color: "#e0a44a" }} className="flex-none mt-0.5" />
              <div>
                <p className="text-[13.5px] text-[var(--txt-2)] max-w-2xl">
                  <b className="text-[var(--txt)]">Módulos são habilidades simples que entram DENTRO de um agente.</b> Cada
                  um já vem marcado pra <b className="text-[var(--txt)]">qual agente encaixa</b> — nada liga no lugar errado.
                  Clique num e você vai direto pro agente certo pra ligar.
                </p>
                <div className="flex flex-wrap gap-2 mt-2.5">
                  <Pill color="#34d399"><Check size={12} /> prontos da Metrik</Pill>
                  <Pill color="#e0a44a"><Plug size={12} /> ou traga o seu pelo Claude</Pill>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <div>
        <SectionHeader
          label="Loja de habilidades"
          title="Módulos"
          right={
            <div className="flex gap-1.5">
              {filtros.map((f) => (
                <button key={f.id} onClick={() => setFiltro(f.id)} className={cx("chip !py-1.5", filtro === f.id && "!border-[var(--line-hi)] !bg-[var(--surface-hi)] !text-[var(--txt)]")}>{f.label}</button>
              ))}
            </div>
          }
        />

        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {lista.map((m, i) => (
            <Reveal key={m.id} delay={0.03 * i}>
              <ModuloCard m={m} compat={COMPAT[m.id]} onOpen={onOpen} />
            </Reveal>
          ))}

          {filtro !== "instalados" && (
            <Reveal delay={0.03 * lista.length}>
              <button onClick={() => go("conexoes")} className="w-full h-full min-h-[220px] text-left rounded-[18px] p-5 flex flex-col justify-center items-start gap-3" style={{ border: "1.5px dashed var(--line-hi)" }}>
                <span className="grid place-items-center rounded-[13px]" style={{ width: 42, height: 42, background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                  <Plug size={20} style={{ color: "#e0a44a" }} />
                </span>
                <div>
                  <div className="font-display font-semibold text-[15px] mb-1">Traga a sua</div>
                  <p className="text-[12.5px] text-[var(--txt-3)] leading-snug">Fez uma habilidade no Claude Code? Ela aparece aqui e vira um recurso de um robô seu, já marcada pro agente certo.</p>
                </div>
                <span className="text-[12.5px] flex items-center gap-1.5 mt-1" style={{ color: "#e0a44a" }}><Plug size={13} /> Conectar <ArrowRight size={13} /></span>
              </button>
            </Reveal>
          )}
        </div>
      </div>
    </div>
  );
}

function ModuloCard({ m, compat, onOpen }: { m: Modulo; compat?: { id: string; label: string }; onOpen: (id: string, sub?: Sub) => void }) {
  const abrir = () => compat && onOpen(compat.id, "estrutura");
  return (
    <div className="card card-hover p-5 h-full flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-3.5">
        <IconBox icon={m.icon} color={m.color} />
        {m.tag && <Pill color={m.tag === "novo" ? "#58aae4" : "#fbbf24"}>{m.tag}</Pill>}
      </div>
      <div className="font-display font-semibold text-[15.5px] mb-1.5">{m.name}</div>
      <p className="text-[13px] text-[var(--txt-2)] leading-snug mb-4 flex-1">{m.blurb}</p>

      <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--txt-3)] mb-3">
        <span className="px-2 py-1 rounded-md bg-[var(--surface-2)] border border-[var(--line)]">{m.gatilho}</span>
        <ArrowRight size={12} className="flex-none" style={{ color: m.color }} />
        <span className="px-2 py-1 rounded-md bg-[var(--surface-2)] border border-[var(--line)]">{m.acao}</span>
      </div>

      {/* onde encaixa */}
      <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--txt-3)] mb-3">
        <Bot size={13} style={{ color: m.color }} className="flex-none" />
        encaixa no <b className="text-[var(--txt-2)]">{compat?.label ?? "—"}</b>
      </div>

      {m.installed ? (
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-[var(--line)]">
          <span className="pill" style={{ color: "#34d399", borderColor: "#34d39940", background: "#34d39914" }}><Check size={12} /> já ligado</span>
          <button className="btn btn-ghost btn-sm" onClick={abrir}>Abrir <ArrowRight size={13} /></button>
        </div>
      ) : (
        <button className="btn btn-primary btn-sm w-full" onClick={abrir}><Zap size={14} /> Ligar no {compat?.label}</button>
      )}
    </div>
  );
}
