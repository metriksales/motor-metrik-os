// Regras do seletor de conta, separadas da tela para poderem ser testadas.
// O componente cuida de foco, teclado e pintura; aqui fica o que é decisão:
// o que a busca acha e quais contas contam como recentes.
import type { Conta } from "./auth";

/**
 * Achata acento e caixa. Sem isto, procurar "consultoria" não acha
 * "Consultoria" e procurar "sao" não acha "São" — e quem tem trinta contas
 * desiste da busca na primeira tentativa frustrada.
 */
export function achatar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Busca por pedaço do nome, em qualquer posição. */
export function filtrarContas(contas: Conta[], busca: string): Conta[] {
  const termo = achatar(busca.trim());
  if (!termo) return contas;
  return contas.filter((c) => achatar(c.nome).includes(termo));
}

/**
 * As recentes que vale mostrar: na ordem em que foram usadas, sem a conta já
 * aberta (ela está em destaque logo acima) e sem id que não corresponde mais a
 * conta nenhuma — acesso revogado deixa lixo na lista do navegador.
 */
export function escolherRecentes(
  contas: Conta[],
  ordem: string[],
  orgIdAtual: string | null | undefined,
  limite: number,
): Conta[] {
  const achadas: Conta[] = [];
  for (const id of ordem) {
    if (achadas.length >= limite) break;
    if (id === orgIdAtual) continue;
    const c = contas.find((x) => x.orgId === id);
    if (c) achadas.push(c);
  }
  return achadas;
}

/** Nova ordem depois de usar uma conta: ela vai para a frente, sem repetir. */
export function anotarUso(ordem: string[], orgId: string, guardar = 6): string[] {
  return [orgId, ...ordem.filter((x) => x !== orgId)].slice(0, guardar);
}
