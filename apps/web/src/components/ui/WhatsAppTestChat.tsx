import { useEffect, useRef, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Camera, CheckCheck, CircleCheck, CircleX, Loader2, MoreVertical, Paperclip, Phone, SendHorizontal, ShieldCheck, Smile, Video } from "lucide-react";

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
};

export type TestRunView = {
  status: "idle" | "rodando" | "pronto";
  passed?: number;
  total?: number;
  cases?: TestRunCase[];
  mode?: string;
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
}: WhatsAppTestChatProps) {
  const reduceMotion = useReducedMotion();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0 && !thinking && testRun.status === "idle" && !testRun.error) return;
    endRef.current?.scrollIntoView({ block: "end", behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages.length, reduceMotion, testRun.cases?.length, testRun.error, testRun.status, thinking]);

  const showTestRun = testRun.status !== "idle" || Boolean(testRun.error);
  const runCases = testRun.cases ?? [];
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
                        : `${testRun.passed ?? runCases.filter((item) => item.passou).length}/${testRun.total ?? runCases.length} travas de pé`}
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
                <div className="wa-test-guard-cases">
                  {runCases.map((testCase) => (
                    <div key={testCase.caseId ?? testCase.nome} data-state={testCase.passou ? "ok" : "fail"}>
                      {testCase.passou ? <CircleCheck size={15} /> : <CircleX size={15} />}
                      <span><strong>{testCase.nome}</strong>{testCase.falhas?.[0] ? <small>{testCase.falhas[0]}</small> : null}</span>
                      {testCase.ms != null ? <time>{(testCase.ms / 1000).toFixed(1)}s</time> : null}
                      {!testCase.passou ? <button type="button" onClick={() => onFixCase(testCase)}>Corrigir</button> : null}
                    </div>
                  ))}
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
