-- Identidade fechada (S-046): as quatro tabelas que ficaram de fora do RLS.
--
-- O QUE ESTAVA ABERTO. A S-011 protegeu tudo que tem `org_id` e parou em
-- `users`, `login_codes`, `sessions` e `organizations` — as tabelas do login,
-- que não pertencem a conta nenhuma. Ficou registrado como dívida, e é esta.
--
-- Enquanto a aplicação conectar como DONA do banco, nada aqui muda o que ela
-- pode: dono atravessa RLS. O valor aparece em dois momentos, e os dois
-- importam:
--
--  1. JÁ HOJE, dentro de `comContexto`, onde a conexão vira `metrik_app`. Uma
--     consulta a `users` ali passa a devolver só quem a pessoa pode ver.
--  2. Na parte 2 da S-046, quando `metrik_app` virar papel de login e a
--     aplicação deixar de conectar como dona. Aí isto vira o padrão.
--
-- A REGRA QUE ORGANIZA TUDO: nada que o login precisa fazer ANTES de saber
-- quem é a pessoa pode virar política — não há contexto a declarar, é o
-- contexto que está sendo produzido. Tudo isso vira função `SECURITY DEFINER`
-- nomeada, que é uma lista que dá para ler de uma vez.

-- ── users ────────────────────────────────────────────────────────────────
-- Dois motivos legítimos para ver uma pessoa: ela é você, ou ela divide a
-- conta em curso com você (é o que a tela de membros mostra).
--
-- NÃO HÁ POLÍTICA DE ESCRITA, de propósito. Criar pessoa é privilégio do
-- fluxo de entrada, e privilégio vira função nomeada — `garantir_pessoa`.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS users_leitura ON users;--> statement-breakpoint
CREATE POLICY users_leitura ON users FOR SELECT TO metrik_app
	USING (
		id = pessoa_em_curso()
		OR EXISTS (
			SELECT 1 FROM memberships m
			WHERE m.user_id = users.id::text AND m.org_id = conta_em_curso()
		)
	);
--> statement-breakpoint

-- ── login_codes ──────────────────────────────────────────────────────────
-- NENHUMA política. É a única tabela em que a aplicação não entra nunca por
-- consulta direta, e é a mais sensível: quem lê um código em trânsito entra
-- como a pessoa. Todo acesso passa pelas funções abaixo, que exigem o e-mail
-- ou o id em mãos e não devolvem lista.
ALTER TABLE login_codes ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- ── sessions ─────────────────────────────────────────────────────────────
-- A sessão é da pessoa. Resolver a sessão a partir do cookie continua sendo
-- bootstrap (`resolver_sessao_por_hash`), porque ali ainda não se sabe quem é.
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS sessions_da_pessoa ON sessions;--> statement-breakpoint
CREATE POLICY sessions_da_pessoa ON sessions FOR ALL TO metrik_app
	USING (user_id = pessoa_em_curso())
	WITH CHECK (user_id = pessoa_em_curso());
--> statement-breakpoint

-- ── organizations ────────────────────────────────────────────────────────
-- A conta em curso, ou qualquer conta de que a pessoa participe — é o que o
-- seletor de contas precisa. Criar conta é `fundar_conta`, que já existe.
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS organizations_visiveis ON organizations;--> statement-breakpoint
CREATE POLICY organizations_visiveis ON organizations FOR SELECT TO metrik_app
	USING (
		id = conta_em_curso()
		OR EXISTS (
			SELECT 1 FROM memberships m
			WHERE m.org_id = organizations.id AND m.user_id = pessoa_em_curso()::text
		)
	);
--> statement-breakpoint

-- ── as portas do login ───────────────────────────────────────────────────
-- Todas exigem um segredo ou um identificador exato. Nenhuma lista nada.

-- Esta pessoa já existe? Responde só o id — é o que separa "conhecida" de
-- "precisa de convite", e não serve para descobrir quem mais está aqui.
CREATE OR REPLACE FUNCTION pessoa_por_email(p_email text) RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
	SELECT u.id FROM users u WHERE u.email = p_email
$$;
--> statement-breakpoint

-- A instalação está vazia? É o que autoriza o fundador, e só isso.
CREATE OR REPLACE FUNCTION existe_alguma_pessoa() RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
	SELECT EXISTS (SELECT 1 FROM users)
$$;
--> statement-breakpoint

