import { describe, expect, test } from "vitest";
import { apenasNoDemo, estadoDoDado, legendaDoEstado, SEM_DADO } from "../src/lib/honestidade";

describe("maquete só na vitrine", () => {
  test("valor de demonstração não escapa para conta real", () => {
    const STATS_FALSOS = [{ label: "Atendimentos hoje", value: "212" }];
    expect(apenasNoDemo(true, STATS_FALSOS)).toBe(STATS_FALSOS);
    expect(apenasNoDemo(false, STATS_FALSOS)).toBeNull();
  });
});

describe("estado do dado", () => {
  test("demo é demo, mesmo carregando ou com erro", () => {
    expect(estadoDoDado({ demo: true, carregando: true, temDado: false })).toBe("demo");
  });

  test("erro não vira vazio — são coisas diferentes na tela", () => {
    expect(estadoDoDado({ demo: false, carregando: false, erro: new Error("x"), temDado: false })).toBe("erro");
    expect(estadoDoDado({ demo: false, carregando: false, temDado: false })).toBe("vazio");
  });

  test("carregando não mostra zero como se fosse resultado", () => {
    expect(estadoDoDado({ demo: false, carregando: true, temDado: false })).toBe("carregando");
  });

  test("com dado, é ok", () => {
    expect(estadoDoDado({ demo: false, carregando: false, temDado: true })).toBe("ok");
  });

  test("cada estado tem uma frase honesta, e nenhuma promete dado que não existe", () => {
    expect(legendaDoEstado("erro")).toContain("não consegui");
    expect(legendaDoEstado("vazio")).toContain("sem atividade");
    expect(legendaDoEstado("ok")).toContain("dados reais");
    expect(legendaDoEstado("demo")).toContain("demonstração");
    expect(SEM_DADO).toBe("—");
  });
});
