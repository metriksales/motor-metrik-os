// MUDANÇAS — a aba que o cliente adora observar. Endereço próprio, não porão.
// Cada mudança é uma história completa, em LEITURA (zero botões): o pedido na
// fala dele → antes/agora → onde encaixou no processo → a prova do porteiro →
// status. Quem alimenta isto é o Melhorar (pedido) + o porteiro (teste).
import { useEffect, useState } from "react";
import { ShieldCheck, Sparkles } from "lucide-react";
import { type Agent, type Mudanca, type Ramo } from "../data";
import { api } from "../lib/api";
import { useMotorAuth } from "../lib/auth";
import { tempoRelativo } from "../lib/live";
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
  const auth = useMotorAuth();
  const mapa = agent.mapa!;
  const ramoById = (id?: string) => mapa.ramos.find((r) => r.id === id);

  // Agente REAL → mudanças reais do ledger (ChangeSets no Neon); senão, o demo.
  const [reais, setReais] = useState<Mudanca[] | null>(null);
  useEffect(() => {
    if (!agent.real) return;
    let vivo = true;
    (api.listChangeSets(agent.id, auth.getToken) as Promise<any[]>)
      .then((rows) => {
        if (!vivo || !Array.isArray(rows) || rows.length === 0) return;
        setReais(
          rows.map((r): Mudanca => ({
            quando: r.createdAt ? tempoRelativo(r.createdAt) : "",
            origem: r.origin === "hub_chat" ? "voce" : "metrik",
            pedido: r.intent ?? "mudança",
            status: r.status === "published" ? "no ar" : r.status === "approved" ? "em teste" : "aguardando aprovação",
            porteiro: r.impact?.evals
              ? {
                  nota: (r.impact.evals.taxa * 10).toFixed(1).replace(".", ","),
                  casos: `${r.impact.evals.passaram}/${r.impact.evals.total} casos passaram`,
                  taxa: r.impact.evals.taxa,
                }
              : undefined,
          }))
        );
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id]);

  const mudancas = reais ?? mapa.mudancas ?? [];

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

/* a história de UMA mudança: pedido → antes/agora → onde encaixou → prova → status.
   A prova é um SELO — pra advogado, protocolo e carimbo são linguagem nativa. */
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

      <div className="flex items-start justify-between gap-4 mb-3.5">
        <p className="text-[15px] text-[var(--txt)] leading-relaxed flex-1">“{m.pedido}”</p>
        {m.porteiro && <SeloPorteiro nota={m.porteiro.nota} taxa={m.porteiro.taxa} />}
      </div>

      {(m.antes || m.agora) && (
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
      )}

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

/* o CARIMBO do porteiro: círculo de progresso proporcional aos casos que
   passaram, com a nota no centro — a prova em forma de selo, não de rodapé */
function SeloPorteiro({ nota, taxa }: { nota: string; taxa?: number }) {
  const t = taxa ?? Math.min(1, parseFloat(nota.replace(",", ".")) / 10 || 0);
  const R = 24;
  const C = 2 * Math.PI * R;
  const cor = t >= 0.75 ? "#34d399" : "#fbbf24";
  return (
    <div className="flex-none flex flex-col items-center" title={`porteiro: nota ${nota}`}>
      <svg width={62} height={62} viewBox="0 0 62 62">
        <circle cx={31} cy={31} r={R} fill={`${cor}0d`} stroke="var(--line)" strokeWidth={3} />
        <circle
          cx={31}
          cy={31}
          r={R}
          fill="none"
          stroke={cor}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={`${C * t} ${C}`}
          transform="rotate(-90 31 31)"
        />
        <text x={31} y={35} textAnchor="middle" fill="var(--txt)" fontSize={15} fontWeight={700} fontFamily="Space Grotesk, sans-serif">
          {nota}
        </text>
      </svg>
      <span className="mono-label !text-[8px] mt-0.5" style={{ color: cor }}>porteiro</span>
    </div>
  );
}
