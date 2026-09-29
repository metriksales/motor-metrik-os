// Erro da TELA vira erro rastreado (S-012).
//
// Antes, uma tela que quebrava no navegador de alguém só deixava rastro no
// console desse navegador — ninguém do lado de cá sabia. Aqui, o erro não
// tratado e a promessa rejeitada sem tratamento viram um registro no
// rastreador, com a página (sem query) e o começo da pilha.
//
// Limites de propósito: no máximo 5 por carregamento de página, sem repetir a
// mesma mensagem, e nada no modo demonstração. Um laço de erro não pode virar
// um laço de requisições.
import { api } from "./api";

const MAXIMO_POR_PAGINA = 5;

export function instalarRastreioDaTela(): () => void {
  const vistas = new Set<string>();
  let enviados = 0;

  const enviar = (mensagem: string, pilha?: string) => {
    const chave = mensagem.slice(0, 200);
    if (!chave || vistas.has(chave) || enviados >= MAXIMO_POR_PAGINA) return;
    vistas.add(chave);
    enviados++;
    // falhar ao registrar não pode gerar outro erro para registrar
    api
      .registrarErroDaTela({ mensagem: chave, pilha: pilha?.slice(0, 4000), pagina: window.location.pathname })
      .catch(() => {});
  };

  const aoErro = (ev: ErrorEvent) => {
    const e = ev.error;
    enviar(e instanceof Error ? e.message : ev.message || "Erro sem mensagem.", e instanceof Error ? e.stack : undefined);
  };
  const aoRejeitar = (ev: PromiseRejectionEvent) => {
    const e = ev.reason;
    enviar(
      e instanceof Error ? `Promessa rejeitada: ${e.message}` : `Promessa rejeitada: ${String(e).slice(0, 200)}`,
      e instanceof Error ? e.stack : undefined,
    );
  };

  window.addEventListener("error", aoErro);
  window.addEventListener("unhandledrejection", aoRejeitar);
  return () => {
    window.removeEventListener("error", aoErro);
    window.removeEventListener("unhandledrejection", aoRejeitar);
  };
}
