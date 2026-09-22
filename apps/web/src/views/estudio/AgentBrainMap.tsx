import type { CSSProperties } from "react";
import { Plus } from "lucide-react";

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

export function AgentBrainMap({
  agentName,
  pieces,
  selectedId,
  onSelect,
  real,
}: {
  agentName: string;
  pieces: BrainPiece[];
  selectedId: string;
  onSelect: (id: string) => void;
  real: boolean;
}) {
  const active = pieces.filter((piece) => piece.estado !== "off");
  const available = pieces.filter((piece) => piece.estado === "off");

  return (
    <section className="est-brain" aria-labelledby="agent-path-title">
      <header className="est-brain-head">
        <div>
          <div className="emo est-kicker">MOTOR · {agentName.toUpperCase()}</div>
          <h2 id="agent-path-title">O circuito que faz o agente agir</h2>
          <p>A energia passa por estas peças, nesta ordem. Toque em um nó para abrir o que acontece dentro dele.</p>
        </div>
        <div className="est-brain-count" aria-label={`${active.length} peças no ar`}>
          <b>{active.length}</b>
          <span>{active.length === 1 ? "peça trabalhando" : "peças trabalhando"}</span>
        </div>
      </header>

      <div className="est-path" role="list" aria-label="Peças que trabalham neste agente">
        {active.map((piece, index) => (
          <div className="est-path-item" role="listitem" key={piece.id}>
            {piece.cond && <span className="emo est-path-condition">{piece.cond}</span>}
            <button
              type="button"
              aria-pressed={selectedId === piece.id}
              onClick={() => onSelect(piece.id)}
              className="est-path-node"
              data-selected={selectedId === piece.id ? "true" : "false"}
            >
              <span className="est-path-orb" style={{ "--piece-color": piece.cor } as CSSProperties}>
                <span className="emo est-path-step">{String(index + 1).padStart(2, "0")}</span>
                <span className="est-path-glyph" aria-hidden="true">{piece.glifo}</span>
                <i aria-hidden="true" />
              </span>
              <span className="est-path-copy">
                <span className="est-path-title">{piece.nome}</span>
                <span className="est-path-summary">{piece.resumo}</span>
                {piece.meta && <span className="emo est-path-meta">{piece.meta}</span>}
                <span className="emo est-path-state">{piece.estado === "nucleo" ? "núcleo" : "no ar"}</span>
              </span>
            </button>
            {index < active.length - 1 && <span className="est-path-connector" aria-hidden="true"><i /></span>}
          </div>
        ))}

        {real && active.length === 1 && available.length === 0 && (
          <div className="est-path-item est-path-next" role="listitem" aria-label="Próxima peça">
            <span className="est-path-condition emo">depois →</span>
            <div className="est-path-node est-path-node-ghost">
              <span className="est-path-orb est-path-orb-ghost"><Plus size={20} /></span>
              <span className="est-path-copy">
                <span className="est-path-title">Próxima peça</span>
                <span className="est-path-summary">Follow-up, agenda ou outro trabalho entra aqui quando for ligado.</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {available.length > 0 && (
        <div className="est-available">
          <span className="emo">PODE LIGAR</span>
          <div>
            {available.map((piece) => (
              <button type="button" key={piece.id} onClick={() => onSelect(piece.id)} aria-pressed={selectedId === piece.id}>
                <Plus size={13} /> {piece.nome}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
