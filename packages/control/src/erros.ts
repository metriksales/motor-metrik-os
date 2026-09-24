// Erros de domínio (S-006). Antes tudo virava 500 com a mensagem interna no
// corpo da resposta — inclusive erro de banco, que no drizzle carrega o SQL e
// os parâmetros. Aqui cada erro sabe o próprio status; o handler traduz.

export class ErroDeDominio extends Error {
  constructor(
    mensagem: string,
    readonly status: number = 400,
    readonly codigo: string = "invalido",
  ) {
    super(mensagem);
    this.name = new.target.name;
  }
}

/** 400 — o pedido em si está errado (campo faltando, valor fora do formato). */
export class EntradaInvalida extends ErroDeDominio {
  constructor(mensagem: string) {
    super(mensagem, 400, "entrada_invalida");
  }
}

/** 403 — autenticado, mas sem permissão para esta ação. */
export class SemPermissao extends ErroDeDominio {
  constructor(mensagem = "sem permissão para esta ação") {
    super(mensagem, 403, "sem_permissao");
  }
}

/** 404 — não existe, ou não é desta conta (a resposta é a mesma de propósito). */
export class NaoEncontrado extends ErroDeDominio {
  constructor(oQue: string) {
    super(`${oQue} não encontrado nesta conta`, 404, "nao_encontrado");
  }
}

/** 409 — alguém mexeu antes; recarregue e tente de novo. */
export class Conflito extends ErroDeDominio {
  constructor(mensagem: string) {
    super(mensagem, 409, "conflito");
  }
}

export function ehErroDeDominio(e: unknown): e is ErroDeDominio {
  return e instanceof ErroDeDominio;
}
