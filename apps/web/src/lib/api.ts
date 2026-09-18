// Cliente da Control API (a porta única). Usa a sessão Clerk quando houver;
// senão, um token de dev (VITE_MOTOR_TOKEN + VITE_ORG_ID) pra testar antes do Clerk.
type GetToken = (() => Promise<string | null>) | undefined;

async function authHeaders(getToken: GetToken): Promise<Record<string, string>> {
  if (getToken) {
    const t = await getToken();
    if (t) return { authorization: `Bearer ${t}` };
  }
  const dev = import.meta.env.VITE_MOTOR_TOKEN as string | undefined;
  const org = import.meta.env.VITE_ORG_ID as string | undefined;
  if (dev && org) return { "x-motor-token": dev, "x-org-id": org, "x-actor": "web" };
  return {};
}

export async function control<T = unknown>(
  action: string,
  opts: { getToken?: GetToken; body?: unknown; query?: Record<string, string> } = {}
): Promise<T> {
  const q = new URLSearchParams({ action, ...(opts.query ?? {}) }).toString();
  const res = await fetch(`/api/control?${q}`, {
    method: opts.body ? "POST" : "GET",
    headers: { "content-type": "application/json", ...(await authHeaders(opts.getToken)) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error ?? `erro ${res.status}`);
  }
  return res.json() as Promise<T>;
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
  testar: (agentId: string, historico: { role: "user" | "assistant"; content: string }[], modo?: "ar" | "ensaio", getToken?: GetToken) =>
    control("testar", { body: { agentId, historico, modo }, getToken }),
  rodando: (agentId: string, getToken?: GetToken) => control("rodando", { query: { agentId }, getToken }),
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
