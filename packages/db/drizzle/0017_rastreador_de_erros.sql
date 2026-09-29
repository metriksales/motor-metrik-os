-- Rastreador de erros caseiro (S-012): o erro deixa de morrer no console.
--
-- O QUE ESTAVA ERRADO. Um erro 500 virava uma linha no console da Vercel, com
-- o id da requisição, e ninguém era avisado. O console engasga em janela
-- grande, e "saber que quebrou" dependia de alguém abrir e procurar.
--
-- O DESENHO. Um erro é agrupado pela ASSINATURA (onde + mensagem normalizada,
-- calculada no pacote de controle): mil ocorrências do mesmo erro são uma
-- linha com `ocorrencias = 1000`, não mil linhas. O aviso por e-mail sai uma
-- vez por assinatura a cada 24 h, e é o banco quem decide — várias funções
-- serverless podem registrar o mesmo erro ao mesmo tempo, e só uma avisa.
--
-- QUEM LÊ. Ninguém pela conexão da aplicação: a tabela tem RLS e nenhuma
-- política. Erro é dado da PLATAFORMA, não de uma conta — a mensagem pode
-- citar rota, tabela, fornecedor. Escrever e ler passam por duas funções
-- nomeadas, e é o pacote de controle quem confere que quem lê é operador da
-- plataforma. Um erro pode acontecer antes de haver conta (login, webhook
-- sem segredo), por isso `org_id` é opcional.

CREATE TABLE IF NOT EXISTS erros (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	assinatura text NOT NULL,
	onde text NOT NULL,
	mensagem text NOT NULL,
	pilha text,
	org_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
	ultimo_request_id text,
	ocorrencias integer NOT NULL DEFAULT 1,
	primeira_em timestamptz NOT NULL DEFAULT now(),
	ultima_em timestamptz NOT NULL DEFAULT now(),
	avisado_em timestamptz,
	CONSTRAINT erros_assinatura_unica UNIQUE (assinatura)
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS erros_ultima ON erros (ultima_em DESC);--> statement-breakpoint
ALTER TABLE erros ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Registra uma ocorrência e diz se é para AVISAR. O aviso é reivindicado no
-- mesmo lugar em que é decidido: quem conseguir marcar `avisado_em` avisa; a
-- função concorrente que chegar um instante depois encontra a marca e não
-- avisa. `p_forcar_aviso` existe para o erro de teste, que precisa provar que
-- o e-mail chega mesmo que a mesma assinatura tenha avisado há pouco.
CREATE OR REPLACE FUNCTION registrar_erro(
	p_assinatura text,
	p_onde text,
	p_mensagem text,
	p_pilha text,
	p_org uuid,
	p_request text,
	p_forcar_aviso boolean DEFAULT false
) RETURNS TABLE (erro_id uuid, total integer, avisar boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
	v_id uuid;
	v_total integer;
BEGIN
	INSERT INTO erros AS e (assinatura, onde, mensagem, pilha, org_id, ultimo_request_id)
	VALUES (p_assinatura, left(p_onde, 120), left(p_mensagem, 1000), left(p_pilha, 4000), p_org, left(p_request, 128))
	ON CONFLICT (assinatura) DO UPDATE SET
		ocorrencias = e.ocorrencias + 1,
		ultima_em = now(),
		mensagem = EXCLUDED.mensagem,
		pilha = coalesce(EXCLUDED.pilha, e.pilha),
		org_id = coalesce(EXCLUDED.org_id, e.org_id),
		ultimo_request_id = coalesce(EXCLUDED.ultimo_request_id, e.ultimo_request_id)
	RETURNING e.id, e.ocorrencias INTO v_id, v_total;

	UPDATE erros SET avisado_em = now()
	WHERE erros.id = v_id
		AND (p_forcar_aviso OR erros.avisado_em IS NULL OR erros.avisado_em < now() - interval '24 hours');
	RETURN QUERY SELECT v_id, v_total, FOUND;
END
$$;--> statement-breakpoint

-- A lista para a tela dos operadores da plataforma, do mais recente ao mais
-- antigo. Quem pode chamar é decidido no pacote de controle, antes.
CREATE OR REPLACE FUNCTION listar_erros(p_limite integer DEFAULT 100)
RETURNS TABLE (
	erro_id uuid,
	onde text,
	mensagem text,
	pilha text,
	conta uuid,
	ultimo_request_id text,
	ocorrencias integer,
	primeira_em timestamptz,
	ultima_em timestamptz,
	avisado_em timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
	SELECT e.id, e.onde, e.mensagem, e.pilha, e.org_id, e.ultimo_request_id,
		e.ocorrencias, e.primeira_em, e.ultima_em, e.avisado_em
	FROM erros e
	ORDER BY e.ultima_em DESC
	LIMIT least(greatest(coalesce(p_limite, 100), 1), 500)
$$;
