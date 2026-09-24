// ADMIN — a sala de máquinas de contas e acessos: a organização, quem tem
// login nela e o estado da entrada. Leitura em primeiro lugar.
import { useEffect, useState } from "react";
import { Building2, KeyRound, Users, Database, ShieldCheck, Check } from "lucide-react";
import { api } from "../lib/api";
import { useMotorAuth } from "../lib/auth";
import { tempoRelativo } from "../lib/live";
import { apenasNoDemo } from "../lib/honestidade";
import { Reveal, Pill } from "../ui";

type Membro = { userId: string; role: string; createdAt?: string; email?: string | null; nome?: string | null };

const DEMO_MEMBROS: Membro[] = [
  { userId: "voce@suaempresa.com", role: "owner", email: "voce@suaempresa.com" },
  { userId: "comercial@suaempresa.com", role: "operator", email: "comercial@suaempresa.com" },
];

/**
 * Como chamar quem está na lista. `user_id` é texto e nem sempre é uma pessoa:
 * os vínculos da época do Clerk apontam para identidades que não existem mais.
 * Mostrar o id cru fazia o dono da conta não se reconhecer na própria lista.
 */
function identificar(m: Membro): { nome: string; morta: boolean } {
  if (m.email) return { nome: m.nome ? `${m.nome} · ${m.email}` : m.email, morta: false };
  if (m.userId.includes("@")) return { nome: m.userId, morta: false }; // demo
  return { nome: m.userId, morta: true };
}

const ROLE_LABEL: Record<string, { label: string; cor: string }> = {
  owner: { label: "dono", cor: "#3b82f6" },
  admin: { label: "admin", cor: "#58aae4" },
  operator: { label: "operador", cor: "#3fb950" },
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

  // membros de demonstração SÓ na vitrine (S-007): numa conta real, lista vazia
  // é lista vazia — antes mostrava gente que não existe com um selo "demo".
  const lista: Membro[] = membros ?? apenasNoDemo(auth.demo, DEMO_MEMBROS) ?? [];
  const real = membros !== null;

  return (
    <div className="space-y-4 max-w-3xl">
      {/* organização */}
      <Reveal>
        <div className="card p-5 flex items-center gap-4">
          <span className="grid place-items-center rounded-xl flex-none" style={{ width: 42, height: 42, background: "#3b82f616", border: "1px solid #3b82f630" }}>
            <Building2 size={20} style={{ color: "#3b82f6" }} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display font-semibold text-[16px]">{auth.orgName}</div>
            <div className="text-[12.5px] text-[var(--txt-3)] mt-0.5">
              {auth.demo ? "organização de exemplo" : "a sua organização — os dados são só seus"}
            </div>
          </div>
          <Pill color={auth.demo ? "#83879a" : "#3fb950"}>{auth.demo ? "demo" : "conta real"}</Pill>
        </div>
      </Reveal>

      {/* usuários / logins */}
      <Reveal delay={0.04}>
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="mono-label flex items-center gap-1.5"><Users size={12} /> Usuários com acesso</div>
            <span className="pill" style={real ? { color: "#3b82f6" } : undefined}>
              {real ? <Database size={11} /> : null} {real ? "dado real ✓" : "demo"}
            </span>
          </div>
          <ul className="space-y-1">
            {lista.map((m, i) => {
              const r = ROLE_LABEL[m.role] ?? ROLE_LABEL.viewer;
              const { nome, morta } = identificar(m);
              const cor = morta ? "#83879a" : r.cor;
              const souEu = Boolean(m.email) && m.email === auth.email;
              return (
                <li key={i} className="flex items-center gap-3 py-2.5 border-b border-[var(--line)] last:border-0">
                  <span className="grid place-items-center rounded-full flex-none text-[11px] font-bold font-display" style={{ width: 30, height: 30, background: `${cor}18`, border: `1px solid ${cor}33`, color: cor }}>
                    {nome.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-[13.5px] truncate ${morta ? "text-[var(--txt-4)] font-mono" : "text-[var(--txt)]"}`}>
                      {nome}
                      {souEu && <span className="text-[var(--txt-4)]"> (você)</span>}
                    </span>
                    {morta && (
                      <span className="block text-[11px] text-[var(--txt-4)]">
                        acesso antigo, do Clerk — esta identidade não entra mais
                      </span>
                    )}
                  </span>
                  {m.createdAt && <span className="tick flex-none hidden sm:block">{tempoRelativo(m.createdAt)}</span>}
                  <span className="pill flex-none" style={{ color: cor, borderColor: `${cor}40`, background: `${cor}14` }}>{r.label}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-[11.5px] text-[var(--txt-4)] mt-3">
            Não existe senha aqui: quem é convidado recebe um código por e-mail, entra com ele e já cai nesta organização com o papel do convite.
          </p>
        </div>
      </Reveal>

      {/* login — em linguagem de cliente */}
      <Reveal delay={0.08}>
        <div className="card p-5">
          <div className="mono-label flex items-center gap-1.5 mb-3"><KeyRound size={12} /> Login e acesso</div>
          <p className="text-[13px] text-[var(--txt-2)] leading-relaxed flex items-start gap-2">
            <Check size={15} style={{ color: "#3fb950" }} className="flex-none mt-0.5" />
            {auth.demo
              ? "Cada pessoa da sua equipe entra com o próprio login e senha, e vê só a sua operação. A Metrik cuida de toda a configuração de acesso."
              : "Login ativo — cada pessoa entra com a própria conta e vê só a sua operação. Pra convidar alguém, é só pedir pra Metrik."}
          </p>
        </div>
      </Reveal>

      {/* segurança — sem jargão: a Metrik opera por baixo, seus dados protegidos */}
      <Reveal delay={0.12}>
        <div className="card p-5 flex items-start gap-3">
          <ShieldCheck size={18} style={{ color: "#3fb950" }} className="flex-none mt-0.5" />
          <div>
            <div className="text-[13.5px] font-medium text-[var(--txt)]">Seus dados, protegidos</div>
            <p className="text-[12.5px] text-[var(--txt-2)] leading-relaxed mt-0.5">
              A Metrik opera o seu motor pelos bastidores com acesso seguro — cada conversa e cada número ficam só
              na sua operação, separados de qualquer outro cliente.
            </p>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
