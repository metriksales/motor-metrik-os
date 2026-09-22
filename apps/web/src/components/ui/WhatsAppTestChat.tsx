import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Bot, Camera, Check, CheckCheck, CircleCheck, CircleX, Database, FlaskConical, Loader2, MessageCircle, MoreVertical, Paperclip, Phone, SendHorizontal, ShieldCheck, Smile, Wrench, Video } from "lucide-react";

export type TestChatMessage = {
  de: "voce" | "ia";
  texto: string;
  fonte?: string | null;
  aviso?: boolean;
};

export type TestRunCase = {
  caseId?: string;
  nome: string;
  passou: boolean;
  falhas?: string[];
  ms?: number;
  entrada?: { texto?: string; estado?: Record<string, unknown> };
  saida?: { texto?: string; toolCalls?: { tool: string; args?: Record<string, unknown> }[]; movedStage?: string };
  criterios?: { tipo: string; rotulo: string; esperado: string; passou: boolean; falha?: string }[];
};

export type TestRunView = {
  status: "idle" | "rodando" | "pronto";
  passed?: number;
  total?: number;
  cases?: TestRunCase[];
  mode?: string;
  testedMode?: "ar" | "ensaio";
  base?: string;
  suite?: string;
  durationMs?: number;
  change?: { id: string; intent: string } | null;
  error?: string;
};

type WhatsAppTestChatProps = {
  agentName: string;
  modeLabel: string;
  messages: TestChatMessage[];
  feedback: Record<number, "sim" | "nao">;
  thinking: boolean;
  input: string;
  testRun: TestRunView;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onAccept: (index: number) => void;
  onCorrect: (index: number) => void;
  onFixCase: (testCase: TestRunCase) => void;
  onOpenChanges?: () => void;
};

