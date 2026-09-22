// ESTÚDIO DA IA — a refundação aprovada no canvas: o agente SDR em PARTES,
// com o padrão fixo em 3 zonas (❯ composer → VALENDO AGORA → MUDANÇAS) e a
// bancada NA PRÁTICA sempre à direita. Mudança = DIFF (− antes / + agora),
// progresso = log de terminal. Tudo lido do MOTOR (spec, ledger, evals,
// chat-sandbox) — zero vitrine vestida em agente real.
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Activity, ArrowLeft, ArrowUp, Check, Clock, FileText, FlaskConical, History, Loader2, Lock, Mic, Plus, Radio, ShieldCheck, Sparkles, X } from "lucide-react";
import { type Agent, type Upgrade } from "../data";
import { Robot } from "../Robot";
import { api } from "../lib/api";
import { useMotorAuth } from "../lib/auth";
import { useLive, tempoRelativo } from "../lib/live";
import { AgentBrainMap, type BrainPiece } from "./estudio/AgentBrainMap";

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
                        <button key={o} onClick={() => setEscolhas((s) => ({ ...s, [i]: o }))} className="text-[12.5px] rounded-lg px-3 py-1.5" style={sel ? { background: "var(--e-amber)", color: "#08090d", fontWeight: 600 } : { border: "1px solid var(--e-line)", color: "var(--e-mut)" }}>
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
  const seguradas = cs.filter((r) => ["rejected"].includes(String(r.status)));
  const execsHoje = agent.real ? (stats?.porAgente?.[agent.id]?.execucoes ?? 0) : agent.metrics.execucoes;
  const personalizacoesNoAr = agent.real ? publicadas.length : 4;
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
  const publicarEmRev = async () => {
    if (!emRev || revIndo) return;
    try { setRevErro(null); setRevIndo(true); await api.publicarMudanca(emRev.id, auth.getToken); setTick((x) => x + 1); }
    catch (e) { setRevErro(e instanceof Error ? e.message : "não consegui publicar — retoma pelo chat"); }
    finally { setRevIndo(false); }
  };

  // ── NA PRÁTICA (chat sandbox real) ──
  const [msgs, setMsgs] = useState<MsgT[]>([]);
  const [input, setInput] = useState("");
  const [pensando, setPensando] = useState(false);
  const [feedback, setFeedback] = useState<Record<number, "sim" | "nao">>({});
  const [modoTeste, setModoTeste] = useState<"ar" | "ensaio">("ar");
  const fimRef = useRef<HTMLDivElement>(null);
  useEffect(() => { fimRef.current?.scrollIntoView({ block: "end" }); }, [msgs]);
  // sem mudança pendente, testar "com a mudança nova" não faz sentido → volta pro ar
  useEffect(() => { if (!emRev && modoTeste === "ensaio") setModoTeste("ar"); }, [emRev, modoTeste]);
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
    <div className="est flex-1 min-h-0 flex flex-col pb-[60px] md:pb-0">
      {/* ── cabeçalho do workspace: identidade + estado + recibo compacto ── */}
      <header className="est-agentbar flex-none">
        <div className="est-agentbar-main">
          <button onClick={onBack} title="voltar pra frota" aria-label="voltar pra frota" className="est-icon-btn"><ArrowLeft size={17} /></button>
          <div className="est-agent-avatar"><Robot state={estado} color={agent.color} size={30} /></div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <strong className="text-[16px] truncate">{agent.name}</strong>
              <span className="est-status-dot" data-on={estado !== "pausado" ? "true" : "false"} />
            </div>
            <div className="emo text-[12px] truncate" style={{ color: "var(--e-dim)" }}>
              {agent.tipo === "acao" ? "agente de ação" : "agente de resposta"}{rod ? ` · versão ${rod.versao}` : ""} · {estado === "pausado" ? "pausado" : "no ar"}
            </div>
          </div>

          <div className="hidden lg:flex est-agentbar-stats">
            <div><b>{personalizacoesNoAr}</b><span>ajustes seus<br />no ar</span></div>
            <div><b>{execsHoje}</b><span>atendimentos<br />hoje</span></div>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <button onClick={onAoVivo} title="abrir atividade ao vivo" aria-label="abrir atividade ao vivo" className="est-icon-btn"><Radio size={16} /><span className="hidden xl:inline">Ao vivo</span></button>
            <button onClick={onToggle} title={estado === "pausado" ? "ligar agente" : "pausar agente"} aria-label={estado === "pausado" ? "ligar agente" : "pausar agente"} className="est-switch">
              <span data-on={estado === "pausado" ? "false" : "true"}><i /></span>
            </button>
          </div>
        </div>
        <div className="lg:hidden est-agentbar-mobile-stats">
          <span><b>{personalizacoesNoAr}</b> ajustes seus no ar</span>
          <span><b>{execsHoje}</b> atendimentos hoje</span>
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
        <div className={`${mobilePane === "editar" ? "flex" : "hidden"} xl:flex flex-col min-h-0 w-full min-w-0 xl:w-[352px] xl:min-w-[330px] flex-none est-improve`}>
          <div className="est-improve-head">
            <div>
              <span className="emo">MELHORAR</span>
              <p>Peça uma mudança. Eu mostro o antes e o depois.</p>
            </div>
          </div>

          <div ref={feedRef} className="flex-1 overflow-y-auto scroll-thin px-5 py-5 space-y-5">
            {/* boas-vindas do motor + pontos de partida (ninguém fica olhando pro vazio) */}
            <div className={bolhaMotor}>
              <div className="flex-none mt-0.5"><Robot state="ativo" color={agent.color} size={22} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] leading-relaxed m-0" style={{ color: "var(--e-txt2)" }}>
                  Descreva o que precisa mudar. Eu localizo a peça certa, mostro o antes e o depois e <b style={{ color: "var(--e-txt)" }}>só publico depois do teste.</b>
                </p>
                {trocas.length === 0 && envio.fase === "idle" && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {[
                      "Ensina que o parcelamento é em até 3x sem juros",
                      "Quando o lead sumir, espera 1 dia e manda só 1 follow",
                      "Nunca prometa resultado — fala em acompanhamento",
                    ].map((s) => (
                      <button key={s} onClick={() => setTexto(s)} className="text-[12.5px] rounded-full px-3 py-1.5 text-left" style={{ border: "1px solid var(--e-line)", color: "var(--e-mut)" }}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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

          {/* a caixinha */}
          <div className="flex-none" style={{ borderTop: "1px solid var(--e-line)", padding: "12px 18px" }}>
            <div className="melhorar-campo rounded-xl" style={{ background: "var(--e-surface)", border: "1px solid var(--e-line)", padding: "13px 15px 11px", transition: "border-color .2s, box-shadow .2s" }}>
              <div className="flex items-start gap-2.5">
                <span className="emo text-[15px] mt-0.5" style={{ color: "var(--e-amber)" }}>❯</span>
                <textarea
                  rows={1}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); mandar(); } }}
                  placeholder="pede qualquer mudança na sua IA…"
                  className="flex-1 bg-transparent resize-none outline-none text-[15px] py-0.5"
                  style={{ color: "var(--e-txt)" }}
                />
              </div>
              <div className="flex items-center gap-2.5 mt-2 pt-2" style={{ borderTop: "1px solid var(--e-line-soft)" }}>
                <button onClick={falar} aria-label={gravando ? "parar de gravar" : "falar em vez de escrever"} className={"flex items-center gap-2" + (gravando ? " est-mic-on" : "")} style={{ color: "var(--e-mut)" }}>
                  <Mic size={15} />
                  <span className="emo text-[12.5px]" style={{ color: gravando ? "var(--e-red)" : "var(--e-dim)" }}>{gravando ? "ouvindo… toca pra parar" : "toca pra falar"}</span>
                </button>
                {vozErro && <span className="text-[12.5px]" style={{ color: "var(--e-amber)" }}>{vozErro}</span>}
                <button onClick={mandar} disabled={!texto.trim() || envio.fase === "rodando"} aria-label="enviar o pedido" className="est-btn ml-auto">Enviar <ArrowUp size={13} /></button>
              </div>
            </div>
          </div>
        </div>

        {/* ══ DIREITA · O ARTEFATO (doc vivo do spec — zero token pra desenhar) ══ */}
        <div className={`${mobilePane === "resultado" ? "flex" : "hidden"} xl:flex flex-1 min-w-0 flex-col min-h-0`} style={{ background: "#0a0c10" }}>
          {/* abas do artefato */}
          <div className="hidden xl:flex items-center gap-1 px-4 flex-none" style={{ height: 46, borderBottom: "1px solid var(--e-line)" }}>
            {([
              { id: "artefato" as const, icone: FileText, rotulo: "Como funciona" },
              { id: "testar" as const, icone: FlaskConical, rotulo: "Testar" },
              { id: "exec" as const, icone: Activity, rotulo: "Ao vivo" },
              { id: "historico" as const, icone: History, rotulo: "Mudanças" },
            ]).map((t) => {
              const ativo = aba === t.id;
              const Icone = t.icone;
              return (
                <button key={t.id} onClick={() => abrirAba(t.id)} aria-current={ativo ? "page" : undefined} className="est-tab flex items-center gap-2 px-3.5 h-full text-[13.5px]" style={ativo ? { color: "var(--e-txt)", fontWeight: 600, boxShadow: "inset 0 -2px 0 var(--e-amber)" } : { color: "var(--e-mut)" }}>
                  <Icone size={15} /> {t.rotulo}
                  {t.id === "exec" && <span className="live-dot" style={{ width: 6, height: 6 }} />}
                  {t.id === "historico" && emRev && <span className="est-tab-badge" aria-label="uma mudança pendente">1</span>}
                </button>
              );
            })}
          </div>

          {/* ── COMO FUNCIONA — caminho primeiro, peça selecionada abaixo ── */}
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
              <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
                <div className="est-artifact-shell">
                  <AgentBrainMap agentName={agent.name} pieces={pecas} selectedId={aberta.id} onSelect={setPeca} real={!!agent.real} />

                  <article className="est-artifact-doc" aria-labelledby="selected-piece-title">
                    <header className="est-piece-head">
                      <div className="est-piece-icon" style={{ color: aberta.cor }} aria-hidden="true">{aberta.glifo}</div>
                      <div className="min-w-0">
                        <span className="emo est-kicker">PEÇA SELECIONADA</span>
                        <h2 id="selected-piece-title">{aberta.nome} — como {agent.name} {aberta.id === "conversa" ? "conversa" : "trabalha"}</h2>
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
                          <span className="emo est-kicker">O PAPEL DESTA PEÇA</span>
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
                              <span className="emo est-kicker">COMO ELA FALA</span>
                              <p>{c?.identidade ?? "Identidade ainda não descrita."}</p>
                            </section>
                            <section>
                              <span className="emo est-kicker">O QUE ELA OFERECE</span>
                              <p>{c?.oferta ?? "Oferta ainda não descrita."}</p>
                            </section>
                          </div>

                          <section className="est-rules" aria-labelledby="agent-rules-title">
                            <div className="est-section-head">
                              <div><span className="emo est-kicker">DECISÕES DO NÚCLEO</span><h3 id="agent-rules-title">Regras que guiam a conversa</h3></div>
                              <span>{regras.length} {regras.length === 1 ? "regra" : "regras"}</span>
                            </div>
                            <div className="est-card overflow-hidden">
                              {regras.map((r, i) => {
                                const fato = /^fato:/i.test(r);
                                const sua = fato || suasIntents.has(r.trim().toLowerCase());
                                const nova = publicadas.length > 0 && r.trim().toLowerCase() === String(publicadas[0].intent ?? "").trim().toLowerCase();
                                const badge = fato ? { t: "FATO", c: "#3fb950" } : sua ? { t: "SEU AJUSTE", c: "#e8b04b" } : { t: "NÚCLEO", c: "#7d8694" };
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
                          <span className="emo est-kicker">O PAPEL DESTA PEÇA</span>
                          <h3>{aberta.resumo}.</h3>
                          {aberta.meta && <div className="est-module-now"><span className="emo">AGORA</span><b>{aberta.meta}</b></div>}
                          <p>Para mudar como esta peça age, descreva o ajuste em Melhorar. O guardião testa antes de publicar.</p>
                        </section>
                      )}

                      {aberta.estado === "off" && (
                        <section className="est-module-detail">
                          <span className="emo est-kicker">DISPONÍVEL PARA LIGAR</span>
                          <h3>{aberta.resumo}.</h3>
                          {aberta.upg?.resultado && <div className="est-upgrade-result">{aberta.upg.resultado}</div>}
                          {aberta.upg ? <button onClick={() => setModal(aberta.upg!)} className="est-btn"><Plus size={14} /> Ligar esta peça</button> : <p>Na sua conta, a Metrik liga esta peça e ela entra no caminho depois de ensaio e aprovação.</p>}
                        </section>
                      )}

                      <footer className="est-truth-note">Esta visão é montada com o cérebro atual do agente. Melhorias só aparecem aqui depois de publicadas.</footer>
                    </div>
                  </article>
                </div>
              </div>
            );
          })()}

          {/* ── ABA TESTAR ── */}
          {aba === "testar" && (
            <div className="flex-1 min-h-0 flex flex-col est-entra">
              <div className="flex-none px-5 pt-3 pb-2.5" style={{ borderBottom: "1px solid var(--e-line)" }}>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[13.5px] font-semibold">Testar {agent.name}</span>
                  <span className="text-[12px]" style={{ color: "var(--e-dim)" }}>você é o lead — veja como ela responde</span>
                  {run.r?.evals && <span className="emo text-[12px]" style={{ color: run.r.evals.aprovado ? "var(--e-green)" : "var(--e-red)" }}>{run.r.evals.passaram}/{run.r.evals.total} travas de pé</span>}
                  <button onClick={() => void rodarTestes()} disabled={run.status === "rodando"} className="est-btn2 ml-auto">{run.status === "rodando" ? <Loader2 size={13} className="animate-spin" /> : <FlaskConical size={13} />} {run.r ? "Rodar de novo" : "Rodar os testes"}</button>
                </div>
                {/* a escolha da versão SÓ aparece quando há mudança pendente — aí sim
                    faz sentido: testar como está no ar × com a mudança que você ainda não publicou */}
                {agent.real && emRev && (
                  <div className="flex items-center gap-2.5 mt-2.5 flex-wrap">
                    <span className="text-[12px]" style={{ color: "var(--e-mut)" }}>conversar com:</span>
                    <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #26303a" }}>
                      <button onClick={() => setModoTeste("ar")} className="text-[12px] px-3 py-1.5" style={modoTeste === "ar" ? { background: "var(--e-green)", color: "#08090d", fontWeight: 600 } : { color: "var(--e-mut)" }}>a versão no ar hoje</button>
                      <button onClick={() => setModoTeste("ensaio")} className="text-[12px] px-3 py-1.5 flex items-center gap-1" style={modoTeste === "ensaio" ? { background: "var(--e-amber)", color: "#08090d", fontWeight: 600 } : { color: "var(--e-mut)" }}>com a mudança nova <Sparkles size={11} /></button>
                    </div>
                    <span className="text-[12.5px]" style={{ color: "var(--e-dim)" }}>{modoTeste === "ensaio" ? "prévia da mudança que ainda não foi pro ar" : "o que os leads recebem agora"}</span>
                  </div>
                )}
                {run.status === "rodando" && <div className="flex items-center gap-2 mt-2 text-[12.5px]" style={{ color: "var(--e-mut)" }}><span className="est-spin" /> o robô-lead está conversando com ela…</div>}
                {run.erro && <div className="text-[12.5px] mt-1.5" style={{ color: "var(--e-red)" }}>{run.erro}</div>}
                {run.r?.evals?.casos && (
                  <div className="emo text-[12.5px] mt-2 max-h-[160px] overflow-y-auto scroll-thin">
                    {run.r.evals.casos.map((caso: any, i: number) => (
                      <div key={caso.caseId ?? i} className="py-0.5 flex gap-2.5">
                        <span style={{ color: caso.passou ? "var(--e-green)" : "var(--e-red)" }}>{caso.passou ? "✓" : "✗"}</span>
                        <span className="flex-1 truncate" style={{ color: caso.passou ? "var(--e-txt2)" : "var(--e-red)" }}>{caso.nome}</span>
                        {run.r.ms?.[i] != null && <span style={{ color: "var(--e-dim)" }}>{(run.r.ms[i] / 1000).toFixed(1)}s</span>}
                        {!caso.passou && <button onClick={() => setTexto(`A trava "${caso.nome}" quebrou no teste (${caso.falhas[0] ?? ""}). Reforça: `)} className="emo text-[12px]" style={{ color: "var(--e-amber)" }}>corrigir</button>}
                      </div>
                    ))}
                    {run.r?.modo === "roteiro" && <div className="text-[12.5px] pt-1" style={{ color: "var(--e-amber)" }}>conferido no roteiro (sem cérebro) — a Metrik liga a chave e vira ataque real</div>}
                  </div>
                )}
              </div>
              <div className="flex-1 px-5 py-4 space-y-2.5 overflow-y-auto" style={{ background: "#0b141a", minHeight: 0 }}>
                {msgs.length === 0 && (
                  <div className="text-center text-[13px] py-10" style={{ color: "#8696a0" }}>
                    Você é o lead — escreve como um cliente escreveria, fora do CRM.
                  </div>
                )}
                {msgs.map((m, i) =>
                  m.de === "voce" ? (
                    <div key={i} className="ml-auto max-w-[78%] rounded-lg px-3.5 py-2" style={{ background: "#005c4b", borderTopRightRadius: 3 }}>
                      <div className="text-[14px]" style={{ color: "#e9edef" }}>{m.texto}</div>
                    </div>
                  ) : (
                    <div key={i} className="max-w-[88%]">
                      <div className="rounded-lg px-3.5 py-2" style={{ background: m.aviso ? "rgba(232,176,75,.12)" : "#1b242b", borderTopLeftRadius: 3, border: m.aviso ? "1px solid rgba(232,176,75,.35)" : undefined }}>
                        <div className="text-[14px] leading-relaxed" style={{ color: m.aviso ? "#e8b04b" : "#e9edef" }}>{m.texto}</div>
                      </div>
                      {!m.aviso && (
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {m.fonte && <span className="emo text-[12px] rounded-full px-2 py-0.5" style={{ color: "var(--e-green)", background: "rgba(63,185,80,.1)", border: "1px solid rgba(63,185,80,.3)" }}>{m.fonte}</span>}
                          {feedback[i] === "sim" ? (
                            <span className="emo text-[12px] font-bold rounded px-2 py-0.5" style={{ background: "var(--e-green)", color: "#08090d" }}>✓ é isso</span>
                          ) : feedback[i] === "nao" ? (
                            <span className="emo text-[12px] rounded px-2 py-0.5" style={{ color: "var(--e-red)", border: "1px solid rgba(248,81,73,.4)" }}>corrigindo…</span>
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
                {pensando && <div className="text-[12px]" style={{ color: "#8696a0" }}>digitando…</div>}
                <div ref={fimRef} />
              </div>
              <div className="px-5 py-2.5 flex-none" style={{ borderTop: "1px solid var(--e-line)" }}>
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {sugestoes.map((s) => (
                    <button key={s} onClick={() => void perguntar(s)} className="text-[12.5px] rounded-full px-3 py-1" style={{ border: "1px solid var(--e-line)", color: "var(--e-mut)" }}>“{s}”</button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void perguntar(); } }}
                    placeholder="escreve como um lead…"
                    className="flex-1 rounded-lg px-3.5 py-2.5 text-[14px] outline-none min-w-0"
                    style={{ background: "var(--e-surface)", border: "1px solid var(--e-line)", color: "var(--e-txt)" }}
                  />
                  <button onClick={() => void perguntar()} disabled={!input.trim() || pensando} className="grid place-items-center rounded-lg flex-none" style={{ width: 36, height: 36, background: "var(--e-amber)" }}>
                    {pensando ? <Loader2 size={14} className="animate-spin" style={{ color: "#08090d" }} /> : <ArrowUp size={16} style={{ color: "#08090d" }} />}
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-2 pt-2 emo text-[12px]" style={{ borderTop: "1px solid var(--e-line-soft)", color: "var(--e-dim)" }}>
                  <span>{msgs.filter((m) => m.de === "voce").length} perguntas</span>
                  <span style={{ color: "var(--e-green)" }}>{nSim} é isso ✓</span>
                  {nNao > 0 && <span style={{ color: "var(--e-red)" }}>{nNao} corrigindo</span>}
                  <span className="ml-auto">o “corrigir” escreve o pedido por você</span>
                </div>
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

          {/* ── ABA HISTÓRICO — linha do tempo (trilho + nós), texto em 2 linhas ── */}
          {aba === "historico" && (() => {
            type Item = { texto: string; estado: "rev" | "ar" | "seg"; quando?: string; ganho?: string };
            const itens: Item[] = agent.real
              ? [
                  ...(emRev ? [{ texto: emRev.intent, estado: "rev" as const, quando: emRev.createdAt ? `há ${tempoRelativo(emRev.createdAt)}` : undefined }] : []),
                  ...publicadas.map((r) => ({ texto: r.intent, estado: "ar" as const, quando: r.createdAt ? `há ${tempoRelativo(r.createdAt)}` : undefined })),
                  ...seguradas.map((r) => ({ texto: r.intent, estado: "seg" as const, quando: r.createdAt ? `há ${tempoRelativo(r.createdAt)}` : undefined })),
                ]
              : [
                  { texto: "ao negar, oferece outro caminho", estado: "ar", quando: "há 3 dias", ganho: "+4 leads voltaram" },
                  { texto: "25% de desconto — passa do teto do núcleo", estado: "seg", quando: "há 4 dias" },
                ];
            const META = {
              rev: { cor: "var(--e-amber)", rot: "EM REVISÃO", pill: { color: "var(--e-amber)", border: "1px solid rgba(232,176,75,.5)" } },
              ar: { cor: "var(--e-green)", rot: "✓ NO AR", pill: { color: "#08090d", background: "var(--e-green)" } },
              seg: { cor: "var(--e-red)", rot: "✗ SEGURADA", pill: { color: "var(--e-red)", border: "1px solid rgba(248,81,73,.4)" } },
            } as const;
            const clamp2 = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" };
            return (
              <div className="flex-1 overflow-y-auto scroll-thin est-entra">
                <div className="flex items-center gap-2.5 px-6 py-3.5" style={{ borderBottom: "1px solid var(--e-line)" }}>
                  <span className="text-[13.5px] font-semibold">Tudo que você já mudou</span>
                  <span className="text-[12px] ml-auto" style={{ color: "var(--e-dim)" }}>{agent.real ? `${publicadas.length} no ar · ${seguradas.length} seguradas${emRev ? " · 1 em revisão" : ""}` : "demonstração"}</span>
                </div>

                {itens.length === 0 ? (
                  <div className="px-6 py-10 text-[14px]" style={{ color: "var(--e-dim)" }}>Sua primeira mudança aparece aqui — com data, status e o texto do pedido.</div>
                ) : (
                  <div className="px-6 py-6">
                    <div className="relative">
                      {/* o trilho */}
                      <div className="absolute top-2 bottom-2" style={{ left: 7, width: 1, background: "var(--e-line)" }} />
                      {itens.map((it, i) => {
                        const m = META[it.estado];
                        return (
                          <div key={i} className="relative pl-9 pb-6 last:pb-0 est-entra" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
                            {/* o nó */}
                            <span className="absolute rounded-full" style={{ left: 0, top: 3, width: 16, height: 16, background: m.cor, border: "3px solid #0a0c10" }}>
                              {it.estado === "rev" && <span className="est-mic-on absolute inset-0 rounded-full" style={{ background: m.cor }} />}
                            </span>
                            <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                              <span className="emo text-[12px] font-bold rounded px-2 py-0.5" style={m.pill}>{m.rot}</span>
                              {it.ganho && <span className="emo text-[12px]" style={{ color: "var(--e-green)" }}>{it.ganho}</span>}
                              <span className="emo text-[12.5px]" style={{ color: "var(--e-dim)" }}>{it.quando}</span>
                            </div>
                            <p className="text-[14.5px] leading-relaxed m-0" style={{ color: it.estado === "seg" ? "var(--e-mut)" : "var(--e-txt)", ...clamp2 }}>{it.texto}</p>
                            {it.estado === "rev" && agent.real && (
                              <div className="flex items-center gap-2.5 mt-3 flex-wrap">
                                <button onClick={() => void publicarEmRev()} disabled={revIndo} className="est-btn">{revIndo ? <Loader2 size={12} className="animate-spin" /> : null} Publicar</button>
                                <button onClick={() => abrirAba("testar")} className="est-btn2"><FlaskConical size={12} /> Testar antes</button>
                                {revErro && <span className="text-[12px]" style={{ color: "var(--e-red)" }}>{revErro}</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {modal && <LigarModulo agent={agent} u={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
