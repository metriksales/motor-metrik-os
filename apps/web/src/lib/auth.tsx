import { createContext, useContext } from "react";

// Contexto de autenticação/tenant do app. Preenchido pelo main.tsx:
// - modo Clerk: org + getToken vêm da sessão (o tenant é a organização ativa).
// - modo demo (sem chave): 1 org fake, sem token.
export type MotorAuth = {
  demo: boolean;
  orgId?: string;
  orgName: string;
  orgDesc: string;
  orgInitial: string;
  getToken?: () => Promise<string | null>;
};

const DEFAULT: MotorAuth = { demo: true, orgName: "Demo", orgDesc: "", orgInitial: "D" };

const MotorAuthContext = createContext<MotorAuth>(DEFAULT);

export const MotorAuthProvider = MotorAuthContext.Provider;

export function useMotorAuth(): MotorAuth {
  return useContext(MotorAuthContext);
}
