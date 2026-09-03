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
import "./index.css";

// Clerk é OPCIONAL: sem a chave, o app abre em modo demo (1 org fake).
// Com a chave: exige login E uma organização ativa (a org = o tenant).
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", padding: 24 }}>
      <div style={{ textAlign: "center" }}>
        <div className="font-display" style={{ fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em", marginBottom: 18 }}>
          Metrik <span className="grad-text">Motor OS</span>
        </div>
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
      <App />
    </MotorAuthProvider>
  );
}

const demoValue: MotorAuth = {
  demo: true,
  orgName: "Vega Consultoria",
  orgDesc: "operação comercial (demo)",
  orgInitial: "V",
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {clerkKey ? (
      <ClerkProvider publishableKey={clerkKey} afterSignOutUrl="/">
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
        <App />
      </MotorAuthProvider>
    )}
  </React.StrictMode>
);
