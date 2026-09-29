// Rastreador de erros caseiro (S-012) — a parte que não fala com o banco.
//
// Três trabalhos, todos antes de o erro sair do processo:
//  1. achar o MOTIVO de verdade (o Drizzle embrulha o erro do Postgres em
//     "Failed query: <sql> params: <valores>", e o original fica em `cause`);
//  2. LIMPAR: parâmetro de consulta é dado de cliente, e mensagem de erro às
//     vezes carrega token, e-mail, string de conexão. Nada disso vai para a
//     tabela nem para o e-mail de aviso;
//  3. calcular a ASSINATURA, que agrupa "o mesmo erro" mesmo quando ids,
//     números e horários mudam de uma ocorrência para outra.
import { createHash } from "node:crypto";

/** O motivo do erro, atravessando a corrente de `cause`. */
export function motivoDoErro(erro: unknown): { mensagem: string; pilha?: string } {
  const cadeia: { message: string; code?: string; stack?: string }[] = [];
  let atual: unknown = erro;
  for (let i = 0; atual && i < 6; i++) {
    if (atual instanceof Error) {
      const code = (atual as { code?: unknown }).code;
      cadeia.push({ message: atual.message, code: typeof code === "string" ? code : undefined, stack: atual.stack });
      atual = (atual as { cause?: unknown }).cause;
    } else {
      cadeia.push({ message: typeof atual === "string" ? atual : safeJson(atual) });
      atual = undefined;
    }
  }
  if (!cadeia.length) return { mensagem: "Erro sem mensagem." };

  const embrulho = cadeia[0];
  // o motivo é o mais fundo da corrente que não é o embrulho do Drizzle
  const fundo = [...cadeia].reverse().find((c) => !/^Failed query:/i.test(c.message)) ?? embrulho;
  let mensagem = fundo.message;
  if (fundo.code && !mensagem.includes(fundo.code)) mensagem += ` (${fundo.code})`;
  if (/^Failed query:/i.test(embrulho.message) && fundo !== embrulho) {
    // o SQL ajuda a achar o lugar; os parâmetros ficam de fora, sempre
    const consulta = embrulho.message.replace(/^Failed query:\s*/i, "").split(/\bparams:/i)[0].trim();
    mensagem += ` · consulta: ${consulta.slice(0, 160)}`;
  }
  return { mensagem, pilha: fundo.stack ?? embrulho.stack };
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v).slice(0, 300);
  } catch {
    return String(v);
  }
}

/** Tira do texto o que não pode sair do processo: segredo, dado de cliente, parâmetro de consulta. */
export function limparTexto(texto: string, max = 600): string {
  return texto
    .replace(/\bparams:[\s\S]*$/i, "params: <omitidos>")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "<url do banco>")
    .replace(/\bBearer\s+\S+/gi, "Bearer <segredo>")
    .replace(/\b(?:mos|npg|sk|re|pk|rk|ghp|gho)_[A-Za-z0-9_-]{8,}/g, "<segredo>")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "<e-mail>")
    .replace(/\b[0-9a-f]{32,}\b/gi, "<hex>")
    .replace(/\b[A-Za-z0-9+/]{40,}={0,2}/g, "<base64>")
    // telefone é número SOLTO: colado a hífen ou letra é pedaço de outra coisa
    // (o último bloco de um UUID tem 12 dígitos, e trocá-lo quebrava o agrupamento)
    .replace(/(?<![\w-])\d{10,15}(?![\w-])/g, "<número>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** As primeiras linhas da pilha, com caminho relativo: o suficiente para achar o arquivo. */
export function limparPilha(pilha: string | undefined, linhas = 8): string | undefined {
  if (!pilha) return undefined;
  const quadros = pilha
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("at "))
    .slice(0, linhas)
    // o caminho absoluto (máquina, /var/task) sai; fica a partir de apps/ ou
    // packages/. UMA troca por quadro: global, a regra casava de novo dentro
    // do próprio caminho e comia "packages/control/".
    .map((l) => l.replace(/\\/g, "/").replace(/(\(|at\s)(?:file:\/\/)?[^()\s]*?\/((?:apps|packages)\/)/, "$1$2"));
  return quadros.length ? limparTexto(quadros.join("\n"), 2000).replace(/ at /g, "\nat ") : undefined;
}

/**
 * "O mesmo erro": onde + mensagem com os pedaços variáveis trocados por
 * marcadores. `duplicate key … (id)=(3f9a…)` e `(id)=(71bc…)` são um erro só.
 */
export function assinaturaDe(onde: string, mensagem: string): string {
  const forma = mensagem
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<uuid>")
    .replace(/"[^"]*"|'[^']*'/g, "<texto>")
    .replace(/\d+/g, "<n>")
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha256").update(`${onde}|${forma}`).digest("hex");
}

/**
 * Quem opera a plataforma: vê a lista de erros e recebe os avisos.
 * `OPERADORES_DA_PLATAFORMA` (e-mails separados por vírgula); na falta dela,
 * o `DONO_INICIAL`, que já é o fundador da instalação.
 */
export function operadoresDaPlataforma(env: NodeJS.ProcessEnv = process.env): string[] {
  const lista = (env.OPERADORES_DA_PLATAFORMA || env.DONO_INICIAL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  return [...new Set(lista)];
}
