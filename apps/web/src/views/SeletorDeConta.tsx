import { useEffect, useMemo, useRef, useState, type KeyboardEvent as TeclaReact } from "react";
import { Check, ChevronsUpDown, LogOut, Search } from "lucide-react";
import { useMotorAuth, type Conta } from "../lib/auth";
import { anotarUso, escolherRecentes, filtrarContas } from "../lib/contas";

/**
 * Seletor de conta (S-045) — o que era o OrganizationSwitcher do Clerk.
 * Quem acessa várias contas (implementador) troca por aqui; quem só tem uma vê
 * o nome dela. A troca acontece na SESSÃO, no servidor.
 *
 * O painel abre PARA A DIREITA da barra lateral, como no GHL: a lista cresce
 * sem espremer o menu e sobra largura para o nome inteiro da conta. Com muitas
 * contas, rolar uma lista é pior que buscar — por isso o campo de busca recebe
 * o foco assim que abre, e dá para navegar só pelo teclado.
 */

/** Recentes que são de verdade: o que ESTE navegador usou por último. */
const CHAVE_RECENTES = "mos:contas-recentes";
const QUANTAS_RECENTES = 3;

function lerRecentes(): string[] {
  try {
    const cru = localStorage.getItem(CHAVE_RECENTES);
    const lista: unknown = cru ? JSON.parse(cru) : [];
    return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return []; // janela anônima, storage bloqueado: a seção some, o resto funciona
  }
}

function anotarRecente(orgId: string) {
  try {
    localStorage.setItem(CHAVE_RECENTES, JSON.stringify(anotarUso(lerRecentes(), orgId)));
  } catch {
    /* sem storage, seguimos sem recentes */
  }
}

export function SeletorDeConta({ compacto }: { compacto?: boolean }) {
  const auth = useMotorAuth();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [destacado, setDestacado] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  const varias = auth.contas.length > 1;

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  // abrir limpa a busca e devolve o foco ao campo — abrir de novo não herda
  // o estado da vez anterior
  useEffect(() => {
    if (!aberto) return;
    setBusca("");
    setDestacado(0);
    const t = setTimeout(() => campo.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [aberto]);

  const filtradas = useMemo(() => filtrarContas(auth.contas, busca), [auth.contas, busca]);

  const recentes = useMemo(
    () =>
      busca.trim() ? [] : escolherRecentes(auth.contas, lerRecentes(), auth.orgId, QUANTAS_RECENTES),
    [auth.contas, auth.orgId, busca],
  );

  // a navegação por teclado percorre a lista visível de cima para baixo
  const navegaveis = useMemo(() => [...recentes, ...filtradas], [recentes, filtradas]);

  function escolher(orgId: string) {
    setAberto(false);
    if (orgId === auth.orgId) return;
    anotarRecente(orgId);
    void auth.trocarConta(orgId);
  }

  function teclado(e: TeclaReact) {
    if (e.key === "Escape") {
      setAberto(false);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (navegaveis.length === 0) return;
      const passo = e.key === "ArrowDown" ? 1 : -1;
      setDestacado((i) => (i + passo + navegaveis.length) % navegaveis.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const alvo = navegaveis[destacado];
      if (alvo) escolher(alvo.orgId);
    }
  }

  if (compacto) {
    return (
      <span className="app-org-avatar" title={auth.orgName}>
        {auth.orgInitial}
      </span>
    );
  }

  let indice = -1;
  const linha = (c: Conta, chave: string) => {
    indice += 1;
    const meu = indice;
    const atual = c.orgId === auth.orgId;
    return (
      <button
        key={chave}
        role="option"
        aria-selected={atual}
        onClick={() => escolher(c.orgId)}
        onMouseEnter={() => setDestacado(meu)}
        className={`conta-linha${destacado === meu ? " is-destacada" : ""}${atual ? " is-atual" : ""}`}
        title={c.nome}
      >
        <span className="conta-avatar">{c.nome.slice(0, 1).toUpperCase()}</span>
        <span className="conta-texto">
          <strong>{c.nome}</strong>
          <small>{c.role}</small>
        </span>
        {atual && <Check size={14} className="conta-check" aria-hidden="true" />}
      </button>
    );
  };

  return (
    <div className="conta-ancora" ref={ref} onKeyDown={teclado}>
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
        <div className="conta-painel" role="dialog" aria-label="Trocar de conta">
          <div className="conta-busca">
            <Search size={14} aria-hidden="true" />
            <input
              ref={campo}
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setDestacado(0);
              }}
              placeholder="Buscar conta"
              aria-label="Buscar conta"
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          <div className="conta-lista" role="listbox" aria-label="Suas contas">
            {recentes.length > 0 && (
              <>
                <div className="conta-secao">recentes</div>
                {recentes.map((c) => linha(c, `r-${c.orgId}`))}
                <div className="conta-risco" />
              </>
            )}

            <div className="conta-secao">
              todas as contas<span>{filtradas.length}</span>
            </div>
            {filtradas.length === 0 ? (
              <p className="conta-vazio">Nenhuma conta com esse nome.</p>
            ) : (
              filtradas.map((c) => linha(c, c.orgId))
            )}
          </div>
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
