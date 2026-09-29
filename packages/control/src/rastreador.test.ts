/**
 * O rastreador de erros antes do banco (S-012): achar o motivo, limpar o que
 * não pode sair do processo e agrupar "o mesmo erro". Sem rede, sem banco.
 *
 * O que estes testes atacam é o vazamento: parâmetro de consulta, token,
 * e-mail e string de conexão são exatamente o tipo de coisa que aparece numa
 * mensagem de erro — e a tabela de erros e o e-mail de aviso não podem
 * carregar nenhum deles.
 */
import { describe, expect, test } from "vitest";
import { assinaturaDe, limparPilha, limparTexto, motivoDoErro, operadoresDaPlataforma } from "./rastreador.js";

describe("motivo do erro", () => {
  test("atravessa o embrulho do Drizzle até o erro do Postgres, e os parâmetros ficam de fora", () => {
    const pg = Object.assign(new Error('duplicate key value violates unique constraint "connections_org_kind"'), { code: "23505" });
    const embrulho = new Error(
      'Failed query: insert into "connections" ("org_id", "kind") values ($1, $2)\nparams: 3f9a2b1c-0000-4000-8000-000000000001,kommo',
      { cause: pg },
    );
    const { mensagem } = motivoDoErro(embrulho);
    expect(mensagem).toContain('duplicate key value violates unique constraint "connections_org_kind" (23505)');
    expect(mensagem).toContain('consulta: insert into "connections"');
    expect(mensagem).not.toContain("params");
    expect(mensagem).not.toContain("kommo");
  });

  test("erro que não é Error vira texto, e erro vazio tem frase", () => {
    expect(motivoDoErro("caiu").mensagem).toBe("caiu");
    expect(motivoDoErro({ codigo: 7 }).mensagem).toBe('{"codigo":7}');
    expect(motivoDoErro(undefined).mensagem).toBe("Erro sem mensagem.");
  });
});

describe("limpeza", () => {
  test("tira segredo, e-mail, string de conexão, parâmetros e números de telefone", () => {
    const sujo = [
      "falhou em postgres://neondb_owner:npg_AbCdEf123456@ep-x.neon.tech/db",
      "com Bearer eyJhbGciOiJIUzI1NiJ9.abc.def",
      "token mos_abcdefghijklmnop e npg_ZZZZZZZZZZZZ",
      "para fulano@cliente.com.br",
      "hash 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      "lead 5561991840065",
      "params: segredo,outro",
    ].join(" ");
    const limpo = limparTexto(sujo);
    for (const proibido of ["npg_AbCd", "eyJhbGci", "mos_abcdef", "npg_ZZZZ", "fulano@", "9f86d081", "5561991840065", "segredo,outro"]) {
      expect(limpo, proibido).not.toContain(proibido);
    }
    expect(limpo).toContain("<url do banco>");
    expect(limpo).toContain("Bearer <segredo>");
    expect(limpo).toContain("<e-mail>");
    expect(limpo).toContain("params: <omitidos>");
  });

  test("telefone solto sai; o último bloco de um UUID fica, senão o agrupamento quebra", () => {
    expect(limparTexto("lead 5561991840065 escreveu")).toBe("lead <número> escreveu");
    const comId = "registro 3f9a2b1c-0000-4000-8000-000000000001 não encontrado";
    expect(limparTexto(comId)).toBe(comId);
    expect(assinaturaDe("x", limparTexto(comId))).toBe(
      assinaturaDe("x", limparTexto("registro 71bc0000-1111-4222-8333-444444444444 não encontrado")),
    );
  });

  test("corta no tamanho e junta espaços; sequência longa sem espaço vira marcador", () => {
    expect(limparTexto("a   b\n\nc")).toBe("a b c");
    expect(limparTexto("ab ".repeat(700)).length).toBe(600);
    expect(limparTexto("x".repeat(2000))).toBe("<base64>");
  });

  test("pilha: só os quadros, com caminho relativo ao repositório", () => {
    const pilha = [
      "Error: caiu",
      "    at testarConexao (C:\\dev\\Metrik-OS\\motor-metrik-os\\packages\\control\\src\\index.ts:640:11)",
      "    at async handler (file:///var/task/apps/web/api/control.js:120:9)",
    ].join("\n");
    const limpa = limparPilha(pilha)!;
    expect(limpa).not.toContain("C:");
    expect(limpa).not.toContain("/var/task");
    expect(limpa).toContain("packages/control/src/index.ts:640:11");
    expect(limpa).toContain("apps/web/api/control.js:120:9");
    expect(limparPilha(undefined)).toBeUndefined();
  });
});

describe("assinatura", () => {
  test("o mesmo erro com ids, números e textos diferentes é um só", () => {
    const a = assinaturaDe("control:agents", 'violou "x" com id 3f9a2b1c-0000-4000-8000-000000000001 na linha 12');
    const b = assinaturaDe("control:agents", 'violou "y" com id 71bc0000-1111-4222-8333-444444444444 na linha 98');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  test("onde diferente, ou mensagem diferente, é outro erro", () => {
    const base = assinaturaDe("control:agents", "tempo esgotado");
    expect(assinaturaDe("auth:entrar", "tempo esgotado")).not.toBe(base);
    expect(assinaturaDe("control:agents", "conexão recusada")).not.toBe(base);
  });
});

describe("operadores da plataforma", () => {
  test("lista da variável, normalizada e sem repetição; sem ela, o DONO_INICIAL", () => {
    expect(
      operadoresDaPlataforma({ OPERADORES_DA_PLATAFORMA: " A@metrik.com, b@metrik.com ,a@metrik.com, lixo" } as NodeJS.ProcessEnv),
    ).toEqual(["a@metrik.com", "b@metrik.com"]);
    expect(operadoresDaPlataforma({ DONO_INICIAL: "Dono@Metrik.com" } as NodeJS.ProcessEnv)).toEqual(["dono@metrik.com"]);
    expect(operadoresDaPlataforma({} as NodeJS.ProcessEnv)).toEqual([]);
  });
});
