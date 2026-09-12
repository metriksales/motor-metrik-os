// CONEXÕES — as ligações da operação, na LÍNGUA DO CLIENTE: onde a IA dele
// trabalha (WhatsApp, CRM, agenda). A parte técnica (Claude Code/Codex/MCP) é
// dos bastidores da Metrik — aparece como nota honesta, sem terminal nem jargão.
import { Plug, Check, Wrench } from "lucide-react";
import { CONEXOES_CANAIS } from "../data";
import { Reveal, SectionHeader } from "../ui";

export default function Conexoes() {
  return (
    <div className="space-y-6">
      <Reveal>
        <div className="grad-border overflow-hidden">
          <div className="relative p-6 md:p-7">
            <div className="aurora !opacity-30" />
            <div className="relative max-w-2xl">
              <div className="flex items-center gap-2 mb-2">
                <Plug size={16} style={{ color: "#e0a44a" }} />
                <span className="mono-label">As conexões da sua operação</span>
              </div>
              <h2 className="font-display text-[22px] md:text-[26px] font-semibold tracking-tight">
                Onde a sua IA <span className="grad-text">trabalha</span> — e quem liga tudo.
              </h2>
              <p className="text-[var(--txt-2)] mt-2.5 text-[14px] leading-relaxed">
                O WhatsApp, o seu CRM e a agenda ficam ligados aqui. <b className="text-[var(--txt)]">A Metrik conecta e cuida
                dos bastidores</b> — você acompanha o que está no ar e, pra mudar algo, é pelo Melhorar.
              </p>
            </div>
          </div>
        </div>
      </Reveal>

      {/* canais — o que o cliente entende: WhatsApp, CRM, agenda */}
      <div>
        <SectionHeader label="Onde a IA atende e registra" title="WhatsApp, CRM e agenda" />
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {CONEXOES_CANAIS.map((c, i) => (
            <Reveal key={c.id} delay={0.04 * i}>
              <div className="card card-hover p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="mono-label">{c.tipo}</span>
                  <span className="pill flex-none" style={{ color: c.ok ? "#34d399" : "var(--txt-4)", borderColor: c.ok ? "#34d39940" : "var(--line)", background: c.ok ? "#34d39912" : "var(--surface-2)" }}>
                    {c.ok ? <><Check size={11} /> ligado</> : "a ligar"}
                  </span>
                </div>
                <div className="font-display font-semibold text-[16px]">{c.name}</div>
                {c.ok ? (
                  <div className="text-[12.5px] text-[var(--txt-3)]">no ar e funcionando</div>
                ) : (
                  <div className="text-[12.5px] text-[var(--txt-4)]">a Metrik liga pra você</div>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* bastidores — honesto, sem npx/terminal: a Metrik opera por aqui */}
      <Reveal delay={0.1}>
        <div className="card p-5 flex items-start gap-3">
          <span className="grid place-items-center rounded-[11px] flex-none" style={{ width: 38, height: 38, background: "rgba(224,164,74,.14)", border: "1px solid rgba(224,164,74,.3)" }}>
            <Wrench size={18} style={{ color: "#e0a44a" }} />
          </span>
          <div>
            <div className="text-[13.5px] font-medium text-[var(--txt)]">Bastidores da Metrik</div>
            <p className="text-[12.5px] text-[var(--txt-2)] leading-relaxed mt-0.5">
              É por aqui que a Metrik monta e ajusta o seu motor (as ferramentas Claude Code e Codex). Tudo o que
              elas fazem vira uma mudança testada e reversível — você não precisa mexer nesta parte.
            </p>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
