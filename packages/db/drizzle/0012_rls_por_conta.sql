-- Row Level Security por conta (S-011): o BANCO recusa leitura cruzada, mesmo
-- quando o código esquece o filtro.
--
-- POR QUE NÃO BASTA FILTRAR NO CÓDIGO. Um `join` sem `where org_id` não quebra
-- nada, não aparece em log e não dispara alerta: só devolve dado de outro
-- cliente. Você descobre pelo cliente, ou pela ANPD. Com política no banco, o
-- mesmo bug devolve zero linhas — falha visível, na hora.
--
-- COMO FUNCIONA, EM TRÊS PEÇAS
--
-- 1. `metrik_app` é o papel da aplicação. Ele NÃO é dono das tabelas, então as
--    políticas valem para ele. O dono (quem roda migração) continua passando
--    livre, que é o que permite a própria migração existir.
--
-- 2. Toda conexão da aplicação faz `SET ROLE metrik_app` ao abrir (ver
--    packages/db/src/client.ts). Isso é o que torna a proteção padrão em vez
--    de opcional: uma consulta que esqueça de declarar a conta não vaza dado
--    nenhum, ela devolve zero linhas.
--
-- 3. O bootstrap da autenticação precisa atravessar contas — descobrir a conta
--    a PARTIR de um segredo. Isso não vira política; vira função
--    `SECURITY DEFINER`. A única porta pelo RLS exige que quem bate já tenha o
--    segredo em mãos, e não serve para enumerar nada.

-- ── de quem é a requisição ────────────────────────────────────────────────
-- `nullif(..., '')` não é firula: depois que uma transação define e encerra um
-- parâmetro, o Postgres o devolve como STRING VAZIA, não NULL — e a conexão
-- vem do pool. Sem o nullif, o cast para uuid estoura, e a mensagem não diria
-- que o problema é falta de contexto.
CREATE OR REPLACE FUNCTION conta_em_curso() RETURNS uuid
	LANGUAGE sql STABLE PARALLEL SAFE AS
