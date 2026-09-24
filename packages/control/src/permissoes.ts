// Permissões (S-006). Modelo provisório por papel, até a S-022 trazer as
// permissões por pessoa que o PRODUTO.md define. A regra que importa já vale:
// TODA ação declara o que exige, e quem não tem, não passa.
import { SemPermissao } from "./erros.js";

export type Papel = "owner" | "admin" | "operator" | "viewer";

/** O que se pode fazer. `gerenciar` é o topo (pessoas, conexões, tokens). */
export type Permissao = "ver" | "operar" | "ajustar" | "publicar" | "gerenciar";

const PODE: Record<Papel, Permissao[]> = {
  owner: ["ver", "operar", "ajustar", "publicar", "gerenciar"],
  admin: ["ver", "operar", "ajustar", "publicar", "gerenciar"],
  // opera o dia a dia e pede mudança, mas NÃO aprova nem publica
  operator: ["ver", "operar", "ajustar"],
  viewer: ["ver"],
};

export function permite(papel: Papel, p: Permissao): boolean {
  return PODE[papel]?.includes(p) ?? false;
}

export function exigirPermissao(ctx: { role: Papel }, p: Permissao): void {
  if (!permite(ctx.role, p)) throw new SemPermissao(`esta ação exige permissão de "${p}"`);
}
