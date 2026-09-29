import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Radio, Zap, Wand2, Check, X, Loader2, ShieldCheck, Lock, Plus,
  ArrowUp, Play, FlaskConical, Rocket, Lightbulb, ThumbsUp, AlertTriangle,
  Link2, ArrowRight, CalendarClock, Repeat, FileSignature, BookOpen, ListChecks, Plug, Clock, Mic, ScrollText, Sparkles, MessageCircle,
} from "lucide-react";
import { type Agent, type AgentState, type Insight, type Upgrade, type Selo, STATE_META, SELO_META, conferir } from "../data";
import { Reveal, Pill, Toggle, Skeleton, cx } from "../ui";
import { Robot } from "../Robot";
import WorkTab from "./WorkTab";
import Conversas from "./Conversas";
import Followup from "./Followup";
import MapaTab from "./MapaTab";
import MapaAcao from "./MapaAcao";
import MudancasTab from "./MudancasTab";
import Estudio from "./Estudio";
import { api } from "../lib/api";
import { useMotorAuth } from "../lib/auth";
import { tempoRelativo, useLive, reais } from "../lib/live";

// A REFUNDAÇÃO (canvas Estúdio da IA aprovado): o agente vive no ESTÚDIO —
// módulos + diff + teste numa tela só. "Ao vivo" (conversas/assumir) é a
// segunda tela. As abas antigas morreram; deep-links velhos caem no Estúdio.
type Tela = "estudio" | "aovivo";
function normalizeTela(s?: string): Tela {
  return s === "aovivo" ? "aovivo" : "estudio";
}

export default function AgentDetail({ agent, onBack, initialSub }: { agent: Agent; onBack: () => void; initialSub?: string }) {
  const auth = useMotorAuth();
  const [tela, setTela] = useState<Tela>(normalizeTela(initialSub));
  // qualquer "corrigir/melhorar isto" das telas cai no composer do Estúdio já escrito
  const [seed, setSeed] = useState<{ tipo: "pedido" | "pergunta"; texto: string; n: number } | null>(null);
  const irEstudio = (texto?: string) => {
    if (texto) setSeed({ tipo: "pedido", texto, n: Date.now() });
    setTela("estudio");
  };

  const [state, setState] = useState<AgentState>(agent.state);
  const [pausaMsg, setPausaMsg] = useState<string | null>(null);
  const sm = STATE_META[state];

  // PAUSE REAL: persiste o estado no banco (o runtime lê antes de responder).
  const alternarEstado = async () => {
    const novo: AgentState = state === "pausado" ? "ativo" : "pausado";
    setState(novo);
    if (!agent.real) return;
    try {
      await api.setEstado(agent.id, novo === "pausado" ? "pausado" : "ativo", auth.getToken);
      setPausaMsg(novo === "pausado" ? "Agente pausado. Ele não responde aos leads." : "Agente reativado. Ele volta a responder aos leads.");
      window.setTimeout(() => setPausaMsg(null), 4000);
    } catch (e) {
      setState((s) => (s === "pausado" ? "ativo" : "pausado")); // desfaz na falha
      setPausaMsg(e instanceof Error ? e.message : "Não foi possível mudar o estado do agente.");
    }
  };

  // faixa de estado (pausa) — no Estúdio vira tira full-width; no Ao vivo, card
  const pausaStrip = (pausaMsg || state === "pausado") && (
    <div
      className={tela === "estudio" ? "flex-none border-b px-5 py-2 text-[12px] flex items-center gap-2" : "rounded-xl px-4 py-2.5 text-[12.5px] flex items-center gap-2"}
      style={{
        ...(tela === "estudio"
          ? { borderColor: "var(--line)" }
          : { border: `1px solid ${state === "pausado" ? "#fbbf2440" : "#3fb95040"}` }),
        background: state === "pausado" ? "rgba(251,191,36,.08)" : "rgba(63,185,80,.08)",
        color: state === "pausado" ? "#fbbf24" : "#3fb950",
      }}
    >
      {state === "pausado" ? <Clock size={14} /> : <Check size={14} />}
      {pausaMsg ?? "Agente pausado. Ele não responde aos leads."}
    </div>
  );

  // ESTÚDIO = a tela inteira (workspace): sem coluna centrada, colunas até o rodapé
  if (tela === "estudio") {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        {pausaStrip}
        <motion.div key="estudio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="flex-1 min-h-0 flex flex-col">
          <Estudio agent={agent} estado={state} onBack={onBack} onToggle={() => void alternarEstado()} onAoVivo={() => setTela("aovivo")} seed={seed} />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
      <div className="max-w-[1180px] mx-auto px-4 md:px-7 py-6 pb-24 md:pb-6 space-y-4">
      <button onClick={onBack} className="btn btn-ghost btn-sm !px-2"><ArrowLeft size={15} /> Agentes</button>

      {pausaStrip}

      {(
        <motion.div key="aovivo" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="rounded-xl p-1 flex-none" style={{ background: `${agent.color}0f`, border: `1px solid ${agent.color}2e` }}>
              <Robot state={state} color={agent.color} size={40} />
            </div>
            <h2 className="font-display text-[19px] font-semibold tracking-tight">{agent.name}</h2>
            <span className="pill" style={{ color: sm.color, borderColor: `${sm.color}40`, background: `${sm.color}14` }}>
              {state === "ativo" ? <span className="live-dot" style={{ width: 6, height: 6, background: sm.color }} /> : <span className="dot" style={{ background: sm.color }} />}
              {sm.label}
            </span>
            <div className="ml-auto flex items-center gap-3">
              <button className="btn btn-sm" onClick={() => setTela("estudio")}><Wand2 size={14} /> Abrir o Estúdio</button>
              <button onClick={() => void alternarEstado()} className="flex items-center gap-2" title={state === "pausado" ? "Reativar o agente" : "Pausar o agente"}>
                <span className="text-[12px] text-[var(--txt-3)]">{state === "pausado" ? "Pausado" : "Ativo"}</span>
                <Toggle on={state !== "pausado"} />
              </button>
            </div>
          </div>
          <AoVivoTab agent={agent} onMelhorar={irEstudio} irModulos={() => setTela("estudio")} />
        </motion.div>
      )}
      </div>
    </div>
  );
}

