import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider, SignedIn, SignedOut, SignIn } from "@clerk/clerk-react";
import App from "./App";
import "./index.css";

// Clerk é OPCIONAL: sem a chave, o app abre direto (modo demo).
// Com a chave, exige login e a org da sessão vira o tenant.
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

function SignInScreen() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", gap: 18 }}>
      <div style={{ textAlign: "center" }}>
        <div className="font-display" style={{ fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em" }}>
          Metrik <span className="grad-text">Motor OS</span>
        </div>
        <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
          <SignIn routing="hash" />
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {clerkKey ? (
      <ClerkProvider publishableKey={clerkKey} afterSignOutUrl="/">
        <SignedIn>
          <App />
        </SignedIn>
        <SignedOut>
          <SignInScreen />
        </SignedOut>
      </ClerkProvider>
    ) : (
      <App />
    )}
  </React.StrictMode>
);
