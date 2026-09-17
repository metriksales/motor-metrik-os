import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const baseUrl = process.argv[2];
const secret = process.env.GROUP_READER_WEBHOOK_SECRET;
const databaseUrl = process.env.DATABASE_URL;
const groupJid = (process.env.GROUP_READER_ALLOWLIST ?? "").split(",")[0]?.trim();

if (!baseUrl || !secret || !databaseUrl || !groupJid) {
  throw new Error("base URL ou variáveis do piloto ausentes");
}

const endpoint = `${baseUrl.replace(/\/$/, "")}/api/group-reader`;
const messageId = `pilot-selftest-${randomUUID()}`;
const sql = neon(databaseUrl);

async function json(response) {
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(body)}`);
  return body;
}

try {
  const health = await json(await fetch(endpoint));
  if (!health.configured || health.repliesEnabled !== false || health.allowlistedGroups !== 1) {
    throw new Error(`health inesperado: ${JSON.stringify(health)}`);
  }

  const unauthorized = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "x-webhook-secret": "segredo-incorreto" },
    body: JSON.stringify({}),
  });
  if (unauthorized.status !== 401) throw new Error(`auth deveria retornar 401, retornou ${unauthorized.status}`);

  const payload = {
    event: "messages",
    message: {
      id: messageId,
      chatid: groupJid,
      chatName: "Metrik Dev",
      sender: "558500000001@s.whatsapp.net",
      senderName: "Verificação Metrik",
      messageType: "text",
      text: "[self-test] leitor de grupos",
      timestamp: Math.floor(Date.now() / 1000),
    },
  };
  const headers = { "content-type": "application/json", "x-webhook-secret": secret };
  const first = await json(await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(payload) }));
  if (first.stored !== true) throw new Error(`primeira gravação falhou: ${JSON.stringify(first)}`);

  const duplicate = await json(await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(payload) }));
  if (duplicate.duplicate !== true) throw new Error(`deduplicação falhou: ${JSON.stringify(duplicate)}`);

  const audit = await json(await fetch(`${endpoint}?limit=10`, { headers: { "x-webhook-secret": secret } }));
  if (!audit.events.some((event) => event.message_id === messageId)) {
    throw new Error("evento não apareceu na auditoria protegida");
  }

  console.log(JSON.stringify({ health: true, auth: true, persistence: true, dedupe: true, adminRead: true }));
} finally {
  await sql`DELETE FROM group_reader_events WHERE group_jid = ${groupJid} AND message_id = ${messageId}`;
}
