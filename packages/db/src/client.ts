import { AsyncLocalStorage } from "node:async_hooks";
import { sql as tag } from "drizzle-orm";
import type { drizzle as drizzleWs } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// A integração Neon↔Vercel pode nomear a env com prefixo (STORAGE_/POSTGRES_…),
// dependendo do "Custom Prefix" na hora de conectar. Resolvemos por uma cadeia de
// fallback pra "só funcionar" no deploy — DATABASE_URL (pooled) é o preferido.
export function getDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_DATABASE_URL ??
    process.env.STORAGE_DATABASE_URL ??
    process.env.STORAGE_URL ??
    ""
  );
}

// Placeholder quando não há env: o MÓDULO nunca crasha no import; os guards
// (getDatabaseUrl()) impedem qualquer query sem banco configurado.
const url = getDatabaseUrl() || "postgresql://placeholder:placeholder@placeholder.invalid/placeholder";

/**
 * POR QUE WEBSOCKET, E NÃO O DRIVER HTTP (S-011)
 *
 * O `neon-http` é mais leve, mas é SEM ESTADO: cada query vai numa requisição
 * própria, e o drizzle recusa transação nele — literalmente
 * `throw new Error("No transactions support in neon-http driver")`.
 *
 * Sem transação não há onde declarar de qual conta é a query, e sem isso o
 * Postgres não consegue aplicar Row Level Security: a política precisa ler
 * `current_setting('app.org_id')`, que só existe dentro de uma sessão.
 *
 * O driver WebSocket dá sessão de verdade. Não precisa de dependência nova:
 * sem `webSocketConstructor` configurado, ele usa o `WebSocket` global, que o
 * Node 22 tem. O custo é latência no primeiro acesso de cada instância fria.
 */
async function criarDb() {
  if (process.env.DB_DRIVER === "pg") {
    // Postgres comum, para teste local e CI: mesmo contrato, sem depender do Neon.
    const [{ drizzle: drizzlePg }, pg] = await Promise.all([
      import("drizzle-orm/node-postgres"),
      import("pg"),
    ]);
    return drizzlePg(new pg.default.Pool({ connectionString: url }), { schema });
  }
  const [{ drizzle: criar }, { Pool }] = await Promise.all([
    import("drizzle-orm/neon-serverless"),
    import("@neondatabase/serverless"),
  ]);
  return criar(new Pool({ connectionString: url }), { schema });
}

const base = (await criarDb()) as unknown as ReturnType<typeof drizzleWs<typeof schema>>;

/** A transação da conta em curso, se houver alguma. */
type Ambiente = { tx: typeof base; orgId: string };
const ambiente = new AsyncLocalStorage<Ambiente>();

/**
 * O `db` que o resto do código importa.
 *
 * Por dentro é um proxy: quando a chamada está dentro de `comConta`, ele
 * entrega a TRANSAÇÃO daquela conta; fora dela, a conexão comum. Assim as
 * dezenas de consultas espalhadas pelo control plane não precisam receber um
 * parâmetro novo cada uma — e, o que importa mais, não existe a chance de
 * alguém esquecer de repassá-lo. Um lugar que pode errar é melhor que setenta.
 */
export const db = new Proxy(base, {
  get(alvo, prop) {
    const atual = ambiente.getStore();
    const usado = (atual?.tx ?? alvo) as unknown as Record<string | symbol, unknown>;
    const valor = usado[prop];
    return typeof valor === "function" ? valor.bind(usado) : valor;
  },
}) as typeof base;

/**
 * Roda `corpo` numa transação que DECLARA a conta ao banco.
 *
 * É o ponto único por onde o control plane passa. Enquanto o RLS não está
 * ligado, isto não muda comportamento nenhum — o valor só aparece quando as
 * políticas entram, e aí toda query fora daqui enxerga zero linhas.
 *
 * `set_config(..., true)` é o `SET LOCAL` que aceita parâmetro: `SET LOCAL`
 * não aceita bind, e montar o comando por concatenação com um id vindo de fora
 * é injeção de SQL esperando acontecer.
 */
export async function comConta<T>(orgId: string, corpo: () => Promise<T>): Promise<T> {
  return base.transaction(async (tx) => {
    await tx.execute(tag`select set_config('app.org_id', ${orgId}, true)`);
    return ambiente.run({ tx: tx as unknown as typeof base, orgId }, corpo);
  });
}

/** A conta declarada ao banco agora, se houver. Serve para teste e diagnóstico. */
export function contaEmCurso(): string | null {
  return ambiente.getStore()?.orgId ?? null;
}

export type Db = typeof db;
