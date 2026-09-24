// Cliente da Control API (a porta única). Autentica SÓ pela sessão da pessoa.
//
// Não existe atalho por token de máquina aqui, de propósito (S-003): token de
// máquina é segredo de servidor e, num app Vite, qualquer variável `VITE_*` é
// embutida no JavaScript público. Sem sessão, a API responde 401 — e é isso
// mesmo que deve acontecer.
/**
 * Parâmetro herdado do tempo do Clerk (S-045). A sessão agora é um cookie
 * `httpOnly`, que o navegador manda sozinho — não há token para o JavaScript
 * carregar. Ficou aceito para não mexer em ~70 chamadas de uma vez; é ignorado.
 */
type GetToken = (() => Promise<string | null>) | undefined;

/** Lê um cookie legível pelo JavaScript (o de CSRF é assim de propósito). */
export function lerCookie(nome: string): string {
  const alvo = `${nome}=`;
  for (const parte of document.cookie.split(";")) {
    const p = parte.trim();
    if (p.startsWith(alvo)) return decodeURIComponent(p.slice(alvo.length));
  }
  return "";
}

/**
 * Cabeçalhos de uma escrita. O cookie de sessão viaja sozinho, então toda
 * escrita repete o valor do cookie de CSRF no header — um site hostil
 * consegue fazer o navegador mandar o cookie, mas não consegue lê-lo.
 */
export function cabecalhosDeEscrita(csrf: string): Record<string, string> {
  return csrf ? { "content-type": "application/json", "x-csrf-token": csrf } : { "content-type": "application/json" };
}

export async function control<T = unknown>(
  action: string,
  opts: { getToken?: GetToken; body?: unknown; query?: Record<string, string> } = {}
): Promise<T> {
  const q = new URLSearchParams({ action, ...(opts.query ?? {}) }).toString();
  const res = await fetch(`/api/control?${q}`, {
    method: opts.body ? "POST" : "GET",
    headers: cabecalhosDeEscrita(lerCookie("mos_csrf")),
    credentials: "same-origin",
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string })?.error ?? `erro ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Endpoints de sessão (S-045): entrar, sair, trocar de conta. */
export const auth = {
  async pedirCodigo(email: string) {
    return chamarAuth("pedirCodigo", { email });
  },
  async entrar(email: string, codigo: string) {
    return chamarAuth("entrar", { email, codigo });
  },
  async sair() {
    return chamarAuth("sair", {});
  },
  async eu() {
    return chamarAuth("eu");
  },
  async contas() {
    return chamarAuth("contas");
  },
  async trocarConta(orgId: string) {
    return chamarAuth("trocarConta", { orgId });
  },
  async aceitarConvite(token: string) {
    return chamarAuth("aceitarConvite", { token });
  },
};

async function chamarAuth(acao: string, body?: Record<string, unknown>) {
  const res = await fetch(`/api/auth?acao=${acao}`, {
    method: body ? "POST" : "GET",
    headers: cabecalhosDeEscrita(lerCookie("mos_csrf")),
    credentials: "same-origin",
    body: body ? JSON.stringify(body) : undefined,
  });
  const dados = await res.json().catch(() => ({}));
  if (!res.ok) {
    const { error, requestId } = dados as { error?: string; requestId?: string };
    // o id de correlação vai junto: é com ele que se acha a linha no log do
    // servidor, já que a mensagem interna nunca volta pro cliente (S-006)
    throw new Error(requestId ? `${error ?? "erro"} (ref ${requestId.slice(0, 8)})` : error ?? `erro ${res.status}`);
  }
  return dados;
}

// Atalhos tipados (o front conecta nisto quando o banco estiver vivo).
export const api = {
  listAgents: (getToken?: GetToken) => control("agents", { getToken }),
  createAgent: (input: { name: string; tipo: "resposta" | "acao" }, getToken?: GetToken) =>
    control("createAgent", { body: input, getToken }),
  listChangeSets: (agentId: string, getToken?: GetToken) =>
    control("changesets", { query: { agentId }, getToken }),
  propor: (input: { agentId: string; origin: string; intent: string; patch: unknown }, getToken?: GetToken) =>
    control("propor", { body: input, getToken }),
  aprovar: (changeSetId: string, getToken?: GetToken) => control("aprovar", { body: { changeSetId }, getToken }),
  avaliar: (changeSetId: string, getToken?: GetToken) => control("avaliar", { body: { changeSetId }, getToken }),
  publicarMudanca: (changeSetId: string, getToken?: GetToken) => control("publicarMudanca", { body: { changeSetId }, getToken }),
  testar: (agentId: string, historico: { role: "user" | "assistant"; content: string }[], modo?: "ar" | "ensaio", getToken?: GetToken, changeSetId?: string | null) =>
    control("testar", { body: { agentId, historico, modo, changeSetId }, getToken }),
  rodando: (agentId: string, getToken?: GetToken) => control("rodando", { query: { agentId }, getToken }),
  rodarTestes: (agentId: string, modoTeste: "ar" | "ensaio" = "ar", getToken?: GetToken, changeSetId?: string | null) => control("rodarTestes", { body: { agentId, modoTeste, changeSetId }, getToken }),
  listMembers: (getToken?: GetToken) => control("members", { getToken }),
  setEstado: (agentId: string, estado: "ativo" | "pausado", getToken?: GetToken) =>
    control("setEstado", { body: { agentId, estado }, getToken }),
  assumirContato: (agentId: string, contato: string, getToken?: GetToken) =>
    control("assumirContato", { body: { agentId, contato }, getToken }),
  devolverContato: (agentId: string, contato: string, getToken?: GetToken) =>
    control("devolverContato", { body: { agentId, contato }, getToken }),
  listAssumidos: (agentId?: string, getToken?: GetToken) =>
    control("assumidos", { getToken, query: agentId ? { agentId } : undefined }),
  listLogs: (agentId?: string, getToken?: GetToken) =>
    control("logs", { getToken, query: agentId ? { agentId } : undefined }),
  stats: (getToken?: GetToken) => control("stats", { getToken }),
  pendencias: (getToken?: GetToken) => control("pendencias", { getToken }),
};
