import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Radio, Zap, Wand2, Check, X, Loader2, ShieldCheck, Lock, Plus,
  ArrowUp, Play, FlaskConical, Rocket, Lightbulb, ThumbsUp, AlertTriangle,
  Link2, ArrowRight, CalendarClock, Repeat, FileSignature, BookOpen, ListChecks, Plug, Clock, Mic, ScrollText, Sparkles, MessageCircle,
} from "lucide-react";
import { type Agent, type AgentState, type Insight, type Upgrade, type Selo, STATE_META, CHAT_EXEMPLOS, SELO_META, conferir } from "../data";
import { Reveal, Pill, Toggle, cx } from "../ui";
import { Robot } from "../Robot";
import WorkTab from "./WorkTab";
import Conversas from "./Conversas";
import Followup from "./Followup";
import MapaTab from "./MapaTab";
import MapaAcao from "./MapaAcao";
import MudancasTab from "./MudancasTab";
import { api } from "../lib/api";
import { useMotorAuth } from "../lib/auth";
import { tempoRelativo, useLive } from "../lib/live";

// 3 LUGARES (redesign aprovado no canvas "Agente por Dentro"): VER · ENTENDER · MELHORAR.
type Sub = "aovivo" | "comofunciona" | "melhorar";
/** aceita deep-links antigos (estrutura/trabalho/logs…) e mapeia pros 3 lugares */
function normalizeSub(s?: string): Sub {
  if (s === "melhorar") return "melhorar";
  if (s === "estrutura" || s === "comofunciona" || s === "mudancas") return "comofunciona";
  return "aovivo";
}

