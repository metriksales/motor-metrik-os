import { AsyncLocalStorage } from "node:async_hooks";
import { sql as tag } from "drizzle-orm";
import type { drizzle as drizzleWs } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

/**
 * A CONEXÃO DA APLICAÇÃO (S-046 parte 2).
 *
 * `DATABASE_URL_APP` conecta como `metrik_app`, que NÃO é dono das tabelas —
 * então o RLS vale desde o primeiro byte, e não só dentro de `comContexto`.
 * Uma consulta que esqueça de declarar a conta devolve zero linhas, em vez de
 * devolver tudo.
 *
 * QUANDO ELA NÃO EXISTE, a cadeia antiga assume e a aplicação conecta como
 * dona, exatamente como antes. Isso é de propósito: a variável é o único
 * interruptor da mudança, e apagá-la desfaz tudo sem migração reversa.
 *
 * `DATABASE_URL` continua sendo a do DONO e continua necessária — é ela que a
 * migração usa (via `scripts/migrar.mjs`, que prefere `DATABASE_URL_UNPOOLED`).
 * Papel restrito não cria tabela.
 */
export function getDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL_APP ??
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
/**
 * O PAPEL DA APLICAÇÃO (S-011), e a cicatriz de como ele quase derrubou tudo.
 *
 * `metrik_app` não é dono das tabelas, então as políticas de RLS valem para
 * ele. A primeira versão trocava de papel com `SET ROLE` ao ABRIR a conexão —
 * e isso é veneno num pooler de transação como o do Neon.
 *
 * `SET ROLE` é de SESSÃO. O pooler reaproveita a mesma conexão de servidor
 * entre clientes diferentes, então o papel vazava: uma conexão nova, aberta
 * pelo `drizzle-kit` para migrar, chegava já como `metrik_app` — e a migração
 * morria com "permission denied for schema public". Três deploys seguidos
 * falharam assim, e o SQL estava certo o tempo todo. A sonda mostrou:
 *
 *     POOLER : papel=metrik_app   sessao=neondb_owner
 *     DIRETO : papel=neondb_owner sessao=neondb_owner
 *
 * Por isso a troca agora é `SET LOCAL ROLE`, DENTRO da transação de
 * `comContexto`: morre no commit, não atravessa o pooler, não contamina
 * ninguém.
 *
 * O QUE SE PERDEU COM ISSO, dito na cara: consulta fora de `comContexto` roda
 * como dono e passa por cima do RLS. A proteção deixou de ser o padrão da
 * conexão e passou a valer por caminho — todos os caminhos passam por lá hoje,
 * mas "hoje" não é garantia.
 *
 * ISSO VALE ENQUANTO NÃO HOUVER `DATABASE_URL_APP` (S-046 parte 2). Com ela, a
 * conexão JÁ CHEGA como `metrik_app`: o `SET LOCAL ROLE` abaixo vira redundante
 * (trocar para o papel que já se é não faz nada e não custa nada), e a proteção
 * volta a ser o padrão da conexão. Os dois modos convivem de propósito — o
 * mesmo código roda nos dois, e a variável é o interruptor.
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

// Uma linha no log de partida dizendo em qual modo subiu. Sem isto, a diferença
// entre "o RLS é o padrão" e "o RLS vale por caminho" é invisível em produção —
// e é a diferença inteira desta mudança. Não imprime string de conexão nenhuma.
if (getDatabaseUrl()) {
  console.info(
    process.env.DATABASE_URL_APP
      ? "[db] conectado como metrik_app — RLS é o padrão da conexão"
      : "[db] conectado como DONO do banco — RLS só dentro de comContexto (S-046 parte 2 pendente)",
  );
}

/** O contexto em curso: de quem é a requisição, na visão do banco. */
type Ambiente = { tx: typeof base; orgId: string | null; userId: string | null };
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
 * Roda `corpo` numa transação que DECLARA ao banco de quem é a requisição.
 *
 * Duas coordenadas, porque o sistema tem dois tipos de pergunta:
 *  - `orgId`: "o que é desta conta" — quase tudo;
 *  - `userId`: "o que é desta pessoa, em qualquer conta" — o seletor de contas
 *    lista várias contas de uma pessoa, e convite é dirigido a alguém.
 *
 * Sem a segunda, a saída preguiçosa seria deixar `organizations`, `memberships`
 * e `invites` fora do RLS por serem "tabelas de login". Elas têm dono; o que
 * faltava era dizer quem.
 *
 * `set_config(..., true)` é o `SET LOCAL` que aceita parâmetro: `SET LOCAL`
 * não aceita bind, e montar o comando por concatenação com um id vindo de fora
 * é injeção de SQL esperando acontecer.
 */
export async function comContexto<T>(
  quem: { orgId?: string | null; userId?: string | null },
  corpo: () => Promise<T>,
): Promise<T> {
  const orgId = quem.orgId ?? null;
  const userId = quem.userId ?? null;
  return base.transaction(async (tx) => {
    // vira `metrik_app` SÓ nesta transação — ver o comentário grande acima
    // sobre por que isto não pode ser `SET ROLE` de sessão
    await tx.execute(tag`set local role metrik_app`);
    // string vazia é o que o Postgres devolve quando o parâmetro foi zerado;
    // a política trata '' e NULL como "não declarado" (ver contexto.test.ts)
    await tx.execute(tag`select set_config('app.org_id', ${orgId ?? ""}, true)`);
    await tx.execute(tag`select set_config('app.user_id', ${userId ?? ""}, true)`);
    return ambiente.run({ tx: tx as unknown as typeof base, orgId, userId }, corpo);
  });
}

/** Atalho para o caso comum: trabalho dentro de uma conta. */
export function comConta<T>(orgId: string, corpo: () => Promise<T>): Promise<T> {
  return comContexto({ orgId }, corpo);
}

/**
 * Trabalho que é da PESSOA e atravessa contas: listar as contas dela, aceitar
 * convite, encerrar sessão. Não há uma conta em curso, e forçar uma seria
 * mentira.
 */
export function comPessoa<T>(userId: string, corpo: () => Promise<T>): Promise<T> {
  return comContexto({ userId }, corpo);
}

/** O que foi declarado ao banco agora. Serve para teste e diagnóstico. */
export function contaEmCurso(): string | null {
  return ambiente.getStore()?.orgId ?? null;
}

export function pessoaEmCurso(): string | null {
  return ambiente.getStore()?.userId ?? null;
}

export type Db = typeof db;
