import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Neon serverless driver = pooler HTTP → não estoura conexão em serverless.
const url = process.env.DATABASE_URL ?? "";
export const sql = neon(url);
export const db = drizzle(sql, { schema });
export type Db = typeof db;
