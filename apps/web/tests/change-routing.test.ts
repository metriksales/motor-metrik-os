import { expect, test } from "vitest";
import { destinoDe } from "../src/views/Estudio";

// Migrado de node:test para o Vitest, que é o runner único do monorepo (S-002).
test("pedido de follow-up vai para o motor operacional, não para a conversa", () => {
  expect(destinoDe("Quando o lead sumir, espera 1 dia e manda só 1 follow")).toBe("motor");
});
