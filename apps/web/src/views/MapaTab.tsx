// O PROCESSO do agente — uma LEITURA, não um painel. ZERO botões: o cliente lê
// de cima a baixo e entende como o produto dele funciona HOJE. Só isso — cada
// coisa no seu lugar: mudanças moram na aba Mudanças; features no Turbinar;
// ação no Melhorar. As situações alteradas ficam marcadas com ✨ aqui.
// O conteúdo é lido do cérebro do agente — mudou o cérebro, muda aqui sozinho.
import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { Sparkles, UserRound, CheckCheck, ShieldCheck } from "lucide-react";
import { type Agent, type Mudanca, type Ramo, type Regra } from "../data";
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
  const mudancas = mapa.mudancas ?? [];

  return (
    <div className="space-y-4">
      {/* ── O processo dele hoje — leitura corrida, tudo aberto ── */}
      <Reveal>
        <div className="card p-5 md:p-7">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="mono-label">Como conversa — o caminho de todo lead</div>
            <span className="text-[11px] text-[var(--txt-4)] flex-none">a fala é literal: é o que chega pro seu cliente</span>
          </div>
          {mudancas.length > 0 && (
            <div className="flex items-center gap-1.5 text-[12.5px] mb-4" style={{ color: "#e0a44a" }}>
              <Sparkles size={13} />
              {mudancas.length === 1 ? "1 mudança recente" : `${mudancas.length} mudanças recentes`} no ar — marcadas com ✨ abaixo · a prova está em “O que mudou”, ao lado
            </div>
          )}
          {agent.expectativa && (
            <p className="text-[15.5px] text-[var(--txt)] leading-relaxed mb-7 max-w-2xl">{agent.expectativa}</p>
          )}

          <ol>
            <Passo n={1} titulo="Chega" cor="#34d399">
              <p className="text-[14px] text-[var(--txt-2)] leading-relaxed">{frase(mapa.entrada)}</p>
            </Passo>

            <Passo n={2} titulo="Ele descobre o caso" cor="#e0a44a">
              <p className="text-[14px] text-[var(--txt-2)] leading-relaxed">{frase(mapa.triagem.faz)}</p>
              {mapa.triagem.coleta && (
                <p className="text-[13px] text-[var(--txt-3)] leading-relaxed mt-1">
                  {frase(`Pergunta: ${listar(mapa.triagem.coleta)}`)}
                </p>
              )}
            </Passo>

            <Passo n={3} titulo={`Cai num dos ${mapa.ramos.length} caminhos`} cor="#58aae4" ultimo>
              <div className="space-y-4 mt-2">
                {(() => {
                  // calor: o caminho mais rodado do dia fica visualmente óbvio
                  const max = Math.max(1, ...mapa.ramos.map((r) => r.execucoesHoje ?? 0));
                  return mapa.ramos.map((r) => (
                    <Caminho key={r.id} ramo={r} mudancas={mudancas} calor={(r.execucoesHoje ?? 0) / max} />
                  ));
                })()}
              </div>
            </Passo>
          </ol>

          {mapa.aposRamos && (
            <div className="mt-5 flex items-start gap-2.5 rounded-[9px] px-3.5 py-2.5" style={{ background: "rgba(52,211,153,.05)", border: "1px solid rgba(52,211,153,.25)" }}>
              <ShieldCheck size={15} style={{ color: "#34d399" }} className="flex-none mt-0.5" />
              <p className="text-[12px] text-[var(--txt-2)] leading-relaxed m-0">{mapa.aposRamos}</p>
            </div>
          )}
        </div>
      </Reveal>

    </div>
  );
}

/* passo numerado — mesma linguagem visual do passo a passo que o cliente já lê */
function Passo({ n, titulo, cor, ultimo, children }: { n: number; titulo: string; cor: string; ultimo?: boolean; children: ReactNode }) {
  return (
    <li className="relative pl-12 pb-7 last:pb-0">
      {!ultimo && <span className="absolute left-[16px] top-10 bottom-0 w-px bg-[var(--line)]" />}
      <span
        className="absolute left-0 top-0 grid place-items-center rounded-full font-mono text-[13px]"
        style={{ width: 33, height: 33, background: `${cor}16`, border: `1px solid ${cor}30`, color: cor }}
      >
        {n}
      </span>
      <div className="font-display font-semibold text-[16px] text-[var(--txt)] pt-1">{titulo}</div>
      <div className="mt-1.5">{children}</div>
    </li>
  );
}

