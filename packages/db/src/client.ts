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
const url = getDatabaseUrl();
export const sql = neon(url);
export const db = drizzle(sql, { schema });
export type Db = typeof db;
