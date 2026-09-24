# Motor Metrik OS — Backend / Estrutura Multi-tenant (SaaS)

> Planta do backend. **Motor = a skill `agente-ia-metrik-completo`** (não reinventar); o backend **orquestra e governa**. Segue a doutrina do control-plane v2 já provada no dogfood (Neon + Clerk + CAS).

## Princípios (as leis)
- **Multi-tenant de verdade:** 1 app + 1 runtime **compartilhados**; por-tenant = só os **DADOS** (AgentSpec, credenciais, storage, logs), tudo com `org_id`. **Nunca clonar infra por cliente** (senão vira agência com dashboard, não SaaS).
- **Fonte única / ledger:** toda mudança vira **ChangeSet** auditável. `org_id` é **derivado no servidor** (da sessão), **nunca vem do browser**.
- **Sem gargalo por construção:** stateless serverless + Postgres com pooler + Redis no hot path + filas pro pesado + **runtime lê config em cache** (não bate no DB por mensagem).
- **Motor não depende do control plane por mensagem:** usa a última config publicada (cache) + heartbeat/ACK. Se o control plane cair, o atendimento continua.

## Dois planos
### 1) Control Plane — o cérebro do SaaS
- **Auth/Identidade:** Clerk (Organizations + Users + Roles: `owner/admin/operator/viewer`). `org_id`/role da sessão, server-side. **Service tokens** pra Claude Code/Codex (acesso máquina).
- **DB:** Postgres (**Neon**) — fonte de verdade durável, JSONB versionado, auditoria append-only **garantida por gatilho** (S-010), não por disciplina.
- **Vault:** credenciais (token GHL/Kommo, etc.) **criptografadas por tenant**, nunca no browser.
- **Control API** (porta ÚNICA — front, Claude, Codex, API externa usam a mesma): `inspecionar · propor(ChangeSet) · testar(evals) · publicar(release) · reverter`.
- **Redis (Upstash):** locks (compare-and-swap por revisão), **filas**, **cache da config publicada**, rate-limit, pausa TTL. NÃO é o banco durável.

### 2) Data Plane — o Motor / runtime (a skill)
- Runtime **compartilhado e versionado**. Carrega o **AgentSpec PUBLICADO** do cache. Inbound: webhook CRM/WhatsApp → identifica `tenant+agente` → carrega spec → LLM + tools → escreve no CRM via **adapter** → **loga execução**.
- **Adapter GHL/Kommo** (uma língua: `moverEtapa/preencherCampo/agendar/tag…`, duas APIs). Integrações: AdvBox (polling), ZapSign, GCal, uazapi.
- **Rotinas** (cron/QStash): follow-up scheduler, análise diária, recuperação.

## Modelo de dados (Postgres — TUDO com `org_id`)
- `organizations` (tenant): id, name, plan, status
- `memberships`: org_id, user_id, role
- `agents`: id, org_id, name, tipo(resposta|acao), state
- `agent_specs`: id, agent_id, version, spec JSONB (prompt, motores, módulos, features, integrações, regras), status(draft|published), origin, created_by
- `change_sets` (**mutável, de propósito**): id, org_id, agent_id, origin(hub_chat|hub_visual|claude_code|codex|api), actor, intent, patch, before/after, impacto, evals, approval, status
- `connections`: id, org_id, kind(ghl|kommo|whatsapp|advbox|zapsign|gcal), cred(ref vault), status, meta
- `releases` (**imutável de verdade**: gatilho recusa UPDATE): id, org_id, agent_id, spec_version, runtime_version, eval_run, git_sha — único por `(agent_id, spec_version)`
- `executions`/logs: hot em Redis/analytics, resumo em Postgres
- `audit_log`: **append-only de verdade** (gatilho recusa UPDATE; DELETE só com expurgo explícito)

### O que o banco garante, e o que ele não garante (S-010)

Antes desta story, "append-only" e "imutável" eram promessa de documento: o
banco aceitava qualquer `UPDATE`. Hoje:

| Tabela | Regra no banco |
| :--- | :--- |
| `releases` | gatilho recusa UPDATE e DELETE; único por `(agent_id, spec_version)` |
| `audit_log` | gatilho recusa UPDATE e DELETE |
| tabelas de conta | chave estrangeira para `organizations`, com cascata |
| `connections` | uma por tipo por conta — **exceto WhatsApp**, onde dois números é caso real |

**`change_sets` NÃO é append-only, e isso é decisão, não esquecimento.** Uma
mudança nasce `draft` e caminha por `evaluated`, `approved` e `published`: o
estado da linha é o próprio andamento, e travá-la exigiria uma segunda tabela
de transições sem ganho nenhum hoje. O que precisa ser imutável é o resultado
— `releases` — e esse está trancado. A auditoria de quem mexeu mora em
`audit_log`, que também está.

**Apagar é possível, mas tem que ser deliberado.** A LGPD dá ao titular o
direito de ser esquecido, então livro-razão eterno seria ilegal, não rigoroso.
Para apagar uma conta inteira:

```sql
BEGIN;
SET LOCAL app.expurgo = 'on';
DELETE FROM organizations WHERE id = '...';  -- a cascata leva o resto
COMMIT;
```

`SET LOCAL` morre junto com a transação, então a porta nunca fica encostada.

**`runtime_logs.agent_id` continua sem chave estrangeira**, de propósito: o log
de execução precisa sobreviver a qualquer reorganização da frota. O `org_id`
dele, esse sim, tem.

## Escala / sem gargalo (as travas concretas)
- **Serverless stateless** (Vercel/edge) → escala horizontal, sem servidor único.
- **Postgres com pooler** (Neon serverless driver / PgBouncer) → não estoura conexão (o gargalo clássico de serverless+PG).
- **Runtime lê config em CACHE** (Redis/edge) → **0 query no DB por mensagem**. Config é empurrada pro cache no release.
- **Filas** (QStash) pro pesado (evals, follow-up, análise diária, envios) → absorve pico, retry, **idempotência**.
- **Idempotency key** em toda escrita (`ActionRun`) → nada duplica (a dor de "não duplicar" resolvida na raiz).
- **Isolamento por `org_id`** em tudo (+ RLS/Row-Level Security) → zero vazamento cross-tenant, zero infra por cliente.
- **Rate-limit por tenant** → cliente barulhento não derruba os outros.
- **Custo LLM:** triagem determinística **zero-token por execução** + análise pesada **1×/dia** (a cadência já definida).

## A esteira de uma mudança (governada)
`pedido (chat/voz/botão/Claude/Codex) → ChangeSet → simular/evals → aprovar → release IMUTÁVEL → runtime ACK → log/histórico`.
Regra: `rascunho ≠ produção · eval pedido ≠ aprovado · deploy ≠ E2E`. Escrita no Postgres com **compare-and-swap** pela revisão.

## Stack (o que já é decisão da casa)
Front (este projeto) · **Control API + Clerk (auth) + Neon (Postgres) + Upstash (Redis/filas) + Vault** · **Data Plane** (runtime serverless — já existe no dogfood). Parte pronta: control-plane v2 em `metrik-sales-layer` (Neon+Clerk+CAS), agente GHL serverless. Conexão CRM = **token (PIT/OAuth) faz 100% do dado**; app do marketplace é opcional.
