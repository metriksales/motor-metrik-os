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
 * contou aparecem — no clique e no próximo carregamento. E os textos seguem a
 * skill `texto-de-tela`: os testes conferem a frase exata.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import type { ConexaoReal } from "../src/lib/conexoes";

const api = vi.hoisted(() => ({
  conexoes: vi.fn(),
  testarConexao: vi.fn(),
  cadastrarConexao: vi.fn(),
  enviarMensagemDeTeste: vi.fn(),
  conectarWhatsApp: vi.fn(),
  acompanharWhatsApp: vi.fn(),
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
  ultimoTesteDetalhe: "Instância desconectada. Leia o QR code no painel da uazapi.",
  ultimoTesteDados: { estado: "disconnected" },
  createdAt: agora,
  testavel: true,
  temSegredoDeEntrada: false,
};

const NO_AR: ConexaoReal = {
  ...FORA,
  status: "ok",
  ultimoTesteDetalhe: "Conectado como Luã (+5521981740018).",
  ultimoTesteDados: { estado: "connected", nome: "Luã", numero: "5521981740018", foto: "https://pps.whatsapp.net/foto.jpg" },
};

describe("Conexões — testar agora", () => {
  test("o cartão muda de 'Com problema' para 'No ar' sem recarregar a página", async () => {
    api.conexoes.mockResolvedValue([FORA]);
    api.testarConexao.mockResolvedValue(NO_AR);
    render(<Conexoes />);

    await screen.findByText("Com problema");
    expect(screen.getByText(FORA.ultimoTesteDetalhe!)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /testar agora/i }));

    await screen.findByText("No ar");
    expect(api.testarConexao).toHaveBeenCalledWith("c1", undefined);
    // quem respondeu, formatado, e a foto que o provedor mandou
    expect(screen.getByText("Luã · +55 21 98174-0018")).toBeTruthy();
    expect((screen.getByRole("img", { name: /Luã/ }) as HTMLImageElement).src).toBe("https://pps.whatsapp.net/foto.jpg");
    // a frase "Conectado como Luã" NÃO se repete embaixo de quem respondeu
    expect(screen.queryByText(NO_AR.ultimoTesteDetalhe!)).toBeNull();
    // a resposta se anuncia, como frase
    expect(screen.getByRole("status").textContent).toContain("Resposta recebida agora.");
    // e a lista NÃO foi buscada de novo: a resposta do clique bastou
    expect(api.conexoes).toHaveBeenCalledTimes(1);
  });

  test("resposta igual à anterior ainda se anuncia: 'Igual à anterior.'", async () => {
    api.conexoes.mockResolvedValue([FORA]);
    api.testarConexao.mockResolvedValue({ ...FORA, ultimoTesteEm: new Date().toISOString() });
    render(<Conexoes />);
    await screen.findByText("Com problema");

    fireEvent.click(screen.getByRole("button", { name: /testar agora/i }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Resposta recebida agora. Igual à anterior."));
    expect(screen.getByText("Com problema")).toBeTruthy();
  });

  test("falha da chamada aparece no cartão, e o status anterior fica", async () => {
    api.conexoes.mockResolvedValue([FORA]);
    api.testarConexao.mockRejectedValue(new Error("erro interno (ref abc12345)"));
    render(<Conexoes />);
    await screen.findByText("Com problema");

    fireEvent.click(screen.getByRole("button", { name: /testar agora/i }));

    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain("erro interno (ref abc12345)");
    expect(screen.getByText("Com problema")).toBeTruthy();
  });

  test("no próximo carregamento a foto e o número vêm do banco, não da resposta do clique", async () => {
    api.conexoes.mockResolvedValue([NO_AR]);
    render(<Conexoes />);
    await screen.findByText("No ar");
    expect(screen.getByText("Luã · +55 21 98174-0018")).toBeTruthy();
    expect((screen.getByRole("img", { name: /Luã/ }) as HTMLImageElement).src).toBe("https://pps.whatsapp.net/foto.jpg");
    expect(screen.getByText(/Testada agora/)).toBeTruthy();
  });

  test("tipo sem teste: botão desligado e a frase honesta", async () => {
    api.conexoes.mockResolvedValue([{ ...FORA, id: "c2", kind: "gcal", status: "nao_testada", ultimoTesteEm: null, ultimoTesteDetalhe: null, ultimoTesteDados: null, testavel: false }]);
    render(<Conexoes />);
    await screen.findByText("Nunca testada");
    expect((screen.getByRole("button", { name: /testar agora/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Sem teste para este tipo.")).toBeTruthy();
    expect(screen.getByText("Sem teste até agora.")).toBeTruthy();
  });

  test("sem conexão: estado vazio honesto, com o convite a cadastrar", async () => {
    api.conexoes.mockResolvedValue([]);
    render(<Conexoes />);
    await screen.findByText("Nenhuma conexão cadastrada nesta conta.");
    expect(screen.getByText("Cadastre a primeira abaixo. O token vai para o cofre e o teste roda na hora.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /guardar e testar/i })).toBeTruthy();
  });

  test("sem texto decorativo: nem faixa de apresentação, nem 'Onde mora o token'", async () => {
    api.conexoes.mockResolvedValue([NO_AR]);
    render(<Conexoes />);
    await screen.findByText("No ar");
    for (const t of [/Conexões da conta/, /O que cada ponta/, /Estado das pontas/, /O que o último teste disse/, /Onde mora o token/, /Pergunta à uazapi/]) {
      expect(screen.queryByText(t)).toBeNull();
    }
  });

  test("texto de tela: nenhuma frase visível começa em minúscula nem tem travessão", async () => {
    api.conexoes.mockResolvedValue([FORA, { ...NO_AR, id: "c3", vaultRef: "vendas" }]);
    const { container } = render(<Conexoes />);
    await screen.findByText("No ar");
    const textos = Array.from(container.querySelectorAll("p, strong, button, span.mono-label, em"))
      .map((el) => (el.textContent ?? "").trim())
      .filter((t) => t.length > 3 && /[A-Za-zÀ-ú]/.test(t.charAt(0)));
    for (const t of textos) {
      expect(t, t).not.toMatch(/[—;…!]/);
      expect(t, t).toMatch(/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9]/);
    }
  });
});

describe("Conexões — para onde vão as mensagens recebidas", () => {
  const com = (webhooks: unknown): ConexaoReal => ({
    ...NO_AR,
    ultimoTesteDados: { ...NO_AR.ultimoTesteDados, webhooks } as ConexaoReal["ultimoTesteDados"],
  });

  test("webhook para outro sistema aparece como alerta, com o host", async () => {
    api.conexoes.mockResolvedValue([com([{ host: "n8n.metrik.com", ativo: true, eventos: ["messages"] }])]);
    render(<Conexoes />);
    expect(await screen.findByText("Mensagens recebidas vão para n8n.metrik.com, não para este sistema.")).toBeTruthy();
  });

  test("webhook para o leitor de grupos deste sistema", async () => {
    api.conexoes.mockResolvedValue([com([{ host: "motor.test", ativo: true, destino: "grupos", eventos: [] }])]);
    render(<Conexoes />);
    expect(await screen.findByText("Mensagens recebidas chegam ao leitor de grupos.")).toBeTruthy();
  });

  test("nenhum webhook, e webhook desativado", async () => {
    api.conexoes.mockResolvedValue([com([]), { ...com([{ host: "a.com", ativo: false, eventos: [] }]), id: "c9" }]);
    render(<Conexoes />);
    expect(await screen.findByText("Nenhum webhook configurado. Mensagens recebidas não chegam a este sistema.")).toBeTruthy();
    expect(screen.getByText("Webhook desativado na instância. Mensagens recebidas não chegam a este sistema.")).toBeTruthy();
  });

  test("teste que não leu o webhook não diz nada sobre ele", async () => {
    api.conexoes.mockResolvedValue([NO_AR]);
    render(<Conexoes />);
    await screen.findByText("No ar");
    expect(screen.queryByText(/Mensagens recebidas/)).toBeNull();
  });
});

describe("Conexões — mensagem de teste", () => {
  test("abre o campo, envia para o número digitado e mostra a confirmação da uazapi", async () => {
    api.conexoes.mockResolvedValue([NO_AR]);
    api.enviarMensagemDeTeste.mockResolvedValue({ ok: true, detalhe: "Mensagem enviada. A uazapi confirmou o envio." });
    render(<Conexoes />);
    await screen.findByText("No ar");

    fireEvent.click(screen.getByRole("button", { name: /enviar mensagem de teste/i }));
    fireEvent.change(screen.getByPlaceholderText("5561991840065"), { target: { value: "5561991840065" } });
    fireEvent.click(screen.getByRole("button", { name: /^enviar$/i }));

    expect(await screen.findByText("Mensagem enviada. A uazapi confirmou o envio.")).toBeTruthy();
    expect(api.enviarMensagemDeTeste).toHaveBeenCalledWith("c1", "5561991840065", undefined);
  });

  test("a recusa da uazapi aparece como alerta", async () => {
    api.conexoes.mockResolvedValue([NO_AR]);
    api.enviarMensagemDeTeste.mockResolvedValue({ ok: false, detalhe: "A uazapi recusou o token da instância." });
    render(<Conexoes />);
    await screen.findByText("No ar");
    fireEvent.click(screen.getByRole("button", { name: /enviar mensagem de teste/i }));
    fireEvent.change(screen.getByPlaceholderText("5561991840065"), { target: { value: "5561991840065" } });
    fireEvent.click(screen.getByRole("button", { name: /^enviar$/i }));
    expect((await screen.findByRole("alert")).textContent).toContain("A uazapi recusou o token da instância.");
  });

  test("conexão que não é WhatsApp não oferece envio", async () => {
    api.conexoes.mockResolvedValue([{ ...NO_AR, kind: "kommo", ultimoTesteDados: { conta: "Norte" } }]);
    render(<Conexoes />);
    await screen.findByText("No ar");
    expect(screen.queryByRole("button", { name: /enviar mensagem de teste/i })).toBeNull();
  });
});

describe("Conexões — nome da instância e conectar pela plataforma", () => {
  const QR = `data:image/png;base64,${"Q".repeat(120)}`;
  const FORA_COM_NOME: ConexaoReal = { ...FORA, ultimoTesteDados: { estado: "disconnected", instancia: "metrik-01" } };

  afterEach(() => {
    vi.useRealTimers();
  });

  test("o nome da instância aparece fora do ar e no ar", async () => {
    api.conexoes.mockResolvedValue([
      FORA_COM_NOME,
      { ...NO_AR, id: "c2", ultimoTesteDados: { ...NO_AR.ultimoTesteDados, instancia: "metrik-02" } },
    ]);
    render(<Conexoes />);
    expect(await screen.findByText("Instância metrik-01")).toBeTruthy();
    expect(screen.getByText("Luã · +55 21 98174-0018 · Instância metrik-02")).toBeTruthy();
    // fora do ar, a frase do que houve continua embaixo
    expect(screen.getByText(FORA.ultimoTesteDetalhe!)).toBeTruthy();
  });

  test("fora do ar: o botão é conectar, não enviar mensagem", async () => {
    api.conexoes.mockResolvedValue([FORA_COM_NOME]);
    render(<Conexoes />);
    await screen.findByText("Com problema");
    expect(screen.getByRole("button", { name: /conectar whatsapp/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /enviar mensagem de teste/i })).toBeNull();
  });

  test("abre com o QR code, acompanha, e quando conecta o cartão vira 'No ar' sem recarregar", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.conexoes.mockResolvedValue([FORA_COM_NOME]);
    api.conectarWhatsApp.mockResolvedValue({ conectado: false, estado: "connecting", qrcode: QR, detalhe: "Aguardando a leitura no celular." });
    api.acompanharWhatsApp
      .mockResolvedValueOnce({ conectado: false, estado: "connecting", qrcode: QR, detalhe: "Aguardando a leitura no celular." })
      .mockResolvedValueOnce({ conectado: true, estado: "connected", detalhe: "WhatsApp conectado.", conexao: NO_AR });
    render(<Conexoes />);
    await screen.findByText("Com problema");

    fireEvent.click(screen.getByRole("button", { name: /conectar whatsapp/i }));
    const qr = (await screen.findByRole("img", { name: "QR code para conectar o WhatsApp" })) as HTMLImageElement;
    expect(qr.src).toBe(QR);
    expect(api.conectarWhatsApp).toHaveBeenCalledWith("c1", undefined, undefined);

    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(5000);
    await screen.findByText("No ar");
    expect(api.acompanharWhatsApp).toHaveBeenCalledTimes(2);
    expect(api.conexoes).toHaveBeenCalledTimes(1);
  });

  test("pelo número de telefone: mostra o código formatado como o WhatsApp mostra", async () => {
    api.conexoes.mockResolvedValue([FORA_COM_NOME]);
    api.conectarWhatsApp
      .mockResolvedValueOnce({ conectado: false, estado: "connecting", qrcode: QR, detalhe: "Aguardando a leitura no celular." })
      .mockResolvedValueOnce({ conectado: false, estado: "connecting", codigo: "ABCD1234", detalhe: "Aguardando a leitura no celular." });
    render(<Conexoes />);
    await screen.findByText("Com problema");
    fireEvent.click(screen.getByRole("button", { name: /conectar whatsapp/i }));
    await screen.findByRole("img", { name: "QR code para conectar o WhatsApp" });

    fireEvent.click(screen.getByRole("button", { name: /conectar com o número de telefone/i }));
    fireEvent.change(screen.getByPlaceholderText("5561991840065"), { target: { value: "5561991840065" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar código/i }));

    expect((await screen.findByLabelText("Código de pareamento")).textContent).toBe("ABCD-1234");
    expect(api.conectarWhatsApp).toHaveBeenLastCalledWith("c1", "5561991840065", undefined);
  });

  test("recusa da uazapi aparece como alerta", async () => {
    api.conexoes.mockResolvedValue([FORA_COM_NOME]);
    api.conectarWhatsApp.mockResolvedValue({ conectado: false, detalhe: "A uazapi recusou o token da instância." });
    render(<Conexoes />);
    await screen.findByText("Com problema");
    fireEvent.click(screen.getByRole("button", { name: /conectar whatsapp/i }));
    expect((await screen.findByRole("alert")).textContent).toContain("A uazapi recusou o token da instância.");
    expect(screen.getByRole("button", { name: /gerar novo qr code/i })).toBeTruthy();
  });
});
