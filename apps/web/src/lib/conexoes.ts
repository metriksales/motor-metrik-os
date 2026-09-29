// Conexões da conta (S-019): o vocabulário que a tela e o Início compartilham.
//
// O status NÃO é uma string que alguém gravou no cadastro: é o que o último
// teste contra o provedor disse, com data. A tela mostra isso — e quando
// nunca houve teste, diz "Nunca testada", não "ligado".
//
// Todo texto daqui aparece na tela: segue a skill `texto-de-tela`.
import { CalendarDays, ContactRound, Database, FileSignature, MessageCircle, Scale, type LucideIcon } from "lucide-react";

/** Para onde a instância manda os eventos. Só o host: caminho e query podem carregar segredo. */
export interface DestinoDeEventos {
  host: string;
  ativo: boolean;
  destino?: "atendimento" | "grupos" | "este sistema";
  eventos: string[];
}

/** O que o provedor contou no último teste, para mostrar (nunca o segredo). */
export interface DadosDoTeste {
  estado?: string;
  nome?: string;
  numero?: string;
  foto?: string;
  subconta?: string;
  conta?: string;
  /** o nome da instância no servidor da uazapi (não é o nome do perfil) */
  instancia?: string;
  webhooks?: DestinoDeEventos[];
}

/** O que a tela recebe enquanto a pessoa conecta o WhatsApp. O QR e o código nunca são gravados. */
export interface EstadoDaConexao {
  conectado: boolean;
  estado?: string;
  qrcode?: string;
  codigo?: string;
  instancia?: string;
  detalhe: string;
  /** a conexão já testada, quando a instância acabou de conectar */
  conexao?: ConexaoReal;
}

/** "a.com", "a.com e b.com", "a.com, b.com e c.com" */
function juntar(itens: string[]): string {
  return itens.length <= 1 ? (itens[0] ?? "") : `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/**
 * Onde chegam as mensagens recebidas pela instância, numa frase. `null` quando
 * o último teste não leu o webhook (tipo sem isso, ou leitura que falhou).
 * `alerta` quando nada chega a este sistema.
 */
export function ondeChegamOsEventos(c: Pick<ConexaoReal, "ultimoTesteDados">): { frase: string; alerta: boolean } | null {
  const lista = c.ultimoTesteDados?.webhooks;
  if (!Array.isArray(lista)) return null;
  if (lista.length === 0) {
    return { frase: "Nenhum webhook configurado. Mensagens recebidas não chegam a este sistema.", alerta: true };
  }
  const ativos = lista.filter((w) => w.ativo);
  if (ativos.length === 0) return { frase: "Webhook desativado na instância. Mensagens recebidas não chegam a este sistema.", alerta: true };
  const nosso = ativos.find((w) => w.destino);
  if (nosso?.destino === "grupos") return { frase: "Mensagens recebidas chegam ao leitor de grupos.", alerta: false };
  if (nosso?.destino === "atendimento") return { frase: "Mensagens recebidas chegam ao atendimento.", alerta: false };
  if (nosso) return { frase: "Mensagens recebidas chegam a este sistema.", alerta: false };
  const hosts = [...new Set(ativos.map((w) => w.host))];
  return { frase: `Mensagens recebidas vão para ${juntar(hosts.slice(0, 3))}, não para este sistema.`, alerta: true };
}

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
  ultimoTesteDados: DadosDoTeste | null;
  createdAt: string;
  testavel: boolean;
  temSegredoDeEntrada: boolean;
}

export const TIPO_DE_CONEXAO: Record<string, { nome: string; tipo: string; provedor: string; icon: LucideIcon }> = {
  whatsapp: { nome: "WhatsApp (uazapi)", tipo: "Canal", provedor: "uazapi", icon: MessageCircle },
  ghl: { nome: "GoHighLevel", tipo: "CRM", provedor: "GHL", icon: Database },
  kommo: { nome: "Kommo", tipo: "CRM", provedor: "Kommo", icon: ContactRound },
  gcal: { nome: "Google Agenda", tipo: "Agenda", provedor: "Google", icon: CalendarDays },
  advbox: { nome: "ADVBOX", tipo: "Jurídico", provedor: "ADVBOX", icon: Scale },
  zapsign: { nome: "ZapSign", tipo: "Assinatura", provedor: "ZapSign", icon: FileSignature },
};

export function nomeDaConexao(c: Pick<ConexaoReal, "kind" | "vaultRef">): string {
  const base = TIPO_DE_CONEXAO[c.kind]?.nome ?? c.kind;
  return c.vaultRef && c.vaultRef !== "padrao" ? `${base} · ${c.vaultRef}` : base;
}

/** "5521981740018" → "+55 21 98174-0018"; o que não parece BR volta com "+" na frente. */
export function formatarNumero(digitos: string): string {
  const d = digitos.replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4);
    const resto = d.slice(4);
    return `+55 ${ddd} ${resto.slice(0, resto.length - 4)}-${resto.slice(-4)}`;
  }
  return `+${d}`;
}

/**
 * Quem está do outro lado, numa linha: "Luã · +55 21 98174-0018 · Instância metrik-01".
 * Nome, número, subconta e conta só valem com a conexão no ar; o nome da
 * instância no servidor aparece sempre que o último teste o leu, porque é ele
 * que diz QUAL instância está fora.
 */
export function quemRespondeu(c: Pick<ConexaoReal, "ultimoTesteDados" | "status">): string {
  const d = c.ultimoTesteDados ?? {};
  const partes = c.status === "ok" ? [d.nome, d.numero ? formatarNumero(d.numero) : undefined, d.subconta, d.conta] : [];
  if (d.instancia) partes.push(`Instância ${d.instancia}`);
  return partes.filter((x): x is string => typeof x === "string" && x.length > 0).join(" · ");
}

export const STATUS_DA_CONEXAO: Record<string, { label: string; cor: string }> = {
  ok: { label: "No ar", cor: "var(--emerald)" },
  falha: { label: "Com problema", cor: "var(--rose)" },
  sem_credencial: { label: "Sem credencial", cor: "var(--amber)" },
  nao_testada: { label: "Nunca testada", cor: "var(--txt-4)" },
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
    segredo: "Token da instância",
    campos: [
      { key: "baseUrl", label: "Endereço da instância", placeholder: "https://minha.uazapi.com", obrigatorio: true },
    ],
  },
  ghl: {
    segredo: "Token (Private Integration ou OAuth)",
    campos: [
      { key: "locationId", label: "Id da subconta (locationId)", obrigatorio: true },
      { key: "pipelineId", label: "Id do funil", ajuda: "Opcional. Se preenchido, o teste confere que existe." },
      { key: "defaultStageId", label: "Id da etapa inicial", ajuda: "Opcional." },
      { key: "defaultCalendarId", label: "Id do calendário", ajuda: "Opcional." },
    ],
  },
  kommo: {
    segredo: "Token de longa duração",
    campos: [
      { key: "baseUrl", label: "Endereço da conta", placeholder: "https://minhaempresa.kommo.com", obrigatorio: true },
      { key: "pipelineId", label: "Id do funil", ajuda: "Opcional. Se preenchido, o teste confere que existe." },
      { key: "defaultStatusId", label: "Id da etapa inicial", ajuda: "Opcional." },
    ],
  },
};
