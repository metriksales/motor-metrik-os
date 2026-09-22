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
        <div className="emo est-kicker">PEÇAS · {agentName.toUpperCase()}</div>
        <h2 id="agent-path-title">Caminho do agente</h2>
        <p>Os módulos trabalham nesta ordem. Abra uma peça para ver como ela funciona.</p>
        <div className="est-brain-count" role="status" aria-label={`${active.length} peças no ar`}>
          <b>{active.length}</b>
          <span>{active.length === 1 ? "ativa" : "ativas"}</span>
        </div>
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
              <span className="est-module-top">
                <span className="emo est-module-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="est-module-icon" style={{ color: piece.cor }} aria-hidden="true">{piece.glifo}</span>
                <span className="emo est-module-state" data-state={piece.estado}>{piece.estado === "nucleo" ? "núcleo" : "no ar"}</span>
              </span>
              <strong>{piece.nome}</strong>
              <span className="est-module-summary">{piece.resumo}</span>
              <span className="est-module-footer">
                <span className="emo">{piece.meta ?? "configurada"}</span>
                <i aria-hidden="true">→</i>
              </span>
            </button>
          </div>
        ))}

        {real && active.length === 1 && available.length === 0 && (
          <div className="est-path-item est-path-next" role="listitem" aria-label="Próxima peça">
            <div className="est-path-connector" aria-hidden="true"><i /><span className="emo">depois</span></div>
            <div className="est-module-card est-module-card-ghost">
              <span className="est-module-top">
                <span className="emo est-module-index">02</span>
                <span className="est-module-icon"><Plus size={16} /></span>
              </span>
              <strong>Próxima peça</strong>
              <span className="est-module-summary">Follow-up, agenda ou outro módulo entra neste espaço quando for ligado.</span>
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