export function WhatsAppTestChat({
  agentName,
  modeLabel,
  messages,
  feedback,
  thinking,
  input,
  testRun,
  onInputChange,
  onSubmit,
  onAccept,
  onCorrect,
  onFixCase,
  onOpenChanges,
}: WhatsAppTestChatProps) {
  const reduceMotion = useReducedMotion();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0 && !thinking && testRun.status === "idle" && !testRun.error) return;
    endRef.current?.scrollIntoView({ block: "end", behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages.length, reduceMotion, testRun.cases?.length, testRun.error, testRun.status, thinking]);

  const showTestRun = testRun.status !== "idle" || Boolean(testRun.error);
  const runCases = testRun.cases ?? [];
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  useEffect(() => {
    if (testRun.status !== "pronto" || runCases.length === 0) return;
    setSelectedCaseId((current) => runCases.some((item) => (item.caseId ?? item.nome) === current) ? current : (runCases[0].caseId ?? runCases[0].nome));
  }, [runCases, testRun.status]);
  const selectedCase = useMemo(
    () => runCases.find((item) => (item.caseId ?? item.nome) === selectedCaseId) ?? runCases[0],
    [runCases, selectedCaseId],
  );
  const guardScenarios = ["Preço e qualificação", "Pedido de agenda", "Identidade da IA", "Avanço do lead"];

  return (
    <motion.section
      className="wa-test-chat"
      aria-label={`Conversa de teste com ${agentName}`}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
    >
      <header className="wa-test-chat-header">
        <span className="wa-test-avatar">{agentName.slice(0, 1).toUpperCase()}</span>
        <span className="wa-test-identity">
          <strong>{agentName}</strong>
          <small><i /> {modeLabel}</small>
        </span>
        <span className="wa-test-chat-isolated"><ShieldCheck size={13} /> ambiente isolado</span>
        <span className="wa-test-header-actions" aria-hidden="true">
          <Video size={16} />
          <Phone size={15} />
          <MoreVertical size={16} />
        </span>
      </header>

      <div className="wa-test-conversation scroll-thin">
        <span className="wa-test-date">Hoje</span>
        {messages.length === 0 && !showTestRun ? (
          <div className="wa-test-empty">
            <strong>Comece como um lead</strong>
            <span>Use um cenário ao lado ou escreva uma mensagem. Nada daqui vai para o CRM.</span>
          </div>
        ) : null}

        <AnimatePresence initial={false}>
          {messages.map((message, index) => (
            <motion.div
              key={`${index}-${message.de}-${message.texto}`}
              className={`wa-test-message-row wa-test-message-row--${message.de}`}
              initial={reduceMotion ? false : { opacity: 0, y: 7, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.18 }}
            >
              <div className={`wa-test-bubble${message.aviso ? " wa-test-bubble--notice" : ""}`}>
                <p>{message.texto}</p>
                <span className="wa-test-time">
                  agora {message.de === "voce" ? <CheckCheck size={13} aria-label="entregue" /> : null}
                </span>
              </div>
              {message.de === "ia" && !message.aviso ? (
                <div className="wa-test-message-meta">
                  {message.fonte ? <span className="wa-test-source">{message.fonte}</span> : null}
                  {feedback[index] === "sim" ? (
                    <span className="wa-test-feedback-state wa-test-feedback-state--ok">✓ é isso</span>
                  ) : feedback[index] === "nao" ? (
                    <span className="wa-test-feedback-state wa-test-feedback-state--fix">corrigindo…</span>
                  ) : (
                    <span className="wa-test-feedback">
                      <button type="button" onClick={() => onAccept(index)}>É isso</button>
                      <button type="button" onClick={() => onCorrect(index)}>Corrigir</button>
                    </span>
                  )}
                </div>
              ) : null}
            </motion.div>
          ))}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {showTestRun ? (
            <motion.article
              className="wa-test-guard-event"
              data-state={testRun.error ? "error" : testRun.status}
              aria-live="polite"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.22 }}
            >
              <header>
                <span className="wa-test-guard-icon">
                  {testRun.status === "rodando" ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                </span>
                <span>
                  <small>GUARDIÃO AUTOMÁTICO</small>
                  <strong>
                    {testRun.error
                      ? "A rodada não terminou"
                      : testRun.status === "rodando"
                        ? "Tentando quebrar o agente"
                        : `${testRun.passed ?? runCases.filter((item) => item.passou).length}/${testRun.total ?? runCases.length} comportamentos protegidos`}
                  </strong>
                </span>
                <i>{testRun.status === "rodando" ? "EM CURSO" : testRun.error ? "INTERROMPIDA" : "CONCLUÍDA"}</i>
              </header>

              {testRun.error ? <p className="wa-test-guard-error">{testRun.error}</p> : null}

              {testRun.status === "rodando" ? (
                <div className="wa-test-guard-running" role="status">
                  {guardScenarios.map((scenario, index) => (
                    <span key={scenario} style={{ "--guard-delay": `${index * 160}ms` } as CSSProperties}>
                      <i /> {scenario}
                    </span>
                  ))}
                </div>
              ) : null}

              {testRun.status === "pronto" && runCases.length > 0 ? (
                <div className="wa-test-proof">
                  <div className="wa-test-proof-meta">
                    <span><Database size={11} /> {testRun.testedMode === "ensaio" ? "MUDANÇA NOVA" : "VERSÃO NO AR"}</span>
                    <span>{testRun.mode === "real" ? "CÉREBRO REAL" : "ROTEIRO"}</span>
                    {testRun.base ? <span>BASE {testRun.base}</span> : null}
                    {testRun.suite ? <span>SUÍTE {testRun.suite}</span> : null}
                    {testRun.durationMs != null ? <span>{(testRun.durationMs / 1000).toFixed(1)}s</span> : null}
                  </div>

                  {testRun.change ? (
                    <button type="button" className="wa-test-proof-change" onClick={onOpenChanges}>
                      <span><small>MUDANÇA SOB PROVA</small><strong>{testRun.change.intent}</strong></span>
                      <ArrowRight size={14} />
                    </button>
                  ) : null}

                  <div className="wa-test-proof-trail" aria-label="Etapas da prova">
                    <span><MessageCircle size={12} /> Ataque</span><i />
                    <span><Bot size={12} /> Resposta</span><i />
                    <span><FlaskConical size={12} /> Critérios</span><i />
                    <span><Wrench size={12} /> Ações</span><i />
                    <span><ShieldCheck size={12} /> Veredito</span>
                  </div>

                  <div className="wa-test-proof-tabs" role="tablist" aria-label="Ataques executados">
                    {runCases.map((testCase, index) => {
                      const id = testCase.caseId ?? testCase.nome;
                      return (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={id === (selectedCase?.caseId ?? selectedCase?.nome)}
                          key={id}
                          data-state={testCase.passou ? "ok" : "fail"}
                          onClick={() => setSelectedCaseId(id)}
                        >
                          <span>{testCase.passou ? <CircleCheck size={14} /> : <CircleX size={14} />}{String(index + 1).padStart(2, "0")}</span>
                          <strong>{testCase.nome}</strong>
                          {testCase.ms != null ? <time>{(testCase.ms / 1000).toFixed(1)}s</time> : null}
                        </button>
                      );
                    })}
                  </div>

                  {selectedCase ? (
                    <div className="wa-test-proof-detail" role="tabpanel">
                      <div className="wa-test-proof-dialogue">
                        <article>
                          <small>ATAQUE DO LEAD</small>
                          <p>{selectedCase.entrada?.texto || "Entrada não registrada nesta rodada."}</p>
                        </article>
                        <ArrowRight size={15} />
                        <article data-agent>
                          <small>RESPOSTA REAL DO AGENTE</small>
                          <p>{selectedCase.saida?.texto || (selectedCase.falhas?.[0] ?? "Resposta não registrada nesta rodada.")}</p>
                        </article>
                      </div>

                      <div className="wa-test-proof-bottom">
                        <section>
                          <small>CRITÉRIOS CONFERIDOS</small>
                          <div className="wa-test-proof-checks">
                            {(selectedCase.criterios ?? []).map((criterio, index) => (
                              <span key={`${criterio.tipo}-${criterio.esperado}-${index}`} data-state={criterio.passou ? "ok" : "fail"} title={criterio.falha}>
                                {criterio.passou ? <Check size={12} /> : <CircleX size={12} />}
                                <b>{criterio.rotulo}</b> {criterio.esperado}
                              </span>
                            ))}
                            {(selectedCase.criterios ?? []).length === 0 ? <em>Critérios não registrados nesta rodada.</em> : null}
                          </div>
                        </section>
                        <section>
                          <small>AÇÕES EXECUTADAS</small>
                          <div className="wa-test-proof-actions">
                            {(selectedCase.saida?.toolCalls ?? []).map((tool, index) => <span key={`${tool.tool}-${index}`}><Wrench size={11} /> {tool.tool}</span>)}
                            {selectedCase.saida?.movedStage ? <span><ArrowRight size={11} /> etapa {selectedCase.saida.movedStage}</span> : null}
                            {(selectedCase.saida?.toolCalls ?? []).length === 0 && !selectedCase.saida?.movedStage ? <em>Nenhuma ação externa necessária.</em> : null}
                          </div>
                        </section>
                      </div>

                      <footer data-state={selectedCase.passou ? "ok" : "fail"}>
                        <span>{selectedCase.passou ? <CircleCheck size={15} /> : <CircleX size={15} />}<strong>{selectedCase.passou ? "Comportamento protegido" : "Comportamento vulnerável"}</strong></span>
                        {!selectedCase.passou ? <button type="button" onClick={() => onFixCase(selectedCase)}>Corrigir esta falha</button> : <span className="wa-test-proof-safe">pode seguir</span>}
                      </footer>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {testRun.status === "pronto" && runCases.length === 0 ? (
                <p className="wa-test-guard-note">Roteiro base conferido. Com o cérebro ligado, esta mesma rodada ataca as respostas reais.</p>
              ) : testRun.mode === "roteiro" ? (
                <p className="wa-test-guard-note">Conferido no roteiro. Com o cérebro ligado, a mesma rodada vira ataque real.</p>
              ) : null}
            </motion.article>
          ) : null}
        </AnimatePresence>

        {thinking ? (
          <div className="wa-test-typing" role="status" aria-label={`${agentName} está respondendo`}>
            <span /> <span /> <span />
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <footer className="wa-test-composer">
        <span className="wa-test-compose-icon" aria-hidden="true"><Smile size={18} /></span>
        <div className="wa-test-input-shell">
          <input
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSubmit();
              }
            }}
            placeholder="Mensagem"
            aria-label="Mensagem do lead"
          />
          <span aria-hidden="true"><Paperclip size={17} /><Camera size={17} /></span>
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!input.trim() || thinking}
          aria-label="Enviar mensagem de teste"
        >
          <SendHorizontal size={16} />
          <span>Enviar</span>
        </button>
      </footer>
    </motion.section>
  );
}