-- A pessoa provou o e-mail: existe ou passa a existir, e a entrada fica
-- registrada. Uma chamada só, para não haver janela entre achar e criar.
CREATE OR REPLACE FUNCTION garantir_pessoa(p_email text)
RETURNS TABLE (user_id uuid, email text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
	achada users%ROWTYPE;
BEGIN
	SELECT * INTO achada FROM users u WHERE u.email = p_email;
	IF NOT FOUND THEN
		INSERT INTO users (email) VALUES (p_email) RETURNING * INTO achada;
	END IF;
	UPDATE users SET last_login_at = now() WHERE id = achada.id;
	RETURN QUERY SELECT achada.id, achada.email;
END $$;
--> statement-breakpoint

-- Quantos códigos este e-mail pediu na janela. A trava de força bruta lê isto.
CREATE OR REPLACE FUNCTION pedidos_recentes(p_email text, p_desde timestamptz)
RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
	SELECT count(*)::integer FROM login_codes
	WHERE email = p_email AND created_at >= p_desde
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION guardar_codigo(p_email text, p_hash text, p_expira timestamptz)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
	INSERT INTO login_codes (email, code_hash, expires_at) VALUES (p_email, p_hash, p_expira)
$$;
--> statement-breakpoint

-- O código vigente deste e-mail. Devolve o HASH, nunca o código — quem chama
-- compara em tempo constante do lado de fora.
CREATE OR REPLACE FUNCTION codigo_vigente(p_email text)
RETURNS TABLE (code_id uuid, code_hash text, expires_at timestamptz, attempts integer)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
	SELECT c.id, c.code_hash, c.expires_at, c.attempts
	FROM login_codes c
	WHERE c.email = p_email AND c.used_at IS NULL
	ORDER BY c.created_at DESC
	LIMIT 1
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION queimar_tentativa(p_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
	UPDATE login_codes SET attempts = attempts + 1 WHERE id = p_id
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION marcar_codigo_usado(p_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
	UPDATE login_codes SET used_at = now() WHERE id = p_id
$$;
--> statement-breakpoint

-- Registrar que a sessão foi vista agora. Quem marca é quem acabou de ser
-- reconhecido por ela, e nesse instante ainda não há contexto declarado.
CREATE OR REPLACE FUNCTION tocar_sessao(p_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
	UPDATE sessions SET last_seen_at = now() WHERE id = p_id
$$;
--> statement-breakpoint

-- Sair vale mesmo com a sessão já inválida — quem tem o token pode encerrá-lo.
CREATE OR REPLACE FUNCTION encerrar_sessao(p_hash text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
	UPDATE sessions SET revoked_at = now() WHERE token_hash = p_hash AND revoked_at IS NULL
$$;
--> statement-breakpoint

-- ── aceitar convite ──────────────────────────────────────────────────────
-- ISTO ESTAVA QUEBRADO, e os testes não pegaram porque só exercitavam as
-- recusas. O aceite roda dentro de `comPessoa`, que declara a pessoa mas NÃO
-- a conta — e a política de escrita de `memberships` exige a conta. Ou seja:
-- desde a S-011, aceitar um convite estando logado era recusado pelo banco.
--
-- Não se conserta afrouxando a política: "quem tem o token pode se vincular"
-- como regra geral de escrita é exatamente o buraco que a S-011 fechou. Vira
-- função, que confere o token E o e-mail antes de escrever.
CREATE OR REPLACE FUNCTION aceitar_convite_por_hash(p_user uuid, p_hash text)
RETURNS TABLE (org_id uuid, papel text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
	c record;
	dela text;
BEGIN
	SELECT i.id, i.org_id, i.role, i.email INTO c
	FROM invites i
	WHERE i.token_hash = p_hash AND i.accepted_at IS NULL AND i.expires_at >= now();
	IF NOT FOUND THEN
		RAISE EXCEPTION 'convite_invalido' USING ERRCODE = 'check_violation';
	END IF;

	SELECT u.email INTO dela FROM users u WHERE u.id = p_user;
	-- o convite é para um e-mail: quem aceita precisa ser aquela pessoa. A
	-- recusa é a MESMA de convite inexistente, de propósito: quem tenta não
	-- distingue "é de outro" de "não existe".
	IF dela IS NULL OR dela <> c.email THEN
		RAISE EXCEPTION 'convite_invalido' USING ERRCODE = 'check_violation';
	END IF;

	INSERT INTO memberships (org_id, user_id, role)
	VALUES (c.org_id, p_user::text, c.role)
	ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;
	UPDATE invites SET accepted_at = now() WHERE id = c.id;

	RETURN QUERY SELECT c.org_id, c.role::text;
END $$;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION pessoa_por_email(text) TO metrik_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION existe_alguma_pessoa() TO metrik_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION garantir_pessoa(text) TO metrik_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION pedidos_recentes(text, timestamptz) TO metrik_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION guardar_codigo(text, text, timestamptz) TO metrik_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION codigo_vigente(text) TO metrik_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION queimar_tentativa(uuid) TO metrik_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION marcar_codigo_usado(uuid) TO metrik_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION tocar_sessao(uuid) TO metrik_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION encerrar_sessao(text) TO metrik_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION aceitar_convite_por_hash(uuid, text) TO metrik_app;
