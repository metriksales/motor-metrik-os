// Traje do Clerk com a identidade do Motor OS (dark premium, violeta).
// REGRA DURA: cores SÓLIDAS aqui — o Clerk deriva sombras/tons do
// colorBackground; "transparent" deixa o popover do seletor de organização
// ilegível (cicatriz: foi exatamente o bug do "meio transparente").
// Aplicado UMA vez no <ClerkProvider appearance={...}> — vale pra SignIn,
// OrganizationSwitcher, OrganizationList, UserButton e modais.
import type { ComponentProps } from "react";
import type { ClerkProvider } from "@clerk/clerk-react";

type Appearance = ComponentProps<typeof ClerkProvider>["appearance"];

const SOLID = {
  bg: "#141221", // superfície sólida sobre o --bg (#07070b)
  bgHi: "#1b1830",
  input: "#1d1a2e",
  line: "rgba(255,255,255,.09)",
  lineHi: "rgba(255,255,255,.16)",
  txt: "#f4f4f7",
  txt2: "#b7b9c6",
  txt3: "#83879a",
  violet: "#8b7cff",
};

export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: SOLID.violet,
    colorBackground: SOLID.bg,
    colorInputBackground: SOLID.input,
    colorText: SOLID.txt,
    colorTextSecondary: SOLID.txt3,
    colorInputText: SOLID.txt,
    colorNeutral: SOLID.txt,
    colorDanger: "#fb7185",
    colorSuccess: "#34d399",
    colorWarning: "#fbbf24",
    borderRadius: "12px",
    fontFamily: "'Onest', ui-sans-serif, system-ui, sans-serif",
    fontSize: "14px",
  },
  elements: {
    // cartões (login, listas, popovers, modais) — sempre chão sólido
    card: {
      background: SOLID.bg,
      border: `1px solid ${SOLID.line}`,
      boxShadow: "0 1px 0 rgba(255,255,255,.05) inset, 0 24px 60px -24px rgba(0,0,0,.85)",
    },
    cardBox: { boxShadow: "none" },
    headerTitle: {
      fontFamily: "'Space Grotesk', 'Onest', sans-serif",
      fontWeight: 700,
      letterSpacing: "-0.02em",
    },
    headerSubtitle: { color: SOLID.txt3 },
    socialButtonsBlockButton: {
      background: SOLID.bgHi,
      border: `1px solid ${SOLID.line}`,
      color: SOLID.txt,
      "&:hover": { background: SOLID.input, borderColor: SOLID.lineHi },
    },
    dividerLine: { background: SOLID.line },
    dividerText: { color: SOLID.txt3 },
    formFieldLabel: { color: SOLID.txt2 },
    formFieldInput: {
      background: SOLID.input,
      border: `1px solid ${SOLID.line}`,
      color: SOLID.txt,
      "&:focus": { borderColor: SOLID.violet, boxShadow: `0 0 0 3px rgba(139,124,255,.22)` },
    },
    formButtonPrimary: {
      background: "linear-gradient(135deg, #8b7cff 0%, #a06bff 100%)",
      color: "#0a0714",
      fontWeight: 700,
      textTransform: "none",
      fontSize: "14px",
      boxShadow: "0 10px 26px -12px rgba(139,124,255,.65)",
      "&:hover": { filter: "brightness(1.08)" },
    },
    footerActionText: { color: SOLID.txt3 },
    footerActionLink: { color: SOLID.violet, fontWeight: 600 },

    // seletor de organização — o gatilho vive na sidebar do app
    organizationSwitcherTrigger: {
      width: "100%",
      justifyContent: "flex-start",
      padding: "8px 10px",
      color: SOLID.txt,
      borderRadius: "10px",
      "&:hover": { background: "rgba(255,255,255,.05)" },
      "&:focus": { boxShadow: "none" },
    },
    organizationSwitcherPopoverCard: {
      background: SOLID.bg,
      border: `1px solid ${SOLID.lineHi}`,
      boxShadow: "0 28px 70px -20px rgba(0,0,0,.9)",
    },
    organizationSwitcherPopoverActionButton: {
      color: SOLID.txt2,
      "&:hover": { background: "rgba(255,255,255,.05)", color: SOLID.txt },
    },
    organizationPreviewMainIdentifier: { color: SOLID.txt, fontWeight: 600 },
    organizationPreviewSecondaryIdentifier: { color: SOLID.txt3 },

    // menu do usuário (avatar no topo)
    userButtonPopoverCard: {
      background: SOLID.bg,
      border: `1px solid ${SOLID.lineHi}`,
      boxShadow: "0 28px 70px -20px rgba(0,0,0,.9)",
    },
    userButtonPopoverActionButton: {
      color: SOLID.txt2,
      "&:hover": { background: "rgba(255,255,255,.05)", color: SOLID.txt },
    },
    userPreviewMainIdentifier: { color: SOLID.txt, fontWeight: 600 },
    userPreviewSecondaryIdentifier: { color: SOLID.txt3 },

    // modais (criar organização etc.)
    modalBackdrop: { background: "rgba(4,3,10,.72)", backdropFilter: "blur(6px)" },
    modalContent: { background: SOLID.bg },
  },
};
