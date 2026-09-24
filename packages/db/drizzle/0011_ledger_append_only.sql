-- Livro-razão de verdade (S-010): `releases` e `audit_log` só aceitam INSERT.
--
-- Os docs prometiam release imutável e auditoria append-only, e o banco não
-- garantia nada: bastava um `UPDATE` distraído para reescrever a história que
-- a auditoria existe para preservar. Garantia que mora só na disciplina do
-- código evapora no primeiro atalho — e numa plataforma que hospeda dados de
-- cliente, a auditoria é justamente o que se consulta quando algo deu errado.
--
-- APAGAR NÃO É PROIBIDO, É DELIBERADO. A LGPD dá ao titular o direito de ser
-- esquecido, então um livro-razão eterno seria ilegal, não rigoroso. A saída é
-- uma chave que alguém precisa girar de propósito, na mesma transação:
--
--   BEGIN;
--   SET LOCAL app.expurgo = 'on';
--   DELETE FROM organizations WHERE id = '...';  -- cascata leva o resto
--   COMMIT;
--
-- `SET LOCAL` morre com a transação, então a porta nunca fica encostada.
CREATE OR REPLACE FUNCTION impedir_mudanca_em_ledger() RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'UPDATE' THEN
		RAISE EXCEPTION
			'% é livro-razão: linha registrada não se altera. Registre um evento novo em vez de reescrever o antigo.',
			TG_TABLE_NAME;
	END IF;

	IF current_setting('app.expurgo', true) IS DISTINCT FROM 'on' THEN
		RAISE EXCEPTION
			'% é livro-razão: apagar exige expurgo explícito (SET LOCAL app.expurgo = ''on'' na mesma transação).',
			TG_TABLE_NAME;
	END IF;

	RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS releases_append_only ON releases;--> statement-breakpoint
CREATE TRIGGER releases_append_only
	BEFORE UPDATE OR DELETE ON releases
	FOR EACH ROW EXECUTE FUNCTION impedir_mudanca_em_ledger();
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_log_append_only ON audit_log;--> statement-breakpoint
CREATE TRIGGER audit_log_append_only
	BEFORE UPDATE OR DELETE ON audit_log
	FOR EACH ROW EXECUTE FUNCTION impedir_mudanca_em_ledger();
