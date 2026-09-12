import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Radio, Zap, Wand2, Check, X, Loader2, ShieldCheck, Lock, Plus,
  ArrowUp, Play, FlaskConical, Rocket, Lightbulb, ThumbsUp, AlertTriangle,
  Link2, ArrowRight, CalendarClock, Repeat, FileSignature, BookOpen, ListChecks, Plug, Clock, Mic, ScrollText, Sparkles,
} from "lucide-react";
import { type Agent, type AgentState, type Insight, type Upgrade, STATE_META, CHAT_EXEMPLOS } from "../data";
import { Reveal, Pill, Toggle, cx } from "../ui";
import { Robot } from "../Robot";
import WorkTab from "./WorkTab";
import MapaTab from "./MapaTab";
import MudancasTab from "./MudancasTab";
import { api } from "../lib/api";
import { useMotorAuth } from "../lib/auth";
import { tempoRelativo, useLive } from "../lib/live";

type Sub = "trabalho" | "aovivo" | "mudancas" | "logs" | "estrutura" | "melhorar";

export default function AgentDetail({ agent, onBack, initialSub }: { agent: Agent; onBack: () => void; initialSub?: Sub }) {
  const auth = useMotorAuth();
  const [sub, setSub] = useState<Sub>(initialSub ?? "aovivo");

  // Badge de Mudanças conta o LEDGER real (ChangeSets) quando o agente é real.
  const [nReal, setNReal] = useState(0);
  useEffect(() => {
    if (!agent.real) return;
    let vivo = true;
    (api.listChangeSets(agent.id, auth.getToken) as Promise<any[]>)
      .then((rows) => {
        if (vivo && Array.isArray(rows)) setNReal(rows.length);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id, sub]);
  const [state, setState] = useState<AgentState>(agent.state);
  const sm = STATE_META[state];
  const alerta = (agent.fluxo ?? []).some((p) => p.status === "falha") || (agent.insights ?? []).some((i) => i.tipo === "critico");
  const workIconMap: Record<string, any> = { agenda: CalendarClock, followups: Repeat, contratos: FileSignature, conhecimento: BookOpen, acoes: Zap, lista: ListChecks };
  // Cada aba com UMA finalidade: O que faz (ler o processo) · Mudanças (observar
  // o que entrou) · Trabalho (a superfície dele) · Logs · Turbinar · Melhorar.
  const nMud = nReal > 0 ? nReal : (agent.mapa?.mudancas?.length ?? 0);
  const subs: { id: Sub; label: string; icon: any; badge?: number }[] = [
    { id: "aovivo", label: "O que faz", icon: Radio },
    ...(nMud > 0 ? [{ id: "mudancas" as Sub, label: "Mudanças", icon: Sparkles, badge: nMud }] : []),
    ...(agent.work ? [{ id: "trabalho" as Sub, label: agent.work.label, icon: workIconMap[agent.work.kind] }] : []),
    { id: "logs", label: "Logs", icon: ScrollText },
    { id: "estrutura", label: "Turbinar", icon: Zap },
    { id: "melhorar", label: "Melhorar", icon: Wand2 },
  ];

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="btn btn-ghost btn-sm !px-2"><ArrowLeft size={15} /> Agentes</button>

      <Reveal>
        <div className="grad-border overflow-hidden">
          <div className="relative p-5 md:p-6">
            <div className="aurora !opacity-30" />
            <div className="relative flex flex-col md:flex-row md:items-center gap-5 justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <div className="rounded-2xl p-1.5 flex-none" style={{ background: `${agent.color}0f`, border: `1px solid ${agent.color}2e`, boxShadow: `0 24px 55px -26px ${agent.color}` }}>
                  <Robot state={state} color={agent.color} size={90} track />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="font-display text-[22px] font-semibold tracking-tight">{agent.name}</h2>
                    <span className="pill" style={{ color: sm.color, borderColor: `${sm.color}40`, background: `${sm.color}14` }}>
                      {state === "ativo" ? <span className="live-dot" style={{ width: 6, height: 6, background: sm.color }} /> : <span className="dot" style={{ background: sm.color }} />}
                      {sm.label}
                    </span>
                    {agent.tipo && (
                      <span className="pill" style={{ color: agent.tipo === "acao" ? "#a78bfa" : "#22d3ee", borderColor: (agent.tipo === "acao" ? "#a78bfa" : "#22d3ee") + "40", background: (agent.tipo === "acao" ? "#a78bfa" : "#22d3ee") + "14" }}>
                        {agent.tipo === "acao" ? "Ação" : "Resposta"}
                      </span>
                    )}
                  </div>
                  <p className="text-[13.5px] text-[var(--txt-2)] mt-1">{agent.papel}</p>
                  {state === "ativo" && (
                    <div className="flex items-center gap-2 text-[12.5px] text-[var(--txt-3)] mt-2">
                      <Radio size={13} style={{ color: agent.color }} /> {agent.agora}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 flex-none">
                <button onClick={() => setState((s) => (s === "pausado" ? "ativo" : "pausado"))} className="flex items-center gap-2.5">
                  <span className="text-[12.5px] text-[var(--txt-3)]">{state === "pausado" ? "pausado" : "ligado"}</span>
                  <Toggle on={state !== "pausado"} />
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => setSub("melhorar")}><Wand2 size={14} /> Pedir melhoria</button>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="flex gap-1.5 flex-wrap">
        {subs.map((s) => (
          <button key={s.id} onClick={() => setSub(s.id)} className={cx("chip !py-2", sub === s.id && "!border-[var(--line-hi)] !bg-[var(--surface-hi)] !text-[var(--txt)]")}>
            <s.icon size={14} /> {s.label}
            {s.badge != null && (
              <span className="grid place-items-center text-[10px] font-mono rounded-full" style={{ minWidth: 16, height: 16, background: "#8b7cff22", border: "1px solid #8b7cff45", color: "#a78bfa" }}>{s.badge}</span>
            )}
            {s.id === "aovivo" && alerta && <span className="dot" style={{ background: "#fb7185" }} />}
          </button>
        ))}
      </div>

      <motion.div key={sub} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        {sub === "trabalho" && agent.work && <WorkTab agent={agent} />}
        {sub === "aovivo" && <OQueFaz agent={agent} onMelhorar={() => setSub("melhorar")} />}
        {sub === "mudancas" && agent.mapa && <MudancasTab agent={agent} />}
        {sub === "logs" && <LogsTab agent={agent} />}
        {sub === "estrutura" && <Turbinar agent={agent} />}
        {sub === "melhorar" && <MelhorarTab agent={agent} />}
      </motion.div>
    </div>
  );
}

/* ---------- passo a passo ---------- */
const stMeta = {
  ok: { icon: Check, color: "#34d399" },
  erro: { icon: X, color: "#fb7185" },
  run: { icon: Loader2, color: "#8b7cff" },
} as const;

function Fluxo({ agent }: { agent: Agent }) {
  const passos = agent.fluxo!;
  const [fix, setFix] = useState<Record<number, "sim" | "nao">>({});
  const temFalha = passos.some((p) => p.status === "falha");
  const tudoOk = !temFalha && passos.every((p) => p.status === "ok");
  const cor = temFalha ? "#fb7185" : tudoOk ? "#34d399" : "#83879a";
  const lbl = temFalha ? "1 passo falhando" : tudoOk ? "tudo sendo respeitado" : "em espera";
  const sIcon: any = { ok: Check, falha: X, espera: Clock };
  const sCor: any = { ok: "#34d399", falha: "#fb7185", espera: "#83879a" };
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="mono-label">Como funciona — passo a passo</div>
        <span className="pill" style={{ color: cor, borderColor: `${cor}40`, background: `${cor}14` }}>
          {tudoOk ? <span className="live-dot" style={{ width: 6, height: 6, background: cor }} /> : <span className="dot" style={{ background: cor }} />} {lbl}
        </span>
      </div>
      {agent.integracoes && agent.integracoes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {agent.integracoes.map((it) => (
            <span key={it} className="pill"><Plug size={12} style={{ color: agent.color }} /> integra com {it}</span>
          ))}
        </div>
      )}
      <ol>
        {passos.map((p, i) => {
          const SI = sIcon[p.status];
          const c = sCor[p.status];
          const last = i === passos.length - 1;
          return (
            <li key={i} className="relative pl-11 pb-5 last:pb-0">
              {!last && <span className="absolute left-[15px] top-9 bottom-0 w-px bg-[var(--line)]" />}
              <span className="absolute left-0 top-1 grid place-items-center rounded-full" style={{ width: 31, height: 31, background: `${c}16`, border: `1px solid ${c}30` }}>
                <SI size={15} style={{ color: c }} />
              </span>
              <div className="tick !text-[10px]">passo {i + 1}</div>
              <div className="text-[13.5px] font-medium text-[var(--txt)] mt-0.5">{p.label}</div>
              <div className="text-[12px] text-[var(--txt-3)] mt-0.5">deveria: {p.deveria}</div>
              {p.status === "falha" && (
                <div className="mt-2.5 rounded-xl p-3" style={{ border: "1px solid #fb718540", background: "rgba(251,113,133,.07)" }}>
                  <div className="text-[12px]" style={{ color: "#fb7185" }}><b>por quê:</b> {p.porque}</div>
                  {p.sugestao && (
                    <div className="text-[12.5px] text-[var(--txt-2)] mt-2 flex gap-1.5">
                      <Lightbulb size={14} style={{ color: "#8b7cff" }} className="flex-none mt-[1px]" /> {p.sugestao}
                    </div>
                  )}
                  {fix[i] ? (
                    <div className="text-[12px] mt-2.5" style={{ color: fix[i] === "sim" ? "#34d399" : "var(--txt-3)" }}>
                      {fix[i] === "sim" ? "Beleza — vou simular, testar e te mostrar a prova antes de publicar." : "Ok, deixei anotado."}
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-3">
                      <button className="btn btn-primary btn-sm" onClick={() => setFix((s) => ({ ...s, [i]: "sim" }))}>Permitir correção</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setFix((s) => ({ ...s, [i]: "nao" }))}>Agora não</button>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---------- LOGS (o que roda + erros + corrigir + análise diária) ---------- */
function LogsTab({ agent }: { agent: Agent }) {
  const [filtro, setFiltro] = useState<"tudo" | "erros">("tudo");
  const [fix, setFix] = useState<Record<number, "sim" | "nao">>({});
  const { logs: logsReais, stats } = useLive();

  const doFluxo = (agent.fluxo ?? [])
    .filter((p) => p.status === "ok")
    .map((p) => ({ t: "1 h", acao: `Concluiu: ${p.label}`, status: "ok" as const, detalhe: undefined as string | undefined }));
  const logs = [...agent.live, ...doFluxo].map((r, i) => ({ ...r, dur: `${(i % 5) + 1}.${(i * 3) % 10}s`, id: i }));
  const vis = filtro === "erros" ? logs.filter((l) => l.status === "erro") : logs;

  // agente REAL: números do Flight Recorder, não do template
  const meu = agent.real ? stats?.porAgente?.[agent.id] : undefined;
  const meuUltimo = agent.real ? (logsReais ?? []).find((l) => l.agentId === agent.id) : undefined;
  const execsHoje = meu?.execucoes ?? agent.metrics.execucoes;
  const errosHoje = meu ? meu.execucoes - meu.acertos : agent.metrics.erros;
  const rodandoAgora = agent.real
    ? meuUltimo
      ? `há ${tempoRelativo(meuUltimo.at)} — ${meuUltimo.resumo}`
      : "de plantão — aguardando o próximo lead"
    : agent.state === "ativo"
      ? agent.agora
      : "em espera — nada rodando";

  return (
    <div className="space-y-4">
      {/* rodando agora */}
      <div className="card p-4 flex items-center gap-3">
        <span className="grid place-items-center rounded-[10px] flex-none" style={{ width: 34, height: 34, background: `${agent.color}16`, border: `1px solid ${agent.color}30` }}>
          {agent.state === "ativo" ? <Loader2 size={16} className="animate-spin" style={{ color: agent.color }} /> : <Clock size={16} style={{ color: "var(--txt-4)" }} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="mono-label mb-0.5">{agent.real && meuUltimo ? "Último trabalho" : "Rodando agora"}</div>
          <div className="text-[13px] text-[var(--txt)] truncate">{rodandoAgora}</div>
        </div>
        <span className="tick flex-none hidden sm:block">{execsHoje} hoje · {errosHoje} erros</span>
      </div>

      {/* análise diária */}
      <div className="card p-5" style={{ borderColor: "#8b7cff2e", background: "linear-gradient(165deg, rgba(139,124,255,.07), var(--surface))" }}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2"><Sparkles size={16} style={{ color: "#8b7cff" }} /><span className="font-display font-semibold text-[14.5px]">Análise do dia</span></div>
          <Pill color="#8b7cff">rotina diária · 8h</Pill>
        </div>
        <p className="text-[13px] text-[var(--txt-2)] leading-relaxed">
          {agent.real ? (
            <>
              Hoje foram <b className="text-[var(--txt)]">{execsHoje}</b> {execsHoje === 1 ? "atendimento" : "atendimentos"} deste agente.
              {errosHoje > 0 ? <> Peguei <b style={{ color: "#fb7185" }}>{errosHoje} erro(s)</b> — dá pra corrigir no log abaixo.</> : <> Nenhum erro hoje.</>}
            </>
          ) : (
            <>
              Analisei as <b className="text-[var(--txt)]">{agent.metrics.execucoes}</b> execuções de hoje. A última mudança rendeu <b style={{ color: "#34d399" }}>+6% de acerto</b>.
              {agent.metrics.erros > 0 ? <> Peguei <b style={{ color: "#fb7185" }}>{agent.metrics.erros} erro(s)</b> — dá pra corrigir no log abaixo.</> : <> Nenhum erro hoje.</>}
            </>
          )}
        </p>
        <div className="text-[11px] text-[var(--txt-4)] mt-2">a análise pesada roda 1× por dia (barata e escalável); os erros aparecem no log na hora que acontecem.</div>
      </div>

      {/* log */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="mono-label">Log de execuções</div>
          <div className="flex gap-1.5">
            {(["tudo", "erros"] as const).map((f) => (
              <button key={f} onClick={() => setFiltro(f)} className={cx("chip !py-1", filtro === f && "!border-[var(--line-hi)] !bg-[var(--surface-hi)] !text-[var(--txt)]")}>{f === "tudo" ? "tudo" : "só erros"}</button>
            ))}
          </div>
        </div>
        <ul className="space-y-1">
          {vis.map((r) => {
            const st = stMeta[r.status];
            const err = r.status === "erro";
            return (
              <li key={r.id} className="py-2.5 border-b border-[var(--line)] last:border-0" style={err ? { background: "rgba(251,113,133,.05)" } : undefined}>
                <div className="flex items-start gap-3">
                  <span className="grid place-items-center rounded-lg flex-none mt-0.5" style={{ width: 26, height: 26, background: `${st.color}16`, border: `1px solid ${st.color}30` }}>
                    <st.icon size={13} style={{ color: st.color }} className={r.status === "run" ? "animate-spin" : ""} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-[var(--txt)]">{r.acao}</div>
                    {r.detalhe && <div className="text-[11.5px] mt-0.5" style={{ color: err ? "#fb7185" : "var(--txt-3)" }}>{err ? "por quê: " : ""}{r.detalhe}</div>}
                  </div>
                  <span className="tick flex-none font-mono">{r.dur}</span>
                  <span className="tick flex-none w-8 text-right">{r.t}</span>
                </div>
                {err && (
                  fix[r.id] ? (
                    <div className="ml-9 mt-2 text-[12px]" style={{ color: fix[r.id] === "sim" ? "#34d399" : "var(--txt-3)" }}>
                      {fix[r.id] === "sim" ? "Preparando a correção — simulo, testo e te mostro a prova antes de publicar." : "Ok, deixei anotado."}
                    </div>
                  ) : (
                    <div className="ml-9 mt-2 flex gap-2">
                      <button className="btn btn-primary btn-sm" onClick={() => setFix((s) => ({ ...s, [r.id]: "sim" }))}>Corrigir isto</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setFix((s) => ({ ...s, [r.id]: "nao" }))}>Agora não</button>
                    </div>
                  )
                )}
              </li>
            );
          })}
          {vis.length === 0 && <li className="text-[12.5px] text-[var(--txt-3)] py-4 text-center">Nenhum erro — tá tudo rodando limpo 🎉</li>}
        </ul>
      </div>
    </div>
  );
}

/* ---------- O QUE FAZ (passo a passo + o que melhorar) ---------- */
function OQueFaz({ agent, onMelhorar }: { agent: Agent; onMelhorar: () => void }) {
  const m = agent.metrics;
  const pct = Math.round((m.acertos / Math.max(1, m.execucoes)) * 100);
  const insights = agent.insights ?? [];
  return (
    <div className="space-y-4">
      {/* com mapa: a LEITURA do processo (sem botão) substitui o passo a passo genérico */}
      {agent.mapa ? <MapaTab agent={agent} /> : agent.fluxo && <Fluxo agent={agent} />}

      {/* fazendo agora + números, numa linha só */}
      <div className="card p-4 flex items-center gap-3 overflow-hidden">
        <Robot state={agent.state} color={agent.color} size={38} />
        <div className="min-w-0 flex-1">
          <div className="mono-label mb-1">Fazendo agora</div>
          <div className="text-[13.5px] text-[var(--txt)] truncate">{agent.state === "ativo" ? agent.agora : "em espera — nada rodando"}</div>
        </div>
        <div className="hidden sm:flex items-center gap-3 flex-none font-mono text-[12px]">
          <span className="text-[var(--txt-3)]">{m.execucoes} hoje</span>
          <span style={{ color: "#34d399" }}>{pct}% ok</span>
          <span style={{ color: m.erros ? "#fb7185" : "var(--txt-4)" }}>{m.erros} erros</span>
        </div>
      </div>

      {/* o que dá pra melhorar */}
      {insights.length > 0 && (
        <div>
          <div className="mono-label flex items-center gap-1.5 mb-3"><Lightbulb size={12} style={{ color: "#8b7cff" }} /> O que dá pra melhorar</div>
          <div className="grid md:grid-cols-2 gap-3">
            {insights.map((ins, i) => <InsightCard key={i} ins={ins} onGo={onMelhorar} />)}
          </div>
        </div>
      )}
    </div>
  );
}

const insMeta = {
  elogio: { icon: ThumbsUp, color: "#34d399", tag: "indo bem" },
  critico: { icon: AlertTriangle, color: "#fbbf24", tag: "pede permissão" },
  dica: { icon: Lightbulb, color: "#8b7cff", tag: "ideia" },
} as const;

function InsightCard({ ins, onGo }: { ins: Insight; onGo: () => void }) {
  const [done, setDone] = useState<null | "sim" | "nao">(null);
  const meta = insMeta[ins.tipo];
  return (
    <div className="card p-4 h-full flex flex-col" style={{ borderColor: `${meta.color}2e`, background: `linear-gradient(165deg, ${meta.color}0d, var(--surface))` }}>
      <div className="flex items-center gap-2.5 mb-2">
        <span className="grid place-items-center rounded-[10px] flex-none" style={{ width: 30, height: 30, background: `${meta.color}18`, border: `1px solid ${meta.color}33` }}>
          <meta.icon size={15} style={{ color: meta.color }} />
        </span>
        <div className="min-w-0">
          <div className="font-display font-semibold text-[13.5px] leading-tight">{ins.titulo}</div>
          <span className="mono-label !text-[9px]" style={{ color: meta.color }}>{meta.tag}</span>
        </div>
      </div>
      <p className="text-[12.5px] text-[var(--txt-2)] leading-relaxed flex-1">{ins.texto}</p>
      {ins.prova && (
        <div className="mt-2.5 text-[11px] rounded-lg px-2.5 py-1.5" style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--txt-3)" }}>
          <Check size={11} className="inline mr-1" style={{ color: "#34d399" }} /> prova: {ins.prova}
        </div>
      )}
      {ins.ganho && ins.tipo !== "critico" && (
        <div className="mt-2.5 flex items-center justify-between">
          <Pill color={meta.color}>ganho: {ins.ganho}</Pill>
          <button className="btn btn-ghost btn-sm" onClick={onGo}>Ver como <ArrowRight size={13} /></button>
        </div>
      )}
      {ins.tipo === "critico" && (
        done ? (
          <div className="mt-2.5 text-[12px]" style={{ color: done === "sim" ? "#34d399" : "var(--txt-3)" }}>
            {done === "sim" ? "Beleza — vou preparar, simular e te mostrar a prova antes de publicar." : "Ok, deixei anotado."}
          </div>
        ) : (
          <div className="mt-2.5 flex items-center gap-2">
            <button className="btn btn-primary btn-sm" onClick={() => setDone("sim")}>Permitir correção</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setDone("nao")}>Agora não</button>
          </div>
        )
      )}
    </div>
  );
}

/* ---------- TURBINAR (núcleo + recursos + ligar com setup guiado) ---------- */
function Turbinar({ agent }: { agent: Agent }) {
  const [feats, setFeats] = useState(agent.features.map((f) => f.on));
  const [installed, setInstalled] = useState<string[]>([]);
  const [setup, setSetup] = useState<Upgrade | null>(null);
  const upgrades = agent.upgrades ?? [];
  const disponiveis = upgrades.filter((u) => !installed.includes(u.name));

  return (
    <div className="space-y-4">
      {/* núcleo blindado */}
      <div className="card p-4 flex items-start gap-3" style={{ borderColor: "#34d39930", background: "linear-gradient(160deg, rgba(52,211,153,.06), var(--surface))" }}>
        <ShieldCheck size={18} style={{ color: "#34d399" }} className="flex-none mt-0.5" />
        <p className="text-[12.5px] text-[var(--txt-2)]"><b className="text-[var(--txt)]">Núcleo blindado.</b> {agent.shield} Você liga recursos por cima — nunca quebra o que já roda.</p>
      </div>

      {/* recursos ligados */}
      <div className="card p-5">
        <div className="mono-label mb-4">Recursos ligados</div>
        <div className="grid sm:grid-cols-2 gap-2.5">
          {agent.features.map((f, i) => (
            <div key={f.name} className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
              <span className="grid place-items-center rounded-[10px] flex-none" style={{ width: 34, height: 34, background: `${agent.color}14`, border: `1px solid ${agent.color}2e` }}>
                <f.icon size={16} style={{ color: agent.color }} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium truncate">{f.name}</div>
                <span className="text-[10.5px]" style={{ color: f.fonte === "mcp" ? "#8b7cff" : "var(--txt-4)" }}>{f.fonte === "mcp" ? "criada por você · MCP" : "Metrik"}</span>
              </div>
              <button onClick={() => setFeats((s) => s.map((v, idx) => (idx === i ? !v : v)))} className="flex-none"><Toggle on={feats[i]} /></button>
            </div>
          ))}
          {upgrades.filter((u) => installed.includes(u.name)).map((u) => (
            <motion.div key={u.name} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 rounded-xl p-3" style={{ border: "1px solid #8b7cff40", background: "rgba(139,124,255,.08)" }}>
              <span className="grid place-items-center rounded-[10px] flex-none" style={{ width: 34, height: 34, background: "rgba(139,124,255,.16)", border: "1px solid rgba(139,124,255,.3)" }}>
                <u.icon size={16} style={{ color: "#8b7cff" }} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium truncate">{u.name}</div>
                <span className="text-[10.5px]" style={{ color: "#8b7cff" }}>ligado · caiu em {u.onde}</span>
              </div>
              <Toggle on />
            </motion.div>
          ))}
        </div>
      </div>

      {/* turbinar — ligar com setup */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="mono-label">Turbinar este agente</div>
          <span className="text-[11px] text-[var(--txt-4)]">só entra neste robô</span>
        </div>
        <p className="text-[12px] text-[var(--txt-3)] mb-4">Antes de ligar, você escolhe <b className="text-[var(--txt-2)]">como vai funcionar</b>. Nada liga no escuro.</p>
        {disponiveis.length === 0 ? (
          <div className="text-[12.5px] text-[var(--txt-3)] py-4 text-center">Tudo ligado neste agente 🎉</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {disponiveis.map((u) => (
              <div key={u.name} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 flex flex-col">
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="grid place-items-center rounded-[10px] flex-none" style={{ width: 32, height: 32, background: `${agent.color}12`, border: `1px solid ${agent.color}2a` }}>
                    <u.icon size={15} style={{ color: agent.color }} />
                  </span>
                  <span className="font-display font-semibold text-[13.5px]">{u.name}</span>
                </div>
                <p className="text-[12.5px] text-[var(--txt-2)] leading-snug mb-3 flex-1">{u.blurb}</p>
                <button className="btn btn-sm w-full mt-auto" onClick={() => setSetup(u)}><Plus size={14} /> Ligar</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {setup && (
          <UpgradeSetup
            agent={agent}
            upgrade={setup}
            onCancel={() => setSetup(null)}
            onConfirm={() => { setInstalled((s) => [...s, setup.name]); setSetup(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function UpgradeSetup({ agent, upgrade, onCancel, onConfirm }: { agent: Agent; upgrade: Upgrade; onCancel: () => void; onConfirm: () => void }) {
  const cfg = upgrade.config ?? [];
  const [sel, setSel] = useState<string[]>(cfg.map((c) => c.opcoes[0]));
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <motion.div className="relative w-full max-w-[460px] card !rounded-2xl overflow-hidden" initial={{ scale: 0.97, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 8 }} transition={{ duration: 0.18 }} onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-[var(--line)] flex items-center gap-3">
          <span className="grid place-items-center rounded-[11px] flex-none" style={{ width: 38, height: 38, background: `${agent.color}16`, border: `1px solid ${agent.color}33` }}>
            <upgrade.icon size={18} style={{ color: agent.color }} />
          </span>
          <div>
            <div className="font-display font-semibold text-[15px]">{upgrade.name}</div>
            <div className="text-[12px] text-[var(--txt-3)]">como vai funcionar</div>
          </div>
        </div>

        <div className="p-5 space-y-4 max-h-[52vh] overflow-y-auto scroll-thin">
          {(upgrade.resultado || upgrade.criterio) && (
            <div className="rounded-xl p-3" style={{ background: `${agent.color}0d`, border: `1px solid ${agent.color}26` }}>
              {upgrade.resultado && <div className="text-[12.5px] text-[var(--txt)]"><b>O que acontece:</b> {upgrade.resultado}.</div>}
              {upgrade.criterio && <div className="text-[12px] text-[var(--txt-2)] mt-1.5"><b>Como ele decide:</b> {upgrade.criterio}.</div>}
            </div>
          )}
          {cfg.map((c, ci) => (
            <div key={ci}>
              <div className="mono-label mb-2">{c.pergunta}</div>
              <div className="flex flex-wrap gap-1.5">
                {c.opcoes.map((o) => (
                  <button key={o} onClick={() => setSel((s) => s.map((v, i) => (i === ci ? o : v)))} className={cx("chip !py-1.5", sel[ci] === o && "!border-[var(--line-hi)] !bg-[var(--surface-hi)] !text-[var(--txt)]")}>
                    {sel[ci] === o && <Check size={12} style={{ color: agent.color }} />} {o}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="rounded-xl p-3" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
            <div className="text-[11px] text-[var(--txt-3)] mb-1">vai funcionar assim</div>
            <p className="text-[12.5px] text-[var(--txt)]">{upgrade.blurb}{sel.length ? " — " + sel.join(" · ") : ""}.</p>
            <div className="text-[11px] text-[var(--txt-4)] mt-1.5 flex items-center gap-1.5"><ArrowRight size={11} style={{ color: agent.color }} /> cai em: {upgrade.onde}</div>
            {upgrade.sinergia && <div className="text-[11px] text-[var(--txt-4)] mt-1 flex items-center gap-1.5"><Link2 size={11} style={{ color: "#22d3ee" }} /> {upgrade.sinergia}</div>}
          </div>
        </div>

        <div className="p-4 border-t border-[var(--line)] flex items-center justify-between gap-2">
          <div className="text-[11px] text-[var(--txt-4)] flex items-center gap-1.5"><ShieldCheck size={13} style={{ color: "#34d399" }} /> não toca no núcleo</div>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={onConfirm}><Check size={14} /> Ativar</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---------- MELHORAR (pedir + simular + histórico único) ---------- */
const RESP: Record<string, { tipo: string; txt: string }> = {
  "Deixa o follow-up com só 2 toques": { tipo: "ajuste", txt: "É um ajuste no motor de Follow-up (3 → 2 toques). Não é recurso novo. Deixei como rascunho — simule ao lado antes de publicar." },
  "Puxa o preço de outra API": { tipo: "novo", txt: "Isso liga um recurso NOVO (integração de preço). Vai aparecer em “Recursos ligados” com origem “você · chat”. Simule ao lado." },
  "Fala num tom mais próximo": { tipo: "ajuste", txt: "Ajuste de tom, dentro do que é permitido. Rascunho pronto — é só simular." },
  "Não oferece desconto sem eu aprovar": { tipo: "regra", txt: "Vira uma trava (regra) e fica registrada no histórico abaixo. Simule pra confirmar que ela segura." },
};
const respMeta: Record<string, { label: string; color: string }> = {
  ajuste: { label: "ajuste", color: "#fbbf24" },
  novo: { label: "recurso novo", color: "#8b7cff" },
  regra: { label: "trava / regra", color: "#22d3ee" },
};
const ORIG: Record<string, { label: string; color: string }> = {
  metrik: { label: "Metrik", color: "#83879a" },
  chat: { label: "chat", color: "#22d3ee" },
  ajuste: { label: "botão", color: "#fbbf24" },
  claude: { label: "Claude Code", color: "#8b7cff" },
  codex: { label: "Codex", color: "#22d3ee" },
};

type EnsaioSit = { nome: string; pergunta: string; antes: string; agora: string };
type EnvioState = {
  fase: "idle" | "registrando" | "ensaiando" | "pronto" | "publicando" | "publicado" | "erro";
  cs?: any;
  evals?: any;
  ensaio?: { modo: "real" | "sem-cerebro"; situacoes: EnsaioSit[] };
  pedido?: string;
  erro?: string;
};

function MelhorarTab({ agent }: { agent: Agent }) {
  const auth = useMotorAuth();
  const [gravando, setGravando] = useState(false);
  const [texto, setTexto] = useState("");
  const [envio, setEnvio] = useState<EnvioState>({ fase: "idle" });
  const [reaisHist, setReaisHist] = useState<any[] | null>(null);

  useEffect(() => {
    if (!agent.real) return;
    let vivo = true;
    (api.listChangeSets(agent.id, auth.getToken) as Promise<any[]>)
      .then((rows) => {
        if (vivo && Array.isArray(rows) && rows.length > 0) setReaisHist(rows);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id, envio.fase]);

  // pedir → registra a mudança → o guardião testa e monta o ENSAIO (antes/agora)
  const enviar = async () => {
    const t = texto.trim();
    if (!t || envio.fase === "registrando" || envio.fase === "ensaiando") return;
    if (!agent.real) {
      setEnvio({ fase: "erro", erro: "modo demo — com o agente real, o pedido entra no histórico único, passa no guardião e você vê o ensaio antes/agora" });
      return;
    }
    try {
      setEnvio({ fase: "registrando", pedido: t });
      const cs: any = await api.propor({ agentId: agent.id, origin: "hub_chat", intent: t, patch: { pedido: t } }, auth.getToken);
      setEnvio({ fase: "ensaiando", cs, pedido: t });
      const r: any = await api.avaliar(cs.id, auth.getToken);
      setEnvio({ fase: "pronto", cs, evals: r.evals, ensaio: r.ensaio, pedido: t });
      setTexto("");
    } catch (e) {
      setEnvio({ fase: "erro", erro: e instanceof Error ? e.message : "erro ao registrar" });
    }
  };

  // é isso que você queria → PUBLICA de verdade (compila a spec nova + release)
  const publicar = async () => {
    try {
      setEnvio((s) => ({ ...s, fase: "publicando" }));
      await api.publicarMudanca(envio.cs.id, auth.getToken);
      setEnvio((s) => ({ ...s, fase: "publicado" }));
    } catch (e) {
      setEnvio({ fase: "erro", erro: e instanceof Error ? e.message : "erro ao publicar" });
    }
  };

  // não é isso → volta pro campo pra reescrever o pedido de outro jeito
  const ajustar = () => setEnvio({ fase: "idle" });

  // Histórico REAL (ledger do Neon) quando o agente é real; senão o demo.
  const ORIGIN_KEY: Record<string, string> = { hub_chat: "chat", hub_visual: "ajuste", claude_code: "claude", codex: "codex", metrik: "metrik", api: "claude" };
  const ESTADO_LBL: Record<string, string> = { draft: "recebido", evaluated: "testado", approved: "aprovado", published: "no ar", ignored: "ignorado", rejected: "rejeitado" };
  const histReal = reaisHist?.map((r) => ({
    origem: ORIGIN_KEY[r.origin] ?? "chat",
    oque: r.origin === "hub_chat" ? `Você pediu: “${r.intent}”` : r.intent ?? "mudança",
    quando: r.createdAt ? tempoRelativo(r.createdAt) : "",
    estado: ESTADO_LBL[r.status] ?? String(r.status ?? ""),
  }));
  const hist = histReal ?? [];
  const emPreparo = hist.filter((h) => ["rascunho", "recebido", "testado", "aprovado"].includes(h.estado)).length;

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-start gap-3">
        <Link2 size={17} style={{ color: "#8b7cff" }} className="flex-none mt-0.5" />
        <p className="text-[12.5px] text-[var(--txt-2)]"><b className="text-[var(--txt)]">Uma fonte só.</b> Você pode pedir aqui, ligar no Turbinar ou mexer pelo Claude Code — tudo cai no mesmo agente e aparece no histórico abaixo. Nada duplica, nada se perde.</p>
      </div>

      {/* ── PEDIR: campo livre (chip preenche o campo; áudio vira texto) ── */}
      {envio.fase === "idle" || envio.fase === "registrando" || envio.fase === "ensaiando" || envio.fase === "erro" ? (
        <div className="card p-5">
          <div className="mono-label mb-3">Peça uma mudança — escreva do seu jeito</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {CHAT_EXEMPLOS.map((c) => (
              <button key={c} onClick={() => setTexto(c)} className="chip">{c}</button>
            ))}
          </div>
          <div className="flex items-end gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-2 focus-within:border-[var(--line-hi)] transition-colors" style={gravando ? { borderColor: "#fb718560" } : undefined}>
            <textarea
              rows={2}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(); } }}
              placeholder={gravando ? "gravando o áudio…" : `Ex: quando o lead perguntar sobre prazo do auxílio-doença, explica que dá pra pedir em até 30 dias…`}
              className="flex-1 bg-transparent resize-none px-2 py-1.5 text-[13.5px] outline-none placeholder:text-[var(--txt-4)]"
            />
            <button onClick={() => setGravando((g) => !g)} title="Falar em vez de digitar (vira texto)" className={cx("btn !p-2.5 !rounded-xl flex-none", gravando && "!border-[#fb7185]")}>
              {gravando ? <span className="live-dot" style={{ width: 12, height: 12, background: "#fb7185" }} /> : <Mic size={16} />}
            </button>
            <button onClick={() => void enviar()} disabled={!texto.trim() || envio.fase === "registrando" || envio.fase === "ensaiando"} className="btn btn-primary !px-4 !py-2.5 !rounded-xl flex-none">
              {envio.fase === "registrando" || envio.fase === "ensaiando" ? <Loader2 size={16} className="animate-spin" /> : <><FlaskConical size={15} /> Ensaiar</>}
            </button>
          </div>
          {gravando ? (
            <div className="text-[11.5px] mt-2 flex items-center gap-1.5" style={{ color: "#fb7185" }}>
              <span className="live-dot" style={{ width: 6, height: 6, background: "#fb7185" }} /> gravando… fale a mudança e toque no microfone — vira texto no campo
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-3 text-[11.5px] text-[var(--txt-4)]">
              <ShieldCheck size={13} style={{ color: "#34d399" }} /> você escreve, o guardião testa e você vê o antes/agora antes de qualquer coisa ir pro ar
            </div>
          )}
          {(envio.fase === "registrando" || envio.fase === "ensaiando") && (
            <div className="mt-3 flex items-center gap-2 text-[12.5px] text-[var(--txt-2)]">
              <Loader2 size={14} className="animate-spin" style={{ color: "#8b7cff" }} />
              {envio.fase === "registrando" ? "anotando o seu pedido…" : "montando o ensaio — a IA respondendo antes e depois da mudança…"}
            </div>
          )}
          {envio.fase === "erro" && (
            <div className="mt-3 rounded-xl p-3 text-[12.5px]" style={{ border: "1px solid #fb718540", background: "rgba(251,113,133,.07)", color: "#fb7185" }}>{envio.erro}</div>
          )}
        </div>
      ) : null}

      {/* ── ENSAIO: a simulação claríssima — antes vs agora + guardião ── */}
      {envio.fase === "pronto" && envio.evals && (
        <Reveal>
          <div className="card p-5 md:p-6" style={{ borderColor: "#8b7cff2e" }}>
            <div className="flex items-center gap-2 mb-1">
              <FlaskConical size={17} style={{ color: "#8b7cff" }} />
              <span className="font-display font-semibold text-[16px]">O ensaio da sua mudança</span>
            </div>
            <p className="text-[13.5px] text-[var(--txt-2)] mb-4">Você pediu: <b className="text-[var(--txt)]">“{envio.pedido}”</b></p>

            {/* GUARDIÃO — o porteiro que carimba antes de ir pro ar */}
            <div className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3" style={{
              border: `1px solid ${envio.evals.aprovado ? "#34d39938" : "#fb718538"}`,
              background: envio.evals.aprovado ? "rgba(52,211,153,.07)" : "rgba(251,113,133,.07)",
            }}>
              <ShieldCheck size={20} style={{ color: envio.evals.aprovado ? "#34d399" : "#fb7185" }} className="flex-none" />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium text-[var(--txt)]">
                  {envio.evals.aprovado
                    ? "O guardião testou e a mudança não quebrou nenhuma trava do núcleo."
                    : "O guardião segurou: essa mudança encostaria numa trava protegida."}
                </div>
                <div className="text-[11.5px] text-[var(--txt-3)] mt-0.5">
                  {envio.evals.passaram}/{envio.evals.total} testes de segurança passaram · nota {(envio.evals.taxa * 10).toFixed(1).replace(".", ",")}
                </div>
              </div>
            </div>

            {/* ANTES vs AGORA — a simulação em si */}
            <div className="mono-label mb-3">Antes vs agora — a IA respondendo</div>
            {envio.ensaio?.modo === "real" && envio.ensaio.situacoes.length > 0 ? (
              <div className="space-y-4">
                {envio.ensaio.situacoes.map((s, i) => (
                  <div key={i} className="rounded-xl border border-[var(--line)] overflow-hidden">
                    <div className="px-4 py-2.5 bg-[var(--surface-2)] text-[12.5px] text-[var(--txt-2)]">
                      <span className="text-[var(--txt-4)]">situação:</span> {s.pergunta}
                    </div>
                    <div className="grid md:grid-cols-2">
                      <div className="p-4 border-t md:border-t-0 md:border-r border-[var(--line)]">
                        <div className="mono-label !text-[9px] mb-1.5 !text-[var(--txt-4)]">antes</div>
                        <p className="text-[13px] text-[var(--txt-3)] leading-relaxed">{s.antes}</p>
                      </div>
                      <div className="p-4 border-t border-[var(--line)]" style={{ background: "rgba(52,211,153,.05)" }}>
                        <div className="mono-label !text-[9px] mb-1.5" style={{ color: "#34d399" }}>agora</div>
                        <p className="text-[13px] text-[var(--txt)] leading-relaxed">{s.agora}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl px-4 py-4 text-[12.5px] leading-relaxed" style={{ border: "1px dashed var(--line-hi)", background: "var(--surface)", color: "var(--txt-2)" }}>
                O guardião já garantiu que a mudança <b className="text-[var(--txt)]">não quebra nenhuma trava</b>. Pra ver o ensaio ao vivo — a IA respondendo <b>antes</b> e <b>agora</b>, lado a lado — falta ligar o cérebro (a chave da OpenAI) neste ambiente.
              </div>
            )}

            {/* DECISÃO — é isso que você queria? */}
            <div className="mt-6 pt-4 border-t border-[var(--line)]">
              <div className="text-[14px] font-medium text-[var(--txt)] mb-3">É isso que você queria?</div>
              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={() => void publicar()}
                  disabled={!envio.evals.aprovado}
                  className="btn btn-primary"
                  style={{ opacity: envio.evals.aprovado ? 1 : 0.5 }}
                  title={envio.evals.aprovado ? "" : "o guardião segurou — ajuste o pedido primeiro"}
                >
                  <Rocket size={15} /> Sim — publicar pro ar
                </button>
                <button onClick={ajustar} className="btn"><Wand2 size={15} /> Não — quero ajustar</button>
              </div>
              {!envio.evals.aprovado && (
                <p className="text-[11.5px] text-[var(--txt-4)] mt-2">O guardião segurou essa. Clique em “ajustar” e reescreva o pedido de outro jeito.</p>
              )}
            </div>
          </div>
        </Reveal>
      )}

      {(envio.fase === "publicando" || envio.fase === "publicado") && (
        <Reveal>
          <div className="card p-5 flex items-center gap-3" style={{ borderColor: envio.fase === "publicado" ? "#34d39940" : "var(--line)", background: envio.fase === "publicado" ? "rgba(52,211,153,.06)" : undefined }}>
            {envio.fase === "publicando" ? (
              <><Loader2 size={18} className="animate-spin" style={{ color: "#8b7cff" }} /> <span className="text-[13.5px] text-[var(--txt-2)]">publicando a nova versão…</span></>
            ) : (
              <>
                <div className="grid place-items-center rounded-full flex-none" style={{ width: 34, height: 34, background: "rgba(52,211,153,.14)", border: "1px solid rgba(52,211,153,.34)" }}><Check size={17} style={{ color: "#34d399" }} /></div>
                <div>
                  <div className="text-[14px] font-medium text-[var(--txt)]">No ar! A mudança já está valendo pra sua IA.</div>
                  <div className="text-[12px] text-[var(--txt-3)] mt-0.5">Ela virou uma nova versão registrada — veja na aba <b>Mudanças</b> e no histórico abaixo.</div>
                </div>
              </>
            )}
          </div>
        </Reveal>
      )}

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="mono-label">Histórico — tudo que mudou</div>
          {histReal && <span className="pill" style={{ color: "var(--emerald)" }}>dado real ✓</span>}
        </div>
        <p className="text-[12px] text-[var(--txt-3)] mb-4">De qualquer porta: aqui, no Turbinar, ou pelo Claude Code. Nada duplica, nada se perde.</p>
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="pill" style={{ color: "#34d399", borderColor: "#34d39940", background: "#34d39914" }}>{hist.filter((h) => h.estado === "no ar").length} no ar</span>
          <span className="pill" style={{ color: "#fbbf24", borderColor: "#fbbf2440", background: "#fbbf2414" }}>{emPreparo} em preparo</span>
          <span className="pill">{hist.filter((h) => h.estado === "ignorado").length} não precisou</span>
        </div>
        <ul className="space-y-1">
          {hist.map((h, i) => {
            const o = ORIG[h.origem] ?? ORIG.chat;
            const ec = h.estado === "no ar" ? "#34d399" : ["rascunho", "recebido", "testado", "aprovado"].includes(h.estado) ? "#fbbf24" : "#83879a";
            return (
              <li key={i} className="flex items-center gap-3 py-2.5 border-b border-[var(--line)] last:border-0">
                <span className="pill flex-none justify-center" style={{ color: o.color, borderColor: `${o.color}40`, background: `${o.color}14`, minWidth: 96 }}>{o.label}</span>
                <span className="text-[13px] text-[var(--txt)] flex-1 min-w-0 truncate">{h.oque}</span>
                <span className="tick flex-none hidden sm:block">{h.quando}</span>
                <span className="pill flex-none" style={{ color: ec, borderColor: `${ec}40`, background: `${ec}14` }}>{h.estado}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
