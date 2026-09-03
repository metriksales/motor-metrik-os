// Registro de motores — a "caixa de peças". A partir de um evento + o spec do
// agente, diz QUAIS motores devem rodar: o gatilho casa com o tipo do evento E
// o motor está declarado (e ligado) nos descritores do spec.

import type {
  MotorEngine,
  MotorRegistry,
  RuntimeEvent,
  AgentSpec,
} from "@motor/core";

import { followupMotor } from "./followup";
import { agendaMotor } from "./agenda";
import { atendimentoMotor } from "./atendimento";

export function createRegistry(engines: MotorEngine[]): MotorRegistry {
  const porId = new Map<string, MotorEngine>();
  for (const e of engines) porId.set(e.id, e);

  return {
    get(id: string): MotorEngine | undefined {
      return porId.get(id);
    },
    all(): MotorEngine[] {
      return [...porId.values()];
    },
    match(event: RuntimeEvent, spec: AgentSpec): MotorEngine[] {
      // Motores que o spec declara E que estão ligados (on !== false).
      const ligados = new Set(
        spec.motores.filter((m) => m.on !== false).map((m) => m.id),
      );
      return this.all().filter((engine) => {
        const gatilhoCasa = engine.trigger.some((t) => t.type === event.tipo);
        return gatilhoCasa && ligados.has(engine.id);
      });
    },
  };
}

// Registro padrão com a biblioteca inteira montada.
export const defaultRegistry: MotorRegistry = createRegistry([
  followupMotor,
  agendaMotor,
  atendimentoMotor,
]);
