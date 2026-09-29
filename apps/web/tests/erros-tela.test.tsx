// @vitest-environment jsdom
/**
 * Erros do sistema no Admin (S-012), clicada sem servidor.
 *
 * Três promessas da tela: para quem não opera a plataforma (403) a seção não
 * existe; qualquer outra falha APARECE; e o resultado do erro de teste nunca
 * diz "enviado" para um e-mail que não saiu.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

const api = vi.hoisted(() => ({ erros: vi.fn(), registrarErroDeTeste: vi.fn() }));

vi.mock("../src/lib/api", () => ({ api, control: vi.fn(), auth: {}, lerCookie: () => "", cabecalhosDeEscrita: () => ({}) }));
vi.mock("../src/lib/auth", () => ({
  useMotorAuth: () => ({ demo: false, carregando: false, role: "owner", orgId: "org-1", orgName: "Metrik", contas: [] }),
}));

import ErrosDoSistema, { fraseDoTeste } from "../src/views/ErrosDoSistema";

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () =>
      ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) as unknown as MediaQueryList;
  }
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const agora = new Date().toISOString();
const ERRO = {
  id: "e1",
  onde: "control:testarConexao",
  mensagem: "Tempo esgotado ao falar com o banco.",
  pilha: "at testarConexao (packages/control/src/index.ts:640:11)",
  conta: "org-1",
  ultimoRequestId: "3f9a2b1c-aaaa",
  ocorrencias: 3,
  primeiraEm: agora,
  ultimaEm: agora,
  avisadoEm: agora,
};

describe("Erros do sistema", () => {
  test("para quem não opera a plataforma (403), a seção não existe", async () => {
    api.erros.mockRejectedValue(Object.assign(new Error("Esta lista é só para quem opera a plataforma."), { status: 403 }));
    const { container } = render(<ErrosDoSistema />);
    await vi.waitFor(() => expect(api.erros).toHaveBeenCalled());
    await vi.waitFor(() => expect(container.textContent).toBe(""));
  });

  test("falha que não é 403 aparece, nunca some", async () => {
    api.erros.mockRejectedValue(Object.assign(new Error("Erro interno."), { status: 500 }));
    render(<ErrosDoSistema />);
    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível ler os erros. Erro interno.");
  });

  test("lista agrupada: onde, mensagem, ocorrências e a pilha ao abrir", async () => {
    api.erros.mockResolvedValue([ERRO]);
    render(<ErrosDoSistema />);
    expect(await screen.findByText("Tempo esgotado ao falar com o banco.")).toBeTruthy();
    expect(screen.getByText("3 ocorrências")).toBeTruthy();
    expect(screen.getByText(/Req 3f9a2b1c/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Tempo esgotado/ }));
    expect(screen.getByText(/packages\/control\/src\/index.ts:640:11/)).toBeTruthy();
  });

  test("sem erros: a frase honesta", async () => {
    api.erros.mockResolvedValue([]);
    render(<ErrosDoSistema />);
    expect(await screen.findByText("Nenhum erro registrado.")).toBeTruthy();
  });

  test("o erro de teste registra, recarrega a lista e diz o que aconteceu com o aviso", async () => {
    api.erros.mockResolvedValueOnce([]).mockResolvedValueOnce([{ ...ERRO, onde: "teste", mensagem: "Erro de teste registrado pela tela de Admin." }]);
    api.registrarErroDeTeste.mockResolvedValue({ registrado: true, avisado: true, destinatarios: 1, email: "resend" });
    render(<ErrosDoSistema />);
    await screen.findByText("Nenhum erro registrado.");
    fireEvent.click(screen.getByRole("button", { name: /registrar erro de teste/i }));
    expect(await screen.findByText(/Aviso enviado por e-mail\./)).toBeTruthy();
    expect(await screen.findByText("Erro de teste registrado pela tela de Admin.")).toBeTruthy();
  });
});

describe("frase do erro de teste", () => {
  test("nunca diz enviado quando o e-mail não saiu", () => {
    expect(fraseDoTeste({ registrado: true, avisado: true, destinatarios: 1, email: "resend" })).toEqual({
      texto: "Erro de teste registrado. Aviso enviado por e-mail.",
      ok: true,
    });
    expect(fraseDoTeste({ registrado: true, avisado: true, destinatarios: 1, email: "seco" }).texto).toBe(
      "Erro de teste registrado. O e-mail está em modo seco e foi só para o log do servidor.",
    );
    expect(fraseDoTeste({ registrado: true, avisado: false, destinatarios: 0, email: "resend" }).texto).toBe(
      "Erro de teste registrado. Nenhum destinatário de aviso configurado.",
    );
    expect(fraseDoTeste({ registrado: true, avisado: false, destinatarios: 1, email: "resend" }).texto).toBe(
      "Erro de teste registrado. O e-mail de aviso não saiu.",
    );
    expect(fraseDoTeste({ registrado: false, avisado: false, destinatarios: 1, email: "resend" }).ok).toBe(false);
  });
});
