// FECHAMENTO DO DIA — o recibo da operação, desenhado pra ser PRINTADO e
// mandado no grupo do escritório ("olha o que meus robôs fizeram hoje").
// Leitura pura, zero botão (respeita a lei). Marca d'água discreta faz o print
// responder sozinho "que sistema é esse?". Dados reais do Flight Recorder;
// num dia zerado troca pra janela da semana — nunca mostra um zero seco.
import { Gauge, Trophy } from "lucide-react";
import type { LogReal, StatsReais } from "../lib/live";
import { reais, tempoRelativo } from "../lib/live";

function hojePorExtenso(): string {
  const s = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** o melhor momento do dia: o log de maior valor (reunião marcada etc.). */
function melhorMomento(logs: LogReal[]): LogReal | null {
  const comValor = logs.filter((l) => (l.valorCentavos ?? 0) > 0);
  if (!comValor.length) return null;
  return comValor.reduce((a, b) => ((b.valorCentavos ?? 0) > (a.valorCentavos ?? 0) ? b : a));
}

export default function FechamentoDia({
  stats,
  logs,
  demo,
}: {
  stats: StatsReais | null;
  logs: LogReal[] | null;
  demo: boolean;
}) {
  // valores: reais quando existem; no demo, um retrato bonito da vitrine
  const execucoes = stats ? stats.execucoes : 212;
  const acerto = stats?.taxa != null ? Math.round(stats.taxa * 100) : 99;
  const diaValor = stats ? stats.valorCentavos : 750000;
  const semanaValor = stats?.valor7dCentavos ?? (demo ? 3120000 : 0);
  // nunca abre em zero: dia parado mas semana com valor → mostra a semana
  const usaSemana = diaValor === 0 && semanaValor > 0;
  const valorMostrado = usaSemana ? semanaValor : diaValor;
  const rotuloValor = usaSemana ? "gerado na semana" : "gerado hoje";

  const melhor = melhorMomento(logs ?? []);
  const melhorTxt = melhor
    ? { resumo: melhor.resumo, valor: reais(melhor.valorCentavos), quando: `há ${tempoRelativo(melhor.at)}` }
    : demo
      ? { resumo: "reunião marcada com Thiago", valor: "R$ 1.500", quando: "14h32" }
      : null;

  return (
    <div className="grad-border overflow-hidden">
      <div className="relative p-6 md:p-7" style={{ background: "var(--bg-2)" }}>
        <div className="aurora !h-[55%] !opacity-25" />
        <div className="relative">
          {/* cabeçalho do recibo */}
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="mono-label">Fechamento · {hojePorExtenso()}</div>
            <div className="flex items-center gap-1.5 text-[var(--txt-3)]">
              <Gauge size={13} style={{ color: "#8b7cff" }} />
              <span className="mono-label !text-[9px]">Motor Metrik OS</span>
            </div>
          </div>

          {/* os três números grandes */}
          <div className="grid grid-cols-3 gap-4">
            <Numero valor={String(execucoes)} rotulo={execucoes === 1 ? "atendimento" : "atendimentos"} />
            <Numero valor={`${acerto}%`} rotulo="de acerto" cor="#34d399" />
            <Numero valor={reais(valorMostrado)} rotulo={rotuloValor} cor="#8b7cff" />
          </div>

          {/* melhor momento do dia */}
          {melhorTxt && (
            <div className="mt-6 flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "rgba(52,211,153,.07)", border: "1px solid rgba(52,211,153,.22)" }}>
              <span className="grid place-items-center rounded-lg flex-none" style={{ width: 34, height: 34, background: "rgba(52,211,153,.14)", border: "1px solid rgba(52,211,153,.3)" }}>
                <Trophy size={16} style={{ color: "#34d399" }} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="mono-label !text-[9px] mb-0.5" style={{ color: "#34d399" }}>melhor momento do dia</div>
                <div className="text-[13.5px] text-[var(--txt)] truncate">
                  {melhorTxt.resumo} <span className="text-[var(--txt-4)]">· {melhorTxt.quando}</span>
                </div>
              </div>
              <span className="flex-none font-display font-semibold text-[15px]" style={{ color: "#34d399" }}>+{melhorTxt.valor}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Numero({ valor, rotulo, cor }: { valor: string; rotulo: string; cor?: string }) {
  return (
    <div>
      <div className="num text-[27px] md:text-[32px] leading-none" style={cor ? { color: cor } : undefined}>{valor}</div>
      <div className="text-[11.5px] text-[var(--txt-3)] mt-1.5 leading-snug">{rotulo}</div>
    </div>
  );
}
