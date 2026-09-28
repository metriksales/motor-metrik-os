/**
 * O id de correlação (S-012).
 *
 * O que estes testes protegem não é a geração do id — é a ACEITAÇÃO de um id
 * que veio de fora. Cabeçalho é texto de terceiro que vai parar dentro de uma
 * linha de log, e log é onde se investiga incidente. Quem consegue escrever
 * linhas no log consegue forjar um incidente que não houve, ou empurrar o de
 * verdade para fora da janela que alguém está lendo.
 */
import { describe, expect, test } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { idDaRequisicao } from "../api/_observabilidade.js";

/** Mínimo de requisição e resposta para exercitar só o que importa aqui. */
function palco(cabecalho?: string | string[]) {
  const posto: Record<string, unknown> = {};
  const req = { headers: cabecalho === undefined ? {} : { "x-request-id": cabecalho } } as unknown as VercelRequest;
  const res = {
    setHeader(nome: string, valor: unknown) {
      posto[nome] = valor;
    },
  } as unknown as VercelResponse;
  return { req, res, posto };
}

describe("id de correlação", () => {
  test("sem id de fora, gera um e devolve no cabeçalho", () => {
    const { req, res, posto } = palco();
    const id = idDaRequisicao(req, res);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(posto["x-request-id"]).toBe(id);
  });

  test("id de fora é reaproveitado — é o que liga a chamada entre serviços", () => {
    const { req, res, posto } = palco("abc123-do-front");
    expect(idDaRequisicao(req, res)).toBe("abc123-do-front");
    expect(posto["x-request-id"]).toBe("abc123-do-front");
  });
});

describe("id de fora que tenta escrever no log", () => {
  // Cada um destes, se aceito, vira LINHA NOVA no log do servidor.
  const forjas = [
    ["quebra de linha", "ok\nERRO FALSO: banco caiu"],
    ["retorno de carro", "ok\r[control] req=outro"],
    ["tabulação e espaço", "ok\t erro=inventado"],
    ["escape de terminal", "ok\u001b[2K[control] falso"],
  ] as const;

  for (const [nome, veneno] of forjas) {
    test(`${nome} é descartado, e ganhamos um id nosso`, () => {
      const { req, res, posto } = palco(veneno);
      const id = idDaRequisicao(req, res);
      expect(id).not.toBe(veneno);
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      // e o que vai para o cabeçalho é o nosso, não o dele
      expect(String(posto["x-request-id"])).not.toContain("\n");
      expect(String(posto["x-request-id"])).not.toContain("FALSO");
    });
  }

  test("id curto demais não serve — não identifica nada", () => {
    const { req, res } = palco("x");
    expect(idDaRequisicao(req, res)).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("id longo demais é descartado: log não é depósito", () => {
    const { req, res } = palco("a".repeat(5000));
    expect(idDaRequisicao(req, res)).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("cabeçalho repetido: fica o primeiro, e ainda assim conferido", () => {
    const { req, res } = palco(["bom-id-aceitavel", "outro"]);
    expect(idDaRequisicao(req, res)).toBe("bom-id-aceitavel");

    const envenenado = palco(["mau\nid", "outro"]);
    expect(idDaRequisicao(envenenado.req, envenenado.res)).toMatch(/^[0-9a-f-]{36}$/);
  });
});
