// FOLLOW-UP — o kit do SDR, momento "quem ela está cutucando (e quem NÃO deve)".
// A fila com o próximo toque, quem ela parou de cutucar sozinha (respondeu /
// agendou) e quem esgotou. Leitura pura; a exceção é o "não cutucar este
// contato" — que por enquanto se pede no Melhorar (1 porta de mudança).
// REAL: o estado da fila ainda não é espelhado pelo runtime → estado honesto.
import { Repeat, ShieldCheck, Check, CalendarClock, Clock, Pause } from "lucide-react";
import { useMotorAuth } from "../lib/auth";
import { Reveal, Pill } from "../ui";

const DEMO_FILA = [
  { quando: "2h15", toque: "2º toque", quem: "Carlos Mendes", motivo: "sumiu depois do valor · toque leve com motivo" },
  { quando: "40min", toque: "1º toque", quem: "Ana Ribeiro", motivo: "pediu proposta e não abriu mais" },
];

export default function Followup() {
  const auth = useMotorAuth();

  if (!auth.demo) {
    // logado: honestidade primeiro — a fila real aparece quando o runtime espelhar
    return (
      <div className="space-y-4">
        <Cabecalho demo={false} />
        <Reveal>
          <div className="card p-8 text-center">
            <Repeat size={26} className="mx-auto mb-3" style={{ color: "var(--txt-4)" }} />
            <p className="text-[13.5px] text-[var(--txt)] font-medium">Os toques já acontecem — o espelho da fila chega na próxima atualização.</p>
            <p className="text-[12px] text-[var(--txt-3)] mt-1.5 max-w-md mx-auto leading-relaxed">
              Seu robô segue cutucando quem sumiu (nas regras: horário comercial, máximo de toques, para se o lead responder).
              O que falta é ESTA tela ler a fila dele em tempo real — está na esteira.
            </p>
          </div>
        </Reveal>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Cabecalho demo />

      {/* as regras que protegem o cliente — a confiança primeiro */}
      <div className="card p-3.5 flex items-center gap-2.5">
        <ShieldCheck size={16} style={{ color: "var(--emerald)" }} className="flex-none" />
        <p className="text-[11.5px] text-[var(--txt-3)]">
          só em horário comercial · máx. 3 toques · <b className="text-[var(--txt-2)]">para na hora se o lead responder</b>
        </p>
      </div>

      <Reveal>
        <div className="space-y-1.5">
          <div className="mono-label">Próximos toques</div>
          <div className="card">
            {DEMO_FILA.map((f, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--line)]">
                <div className="w-12 text-center flex-none">
                  <div className="font-mono text-[13px] font-semibold" style={{ color: "var(--amber)" }}>{f.quando}</div>
                  <div className="text-[7.5px] uppercase tracking-wider text-[var(--txt-4)] mt-0.5">{f.toque}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold">{f.quem}</div>
                  <div className="text-[11px] text-[var(--txt-3)]">{f.motivo}</div>
                </div>
                <span className="grid place-items-center rounded-full flex-none" style={{ width: 34, height: 34, border: "1px solid var(--line)" }} title="não cutucar este contato">
                  <Pause size={13} style={{ color: "var(--txt-3)" }} />
                </span>
              </div>
            ))}
            <div className="flex items-center gap-3 px-4 py-3" style={{ background: "rgba(192,125,18,.06)" }}>
              <div className="w-12 text-center flex-none"><Pause size={15} style={{ color: "var(--amber)" }} className="mx-auto" /></div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold">Dr. Paulo</div>
                <div className="text-[11px]" style={{ color: "var(--amber)" }}>você pediu: não cutucar este contato</div>
              </div>
              <Pill color="var(--amber)">pausado</Pill>
            </div>
          </div>
          <p className="text-[10.5px] text-[var(--txt-4)] px-1">o <b className="text-[var(--txt-3)]">botão de pausa</b> tira um contato da fila pra sempre — sócio, amigo, cliente antigo</p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="space-y-1.5">
          <div className="mono-label">A IA parou sozinha</div>
          <div className="card">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[var(--line)]">
              <Check size={15} style={{ color: "var(--emerald)" }} className="flex-none" />
              <p className="text-[12.5px] flex-1"><b>Marina respondeu</b> — follow encerrado, conversa devolvida pra IA</p>
              <span className="tick">14:05</span>
            </div>
            <div className="flex items-center gap-2.5 px-4 py-3">
              <CalendarClock size={15} style={{ color: "var(--emerald)" }} className="flex-none" />
              <p className="text-[12.5px] flex-1"><b>Beatriz agendou</b> — o 2º toque virou reunião de quinta</p>
              <span className="tick">14:21</span>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="space-y-1.5">
          <div className="mono-label">Esgotaram</div>
          <div className="card flex items-center gap-2.5 px-4 py-3">
            <Clock size={15} style={{ color: "var(--txt-4)" }} className="flex-none" />
            <p className="text-[12.5px] text-[var(--txt-2)] flex-1"><b className="text-[var(--txt)]">Rodrigo</b> · 3 toques sem resposta — marcado <b className="text-[var(--txt)]">"abandonou"</b> no funil</p>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

function Cabecalho({ demo }: { demo: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="mono-label mb-1">Follow-up</div>
        <p className="text-[13px] text-[var(--txt-2)]">quem a IA está cutucando por você — e quem ela deixou em paz</p>
      </div>
      <Pill color={demo ? undefined : "var(--emerald)"}>{demo ? "demo" : "9 na fila"}</Pill>
    </div>
  );
}
