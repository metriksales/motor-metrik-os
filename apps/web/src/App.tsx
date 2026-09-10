import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gauge, Search, Sun, Moon, Wand2, ChevronsUpDown, CornerDownLeft, ArrowRight, Bell, MessageCircle } from "lucide-react";

type SubId = "trabalho" | "aovivo" | "estrutura" | "melhorar";
import { NAV, type ViewId } from "./data";
import { useAgents } from "./lib/agents";
import { cx, Toggle } from "./ui";
import Inicio from "./views/Inicio";
import Agentes from "./views/Agentes";
import AoVivo from "./views/AoVivo";
import AgentDetail from "./views/AgentDetail";
import Modulos from "./views/Modulos";
import Conexoes from "./views/Conexoes";
import Admin from "./views/Admin";
import { OrganizationSwitcher, UserButton } from "@clerk/clerk-react";
import { useMotorAuth } from "./lib/auth";

export default function App() {
  const [view, setView] = useState<ViewId>("inicio");
  const [agentId, setAgentId] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [palette, setPalette] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [wa, setWa] = useState(true);
  const [agentSub, setAgentSub] = useState<SubId | undefined>(undefined);
  const auth = useMotorAuth();
  const { agents, byId } = useAgents();

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

  const go = (v: ViewId) => { setView(v); setAgentId(null); setPalette(false); setNotifOpen(false); };
  const openAgent = (id: string, sub?: SubId) => { setAgentId(id); setAgentSub(sub); setView("agentes"); setPalette(false); setNotifOpen(false); };

  const nav = NAV.find((n) => n.id === view)!;
  const agent = agentId ? byId(agentId) : null;
  const ativos = agents.filter((a) => a.state === "ativo").length;
  const notifs = agents.flatMap((a) =>
    (a.insights ?? []).filter((i) => i.tipo === "critico").map((i) => ({ agentId: a.id, agentName: a.name, color: a.color, titulo: i.titulo, texto: i.texto }))
  );

  const routeKey = agent ? `agent-${agent.id}` : view;

  return (
    <div className="h-screen w-screen flex overflow-hidden relative">
      <div className="aurora" />
      <div className="absolute inset-0 grid-bg pointer-events-none" />

      {/* SIDEBAR */}
      <aside className="relative z-10 w-[248px] flex-none hidden md:flex flex-col glass border-r border-[var(--line)] p-3.5">
        <div className="flex items-center gap-2.5 px-1.5 py-2 mb-1">
          <span className="grid place-items-center rounded-[11px] flex-none" style={{ width: 34, height: 34, background: "var(--grad)", boxShadow: "0 8px 22px -10px #8b7cff" }}>
            <Gauge size={19} style={{ color: "#0a0714" }} strokeWidth={2.2} />
          </span>
          <div className="leading-none">
            <div className="font-display font-bold text-[16px] tracking-tight">Metrik</div>
            <div className="mono-label !text-[9px] mt-1">Motor OS</div>
          </div>
        </div>

        {auth.demo ? (
          <button className="w-full flex items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors p-2.5 mb-4">
            <span className="grid place-items-center rounded-lg flex-none text-[12px] font-bold font-display" style={{ width: 30, height: 30, background: "rgba(139,124,255,.2)", color: "#a78bfa", border: "1px solid rgba(139,124,255,.4)" }}>{auth.orgInitial}</span>
            <div className="text-left min-w-0 flex-1">
              <div className="text-[13px] font-medium truncate">{auth.orgName}</div>
              <div className="text-[10.5px] text-[var(--txt-3)] truncate">{auth.orgDesc}</div>
            </div>
            <ChevronsUpDown size={14} className="text-[var(--txt-4)] flex-none" />
          </button>
        ) : (
          <div className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1.5">
            <OrganizationSwitcher
              hidePersonal
              afterCreateOrganizationUrl="/"
              afterSelectOrganizationUrl="/"
              appearance={{
                variables: { colorPrimary: "#8b7cff", colorText: "#f4f4f7", colorBackground: "transparent", borderRadius: "12px" },
                elements: { rootBox: { width: "100%" }, organizationSwitcherTrigger: { width: "100%", justifyContent: "flex-start" } },
              }}
            />
          </div>
        )}

        <nav className="space-y-0.5 flex-1">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => go(n.id)} className={cx("nav-item w-full", view === n.id && "active")}>
              <n.icon size={17} strokeWidth={1.9} className="flex-none" />
              <span className="flex-1 text-left">{n.label}</span>
              {n.id === "agentes" && (
                <span className="grid place-items-center text-[10px] font-mono rounded-full text-[var(--txt-3)]" style={{ minWidth: 17, height: 17, background: "var(--surface-hi)", border: "1px solid var(--line)" }}>{agents.length}</span>
              )}
              {n.id === "aovivo" && <span className="live-dot" style={{ width: 7, height: 7 }} />}
            </button>
          ))}
        </nav>

        <div className="pt-3 mt-2 border-t border-[var(--line)] space-y-2.5">
          <div className="flex items-center justify-between px-1.5">
            <div className="flex items-center gap-2 text-[11px] text-[var(--txt-3)]">
              <span className="dot" style={{ background: "#34d399" }} /> Claude Code
              <span className="dot ml-1" style={{ background: "#34d399" }} /> Codex
            </div>
            <button onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} className="btn-ghost btn !p-1.5 !rounded-lg" aria-label="Alternar tema">
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
          <div className="rounded-xl bg-[var(--surface)] border border-[var(--line)] px-3 py-2.5 flex items-center justify-between">
            <div>
              <div className="text-[11.5px] font-medium">{ativos} agentes no ar</div>
              <div className="text-[10px] text-[var(--txt-4)]">motor blindado</div>
            </div>
            <span className="live-dot" style={{ width: 7, height: 7 }} />
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="relative z-10 flex-1 flex flex-col min-w-0">
        <header className="flex-none flex items-center justify-between gap-4 px-5 md:px-7 h-[62px] border-b border-[var(--line)] glass">
          <div className="min-w-0">
            <h1 className="font-display font-semibold text-[16px] tracking-tight leading-none truncate">{agent ? agent.name : nav.label}</h1>
            <p className="text-[11.5px] text-[var(--txt-3)] mt-1 truncate">{agent ? `Agente · ${agent.papel}` : nav.hint}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setNotifOpen((o) => !o)} className="btn btn-sm !px-2.5 relative" aria-label="Avisos">
                <Bell size={15} />
                {notifs.length > 0 && (
                  <span className="absolute -top-1 -right-1 grid place-items-center text-[9px] font-mono rounded-full" style={{ minWidth: 16, height: 16, background: "#fbbf24", color: "#0a0714", fontWeight: 700 }}>{notifs.length}</span>
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
                      {notifs.length === 0 ? (
                        <div className="text-[12.5px] text-[var(--txt-3)] p-3">Nada pendente 🎉</div>
                      ) : (
                        notifs.map((n, i) => (
                          <button key={i} onClick={() => openAgent(n.agentId, "aovivo")} className="w-full text-left rounded-xl p-2.5 hover:bg-[var(--surface-2)] transition-colors flex gap-2.5">
                            <span className="dot mt-1.5 flex-none" style={{ background: n.color }} />
                            <div className="min-w-0">
                              <div className="text-[12.5px] font-medium">{n.agentName} · {n.titulo}</div>
                              <div className="text-[11.5px] text-[var(--txt-3)]">{n.texto}</div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                    <div className="px-3 py-2.5 border-t border-[var(--line)] flex items-center justify-between">
                      <span className="text-[12px] text-[var(--txt-2)] flex items-center gap-1.5"><MessageCircle size={13} style={{ color: "#34d399" }} /> Receber no WhatsApp</span>
                      <button onClick={() => setWa((v) => !v)}><Toggle on={wa} /></button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button onClick={() => setPalette(true)} className="btn btn-sm !text-[var(--txt-3)] hidden sm:flex">
              <Search size={14} /> Buscar
              <span className="font-mono text-[10px] ml-1 px-1.5 py-0.5 rounded border border-[var(--line)] bg-[var(--surface-2)]">⌘K</span>
            </button>
            <span className="pill hidden lg:inline-flex"><span className="live-dot" style={{ width: 7, height: 7 }} /> No ar</span>
            <button className="btn btn-primary btn-sm" onClick={() => go("agentes")}>
              <Wand2 size={14} /> Pedir melhoria
            </button>
            {auth.demo ? (
              <span className="pill hidden sm:inline-flex" title="Modo demo — sem login (adicione as chaves do Clerk pra ativar contas)">Demo</span>
            ) : (
              <UserButton afterSignOutUrl="/" appearance={{ variables: { colorPrimary: "#8b7cff" }, elements: { avatarBox: { width: 30, height: 30 } } }} />
            )}
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto scroll-thin px-5 md:px-7 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={routeKey}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
              className="max-w-[1180px] mx-auto"
            >
              {agent ? (
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
          </AnimatePresence>
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
    </div>
  );
}
