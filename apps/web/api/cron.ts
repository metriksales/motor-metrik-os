import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDatabaseUrl } from "@motor/db";

// Cron de FOLLOW-UP: varre os leads em cadência com toque vencido e dispara
// schedule events (o motor followup decide se é a hora / dentro da janela).
// Fluxo alvo: para cada agente com o motor followup ligado, para cada lead em
// cadência → runEvent({tipo:"schedule", contactId}) via createProductionDeps.
// PENDENTE: a FONTE dos leads em cadência (enumeração) — precisa do registro de
// quem está em follow (tabela/índice por org). Enquanto não existe, responde 501
// honesto em vez de fingir que rodou.
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  if (!getDatabaseUrl()) {
    return res.status(503).json({ error: "banco não configurado — falta DATABASE_URL (Neon)" });
  }
  return res.status(501).json({
    ok: false,
    pendente: "enumeração de leads em follow-up — ligar após o registro de cadência (quem está em follow por org)",
  });
}
