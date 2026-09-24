import { describe, expect, test } from "vitest";
import { SemPermissao } from "./erros.js";
import { exigirPermissao, permite } from "./permissoes.js";

describe("matriz de permissões", () => {
  test("viewer só lê — os achados da auditoria em uma linha", () => {
    expect(permite("viewer", "ver")).toBe(true);
    // não dispara chamada paga de IA
    expect(permite("viewer", "ajustar")).toBe(false);
    // não grava execução com valor em R$ (não infla o Radar)
    expect(permite("viewer", "operar")).toBe(false);
    expect(permite("viewer", "publicar")).toBe(false);
    expect(permite("viewer", "gerenciar")).toBe(false);
  });

  test("operator opera e pede mudança, mas NÃO aprova nem publica", () => {
    expect(permite("operator", "operar")).toBe(true);
    expect(permite("operator", "ajustar")).toBe(true);
    expect(permite("operator", "publicar")).toBe(false);
    expect(permite("operator", "gerenciar")).toBe(false);
  });

  test("admin e owner alcançam tudo", () => {
    for (const p of ["ver", "operar", "ajustar", "publicar", "gerenciar"] as const) {
      expect(permite("admin", p)).toBe(true);
      expect(permite("owner", p)).toBe(true);
    }
  });

  test("exigirPermissao levanta SemPermissao (403), não erro genérico", () => {
    expect(() => exigirPermissao({ role: "viewer" }, "publicar")).toThrow(SemPermissao);
    try {
      exigirPermissao({ role: "operator" }, "gerenciar");
    } catch (e) {
      expect(e).toBeInstanceOf(SemPermissao);
      expect((e as SemPermissao).status).toBe(403);
      expect((e as SemPermissao).codigo).toBe("sem_permissao");
    }
    expect(() => exigirPermissao({ role: "admin" }, "publicar")).not.toThrow();
  });
});

describe("erros de domínio carregam o status certo", () => {
  test("cada tipo tem seu código HTTP", async () => {
    const { EntradaInvalida, NaoEncontrado, Conflito, ehErroDeDominio } = await import("./erros.js");
    expect(new EntradaInvalida("x").status).toBe(400);
    expect(new NaoEncontrado("agente").status).toBe(404);
    expect(new NaoEncontrado("agente").message).toContain("nesta conta");
    expect(new Conflito("x").status).toBe(409);
    expect(ehErroDeDominio(new Conflito("x"))).toBe(true);
    expect(ehErroDeDominio(new Error("erro de banco com SQL dentro"))).toBe(false);
  });
});
