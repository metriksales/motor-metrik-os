import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, FileText, Image as ImageIcon, Mic, Paperclip, Plus, ShieldCheck, X } from "lucide-react";

export type ComposerAttachment = {
  id: string;
  file: File;
  preview: string | null;
  content?: string;
};

export type ComposerPaste = {
  id: string;
  content: string;
};

export type ComposerPayload = {
  message: string;
  files: ComposerAttachment[];
  pastedContent: ComposerPaste[];
};

type ClaudeStyleComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: (payload: ComposerPayload) => void;
  onVoice: () => void;
  isRecording: boolean;
  voiceError?: string | null;
  placeholder: string;
  disabled?: boolean;
};

const TEXT_FILE = /^(text\/)|\/(json|xml|javascript)$|\.(md|txt|csv|json|yaml|yml)$/i;

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ClaudeStyleComposer({
  value,
  onChange,
  onSend,
  onVoice,
  isRecording,
  voiceError,
  placeholder,
  disabled = false,
}: ClaudeStyleComposerProps) {
  const [files, setFiles] = useState<ComposerAttachment[]>([]);
  const [pastedContent, setPastedContent] = useState<ComposerPaste[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrls = useRef(new Set<string>());

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
  }, [value]);

  useEffect(() => () => {
    for (const url of previewUrls.current) URL.revokeObjectURL(url);
    previewUrls.current.clear();
  }, []);

  const addFiles = useCallback(async (incoming: FileList | File[]) => {
    const next = await Promise.all(Array.from(incoming).slice(0, 8).map(async (file) => {
      const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      if (preview) previewUrls.current.add(preview);
      const content = TEXT_FILE.test(file.type) || TEXT_FILE.test(file.name)
        ? await file.text().catch(() => undefined)
        : undefined;
      return { id: makeId(), file, preview, content } satisfies ComposerAttachment;
    }));
    setFiles((current) => {
      const combined = [...current, ...next];
      const kept = combined.slice(0, 8);
      for (const discarded of combined.slice(8)) {
        if (discarded.preview) {
          URL.revokeObjectURL(discarded.preview);
          previewUrls.current.delete(discarded.preview);
        }
      }
      return kept;
    });
  }, []);

  const removeFile = (id: string) => {
    setFiles((current) => {
      const target = current.find((item) => item.id === id);
      if (target?.preview) {
        URL.revokeObjectURL(target.preview);
        previewUrls.current.delete(target.preview);
      }
      return current.filter((item) => item.id !== id);
    });
  };

  const clearAttachments = () => {
    for (const file of files) {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
        previewUrls.current.delete(file.preview);
      }
    }
    setFiles([]);
    setPastedContent([]);
  };

  const submit = () => {
    const message = value.trim();
    if (disabled || (!message && files.length === 0 && pastedContent.length === 0)) return;
    onSend({ message, files, pastedContent });
    clearAttachments();
  };

  return (
    <div
      className={`claude-composer${isDragging ? " claude-composer--dragging" : ""}`}
      onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        if (event.dataTransfer.files.length) void addFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="sr-only"
        aria-label="Anexar arquivos de contexto"
        multiple
        accept="image/*,.pdf,.txt,.md,.csv,.json,.yaml,.yml"
        onChange={(event) => {
          if (event.target.files?.length) void addFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {(files.length > 0 || pastedContent.length > 0) ? (
        <div className="claude-composer-assets" aria-label="Conteúdo anexado">
          {files.map((attachment) => (
            <article className="claude-attachment" key={attachment.id}>
              {attachment.preview ? (
                <img src={attachment.preview} alt="" />
              ) : (
                <span className="claude-attachment-icon">
                  {attachment.file.type.startsWith("image/") ? <ImageIcon size={15} /> : <FileText size={15} />}
                </span>
              )}
              <span className="claude-attachment-copy">
                <strong title={attachment.file.name}>{attachment.file.name}</strong>
                <small>{formatFileSize(attachment.file.size)}</small>
              </span>
              <button type="button" onClick={() => removeFile(attachment.id)} aria-label={`Remover ${attachment.file.name}`}>
                <X size={12} />
              </button>
            </article>
          ))}
          {pastedContent.map((paste) => (
            <article className="claude-paste" key={paste.id}>
              <p>{paste.content}</p>
              <span>texto colado · {paste.content.length} caracteres</span>
              <button type="button" onClick={() => setPastedContent((items) => items.filter((item) => item.id !== paste.id))} aria-label="Remover texto colado">
                <X size={12} />
              </button>
            </article>
          ))}
        </div>
      ) : null}

      <div className="claude-composer-input">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onPaste={(event) => {
            const content = event.clipboardData.getData("text/plain");
            if (content.length < 300) return;
            event.preventDefault();
            setPastedContent((items) => [...items, { id: makeId(), content }]);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          aria-label="Descreva a mudança"
        />
      </div>

      <div className="claude-composer-toolbar">
        <button type="button" className="claude-tool-button" onClick={() => fileInputRef.current?.click()} aria-label="Adicionar arquivo" title="Adicionar arquivo">
          <Plus size={16} />
        </button>
        <button type="button" className="claude-tool-button" onClick={() => fileInputRef.current?.click()} aria-label="Anexar contexto" title="Anexar contexto">
          <Paperclip size={15} />
          <span>Contexto</span>
        </button>
        <button type="button" className={`claude-tool-button${isRecording ? " is-recording" : ""}`} onClick={onVoice} aria-label={isRecording ? "Parar de gravar" : "Falar em vez de escrever"}>
          <Mic size={15} />
          <span>{isRecording ? "Ouvindo" : "Voz"}</span>
        </button>
        <span className="claude-composer-safe" title="Toda mudança passa pelo ensaio antes de ir ao ar">
          <ShieldCheck size={13} /> Ensaio seguro
        </span>
        <button
          type="button"
          className="claude-send-button"
          onClick={submit}
          disabled={disabled || (!value.trim() && files.length === 0 && pastedContent.length === 0)}
          aria-label="Enviar mudança"
        >
          <ArrowUp size={16} />
        </button>
      </div>

      {voiceError ? <p className="claude-composer-error" role="status">{voiceError}</p> : null}
      {isDragging ? <div className="claude-composer-drop">Solte para adicionar ao contexto</div> : null}
    </div>
  );
}
