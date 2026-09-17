import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  extractGroupMessage,
  isAllowlisted,
  minimizeSender,
  parseAllowlist,
  secretsMatch,
} from "../server/group-reader.js";

function databaseUrl(): string {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_DATABASE_URL ??
    process.env.STORAGE_DATABASE_URL ??
    process.env.STORAGE_URL ??
    ""
  );
}

function requestSecret(req: VercelRequest): string {
  const header = req.headers["x-webhook-secret"];
  if (typeof header === "string") return header;
  if (Array.isArray(header)) return header[0] ?? "";
  return typeof req.query.secret === "string" ? req.query.secret : "";
}

async function ensureSchema(sql: NeonQueryFunction<false, false>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS group_reader_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id text NOT NULL,
      group_jid text NOT NULL,
      group_name text,
      sender_hash text,
      sender_last4 text,
      sender_name text,
      message_type text NOT NULL DEFAULT 'unknown',
      message_text text NOT NULL,
      from_me boolean NOT NULL DEFAULT false,
      sent_by_api boolean NOT NULL DEFAULT false,
      event_name text NOT NULL DEFAULT 'messages',
      source text NOT NULL DEFAULT 'uazapi',
      status text NOT NULL DEFAULT 'captured',
      occurred_at timestamp with time zone,
      received_at timestamp with time zone NOT NULL DEFAULT now(),
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      CONSTRAINT group_reader_events_group_message_unique UNIQUE (group_jid, message_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS group_reader_events_received_at_idx ON group_reader_events (received_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS group_reader_events_group_received_idx ON group_reader_events (group_jid, received_at DESC)`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.GROUP_READER_WEBHOOK_SECRET;
  const allowlist = parseAllowlist(process.env.GROUP_READER_ALLOWLIST);

  if (req.method === "GET" && !requestSecret(req)) {
    return res.status(200).json({
      ok: true,
      service: "metrik-group-reader",
      mode: "observe-only",
      repliesEnabled: false,
      configured: Boolean(secret && allowlist.size > 0 && databaseUrl()),
      allowlistedGroups: allowlist.size,
    });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "use GET or POST" });
  }
  if (!secretsMatch(requestSecret(req), secret)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const url = databaseUrl();
  if (!url) return res.status(503).json({ error: "database unavailable" });
  if (allowlist.size === 0) return res.status(503).json({ error: "group allowlist unavailable" });
  const sql = neon(url);

  try {
    await ensureSchema(sql);

    if (req.method === "GET") {
      const limitInput = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
      const limit = Math.max(1, Math.min(50, Number(limitInput ?? 10) || 10));
      const groups = Array.from(allowlist);
      const totals = await sql`
        SELECT count(*)::int AS total, max(received_at) AS last_received_at
        FROM group_reader_events
        WHERE group_jid = ANY(${groups}::text[])
      `;
      const events = await sql`
        SELECT id, message_id, group_name, sender_name, sender_last4, message_type,
               message_text, from_me, occurred_at, received_at, status
        FROM group_reader_events
        WHERE group_jid = ANY(${groups}::text[])
        ORDER BY received_at DESC
        LIMIT ${limit}
      `;
      return res.status(200).json({ ok: true, mode: "observe-only", totals: totals[0], events });
    }

    const message = extractGroupMessage(req.body);
    if (!message) {
      return res.status(200).json({ ok: true, stored: false, reason: "not_a_supported_group_message" });
    }
    if (!isAllowlisted(message.groupJid, allowlist)) {
      return res.status(200).json({ ok: true, stored: false, reason: "outside_allowlist" });
    }

    const sender = minimizeSender(message.senderJid, process.env.GROUP_READER_HASH_SALT || secret || "");
    const metadata = JSON.stringify({ parserVersion: 1, observeOnly: true });
    const inserted = await sql`
      INSERT INTO group_reader_events (
        message_id, group_jid, group_name, sender_hash, sender_last4, sender_name,
        message_type, message_text, from_me, sent_by_api, event_name, occurred_at,
        metadata
      ) VALUES (
        ${message.messageId}, ${message.groupJid}, ${message.groupName || null},
        ${sender.hash || null}, ${sender.last4 || null}, ${message.senderName || null},
        ${message.messageType}, ${message.messageText}, ${message.fromMe},
        ${message.sentByApi}, ${message.eventName}, ${message.occurredAt},
        ${metadata}::jsonb
      )
      ON CONFLICT (group_jid, message_id) DO NOTHING
      RETURNING id
    `;

    return res.status(200).json({ ok: true, stored: inserted.length === 1, duplicate: inserted.length === 0 });
  } catch (error) {
    console.error("[group-reader] persistence failed", error instanceof Error ? error.message : "unknown error");
    return res.status(503).json({ error: "persistence_failed" });
  }
}
