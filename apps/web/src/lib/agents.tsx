import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Bot } from "lucide-react";
import { AGENTS, type Agent, type AgentState } from "../data";
import { api } from "./api";
import { useMotorAuth } from "./auth";

// Fonte dos agentes: "neon" = veio do banco pela Control API; "demo" = mock.
type Source = "neon" | "demo";

interface AgentsData {
  agents: Agent[];
  byId: (id: string) => Agent | undefined;
  source: Source;
  loading: boolean;
}

const PALETTE = ["#22d3ee", "#8b7cff", "#6366f1", "#34d399", "#fbbf24", "#d16bff", "#fb7185", "#a78bfa"];

type DbAgent = { id: string; name: string; tipo?: string; state?: string; currentSpecVersion?: number | null };

// Mapeia uma linha do banco pro formato rico da tela. Se o NOME casa com um
// template de demonstração (ex.: "Atendente", "Petições"), herda o visual — mas
// SEMPRE com id/nome/tipo/estado/versão REAIS do banco (marcado real:true).
// Sem template, cai num card limpo com telemetria zerada (honesto: sem atividade).
function mapReal(row: DbAgent, i: number): Agent {
  const tpl = AGENTS.find((a) => a.name.toLowerCase() === String(row.name).toLowerCase());
  const tipo: "resposta" | "acao" = row.tipo === "acao" ? "acao" : "resposta";
  const state = (["ativo", "idle", "pausado"].includes(String(row.state)) ? row.state : undefined) as
    | AgentState
    | undefined;

  if (tpl) {
    return { ...tpl, id: row.id, name: row.name, tipo, state: state ?? tpl.state, real: true, version: row.currentSpecVersion ?? 0 };
  }
  return {
    id: row.id,
    name: row.name,
    glyph: Bot,
    papel: tipo === "acao" ? "Executa ações no CRM" : "Responde e qualifica no WhatsApp",
    state: state ?? "idle",
    color: PALETTE[i % PALETTE.length],
    agora: `versão ${row.currentSpecVersion ?? 0} — sem atividade registrada ainda`,
    metrics: { execucoes: 0, acertos: 0, erros: 0, custo: "R$ 0,00" },
    shield: "Núcleo blindado. Você ajusta o que é seguro; o motor não quebra.",
    features: [],
    live: [],
    simCenario: "",
    sim: [],
    insights: [],
    upgrades: [],
    tipo,
    fluxo: [],
    integracoes: [],
    real: true,
    version: row.currentSpecVersion ?? 0,
  };
}

const Ctx = createContext<AgentsData>({
  agents: AGENTS,
  byId: (id) => AGENTS.find((a) => a.id === id),
  source: "demo",
  loading: false,
});

export function AgentsProvider({ children }: { children: ReactNode }) {
  const auth = useMotorAuth();
  const [agents, setAgents] = useState<Agent[]>(AGENTS);
  const [source, setSource] = useState<Source>("demo");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = (await api.listAgents(auth.getToken)) as DbAgent[];
        if (!alive) return;
        if (Array.isArray(rows) && rows.length > 0) {
          setAgents(rows.map(mapReal));
          setSource("neon");
        } else {
          // banco vazio ou sem auth → mantém o demo bonito
          setAgents(AGENTS);
          setSource("demo");
        }
      } catch {
        if (alive) {
          setAgents(AGENTS);
          setSource("demo");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [auth.getToken]);

  const byId = (id: string) => agents.find((a) => a.id === id);
  return <Ctx.Provider value={{ agents, byId, source, loading }}>{children}</Ctx.Provider>;
}

export const useAgents = () => useContext(Ctx);
