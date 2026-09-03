// @motor/evals — o PORTEIRO dos evals.
// Custom só promove pra produção se a taxa de acerto ≥ limiar.
// Peças: asserções puras (checkAssertion) + runner (runEvals) + gate.
export { checkAssertion } from "./assertions";
export { runEvals, gate } from "./runner";
