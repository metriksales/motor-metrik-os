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
          <span>{agentName}</span>
          <h2 id="agent-path-title">Caminho</h2>
        </div>
        <p>{active.length} {active.length === 1 ? "peça ativa" : "peças ativas"}</p>
      </header>

      <div className="est-path" role="list" aria-label="Peças que trabalham neste agente">
        {active.map((piece, index) => (
          <div className="est-path-item" role="listitem" key={piece.id}>
            {index > 0 && (
              <div className="est-path-connector" aria-hidden="true">
                <i />
                <span className="emo">{piece.cond ?? "depois"}</span>
              </div>
            )}
            <button
              type="button"
              aria-pressed={selectedId === piece.id}
              onClick={() => onSelect(piece.id)}
              className="est-module-card"
              data-selected={selectedId === piece.id ? "true" : "false"}
            >
              <span className="est-module-marker" style={{ color: piece.cor }} aria-hidden="true">
                <span>{piece.glifo}</span>
              </span>
              <span className="est-module-copy">
                <strong>{piece.nome}</strong>
                <small>{piece.resumo}</small>
                {piece.meta && <em>{piece.meta}</em>}
              </span>
              <span className="est-module-dot" role="img" data-state={piece.estado} aria-label={piece.estado === "nucleo" ? "núcleo" : "no ar"} />
            </button>
          </div>
        ))}

        {real && active.length === 1 && available.length === 0 && (
          <div className="est-path-item est-path-next" role="listitem" aria-label="Próxima peça">
            <div className="est-path-connector" aria-hidden="true"><i /><span className="emo">depois</span></div>
            <div className="est-module-card est-module-card-ghost">
              <span className="est-module-marker" aria-hidden="true"><Plus size={15} /></span>
              <span className="est-module-copy">
                <strong>Próxima peça</strong>
                <small>Follow-up, agenda ou outro módulo.</small>
              </span>
            </div>
          </div>
        )}
      </div>

      {available.length > 0 && (
        <div className="est-available">
          <span className="emo">DISPONÍVEIS</span>
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
