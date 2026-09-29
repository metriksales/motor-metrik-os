// CONEXÕES — o que o PROVEDOR disse no último teste, com data (S-019).
//
// Logado, esta tela não afirma nada por conta própria: cada cartão mostra o
// resultado do último "Testar agora" contra a uazapi/GHL/Kommo, e quando
// ninguém perguntou ainda, diz "Nunca testada". A maquete com tudo "ligado"
// continua existindo — só na vitrine (modo demo), onde é o que ela diz ser.
//
// Todo texto que a pessoa lê aqui segue a skill `texto-de-tela`.
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CircuitBoard,
  ContactRound,
  Database,
  KeyRound,
  Loader2,
  MessageCircle,
  Plug,
  QrCode,
  RefreshCw,
  Send,
  Wrench,
} from "lucide-react";
import { AnimatedBeam } from "../components/ui/AnimatedBeam";
import { CONEXOES_CANAIS } from "../data";
import { api } from "../lib/api";
import { useMotorAuth } from "../lib/auth";
import {
  CAMPOS_POR_TIPO,
  STATUS_DA_CONEXAO,
  TIPO_DE_CONEXAO,
  TIPOS_CADASTRAVEIS,
  nomeDaConexao,
  ondeChegamOsEventos,
  quemRespondeu,
  type ConexaoReal,
  type EstadoDaConexao,
  type TipoCadastravel,
} from "../lib/conexoes";
import { tempoRelativo, useConexoes } from "../lib/live";
import { Pill, Reveal, SectionHeader, SkeletonCard, cx } from "../ui";

export default function Conexoes() {
  const auth = useMotorAuth();
  return auth.demo ? <Vitrine /> : <ConexoesDaConta />;
}

/** Por quanto tempo o cartão anuncia que a resposta chegou. */
const AVISO_MS = 6000;

// ── a conta de verdade ─────────────────────────────────────────────────────

function ConexoesDaConta() {
  const auth = useMotorAuth();
  const { conexoes, carregando, erro, substituir } = useConexoes();
  const podeGerenciar = auth.role === "owner" || auth.role === "admin";
  const [testando, setTestando] = useState<string | null>(null);
  const [erroDoTeste, setErroDoTeste] = useState<Record<string, string | undefined>>({});
  // O cartão precisa DIZER que a resposta chegou — mesmo quando ela é igual à
  // anterior. Sem isso, "Testar agora" numa conexão que já estava fora parecia
  // não fazer nada, e a pessoa recarregava a página para conferir.
  const [aviso, setAviso] = useState<{ id: string; mesma: boolean } | null>(null);
  const avisoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (avisoTimer.current) clearTimeout(avisoTimer.current); }, []);

  const testar = async (c: ConexaoReal) => {
    setTestando(c.id);
    setErroDoTeste((e) => ({ ...e, [c.id]: undefined }));
    try {
      const r = (await api.testarConexao(c.id, auth.getToken)) as ConexaoReal;
      substituir(r);
      const mesma = r.status === c.status && r.ultimoTesteDetalhe === c.ultimoTesteDetalhe;
      setAviso({ id: c.id, mesma });
      if (avisoTimer.current) clearTimeout(avisoTimer.current);
      avisoTimer.current = setTimeout(() => setAviso((a) => (a?.id === c.id ? null : a)), AVISO_MS);
    } catch (e) {
      setErroDoTeste((x) => ({ ...x, [c.id]: e instanceof Error ? e.message : "Falha ao testar." }));
    } finally {
      setTestando(null);
    }
  };

  // Sem cabeçalho nem texto de apresentação: o título da página já está na
  // barra de cima, e os cartões dizem o resto (texto-de-tela, regra 14).
  return (
    <div className="space-y-6">
      <div>
        {erro && (
          <div className="card p-4 mb-3 text-[13px] flex items-center gap-2" style={{ color: "var(--rose)" }} role="alert">
            <AlertTriangle size={14} /> Não foi possível ler as conexões. {erro}
          </div>
        )}
        {carregando && !conexoes ? (
          <div className="grid sm:grid-cols-2 gap-3">
            <SkeletonCard lines={3} h={150} />
            <SkeletonCard lines={3} h={150} />
          </div>
        ) : conexoes && conexoes.length === 0 ? (
          <EstadoVazio podeGerenciar={podeGerenciar} />
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {(conexoes ?? []).map((c, i) => (
              <Reveal key={c.id} delay={0.03 * i}>
                <CartaoDeConexao
                  c={c}
                  testando={testando === c.id}
                  erro={erroDoTeste[c.id]}
                  aviso={aviso?.id === c.id ? aviso : null}
                  podeGerenciar={podeGerenciar}
                  onTestar={() => testar(c)}
                  onConectada={substituir}
                />
              </Reveal>
            ))}
          </div>
        )}
      </div>

      {podeGerenciar && <Cadastro onCadastrada={substituir} />}
    </div>
  );
}

