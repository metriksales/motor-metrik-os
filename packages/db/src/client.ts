import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
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

// Neon serverless driver = pooler HTTP → não estoura conexão em serverless.
// Placeholder quando não há env: o MÓDULO nunca crasha no import (neon("") lança);
// os guards (getDatabaseUrl()) impedem qualquer query sem banco configurado.
const url = getDatabaseUrl() || "postgresql://placeholder:placeholder@placeholder.invalid/placeholder";
export const sql = neon(url);

/**
 * Driver alternativo para TESTE (S-006): com `DB_DRIVER=pg`, fala com um
 * Postgres comum — é assim que a CI exercita isolamento entre contas num banco
 * de verdade, sem depender de um projeto Neon. Em produção este caminho nunca
 * roda: o driver segue sendo o neon-http.
 */
async function criarDb() {
  if (process.env.DB_DRIVER === "pg") {
    const [{ drizzle: drizzlePg }, pg] = await Promise.all([
      import("drizzle-orm/node-postgres"),
      import("pg"),
    ]);
    const pool = new pg.default.Pool({ connectionString: url });
    return drizzlePg(pool, { schema });
  }
  return drizzle(sql, { schema });
}

export const db = (await criarDb()) as ReturnType<typeof drizzle<typeof schema>>;
export type Db = typeof db;
