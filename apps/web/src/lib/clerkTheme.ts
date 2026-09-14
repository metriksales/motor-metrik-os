// Traje do Clerk com a identidade do Motor OS (linha "Bridge": claro, verde menta, Poppins).
// REGRA DURA: cores SÓLIDAS aqui — o Clerk deriva sombras/tons do
// colorBackground; "transparent" deixa o popover do seletor de organização
// ilegível (cicatriz: foi exatamente o bug do "meio transparente").
// Aplicado UMA vez no <ClerkProvider appearance={...}> — vale pra SignIn,
// OrganizationSwitcher, OrganizationList, UserButton e modais.
import type { ComponentProps } from "react";
import type { ClerkProvider } from "@clerk/clerk-react";

type Appearance = ComponentProps<typeof ClerkProvider>["appearance"];

const SOLID = {
  bg: "#ffffff", // superfície sólida (cards, popovers)
  bgHi: "#f2f8f5",
  input: "#f7faf8",
  line: "#dbe4de",
  lineHi: "#c3d3ca",
  txt: "#0b1a12",
  txt2: "#33463b",
  txt3: "#63736a",
  green: "#1f9d6b",
};

export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: SOLID.green,
    colorBackground: SOLID.bg,
    colorInputBackground: SOLID.input,
    colorText: SOLID.txt,
    colorTextSecondary: SOLID.txt3,
    colorInputText: SOLID.txt,
    colorNeutral: SOLID.txt,
    colorDanger: "#d64550",
    colorSuccess: "#12a150",
    colorWarning: "#c07d12",
    borderRadius: "12px",
    fontFamily: "'Poppins', ui-sans-serif, system-ui, sans-serif",
    fontSize: "14px",
  },
  elements: {
    // cartões (login, listas, popovers, modais) — sempre chão sólido claro
    card: {
      background: SOLID.bg,
      border: `1px solid ${SOLID.line}`,
      boxShadow: "0 1px 2px rgba(18,57,30,.05), 0 24px 60px -28px rgba(18,57,30,.28)",
    },
    cardBox: { boxShadow: "none" },
    headerTitle: {
      fontFamily: "'Poppins', sans-serif",
      fontWeight: 700,
      letterSpacing: "-0.02em",
    },
    headerSubtitle: { color: SOLID.txt3 },
    socialButtonsBlockButton: {
      background: SOLID.bg,
      border: `1px solid ${SOLID.line}`,
      color: SOLID.txt,
      "&:hover": { background: SOLID.bgHi, borderColor: SOLID.lineHi },
    },
    dividerLine: { background: SOLID.line },
    dividerText: { color: SOLID.txt3 },
    formFieldLabel: { color: SOLID.txt2 },
    formFieldInput: {
      background: SOLID.input,
      border: `1px solid ${SOLID.line}`,
      color: SOLID.txt,
      "&:focus": { borderColor: SOLID.green, boxShadow: `0 0 0 3px rgba(62,207,142,.22)` },
    },
    formButtonPrimary: {
      background: "linear-gradient(135deg, #3ecf8e 0%, #1f9d6b 100%)",
      color: "#06301f",
      fontWeight: 700,
      textTransform: "none",
      fontSize: "14px",
      boxShadow: "0 10px 26px -14px rgba(31,157,107,.6)",
      "&:hover": { filter: "brightness(1.04)" },
    },
    footerActionText: { color: SOLID.txt3 },
    footerActionLink: { color: SOLID.green, fontWeight: 600 },

    // seletor de organização — o gatilho vive na sidebar do app
    organizationSwitcherTrigger: {
      width: "100%",
      justifyContent: "flex-start",
      padding: "8px 10px",
      color: SOLID.txt,
      borderRadius: "10px",
      "&:hover": { background: "rgba(18,57,30,.05)" },
      "&:focus": { boxShadow: "none" },
    },
    organizationSwitcherPopoverCard: {
      background: SOLID.bg,
      border: `1px solid ${SOLID.lineHi}`,
      boxShadow: "0 28px 70px -24px rgba(18,57,30,.32)",
    },
    organizationSwitcherPopoverActionButton: {
      color: SOLID.txt2,
      "&:hover": { background: "rgba(18,57,30,.05)", color: SOLID.txt },
    },
    organizationPreviewMainIdentifier: { color: SOLID.txt, fontWeight: 600 },
    organizationPreviewSecondaryIdentifier: { color: SOLID.txt3 },

    // menu do usuário (avatar no topo)
    userButtonPopoverCard: {
      background: SOLID.bg,
      border: `1px solid ${SOLID.lineHi}`,
      boxShadow: "0 28px 70px -24px rgba(18,57,30,.32)",
    },
    userButtonPopoverActionButton: {
      color: SOLID.txt2,
      "&:hover": { background: "rgba(18,57,30,.05)", color: SOLID.txt },
    },
    userPreviewMainIdentifier: { color: SOLID.txt, fontWeight: 600 },
    userPreviewSecondaryIdentifier: { color: SOLID.txt3 },

    // modais (criar organização etc.)
    modalBackdrop: { background: "rgba(11,26,18,.5)", backdropFilter: "blur(6px)" },
    modalContent: { background: SOLID.bg },
  },
};