function EstadoVazio({ podeGerenciar }: { podeGerenciar: boolean }) {
  return (
    <div className="card p-6 text-center">
      <div className="mx-auto grid place-items-center rounded-full mb-3" style={{ width: 40, height: 40, background: "rgba(59,130,246,.08)", color: "var(--violet)" }}>
        <Plug size={18} />
      </div>
      <strong className="text-[14px]">Nenhuma conexão cadastrada nesta conta.</strong>
      <p className="text-[13px] text-[var(--txt-3)] mt-1.5 leading-relaxed">
        {podeGerenciar
          ? "Cadastre a primeira abaixo. O token vai para o cofre e o teste roda na hora."
          : "Quem administra a conta pode cadastrar a primeira."}
      </p>
    </div>
  );
}

/** "Testada agora" / "Testada há 5 min" / "Nunca testada" */
function quandoTestou(iso: string | null): string {
  if (!iso) return "Nunca testada";
  const t = tempoRelativo(iso);
  return t === "agora" ? "Testada agora" : `Testada há ${t}`;
}

/** A foto de perfil que o provedor mandou; se a URL venceu, volta ao ícone. */
function Avatar({ foto, Icon, alt }: { foto?: string; Icon: typeof Plug; alt: string }) {
  const [quebrada, setQuebrada] = useState(false);
  useEffect(() => setQuebrada(false), [foto]);
  if (foto && !quebrada) {
    return (
      <img
        className="connection-avatar flex-none"
        src={foto}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setQuebrada(true)}
      />
    );
  }
  return <span className="connection-status-icon flex-none"><Icon size={16} /></span>;
}