/* um caminho, TODO aberto — o cliente lê como um parágrafo, não abre nada */
function Caminho({ ramo, mudancas, calor }: { ramo: Ramo; mudancas: Mudanca[]; calor: number }) {
  return (
    <div className="rounded-xl p-4 md:p-5" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderLeft: `3px solid ${ramo.cor}` }}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-display font-semibold text-[15.5px]">{ramo.nome}</span>
        <span className="text-[12px] font-mono flex-none" style={{ color: ramo.cor }}>
          {ramo.execucoesHoje ?? 0}× hoje{ramo.ultima ? <span className="text-[var(--txt-4)]"> · {ramo.ultima}</span> : null}
        </span>
      </div>
      {/* barra de calor — proporcional ao movimento do dia neste caminho */}
      <div className="mt-2 h-[3px] rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
        <motion.div
          className="h-full rounded-full origin-left"
          style={{ background: ramo.cor, width: `${Math.round(calor * 100)}%` }}
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
        />
      </div>
      <p className="text-[13px] text-[var(--txt-2)] leading-relaxed mt-2">
        {frase(`Entra aqui quando ${ramo.quando}`)}
        {ramo.coleta ? ` ${frase(`Ele pergunta ${listar(ramo.coleta)}`)}` : ""}
      </p>
      <div className="mt-4 space-y-4">
        {ramo.regras.map((rg, i) => {
          const mud = mudancas.find((m) => m.ramoId === ramo.id && m.situacao === rg.se);
          return <Situacao key={i} regra={rg} cor={ramo.cor} mudanca={mud} ultima={ramo.ultima} />;
        })}
      </div>
    </div>
  );
}

function Situacao({ regra, cor, mudanca, ultima }: { regra: Regra; cor: string; mudanca?: Mudanca; ultima?: string }) {
  const destino = regra.move?.replace(/^→\s*/, "");
  return (
    <div className="pl-3.5" style={{ borderLeft: `2px solid ${cor}45` }}>
      <p className="text-[14px] text-[var(--txt-2)] leading-relaxed">
        <b className="text-[var(--txt)]">Se {regra.se}:</b> {frase(regra.entao)}
      </p>
      {regra.diz && (
        // a fala literal vira BOLHA DE WHATSAPP — o cliente reconhece na hora:
        // "é isso que ela manda pros meus clientes". Print que vende sozinho.
        <div className="mt-2 flex">
          <div className="wa-bubble max-w-[520px]">
            <p className="text-[13.5px] leading-relaxed">{regra.diz}</p>
            <span className="wa-meta">
              {ultima ?? "modelo"} <CheckCheck size={13} style={{ color: "#53bdeb" }} />
            </span>
          </div>
        </div>
      )}
      {(destino || regra.aviso || mudanca) && (
        <p className="text-[12.5px] text-[var(--txt-3)] mt-1.5">
          {destino && (
            <>
              <span style={{ color: cor }}>→</span> <b className="font-medium text-[var(--txt-2)]">{destino}</b>
            </>
          )}
          {destino && regra.aviso && <span className="mx-1.5 text-[var(--txt-4)]">·</span>}
          {regra.aviso && (
            <span className="inline-flex items-center gap-1">
              <UserRound size={12} /> um humano é chamado na hora
            </span>
          )}
          {(destino || regra.aviso) && mudanca && <span className="mx-1.5 text-[var(--txt-4)]">·</span>}
          {mudanca && (
            <span className="inline-flex items-center gap-1" style={{ color: "#e0a44a" }}>
              <Sparkles size={12} /> alterado {mudanca.quando}
            </span>
          )}
        </p>
      )}
    </div>
  );
}

