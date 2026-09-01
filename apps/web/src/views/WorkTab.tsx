import { useState } from "react";
import {
  CalendarClock, Video, Phone, MapPin, Repeat, Check, X, FileSignature,
  AlertTriangle, Plus, BookOpen, Zap, MousePointerClick, Layers, Play, ListChecks, Clock,
} from "lucide-react";
import type { Agent, Work } from "../data";
import { Pill, cx } from "../ui";

export default function WorkTab({ agent }: { agent: Agent }) {
  const w = agent.work!;
  return (
    <div className="space-y-4">
      {w.kind === "agenda" && <Agenda w={w} color={agent.color} />}
      {w.kind === "followups" && <Followups w={w} color={agent.color} />}
      {w.kind === "contratos" && <Contratos w={w} />}
      {w.kind === "conhecimento" && <Conhecimento w={w} color={agent.color} />}
      {w.kind === "acoes" && <Acoes w={w} color={agent.color} />}
      {w.kind === "lista" && <Lista w={w} color={agent.color} />}
    </div>
  );
}

const canalIcon: Record<string, any> = { Meet: Video, Ligação: Phone, Presencial: MapPin };

function Agenda({ w, color }: { w: Work; color: string }) {
  const items = w.agenda ?? [];
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="mono-label">Próximas reuniões</div>
        <Pill color={color}><CalendarClock size={12} /> {items.length} marcadas</Pill>
      </div>
      <ul className="space-y-2">
        {items.map((a, i) => {
          const CI = a.canal ? canalIcon[a.canal] ?? Video : Video;
          const ok = a.status === "confirmado";
          return (
            <li key={i} className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
              <div className="text-center flex-none w-[74px]">
                <div className="num text-[13px]" style={{ color }}>{a.quando.split(" ")[0]}</div>
                <div className="tick !text-[13px] !text-[var(--txt)]">{a.quando.split(" ")[1]}</div>
              </div>
              <div className="w-px self-stretch bg-[var(--line)]" />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium truncate">{a.quem}</div>
                <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--txt-3)] mt-0.5"><CI size={11} /> {a.canal}</div>
              </div>
              <Pill color={ok ? "#34d399" : "#fbbf24"}>{a.status}</Pill>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Followups({ w, color }: { w: Work; color: string }) {
  const items = w.followups ?? [];
  const meta: Record<string, { color: string; label: string }> = {
    agora: { color: "#8b7cff", label: "enviando" },
    agendado: { color: "#22d3ee", label: "vai enviar" },
    feito: { color: "#34d399", label: "enviado" },
  };
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="mono-label">Fila de follow-ups</div>
        <Pill color={color}><Repeat size={12} /> {items.filter((f) => f.status !== "feito").length} na fila</Pill>
      </div>
      <ul className="space-y-2">
        {items.map((f, i) => {
          const m = meta[f.status];
          return (
            <li key={i} className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
              <span className="grid place-items-center rounded-lg flex-none" style={{ width: 30, height: 30, background: `${m.color}16`, border: `1px solid ${m.color}30` }}>
                {f.status === "feito" ? <Check size={14} style={{ color: m.color }} /> : <Repeat size={14} style={{ color: m.color }} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium truncate">{f.quem}</div>
                <div className="text-[11.5px] text-[var(--txt-3)] mt-0.5">{f.toque}</div>
              </div>
              <div className="text-right flex-none">
                <div className="flex items-center gap-1.5 justify-end">
                  {f.status === "agora" && <span className="live-dot" style={{ width: 6, height: 6, background: m.color }} />}
                  <span className="text-[11px]" style={{ color: m.color }}>{m.label}</span>
                </div>
                <div className="tick mt-0.5">{f.quando}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Contratos({ w }: { w: Work }) {
  const items = w.contratos ?? [];
  const meta: Record<string, { color: string }> = {
    assinado: { color: "#34d399" }, enviado: { color: "#22d3ee" }, vencendo: { color: "#fbbf24" }, expirado: { color: "#fb7185" },
  };
  const atencao = items.filter((c) => c.status === "vencendo" || c.status === "expirado");
  return (
    <div className="space-y-4">
      {atencao.length > 0 && (
        <div className="card p-4 flex items-center gap-3" style={{ borderColor: "#fbbf2440", background: "linear-gradient(160deg, rgba(251,191,36,.08), var(--surface))" }}>
          <AlertTriangle size={17} style={{ color: "#fbbf24" }} className="flex-none" />
          <p className="text-[13px] text-[var(--txt-2)]"><b className="text-[var(--txt)]">{atencao.length} contrato(s) pedindo atenção</b> — perto de vencer ou já vencido.</p>
        </div>
      )}
      <div className="card p-5">
        <div className="mono-label mb-4">Contratos</div>
        <ul className="space-y-2">
          {items.map((c, i) => {
            const m = meta[c.status];
            const alerta = c.status === "vencendo" || c.status === "expirado";
            return (
              <li key={i} className="flex items-center gap-3 rounded-xl p-3" style={{ border: `1px solid ${alerta ? m.color + "40" : "var(--line)"}`, background: alerta ? `${m.color}0c` : "var(--surface)" }}>
                <span className="grid place-items-center rounded-lg flex-none" style={{ width: 32, height: 32, background: `${m.color}16`, border: `1px solid ${m.color}30` }}>
                  <FileSignature size={15} style={{ color: m.color }} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium truncate">{c.quem}</div>
                  {c.prazo && <div className="text-[11.5px] mt-0.5" style={{ color: alerta ? m.color : "var(--txt-3)" }}>{c.prazo}</div>}
                </div>
                <div className="num text-[13.5px] flex-none mr-2">{c.valor}</div>
                <Pill color={m.color}>{c.status}</Pill>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Conhecimento({ w, color }: { w: Work; color: string }) {
  const [itens, setItens] = useState(w.conhecimento ?? []);
  const [txt, setTxt] = useState("");
  const cats = Array.from(new Set(itens.map((i) => i.cat)));
  const add = () => {
    if (!txt.trim()) return;
    setItens((s) => [{ cat: "Novo", titulo: txt.trim() }, ...s]);
    setTxt("");
  };
  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center gap-3">
        <BookOpen size={17} style={{ color }} className="flex-none" />
        <p className="text-[13px] text-[var(--txt-2)]">É daqui que ele tira as respostas. Cadastre algo e ele já passa a usar — sem tocar no prompt.</p>
      </div>

      <div className="card p-5">
        <div className="flex items-end gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-2 focus-within:border-[var(--line-hi)] transition-colors mb-4">
          <input value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Cadastrar algo novo (um plano, uma objeção, uma regra…)" className="flex-1 bg-transparent px-2 py-1.5 text-[13.5px] outline-none placeholder:text-[var(--txt-4)]" />
          <button onClick={add} className="btn btn-primary btn-sm flex-none"><Plus size={14} /> Adicionar</button>
        </div>

        {cats.map((cat) => (
          <div key={cat} className="mb-4 last:mb-0">
            <div className="mono-label mb-2">{cat}</div>
            <div className="flex flex-wrap gap-2">
              {itens.filter((i) => i.cat === cat).map((i, idx) => (
                <span key={idx} className="chip !cursor-default">{i.titulo}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Acoes({ w, color }: { w: Work; color: string }) {
  const a = w.acoes!;
  const [done, setDone] = useState(false);
  const gatilhos = [
    { icon: Layers, t: "por etapa do funil" },
    { icon: MousePointerClick, t: "botão no card" },
    { icon: ListChecks, t: "seleção em massa" },
  ];
  return (
    <div className="space-y-4">
      {/* gatilho */}
      <div className="card p-5">
        <div className="mono-label mb-3">Quando ele dispara</div>
        <p className="text-[13.5px] text-[var(--txt)] mb-3">{a.gatilho}</p>
        <div className="flex flex-wrap gap-2">
          {gatilhos.map((g) => (
            <span key={g.t} className="pill"><g.icon size={12} style={{ color }} /> {g.t}</span>
          ))}
        </div>
      </div>

      {/* fila / rodar em massa */}
      <div className="grad-border">
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center rounded-[13px] flex-none" style={{ width: 42, height: 42, background: `${color}16`, border: `1px solid ${color}33` }}>
              <Zap size={20} style={{ color }} />
            </span>
            <div>
              <div className="font-display font-semibold text-[15px]">{a.alvo}</div>
              <div className="text-[12px] text-[var(--txt-3)]">prontos pra rodar agora, direto no CRM</div>
            </div>
          </div>
          {done ? (
            <Pill color="#34d399"><Check size={12} /> disparado — acompanhe no log</Pill>
          ) : (
            <button className="btn btn-primary" onClick={() => setDone(true)}><Play size={15} /> Rodar em massa</button>
          )}
        </div>
      </div>

      {/* log */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="mono-label">Últimas ações</div>
          <span className="text-[11.5px] text-[var(--txt-3)]">{a.feito} feitas no total</span>
        </div>
        <ul className="space-y-1">
          {a.log.map((l, i) => (
            <li key={i} className={cx("flex items-center gap-3 py-2.5", i !== a.log.length - 1 && "border-b border-[var(--line)]")}>
              <span className="grid place-items-center rounded-lg flex-none" style={{ width: 28, height: 28, background: l.ok ? "rgba(52,211,153,.16)" : "rgba(251,113,133,.16)", border: `1px solid ${l.ok ? "#34d39930" : "#fb718530"}` }}>
                {l.ok ? <Check size={14} style={{ color: "#34d399" }} /> : <X size={14} style={{ color: "#fb7185" }} />}
              </span>
              <span className="text-[13px] text-[var(--txt)] flex-1 truncate">{l.quem}</span>
              <span className="tick">{l.quando}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Lista({ w, color }: { w: Work; color: string }) {
  const l = w.lista!;
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={15} style={{ color }} />
        <div className="mono-label">{l.titulo}</div>
      </div>
      <ul className="space-y-2">
        {l.itens.map((it, i) => (
          <li key={i} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
            <span className="text-[13.5px] text-[var(--txt)]">{it.a}</span>
            <Pill color={color}>{it.b}</Pill>
          </li>
        ))}
      </ul>
    </div>
  );
}
