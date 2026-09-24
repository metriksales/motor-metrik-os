import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Entrar from "./views/Entrar";
import { ProvedorDeSessao, useSessao } from "./lib/auth";
import { AgentsProvider } from "./lib/agents";
import "./index.css";

// Autenticação PRÓPRIA (S-045). O Clerk saiu: a sessão é um cookie httpOnly
// emitido por /api/auth, e a conta ativa vive na sessão, no servidor.
//
// Modo VITRINE (demo): ligado só de propósito, com VITE_ALLOW_DEMO=1. Sem ele,
// quem não tem sessão vê a tela de entrada — nunca a maquete (S-007).
const modoDemo = import.meta.env.VITE_ALLOW_DEMO === "1";

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", padding: 24, position: "relative", overflow: "hidden" }}>
      <div className="aurora" />
      <div className="grid-bg" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
      <div style={{ textAlign: "center", position: "relative" }}>
        <div className="font-display" style={{ fontWeight: 700, fontSize: 24, letterSpacing: "-0.02em", marginBottom: 6 }}>
          <span className="grad-text">Metrik-OS</span>
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>{children}</div>
      </div>
    </div>
  );
}

function Raiz() {
  const { estado, valor, recarregar } = useSessao(modoDemo);

  if (estado === "carregando") {
    return <Centered><span style={{ color: "var(--txt-3)", fontSize: 13.5 }}>carregando…</span></Centered>;
  }

  if (estado === "fora") {
    return <Entrar aoEntrar={() => void recarregar()} />;
  }

  return (
    <ProvedorDeSessao valor={valor}>
      {/* key = conta ativa: trocar de conta remonta tudo e refaz todo fetch —
          sem isso o painel seguia mostrando os dados da conta anterior */}
      <AgentsProvider key={valor.orgId ?? "demo"}>
        <App />
      </AgentsProvider>
    </ProvedorDeSessao>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Raiz />
  </React.StrictMode>,
);
