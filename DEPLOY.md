# Deploy — Motor Metrik OS (Vercel · domínio `metrik-os`, temporário)

Tudo num app só no Vercel: o front (Vite) + a Control API (funções em `apps/web/api/`) no mesmo domínio.

## Setup (uma vez)
1. **Vercel:** criar projeto apontando pro repo. **Root Directory = `motor-metrik-os/apps/web`**.
   Framework = Vite · Build = `npm run build` · Output = `dist`. As funções em `apps/web/api/*.ts` viram serverless automaticamente.
2. **Neon:** criar banco, pegar a `DATABASE_URL` (pooled).
3. **Env vars no Vercel:** ver `.env.example` — `DATABASE_URL` (agora), `WEBHOOK_SECRET`, `CRON_SECRET`, `RESEND_API_KEY` e os segredos da autenticação própria conforme as stories entregam. **Nada de segredo com prefixo `VITE_`:** o build falha de propósito se encontrar um (`vite.config.ts`).
4. **Migração:** com `DATABASE_URL` setado, rodar `npm run db:migrate --workspace @motor/db` (ou `drizzle-kit push`). O SQL já está gerado em `packages/db/drizzle/`.
5. **Domínio:** apontar `metrik-os.vercel.app` (ou o domínio que o mestre passar).

## Rotas
- `GET /api/health` → status.
- `POST /api/control?action=agents|createAgent|propor|changesets|aprovar|publicar|…`

### Como uma máquina autentica (S-003)
Agentes, Claude Code/Codex e automações usam **token de máquina por conta**:

```
Authorization: Bearer mos_<token>      (ou o header x-motor-token)
```

- O token é criado por alguém admin/owner da conta (`action=criarToken`, com `name` e `scopes`) e **aparece em claro uma única vez** — o banco guarda só o sha256.
- A **conta sai do token**, no servidor. Os headers `x-org-id` e `x-actor` são ignorados: eram a falha crítica da auditoria.
- **Escopos:** `log` (só ingerir execuções) · `leitura` · `mudanca` (propor e testar, sem publicar) · `admin` (tudo). Ação fora do escopo responde 403.
- Para revogar: `action=revogarToken` com o `id`. `action=tokens` lista os da conta.

## Auth & contas — autenticação própria (S-045), sem Clerk
Login e multi-conta são nossos, em `apps/web/api/auth.ts` + `packages/control`:

- **Sem senha:** a pessoa digita o e-mail, recebe um código de 6 dígitos (vale 10 minutos, uso único) e entra.
- **Sessão em cookie `httpOnly`** com token opaco guardado em sha256. "Sair" revoga de verdade — não dá para fazer isso com JWT.
- **CSRF por dupla submissão** (`mos_csrf` + header `x-csrf-token`) e conferência de origem em toda escrita. O cookie viaja sozinho; o header, não.
- **Conta ativa vive na sessão**, no servidor. Trocar de conta só funciona para conta de que a pessoa participa.
- **Convite por e-mail**: quem tem permissão de gerenciar convida; o aceite exige que quem entrou seja o dono daquele e-mail.

**Env necessárias:** `RESEND_API_KEY` e `EMAIL_FROM` (produção). Sem a chave, a porta de e-mail entra em **modo seco**: nada é enviado e o código aparece no log — é assim que dev e preview funcionam.

**Modo vitrine:** `VITE_ALLOW_DEMO=1` publica a demonstração de propósito. Sem ele, quem não tem sessão vê a tela de entrada, nunca a maquete.

## Nota de monorepo
As funções importam packages TS do workspace (`@motor/control` → `@motor/db`/`@motor/core`). O bundler de funções do Vercel transpila TS; se precisar, fixar `nodejs20.x` e conferir o trace dos `@motor/*`.

## Próximos passos
O planejamento vive no [`PLANO-DIRETOR.md`](PLANO-DIRETOR.md) e o estado de cada frente no [`STORIES.md`](STORIES.md). Em resumo, o que ainda falta para atender um cliente real: cofre de credenciais (S-025), RLS (S-011), publicação atômica (S-008), porteiro de verdade (S-009) e o runtime multi-tenant com o motor da skill (S-023).
