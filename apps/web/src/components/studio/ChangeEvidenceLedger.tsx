import { useState } from "react";
import { ChevronDown, CircleCheck, CircleX, FlaskConical, History, Loader2, Rocket, ShieldCheck } from "lucide-react";

type ProofCase = { caseId?: string; nome?: string; passou?: boolean; falhas?: string[] };

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
  const [openId, setOpenId] = useState<string | null>(null);
  const live = changes.filter((change) => change.status === "published").length;
  const pending = changes.filter((change) => ["draft", "evaluated", "approved"].includes(change.status)).length;

  if (!changes.length) {
    return (
      <div className="change-history-empty">
        <History size={18} />
        <strong>Nenhuma mudança ainda</strong>
        <span>Quando você melhorar o agente, ela aparece aqui.</span>
      </div>
    );
  }

  return (
    <section className="change-history">
      <header className="change-history-head">
        <div><h2>Mudanças</h2><p>O que você pediu e o que entrou no agente.</p></div>
        <span>{live} no ar{pending ? ` · ${pending} em revisão` : ""}</span>
      </header>

      <div className="change-history-list">
        {changes.map((change) => {
          const state = meta(change.status);
          const proof = change.impact;
          const evals = proof?.evals;
          const scenario = proof?.ensaio?.situacoes?.[0];
          const failed = evals?.casos?.filter((item) => !item.passou) ?? [];
          const canPublish = ["draft", "evaluated", "approved"].includes(change.status);
          const open = openId === change.id;

          return (
            <article key={change.id} className="change-history-item" data-tone={state.tone}>
              <div className="change-history-row">
                <i />
                <div className="change-history-copy">
                  <span><b>{state.label}</b>{change.createdAt ? ` · há ${relativeTime(change.createdAt)}` : ""}</span>
                  <strong>{change.intent}</strong>
                </div>
                {evals?.total ? <span className="change-history-score" data-ok={evals.aprovado ? "true" : "false"}><ShieldCheck size={12} /> {evals.passaram ?? 0}/{evals.total}</span> : null}
                <div className="change-history-actions">
                  {canPublish ? <button type="button" className="est-btn2" onClick={() => onTest(change)}><FlaskConical size={12} /> Testar</button> : null}
                  {canPublish ? <button type="button" className="est-btn" disabled={publishing} onClick={() => onPublish(change)}>{publishing ? <Loader2 size={12} className="animate-spin" /> : <Rocket size={12} />} Publicar</button> : null}
                  {proof ? (
                    <button type="button" className="change-history-toggle" aria-expanded={open} onClick={() => setOpenId(open ? null : change.id)}>
                      {open ? "Fechar" : "Ver resultado"}<ChevronDown size={13} />
                    </button>
                  ) : null}
                </div>
              </div>

              {open && proof ? (
                <div className="change-history-proof">
                  {scenario ? (
                    <div className="change-history-compare">
                      <p><b>Lead</b>{scenario.pergunta}</p>
                      <div>
                        <article><small>ANTES</small><p>{scenario.antes}</p></article>
                        <article><small>AGORA</small><p>{scenario.agora}</p></article>
                      </div>
                    </div>
                  ) : <p className="change-history-no-compare">Esta mudança ainda não tem comparação antes e depois.</p>}

                  <div className="change-history-guard">
                    <span>{evals?.aprovado ? <CircleCheck size={14} /> : <CircleX size={14} />}</span>
                    <div>
                      <strong>{evals?.total ? `Guardião: ${evals.passaram ?? 0} de ${evals.total} passaram` : "Guardião ainda não executado"}</strong>
                      {failed[0] ? <small>{failed[0].nome}: {failed[0].falhas?.[0]}</small> : <small>{proof.suite ? `Suíte ${proof.suite}` : "Teste concluído"}{proof.ensaio?.modo === "real" ? " · cérebro real" : ""}</small>}
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {publishError ? <p className="change-history-error">{publishError}</p> : null}
    </section>
  );
}
