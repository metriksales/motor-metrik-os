// ADMIN — a sala de máquinas de contas e acessos: a organização, quem tem
// login nela (membros reais do Neon) e o estado do login real (Clerk).
// Leitura em primeiro lugar; convites entram junto com o Clerk.
import { useEffect, useState } from "react";
import { Building2, KeyRound, Users, Bot, Database, ShieldCheck, Check } from "lucide-react";
import { api } from "../lib/api";
import { useMotorAuth } from "../lib/auth";
import { tempoRelativo } from "../lib/live";
import { Reveal, Pill } from "../ui";

type Membro = { userId: string; role: string; createdAt?: string };

const DEMO_MEMBROS: Membro[] = [
  { userId: "voce@suaempresa.com", role: "owner" },
  { userId: "comercial@suaempresa.com", role: "operator" },
];

const ROLE_LABEL: Record<string, { label: string; cor: string }> = {
  owner: { label: "dono", cor: "#8b7cff" },
  admin: { label: "admin", cor: "#22d3ee" },
  operator: { label: "operador", cor: "#34d399" },
  viewer: { label: "só leitura", cor: "#83879a" },
};

export default function Admin() {
  const auth = useMotorAuth();
  const [membros, setMembros] = useState<Membro[] | null>(null);

  useEffect(() => {
    let vivo = true;
    (api.listMembers(auth.getToken) as Promise<Membro[]>)
      .then((rows) => {
        if (vivo && Array.isArray(rows) && rows.length > 0) setMembros(rows);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lista = membros ?? DEMO_MEMBROS;
  const real = membros !== null;

  return (
    <div className="space-y-4 max-w-3xl">
      {/* organização */}
      <Reveal>
        <div className="card p-5 flex items-center gap-4">
          <span className="grid place-items-center rounded-xl flex-none" style={{ width: 42, height: 42, background: "#8b7cff16", border: "1px solid #8b7cff30" }}>
            <Building2 size={20} style={{ color: "#8b7cff" }} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display font-semibold text-[16px]">{auth.orgName}</div>
            <div className="text-[12.5px] text-[var(--txt-3)] mt-0.5">
              {auth.demo ? "organização de demonstração" : `tenant isolado · ${auth.orgId?.slice(0, 8)}…`}
            </div>
          </div>
          <Pill color={auth.demo ? "#83879a" : "#34d399"}>{auth.demo ? "demo" : "conta real"}</Pill>
        </div>
      </Reveal>

      {/* usuários / logins */}
      <Reveal delay={0.04}>
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="mono-label flex items-center gap-1.5"><Users size={12} /> Usuários com acesso</div>
            <span className="pill" style={real ? { color: "#8b7cff" } : undefined}>
              {real ? <Database size={11} /> : null} {real ? "dado real ✓" : "demo"}
            </span>
          </div>
          <ul className="space-y-1">
            {lista.map((m, i) => {
              const r = ROLE_LABEL[m.role] ?? ROLE_LABEL.viewer;
              return (
                <li key={i} className="flex items-center gap-3 py-2.5 border-b border-[var(--line)] last:border-0">
                  <span className="grid place-items-center rounded-full flex-none text-[11px] font-bold font-display" style={{ width: 30, height: 30, background: `${r.cor}18`, border: `1px solid ${r.cor}33`, color: r.cor }}>
                    {m.userId.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="text-[13.5px] text-[var(--txt)] flex-1 min-w-0 truncate font-mono">{m.userId}</span>
                  {m.createdAt && <span className="tick flex-none hidden sm:block">{tempoRelativo(m.createdAt)}</span>}
                  <span className="pill flex-none" style={{ color: r.cor, borderColor: `${r.cor}40`, background: `${r.cor}14` }}>{r.label}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-[11.5px] text-[var(--txt-4)] mt-3">
            Convidar pessoas entra junto com o login real — cada convidado cria a própria senha e cai nesta organização.
          </p>
        </div>
      </Reveal>

      {/* estado do login real */}
      <Reveal delay={0.08}>
        <div className="card p-5">
          <div className="mono-label flex items-center gap-1.5 mb-3"><KeyRound size={12} /> Login real (Clerk)</div>
          {auth.demo ? (
            <>
              <p className="text-[13px] text-[var(--txt-2)] leading-relaxed">
                A ponte multi-tenant está <b className="text-[var(--txt)]">pronta no código</b> (org do Clerk vira tenant
                sozinha no 1º login). Falta só ativar:
              </p>
              <ol className="mt-2.5 space-y-1.5 text-[13px] text-[var(--txt-2)]">
                <li className="flex gap-2"><span className="tick flex-none">1</span> criar o app no clerk.com e habilitar <b>Organizations</b></li>
                <li className="flex gap-2"><span className="tick flex-none">2</span> colar as 2 chaves no Vercel (<span className="font-mono text-[11.5px]">pk_ / sk_</span>)</li>
                <li className="flex gap-2"><span className="tick flex-none">3</span> redeploy — a tela de login aparece sozinha</li>
              </ol>
            </>
          ) : (
            <p className="text-[13px] text-[var(--txt-2)] leading-relaxed flex items-center gap-2">
              <Check size={15} style={{ color: "#34d399" }} /> Login ativo — cada pessoa entra com a própria conta e cai no tenant certo.
            </p>
          )}
        </div>
      </Reveal>

      {/* acessos de máquina */}
      <Reveal delay={0.12}>
        <div className="card p-5">
          <div className="mono-label flex items-center gap-1.5 mb-3"><Bot size={12} /> Acessos de máquina</div>
          <ul className="space-y-2 text-[13px] text-[var(--txt-2)]">
            <li className="flex items-center gap-2"><span className="dot" style={{ background: "#34d399" }} /> Claude Code / Codex — a bancada da Metrik (mesma esteira, mesmo histórico)</li>
            <li className="flex items-center gap-2"><span className="dot" style={{ background: "#34d399" }} /> Agentes reais — gravam execuções na caixa-preta com token de máquina</li>
          </ul>
          <p className="text-[11.5px] text-[var(--txt-4)] mt-3 flex items-center gap-1.5">
            <ShieldCheck size={13} style={{ color: "#34d399" }} /> segredo de máquina nunca aparece aqui — vive só no servidor
          </p>
        </div>
      </Reveal>
    </div>
  );
}
