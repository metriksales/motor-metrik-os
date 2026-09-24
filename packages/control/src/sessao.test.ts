import { describe, expect, test } from "vitest";
import {
  COOKIE_CSRF,
  COOKIE_SESSAO,
  cookieDeCsrf,
  cookieDeSessao,
  cookiesDeSaida,
  csrfValido,
  emailValido,
  expiraEm,
  expirou,
  hash,
  iguais,
  lerCookies,
  normalizarEmail,
  novoCodigo,
  novoTokenOpaco,
  origemConfere,
} from "./sessao.js";

describe("código de entrada", () => {
  test("tem 6 dígitos e só o hash sai daqui", () => {
    const { codigo, hash: h } = novoCodigo();
    expect(codigo).toMatch(/^\d{6}$/);
    expect(h).toHaveLength(64);
    expect(h).not.toContain(codigo);
    expect(hash(codigo)).toBe(h);
  });

  test("dois códigos seguidos não são iguais", () => {
    const a = new Set(Array.from({ length: 20 }, () => novoCodigo().codigo));
    expect(a.size).toBeGreaterThan(15); // sorteio, não sequência
  });
});

describe("token opaco", () => {
  test("é longo e guardado em hash", () => {
    const { token, hash: h } = novoTokenOpaco();
    expect(token.length).toBeGreaterThan(40);
    expect(h).toHaveLength(64);
    expect(novoTokenOpaco().hash).not.toBe(h);
  });
});

describe("comparação em tempo constante", () => {
  test("compara valor, não tamanho", () => {
    expect(iguais("123456", "123456")).toBe(true);
    expect(iguais("123456", "123457")).toBe(false);
    expect(iguais("123456", "12345")).toBe(false);
    expect(iguais("", "")).toBe(true);
  });
});

describe("e-mail", () => {
  test("normaliza e valida", () => {
    expect(normalizarEmail("  Pessoa@Metrik.COM ")).toBe("pessoa@metrik.com");
    expect(emailValido("pessoa@metrik.com")).toBe(true);
    expect(emailValido("pessoa@metrik")).toBe(false);
    expect(emailValido("sem-arroba.com")).toBe(false);
    expect(emailValido("")).toBe(false);
  });
});

describe("cookies", () => {
  test("sessão é httpOnly, Secure e SameSite=Lax", () => {
    const c = cookieDeSessao("abc");
    expect(c).toContain(`${COOKIE_SESSAO}=abc`);
    expect(c).toContain("HttpOnly");
    expect(c).toContain("Secure");
    expect(c).toContain("SameSite=Lax");
  });

  test("o de CSRF é legível pelo JavaScript de propósito (sem HttpOnly)", () => {
    const c = cookieDeCsrf("xyz");
    expect(c).toContain(`${COOKIE_CSRF}=xyz`);
    expect(c).not.toContain("HttpOnly");
  });

  test("sair apaga os dois", () => {
    const saida = cookiesDeSaida();
    expect(saida).toHaveLength(2);
    for (const c of saida) expect(c).toContain("Max-Age=0");
  });

  test("lê o cabeçalho cru", () => {
    expect(lerCookies("a=1; mos_sessao=tok; b=2")).toMatchObject({ a: "1", mos_sessao: "tok", b: "2" });
    expect(lerCookies(undefined)).toEqual({});
  });
});

describe("CSRF — a superfície que o cookie criou", () => {
  test("leitura passa sem token", () => {
    expect(csrfValido({ metodo: "GET", cookie: undefined, header: undefined })).toBe(true);
  });

  test("escrita exige o mesmo valor no cookie e no header", () => {
    expect(csrfValido({ metodo: "POST", cookie: "t1", header: "t1" })).toBe(true);
    expect(csrfValido({ metodo: "POST", cookie: "t1", header: "outro" })).toBe(false);
    // é isto que um site hostil consegue: o cookie vai, o header não
    expect(csrfValido({ metodo: "POST", cookie: "t1", header: undefined })).toBe(false);
    expect(csrfValido({ metodo: "POST", cookie: undefined, header: "t1" })).toBe(false);
  });
});

describe("origem", () => {
  test("aceita mesma origem e recusa outra", () => {
    expect(origemConfere({ origin: "https://app.metrik.com", host: "app.metrik.com" })).toBe(true);
    expect(origemConfere({ origin: "https://site-hostil.com", host: "app.metrik.com" })).toBe(false);
    expect(origemConfere({ origin: undefined, host: "app.metrik.com" })).toBe(true);
    expect(origemConfere({ origin: "nao-e-url", host: "app.metrik.com" })).toBe(false);
  });
});

describe("expiração", () => {
  test("conta o tempo certo", () => {
    const agora = new Date("2026-09-24T12:00:00Z");
    expect(expiraEm(10, agora).toISOString()).toBe("2026-09-24T12:10:00.000Z");
    expect(expirou("2026-09-24T11:59:00Z", agora)).toBe(true);
    expect(expirou("2026-09-24T12:01:00Z", agora)).toBe(false);
  });
});
