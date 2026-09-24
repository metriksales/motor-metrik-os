// Envio de e-mail (S-045) atrás de uma porta: hoje Resend, amanhã outro, sem
// migração. Convite e código de entrada precisam sair da plataforma, e é a
// única dependência nova que a autenticação própria trouxe.
//
// MODO SECO: sem `RESEND_API_KEY`, nada é enviado — o conteúdo vai para o log.
// É assim que dev e preview funcionam sem a chave de produção, e é o que
// impede disparo acidental para endereço real durante teste.

export interface Mensagem {
  para: string;
  assunto: string;
  texto: string;
}

export interface EmailPort {
  readonly modo: "resend" | "seco";
  enviar(msg: Mensagem): Promise<{ ok: boolean; id?: string; erro?: string }>;
}

class EmailSeco implements EmailPort {
  readonly modo = "seco" as const;
  async enviar(msg: Mensagem) {
    console.info(
      `[email:seco] para=${msg.para} assunto="${msg.assunto}"\n${msg.texto}\n` +
        "(sem RESEND_API_KEY: nada foi enviado — isto é o esperado fora de produção)",
    );
    return { ok: true, id: "seco" };
  }
}

class EmailResend implements EmailPort {
  readonly modo = "resend" as const;
  constructor(
    private readonly apiKey: string,
    private readonly remetente: string,
  ) {}

  async enviar(msg: Mensagem) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.remetente,
          to: [msg.para],
          subject: msg.assunto,
          text: msg.texto,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!r.ok) {
        const corpo = await r.text().catch(() => "");
        // o corpo pode conter o endereço; fica no log do servidor, não na resposta
        console.error(`[email] Resend ${r.status}: ${corpo.slice(0, 300)}`);
        return { ok: false, erro: `falha ao enviar (${r.status})` };
      }
      const data = (await r.json().catch(() => ({}))) as { id?: string };
      return { ok: true, id: data.id };
    } catch (e) {
      console.error("[email] Resend indisponível:", e);
      return { ok: false, erro: "serviço de e-mail indisponível" };
    }
  }
}

export function criarEmail(env: NodeJS.ProcessEnv = process.env): EmailPort {
  const chave = env.RESEND_API_KEY;
  const remetente = env.EMAIL_FROM ?? "Metrik-OS <nao-responda@metrik.local>";
  return chave ? new EmailResend(chave, remetente) : new EmailSeco();
}

/** O texto do código de entrada. Curto: é lido no meio de outra coisa. */
export function textoDoCodigo(codigo: string, minutos: number): Mensagem["texto"] {
  return [
    `Seu código de entrada no Metrik-OS é ${codigo}.`,
    "",
    `Ele vale por ${minutos} minutos e só pode ser usado uma vez.`,
    "Se não foi você que pediu, ignore este e-mail — sem o código, ninguém entra.",
  ].join("\n");
}

export function textoDoConvite(input: { conta: string; quemConvidou: string; link: string; dias: number }): string {
  return [
    `${input.quemConvidou} convidou você para a conta "${input.conta}" no Metrik-OS.`,
    "",
    `Para aceitar: ${input.link}`,
    "",
    `O convite vale por ${input.dias} dias.`,
  ].join("\n");
}
