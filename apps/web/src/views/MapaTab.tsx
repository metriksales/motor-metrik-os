// O MAPA do agente — a resposta pra "como o cliente SABE o que a IA dele faz?".
// Não é desenhado à mão: é compilado do cérebro (prompt) pela fábrica e a tela
// se desenha sozinha daqui. Cliente diferente = mapa diferente, tela igual.
// Cada ramo: quando entra · o que pergunta · as regras SE→ENTÃO com a FALA
// literal da IA · pra onde move no funil · liga/desliga (zona verde) · execuções.
import { useState } from "react";
import {
  MessageCircle, Filter, ChevronDown, ArrowRight, ArrowDown, UserRound,
  Sparkles, Radio, GitBranch, Quote,
} from "lucide-react";
import { type Agent, type Ramo, type Regra } from "../data";
import { Reveal, Toggle, cx } from "../ui";

export default function MapaTab({ agent }: { agent: Agent }) {
  const mapa = agent.mapa!;
  const [ligados, setLigados] = useState<Record<string, boolean>>(
    Object.fromEntries(mapa.ramos.map((r) => [r.id, r.on]))
  );
  const [aberto, setAberto] = useState<string | null>(mapa.ramos[0]?.id ?? null);

  return (
    <div className="space-y-4">
      {/* cabeçalho do mapa */}
      <Reveal>
        <div className="card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="mono-label mb-1 flex items-center gap-1.5"><GitBranch size={12} /> O mapa deste agente</div>
            <p className="text-[13px] text-[var(--txt-2)] leading-relaxed max-w-xl">
              Isto foi <b className="text-[var(--txt)]">lido direto do cérebro dele</b> — não é um desenho à parte.
              Mudou o cérebro, o mapa muda junto. Cada ramo mostra o que a IA pergunta, a regra que aplica,
              <b className="text-[var(--txt)]"> a fala exata</b> e pra onde move no funil.
            </p>
          </div>
          <span className="pill flex-none" style={{ color: "#8b7cff" }}><Sparkles size={12} /> se desenha sozinho</span>
        </div>
      </Reveal>

      {/* espinha: entrada → triagem */}
      <Reveal delay={0.05}>
        <div className="flex flex-col items-center gap-1.5">
          <div className="card px-4 py-3 flex items-center gap-3 w-full max-w-md">
            <span className="grid place-items-center rounded-lg flex-none" style={{ width: 32, height: 32, background: "#34d39916", border: "1px solid #34d39930" }}>
              <MessageCircle size={15} style={{ color: "#34d399" }} />
            </span>
            <div className="min-w-0">
              <div className="mono-label !text-[9px]">Entrada</div>
              <div className="text-[13px]">{mapa.entrada}</div>
            </div>
          </div>
          <ArrowDown size={15} className="text-[var(--txt-4)]" />
          <div className="card px-4 py-3 w-full max-w-md">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center rounded-lg flex-none" style={{ width: 32, height: 32, background: "#8b7cff16", border: "1px solid #8b7cff30" }}>
                <Filter size={15} style={{ color: "#8b7cff" }} />
              </span>
              <div className="min-w-0">
                <div className="mono-label !text-[9px]">Triagem</div>
                <div className="text-[13px]">{mapa.triagem.faz}</div>
              </div>
            </div>
            {mapa.triagem.coleta && (
              <div className="flex flex-wrap gap-1.5 mt-2.5 pl-[44px]">
                {mapa.triagem.coleta.map((c) => (
                  <span key={c} className="text-[10.5px] px-2 py-0.5 rounded-md bg-[var(--surface-2)] border border-[var(--line)] text-[var(--txt-3)]">{c}</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[var(--txt-4)]">
            <ArrowDown size={13} /> dependendo da resposta, cai num ramo <ArrowDown size={13} />
          </div>
        </div>
      </Reveal>

      {/* os ramos */}
      <div className="grid md:grid-cols-3 gap-3 items-start">
        {mapa.ramos.map((r, i) => (
          <Reveal key={r.id} delay={0.05 * i}>
            <RamoCard
              ramo={r}
              on={ligados[r.id]}
              aberto={aberto === r.id}
              onToggle={() => setLigados((m) => ({ ...m, [r.id]: !m[r.id] }))}
              onAbrir={() => setAberto((a) => (a === r.id ? null : r.id))}
            />
          </Reveal>
        ))}
      </div>

      {/* saída */}
      {mapa.aposRamos && (
        <Reveal delay={0.1}>
          <div className="card p-4 flex items-start gap-3">
            <ArrowRight size={15} className="flex-none mt-0.5" style={{ color: "#34d399" }} />
            <p className="text-[12.5px] text-[var(--txt-2)] leading-relaxed">{mapa.aposRamos}</p>
          </div>
        </Reveal>
      )}
    </div>
  );
}

function RamoCard({ ramo, on, aberto, onToggle, onAbrir }: { ramo: Ramo; on: boolean; aberto: boolean; onToggle: () => void; onAbrir: () => void }) {
  return (
    <div className={cx("card overflow-hidden transition-opacity", !on && "opacity-55")} style={{ borderColor: `${ramo.cor}30` }}>
      {/* cabeçalho do ramo */}
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="dot flex-none" style={{ background: ramo.cor, width: 9, height: 9 }} />
            <span className="font-display font-semibold text-[14.5px] truncate">{ramo.nome}</span>
          </div>
          <button onClick={onToggle} title={on ? "desligar este ramo" : "religar este ramo"} className="flex-none">
            <Toggle on={on} />
          </button>
        </div>
        <p className="text-[11.5px] text-[var(--txt-3)] leading-snug">
          <b className="text-[var(--txt-2)]">entra quando:</b> {ramo.quando}
        </p>
        <div className="flex items-center gap-2 mt-2.5">
          {on ? (
            <span className="pill !text-[10.5px]" style={{ color: ramo.cor }}>
              <Radio size={10} /> {ramo.execucoesHoje ?? 0} hoje
            </span>
          ) : (
            <span className="pill !text-[10.5px] text-[var(--txt-4)]">desligado — religa quando quiser</span>
          )}
          {on && ramo.ultima && <span className="text-[10.5px] text-[var(--txt-4)] truncate">{ramo.ultima}</span>}
        </div>
      </div>

      {/* abrir/fechar as regras */}
      <button onClick={onAbrir} className="w-full flex items-center justify-between px-4 py-2 border-t border-[var(--line)] text-[11.5px] text-[var(--txt-3)] hover:bg-[var(--surface-2)] transition-colors">
        <span>{aberto ? "esconder as regras" : `ver as ${ramo.regras.length} regras deste ramo`}</span>
        <ChevronDown size={13} className={cx("transition-transform", aberto && "rotate-180")} />
      </button>

      {aberto && (
        <div className="px-4 pb-4 pt-1 space-y-3">
          {ramo.coleta && (
            <div>
              <div className="mono-label !text-[9px] mb-1.5">o que ele pergunta aqui</div>
              <div className="flex flex-wrap gap-1.5">
                {ramo.coleta.map((c) => (
                  <span key={c} className="text-[10.5px] px-2 py-0.5 rounded-md bg-[var(--surface-2)] border border-[var(--line)] text-[var(--txt-3)]">{c}</span>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2.5">
            {ramo.regras.map((rg, i) => (
              <RegraRow key={i} regra={rg} cor={ramo.cor} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RegraRow({ regra, cor }: { regra: Regra; cor: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="text-[12px] leading-relaxed">
        <span className="mono-label !text-[9px] mr-1.5" style={{ color: cor }}>SE</span>
        <span className="text-[var(--txt-2)]">{regra.se}</span>
      </div>
      <div className="text-[12px] leading-relaxed mt-1">
        <span className="mono-label !text-[9px] mr-1.5" style={{ color: cor }}>ENTÃO</span>
        <span className="text-[var(--txt)]">{regra.entao}</span>
      </div>
      {regra.diz && (
        <div className="flex gap-2 mt-2 rounded-lg px-2.5 py-2" style={{ background: `${cor}0d`, border: `1px solid ${cor}22` }}>
          <Quote size={12} className="flex-none mt-0.5" style={{ color: cor }} />
          <p className="text-[11.5px] italic text-[var(--txt-2)] leading-relaxed">“{regra.diz}”</p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {regra.move && (
          <span className="pill !text-[10px]"><ArrowRight size={10} /> {regra.move}</span>
        )}
        {regra.aviso && (
          <span className="pill !text-[10px]" style={{ color: "#fbbf24" }}><UserRound size={10} /> chama humano</span>
        )}
        {regra.mudou && (
          <span className="pill !text-[10px]" style={{ color: "#8b7cff" }} title={regra.mudou}>
            <Sparkles size={10} /> Escola: {regra.mudou}
          </span>
        )}
      </div>
    </div>
  );
}
