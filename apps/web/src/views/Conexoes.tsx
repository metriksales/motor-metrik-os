import { Plug, Terminal, Copy, Eye, Lightbulb, FlaskConical, Rocket, Undo2, Check } from "lucide-react";
import { CONEXOES_MCP, CONEXOES_CANAIS } from "../data";
import { Reveal, IconBox, Pill, SectionHeader } from "../ui";

const PODE = [
  { icon: Eye, t: "olhar tudo" },
  { icon: Lightbulb, t: "propor mudança" },
  { icon: FlaskConical, t: "testar" },
  { icon: Rocket, t: "publicar (com seu ok)" },
  { icon: Undo2, t: "voltar atrás" },
];

export default function Conexoes() {
  return (
    <div className="space-y-6">
      <Reveal>
        <div className="grad-border overflow-hidden">
          <div className="relative p-6 md:p-7">
            <div className="aurora !opacity-30" />
            <div className="relative max-w-2xl">
              <div className="flex items-center gap-2 mb-2">
                <Plug size={16} style={{ color: "#8b7cff" }} />
                <span className="mono-label">A tomada é sua · o motor é nosso</span>
              </div>
              <h2 className="font-display text-[22px] md:text-[26px] font-semibold tracking-tight">
                Conecte o <span className="grad-text">Claude Code ou o Codex</span> e peça de onde quiser.
              </h2>
              <p className="text-[var(--txt-2)] mt-2.5 text-[14px] leading-relaxed">
                O que você pedir por eles vira uma mudança segura aqui dentro — testada, aprovada por você e
                reversível. Eles plugam na tomada; nunca encostam no motor.
              </p>
            </div>
          </div>
        </div>
      </Reveal>

      {/* MCP */}
      <div>
        <SectionHeader label="Assistentes (MCP)" title="Suas tomadas" />
        <div className="grid md:grid-cols-2 gap-4">
          {CONEXOES_MCP.map((c, i) => (
            <Reveal key={c.id} delay={0.05 * i}>
              <div className="card card-hover p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <IconBox icon={Terminal} color={c.color} />
                    <div>
                      <div className="font-display font-semibold text-[15.5px]">{c.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="dot" style={{ background: "#34d399" }} />
                        <span className="text-[11.5px] text-[var(--txt-3)]">{c.status}</span>
                      </div>
                    </div>
                  </div>
                  <Pill color="#34d399"><Check size={12} /> ativo</Pill>
                </div>
                <p className="text-[13px] text-[var(--txt-2)] leading-snug mb-4">{c.desc}</p>

                <div className="mono-label mb-2">O que ele pode fazer</div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {PODE.map((p) => (
                    <span key={p.t} className="pill"><p.icon size={12} style={{ color: c.color }} /> {p.t}</span>
                  ))}
                </div>

                <div className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] border border-[var(--line)] px-3 py-2.5">
                  <code className="font-mono text-[12px] text-[var(--txt-2)]">
                    <span style={{ color: c.color }}>$</span> npx metrik connect --{c.id}
                  </code>
                  <Copy size={14} className="text-[var(--txt-4)] cursor-pointer hover:text-[var(--txt)]" />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* canais */}
      <div>
        <SectionHeader label="Onde o motor trabalha" title="CRM e canais" />
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {CONEXOES_CANAIS.map((c, i) => (
            <Reveal key={c.id} delay={0.04 * i}>
              <div className="card card-hover p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="mono-label">{c.tipo}</span>
                  <span className="dot" style={{ background: c.ok ? "#34d399" : "var(--txt-4)" }} />
                </div>
                <div className="font-display font-semibold text-[16px]">{c.name}</div>
                {c.ok ? (
                  <div className="text-[12.5px] text-[var(--txt-3)] font-mono">{c.status}</div>
                ) : (
                  <button className="btn btn-sm w-full">Conectar</button>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}
