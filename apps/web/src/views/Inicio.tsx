import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, Sparkles, ShieldCheck, GraduationCap, BadgeCheck } from "lucide-react";
import { STATS, type ViewId } from "../data";
import { useAgents } from "../lib/agents";
import { useMotorAuth } from "../lib/auth";
import { useLive, reais, tempoRelativo, kpiDinheiro } from "../lib/live";
import { Reveal, Delta, Skeleton } from "../ui";
import { Robot } from "../Robot";
import FechamentoDia from "./FechamentoDia";
import Marcos from "./Marcos";

// O Início é o ESTADO DA OPERAÇÃO, não uma landing page: placar do dia,
// a frota em linhas, o que precisa de você e o que acabou de acontecer.
// Mesma gramática do Estúdio — denso, mono nos dados, honesto.
export default function Inicio({ go, onOpen }: { go: (v: ViewId) => void; onOpen: (id: string) => void }) {
  const auth = useMotorAuth();
  const { agents } = useAgents();
  const { logs, stats, carregando } = useLive();
  // A vitrine pode usar atividade viva como amostra, mas nunca deve chamá-la
  // de "dados da sua conta": sem login, continua sendo demonstração.
  const dadosDaConta = !auth.demo && !!stats;
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
        { label: "Atendimentos hoje", value: String(stats.execucoes), delta: dadosDaConta ? "dado real ✓" : "demonstração", up: true },
        { label: "Acertos", value: stats.taxa != null ? `${Math.round(stats.taxa * 100)}%` : "—", delta: `${stats.erros} erros`, up: stats.erros === 0 },
        { label: dinheiro.label, value: dinheiro.value, delta: dinheiro.delta, up: true },
      ]
    : STATS;

  return (
    <div className="space-y-4">
      {/* ── HOJE — o placar da operação, sem discurso ── */}
      <Reveal>
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3 border-b border-[var(--line)]">
            <div className="flex items-center gap-2">
              <span className="live-dot" />
              <span className="mono-label">Hoje · {ativos} de {agents.length} no ar</span>
            </div>
            {dadosDaConta && fora.length > 0 ? (
              <span className="text-[12px] text-[var(--txt-3)]">
                enquanto você esteve fora <span className="text-[var(--txt-4)]">(há {tempoRelativo(desde!)})</span>: {fora.length}{" "}
                {fora.length === 1 ? "atendimento" : "atendimentos"}
                {foraReunioes > 0 && <> · {foraReunioes} {foraReunioes === 1 ? "reunião" : "reuniões"}</>}
                {foraValor > 0 && <> · <span style={{ color: "var(--emerald)" }}>+{reais(foraValor)}</span></>}
              </span>
            ) : (
              <span className="text-[12px] text-[var(--txt-4)]">
                {auth.demo ? "números de demonstração" : stats ? "dados reais da sua conta" : "sem atividade ainda"}
              </span>
            )}
          </div>

          {carregandoReal ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--line)]">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-[var(--surface)] px-5 py-4">
                  <Skeleton style={{ width: "60%", height: 11 }} />
                  <Skeleton className="mt-3" style={{ width: "45%", height: 24 }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--line)]">
              {kpis.map((s) => (
                <div key={s.label} className="bg-[var(--surface)] px-5 py-4">
                  <div className="text-[12px] text-[var(--txt-3)] mb-2">{s.label}</div>
                  <div className="flex items-end justify-between gap-2">
                    <div className="num text-[25px] leading-none">{s.value}</div>
                    <Delta up={s.up}>{s.delta}</Delta>
                  </div>
                </div>
              ))}
            </div>
          )}

          {stats && (
            <div className="px-5 py-2.5 border-t border-[var(--line)] font-mono text-[11.5px] text-[var(--txt-3)]">
              {reunioesHoje} {reunioesHoje === 1 ? "reunião marcada" : "reuniões marcadas"} hoje
              <span className="text-[var(--txt-4)]"> · </span>semana {reais(stats.valor7dCentavos ?? 0)}
              <span className="text-[var(--txt-4)]"> · </span>desde o início {reais(stats.valorTotalCentavos ?? 0)}
            </div>
          )}
        </div>
      </Reveal>

      {/* marco alcançado (aparece 1× quando cruza um degrau real) */}
      <Marcos stats={stats} orgKey={auth.orgId ?? "demo"} />

      {/* ── A FROTA — cada robô é uma linha; clicar abre o Estúdio dele ── */}
      <Reveal delay={0.04}>
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3">
            <span className="mono-label">A frota · {agents.length}</span>
            <button className="text-[12px] flex items-center gap-1" style={{ color: "var(--violet)" }} onClick={() => go("agentes")}>
              abrir a frota <ArrowRight size={13} />
            </button>
          </div>
          {agents.map((a) => (
            <button
              key={a.id}
              onClick={() => onOpen(a.id)}
              className="w-full flex items-center gap-3 px-5 py-3 border-t border-[var(--line)] text-left transition-colors hover:bg-[var(--surface-2)]"
            >
              <Robot state={a.state} color={a.color} size={26} />
              <div className="min-w-0 flex-none w-36 md:w-44">
                <div className="text-[13.5px] font-semibold text-[var(--txt)] truncate">{a.name}</div>
                <div className="text-[11.5px] text-[var(--txt-4)] truncate">{a.papel}</div>
              </div>
              <span className="hidden md:block flex-1 min-w-0 text-[13px] text-[var(--txt-3)] truncate">{a.agora}</span>
              <span
                className="font-mono text-[11.5px] flex-none"
                style={{ color: a.state === "ativo" ? "var(--emerald)" : "var(--txt-4)" }}
              >
                {a.state === "ativo" ? "no ar" : "pausado"}
              </span>
              <ArrowRight size={14} className="flex-none text-[var(--txt-4)]" />
            </button>
          ))}
        </div>
      </Reveal>

      {/* POR QUE ISSO NÃO É UM CHATBOT — pitch de venda: SÓ na vitrine (demo).
          Cliente pagante não precisa ser revendido todo dia. */}
      {auth.demo && (
        <Reveal delay={0.05}>
          <div className="card p-5 md:p-6">
            <div className="mono-label mb-1.5">Por que isso não é (mais um) robozinho</div>
            <h2 className="font-display text-[16px] md:text-[18px] font-semibold tracking-tight mb-4 max-w-2xl leading-snug">
              Ferramenta de US$97 você configura e torce.{" "}
              <span className="grad-text">Aqui, uma operação inteira trabalha — e te mostra a prova.</span>
            </h2>
            <div className="grid md:grid-cols-3 gap-3">
              <Pilar
                icon={ShieldCheck}
                color="#3fb950"
                titulo="Operado com prova"
                texto="A Metrik constrói e opera. Cada execução vira uma linha na sua caixa-preta — o que fez, por quê, e quanto rendeu."
              />
              <Pilar
                icon={GraduationCap}
                color="#e8b04b"
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

      {/* ── AO VIVO + o que precisa de você + pedir melhoria ── */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Reveal delay={0.05} className="lg:col-span-2">
          <div className="card overflow-hidden h-full">
            <div className="flex items-center justify-between px-5 py-3">
              <span className="mono-label">Ao vivo</span>
              <button className="text-[12px] flex items-center gap-1" style={{ color: "var(--violet)" }} onClick={() => go("aovivo")}>
                ver tudo <ArrowRight size={13} />
              </button>
            </div>
            {logs && logs.length > 0 ? (
              <ul>
                {logs.slice(0, 5).map((l) => {
                  const a = agents.find((x) => x.id === l.agentId);
                  return (
                    <li key={l.id} className="flex items-center gap-3 px-5 py-2.5 border-t border-[var(--line)]">
                      <span className="font-mono text-[11px] text-[var(--txt-4)] w-16 flex-none">{tempoRelativo(l.at)}</span>
                      <div className="min-w-0 flex-1">
                        <span className="text-[13px] font-medium text-[var(--txt)]">{a?.name ?? l.motor ?? "Motor"}</span>{" "}
                        <span className="text-[13px] text-[var(--txt-2)]">{l.resumo}</span>
                        {(l.valorCentavos ?? 0) > 0 && (
                          <span className="font-mono text-[11.5px] font-medium ml-1.5" style={{ color: "var(--emerald)" }}>+{reais(l.valorCentavos)}</span>
                        )}
                      </div>
                      {!l.ok && <span className="font-mono text-[11px] flex-none" style={{ color: "var(--rose)" }}>erro</span>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul>
                {feedDemo.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-5 py-2.5 border-t border-[var(--line)]">
                    <span className="live-dot flex-none" style={{ width: 6, height: 6, background: a.color }} />
                    <div className="min-w-0 flex-1">
                      <span className="text-[13px] font-medium text-[var(--txt)]">{a.name}</span>{" "}
                      <span className="text-[13px] text-[var(--txt-2)]">{a.agora}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="space-y-4 h-full flex flex-col">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={16} style={{ color: "var(--amber)" }} />
                <span className="font-display font-semibold text-[14px]">Precisa de você</span>
              </div>
              <ul className="space-y-2 text-[13px] text-[var(--txt-2)]">
                {stats ? (
                  errosHoje.length > 0 ? (
                    errosHoje.slice(0, 2).map((l) => (
                      <li key={l.id} className="flex gap-2"><b className="text-[var(--txt)]">{agents.find((a) => a.id === l.agentId)?.name ?? "Motor"}</b> {l.erro ?? l.resumo}</li>
                    ))
                  ) : (
                    <li>nada pendente — a frota está rodando sozinha ✓</li>
                  )
                ) : (
                  <>
                    <li className="flex gap-2"><b className="text-[var(--txt)]">Recuperador</b> bateu no limite de toques 1×</li>
                    <li className="flex gap-2"><b className="text-[var(--txt)]">Contratos</b> está pausado</li>
                  </>
                )}
              </ul>
            </div>

            <div className="card p-5 flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={16} style={{ color: "var(--violet)" }} />
                <span className="font-display font-semibold text-[14px]">Quer mudar algo?</span>
              </div>
              <p className="text-[13px] text-[var(--txt-3)] leading-relaxed">
                Escolha um robô e peça em português. A Metrik simula, testa de verdade e te mostra a prova antes de qualquer coisa ir pro ar.
              </p>
              <button className="btn btn-primary mt-4 w-full" onClick={() => go("agentes")}>Escolher um agente <ArrowRight size={15} /></button>
            </div>
          </div>
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
    </div>
  );
}

function Pilar({ icon: Icon, color, titulo, texto }: { icon: any; color: string; titulo: string; texto: string }) {
  return (
    <div className="rounded-[9px] border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} style={{ color }} />
        <span className="font-display font-semibold text-[13.5px]">{titulo}</span>
      </div>
      <p className="text-[12.5px] text-[var(--txt-3)] leading-relaxed">{texto}</p>
    </div>
  );
}
