import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, Camera, CheckCheck, Mic, MoreVertical, Paperclip, Phone, ShieldCheck, Smile, Video } from "lucide-react";

export type TestChatMessage = {
  de: "voce" | "ia";
  texto: string;
  fonte?: string | null;
  aviso?: boolean;
};

type WhatsAppTestChatProps = {
  agentName: string;
  modeLabel: string;
  messages: TestChatMessage[];
  feedback: Record<number, "sim" | "nao">;
  thinking: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onAccept: (index: number) => void;
  onCorrect: (index: number) => void;
};

export function WhatsAppTestChat({
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
}: WhatsAppTestChatProps) {
  const reduceMotion = useReducedMotion();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0 && !thinking) return;
    endRef.current?.scrollIntoView({ block: "end", behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages.length, reduceMotion, thinking]);

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
        {messages.length === 0 ? (
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
          aria-label={input.trim() ? "Enviar mensagem de teste" : "Microfone indisponível no teste"}
        >
          {input.trim() ? <ArrowUp size={18} /> : <Mic size={18} />}
        </button>
      </footer>
    </motion.section>
  );
}
