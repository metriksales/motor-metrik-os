# Piloto — leitura de grupos WhatsApp

## Escopo atual

- Somente o grupo configurado em `GROUP_READER_ALLOWLIST`.
- Somente observação: não responde no WhatsApp, não altera CRM e não cria demanda no Notion.
- Persiste antes de responder `200` ao webhook.
- Deduplica por `(group_jid, message_id)`.
- Não guarda o JID/telefone completo do remetente: persiste HMAC e últimos quatro dígitos.
- Não baixa anexos nem transcreve áudios nesta fase; registra tipo e caption quando existirem.

## Endpoint

- Saúde pública sem conteúdo: `GET /api/group-reader`
- Entrada UAZAPI: `POST /api/group-reader?secret=...`
- Auditoria protegida: `GET /api/group-reader` com header `x-webhook-secret`

## Variáveis

- `GROUP_READER_WEBHOOK_SECRET`
- `GROUP_READER_HASH_SALT`
- `GROUP_READER_ALLOWLIST`
- `DATABASE_URL`

## Reversão

Desabilitar ou remover apenas o terceiro webhook do piloto na UAZAPI. Os demais webhooks não precisam ser alterados.
