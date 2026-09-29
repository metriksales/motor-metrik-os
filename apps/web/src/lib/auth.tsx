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
  orgDesc: "Demonstração",
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
      // AS DUAS JUNTAS, e só então mostra a tela.
      //
      // Em sequência, havia uma janela em que `eu` já tinha chegado e `contas`
      // não: nessa janela o nome da conta caía no texto de reserva ("Sua
      // conta"), porque ele sai de procurar o `orgId` dentro de `contas`. Era
      // meio quadro de nome errado toda vez que a tela abria.
      //
      // `contas` pode falhar sem derrubar a sessão — quem decide se você está
      // dentro é o `eu`. Por isso ela vira lista vazia em vez de exceção.
      const [dados, listaDeContas] = await Promise.all([
        apiAuth.eu() as Promise<{ email: string; orgId: string; role: string }>,
        (apiAuth.contas() as Promise<Conta[]>).catch(() => [] as Conta[]),
      ]);
      setEu(dados);
      setContas(listaDeContas);
      setEstado("dentro");
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
          // SEM `location.reload()`, de propósito.
          //
          // Quem garante que nada da conta anterior sobrevive é o
          // `key={orgId}` no `AgentsProvider` (ver main.tsx): mudar a chave
          // remonta a árvore inteira e refaz todo fetch. O reload era uma
          // segunda camada em cima disso — e era ela que deixava a troca feia.
          //
          // O motivo é do navegador, não do React: ao recarregar, ele SEGURA o
          // último quadro pintado até o documento novo estar pronto. Como o
          // reload vinha logo depois de atualizar o estado, sem dar ao React a
          // chance de pintar, o quadro segurado era o da conta ANTIGA. Daí a
          // conta velha aparecer por um instante DEPOIS de a página recarregar.
          await carregar();
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
