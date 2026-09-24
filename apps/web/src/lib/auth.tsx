import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { auth as apiAuth } from "./api";

// Contexto de autenticação/conta do app (S-045 — sem Clerk).
//
// A sessão é um cookie httpOnly: o JavaScript não vê o token, e é isso que
// queremos. O que o front guarda é só o retrato de quem está logado, lido de
// /api/auth?acao=eu.
export type Conta = { orgId: string; nome: string; role: string };

export type MotorAuth = {
  /** vitrine: sem login, com dados de demonstração assumidos como tal */
  demo: boolean;
  carregando: boolean;
  email?: string;
  role?: string;
  orgId?: string;
  orgName: string;
  orgDesc: string;
  orgInitial: string;
  contas: Conta[];
  trocarConta: (orgId: string) => Promise<void>;
  sair: () => Promise<void>;
  recarregar: () => Promise<void>;
  /** herdado do Clerk; a sessão viaja em cookie e não há token aqui */
  getToken?: () => Promise<string | null>;
};

const DEMO: MotorAuth = {
  demo: true,
  carregando: false,
  orgName: "Vega Consultoria",
  orgDesc: "demonstração",
  orgInitial: "V",
  contas: [],
  trocarConta: async () => {},
  sair: async () => {},
  recarregar: async () => {},
};

const MotorAuthContext = createContext<MotorAuth>(DEMO);

export const MotorAuthProvider = MotorAuthContext.Provider;

export function useMotorAuth(): MotorAuth {
  return useContext(MotorAuthContext);
}

/** Estado possível da sessão, para o main.tsx decidir o que renderizar. */
export type EstadoSessao = "carregando" | "fora" | "dentro" | "demo";

export function useSessao(modoDemo: boolean) {
  const [estado, setEstado] = useState<EstadoSessao>(modoDemo ? "demo" : "carregando");
  const [eu, setEu] = useState<{ email: string; orgId: string; role: string } | null>(null);
  const [contas, setContas] = useState<Conta[]>([]);

  const carregar = useCallback(async () => {
    if (modoDemo) return;
    try {
      const dados = (await apiAuth.eu()) as { email: string; orgId: string; role: string };
      setEu(dados);
      setEstado("dentro");
      try {
        setContas((await apiAuth.contas()) as Conta[]);
      } catch {
        setContas([]);
      }
    } catch {
      setEu(null);
      setEstado("fora");
    }
  }, [modoDemo]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Convite chega por link (/convite?t=…): depois de entrar, aceita e limpa a URL.
  useEffect(() => {
    if (estado !== "dentro") return;
    const url = new URL(window.location.href);
    const token = url.searchParams.get("t");
    if (!token || !url.pathname.startsWith("/convite")) return;
    (async () => {
      try {
        await apiAuth.aceitarConvite(token);
        await carregar();
      } catch (e) {
        console.error("[convite]", e);
      } finally {
        window.history.replaceState({}, "", "/");
      }
    })();
  }, [estado, carregar]);

  const valor: MotorAuth = modoDemo
    ? DEMO
    : {
        demo: false,
        carregando: estado === "carregando",
        email: eu?.email,
        role: eu?.role,
        orgId: eu?.orgId,
        orgName: contas.find((c) => c.orgId === eu?.orgId)?.nome ?? "Sua conta",
        orgDesc: eu?.email ?? "",
        orgInitial: (contas.find((c) => c.orgId === eu?.orgId)?.nome ?? eu?.email ?? "M").slice(0, 1).toUpperCase(),
        contas,
        trocarConta: async (orgId: string) => {
          await apiAuth.trocarConta(orgId);
          await carregar();
          // a conta mudou: tudo em tela precisa ser relido do zero
          window.location.reload();
        },
        sair: async () => {
          await apiAuth.sair();
          window.location.href = "/";
        },
        recarregar: carregar,
      };

  return { estado, valor, recarregar: carregar };
}

export function ProvedorDeSessao({ valor, children }: { valor: MotorAuth; children: ReactNode }) {
  return <MotorAuthProvider value={valor}>{children}</MotorAuthProvider>;
}
