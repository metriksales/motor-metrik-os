import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, Camera, CheckCheck, Mic, MoreVertical, Paperclip, Phone, Smile, Video } from "lucide-react";

export type TestPhoneMessage = {
  de: "voce" | "ia";
  texto: string;
  fonte?: string | null;
  aviso?: boolean;
};

type WhatsAppTestPhoneProps = {
  agentName: string;
  modeLabel: string;
  messages: TestPhoneMessage[];
  feedback: Record<number, "sim" | "nao">;
  thinking: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onAccept: (index: number) => void;
  onCorrect: (index: number) => void;
};

export function WhatsAppTestPhone({
  agentName,
  modeLabel,
  messages,
  feedback,
  thinking,
  input,
  onInputChange,
  onSubmit,
  onAccept,
  onCorrect,
}: WhatsAppTestPhoneProps) {
  const reduceMotion = useReducedMotion();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0 && !thinking) return;
    endRef.current?.scrollIntoView({ block: "end", behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages.length, reduceMotion, thinking]);

  return (
    <motion.section
      className="wa-test-device"
      aria-label={`Conversa de teste com ${agentName}`}
      initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
    >
      <div className="wa-test-hardware">
        <div className="wa-test-speaker" aria-hidden="true" />
        <div className="wa-test-screen">
          <div className="wa-test-statusbar" aria-hidden="true">
            <strong>10:13</strong>
            <span>5G&nbsp;&nbsp;▰</span>
          </div>

          <header className="wa-test-header">
            <span className="wa-test-avatar">{agentName.slice(0, 1).toUpperCase()}</span>
            <span className="wa-test-identity">
              <strong>{agentName}</strong>
              <small>{modeLabel}</small>
            </span>
            <span className="wa-test-header-actions" aria-hidden="true">
              <Video size={15} />
              <Phone size={14} />
              <MoreVertical size={15} />
            </span>
          </header>

          <div className="wa-test-conversation scroll-thin">
            <span className="wa-test-date">Hoje</span>
            {messages.length === 0 ? (
              <div className="wa-test-empty">
                <strong>Conversa isolada do CRM</strong>
                <span>Escreva como um lead escreveria. Nada daqui envia mensagem de verdade.</span>
              </div>
            ) : null}

            <AnimatePresence initial={false}>
              {messages.map((message, index) => (
                <motion.div
                  key={`${index}-${message.de}-${message.texto}`}
                  className={`wa-test-message-row wa-test-message-row--${message.de}`}
                  initial={reduceMotion ? false : { opacity: 0, y: 7, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2 }}
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

            {thinking ? (
              <div className="wa-test-typing" role="status">
                <span /> <span /> <span />
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <footer className="wa-test-composer">
            <span className="wa-test-compose-icon" aria-hidden="true"><Smile size={17} /></span>
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
              <span aria-hidden="true"><Paperclip size={16} /><Camera size={16} /></span>
            </div>
            <button
              type="button"
              onClick={onSubmit}
              disabled={!input.trim() || thinking}
              aria-label={input.trim() ? "Enviar mensagem de teste" : "Microfone indisponível no teste"}
            >
              {input.trim() ? <ArrowUp size={17} /> : <Mic size={17} />}
            </button>
          </footer>
          <div className="wa-test-homebar" aria-hidden="true"><span /></div>
        </div>
      </div>
    </motion.section>
  );
}
