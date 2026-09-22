import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, CircleCheck, CircleX, Clock3, Database, FlaskConical, History, Loader2, Rocket, ShieldCheck } from "lucide-react";

type ProofCase = {
  caseId?: string;
  nome?: string;
  passou?: boolean;
  falhas?: string[];
};

export type ChangeEvidence = {
  id: string;
  intent: string;
  status: string;
  createdAt?: string | null;
  impact?: {
    suite?: string;
    evals?: { taxa?: number; passaram?: number; total?: number; aprovado?: boolean; casos?: ProofCase[] };
    ensaio?: { modo?: string; situacoes?: { nome?: string; pergunta?: string; antes?: string; agora?: string }[] };
  } | null;
};

type Props = {
  changes: ChangeEvidence[];
  relativeTime: (value: string) => string;
  publishing?: boolean;
  publishError?: string | null;
  onTest: (change: ChangeEvidence) => void;
  onPublish: (change: ChangeEvidence) => void;
};

const STATUS = {
  draft: { label: "EM PREPARO", tone: "draft" },
  evaluated: { label: "PROVADA", tone: "proved" },
  approved: { label: "PRONTA", tone: "proved" },
  published: { label: "NO AR", tone: "live" },
  rejected: { label: "SEGURADA", tone: "blocked" },
} as const;

function meta(status: string) {
  return STATUS[status as keyof typeof STATUS] ?? STATUS.draft;
}

