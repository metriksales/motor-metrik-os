// DRAWER DA CONVERSA — o cliente clica numa linha do Ao Vivo e LÊ o que a IA
// disse pro lead dele. É o vício de observação: "vê a conversa que a Bia teve
// com a Dona Cléia de madrugada". Leitura pura, zero botão de ação.
// A conversa vem do campo `did` do log (a Bia espelha turnoLead/respostaIA).
import { AnimatePresence, motion } from "framer-motion";
import { X, CheckCheck, Wrench, Mic } from "lucide-react";
import type { LogReal } from "../lib/live";
import { reais, tempoRelativo } from "../lib/live";

type Conversa = { contato?: string; lead?: string; ia?: string; tools?: string[]; voz?: boolean };

export type ConversaAberta =
  | { tipo: "real"; log: LogReal; agente: string; cor: string }
  | { tipo: "demo"; agente: string; cor: string };

const DEMO: Conversa = {
  contato: "Marina",
  lead: "Oi! Vi o anúncio de vocês. Como funciona a implantação do CRM com IA?",
  ia: "Oi Marina 😊 A gente instala e opera a IA pra você — ela atende, qualifica e agenda sozinha. Pra eu te explicar certinho: qual o tamanho do seu time comercial hoje?",
  tools: ["moverEtapa"],
};

export default function ConversaDrawer({ aberta, onClose }: { aberta: ConversaAberta | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {aberta && (
        <motion.div
          className="fixed inset-0 z-50 flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <motion.aside
            className="relative h-full w-full max-w-[440px] glass border-l border-[var(--line)] flex flex-col"
            initial={{ x: 40 }}
            animate={{ x: 0 }}
            exit={{ x: 40 }}
            transition={{ duration: 0.24, ease: [0.2, 0.7, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <Corpo aberta={aberta} onClose={onClose} />
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Corpo({ aberta, onClose }: { aberta: ConversaAberta; onClose: () => void }) {
  const conversa: Conversa = aberta.tipo === "demo" ? DEMO : ((aberta.log.did ?? {}) as Conversa);
  const temConversa = !!(conversa.lead || conversa.ia);
  const contato = conversa.contato || (aberta.tipo === "real" ? "lead" : "Marina");
  const quando = aberta.tipo === "real" ? `há ${tempoRelativo(aberta.log.at)}` : "agora";
  const valor = aberta.tipo === "real" ? aberta.log.valorCentavos : null;

  return (
    <>
      {/* cabeçalho */}
      <div className="flex-none flex items-center gap-3 px-5 h-[62px] border-b border-[var(--line)]">
        <span className="grid place-items-center rounded-[11px] flex-none" style={{ width: 34, height: 34, background: `${aberta.cor}18`, border: `1px solid ${aberta.cor}30`, color: aberta.cor, fontWeight: 700 }}>
          {contato.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display font-semibold text-[14.5px] truncate">{contato}</div>
          <div className="text-[11.5px] text-[var(--txt-3)]">{aberta.agente} · {quando}</div>
        </div>
        {(valor ?? 0) > 0 && (
          <span className="flex-none text-[12px] font-semibold px-2 py-0.5 rounded-full" style={{ color: "var(--emerald)", background: "rgba(52,211,153,.12)", border: "1px solid rgba(52,211,153,.3)" }}>
            +{reais(valor)}
          </span>
        )}
        <button onClick={onClose} className="btn btn-sm !px-2 flex-none" aria-label="Fechar"><X size={16} /></button>
      </div>

      {/* corpo: a conversa como no WhatsApp */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin px-5 py-5 space-y-3">
        <div className="text-center">
          <span className="mono-label !text-[9px]">a conversa que a IA teve</span>
        </div>

        {temConversa ? (
          <>
            {conversa.lead && (
              <div className="flex">
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-3.5 py-2.5" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                  <p className="text-[13.5px] text-[var(--txt)] leading-relaxed">{conversa.lead}</p>
                  <div className="text-[10px] text-[var(--txt-4)] mt-1">{contato}</div>
                </div>
              </div>
            )}
            {conversa.ia && (
              <div className="flex justify-end">
                <div className="wa-bubble max-w-[85%]">
                  {conversa.voz && (
                    <div className="flex items-center gap-1.5 mb-1 text-[11px]" style={{ color: "rgba(233,237,239,.7)" }}>
                      <Mic size={11} /> respondeu por áudio
                    </div>
                  )}
                  <p className="text-[13.5px] leading-relaxed">{conversa.ia}</p>
                  <span className="wa-meta">{aberta.agente} <CheckCheck size={13} style={{ color: "#53bdeb" }} /></span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-6 text-center">
            <p className="text-[13px] text-[var(--txt-2)] leading-relaxed">
              Essa execução não guardou o texto da conversa.
            </p>
            <p className="text-[12px] text-[var(--txt-3)] mt-1.5 leading-relaxed">
              As próximas conversas da sua IA aparecem aqui pra você ler, palavra por palavra.
            </p>
          </div>
        )}

        {conversa.tools && conversa.tools.length > 0 && (
          <div className="pt-2">
            <div className="mono-label !text-[9px] mb-2">o que ela fez no CRM</div>
            <div className="flex flex-wrap gap-1.5">
              {conversa.tools.map((t, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-[11.5px] px-2 py-1 rounded-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--txt-2)" }}>
                  <Wrench size={11} style={{ color: aberta.cor }} /> {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
