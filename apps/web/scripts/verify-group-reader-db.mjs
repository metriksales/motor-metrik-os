import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ausente");

const sql = neon(process.env.DATABASE_URL);
const [schema] = await sql`
  SELECT count(*)::int AS columns
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'group_reader_events'
`;
const [events] = await sql`SELECT count(*)::int AS events FROM group_reader_events`;

console.log(JSON.stringify({ columns: schema.columns, events: events.events }));
