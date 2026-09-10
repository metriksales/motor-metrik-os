// O PROCESSO do agente — uma LEITURA, não um painel. ZERO botões aqui: o
// cliente lê de cima a baixo e entende (1) como o produto dele funciona hoje,
// (2) o que mudou por último e onde encaixou, (3) o que está ligado.
// Ação mora no Turbinar e no Melhorar — aqui é só clareza.
// O conteúdo é lido do cérebro do agente — mudou o cérebro, muda aqui sozinho.
import { type ReactNode } from "react";
import { Check, Sparkles, UserRound } from "lucide-react";
import { type Agent, type Ramo, type Regra } from "../data";
import { Reveal } from "../ui";

function listar(itens: string[]): string {
  if (itens.length === 1) return itens[0];
  return itens.slice(0, -1).join(", ") + " e " + itens[itens.length - 1];
}

/** fecha a frase sem duplicar pontuação ("…em dia?" não vira "…em dia?.") */
function frase(s: string): string {
  return /[.?!…]$/.test(s.trim()) ? s : s + ".";
}

export default function MapaTab({ agent }: { agent: Agent }) {
  const mapa = agent.mapa!;
  const mudancas = mapa.ramos.flatMap((r) =>
    r.regras.filter((rg) => rg.mudou).map((rg) => ({ ramo: r, regra: rg }))
  );
  const ligadas = agent.features.filter((f) => f.on);
  const desligadas = agent.features.filter((f) => !f.on);

  return (
    <div className="space-y-4">
      {/* ── O processo dele hoje — leitura corrida, tudo aberto ── */}
      <Reveal>
        <div className="card p-5 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="mono-label">O processo dele hoje</div>
            <span className="text-[11px] text-[var(--txt-4)] flex-none">lido do cérebro do agente · atualiza sozinho</span>
          </div>
          {agent.expectativa && (
            <p className="text-[14px] text-[var(--txt-2)] leading-relaxed mb-6 max-w-2xl">{agent.expectativa}</p>
          )}

          <ol>
            <Passo n={1} titulo="Chega" cor="#34d399">
              <p className="text-[13px] text-[var(--txt-2)] leading-relaxed">{mapa.entrada}.</p>
            </Passo>

            <Passo n={2} titulo="Ele descobre o caso" cor="#8b7cff">
              <p className="text-[13px] text-[var(--txt-2)] leading-relaxed">{mapa.triagem.faz}.</p>
              {mapa.triagem.coleta && (
                <p className="text-[12.5px] text-[var(--txt-3)] leading-relaxed mt-1">
                  {frase(`Pergunta: ${listar(mapa.triagem.coleta)}`)}
                </p>
              )}
            </Passo>

            <Passo n={3} titulo={`Cai num dos ${mapa.ramos.length} caminhos`} cor="#22d3ee" ultimo={!mapa.aposRamos}>
              <div className="space-y-4 mt-2">
                {mapa.ramos.map((r) => (
                  <Caminho key={r.id} ramo={r} />
                ))}
              </div>
            </Passo>

            {mapa.aposRamos && (
              <Passo n={4} titulo="Fim de linha" cor="#d16bff" ultimo>
                <p className="text-[13px] text-[var(--txt-2)] leading-relaxed">{mapa.aposRamos}</p>
              </Passo>
            )}
          </ol>
        </div>
      </Reveal>

      {/* ── O que mudou por último — e onde encaixou ── */}
      {mudancas.length > 0 && (
        <Reveal delay={0.05}>
          <div className="card p-5">
            <div className="mono-label flex items-center gap-1.5 mb-3">
              <Sparkles size={12} style={{ color: "#8b7cff" }} /> O que mudou por último
            </div>
            <ul className="space-y-3">
              {mudancas.map((m, i) => (
                <li key={i} className="text-[13px] text-[var(--txt-2)] leading-relaxed pl-3" style={{ borderLeft: `2px solid ${m.ramo.cor}66` }}>
                  <b className="text-[var(--txt)]">No caminho {m.ramo.nome}:</b> {m.regra.mudou}.{" "}
                  <span className="text-[var(--txt-4)]">Encaixou na situação “{m.regra.se}”.</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      )}

      {/* ── O que está ligado — só leitura; a ação mora no Turbinar ── */}
      {agent.features.length > 0 && (
        <Reveal delay={0.08}>
          <div className="card p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="mono-label">O que está ligado nele</div>
              <span className="text-[11px] text-[var(--txt-4)] flex-none">ligar e desligar é na aba Turbinar</span>
            </div>
            <ul className="space-y-2">
              {ligadas.map((f) => (
                <li key={f.name} className="flex items-center gap-2 text-[13px] text-[var(--txt-2)]">
                  <Check size={13} style={{ color: "#34d399" }} className="flex-none" /> {f.name}
                </li>
              ))}
              {desligadas.map((f) => (
                <li key={f.name} className="flex items-center gap-2 text-[13px] text-[var(--txt-4)]">
                  <span className="dot flex-none" style={{ background: "var(--txt-4)", width: 6, height: 6 }} /> {f.name} — desligado
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      )}
    </div>
  );
}

/* passo numerado — mesma linguagem visual do passo a passo que o cliente já lê */
function Passo({ n, titulo, cor, ultimo, children }: { n: number; titulo: string; cor: string; ultimo?: boolean; children: ReactNode }) {
  return (
    <li className="relative pl-11 pb-6 last:pb-0">
      {!ultimo && <span className="absolute left-[15px] top-9 bottom-0 w-px bg-[var(--line)]" />}
      <span
        className="absolute left-0 top-0 grid place-items-center rounded-full font-mono text-[12.5px]"
        style={{ width: 31, height: 31, background: `${cor}16`, border: `1px solid ${cor}30`, color: cor }}
      >
        {n}
      </span>
      <div className="font-display font-medium text-[14.5px] text-[var(--txt)] pt-1">{titulo}</div>
      <div className="mt-1.5">{children}</div>
    </li>
  );
}

/* um caminho, TODO aberto — o cliente lê como um parágrafo, não abre nada */
function Caminho({ ramo }: { ramo: Ramo }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderLeft: `3px solid ${ramo.cor}` }}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-display font-semibold text-[14px]">{ramo.nome}</span>
        <span className="text-[11px] font-mono text-[var(--txt-4)] flex-none">
          {ramo.execucoesHoje ?? 0}× hoje{ramo.ultima ? ` · ${ramo.ultima}` : ""}
        </span>
      </div>
      <p className="text-[12.5px] text-[var(--txt-3)] leading-relaxed mt-1">
        {frase(`Entra aqui quando ${ramo.quando}`)}{ramo.coleta ? ` ${frase(`Ele pergunta ${listar(ramo.coleta)}`)}` : ""}
      </p>
      <div className="mt-3.5 space-y-3.5">
        {ramo.regras.map((rg, i) => (
          <Situacao key={i} regra={rg} cor={ramo.cor} />
        ))}
      </div>
    </div>
  );
}

function Situacao({ regra, cor }: { regra: Regra; cor: string }) {
  const destino = regra.move?.replace(/^→\s*/, "");
  return (
    <div className="pl-3" style={{ borderLeft: `2px solid ${cor}40` }}>
      <p className="text-[13px] text-[var(--txt-2)] leading-relaxed">
        <b className="text-[var(--txt)]">Se {regra.se}:</b> {regra.entao}.
      </p>
      {regra.diz && (
        <p className="text-[12.5px] text-[var(--txt-3)] leading-relaxed mt-1">
          ela diz: <i className="text-[var(--txt-2)]">“{regra.diz}”</i>
        </p>
      )}
      {(destino || regra.aviso) && (
        <p className="text-[12px] text-[var(--txt-4)] mt-1">
          {destino && <>→ <b className="font-medium text-[var(--txt-3)]">{destino}</b></>}
          {destino && regra.aviso && <span className="mx-1">·</span>}
          {regra.aviso && (
            <span className="inline-flex items-center gap-1">
              <UserRound size={11} /> um humano é chamado na hora
            </span>
          )}
        </p>
      )}
    </div>
  );
}
