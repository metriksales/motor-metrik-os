import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, LogOut } from "lucide-react";
import { useMotorAuth } from "../lib/auth";

/**
 * Seletor de conta (S-045) — o que era o OrganizationSwitcher do Clerk.
 * Quem acessa várias contas (implementador) troca por aqui; quem só tem uma vê
 * o nome dela. A troca acontece na SESSÃO, no servidor.
 */
export function SeletorDeConta({ compacto }: { compacto?: boolean }) {
  const auth = useMotorAuth();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const varias = auth.contas.length > 1;

  if (compacto) {
    return (
      <span className="app-org-avatar" title={auth.orgName}>
        {auth.orgInitial}
      </span>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        className="app-org-card w-full"
        onClick={() => varias && setAberto((v) => !v)}
        aria-haspopup={varias ? "listbox" : undefined}
        aria-expanded={varias ? aberto : undefined}
        title={varias ? "Trocar de conta" : auth.orgName}
      >
        <span className="app-org-avatar">{auth.orgInitial}</span>
        <span className="app-org-copy">
          <strong>{auth.orgName}</strong>
          <small>{auth.orgDesc}</small>
        </span>
        {varias && <ChevronsUpDown size={14} aria-hidden="true" />}
      </button>

      {aberto && (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 card p-1.5 shadow-xl"
          style={{ background: "var(--surface)" }}
        >
          <div className="mono-label px-2 py-1">suas contas</div>
          {auth.contas.map((c) => (
            <button
              key={c.orgId}
              role="option"
              aria-selected={c.orgId === auth.orgId}
              onClick={() => {
                setAberto(false);
                if (c.orgId !== auth.orgId) void auth.trocarConta(c.orgId);
              }}
              className="w-full text-left rounded-lg px-2 py-2 hover:bg-[var(--surface-2)] flex items-center gap-2"
            >
              <span className="app-org-avatar" style={{ width: 22, height: 22, fontSize: 11 }}>
                {c.nome.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] truncate">{c.nome}</span>
                <span className="block text-[11px] text-[var(--txt-4)]">{c.role}</span>
              </span>
              {c.orgId === auth.orgId && <Check size={14} style={{ color: "var(--emerald)" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Menu da pessoa — o que era o UserButton do Clerk. */
export function MenuDaPessoa() {
  const auth = useMotorAuth();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const inicial = (auth.email ?? "?").slice(0, 1).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAberto((v) => !v)}
        className="app-org-avatar"
        style={{ width: 30, height: 30 }}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label="Sua conta"
        title={auth.email}
      >
        {inicial}
      </button>

      {aberto && (
        <div role="menu" className="absolute right-0 z-50 mt-1 card p-1.5 shadow-xl min-w-[220px]" style={{ background: "var(--surface)" }}>
          <div className="px-2 py-1.5">
            <div className="text-[13px] truncate">{auth.email}</div>
            <div className="text-[11px] text-[var(--txt-4)]">{auth.role}</div>
          </div>
          <div className="border-t border-[var(--line)] my-1" />
          <button
            role="menuitem"
            onClick={() => void auth.sair()}
            className="w-full text-left rounded-lg px-2 py-2 hover:bg-[var(--surface-2)] flex items-center gap-2 text-[13px]"
          >
            <LogOut size={14} /> Sair
          </button>
        </div>
      )}
    </div>
  );
}
