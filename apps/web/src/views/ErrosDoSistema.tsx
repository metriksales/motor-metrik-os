// ERROS DO SISTEMA — o rastreador caseiro na tela (S-012).
//
// Só aparece para quem opera a plataforma: a API responde 403 para os demais,
// e aí a seção simplesmente não existe. Qualquer outra falha aparece como
// falha — esconder um 500 seria a tela mentindo sobre o próprio rastreador.
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Bug, Check, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { useMotorAuth } from "../lib/auth";
import { tempoRelativo } from "../lib/live";
import { Reveal } from "../ui";

export interface ErroRegistrado {
  id: string;
  onde: string;
  mensagem: string;
  pilha: string | null;
  conta: string | null;
  ultimoRequestId: string | null;
  ocorrencias: number;
  primeiraEm: string;
  ultimaEm: string;
  avisadoEm: string | null;
}

type ResultadoDoTeste = { registrado: boolean; avisado: boolean; destinatarios: number; email: "resend" | "seco" };

/** "há 5 min" / "agora", para o meio de uma linha de metadados. */
function ha(iso: string): string {
  const t = tempoRelativo(iso);
  return t === "agora" ? "agora" : `há ${t}`;
}

/** A frase do resultado do erro de teste. Nunca diz "enviado" para o que não saiu. */
export function fraseDoTeste(r: ResultadoDoTeste): { texto: string; ok: boolean } {
  if (!r.registrado) return { texto: "O erro de teste não foi registrado. Veja o log do servidor.", ok: false };
  if (r.destinatarios === 0) {
    return { texto: "Erro de teste registrado. Nenhum destinatário de aviso configurado.", ok: false };
  }
  if (r.email === "seco") {
    return { texto: "Erro de teste registrado. O e-mail está em modo seco e foi só para o log do servidor.", ok: false };
  }
  return r.avisado
    ? { texto: "Erro de teste registrado. Aviso enviado por e-mail.", ok: true }
    : { texto: "Erro de teste registrado. O e-mail de aviso não saiu.", ok: false };
}

export default function ErrosDoSistema() {
  const auth = useMotorAuth();
  const [erros, setErros] = useState<ErroRegistrado[] | null>(null);
  const [permitido, setPermitido] = useState(true);
  const [falha, setFalha] = useState<string | undefined>(undefined);
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState<{ texto: string; ok: boolean } | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const lista = (await api.erros(auth.getToken)) as ErroRegistrado[];
      setErros(Array.isArray(lista) ? lista : []);
      setFalha(undefined);
    } catch (e) {
      if ((e as { status?: number }).status === 403) setPermitido(false);
      else setFalha(e instanceof Error ? e.message : "Falha ao ler os erros.");
    }
  }, [auth.getToken]);

  useEffect(() => {
    if (auth.demo) return;
    void carregar();
  }, [auth.demo, carregar]);

  if (auth.demo || !permitido) return null;

  const testar = async () => {
    setTestando(true);
    setResultado(null);
    try {
      const r = (await api.registrarErroDeTeste(auth.getToken)) as ResultadoDoTeste;
      setResultado(fraseDoTeste(r));
      await carregar();
    } catch (e) {
      setResultado({ texto: e instanceof Error ? e.message : "Falha ao registrar o erro de teste.", ok: false });
    } finally {
      setTestando(false);
    }
  };

  return (
    <Reveal delay={0.14}>
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="mono-label flex items-center gap-1.5">
            <Bug size={12} /> Erros do sistema
          </div>
          <button type="button" className="btn btn-sm" disabled={testando} onClick={() => void testar()}>
            {testando ? <Loader2 size={13} className="animate-spin" /> : <Bug size={13} />}
            {testando ? "Registrando" : "Registrar erro de teste"}
          </button>
        </div>

        {resultado && (
          <p
            className="text-[12.5px] mb-3 flex items-center gap-1.5"
            style={{ color: resultado.ok ? "var(--emerald)" : "var(--amber)" }}
            role="status"
          >
            {resultado.ok ? <Check size={12} /> : <AlertTriangle size={12} />} {resultado.texto}
          </p>
        )}
        {falha && (
          <p className="text-[12.5px] mb-3 flex items-center gap-1.5" style={{ color: "var(--rose)" }} role="alert">
            <AlertTriangle size={12} /> Não foi possível ler os erros. {falha}
          </p>
        )}

        {erros === null && !falha ? (
          <p className="text-[12.5px] text-[var(--txt-3)] flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" /> Lendo os erros
          </p>
        ) : erros && erros.length === 0 ? (
          <p className="text-[12.5px] text-[var(--txt-3)]">Nenhum erro registrado.</p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {(erros ?? []).map((e) => (
              <li key={e.id} className="py-2.5">
                <button
                  type="button"
                  className="w-full text-left"
                  aria-expanded={aberto === e.id}
                  onClick={() => setAberto((a) => (a === e.id ? null : e.id))}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-[11.5px] text-[var(--txt-3)] truncate">{e.onde}</span>
                    <span className="font-mono text-[11px] text-[var(--txt-4)] flex-none">
                      {e.ocorrencias} {e.ocorrencias === 1 ? "ocorrência" : "ocorrências"}
                    </span>
                  </div>
                  <div className="text-[13px] text-[var(--txt)] mt-0.5 break-words">{e.mensagem}</div>
                  <div className="text-[11.5px] text-[var(--txt-4)] mt-0.5">
                    Última {ha(e.ultimaEm)} · Primeira {ha(e.primeiraEm)}
                    {e.ultimoRequestId ? ` · Req ${e.ultimoRequestId.slice(0, 8)}` : ""}
                  </div>
                </button>
                {aberto === e.id && e.pilha && (
                  <pre className="mt-2 text-[11px] text-[var(--txt-3)] whitespace-pre-wrap break-words font-mono">{e.pilha}</pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Reveal>
  );
}
