-- Religa as contas que a saída do Clerk deixou sem dono (S-045).
--
-- O QUE QUEBROU
-- `memberships.user_id` é TEXTO e guardava o id do Clerk (`user_2abc…`). A
-- autenticação própria identifica a pessoa por um uuid em `users`. São
-- identificadores de mundos diferentes, e nada os liga. Ao entrar, a pessoa
-- não era achada em conta nenhuma e ganhava uma conta vazia — enquanto a conta
-- antiga, com os agentes e o histórico, seguia inteira e inacessível.
--
-- O QUE ESTA MIGRAÇÃO FAZ
-- Dá a titularidade das contas órfãs ao dono da plataforma. "Órfã" aqui é
-- precisa: nenhum dos vínculos da conta aponta para uma pessoa que exista em
-- `users` — ou seja, ninguém consegue abri-la. A conta nova e vazia criada no
-- primeiro acesso NÃO se encaixa nisso e fica de fora.
--
-- Só insere: nenhuma linha é apagada ou alterada. Se a pessoa não existir em
-- `users` (banco de teste, banco novo), não faz nada. Cada religação fica
-- registrada em `audit_log`, visível na tela de Logs.
--
-- Reversível: basta apagar os vínculos que a auditoria aponta.
WITH pessoa AS (
	SELECT "id" FROM "users" WHERE "email" = 'contatosalesmetrik@gmail.com'
), orfas AS (
	SELECT o."id"
	FROM "organizations" o
	WHERE NOT EXISTS (
		SELECT 1
		FROM "memberships" m
		JOIN "users" viva ON viva."id"::text = m."user_id"
		WHERE m."org_id" = o."id"
	)
), religadas AS (
	INSERT INTO "memberships" ("org_id", "user_id", "role")
	SELECT orfas."id", pessoa."id"::text, 'owner'::"public"."role"
	FROM orfas CROSS JOIN pessoa
	ON CONFLICT ("org_id", "user_id") DO NOTHING
	RETURNING "org_id"
)
INSERT INTO "audit_log" ("org_id", "actor", "action", "target", "data")
SELECT
	religadas."org_id",
	'migração 0008',
	'conta.religada',
	'contatosalesmetrik@gmail.com',
	jsonb_build_object(
		'motivo', 'vínculo perdido na saída do Clerk (S-045)',
		'papel', 'owner'
	)
FROM religadas;
