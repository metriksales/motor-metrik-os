// ESTÚDIO DA IA — a refundação aprovada no canvas: o agente SDR em PARTES,
// com o padrão fixo em 3 zonas (❯ composer → VALENDO AGORA → MUDANÇAS) e a
// bancada NA PRÁTICA sempre à direita. Mudança = DIFF (− antes / + agora),
// progresso = log de terminal. Tudo lido do MOTOR (spec, ledger, evals,
// chat-sandbox) — zero vitrine vestida em agente real.
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, Check, Clock, FileText, FlaskConical, Loader2, Lock, Mic, Radio, ScrollText, ShieldCheck, Sparkles, X } from "lucide-react";
import { type Agent, type Upgrade } from "../data";
import { Robot } from "../Robot";
import { api } from "../lib/api";
import { useMotorAuth } from "../lib/auth";
import { useLive, tempoRelativo } from "../lib/live";

/* ── o DESTINO da informação: 🧾 fato · ⚙️ regra · 📚 doc (canvas Cérebro) ── */
export type Destino = "fato" | "regra" | "doc";
export const DESTINO_META: Record<Destino, { rotulo: string; cor: string; desc: string }> = {
  fato: { rotulo: "Lista · fato exato", cor: "#3fb950", desc: "ela passa a responder sempre igual — entra depois do ensaio rápido." },
  regra: { rotulo: "Motor · comportamento", cor: "#e8b04b", desc: "muda o jeito dela agir — o guardião testa antes de valer." },
  doc: { rotulo: "Biblioteca · documento", cor: "#58aae4", desc: "conteúdo longo — fica guardado; a busca inteligente é a próxima fatia da Metrik." },
};
export function destinoDe(t: string): Destino {
  if (/\.pdf|\.docx?|documento|p[áa]gina|em anexo|cont[eú]do longo/i.test(t)) return "doc";
  if (/r\$|\d+ ?(reais|%)|custa|pre[çc]o|hor[áa]rio|\b\d{1,2}h\b|link|site|endere[çc]o|telefone|pix|parcel|prazo de/i.test(t)) return "fato";
  return "regra";
}
export function pedidoVago(t: string): boolean {
  const palavras = t.split(/\s+/).filter(Boolean);
  return t.length < 18 || palavras.length < 4;
}

/* ── LIGAR MÓDULO em 1 minuto (modal do canvas): escolhas prontas + Ativar.
   Real → propor(hub_visual)+ensaio (cérebro+guardião ✓ publica; sem cérebro
   registra honesto). Demo avisa que é demo. ── */