export default function AgentDetail({ agent, onBack, initialSub }: { agent: Agent; onBack: () => void; initialSub?: string }) {
  const auth = useMotorAuth();
  const [sub, setSub] = useState<Sub>(normalizeSub(initialSub));
  // quando o cliente clica "Melhorar isto" num erro do Diário (ou num insight),
  // o caso já vai ESCRITO pro Melhorar — a única porta de mudança.
  const [melhorarSeed, setMelhorarSeed] = useState<string | null>(null);
  const irMelhorar = (seed?: string) => { setMelhorarSeed(seed ?? null); setSub("melhorar"); };

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
  const [pausaMsg, setPausaMsg] = useState<string | null>(null);
  const sm = STATE_META[state];

  // PAUSE REAL: persiste o estado no banco (o runtime lê antes de responder).
  // Agente demo segue só visual; agente real para/volta de verdade.
  const alternarEstado = async () => {
    const novo: AgentState = state === "pausado" ? "ativo" : "pausado";
    setState(novo);
    if (!agent.real) return;
    try {
      await api.setEstado(agent.id, novo === "pausado" ? "pausado" : "ativo", auth.getToken);
      setPausaMsg(novo === "pausado" ? "Pausado — a IA parou de responder os leads." : "Ligado — a IA voltou a responder.");
      window.setTimeout(() => setPausaMsg(null), 4000);
    } catch (e) {
      setState((s) => (s === "pausado" ? "ativo" : "pausado")); // desfaz na falha
      setPausaMsg(e instanceof Error ? e.message : "não consegui mudar o estado");
    }
  };
  const alerta = (agent.fluxo ?? []).some((p) => p.status === "falha") || (agent.insights ?? []).some((i) => i.tipo === "critico");
  // 3 LUGARES: Ao vivo (ver) · Como funciona (entender) · Melhorar (a porta única).
  const nMud = nReal > 0 ? nReal : (agent.mapa?.mudancas?.length ?? 0);
  const subs: { id: Sub; label: string; icon: any; badge?: number }[] = [
    { id: "aovivo", label: "Ao vivo", icon: Radio },
    { id: "comofunciona", label: "Como funciona", icon: BookOpen, badge: nMud > 0 ? nMud : undefined },
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
                      <span className="pill" style={{ color: agent.tipo === "acao" ? "#edc074" : "#58aae4", borderColor: (agent.tipo === "acao" ? "#edc074" : "#58aae4") + "40", background: (agent.tipo === "acao" ? "#edc074" : "#58aae4") + "14" }}>
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
                <button onClick={() => void alternarEstado()} className="flex items-center gap-2.5" title={state === "pausado" ? "ligar — a IA volta a responder" : "pausar — a IA para de responder os leads"}>
                  <span className="text-[12.5px] text-[var(--txt-3)]">{state === "pausado" ? "pausado" : "ligado"}</span>
                  <Toggle on={state !== "pausado"} />
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => setSub("melhorar")}><Wand2 size={14} /> Pedir melhoria</button>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {(pausaMsg || state === "pausado") && (
        <div className="rounded-xl px-4 py-2.5 text-[12.5px] flex items-center gap-2" style={{
          border: `1px solid ${state === "pausado" ? "#fbbf2440" : "#34d39940"}`,
          background: state === "pausado" ? "rgba(251,191,36,.08)" : "rgba(52,211,153,.08)",
          color: state === "pausado" ? "#fbbf24" : "#34d399",
        }}>
          {state === "pausado" ? <Clock size={14} /> : <Check size={14} />}
          {pausaMsg ?? "Este agente está pausado — a IA não está respondendo os leads. Ligue no botão acima quando quiser retomar."}
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {subs.map((s) => (
          <button key={s.id} onClick={() => setSub(s.id)} className={cx("chip !py-2", sub === s.id && "!border-[var(--line-hi)] !bg-[var(--surface-hi)] !text-[var(--txt)]")}>
            <s.icon size={14} /> {s.label}
            {s.badge != null && (
              <span className="grid place-items-center text-[10px] font-mono rounded-full" style={{ minWidth: 16, height: 16, background: "#e0a44a22", border: "1px solid #e0a44a45", color: "#edc074" }}>{s.badge}</span>
            )}
            {s.id === "aovivo" && alerta && <span className="dot" style={{ background: "#fb7185" }} />}
          </button>
        ))}
      </div>

      <motion.div key={sub} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        {sub === "aovivo" && <AoVivoTab agent={agent} onMelhorar={irMelhorar} />}
        {sub === "comofunciona" && <ComoFuncionaTab agent={agent} onMelhorar={irMelhorar} />}
        {sub === "melhorar" && <MelhorarTab agent={agent} initialTexto={melhorarSeed} />}
      </motion.div>
    </div>
  );
}

/* ═══════════ LUGAR 1 · AO VIVO — "o que está acontecendo?" ═══════════ */
function AoVivoTab({ agent, onMelhorar }: { agent: Agent; onMelhorar: (seed?: string) => void }) {
  const auth = useMotorAuth();
  const { logs, stats } = useLive();

  // placar do dia (selos conferidos na hora — a mesma honestidade do Diário)
  const doFluxo = (agent.fluxo ?? []).filter((p) => p.status === "ok").map((p) => ({ t: "1 h", acao: `Concluiu: ${p.label}`, status: "ok" as const }));
  const locais = [...agent.live, ...doFluxo].filter((l) => l.status !== "run").map((r) => ({ ...r, conf: conferir(r) }));
  const temConf = locais.some((l) => (l as { conferencia?: unknown }).conferencia != null);
  const cont = (s: Selo) => locais.filter((l) => l.conf.veredito === s).length;
  const meu = agent.real ? stats?.porAgente?.[agent.id] : undefined;
  const meuUltimo = agent.real ? (logs ?? []).find((l) => l.agentId === agent.id) : undefined;
  const execsHoje = meu?.execucoes ?? agent.metrics.execucoes;
  const falhas = temConf ? cont("falhou") : meu ? meu.execucoes - meu.acertos : agent.metrics.erros;
  const agora = agent.real
    ? meuUltimo
      ? `há ${tempoRelativo(meuUltimo.at)} — ${meuUltimo.resumo}`
      : "de plantão — aguardando o próximo lead"
    : agent.state === "ativo"
      ? agent.agora
      : "em espera — nada rodando";

  const followOn = agent.work?.kind === "followups";
  const naFila = agent.work?.followups?.filter((f) => f.status !== "feito").length ?? 0;

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
      <div className="space-y-4 min-w-0">
        {auth.demo && agent.tipo === "resposta" && (
          <div className="card p-4 flex items-center gap-3.5" style={{ borderColor: "#fbbf2440", background: "linear-gradient(160deg, rgba(251,191,36,.08), var(--surface))" }}>
            <span className="grid place-items-center rounded-full flex-none font-semibold text-[15px]" style={{ width: 40, height: 40, background: "var(--deep)", color: "#fff" }}>P</span>
            <div className="min-w-0 flex-1">
              <div className="mono-label !text-[9px]" style={{ color: "#b8860b" }}>Esperando você · 1</div>
              <div className="text-[13.5px] font-medium mt-0.5">Dr. Paulo pediu um humano <span className="text-[var(--txt-3)] font-normal text-[12px]">· há 8 min · a IA está segurando com educação — abra a conversa abaixo</span></div>
            </div>
          </div>
        )}

        {agent.tipo === "resposta" ? <Conversas agent={agent} /> : agent.work ? <WorkTab agent={agent} onMelhorar={() => onMelhorar()} /> : null}
        {agent.tipo === "resposta" && agent.work && agent.work.kind !== "conhecimento" && (
          <WorkTab agent={agent} onMelhorar={() => onMelhorar()} />
        )}
      </div>

      <div className="space-y-4">
        <div className="card p-4 flex items-center gap-3">
          <span className="live-dot flex-none" style={{ width: 9, height: 9 }} />
          <div className="min-w-0 flex-1">
            <div className="mono-label !text-[9px] mb-0.5">Agora</div>
            <div className="text-[12.5px] text-[var(--txt)] leading-snug">{agora}</div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="mono-label !text-[9px]">O dia · conferido na hora</div>
            <span className="tick">{execsHoje} hoje</span>
          </div>
          {temConf ? (
            <div className="space-y-1.5">
              {(["seguiu", "segurou", "conversou", "falhou"] as Selo[]).map((s) => {
                const m = SELO_META[s];
                return (
                  <div key={s} className="flex items-center gap-2.5">
                    <span className="num text-[13.5px] w-5 text-right flex-none" style={{ color: m.cor }}>{cont(s)}</span>
                    <span className="text-[12px] text-[var(--txt-2)]">{FECHO_LBL[s]}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[12.5px] text-[var(--txt-2)]">
              {falhas > 0 ? <>Peguei <b style={{ color: "#fb7185" }}>{falhas}</b> que {falhas === 1 ? "falhou" : "falharam"}.</> : <>Nenhuma falha hoje.</>}
            </p>
          )}
          {falhas > 0 && (
            <button onClick={() => onMelhorar()} className="text-[11.5px] font-medium mt-2.5" style={{ color: "var(--cyan)" }}>corrigir no Melhorar →</button>
          )}
          <p className="text-[10px] text-[var(--txt-4)] mt-2.5 leading-relaxed">contado na hora, um por atendimento — sem nota por linha.</p>
        </div>

        {agent.tipo === "resposta" && (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="mono-label !text-[9px]">Follow-up · módulo</div>
              {followOn ? (
                <Pill color="#34d399"><span className="live-dot" style={{ width: 5, height: 5 }} /> ligado</Pill>
              ) : (
                <Pill>desligado</Pill>
              )}
            </div>
            {followOn ? (
              <>
                <div className="text-[12.5px] font-medium">{naFila} na fila</div>
                <p className="text-[10.5px] text-[var(--txt-4)] mt-1 leading-relaxed">horário comercial · máx. 3 toques · para se o lead responder</p>
              </>
            ) : (
              <>
                <p className="text-[11.5px] text-[var(--txt-3)] leading-relaxed">Ligado, ele cutuca quem sumiu — e para na hora se o lead responder.</p>
                <button onClick={() => onMelhorar("Liga o follow-up neste agente: cutucar quem sumiu no meio da conversa, em horário comercial, com no máximo 3 toques, parando se o lead responder. ")} className="text-[11.5px] font-medium mt-2" style={{ color: "var(--cyan)" }}>ligar — passa pelo ensaio →</button>
              </>
            )}
          </div>
        )}

        {auth.demo && (
          <div className="card p-3.5 flex items-start gap-2.5" style={{ borderColor: "#34d39930" }}>
            <ShieldCheck size={15} style={{ color: "#34d399" }} className="flex-none mt-0.5" />
            <p className="text-[11px] text-[var(--txt-2)] leading-relaxed"><b className="text-[var(--txt)]">WhatsApp conectado.</b> Se cair, esta tela vira o alarme — e te avisamos no número reserva.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════ LUGAR 2 · COMO FUNCIONA — "como ele decide?" ═══════════ */
function ComoFuncionaTab({ agent, onMelhorar }: { agent: Agent; onMelhorar: (seed?: string) => void }) {
  const followOn = agent.work?.kind === "followups";
  const agendaOn = agent.work?.kind === "agenda" || (agent.integracoes ?? []).some((i) => /agenda/i.test(i));
  const contratoOn = agent.work?.kind === "contratos";

  const lentes: { label: string; estado: "nucleo" | "on" | "off" }[] =
    agent.tipo === "acao"
      ? [{ label: "O que faz", estado: "nucleo" }]
      : [
          { label: "Como conversa", estado: "nucleo" },
          { label: "Como recupera (follow-up)", estado: followOn ? "on" : "off" },
          { label: "Como marca reunião", estado: agendaOn ? "on" : "off" },
          { label: "Como fecha contrato", estado: contratoOn ? "on" : "off" },
        ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {lentes.map((l) => (
          <span
            key={l.label}
            className="inline-flex items-center gap-2 text-[12px] px-3.5 py-2 rounded-[9px]"
            style={
              l.estado === "nucleo"
                ? { background: "rgba(62,207,142,.12)", border: "1px solid var(--violet-2)", color: "var(--txt)", fontWeight: 600 }
                : l.estado === "on"
                  ? { background: "var(--surface)", border: "1px solid var(--line)", color: "var(--txt-2)" }
                  : { background: "var(--surface-2)", border: "1px dashed var(--line-hi)", color: "var(--txt-4)" }
            }
          >
            {l.label}
            <span className="mono-label !text-[8px]" style={{ letterSpacing: ".08em" }}>
              {l.estado === "nucleo" ? "núcleo" : l.estado === "on" ? "módulo · ligado" : "desligado"}
            </span>
          </span>
        ))}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          {agent.mapa ? <MapaTab agent={agent} /> : agent.fluxo ? <MapaAcao agent={agent} onMelhorar={() => onMelhorar()} /> : null}
          {agent.work?.kind === "conhecimento" && <WorkTab agent={agent} onMelhorar={() => onMelhorar()} />}
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <div className="mono-label !text-[9px] mb-2.5">Módulos deste robô</div>
            <div className="space-y-1">
              {agent.features.map((f) => (
                <div key={f.name} className="flex items-center gap-2.5 py-1.5 border-b border-[var(--line)] last:border-0">
                  <f.icon size={14} style={{ color: "var(--violet)" }} className="flex-none" />
                  <span className="text-[12px] flex-1 min-w-0 truncate">{f.name}</span>
                  <Pill color={f.on ? "#34d399" : undefined}>{f.on ? "ligado" : "desligado"}</Pill>
                </div>
              ))}
              {(agent.upgrades ?? []).slice(0, 3).map((u) => (
                <div key={u.name} className="flex items-center gap-2.5 py-1.5 border-b border-[var(--line)] last:border-0">
                  <u.icon size={14} style={{ color: "var(--txt-4)" }} className="flex-none" />
                  <span className="text-[12px] text-[var(--txt-3)] flex-1 min-w-0 truncate">{u.name}</span>
                  <button onClick={() => onMelhorar(`Liga o módulo "${u.name}" neste agente: ${u.blurb} `)} className="text-[10.5px] font-medium flex-none" style={{ color: "var(--cyan)" }}>ligar →</button>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[var(--txt-4)] mt-2.5 leading-relaxed">ligar nunca acontece no escuro: vai pro Melhorar, roda o ensaio, e a lente acende aqui.</p>
          </div>

          <div className="card p-4 flex items-start gap-2.5" style={{ borderColor: "#34d39930", background: "linear-gradient(160deg, rgba(52,211,153,.05), var(--surface))" }}>
            <ShieldCheck size={16} style={{ color: "#34d399" }} className="flex-none mt-0.5" />
            <div>
              <div className="text-[12.5px] font-medium">Núcleo blindado</div>
              <p className="text-[11px] text-[var(--txt-3)] mt-1 leading-relaxed">{agent.shield}</p>
            </div>
          </div>

          {(agent.mapa?.mudancas?.length ?? 0) > 0 && (
            <div className="card p-4">
              <div className="mono-label !text-[9px] mb-2.5">O que mudou nele</div>
              {agent.mapa!.mudancas!.slice(0, 2).map((m, i) => (
                <div key={i} className="py-1.5 border-b border-[var(--line)] last:border-0">
                  <div className="text-[11.5px] leading-snug"><Sparkles size={11} className="inline mr-1" style={{ color: "var(--violet)" }} /><b>{m.quando} · {m.origem === "voce" ? "você" : m.origem === "metrik" ? "Metrik" : "escola"}:</b> "{m.pedido}"</div>
                  {m.porteiro && <div className="text-[10px] text-[var(--txt-4)] mt-0.5">guardião {m.porteiro.casos} · nota {m.porteiro.nota} · {m.status}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- passo a passo ---------- */
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
                      <Lightbulb size={14} style={{ color: "#e0a44a" }} className="flex-none mt-[1px]" /> {p.sugestao}
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
// DIÁRIO — o ledger honesto do dia deste robô: o selo conferido na hora de cada
// resposta (4 selos no MVP), o fecho do dia, a nota da rotina, e a linha do tempo
// com o porquê. Clicar "Melhorar isto" num tropeço LEVA pro Melhorar com o caso
// já escrito (é porta, não muda nada aqui). Zero nota por linha (isso seria caro
// e viciado) — a nota 0–10 só no fecho/rotina e no ensaio do Melhorar.
const FECHO_LBL: Record<Selo, string> = {
  seguiu: "seguiram a regra",
  segurou: "seguraram de propósito",
  conversou: "conversaram (sem regra a conferir)",
  falhou: "falharam",
};
const FILTROS_SELO: ("tudo" | Selo)[] = ["tudo", "seguiu", "segurou", "falhou"];

function LogsTab({ agent, onCorrigir }: { agent: Agent; onCorrigir: (seed: string) => void }) {
  const [filtro, setFiltro] = useState<"tudo" | Selo>("tudo");
  const { logs: logsReais, stats } = useLive();

  const doFluxo = (agent.fluxo ?? [])
    .filter((p) => p.status === "ok")
    .map((p) => ({ t: "1 h", acao: `Concluiu: ${p.label}`, status: "ok" as const }));
  const logs = [...agent.live, ...doFluxo].map((r, i) => ({ ...r, id: i, conf: conferir(r) }));
  const timeline = logs.filter((l) => l.status !== "run");
  const temConf = logs.some((l) => (l as { conferencia?: unknown }).conferencia != null);
  const cont = (s: Selo) => timeline.filter((l) => l.conf.veredito === s).length;
  const nFalhou = cont("falhou");

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
      {/* fazendo agora */}
      <div className="card p-4 flex items-center gap-3">
        <span className="grid place-items-center rounded-[10px] flex-none" style={{ width: 34, height: 34, background: `${agent.color}16`, border: `1px solid ${agent.color}30` }}>
          {agent.state === "ativo" ? <Loader2 size={16} className="animate-spin" style={{ color: agent.color }} /> : <Clock size={16} style={{ color: "var(--txt-4)" }} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="mono-label mb-0.5">Fazendo agora</div>
          <div className="text-[13px] text-[var(--txt)] truncate">{rodandoAgora}</div>
        </div>
        <span className="tick flex-none hidden sm:block">{execsHoje} hoje</span>
      </div>

      {/* como sei que tá certo? — a legenda dos selos, sempre à vista */}
      <div className="card p-4">
        <div className="text-[11.5px] text-[var(--txt-3)] mb-2.5">Como sei que tá certo? — cada atendimento ganha um destes, conferido na hora:</div>
        <div className="flex flex-wrap gap-2">
          {(["seguiu", "segurou", "conversou", "falhou"] as Selo[]).map((s) => {
            const m = SELO_META[s]; const Ico = m.icon;
            return (
              <span key={s} className="inline-flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 rounded-lg" style={{ color: m.cor, border: `1px solid ${m.cor}45`, background: `${m.cor}12` }}>
                <Ico size={13} /> {m.label}
              </span>
            );
          })}
        </div>
        <p className="text-[11px] text-[var(--txt-4)] mt-2.5 leading-relaxed"><b className="text-[var(--txt-3)]">Conferido na hora de cada resposta, sem custo.</b> A nota de qualidade de 0 a 10 sai no fecho do dia, aqui embaixo — nenhuma linha tem nota própria. Quer a nota de uma conversa agora? Peça um ensaio no Melhorar.</p>
      </div>

      {/* fecho do dia + análise (a única nota) */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="mono-label mb-3">Fecho do dia · o placar</div>
          {temConf ? (
            <>
              {(["seguiu", "segurou", "conversou", "falhou"] as Selo[]).map((s) => {
                const m = SELO_META[s];
                return (
                  <div key={s} className="flex items-center gap-2.5 mb-2 last:mb-0">
                    <span className="num text-[14px] w-6 text-right flex-none" style={{ color: m.cor }}>{cont(s)}</span>
                    <span className="text-[13px] text-[var(--txt-2)]">{FECHO_LBL[s]}</span>
                  </div>
                );
              })}
              <p className="text-[11px] text-[var(--txt-4)] mt-3 leading-relaxed">Contados na hora, um por atendimento — sem nota e sem custo.</p>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-2 mb-1"><span className="num text-[26px]" style={{ color: agent.color }}>{execsHoje}</span><span className="text-[12px] text-[var(--txt-3)]">atendimentos hoje</span></div>
              <p className="text-[12.5px] text-[var(--txt-2)]">{errosHoje > 0 ? <>Peguei <b style={{ color: "#fb7185" }}>{errosHoje}</b> que falharam.</> : <>Nenhuma falha hoje.</>}</p>
              <p className="text-[11px] text-[var(--txt-4)] mt-3 leading-relaxed">O selo de cada resposta (seguiu a regra / segurou / falhou) aparece assim que o robô começa a registrar a conferência.</p>
            </>
          )}
        </div>

        <div className="card p-5" style={{ borderColor: "#e0a44a2e", background: "linear-gradient(165deg, rgba(224,164,74,.07), var(--surface))" }}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2"><Sparkles size={16} style={{ color: "#e0a44a" }} /><span className="font-display font-semibold text-[14.5px]">Análise do dia</span></div>
            <Pill color="#e0a44a">rotina · 8h</Pill>
          </div>
          {(() => { const saiu = temConf ? nFalhou : errosHoje; return (
            <p className="text-[13px] text-[var(--txt-2)] leading-relaxed">
              {saiu > 0
                ? <>{saiu === 1 ? "Saiu do padrão " : "Saíram do padrão "}<b style={{ color: "#fb7185" }}>{saiu}</b> — dá pra corrigir na linha do tempo abaixo.</>
                : <>Nada saiu do padrão hoje.</>}
            </p>
          ); })()}
          <p className="text-[11px] text-[var(--txt-4)] mt-2 leading-relaxed">A nota de qualidade de 0 a 10 é do dia inteiro, tirada uma vez de manhã — nenhuma linha tem nota própria (nota por linha sairia cara e não seria honesta).</p>
        </div>
      </div>

      {/* a linha do tempo — o filme do dia, com o selo */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="mono-label">A linha do tempo · o filme do dia</div>
          <div className="flex gap-1.5 flex-wrap">
            {FILTROS_SELO.map((f) => (
              <button key={f} onClick={() => setFiltro(f)} className={cx("chip !py-1", filtro === f && "!border-[var(--line-hi)] !bg-[var(--surface-hi)] !text-[var(--txt)]")}>
                {f === "tudo" ? "tudo" : SELO_META[f].label.split(" ")[0].toLowerCase()}
              </button>
            ))}
          </div>
        </div>
        <ul>
          {timeline.map((r) => {
            const m = SELO_META[r.conf.veredito]; const Ico = m.icon;
            const dim = filtro !== "tudo" && r.conf.veredito !== filtro;
            const problema = r.conf.veredito === "falhou";
            const mostraPorque = !!r.conf.porque && (r.conf.veredito === "segurou" || r.conf.veredito === "falhou");
            const seed = `Neste atendimento a IA "${r.acao}".` + (r.conf.porque ? ` O que rolou: ${r.conf.porque}` : "") + ` Deveria: `;
            return (
              <li key={r.id} className="py-3 border-b border-[var(--line)] last:border-0" style={{ opacity: dim ? 0.32 : 1, transition: "opacity .15s" }}>
                <div className="flex items-start gap-3">
                  <span className="grid place-items-center rounded-lg flex-none mt-0.5" style={{ width: 28, height: 28, background: `${m.cor}16`, border: `1px solid ${m.cor}33` }}>
                    <Ico size={14} style={{ color: m.cor }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <span className="text-[13.5px] text-[var(--txt)] leading-snug flex-1">{r.acao}</span>
                      <span className="tick flex-none">{r.t}</span>
                    </div>
                    {mostraPorque && (
                      <div className="mt-2 rounded-lg px-3 py-2 text-[12.5px] leading-relaxed" style={{
                        color: problema ? "#f2cf86" : "#a9d3f2",
                        background: problema ? "rgba(251,191,36,.07)" : "rgba(88,170,228,.06)",
                        border: `1px solid ${problema ? "rgba(251,191,36,.24)" : "rgba(88,170,228,.22)"}`,
                      }}>
                        {r.conf.fonte && <span className="mono-label !text-[8.5px] block mb-1 opacity-75">{r.conf.fonte === "na-hora" ? "pego na hora" : "achado da análise"}</span>}
                        {r.conf.porque}
                      </div>
                    )}
                    {problema && (
                      <div className="mt-2 flex items-center gap-2.5 flex-wrap">
                        <button className="btn btn-primary btn-sm" onClick={() => onCorrigir(seed)}><Wand2 size={13} /> Melhorar isto</button>
                        <span className="text-[11px] text-[var(--txt-4)]">isto é leitura — corrigir acontece no Melhorar</span>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
          {timeline.length === 0 && <li className="text-[12.5px] text-[var(--txt-3)] py-4 text-center">Ainda sem execuções hoje — as respostas aparecem aqui com o selo de cada uma.</li>}
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
      {/* LEITURA do processo (sem botão): conversa → MapaTab · ação → MapaAcao */}
      {agent.mapa ? <MapaTab agent={agent} /> : agent.fluxo ? <MapaAcao agent={agent} onMelhorar={onMelhorar} /> : null}

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
          <div className="mono-label flex items-center gap-1.5 mb-3"><Lightbulb size={12} style={{ color: "#e0a44a" }} /> O que dá pra melhorar</div>
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
  dica: { icon: Lightbulb, color: "#e0a44a", tag: "ideia" },
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
function Turbinar({ agent, onMelhorar }: { agent: Agent; onMelhorar?: () => void }) {
  const upgrades = agent.upgrades ?? [];

  return (
    <div className="space-y-4">
      {/* núcleo blindado */}
      <div className="card p-4 flex items-start gap-3" style={{ borderColor: "#34d39930", background: "linear-gradient(160deg, rgba(52,211,153,.06), var(--surface))" }}>
        <ShieldCheck size={18} style={{ color: "#34d399" }} className="flex-none mt-0.5" />
        <p className="text-[12.5px] text-[var(--txt-2)]"><b className="text-[var(--txt)]">Núcleo blindado.</b> {agent.shield} Estes recursos são operados pela Metrik — pra mudar o comportamento, é no <b className="text-[var(--txt)]">Melhorar</b> (com ensaio e guardião).</p>
      </div>

      {/* recursos ligados — LEITURA (o que o agente já sabe fazer) */}
      <div className="card p-5">
        <div className="mono-label mb-4">Recursos ligados</div>
        <div className="grid sm:grid-cols-2 gap-2.5">
          {agent.features.map((f) => (
            <div key={f.name} className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
              <span className="grid place-items-center rounded-[10px] flex-none" style={{ width: 34, height: 34, background: `${agent.color}14`, border: `1px solid ${agent.color}2e` }}>
                <f.icon size={16} style={{ color: agent.color }} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium truncate">{f.name}</div>
                <span className="text-[10.5px]" style={{ color: f.fonte === "mcp" ? "#e0a44a" : "var(--txt-4)" }}>{f.fonte === "mcp" ? "criada por você" : "operado pela Metrik"}</span>
              </div>
              <span className="pill flex-none" style={{ color: f.on ? "#34d399" : "var(--txt-4)", borderColor: f.on ? "#34d39940" : "var(--line)", background: f.on ? "#34d39912" : "var(--surface-2)" }}>
                {f.on ? <><span className="live-dot" style={{ width: 6, height: 6, background: "#34d399" }} /> ligado</> : "desligado"}
              </span>
            </div>
          ))}
        </div>
        {onMelhorar && (
          <button onClick={onMelhorar} className="btn btn-sm mt-4"><Wand2 size={13} /> Ligar, desligar ou turbinar — peça no Melhorar</button>
        )}
      </div>

      {/* turbinar — ligar com setup */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="mono-label">Turbinar este agente</div>
          <span className="text-[11px] text-[var(--txt-4)]">só entra neste robô</span>
        </div>
        <p className="text-[12px] text-[var(--txt-3)] mb-4">Cada um destes é um upgrade que <b className="text-[var(--txt-2)]">a Metrik liga pra você</b> quando você pede — testado no ensaio antes de entrar.</p>
        {upgrades.length === 0 ? (
          <div className="text-[12.5px] text-[var(--txt-3)] py-4 text-center">Tudo ligado neste agente 🎉</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {upgrades.map((u) => (
              <div key={u.name} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 flex flex-col">
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="grid place-items-center rounded-[10px] flex-none" style={{ width: 32, height: 32, background: `${agent.color}12`, border: `1px solid ${agent.color}2a` }}>
                    <u.icon size={15} style={{ color: agent.color }} />
                  </span>
                  <span className="font-display font-semibold text-[13.5px]">{u.name}</span>
                </div>
                <p className="text-[12.5px] text-[var(--txt-2)] leading-snug mb-3 flex-1">{u.blurb}</p>
                <button className="btn btn-sm w-full mt-auto" onClick={onMelhorar}><Wand2 size={14} /> Pedir no Melhorar</button>
              </div>
            ))}
          </div>
        )}
      </div>
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
            {upgrade.sinergia && <div className="text-[11px] text-[var(--txt-4)] mt-1 flex items-center gap-1.5"><Link2 size={11} style={{ color: "#58aae4" }} /> {upgrade.sinergia}</div>}
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
  novo: { label: "recurso novo", color: "#e0a44a" },
  regra: { label: "trava / regra", color: "#58aae4" },
};
const ORIG: Record<string, { label: string; color: string }> = {
  metrik: { label: "Metrik", color: "#83879a" },
  chat: { label: "chat", color: "#58aae4" },
  ajuste: { label: "botão", color: "#fbbf24" },
  claude: { label: "Claude Code", color: "#e0a44a" },
  codex: { label: "Codex", color: "#58aae4" },
};

type EnsaioSit = { nome: string; pergunta: string; antes: string; agora: string };
type EnvioState = {
  fase: "idle" | "clarificar" | "registrando" | "ensaiando" | "pronto" | "publicando" | "publicado" | "erro";
  cs?: any;
  evals?: any;
  ensaio?: { modo: "real" | "sem-cerebro"; situacoes: EnsaioSit[] };
  pedido?: string;
  erro?: string;
};

/** O pedido está claro o bastante pra virar uma mudança? Sem o cérebro, uso uma
 *  heurística simples: pedido curto/1-2 palavras = vago → o "professor" pergunta
 *  em vez de fingir que testou. (Com o cérebro ligado, é a IA que julga.) */
function pedidoVago(t: string): boolean {
  const palavras = t.split(/\s+/).filter(Boolean);
  return t.length < 18 || palavras.length < 4;
}

function MelhorarTab({ agent, initialTexto }: { agent: Agent; initialTexto?: string | null }) {
  const auth = useMotorAuth();
  const [gravando, setGravando] = useState(false);
  // veio do Diário? o caso já chega ESCRITO no campo (o cliente completa o "Deveria:")
  const [texto, setTexto] = useState(initialTexto ?? "");
  const veioDoDiario = !!initialTexto;
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

  // pedir → (se vago, o professor PERGUNTA) → registra → ensaia → antes/agora
  const enviar = async (forcar = false) => {
    const t = texto.trim();
    if (!t || envio.fase === "registrando" || envio.fase === "ensaiando") return;
    // PROFESSOR: pedido vago não vira "teste 4/4" no escuro — ele pergunta primeiro.
    if (!forcar && pedidoVago(t)) {
      setEnvio({ fase: "clarificar", pedido: t });
      return;
    }
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
      {veioDoDiario ? (
        <div className="card p-4 flex items-start gap-3" style={{ borderColor: "#58aae440", background: "linear-gradient(160deg, rgba(88,170,228,.07), var(--surface))" }}>
          <ScrollText size={17} style={{ color: "#58aae4" }} className="flex-none mt-0.5" />
          <p className="text-[12.5px] text-[var(--txt-2)]"><b className="text-[var(--txt)]">Veio do Diário.</b> O caso já está escrito no campo abaixo — só complete o <b className="text-[var(--txt)]">“Deveria:”</b> com o que a IA deveria ter feito, e rode o ensaio. Corrigir de verdade acontece aqui, com prova antes de ir pro ar.</p>
        </div>
      ) : (
        <div className="card p-4 flex items-start gap-3">
          <Link2 size={17} style={{ color: "#e0a44a" }} className="flex-none mt-0.5" />
          <p className="text-[12.5px] text-[var(--txt-2)]"><b className="text-[var(--txt)]">Uma fonte só.</b> Você pode pedir aqui, ligar no Turbinar ou mexer pelo Claude Code — tudo cai no mesmo agente e aparece no histórico abaixo. Nada duplica, nada se perde.</p>
        </div>
      )}

      {/* ── PEDIR: campo livre (chip preenche o campo; áudio vira texto) ── */}
      {envio.fase === "idle" || envio.fase === "clarificar" || envio.fase === "registrando" || envio.fase === "ensaiando" || envio.fase === "erro" ? (
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
              <ShieldCheck size={13} style={{ color: "#34d399" }} /> quanto mais claro o pedido, melhor o ensaio — diga o que a IA passa a fazer e em que momento
            </div>
          )}

          {/* PROFESSOR: pedido vago → ele pergunta, não finge que testou */}
          {envio.fase === "clarificar" && (
            <div className="mt-3 rounded-xl p-4" style={{ border: "1px solid #58aae440", background: "rgba(88,170,228,.07)" }}>
              <div className="flex items-center gap-2 mb-1.5">
                <MessageCircle size={15} style={{ color: "#58aae4" }} />
                <span className="text-[13px] font-medium text-[var(--txt)]">Me conta um pouco mais pra eu entender</span>
              </div>
              <p className="text-[12.5px] text-[var(--txt-2)] leading-relaxed">
                Você escreveu <b className="text-[var(--txt)]">“{envio.pedido}”</b> — só isso ainda não me diz o que mudar. O que a IA
                <b className="text-[var(--txt)]"> passa a fazer</b>, e <b className="text-[var(--txt)]">em que momento</b>? Por exemplo:
                <i> “quando o lead perguntar sobre prazo, responder que dá pra pedir em até 30 dias”</i>, ou
                <i> “passa a saber que o plano Start custa R$ 497 e oferece quando perguntarem preço”</i>.
              </p>
              <p className="text-[11.5px] text-[var(--txt-4)] mt-2">Escreve com esse detalhe no campo acima e manda de novo.</p>
            </div>
          )}

          {(envio.fase === "registrando" || envio.fase === "ensaiando") && (
            <div className="mt-3 flex items-center gap-2 text-[12.5px] text-[var(--txt-2)]">
              <Loader2 size={14} className="animate-spin" style={{ color: "#e0a44a" }} />
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
          <div className="card p-5 md:p-6" style={{ borderColor: "#e0a44a2e" }}>
            <div className="flex items-center gap-2 mb-1">
              <FlaskConical size={17} style={{ color: "#e0a44a" }} />
              <span className="font-display font-semibold text-[16px]">O ensaio da sua mudança</span>
            </div>
            <p className="text-[13.5px] text-[var(--txt-2)] mb-4">Você pediu: <b className="text-[var(--txt)]">“{envio.pedido}”</b></p>

            {envio.ensaio?.modo === "real" ? (
              <>
                {/* GUARDIÃO — testou o SEU pedido de verdade (cérebro ligado) */}
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

                {/* ANTES vs AGORA — a IA respondendo, lado a lado */}
                <div className="mono-label mb-3">Antes vs agora — a IA respondendo</div>
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

                <div className="mt-6 pt-4 border-t border-[var(--line)]">
                  <div className="text-[14px] font-medium text-[var(--txt)] mb-3">É isso que você queria?</div>
                  <div className="flex flex-wrap gap-2.5">
                    <button onClick={() => void publicar()} disabled={!envio.evals.aprovado} className="btn btn-primary" style={{ opacity: envio.evals.aprovado ? 1 : 0.5 }}>
                      <Rocket size={15} /> Sim — publicar pro ar
                    </button>
                    <button onClick={ajustar} className="btn"><Wand2 size={15} /> Não — quero ajustar</button>
                  </div>
                  {!envio.evals.aprovado && (
                    <p className="text-[11.5px] text-[var(--txt-4)] mt-2">O guardião segurou essa. Clique em “ajustar” e reescreva o pedido de outro jeito.</p>
                  )}
                </div>
              </>
            ) : (
              /* SEM CÉREBRO — honesto: registrei, mas NÃO testei o seu pedido */
              <>
                <div className="rounded-xl px-4 py-4 mb-4" style={{ border: "1px solid #fbbf2440", background: "rgba(251,191,36,.07)" }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <AlertTriangle size={16} style={{ color: "#fbbf24" }} />
                    <span className="text-[13.5px] font-medium text-[var(--txt)]">Registrei o seu pedido — mas ainda não consigo provar que ele funciona.</span>
                  </div>
                  <p className="text-[12.5px] text-[var(--txt-2)] leading-relaxed">
                    Pra ser o ensaio de verdade — te mostrar <b className="text-[var(--txt)]">onde isso entra</b> e a <b className="text-[var(--txt)]">IA respondendo antes e agora</b> —
                    a Metrik precisa <b className="text-[var(--txt)]">ligar o cérebro</b> (a chave da OpenAI) neste ambiente. Enquanto isso, seu pedido fica guardado no histórico.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[11.5px] text-[var(--txt-4)] mb-5">
                  <ShieldCheck size={13} style={{ color: "#34d399" }} /> só dá pra dizer o básico: o pedido não pede nada que quebre as travas do núcleo. Testar SE ele faz o que você quer, só com o cérebro ligado.
                </div>
                <div className="pt-4 border-t border-[var(--line)]">
                  <div className="text-[14px] font-medium text-[var(--txt)] mb-3">O que você quer fazer?</div>
                  <div className="flex flex-wrap gap-2.5">
                    <button onClick={ajustar} className="btn btn-primary"><Wand2 size={15} /> Reescrever o pedido</button>
                    <button onClick={ajustar} className="btn"><Check size={15} /> Deixar registrado pra Metrik</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </Reveal>
      )}

      {(envio.fase === "publicando" || envio.fase === "publicado") && (
        <Reveal>
          <div className="card p-5 flex items-center gap-3" style={{ borderColor: envio.fase === "publicado" ? "#34d39940" : "var(--line)", background: envio.fase === "publicado" ? "rgba(52,211,153,.06)" : undefined }}>
            {envio.fase === "publicando" ? (
              <><Loader2 size={18} className="animate-spin" style={{ color: "#e0a44a" }} /> <span className="text-[13.5px] text-[var(--txt-2)]">publicando a nova versão…</span></>
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
