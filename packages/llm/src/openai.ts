// OpenAiBrain — implementação de LlmPort sobre a OpenAI RESPONSES API.
//
// POR QUE Responses API (e não chat.completions):
// os modelos gpt-5.x RECUSAM `reasoning_effort` junto com `tools` no
// chat.completions. A Responses API (POST /v1/responses) aceita
// `reasoning` + `tools` na mesma chamada — por isso é o transporte aqui.
//
// As tools são declaradas COM schema (`ToolSpec` de @motor/core): nome,
// descrição e parâmetros. O motor injeta o catálogo em `tools`.
import type { LlmPort, LlmTurn, ToolCall, ToolSpec } from "@motor/core";

/** Opções de construção do cérebro OpenAI. */
export interface OpenAiBrainOptions {
  /** chave da OpenAI — entra por parâmetro/env, NUNCA embutida no código */
  apiKey: string;
  /** modelo (default "gpt-5.1") */
  model?: string;
  /** base da API (default "https://api.openai.com/v1") */
  baseUrl?: string;
  /** esforço de raciocínio — só vai no payload quando setado */
  reasoningEffort?: "low" | "medium" | "high";
}

/** Formato de um item de input da Responses API (role + conteúdo). */
interface ResponsesInputItem {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
}

export class OpenAiBrain implements LlmPort {
  readonly kind = "openai-responses";
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly reasoningEffort?: "low" | "medium" | "high";

  constructor(opts: OpenAiBrainOptions) {
    if (!opts.apiKey) throw new Error("OpenAiBrain: apiKey é obrigatória (venha do vault/env, nunca do browser).");
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? "gpt-5.1";
    // tira barra final pra não duplicar "//responses"
    this.baseUrl = (opts.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
    this.reasoningEffort = opts.reasoningEffort;
  }

  async responder(input: {
    system: string;
    historico: { role: "user" | "assistant" | "tool"; content: string }[];
    tools?: ToolSpec[];
  }): Promise<LlmTurn> {
    // 1) monta o input: system primeiro, depois o histórico (role→content).
    const inputItems: ResponsesInputItem[] = [
      { role: "system", content: input.system },
      ...input.historico.map((h) => ({ role: h.role, content: h.content })),
    ];

    // 2) payload base da Responses API.
    const payload: Record<string, unknown> = {
      model: this.model,
      input: inputItems,
    };

    // 3) reasoning só quando o esforço foi setado.
    if (this.reasoningEffort) {
      payload.reasoning = { effort: this.reasoningEffort };
    }

    // 4) tools com SCHEMA (S-005): nome, descrição e parâmetros declarados.
    // Sem schema, o modelo adivinha os campos e manda string vazia — que no
    // Kommo vira id 0 e no GHL vira PUT numa URL sem id.
    if (input.tools && input.tools.length > 0) {
      payload.tools = input.tools.map((t) => ({
        type: "function",
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      }));
    }

    // 5) chamada HTTP — Authorization: Bearer <apiKey>.
    const resp = await fetch(`${this.baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // 6) erro claro quando não-2xx (corpo do erro no throw).
    if (!resp.ok) {
      const corpo = await resp.text().catch(() => "");
      throw new Error(`OpenAiBrain: Responses API ${resp.status} ${resp.statusText} — ${corpo}`);
    }

    const data: unknown = await resp.json().catch(() => ({}));
    return parseResponsesOutput(data);
  }
}

// ── PARSE da resposta da Responses API ────────────────────────────────
// CONFERIR shape: o formato exato pode variar por versão da API. Aqui
// cobrimos os caminhos conhecidos:
//   • data.output_text — atalho de texto já concatenado (algumas SDKs);
//   • data.output[] — itens: { type:"message", content:[{type:"output_text", text}] }
//                     e { type:"function_call", name, arguments } (tool call);
//   • fallback tolerante a data.tool_calls / choices legadas.
function parseResponsesOutput(data: unknown): LlmTurn {
  const root = asRecord(data);
  const partesTexto: string[] = [];
  const toolCalls: ToolCall[] = [];

  // atalho: output_text agregado (quando a API/SDK já entrega pronto)
  if (typeof root.output_text === "string" && root.output_text.length > 0) {
    partesTexto.push(root.output_text);
  }

  // caminho principal: array `output`
  const output = Array.isArray(root.output) ? root.output : [];
  for (const itemRaw of output) {
    const item = asRecord(itemRaw);
    const tipo = typeof item.type === "string" ? item.type : "";

    // 6a) mensagem com blocos de conteúdo (output_text)
    if (tipo === "message" || Array.isArray(item.content)) {
      const blocos = Array.isArray(item.content) ? item.content : [];
      for (const blocoRaw of blocos) {
        const bloco = asRecord(blocoRaw);
        if ((bloco.type === "output_text" || bloco.type === "text") && typeof bloco.text === "string") {
          partesTexto.push(bloco.text);
        }
      }
    }

    // 6b) tool/function call — nome + arguments (string JSON)
    if (tipo === "function_call" || tipo === "tool_call") {
      const tc = mapToolCall(item);
      if (tc) toolCalls.push(tc);
    }
  }

  // fallback: alguns formatos expõem tool_calls no topo
  if (Array.isArray(root.tool_calls)) {
    for (const raw of root.tool_calls) {
      const tc = mapToolCall(asRecord(raw));
      if (tc) toolCalls.push(tc);
    }
  }

  const texto = partesTexto.join("").trim();
  const turn: LlmTurn = {};
  if (texto.length > 0) turn.texto = texto;
  if (toolCalls.length > 0) turn.toolCalls = toolCalls;
  return turn;
}

/** Mapeia um item de function/tool call → ToolCall (args = JSON.parse tolerante). */
function mapToolCall(item: Record<string, unknown>): ToolCall | undefined {
  // o nome pode vir direto (Responses) ou aninhado em `function` (chat legado)
  const fn = asRecord(item.function);
  const nome =
    (typeof item.name === "string" && item.name) ||
    (typeof fn.name === "string" && fn.name) ||
    "";
  if (!nome) return undefined;

  const argsRaw =
    (typeof item.arguments === "string" && item.arguments) ||
    (typeof fn.arguments === "string" && fn.arguments) ||
    "";

  let args: Record<string, unknown> = {};
  if (argsRaw) {
    try {
      const parsed = JSON.parse(argsRaw);
      if (parsed && typeof parsed === "object") args = parsed as Record<string, unknown>;
    } catch {
      args = {}; // arguments inválido → objeto vazio (não derruba o turno)
    }
  } else if (item.arguments && typeof item.arguments === "object") {
    // alguns formatos já entregam arguments como objeto
    args = item.arguments as Record<string, unknown>;
  }

  return { tool: nome, args };
}

/** Coerção segura pra Record (evita `any` e protege o parse). */
function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
