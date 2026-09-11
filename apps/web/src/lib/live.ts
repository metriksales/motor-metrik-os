// A VERDADE na tela — dados REAIS do Flight Recorder (runtime_logs no Neon).
// null = ainda não há dado real (sem auth, banco vazio, erro) → a tela cai no
// demo e DIZ que é demo. É o selo Real × Demo que separa produto de maquete.
// No modo LOGADO a regra endurece: dado real SEMPRE entra (mesmo vazio) e o
// feed PULSA — refetch a cada 20s (pausado com a aba oculta) + relógio de 60s
// pros "há X min" envelhecerem sozinhos.
import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useMotorAuth } from "./auth";

export interface LogReal {
  id: string;
  agentId: string | null;
  motor: string | null;
  ok: boolean;
  resumo: string;
  did: unknown;
  erro: string | null;
  valorCentavos: number | null;
  at: string;
}

export interface StatsReais {
  execucoes: number;
  acertos: number;
  erros: number;
  taxa: number | null;
  valorCentavos: number;
  valor7dCentavos?: number;
  valor30dCentavos?: number;
  valorTotalCentavos?: number;
  ultimoValor?: { resumo: string; valorCentavos: number; at: string } | null;
  porAgente: Record<string, { execucoes: number; acertos: number }>;
}

const POLL_MS = 20_000;
const CLOCK_MS = 60_000;

export function useLive(): { logs: LogReal[] | null; stats: StatsReais | null; carregando: boolean } {
  const auth = useMotorAuth();
  const [logs, setLogs] = useState<LogReal[] | null>(null);
  const [stats, setStats] = useState<StatsReais | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [, setTick] = useState(0); // relógio: re-render pros tempos relativos
  const vivoRef = useRef(true);

  useEffect(() => {
    vivoRef.current = true;

    const buscar = async () => {
      try {
        const [l, s] = await Promise.all([
          api.listLogs(undefined, auth.getToken) as Promise<LogReal[]>,
          api.stats(auth.getToken) as Promise<StatsReais>,
        ]);
        if (!vivoRef.current) return;
        if (auth.demo) {
          // demo: só troca a maquete quando existe dado real de verdade
          if (Array.isArray(l) && l.length > 0) setLogs(l);
          if (s && typeof s.execucoes === "number" && s.execucoes > 0) setStats(s);
        } else {
          // logado: a verdade SEMPRE entra, mesmo que seja "nada ainda"
          if (Array.isArray(l)) setLogs(l);
          if (s && typeof s.execucoes === "number") setStats(s);
        }
      } catch (e) {
        // demo: segue na maquete (com selo). Logado: deixa rastro pro diagnóstico
        // (o banner de erro global vem do AgentsProvider).
        if (!auth.demo) console.error("[live] control API falhou:", e);
      } finally {
        if (vivoRef.current) setCarregando(false);
      }
    };

    buscar();
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") buscar();
    }, POLL_MS);
    const onVisivel = () => {
      if (document.visibilityState === "visible") buscar();
    };
    document.addEventListener("visibilitychange", onVisivel);
    const clock = setInterval(() => setTick((t) => t + 1), CLOCK_MS);

    return () => {
      vivoRef.current = false;
      clearInterval(poll);
      clearInterval(clock);
      document.removeEventListener("visibilitychange", onVisivel);
    };
  }, [auth.getToken, auth.demo]);

  return { logs, stats, carregando };
}

/** "há 27 min", "há 2 h", "ontem", "há 3 dias" */
export function tempoRelativo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 d" : `${d} d`;
}

/**
 * O tile de dinheiro NUNCA abre em zero: com R$ no dia mostra o dia; num dia
 * parado, o herói vira o acumulado (7d → total) e o delta vira a memória do
 * último dinheiro que a frota fez. Zero seco só quando nunca houve valor.
 */
export function kpiDinheiro(stats: StatsReais): { label: string; value: string; delta: string } {
  const dia = stats.valorCentavos ?? 0;
  const d7 = stats.valor7dCentavos ?? 0;
  const total = stats.valorTotalCentavos ?? 0;
  const u = stats.ultimoValor;
  const ultimo = u ? `último: +${reais(u.valorCentavos)} · há ${tempoRelativo(u.at)}` : "";
  if (dia > 0) return { label: "Gerado hoje", value: reais(dia), delta: d7 > dia ? `${reais(d7)} na semana` : "Radar de Dinheiro" };
  if (d7 > 0) return { label: "Gerado · 7 dias", value: reais(d7), delta: ultimo || "hoje começa agora" };
  if (total > 0) return { label: "Gerado · desde o início", value: reais(total), delta: ultimo || "hoje começa agora" };
  return { label: "Gerado hoje", value: reais(0), delta: "robôs de plantão" };
}

/** centavos → "R$ 1.500" (sem centavos quando é valor redondo) */
export function reais(centavos: number | null | undefined): string {
  const v = (centavos ?? 0) / 100;
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: v % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}