export function LigarModulo({ agent, u, onClose }: { agent: Agent; u: Upgrade; onClose: () => void }) {
  const auth = useMotorAuth();
  const [escolhas, setEscolhas] = useState<Record<number, string>>(() => Object.fromEntries((u.config ?? []).map((c, i) => [i, c.opcoes[0]])));
  const [fase, setFase] = useState<"idle" | "rodando" | "ok" | "registrado" | "segurada" | "demo" | "erro">("idle");
  const [erro, setErro] = useState<string | null>(null);

  const ativar = async () => {
    const resumo = (u.config ?? []).map((c, i) => `${c.pergunta} ${escolhas[i]}`).join(" · ");
    const intent = `Ligar o módulo "${u.name}"${resumo ? ` — ${resumo}` : ""}`;
    if (!agent.real) return setFase("demo");
    try {
      setFase("rodando");
      const cs: any = await api.propor({ agentId: agent.id, origin: "hub_visual", intent, patch: { modulo: u.name, escolhas } }, auth.getToken);
      const r: any = await api.avaliar(cs.id, auth.getToken);
      if (r?.ensaio?.modo === "real" && r?.evals?.aprovado) {
        await api.publicarMudanca(cs.id, auth.getToken);
        setFase("ok");
      } else if (r?.evals && r.evals.aprovado === false) setFase("segurada");
      else setFase("registrado");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "não consegui registrar");
      setFase("erro");
    }
  };

  return (
    <div className="est fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "rgba(4,5,8,.66)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-xl p-6" style={{ background: "var(--e-surface)", border: "1px solid rgba(232,176,75,.4)", boxShadow: "0 30px 70px -30px rgba(0,0,0,.85)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <div className="emo text-[10px]" style={{ color: "var(--e-amber)", letterSpacing: ".1em" }}>LIGAR · {u.name.toUpperCase()}</div>
            <div className="text-[16px] font-semibold tracking-tight mt-1">{(u.config?.length ?? 0) > 0 ? `${u.config!.length} ${u.config!.length === 1 ? "escolha" : "escolhas"} — já vem pronto` : "Já vem pronto"}</div>
          </div>
          <button onClick={onClose} className="est-ghost !p-1.5"><X size={15} /></button>
        </div>

        {fase === "idle" || fase === "rodando" || fase === "erro" ? (
          <>
            <div className="space-y-3 mt-4">
              {(u.config ?? []).map((c, i) => (
                <div key={i}>
                  <div className="text-[11px] mb-1.5" style={{ color: "var(--e-dim)" }}>{c.pergunta}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.opcoes.map((o) => {
                      const sel = escolhas[i] === o;
                      return (
                        <button key={o} onClick={() => setEscolhas((s) => ({ ...s, [i]: o }))} className="text-[11.5px] rounded-lg px-3 py-1.5" style={sel ? { background: "var(--e-amber)", color: "#08090d", fontWeight: 600 } : { border: "1px solid var(--e-line)", color: "var(--e-mut)" }}>
                          {o}{sel ? " ✓" : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-lg px-3.5 py-3 mt-4" style={{ background: "rgba(232,176,75,.07)", border: "1px solid rgba(232,176,75,.3)" }}>
              <p className="text-[12.5px] leading-relaxed m-0">{u.resultado ?? u.blurb}</p>
            </div>
            {fase === "erro" && <div className="text-[11.5px] mt-3" style={{ color: "var(--e-red)" }}>{erro}</div>}
            <div className="flex items-center gap-2.5 mt-4">
              <button onClick={() => void ativar()} disabled={fase === "rodando"} className="est-btn">{fase === "rodando" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Ativar</button>
              <button onClick={onClose} className="est-ghost">depois</button>
            </div>
            <p className="text-[10px] mt-3 m-0" style={{ color: "var(--e-dim)" }}>o ensaio roda antes de valer — se quebrar uma trava, não liga.</p>
          </>
        ) : (
          <div className="mt-4">
            <div className="flex items-center gap-2.5 text-[14px] font-medium" style={{ color: fase === "ok" ? "var(--e-green)" : fase === "segurada" ? "var(--e-red)" : "var(--e-amber)" }}>
              {fase === "ok" ? <Check size={16} /> : fase === "segurada" ? <ShieldCheck size={16} /> : fase === "demo" ? <Sparkles size={16} /> : <Clock size={16} />}
              {fase === "ok" ? "Ligado — no ar." : fase === "segurada" ? "O guardião segurou." : fase === "demo" ? "Modo demonstração." : "Registrado pra Metrik."}
            </div>
            <p className="text-[12px] mt-1.5" style={{ color: "var(--e-dim)" }}>
              {fase === "ok" ? "Passou no guardião e já está valendo — está no log de mudanças." : fase === "segurada" ? "Essa configuração encostaria numa trava do núcleo — por isso não ligou." : fase === "demo" ? "No agente real, isto registra a mudança, roda o ensaio e só liga com o guardião ✓." : "Sem o cérebro ligado não dá pra provar sozinho — a Metrik ativa com o ensaio de verdade."}
            </p>
            <button onClick={onClose} className="est-btn mt-4">Beleza</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════ O ESTÚDIO ═══════════════════════════ */
type Secao = "conversa" | "testes";
type MsgT = { de: "voce" | "ia"; texto: string; fonte?: string | null; aviso?: boolean };
type EnvioE = {
  fase: "idle" | "clarificar" | "confirmar" | "rodando" | "pronto" | "publicando" | "publicado" | "guardado" | "erro";
  pedido?: string;
  destino?: Destino;
  cs?: any;
  evals?: any;
  ensaio?: { modo: "real" | "sem-cerebro"; situacoes: { nome: string; pergunta: string; antes: string; agora: string }[] };
  erro?: string;
};
const DEMO_PRATICA: { re: RegExp; resp: string; fonte: string }[] = [
  { re: /academy|comprar|checkout/i, resp: "A Academy é R$ 197 — te mando o checkout: vega.com/academy. Qualquer dúvida na compra eu te ajudo por aqui!", fonte: "usou: a rota que você mudou" },
  { re: /start|pre[cç]o|quanto|custa|valor/i, resp: "O Start sai por R$ 497! Quer que eu te mostre o que vem nele?", fonte: "usou: Lista · Preços" },
  { re: /desconto|vista/i, resp: "Consigo até 10% à vista — e o retorno paga o resto. Monto a conta pro seu caso?", fonte: "segurou no teto de 10% — trava valendo" },
];

export default function Estudio({ agent, estado, onBack, onToggle, onAoVivo, seed }: {
  agent: Agent;
  estado: "ativo" | "idle" | "pausado";
  onBack: () => void;
  onToggle: () => void;
  onAoVivo: () => void;
  seed?: { tipo: "pedido" | "pergunta"; texto: string; n: number } | null;
}) {
  const auth = useMotorAuth();
  const { logs, stats } = useLive();
  // painel lateral: nada aberto por padrão — o cliente abre pelo botãozinho
  const [painel, setPainel] = useState<"como" | "testar" | "logs" | null>(null);
  const [modal, setModal] = useState<Upgrade | null>(null);

  // ── o motor: spec rodando + ledger ──
  const [rod, setRod] = useState<any | null>(null);
  const [cs, setCs] = useState<any[]>([]);
  const [tick, setTick] = useState(0); // recarrega motor+ledger após publicar
  useEffect(() => {
    let vivo = true;
    if (agent.real) {
      (api.rodando(agent.id, auth.getToken) as Promise<any>).then((r) => vivo && setRod(r)).catch(() => {});
      (api.listChangeSets(agent.id, auth.getToken) as Promise<any[]>).then((rows) => vivo && Array.isArray(rows) && setCs(rows)).catch(() => {});
    }
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id, tick]);

  const c = rod?.spec?.cerebro ?? null;
  const regras: string[] = Array.isArray(c?.regras) ? c.regras : [];
  const fatos = regras.filter((r) => /^fato:/i.test(r));
  const suasIntents = new Set(cs.filter((r) => String(r.status) === "published").map((r) => String(r.intent ?? "").trim().toLowerCase()));
  const emRev = cs.find((r) => ["draft", "evaluated", "approved"].includes(String(r.status)));
  const publicadas = cs.filter((r) => String(r.status) === "published");
  const seguradas = cs.filter((r) => ["rejected"].includes(String(r.status)));
  const execsHoje = agent.real ? (stats?.porAgente?.[agent.id]?.execucoes ?? 0) : agent.metrics.execucoes;
  const naFila = agent.work?.kind === "followups" ? (agent.work.followups?.filter((f) => f.status !== "feito").length ?? 0) : null;

  // ── composer (a porta única) ──
  const [texto, setTexto] = useState("");
  const [envio, setEnvio] = useState<EnvioE>({ fase: "idle" });
  const mandar = () => {
    const t = texto.trim();
    if (!t || envio.fase === "rodando") return;
    if (pedidoVago(t)) return setEnvio({ fase: "clarificar", pedido: t });
    setEnvio({ fase: "confirmar", pedido: t, destino: destinoDe(t) });
  };
  const rodarEnsaio = async () => {
    const bruto = envio.pedido ?? "";
    const destino: Destino = envio.destino ?? "regra";
    if (!agent.real) return setEnvio({ fase: "erro", pedido: bruto, destino, erro: "modo demo — no agente real o pedido entra no ledger, passa no guardião e o diff aparece aqui." });
    if (destino === "doc") {
      try {
        setEnvio({ fase: "rodando", pedido: bruto, destino });
        await api.propor({ agentId: agent.id, origin: "hub_chat", intent: bruto, patch: { pedido: bruto, tipo: "doc" } }, auth.getToken);
        setEnvio({ fase: "guardado", pedido: bruto, destino });
        setTexto(""); setTick((x) => x + 1);
      } catch (e) { setEnvio({ fase: "erro", erro: e instanceof Error ? e.message : "erro ao registrar" }); }
      return;
    }
    const t = destino === "fato" && !/^fato:/i.test(bruto) ? `Fato: ${bruto}` : bruto;
    try {
      setEnvio({ fase: "rodando", pedido: bruto, destino });
      const novo: any = await api.propor({ agentId: agent.id, origin: "hub_chat", intent: t, patch: { pedido: t, tipo: destino } }, auth.getToken);
      const r: any = await api.avaliar(novo.id, auth.getToken);
      setEnvio({ fase: "pronto", cs: novo, evals: r.evals, ensaio: r.ensaio, pedido: bruto, destino });
      setTexto(""); setTick((x) => x + 1);
    } catch (e) { setEnvio({ fase: "erro", erro: e instanceof Error ? e.message : "erro ao registrar" }); }
  };
  const publicar = async () => {
    try {
      setEnvio((s) => ({ ...s, fase: "publicando" }));
      await api.publicarMudanca(envio.cs.id, auth.getToken);
      setEnvio((s) => ({ ...s, fase: "publicado" }));
      setTick((x) => x + 1);
    } catch (e) { setEnvio({ fase: "erro", erro: e instanceof Error ? e.message : "erro ao publicar" }); }
  };

  // ── NA PRÁTICA (chat sandbox real) ──
  const [msgs, setMsgs] = useState<MsgT[]>([]);
  const [input, setInput] = useState("");
  const [pensando, setPensando] = useState(false);
  const [feedback, setFeedback] = useState<Record<number, "sim" | "nao">>({});
  const [modoTeste, setModoTeste] = useState<"ar" | "ensaio">("ar");
  const fimRef = useRef<HTMLDivElement>(null);
  useEffect(() => { fimRef.current?.scrollIntoView({ block: "end" }); }, [msgs]);
  useEffect(() => {
    if (!seed) return;
    if (seed.tipo === "pergunta") { setInput(seed.texto); setPainel("testar"); }
    else setTexto(seed.texto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.n]);

  const perguntar = async (direto?: string) => {
    const t = (direto ?? input).trim();
    if (!t || pensando) return;
    const novo: MsgT[] = [...msgs, { de: "voce", texto: t }];
    setMsgs(novo); setInput("");
    if (!agent.real) {
      const d = DEMO_PRATICA.find((x) => x.re.test(t));
      return setMsgs([...novo, d ? { de: "ia", texto: d.resp, fonte: d.fonte } : { de: "ia", texto: "Na sua conta, quem responde aqui é o cérebro do ar — isto é a demonstração.", aviso: true }]);
    }
    try {
      setPensando(true);
      const historico = novo.filter((m) => !m.aviso).map((m) => ({ role: m.de === "voce" ? ("user" as const) : ("assistant" as const), content: m.texto }));
      const r: any = await api.testar(agent.id, historico, modoTeste, auth.getToken);
      if (r?.modo === "sem-cerebro") setMsgs([...novo, { de: "ia", texto: "O teste usa o cérebro (chave OpenAI) e ele não está ligado neste ambiente — a Metrik liga e esta conversa vira a IA real.", aviso: true }]);
      else setMsgs([...novo, { de: "ia", texto: String(r?.texto ?? "…"), fonte: r?.fonte ? `usou: ${r.fonte}` : r?.base === "semente" ? "cérebro-semente da vertical" : null }]);
    } catch (e) {
      setMsgs([...novo, { de: "ia", texto: e instanceof Error ? e.message : "o teste falhou — tenta de novo", aviso: true }]);
    } finally { setPensando(false); }
  };
  const corrigir = (i: number) => {
    setFeedback((s) => ({ ...s, [i]: "nao" }));
    const pergunta = [...msgs.slice(0, i)].reverse().find((m) => m.de === "voce")?.texto ?? "";
    setTexto(`No teste, perguntei: "${pergunta}" e ela respondeu: "${msgs[i].texto}" — não é isso. Deveria: `);
  };

  // ── TESTES (rodada real) ──
  const [run, setRun] = useState<{ status: "idle" | "rodando" | "pronto"; r?: any; erro?: string }>({ status: "idle" });
  const rodarTestes = async () => {
    if (!agent.real) return setRun({ status: "pronto", r: { modo: "demo" } });
    try {
      setRun({ status: "rodando" });
      const r: any = await api.rodarTestes(agent.id, auth.getToken);
      setRun({ status: "pronto", r });
    } catch (e) { setRun({ status: "idle", erro: e instanceof Error ? e.message : "a rodada falhou" }); }
  };

  const sugestoes = agent.real ? ["quanto custa?", "que horas vocês atendem?", "quero falar com uma pessoa"] : ["quero comprar a academy", "quanto custa o start?", "tem desconto à vista?"];
  const nSim = Object.values(feedback).filter((v) => v === "sim").length;
  const nNao = Object.values(feedback).filter((v) => v === "nao").length;

  // rola o feed pro fim quando o fluxo do pedido avança (a resposta nasce perto da caixinha)
  const feedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (envio.fase === "idle") return; // no mount/reset fica no topo
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [envio.fase]);

  const meusLogs = agent.real ? (logs ?? []).filter((l) => l.agentId === agent.id).slice(0, 30) : [];

  /* ═══ O DESENHO (ordem do mestre, 21/09): em cima o estado + as alterações ·
     no meio o feed · EMBAIXO a caixinha de pedir · na lateral BOTÕEZINHOS que
     abrem painéis: Como funciona (o artefato da feature aberta) · Testar · Logs. */
  return (
    <div className="est flex-1 min-h-0 flex flex-col">
      {/* ── topo ── */}
      <div className="flex items-center gap-3 px-5 flex-none" style={{ height: 52, borderBottom: "1px solid var(--e-line)" }}>
        <button onClick={onBack} title="voltar pra frota" className="flex items-center gap-1 -ml-1 px-1 py-1" style={{ color: "var(--e-mut)" }}><ArrowLeft size={15} /></button>
        <div className="rounded-lg p-0.5" style={{ border: "1px solid rgba(232,176,75,.5)", background: "#0e1116" }}><Robot state={estado} color={agent.color} size={26} /></div>
        <span className="text-[13px] font-semibold">{agent.name}</span>
        <span className="emo text-[10.5px]" style={{ color: "var(--e-dim)" }}>/</span>
        <span className="emo text-[10.5px]" style={{ color: "var(--e-mut)" }}>Conversa</span>
        <span className="emo text-[10.5px]" style={{ color: "var(--e-mut)" }}>{agent.tipo === "acao" ? "ação" : "sdr"}{rod ? ` · v${rod.versao}` : ""} · {estado === "pausado" ? "pausado" : "no ar"}</span>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: estado === "pausado" ? "#7d8694" : "var(--e-green)" }} />
        <div className="ml-auto flex items-center gap-4">
          <button onClick={onAoVivo} className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--e-mut)" }}><Radio size={13} /> Ao vivo</button>
          <button onClick={onToggle} title={estado === "pausado" ? "ligar" : "pausar"} className="relative" style={{ width: 34, height: 19, borderRadius: 99, background: estado === "pausado" ? "#2a3138" : "var(--e-green)" }}>
            <span style={{ position: "absolute", top: 2, ...(estado === "pausado" ? { left: 2 } : { right: 2 }), width: 15, height: 15, borderRadius: 99, background: "#08090d" }} />
          </button>
        </div>
      </div>

      {/* ── PARTE DE CIMA: como está no momento + o que está em andamento ── */}
      <div className="flex items-center gap-5 px-6 flex-wrap flex-none" style={{ minHeight: 38, borderBottom: "1px solid var(--e-line)", background: "#0a0c10" }}>
        <span className="text-[10px] font-semibold" style={{ letterSpacing: ".1em", color: "var(--e-dim)" }}>AGORA</span>
        {agent.real ? (
          <>
            <span className="emo text-[11px]" style={{ color: "var(--e-txt2)" }}>{rod ? (rod.base === "semente" ? "cérebro-semente da vertical" : `versão ${rod.versao} no ar`) : "lendo o motor…"}</span>
            <span className="emo text-[11px]" style={{ color: "var(--e-green)" }}>{publicadas.length} {publicadas.length === 1 ? "mudança sua" : "mudanças suas"} no ar</span>
            {emRev && <span className="emo text-[11px] truncate max-w-[320px]" style={{ color: "var(--e-amber)" }}>● em revisão: “{emRev.intent}”</span>}
            {seguradas.length > 0 && <span className="emo text-[11px]" style={{ color: "var(--e-mut)" }}>{seguradas.length} seguradas</span>}
            <span className="emo text-[10.5px] ml-auto" style={{ color: "var(--e-dim)" }}>{execsHoje} atendimentos hoje</span>
          </>
        ) : (
          <>
            <span className="emo text-[11px]" style={{ color: "var(--e-green)" }}>+4 leads que iam embora voltaram</span>
            <span className="emo text-[11px]" style={{ color: "var(--e-green)" }}>R$ 1.500 esta semana</span>
            <span className="emo text-[11px]" style={{ color: "var(--e-mut)" }}>nota 8,6 → <b style={{ color: "var(--e-txt)" }}>9,2</b></span>
            <span className="emo text-[10.5px] ml-auto" style={{ color: "var(--e-dim)" }}>demonstração</span>
          </>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* ── rail: as PARTES do agente ── */}
        <div className="w-[200px] flex-none overflow-y-auto scroll-thin" style={{ borderRight: "1px solid var(--e-line)", padding: "14px 0" }}>
          <div className="px-5 pb-2 text-[10px] font-semibold" style={{ letterSpacing: ".1em", color: "var(--e-dim)" }}>MÓDULOS</div>
          <div className="w-full flex items-center gap-2.5 px-5 py-2" style={{ background: "var(--e-surface)", borderRight: "2px solid var(--e-amber)" }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--e-green)" }} />
            <span className="text-[12.5px] flex-1 font-semibold" style={{ color: "var(--e-txt)" }}>Conversa</span>
            <span className="emo text-[10px]" style={{ color: "var(--e-dim)" }}>{execsHoje} hoje</span>
          </div>
          {naFila != null && (
            <div className="flex items-center gap-2.5 px-5 py-2">
              <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--e-green)" }} />
              <span className="text-[12.5px] flex-1" style={{ color: "var(--e-mut)" }}>Follow-up</span>
              <span className="emo text-[10px]" style={{ color: "var(--e-dim)" }}>{naFila} na fila</span>
            </div>
          )}
          {(agent.upgrades?.length ?? 0) > 0 && (
            <>
              <div className="px-5 pt-4 pb-2 text-[10px] font-semibold" style={{ letterSpacing: ".1em", color: "var(--e-dim)" }}>ATIVAR</div>
              {agent.upgrades!.map((u) => (
                <button key={u.name} onClick={() => setModal(u)} className="w-full flex items-center gap-2.5 px-5 py-2 text-left">
                  <span style={{ width: 6, height: 6, borderRadius: 99, border: "1px solid var(--e-dim)" }} />
                  <span className="text-[12.5px] flex-1 truncate" style={{ color: "var(--e-mut)" }}>{u.name}</span>
                  <span className="text-[11px]" style={{ color: "var(--e-amber)" }}>+</span>
                </button>
              ))}
            </>
          )}
        </div>

        {/* ── MEIO: o feed das alterações · a caixinha fica EMBAIXO ── */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div ref={feedRef} className="flex-1 overflow-y-auto scroll-thin" style={{ padding: "18px 24px" }}>
            {/* uma linha só: o que ela é hoje — o detalhe mora no painel Como funciona */}
            <div className="flex items-center gap-2.5 text-[12px]" style={{ color: "var(--e-mut)" }}>
              <span className="truncate">{agent.real ? (c?.identidade ?? "lendo o motor…") : "Bia, consultora comercial da Vega — 3 rotas · 4 regras · 12 fatos"}</span>
              <button onClick={() => setPainel("como")} className="emo text-[10.5px] flex-none" style={{ color: "var(--e-amber)" }}>ver como funciona →</button>
            </div>

            <div className="est-faixa mt-4 mb-2"><b>MUDANÇAS</b><span>{agent.real ? `${publicadas.length} no ar${emRev ? " · 1 em revisão" : ""}${seguradas.length ? ` · ${seguradas.length} seguradas` : ""}` : "demonstração"}</span></div>
            <div className="est-card overflow-hidden">
              {(agent.real ? [...publicadas, ...seguradas].slice(0, 8).reverse() : []).map((r, i, arr) => {
                const seg = String(r.status) === "rejected";
                return (
                  <div key={r.id ?? i} className="flex items-center gap-3 px-3.5 py-2" style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--e-line)" : undefined }}>
                    <span className="emo text-[11px] w-2.5" style={{ color: seg ? "var(--e-red)" : "var(--e-green)" }}>{seg ? "✗" : "✓"}</span>
                    <span className="text-[12px] flex-1 truncate" style={{ color: seg ? "var(--e-mut)" : "var(--e-txt2)" }}>{r.intent}</span>
                    <span className="emo text-[10px] flex-none" style={{ color: seg ? "var(--e-red)" : "var(--e-green)" }}>{seg ? "segurada" : "no ar"}</span>
                    <span className="emo text-[10px] flex-none" style={{ color: "var(--e-dim)" }}>{r.createdAt ? `há ${tempoRelativo(r.createdAt)}` : ""}</span>
                  </div>
                );
              })}
              {agent.real && publicadas.length + seguradas.length === 0 && (
                <div className="px-3.5 py-3 text-[11.5px]" style={{ color: "var(--e-dim)" }}>Pede a primeira mudança na caixinha aí embaixo — ela passa no guardião e aparece aqui com o antes e o depois.</div>
              )}
              {!agent.real && (
                <>
                  <div className="flex items-center gap-3 px-3.5 py-2" style={{ borderBottom: "1px solid var(--e-line)" }}>
                    <span className="emo text-[11px] w-2.5" style={{ color: "var(--e-green)" }}>✓</span>
                    <span className="text-[12px] flex-1">ao negar, oferece outro caminho</span>
                    <span className="emo text-[10px]" style={{ color: "var(--e-green)" }}>+4 leads voltaram</span>
                    <span className="emo text-[10px]" style={{ color: "var(--e-dim)" }}>há 3 dias</span>
                  </div>
                  <div className="flex items-center gap-3 px-3.5 py-2">
                    <span className="emo text-[11px] w-2.5" style={{ color: "var(--e-red)" }}>✗</span>
                    <span className="text-[12px] flex-1" style={{ color: "var(--e-mut)" }}>25% de desconto — segurada: passa do teto</span>
                    <span className="emo text-[10px]" style={{ color: "var(--e-red)" }}>não entrou</span>
                    <span className="emo text-[10px]" style={{ color: "var(--e-dim)" }}>há 4 dias</span>
                  </div>
                </>
              )}
            </div>
            {agent.real && emRev && envio.fase === "idle" && (
              <div className="rounded-[9px] overflow-hidden mt-2" style={{ border: "1px solid #2b2415", background: "var(--e-surface)" }}>
                <div className="est-beam" />
                <div className="flex items-center gap-2.5 px-3.5 py-2">
                  <span className="emo text-[10.5px]" style={{ color: "var(--e-amber)" }}>● em revisão</span>
                  <span className="text-[12px] flex-1 truncate" style={{ color: "var(--e-txt2)" }}>{emRev.intent}</span>
                  <span className="emo text-[10px]" style={{ color: "var(--e-dim)" }}>{emRev.createdAt ? `há ${tempoRelativo(emRev.createdAt)}` : ""}</span>
                </div>
              </div>
            )}

            {/* ── o fluxo do pedido em andamento (nasce perto da caixinha) ── */}
            {envio.fase === "clarificar" && (
              <div className="est-card mt-3 p-3.5" style={{ borderColor: "rgba(88,170,228,.4)" }}>
                <div className="text-[12.5px]" style={{ color: "var(--e-txt2)" }}>
                  Você mandou <b>“{envio.pedido}”</b> — só isso não me diz o que mudar. O que ela <b>passa a fazer</b>, e <b>em que momento</b>?
                </div>
              </div>
            )}
            {envio.fase === "confirmar" && (
              <div className="est-card mt-3 p-4" style={{ borderColor: "rgba(88,170,228,.4)" }}>
                <div className="text-[11px] font-semibold mb-1.5" style={{ color: "#58aae4" }}>Ela confirma — e PRA ONDE vai</div>
                <div className="text-[13px]" style={{ color: "var(--e-txt2)" }}>“{envio.pedido}”</div>
                <div className="flex gap-1.5 mt-2.5 flex-wrap">
                  {(["fato", "regra", "doc"] as Destino[]).map((d) => {
                    const m = DESTINO_META[d];
                    const sel = (envio.destino ?? "regra") === d;
                    return (
                      <button key={d} onClick={() => setEnvio((s) => ({ ...s, destino: d }))} className="text-[10.5px] rounded-md px-2.5 py-1" style={sel ? { background: `${m.cor}1f`, border: `1px solid ${m.cor}66`, color: m.cor, fontWeight: 700 } : { border: "1px solid var(--e-line)", color: "var(--e-dim)" }}>
                        {m.rotulo}{sel ? " ✓" : ""}
                      </button>
                    );
                  })}
                </div>
                <div className="text-[10.5px] mt-1.5" style={{ color: "var(--e-dim)" }}>{DESTINO_META[envio.destino ?? "regra"].desc}</div>
                <div className="flex items-center gap-2.5 mt-3">
                  <button onClick={() => void rodarEnsaio()} className="est-btn">{envio.destino === "doc" ? "É isso — guardar" : "É isso — roda o ensaio"}</button>
                  <button onClick={() => setEnvio({ fase: "idle" })} className="est-ghost">não — escrevo de novo</button>
                  <span className="ml-auto inline-flex items-center gap-1 text-[10px]" style={{ color: "var(--e-dim)" }}><Lock size={10} /> núcleo blindado</span>
                </div>
              </div>
            )}
            {envio.fase === "rodando" && (
              <div className="est-card mt-3 p-3.5 flex items-center gap-2.5 text-[12px]" style={{ color: "var(--e-mut)" }}>
                <span className="est-spin" /> o guardião roda as travas · a IA responde as situações do SEU pedido — ~30s, teste de verdade
              </div>
            )}
            {envio.fase === "erro" && <div className="est-card mt-3 p-3.5 text-[12px]" style={{ borderColor: "rgba(248,81,73,.4)", color: "var(--e-red)" }}>{envio.erro}</div>}
            {envio.fase === "guardado" && (
              <div className="est-card mt-3 p-3.5 text-[12px]" style={{ borderColor: "rgba(88,170,228,.4)", color: "var(--e-txt2)" }}>
                Guardado pra <b>Biblioteca</b> — a busca inteligente é a próxima fatia da Metrik; seu conteúdo está no log.
                <button onClick={() => setEnvio({ fase: "idle" })} className="est-ghost ml-2">ok</button>
              </div>
            )}
            {(envio.fase === "pronto" || envio.fase === "publicando" || envio.fase === "publicado") && envio.evals && (
              <div className="mt-3 rounded-[9px] overflow-hidden" style={{ border: "1px solid #2b2415", background: "var(--e-surface)" }}>
                <div className="est-beam" />
                <div className="flex items-center gap-2.5 px-3.5 py-2" style={{ borderBottom: "1px solid var(--e-line)" }}>
                  <span className="emo text-[10.5px]" style={{ color: "var(--e-amber)" }}>● {envio.fase === "publicado" ? "publicado" : "em revisão"}</span>
                  <span className="emo text-[11px]" style={{ color: "var(--e-txt2)" }}>conversa / {envio.destino}</span>
                  <span className="emo text-[10px] rounded px-1.5" style={{ background: "#171b22" }}><span style={{ color: "var(--e-green)" }}>+1</span></span>
                  <span className="emo text-[10px] ml-auto" style={{ color: "var(--e-dim)" }}>você · agora</span>
                </div>
                {envio.ensaio?.modo === "real" && envio.ensaio.situacoes[0] ? (
                  <>
                    <div className="px-3.5 py-1.5 text-[10.5px]" style={{ color: "var(--e-dim)", borderBottom: "1px solid var(--e-line-soft)" }}>
                      situação: {envio.ensaio.situacoes[0].pergunta}
                      {envio.ensaio.situacoes[0].nome === "do seu pedido" && <span className="emo ml-2" style={{ color: "var(--e-amber)" }}>do SEU pedido</span>}
                    </div>
                    <div className="emo">
                      <div className="est-diff-del"><i>−</i><s>{envio.ensaio.situacoes[0].antes.slice(0, 160)}</s></div>
                      <div className="est-diff-add"><i>+</i><s>{envio.ensaio.situacoes[0].agora.slice(0, 160)}</s></div>
                    </div>
                  </>
                ) : (
                  <div className="emo"><div className="est-diff-add"><i>+</i><s>{envio.pedido}</s></div></div>
                )}
                <div className="flex items-center gap-3 px-3.5 py-2" style={{ borderTop: "1px solid var(--e-line)" }}>
                  <span className="emo text-[10px]" style={{ color: envio.evals.aprovado ? "var(--e-green)" : "var(--e-red)" }}>
                    {envio.evals.aprovado ? "✓" : "✗"} guardião {envio.evals.passaram}/{envio.evals.total}
                  </span>
                  {envio.ensaio?.modo !== "real" && <span className="emo text-[10px]" style={{ color: "var(--e-amber)" }}>sem cérebro — registrado pra Metrik</span>}
                  {envio.fase === "publicado" ? (
                    <button onClick={() => setPainel("testar")} className="emo text-[10px] ml-auto" style={{ color: "var(--e-green)" }}>✓ no ar — testa na prática →</button>
                  ) : (
                    <div className="ml-auto flex items-center gap-2">
                      <button onClick={() => setEnvio({ fase: "idle" })} className="est-ghost">deixar de fora</button>
                      {envio.ensaio?.modo === "real" && (
                        <button onClick={() => void publicar()} disabled={!envio.evals.aprovado || envio.fase === "publicando"} className="est-btn" style={!envio.evals.aprovado ? { opacity: 0.5 } : undefined}>
                          {envio.fase === "publicando" ? <Loader2 size={12} className="animate-spin" /> : null} Publicar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── EMBAIXO: a caixinha ── */}
          <div className="flex-none" style={{ borderTop: "1px solid var(--e-line)", padding: "12px 24px" }}>
            <div className="rounded-xl" style={{ background: "var(--e-surface)", border: "1px solid var(--e-line)", padding: "11px 13px 9px" }}>
              <div className="flex items-start gap-2.5">
                <span className="emo text-[12px] mt-1" style={{ color: "var(--e-amber)" }}>❯</span>
                <textarea
                  rows={1}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); mandar(); } }}
                  placeholder={'pede qualquer mudança — "no follow, só 2 toques" · "ensina que o Start é 497"'}
                  className="flex-1 bg-transparent resize-none outline-none text-[13px] py-0.5"
                  style={{ color: "var(--e-txt)" }}
                />
              </div>
              <div className="flex items-center gap-3 mt-2 pt-2" style={{ borderTop: "1px solid var(--e-line-soft)" }}>
                <Mic size={13} style={{ color: "var(--e-mut)" }} />
                <span className="emo text-[10px]" style={{ color: "var(--e-dim)" }}>segura pra falar</span>
                <button onClick={mandar} disabled={!texto.trim() || envio.fase === "rodando"} className="est-btn ml-auto">Enviar <ArrowUp size={11} /></button>
              </div>
            </div>
          </div>
        </div>

        {/* ── painel lateral (abre pelo botãozinho) ── */}
        {painel && (
          <div className="w-[400px] flex-none flex flex-col min-h-0" style={{ borderLeft: "1px solid var(--e-line)" }}>
            <div className="flex items-center gap-2.5 px-4 flex-none" style={{ height: 42, borderBottom: "1px solid var(--e-line)" }}>
              <span className="text-[10px] font-semibold" style={{ letterSpacing: ".1em", color: "var(--e-amber)" }}>
                {painel === "como" ? "COMO FUNCIONA" : painel === "testar" ? "NA PRÁTICA" : "LOGS"}
              </span>
              <span className="text-[10px]" style={{ color: "var(--e-dim)" }}>
                {painel === "como" ? "a Conversa, hoje · lido do motor" : painel === "testar" ? "você é o lead · fora do CRM" : "o que ela fez, na ordem"}
              </span>
              <button onClick={() => setPainel(null)} className="ml-auto" style={{ color: "var(--e-mut)" }}><X size={14} /></button>
            </div>

            {/* COMO FUNCIONA — o artefato da feature aberta */}
            {painel === "como" && (
              <div className="flex-1 overflow-y-auto scroll-thin p-4">
                <div className="est-faixa mb-2"><b>VALENDO AGORA</b><span>{agent.real ? (rod ? (rod.base === "semente" ? "cérebro-semente da vertical ✓" : `versão ${rod.versao} ✓`) : "lendo o motor…") : "demonstração"}</span></div>
                <div className="est-card overflow-hidden">
                  {agent.real && rod ? (
                    <>
                      <div className="flex gap-3 px-3.5 py-2.5" style={{ borderBottom: "1px solid var(--e-line)" }}>
                        <span className="emo text-[10px] w-[74px] flex-none" style={{ color: "var(--e-dim)" }}>identidade</span>
                        <span className="text-[12.5px] flex-1" style={{ color: "var(--e-txt2)" }}>{c?.identidade ?? "—"}</span>
                      </div>
                      {c?.oferta && (
                        <div className="flex gap-3 px-3.5 py-2.5" style={{ borderBottom: "1px solid var(--e-line)" }}>
                          <span className="emo text-[10px] w-[74px] flex-none" style={{ color: "var(--e-dim)" }}>oferta</span>
                          <span className="text-[12.5px] flex-1" style={{ color: "var(--e-txt2)" }}>{c.oferta}</span>
                        </div>
                      )}
                      <div className="flex gap-3 px-3.5 py-2.5">
                        <span className="emo text-[10px] w-[74px] flex-none" style={{ color: "var(--e-dim)" }}>regras · {regras.length}</span>
                        <div className="flex-1 min-w-0">
                          {regras.map((r, i) => {
                            const fato = /^fato:/i.test(r);
                            const sua = fato || suasIntents.has(r.trim().toLowerCase());
                            const b = fato ? { t: "fato", c: "#3fb950" } : sua ? { t: "sua", c: "#e8b04b" } : { t: "núcleo", c: "#7d8694" };
                            return (
                              <div key={i} className="flex items-start gap-2 py-1" style={{ borderBottom: i < regras.length - 1 ? "1px solid var(--e-line-soft)" : undefined }}>
                                <span className="emo text-[8.5px] rounded px-1.5 mt-0.5 flex-none" style={{ color: b.c, border: `1px solid ${b.c}44`, background: `${b.c}12` }}>{b.t}</span>
                                <span className="text-[12px] flex-1" style={{ color: "var(--e-txt2)" }}>{fato ? r.replace(/^fato:\s*/i, "") : r}</span>
                                <button onClick={() => { setInput(fato ? r.replace(/^fato:\s*/i, "") : r); setPainel("testar"); }} className="emo text-[9.5px] flex-none" style={{ color: "var(--e-amber)" }}>testar</button>
                              </div>
                            );
                          })}
                          {fatos.length === 0 && <div className="text-[10.5px] pt-1" style={{ color: "var(--e-dim)" }}>ainda sem fatos seus — ensina o primeiro pela caixinha.</div>}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="px-3.5 py-3 text-[12px]" style={{ color: "var(--e-mut)" }}>
                      Bia, consultora comercial da Vega — 3 rotas (Implementação R$ 997 · Academy R$ 197 · humano) · 4 regras · 12 fatos. <span style={{ color: "var(--e-dim)" }}>Na sua conta, isto é lido do motor de verdade.</span>
                    </div>
                  )}
                </div>
                <div className="text-[10.5px] mt-3" style={{ color: "var(--e-dim)" }}>Mudou o cérebro, muda aqui sozinho — isto não é print, é o motor.</div>
              </div>
            )}

            {/* TESTAR — a rodada de travas + o chat na prática */}
            {painel === "testar" && (
              <>
                <div className="flex-none px-4 pt-3 pb-2" style={{ borderBottom: "1px solid var(--e-line)" }}>
                  <div className="flex items-center gap-2.5">
                    <span className="emo text-[11px]" style={{ color: "var(--e-amber)" }}>❯</span>
                    <span className="emo text-[11px]" style={{ color: "var(--e-txt2)" }}>rodar testes · {agent.real ? (rod?.base === "publicada" ? `v${rod.versao}` : "semente") : "demo"}</span>
                    {run.r?.evals && <span className="emo text-[10px]" style={{ color: run.r.evals.aprovado ? "var(--e-green)" : "var(--e-red)" }}>{run.r.evals.passaram}/{run.r.evals.total} travas</span>}
                    <button onClick={() => void rodarTestes()} disabled={run.status === "rodando"} className="est-btn ml-auto">{run.status === "rodando" ? <Loader2 size={12} className="animate-spin" /> : null} {run.r ? "de novo" : "Rodar"}</button>
                  </div>
                  {run.status === "rodando" && <div className="flex items-center gap-2 mt-2 text-[11px]" style={{ color: "var(--e-mut)" }}><span className="est-spin" /> o robô-lead está conversando com ela…</div>}
                  {run.erro && <div className="text-[11px] mt-1.5" style={{ color: "var(--e-red)" }}>{run.erro}</div>}
                  {run.r?.evals?.casos && (
                    <div className="emo text-[11px] mt-1.5 max-h-[150px] overflow-y-auto scroll-thin">
                      {run.r.evals.casos.map((caso: any, i: number) => (
                        <div key={caso.caseId ?? i} className="py-0.5 flex gap-2">
                          <span style={{ color: caso.passou ? "var(--e-green)" : "var(--e-red)" }}>{caso.passou ? "✓" : "✗"}</span>
                          <span className="flex-1 truncate" style={{ color: caso.passou ? "var(--e-txt2)" : "var(--e-red)" }}>{caso.nome}</span>
                          {run.r.ms?.[i] != null && <span style={{ color: "var(--e-dim)" }}>{(run.r.ms[i] / 1000).toFixed(1)}s</span>}
                          {!caso.passou && <button onClick={() => setTexto(`A trava "${caso.nome}" quebrou no teste (${caso.falhas[0] ?? ""}). Reforça: `)} className="emo text-[9.5px]" style={{ color: "var(--e-amber)" }}>corrigir</button>}
                        </div>
                      ))}
                      {run.r?.modo === "roteiro" && <div className="text-[10px] pt-1" style={{ color: "var(--e-amber)" }}>conferido no roteiro (sem cérebro) — a Metrik liga a chave e vira ataque real</div>}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px]" style={{ color: "var(--e-dim)" }}>conversar com a versão:</span>
                    <div className="flex rounded-md overflow-hidden" style={{ border: "1px solid #26303a" }}>
                      <button onClick={() => setModoTeste("ar")} className="emo text-[9px] px-2 py-1" style={modoTeste === "ar" ? { background: "var(--e-green)", color: "#08090d", fontWeight: 700 } : { color: "var(--e-dim)" }}>no ar ✓</button>
                      <button onClick={() => (emRev || !agent.real) && setModoTeste("ensaio")} title={emRev ? `aplica: ${emRev.intent}` : "sem mudança em revisão"} className="emo text-[9px] px-2 py-1" style={modoTeste === "ensaio" ? { background: "var(--e-amber)", color: "#08090d", fontWeight: 700 } : { color: "var(--e-dim)", opacity: emRev || !agent.real ? 1 : 0.4 }}>+ revisão</button>
                    </div>
                  </div>
                </div>
                <div className="flex-1 px-4 py-4 space-y-2.5 overflow-y-auto" style={{ background: "#0b141a", minHeight: 0 }}>
                  {msgs.length === 0 && (
                    <div className="text-center text-[11px] py-8" style={{ color: "#8696a0" }}>
                      Escreve como um lead escreveria — ou toca numa sugestão.
                    </div>
                  )}
                  {msgs.map((m, i) =>
                    m.de === "voce" ? (
                      <div key={i} className="ml-auto max-w-[78%] rounded-lg px-3 py-1.5" style={{ background: "#005c4b", borderTopRightRadius: 3 }}>
                        <div className="text-[12.5px]" style={{ color: "#e9edef" }}>{m.texto}</div>
                      </div>
                    ) : (
                      <div key={i} className="max-w-[88%]">
                        <div className="rounded-lg px-3 py-1.5" style={{ background: m.aviso ? "rgba(232,176,75,.12)" : "#1b242b", borderTopLeftRadius: 3, border: m.aviso ? "1px solid rgba(232,176,75,.35)" : undefined }}>
                          <div className="text-[12.5px] leading-relaxed" style={{ color: m.aviso ? "#e8b04b" : "#e9edef" }}>{m.texto}</div>
                        </div>
                        {!m.aviso && (
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {m.fonte && <span className="emo text-[9px] rounded-full px-2 py-0.5" style={{ color: "var(--e-green)", background: "rgba(63,185,80,.1)", border: "1px solid rgba(63,185,80,.3)" }}>{m.fonte}</span>}
                            {feedback[i] === "sim" ? (
                              <span className="emo text-[9.5px] font-bold rounded px-2 py-0.5" style={{ background: "var(--e-green)", color: "#08090d" }}>✓ é isso</span>
                            ) : feedback[i] === "nao" ? (
                              <span className="emo text-[9.5px] rounded px-2 py-0.5" style={{ color: "var(--e-red)", border: "1px solid rgba(248,81,73,.4)" }}>corrigindo…</span>
                            ) : (
                              <span className="est-feed">
                                <button onClick={() => setFeedback((s) => ({ ...s, [i]: "sim" }))}>✓ é isso</button>
                                <button onClick={() => corrigir(i)}>corrigir</button>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ),
                  )}
                  {pensando && <div className="text-[10.5px]" style={{ color: "#8696a0" }}>digitando…</div>}
                  <div ref={fimRef} />
                </div>
                <div className="px-4 py-2 flex-none" style={{ borderTop: "1px solid var(--e-line)" }}>
                  <div className="flex gap-1.5 flex-wrap mb-2">
                    {sugestoes.map((s) => (
                      <button key={s} onClick={() => void perguntar(s)} className="text-[10px] rounded-full px-2.5 py-1" style={{ border: "1px solid var(--e-line)", color: "var(--e-mut)" }}>“{s}”</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void perguntar(); } }}
                      placeholder="escreve como um lead…"
                      className="flex-1 rounded-lg px-3 py-2 text-[12px] outline-none min-w-0"
                      style={{ background: "var(--e-surface)", border: "1px solid var(--e-line)", color: "var(--e-txt)" }}
                    />
                    <button onClick={() => void perguntar()} disabled={!input.trim() || pensando} className="grid place-items-center rounded-lg flex-none" style={{ width: 32, height: 32, background: "var(--e-amber)" }}>
                      {pensando ? <Loader2 size={13} className="animate-spin" style={{ color: "#08090d" }} /> : <ArrowUp size={14} style={{ color: "#08090d" }} />}
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mt-2 pt-2 emo text-[9.5px]" style={{ borderTop: "1px solid var(--e-line-soft)", color: "var(--e-dim)" }}>
                    <span>{msgs.filter((m) => m.de === "voce").length} perguntas</span>
                    <span style={{ color: "var(--e-green)" }}>{nSim} é isso ✓</span>
                    {nNao > 0 && <span style={{ color: "var(--e-red)" }}>{nNao} corrigindo</span>}
                    <span className="ml-auto">o “corrigir” escreve o pedido por você</span>
                  </div>
                </div>
              </>
            )}

            {/* LOGS — o que ela fez, na ordem (do Flight Recorder) */}
            {painel === "logs" && (
              <div className="flex-1 overflow-y-auto scroll-thin">
                {agent.real ? (
                  meusLogs.length > 0 ? (
                    meusLogs.map((l) => (
                      <div key={l.id} className="flex items-start gap-2.5 px-4 py-2" style={{ borderBottom: "1px solid var(--e-line-soft)" }}>
                        <span className="emo text-[10px] w-14 flex-none pt-0.5" style={{ color: "var(--e-dim)" }}>{tempoRelativo(l.at)}</span>
                        <span className="text-[11.5px] flex-1" style={{ color: l.ok ? "var(--e-txt2)" : "var(--e-red)" }}>{l.resumo}{!l.ok && l.erro ? ` — ${l.erro}` : ""}</span>
                        {!l.ok && <span className="emo text-[9.5px] flex-none" style={{ color: "var(--e-red)" }}>erro</span>}
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-[11.5px]" style={{ color: "var(--e-dim)" }}>Ainda sem execuções registradas — quando um lead falar com ela, cada passo aparece aqui.</div>
                  )
                ) : (
                  agent.live.map((r, i) => (
                    <div key={i} className="flex items-start gap-2.5 px-4 py-2" style={{ borderBottom: "1px solid var(--e-line-soft)" }}>
                      <span className="emo text-[10px] w-14 flex-none pt-0.5" style={{ color: "var(--e-dim)" }}>{r.t}</span>
                      <span className="text-[11.5px] flex-1" style={{ color: r.status === "erro" ? "var(--e-red)" : "var(--e-txt2)" }}>{r.acao}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* ── os BOTÕEZINHOS laterais ── */}
        <div className="w-[52px] flex-none flex flex-col items-center gap-1 py-3" style={{ borderLeft: "1px solid var(--e-line)" }}>
          {([
            { id: "como" as const, icone: FileText, rotulo: "Como" },
            { id: "testar" as const, icone: FlaskConical, rotulo: "Testar" },
            { id: "logs" as const, icone: ScrollText, rotulo: "Logs" },
          ]).map((b) => {
            const ativo = painel === b.id;
            const Icone = b.icone;
            return (
              <button
                key={b.id}
                onClick={() => setPainel(ativo ? null : b.id)}
                title={b.id === "como" ? "Como funciona (a feature aberta)" : b.id === "testar" ? "Testar na prática" : "Logs do agente"}
                className="flex flex-col items-center gap-0.5 rounded-md py-1.5 w-[42px]"
                style={ativo ? { background: "rgba(232,176,75,.12)", border: "1px solid rgba(232,176,75,.4)", color: "var(--e-amber)" } : { border: "1px solid transparent", color: "var(--e-mut)" }}
              >
                <Icone size={15} />
                <span className="text-[8.5px]">{b.rotulo}</span>
              </button>
            );
          })}
        </div>
      </div>

      {modal && <LigarModulo agent={agent} u={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
