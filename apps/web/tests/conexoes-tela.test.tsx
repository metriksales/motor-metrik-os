// @vitest-environment jsdom
/**
 * A tela de Conexões (S-019), clicada de verdade — sem servidor, sem rede.
 *
 * O CASO QUE MOTIVOU ESTE ARQUIVO. Em 29/09 a instância de WhatsApp foi
 * conectada com a tela aberta; "Testar agora" gravou `ok` no banco (a
 * auditoria mostra) e a pessoa recarregou a página inteira para ver. Nenhum
 * teste da casa exercitava a tela: o pacote de controle tinha 10 testes de
 * banco e a tela tinha zero. Este é o primeiro teste de tela do projeto.
 *
 * O que se prova: o cartão muda SEM recarregar, a resposta se anuncia mesmo
 * quando é igual à anterior, o erro aparece, e a foto/número que o provedor
 * contou aparecem — no clique e no próximo carregamento.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import type { ConexaoReal } from "../src/lib/conexoes";

const api = vi.hoisted(() => ({
  conexoes: vi.fn(),
  testarConexao: vi.fn(),
  cadastrarConexao: vi.fn(),
}));

vi.mock("../src/lib/api", () => ({ api, control: vi.fn(), auth: {}, lerCookie: () => "", cabecalhosDeEscrita: () => ({}) }));
vi.mock("../src/lib/auth", () => ({
  useMotorAuth: () => ({
    demo: false,
    carregando: false,
    role: "owner",
    orgId: "org-1",
    orgName: "Metrik",
    orgDesc: "",
    orgInitial: "M",
    contas: [],
    trocarConta: async () => {},
    sair: async () => {},
    recarregar: async () => {},
  }),
  MotorAuthProvider: ({ children }: { children: unknown }) => children,
}));

import Conexoes from "../src/views/Conexoes";

beforeAll(() => {
  // o framer-motion consulta preferências de movimento; o jsdom não tem isto
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

const FORA: ConexaoReal = {
  id: "c1",
  kind: "whatsapp",
  status: "falha",
  vaultRef: "padrao",
  meta: null,
  agentId: null,
  ultimoTesteEm: agora,
  ultimoTesteDetalhe: "a instância está desconectada do WhatsApp — reconecte pelo QR code no painel da uazapi",
  ultimoTesteDados: { estado: "disconnected" },
  createdAt: agora,
  testavel: true,
  temSegredoDeEntrada: false,
};

const NO_AR: ConexaoReal = {
  ...FORA,
  status: "ok",
  ultimoTesteDetalhe: "WhatsApp conectado como Luã · +5521981740018",
  ultimoTesteDados: { estado: "connected", nome: "Luã", numero: "5521981740018", foto: "https://pps.whatsapp.net/foto.jpg" },
};

describe("Conexões — testar agora", () => {
  test("o cartão muda de 'com problema' para 'no ar' sem recarregar a página", async () => {
    api.conexoes.mockResolvedValue([FORA]);
    api.testarConexao.mockResolvedValue(NO_AR);
    render(<Conexoes />);

    await screen.findByText("com problema");
    expect(screen.getByText(FORA.ultimoTesteDetalhe!)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /testar agora/i }));

    await screen.findByText("no ar");
    expect(api.testarConexao).toHaveBeenCalledWith("c1", undefined);
    expect(screen.getByText("WhatsApp conectado como Luã · +5521981740018")).toBeTruthy();
    // quem respondeu, formatado, e a foto que o provedor mandou
    expect(screen.getByText("Luã · +55 21 98174-0018")).toBeTruthy();
    expect((screen.getByRole("img", { name: /Luã/ }) as HTMLImageElement).src).toBe("https://pps.whatsapp.net/foto.jpg");
    // a resposta se anuncia
    expect(screen.getByRole("status").textContent).toMatch(/uazapi respondeu agora/);
    // e a lista NÃO foi buscada de novo: a resposta do clique bastou
    expect(api.conexoes).toHaveBeenCalledTimes(1);
  });

  test("resposta igual à anterior ainda se anuncia — 'a mesma resposta de antes'", async () => {
    api.conexoes.mockResolvedValue([FORA]);
    api.testarConexao.mockResolvedValue({ ...FORA, ultimoTesteEm: new Date().toISOString() });
    render(<Conexoes />);
    await screen.findByText("com problema");

    fireEvent.click(screen.getByRole("button", { name: /testar agora/i }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/a mesma resposta de antes/));
    expect(screen.getByText("com problema")).toBeTruthy();
  });

  test("falha da chamada aparece no cartão, e o status anterior fica", async () => {
    api.conexoes.mockResolvedValue([FORA]);
    api.testarConexao.mockRejectedValue(new Error("erro interno (ref abc12345)"));
    render(<Conexoes />);
    await screen.findByText("com problema");

    fireEvent.click(screen.getByRole("button", { name: /testar agora/i }));

    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain("erro interno (ref abc12345)");
    expect(screen.getByText("com problema")).toBeTruthy();
  });

  test("no próximo carregamento a foto e o número vêm do banco, não da resposta do clique", async () => {
    api.conexoes.mockResolvedValue([NO_AR]);
    render(<Conexoes />);
    await screen.findByText("no ar");
    expect(screen.getByText("Luã · +55 21 98174-0018")).toBeTruthy();
    expect((screen.getByRole("img", { name: /Luã/ }) as HTMLImageElement).src).toBe("https://pps.whatsapp.net/foto.jpg");
    expect(screen.getByText(/testada agora/)).toBeTruthy();
  });

  test("tipo sem teste: botão desligado e a frase honesta", async () => {
    api.conexoes.mockResolvedValue([{ ...FORA, id: "c2", kind: "gcal", status: "nao_testada", ultimoTesteEm: null, ultimoTesteDetalhe: null, ultimoTesteDados: null, testavel: false }]);
    render(<Conexoes />);
    await screen.findByText("nunca testada");
    expect((screen.getByRole("button", { name: /testar agora/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(/ainda não existe teste para este tipo/).length).toBeGreaterThan(0);
  });

  test("sem conexão: estado vazio honesto, com o convite a cadastrar", async () => {
    api.conexoes.mockResolvedValue([]);
    render(<Conexoes />);
    await screen.findByText("Nenhuma conexão cadastrada nesta conta.");
    expect(screen.getByText(/Cadastre a primeira/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /guardar e testar/i })).toBeTruthy();
  });
});
