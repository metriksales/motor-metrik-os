import { describe, expect, test } from "vitest";
import { achatar, anotarUso, escolherRecentes, filtrarContas } from "@/lib/contas";
import type { Conta } from "@/lib/auth";

const conta = (orgId: string, nome: string): Conta => ({ orgId, nome, role: "owner" });

const CONTAS: Conta[] = [
  conta("a", "Vega Consultoria"),
  conta("b", "Sertão Advocacia"),
  conta("c", "teste-1790010008805581"),
  conta("d", "contatosalesmetrik"),
];

describe("busca de conta", () => {
  test("ignora acento e caixa", () => {
    expect(achatar("Sertão")).toBe("sertao");
    expect(filtrarContas(CONTAS, "sertao").map((c) => c.orgId)).toEqual(["b"]);
    expect(filtrarContas(CONTAS, "VEGA").map((c) => c.orgId)).toEqual(["a"]);
  });

  test("acha por pedaço no meio do nome", () => {
    expect(filtrarContas(CONTAS, "consult").map((c) => c.orgId)).toEqual(["a"]);
  });

  test("busca vazia devolve tudo, e espaço não conta como busca", () => {
    expect(filtrarContas(CONTAS, "")).toHaveLength(4);
    expect(filtrarContas(CONTAS, "   ")).toHaveLength(4);
  });

  test("sem resultado devolve lista vazia, não a lista inteira", () => {
    expect(filtrarContas(CONTAS, "zzz")).toEqual([]);
  });
});

describe("contas recentes", () => {
  test("respeita a ordem de uso e tira a conta já aberta", () => {
    const r = escolherRecentes(CONTAS, ["c", "a", "b"], "c", 3);
    expect(r.map((x) => x.orgId)).toEqual(["a", "b"]);
  });

  test("descarta id que não é mais conta da pessoa", () => {
    // acesso revogado: o id fica no navegador, mas não pode virar linha clicável
    const r = escolherRecentes(CONTAS, ["sumiu", "a"], null, 3);
    expect(r.map((x) => x.orgId)).toEqual(["a"]);
  });

  test("respeita o limite", () => {
    const r = escolherRecentes(CONTAS, ["a", "b", "c", "d"], null, 2);
    expect(r.map((x) => x.orgId)).toEqual(["a", "b"]);
  });
});

describe("anotar uso", () => {
  test("põe na frente sem duplicar", () => {
    expect(anotarUso(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
    expect(anotarUso(["a", "b"], "novo")).toEqual(["novo", "a", "b"]);
  });

  test("não cresce sem fim", () => {
    expect(anotarUso(["1", "2", "3", "4", "5", "6"], "novo", 3)).toEqual(["novo", "1", "2"]);
  });
});
