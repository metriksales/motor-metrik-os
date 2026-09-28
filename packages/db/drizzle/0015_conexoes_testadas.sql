-- Conexões testadas (S-019): o status de uma conexão vem de um TESTE, nunca do cadastro.
--
-- O QUE ESTAVA ERRADO. `upsertConnection` gravava `status = 'connected'` no ato
-- de cadastrar — sem ter perguntado nada a ninguém. A tela mostrava "ligado"
-- para uma instância de WhatsApp que passou uma hora desconectada em 28/09, e
-- o sistema SABIA como perguntar (`GET /instance/status`) e nunca perguntou.
--
-- O DESENHO. Quatro estados, e só eles:
--   nao_testada     cadastrada, e ninguém perguntou ainda
--   sem_credencial  perguntou, e não havia credencial no cofre para perguntar com
--   ok              o provedor respondeu que está de pé (com data)
--   falha           o provedor respondeu que não, ou não respondeu (com data e motivo)
-- A data e o motivo ficam ao lado. Um status de teste sem data é contradição,
-- e o banco recusa — assim como recusa qualquer 'connected' que volte a
-- aparecer por um caminho esquecido.

ALTER TABLE connections ADD COLUMN IF NOT EXISTS ultimo_teste_em timestamptz;--> statement-breakpoint
ALTER TABLE connections ADD COLUMN IF NOT EXISTS ultimo_teste_detalhe text;--> statement-breakpoint

-- o que já existe nunca foi testado; 'connected' era o cadastro se declarando ligado
UPDATE connections SET status = 'nao_testada'
	WHERE status NOT IN ('nao_testada', 'sem_credencial', 'ok', 'falha');--> statement-breakpoint
ALTER TABLE connections ALTER COLUMN status SET DEFAULT 'nao_testada';--> statement-breakpoint

ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_status_vem_de_teste;--> statement-breakpoint
ALTER TABLE connections ADD CONSTRAINT connections_status_vem_de_teste
	CHECK (status IN ('nao_testada', 'sem_credencial', 'ok', 'falha'));--> statement-breakpoint

ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_teste_tem_data;--> statement-breakpoint
ALTER TABLE connections ADD CONSTRAINT connections_teste_tem_data
	CHECK (status = 'nao_testada' OR ultimo_teste_em IS NOT NULL);
