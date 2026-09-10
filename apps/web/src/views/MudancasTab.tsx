// MUDANÇAS — a aba que o cliente adora observar. Endereço próprio, não porão.
// Cada mudança é uma história completa, em LEITURA (zero botões): o pedido na
// fala dele → antes/agora → onde encaixou no processo → a prova do porteiro →
// status. Quem alimenta isto é o Melhorar (pedido) + o porteiro (teste).
import { ShieldCheck, Sparkles } from "lucide-react";
import { type Agent, type Mudanca, type Ramo } from "../data";
import { Reveal } from "../ui";

const ORIGEM_LABEL: Record<Mudanca["origem"], string> = {
  voce: "você pediu",
  metrik: "a Metrik ajustou",
  escola: "você corrigiu (Escola)",
};

const STATUS_COR: Record<Mudanca["status"], string> = {
  "no ar": "#34d399",
  "em teste": "#fbbf24",
  "aguardando aprovação": "#8b7cff",
};

export default function MudancasTab({ agent }: { agent: Agent }) {
  const mapa = agent.mapa!;
  const mudancas = mapa.mudancas ?? [];
  const ramoById = (id?: string) => mapa.ramos.find((r) => r.id === id);

  return (
    <div className="space-y-4">
      <Reveal>
        <div className="card p-4 flex items-start gap-3">
          <Sparkles size={16} className="flex-none mt-0.5" style={{ color: "#8b7cff" }} />
          <p className="text-[13px] text-[var(--txt-2)] leading-relaxed">
            Você pede no <b className="text-[var(--txt)]">Melhorar</b> — e o que entra no ar aparece aqui,
            com antes/depois, <b className="text-[var(--txt)]">onde encaixou</b> no processo e a prova do porteiro.
            As situações alteradas ficam marcadas com ✨ no “O que faz”.
          </p>
        </div>
      </Reveal>

      <div className="space-y-3">
        {mudancas.map((m, i) => (
          <Reveal key={i} delay={0.04 * i}>
            <MudancaCard m={m} ramo={ramoById(m.ramoId)} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/* a história de UMA mudança: pedido → antes/agora → onde encaixou → prova → status */
function MudancaCard({ m, ramo }: { m: Mudanca; ramo?: Ramo }) {
  const stCor = STATUS_COR[m.status];
  return (
    <div className="card p-5" style={{ borderColor: "#8b7cff2e" }}>
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <span className="text-[12px] text-[var(--txt-3)]">
          {m.quando} · <b className="text-[var(--txt-2)]">{ORIGEM_LABEL[m.origem]}</b>
        </span>
        <span className="pill flex-none" style={{ color: stCor, borderColor: `${stCor}40`, background: `${stCor}12` }}>
          {m.status === "no ar" && <span className="live-dot" style={{ width: 6, height: 6, background: stCor }} />}
          {m.status}
        </span>
      </div>

      <p className="text-[15px] text-[var(--txt)] leading-relaxed mb-3.5">“{m.pedido}”</p>

      <div className="grid md:grid-cols-2 gap-2.5 mb-3">
        <div className="rounded-lg px-3.5 py-2.5 bg-[var(--surface-2)] border border-[var(--line)]">
          <div className="mono-label !text-[9px] mb-1 !text-[var(--txt-4)]">antes</div>
          <p className="text-[13px] text-[var(--txt-3)] leading-relaxed">{m.antes}</p>
        </div>
        <div className="rounded-lg px-3.5 py-2.5" style={{ background: "#34d3990d", border: "1px solid #34d39928" }}>
          <div className="mono-label !text-[9px] mb-1" style={{ color: "#34d399" }}>agora</div>
          <p className="text-[13px] text-[var(--txt)] leading-relaxed">{m.agora}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px]">
        {ramo && (
          <span className="inline-flex items-center gap-1.5 text-[var(--txt-2)]">
            <span className="dot" style={{ background: ramo.cor, width: 8, height: 8 }} />
            encaixou no caminho <b>{ramo.nome}</b>
            {m.situacao && <span className="text-[var(--txt-4)]">· situação “{m.situacao}”</span>}
          </span>
        )}
        {m.porteiro && (
          <span className="inline-flex items-center gap-1.5" style={{ color: "#34d399" }}>
            <ShieldCheck size={13} /> porteiro: {m.porteiro.casos} · nota {m.porteiro.nota}
          </span>
        )}
      </div>
    </div>
  );
}
