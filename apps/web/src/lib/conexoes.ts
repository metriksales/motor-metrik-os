// Conexões da conta (S-019): o vocabulário que a tela e o Início compartilham.
//
// O status NÃO é uma string que alguém gravou no cadastro: é o que o último
// teste contra o provedor disse, com data. A tela mostra isso — e quando
// nunca houve teste, diz "nunca testada", não "ligado".
import { CalendarDays, ContactRound, Database, FileSignature, MessageCircle, Scale, type LucideIcon } from "lucide-react";

export interface ConexaoReal {
  id: string;
  kind: string;
  /** `nao_testada` | `sem_credencial` | `ok` | `falha` */
  status: string;
  /** rótulo da credencial no cofre; `null` vale "padrao" */
  vaultRef: string | null;
  meta: unknown;
  agentId: string | null;
  ultimoTesteEm: string | null;
  ultimoTesteDetalhe: string | null;
  createdAt: string;
  testavel: boolean;
  temSegredoDeEntrada: boolean;
}

/** O que volta de "testar agora" e do cadastro: a conexão, mais o que o provedor contou. */
export type ConexaoTestada = ConexaoReal & { dados: Record<string, unknown> | null };

export const TIPO_DE_CONEXAO: Record<string, { nome: string; tipo: string; icon: LucideIcon }> = {
  whatsapp: { nome: "WhatsApp (uazapi)", tipo: "Canal", icon: MessageCircle },
  ghl: { nome: "GoHighLevel", tipo: "CRM", icon: Database },
  kommo: { nome: "Kommo", tipo: "CRM", icon: ContactRound },
  gcal: { nome: "Google Agenda", tipo: "Agenda", icon: CalendarDays },
  advbox: { nome: "ADVBOX", tipo: "Jurídico", icon: Scale },
  zapsign: { nome: "ZapSign", tipo: "Assinatura", icon: FileSignature },
};

export function nomeDaConexao(c: Pick<ConexaoReal, "kind" | "vaultRef">): string {
  const base = TIPO_DE_CONEXAO[c.kind]?.nome ?? c.kind;
  return c.vaultRef && c.vaultRef !== "padrao" ? `${base} · ${c.vaultRef}` : base;
}

export const STATUS_DA_CONEXAO: Record<string, { label: string; cor: string }> = {
  ok: { label: "no ar", cor: "var(--emerald)" },
  falha: { label: "com problema", cor: "var(--rose)" },
  sem_credencial: { label: "sem credencial", cor: "var(--amber)" },
  nao_testada: { label: "nunca testada", cor: "var(--txt-4)" },
};

/** As que pedem alguém: o provedor disse que não, ou não há com o que perguntar. */
export function precisaDeAlguem(c: ConexaoReal): boolean {
  return c.status === "falha" || c.status === "sem_credencial";
}

/** Os tipos que a tela sabe cadastrar hoje — os que têm teste. */
export const TIPOS_CADASTRAVEIS = ["whatsapp", "ghl", "kommo"] as const;
export type TipoCadastravel = (typeof TIPOS_CADASTRAVEIS)[number];

export interface CampoDeCadastro {
  key: string;
  label: string;
  placeholder?: string;
  obrigatorio?: boolean;
  ajuda?: string;
}

/** O que cada tipo precisa além do segredo. Nada aqui é secreto: vai no `meta`. */
export const CAMPOS_POR_TIPO: Record<TipoCadastravel, { segredo: string; campos: CampoDeCadastro[] }> = {
  whatsapp: {
    segredo: "token da instância",
    campos: [
      { key: "baseUrl", label: "endereço da instância", placeholder: "https://minha.uazapi.com", obrigatorio: true },
    ],
  },
  ghl: {
    segredo: "token (Private Integration ou OAuth)",
    campos: [
      { key: "locationId", label: "id da subconta (locationId)", obrigatorio: true },
      { key: "pipelineId", label: "id do funil", ajuda: "opcional — se preencher, o teste confere que existe" },
      { key: "defaultStageId", label: "id da etapa inicial", ajuda: "opcional" },
      { key: "defaultCalendarId", label: "id do calendário", ajuda: "opcional" },
    ],
  },
  kommo: {
    segredo: "token de longa duração",
    campos: [
      { key: "baseUrl", label: "endereço da conta", placeholder: "https://minhaempresa.kommo.com", obrigatorio: true },
      { key: "pipelineId", label: "id do funil", ajuda: "opcional — se preencher, o teste confere que existe" },
      { key: "defaultStatusId", label: "id da etapa inicial", ajuda: "opcional" },
    ],
  },
};
