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

## Auth & Tenants (Clerk) — front JÁ ligado, env-gated
O login e a **multi-tenência** já estão no front (`apps/web/src/main.tsx` + `lib/auth.tsx`), ligando quando as chaves existem:
- **1 organização Clerk = 1 tenant (cliente).** Sem org ativa, o app exige criar/escolher uma (`<OrganizationList>`).
- **Modo demo (sem chave):** abre direto com 1 org fake ("Vega Consultoria") + pill **Demo** — pra desenvolver sem Clerk.
- O front manda o **token da sessão** (Bearer) pro `/api/control`; o `resolveCtx` tira o `org_id` do token (nunca do header). `org_id` scoping é a base do isolamento por cliente.

**Pra ativar (quando o mestre mandar as chaves):**
1. No dashboard do Clerk: **habilitar Organizations** (senão o gate de org não funciona).
2. Env no Vercel: `VITE_CLERK_PUBLISHABLE_KEY` (client) + `CLERK_SECRET_KEY` (server).
3. Redeploy. A partir daí: login obrigatório, org = tenant, `OrganizationSwitcher` na sidebar, `UserButton` no header.

## Nota de monorepo
As funções importam packages TS do workspace (`@motor/control` → `@motor/db`/`@motor/core`). O bundler de funções do Vercel transpila TS; se precisar, fixar `nodejs20.x` e conferir o trace dos `@motor/*`.

## Próximos slices
1. ~~**Clerk** (auth + orgs)~~ ✅ front ligado (env-gated). Falta só: habilitar Organizations no Clerk + setar as 2 chaves no Vercel.
2. **Neon**: setar `DATABASE_URL` + `CONTROL_PLANE_SECRET` → rodar migração/seed → a Control API sai do 503 e o front passa a ler dados reais por org.
3. **Ligar o runtime** (`apps/runtime`) nas libs `common/ghl/kommo` da skill `agente-ia-metrik-completo` + cache de config no Redis.
4. **CAS + transação** no `publicar()` e push da config publicada pro cache.