/* ═══════════ LUGAR 1 · AO VIVO — "o que está acontecendo?" ═══════════ */
function AoVivoTab({ agent, onMelhorar, irModulos }: { agent: Agent; onMelhorar: (seed?: string) => void; irModulos: () => void }) {
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
      ? `${tempoRelativo(meuUltimo.at) === "agora" ? "Agora" : `Há ${tempoRelativo(meuUltimo.at)}`} · ${meuUltimo.resumo}`
      : "Aguardando o próximo lead"
    : agent.state === "ativo"
      ? agent.agora
      : "Nenhuma execução em andamento.";

  const followOn = agent.work?.kind === "followups";
  const naFila = agent.work?.followups?.filter((f) => f.status !== "feito").length ?? 0;

  // o RELANCE no celular: o dia em números, 5 segundos, sem rolar
  // (no desktop esses números já moram no topo do agente)
  const hoje0 = new Date(); hoje0.setHours(0, 0, 0, 0);
  const meusHoje = agent.real ? (logs ?? []).filter((l) => l.agentId === agent.id && new Date(l.at) >= hoje0) : [];
  const reunioesHoje = agent.real ? meusHoje.filter((l) => (l.valorCentavos ?? 0) > 0).length : agent.live.filter((r) => /reuni/i.test(r.acao)).length;
  const valorHoje = meusHoje.reduce((s, l) => s + (l.valorCentavos ?? 0), 0);

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
      <div className="space-y-4 min-w-0">
        <div className="grid grid-cols-3 gap-2 md:hidden">
          {[
            { v: String(execsHoje), l: "Atendimentos", cor: undefined },
            { v: String(reunioesHoje), l: reunioesHoje === 1 ? "Reunião" : "Reuniões", cor: undefined },
            { v: valorHoje > 0 ? reais(valorHoje) : "—", l: "Gerado hoje", cor: valorHoje > 0 ? "var(--emerald)" : undefined },
          ].map((t) => (
            <div key={t.l} className="card p-3">
              <div className="num text-[18px] leading-none" style={t.cor ? { color: t.cor } : undefined}>{t.v}</div>
              <div className="text-[9.5px] text-[var(--txt-3)] mt-1">{t.l}</div>
            </div>
          ))}
        </div>

        {auth.demo && agent.tipo === "resposta" && (
          <div className="card p-4 flex items-center gap-3.5" style={{ borderColor: "#fbbf2440", background: "linear-gradient(160deg, rgba(251,191,36,.08), var(--surface))" }}>
            <span className="grid place-items-center rounded-full flex-none font-semibold text-[15px]" style={{ width: 40, height: 40, background: "var(--deep)", color: "#fff" }}>P</span>
            <div className="min-w-0 flex-1">
              <div className="mono-label !text-[9px]" style={{ color: "#fbbf24" }}>Esperando você · 1</div>
              <div className="text-[13.5px] font-medium mt-0.5">Dr. Paulo pediu atendimento humano <span className="text-[var(--txt-3)] font-normal text-[12px]">· Há 8 min. O agente segura o lead até alguém assumir a conversa abaixo.</span></div>
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
            <div className="mono-label !text-[9px]">O dia · Conferido na hora</div>
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
              {falhas > 0 ? <><b style={{ color: "#f85149" }}>{falhas}</b> {falhas === 1 ? "atendimento falhou hoje" : "atendimentos falharam hoje"}.</> : <>Nenhuma falha hoje.</>}
            </p>
          )}
          {falhas > 0 && (
            <button onClick={() => onMelhorar()} className="text-[11.5px] font-medium mt-2.5" style={{ color: "var(--cyan)" }}>Corrigir no Melhorar</button>
          )}
          <p className="text-[10px] text-[var(--txt-4)] mt-2.5 leading-relaxed">Cada atendimento recebe um selo na hora, sem nota individual.</p>
        </div>

        {agent.tipo === "resposta" && (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="mono-label !text-[9px]">Follow-up · Módulo</div>
              {followOn ? (
                <Pill color="#3fb950"><span className="live-dot" style={{ width: 5, height: 5 }} /> Ligado</Pill>
              ) : (
                <Pill>Desligado</Pill>
              )}
            </div>
            {followOn ? (
              <>
                <div className="text-[12.5px] font-medium">{naFila} na fila</div>
                <p className="text-[10.5px] text-[var(--txt-4)] mt-1 leading-relaxed">Horário comercial · Para quando o lead responde</p>
              </>
            ) : (
              <>
                <p className="text-[11.5px] text-[var(--txt-3)] leading-relaxed">O follow-up retoma o contato com leads que pararam de responder. Ele para quando o lead responde.</p>
                <button onClick={irModulos} className="text-[11.5px] font-semibold mt-2" style={{ color: "var(--violet-2)" }}>Ligar no Estúdio</button>
              </>
            )}
          </div>
        )}

        {auth.demo && (
          <div className="card p-3.5 flex items-start gap-2.5" style={{ borderColor: "#3fb95030" }}>
            <ShieldCheck size={15} style={{ color: "#3fb950" }} className="flex-none mt-0.5" />
            <p className="text-[11px] text-[var(--txt-2)] leading-relaxed"><b className="text-[var(--txt)]">WhatsApp conectado.</b> Se a conexão cair, esta tela e o número reserva recebem o alerta.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════ LUGAR 2 · COMO FUNCIONA — "como ele decide?" ═══════════ */
function ComoFuncionaTab({ agent, onMelhorar, irTestar }: { agent: Agent; onMelhorar: (seed?: string) => void; irTestar: (seed?: string) => void }) {
  // ligar módulo = modal "Como vai funcionar" (canvas): escolhas prontas, prévia, Ativar
  const [modal, setModal] = useState<Upgrade | null>(null);
  const naFila = agent.work?.kind === "followups" ? (agent.work.followups?.filter((f) => f.status !== "feito").length ?? 0) : 0;
  const followOn = agent.work?.kind === "followups";
  const agendaOn = agent.work?.kind === "agenda" || (agent.integracoes ?? []).some((i) => /agenda/i.test(i));
  const contratoOn = agent.work?.kind === "contratos";

  const lentes: { label: string; estado: "nucleo" | "on" | "off" }[] =
    agent.tipo === "acao"
      ? [{ label: "O que faz", estado: "nucleo" }]
      : [
          { label: "Como conversa", estado: "nucleo" },
          { label: "Como recupera", estado: followOn ? "on" : "off" },
          { label: "Como marca reunião", estado: agendaOn ? "on" : "off" },
          { label: "Como fecha contrato", estado: contratoOn ? "on" : "off" },
        ];

  return (
    <div className="space-y-4">
      {/* as LENTES (canvas): núcleo aceso em âmbar · módulo ligado · desligado À VISTA */}
      <div className="flex gap-2 flex-wrap">
        {lentes.map((l) => (
          <span
            key={l.label}
            className="inline-flex items-center gap-2 rounded-[9px] text-[12.5px]"
            style={{
              height: 38,
              padding: "0 16px",
              ...(l.estado === "nucleo"
                ? { background: "rgba(59,130,246,.13)", border: "1px solid rgba(59,130,246,.55)", color: "var(--txt)", fontWeight: 600 }
                : l.estado === "on"
                  ? { background: "var(--surface)", border: "1px solid var(--line)", color: "var(--txt-2)", fontWeight: 500 }
                  : { background: "var(--surface-2)", border: "1px dashed var(--line-hi)", color: "var(--txt-4)", fontWeight: 500 }),
            }}
          >
            {l.estado === "off" && <Lock size={12} className="flex-none" />}
            {l.label}
            <span
              className="text-[9px] font-semibold rounded-[5px] px-1.5 py-0.5"
              style={
                l.estado === "nucleo"
                  ? { color: "#60a5fa", background: "rgba(59,130,246,.18)" }
                  : l.estado === "on"
                    ? { color: "var(--emerald)", background: "rgba(63,185,80,.12)" }
                    : { color: "var(--txt-4)" }
              }
            >
              {l.estado === "nucleo" ? "Núcleo" : l.estado === "on" ? "Módulo ligado" : "Desligado"}
            </span>
          </span>
        ))}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          {/* agente REAL lê o MOTOR (nada de vitrine vestida); demo mostra o mapa da maquete */}
          {agent.real ? (
            <RodandoAgora agent={agent} onMelhorar={onMelhorar} irTestar={irTestar} />
          ) : agent.mapa ? (
            <MapaTab agent={agent} />
          ) : agent.fluxo ? (
            <MapaAcao agent={agent} onMelhorar={() => onMelhorar()} />
          ) : null}
          {agent.tipo === "resposta" && <MemoriaRobo agent={agent} onMelhorar={onMelhorar} irTestar={irTestar} />}
        </div>

        <div className="space-y-4">
          <div className="card p-4 flex items-start gap-2.5" style={{ borderColor: "#3fb95030", background: "linear-gradient(160deg, rgba(63,185,80,.05), var(--surface))" }}>
            <ShieldCheck size={16} style={{ color: "#3fb950" }} className="flex-none mt-0.5" />
            <div>
              <div className="text-[12.5px] font-medium">Núcleo blindado</div>
              <p className="text-[11px] text-[var(--txt-3)] mt-1 leading-relaxed">{agent.shield}</p>
            </div>
          </div>

          {!agent.real && (agent.mapa?.mudancas?.length ?? 0) > 0 && (
            <div className="card p-4">
              <div className="mono-label !text-[9px] mb-2.5">O que mudou no agente</div>
              {agent.mapa!.mudancas!.slice(0, 2).map((m, i) => (
                <div key={i} className="py-1.5 border-b border-[var(--line)] last:border-0">
                  <div className="text-[11.5px] leading-snug"><Sparkles size={11} className="inline mr-1" style={{ color: "var(--violet)" }} /><b>{m.quando} · {m.origem === "voce" ? "Você" : m.origem === "metrik" ? "Metrik" : "Escola"}:</b> "{m.pedido}"</div>
                  {m.porteiro && <div className="text-[10px] text-[var(--txt-4)] mt-0.5">Guardião {m.porteiro.casos} · Nota {m.porteiro.nota} · {m.status}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── MÓDULOS DESTE ROBÔ (canvas): entender numa frase, ligar em 1 minuto ── */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="mono-label">Módulos deste agente</div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {agent.features.filter((f) => f.on).map((f) => (
            <div key={f.name} className="card p-4" style={{ borderColor: "rgba(63,185,80,.3)" }}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 min-w-0">
                  <f.icon size={15} style={{ color: "#3fb950" }} className="flex-none" />
                  <b className="text-[13px] truncate">{f.name}</b>
                </span>
                <Pill color="#3fb950"><span className="live-dot" style={{ width: 5, height: 5 }} /> Ligado</Pill>
              </div>
              {/follow/i.test(f.name) && followOn && (
                <div className="mt-2.5 rounded-[9px] px-3 py-2 text-[11.5px]" style={{ background: "rgba(63,185,80,.06)", border: "1px solid rgba(63,185,80,.22)" }}>
                  <b>{naFila} na fila</b> · Para se o lead responder
                </div>
              )}
            </div>
          ))}
          {(agent.upgrades ?? []).map((u) => (
            <div key={u.name} className="card p-4 flex flex-col" style={{ borderColor: "rgba(59,130,246,.35)", background: "linear-gradient(150deg, rgba(59,130,246,.06), var(--surface))" }}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="flex items-center gap-2 min-w-0">
                  <u.icon size={15} style={{ color: "#3b82f6" }} className="flex-none" />
                  <b className="text-[13px] truncate">{u.name}</b>
                </span>
                <span className="mono-label !text-[8px] flex-none" style={{ color: "#60a5fa" }}>Novo</span>
              </div>
              <p className="text-[11.5px] text-[var(--txt-3)] leading-relaxed mb-3 flex-1">{u.blurb}</p>
              <button className="btn btn-primary btn-sm self-start" onClick={() => setModal(u)}>Ligar módulo <ArrowRight size={13} /></button>
            </div>
          ))}
        </div>
      </div>

      {modal && <LigarModulo agent={agent} u={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ---------- passo a passo ---------- */
function Fluxo({ agent }: { agent: Agent }) {
  const passos = agent.fluxo!;
  const [fix, setFix] = useState<Record<number, "sim" | "nao">>({});
  const temFalha = passos.some((p) => p.status === "falha");
  const tudoOk = !temFalha && passos.every((p) => p.status === "ok");
  const cor = temFalha ? "#f85149" : tudoOk ? "#3fb950" : "#83879a";
  const lbl = temFalha ? "Com falha" : tudoOk ? "Sem falhas" : "Em espera";
  const sIcon: any = { ok: Check, falha: X, espera: Clock };
  const sCor: any = { ok: "#3fb950", falha: "#f85149", espera: "#83879a" };
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="mono-label">Passo a passo</div>
        <span className="pill" style={{ color: cor, borderColor: `${cor}40`, background: `${cor}14` }}>
          {tudoOk ? <span className="live-dot" style={{ width: 6, height: 6, background: cor }} /> : <span className="dot" style={{ background: cor }} />} {lbl}
        </span>
      </div>
      {agent.integracoes && agent.integracoes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {agent.integracoes.map((it) => (
            <span key={it} className="pill"><Plug size={12} style={{ color: agent.color }} /> Integra com {it}</span>
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
              <div className="tick !text-[10px]">Passo {i + 1}</div>
              <div className="text-[13.5px] font-medium text-[var(--txt)] mt-0.5">{p.label}</div>
              <div className="text-[12px] text-[var(--txt-3)] mt-0.5">Deveria: {p.deveria}</div>
              {p.status === "falha" && (
                <div className="mt-2.5 rounded-xl p-3" style={{ border: "1px solid #f8514940", background: "rgba(248,81,73,.07)" }}>
                  <div className="text-[12px]" style={{ color: "#f85149" }}><b>Motivo:</b> {p.porque}</div>
                  {p.sugestao && (
                    <div className="text-[12.5px] text-[var(--txt-2)] mt-2 flex gap-1.5">
                      <Lightbulb size={14} style={{ color: "#3b82f6" }} className="flex-none mt-[1px]" /> {p.sugestao}
                    </div>
                  )}
                  {fix[i] ? (
                    <div className="text-[12px] mt-2.5" style={{ color: fix[i] === "sim" ? "#3fb950" : "var(--txt-3)" }}>
                      {fix[i] === "sim" ? "Correção autorizada. Ela passa por simulação e teste antes de publicar." : "A sugestão ficou anotada."}
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
  conversou: "conversaram sem regra a conferir",
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
      ? `${tempoRelativo(meuUltimo.at) === "agora" ? "Agora" : `Há ${tempoRelativo(meuUltimo.at)}`} · ${meuUltimo.resumo}`
      : "Aguardando o próximo lead"
    : agent.state === "ativo"
      ? agent.agora
      : "Nenhuma execução em andamento.";

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
        <div className="text-[11.5px] text-[var(--txt-3)] mb-2.5">Cada atendimento recebe um destes selos na hora da resposta.</div>
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
        <p className="text-[11px] text-[var(--txt-4)] mt-2.5 leading-relaxed"><b className="text-[var(--txt-3)]">O selo sai na hora, sem custo.</b> A nota de qualidade, de 0 a 10, sai no fecho do dia.</p>
      </div>

      {/* fecho do dia + análise (a única nota) */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="mono-label mb-3">Fecho do dia</div>
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
              <p className="text-[11px] text-[var(--txt-4)] mt-3 leading-relaxed">Cada atendimento conta uma vez, na hora e sem custo.</p>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-2 mb-1"><span className="num text-[26px]" style={{ color: agent.color }}>{execsHoje}</span><span className="text-[12px] text-[var(--txt-3)]">atendimentos hoje</span></div>
              <p className="text-[12.5px] text-[var(--txt-2)]">{errosHoje > 0 ? <>Falhas hoje: <b style={{ color: "#f85149" }}>{errosHoje}</b>.</> : <>Nenhuma falha hoje.</>}</p>
              <p className="text-[11px] text-[var(--txt-4)] mt-3 leading-relaxed">O selo de cada resposta aparece quando o agente começar a registrar a conferência.</p>
            </>
          )}
        </div>

        <div className="card p-5" style={{ borderColor: "#3b82f62e", background: "linear-gradient(165deg, rgba(59,130,246,.07), var(--surface))" }}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2"><Sparkles size={16} style={{ color: "#3b82f6" }} /><span className="font-display font-semibold text-[14.5px]">Análise do dia</span></div>
            <Pill color="#3b82f6">Rotina das 8h</Pill>
          </div>
          {(() => { const saiu = temConf ? nFalhou : errosHoje; return (
            <p className="text-[13px] text-[var(--txt-2)] leading-relaxed">
              {saiu > 0
                ? <><b style={{ color: "#f85149" }}>{saiu}</b>{saiu === 1 ? " atendimento saiu do padrão." : " atendimentos saíram do padrão."} Corrija na linha do tempo abaixo.</>
                : <>Nada saiu do padrão hoje.</>}
            </p>
          ); })()}
          <p className="text-[11px] text-[var(--txt-4)] mt-2 leading-relaxed">A nota de qualidade, de 0 a 10, vale para o dia inteiro e sai uma vez de manhã.</p>
        </div>
      </div>

      {/* a linha do tempo — o filme do dia, com o selo */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="mono-label">Linha do tempo</div>
          <div className="flex gap-1.5 flex-wrap">
            {FILTROS_SELO.map((f) => (
              <button key={f} onClick={() => setFiltro(f)} className={cx("chip !py-1", filtro === f && "!border-[var(--line-hi)] !bg-[var(--surface-hi)] !text-[var(--txt)]")}>
                {f === "tudo" ? "Tudo" : SELO_META[f].label.split(" ")[0]}
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
                        {r.conf.fonte && <span className="mono-label !text-[8.5px] block mb-1 opacity-75">{r.conf.fonte === "na-hora" ? "Pego na hora" : "Achado da análise"}</span>}
                        {r.conf.porque}
                      </div>
                    )}
                    {problema && (
                      <div className="mt-2 flex items-center gap-2.5 flex-wrap">
                        <button className="btn btn-primary btn-sm" onClick={() => onCorrigir(seed)}><Wand2 size={13} /> Melhorar isto</button>
                        <span className="text-[11px] text-[var(--txt-4)]">A correção é feita no Melhorar.</span>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
          {timeline.length === 0 && <li className="text-[12.5px] text-[var(--txt-3)] py-4 text-center">Nenhuma execução hoje. As respostas aparecem aqui com o selo de cada uma.</li>}
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
          <div className="text-[13.5px] text-[var(--txt)] truncate">{agent.state === "ativo" ? agent.agora : "Nenhuma execução em andamento."}</div>
        </div>
        <div className="hidden sm:flex items-center gap-3 flex-none font-mono text-[12px]">
          <span className="text-[var(--txt-3)]">{m.execucoes} hoje</span>
          <span style={{ color: "#3fb950" }}>{pct}% ok</span>
          <span style={{ color: m.erros ? "#f85149" : "var(--txt-4)" }}>{m.erros} erros</span>
        </div>
      </div>

      {/* o que dá pra melhorar */}
      {insights.length > 0 && (
        <div>
          <div className="mono-label flex items-center gap-1.5 mb-3"><Lightbulb size={12} style={{ color: "#3b82f6" }} /> O que pode melhorar</div>
          <div className="grid md:grid-cols-2 gap-3">
            {insights.map((ins, i) => <InsightCard key={i} ins={ins} onGo={onMelhorar} />)}
          </div>
        </div>
      )}
    </div>
  );
}

const insMeta = {
  elogio: { icon: ThumbsUp, color: "#3fb950", tag: "Indo bem" },
  critico: { icon: AlertTriangle, color: "#fbbf24", tag: "Pede permissão" },
  dica: { icon: Lightbulb, color: "#3b82f6", tag: "Ideia" },
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
          <Check size={11} className="inline mr-1" style={{ color: "#3fb950" }} /> Prova: {ins.prova}
        </div>
      )}
      {ins.ganho && ins.tipo !== "critico" && (
        <div className="mt-2.5 flex items-center justify-between">
          <Pill color={meta.color}>Ganho: {ins.ganho}</Pill>
          <button className="btn btn-ghost btn-sm" onClick={onGo}>Ver como <ArrowRight size={13} /></button>
        </div>
      )}
      {ins.tipo === "critico" && (
        done ? (
          <div className="mt-2.5 text-[12px]" style={{ color: done === "sim" ? "#3fb950" : "var(--txt-3)" }}>
            {done === "sim" ? "Correção autorizada. Ela passa por simulação antes de publicar." : "A sugestão ficou anotada."}
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
      <div className="card p-4 flex items-start gap-3" style={{ borderColor: "#3fb95030", background: "linear-gradient(160deg, rgba(63,185,80,.06), var(--surface))" }}>
        <ShieldCheck size={18} style={{ color: "#3fb950" }} className="flex-none mt-0.5" />
        <p className="text-[12.5px] text-[var(--txt-2)]"><b className="text-[var(--txt)]">Núcleo blindado.</b> {agent.shield} A Metrik opera estes recursos. Mudanças de comportamento passam pelo <b className="text-[var(--txt)]">Melhorar</b>, com ensaio e guardião.</p>
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
                <span className="text-[10.5px]" style={{ color: f.fonte === "mcp" ? "#3b82f6" : "var(--txt-4)" }}>{f.fonte === "mcp" ? "Criado por você" : "Operado pela Metrik"}</span>
              </div>
              <span className="pill flex-none" style={{ color: f.on ? "#3fb950" : "var(--txt-4)", borderColor: f.on ? "#3fb95040" : "var(--line)", background: f.on ? "#3fb95012" : "var(--surface-2)" }}>
                {f.on ? <><span className="live-dot" style={{ width: 6, height: 6, background: "#3fb950" }} /> Ligado</> : "Desligado"}
              </span>
            </div>
          ))}
        </div>
        {onMelhorar && (
          <button onClick={onMelhorar} className="btn btn-sm mt-4"><Wand2 size={13} /> Pedir mudança no Melhorar</button>
        )}
      </div>

      {/* turbinar — ligar com setup */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="mono-label">Turbinar este agente</div>
          <span className="text-[11px] text-[var(--txt-4)]">Só para este agente</span>
        </div>
        <p className="text-[12px] text-[var(--txt-3)] mb-4">Cada recurso abaixo é ligado <b className="text-[var(--txt-2)]">pela Metrik</b>, sob pedido. O ensaio testa antes de entrar no ar.</p>
        {upgrades.length === 0 ? (
          <div className="text-[12.5px] text-[var(--txt-3)] py-4 text-center">Todos os recursos estão ligados neste agente.</div>
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
            <div className="text-[12px] text-[var(--txt-3)]">Como vai funcionar</div>
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
            <div className="text-[11px] text-[var(--txt-3)] mb-1">Prévia</div>
            <p className="text-[12.5px] text-[var(--txt)]">{upgrade.blurb}{sel.length ? ". Escolhas: " + sel.join(", ") : ""}.</p>
            <div className="text-[11px] text-[var(--txt-4)] mt-1.5 flex items-center gap-1.5"><ArrowRight size={11} style={{ color: agent.color }} /> Destino: {upgrade.onde}</div>
            {upgrade.sinergia && <div className="text-[11px] text-[var(--txt-4)] mt-1 flex items-center gap-1.5"><Link2 size={11} style={{ color: "#58aae4" }} /> {upgrade.sinergia}</div>}
          </div>
        </div>

        <div className="p-4 border-t border-[var(--line)] flex items-center justify-between gap-2">
          <div className="text-[11px] text-[var(--txt-4)] flex items-center gap-1.5"><ShieldCheck size={13} style={{ color: "#3fb950" }} /> Não altera o núcleo.</div>
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
  "Deixa o follow-up com só 2 toques": { tipo: "ajuste", txt: "O follow-up passa de 3 para 2 toques. Simule ao lado antes de publicar." },
  "Puxa o preço de outra API": { tipo: "novo", txt: "Isto liga um recurso novo, a integração de preço. Simule ao lado antes de publicar." },
  "Fala num tom mais próximo": { tipo: "ajuste", txt: "O tom muda dentro do permitido. Simule ao lado antes de publicar." },
  "Não oferece desconto sem eu aprovar": { tipo: "regra", txt: "O pedido vira uma trava registrada no histórico. Simule para confirmar que ela segura." },
};
const respMeta: Record<string, { label: string; color: string }> = {
  ajuste: { label: "Ajuste", color: "#fbbf24" },
  novo: { label: "Recurso novo", color: "#3b82f6" },
  regra: { label: "Trava", color: "#58aae4" },
};
const ORIG: Record<string, { label: string; color: string }> = {
  metrik: { label: "Metrik", color: "#83879a" },
  chat: { label: "Chat", color: "#58aae4" },
  ajuste: { label: "Botão", color: "#fbbf24" },
  claude: { label: "Claude Code", color: "#3b82f6" },
  codex: { label: "Codex", color: "#58aae4" },
};

type EnsaioSit = { nome: string; pergunta: string; antes: string; agora: string };
/** o DESTINO da informação (canvas Cérebro do Robô): 🧾 fato · ⚙️ regra · 📚 doc */
type Destino = "fato" | "regra" | "doc";
const DESTINO_META: Record<Destino, { emoji: string; label: string; cor: string; desc: string }> = {
  fato: { emoji: "🧾", label: "Lista · Fato exato", cor: "#3fb950", desc: "O agente passa a responder sempre igual. O fato entra no cérebro depois de um ensaio rápido." },
  regra: { emoji: "⚙️", label: "Motor · Comportamento", cor: "#3b82f6", desc: "Muda o jeito de agir do agente. O guardião testa no ensaio antes de valer." },
  doc: { emoji: "📚", label: "Biblioteca · Documento", cor: "#58aae4", desc: "O conteúdo longo fica guardado. A busca inteligente entra numa próxima atualização." },
};
/** palpite de destino (sem cérebro é heurística — o cliente SEMPRE confirma) */
function destinoDe(t: string): Destino {
  if (/\.pdf|\.docx?|documento|p[áa]gina|em anexo|cont[eú]udo longo/i.test(t)) return "doc";
  if (/r\$|\d+ ?(reais|%)|custa|pre[çc]o|hor[áa]rio|\b\d{1,2}h\b|link|site|endere[çc]o|telefone|pix|parcel|prazo de/i.test(t)) return "fato";
  return "regra";
}
type EnvioState = {
  fase: "idle" | "clarificar" | "confirmar" | "registrando" | "ensaiando" | "pronto" | "publicando" | "publicado" | "guardado" | "erro";
  cs?: any;
  evals?: any;
  ensaio?: { modo: "real" | "sem-cerebro"; situacoes: EnsaioSit[] };
  pedido?: string;
  destino?: Destino;
  erro?: string;
};

/** O pedido está claro o bastante pra virar uma mudança? Sem o cérebro, uso uma
 *  heurística simples: pedido curto/1-2 palavras = vago → o "professor" pergunta
 *  em vez de fingir que testou. (Com o cérebro ligado, é a IA que julga.) */
function pedidoVago(t: string): boolean {
  const palavras = t.split(/\s+/).filter(Boolean);
  return t.length < 18 || palavras.length < 4;
}

/* selo redondo do fluxo 1-2-3 (canvas Porta Única) */
function StepBadge({ n, cor, ativo }: { n: number; cor: string; ativo: boolean }) {
  return (
    <span
      className="grid place-items-center rounded-full flex-none font-mono font-bold text-[15px] mt-1"
      style={{
        width: 38,
        height: 38,
        background: ativo ? `${cor}1f` : "var(--surface)",
        border: `1px solid ${ativo ? `${cor}66` : "var(--line)"}`,
        color: ativo ? cor : "var(--txt-4)",
      }}
    >
      {n}
    </span>
  );
}

/* a linha do tempo da vitrine (demo) — no agente real vem do ledger do Neon */
const DEMO_HIST: HistRow[] = [
  { origem: "chat", oque: "“ao negar, oferece outro caminho”", quando: "Há 3 dias", estado: "No ar", prova: "Guardião 12/12 · Nota 9,6", rendeu: "4 leads voltaram" },
  { origem: "chat", oque: "“25% de desconto pra quem pedir”", quando: "Há 4 dias", estado: "Segurada", prova: "Passa do teto do núcleo" },
  { origem: "ajuste", oque: "Follow-up ligado com 3 toques, parando quando o lead responde", quando: "Há 5 dias", estado: "No ar", rendeu: "2 leads recuperados" },
  { origem: "metrik", oque: "Tom mais próximo na rota de implementação", quando: "Há 1 semana", estado: "No ar", prova: "Guardião 8/8 · Nota 9,2" },
];
type HistRow = { origem: string; oque: string; quando: string; estado: string; prova?: string; rendeu?: string };
const BADGE_ORIGEM: Record<string, { label: string; cor: string }> = {
  chat: { label: "Você", cor: "#60a5fa" },
  ajuste: { label: "Módulo", cor: "#60a5fa" },
  metrik: { label: "Metrik", cor: "#58aae4" },
  claude: { label: "Metrik", cor: "#58aae4" },
  codex: { label: "Metrik", cor: "#58aae4" },
};

/* ── LIGAR MÓDULO em 1 minuto (canvas): escolhas prontas + prévia + Ativar.
   NADA liga no escuro: real → propor(hub_visual) + ensaio; com cérebro e
   guardião ✓ publica; sem cérebro registra honesto pra Metrik. ── */
function LigarModulo({ agent, u, onClose }: { agent: Agent; u: Upgrade; onClose: () => void }) {
  const auth = useMotorAuth();
  const [escolhas, setEscolhas] = useState<Record<number, string>>(
    () => Object.fromEntries((u.config ?? []).map((c, i) => [i, c.opcoes[0]])),
  );
  const [fase, setFase] = useState<"idle" | "rodando" | "ok" | "registrado" | "segurada" | "demo" | "erro">("idle");
  const [erro, setErro] = useState<string | null>(null);

  const ativar = async () => {
    const resumo = (u.config ?? []).map((c, i) => `${c.pergunta} ${escolhas[i]}`).join(" · ");
    const intent = `Ligar o módulo "${u.name}"${resumo ? ` — ${resumo}` : ""}`;
    if (!agent.real) {
      setFase("demo");
      return;
    }
    try {
      setFase("rodando");
      const cs: any = await api.propor({ agentId: agent.id, origin: "hub_visual", intent, patch: { modulo: u.name, escolhas } }, auth.getToken);
      const r: any = await api.avaliar(cs.id, auth.getToken);
      if (r?.ensaio?.modo === "real" && r?.evals?.aprovado) {
        await api.publicarMudanca(cs.id, auth.getToken);
        setFase("ok");
      } else if (r?.evals && r.evals.aprovado === false) {
        setFase("segurada");
      } else {
        setFase("registrado");
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível registrar o pedido.");
      setFase("erro");
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "rgba(6,8,12,.6)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: "#151a24", border: "1px solid rgba(59,130,246,.4)", boxShadow: "0 30px 70px -30px rgba(0,0,0,.8)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <div className="mono-label !text-[9px]" style={{ color: "#60a5fa" }}>Ligar · {u.name}</div>
            <div className="font-display font-bold text-[16px] tracking-tight mt-1">
              {(u.config?.length ?? 0) > 0 ? `${u.config!.length} ${u.config!.length === 1 ? "escolha pré-selecionada" : "escolhas pré-selecionadas"}` : "Sem escolhas a fazer"}
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm !p-1.5 flex-none"><X size={15} /></button>
        </div>

        {fase === "idle" || fase === "rodando" || fase === "erro" ? (
          <>
            <div className="space-y-3 mt-4">
              {(u.config ?? []).map((c, i) => (
                <div key={i}>
                  <div className="text-[11px] text-[var(--txt-3)] mb-1.5">{c.pergunta}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.opcoes.map((o) => {
                      const sel = escolhas[i] === o;
                      return (
                        <button key={o} onClick={() => setEscolhas((s) => ({ ...s, [i]: o }))} className="text-[11.5px] rounded-lg px-3 py-1.5 transition-colors" style={sel ? { background: "#3b82f6", color: "#08090d", fontWeight: 600 } : { border: "1px solid var(--line-hi)", color: "var(--txt-2)" }}>
                          {o}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl px-3.5 py-3 mt-4" style={{ background: "rgba(59,130,246,.08)", border: "1px solid rgba(59,130,246,.3)" }}>
              <p className="text-[12.5px] leading-relaxed m-0">{u.resultado ?? u.blurb}</p>
            </div>
            {fase === "erro" && <div className="text-[11.5px] mt-3" style={{ color: "#f85149" }}>{erro}</div>}
            <div className="flex items-center gap-2.5 mt-4">
              <button onClick={() => void ativar()} disabled={fase === "rodando"} className="btn btn-primary">
                {fase === "rodando" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Ativar
              </button>
              <button onClick={onClose} className="btn">Agora não</button>
            </div>
            <p className="text-[10px] text-[var(--txt-4)] mt-3 leading-relaxed m-0">O ensaio roda antes. Se quebrar uma trava, o módulo não liga.</p>
          </>
        ) : fase === "ok" ? (
          <div className="mt-4">
            <div className="flex items-center gap-2.5 text-[14px] font-medium"><Check size={17} style={{ color: "#3fb950" }} /> Módulo ligado.</div>
            <p className="text-[12px] text-[var(--txt-3)] mt-1.5">Aprovado pelo guardião e publicado. A mudança está no histórico.</p>
            <button onClick={onClose} className="btn btn-primary btn-sm mt-4">Fechar</button>
          </div>
        ) : fase === "segurada" ? (
          <div className="mt-4">
            <div className="flex items-center gap-2.5 text-[14px] font-medium" style={{ color: "#f85149" }}><ShieldCheck size={17} /> O guardião segurou.</div>
            <p className="text-[12px] text-[var(--txt-3)] mt-1.5">A configuração esbarra numa trava do núcleo e o módulo não ligou. O pedido está no histórico.</p>
            <button onClick={onClose} className="btn btn-sm mt-4">Fechar</button>
          </div>
        ) : fase === "registrado" ? (
          <div className="mt-4">
            <div className="flex items-center gap-2.5 text-[14px] font-medium" style={{ color: "#fbbf24" }}><Clock size={17} /> Pedido registrado.</div>
            <p className="text-[12px] text-[var(--txt-3)] mt-1.5">Sem o cérebro ligado, não há como provar que funciona. A Metrik liga depois do ensaio completo.</p>
            <button onClick={onClose} className="btn btn-primary btn-sm mt-4">Fechar</button>
          </div>
        ) : (
          <div className="mt-4">
            <div className="flex items-center gap-2.5 text-[14px] font-medium" style={{ color: "#fbbf24" }}><Sparkles size={17} /> Modo demonstração.</div>
            <p className="text-[12px] text-[var(--txt-3)] mt-1.5">No agente real, o pedido passa pelo ensaio e só liga com aprovação do guardião.</p>
            <button onClick={onClose} className="btn btn-sm mt-4">Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══ TESTAR (canvas Cérebro do Robô): conversa tipo WhatsApp com a MESMA IA
   do ar. Sandbox DE VERDADE: o backend roda o cérebro SEM tools — não existe
   caminho pra tocar CRM, estado ou WhatsApp. Demo = roteiro de vitrine. ══ */
type MsgTeste = { de: "voce" | "ia"; texto: string; fonte?: string | null; aviso?: boolean };
const WA = { fundo: "#0b141a", topo: "#1f2c34", campo: "#2a3942", bolhaVoce: "#005c4b", bolhaIa: "#202c33", txt: "#e9edef", meta: "#8696a0" };
const DEMO_TESTE: { re: RegExp; resp: string; fonte: string }[] = [
  { re: /start|pre[cç]o|quanto|custa|valor|plano/i, resp: "O Start sai por R$ 497! É o plano pra quem quer começar com a IA atendendo já na primeira semana. Quer que eu te mostre o que vem nele?", fonte: "Lista · Preços · Fato adicionado hoje" },
  { re: /desconto|vista/i, resp: "Boa pergunta! Deixa eu confirmar essa condição com o time e já te falo, tá bom?", fonte: "Motor · Regra de desconto em ensaio · Resposta segurada" },
  { re: /cancelar|fidelidade/i, resp: "Pode cancelar quando quiser — não tem fidelidade. Só pedimos aviso com 30 dias, tá bom?", fonte: "Biblioteca · contrato.pdf" },
];

function TestarTab({ agent, onMelhorar, seed }: { agent: Agent; onMelhorar: (seed?: string) => void; seed?: string | null }) {
  const auth = useMotorAuth();
  const [msgs, setMsgs] = useState<MsgTeste[]>([]);
  const [input, setInput] = useState(seed ?? "");
  const [rodando, setRodando] = useState(false);
  const [modo, setModo] = useState<"ar" | "ensaio">("ar");
  const [feedback, setFeedback] = useState<Record<number, "sim" | "nao">>({});
  const [emPreparo, setEmPreparo] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (seed) setInput(seed); }, [seed]);
  useEffect(() => { fimRef.current?.scrollIntoView({ block: "end" }); }, [msgs]);

  // existe mudança em preparo? (é o que o "com o ensaio" aplica por cima)
  useEffect(() => {
    if (!agent.real) return;
    let vivo = true;
    (api.listChangeSets(agent.id, auth.getToken) as Promise<any[]>)
      .then((rows) => {
        if (!vivo || !Array.isArray(rows)) return;
        const cs = rows.find((r) => ["draft", "evaluated", "approved"].includes(String(r.status)));
        setEmPreparo(cs ? String(cs.intent ?? "Mudança em preparo") : null);
      })
      .catch(() => {});
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id]);

  const enviarTeste = async (textoDireto?: string) => {
    const t = (textoDireto ?? input).trim();
    if (!t || rodando) return;
    const novo: MsgTeste[] = [...msgs, { de: "voce", texto: t }];
    setMsgs(novo);
    setInput("");
    if (!agent.real) {
      const demo = DEMO_TESTE.find((d) => d.re.test(t));
      setMsgs([
        ...novo,
        demo
          ? { de: "ia", texto: demo.resp, fonte: demo.fonte }
          : { de: "ia", texto: "Modo demonstração. Na conta real, o cérebro no ar responde aqui.", aviso: true },
      ]);
      return;
    }
    try {
      setRodando(true);
      const historico = novo.filter((m) => !m.aviso).map((m) => ({ role: m.de === "voce" ? ("user" as const) : ("assistant" as const), content: m.texto }));
      const r: any = await api.testar(agent.id, historico, modo, auth.getToken);
      if (r?.modo === "sem-cerebro") {
        setMsgs([...novo, { de: "ia", texto: "Teste indisponível. O cérebro (chave da OpenAI) não está ligado neste ambiente.", aviso: true }]);
      } else {
        const fonte = r?.fonte
          ? `Usou: ${r.fonte}${r.base === "semente" ? " · Cérebro-semente" : ""}`
          : r?.base === "semente"
            ? "Cérebro-semente da vertical · Sem versão publicada"
            : null;
        setMsgs([...novo, { de: "ia", texto: String(r?.texto ?? "…"), fonte }]);
      }
    } catch (e) {
      setMsgs([...novo, { de: "ia", texto: e instanceof Error ? e.message : "O teste falhou. Envie a mensagem de novo.", aviso: true }]);
    } finally {
      setRodando(false);
    }
  };

  const naoEIsso = (i: number) => {
    setFeedback((s) => ({ ...s, [i]: "nao" }));
    const pergunta = [...msgs.slice(0, i)].reverse().find((m) => m.de === "voce")?.texto ?? "";
    onMelhorar(`No teste, perguntei: "${pergunta}" e ela respondeu: "${msgs[i].texto}" — não é isso. Deveria: `);
  };

  const sugestoes = agent.real
    ? ["quanto custa?", "que horas vocês atendem?", "quero falar com uma pessoa"]
    : ["quanto custa o plano start?", "e à vista, tem desconto?", "posso cancelar quando?"];
  const nPerg = msgs.filter((m) => m.de === "voce").length;
  const nSim = Object.values(feedback).filter((v) => v === "sim").length;
  const nNao = Object.values(feedback).filter((v) => v === "nao").length;

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
      {/* o telefone — a conversa */}
      <div className="rounded-2xl overflow-hidden border border-[var(--line)] min-w-0" style={{ background: WA.fundo }}>
        <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: WA.topo }}>
          <div className="rounded-full p-1 flex-none" style={{ background: "var(--deep)", border: "1px solid rgba(59,130,246,.5)" }}>
            <Robot state="ativo" color={agent.color} size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold" style={{ color: WA.txt }}>{agent.name} · Conversa de teste</div>
            <div className="text-[10.5px]" style={{ color: WA.meta }}>Você é o lead. Pergunte qualquer coisa.</div>
          </div>
          <div className="flex rounded-[9px] overflow-hidden flex-none" style={{ border: "1px solid rgba(255,255,255,.14)" }}>
            <button onClick={() => setModo("ar")} className="text-[10px] font-semibold px-2.5 py-1.5" style={modo === "ar" ? { background: "#3fb950", color: "#08090d" } : { color: WA.meta }}>No ar</button>
            <button
              onClick={() => (emPreparo || !agent.real) && setModo("ensaio")}
              title={emPreparo ? `Aplica a mudança em ensaio: ${emPreparo}` : "Nenhuma mudança em ensaio agora."}
              className="text-[10px] font-semibold px-2.5 py-1.5"
              style={modo === "ensaio" ? { background: "#fbbf24", color: "#08090d" } : { color: WA.meta, opacity: emPreparo || !agent.real ? 1 : 0.4 }}
            >
              Com o ensaio
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-2.5 overflow-y-auto" style={{ minHeight: 340, maxHeight: 460 }}>
          {msgs.length === 0 && (
            <div className="text-center text-[11.5px] py-10" style={{ color: WA.meta }}>
              Escreva como um lead escreveria ou toque numa sugestão ao lado.
              <br />
              <span className="text-[10px]">Nada daqui vai para o CRM nem usa o WhatsApp.</span>
            </div>
          )}
          {msgs.map((m, i) =>
            m.de === "voce" ? (
              <div key={i} className="ml-auto max-w-[70%] rounded-[10px] px-3 py-1.5" style={{ background: WA.bolhaVoce, borderTopRightRadius: 3 }}>
                <div className="text-[13px] leading-relaxed" style={{ color: WA.txt }}>{m.texto}</div>
              </div>
            ) : (
              <div key={i} className="max-w-[76%]">
                <div className="rounded-[10px] px-3 py-1.5" style={{ background: m.aviso ? "rgba(251,191,36,.12)" : WA.bolhaIa, borderTopLeftRadius: 3, border: m.aviso ? "1px solid rgba(251,191,36,.35)" : undefined }}>
                  <div className="text-[13px] leading-relaxed" style={{ color: m.aviso ? "#fbbf24" : WA.txt }}>{m.texto}</div>
                </div>
                {!m.aviso && (
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {m.fonte && (
                      <span className="text-[9.5px] font-semibold rounded-full px-2.5 py-1" style={{ color: "#3fb950", background: "rgba(63,185,80,.1)", border: "1px solid rgba(63,185,80,.3)" }}>{m.fonte}</span>
                    )}
                    {feedback[i] === "sim" ? (
                      <span className="text-[10px] font-bold rounded-[7px] px-2.5 py-1" style={{ background: "#3fb950", color: "#08090d" }}>Aprovada</span>
                    ) : feedback[i] === "nao" ? (
                      <span className="text-[10px] font-semibold rounded-[7px] px-2.5 py-1" style={{ color: "#f85149", border: "1px solid rgba(248,81,73,.4)" }}>Corrigindo no Melhorar</span>
                    ) : (
                      <>
                        <button onClick={() => setFeedback((s) => ({ ...s, [i]: "sim" }))} className="text-[10px] font-bold rounded-[7px] px-2.5 py-1" style={{ background: "#3fb950", color: "#08090d" }}>Aprovar</button>
                        <button onClick={() => naoEIsso(i)} className="text-[10px] font-semibold rounded-[7px] px-2.5 py-1" style={{ color: "#f85149", border: "1px solid rgba(248,81,73,.4)" }}>Corrigir</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ),
          )}
          {rodando && <div className="text-[11px]" style={{ color: WA.meta }}>Digitando</div>}
          <div ref={fimRef} />
        </div>

        <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ background: WA.topo }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void enviarTeste(); } }}
            placeholder="Escreva como um lead escreveria"
            className="flex-1 rounded-full px-4 py-2.5 text-[12.5px] outline-none min-w-0"
            style={{ background: WA.campo, color: WA.txt }}
          />
          <button onClick={() => void enviarTeste()} disabled={!input.trim() || rodando} className="grid place-items-center rounded-full flex-none" style={{ width: 40, height: 40, background: "var(--grad)" }}>
            {rodando ? <Loader2 size={16} className="animate-spin" style={{ color: "#08090d" }} /> : <ArrowUp size={17} style={{ color: "#08090d" }} />}
          </button>
        </div>
      </div>

      {/* rail: a IA orienta o teste + placar honesto */}
      <div className="space-y-4">
        <div className="card p-4" style={{ borderColor: "rgba(59,130,246,.35)", background: "linear-gradient(150deg, rgba(59,130,246,.07), var(--surface))" }}>
          <div className="mono-label !text-[9px] mb-2.5" style={{ color: "#60a5fa" }}>Sugestões de teste</div>
          <div className="space-y-1.5">
            {sugestoes.map((s) => (
              <button key={s} onClick={() => void enviarTeste(s)} className="block w-full text-left text-[12px] rounded-[9px] px-3 py-2 transition-colors hover:border-[rgba(59,130,246,.4)]" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                “{s}”
              </button>
            ))}
            {emPreparo && (
              <button onClick={() => setModo("ensaio")} className="block w-full text-left text-[11.5px] rounded-[9px] px-3 py-2" style={{ background: "rgba(251,191,36,.06)", border: "1px solid rgba(251,191,36,.3)", color: "#fbbf24" }}>
                Testar a mudança em ensaio: “{emPreparo.slice(0, 60)}”
              </button>
            )}
          </div>
          <p className="text-[10px] text-[var(--txt-4)] mt-2.5 leading-relaxed m-0">A sugestão tocada entra na conversa como mensagem do lead.</p>
        </div>

        <div className="card p-4">
          <div className="mono-label !text-[9px] mb-2.5">Este teste</div>
          <div className="flex gap-5">
            <div><div className="num text-[20px] leading-none">{nPerg}</div><div className="text-[9.5px] text-[var(--txt-3)] mt-1">Perguntas</div></div>
            <div><div className="num text-[20px] leading-none" style={{ color: "#3fb950" }}>{nSim}</div><div className="text-[9.5px] text-[var(--txt-3)] mt-1">Aprovadas</div></div>
            <div><div className="num text-[20px] leading-none" style={{ color: "#f85149" }}>{nNao}</div><div className="text-[9.5px] text-[var(--txt-3)] mt-1">Em correção</div></div>
          </div>
          <p className="text-[10.5px] text-[var(--txt-3)] mt-3 leading-relaxed m-0">“Corrigir” abre o Melhorar com a conversa já colada.</p>
        </div>

        <div className="card p-3.5 flex items-start gap-2.5" style={{ borderColor: "#3fb95030" }}>
          <ShieldCheck size={15} style={{ color: "#3fb950" }} className="flex-none mt-0.5" />
          <p className="text-[11px] text-[var(--txt-2)] leading-relaxed m-0"><b className="text-[var(--txt)]">{agent.real ? "É o mesmo cérebro do ar." : "Demonstração."}</b> {agent.real ? "Roda sem ferramentas e não altera o CRM, o estado nem o WhatsApp." : "Na conta real, este chat usa o cérebro no ar."}</p>
        </div>
      </div>
    </div>
  );
}

/* ══ RODANDO AGORA — a spec que o MOTOR está lendo NESTE instante (action
   "rodando"): versão, desde quando, quem ela é e as regras valendo, com a
   origem de cada uma (🔒 núcleo · ✦ sua via Melhorar · 🧾 fato seu).
   Substitui a vitrine vestida no agente real — aqui é o dado do motor. ══ */
function RodandoAgora({ agent, onMelhorar, irTestar }: { agent: Agent; onMelhorar: (s?: string) => void; irTestar: (s?: string) => void }) {
  const auth = useMotorAuth();
  const [rod, setRod] = useState<any | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [suas, setSuas] = useState<Set<string>>(new Set());

  useEffect(() => {
    let vivo = true;
    (api.rodando(agent.id, auth.getToken) as Promise<any>)
      .then((r) => { if (vivo) setRod(r); })
      .catch((e) => { if (vivo) setErro(e instanceof Error ? e.message : "Motivo desconhecido."); });
    (api.listChangeSets(agent.id, auth.getToken) as Promise<any[]>)
      .then((rows) => {
        if (!vivo || !Array.isArray(rows)) return;
        setSuas(new Set(rows.filter((r) => String(r.status) === "published").map((r) => String(r.intent ?? "").trim().toLowerCase())));
      })
      .catch(() => {});
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id]);

  if (erro) {
    return <div className="card p-5 text-[12.5px]" style={{ color: "#f85149" }}>Não foi possível ler o motor. {erro}</div>;
  }
  if (!rod) {
    return (
      <div className="card p-5">
        <div className="mono-label mb-3">O que está rodando agora</div>
        <Skeleton style={{ width: "60%", height: 12 }} />
        <Skeleton className="mt-3" style={{ width: "90%", height: 12 }} />
        <Skeleton className="mt-2" style={{ width: "80%", height: 12 }} />
      </div>
    );
  }

  const c = rod.spec?.cerebro ?? {};
  const regras: string[] = Array.isArray(c.regras) ? c.regras : [];
  const ehSua = (r: string) => suas.has(r.trim().toLowerCase());
  const ehFato = (r: string) => /^fato:/i.test(r.trim());
  const semente = rod.base === "semente";

  return (
    <div className="card p-5 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <div className="font-display font-semibold text-[16px] tracking-tight">O que está rodando <span className="grad-text">agora</span></div>
        <div className="flex items-center gap-2 flex-wrap">
          {semente ? (
            <span className="pill" style={{ color: "#fbbf24", borderColor: "#fbbf2440", background: "#fbbf2414" }}>Cérebro-semente da vertical</span>
          ) : (
            <span className="pill" style={{ color: "var(--emerald)", borderColor: "#3fb95040", background: "#3fb95014" }}>
              Versão {rod.versao}{rod.desde ? ` · ${tempoRelativo(rod.desde) === "agora" ? "No ar agora" : `No ar há ${tempoRelativo(rod.desde)}`}` : ""}
            </span>
          )}
          <span className="text-[10px] text-[var(--txt-4)]">Lido do motor</span>
        </div>
      </div>
      {semente && (
        <p className="text-[11.5px] mb-3" style={{ color: "#f2cf86" }}>
          O agente responde com a base da vertical. A primeira mudança publicada no Melhorar vira a versão 1.
        </p>
      )}

      {c.identidade && <p className="text-[14px] text-[var(--txt)] leading-relaxed mb-3 max-w-2xl">{c.identidade}</p>}
      <div className="flex flex-wrap gap-2 mb-4">
        {c.oferta && <span className="pill">Oferta: {String(c.oferta).slice(0, 70)}{String(c.oferta).length > 70 ? "…" : ""}</span>}
        {c.tom && <span className="pill">Tom: {c.tom}</span>}
      </div>

      <div className="mono-label !text-[9px] mb-2">Regras em vigor · {regras.length}</div>
      <div>
        {regras.map((r, i) => {
          const fato = ehFato(r);
          const sua = fato || ehSua(r);
          const badge = fato ? { t: "Fato seu", c: "#3fb950" } : sua ? { t: "Sua regra", c: "#60a5fa" } : { t: "Núcleo", c: "#838a99" };
          return (
            <div key={i} className="flex items-start gap-2.5 py-2 border-b border-[var(--line)] last:border-0">
              <span className="text-[9px] font-bold rounded-[6px] px-2 py-0.5 flex-none mt-0.5" style={{ color: badge.c, background: `${badge.c}14`, border: `1px solid ${badge.c}35` }}>{badge.t}</span>
              <span className="text-[12.5px] text-[var(--txt-2)] leading-relaxed flex-1 min-w-0">{fato ? r.replace(/^fato:\s*/i, "") : r}</span>
              <button onClick={() => irTestar(fato ? r.replace(/^fato:\s*/i, "") : r)} className="text-[10px] font-semibold flex-none mt-0.5" style={{ color: "var(--violet-2)" }}>Testar</button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-3.5">
        <button className="btn btn-primary btn-sm" onClick={() => onMelhorar()}>Mudar no Melhorar</button>
        <span className="text-[10px] text-[var(--txt-4)]">Uma regra publicada no Melhorar aparece nesta lista na hora.</span>
      </div>
    </div>
  );
}

/* ══ MEMÓRIA (canvas): tudo que o robô sabe — e ONDE vive. 3 casas:
   🧾 Listas (fatos exatos) · 📚 Biblioteca (docs — próxima fatia, honesto)
   · ⚙️ Motor (comportamento). Real = ledger do Neon; demo = vitrine. ══ */
function MemoriaRobo({ agent, onMelhorar, irTestar }: { agent: Agent; onMelhorar: (s?: string) => void; irTestar: (s?: string) => void }) {
  const auth = useMotorAuth();
  const [cs, setCs] = useState<any[] | null>(null);
  useEffect(() => {
    if (!agent.real) return;
    let vivo = true;
    (api.listChangeSets(agent.id, auth.getToken) as Promise<any[]>)
      .then((rows) => { if (vivo && Array.isArray(rows)) setCs(rows); })
      .catch(() => {});
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id]);

  const tipoDe = (r: any): string => String((r?.patch as any)?.tipo ?? "regra");
  const estadoDe = (r: any) => (String(r.status) === "published" ? "No ar" : ["draft", "evaluated", "approved"].includes(String(r.status)) ? "Em ensaio" : null);
  const fatos = agent.real
    ? (cs ?? []).filter((r) => tipoDe(r) === "fato" && estadoDe(r)).map((r) => ({ titulo: String(r.intent ?? "").replace(/^fato:\s*/i, ""), estado: estadoDe(r)! }))
    : (agent.work?.conhecimento ?? []).map((c) => ({ titulo: c.titulo, estado: "No ar" as string, cat: c.cat }));
  const docs = agent.real
    ? (cs ?? []).filter((r) => tipoDe(r) === "doc").map((r) => ({ titulo: String(r.intent ?? "Documento").slice(0, 60), estado: "Guardado" }))
    : [{ titulo: "contrato.pdf · 12 páginas", estado: "No ar", uso: "Usado 14 vezes esta semana" }, { titulo: "catalogo-servicos.pdf", estado: "No ar", uso: "Usado 5 vezes esta semana" }];
  const regras = agent.real
    ? (cs ?? []).filter((r) => tipoDe(r) === "regra" && estadoDe(r)).map((r) => ({ titulo: String(r.intent ?? ""), estado: estadoDe(r)! }))
    : (agent.mapa?.ramos?.[0]?.regras ?? []).slice(0, 4).map((rg) => ({ titulo: `Se ${rg.se}`, estado: "No ar" as string }));

  const estCor = (e: string) => (e === "No ar" ? "#3fb950" : e === "Guardado" ? "#58aae4" : "#fbbf24");
  const Item = ({ titulo, estado }: { titulo: string; estado: string }) => (
    <div className="flex items-center gap-2 py-1.5 border-b border-[var(--line)] last:border-0 text-[12px]">
      <span className="flex-1 min-w-0 truncate">{titulo}</span>
      <span className="text-[9.5px] font-semibold flex-none" style={{ color: estCor(estado) }}>{estado}</span>
      <button onClick={() => irTestar(titulo)} className="text-[10px] font-semibold flex-none" style={{ color: "var(--violet-2)" }}>Testar</button>
    </div>
  );

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <div className="font-display font-semibold text-[16px] tracking-tight">O que {agent.name} <span className="grad-text">sabe</span> e onde fica</div>
        <div className="flex items-center gap-4">
          <span className="text-[10.5px] text-[var(--txt-4)]"><b style={{ color: "#3fb950" }}>{fatos.length}</b> fatos · <b style={{ color: "#58aae4" }}>{docs.length}</b> documentos · <b style={{ color: "#60a5fa" }}>{regras.length}</b> regras</span>
          <button className="btn btn-primary btn-sm" onClick={() => onMelhorar()}>Ensinar</button>
        </div>
      </div>
      <p className="text-[11px] text-[var(--txt-4)] mb-4">O botão Testar abre a conversa de teste com o item.</p>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="rounded-xl p-3.5" style={{ border: "1px solid rgba(63,185,80,.3)", background: "var(--surface)" }}>
          <div className="flex items-center gap-2 mb-0.5"><span className="text-[15px]">🧾</span><b className="text-[13px]">Listas de fatos exatos</b></div>
          <div className="text-[10px] text-[var(--txt-4)] mb-2.5">Para preço, horário e link. A resposta sai sempre igual.</div>
          {fatos.length === 0 ? (
            <p className="text-[11px] text-[var(--txt-3)] m-0">Nenhum fato cadastrado. Ensine o primeiro no Melhorar.</p>
          ) : (
            fatos.slice(0, 6).map((f, i) => <Item key={i} titulo={f.titulo} estado={f.estado} />)
          )}
        </div>

        <div className="rounded-xl p-3.5" style={{ border: "1px solid rgba(88,170,228,.3)", background: "var(--surface)" }}>
          <div className="flex items-center gap-2 mb-0.5"><span className="text-[15px]">📚</span><b className="text-[13px]">Biblioteca de documentos</b></div>
          <div className="text-[10px] text-[var(--txt-4)] mb-2.5">Guarda documentos longos.</div>
          {agent.real ? (
            <>
              {docs.map((d, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 border-b border-[var(--line)] last:border-0 text-[12px]">
                  <span className="flex-1 min-w-0 truncate">{d.titulo}</span>
                  <span className="text-[9.5px] font-semibold flex-none" style={{ color: "#58aae4" }}>Guardado</span>
                </div>
              ))}
              <p className="text-[10px] text-[var(--txt-4)] mt-2 m-0">A busca inteligente entra numa próxima atualização. O conteúdo enviado fica guardado aqui.</p>
            </>
          ) : (
            (docs as any[]).map((d, i) => (
              <div key={i} className="py-1.5 border-b border-[var(--line)] last:border-0">
                <div className="flex items-center gap-2 text-[12px]"><span className="flex-1 truncate">{d.titulo}</span><span className="text-[9.5px] font-semibold" style={{ color: "#3fb950" }}>No ar</span></div>
                {d.uso && <div className="text-[10px] text-[var(--txt-4)] mt-0.5">{d.uso}</div>}
              </div>
            ))
          )}
        </div>

        <div className="rounded-xl p-3.5" style={{ border: "1px solid rgba(59,130,246,.35)", background: "var(--surface)" }}>
          <div className="flex items-center gap-2 mb-0.5"><span className="text-[15px]">⚙️</span><b className="text-[13px]">Motor de comportamento</b></div>
          <div className="text-[10px] text-[var(--txt-4)] mb-2.5">Cada regra passa pelo ensaio antes de valer.</div>
          {regras.length === 0 ? (
            <p className="text-[11px] text-[var(--txt-3)] m-0">As regras pedidas aparecem aqui com a prova do guardião.</p>
          ) : (
            regras.slice(0, 5).map((r, i) => <Item key={i} titulo={r.titulo} estado={r.estado} />)
          )}
          <button onClick={() => onMelhorar()} className="text-[10.5px] font-semibold mt-2" style={{ color: "var(--violet-2)" }}>Mudar o comportamento no Melhorar</button>
        </div>
      </div>
    </div>
  );
}

/* o ensaio demora ~30s de verdade — narra o que está acontecendo, com relógio */
function EnsaioProgresso() {
  const [s, setS] = useState(0);
  useEffect(() => {
    const i = window.setInterval(() => setS((x) => x + 1), 1000);
    return () => window.clearInterval(i);
  }, []);
  const msg =
    s < 6
      ? "Conferindo as travas do núcleo"
      : s < 14
        ? "Criando situações de lead a partir do pedido"
        : "Respondendo cada situação antes e depois da mudança";
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2.5 text-[12.5px] text-[var(--txt-2)]">
        <Loader2 size={15} className="animate-spin flex-none" style={{ color: "#3b82f6" }} />
        <span className="flex-1">{msg}</span>
        <span className="tick flex-none">{s}s</span>
      </div>
      <p className="text-[10.5px] text-[var(--txt-4)] mt-2 m-0">O ensaio leva cerca de 30 segundos.</p>
    </div>
  );
}

function MelhorarTab({ agent, initialTexto, irTestar, irComoFunciona }: { agent: Agent; initialTexto?: string | null; irTestar: (s?: string) => void; irComoFunciona: () => void }) {
  const auth = useMotorAuth();
  const [gravando, setGravando] = useState(false);
  const [verHist, setVerHist] = useState(false);
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

  // o fluxo 1-2-3 do canvas: fala (1) → ela confirma (2) → ensaio e prova (3).
  // "Manda" NUNCA muda nada sozinho: vago → o professor pergunta; claro → passo 2.
  const enviar = (forcar = false) => {
    const t = texto.trim();
    if (!t || envio.fase === "registrando" || envio.fase === "ensaiando") return;
    if (!forcar && pedidoVago(t)) {
      setEnvio({ fase: "clarificar", pedido: t });
      return;
    }
    setEnvio({ fase: "confirmar", pedido: t, destino: destinoDe(t) });
  };

  // passo 2 → "É isso" → registra + ensaia (passo 3), conforme o DESTINO:
  //  fato → vira regra "Fato: …" (o runtime já lê) via a MESMA esteira do ensaio;
  //  regra → a esteira de sempre; doc → registra pra Metrik (Biblioteca é a próxima fatia).
  const rodarEnsaio = async () => {
    const bruto = envio.pedido ?? texto.trim();
    if (!bruto) return;
    const destino: Destino = envio.destino ?? "regra";
    if (!agent.real) {
      setEnvio({ fase: "erro", pedido: bruto, destino, erro: "Modo demonstração. No agente real, o pedido passa pelo guardião e mostra o ensaio." });
      return;
    }
    if (destino === "doc") {
      try {
        setEnvio({ fase: "registrando", pedido: bruto, destino });
        await api.propor({ agentId: agent.id, origin: "hub_chat", intent: bruto, patch: { pedido: bruto, tipo: "doc" } }, auth.getToken);
        setEnvio({ fase: "guardado", pedido: bruto, destino });
        setTexto("");
      } catch (e) {
        setEnvio({ fase: "erro", erro: e instanceof Error ? e.message : "Não foi possível registrar o pedido." });
      }
      return;
    }
    const t = destino === "fato" && !/^fato:/i.test(bruto) ? `Fato: ${bruto}` : bruto;
    try {
      setEnvio({ fase: "registrando", pedido: bruto, destino });
      const cs: any = await api.propor({ agentId: agent.id, origin: "hub_chat", intent: t, patch: { pedido: t, tipo: destino } }, auth.getToken);
      setEnvio({ fase: "ensaiando", cs, pedido: bruto, destino });
      const r: any = await api.avaliar(cs.id, auth.getToken);
      setEnvio({ fase: "pronto", cs, evals: r.evals, ensaio: r.ensaio, pedido: bruto, destino });
      setTexto("");
    } catch (e) {
      setEnvio({ fase: "erro", erro: e instanceof Error ? e.message : "Não foi possível registrar o pedido." });
    }
  };

  // é isso que você queria → PUBLICA de verdade (compila a spec nova + release)
  const publicar = async () => {
    try {
      setEnvio((s) => ({ ...s, fase: "publicando" }));
      await api.publicarMudanca(envio.cs.id, auth.getToken);
      setEnvio((s) => ({ ...s, fase: "publicado" }));
    } catch (e) {
      setEnvio({ fase: "erro", erro: e instanceof Error ? e.message : "Não foi possível publicar a mudança." });
    }
  };

  // não é isso → volta pro campo pra reescrever o pedido de outro jeito
  const ajustar = () => setEnvio({ fase: "idle" });

  // Histórico REAL (ledger do Neon) quando o agente é real; senão o demo.
  const ORIGIN_KEY: Record<string, string> = { hub_chat: "chat", hub_visual: "ajuste", claude_code: "claude", codex: "codex", metrik: "metrik", api: "claude" };
  const ESTADO_LBL: Record<string, string> = { draft: "Recebido", evaluated: "Testado", approved: "Aprovado", published: "No ar", ignored: "Ignorado", rejected: "Rejeitado" };
  const histReal = reaisHist?.map((r) => ({
    origem: ORIGIN_KEY[r.origin] ?? "chat",
    oque: r.origin === "hub_chat" ? `Você pediu: “${r.intent}”` : r.intent ?? "Mudança",
    quando: r.createdAt ? tempoRelativo(r.createdAt) : "",
    estado: ESTADO_LBL[r.status] ?? String(r.status ?? ""),
  }));
  const hist = histReal ?? [];
  const emPreparo = hist.filter((h) => ["Rascunho", "Recebido", "Testado", "Aprovado"].includes(h.estado)).length;

  // pendência da vitrine: a pergunta que ela não soube — 1 clique já semeia o campo
  const pendencia = auth.demo && agent.tipo === "resposta" ? "Vocês parcelam em quantas vezes?" : null;

  // A LINHA DO TEMPO GRANDE (canvas): o histórico é a prova do produto.
  const linhas: HistRow[] = histReal ?? (auth.demo ? DEMO_HIST : []);
  const nAr = linhas.filter((h) => h.estado === "No ar").length;
  const nSeg = linhas.filter((h) => h.estado === "Segurada" || h.estado === "Rejeitado").length;
  const nSuas = linhas.filter((h) => h.origem === "chat" || h.origem === "ajuste").length;
  const nMet = linhas.length - nSuas;

  if (verHist) {
    return (
      <div className="space-y-4">
        <button onClick={() => setVerHist(false)} className="btn btn-ghost btn-sm !px-2"><ArrowLeft size={15} /> Melhorar</button>
        <div className="flex items-end justify-between gap-5 flex-wrap">
          <h3 className="font-display text-[24px] font-bold tracking-tight m-0">O que {agent.name} <span className="grad-text">já aprendeu</span></h3>
          <div className="flex gap-6 text-right">
            <div><div className="num text-[24px] leading-none">{nAr}</div><div className="text-[10px] text-[var(--txt-3)] mt-1">No ar</div></div>
            <div><div className="num text-[24px] leading-none" style={{ color: "#60a5fa" }}>{nSuas}</div><div className="text-[10px] text-[var(--txt-3)] mt-1">Suas</div></div>
            <div><div className="num text-[24px] leading-none" style={{ color: "#58aae4" }}>{nMet}</div><div className="text-[10px] text-[var(--txt-3)] mt-1">Da Metrik</div></div>
            <div><div className="num text-[24px] leading-none" style={{ color: nSeg > 0 ? "#f85149" : "#3fb950" }}>{nSeg}</div><div className="text-[10px] text-[var(--txt-3)] mt-1">Seguradas</div></div>
          </div>
        </div>
        <div className="card px-5">
          {linhas.length === 0 && <p className="text-[12.5px] text-[var(--txt-3)] py-5">Nenhuma mudança até agora. A primeira aparece aqui com a prova.</p>}
          {linhas.map((h, i) => {
            const b = BADGE_ORIGEM[h.origem] ?? BADGE_ORIGEM.chat;
            const segurada = h.estado === "Segurada" || h.estado === "Rejeitado";
            const ec = h.estado === "No ar" ? "#3fb950" : segurada ? "#f85149" : "#fbbf24";
            return (
              <div key={i} className="flex items-center gap-4 py-3.5 border-b border-[var(--line)] last:border-0">
                <span className="grid place-items-center rounded-[7px] flex-none text-[10px] font-bold" style={{ width: 66, height: 24, background: `${segurada ? "#f85149" : b.cor}1f`, border: `1px solid ${segurada ? "#f85149" : b.cor}55`, color: segurada ? "#f85149" : b.cor }}>{b.label}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium leading-snug">{h.oque}</div>
                  <div className="text-[10.5px] mt-0.5" style={{ color: segurada ? "#f85149" : "var(--txt-4)" }}>{[h.quando, h.prova].filter(Boolean).join(" · ")}</div>
                </div>
                {h.rendeu && <span className="text-[10.5px] font-semibold rounded-[7px] px-2.5 py-1 flex-none hidden sm:block" style={{ color: "#3fb950", background: "rgba(63,185,80,.08)" }}>{h.rendeu}</span>}
                <span className="pill flex-none" style={{ color: ec, borderColor: `${ec}40`, background: `${ec}14` }}>{segurada ? "Segurada" : h.estado}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
      <div className="space-y-4 min-w-0">
      {veioDoDiario && (
        <div className="card p-4 flex items-start gap-3" style={{ borderColor: "#58aae440", background: "linear-gradient(160deg, rgba(88,170,228,.07), var(--surface))" }}>
          <ScrollText size={17} style={{ color: "#58aae4" }} className="flex-none mt-0.5" />
          <p className="text-[12.5px] text-[var(--txt-2)]"><b className="text-[var(--txt)]">Caso trazido do Diário.</b> Complete o <b className="text-[var(--txt)]">“Deveria:”</b> no campo abaixo com o que o agente deveria ter feito.</p>
        </div>
      )}

      {/* ── PASSO 1 · fala ou escreve, do seu jeito (canvas Porta Única) ── */}
      <div className="flex gap-3.5">
        <StepBadge n={1} cor="#3b82f6" ativo={envio.fase === "idle" || envio.fase === "clarificar"} />
        <div className="card p-5 flex-1 min-w-0" style={{ borderColor: "rgba(59,130,246,.3)", background: "linear-gradient(150deg, rgba(59,130,246,.06), var(--surface))" }}>
          <div className="font-display font-bold text-[16px] tracking-tight mb-3">Fale ou escreva <span className="grad-text">o pedido</span></div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setGravando((g) => !g)}
              title={gravando ? "Parar a gravação" : "Falar em vez de digitar"}
              className="grid place-items-center rounded-full flex-none transition-transform hover:scale-105"
              style={{ width: 54, height: 54, background: gravando ? "#f85149" : "var(--grad)", boxShadow: gravando ? "0 0 0 5px rgba(248,81,73,.18)" : "0 12px 26px -14px rgba(59,130,246,.7)" }}
            >
              <Mic size={22} style={{ color: "#08090d" }} />
            </button>
            <div className="melhorar-campo flex items-end gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-2 transition-colors flex-1 min-w-0" style={gravando ? { borderColor: "#f8514960" } : undefined}>
              <textarea
                rows={2}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                placeholder={gravando ? "Gravando o áudio" : `ó, quando perguntarem de parcelamento fala que é 12x no cartão…`}
                className="flex-1 bg-transparent resize-none px-2 py-1.5 text-[13.5px] outline-none placeholder:text-[var(--txt-4)]"
              />
            </div>
            <button onClick={() => enviar()} disabled={!texto.trim() || envio.fase === "registrando" || envio.fase === "ensaiando"} className="btn btn-primary !px-5 flex-none" style={{ height: 46 }}>
              Enviar
            </button>
          </div>
          {gravando ? (
            <div className="text-[11px] mt-2.5 flex items-center gap-1.5" style={{ color: "#f85149" }}>
              <span className="live-dot" style={{ width: 6, height: 6, background: "#f85149" }} /> Gravando. Fale e toque no microfone para terminar.
            </div>
          ) : (
            <div className="text-[10.5px] text-[var(--txt-4)] mt-2.5">Qualquer redação serve. O núcleo continua blindado.</div>
          )}

        </div>
      </div>

      {/* ── PASSO 2 · ela confirma o que entendeu — nada muda no escuro ── */}
      <div className="flex gap-3.5">
        <StepBadge n={2} cor="#58aae4" ativo={envio.fase === "confirmar" || envio.fase === "clarificar"} />
        {envio.fase === "confirmar" ? (
          <div className="card p-5 flex-1 min-w-0" style={{ borderColor: "#58aae440" }}>
            <div className="text-[12px] font-semibold mb-2" style={{ color: "#58aae4" }}>O que foi entendido e para onde vai</div>
            <p className="text-[14px] leading-relaxed m-0">Você quer que o agente {envio.destino === "fato" ? "guarde o fato" : envio.destino === "doc" ? "guarde o documento" : "passe a fazer"}: <b className="text-[var(--txt)]">“{envio.pedido}”</b></p>
            <div className="flex gap-1.5 mt-3.5 flex-wrap">
              {(["fato", "regra", "doc"] as Destino[]).map((d) => {
                const m = DESTINO_META[d];
                const sel = (envio.destino ?? "regra") === d;
                return (
                  <button key={d} onClick={() => setEnvio((s) => ({ ...s, destino: d }))} className="text-[11px] rounded-lg px-2.5 py-1.5 transition-colors" style={sel ? { background: `${m.cor}1f`, border: `1px solid ${m.cor}66`, color: m.cor, fontWeight: 700 } : { border: "1px solid var(--line)", color: "var(--txt-3)" }}>
                    {m.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[10.5px] text-[var(--txt-4)] mt-2 m-0">{DESTINO_META[envio.destino ?? "regra"].desc}</p>
            <div className="flex items-center gap-2.5 mt-4 flex-wrap">
              <button className="btn btn-primary" onClick={() => void rodarEnsaio()}>{envio.destino === "doc" ? "Guardar" : "Rodar o ensaio"}</button>
              <button className="btn" onClick={() => setEnvio({ fase: "idle" })}>Reescrever o pedido</button>
              <span className="inline-flex items-center gap-1.5 text-[10.5px] text-[var(--txt-4)] ml-auto"><Lock size={11} /> O núcleo continua blindado.</span>
            </div>
          </div>
        ) : envio.fase === "clarificar" ? (
          <div className="card p-5 flex-1 min-w-0" style={{ borderColor: "#58aae440", background: "rgba(88,170,228,.05)" }}>
            <div className="flex items-center gap-2 mb-1.5">
              <MessageCircle size={15} style={{ color: "#58aae4" }} />
              <span className="text-[13px] font-medium text-[var(--txt)]">O pedido precisa de mais detalhe</span>
            </div>
            <p className="text-[12.5px] text-[var(--txt-2)] leading-relaxed m-0">
              Diga o que o agente
              <b className="text-[var(--txt)]"> passa a fazer</b> e <b className="text-[var(--txt)]">em que momento</b>.
              Exemplo: <i>“quando perguntarem prazo, responder que dá pra pedir em até 30 dias”</i>.
            </p>
          </div>
        ) : (
          <div className="card p-4 flex-1 min-w-0" style={{ opacity: 0.45 }}>
            <div className="text-[12.5px] text-[var(--txt-3)]">Confirmação do que foi entendido</div>
          </div>
        )}
      </div>

      {/* ── PASSO 3 · a prova (ensaio) e o publicar ── */}
      <div className="flex gap-3.5">
        <StepBadge n={3} cor="#3fb950" ativo={envio.fase === "registrando" || envio.fase === "ensaiando" || envio.fase === "pronto" || envio.fase === "publicando" || envio.fase === "publicado" || envio.fase === "guardado" || envio.fase === "erro"} />
        <div className="flex-1 min-w-0 space-y-4">
          {envio.fase === "registrando" && (
            <div className="card p-5 flex items-center gap-2.5 text-[12.5px] text-[var(--txt-2)]">
              <Loader2 size={15} className="animate-spin" style={{ color: "#3b82f6" }} /> Registrando o pedido
            </div>
          )}
          {envio.fase === "ensaiando" && <EnsaioProgresso />}
          {envio.fase === "erro" && (
            <div className="card p-4 text-[12.5px]" style={{ borderColor: "#f8514940", background: "rgba(248,81,73,.06)", color: "#f85149" }}>{envio.erro}</div>
          )}
          {envio.fase === "guardado" && (
            <div className="card p-5" style={{ borderColor: "rgba(88,170,228,.4)", background: "linear-gradient(160deg, rgba(88,170,228,.06), var(--surface))" }}>
              <div className="flex items-center gap-2.5 text-[14px] font-medium"><BookOpen size={17} style={{ color: "#58aae4" }} /> Guardado na Biblioteca.</div>
              <p className="text-[12px] text-[var(--txt-3)] mt-1.5 leading-relaxed">O conteúdo está no histórico. A busca inteligente em documentos entra numa próxima atualização.</p>
              <button onClick={() => setEnvio({ fase: "idle" })} className="btn btn-sm mt-3">Fechar</button>
            </div>
          )}
          {!(envio.fase === "registrando" || envio.fase === "ensaiando" || envio.fase === "pronto" || envio.fase === "publicando" || envio.fase === "publicado" || envio.fase === "guardado" || envio.fase === "erro") && (
            <div className="card p-4" style={{ opacity: 0.45 }}>
              <div className="text-[12.5px] text-[var(--txt-3)]">Prova do ensaio e publicação</div>
            </div>
          )}

      {/* ── ENSAIO: a simulação claríssima — antes vs agora + guardião ── */}
      {envio.fase === "pronto" && envio.evals && (
        <Reveal>
          <div className="card p-5 md:p-6" style={{ borderColor: "#3b82f62e" }}>
            <div className="flex items-center gap-2 mb-1">
              <FlaskConical size={17} style={{ color: "#3b82f6" }} />
              <span className="font-display font-semibold text-[16px]">Ensaio da mudança</span>
            </div>
            <p className="text-[13.5px] text-[var(--txt-2)] mb-4">Você pediu: <b className="text-[var(--txt)]">“{envio.pedido}”</b></p>

            {envio.ensaio?.modo === "real" ? (
              <>
                {/* GUARDIÃO — testou o SEU pedido de verdade (cérebro ligado) */}
                <div className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3" style={{
                  border: `1px solid ${envio.evals.aprovado ? "#3fb95038" : "#f8514938"}`,
                  background: envio.evals.aprovado ? "rgba(63,185,80,.07)" : "rgba(248,81,73,.07)",
                }}>
                  <ShieldCheck size={20} style={{ color: envio.evals.aprovado ? "#3fb950" : "#f85149" }} className="flex-none" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium text-[var(--txt)]">
                      {envio.evals.aprovado
                        ? "O guardião testou e a mudança não quebrou nenhuma trava do núcleo."
                        : "O guardião segurou a mudança porque ela esbarra numa trava do núcleo."}
                    </div>
                    <div className="text-[11.5px] text-[var(--txt-3)] mt-0.5">
                      {envio.evals.passaram}/{envio.evals.total} testes de segurança passaram · Nota {(envio.evals.taxa * 10).toFixed(1).replace(".", ",")}
                    </div>
                  </div>
                </div>

                {/* ANTES vs AGORA — a IA respondendo, lado a lado */}
                <div className="mono-label mb-3">Antes e agora</div>
                <div className="space-y-4">
                  {envio.ensaio.situacoes.map((s, i) => (
                    <div key={i} className="rounded-xl border border-[var(--line)] overflow-hidden">
                      <div className="px-4 py-2.5 bg-[var(--surface-2)] text-[12.5px] text-[var(--txt-2)] flex items-center gap-2 flex-wrap">
                        <span><span className="text-[var(--txt-4)]">Situação:</span> {s.pergunta}</span>
                        {s.nome === "do seu pedido" && (
                          <span className="text-[9px] font-bold rounded-[6px] px-2 py-0.5 flex-none" style={{ color: "#60a5fa", background: "rgba(59,130,246,.14)", border: "1px solid rgba(59,130,246,.4)" }}>Do seu pedido</span>
                        )}
                      </div>
                      <div className="grid md:grid-cols-2">
                        <div className="p-4 border-t md:border-t-0 md:border-r border-[var(--line)]">
                          <div className="mono-label !text-[9px] mb-1.5 !text-[var(--txt-4)]">Antes</div>
                          <p className="text-[13px] text-[var(--txt-3)] leading-relaxed">{s.antes}</p>
                        </div>
                        <div className="p-4 border-t border-[var(--line)]" style={{ background: "rgba(63,185,80,.05)" }}>
                          <div className="mono-label !text-[9px] mb-1.5" style={{ color: "#3fb950" }}>Agora</div>
                          <p className="text-[13px] text-[var(--txt)] leading-relaxed">{s.agora}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-4 border-t border-[var(--line)]">
                  <div className="text-[14px] font-medium text-[var(--txt)] mb-3">Publicar esta mudança?</div>
                  <div className="flex flex-wrap gap-2.5">
                    <button onClick={() => void publicar()} disabled={!envio.evals.aprovado} className="btn btn-primary" style={{ opacity: envio.evals.aprovado ? 1 : 0.5 }}>
                      <Rocket size={15} /> Publicar
                    </button>
                    <button onClick={ajustar} className="btn"><Wand2 size={15} /> Ajustar o pedido</button>
                  </div>
                  {!envio.evals.aprovado && (
                    <p className="text-[11.5px] text-[var(--txt-4)] mt-2">O guardião segurou esta mudança. Ajuste o pedido e rode o ensaio de novo.</p>
                  )}
                </div>
              </>
            ) : (
              /* SEM CÉREBRO — honesto: registrei, mas NÃO testei o seu pedido */
              <>
                <div className="rounded-xl px-4 py-4 mb-4" style={{ border: "1px solid #fbbf2440", background: "rgba(251,191,36,.07)" }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <AlertTriangle size={16} style={{ color: "#fbbf24" }} />
                    <span className="text-[13.5px] font-medium text-[var(--txt)]">Pedido registrado. Ainda não há como provar que ele funciona.</span>
                  </div>
                  <p className="text-[12.5px] text-[var(--txt-2)] leading-relaxed">
                    O ensaio completo exige que a Metrik <b className="text-[var(--txt)]">ligue o cérebro</b> (chave da OpenAI) neste ambiente. Até lá, o pedido fica no histórico.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[11.5px] text-[var(--txt-4)] mb-5">
                  <ShieldCheck size={13} style={{ color: "#3fb950" }} /> O pedido não esbarra nas travas do núcleo. Conferir o resultado exige o cérebro ligado.
                </div>
                <div className="pt-4 border-t border-[var(--line)]">
                  <div className="text-[14px] font-medium text-[var(--txt)] mb-3">Próximo passo</div>
                  <div className="flex flex-wrap gap-2.5">
                    <button onClick={ajustar} className="btn btn-primary"><Wand2 size={15} /> Reescrever o pedido</button>
                    <button onClick={ajustar} className="btn"><Check size={15} /> Deixar registrado para a Metrik</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </Reveal>
      )}

      {(envio.fase === "publicando" || envio.fase === "publicado") && (
        <Reveal>
          <div className="card p-5 flex items-center gap-3" style={{ borderColor: envio.fase === "publicado" ? "#3fb95040" : "var(--line)", background: envio.fase === "publicado" ? "rgba(63,185,80,.06)" : undefined }}>
            {envio.fase === "publicando" ? (
              <><Loader2 size={18} className="animate-spin" style={{ color: "#3b82f6" }} /> <span className="text-[13.5px] text-[var(--txt-2)]">Publicando a nova versão</span></>
            ) : (
              <>
                <div className="grid place-items-center rounded-full flex-none" style={{ width: 34, height: 34, background: "rgba(63,185,80,.14)", border: "1px solid rgba(63,185,80,.34)" }}><Check size={17} style={{ color: "#3fb950" }} /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium text-[var(--txt)]">Mudança publicada.</div>
                  <div className="text-[12px] text-[var(--txt-3)] mt-0.5">A nova versão já está valendo.</div>
                  <div className="flex gap-2 mt-2.5 flex-wrap">
                    <button className="btn btn-primary btn-sm" onClick={() => irTestar(envio.pedido)}><MessageCircle size={13} /> Testar agora</button>
                    <button className="btn btn-sm" onClick={irComoFunciona}>Ver no Como funciona</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </Reveal>
      )}
        </div>
      </div>

      </div>

      {/* rail (canvas): a pendência que puxa o cliente a ensinar + o histórico único */}
      <div className="space-y-4">
        {pendencia && (
          <div className="card p-4" style={{ borderColor: "rgba(251,191,36,.35)", background: "linear-gradient(160deg, rgba(251,191,36,.07), var(--surface))" }}>
            <div className="mono-label !text-[9px] mb-2.5" style={{ color: "#fbbf24" }}>Pergunta sem resposta · 1</div>
            <div className="rounded-[9px] p-3 mb-3" style={{ background: "var(--surface-2)", border: "1px solid rgba(251,191,36,.3)" }}>
              <div className="text-[12.5px] leading-snug">“{pendencia}”</div>
              <div className="text-[10.5px] text-[var(--txt-4)] mt-1">Ontem, 19:40 · Carlos Mendes · O agente pediu tempo para confirmar</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setTexto(`Quando perguntarem “${pendencia}”, responde: `)}>
              <Mic size={13} /> Responder
            </button>
            <p className="text-[10.5px] mt-2.5 leading-relaxed" style={{ color: "#f2cf86" }}>Responda uma vez e o agente passa a usar a resposta.</p>
          </div>
        )}

        <div className="card p-4">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="mono-label !text-[9px]">Mudanças</div>
            <span className="text-[10px] text-[var(--txt-4)]">{nAr} no ar{emPreparo > 0 ? ` · ${emPreparo} em preparo` : ""}{nSeg > 0 ? ` · ${nSeg} seguradas` : ""}</span>
          </div>
          {linhas.length === 0 && <p className="text-[11.5px] text-[var(--txt-3)]">Nenhuma mudança pedida. A primeira aparece aqui.</p>}
          {linhas.slice(0, 3).map((h, i) => {
            const segurada = h.estado === "Segurada" || h.estado === "Rejeitado";
            const ec = h.estado === "No ar" ? "#3fb950" : segurada ? "#f85149" : "#fbbf24";
            return (
              <div key={i} className="flex items-center gap-2 py-1.5 border-b border-[var(--line)] last:border-0 text-[11.5px]">
                <span className="flex-1 min-w-0 truncate text-[var(--txt-2)]">{h.oque}</span>
                <span className="text-[9.5px] font-semibold flex-none" style={{ color: ec }}>{segurada ? "Segurada" : h.estado}</span>
              </div>
            );
          })}
          <button onClick={() => setVerHist(true)} className="text-[11.5px] font-semibold mt-2.5" style={{ color: "var(--violet-2)" }}>Ver a linha do tempo</button>
        </div>
      </div>
    </div>
  );
}
