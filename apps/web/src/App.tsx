import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gauge, Search, Sun, Moon, Wand2, ChevronsUpDown, CornerDownLeft, ArrowRight, Bell, MessageCircle, Menu, X, Sparkles, PanelLeftClose, PanelLeftOpen } from "lucide-react";

type SubId = "trabalho" | "aovivo" | "estrutura" | "melhorar";
import { NAV, type ViewId } from "./data";
import { useAgents } from "./lib/agents";
import { usePendencias, useTituloAoVivo } from "./lib/live";
import { cx, Toggle } from "./ui";
import Inicio from "./views/Inicio";
import Agentes from "./views/Agentes";
import AoVivo from "./views/AoVivo";
import AgentDetail from "./views/AgentDetail";
import Modulos from "./views/Modulos";
import Conexoes from "./views/Conexoes";
import Admin from "./views/Admin";
import { MenuDaPessoa, SeletorDeConta } from "./views/SeletorDeConta";
import { useMotorAuth } from "./lib/auth";

export default function App() {
  const [view, setView] = useState<ViewId>("inicio");
  const [agentId, setAgentId] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [palette, setPalette] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [wa, setWa] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  // menu lateral recolhível (lembra a escolha por navegador)
  const [sideCollapsed, setSideCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("motor:side") === "1"; } catch { return false; }
  });
  const toggleSide = () => setSideCollapsed((v) => {
    const n = !v;
    try { localStorage.setItem("motor:side", n ? "1" : "0"); } catch { /* sem storage */ }
    return n;
  });
  const [agentSub, setAgentSub] = useState<SubId | undefined>(undefined);
  const auth = useMotorAuth();
  const { agents, byId, erro, loading: agentsLoading } = useAgents();
  // "no ar" de verdade: conta a frota, não um selo fixo (S-007)
  const noAr = agents.filter((a) => a.state === "ativo").length;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
      if (e.key === "Escape") setPalette(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (v: ViewId) => { setView(v); setAgentId(null); setPalette(false); setNotifOpen(false); setMobileMenu(false); };
  const openAgent = (id: string, sub?: SubId) => { setAgentId(id); setAgentSub(sub); setView("agentes"); setPalette(false); setNotifOpen(false); setMobileMenu(false); };

  // celular: as 3 telas que o cliente usa toda hora ficam na barra de baixo;
  // o resto (Módulos/Conexões/Admin) entra no "Mais". Sempre há como voltar.
  // Módulos e Conexões ainda são MAQUETE (nada ali consulta a conta). Ficam
  // fora da navegação de quem está logado até S-019 e S-030 trazerem dado real
  // — telas que afirmam "ligado · no ar e funcionando" sem ter consultado nada
  // são a pior mentira do painel (S-007).
  const MAQUETE: ViewId[] = ["modulos", "conexoes"];
  const navVisivel = NAV.filter((n) => auth.demo || !MAQUETE.includes(n.id));

  const NAV_MOBILE = navVisivel.filter((n) => ["inicio", "agentes", "aovivo"].includes(n.id));
  const NAV_MAIS = navVisivel.filter((n) => !["inicio", "agentes", "aovivo"].includes(n.id));
  const NAV_OPERAR = navVisivel.filter((n) => ["inicio", "agentes", "aovivo"].includes(n.id));
  const NAV_CONSTRUIR = navVisivel.filter((n) => ["modulos", "conexoes"].includes(n.id));
  const NAV_GESTAO = navVisivel.filter((n) => n.id === "admin");

  // se a pessoa estava numa tela de maquete e saiu do demo, volta pro Início
  const nav = navVisivel.find((n) => n.id === view) ?? navVisivel[0];
  const agent = agentId ? byId(agentId) : null;
  // Dentro de um agente, a navegação global vira um rail silencioso. O Estúdio
  // é a tarefa principal e não deve disputar largura com o menu completo.
  const compactSide = sideCollapsed || Boolean(agent);
  const ativos = agents.filter((a) => a.state === "ativo").length;
  const pendencias = usePendencias();
  useTituloAoVivo(); // alerta "(N)" no título quando a aba está em 2º plano
  // insights críticos só valem no DEMO (mock); logado, o que pede atenção são
  // as pendências reais do porteiro (mudanças do cliente esperando aprovação).
  const notifs = auth.demo
    ? agents.flatMap((a) =>
        (a.insights ?? []).filter((i) => i.tipo === "critico").map((i) => ({ agentId: a.id, agentName: a.name, color: a.color, titulo: i.titulo, texto: i.texto }))
      )
    : [];
  const totalAvisos = notifs.length + pendencias.length;

  const routeKey = agent ? `agent-${agent.id}` : view;

  // trocar de tela SEMPRE volta pro topo — cair no meio da página desorienta
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [routeKey]);

  return (
    <div className="h-screen w-screen flex overflow-hidden relative">

      {/* SIDEBAR — a coluna estrutural do Metrik-OS */}
      <aside className={cx("app-sidebar relative z-20 flex-none hidden md:flex flex-col", compactSide ? "app-sidebar--compact" : "app-sidebar--expanded")}>
        <div className="app-sidebar-brand-row">
          <button type="button" className="app-brand" onClick={() => go("inicio")} aria-label="Ir para o Início" title={compactSide ? "Metrik · Início" : undefined}>
            <span className="app-brand-mark" aria-hidden="true"><Gauge size={19} strokeWidth={2.2} /></span>
            {!compactSide && (
              <span className="app-brand-copy">
                <strong>Metrik</strong>
                <small>Metrik-OS</small>
              </span>
            )}
          </button>
          {!compactSide && (
            <button onClick={toggleSide} className="app-sidebar-toggle" aria-label="Recolher menu" title="Recolher menu">
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>

        {compactSide && !agent && (
          <button onClick={toggleSide} className="app-sidebar-toggle app-sidebar-toggle--compact" aria-label="Expandir menu" title="Expandir menu">
            <PanelLeftOpen size={17} />
          </button>
        )}

        {!compactSide && <SeletorDeConta />}

        <nav className="app-nav" aria-label="Navegação principal">
          {[
            { label: "Operar", items: NAV_OPERAR },
            { label: "Construir", items: NAV_CONSTRUIR },
            { label: "Gestão", items: NAV_GESTAO },
          ]
            // grupo sem item nenhum não vira cabeçalho solto: fora do demo,
            // "Construir" ficava vazio porque Módulos e Conexões estão
            // escondidos até terem dado real (S-007).
            .filter((group) => group.items.length > 0)
            .map((group) => (
            <div className="app-nav-group" key={group.label}>
              {!compactSide && <span className="app-nav-group-label">{group.label}</span>}
              {group.items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => go(n.id)}
                  aria-label={n.label}
                  aria-current={view === n.id ? "page" : undefined}
                  className={cx("app-nav-item", view === n.id && "active")}
                >
                  <span className="app-nav-icon"><n.icon size={18} strokeWidth={view === n.id ? 2.15 : 1.85} /></span>
                  {!compactSide && (
                    <span className="app-nav-copy">
                      <strong>{n.label}</strong>
                      <small>{n.hint}</small>
                    </span>
                  )}
                  {n.id === "agentes" && <span className="app-nav-badge">{agents.length}</span>}
                  {n.id === "aovivo" && <span className="app-nav-live" aria-label="Atividade ao vivo" />}
                  {compactSide && (
                    <span className="app-nav-tooltip" aria-hidden="true">
                      <strong>{n.label}</strong>
                      <small>{n.hint}</small>
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {compactSide ? (
          <div className="app-sidebar-footer app-sidebar-footer--compact">
            <span className="app-operation-beacon" title={`${ativos} agentes trabalhando`}><i /></span>
            <button onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} className="app-sidebar-theme" aria-label="Alternar tema" title="Alternar tema">
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        ) : (
          <div className="app-sidebar-footer">
            <div className="app-operation-status">
              <span className="app-operation-beacon"><i /></span>
              <span>
                <strong>Operação ativa</strong>
                <small>{ativos} {ativos === 1 ? "agente trabalhando" : "agentes trabalhando"}</small>
              </span>
            </div>
            <div className="app-sidebar-meta">
              <span>Motor conectado</span>
              <button onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} className="app-sidebar-theme" aria-label="Alternar tema" title="Alternar tema">
                {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* MAIN */}
      <main className="relative z-10 flex-1 flex flex-col min-w-0">
        {/* agente aberto = modo foco: o Estúdio tem barra própria (nome, voltar,
            toggle, Ao vivo). Esconder o cabeçalho do app aqui MATA o "Bia" e o
            "no ar" repetidos e devolve uma barra inteira de altura. */}
        {!agent && (
        <header className="flex-none flex items-center justify-between gap-3 px-4 md:px-7 h-[62px] border-b border-[var(--line)] glass">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* celular: logo = voltar pro Início (âncora de "casa" sempre visível) */}
            <button onClick={() => go("inicio")} className="md:hidden grid place-items-center rounded-[10px] flex-none" style={{ width: 32, height: 32, background: "var(--grad)", boxShadow: "0 8px 22px -12px #3b82f6" }} aria-label="Início">
              <Gauge size={17} style={{ color: "#08090d" }} strokeWidth={2.2} />
            </button>
            <div className="min-w-0">
              <h1 className="font-display font-semibold text-[16px] tracking-tight leading-none truncate">{nav.label}</h1>
              <p className="text-[11.5px] text-[var(--txt-3)] mt-1 truncate">{nav.hint}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setNotifOpen((o) => !o)} className="btn btn-sm !px-2.5 relative" aria-label="Avisos">
                <Bell size={15} />
                {totalAvisos > 0 && (
                  <span className="absolute -top-1 -right-1 grid place-items-center text-[9px] font-mono rounded-full" style={{ minWidth: 16, height: 16, background: "#fbbf24", color: "#0a0714", fontWeight: 700 }}>{totalAvisos}</span>
                )}
              </button>
              <AnimatePresence>
                {notifOpen && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 mt-2 w-[320px] card !rounded-2xl z-40 overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--line)] flex items-center gap-2">
                      <Bell size={14} style={{ color: "#fbbf24" }} />
                      <span className="font-display font-semibold text-[13.5px]">Seus robôs pedem atenção</span>
                    </div>
                    <div className="p-2">
                      {totalAvisos === 0 ? (
                        <div className="text-[12.5px] text-[var(--txt-3)] p-3">Nada pendente 🎉</div>
                      ) : (
                        <>
                          {/* PENDÊNCIAS do porteiro: o pedido do cliente esperando o aval dele */}
                          {pendencias.map((p) => {
                            const nota = p.impact?.evals?.taxa != null ? (p.impact.evals.taxa * 10).toFixed(1).replace(".", ",") : null;
                            return (
                              <button key={p.id} onClick={() => openAgent(p.agentId, "melhorar")} className="w-full text-left rounded-xl p-2.5 hover:bg-[var(--surface-2)] transition-colors flex gap-2.5">
                                <span className="grid place-items-center rounded-md flex-none mt-0.5" style={{ width: 18, height: 18, background: "rgba(63,185,80,.16)", border: "1px solid rgba(63,185,80,.34)", color: "#3fb950", fontSize: 10, fontWeight: 700 }}>✓</span>
                                <div className="min-w-0">
                                  <div className="text-[12.5px] font-medium">{p.agentName} · passou no porteiro{nota ? ` · nota ${nota}` : ""}</div>
                                  <div className="text-[11.5px] text-[var(--txt-3)] truncate">“{p.intent}” — falta você aprovar</div>
                                </div>
                              </button>
                            );
                          })}
                          {notifs.map((n, i) => (
                            <button key={`n${i}`} onClick={() => openAgent(n.agentId, "aovivo")} className="w-full text-left rounded-xl p-2.5 hover:bg-[var(--surface-2)] transition-colors flex gap-2.5">
                              <span className="dot mt-1.5 flex-none" style={{ background: n.color }} />
                              <div className="min-w-0">
                                <div className="text-[12.5px] font-medium">{n.agentName} · {n.titulo}</div>
                                <div className="text-[11.5px] text-[var(--txt-3)]">{n.texto}</div>
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                    <div className="px-3 py-2.5 border-t border-[var(--line)] flex items-center justify-between">
                      <span className="text-[12px] text-[var(--txt-2)] flex items-center gap-1.5"><MessageCircle size={13} style={{ color: "#3fb950" }} /> Receber no WhatsApp</span>
                      <button onClick={() => setWa((v) => !v)}><Toggle on={wa} /></button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* atalhos de desktop — escondidos no celular (a barra de baixo navega) */}
            <div className="hidden md:flex items-center gap-2">
              <button onClick={() => setPalette(true)} className="btn btn-sm !text-[var(--txt-3)]">
                <Search size={14} /> Buscar
                <span className="font-mono text-[10px] ml-1 px-1.5 py-0.5 rounded border border-[var(--line)] bg-[var(--surface-2)]">⌘K</span>
              </button>
              {/* "No ar" era fixo: mostrava verde até com a frota parada (S-007) */}
              {noAr > 0 && (
                <span className="pill hidden lg:inline-flex"><span className="live-dot" style={{ width: 7, height: 7 }} /> {noAr} no ar</span>
              )}
            </div>
            <button className="btn btn-primary btn-sm !px-2.5 sm:!px-3.5" onClick={() => go("agentes")}>
              <Wand2 size={14} /> <span className="hidden sm:inline">Pedir melhoria</span>
            </button>
            {auth.demo ? (
              <span className="pill hidden sm:inline-flex" title="Modo vitrine — dados de demonstração">Demo</span>
            ) : (
              <MenuDaPessoa />
            )}
          </div>
        </header>
        )}

        {/* agente aberto = MODO WORKSPACE: a tela É o app (sem coluna centrada,
            sem scroll de página — o Estúdio gerencia o scroll por dentro) */}
        <div
          ref={scrollRef}
          className={
            agent
              ? "flex-1 min-h-0 flex flex-col overflow-hidden"
              : "flex-1 min-h-0 overflow-y-auto scroll-thin px-4 md:px-7 py-6 pb-24 md:pb-6"
          }
        >
          {/* modo DEMO: deixa claro que é EXEMPLO — a conta real começa limpa */}
          {auth.demo && (
            <div
              className={
                agent
                  ? "flex-none border-b px-5 py-1.5 text-[11.5px] flex items-center gap-2"
                  : "max-w-[1180px] mx-auto mb-4 rounded-xl border px-4 py-2.5 text-[12.5px] flex items-center gap-2"
              }
              style={{ borderColor: agent ? "var(--line)" : "rgba(59,130,246,.35)", background: "rgba(59,130,246,.08)", color: "var(--txt-2)" }}
            >
              <Sparkles size={13} style={{ color: "#3b82f6" }} className="flex-none" />
              <span><b className="text-[var(--txt)]">Isto é um exemplo</b> — números e conversas de demonstração. A sua conta começa limpa e vai enchendo sozinha conforme a IA trabalha.</span>
            </div>
          )}
          {/* modo LOGADO: falha real da API nunca vira maquete — vira aviso claro */}
          {!auth.demo && erro && (
            <div
              className={agent ? "flex-none border-b px-5 py-2 text-[12.5px]" : "max-w-[1180px] mx-auto mb-4 rounded-xl border px-4 py-3 text-[13px]"}
              style={{ borderColor: "rgba(248,81,73,.4)", background: "rgba(248,81,73,.08)", color: "#f85149" }}
            >
              Não consegui falar com o motor agora: <span className="font-mono">{erro}</span>. A Metrik já enxerga isso do outro lado — se persistir, chama a gente.
            </div>
          )}
          {/* remonte por chave (sem AnimatePresence/exit): trocar de tela SEMPRE
              troca o conteúdo — o mode="wait" prendia o bloco antigo no DOM
              (cicatriz: 2 blocos + removeChild). Fade-in simples, robusto. */}
          <motion.div
            key={routeKey}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, ease: [0.2, 0.7, 0.2, 1] }}
            className={agent ? "flex-1 min-h-0 flex flex-col" : "max-w-[1180px] mx-auto"}
          >
              {!auth.demo && !erro && !agentsLoading && agents.length === 0 ? (
                <div className="card !rounded-2xl px-6 py-10 text-center">
                  <div className="font-display font-semibold text-[17px] mb-2">Sua organização está pronta — os agentes chegam por aqui</div>
                  <p className="text-[13px] text-[var(--txt-3)] max-w-[520px] mx-auto">
                    Ainda não há nenhum agente instalado nesta organização. A Metrik monta e liga o primeiro pra você;
                    assim que ele estiver no ar, esta tela vira o seu painel de acompanhamento ao vivo.
                  </p>
                </div>
              ) : agent ? (
                <AgentDetail key={agent.id} agent={agent} onBack={() => go("agentes")} initialSub={agentSub} />
              ) : (
                <>
                  {view === "inicio" && <Inicio go={go} onOpen={openAgent} />}
                  {view === "agentes" && <Agentes onOpen={openAgent} go={go} />}
                  {view === "aovivo" && <AoVivo onOpen={openAgent} />}
                  {view === "modulos" && <Modulos go={go} onOpen={openAgent} />}
                  {view === "conexoes" && <Conexoes />}
                  {view === "admin" && <Admin />}
                </>
              )}
          </motion.div>
        </div>
      </main>

      {/* COMMAND PALETTE */}
      <AnimatePresence>
        {palette && (
          <motion.div className="fixed inset-0 z-50 flex items-start justify-center pt-[16vh] px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPalette(false)}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div className="relative w-full max-w-[520px] card !rounded-2xl overflow-hidden" initial={{ scale: 0.97, y: -8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: -8 }} transition={{ duration: 0.18 }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--line)]">
                <Search size={16} className="text-[var(--txt-3)]" />
                <input autoFocus placeholder="Ir para…" className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-[var(--txt-4)]" />
                <span className="tick">esc</span>
              </div>
              <div className="p-2">
                {NAV.map((n) => (
                  <button key={n.id} onClick={() => go(n.id)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--surface-2)] transition-colors group">
                    <n.icon size={16} className="text-[var(--txt-2)]" />
                    <span className="text-[13.5px] flex-1 text-left">{n.label}</span>
                    <span className="text-[11.5px] text-[var(--txt-4)]">{n.hint}</span>
                    <CornerDownLeft size={13} className="text-[var(--txt-4)] opacity-0 group-hover:opacity-100" />
                  </button>
                ))}
                <div className="hairline-x my-2" />
                {agents.map((a) => (
                  <button key={a.id} onClick={() => openAgent(a.id)} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[var(--surface-2)] transition-colors">
                    <span className="dot" style={{ background: a.color }} />
                    <span className="text-[13px] flex-1 text-left">{a.name}</span>
                    <span className="text-[11px] text-[var(--txt-4)]">{a.papel}</span>
                  </button>
                ))}
              </div>
              <div className="px-4 py-2.5 border-t border-[var(--line)] flex items-center justify-between text-[11px] text-[var(--txt-4)]">
                <span>Motor · Metrik OS</span>
                <span className="flex items-center gap-1">navegar <ArrowRight size={11} /></span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NAV MOBILE — barra inferior sempre visível (o cliente nunca fica preso) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 glass border-t border-[var(--line)] flex items-stretch" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {NAV_MOBILE.map((n) => {
          const ativo = !agent && view === n.id;
          return (
            <button key={n.id} onClick={() => go(n.id)} className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5" style={{ color: ativo ? "var(--violet-2)" : "var(--txt-3)" }}>
              <n.icon size={20} strokeWidth={ativo ? 2.3 : 1.9} />
              <span className="text-[10px] font-medium">{n.label}</span>
            </button>
          );
        })}
        <button onClick={() => setMobileMenu(true)} className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5" style={{ color: mobileMenu ? "var(--violet-2)" : "var(--txt-3)" }}>
          <Menu size={20} strokeWidth={1.9} />
          <span className="text-[10px] font-medium">Mais</span>
        </button>
      </nav>

      {/* SHEET "MAIS" — o resto das telas + tema, sempre alcançável no celular */}
      <AnimatePresence>
        {mobileMenu && (
          <motion.div className="md:hidden fixed inset-0 z-40 flex items-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileMenu(false)}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div className="relative w-full card !rounded-t-2xl !rounded-b-none overflow-hidden pb-[env(safe-area-inset-bottom)]" initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} transition={{ duration: 0.22 }} onClick={(e) => e.stopPropagation()}>
              <div className="px-4 py-3 border-b border-[var(--line)] flex items-center justify-between">
                <span className="mono-label">Mais</span>
                <button onClick={() => setMobileMenu(false)} className="btn btn-sm !px-2" aria-label="Fechar"><X size={16} /></button>
              </div>
              <div className="p-2">
                {NAV_MAIS.map((n) => (
                  <button key={n.id} onClick={() => go(n.id)} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[var(--surface-2)] transition-colors">
                    <n.icon size={18} className="text-[var(--txt-2)]" />
                    <span className="text-[14px] flex-1 text-left">{n.label}</span>
                    <span className="text-[11.5px] text-[var(--txt-4)]">{n.hint}</span>
                  </button>
                ))}
                <div className="hairline-x my-1.5" />
                <button onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[var(--surface-2)] transition-colors">
                  {theme === "dark" ? <Sun size={18} className="text-[var(--txt-2)]" /> : <Moon size={18} className="text-[var(--txt-2)]" />}
                  <span className="text-[14px] flex-1 text-left">{theme === "dark" ? "Tema claro" : "Tema escuro"}</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
