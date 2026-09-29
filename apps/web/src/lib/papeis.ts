// O papel de uma pessoa na conta, como a tela o escreve.
//
// O banco guarda `owner`/`admin`/`operator`/`viewer`; mostrar isso cru é nome
// interno na tela (skill `texto-de-tela`, regra 10).
const ROTULOS: Record<string, string> = {
  owner: "Dono",
  admin: "Admin",
  operator: "Operador",
  viewer: "Só leitura",
};

export function rotuloDoPapel(papel: string | undefined | null): string {
  return (papel && ROTULOS[papel]) || "Só leitura";
}
