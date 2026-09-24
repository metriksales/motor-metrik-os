import React from "react";
import ReactDOM from "react-dom/client";
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignIn,
  OrganizationList,
  useAuth,
  useOrganization,
} from "@clerk/clerk-react";
import App from "./App";
import { MotorAuthProvider, type MotorAuth } from "./lib/auth";
import { AgentsProvider } from "./lib/agents";
import { clerkAppearance } from "./lib/clerkTheme";
import "./index.css";

// Clerk é OPCIONAL: sem a chave, o app abre em modo demo (1 org fake).
// Com a chave: exige login E uma organização ativa (a org = o tenant).
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
// denuncia build sem a env (a chave é inlinada em BUILD time: colar no Vercel
// sem redeploy não muda nada — este log é o diagnóstico de 1 segundo).
if (!clerkKey) console.info("Metrik-OS em modo DEMO — build sem VITE_CLERK_PUBLISHABLE_KEY (login desligado).");

// Produção NUNCA cai em demo por acidente (S-007): sem chave de login, o que
// iria ao ar seria uma vitrine com dados fictícios no lugar do painel da conta.
// Aqui a tela DIZ isso, em vez de abrir a maquete como se fosse o produto.
// Para publicar a vitrine de propósito: VITE_ALLOW_DEMO=1 no build.
const demoEmProducaoSemPermissao =
  import.meta.env.PROD && !clerkKey && import.meta.env.VITE_ALLOW_DEMO !== "1";

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", padding: 24, position: "relative", overflow: "hidden" }}>
      <div className="aurora" />
      <div className="grid-bg" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
      <div style={{ textAlign: "center", position: "relative" }}>
        <div className="font-display" style={{ fontWeight: 700, fontSize: 24, letterSpacing: "-0.02em", marginBottom: 6 }}>
          <span className="grad-text">Metrik-OS</span>
        </div>
        <p style={{ color: "var(--txt-3)", fontSize: 13.5, marginBottom: 22 }}>
          sua operação trabalhando sozinha — entre pra observar
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}>{children}</div>
      </div>
    </div>
  );
}

function SignInScreen() {
  return (
    <Centered>
      <SignIn routing="hash" />
    </Centered>
  );
}

// Exige uma organização ativa antes de entrar (multi-tenant: 1 org = 1 cliente).
function RequireOrg({ children }: { children: React.ReactNode }) {
  const { organization, isLoaded } = useOrganization();
  if (!isLoaded) return <Centered><span style={{ color: "var(--txt-3)" }}>carregando…</span></Centered>;
  if (!organization) {
    return (
      <Centered>
        <OrganizationList hidePersonal afterCreateOrganizationUrl="/" afterSelectOrganizationUrl="/" />
      </Centered>
    );
  }
  return <>{children}</>;
}

// Dentro do Clerk: injeta org ativa + getToken no contexto do app.
function ClerkedApp() {
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const name = organization?.name ?? "Organização";
  const value: MotorAuth = {
    demo: false,
    orgId: organization?.id,
    orgName: name,
    orgDesc: "operação",
    orgInitial: name.slice(0, 1).toUpperCase(),
    getToken: () => getToken(),
  };
  return (
    <MotorAuthProvider value={value}>
      {/* key = org ativa: TROCAR de conta remonta os providers e refaz todo
          fetch — sem isso o painel seguia mostrando os dados da org anterior */}
      <AgentsProvider key={organization?.id ?? "sem-org"}>
        <App />
      </AgentsProvider>
    </MotorAuthProvider>
  );
}

const demoValue: MotorAuth = {
  demo: true,
  orgName: "Vega Consultoria",
  orgDesc: "operação comercial (demo)",
  orgInitial: "V",
};

/** Produção sem login configurado: diz o que houve, em vez de abrir a maquete. */
function DemoBloqueado() {
  return (
    <Centered>
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>Login não configurado</h1>
      <p style={{ maxWidth: 460, lineHeight: 1.5, color: "var(--txt-3)" }}>
        Este build subiu sem <code>VITE_CLERK_PUBLISHABLE_KEY</code>. Sem ela, o app abriria em
        modo demonstração — com dados fictícios no lugar dos da sua conta, o que seria pior que
        não abrir.
      </p>
      <p style={{ maxWidth: 460, lineHeight: 1.5, color: "var(--txt-4)", marginTop: 12 }}>
        Configure a chave no projeto e publique de novo. Para mostrar a vitrine de propósito,
        use <code>VITE_ALLOW_DEMO=1</code> no build.
      </p>
    </Centered>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {demoEmProducaoSemPermissao ? (
      <DemoBloqueado />
    ) : clerkKey ? (
      <ClerkProvider publishableKey={clerkKey} afterSignOutUrl="/" appearance={clerkAppearance}>
        <SignedIn>
          <RequireOrg>
            <ClerkedApp />
          </RequireOrg>
        </SignedIn>
        <SignedOut>
          <SignInScreen />
        </SignedOut>
      </ClerkProvider>
    ) : (
      <MotorAuthProvider value={demoValue}>
        <AgentsProvider>
          <App />
        </AgentsProvider>
      </MotorAuthProvider>
    )}
  </React.StrictMode>
);
