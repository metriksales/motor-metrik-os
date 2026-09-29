// CONEXÕES — o que o PROVEDOR disse no último teste, com data (S-019).
//
// Logado, esta tela não afirma nada por conta própria: cada cartão mostra o
// resultado do último "testar agora" contra a uazapi/GHL/Kommo, e quando
// ninguém perguntou ainda, diz "nunca testada". A maquete com tudo "ligado"
// continua existindo — só na vitrine (modo demo), onde é o que ela diz ser.
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
  RefreshCw,
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
  quemRespondeu,
  type ConexaoReal,
  type TipoCadastravel,
} from "../lib/conexoes";
import { tempoRelativo, useConexoes } from "../lib/live";
import { Pill, Reveal, SectionHeader, SkeletonCard, cx } from "../ui";

export default function Conexoes() {
  const auth = useMotorAuth();
  return auth.demo ? <Vitrine /> : <ConexoesDaConta />;
}

/** Por quanto tempo o cartão anuncia "o provedor respondeu agora". */
const AVISO_MS = 6000;

// ── a conta de verdade ─────────────────────────────────────────────────────

function ConexoesDaConta() {
  const auth = useMotorAuth();
  const { conexoes, carregando, erro, substituir } = useConexoes();
  const podeGerenciar = auth.role === "owner" || auth.role === "admin";
  const [testando, setTestando] = useState<string | null>(null);
  const [erroDoTeste, setErroDoTeste] = useState<Record<string, string | undefined>>({});
  // O cartão precisa DIZER que a resposta chegou — mesmo quando ela é igual à
  // anterior. Sem isso, "testar" numa conexão que já estava fora parecia não
  // fazer nada, e a pessoa recarregava a página para conferir.
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
      setErroDoTeste((x) => ({ ...x, [c.id]: e instanceof Error ? e.message : "não consegui testar" }));
    } finally {
      setTestando(null);
    }
  };

  const comProblema = (conexoes ?? []).filter((c) => c.status === "falha" || c.status === "sem_credencial").length;

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="connection-hero">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Plug size={16} className="text-[var(--violet)]" />
              <span className="mono-label">As conexões da sua conta</span>
            </div>
            <h2 className="font-display text-[22px] md:text-[26px] font-semibold tracking-tight">
              O que cada ponta <span className="grad-text">respondeu</span> — não o que foi cadastrado.
            </h2>
            <p className="text-[var(--txt-2)] mt-2.5 text-[14px] leading-relaxed">
              Conexão é a primeira coisa que quebra: token vencido, instância de WhatsApp desconectada, funil que
              mudou de id. Cada cartão mostra o resultado do último teste contra o provedor, com data. Se ninguém
              perguntou ainda, ele diz isso.
            </p>
          </div>
        </div>
      </Reveal>

      <div>
        <SectionHeader
          label="Estado das pontas"
          title="O que o último teste disse"
          right={
            conexoes && conexoes.length > 0 ? (
              <span className="mono-label">
                {conexoes.length} {conexoes.length === 1 ? "conexão" : "conexões"}
                {comProblema > 0 ? ` · ${comProblema} com problema` : ""}
              </span>
            ) : undefined
          }
        />
        {erro && (
          <div className="card p-4 mb-3 text-[13px] flex items-center gap-2" style={{ color: "var(--rose)" }}>
            <AlertTriangle size={14} /> não consegui ler as conexões da sua conta: {erro}
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
                  onTestar={() => testar(c)}
                />
              </Reveal>
            ))}
          </div>
        )}
      </div>

      {podeGerenciar && <Cadastro onCadastrada={substituir} />}

      <Reveal delay={0.1}>
        <div className="connection-backstage">
          <span><KeyRound size={17} /></span>
          <div>
            <strong>Onde mora o token</strong>
            <p>
              No cofre da sua conta, cifrado com uma chave que só abre para ela. Ele nunca volta a esta tela — trocar
              é substituir — e cada vez que um teste o usa fica registrado na auditoria.
            </p>
          </div>
        </div>
      </Reveal>
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
          ? "Cadastre a primeira logo abaixo: o token vai para o cofre e o teste roda na hora."
          : "Quem administra a conta pode cadastrar a primeira."}
      </p>
    </div>
  );
}

