import assert from "node:assert/strict";
import test from "node:test";
import { destinoDe } from "../src/views/Estudio";

test("routes a follow-up request to the operational motor, not to conversation", () => {
  assert.equal(
    destinoDe("Quando o lead sumir, espera 1 dia e manda só 1 follow"),
    "motor",
  );
});

