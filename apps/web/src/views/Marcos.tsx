// MARCOS — degraus de progresso. Num produto onde o cliente não opera nada, o
// degrau é o que dá sensação de avanço: "10ª reunião marcada", "R$ 50 mil
// gerados". Aparece UMA vez, no momento que cruza (localStorage marca o visto),
// e some. Zero dark pattern: só marcos que aconteceram de verdade nos logs.
import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import type { StatsReais } from "../lib/live";

const MARCOS_REUNIAO = [1, 5, 10, 25, 50, 100, 250, 500];
const MARCOS_REAIS = [10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];

/** maior limiar já atingido numa lista (0 se nenhum) */
function maiorAtingido(valor: number, limiares: number[]): number {
  let m = 0;
  for (const l of limiares) if (valor >= l) m = l;
  return m;
}

function rotuloReais(reais: number): string {
  return reais >= 1000 ? `R$ ${(reais / 1000).toLocaleString("pt-BR")} mil` : `R$ ${reais.toLocaleString("pt-BR")}`;
}

export default function Marcos({ stats, orgKey }: { stats: StatsReais | null; orgKey: string }) {
  const [marco, setMarco] = useState<{ chave: string; texto: string } | null>(null);

  useEffect(() => {
    if (!stats) return;
    const reunioes = stats.reunioesTotal ?? 0;
    const reaisGerados = Math.floor((stats.valorTotalCentavos ?? 0) / 100);

    const mReuniao = maiorAtingido(reunioes, MARCOS_REUNIAO);
    const mReais = maiorAtingido(reaisGerados, MARCOS_REAIS);

    // candidatos com a chave estável (track + limiar) e o texto comemorativo
    const candidatos: { chave: string; texto: string }[] = [];
    if (mReais > 0) candidatos.push({ chave: `$:${mReais}`, texto: `${rotuloReais(mReais)} gerados desde que você ligou o Motor` });
    if (mReuniao > 0) candidatos.push({ chave: `r:${mReuniao}`, texto: mReuniao === 1 ? "1ª reunião marcada pela sua equipe 🎉" : `${mReuniao}ª reunião marcada pela sua equipe` });

    let vistos: string[] = [];
    try { vistos = JSON.parse(localStorage.getItem(`motor:marcos:${orgKey}`) || "[]"); } catch { vistos = []; }

    // mostra o mais "impressionante" ainda não visto (dinheiro > reunião)
    const novo = candidatos.find((c) => !vistos.includes(c.chave));
    if (novo) {
      setMarco(novo);
      try { localStorage.setItem(`motor:marcos:${orgKey}`, JSON.stringify([...vistos, novo.chave].slice(-24))); } catch { /* sem storage */ }
    }
  }, [stats, orgKey]);

  if (!marco) return null;

  return (
    <div className="grad-border overflow-hidden">
      <div className="relative flex items-center gap-3.5 px-5 py-3.5" style={{ background: "linear-gradient(100deg, rgba(251,191,36,.10), var(--surface))" }}>
        <span className="grid place-items-center rounded-xl flex-none" style={{ width: 38, height: 38, background: "rgba(251,191,36,.16)", border: "1px solid rgba(251,191,36,.36)" }}>
          <Trophy size={19} style={{ color: "#fbbf24" }} />
        </span>
        <div className="min-w-0">
          <div className="mono-label !text-[9px] mb-0.5" style={{ color: "#fbbf24" }}>Marco alcançado</div>
          <div className="text-[14px] text-[var(--txt)] font-medium leading-snug">{marco.texto}</div>
        </div>
      </div>
    </div>
  );
}
