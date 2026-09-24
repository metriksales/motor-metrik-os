import { describe, expect, test } from "vitest";
import { ehSegredoEntrada, extrairSegredoEntrada, hashSegredo, novoSegredoEntrada } from "./webhooks.js";

describe("segredo de entrada", () => {
  test("gera valor com prefixo e hash estável", () => {
    const a = novoSegredoEntrada();
    expect(a.segredo.startsWith("mws_")).toBe(true);
    expect(a.hash).toHaveLength(64);
    expect(hashSegredo(a.segredo)).toBe(a.hash);
    expect(novoSegredoEntrada().hash).not.toBe(a.hash);
  });

  test("reconhece o formato", () => {
    expect(ehSegredoEntrada(novoSegredoEntrada().segredo)).toBe(true);
    expect(ehSegredoEntrada("mws_curto")).toBe(false);
    expect(ehSegredoEntrada("mos_" + "x".repeat(40))).toBe(false);
  });
});

describe("extração do pedido", () => {
  const { segredo } = novoSegredoEntrada();

  test("header é o caminho preferido", () => {
    const r = extrairSegredoEntrada({ headers: { "x-webhook-secret": segredo } });
    expect(r).toEqual({ segredo, viaQuery: false });
  });

  test("query é aceita, mas marcada", () => {
    expect(extrairSegredoEntrada({ query: { s: segredo } })).toEqual({ segredo, viaQuery: true });
    expect(extrairSegredoEntrada({ query: { secret: segredo } })).toEqual({ segredo, viaQuery: true });
  });

  test("sem segredo ou com segredo de outro formato, não passa — fail-closed", () => {
    expect(extrairSegredoEntrada({})).toBeNull();
    expect(extrairSegredoEntrada({ headers: {}, query: {} })).toBeNull();
    expect(extrairSegredoEntrada({ headers: { "x-webhook-secret": "" } })).toBeNull();
    // token de máquina não serve como segredo de entrada
    expect(extrairSegredoEntrada({ query: { s: "mos_" + "y".repeat(40) } })).toBeNull();
  });
});
