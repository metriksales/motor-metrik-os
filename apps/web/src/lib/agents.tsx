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
  /** modo logado: falha REAL da API (nunca mascarada com o demo) */
  erro?: string;
}

const PALETTE = ["#58aae4", "#3b82f6", "#6366f1", "#3fb950", "#fbbf24", "#58aae4", "#f85149", "#60a5fa"];

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
    // Herda do template SÓ A APARÊNCIA: ícone, cor, papel e escudo.
    //
    // Nada que seja DADO vem junto (S-007): `work` trazia reuniões e follow-ups
    // de gente que não existe ("Marina Alves, hoje 16:00"), `mapa`, `fluxo`,
    // `upgrades` e `features` traziam configuração que a conta nunca ligou.
    // Antes bastava o agente real se chamar "Atendente" para vestir tudo isso.
    return {
      id: row.id,
      name: row.name,
      glyph: tpl.glyph,
      color: tpl.color,
      papel: tpl.papel,
      shield: tpl.shield,
      tipo,
      state: state ?? "idle",
      real: true,
      version: row.currentSpecVersion ?? 0,
      agora: "de plantão — aguardando o próximo lead",
      live: [],
      insights: [],
      metrics: { execucoes: 0, acertos: 0, erros: 0, custo: "R$ 0,00" },
      simCenario: "",
      sim: [],
      integracoes: tpl.integracoes,
      work: undefined,
      mapa: undefined,
      fluxo: [],
      upgrades: [],
      features: [],
    };
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
  // Numa conta real a lista começa VAZIA (S-007): antes ela começava com os 9
  // agentes de demonstração, então o cliente via uma frota fictícia até a API
  // responder — e o skeleton de carregamento nunca aparecia, porque a lista
  // "já tinha" itens.
  const [agents, setAgents] = useState<Agent[]>(() => (auth.demo ? AGENTS : []));
  const [source, setSource] = useState<Source>("demo");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = (await api.listAgents(auth.getToken)) as DbAgent[];
        if (!alive) return;
        setErro(undefined);
        if (Array.isArray(rows) && rows.length > 0) {
          setAgents(rows.map(mapReal));
          setSource("neon");
        } else if (auth.demo) {
          // sem banco/sem auth no modo demo → mantém a maquete bonita
          setAgents(AGENTS);
          setSource("demo");
        } else {
          // LOGADO com org vazia: estado honesto — nada de mock fingindo ser real
          setAgents([]);
          setSource("neon");
        }
      } catch (e) {
        if (!alive) return;
        if (auth.demo) {
          setAgents(AGENTS);
          setSource("demo");
        } else {
          // LOGADO com falha real: mostra o erro, não a maquete
          console.error("[agents] control API falhou:", e);
          setAgents([]);
          setSource("neon");
          setErro(e instanceof Error ? e.message : "falha ao falar com a API");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [auth.getToken, auth.demo]);

  const byId = (id: string) => agents.find((a) => a.id === id);
  return <Ctx.Provider value={{ agents, byId, source, loading, erro }}>{children}</Ctx.Provider>;
}

export const useAgents = () => useContext(Ctx);
