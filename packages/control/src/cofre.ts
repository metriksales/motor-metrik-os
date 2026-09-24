// COFRE (S-025) — a criptografia das credenciais de cliente.
//
// Este arquivo é só a matemática: cifrar, decifrar, derivar chave. Quem guarda
// e quem lê do banco está no index.ts. Separado de propósito — código de
// criptografia se revisa melhor sozinho, e assim ele é testável sem banco.
//
// AS ESCOLHAS, E POR QUÊ
//
// AES-256-GCM, não AES-CBC. GCM é autenticado: se alguém alterar um byte do
// texto cifrado, a decifragem FALHA em vez de devolver lixo plausível. Num
// cofre, "devolveu algo estranho" e "foi adulterado" precisam ser distinguíveis.
//
// CHAVE DERIVADA POR CONTA, via HKDF com o `orgId` como sal. A chave-mestra
// nunca cifra nada diretamente. Assim a credencial de um cliente não é
// decifrável com a chave derivada de outro — e é por isso que trocar o `orgId`
// na hora de ler não devolve o segredo alheio, devolve erro.
//
// O `orgId` VAI NO AAD (dado autenticado adicional). É o que amarra o texto
// cifrado à conta: copiar a linha de um cliente para a conta de outro no banco
// não funciona, porque a decifragem confere a amarração.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

const ALGORITMO = "aes-256-gcm";
const TAMANHO_IV = 12; // 96 bits, o recomendado para GCM
const TAMANHO_TAG = 16;
const TAMANHO_CHAVE = 32;

/** Uma chave-mestra e a sua versão. A versão é o que permite rotacionar. */
export type ChaveMestra = { versao: number; bytes: Buffer };

export class CofreIndisponivel extends Error {
  constructor(motivo: string) {
    super(`cofre indisponível: ${motivo}`);
    this.name = "CofreIndisponivel";
  }
}

export class SegredoInvalido extends Error {
  constructor(motivo: string) {
    super(`não consegui abrir a credencial: ${motivo}`);
    this.name = "SegredoInvalido";
  }
}

/**
 * Lê as chaves do ambiente.
 *
 * `COFRE_CHAVE` é a chave em uso, no formato `<versao>:<base64 de 32 bytes>`.
 * `COFRE_CHAVES_ANTIGAS` guarda as anteriores, separadas por vírgula, e só
 * serve para DECIFRAR — é o que permite rotacionar sem parar o sistema: cifra
 * com a nova, ainda abre o que foi cifrado com a velha.
 */
export function lerChaves(env: NodeJS.ProcessEnv = process.env): {
  atual: ChaveMestra;
  antigas: ChaveMestra[];
} {
  const atual = interpretarChave(env.COFRE_CHAVE ?? "", "COFRE_CHAVE");
  const antigas = (env.COFRE_CHAVES_ANTIGAS ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => interpretarChave(p, "COFRE_CHAVES_ANTIGAS"));
  return { atual, antigas };
}

function interpretarChave(valor: string, nome: string): ChaveMestra {
  if (!valor) {
    throw new CofreIndisponivel(
      `falta ${nome}. Gere uma com: node -e "console.log('1:' + require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }
  const corte = valor.indexOf(":");
  if (corte < 1) throw new CofreIndisponivel(`${nome} deve ser "<versao>:<base64>"`);

  const versao = Number(valor.slice(0, corte));
  if (!Number.isInteger(versao) || versao < 1) {
    throw new CofreIndisponivel(`${nome} tem versão inválida`);
  }

  const bytes = Buffer.from(valor.slice(corte + 1), "base64");
  if (bytes.length !== TAMANHO_CHAVE) {
    throw new CofreIndisponivel(`${nome} precisa de 32 bytes (${bytes.length} encontrados)`);
  }
  return { versao, bytes };
}

/**
 * A chave desta conta. A mestra nunca toca no texto: ela só gera esta.
 * HKDF com o `orgId` como sal — contas diferentes, chaves diferentes.
 */
function chaveDaConta(mestra: ChaveMestra, orgId: string): Buffer {
  return Buffer.from(hkdfSync("sha256", mestra.bytes, orgId, "metrik-os:cofre:v1", TAMANHO_CHAVE));
}

/** iv + tag + texto cifrado, em base64. Tudo que a linha do banco precisa. */
export function cifrar(mestra: ChaveMestra, orgId: string, segredo: string): string {
  if (!segredo) throw new SegredoInvalido("segredo vazio");
  const iv = randomBytes(TAMANHO_IV);
  const cifra = createCipheriv(ALGORITMO, chaveDaConta(mestra, orgId), iv);
  // amarra o texto cifrado à conta: mover a linha para outra conta não abre
  cifra.setAAD(Buffer.from(orgId, "utf8"));
  const corpo = Buffer.concat([cifra.update(segredo, "utf8"), cifra.final()]);
  return Buffer.concat([iv, cifra.getAuthTag(), corpo]).toString("base64");
}

/**
 * Abre a credencial. Tenta a chave atual e depois as antigas — é assim que a
 * rotação não derruba nada. Se nenhuma abrir, o erro NÃO diz qual falhou nem
 * por quê: quem está tentando adivinhar não merece pistas.
 */
export function decifrar(
  chaves: { atual: ChaveMestra; antigas: ChaveMestra[] },
  orgId: string,
  guardado: string,
): string {
  const bruto = Buffer.from(guardado, "base64");
  if (bruto.length <= TAMANHO_IV + TAMANHO_TAG) throw new SegredoInvalido("formato inesperado");

  const iv = bruto.subarray(0, TAMANHO_IV);
  const tag = bruto.subarray(TAMANHO_IV, TAMANHO_IV + TAMANHO_TAG);
  const corpo = bruto.subarray(TAMANHO_IV + TAMANHO_TAG);

  for (const mestra of [chaves.atual, ...chaves.antigas]) {
    try {
      const decifra = createDecipheriv(ALGORITMO, chaveDaConta(mestra, orgId), iv);
      decifra.setAuthTag(tag);
      decifra.setAAD(Buffer.from(orgId, "utf8"));
      return Buffer.concat([decifra.update(corpo), decifra.final()]).toString("utf8");
    } catch {
      // chave errada, conta errada ou linha adulterada — tenta a próxima
    }
  }
  throw new SegredoInvalido("chave incorreta ou credencial adulterada");
}

/**
 * Os últimos caracteres, para a pessoa reconhecer o token sem que a tela
 * mostre o valor. Segredo curto não ganha dica: com um token de 8 caracteres,
 * "os últimos 4" seria metade dele.
 */
export function dicaDe(segredo: string): string | null {
  if (segredo.length < 12) return null;
  return `…${segredo.slice(-4)}`;
}

/** Comparação de segredo em tempo constante. */
export function segredosIguais(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
