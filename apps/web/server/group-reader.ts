import { createHmac, timingSafeEqual } from "node:crypto";

export const MAX_TEXT_LENGTH = 12_000;

export interface CapturedGroupMessage {
  eventName: string;
  messageId: string;
  groupJid: string;
  groupName: string;
  senderJid: string;
  senderName: string;
  messageType: string;
  messageText: string;
  fromMe: boolean;
  sentByApi: boolean;
  occurredAt: Date | null;
}

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function firstObject(...values: unknown[]): JsonObject {
  for (const value of values) {
    const candidate = object(value);
    if (candidate) return candidate;
  }
  return {};
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function bool(...values: unknown[]): boolean {
  return values.some((value) => value === true || value === "true" || value === 1 || value === "1");
}

function firstArrayObject(value: unknown): JsonObject | null {
  if (!Array.isArray(value)) return null;
  return value.map(object).find(Boolean) ?? null;
}

function normalizeJid(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeMessageType(value: string, message: JsonObject): string {
  const normalized = value.trim().toLowerCase();
  if (normalized) return normalized.slice(0, 80);

  const whatsappMessage = object(message.message);
  if (whatsappMessage) {
    const detected = Object.keys(whatsappMessage).find((key) => key.endsWith("Message"));
    if (detected) return detected.replace(/Message$/, "").toLowerCase().slice(0, 80);
  }
  return "unknown";
}

function extractText(message: JsonObject): string {
  const content = firstObject(message.content);
  const whatsappMessage = firstObject(message.message);
  const extended = firstObject(whatsappMessage.extendedTextMessage);
  const image = firstObject(whatsappMessage.imageMessage, message.image);
  const video = firstObject(whatsappMessage.videoMessage, message.video);
  const document = firstObject(whatsappMessage.documentMessage, message.document);

  const text = firstString(
    message.text,
    content.text,
    message.body,
    message.caption,
    content.caption,
    message.conversation,
    whatsappMessage.conversation,
    extended.text,
    image.caption,
    video.caption,
    document.caption,
    typeof message.content === "string" ? message.content : "",
  );
  return text.slice(0, MAX_TEXT_LENGTH);
}

function parseOccurredAt(...values: unknown[]): Date | null {
  for (const value of values) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === "number" && Number.isFinite(value)) {
      const millis = value < 10_000_000_000 ? value * 1000 : value;
      const date = new Date(millis);
      if (!Number.isNaN(date.getTime())) return date;
    }
    if (typeof value === "string" && value.trim()) {
      if (/^\d+$/.test(value.trim())) {
        const numeric = Number(value);
        const millis = numeric < 10_000_000_000 ? numeric * 1000 : numeric;
        const date = new Date(millis);
        if (!Number.isNaN(date.getTime())) return date;
      }
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }
  return null;
}

/** Parser tolerante às variações conhecidas do payload UAZAPI v2. */
export function extractGroupMessage(rawBody: unknown): CapturedGroupMessage | null {
  const root = object(rawBody);
  if (!root) return null;

  const data = firstObject(root.data);
  const nested = firstObject(
    root.message,
    firstArrayObject(root.messages),
    data.message,
    firstArrayObject(data.messages),
    data,
    root,
  );
  const key = firstObject(nested.key);
  const chat = firstObject(nested.chat, data.chat, root.chat);
  const sender = firstObject(nested.sender, data.sender, root.sender);

  const groupJid = normalizeJid(firstString(
    nested.chatid,
    nested.chatId,
    nested.remoteJid,
    key.remoteJid,
    chat.wa_chatid,
    chat.id,
    data.chatid,
    data.chatId,
    root.chatid,
    root.chatId,
  ));
  const isGroup = groupJid.endsWith("@g.us") || bool(nested.isGroup, nested.wa_isGroup, chat.wa_isGroup);
  if (!groupJid || !isGroup) return null;

  const senderJid = normalizeJid(firstString(
    nested.participant,
    nested.senderJid,
    nested.sender_pn,
    nested.senderPn,
    key.participant,
    sender.id,
    sender.jid,
    data.participant,
  ));
  const messageType = normalizeMessageType(
    firstString(nested.messageType, nested.mediaType, nested.type, data.messageType, root.type),
    nested,
  );
  const messageText = extractText(nested) || `[${messageType}]`;
  const messageId = firstString(nested.id, nested.messageid, nested.messageId, key.id, data.id, root.id);
  if (!messageId) return null;

  return {
    eventName: firstString(root.event, data.event, root.EventType) || "messages",
    messageId: messageId.slice(0, 300),
    groupJid,
    groupName: firstString(nested.chatName, nested.groupName, chat.name, data.chatName).slice(0, 300),
    senderJid,
    senderName: firstString(
      nested.pushName,
      nested.senderName,
      nested.notifyName,
      sender.name,
      data.pushName,
    ).slice(0, 300),
    messageType,
    messageText,
    fromMe: bool(nested.fromMe, key.fromMe, data.fromMe, root.fromMe),
    sentByApi: bool(nested.wasSentByApi, data.wasSentByApi, root.wasSentByApi),
    occurredAt: parseOccurredAt(
      nested.messageTimestamp,
      nested.timestamp,
      data.messageTimestamp,
      root.timestamp,
    ),
  };
}

export function parseAllowlist(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map(normalizeJid)
      .filter((jid) => jid.endsWith("@g.us")),
  );
}

export function isAllowlisted(groupJid: string, allowlist: Set<string>): boolean {
  return allowlist.has(normalizeJid(groupJid));
}

export function minimizeSender(senderJid: string, secret: string): { hash: string; last4: string } {
  const digits = senderJid.replace(/@.*$/, "").replace(/\D+/g, "");
  if (!senderJid) return { hash: "", last4: "" };
  return {
    hash: createHmac("sha256", secret).update(normalizeJid(senderJid)).digest("hex"),
    last4: digits.slice(-4),
  };
}

export function secretsMatch(actual: unknown, expected: string | undefined): boolean {
  if (!expected || typeof actual !== "string") return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
