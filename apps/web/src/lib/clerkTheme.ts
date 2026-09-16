// Traje do Clerk com a identidade do Motor OS ("Casa do Motor": noite, âmbar/azul, Poppins).
// REGRA DURA: cores SÓLIDAS aqui — o Clerk deriva sombras/tons do
// colorBackground; "transparent" deixa o popover do seletor de organização
// ilegível (cicatriz: foi exatamente o bug do "meio transparente").
// Aplicado UMA vez no <ClerkProvider appearance={...}> — vale pra SignIn,
// OrganizationSwitcher, OrganizationList, UserButton e modais.
import type { ComponentProps } from "react";
import type { ClerkProvider } from "@clerk/clerk-react";

type Appearance = ComponentProps<typeof ClerkProvider>["appearance"];

const SOLID = {
  bg: "#151a24", // superfície sólida (cards, popovers)
  bgHi: "#1b2130",
  input: "#10141c",
  line: "rgba(255,255,255,.09)",
  lineHi: "rgba(255,255,255,.16)",
  txt: "#f2f3f6",
  txt2: "#b6bac6",
  txt3: "#838a99",
  amber: "#e0a44a",
};

export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: SOLID.amber,
    colorBackground: SOLID.bg,
    colorInputBackground: SOLID.input,
    colorText: SOLID.txt,
    colorTextSecondary: SOLID.txt3,
    colorInputText: SOLID.txt,
    colorNeutral: SOLID.txt,
    colorDanger: "#fb7185",
    colorSuccess: "#34d399",
    colorWarning: "#fbbf24",
    borderRadius: "11px",
    fontFamily: "'Poppins', ui-sans-serif, system-ui, sans-serif",
    fontSize: "14px",
  },
  elements: {
    // cartões (login, listas, popovers, modais) — sempre chão sólido escuro
    card: {
      background: SOLID.bg,
      border: `1px solid ${SOLID.line}`,
      boxShadow: "0 1px 2px rgba(0,0,0,.3), 0 24px 60px -28px rgba(0,0,0,.65)",
    },
    cardBox: { boxShadow: "none" },
    headerTitle: {
      fontFamily: "'Poppins', sans-serif",
      fontWeight: 700,
      letterSpacing: "-0.02em",
    },
    headerSubtitle: { color: SOLID.txt3 },
    socialButtonsBlockButton: {
      background: SOLID.bgHi,
      border: `1px solid ${SOLID.line}`,
      color: SOLID.txt,
      "&:hover": { background: "#20273a", borderColor: SOLID.lineHi },
    },
    dividerLine: { background: SOLID.line },
    dividerText: { color: SOLID.txt3 },
    formFieldLabel: { color: SOLID.txt2 },
    formFieldInput: {
      background: SOLID.input,
      border: `1px solid ${SOLID.line}`,
      color: SOLID.txt,
      "&:focus": { borderColor: SOLID.amber, boxShadow: `0 0 0 3px rgba(224,164,74,.22)` },
    },
    formButtonPrimary: {
      background: "linear-gradient(135deg, #e0a44a 0%, #58aae4 100%)",
      color: "#0c0f15",
      fontWeight: 700,
      textTransform: "none",
      fontSize: "14px",
      boxShadow: "0 10px 26px -14px rgba(224,164,74,.6)",
      "&:hover": { filter: "brightness(1.06)" },
    },
    footerActionText: { color: SOLID.txt3 },
    footerActionLink: { color: SOLID.amber, fontWeight: 600 },

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
      boxShadow: "0 28px 70px -24px rgba(0,0,0,.7)",
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
      boxShadow: "0 28px 70px -24px rgba(0,0,0,.7)",
    },
    userButtonPopoverActionButton: {
      color: SOLID.txt2,
      "&:hover": { background: "rgba(255,255,255,.05)", color: SOLID.txt },
    },
    userPreviewMainIdentifier: { color: SOLID.txt, fontWeight: 600 },
    userPreviewSecondaryIdentifier: { color: SOLID.txt3 },

    // modais (criar organização etc.)
    modalBackdrop: { background: "rgba(6,8,12,.6)", backdropFilter: "blur(6px)" },
    modalContent: { background: SOLID.bg },
  },
};