$$ SELECT nullif(current_setting('app.org_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION pessoa_em_curso() RETURNS uuid
	LANGUAGE sql STABLE PARALLEL SAFE AS
$$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
--> statement-breakpoint

-- ── o papel da aplicação ──────────────────────────────────────────────────
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'metrik_app') THEN
		CREATE ROLE metrik_app NOLOGIN;
	END IF;
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO metrik_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO metrik_app;--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO metrik_app;--> statement-breakpoint
-- tabela criada depois desta migração já nasce acessível ao app
ALTER DEFAULT PRIVILEGES IN SCHEMA public
	GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO metrik_app;--> statement-breakpoint
-- quem roda a migração precisa poder virar `metrik_app` para a aplicação
-- conseguir o `SET ROLE`; sem isto o app não sobe
GRANT metrik_app TO CURRENT_USER;--> statement-breakpoint

-- ── políticas: o que é da conta em curso ──────────────────────────────────
DO $$
DECLARE
	t text;
BEGIN
	FOREACH t IN ARRAY ARRAY[
		'agents', 'agent_specs', 'change_sets', 'releases',
		'connections', 'contact_states', 'runtime_logs',
		'machine_tokens', 'audit_log'
	] LOOP
		EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
		EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_da_conta', t);
		EXECUTE format(
			'CREATE POLICY %I ON %I FOR ALL TO metrik_app
			 USING (org_id = conta_em_curso())
			 WITH CHECK (org_id = conta_em_curso())',
			t || '_da_conta', t);
	END LOOP;
END $$;
--> statement-breakpoint

-- `memberships` e `invites` têm DOIS donos possíveis, e é isto que evita a
-- saída preguiçosa de deixá-las fora do RLS por serem "tabelas de login": elas
-- são da conta, mas também são da pessoa.
--
-- MAS LER E ESCREVER NÃO SÃO A MESMA COISA, e aqui está a diferença entre
-- política e furo. Se a escrita também aceitasse "é da pessoa em curso",
-- qualquer um poderia inserir um vínculo de si mesmo em QUALQUER conta — e
-- entrar nela. Então: leitura pelos dois donos, escrita só por dentro da conta.
--
-- O que legitimamente escreve sem estar dentro da conta (aceitar convite,
-- fundar a primeira conta) não vira política frouxa: vira função nomeada, lá
-- embaixo. Operação privilegiada tem que caber numa lista que dá para ler.
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS memberships_da_conta_ou_da_pessoa ON memberships;--> statement-breakpoint
DROP POLICY IF EXISTS memberships_leitura ON memberships;--> statement-breakpoint
DROP POLICY IF EXISTS memberships_escrita ON memberships;--> statement-breakpoint
CREATE POLICY memberships_leitura ON memberships FOR SELECT TO metrik_app
	USING (org_id = conta_em_curso() OR user_id = pessoa_em_curso()::text);
--> statement-breakpoint
CREATE POLICY memberships_escrita ON memberships FOR ALL TO metrik_app
	USING (org_id = conta_em_curso())
	WITH CHECK (org_id = conta_em_curso());
--> statement-breakpoint
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS invites_da_conta_ou_do_convidado ON invites;--> statement-breakpoint
DROP POLICY IF EXISTS invites_leitura ON invites;--> statement-breakpoint
DROP POLICY IF EXISTS invites_escrita ON invites;--> statement-breakpoint
CREATE POLICY invites_leitura ON invites FOR SELECT TO metrik_app
	USING (
		org_id = conta_em_curso()
		OR email = (SELECT u.email FROM users u WHERE u.id = pessoa_em_curso())
	);
--> statement-breakpoint
CREATE POLICY invites_escrita ON invites FOR ALL TO metrik_app
	USING (org_id = conta_em_curso())
	WITH CHECK (org_id = conta_em_curso());
--> statement-breakpoint

-- ── as portas do bootstrap ────────────────────────────────────────────────
-- Estas três descobrem a conta A PARTIR de um segredo, então não há contexto
-- a declarar — é o contexto que elas produzem. `SECURITY DEFINER` as faz rodar
-- como o dono, atravessando o RLS; a chave é que só devolvem alguma coisa para
-- quem já tem o hash certo. Não dá para listar, só para conferir.
CREATE OR REPLACE FUNCTION resolver_sessao_por_hash(p_hash text)
RETURNS TABLE (session_id uuid, user_id uuid, org_id uuid, expires_at timestamptz, email text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
	SELECT s.id, s.user_id, s.org_id, s.expires_at, u.email
	FROM sessions s JOIN users u ON u.id = s.user_id
	WHERE s.token_hash = p_hash AND s.revoked_at IS NULL
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION resolver_token_por_hash(p_hash text)
RETURNS TABLE (token_id uuid, org_id uuid, nome text, escopos jsonb)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
	SELECT t.id, t.org_id, t.name, to_jsonb(t.scopes)
	FROM machine_tokens t
	WHERE t.token_hash = p_hash AND t.revoked_at IS NULL
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION resolver_entrada_por_hash(p_hash text)
RETURNS TABLE (connection_id uuid, org_id uuid, agent_id uuid, kind text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
	SELECT c.id, c.org_id, c.agent_id, c.kind::text
	FROM connections c
	WHERE c.inbound_secret_hash = p_hash AND c.agent_id IS NOT NULL
$$;
--> statement-breakpoint
-- o papel do vínculo de uma pessoa numa conta, para a sessão saber o que ela pode
CREATE OR REPLACE FUNCTION papel_na_conta(p_user uuid, p_org uuid)
RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
	SELECT m.role::text FROM memberships m
	WHERE m.user_id = p_user::text AND m.org_id = p_org
$$;
--> statement-breakpoint
-- marcar o uso do token não pode depender de contexto: quem marca é quem acabou
-- de ser reconhecido por ele
CREATE OR REPLACE FUNCTION marcar_uso_do_token(p_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
	UPDATE machine_tokens SET last_used_at = now() WHERE id = p_id
$$;
--> statement-breakpoint
-- ── o que a entrada faz, e não cabe em política ──────────────────────────
-- Estas duas escrevem vínculo SEM estar dentro de uma conta. São privilégio,
-- e por isso são função nomeada em vez de política permissiva: dá para listar
-- num fôlego tudo que escapa do RLS.

-- Existe convite no prazo para este e-mail? É lido ANTES de haver autenticado,
-- então não há contexto; e a resposta é só sim/não, não dá para enumerar.
CREATE OR REPLACE FUNCTION tem_convite_pendente(p_email text) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
	SELECT EXISTS (
		SELECT 1 FROM invites
		WHERE email = p_email AND accepted_at IS NULL AND expires_at >= now()
	)
$$;
--> statement-breakpoint

-- A pessoa provou o e-mail; os convites dirigidos a ele viram vínculo. Roda
-- inteiro aqui dentro para não precisar de escrita solta em `memberships`.
CREATE OR REPLACE FUNCTION aceitar_convites_do_email(p_user uuid, p_email text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
	c record;
	n integer := 0;
BEGIN
	FOR c IN
		SELECT id, org_id, role FROM invites
		WHERE email = p_email AND accepted_at IS NULL AND expires_at >= now()
	LOOP
		INSERT INTO memberships (org_id, user_id, role)
		VALUES (c.org_id, p_user::text, c.role)
		ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;
		UPDATE invites SET accepted_at = now() WHERE id = c.id;
		n := n + 1;
	END LOOP;
	RETURN n;
END $$;
--> statement-breakpoint

-- A primeira conta de uma instalação nova. Só o fluxo de entrada chama, e só
-- depois de `comoPodeEntrar` ter dito que pode.
CREATE OR REPLACE FUNCTION fundar_conta(p_user uuid, p_nome text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
	nova uuid;
BEGIN
	INSERT INTO organizations (name) VALUES (p_nome) RETURNING id INTO nova;
	INSERT INTO memberships (org_id, user_id, role) VALUES (nova, p_user::text, 'owner');
	RETURN nova;
END $$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION tem_convite_pendente(text) TO metrik_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION aceitar_convites_do_email(uuid, text) TO metrik_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION fundar_conta(uuid, text) TO metrik_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION resolver_sessao_por_hash(text) TO metrik_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION resolver_token_por_hash(text) TO metrik_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION resolver_entrada_por_hash(text) TO metrik_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION papel_na_conta(uuid, uuid) TO metrik_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION marcar_uso_do_token(uuid) TO metrik_app;
