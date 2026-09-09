// A VERDADE na tela — dados REAIS do Flight Recorder (runtime_logs no Neon).
// null = ainda não há dado real (sem auth, banco vazio, erro) → a tela cai no
// demo e DIZ que é demo. É o selo Real × Demo que separa produto de maquete.
import { useEffect, useState } from "react";
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
  porAgente: Record<string, { execucoes: number; acertos: number }>;
}

export function useLive(): { logs: LogReal[] | null; stats: StatsReais | null; carregando: boolean } {
  const auth = useMotorAuth();
  const [logs, setLogs] = useState<LogReal[] | null>(null);
  const [stats, setStats] = useState<StatsReais | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [l, s] = await Promise.all([
          api.listLogs(undefined, auth.getToken) as Promise<LogReal[]>,
          api.stats(auth.getToken) as Promise<StatsReais>,
        ]);
        if (!vivo) return;
        if (Array.isArray(l) && l.length > 0) setLogs(l);
        if (s && typeof s.execucoes === "number" && s.execucoes > 0) setStats(s);
      } catch {
        // sem auth / sem API → segue no demo (com selo de demo)
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [auth.getToken]);

  return { logs, stats, carregando };
}

/** "agora" / "12 min" / "3 h" a partir de um ISO. */
export function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}

/** centavos → "R$ 1.500" */
export function reais(centavos: number): string {
  return `R$ ${(centavos / 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}