function CartaoDeConexao({
  c,
  testando,
  erro,
  aviso,
  podeGerenciar,
  onTestar,
  onConectada,
}: {
  c: ConexaoReal;
  testando: boolean;
  erro?: string;
  aviso: { mesma: boolean } | null;
  podeGerenciar: boolean;
  onTestar: () => void;
  onConectada: (c: ConexaoReal) => void;
}) {
  const [painel, setPainel] = useState<"envio" | "conectar" | null>(null);
  const whatsapp = c.kind === "whatsapp";
  // no ar: dá para mandar uma mensagem de teste; fora: dá para conectar por aqui
  const podeEnviar = podeGerenciar && whatsapp && c.status === "ok";
  const podeConectar = podeGerenciar && whatsapp && (c.status === "falha" || c.status === "nao_testada");
  const alternar = (p: "envio" | "conectar") => setPainel((atual) => (atual === p ? null : p));
  const eventos = ondeChegamOsEventos(c);
  const tipo = TIPO_DE_CONEXAO[c.kind];
  const Icon = tipo?.icon ?? Plug;
  const provedor = tipo?.provedor ?? "provedor";
  const st = STATUS_DA_CONEXAO[c.status] ?? { label: c.status, cor: "var(--txt-4)" };
  const quem = quemRespondeu(c);
  const foto = c.status === "ok" ? c.ultimoTesteDados?.foto : undefined;
  // No ar, quem respondeu já está na linha de cima; a frase "Conectado como
  // Luã" não se repete embaixo dela (texto-de-tela, regra 13). Fora do ar, a
  // linha de cima só diz qual instância, e a frase diz o que houve.
  const frase = c.status === "ok" && quem ? null : c.ultimoTesteDetalhe ?? "Sem teste até agora.";
  return (
    <div className={cx("card p-4 h-full flex flex-col", aviso ? "connection-respondeu" : undefined)} data-status={c.status}>
      <div className="flex items-start gap-3">
        <Avatar foto={foto} Icon={Icon} alt={quem || nomeDaConexao(c)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <strong className="text-[13.5px] text-[var(--txt)]">{nomeDaConexao(c)}</strong>
            <Pill color={st.cor}>{st.label}</Pill>
          </div>
          {quem && <div className="text-[12.5px] text-[var(--txt-2)] mt-0.5 truncate">{quem}</div>}
          <div className="mono-label mt-1">{tipo?.tipo ?? c.kind} · {quandoTestou(c.ultimoTesteEm)}</div>
          {frase && <p className="text-[13px] text-[var(--txt-2)] mt-2 leading-relaxed">{frase}</p>}
          {eventos && (
            <p
              className="text-[12.5px] mt-1.5 leading-relaxed"
              style={{ color: eventos.alerta ? "var(--amber)" : "var(--txt-3)" }}
            >
              {eventos.frase}
            </p>
          )}
          {aviso && (
            <p className="text-[12px] mt-1.5 flex items-center gap-1.5" style={{ color: "var(--emerald)" }} role="status">
              <Check size={12} /> {aviso.mesma ? "Resposta recebida agora. Igual à anterior." : "Resposta recebida agora."}
            </p>
          )}
          {erro && (
            <p className="text-[12.5px] mt-1.5" style={{ color: "var(--rose)" }} role="alert">{erro}</p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-[var(--line)]">
        {podeConectar ? (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            aria-expanded={painel === "conectar"}
            onClick={() => alternar("conectar")}
          >
            <QrCode size={13} /> Conectar WhatsApp
          </button>
        ) : podeEnviar ? (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            aria-expanded={painel === "envio"}
            onClick={() => alternar("envio")}
          >
            <Send size={13} /> Enviar mensagem de teste
          </button>
        ) : (
          <span className="text-[11.5px] text-[var(--txt-4)]">{c.testavel ? "" : "Sem teste para este tipo."}</span>
        )}
        <button
          type="button"
          className="btn btn-sm"
          disabled={!c.testavel || testando}
          onClick={onTestar}
          title={c.testavel ? `Pergunta à ${provedor} e grava a resposta.` : "Sem teste para este tipo."}
        >
          {testando ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {testando ? "Testando" : "Testar agora"}
        </button>
      </div>
      {podeEnviar && painel === "envio" && <EnvioDeTeste id={c.id} />}
      {podeConectar && painel === "conectar" && (
        <ConectarWhatsApp
          id={c.id}
          onConectada={(nova) => {
            onConectada(nova);
            setPainel(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Uma mensagem real pela instância (S-026): a prova de que o envio funciona.
 * O número fica só neste campo; a auditoria guarda os quatro últimos dígitos.
 */
function EnvioDeTeste({ id }: { id: string }) {
  const auth = useMotorAuth();
  const [numero, setNumero] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; detalhe: string } | null>(null);

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    setOcupado(true);
    setResultado(null);
    try {
      const r = (await api.enviarMensagemDeTeste(id, numero, auth.getToken)) as { ok: boolean; detalhe: string };
      setResultado(r);
    } catch (e) {
      setResultado({ ok: false, detalhe: e instanceof Error ? e.message : "Falha ao enviar." });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <form className="conexao-cadastro mt-3" onSubmit={enviar} autoComplete="off">
      <label className="auth-campo">
        <span className="mono-label">Número com DDI e DDD</span>
        <div className="flex gap-2">
          <input
            type="tel"
            inputMode="numeric"
            required
            disabled={ocupado}
            placeholder="5561991840065"
            value={numero}
            onChange={(ev) => setNumero(ev.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm flex-none" disabled={ocupado || !numero.trim()}>
            {ocupado ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {ocupado ? "Enviando" : "Enviar"}
          </button>
        </div>
      </label>
      {resultado && (
        <p
          className="text-[12.5px] flex items-center gap-1.5"
          style={{ color: resultado.ok ? "var(--emerald)" : "var(--rose)" }}
          role={resultado.ok ? "status" : "alert"}
        >
          {resultado.ok ? <Check size={12} /> : <AlertTriangle size={12} />} {resultado.detalhe}
        </p>
      )}
    </form>
  );
}

/** A cada quanto a tela pergunta se a instância já conectou. */
const INTERVALO_CONEXAO_MS = 5000;
/** A uazapi mantém o QR por 2 minutos e o código de pareamento por 5. */
const VALIDADE_MS = { qrcode: 2 * 60_000, codigo: 5 * 60_000 } as const;

/** "ABCD1234" → "ABCD-1234", como o WhatsApp mostra. */
function formatarCodigo(codigo: string): string {
  const c = codigo.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : codigo;
}

/**
 * Conectar o WhatsApp sem sair da plataforma (S-019). Abre pedindo o QR code
 * à uazapi; quem está no próprio celular troca para o código de pareamento. A
 * tela pergunta a cada poucos segundos se já conectou e, quando conecta, troca
 * o cartão pela conexão já testada. O QR e o código não são guardados.
 */
function ConectarWhatsApp({ id, onConectada }: { id: string; onConectada: (c: ConexaoReal) => void }) {
  const auth = useMotorAuth();
  const [modo, setModo] = useState<"qrcode" | "codigo">("qrcode");
  const [telefone, setTelefone] = useState("");
  const [estado, setEstado] = useState<EstadoDaConexao | null>(null);
  const [pedindo, setPedindo] = useState(false);
  const [erro, setErro] = useState<string | undefined>(undefined);
  const [expiraEm, setExpiraEm] = useState<number | null>(null);
  const [expirou, setExpirou] = useState(false);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const pedir = async (m: "qrcode" | "codigo", fone?: string) => {
    setPedindo(true);
    setErro(undefined);
    setExpirou(false);
    setEstado(null);
    try {
      const r = (await api.conectarWhatsApp(id, m === "codigo" ? fone : undefined, auth.getToken)) as EstadoDaConexao;
      if (!vivo.current) return;
      setEstado(r);
      setExpiraEm(r.qrcode || r.codigo ? Date.now() + VALIDADE_MS[m] : null);
    } catch (e) {
      if (vivo.current) setErro(e instanceof Error ? e.message : "Falha ao pedir a conexão.");
    } finally {
      if (vivo.current) setPedindo(false);
    }
  };

  // ao abrir, já pede o QR code
  useEffect(() => {
    void pedir("qrcode");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // enquanto há QR ou código na tela, pergunta se já conectou
  const aguardando = !!estado && !estado.conectado && !!(estado.qrcode || estado.codigo) && !expirou;
  useEffect(() => {
    if (!aguardando) return;
    const t = setTimeout(async () => {
      if (expiraEm && Date.now() >= expiraEm) {
        setExpirou(true);
        return;
      }
      try {
        const r = (await api.acompanharWhatsApp(id, auth.getToken)) as EstadoDaConexao;
        if (!vivo.current) return;
        if (r.conexao) {
          setEstado(r);
          onConectada(r.conexao);
          return;
        }
        // o status devolve o QR renovado, mas não repete o código de pareamento
        setEstado((antes) => ({
          ...r,
          codigo: r.codigo ?? antes?.codigo,
          qrcode: antes?.codigo ? undefined : (r.qrcode ?? antes?.qrcode),
        }));
      } catch (e) {
        if (vivo.current) setErro(e instanceof Error ? e.message : "Falha ao acompanhar a conexão.");
      }
    }, INTERVALO_CONEXAO_MS);
    return () => clearTimeout(t);
  }, [aguardando, estado, expiraEm, id, auth.getToken, onConectada]);

  const trocarModo = (m: "qrcode" | "codigo") => {
    setModo(m);
    setEstado(null);
    setErro(undefined);
    setExpirou(false);
    if (m === "qrcode") void pedir("qrcode");
  };

  const semResultado = !!estado && !estado.conectado && !estado.qrcode && !estado.codigo && !pedindo;

  return (
    <div className="conexao-cadastro mt-3 pt-3 border-t border-[var(--line)]">
      {estado?.conectado ? (
        <p className="text-[12.5px] flex items-center gap-1.5" style={{ color: "var(--emerald)" }} role="status">
          <Check size={12} /> WhatsApp conectado.
        </p>
      ) : modo === "qrcode" ? (
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="connection-qr flex-none grid place-items-center" aria-busy={pedindo}>
            {estado?.qrcode && !expirou ? (
              <img src={estado.qrcode} alt="QR code para conectar o WhatsApp" width={200} height={200} />
            ) : pedindo ? (
              <Loader2 size={20} className="animate-spin text-[var(--txt-4)]" />
            ) : (
              <QrCode size={28} className="text-[var(--txt-4)]" />
            )}
          </div>
          <div className="min-w-0 space-y-2">
            <p className="text-[13px] text-[var(--txt-2)] leading-relaxed">
              No celular, abra o WhatsApp, toque em Aparelhos conectados e leia o QR code.
            </p>
            {aguardando && (
              <p className="text-[12px] text-[var(--txt-3)] flex items-center gap-1.5" role="status">
                <Loader2 size={12} className="animate-spin" /> Aguardando a leitura no celular
              </p>
            )}
            {expirou && (
              <p className="text-[12.5px]" style={{ color: "var(--amber)" }} role="status">
                O QR code expirou.
              </p>
            )}
            {(expirou || semResultado) && (
              <button type="button" className="btn btn-sm" onClick={() => void pedir("qrcode")}>
                <RefreshCw size={13} /> Gerar novo QR code
              </button>
            )}
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => trocarModo("codigo")}>
              Conectar com o número de telefone
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {estado?.codigo && !expirou ? (
            <>
              <div className="connection-codigo" aria-label="Código de pareamento">
                {formatarCodigo(estado.codigo)}
              </div>
              <p className="text-[13px] text-[var(--txt-2)] leading-relaxed">
                No WhatsApp, toque em Aparelhos conectados, depois em Conectar com número de telefone, e digite o código.
              </p>
              {aguardando && (
                <p className="text-[12px] text-[var(--txt-3)] flex items-center gap-1.5" role="status">
                  <Loader2 size={12} className="animate-spin" /> Aguardando a confirmação no celular
                </p>
              )}
            </>
          ) : (
            <form
              onSubmit={(ev: FormEvent) => {
                ev.preventDefault();
                void pedir("codigo", telefone);
              }}
            >
              <label className="auth-campo">
                <span className="mono-label">Número do WhatsApp com DDI e DDD</span>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    inputMode="numeric"
                    required
                    disabled={pedindo}
                    placeholder="5561991840065"
                    value={telefone}
                    onChange={(ev) => setTelefone(ev.target.value)}
                  />
                  <button type="submit" className="btn btn-primary btn-sm flex-none" disabled={pedindo || !telefone.trim()}>
                    {pedindo ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    {pedindo ? "Gerando" : "Gerar código"}
                  </button>
                </div>
              </label>
              {expirou && (
                <p className="text-[12.5px]" style={{ color: "var(--amber)" }} role="status">
                  O código expirou. Gere um novo.
                </p>
              )}
            </form>
          )}
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => trocarModo("qrcode")}>
            Usar QR code
          </button>
        </div>
      )}
      {(erro || semResultado) && (
        <p className="text-[12.5px] mt-2 flex items-center gap-1.5" style={{ color: "var(--rose)" }} role="alert">
          <AlertTriangle size={12} /> {erro ?? estado?.detalhe}
        </p>
      )}
    </div>
  );
}

/**
 * Cadastro (primeiro item da S-044, adiantado): guarda no cofre, aponta a
 * conexão e testa — uma chamada só. O segredo sai do campo assim que a
 * resposta chega; ele não fica na tela nem volta dela.
 */
function Cadastro({ onCadastrada }: { onCadastrada: (c: ConexaoReal) => void }) {
  const auth = useMotorAuth();
  const [kind, setKind] = useState<TipoCadastravel>("whatsapp");
  const [rotulo, setRotulo] = useState("padrao");
  const [segredo, setSegredo] = useState("");
  const [meta, setMeta] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | undefined>(undefined);
  const [resultado, setResultado] = useState<ConexaoReal | null>(null);
  const def = CAMPOS_POR_TIPO[kind];

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    setOcupado(true);
    setErro(undefined);
    setResultado(null);
    try {
      const limpo: Record<string, string> = {};
      for (const campo of def.campos) {
        const v = (meta[campo.key] ?? "").trim();
        if (v) limpo[campo.key] = v;
      }
      const r = (await api.cadastrarConexao(
        { kind, segredo, rotulo: rotulo.trim() || "padrao", meta: limpo },
        auth.getToken,
      )) as ConexaoReal;
      onCadastrada(r);
      setResultado(r);
      setSegredo("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao cadastrar.");
    } finally {
      setOcupado(false);
    }
  };

  const st = resultado ? STATUS_DA_CONEXAO[resultado.status] ?? { label: resultado.status, cor: "var(--txt-4)" } : null;

  return (
    <Reveal delay={0.06}>
      <form className="card p-5 conexao-cadastro" onSubmit={enviar} autoComplete="off">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound size={15} style={{ color: "var(--violet)" }} />
          <span className="font-display font-semibold text-[14px]">Cadastrar conexão</span>
        </div>
        <p className="text-[12.5px] text-[var(--txt-3)] mb-4 leading-relaxed">
          O token vai para o cofre e o teste roda na hora. Cadastrar de novo com o mesmo rótulo substitui o anterior.
        </p>

        <div className="grid sm:grid-cols-2 gap-x-4">
          <label className="auth-campo">
            <span className="mono-label">Tipo</span>
            <select
              value={kind}
              disabled={ocupado}
              onChange={(ev) => {
                setKind(ev.target.value as TipoCadastravel);
                setMeta({});
                setResultado(null);
              }}
            >
              {TIPOS_CADASTRAVEIS.map((k) => (
                <option key={k} value={k}>{TIPO_DE_CONEXAO[k].nome}</option>
              ))}
            </select>
          </label>
          <label className="auth-campo">
            <span className="mono-label">Rótulo</span>
            <input
              type="text"
              value={rotulo}
              disabled={ocupado}
              placeholder="padrao"
              onChange={(ev) => setRotulo(ev.target.value)}
            />
          </label>
          {def.campos.map((campo) => (
            <label className="auth-campo" key={campo.key}>
              <span className="mono-label">
                {campo.label}
                {campo.ajuda ? <em className="not-italic normal-case text-[var(--txt-4)] ml-2">{campo.ajuda}</em> : null}
              </span>
              <input
                type="text"
                required={campo.obrigatorio}
                disabled={ocupado}
                placeholder={campo.placeholder}
                value={meta[campo.key] ?? ""}
                onChange={(ev) => setMeta((m) => ({ ...m, [campo.key]: ev.target.value }))}
              />
            </label>
          ))}
          <label className="auth-campo sm:col-span-2">
            <span className="mono-label">{def.segredo}</span>
            <input
              type="password"
              required
              autoComplete="new-password"
              disabled={ocupado}
              value={segredo}
              onChange={(ev) => setSegredo(ev.target.value)}
            />
          </label>
        </div>

        {erro && (
          <p className="text-[12.5px] mb-3 flex items-center gap-1.5" style={{ color: "var(--rose)" }} role="alert">
            <AlertTriangle size={13} /> {erro}
          </p>
        )}
        {resultado && st && (
          <div className="text-[13px] mb-3 flex items-start gap-2" role="status">
            <Pill color={st.cor}>{st.label}</Pill>
            <span className="text-[var(--txt-2)]">{resultado.ultimoTesteDetalhe}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-[11.5px] text-[var(--txt-4)]">O segredo não volta à tela depois de guardado.</span>
          <button type="submit" className="btn btn-primary btn-sm" disabled={ocupado || !segredo}>
            {ocupado ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {ocupado ? "Guardando e testando" : "Guardar e testar"}
          </button>
        </div>
      </form>
    </Reveal>
  );
}

// ── a vitrine (modo demo): a maquete de sempre, que é o que diz ser ────────

const CHANNEL_ICONS = {
  ghl: Database,
  kommo: ContactRound,
  wa: MessageCircle,
  cal: CalendarDays,
};

function Vitrine() {
  const mapRef = useRef<HTMLDivElement>(null);
  const ghlRef = useRef<HTMLDivElement>(null);
  const kommoRef = useRef<HTMLDivElement>(null);
  const waRef = useRef<HTMLDivElement>(null);
  const calRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const refs = { ghl: ghlRef, kommo: kommoRef, wa: waRef, cal: calRef };

  const channelNode = (id: keyof typeof refs) => {
    const channel = CONEXOES_CANAIS.find((item) => item.id === id)!;
    const Icon = CHANNEL_ICONS[id];
    return (
      <div ref={refs[id]} className="connection-node" key={id}>
        <span><Icon size={16} /></span>
        <div><strong>{channel.name}</strong><small>{channel.tipo} · ligado</small></div>
        <i aria-label="conectado" />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="connection-hero">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Plug size={16} className="text-[var(--violet)]" />
              <span className="mono-label">As conexões da sua operação · demonstração</span>
            </div>
            <h2 className="font-display text-[22px] md:text-[26px] font-semibold tracking-tight">
              Tudo conversa com o <span className="grad-text">motor Metrik</span>.
            </h2>
            <p className="text-[var(--txt-2)] mt-2.5 text-[14px] leading-relaxed">
              CRM, WhatsApp e agenda chegam ao mesmo núcleo. Você vê o fluxo; a Metrik cuida da parte técnica.
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.04}>
        <section className="connection-map-shell" aria-labelledby="connection-map-title">
          <div className="connection-map-head">
            <div>
              <span className="mono-label">Fluxo operacional</span>
              <h3 id="connection-map-title">Uma operação, quatro pontos ligados</h3>
            </div>
            <span className="connection-map-status"><i /> sincronizado agora</span>
          </div>
          <div ref={mapRef} className="connection-map">
            <div className="connection-map-column">{channelNode("ghl")}{channelNode("kommo")}</div>
            <div ref={hubRef} className="connection-hub">
              <span><CircuitBoard size={22} /></span>
              <strong>Motor Metrik</strong>
              <small>decide · executa · registra</small>
            </div>
            <div className="connection-map-column">{channelNode("wa")}{channelNode("cal")}</div>
            <AnimatedBeam containerRef={mapRef} fromRef={ghlRef} toRef={hubRef} duration={4.2} />
            <AnimatedBeam containerRef={mapRef} fromRef={kommoRef} toRef={hubRef} delay={0.7} duration={4.8} curvature={-24} />
            <AnimatedBeam containerRef={mapRef} fromRef={waRef} toRef={hubRef} reverse delay={0.35} duration={4.5} />
            <AnimatedBeam containerRef={mapRef} fromRef={calRef} toRef={hubRef} reverse delay={1.05} duration={5} curvature={24} />
          </div>
        </section>
      </Reveal>

      <div>
        <SectionHeader label="Estado das pontas" title="Canais e sistemas" />
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {CONEXOES_CANAIS.map((channel, index) => {
            const Icon = CHANNEL_ICONS[channel.id as keyof typeof CHANNEL_ICONS];
            return (
              <Reveal key={channel.id} delay={0.03 * index}>
                <div className="connection-status-card">
                  <span className="connection-status-icon">{Icon ? <Icon size={16} /> : <Plug size={16} />}</span>
                  <div><span>{channel.tipo}</span><strong>{channel.name}</strong></div>
                  <span className="connection-ok"><Check size={11} /> ligado</span>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>

      <Reveal delay={0.1}>
        <div className="connection-backstage">
          <span><Wrench size={17} /></span>
          <div>
            <strong>Bastidores da Metrik</strong>
            <p>Claude Code e Codex operam por trás do motor. Para você, toda alteração chega como mudança testada, rastreável e reversível.</p>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
