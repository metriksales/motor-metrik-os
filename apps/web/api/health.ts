import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDatabaseUrl, sondarBanco } from "./_bundled/motor.mjs";
import { idDaRequisicao, registrarFalha } from "./_observabilidade.js";

/**
 * Saúde, e não apenas sinal de vida (S-012).
 *
 * ANTES, este endereço respondia `{ok:true}` sem tocar em nada. Isso é pior que
 * inútil: a função subir e o banco estar fora é EXATAMENTE o incidente que a
 * gente quer detectar, e o health respondia 200 alegremente durante ele.
 *
 * Agora ele faz uma pergunta de verdade ao banco. Se o banco não responde, o
 * status é 503 — um monitor precisa distinguir "de pé" de "de pé e inútil",
 * e essa distinção mora no código de status, não no corpo.
 *
 * O QUE NÃO SAI DAQUI. O papel com que a aplicação conectou é detalhe de
 * configuração e fica só no log; esta resposta é pública. Quem precisa dele
 * autenticado pede em `/api/control?action=saude`.
 *
 * CUSTO: uma consulta barata por chamada, que também acorda a compute do Neon.
 * Se um monitor externo bater aqui de minuto em minuto, ele sozinho mantém a
 * compute acordada — o que pode ser o que se quer, mas é bom saber que é uma
 * escolha, e não um efeito colateral invisível.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = idDaRequisicao(req, res);
  const base = { service: "motor-metrik-os", ts: new Date().toISOString() };

  if (!getDatabaseUrl()) {
    return res.status(503).json({ ok: false, ...base, banco: { ok: false, motivo: "não configurado" } });
  }

  const r = await sondarBanco();
  if (!r.ok) {
    registrarFalha("health", id, r.motivo, { ms: r.ms });
    return res.status(503).json({ ok: false, ...base, banco: { ok: false, ms: r.ms } });
  }

  return res.status(200).json({ ok: true, ...base, banco: { ok: true, ms: r.ms } });
}
