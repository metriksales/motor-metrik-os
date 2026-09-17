import assert from "node:assert/strict";
import test from "node:test";
import {
  extractGroupMessage,
  isAllowlisted,
  minimizeSender,
  parseAllowlist,
  secretsMatch,
} from "../server/group-reader.js";

const group = "120363420771756873@g.us";

test("extracts a direct UAZAPI group message", () => {
  const captured = extractGroupMessage({
    event: "messages",
    message: {
      id: "msg-1",
      chatid: group,
      chatName: "Metrik Dev",
      sender: "558599999999@s.whatsapp.net",
      senderName: "Pessoa",
      text: "Ajustar o prompt do cliente X",
      messageType: "text",
      timestamp: 1_789_560_000,
    },
  });

  assert.ok(captured);
  assert.equal(captured.groupJid, group);
  assert.equal(captured.groupName, "Metrik Dev");
  assert.equal(captured.messageText, "Ajustar o prompt do cliente X");
  assert.equal(captured.senderName, "Pessoa");
});

test("extracts a wrapped WhatsApp payload and media caption", () => {
  const captured = extractGroupMessage({
    event: "messages",
    data: {
      message: {
        key: { id: "msg-2", remoteJid: group, participant: "558588888888@s.whatsapp.net" },
        message: { imageMessage: { caption: "Erro mostrado neste print" } },
      },
    },
  });

  assert.ok(captured);
  assert.equal(captured.messageId, "msg-2");
  assert.equal(captured.messageType, "image");
  assert.equal(captured.messageText, "Erro mostrado neste print");
});

test("rejects direct chats and payloads without a stable message id", () => {
  assert.equal(extractGroupMessage({ message: { id: "x", chatid: "558599999999@s.whatsapp.net", text: "oi" } }), null);
  assert.equal(extractGroupMessage({ message: { chatid: group, text: "sem id" } }), null);
});

test("enforces an exact group allowlist", () => {
  const allowlist = parseAllowlist(` ${group},not-a-group,120000000000000000@g.us `);
  assert.equal(allowlist.size, 2);
  assert.equal(isAllowlisted(group, allowlist), true);
  assert.equal(isAllowlisted("120000000000000001@g.us", allowlist), false);
});

test("minimizes sender and compares secrets safely", () => {
  const sender = minimizeSender("558599999999@s.whatsapp.net", "test-secret");
  assert.equal(sender.last4, "9999");
  assert.equal(sender.hash.length, 64);
  assert.equal(sender.hash.includes("558599999999"), false);
  assert.equal(secretsMatch("same", "same"), true);
  assert.equal(secretsMatch("different", "same"), false);
});
