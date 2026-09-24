import { describe, expect, test } from "vitest";
import {
  ehTokenDeMaquina,
  escopoPermite,
  extrairToken,
  hashToken,
  normalizarEscopos,
  novoToken,
  papelDoToken,
} from "./tokens.js";

describe("geração e hash", () => {
  test("token novo tem prefixo, entropia e hash estável", () => {
    const a = novoToken();
    expect(a.token.startsWith("mos_")).toBe(true);
    expect(a.token.length).toBeGreaterThan(40);
    expect(a.hash).toHaveLength(64);
    expect(a.prefix).toBe(a.token.slice(0, 10));
    // o hash não carrega o token em claro
    expect(a.hash.includes(a.token.slice(4))).toBe(false);
    // mesmo token, mesmo hash; tokens diferentes, hashes diferentes
    expect(hashToken(a.token)).toBe(a.hash);
    expect(novoToken().hash).not.toBe(a.hash);
  });
});

describe("extração do pedido", () => {
  test("aceita x-motor-token e Bearer de token de máquina", () => {
    const { token } = novoToken();
    expect(extrairToken({ "x-motor-token": token })).toBe(token);
    expect(extrairToken({ authorization: `Bearer ${token}` })).toBe(token);
  });

  test("ignora sessão de pessoa, para ela seguir o próprio caminho", () => {
    // um JWT de sessão não começa com mos_
    expect(extrairToken({ authorization: "Bearer eyJhbGciOiJSUzI1NiJ9.abc.def" })).toBeNull();
    expect(extrairToken({})).toBeNull();
    expect(extrairToken({ "x-motor-token": "mos_curto" })).toBeNull();
  });

  test("reconhece o formato do token de máquina", () => {
    expect(ehTokenDeMaquina(novoToken().token)).toBe(true);
    expect(ehTokenDeMaquina("outro_" + "x".repeat(40))).toBe(false);
  });
});

describe("escopos", () => {
  test("admin abre tudo; os demais só o próprio escopo", () => {
    expect(escopoPermite(["admin"], "log")).toBe(true);
    expect(escopoPermite(["admin"], "mudanca")).toBe(true);
    expect(escopoPermite(["log"], "log")).toBe(true);
    // o caso que a auditoria pedia: token de ingestão não lê nem publica
    expect(escopoPermite(["log"], "leitura")).toBe(false);
    expect(escopoPermite(["log"], "mudanca")).toBe(false);
    expect(escopoPermite(["log"], "admin")).toBe(false);
    expect(escopoPermite([], "leitura")).toBe(false);
  });

  test("normaliza o que vem do banco, descartando lixo e repetição", () => {
    expect(normalizarEscopos(["log", "log", "inventado", 7])).toEqual(["log"]);
    expect(normalizarEscopos("log")).toEqual([]);
    expect(normalizarEscopos(null)).toEqual([]);
  });

  test("papel equivalente ao conjunto de escopos", () => {
    expect(papelDoToken(["admin"])).toBe("admin");
    expect(papelDoToken(["mudanca"])).toBe("operator");
    expect(papelDoToken(["log"])).toBe("viewer");
    expect(papelDoToken([])).toBe("viewer");
  });
});
