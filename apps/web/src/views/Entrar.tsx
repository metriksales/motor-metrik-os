import { useState } from "react";
import { ArrowRight, Gauge, Loader2, MailCheck, ShieldCheck, Terminal } from "lucide-react";
import { auth } from "../lib/api";

// Entrada sem senha (S-045): e-mail → código de 6 dígitos → dentro.
// Primeira tela que alguém vê do produto, então ela usa o mesmo vocabulário
// visual do app: marca, cartão com fio de luz, mono nos rótulos.
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
    <div className="auth-tela">
      <div className="aurora" />
      <div className="grid-bg" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />

      <div>
        <div className="auth-caixa">
          <div className="auth-marca">
            <span className="app-brand-mark" aria-hidden="true">
              <Gauge size={19} strokeWidth={2.2} />
            </span>
            <span className="auth-marca-copy">
              <strong className="font-display">
                Metrik<span className="grad-text">-OS</span>
              </strong>
              <small>sua operação trabalhando sozinha</small>
            </span>
          </div>

          {passo === "email" ? (
            <form onSubmit={pedir}>
              <div className="auth-titulo">Entrar</div>
              <p className="auth-sub">
                Sem senha. Você recebe um código no e-mail e entra com ele.
              </p>

              <label className="auth-campo">
                <span className="mono-label">seu e-mail</span>
                <input
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  disabled={ocupado}
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  placeholder="voce@empresa.com"
                />
              </label>

              <button type="submit" disabled={ocupado} className="btn btn-primary auth-acao">
                {ocupado ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                {ocupado ? "enviando…" : "Receber código"}
              </button>

              <div className="auth-nota">
                <ShieldCheck size={13} style={{ display: "inline", marginRight: 6, verticalAlign: -2, color: "var(--emerald)" }} />
                O código vale por 10 minutos e só funciona uma vez. Não existe senha para esquecer,
                nem para vazar.
              </div>
            </form>
          ) : (
            <form onSubmit={entrar}>
              <div className="auth-titulo">Digite o código</div>
              <p className="auth-sub">
                Se <strong style={{ color: "var(--txt-2)" }}>{email}</strong> tiver acesso, o código
                acabou de chegar.
              </p>

              {modoSeco && (
                <div className="auth-aviso">
                  <Terminal size={14} style={{ flex: "none", marginTop: 2, color: "var(--txt-3)" }} />
                  <span>
                    Este ambiente não envia e-mail: o código está no <strong>log do servidor</strong>.
                  </span>
                </div>
              )}

              <label className="auth-campo auth-codigo">
                <span className="mono-label">código de 6 dígitos</span>
                <input
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  autoFocus
                  autoComplete="one-time-code"
                  disabled={ocupado}
                  value={codigo}
                  onChange={(ev) => setCodigo(ev.target.value.replace(/\D/g, ""))}
                  placeholder="••••••"
                />
              </label>

              <button
                type="submit"
                disabled={ocupado || codigo.length < 6}
                className="btn btn-primary auth-acao"
              >
                {ocupado ? <Loader2 size={15} className="animate-spin" /> : <MailCheck size={15} />}
                {ocupado ? "entrando…" : "Entrar"}
              </button>

              <button
                type="button"
                className="auth-secundario"
                onClick={() => {
                  setPasso("email");
                  setCodigo("");
                  setErro(null);
                }}
              >
                usar outro e-mail
              </button>
            </form>
          )}

          {erro && <div className="auth-erro">{erro}</div>}
        </div>

        <div className="auth-rodape">Metrik · agentes de IA que trabalham dentro do seu CRM</div>
      </div>
    </div>
  );
}
