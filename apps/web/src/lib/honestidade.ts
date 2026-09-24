// A regra da tela honesta (S-007), num lugar só.
//
// O painel promete "o que a IA fez de verdade". Um número inventado numa conta
// real destrói a credibilidade de todos os números verdadeiros — inclusive os
// certos. Então: maquete SÓ na vitrine (modo demo). Na conta de alguém, quando
// não há dado, a tela diz que não há.

/**
 * Devolve o valor de demonstração **apenas** no modo demo; fora dele, `null`.
 *
 * ```ts
 * const kpis = reais ?? apenasNoDemo(auth.demo, STATS) ?? VAZIO;
 * ```
 */
export function apenasNoDemo<T>(demo: boolean, valorDeDemonstracao: T): T | null {
  return demo ? valorDeDemonstracao : null;
}

/** Estado do que a tela tem para mostrar — evita confundir "vazio" com "erro". */
export type EstadoDoDado = "carregando" | "erro" | "vazio" | "ok" | "demo";

export function estadoDoDado(input: {
  demo: boolean;
  carregando: boolean;
  erro?: unknown;
  temDado: boolean;
}): EstadoDoDado {
  if (input.demo) return "demo";
  if (input.erro) return "erro";
  if (input.carregando) return "carregando";
  return input.temDado ? "ok" : "vazio";
}

/** O que escrever quando não há número real — nunca um número inventado. */
export const SEM_DADO = "—";

/** Frase curta por estado, para o rodapé de um bloco de números. */
export function legendaDoEstado(estado: EstadoDoDado): string {
  switch (estado) {
    case "demo":
      return "números de demonstração";
    case "erro":
      return "não consegui ler os dados da sua conta";
    case "carregando":
      return "lendo os dados da sua conta…";
    case "vazio":
      return "sem atividade registrada ainda";
    case "ok":
      return "dados reais da sua conta";
  }
}
