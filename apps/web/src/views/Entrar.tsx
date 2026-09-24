import { useState } from "react";
import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { auth } from "../lib/api";

// Entrada sem senha (S-045): a pessoa digita o e-mail, recebe um código de 6
// dígitos e entra. Sem senha não há o que vazar nem o que redefinir.
export default function Entrar({ aoEntrar }: { aoEntrar: () => void }) {
  const [passo, setPasso] = useState<"email" | "codigo">("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modoSeco, setModoSeco] = useState(false);

  async function pedir(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setErro(null);
    try {
      const r = (await auth.pedirCodigo(email)) as { modoSeco?: boolean };
      setModoSeco(Boolean(r.modoSeco));
      setPasso("codigo");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "não consegui pedir o código");
    } finally {
      setOcupado(false);
    }
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setErro(null);
    try {
      await auth.entrar(email, codigo);
      aoEntrar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "não consegui entrar");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6 relative overflow-hidden">
      <div className="aurora" />
      <div className="grid-bg" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />

      <div className="card relative w-full max-w-[400px] p-7">
        <div className="mb-6">
          <div className="font-display text-[22px] font-semibold">
            <span className="grad-text">Metrik-OS</span>
          </div>
          <p className="text-[13px] text-[var(--txt-3)] mt-1">
            sua operação trabalhando sozinha — entre pra acompanhar
          </p>
        </div>

        {passo === "email" ? (
          <form onSubmit={pedir} className="space-y-3">
            <label className="block">
              <span className="mono-label">Seu e-mail</span>
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                placeholder="voce@empresa.com"
                className="input mt-1.5 w-full"
              />
            </label>
            <button type="submit" disabled={ocupado} className="btn btn-primary w-full justify-center">
              {ocupado ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
              {ocupado ? "enviando…" : "Receber código"}
            </button>
            <p className="text-[12px] text-[var(--txt-4)] leading-relaxed">
              Sem senha: mandamos um código de 6 dígitos que vale por 10 minutos. Não há senha para
              esquecer nem para vazar.
            </p>
          </form>
        ) : (
          <form onSubmit={entrar} className="space-y-3">
            <div className="flex items-center gap-2 text-[13px] text-[var(--txt-2)]">
              <MailCheck size={15} style={{ color: "var(--emerald)" }} />
              <span>
                Se <strong>{email}</strong> tiver acesso, o código chegou.
              </span>
            </div>

            {modoSeco && (
              <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-2.5 text-[12px] text-[var(--txt-3)]">
                Ambiente sem envio de e-mail configurado: o código está no log do servidor.
              </div>
            )}

            <label className="block">
              <span className="mono-label">Código</span>
              <input
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                autoFocus
                autoComplete="one-time-code"
                value={codigo}
                onChange={(ev) => setCodigo(ev.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="input mt-1.5 w-full font-mono text-[18px] tracking-[0.3em] text-center"
              />
            </label>

            <button type="submit" disabled={ocupado || codigo.length < 6} className="btn btn-primary w-full justify-center">
              {ocupado ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
              {ocupado ? "entrando…" : "Entrar"}
            </button>

            <button
              type="button"
              onClick={() => { setPasso("email"); setCodigo(""); setErro(null); }}
              className="btn btn-sm w-full justify-center !text-[var(--txt-3)]"
            >
              usar outro e-mail
            </button>
          </form>
        )}

        {erro && (
          <div className="mt-3 rounded-lg border border-[#f8514940] bg-[#f8514912] px-3 py-2 text-[12.5px]" style={{ color: "#f85149" }}>
            {erro}
          </div>
        )}
      </div>
    </div>
  );
}
