// O mínimo para um incidente não virar adivinhação (S-012).
//
// POR QUE ISTO EXISTE. Hoje, quando algo quebra em produção, o caminho é abrir
// o console da Vercel e procurar. Isso falha de duas formas: o console engasga
// em janelas grandes (aconteceu três vezes num dia só), e sem um id comum não
// há como ligar "deu erro na minha tela" à linha de log que explica o porquê.
//
// A peça é pequena de propósito: um id por requisição, no cabeçalho da resposta
// e no log do erro. Quem vê o erro na tela copia o id; quem procura no log acha
// pelo mesmo id.
import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { registrarErro } from "./_bundled/motor.mjs";

/** Aceita id de fora, mas só se ele for inofensivo. */
const ID_ACEITAVEL = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * O id desta requisição, já posto no cabeçalho `x-request-id` da resposta.
 *
 * SE VEIO UM DE FORA, reaproveita. É o que permite seguir uma chamada que
 * atravessa serviços — o front, ou um agente de operação, manda o id que já
 * usa e os dois lados registram o mesmo.
 *
 * MAS SÓ SE FOR SÃO, e isto não é paranoia de formulário: cabeçalho é texto
 * que veio de fora, e vai direto para dentro de uma linha de log. Um id com
 * quebra de linha injeta LINHAS INTEIRAS no log — dá para forjar um "erro" que
 * nunca houve, ou empurrar o de verdade para longe. Id estranho é descartado
 * em silêncio e geramos um nosso; recusar a requisição seria pior, porque
 * transformaria um detalhe de telemetria em porta fechada.
 */
export function idDaRequisicao(req: VercelRequest, res: VercelResponse): string {
  const veio = req.headers["x-request-id"];
  const candidato = (Array.isArray(veio) ? veio[0] : veio)?.trim();
  const id = candidato && ID_ACEITAVEL.test(candidato) ? candidato : randomUUID();
  res.setHeader("x-request-id", id);
  return id;
}

/**
 * Uma linha por falha, sempre com o id, e SÓ a linha. É o que sobra quando o
 * próprio banco está fora (o health), onde tentar gravar só somaria espera.
 * `erro` entra como mensagem, nunca como objeto inteiro: o erro do Drizzle
 * carrega o SQL e os parâmetros, e parâmetro é dado de cliente.
 */
export function registrarNoLog(onde: string, id: string, erro: unknown, extra?: Record<string, unknown>) {
  const motivo = erro instanceof Error ? erro.message : String(erro);
  const enfeites = extra
    ? " " + Object.entries(extra).map(([k, v]) => `${k}=${String(v)}`).join(" ")
    : "";
  console.error(`[${onde}] req=${id}${enfeites} erro=${motivo}`);
}

/**
 * A falha vai para o rastreador de erros (S-012): a linha de log de sempre,
 * mais o registro agrupado no banco e o aviso por e-mail aos operadores
 * quando o erro é novo. Nunca lança, e é aguardada antes da resposta — numa
 * função serverless, o que fica em voo depois de responder se perde.
 */
export async function registrarFalha(onde: string, id: string, erro: unknown, extra: { orgId?: string | null } = {}) {
  await registrarErro({ onde, erro, requestId: id, orgId: extra.orgId ?? null });
}
