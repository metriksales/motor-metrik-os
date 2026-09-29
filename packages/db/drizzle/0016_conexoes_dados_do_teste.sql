-- O que o provedor CONTOU no último teste (S-019, segunda rodada).
--
-- A frase (`ultimo_teste_detalhe`) é para ler; isto é para mostrar: nome do
-- perfil, número, foto de perfil no WhatsApp; nome da subconta no GHL; nome
-- da conta no Kommo. Sem persistir, a foto aparecia só na resposta do clique
-- e sumia no próximo carregamento — a tela ficava mais pobre ao recarregar
-- do que logo depois de testar.
ALTER TABLE connections ADD COLUMN IF NOT EXISTS ultimo_teste_dados jsonb;
