// MAPA DE AÇÃO — o "O que faz" dos agentes de AÇÃO (petição, contrato, CRM).
// É o irmão do MapaTab (conversa): leitura pura, zero botão. Mostra o GATILHO
// (quando dispara), a SEQUÊNCIA de ações — cada uma com o ALVO claro (etapa ×
// campo × integração × canal), o que ela faz e se está ok/travada — e o
// RESULTADO (o que o cliente recebe). Assim "muda de etapa" e "preenche outro
// campo" viram coisas VISÍVEIS, não uma lista genérica.
import { type ReactNode } from "react";
import {
  Zap, Check, X, Clock, ArrowRight, Wand2,
  Columns3, TextCursorInput, Plug, MessageCircle, FileText,
} from "lucide-react";
import { type Agent, type Passo } from "../data";
import { Reveal } from "../ui";

const ALVO_META: Record<string, { icon: any; label: string; cor: string }> = {
  etapa: { icon: Columns3, label: "etapa", cor: "#58aae4" },
  campo: { icon: TextCursorInput, label: "campo", cor: "#3b82f6" },
  integracao: { icon: Plug, label: "integração", cor: "#7c9fe0" },
  canal: { icon: MessageCircle, label: "canal", cor: "#3fb950" },
  documento: { icon: FileText, label: "documento", cor: "#60a5fa" },
};

const ST_META: Record<Passo["status"], { icon: any; cor: string; label: string }> = {
  ok: { icon: Check, cor: "#3fb950", label: "rodando certo" },
  falha: { icon: X, cor: "#f85149", label: "travou" },
  espera: { icon: Clock, cor: "#fbbf24", label: "em espera" },
};

export default function MapaAcao({ agent, onMelhorar }: { agent: Agent; onMelhorar: () => void }) {
  const passos = agent.fluxo ?? [];
  const gatilho = agent.work?.acoes?.gatilho ?? passos[0]?.deveria ?? "quando o gatilho acontece no funil";
  const entrega = passos[passos.length - 1];

  return (
    <div className="space-y-4">
      <Reveal>
        <div className="card p-5 md:p-7">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="mono-label">O que ele faz, passo a passo</div>
            <span className="text-[11px] text-[var(--txt-4)] flex-none">lido do processo · atualiza sozinho</span>
          </div>
          {agent.expectativa && (
            <p className="text-[15.5px] text-[var(--txt)] leading-relaxed mb-6 max-w-2xl">{agent.expectativa}</p>
          )}

          {/* GATILHO — quando dispara */}
          <div className="rounded-xl p-4 mb-5 flex items-start gap-3" style={{ border: "1px solid #58aae433", background: "rgba(88,170,228,.06)" }}>
            <span className="grid place-items-center rounded-lg flex-none" style={{ width: 34, height: 34, background: "rgba(88,170,228,.14)", border: "1px solid #58aae440" }}>
              <Zap size={17} style={{ color: "#58aae4" }} />
            </span>
            <div>
              <div className="mono-label !text-[9px] mb-1" style={{ color: "#58aae4" }}>dispara quando</div>
              <p className="text-[14px] text-[var(--txt)] leading-relaxed">{frase(gatilho)}</p>
            </div>
          </div>

          {/* SEQUÊNCIA — cada passo com o alvo claro */}
          <ol>
            {passos.map((p, i) => (
              <PassoAcao key={i} n={i + 1} passo={p} ultimo={i === passos.length - 1} onMelhorar={onMelhorar} />
            ))}
          </ol>
        </div>
      </Reveal>

      {/* RESULTADO — o que o cliente recebe */}
      {entrega && (
        <Reveal delay={0.05}>
          <div className="card p-5 flex items-start gap-3" style={{ borderColor: "#3fb95030", background: "linear-gradient(160deg, rgba(63,185,80,.06), var(--surface))" }}>
            <span className="grid place-items-center rounded-lg flex-none" style={{ width: 34, height: 34, background: "rgba(63,185,80,.14)", border: "1px solid #3fb95040" }}>
              <Check size={17} style={{ color: "#3fb950" }} />
            </span>
            <div>
              <div className="mono-label !text-[9px] mb-1" style={{ color: "#3fb950" }}>no fim, você recebe</div>
              <p className="text-[14px] text-[var(--txt)] leading-relaxed">{frase(entrega.deveria)}</p>
            </div>
          </div>
        </Reveal>
      )}
    </div>
  );
}

function PassoAcao({ n, passo, ultimo, onMelhorar }: { n: number; passo: Passo; ultimo?: boolean; onMelhorar: () => void }) {
  const st = ST_META[passo.status];
  const alvo = passo.alvo ? ALVO_META[passo.alvo.tipo] : null;
  return (
    <li className="relative pl-12 pb-6 last:pb-0">
      {!ultimo && <span className="absolute left-[16px] top-10 bottom-0 w-px bg-[var(--line)]" />}
      <span className="absolute left-0 top-0 grid place-items-center rounded-full font-mono text-[13px]"
        style={{ width: 33, height: 33, background: `${st.cor}16`, border: `1px solid ${st.cor}33`, color: st.cor }}>
        {n}
      </span>
      <div className="flex items-center gap-2 flex-wrap pt-1">
        <span className="font-display font-semibold text-[15px] text-[var(--txt)]">{passo.label}</span>
        {alvo && passo.alvo && (
          <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md" style={{ color: alvo.cor, background: `${alvo.cor}12`, border: `1px solid ${alvo.cor}30` }}>
            <alvo.icon size={11} /> {alvo.label}: <b className="font-medium">{passo.alvo.nome}</b>
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-[11px] ml-auto" style={{ color: st.cor }}>
          <st.icon size={12} className={passo.status === "espera" ? "" : ""} /> {st.label}
        </span>
      </div>
      <p className="text-[13.5px] text-[var(--txt-2)] leading-relaxed mt-1">{frase(passo.deveria)}</p>
      {passo.status === "falha" && passo.porque && (
        <div className="mt-2 rounded-lg px-3.5 py-2.5" style={{ background: "rgba(248,81,73,.07)", border: "1px solid rgba(248,81,73,.28)" }}>
          <p className="text-[12.5px]" style={{ color: "#f85149" }}>{frase(passo.porque)}</p>
          {passo.sugestao && (
            <button onClick={onMelhorar} className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium" style={{ color: "var(--violet)" }}>
              <Wand2 size={12} /> {passo.sugestao} <ArrowRight size={12} />
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function frase(s: string): ReactNode {
  const t = s.trim();
  return /[.?!…]$/.test(t) ? t : t + ".";
}
