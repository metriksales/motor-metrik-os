// @motor/motors — biblioteca de motores reutilizáveis do Motor Metrik OS.
// Peças plugáveis (só dependem de @motor/core; infra entra por ports).
// A estrela é o follow-up; o registro monta a caixa de peças pro runtime.

export { followupMotor } from "./followup";
export { agendaMotor } from "./agenda";
export { atendimentoMotor } from "./atendimento";
export { createRegistry, defaultRegistry } from "./registry";