/** "testada agora" / "testada há 5 min" / "nunca testada" */
function quandoTestou(iso: string | null): string {
  if (!iso) return "nunca testada";
  const t = tempoRelativo(iso);
  return t === "agora" ? "testada agora" : `testada há ${t}`;
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
  onTestar,
}: {
  c: ConexaoReal;
  testando: boolean;
  erro?: string;
  aviso: { mesma: boolean } | null;
  onTestar: () => void;
}) {
  const tipo = TIPO_DE_CONEXAO[c.kind];
  const Icon = tipo?.icon ?? Plug;
  const st = STATUS_DA_CONEXAO[c.status] ?? { label: c.status, cor: "var(--txt-4)" };
  const quem = quemRespondeu(c);
  const foto = c.status === "ok" ? c.ultimoTesteDados?.foto : undefined;
  return (
    <div className={cx("card p-4 h-full flex flex-col", aviso ? "connection-respondeu" : undefined)} data-status={c.status}>
      <div className="flex items-start gap-3">
        <Avatar foto={foto} Icon={Icon} alt={quem || nomeDaConexao(c)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <strong className="text-[13.5px] text-[var(--txt)]">{nomeDaConexao(c)}</strong>
            <Pill color={st.cor}>{st.label}</Pill>
          </div>
          {quem && c.status === "ok" && (
            <div className="text-[12.5px] text-[var(--txt-2)] mt-0.5 truncate">{quem}</div>
          )}
          <div className="mono-label mt-1">{tipo?.tipo ?? c.kind} · {quandoTestou(c.ultimoTesteEm)}</div>
          <p className="text-[13px] text-[var(--txt-2)] mt-2 leading-relaxed">
            {c.ultimoTesteDetalhe ?? "Ninguém perguntou ao provedor ainda. Teste agora para saber."}
          </p>
          {aviso && (
            <p className="text-[12px] mt-1.5 flex items-center gap-1.5" style={{ color: "var(--emerald)" }} role="status">
              <Check size={12} /> {tipo?.provedor ?? "o provedor"} respondeu agora{aviso.mesma ? " — a mesma resposta de antes" : ""}
            </p>
          )}
          {erro && (
            <p className="text-[12.5px] mt-1.5" style={{ color: "var(--rose)" }} role="alert">{erro}</p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-[var(--line)]">
        <span className="text-[11.5px] text-[var(--txt-4)]">
          {c.testavel ? `pergunta à ${tipo?.provedor ?? "provedor"} e grava a resposta` : "ainda não existe teste para este tipo"}
        </span>
        <button
          type="button"
          className="btn btn-sm"
          disabled={!c.testavel || testando}
          onClick={onTestar}
          title={c.testavel ? undefined : "ainda não existe teste para este tipo"}
        >
          {testando ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {testando ? `perguntando à ${tipo?.provedor ?? "provedor"}…` : "Testar agora"}
        </button>
      </div>
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
      setErro(e instanceof Error ? e.message : "não consegui cadastrar");
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
            <span className="mono-label">tipo</span>
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
            <span className="mono-label">rótulo</span>
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
                {campo.ajuda ? <em className="not-italic normal-case text-[var(--txt-4)]"> · {campo.ajuda}</em> : null}
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
          <span className="text-[11.5px] text-[var(--txt-4)]">o segredo não volta à tela depois de guardado</span>
          <button type="submit" className="btn btn-primary btn-sm" disabled={ocupado || !segredo}>
            {ocupado ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {ocupado ? "guardando e testando…" : "Guardar e testar"}
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
