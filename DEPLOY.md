# Deploy — Motor Metrik OS (Vercel · domínio `metrik-os`, temporário)

Tudo num app só no Vercel: o front (Vite) + a Control API (funções em `apps/web/api/`) no mesmo domínio.

## Setup (uma vez)
1. **Vercel:** criar projeto apontando pro repo. **Root Directory = `motor-metrik-os/apps/web`**.
   Framework = Vite · Build = `npm run build` · Output = `dist`. As funções em `apps/web/api/*.ts` viram serverless automaticamente.
2. **Neon:** criar banco, pegar a `DATABASE_URL` (pooled).
3. **Env vars no Vercel:** `DATABASE_URL`, `CONTROL_PLANE_SECRET` (agora); `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `UPSTASH_*` (próximos slices). Ver `.env.example`.
4. **Migração:** com `DATABASE_URL` setado, rodar `npm run db:migrate --workspace @motor/db` (ou `drizzle-kit push`). O SQL já está gerado em `packages/db/drizzle/`.
5. **Domínio:** apontar `metrik-os.vercel.app` (ou o domínio que o mestre passar).

## Rotas
- `GET /api/health` → status.
- `POST /api/control?action=agents|createAgent|propor|changesets|aprovar|publicar`
  - headers (temporário, até Clerk): `x-motor-token: <CONTROL_PLANE_SECRET>`, `x-org-id: <org>`, `x-actor: <quem>`.

## Nota de monorepo
As funções importam packages TS do workspace (`@motor/control` → `@motor/db`/`@motor/core`). O bundler de funções do Vercel transpila TS; se precisar, fixar `nodejs20.x` e conferir o trace dos `@motor/*`.

## Próximos slices
1. **Clerk** (auth + orgs) substitui a auth temporária — `org_id` vem da sessão, nunca do header.
2. **Ligar o runtime** (`apps/runtime`) nas libs `common/ghl/kommo` da skill `agente-ia-metrik-completo` + cache de config no Redis.
3. **CAS + transação** no `publicar()` e push da config publicada pro cache.
