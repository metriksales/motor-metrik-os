// @motor/runtime · pipeline — o coração do Data Plane.
// Recebe um RuntimeEvent, carrega o spec publicado, casa os motores pelo
// gatilho (registry.match) e roda cada um com os ports injetados, logando
// execução por execução. Fail-open: motor que estoura não derruba os outros.
import { resolveMotorConfig, type MotorResult, type RuntimeEvent } from "@motor/core";
import type { RuntimeDeps } from "./deps";

export async function runEvent(
  evt: RuntimeEvent,
  deps: RuntimeDeps,
): Promise<{ ran: string[]; results: MotorResult[] }> {
  const agora = () => new Date().toISOString();

  const spec = await deps.loadSpec(evt.orgId, evt.agentId);
  if (!spec) {
    deps.log({
      orgId: evt.orgId,
      agentId: evt.agentId,
      ok: false,
      resumo: "spec não encontrada",
      at: agora(),
      meta: { tipo: evt.tipo, canal: evt.canal, contactId: evt.contactId },
    });
    return { ran: [], results: [] };
  }

  // TODO: checar pausa do lead via ports.getState (tag atendimento-humano / TTL).
  //       Regra da casa: fail-open — se a checagem falha, o agente segue.
  //       (o silêncio real nunca vem daqui; vem do motor de handoff).

  const engines = deps.registry.match(evt, spec);
  const ports = await deps.portsFor(evt.orgId, evt.agentId);

  const ran: string[] = [];
  const results: MotorResult[] = [];

  for (const engine of engines) {
    let r: MotorResult;
    try {
      r = await engine.run(
        { orgId: evt.orgId, agentId: evt.agentId, spec, event: evt, config: resolveMotorConfig(spec, engine.id) },
        ports,
      );
      deps.log({
        orgId: evt.orgId,
        agentId: evt.agentId,
        motor: engine.id,
        ok: r.ok,
        resumo: r.did.join("; "),
        did: r.did,
        erro: r.error,
        at: agora(),
        meta: { tipo: evt.tipo, canal: evt.canal, contactId: evt.contactId },
      });
    } catch (e) {
      const erro = e instanceof Error ? e.message : String(e);
      r = { ok: false, did: [], error: erro };
      deps.log({
        orgId: evt.orgId,
        agentId: evt.agentId,
        motor: engine.id,
        ok: false,
        resumo: `motor estourou: ${erro}`,
        did: [],
        erro,
        at: agora(),
        meta: { tipo: evt.tipo, canal: evt.canal, contactId: evt.contactId },
      });
    }
    ran.push(engine.id);
    results.push(r);
  }

  return { ran, results };
}
