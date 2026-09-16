import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Wallet, ArrowRight, Sparkles, Radio, ShieldCheck, GraduationCap, BadgeCheck } from "lucide-react";
import { STATS, type ViewId } from "../data";
import { useAgents } from "../lib/agents";
import { useMotorAuth } from "../lib/auth";
import { useLive, reais, tempoRelativo, kpiDinheiro } from "../lib/live";
import { Reveal, Delta, Skeleton, cx } from "../ui";
import { Robot } from "../Robot";
import FechamentoDia from "./FechamentoDia";
import Marcos from "./Marcos";

export default function Inicio({ go, onOpen }: { go: (v: ViewId) => void; onOpen: (id: string) => void }) {
  const auth = useMotorAuth();
  const { agents } = useAgents();
  const { logs, stats, carregando } = useLive();
  // logado, ainda buscando a verdade → skeleton (nunca zeros/mock piscando)
  const carregandoReal = !auth.demo && carregando && !stats;
  const ativos = agents.filter((a) => a.state === "ativo").length;
  const feedDemo = agents.filter((a) => a.state === "ativo").slice(0, 4);

  // "Enquanto você esteve fora" — o gancho de retorno: recorta os logs reais
  // pela última visita (localStorage por org) e conta o que a frota fez.
  const orgKey = `motor:lastVisit:${auth.orgId ?? "demo"}`;
  const [desde] = useState<string | null>(() => {
    try { return localStorage.getItem(orgKey); } catch { return null; }
  });
  useEffect(() => {
    try { localStorage.setItem(orgKey, new Date().toISOString()); } catch { /* sem storage, sem gancho */ }
  }, [orgKey]);
  const fora = desde && logs ? logs.filter((l) => l.at > desde) : [];
  const foraValor = fora.reduce((s, l) => s + (l.valorCentavos ?? 0), 0);
  const foraReunioes = fora.filter((l) => (l.valorCentavos ?? 0) > 0).length;

  // recortes REAIS do dia (Flight Recorder)
  const hoje0 = new Date(); hoje0.setHours(0, 0, 0, 0);
  const logsHoje = (logs ?? []).filter((l) => new Date(l.at) >= hoje0);
  const reunioesHoje = logsHoje.filter((l) => (l.valorCentavos ?? 0) > 0).length;
  const errosHoje = logsHoje.filter((l) => !l.ok);

  // Números REAIS do Flight Recorder quando existem; senão o demo (STATS mock).
  const dinheiro = stats ? kpiDinheiro(stats) : null;
  const kpis = stats && dinheiro
    ? [
        { label: "Agentes no ar", value: String(ativos), delta: `de ${agents.length}`, up: true },
        { label: "Atendimentos hoje", value: String(stats.execucoes), delta: "dado real ✓", up: true },
        { label: "Acertos", value: stats.taxa != null ? `${Math.round(stats.taxa * 100)}%` : "—", delta: `${stats.erros} erros`, up: stats.erros === 0 },
        { label: dinheiro.label, value: dinheiro.value, delta: dinheiro.delta, up: true },
      ]
    : STATS;

  return (
    <div className="space-y-6">
      {/* HERO — banner com peso (linha Bridge) */}
      <Reveal>
        <div className="hero-banner card-hover relative overflow-hidden rounded-2xl">
          <div className="aurora !opacity-50" />
          <div className="relative p-7 md:p-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-4">
                <span className="live-dot" />
                <span className="mono-label" style={{ color: "var(--emerald)" }}>{ativos} de {agents.length} agentes trabalhando</span>
              </div>
              <h1 className="font-display font-bold tracking-tight leading-[1.02] text-[34px] md:text-[47px]">
                Sua operação está <span className="grad-text">trabalhando sozinha</span>.
              </h1>
              {stats && fora.length > 0 ? (
                <p className="mt-4 text-[15px] md:text-[16px] leading-relaxed" style={{ color: "var(--txt-2)" }}>
                  <span className="font-medium" style={{ color: "var(--txt)" }}>Enquanto você esteve fora</span>{" "}
                  <span style={{ color: "var(--txt-3)" }}>(há {tempoRelativo(desde!)})</span>: {fora.length}{" "}
                  {fora.length === 1 ? "atendimento" : "atendimentos"}
                  {foraReunioes > 0 && <> · {foraReunioes} {foraReunioes === 1 ? "reunião marcada" : "reuniões marcadas"}</>}
                  {foraValor > 0 && <> · <span style={{ color: "var(--emerald)" }}>+{reais(foraValor)}</span></>}
                </p>
              ) : (
                <p className="mt-4 text-[15px] md:text-[16px] leading-relaxed max-w-xl" style={{ color: "var(--txt-2)" }}>
                  Uma frota de robôs atende, qualifica, agenda, recupera e rastreia — cada um blindado.
                  Você só observa e, quando quiser, pede uma melhoria.
                </p>
              )}
              <div className="flex gap-2.5 mt-6">
                <button className="btn btn-primary" onClick={() => go("aovivo")}><Radio size={15} /> Ver ao vivo</button>
                <button className="btn" onClick={() => go("agentes")}>Abrir a frota</button>
              </div>
            </div>

            {/* fleet strip */}
            <div className="flex-none">
              <div className="mono-label mb-2.5">A frota</div>
              <div className="flex gap-2">
                {agents.map((a) => (
                  <button key={a.id} onClick={() => onOpen(a.id)} title={a.name} className="rounded-lg p-1.5 border card-hover" style={{ borderColor: a.state === "ativo" ? `${a.color}30` : "var(--line)", background: a.state === "ativo" ? `${a.color}12` : "var(--surface)" }}>
                    <Robot state={a.state} color={a.color} size={40} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* marco alcançado (aparece 1× quando cruza um degrau real) */}
      <Marcos stats={stats} orgKey={auth.orgId ?? "demo"} />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {carregandoReal
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-4">
                <Skeleton style={{ width: "60%", height: 11 }} />
                <Skeleton className="mt-3" style={{ width: "45%", height: 24 }} />
              </div>
            ))
          : kpis.map((s, i) => (
              <Reveal key={s.label} delay={0.04 * i}>
                <div
                  className={cx("card card-hover p-4", s.value.startsWith("R$") && "money-glow")}
                  style={s.value.startsWith("R$") ? { borderColor: "rgba(52,211,153,.35)" } : undefined}
                >
                  <div className="text-[12.5px] text-[var(--txt-3)] mb-2">{s.label}</div>
                  <div className="flex items-end justify-between">
                    <div className="num text-[26px] leading-none">{s.value}</div>
                    <Delta up={s.up}>{s.delta}</Delta>
                  </div>
                </div>
              </Reveal>
            ))}
      </div>

      {/* POR QUE ISSO NÃO É UM CHATBOT — pitch de venda: SÓ na vitrine (demo).
          Cliente pagante não precisa ser revendido todo dia. */}
      {auth.demo && (
        <Reveal delay={0.05}>
          <div className="card p-5 md:p-6">
            <div className="mono-label mb-1.5">Por que isso não é (mais um) robozinho</div>
            <h2 className="font-display text-[17px] md:text-[19px] font-semibold tracking-tight mb-4 max-w-2xl leading-snug">
              Ferramenta de US$97 você configura e torce.{" "}
              <span className="grad-text">Aqui, uma operação inteira trabalha — e te mostra a prova.</span>
            </h2>
            <div className="grid md:grid-cols-3 gap-3">
              <Pilar
                icon={ShieldCheck}
                color="#34d399"
                titulo="Operado com prova"
                texto="A Metrik constrói e opera. Cada execução vira uma linha na sua caixa-preta — o que fez, por quê, e quanto rendeu."
              />
              <Pilar
                icon={GraduationCap}
                color="#e0a44a"
                titulo="Escola"
                texto="A IA errou? Você corrige apontando, como faria com uma pessoa. O motor aprende sem você tocar em nada por dentro."
              />
              <Pilar
                icon={BadgeCheck}
                color="#58aae4"
                titulo="Porteiro"
                texto="Nenhuma mudança vai pro ar sem passar no teste. Você vê a nota e a prova antes de aprovar."
              />
            </div>
          </div>
        </Reveal>
      )}

      {/* decisões — com dado real quando existe; mock SÓ na vitrine */}
      <div className="grid md:grid-cols-3 gap-4">
        <Reveal delay={0.05}>
          <Decision
            icon={CheckCircle2}
            color="#34d399"
            titulo="Aconteceu"
            linhas={
              stats
                ? [
                    `${stats.execucoes} ${stats.execucoes === 1 ? "atendimento" : "atendimentos"} hoje`,
                    stats.taxa != null ? `${Math.round(stats.taxa * 100)}% de acerto` : "sem atendimentos ainda hoje",
                    `${reunioesHoje} ${reunioesHoje === 1 ? "reunião marcada" : "reuniões marcadas"}`,
                  ]
                : ["774 execuções hoje", "99,3% de acerto", "5 reuniões marcadas"]
            }
          />
        </Reveal>
        <Reveal delay={0.1}>
          <div className="card card-hover p-5 h-full" style={{ borderColor: "#fbbf2433", background: "linear-gradient(160deg, rgba(251,191,36,.07), var(--surface))" }}>
            <div className="flex items-center gap-2.5 mb-3">
              <AlertCircle size={18} style={{ color: "#fbbf24" }} />
              <span className="font-display font-semibold text-[15px]">Precisa de você</span>
            </div>
            <ul className="space-y-2 text-[13.5px] text-[var(--txt-2)]">
              {stats ? (
                errosHoje.length > 0 ? (
                  errosHoje.slice(0, 2).map((l) => (
                    <li key={l.id} className="flex gap-2"><b className="text-[var(--txt)]">{agents.find((a) => a.id === l.agentId)?.name ?? "Motor"}</b> {l.erro ?? l.resumo}</li>
                  ))
                ) : (
                  <li className="flex gap-2">nada pendente — a frota está rodando sozinha ✓</li>
                )
              ) : (
                <>
                  <li className="flex gap-2"><b className="text-[var(--txt)]">Recuperador</b> bateu no limite de toques 1×</li>
                  <li className="flex gap-2"><b className="text-[var(--txt)]">Contratos</b> está pausado</li>
                </>
              )}
            </ul>
            <button className="btn btn-sm mt-4 w-full justify-between" onClick={() => go("agentes")}>Abrir a frota <ArrowRight size={15} /></button>
          </div>
        </Reveal>
        <Reveal delay={0.15}>
          <Decision
            icon={Wallet}
            color="#e0a44a"
            titulo="Rendeu"
            linhas={
              stats
                ? [
                    `${reais(stats.valorCentavos)} hoje`,
                    `${reais(stats.valor7dCentavos ?? 0)} na semana`,
                    `${reais(stats.valorTotalCentavos ?? 0)} desde o início`,
                  ]
                : ["R$ 18.400 em oportunidades", "R$ 13,97 de custo no dia", "margem tranquila"]
            }
          />
        </Reveal>
      </div>

      {/* fechamento do dia — o recibo pra printar (leitura pura) */}
      {carregandoReal ? (
        <div className="card p-6 md:p-7">
          <Skeleton style={{ width: 180, height: 10 }} />
          <div className="grid grid-cols-3 gap-4 mt-5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} style={{ width: "70%", height: 30 }} />
            ))}
          </div>
          <Skeleton className="mt-6" style={{ width: "100%", height: 52, borderRadius: 12 }} />
        </div>
      ) : (
        <Reveal delay={0.05}>
          <FechamentoDia stats={stats} logs={logs} demo={auth.demo} />
        </Reveal>
      )}

      {/* ao vivo preview + pedir melhoria */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Reveal delay={0.05} className="lg:col-span-2">
          <div className="card p-5 h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="mono-label">Ao vivo</div>
              <button className="text-[12px] flex items-center gap-1" style={{ color: "#e0a44a" }} onClick={() => go("aovivo")}>ver tudo <ArrowRight size={13} /></button>
            </div>
            {logs && logs.length > 0 ? (
              <ul className="space-y-1">
                {logs.slice(0, 4).map((l, i, arr) => {
                  const a = agents.find((x) => x.id === l.agentId);
                  return (
                    <li key={l.id} className={cx("flex items-center gap-3 py-2.5", i !== arr.length - 1 && "border-b border-[var(--line)]")}>
                      <Robot state={a?.state ?? "ativo"} color={a?.color ?? "#e0a44a"} size={30} />
                      <div className="min-w-0 flex-1">
                        <span className="text-[13.5px] text-[var(--txt)]">{a?.name ?? l.motor ?? "Motor"}</span>{" "}
                        <span className="text-[13.5px] text-[var(--txt-2)]">{l.resumo}</span>
                        {(l.valorCentavos ?? 0) > 0 && (
                          <span className="text-[12px] font-medium ml-1.5" style={{ color: "var(--emerald)" }}>+{reais(l.valorCentavos)}</span>
                        )}
                      </div>
                      <span className="tick flex-none">{tempoRelativo(l.at)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul className="space-y-1">
                {feedDemo.map((a, i) => (
                  <li key={a.id} className={cx("flex items-center gap-3 py-2.5", i !== feedDemo.length - 1 && "border-b border-[var(--line)]")}>
                    <Robot state={a.state} color={a.color} size={30} />
                    <div className="min-w-0 flex-1">
                      <span className="text-[13.5px] text-[var(--txt)]">{a.name}</span>{" "}
                      <span className="text-[13.5px] text-[var(--txt-2)]">{a.agora}</span>
                    </div>
                    <span className="live-dot flex-none" style={{ width: 6, height: 6, background: a.color }} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="grad-border h-full">
            <div className="relative p-5 h-full flex flex-col">
              <div className="aurora !h-[40%] !opacity-30" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={17} style={{ color: "#e0a44a" }} />
                  <span className="font-display font-semibold text-[15px]">Quer mudar algo?</span>
                </div>
                <p className="text-[13.5px] text-[var(--txt-2)] leading-relaxed">
                  Escolha um robô e peça em português. A Metrik simula, testa de verdade e te mostra a prova
                  antes de qualquer coisa ir pro ar.
                </p>
              </div>
              <button className="btn btn-primary mt-auto w-full" onClick={() => go("agentes")}>Escolher um agente <ArrowRight size={16} /></button>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

function Pilar({ icon: Icon, color, titulo, texto }: { icon: any; color: string; titulo: string; texto: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} style={{ color }} />
        <span className="font-display font-semibold text-[13.5px]">{titulo}</span>
      </div>
      <p className="text-[12.5px] text-[var(--txt-3)] leading-relaxed">{texto}</p>
    </div>
  );
}

function Decision({ icon: Icon, color, titulo, linhas }: { icon: any; color: string; titulo: string; linhas: string[] }) {
  return (
    <div className="card card-hover p-5 h-full">
      <div className="flex items-center gap-2.5 mb-3">
        <Icon size={18} style={{ color }} />
        <span className="font-display font-semibold text-[15px]">{titulo}</span>
      </div>
      <ul className="space-y-2 text-[13.5px] text-[var(--txt-2)]">
        {linhas.map((l) => (
          <li key={l} className="flex items-start gap-2"><span className="dot mt-1.5" style={{ background: color }} />{l}</li>
        ))}
      </ul>
    </div>
  );
}