export function ChangeEvidenceLedger({ changes, relativeTime, publishing, publishError, onTest, onPublish }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(changes[0]?.id ?? null);
  const [scenarioIndex, setScenarioIndex] = useState(0);

  useEffect(() => {
    if (!changes.length) return setSelectedId(null);
    setSelectedId((current) => changes.some((change) => change.id === current) ? current : changes[0].id);
  }, [changes]);

  const selected = useMemo(() => changes.find((change) => change.id === selectedId) ?? changes[0], [changes, selectedId]);
  const proof = selected?.impact;
  const evals = proof?.evals;
  const scenarios = proof?.ensaio?.situacoes ?? [];
  const scenario = scenarios[scenarioIndex] ?? scenarios[0];
  const selectedMeta = selected ? meta(selected.status) : meta("draft");
  const canPublish = selected && ["draft", "evaluated", "approved"].includes(selected.status);
  const liveCount = changes.filter((change) => change.status === "published").length;
  const protectedCount = changes.reduce((total, change) => total + (change.impact?.evals?.passaram ?? 0), 0);

  useEffect(() => setScenarioIndex(0), [selectedId]);

  if (!selected) {
    return (
      <div className="change-ledger-empty">
        <span><History size={20} /></span>
        <strong>A primeira mudança ainda vai nascer aqui</strong>
        <p>Quando você pedir uma correção, esta área vai ligar o pedido à prova, ao antes e depois e ao que entrou no ar.</p>
      </div>
    );
  }

  return (
    <section className="change-ledger">
      <header className="change-ledger-head">
        <div>
          <span className="change-eyebrow">REGISTRO DE DECISÕES</span>
          <h2>Mudanças com prova, não promessa.</h2>
          <p>Cada pedido fica ligado ao que mudou, ao teste que tentou quebrá-lo e ao estado real da publicação.</p>
        </div>
        <div className="change-ledger-metrics">
          <span><strong>{changes.length}</strong> mudanças</span>
          <span><strong>{protectedCount}</strong> ataques vencidos</span>
          <span><strong>{liveCount}</strong> no ar</span>
        </div>
      </header>

      <div className="change-ledger-shell">
        <aside className="change-ledger-list" aria-label="Mudanças registradas">
          <span className="change-eyebrow">LINHA DE MUDANÇAS</span>
          <div>
            {changes.map((change) => {
              const state = meta(change.status);
              const score = change.impact?.evals;
              return (
                <button key={change.id} type="button" aria-current={change.id === selected.id ? "true" : undefined} onClick={() => setSelectedId(change.id)}>
                  <i data-tone={state.tone} />
                  <span>
                    <small data-tone={state.tone}>{state.label}</small>
                    <strong>{change.intent}</strong>
                    <em>{change.createdAt ? `há ${relativeTime(change.createdAt)}` : "agora"}{score?.total ? ` · ${score.passaram ?? 0}/${score.total} passaram` : ""}</em>
                  </span>
                  <ArrowRight size={13} />
                </button>
              );
            })}
          </div>
        </aside>

        <article className="change-ledger-detail">
          <header>
            <div>
              <span className="change-status" data-tone={selectedMeta.tone}><i /> {selectedMeta.label}</span>
              <h3>{selected.intent}</h3>
            </div>
            <div className="change-detail-actions">
              {canPublish ? <button type="button" className="est-btn2" onClick={() => onTest(selected)}><FlaskConical size={13} /> Testar esta prévia</button> : null}
              {canPublish ? <button type="button" className="est-btn" disabled={publishing} onClick={() => onPublish(selected)}>{publishing ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />} Publicar</button> : null}
            </div>
          </header>

          {publishError ? <p className="change-publish-error">{publishError}</p> : null}

          <section className="change-proof-flow" aria-label="Caminho da mudança">
            <span data-active><Check size={12} /> Pedido registrado</span><i />
            <span data-active={Boolean(proof) || undefined}><FlaskConical size={12} /> Prova executada</span><i />
            <span data-active={selected.status === "published" || undefined}><Rocket size={12} /> No atendimento</span>
          </section>

          <div className="change-proof-grid">
            <section className="change-before-after">
              <header>
                <div><span className="change-eyebrow">IMPACTO NA CONVERSA</span><h4>{scenario ? "A mesma situação, duas respostas" : "Comparação ainda não executada"}</h4></div>
                {scenarios.length > 1 ? (
                  <div className="change-scenario-tabs">
                    {scenarios.map((item, index) => <button type="button" key={`${item.nome}-${index}`} aria-pressed={index === scenarioIndex} onClick={() => setScenarioIndex(index)}>{index + 1}</button>)}
                  </div>
                ) : null}
              </header>

              {scenario ? (
                <>
                  <div className="change-proof-question"><span>LEAD</span><p>{scenario.pergunta}</p></div>
                  <div className="change-proof-compare">
                    <article><small>ANTES</small><p>{scenario.antes}</p></article>
                    <ArrowRight size={16} />
                    <article data-now><small>AGORA, COM A MUDANÇA</small><p>{scenario.agora}</p></article>
                  </div>
                </>
              ) : (
                <div className="change-proof-pending">
                  <Clock3 size={17} />
                  <span><strong>Falta gerar o antes e depois</strong><p>Teste a mudança para registrar como ela responde na prática.</p></span>
                </div>
              )}
            </section>

            <aside className="change-guardian-card" data-approved={evals?.aprovado ? "true" : "false"}>
              <header>
                <span><ShieldCheck size={16} /></span>
                <div><small>GUARDIÃO AUTOMÁTICO</small><strong>{evals?.total ? `${evals.passaram ?? 0}/${evals.total} protegidos` : "Aguardando prova"}</strong></div>
                {evals?.taxa != null ? <b>{Math.round(evals.taxa * 100)}%</b> : null}
              </header>
              <div className="change-guardian-cases">
                {(evals?.casos ?? []).map((testCase) => (
                  <span key={testCase.caseId ?? testCase.nome} data-state={testCase.passou ? "ok" : "fail"}>
                    {testCase.passou ? <CircleCheck size={13} /> : <CircleX size={13} />}
                    <strong>{testCase.nome}</strong>
                    {testCase.falhas?.[0] ? <small>{testCase.falhas[0]}</small> : null}
                  </span>
                ))}
                {!evals?.casos?.length ? <p>Ao iniciar a prova, cada ataque e seu veredito aparecem aqui.</p> : null}
              </div>
              <footer>
                <span><Database size={11} /> {proof?.suite ? `suíte ${proof.suite}` : "sem suíte registrada"}</span>
                <span>{proof?.ensaio?.modo === "real" ? "cérebro real" : proof ? "roteiro" : "não testada"}</span>
              </footer>
            </aside>
          </div>
        </article>
      </div>
    </section>
  );
}
