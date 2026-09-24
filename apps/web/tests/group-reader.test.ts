import { expect, test } from "vitest";
import {
  extractGroupMessage,
  isAllowlisted,
  minimizeSender,
  parseAllowlist,
  secretsMatch,
} from "../server/group-reader.js";

// JID fictício de propósito: nada de grupo real em teste (ver S-002).
const group = "120000000000000000@g.us";

test("extrai mensagem de grupo direta da UAZAPI", () => {
  const captured = extractGroupMessage({
    event: "messages",
    message: {
      id: "msg-1",
      chatid: group,
      chatName: "Grupo de Teste",
      sender: "558599999999@s.whatsapp.net",
      senderName: "Pessoa",
      text: "Ajustar o prompt do cliente X",
      messageType: "text",
      timestamp: 1_789_560_000,
    },
  });

  expect(captured).toBeTruthy();
  expect(captured?.groupJid).toBe(group);
  expect(captured?.groupName).toBe("Grupo de Teste");
  expect(captured?.messageText).toBe("Ajustar o prompt do cliente X");
  expect(captured?.senderName).toBe("Pessoa");
});

test("extrai payload aninhado do WhatsApp e a legenda da mídia", () => {
  const captured = extractGroupMessage({
    event: "messages",
    data: {
      message: {
        key: { id: "msg-2", remoteJid: group, participant: "558588888888@s.whatsapp.net" },
        message: { imageMessage: { caption: "Erro mostrado neste print" } },
      },
    },
  });

  expect(captured).toBeTruthy();
  expect(captured?.messageId).toBe("msg-2");
  expect(captured?.messageType).toBe("image");
  expect(captured?.messageText).toBe("Erro mostrado neste print");
});

test("recusa conversa direta e payload sem id estável de mensagem", () => {
  expect(
    extractGroupMessage({ message: { id: "x", chatid: "558599999999@s.whatsapp.net", text: "oi" } }),
  ).toBeNull();
  expect(extractGroupMessage({ message: { chatid: group, text: "sem id" } })).toBeNull();
});

test("aplica a lista de grupos liberados de forma exata", () => {
  const allowlist = parseAllowlist(` ${group},not-a-group,120000000000000009@g.us `);
  expect(allowlist.size).toBe(2);
  expect(isAllowlisted(group, allowlist)).toBe(true);
  expect(isAllowlisted("120000000000000001@g.us", allowlist)).toBe(false);
});

test("minimiza o remetente e compara segredos com segurança", () => {
  const sender = minimizeSender("558599999999@s.whatsapp.net", "test-secret");
  expect(sender.last4).toBe("9999");
  expect(sender.hash).toHaveLength(64);
  expect(sender.hash.includes("558599999999")).toBe(false);
  expect(secretsMatch("same", "same")).toBe(true);
  expect(secretsMatch("different", "same")).toBe(false);
});
