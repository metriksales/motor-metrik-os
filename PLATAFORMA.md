# PLATAFORMA — Motor Metrik OS (o que existe e como conecta)

> Mapa do backend "pronto pra trabalhar". Doutrina de produto em `ORIENTACAO.md`; taxonomia em `ARQUITETURA.md`.

## A ideia em 1 frase
Uma **biblioteca de MOTORES** (peças reutilizáveis) que se combinam em **AGENTES** por **config**. O runtime lê o spec publicado, casa os motores pelo gatilho e roda cada um com **portas plugáveis** (cérebro/mãos/canal injetados). Nada de infra dentro do motor → nada engessa.

## Os pacotes (monorepo `packages/*` + `apps/*`)
```
@motor/core       ← CONTRATOS (a lei). AgentSpec + ports: Sender/Transport/LlmPort/CrmPort,
                    MotorEngine/MotorPorts/MotorManifest, MotorRegistry, RuntimeEvent/Log, Evals.
                    Regra de ouro: todo pacote depende SÓ de core; infra entra por porta.
@motor/messaging  ← PEÇAS de mensagem. Sender: MetaTemplate | LlmFreeform ·
                    Transport: GhlNative | UazapiMultiInstance (roteia por vendedor).
@motor/motors     ← BIBLIOTECA de motores: followup (cadência real), agenda, atendimento
                    + registry (match por gatilho + descritor do spec). defaultRegistry.
@motor/crm        ← MÃOS no CRM: GhlAdapter + KommoAdapter (fetch real) atrás do CrmAdapter.
@motor/llm        ← CÉREBRO: OpenAiBrain (Responses API) + FakeBrain (offline) + makeBrain.
@motor/evals      ← PORTEIRO: runEvals(casos, runner, limiar) → aprovado? (gate do sandbox).
@motor/samples    ← EXEMPLOS: Bia SDR, Cobrador de Equipe (= follow-up pros humanos), Petições.
@motor/db         ← Neon/Drizzle: organizations/memberships/agents/agent_specs/change_sets/
                    connections/releases/audit — TUDO por org_id.
@motor/control    ← Control API: listAgents/getAgent/createAgent/propor/aprovar/publicar(CAS)/
                    reverter/releases/connections/loadPublishedSpec. org_id sempre do servidor.
apps/runtime      ← Data Plane: pipeline (runEvent) + composição (wiring dev · host produção).
apps/web          ← Front (Vite+Clerk) + funções: /api/control /api/webhook /api/cron /api/health.
```

## Como um evento roda (o fluxo vivo)
```
canal → /api/webhook → handleInbound → runEvent(evt, deps)
  deps.loadSpec(org,agente)     → spec PUBLICADO (Neon, versão atual)
  deps.registry.match(evt,spec) → quais motores casam (gatilho + descritor ligado)
  deps.portsFor(org,agente)     → cérebro (llm) + mãos (crm via vault) + canal (sender/transport por config)
  cada motor.run(input, ports)  → faz o trabalho, loga (caixa-preta)
```
`config` do motor vem dos **módulos do spec** (`onde === motor.id`) — são os "botões" do cliente (ex.: `publico=humanos` transforma o follow-up em cobrança de time).

## O que JÁ funciona (verificado, sem Neon)
- **Typecheck verde** nos 8 pacotes/apps de backend.
- **`npm run smoke --workspace @motor/runtime`** → inbound na Bia agenda via tool; follow-up pros humanos dispara toque (mesmo motor, config diferente).
- **`npm run eval --workspace @motor/runtime`** → porteiro roda 4/4 offline (FakeBrain) e aprova.
- **Front + login multi-tenant (Clerk orgs)** no ar (modo demo sem chave).
- **CAS de versão** no publicar; **reverter** restore-forward; conexões só com `vaultRef`.

## O que falta pra ir 100% AO VIVO (precisa do mestre / decisões)
1. **Neon** (`DATABASE_URL` + `CONTROL_PLANE_SECRET`) → migração + seed → `/api/control` e `/api/webhook` saem do 503.
2. **Clerk** (Organizations + 2 chaves) → login real no lugar do demo.
3. **OpenAI** (`OPENAI_API_KEY`) → cérebro de verdade (senão FakeBrain).
4. **Vault de tokens por org** (o `VaultPort` já está definido) → as mãos no CRM ligam (hoje fail-open sem token).
5. **Redis (Upstash)** → estado da cadência/anti-eco por org (hoje em memória).
6. **Registro de cadência** (quem está em follow) → o `/api/cron` enumerar e disparar.
7. **Conferir endpoints reais** de GHL/Kommo com um token de teste (os adapters estão implementados; faltam os IDs vivos).

## Método de evolução (como crescemos sem quebrar)
Contrato novo → congela em `@motor/core`. Peça nova → pacote que depende só de core (motor/sender/transport/adapter). Integra → typecheck por pacote + smoke. **O build do deploy (front) não typa os pacotes** — a verdade é `tsc --noEmit -p <pacote>`.
