-- Pré-checagem da S-010: falhar FALANDO, não com erro de catálogo.
--
-- A migração seguinte cria chaves estrangeiras de conta e índices únicos. Se o
-- banco já tiver linha órfã ou duplicada, ela quebra — e o erro cru do Postgres
-- ("insert or update on table ... violates foreign key constraint") não diz
-- QUAIS linhas nem quantas, e o deploy inteiro para sem ninguém saber o que
-- consertar.
--
-- Este arquivo roda antes e, quando algo impede, ergue uma exceção com a conta,
-- a tabela e a contagem. Não conserta nada sozinho: apagar linha de cliente é
-- decisão de gente, não de migração.
DO $$
DECLARE
	orfas text;
	duplicadas text;
BEGIN
	-- 1. linhas apontando para conta que não existe mais
	SELECT string_agg(format('%s: %s linha(s)', tabela, n), ' | ')
	INTO orfas
	FROM (
		SELECT 'contact_states' AS tabela, count(*) AS n FROM contact_states c
			WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = c.org_id)
		UNION ALL SELECT 'agent_specs', count(*) FROM agent_specs c
			WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = c.org_id)
		UNION ALL SELECT 'change_sets', count(*) FROM change_sets c
			WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = c.org_id)
		UNION ALL SELECT 'releases', count(*) FROM releases c
			WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = c.org_id)
		UNION ALL SELECT 'runtime_logs', count(*) FROM runtime_logs c
			WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = c.org_id)
		UNION ALL SELECT 'audit_log', count(*) FROM audit_log c
			WHERE c.org_id IS NOT NULL
			  AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = c.org_id)
	) t
	WHERE n > 0;

	IF orfas IS NOT NULL THEN
		RAISE EXCEPTION
			'S-010: há linhas apontando para conta inexistente (%). Decida o destino delas antes de criar as chaves estrangeiras.', orfas;
	END IF;

	-- 2. linhas apontando para agente que não existe mais
	SELECT string_agg(format('%s: %s linha(s)', tabela, n), ' | ')
	INTO orfas
	FROM (
		SELECT 'change_sets' AS tabela, count(*) AS n FROM change_sets c
			WHERE NOT EXISTS (SELECT 1 FROM agents a WHERE a.id = c.agent_id)
		UNION ALL SELECT 'releases', count(*) FROM releases c
			WHERE NOT EXISTS (SELECT 1 FROM agents a WHERE a.id = c.agent_id)
		UNION ALL SELECT 'connections', count(*) FROM connections c
			WHERE c.agent_id IS NOT NULL
			  AND NOT EXISTS (SELECT 1 FROM agents a WHERE a.id = c.agent_id)
	) t
	WHERE n > 0;

	IF orfas IS NOT NULL THEN
		RAISE EXCEPTION
			'S-010: há linhas apontando para agente inexistente (%).', orfas;
	END IF;

	-- 3. o que impediria os índices únicos
	SELECT string_agg(format('release agent=%s spec=%s aparece %sx', agent_id, spec_version, n), ' | ')
	INTO duplicadas
	FROM (
		SELECT agent_id, spec_version, count(*) AS n
		FROM releases GROUP BY 1, 2 HAVING count(*) > 1
	) d;

	IF duplicadas IS NOT NULL THEN
		RAISE EXCEPTION
			'S-010: a mesma versão de spec foi publicada mais de uma vez (%). Uma delas precisa ir embora para o release virar único.', duplicadas;
	END IF;

	SELECT string_agg(format('conta=%s tipo=%s aparece %sx', org_id, kind, n), ' | ')
	INTO duplicadas
	FROM (
		SELECT org_id, kind, count(*) AS n
		FROM connections WHERE kind <> 'whatsapp' GROUP BY 1, 2 HAVING count(*) > 1
	) d;

	IF duplicadas IS NOT NULL THEN
		RAISE EXCEPTION
			'S-010: a mesma conta tem mais de uma conexão do mesmo tipo (%). Com duas, "para qual CRM eu escrevo?" não tem resposta.', duplicadas;
	END IF;
END $$;
