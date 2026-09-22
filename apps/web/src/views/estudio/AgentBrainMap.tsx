import {
  Blocks,
  BookOpenText,
  Braces,
  CalendarCheck2,
  ContactRound,
  ScanLine,
  TimerReset,
  type LucideIcon,
} from "lucide-react";

export type BrainPiece = {
  id: string;
  nome: string;
  glifo: string;
  cor: string;
  estado: "nucleo" | "no ar" | "off";
  resumo: string;
  meta?: string;
  cond?: string;
};

function iconFor(piece: BrainPiece): LucideIcon {
  const key = `${piece.id} ${piece.nome}`.toLowerCase();
  if (piece.id === "conversa") return Braces;
  if (/follow/.test(key)) return TimerReset;
  if (/base|conhecimento|biblioteca/.test(key)) return BookOpenText;
  if (/crm|campo|card|lead/.test(key)) return ContactRound;
  if (/agenda|calend/.test(key)) return CalendarCheck2;
  if (/áudio|audio|imagem|pdf|mídia|midia/.test(key)) return ScanLine;
  return Blocks;
}

export function AgentBrainMap({
  agentName,
  pieces,
  selectedId,
  onSelect,
  contextLabel,
}: {
  agentName: string;
  pieces: BrainPiece[];
  selectedId: string;
  onSelect: (id: string) => void;
  contextLabel?: string;
}) {
  const active = pieces.filter((piece) => piece.estado !== "off");

  return (
    <section className="est-brain" aria-labelledby="agent-features-title">
      <header className="est-brain-head">
        <div>
          <h2 id="agent-features-title">Recursos</h2>
          <span>{contextLabel ?? `O que faz parte de ${agentName}`}</span>
        </div>
      </header>

      <div className="est-feature-list" role="list" aria-label={`Recursos ativos de ${agentName}`}>
        {active.map((piece) => {
          const Icon = iconFor(piece);
          const descriptionId = `agent-feature-${piece.id.replace(/[^a-z0-9_-]/gi, "-")}`;
          return (
            <div role="listitem" key={piece.id}>
              <button
                type="button"
                aria-pressed={selectedId === piece.id}
                aria-describedby={descriptionId}
                onClick={() => onSelect(piece.id)}
                className="est-feature-item"
                data-selected={selectedId === piece.id ? "true" : "false"}
              >
                <span className="est-feature-icon" style={{ color: piece.cor }} aria-hidden="true"><Icon size={16} strokeWidth={1.8} /></span>
                <span className="est-feature-copy">
                  <strong>{piece.nome}</strong>
                  <small id={descriptionId}>{piece.resumo}</small>
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
