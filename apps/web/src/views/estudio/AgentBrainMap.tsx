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
          <h2 id="agent-path-title">Caminho</h2>
          <span>Ordem em que {agentName} trabalha</span>
        </div>
        <p><b>{active.length}</b> {active.length === 1 ? "ativa" : "ativas"}</p>
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
              <span className="est-step-node" aria-hidden="true" />
              <span className="est-module-body">
                <span className="est-module-topline">
                  <span>{piece.estado === "nucleo" ? "Núcleo" : "Módulo"}</span>
                  <span className="est-module-live"><i />{piece.estado === "nucleo" || piece.estado === "no ar" ? "No ar" : "Disponível"}</span>
                </span>
                <strong><span style={{ color: piece.cor }} aria-hidden="true">{piece.glifo}</span>{piece.nome}</strong>
                <small>{piece.resumo}</small>
                <span className="est-module-footer">
                  <span>{piece.meta ?? "configurada"}</span>
                  <i aria-hidden="true">→</i>
                </span>
              </span>
            </button>
          </div>
        ))}

        {real && active.length === 1 && available.length === 0 && (
          <div className="est-path-item est-path-next" role="listitem" aria-label="Próxima peça">
            <div className="est-path-connector" aria-hidden="true"><i /><span className="emo">depois</span></div>
            <div className="est-module-card est-module-card-ghost">
              <span className="est-step-node" aria-hidden="true" />
              <span className="est-module-body">
                <span className="est-module-add"><Plus size={14} /> Ligar próxima peça</span>
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
