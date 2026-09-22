// ESTÚDIO DA IA — a refundação aprovada no canvas: o agente SDR em PARTES,
// com o padrão fixo em 3 zonas (❯ composer → VALENDO AGORA → MUDANÇAS) e a
// bancada NA PRÁTICA sempre à direita. Mudança = DIFF (− antes / + agora),
// progresso = log de terminal. Tudo lido do MOTOR (spec, ledger, evals,
// chat-sandbox) — zero vitrine vestida em agente real.
import { type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { Activity, ArrowLeft, Check, Clock, FileText, FlaskConical, GripVertical, History, Loader2, Lock, Plus, Radio, ShieldCheck, Sparkles, X } from "lucide-react";
import { type Agent, type Upgrade } from "../data";
import { Robot } from "../Robot";
import { ClaudeStyleComposer, type ComposerPayload } from "../components/ui/ClaudeStyleComposer";
import { WhatsAppTestChat } from "../components/ui/WhatsAppTestChat";
import { ChangeEvidenceLedger, type ChangeEvidence } from "../components/studio/ChangeEvidenceLedger";
import { api } from "../lib/api";
import { useMotorAuth } from "../lib/auth";
import { useLive, tempoRelativo } from "../lib/live";
import { AgentBrainMap, type BrainPiece } from "./estudio/AgentBrainMap";

/* ── o DESTINO da informação: 🧾 fato · ⚙️ regra · 📚 doc (canvas Cérebro) ── */
export type Destino = "fato" | "regra" | "doc";
export const DESTINO_META: Record<Destino, { rotulo: string; cor: string; desc: string }> = {
  fato: { rotulo: "Lista · fato exato", cor: "#3fb950", desc: "ela passa a responder sempre igual — entra depois do ensaio rápido." },
  regra: { rotulo: "Motor · comportamento", cor: "#3b82f6", desc: "muda o jeito dela agir — o guardião testa antes de valer." },
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
      <div className="w-full max-w-md rounded-xl p-6" style={{ background: "var(--e-surface)", border: "1px solid rgba(59,130,246,.4)", boxShadow: "0 30px 70px -30px rgba(0,0,0,.85)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <div className="emo text-[11.5px]" style={{ color: "var(--e-amber)", letterSpacing: ".1em" }}>LIGAR · {u.name.toUpperCase()}</div>
            <div className="text-[16px] font-semibold tracking-tight mt-1">{(u.config?.length ?? 0) > 0 ? `${u.config!.length} ${u.config!.length === 1 ? "escolha" : "escolhas"} — já vem pronto` : "Já vem pronto"}</div>
          </div>
          <button onClick={onClose} className="est-ghost !p-1.5"><X size={15} /></button>
        </div>

        {fase === "idle" || fase === "rodando" || fase === "erro" ? (
          <>
            <div className="space-y-3 mt-4">
              {(u.config ?? []).map((c, i) => (
                <div key={i}>
                  <div className="text-[12px] mb-1.5" style={{ color: "var(--e-dim)" }}>{c.pergunta}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.opcoes.map((o) => {
                      const sel = escolhas[i] === o;
                      return (
                        <button key={o} onClick={() => setEscolhas((s) => ({ ...s, [i]: o }))} className="text-[12.5px] rounded-lg px-3 py-1.5" style={sel ? { background: "var(--e-amber)", color: "#ffffff", fontWeight: 600 } : { border: "1px solid var(--e-line)", color: "var(--e-mut)" }}>
                          {o}{sel ? " ✓" : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-lg px-3.5 py-3 mt-4" style={{ background: "rgba(59,130,246,.07)", border: "1px solid rgba(59,130,246,.3)" }}>
              <p className="text-[12.5px] leading-relaxed m-0">{u.resultado ?? u.blurb}</p>
            </div>
            {fase === "erro" && <div className="text-[12.5px] mt-3" style={{ color: "var(--e-red)" }}>{erro}</div>}
            <div className="flex items-center gap-2.5 mt-4">
              <button onClick={() => void ativar()} disabled={fase === "rodando"} className="est-btn">{fase === "rodando" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Ativar</button>
              <button onClick={onClose} className="est-ghost">depois</button>
            </div>
            <p className="text-[11.5px] mt-3 m-0" style={{ color: "var(--e-dim)" }}>o ensaio roda antes de valer — se quebrar uma trava, não liga.</p>
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
  // a experiência Claude: chat de edições à esquerda + ARTEFATO à direita.
  // O artefato é renderizado do spec do motor — custa ZERO token desenhar.
  const [aba, setAba] = useState<"artefato" | "testar" | "exec" | "historico">("artefato");
  // No celular, chat e artefato não cabem lado a lado. Esta chave transforma
  // as duas colunas num workspace navegável sem duplicar nenhuma tela.
  const [mobilePane, setMobilePane] = useState<"editar" | "resultado">("editar");
  const abrirAba = (proxima: "artefato" | "testar" | "exec" | "historico") => {
    setAba(proxima);
    setMobilePane("resultado");
  };
  // A bancada funciona como um editor: no desktop o mestre pode dar mais
  // espaço ao chat ou ao artefato arrastando o divisor. Persistimos a escolha.
  const [chatWidth, setChatWidth] = useState(() => {
    if (typeof window === "undefined") return 320;
    const saved = Number(window.localStorage.getItem("metrik:studio-chat-width-v4"));
    return Number.isFinite(saved) && saved >= 296 && saved <= 440 ? saved : 320;
  });
  const [resizing, setResizing] = useState(false);
  const resizeRef = useRef<{ x: number; width: number; pointerId: number } | null>(null);
  const clampChatWidth = (value: number) => Math.min(440, Math.max(296, value));
  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    resizeRef.current = { x: event.clientX, width: chatWidth, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizing(true);
  };
  const moveResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current) return;
    setChatWidth(clampChatWidth(resizeRef.current.width + event.clientX - resizeRef.current.x));
  };
  const stopResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current) return;
    try { event.currentTarget.releasePointerCapture(resizeRef.current.pointerId); } catch { /* já solto */ }
    resizeRef.current = null;
    setResizing(false);
  };
  const resizeWithKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home") return;
    event.preventDefault();
    setChatWidth((width) => event.key === "Home" ? 320 : clampChatWidth(width + (event.key === "ArrowLeft" ? -24 : 24)));
  };
  useEffect(() => {
    window.localStorage.setItem("metrik:studio-chat-width-v4", String(Math.round(chatWidth)));
  }, [chatWidth]);
  // qual PEÇA do cérebro está aberta no artefato (o mapa fica à direita)
  const [peca, setPeca] = useState<string>("conversa");
  const [trocas, setTrocas] = useState<{ pedido: string; status: "no ar" | "guardada" }[]>([]);
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
  const execsHoje = agent.real ? (stats?.porAgente?.[agent.id]?.execucoes ?? 0) : agent.metrics.execucoes;
  const naFila = agent.work?.kind === "followups" ? (agent.work.followups?.filter((f) => f.status !== "feito").length ?? 0) : null;

  // ── composer (a porta única) ──
  const [texto, setTexto] = useState("");
  const [envio, setEnvio] = useState<EnvioE>({ fase: "idle" });
  const mandar = (valor = texto) => {
    const t = valor.trim();
    if (!t || envio.fase === "rodando") return;
    setTexto("");
    if (pedidoVago(t)) return setEnvio({ fase: "clarificar", pedido: t });
    setEnvio({ fase: "confirmar", pedido: t, destino: destinoDe(t) });
  };
  const enviarComposer = ({ message, files, pastedContent }: ComposerPayload) => {
    const contexto = [
      ...pastedContent.map((item) => `Texto colado:\n${item.content}`),
      ...files.map((item) => item.content
        ? `Arquivo ${item.file.name}:\n${item.content}`
        : `Anexo: ${item.file.name}`),
    ];
    mandar([message, ...contexto].filter(Boolean).join("\n\n"));
  };

  // ── VOZ DE VERDADE (Web Speech, pt-BR): toca pra falar, o texto nasce na
  // caixinha. Sem suporte/permissão → aviso honesto, nunca botão de mentira.
  const [gravando, setGravando] = useState(false);
  const [vozErro, setVozErro] = useState<string | null>(null);
  const recRef = useRef<any>(null);
  const baseVozRef = useRef("");
  const falar = () => {
    const SR: any = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return setVozErro("este navegador não faz voz — escreve que funciona igual");
    if (gravando) { try { recRef.current?.stop(); } catch { /* já parou */ } return; }
    const r = new SR();
    r.lang = "pt-BR"; r.interimResults = true; r.continuous = true;
    baseVozRef.current = texto ? texto.replace(/\s+$/, "") + " " : "";
    r.onresult = (e: any) => {
      let t = "";
      for (const res of e.results) t += res[0].transcript;
      setTexto(baseVozRef.current + t);
    };
    r.onerror = (e: any) => {
      setVozErro(e?.error === "not-allowed" ? "libera o microfone no navegador pra falar" : "a voz falhou — escreve que funciona igual");
      setGravando(false);
    };
    r.onend = () => setGravando(false);
    recRef.current = r; setVozErro(null); setGravando(true);
    try { r.start(); } catch { setGravando(false); }
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
        setTrocas((t) => [...t, { pedido: bruto, status: "guardada" }]);
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
      setTrocas((t) => [...t, { pedido: envio.pedido ?? "", status: "no ar" }]);
      setTick((x) => x + 1);
    } catch (e) { setEnvio({ fase: "erro", erro: e instanceof Error ? e.message : "erro ao publicar" }); }
  };

  // publicar direto uma mudança que ficou "em revisão" (do Histórico)
  const [revErro, setRevErro] = useState<string | null>(null);
  const [revIndo, setRevIndo] = useState(false);
  const publicarEmRev = async (changeSetId?: string) => {
    const alvo = changeSetId ?? emRev?.id;
    if (!alvo || revIndo) return;
    try { setRevErro(null); setRevIndo(true); await api.publicarMudanca(alvo, auth.getToken); setTick((x) => x + 1); }
    catch (e) { setRevErro(e instanceof Error ? e.message : "não consegui publicar — retoma pelo chat"); }
    finally { setRevIndo(false); }
  };

  // ── NA PRÁTICA (chat sandbox real) ──
  const [msgs, setMsgs] = useState<MsgT[]>([]);
  const [input, setInput] = useState("");
  const [pensando, setPensando] = useState(false);
  const [feedback, setFeedback] = useState<Record<number, "sim" | "nao">>({});
  const [modoTeste, setModoTeste] = useState<"ar" | "ensaio">("ar");
  const [mudancaTesteId, setMudancaTesteId] = useState<string | null>(null);
  // sem mudança pendente, testar "com a mudança nova" não faz sentido → volta pro ar
  useEffect(() => { if (!emRev && modoTeste === "ensaio") { setModoTeste("ar"); setMudancaTesteId(null); } }, [emRev, modoTeste]);
  useEffect(() => {
    if (!seed) return;
    if (seed.tipo === "pergunta") { setInput(seed.texto); abrirAba("testar"); }
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
      const r: any = await api.testar(agent.id, historico, modoTeste, auth.getToken, mudancaTesteId);
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
      const r: any = await api.rodarTestes(agent.id, modoTeste, auth.getToken, mudancaTesteId);
      setRun({ status: "pronto", r });
    } catch (e) { setRun({ status: "idle", erro: e instanceof Error ? e.message : "a rodada falhou" }); }
  };

  const sugestoes = agent.real ? ["quanto custa?", "que horas vocês atendem?", "quero falar com uma pessoa"] : ["quero comprar a academy", "quanto custa o start?", "tem desconto à vista?"];
  const nSim = Object.values(feedback).filter((v) => v === "sim").length;
  const nNao = Object.values(feedback).filter((v) => v === "nao").length;

  // rola o feed pro fim quando o fluxo do pedido avança (a resposta nasce perto da caixinha)
  const feedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (envio.fase === "idle" && trocas.length === 0) return; // no mount fica no topo
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [envio.fase, trocas.length]);

  const meusLogs = agent.real ? (logs ?? []).filter((l) => l.agentId === agent.id).slice(0, 30) : [];

  /* ═══ A EXPERIÊNCIA CLAUDE (ordem do mestre, 21/09): CHAT DE EDIÇÕES à
     esquerda + ARTEFATO grande à direita (o doc vivo de como a feature
     funciona, renderizado do spec — ZERO token pra desenhar). No artefato,
     as abas: Testar · Execuções ao vivo · Histórico. Mudou no chat → o
     artefato marca o que mudou → roda os testes → publica. ═══ */
  const bolhaMotor = "flex items-start gap-3";
  const bolhaVoce = "ml-auto max-w-[85%] rounded-xl px-4 py-2.5 text-[14.5px] leading-relaxed";

  return (
    <div className={`est flex-1 min-h-0 flex flex-col pb-[60px] md:pb-0${resizing ? " est-is-resizing" : ""}`} style={{ "--est-chat-width": `${chatWidth}px` } as CSSProperties}>
      {/* ── cabeçalho do workspace: identidade + estado + recibo compacto ── */}
      <header className="est-agentbar flex-none">
        <div className="est-agentbar-main">
          <button onClick={onBack} title="voltar pra frota" aria-label="voltar pra frota" className="est-icon-btn"><ArrowLeft size={17} /></button>
          <div className="est-agent-avatar"><Robot state={estado} color={agent.color} size={30} /></div>
          <div className="min-w-0 est-agent-identity">
            <div className="flex items-center gap-2">
              <strong className="text-[16px] truncate">{agent.name}</strong>
              <span className="est-status-dot" data-on={estado !== "pausado" ? "true" : "false"} />
            </div>
            <div className="text-[11.5px] truncate" style={{ color: "var(--e-dim)" }}>
              {agent.tipo === "acao" ? "Executa tarefas" : "Conversa com leads"} · {estado === "pausado" ? "pausado" : "no ar"}
            </div>
          </div>

          <div className="est-agentbar-today" role="status" aria-label={`${execsHoje} atendimentos hoje`}><b>{execsHoje}</b><span>hoje</span></div>

          <div className="flex items-center gap-1">
            <button onClick={onAoVivo} title="abrir atividade ao vivo" aria-label="abrir atividade ao vivo" className="est-icon-btn"><Radio size={16} /></button>
            <button onClick={onToggle} title={estado === "pausado" ? "ligar agente" : "pausar agente"} aria-label={estado === "pausado" ? "ligar agente" : "pausar agente"} className="est-switch">
              <span data-on={estado === "pausado" ? "false" : "true"}><i /></span>
            </button>
          </div>
        </div>
      </header>

      {/* Até xl usamos uma superfície por vez. Isso inclui tablets com a
          sidebar global aberta, onde o antigo split expulsava o documento. */}
      <nav className="xl:hidden est-mobile-workspace" aria-label="Áreas do agente">
        <button onClick={() => setMobilePane("editar")} aria-current={mobilePane === "editar" ? "page" : undefined}>Melhorar</button>
        {([
          { id: "artefato" as const, curto: "Como age", longo: "Como funciona" },
          { id: "testar" as const, curto: "Testar", longo: "Testar" },
          { id: "exec" as const, curto: "Ao vivo", longo: "Ao vivo" },
          { id: "historico" as const, curto: "Mudanças", longo: "Mudanças" },
        ]).map((t) => (
          <button key={t.id} onClick={() => abrirAba(t.id)} aria-current={mobilePane === "resultado" && aba === t.id ? "page" : undefined}>
            <span className="sm:hidden">{t.curto}</span><span className="hidden sm:inline">{t.longo}</span>
            {t.id === "historico" && emRev && <i aria-label="uma mudança pendente">1</i>}
          </button>
        ))}
      </nav>

      <div className="flex flex-1 min-h-0">
        {/* ══ ESQUERDA · CHAT DE EDIÇÕES ══ */}
        <div className={`${mobilePane === "editar" ? "flex" : "hidden"} xl:flex flex-col min-h-0 w-full min-w-0 flex-none est-improve`}>
          <div className="est-improve-head">
            <span>Melhorar · {agent.name}</span>
          </div>

          <div ref={feedRef} className="flex-1 overflow-y-auto scroll-thin est-improve-feed space-y-5">
            {/* boas-vindas do motor + pontos de partida (ninguém fica olhando pro vazio) */}
            <div className="est-improve-intro">
              <h2>O que deve mudar?</h2>
              <p>Diga do seu jeito. Eu encontro a peça, testo e mostro antes de publicar.</p>
                {trocas.length === 0 && envio.fase === "idle" && (
                  <div className="est-suggestions">
                    {[
                      "Ensina que o parcelamento é em até 3x sem juros",
                      "Quando o lead sumir, espera 1 dia e manda só 1 follow",
                    ].map((s) => (
                      <button key={s} onClick={() => setTexto(s)}><Plus size={13} />{s}</button>
                    ))}
                  </div>
                )}
            </div>

            {/* trocas já fechadas nesta visita */}
            {trocas.map((t, i) => (
              <div key={i} className="space-y-3 est-entra">
                <div className={bolhaVoce} style={{ background: "var(--e-surface)", border: "1px solid var(--e-line)" }}>{t.pedido}</div>
                <div className={bolhaMotor}>
                  <div className="flex-none mt-0.5"><Robot state="ativo" color={agent.color} size={22} /></div>
                  <p className="text-[14px] leading-relaxed m-0" style={{ color: t.status === "no ar" ? "var(--e-green)" : "var(--e-txt2)" }}>
                    {t.status === "no ar" ? "✓ Publicado — já está no ar e marcado no artefato." : "Guardado na Biblioteca — a busca inteligente é a próxima fatia."}
                  </p>
                </div>
              </div>
            ))}

            {/* a troca em andamento */}
            {envio.fase !== "idle" && envio.pedido && (
              <div className={bolhaVoce + " est-entra"} style={{ background: "var(--e-surface)", border: "1px solid var(--e-line)" }}>{envio.pedido}</div>
            )}
            {envio.fase === "clarificar" && (
              <div className={bolhaMotor + " est-entra"}>
                <div className="flex-none mt-0.5"><Robot state="ativo" color={agent.color} size={22} /></div>
                <p className="text-[14.5px] leading-relaxed m-0" style={{ color: "var(--e-txt2)" }}>
                  Só isso não me diz o que mudar. O que ela <b>passa a fazer</b>, e <b>em que momento</b>?
                </p>
              </div>
            )}
            {envio.fase === "confirmar" && (
              <div className={bolhaMotor + " est-entra"}>
                <div className="flex-none mt-0.5"><Robot state="ativo" color={agent.color} size={22} /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] leading-relaxed m-0" style={{ color: "var(--e-txt2)" }}>Entendi. Isso vai <b>pra onde</b>?</p>
                  <div className="flex gap-1.5 mt-2.5 flex-wrap">
                    {(["fato", "regra", "doc"] as Destino[]).map((d) => {
                      const m = DESTINO_META[d];
                      const sel = (envio.destino ?? "regra") === d;
                      return (
                        <button key={d} onClick={() => setEnvio((s) => ({ ...s, destino: d }))} className="text-[12px] rounded-md px-3 py-1.5" style={sel ? { background: `${m.cor}1f`, border: `1px solid ${m.cor}66`, color: m.cor, fontWeight: 700 } : { border: "1px solid var(--e-line)", color: "var(--e-dim)" }}>
                          {m.rotulo}{sel ? " ✓" : ""}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-[12px] mt-1.5" style={{ color: "var(--e-dim)" }}>{DESTINO_META[envio.destino ?? "regra"].desc}</div>
                  <div className="flex items-center gap-2.5 mt-3">
                    <button onClick={() => void rodarEnsaio()} className="est-btn">{envio.destino === "doc" ? "É isso — guardar" : "É isso — roda o ensaio"}</button>
                    <button onClick={() => setEnvio({ fase: "idle" })} className="est-ghost">não — escrevo de novo</button>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[12px] mt-2" style={{ color: "var(--e-dim)" }}><Lock size={11} /> núcleo blindado — o guardião testa antes de valer</span>
                </div>
              </div>
            )}
            {envio.fase === "rodando" && (
              <div className={bolhaMotor + " est-entra"}>
                <div className="flex-none mt-0.5"><Robot state="ativo" color={agent.color} size={22} /></div>
                <p className="text-[14px] leading-relaxed m-0 flex items-center gap-2.5" style={{ color: "var(--e-mut)" }}>
                  <span className="est-spin" /> rodando o ensaio do SEU pedido + as travas do guardião — ~30s, teste de verdade…
                </p>
              </div>
            )}
            {envio.fase === "erro" && (
              <div className={bolhaMotor + " est-entra"}>
                <div className="flex-none mt-0.5"><Robot state="idle" color={agent.color} size={22} /></div>
                <p className="text-[14px] leading-relaxed m-0" style={{ color: "var(--e-red)" }}>{envio.erro}</p>
              </div>
            )}
            {envio.fase === "guardado" && (
              <div className={bolhaMotor + " est-entra"}>
                <div className="flex-none mt-0.5"><Robot state="ativo" color={agent.color} size={22} /></div>
                <p className="text-[14px] leading-relaxed m-0" style={{ color: "var(--e-txt2)" }}>
                  Guardado na <b>Biblioteca</b>. <button onClick={() => setEnvio({ fase: "idle" })} className="est-ghost !p-0 !px-1">ok</button>
                </p>
              </div>
            )}
            {(envio.fase === "pronto" || envio.fase === "publicando" || envio.fase === "publicado") && envio.evals && (
              <div className={bolhaMotor + " est-entra"}>
                <div className="flex-none mt-0.5"><Robot state="ativo" color={agent.color} size={22} /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] leading-relaxed m-0 mb-2" style={{ color: "var(--e-txt2)" }}>
                    {envio.fase === "publicado" ? <b style={{ color: "var(--e-green)" }}>✓ No ar — marquei no artefato o que mudou.</b> : <>Alterei — <b style={{ color: "var(--e-txt)" }}>olha o antes e o depois</b>:</>}
                  </p>
                  {envio.ensaio?.modo === "real" && envio.ensaio.situacoes[0] ? (
                    <div className="rounded-[9px] overflow-hidden" style={{ border: "1px solid #2b2415", background: "var(--e-surface)" }}>
                      <div className="px-3.5 py-1.5 text-[12px]" style={{ color: "var(--e-dim)", borderBottom: "1px solid var(--e-line-soft)" }}>
                        situação: {envio.ensaio.situacoes[0].pergunta}
                        {envio.ensaio.situacoes[0].nome === "do seu pedido" && <span className="emo ml-2" style={{ color: "var(--e-amber)" }}>do SEU pedido</span>}
                      </div>
                      <div className="emo">
                        <div className="est-diff-del"><i>−</i><s>{envio.ensaio.situacoes[0].antes.slice(0, 180)}</s></div>
                        <div className="est-diff-add"><i>+</i><s>{envio.ensaio.situacoes[0].agora.slice(0, 180)}</s></div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[9px] overflow-hidden emo" style={{ border: "1px solid #2b2415" }}><div className="est-diff-add"><i>+</i><s>{envio.pedido}</s></div></div>
                  )}
                  <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                    <span className="emo text-[12px]" style={{ color: envio.evals.aprovado ? "var(--e-green)" : "var(--e-red)" }}>
                      {envio.evals.aprovado ? "✓" : "✗"} guardião {envio.evals.passaram}/{envio.evals.total}
                    </span>
                    {envio.ensaio?.modo !== "real" && <span className="emo text-[12.5px]" style={{ color: "var(--e-amber)" }}>sem cérebro — registrado pra Metrik</span>}
                    {envio.fase === "publicado" ? (
                      <button onClick={() => abrirAba("testar")} className="est-btn ml-auto">Testar na prática →</button>
                    ) : (
                      <div className="ml-auto flex items-center gap-2">
                        <button onClick={() => setEnvio({ fase: "idle" })} className="est-ghost">deixar de fora</button>
                        {envio.ensaio?.modo === "real" && (
                          <button onClick={() => void publicar()} disabled={!envio.evals.aprovado || envio.fase === "publicando"} className="est-btn" style={!envio.evals.aprovado ? { opacity: 0.5 } : undefined}>
                            {envio.fase === "publicando" ? <Loader2 size={13} className="animate-spin" /> : null} Publicar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* composer no padrão Claude: contexto, voz, texto colado e envio */}
          <div className="flex-none est-composer-wrap">
            <ClaudeStyleComposer
              value={texto}
              onChange={setTexto}
              onSend={enviarComposer}
              onVoice={falar}
              isRecording={gravando}
              voiceError={vozErro}
              placeholder={`Peça uma mudança para ${agent.name}…`}
              disabled={envio.fase === "rodando"}
            />
          </div>
        </div>

        <div
          className="hidden xl:flex est-splitter"
          role="separator"
          aria-label="Redimensionar painel Melhorar"
          aria-orientation="vertical"
          aria-valuemin={296}
          aria-valuemax={440}
          aria-valuenow={Math.round(chatWidth)}
          tabIndex={0}
          title="Arraste para aumentar ou diminuir o chat"
          onDoubleClick={() => setChatWidth(320)}
          onPointerDown={startResize}
          onPointerMove={moveResize}
          onPointerUp={stopResize}
          onPointerCancel={stopResize}
          onKeyDown={resizeWithKeyboard}
        >
          <span><GripVertical size={14} /></span>
        </div>

        {/* ══ DIREITA · O ARTEFATO (doc vivo do spec — zero token pra desenhar) ══ */}
        <div className={`${mobilePane === "resultado" ? "flex" : "hidden"} xl:flex flex-1 min-w-0 flex-col min-h-0 est-main-workspace`}>
          {/* abas do artefato */}
          <div className="hidden xl:grid est-workspace-tabs">
            {([
              { id: "artefato" as const, icone: FileText, rotulo: "Como funciona" },
              { id: "testar" as const, icone: FlaskConical, rotulo: "Testar" },
              { id: "exec" as const, icone: Activity, rotulo: "Ao vivo" },
              { id: "historico" as const, icone: History, rotulo: "Mudanças" },
            ]).map((t) => {
              const ativo = aba === t.id;
              const Icone = t.icone;
              return (
                <button key={t.id} onClick={() => abrirAba(t.id)} aria-current={ativo ? "page" : undefined} className="est-tab" title={t.rotulo}>
                  <span className="est-tab-icon"><Icone size={16} />{t.id === "exec" && <i className="live-dot" />}</span>
                  <b>{t.rotulo}</b>
                  {t.id === "historico" && emRev && <span className="est-tab-badge" aria-label="uma mudança pendente">1</span>}
                </button>
              );
            })}
          </div>

          {/* ── COMO FUNCIONA — documento primeiro, caminho como índice lateral ── */}
          {aba === "artefato" && (() => {
            type Peca = BrainPiece & { upg?: Upgrade };
            const temFollow = agent.work?.kind === "followups";
            const pecas: Peca[] = agent.real
              ? [
                  { id: "conversa", nome: "Conversa", glifo: "💬", cor: "var(--e-amber)", estado: "nucleo", resumo: "o núcleo — como ela fala com o lead", meta: `${regras.length} regras · ${fatos.length} fatos` },
                  ...(temFollow ? [{ id: "followup", nome: "Follow-up", glifo: "⏱", cor: "var(--e-green)", estado: "no ar" as const, resumo: "busca de volta quem sumiu", meta: naFila != null ? `${naFila} na fila` : undefined, cond: "se some →" }] : []),
                  ...(agent.upgrades ?? []).map((u): Peca => ({ id: `u:${u.name}`, nome: u.name, glifo: "✦", cor: "#7d8694", estado: "off", resumo: u.blurb ?? "disponível pra ligar", upg: u })),
                ]
              : [
                  { id: "conversa", nome: "Conversa", glifo: "💬", cor: "var(--e-amber)", estado: "nucleo", resumo: "o núcleo — como ela fala", meta: "4 regras · 12 fatos" },
                  { id: "agenda", nome: "Agendamento", glifo: "📅", cor: "#58aae4", estado: "no ar", resumo: "marca a reunião na agenda", meta: "5 marcadas hoje", cond: "se qualifica →" },
                  { id: "followup", nome: "Follow-up", glifo: "⏱", cor: "var(--e-green)", estado: "no ar", resumo: "busca quem sumiu — 2 toques", meta: "3 na fila", cond: "se some →" },
                  { id: "avisa", nome: "Avisa no WhatsApp", glifo: "📲", cor: "#7d8694", estado: "off", resumo: "chama um humano na hora", cond: "se trava →" },
                  { id: "crm", nome: "Preenche o CRM", glifo: "📝", cor: "#7d8694", estado: "off", resumo: "anota origem e resumo no card" },
                ];
            const ativas = pecas.filter((p) => p.estado !== "off");
            const aberta = pecas.find((p) => p.id === peca) ?? pecas[0];

            // "o que ela faz" — a função em 1 frase + os trabalhos concretos (dos módulos ativos)
            const VERBO: Record<string, { rot: string; cor: string }> = {
              conversa: { rot: "Atende e conversa", cor: "var(--e-amber)" },
              followup: { rot: "Recupera quem sumiu", cor: "var(--e-green)" },
              agenda: { rot: "Agenda a reunião", cor: "#58aae4" },
              avisa: { rot: "Chama um humano", cor: "#58aae4" },
              crm: { rot: "Preenche o CRM", cor: "var(--e-green)" },
            };
            const jobs = ativas.map((p) => VERBO[p.id] ?? { rot: p.nome, cor: p.cor });
            const funcao = agent.papel?.trim() || (c?.identidade ? `${c.identidade}.` : "Atende cada lead no WhatsApp e conduz a conversa até o próximo passo.");

            return (
              <div className="flex-1 min-h-0 est-artifact-view">
                <div className="est-artifact-shell">
                  <article className="est-artifact-doc" aria-labelledby="selected-piece-title">
                    <header className="est-piece-head">
                      <div className="est-piece-icon" style={{ color: aberta.cor }} aria-hidden="true">{aberta.glifo}</div>
                      <div className="min-w-0">
                        <span className="est-piece-context">Como {agent.name} funciona</span>
                        <h2 id="selected-piece-title">{aberta.nome}</h2>
                      </div>
                      {aberta.estado !== "off" ? (
                        <span className="emo est-piece-status" data-state="live">
                          {agent.real ? (rod ? (rod.base === "semente" ? "cérebro-semente" : `versão ${rod.versao}`) : "lendo…") : "demonstração"} · no ar
                        </span>
                      ) : (
                        <span className="emo est-piece-status" data-state="available">disponível · desligada</span>
                      )}
                    </header>

                    <div className="est-piece-body">
                      {aberta.id === "conversa" && (
                        <section className="est-piece-intro" aria-labelledby="piece-purpose-title">
                          <h3 id="piece-purpose-title">{funcao}</h3>
                          <div className="flex flex-wrap gap-2">
                            {jobs.map((job, index) => <span key={index} className="est-chip"><span style={{ background: job.cor }} />{job.rot}</span>)}
                          </div>
                        </section>
                      )}

                      {aberta.id === "conversa" && (agent.real && rod ? (
                        <>
                          <div className="est-facts-grid">
                            <section>
                              <h4>Jeito de falar</h4>
                              <p>{c?.identidade ?? "Identidade ainda não descrita."}</p>
                            </section>
                            <section>
                              <h4>O que oferece</h4>
                              <p>{c?.oferta ?? "Oferta ainda não descrita."}</p>
                            </section>
                          </div>

                          <section className="est-rules" aria-labelledby="agent-rules-title">
                            <div className="est-section-head">
                              <h3 id="agent-rules-title">Regras em vigor</h3>
                              <span>{regras.length} {regras.length === 1 ? "regra" : "regras"}</span>
                            </div>
                            <div className="est-card overflow-hidden">
                              {regras.map((r, i) => {
                                const fato = /^fato:/i.test(r);
                                const sua = fato || suasIntents.has(r.trim().toLowerCase());
                                const nova = publicadas.length > 0 && r.trim().toLowerCase() === String(publicadas[0].intent ?? "").trim().toLowerCase();
                                const badge = fato ? { t: "FATO", c: "#3fb950" } : sua ? { t: "SEU AJUSTE", c: "#3b82f6" } : { t: "NÚCLEO", c: "#7d8694" };
                                return (
                                  <div key={i} className="est-rule-row" data-authored={sua ? "true" : "false"} style={sua ? { "--rule-color": badge.c } as CSSProperties : undefined}>
                                    <span className="emo est-rule-origin" style={{ color: badge.c, borderColor: `${badge.c}55`, background: `${badge.c}12` }}>{badge.t}</span>
                                    <span>{fato ? r.replace(/^fato:\s*/i, "") : r}</span>
                                    {nova && <span className="emo est-rule-new">novo</span>}
                                    <button onClick={() => { setInput(fato ? r.replace(/^fato:\s*/i, "") : r); abrirAba("testar"); }}>Testar</button>
                                  </div>
                                );
                              })}
                              {regras.length === 0 && <div className="est-rules-empty">Ainda sem regras — peça a primeira em Melhorar.</div>}
                            </div>
                          </section>

                          {publicadas[0] && (
                            <section className="est-latest">
                              <div className="est-section-head"><div><span className="emo est-kicker">ÚLTIMA PUBLICAÇÃO</span><h3>O que entrou por último</h3></div><span>{publicadas[0].createdAt ? `há ${tempoRelativo(publicadas[0].createdAt)}` : ""}</span></div>
                              <div className="est-diff-add emo"><i>+</i><s>{publicadas[0].intent}</s></div>
                            </section>
                          )}
                        </>
                      ) : (
                        <div className="est-demo-note">
                          <span className="emo est-kicker">EXEMPLO GUIADO</span>
                          <p>{agent.papel || `${agent.name} atende, entende a necessidade e conduz cada conversa ao próximo passo.`}</p>
                          <span>Na sua conta, esta página é montada com as peças, regras e fatos lidos do motor real.</span>
                        </div>
                      ))}

                      {aberta.id !== "conversa" && aberta.estado !== "off" && (
                        <section className="est-module-detail">
                          <h3>{aberta.resumo}.</h3>
                          {aberta.meta && <div className="est-module-now"><span className="emo">AGORA</span><b>{aberta.meta}</b></div>}
                          <p>Para mudar como esta peça age, descreva o ajuste em Melhorar. O guardião testa antes de publicar.</p>
                        </section>
                      )}

                      {aberta.estado === "off" && (
                        <section className="est-module-detail">
                          <span className="est-piece-context">Disponível para ligar</span>
                          <h3>{aberta.resumo}.</h3>
                          {aberta.upg?.resultado && <div className="est-upgrade-result">{aberta.upg.resultado}</div>}
                          {aberta.upg ? <button onClick={() => setModal(aberta.upg!)} className="est-btn"><Plus size={14} /> Ligar esta peça</button> : <p>Na sua conta, a Metrik liga esta peça e ela entra no caminho depois de ensaio e aprovação.</p>}
                        </section>
                      )}
                    </div>
                  </article>

                  <aside className="est-brain-rail" aria-label="Módulos e peças do agente">
                    <AgentBrainMap agentName={agent.name} pieces={pecas} selectedId={aberta.id} onSelect={setPeca} real={!!agent.real} />
                  </aside>
                </div>
              </div>
            );
          })()}

          {/* ── ABA TESTAR ── */}
          {aba === "testar" && (
            <div className="flex-1 min-h-0 flex flex-col est-entra est-test-page">
              <div className="est-test-layout scroll-thin">
                <WhatsAppTestChat
                  agentName={agent.name}
                  modeLabel={modoTeste === "ensaio" ? "prévia da mudança" : "versão no ar"}
                  messages={msgs}
                  feedback={feedback}
                  thinking={pensando}
                  input={input}
                  testRun={{
                    status: run.status,
                    passed: run.r?.evals?.passaram,
                    total: run.r?.evals?.total,
                    cases: run.r?.evals?.casos?.map((testCase: any, index: number) => ({ ...testCase, ms: run.r?.ms?.[index] })),
                    mode: run.r?.modo,
                    testedMode: run.r?.modoTeste,
                    base: run.r?.base,
                    suite: run.r?.suite,
                    durationMs: run.r?.duracaoMs,
                    change: run.r?.mudanca,
                    error: run.erro,
                  }}
                  onInputChange={setInput}
                  onSubmit={() => void perguntar()}
                  onAccept={(index) => setFeedback((state) => ({ ...state, [index]: "sim" }))}
                  onCorrect={corrigir}
                  onFixCase={(testCase) => setTexto(`A trava "${testCase.nome}" quebrou no teste (${testCase.falhas?.[0] ?? ""}). Reforça: `)}
                />

                <aside className="est-test-console scroll-thin" aria-label="Controles do laboratório de teste">
                  <header className="est-test-console-head">
                    <span className="est-test-panel-label">CONTROLES DO TESTE</span>
                    <strong>{modoTeste === "ensaio" ? "Prévia isolada" : "Versão em produção"}</strong>
                  </header>

                  <section className="est-test-console-section">
                    <span className="est-test-panel-label">VERSÃO TESTADA</span>
                    {agent.real && emRev ? (
                      <div className="est-test-version-switch">
                        <button type="button" onClick={() => { setModoTeste("ar"); setMudancaTesteId(null); }} aria-pressed={modoTeste === "ar"}>No ar</button>
                        <button type="button" onClick={() => { setModoTeste("ensaio"); setMudancaTesteId(emRev.id); }} aria-pressed={modoTeste === "ensaio"}>Mudança nova</button>
                      </div>
                    ) : (
                      <div className="est-test-version-static"><i /> versão no ar agora</div>
                    )}
                    <p>{modoTeste === "ensaio" ? "Prévia ainda não publicada." : "O que os leads recebem hoje."}</p>
                  </section>

                  <section className="est-test-console-section">
                    <span className="est-test-panel-label">COMEÇAR POR UM CENÁRIO</span>
                    <div className="est-test-prompts">
                      {sugestoes.map((s) => (
                        <button type="button" key={s} onClick={() => void perguntar(s)}>{s}<span>→</span></button>
                      ))}
                    </div>
                  </section>

                  <section className="est-test-console-section est-test-session">
                    <span className="est-test-panel-label">SESSÃO ATUAL</span>
                    <div><strong>{msgs.filter((m) => m.de === "voce").length}</strong><span>perguntas</span></div>
                    <div><strong className="is-ok">{nSim}</strong><span>respostas certas</span></div>
                    <div><strong className={nNao > 0 ? "is-fix" : ""}>{nNao}</strong><span>correções abertas</span></div>
                  </section>

                  <section className="est-test-console-section est-test-console-guardian">
                    <span className="est-test-panel-label">GUARDIÃO AUTOMÁTICO</span>
                    <h3>{run.r?.evals ? `${run.r.evals.passaram}/${run.r.evals.total} comportamentos protegidos` : modoTeste === "ensaio" ? "Provar a mudança antes de publicar" : "Atacar a versão que atende seus leads"}</h3>
                    <p>{run.r?.evals ? "Abra cada ataque na conversa para ver resposta, critérios e ações." : `O Guardião vai testar ${modoTeste === "ensaio" ? "a prévia selecionada" : "a versão no ar"} e guardar a prova.`}</p>
                    <button type="button" onClick={() => void rodarTestes()} disabled={run.status === "rodando"} className="est-btn2 est-test-run">
                      {run.status === "rodando" ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
                      {run.r ? "Rodar nova prova" : "Iniciar prova"}
                    </button>
                    {run.erro ? <div className="est-test-error">{run.erro}</div> : null}
                  </section>
                </aside>
              </div>
            </div>
          )}

          {/* ── ABA EXECUÇÕES (ao vivo) ── */}
          {aba === "exec" && (
            <div className="flex-1 overflow-y-auto scroll-thin est-entra">
              <div className="flex items-center gap-2.5 px-6 py-3.5" style={{ borderBottom: "1px solid var(--e-line)" }}>
                <span className="live-dot" style={{ width: 8, height: 8 }} />
                <span className="text-[13.5px] font-semibold">O que ela está fazendo — ao vivo</span>
                <span className="text-[12px] ml-auto" style={{ color: "var(--e-dim)" }}>cada linha é uma execução real</span>
              </div>
              {agent.real ? (
                meusLogs.length > 0 ? (
                  meusLogs.map((l, i) => (
                    <div key={l.id} className="est-row est-entra flex items-start gap-3.5 px-6 py-3" style={{ borderBottom: "1px solid var(--e-line-soft)", animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                      <span className="emo text-[12.5px] w-16 flex-none pt-0.5" style={{ color: "var(--e-dim)" }}>{tempoRelativo(l.at)}</span>
                      <span className="text-[14px] flex-1 leading-relaxed" style={{ color: l.ok ? "var(--e-txt2)" : "var(--e-red)" }}>{l.resumo}{!l.ok && l.erro ? ` — ${l.erro}` : ""}</span>
                      {!l.ok && <span className="emo text-[12px] font-bold flex-none rounded px-1.5" style={{ color: "var(--e-red)", border: "1px solid rgba(248,81,73,.4)" }}>ERRO</span>}
                    </div>
                  ))
                ) : (
                  <div className="px-6 py-8 text-[14px]" style={{ color: "var(--e-dim)" }}>Ainda sem execuções — quando um lead falar com ela, cada passo aparece aqui na hora.</div>
                )
              ) : (
                agent.live.map((r, i) => (
                  <div key={i} className="est-row flex items-start gap-3.5 px-6 py-3" style={{ borderBottom: "1px solid var(--e-line-soft)" }}>
                    <span className="emo text-[12.5px] w-16 flex-none pt-0.5" style={{ color: "var(--e-dim)" }}>{r.t}</span>
                    <span className="text-[14px] flex-1" style={{ color: r.status === "erro" ? "var(--e-red)" : "var(--e-txt2)" }}>{r.acao}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── ABA MUDANÇAS — pedido, impacto, prova e publicação no mesmo lugar ── */}
          {aba === "historico" && (
            <div className="flex-1 min-h-0 overflow-y-auto scroll-thin est-entra">
              <ChangeEvidenceLedger
                changes={(agent.real ? cs : [
                  {
                    id: "demo-provada",
                    intent: "Ao negar, oferecer um caminho alternativo sem encerrar a conversa",
                    status: "evaluated",
                    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
                    impact: {
                      suite: "comercial",
                      ensaio: { modo: "real", situacoes: [{ pergunta: "Não consigo nesse horário", antes: "Tudo bem. Se precisar, estamos à disposição.", agora: "Sem problema — prefere amanhã de manhã ou no fim da tarde?" }] },
                      evals: { taxa: 1, passaram: 4, total: 4, aprovado: true, casos: [
                        { caseId: "agenda", nome: "Mantém o próximo passo", passou: true },
                        { caseId: "tom", nome: "Preserva o tom consultivo", passou: true },
                      ] },
                    },
                  },
                  { id: "demo-live", intent: "Qualificar antes de falar preço", status: "published", createdAt: new Date(Date.now() - 8 * 86400000).toISOString() },
                ]) as ChangeEvidence[]}
                relativeTime={tempoRelativo}
                publishing={revIndo}
                publishError={revErro}
                onTest={(change) => { setMudancaTesteId(change.id); setModoTeste("ensaio"); abrirAba("testar"); }}
                onPublish={(change) => void publicarEmRev(change.id)}
              />
            </div>
          )}
        </div>
      </div>

      {modal && <LigarModulo agent={agent} u={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
