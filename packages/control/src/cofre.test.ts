/**
 * A criptografia do cofre (S-025). Roda sem banco: é só matemática.
 *
 * O que estes testes tentam é justamente o que um atacante tentaria — abrir a
 * credencial de outra conta, mexer num byte, usar a chave errada. Criptografia
 * que nunca foi atacada num teste é criptografia que ninguém conferiu.
 */
import { randomBytes } from "node:crypto";
import { describe, expect, test } from "vitest";
import { cifrar, decifrar, dicaDe, lerChaves, segredosIguais, CofreIndisponivel, SegredoInvalido } from "./cofre.js";

const CONTA_A = "11111111-1111-4111-8111-111111111111";
const CONTA_B = "22222222-2222-4222-8222-222222222222";

function chave(versao = 1) {
  return { versao, bytes: randomBytes(32) };
}

describe("guardar e abrir", () => {
  test("o que entra é o que sai", () => {
    const k = chave();
    const segredo = "pit-abc123-token-do-ghl";
    const guardado = cifrar(k, CONTA_A, segredo);

    expect(guardado).not.toContain(segredo); // o óbvio, que precisa estar escrito
    expect(decifrar({ atual: k, antigas: [] }, CONTA_A, guardado)).toBe(segredo);
  });

  test("cifrar duas vezes o mesmo segredo dá resultados diferentes", () => {
    // sem isso, dava para ver que dois clientes usam o mesmo token
    const k = chave();
    expect(cifrar(k, CONTA_A, "igual")).not.toBe(cifrar(k, CONTA_A, "igual"));
  });
});

describe("a conta faz parte da chave", () => {
  test("a credencial de uma conta não abre na outra", () => {
    const k = chave();
    const guardado = cifrar(k, CONTA_A, "segredo da conta A");

    expect(() => decifrar({ atual: k, antigas: [] }, CONTA_B, guardado)).toThrow(SegredoInvalido);
  });

  test("mover a linha no banco para outra conta não entrega nada", () => {
    // o cenário real: alguém com acesso de escrita ao banco copia a linha
    const k = chave();
    const daOutra = cifrar(k, CONTA_A, "token caro");
    expect(() => decifrar({ atual: k, antigas: [] }, CONTA_B, daOutra)).toThrow(/chave incorreta|adulterada/);
  });
});

describe("adulteração", () => {
  test("mexer num byte quebra a abertura, não devolve lixo", () => {
    const k = chave();
    const guardado = cifrar(k, CONTA_A, "token do kommo");

    const bytes = Buffer.from(guardado, "base64");
    bytes[bytes.length - 1] ^= 0x01; // um bit só
    const mexido = bytes.toString("base64");

    expect(() => decifrar({ atual: k, antigas: [] }, CONTA_A, mexido)).toThrow(SegredoInvalido);
  });

  test("texto que não é credencial nenhuma é recusado", () => {
    const k = chave();
    expect(() => decifrar({ atual: k, antigas: [] }, CONTA_A, "nada disso")).toThrow(SegredoInvalido);
    expect(() => decifrar({ atual: k, antigas: [] }, CONTA_A, "")).toThrow(SegredoInvalido);
  });

  test("a chave errada não abre", () => {
    const guardado = cifrar(chave(), CONTA_A, "segredo");
    expect(() => decifrar({ atual: chave(), antigas: [] }, CONTA_A, guardado)).toThrow(SegredoInvalido);
  });
});

describe("rotação de chave", () => {
  test("o que foi cifrado com a chave velha continua abrindo", () => {
    const velha = chave(1);
    const nova = chave(2);
    const guardado = cifrar(velha, CONTA_A, "token antigo");

    // é isto que permite trocar a chave-mestra sem parar o sistema
    expect(decifrar({ atual: nova, antigas: [velha] }, CONTA_A, guardado)).toBe("token antigo");
  });

  test("com a chave nova, a velha nem é consultada", () => {
    const velha = chave(1);
    const nova = chave(2);
    const guardado = cifrar(nova, CONTA_A, "token novo");
    expect(decifrar({ atual: nova, antigas: [velha] }, CONTA_A, guardado)).toBe("token novo");
  });
});

describe("chaves do ambiente", () => {
  test("sem chave, o cofre diz o que fazer em vez de quebrar feio", () => {
    expect(() => lerChaves({} as NodeJS.ProcessEnv)).toThrow(CofreIndisponivel);
    expect(() => lerChaves({} as NodeJS.ProcessEnv)).toThrow(/randomBytes\(32\)/);
  });

  test("chave de tamanho errado é recusada na partida, não no primeiro uso", () => {
    const curta = `1:${randomBytes(16).toString("base64")}`;
    expect(() => lerChaves({ COFRE_CHAVE: curta } as NodeJS.ProcessEnv)).toThrow(/32 bytes/);
  });

  test("formato sem versão é recusado", () => {
    const semVersao = randomBytes(32).toString("base64");
    expect(() => lerChaves({ COFRE_CHAVE: semVersao } as NodeJS.ProcessEnv)).toThrow(/versao|<base64>/i);
  });

  test("as antigas entram na ordem, e a atual é a primeira a ser tentada", () => {
    const env = {
      COFRE_CHAVE: `2:${randomBytes(32).toString("base64")}`,
      COFRE_CHAVES_ANTIGAS: `1:${randomBytes(32).toString("base64")}`,
    } as NodeJS.ProcessEnv;
    const { atual, antigas } = lerChaves(env);
    expect(atual.versao).toBe(2);
    expect(antigas).toHaveLength(1);
    expect(antigas[0].versao).toBe(1);
  });
});

describe("dica", () => {
  test("mostra o fim do token, nunca o começo", () => {
    expect(dicaDe("pit-abcdefgh-1234")).toBe("…1234");
  });

  test("segredo curto não ganha dica — seriam metade dos caracteres", () => {
    expect(dicaDe("curto12")).toBeNull();
  });
});

describe("comparação", () => {
  test("compara sem entregar o tamanho da coincidência", () => {
    expect(segredosIguais("abc", "abc")).toBe(true);
    expect(segredosIguais("abc", "abd")).toBe(false);
    expect(segredosIguais("abc", "abcd")).toBe(false);
  });
});
