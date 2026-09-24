# Stories — Metrik-OS

A bancada hospedada onde um agente construtor monta, mantém e audita agentes de IA que trabalham dentro do CRM do cliente (GHL, Kommo, WhatsApp).

Atualizado em 2026-09-23 14:05.

> Produto: [`PRODUTO.md`](PRODUTO.md) · Fases e ordem: [`PLANO-DIRETOR.md`](PLANO-DIRETOR.md).
> Reescrito em 2026-09-23 para o modelo **totalmente hospedado na Metrik**. As stories escritas para o modelo de auto-hospedagem foram canceladas com o motivo (S-018) ou reescritas (S-023, S-028).

## Resumo

| ID | Story | Fase | Status |
| :--- | :--- | :--- | :--- |
| S-001 | Auditoria técnica de base | — | concluido |
| S-002 | Esteira de qualidade: CI, lint e testes | 0 | backlog |
| S-003 | Auth de máquina por conta, sem segredo no browser | 0 | backlog |
| S-004 | Webhook de entrada fail-closed com tenant do servidor | 0 | backlog |
| S-005 | Tools da IA presas ao contato da conversa | 0 | backlog |
| S-006 | Isolamento, permissões e erros no control plane | 0 | backlog |
| S-007 | Tela honesta: nenhum dado demo fora do modo demo | 0 | backlog |
| S-008 | Publicação atômica e à prova de concorrência | 1 | backlog |
| S-009 | Porteiro de verdade: eval obrigatório e fiel à produção | 1 | backlog |
| S-010 | Integridade do banco: FKs, uniques e ledger append-only | 1 | backlog |
| S-011 | Isolamento no banco com RLS | 1 | backlog |
| S-012 | Observabilidade do control plane e do runtime | 1 | backlog |
| S-013 | Front enxuto: código morto, tipos e lint | 1 | backlog |
| S-014 | Dados ao vivo com um só polling e fuso fixo | 1 | backlog |
| S-015 | Studio utilizável no celular | 3 | backlog |
| S-016 | Decisão D-1: papel do OS frente aos agentes no ar | — | cancelado |
| S-017 | Definição de produto v1 | — | concluido |
| S-018 | Frota que se reporta ao OS | — | cancelado |
| S-019 | Conexões reais com teste e status verdadeiro | 2 | backlog |
| S-020 | Controles de operador: parada, recado, pausa e assumir | 2 | backlog |
| S-021 | Métricas que o cliente paga | 4 | backlog |
| S-022 | Permissões e modo desenvolvedor | 3 | backlog |
| S-023 | Runtime multi-tenant: extrair o motor da skill (GHL + Kommo) | 2 | backlog |
| S-024 | Estado, filas e idempotência no Redis | 2 | backlog |
| S-025 | Cofre de credenciais por conta | 1 | backlog |
| S-026 | Canais reais de entrada e saída | 2 | backlog |
| S-027 | Resiliência e custo das integrações | 2 | backlog |
| S-028 | Migrar os clientes atuais para a plataforma | 4 | backlog |
| S-029 | Leitor de grupos: fechar o piloto | 1 | backlog |
| S-030 | Catálogo de módulos | 3 | backlog |
| S-031 | Escola: correção do cliente vira regra, exemplo ou tarefa | 3 | backlog |
| S-032 | Onboarding de conta | 4 | backlog |
| S-033 | Planos e cobrança | 4 | adiado |
| S-034 | Servidor MCP da plataforma | 3 | backlog |
| S-035 | Manifesto de módulo e motor de configuração | 1 | backlog |
| S-036 | Studio: o agente construtor interno | 3 | backlog |
| S-037 | Painéis declarativos (A2UI) | 3 | backlog |
| S-038 | Logs: tabela única de auditoria | 3 | backlog |
| S-039 | Composição de módulos (gatilho → ação) | 3 | backlog |
| S-040 | Conectores declarativos e MCP de terceiros | 3 | backlog |
| S-041 | Orientação sob demanda a partir da skill | 3 | backlog |
| S-042 | Página Início | 3 | backlog |
| S-043 | Página do agente | 3 | backlog |
| S-044 | Página Conta e Conexões | 3 | backlog |
| S-045 | Autenticação e gestão de usuários própria | 1 | backlog |

---

## S-001 · Auditoria técnica de base

- **status:** concluido
- **criado:** 2026-09-21 14:34
- **atualizado:** 2026-09-21 15:47

**Missão.** Saber, com evidência de código, o que o sistema realmente faz hoje antes de planejar — os docs prometem mais do que o código entrega.

**Escopo.** Leitura integral de `apps/web`, `apps/runtime` e `packages/*`, varredura de segredos no histórico git e confronto com a skill `agente-ia-metrik-completo`. Sem execução: não havia Node.js na máquina.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `PLANO-DIRETOR.md` → Apêndice A | rastreio de cada achado até a story que o resolve |

**Relacionados.** Origina as demais stories.

**Checklist**

- [x] Ler control plane, data plane e front por completo
- [x] Varrer o histórico git por segredos
- [x] Conferir pessoalmente os achados críticos
- [x] Confrontar o runtime com a skill-motor
- [x] Registrar achados rastreáveis no plano diretor

**Notas.** Verificado por leitura de código no commit `55a7025`; build, typecheck e testes **não** foram executados. Segredos: histórico limpo; só um JID real de grupo em `apps/web/tests/group-reader.test.ts:11`.

---

## S-002 · Esteira de qualidade: CI, lint e testes

- **status:** em-andamento
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 13:05

**Missão.** Nada impede um commit quebrado de ir ao ar: o build de deploy não tipa os pacotes, não há lint e só existe um teste. Toda correção das fases seguintes precisa de uma esteira que prove que funciona e continua funcionando.

**Escopo.** GitHub Actions com typecheck de todos os workspaces, lint e testes em todo PR e push no `main`; runner único de testes com o primeiro teste do control plane. Não inclui testes de ponta a ponta com CRM real.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `.github/workflows/ci.yml` | pipeline: typecheck, lint, testes e build |
| `package.json` (raiz) | scripts `typecheck`, `lint`, `test`, `ci`; `engines: node >=22` |
| `scripts/typecheck.mjs` | roda `tsc --noEmit` nos 12 alvos e só falha no fim |
| `eslint.config.js` | flat config com typescript-eslint + react-hooks |
| `vitest.config.ts` | runner único do monorepo |
| `packages/core/tsconfig.json` | criado — o pacote não tinha |
| `apps/web/tsconfig.node.json` | criado — cobre `vite.config.ts`, `server/`, `tests/`, `scripts/` |

**Relacionados.** Destrava a verificação de todas as outras stories.

**Checklist**

- [x] `npm run typecheck` na raiz cobre todos os workspaces e passa
- [x] `apps/web/api/*.ts` e `vite.config.ts` entram no typecheck
- [x] ESLint com `react-hooks/exhaustive-deps` ligado (como aviso)
- [x] Runner único (Vitest); o teste do group-reader roda nele
- [x] JID real trocado por fictício no teste
- [ ] CI verde num PR de teste e obrigatória no `main`

**Notas.** Verificado nesta máquina com Node v24.19.0: `npm run ci` sai com código 0 — typecheck em **12 alvos** (8 pacotes, runtime, front, `api/` e o alvo `tsconfig.node.json`), lint com **0 erros e 95 avisos**, **5 testes** passando, e `npm run build:web` gerando os bundles das funções e o `dist`.

Os 95 avisos são a dívida que a auditoria mapeou (≈50 `any`, variáveis sem uso, deps de efeito). Ficam como **aviso** de propósito, para a CI poder passar hoje; viram **erro** quando as S-013 e S-014 limparem. Os 8 `eslint-disable` de `exhaustive-deps` continuam no lugar pelo mesmo motivo — revisá-los é trabalho da S-014.

Falta só o último item: a CI precisa rodar uma vez num PR para o GitHub conhecer o nome da checagem, e só então dá para exigi-la no `main`.

---

## S-003 · Auth de máquina por conta, sem segredo no browser

- **status:** concluido
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 13:12

**Missão.** Um único `CONTROL_PLANE_SECRET` dá papel admin em **qualquer** conta, escolhida pelo header `x-org-id`. Com a plataforma hospedando as credenciais e as conversas de todos os clientes, esse caminho é inaceitável.

**Escopo.** Tokens de máquina por conta, com hash no banco, conta derivada do token e escopo de ações. Remover o fallback `VITE_MOTOR_TOKEN` do browser. Base de autenticação que o MCP (S-034) vai reusar.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `packages/control/src/tokens.ts` | criado — parte pura: geração, hash, extração do pedido, escopos |
| `packages/control/src/tokens.test.ts` | criado — 7 testes |
| `packages/control/src/index.ts` | `criarMachineToken`, `listarMachineTokens`, `revogarMachineToken`, `resolverMachineToken`; `Ctx` ganhou `via` e `scopes` |
| `packages/db/src/schema.ts` | tabela `machine_tokens` (hash único, escopos, revogação, FK da conta) |
| `packages/db/drizzle/0005_silent_rockslide.sql` | migração gerada |
| `apps/web/api/_auth.ts` | reescrito: conta vem do token, headers ignorados |
| `apps/web/api/control.ts` | escopo exigido por ação + rotas `criarToken`/`tokens`/`revogarToken` |
| `apps/web/src/lib/api.ts`, `src/vite-env.d.ts` | fallback `VITE_MOTOR_TOKEN` removido |
| `apps/web/vite.config.ts` | build falha com `VITE_*` que pareça segredo; dev server só em `localhost` |
| `.env.example`, `DEPLOY.md` | `CONTROL_PLANE_SECRET` removido; documentado como máquina autentica |

**Relacionados.** Depende de S-002. Destrava S-034. O modelo de escopos é provisório até as permissões finas da S-022.

**Checklist**

- [x] Tabela de tokens com hash, conta, escopos, criação e revogação
- [x] `resolveCtx` resolve a conta pelo token; `x-org-id` é ignorado
- [x] Token fora do escopo recebe 403
- [x] `VITE_MOTOR_TOKEN` removido; build de produção falha se a variável existir
- [x] `CONTROL_PLANE_SECRET` global retirado
- [ ] Teste de ponta a ponta contra o banco: token da conta A não alcança a conta B

**Notas.** Verificado: `npm run ci` verde (12 alvos de typecheck, 0 erros de lint, **12 testes**, sendo 7 novos de token) e `npm run build:web` gerando bundle **sem** nenhum vestígio de `x-motor-token` ou `VITE_MOTOR_TOKEN` (conferido com busca no `dist`).

Decisões tomadas aqui:
- Token no formato `mos_` + 32 bytes; o banco guarda **sha256**, e a busca é por hash — não há comparação de segredo em tempo linear, então a questão de tempo constante deixa de existir neste caminho.
- Escopos `log` · `leitura` · `mudanca` · `admin`, com `admin` implicando os demais. A tabela ação → escopo mora em `apps/web/api/control.ts`.
- O `papelDoToken` é uma ponte provisória: enquanto o control plane decide por papel, um token vira `viewer`, `operator` ou `admin`. A S-022 troca isso por permissão de verdade.

**O que ficou faltando:** o último item do checklist exige um Neon de teste, que ainda não existe nesta máquina. O caminho está coberto por tipos e pelos testes da parte pura, mas **o isolamento entre contas ainda não foi exercitado contra um banco real** — fica para a S-006, que monta os testes de isolamento.

---

## S-004 · Webhook de entrada fail-closed com tenant do servidor

- **status:** concluido
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 13:20

**Missão.** Sem `WEBHOOK_SECRET` configurado, qualquer pessoa dispara chamadas pagas de IA e grava execuções em qualquer conta, escolhendo a conta no corpo da requisição. Com a plataforma recebendo os webhooks de todos os clientes, essa é a porta da frente.

**Escopo.** Segredo obrigatório (sem ele, 503), segredo por conexão, conta e agente resolvidos no servidor a partir da conexão. Os formatos de cada provedor ficam no S-026.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `packages/control/src/webhooks.ts` | criado — parte pura: geração, hash e extração do segredo |
| `packages/control/src/webhooks.test.ts` | criado — 5 testes |
| `packages/control/src/index.ts` | `criarSegredoDeEntrada`, `resolverEntrada` |
| `packages/db/src/schema.ts` → `connections` | colunas `inbound_secret_hash` (única) e `agent_id` |
| `packages/db/drizzle/0006_awesome_victor_mancha.sql` | migração gerada |
| `apps/web/api/webhook.ts` | reescrito: fail-closed, tenant do servidor, erro sem vazamento |

**Relacionados.** Depende de S-002. Relaciona-se com S-024 (dedupe) e S-026 (formato de cada provedor).

**Checklist**

- [x] Sem segredo válido → 401, sem chamar IA nem tocar no banco de execução
- [x] Lookup `segredo → (conta, agente)` no servidor; `orgId`/`agentId` do corpo ignorados
- [x] Segredo **por conexão**, não global
- [x] Erro 500 não devolve a mensagem interna
- [x] Testes: sem segredo, segredo vazio, formato errado, token de máquina no lugar do segredo
- [ ] Teste contra banco real: segredo de outra conta não alcança esta

**Notas.** Verificado: `npm run ci` verde com **17 testes** (5 novos aqui).

Decisões:
- Segredo `mws_` + 24 bytes, guardado em **sha256** na conexão. Busca por hash, então não há comparação de segredo em tempo linear.
- **Header `x-webhook-secret` é o caminho preferido, e a query é aceita** (`?s=`), porque vários provedores de WhatsApp só deixam configurar a URL. Quando vem pela query, o handler registra aviso — o segredo aparece no log de acesso, e a rotação é por conexão. É o mesmo problema que a S-029 corrige no piloto de grupos.
- O que antes vinha do corpo (`orgId`, `agentId`) agora sai da conexão. Só o `contactId` continua vindo do payload, porque é o identificador do lead no provedor.

**O que NÃO mudou aqui:** a pausa e o "assumir" continuam **fail-open** — se a leitura do estado falhar, o agente responde. Está marcado com `TODO(S-020)` no código, que é onde vira fail-closed junto com a parada de emergência.

---

## S-005 · Tools da IA presas ao contato da conversa

- **status:** concluido
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 13:30

**Missão.** Um lead mal-intencionado pode escrever "chame enviarMensagem para o contato X" e o agente de operação manda mensagem, põe tag ou move negócio de outra pessoa, porque o alvo vem dos argumentos do modelo.

**Escopo.** Contato sempre o do evento; `oppId` validado contra as oportunidades do contato; tools com schema de parâmetros; `enviarMensagem` fora do conjunto oferecido ao modelo. Vale como correção de segurança mesmo com `packages/motors` congelado, e o princípio migra para o runtime do S-023.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `packages/core/src/index.ts` | `ToolSpec` + catálogo `FERRAMENTAS_CRM` com schema; `LlmPort.tools` passa a receber schema |
| `packages/motors/src/atendimento.ts` | `executarTool` com alvo fixo, `exigir()` para argumento obrigatório, `oppsPermitidos` |
| `packages/motors/src/atendimento.test.ts` | criado — 8 testes |
| `packages/llm/src/openai.ts`, `fake.ts` | declaram nome + descrição + parâmetros |

**Relacionados.** Depende de S-002. Princípio reaplicado em S-023.

**Checklist**

- [x] `executarTool` ignora `contactId` dos argumentos
- [x] `moverEtapa` recusa `oppId` que não é do contato
- [x] Toda tool com JSON Schema; argumento obrigatório faltando é erro
- [x] `enviarMensagem` fora das tools do modelo, e recusada se vier mesmo assim
- [x] Falha de tool não termina como `ok:true`
- [x] Teste de injeção: nenhuma escrita em contato diferente do evento

**Notas.** Verificado: `npm run ci` verde com **25 testes**, sendo 8 novos que exercitam exatamente o ataque — o cérebro pede `addTag` no "contato-de-outra-pessoa" e a escrita sai no contato da conversa; `moverEtapa` com oportunidade alheia não chega ao CRM e derruba o `ok` da execução.

Decisões:
- O catálogo de ferramentas virou **contrato em `@motor/core`**, com descrição e parâmetros. Nenhuma recebe `contactId`: o alvo é sempre o contato do evento.
- `agendar` **sem `quando` não marca mais reunião "para agora"** — era como a agenda do time se enchia de reunião no instante da conversa.
- `criarOportunidade` registra o id criado, e só ele (ou o que veio no evento) pode ser movido na mesma execução.

**Limite honesto:** a validação de `oppId` é por **lista do que o runtime conhece**, não por consulta ao CRM — o `CrmPort` não tem como listar as oportunidades de um contato. Quando os adapters ganharem essa consulta (S-023), a checagem passa a ser contra o CRM vivo. Até lá, uma oportunidade legítima que não veio no evento é recusada: erra para o lado seguro.

---

## S-006 · Isolamento, permissões e erros no control plane

- **status:** em-andamento
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 13:52

**Missão.** Há escritas sem filtro de conta, ações que aceitam agente de outra conta e papéis que não são aplicados. Numa plataforma hospedada multi-tenant, isso é a falha que encerra a confiança de uma vez.

**Escopo.** Filtro de conta em todo `where` e join, validação de posse, checagem de permissão por ação (a lista fina é do S-022), erros de domínio em 4xx e 5xx genérico com id de correlação.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `packages/control/src/erros.ts` | criado — `EntradaInvalida` 400, `SemPermissao` 403, `NaoEncontrado` 404, `Conflito` 409 |
| `packages/control/src/permissoes.ts` | criado — matriz papel → permissão |
| `packages/control/src/permissoes.test.ts` | criado — 5 testes |
| `packages/control/src/isolamento.test.ts` | criado — 8 testes contra Postgres real |
| `packages/control/src/index.ts` | `exigirAgenteDaConta`, permissão por ação, join e update com filtro de conta |
| `packages/db/src/client.ts` | driver `pg` opcional (`DB_DRIVER=pg`) só para teste |
| `apps/web/api/control.ts` | erro de domínio → 4xx, 5xx genérico com id, mutação só por POST, `limit` validado |
| `.github/workflows/ci.yml` | serviço Postgres + migração antes dos testes |

**Relacionados.** Depende de S-002. Complementado por S-011 (RLS) e S-022 (permissões por pessoa).

**Checklist**

- [x] Todo `update`/`delete`/`join` filtra pela conta do contexto
- [x] Ações que recebem `agentId` confirmam a posse (`exigirAgenteDaConta`)
- [x] Toda ação declara a permissão que exige
- [x] Mutações só por POST
- [x] Erros de domínio em 4xx; 5xx genérico com id de correlação
- [x] Testes de isolamento entre contas contra banco real
- [ ] Limite de chamadas de IA por conta

**Notas.** Verificado nesta máquina: `npm run ci` verde — **30 testes passando e 8 pulados**, que são justamente os de isolamento: eles exigem banco e esta máquina não tem Postgres nem Docker. Na CI eles rodam contra um `postgres:16` de serviço, com as migrações aplicadas antes. **Enquanto a CI não rodar uma vez, o isolamento continua verificado só por leitura de código.**

Correções concretas dos achados da auditoria:
- o `update` de changeSet no publicar agora filtra por conta (antes, com o id, um admin marcava como publicada a mudança de outra conta);
- o join do sino de pendências filtra a conta do agente (antes vazava o nome de agente alheio);
- `proporMudanca` e `registrarLog` confirmam que o agente é da conta;
- `aprovarMudanca` exige permissão de publicar (antes bastava não ser viewer) e falha com 404 quando não atualiza nada — antes gravava auditoria mesmo sem ter mudado coisa alguma;
- `registrarLog` recusa `valorCentavos` que não seja inteiro não negativo, e exige permissão de operar quando vem de pessoa.

**O que ficou faltando:** limite de chamadas de IA por conta. É contenção de custo, não de segurança, e casa melhor com o orçamento por conta da S-027.

---

## S-007 · Tela honesta: nenhum dado demo fora do modo demo

- **status:** backlog
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Missão.** O painel promete "o que a IA fez de verdade", mas um cliente logado pode ver agentes fictícios, "212 atendimentos · R$ 7.500" e integrações "no ar e funcionando" que nunca foram ligadas. Um número falso destrói a credibilidade de todos os verdadeiros.

**Escopo.** Estado inicial vazio no logado; estados de carregando, erro e vazio no lugar do fallback demo; agente real herdando só aparência; telas ainda de maquete escondidas fora do demo; `live-run` fora do banco de produção.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `apps/web/src/lib/agents.tsx:27-52, 86` | estado inicial e herança |
| `apps/web/src/lib/live.ts` | expor `erro` |
| `apps/web/src/views/Inicio.tsx`, `FechamentoDia.tsx`, `AoVivo.tsx` | fallbacks demo |
| `apps/web/src/views/Conexoes.tsx`, `Modulos.tsx`, `Admin.tsx` | maquetes |
| `apps/web/src/App.tsx:160-170, 242, 254` | indicadores fixos |
| `apps/runtime/src/live-run.ts` | execuções sintéticas |
| `apps/web/src/main.tsx:20-23` | produção caindo em demo |

**Relacionados.** Depende de S-002. S-019, S-030 e S-042 devolvem essas telas com dado real.

**Checklist**

- [ ] Estado inicial vazio quando não é demo; skeleton aparece
- [ ] Helper único de fallback + teste garantindo que nada demo vaza no logado
- [ ] `useLive` expõe erro e a tela mostra o erro em vez de números
- [ ] Telas de maquete fora da navegação do logado
- [ ] `live-run` exige banco de dev
- [ ] Build de produção com modo demo ligado falha (salvo `VITE_ALLOW_DEMO=1`); enquanto o Clerk ainda estiver no código, vale também para a chave dele
- [ ] Varredura manual do app logado, registrada com prints

**Notas.** Os commits `2f724c1` ("corrige workspace mobile e honestidade da demo") e `2a28876` podem ter coberto parte disto; conferir antes de começar.

---

## S-008 · Publicação atômica e à prova de concorrência

- **status:** backlog
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Missão.** Uma falha no meio do publicar deixa o agente apontando para uma versão inexistente — ele fica mudo em produção e a publicação seguinte recomeça da semente, apagando as personalizações. Duas publicações simultâneas perdem uma regra sem aviso.

**Escopo.** Gravar a spec antes de mover o ponteiro (ou usar transação), CAS com a versão-base que o editor viu, máquina de estados do changeSet (`draft → evaluated → approved → published`) e idempotência de clique duplo. Vale para `publicar`, `publicarMudanca` e `reverter`.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `packages/control/src/index.ts:146-198` | `publicar` |
| `packages/control/src/index.ts:239-280` | `reverter` |
| `packages/control/src/index.ts:629-648` | `publicarMudanca` |
| `apps/web/api/control.ts:64-65` | ação com spec livre |

**Relacionados.** Depende de S-006. Destrava S-009 e S-036.

**Checklist**

- [ ] Spec gravada antes do ponteiro; falha no insert não muda a versão corrente
- [ ] Editor envia `baseVersion`; divergência → 409
- [ ] Publicação só a partir de `approved`, com update condicional
- [ ] Clique duplo publica uma vez
- [ ] Ação com spec livre removida ou validada por schema
- [ ] Teste de concorrência e teste com falha injetada no insert

---

## S-009 · Porteiro de verdade: eval obrigatório e fiel à produção

- **status:** backlog
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Missão.** "Eval é o porteiro" é a 5ª lei da skill, mas aqui o porteiro não barra nada: `gate()` nunca é chamado, com o cérebro falso tudo passa sempre, e com IA real o teste de agendar falha sempre porque as tools não são enviadas.

**Escopo.** Aprovação exige eval aprovado; eval usa o mesmo montador de prompt e as mesmas tools (em dry-run) da produção; asserções binárias com prova literal; cérebro falso proibido como porteiro.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `packages/evals/src/runner.ts:55` | `gate()` sem uso |
| `packages/control/src/index.ts:347, 384-414, 518-547` | montador, avaliar, rodar testes |
| `packages/motors/src/atendimento.ts:31` | montador de produção |
| `packages/samples/src/evals.ts`, `kits.ts` | casos e roteiros |

**Relacionados.** Depende de S-008. Usado por S-031, S-036 e S-039.

**Checklist**

- [ ] Um só montador de prompt, usado por produção e eval
- [ ] Eval passa as tools em dry-run; "chamou tool" mede de verdade
- [ ] Aprovar exige resultado de eval registrado
- [ ] Cérebro falso não aprova mudança
- [ ] Asserções binárias com trecho literal como prova
- [ ] Teste: mudança sabotada é reprovada

---

## S-010 · Integridade do banco: FKs, uniques e ledger append-only

- **status:** backlog
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Missão.** Os docs prometem ledger append-only e releases imutáveis; o banco não garante nada disso, e uma conta inexistente cria linhas órfãs. Garantia que só existe na disciplina do código some no primeiro atalho.

**Escopo.** FKs de conta, uniques em releases e conexões, bloqueio de UPDATE/DELETE em `releases` e `audit_log`, decisão sobre `change_sets`. RLS fica no S-011.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `packages/db/src/schema.ts` | schema |
| `packages/db/drizzle/0005_*.sql` | planejado |
| `BACKEND.md` | alinhar promessa e realidade |

**Relacionados.** Depende de S-002. Relaciona-se com S-008 e S-011.

**Checklist**

- [ ] FKs de conta nas tabelas de tenant
- [ ] Uniques em `releases(agent_id, spec_version)` e `connections(org_id, kind)`
- [ ] UPDATE/DELETE bloqueados em `releases` e `audit_log`
- [ ] Decisão sobre `change_sets` registrada e doc alinhado
- [ ] Restrições exercitadas por script de invariantes num Neon de teste

---

## S-011 · Isolamento no banco com RLS

- **status:** backlog
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Missão.** A plataforma passa a guardar credenciais e conversas completas de todos os clientes. O filtro por conta no código já falhou na auditoria; o banco precisa recusar leitura cruzada mesmo quando o código esquece.

**Escopo.** Políticas RLS por conta nas tabelas de tenant, papel de aplicação sem bypass, contexto de conta por request. Se o driver não permitir, registrar a tentativa com o mecanismo da falha e adotar testes de isolamento como rede.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `packages/db/src/client.ts` | conexão e contexto por request |
| `packages/db/drizzle/*.sql` | políticas |
| `packages/control/src/index.ts` | onde o contexto vira contexto de banco |

**Relacionados.** Depende de S-006 e S-010. Obrigatória antes de qualquer cliente real (LGPD).

**Checklist**

- [ ] Prova de conceito de contexto por request com o driver atual (ou registro de por que não)
- [ ] Políticas nas tabelas de tenant
- [ ] Papel de aplicação sem bypass; migrações com papel separado
- [ ] Teste: query sem contexto de conta retorna zero linhas
- [ ] Docs descrevendo o que existe de fato

---

## S-012 · Observabilidade do control plane e do runtime

- **status:** backlog
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Missão.** Um 500 em produção não deixa rastro, cada execução é logada duas vezes e o insert é fire-and-forget, podendo se perder quando a função congela. Sem isso, o primeiro incidente real vira adivinhação — e agora o incidente afeta todos os clientes.

**Escopo.** Log estruturado com id de correlação, log único por execução, persistência garantida, health que checa o banco, rastreador de erros.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `apps/web/api/control.ts`, `webhook.ts`, `health.ts` | handlers |
| `apps/runtime/src/host.ts:70-84` | insert fire-and-forget |
| `apps/runtime/src/pipeline.ts:57` | log duplicado |

**Relacionados.** Depende de S-006. Alimenta S-038.

**Checklist**

- [ ] Toda resposta com `x-request-id`; o log do erro tem o mesmo id
- [ ] Uma linha de log por execução
- [ ] Persistência do log aguardada ou em `waitUntil`
- [ ] Health responde o estado do banco
- [ ] Rastreador de erros ligado e testado com erro provocado

---

## S-013 · Front enxuto: código morto, tipos e lint

- **status:** backlog
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Missão.** Cerca de 1.600 das 1.883 linhas de `AgentDetail.tsx` nunca são renderizadas, e há lógica duplicada com o Studio. Código morto confunde quem mexe, humano ou IA, e esconde qual tela é a de verdade.

**Escopo.** Apagar o não alcançado, ligar `noUnusedLocals`/`noUnusedParameters`, tipar as respostas da API com os tipos do control plane. Sem mudança de comportamento.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `apps/web/src/views/AgentDetail.tsx:259-1883` | componentes mortos |
| `apps/web/src/views/MudancasTab.tsx`, `Followup.tsx`, `MapaTab.tsx`, `MapaAcao.tsx` | só alcançados pelo código morto |
| `apps/web/src/lib/api.ts` | respostas `any` |
| `apps/web/scripts/inline.mjs` | caminho de outra máquina |

**Relacionados.** Depende de S-002. Facilita S-036 e S-043.

**Checklist**

- [ ] Componentes não alcançados removidos; app navegado sem regressão
- [ ] Lógica duplicada com o Studio unificada
- [ ] `noUnusedLocals` e `noUnusedParameters` ligados e passando
- [ ] `api.ts` sem `any` nas respostas
- [ ] `scripts/inline.mjs` removido

**Notas.** Reconferir o que sobrou depois do commit `2a28876`, que redesenhou o Estúdio.

---

## S-014 · Dados ao vivo com um só polling e fuso fixo

- **status:** backlog
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Missão.** Cada tela abre o próprio polling, os números "de hoje" são contados sobre 50 registros e o "hoje" do servidor vira às 21h de Brasília. Custo à toa e números que não batem entre telas.

**Escopo.** Um provider único de dados ao vivo, `getToken` estável, agregados no backend, fuso `America/Sao_Paulo` (configurável por conta depois), listas recarregáveis.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `apps/web/src/lib/live.ts` | `useLive`, título, pendências |
| `apps/web/src/main.tsx:76` | `getToken` instável |
| `apps/web/src/lib/agents.tsx` | `refresh()` |
| `packages/control/src/index.ts:765-780` | listagem e agregados |

**Relacionados.** Depende de S-007. Alimenta S-042.

**Checklist**

- [ ] Uma requisição por intervalo, independente de quantas telas usam
- [ ] Poll do título só com a aba oculta
- [ ] `getToken` estável e contexto memoizado
- [ ] Agregados do dia vindos do backend
- [ ] "Hoje" calculado em `America/Sao_Paulo`
- [ ] Pausar um agente reflete na lista sem recarregar

---

## S-015 · Studio utilizável no celular

- **status:** backlog
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Missão.** O Studio é a tela principal de manutenção e muita gente vive no celular, mas ele tem coluna fixa de 400 px e a barra inferior cobre o campo de texto.

**Escopo.** Colunas empilhadas em telas pequenas, espaço para a nav inferior, `h-dvh` no shell, toggles e drawers acessíveis por teclado.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `apps/web/src/views/Estudio.tsx` | layout |
| `apps/web/src/App.tsx:88, 274, 374` | shell e nav inferior |
| `apps/web/src/ui.tsx:148` | `Toggle` sem semântica |

**Relacionados.** Depende de S-036 (o Studio novo). Conferir o commit `2f724c1`, que mexeu em mobile.

**Checklist**

- [ ] Sem scroll horizontal a 375 px
- [ ] Campo de texto visível com a nav inferior aberta
- [ ] Shell com `h-dvh`
- [ ] Toggles com `role="switch"`; drawers fecham com Esc
- [ ] Verificado em aparelho real (iOS e Android)

---

## S-016 · Decisão D-1: papel do OS frente aos agentes no ar

- **status:** cancelado
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-22 06:52

**Cancelado — nasceu de uma leitura errada do conceito.** A story pedia para escolher entre "painel da frota" e "runtime concorrente do motor da skill". O conceito real é outro (ver `PRODUTO.md`): uma bancada hospedada, operada por um agente construtor. **O que continua valendo:** `packages/motors` é uma reimplementação mais fraca do motor provado na skill, e será substituído pela extração desse motor — o que virou a S-023.

---

## S-017 · Definição de produto v1

- **status:** concluido
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Missão.** Várias funcionalidades estavam inacabadas porque nunca foram definidas: quem usa, o que é módulo, o que o cliente muda sozinho, onde o agente roda. Sem isso, cada tela era redesenhada a cada rodada.

**Escopo.** O `PRODUTO.md`: conceito, camadas, contas e permissões, modos, navegação, módulos e artefatos, o que o construtor pode gerar, protocolos, os dois agentes e onde rodam, manutenção, riscos e decisões.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `PRODUTO.md` | o documento |
| `PLANO-DIRETOR.md` | fases derivadas dele |

**Relacionados.** Substitui a S-016. Origina S-034 a S-044.

**Checklist**

- [x] Conceito e camadas escritos e validados
- [x] Contas, permissões e modo desenvolvedor definidos
- [x] Navegação definida
- [x] Módulos, artefatos e catálogo de lançamento definidos
- [x] Hospedagem, chaves de IA e modos do construtor definidos
- [x] Decisões P-1 a P-9 registradas (só P-5 em aberto)

**Notas.** Verificado por validação do mestre, decisão a decisão, na conversa de 21 a 23/09. A P-1 foi revista em 23/09: **tudo hospedado na Metrik**, revogando a auto-hospedagem decidida em 22/09. Em aberto: P-5 (contas e cobrança), que é decisão comercial e não bloqueia a construção.

---

## S-018 · Frota que se reporta ao OS

- **status:** cancelado
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Cancelado — o modelo que a justificava deixou de existir.** A story fazia os deploys por cliente enviarem execuções e versão para a plataforma. Com tudo hospedado (P-1, 23/09), não há deploys por cliente: o runtime é único e a telemetria é interna. **O que continua valendo:** a necessidade de ver o estado de todas as contas de uma vez virou a **visão de frota** do seletor de contas (`PRODUTO.md` §3), alimentada pelos Logs da S-038; e a migração dos deploys que existem hoje virou a S-028.

---

## S-019 · Conexões reais com teste e status verdadeiro

- **status:** backlog
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Missão.** A tela de Conexões afirma que tudo está "no ar e funcionando" sem consultar nada. Conexão é a primeira coisa que quebra — token expirado, ID do CRM mudado — e o cliente precisa ver isso antes do lead reclamar.

**Escopo.** Conexões reais da conta com status vindo de teste ativo (token válido, IDs existem no CRM vivo, instância de WhatsApp conectada), data do último teste e botão "testar agora". O cadastro da credencial é do S-044; o cofre é do S-025.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `apps/web/src/views/Conexoes.tsx` | tela |
| `packages/control/src/index.ts:296-321` | conexões |
| skill: `/api/validate` | validação de IDs ao vivo, já provada |

**Relacionados.** Depende de S-023 e S-025. Alimenta S-042 e S-044.

**Checklist**

- [ ] Status de cada conexão vem de teste ativo, com data
- [ ] Mapa de IDs quebrado vira alerta no Início
- [ ] "Testar agora" com resultado em linguagem do cliente
- [ ] Sem conexão cadastrada → estado vazio honesto

---

## S-020 · Controles de operador: parada, recado, pausa e assumir

- **status:** backlog
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Missão.** Quando o agente de operação fala besteira, a pessoa precisa de um botão que funcione **sempre**. Hoje a pausa é fail-open (falhou a leitura, o agente pausado volta a responder) e o "Assumir" abre sempre como se a IA estivesse no controle.

**Escopo.** Parada de emergência por agente com efeito garantido, recado do dia (texto temporário no contexto), estado correto de assumir, alerta quando um agente fica pausado tempo demais.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `apps/web/api/webhook.ts:30-48` | leitura fail-open |
| `apps/web/src/views/ConversaDrawer.tsx:191` | estado inicial |
| skill: `FRONTEIRA.md` #1 | desenho da parada e do recado |

**Relacionados.** Depende de S-023 e S-024.

**Checklist**

- [ ] Pausa fail-closed: falha de leitura não responde e alerta
- [ ] Pausa tem efeito em menos de 1 minuto, verificado em conta real
- [ ] Recado do dia com validade e prévia do efeito
- [ ] Drawer abre no estado real do contato
- [ ] Pausa esquecida gera alerta

---

## S-021 · Métricas que o cliente paga

- **status:** backlog
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Missão.** O Radar de Dinheiro soma um valor fixo de R$ 1.500 por "agendar" e conta execuções em dobro. O que renova contrato é a taxa real de agendamento e a atribuição honesta, não um número bonito.

**Escopo.** Carimbo de versão do prompt em cada execução, taxa real de agendamento por versão, valor por evento definido pelo cliente, fechamento do dia sobre agregados do backend, aviso de viés enquanto não houver holdout.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `packages/control/src/index.ts:765-780` | agregados |
| `apps/web/src/views/FechamentoDia.tsx`, `Inicio.tsx` | telas |
| skill: `MONETIZACAO.md`, `RECUPERACAO.md` | definição das métricas |

**Relacionados.** Depende de S-014, S-023 e S-038. Alimenta S-042.

**Checklist**

- [ ] Toda execução carrega a versão do prompt
- [ ] Taxa de agendamento por versão, calculada no backend
- [ ] Valor por tipo de evento configurado pelo cliente; sem valor, sem R$
- [ ] Fechamento do dia bate com a consulta direta ao banco
- [ ] Texto de viés de seleção visível até existir holdout

---

## S-022 · Permissões e modo desenvolvedor

- **status:** backlog
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Missão.** O produto define dono da conta e usuários com permissões, mais um modo desenvolvedor alternável. Hoje o Admin mostra o identificador cru do usuário, cai em membros fictícios quando falha, e os papéis existem no banco sem mudar o que cada pessoa vê.

**Escopo.** Permissões por conta (Ver, Operar, Ajustar, Aprovar e publicar, Modo desenvolvedor, Gerenciar pessoas), aplicadas no servidor e refletidas na interface; alternância de modo; convite e troca de permissão; transferência de titularidade. O construtor externo herda as permissões de quem o autorizou.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `apps/web/src/views/Admin.tsx` | tela atual |
| `packages/control/src/index.ts:26-53, 726` | vínculo de usuário e listagem |
| `apps/web/src/App.tsx` | alternância de modo no shell |
| `PRODUTO.md` §3 | a definição |

**Relacionados.** Depende de S-006. Condiciona S-030, S-034, S-036 e S-044.

**Checklist**

- [ ] Permissões modeladas no banco e checadas no servidor por ação
- [ ] Interface esconde o que a permissão não alcança
- [ ] Modo desenvolvedor alternável; zona 🔴 só nele
- [ ] Convite, troca de permissão e transferência de titularidade
- [ ] Token de MCP herda as permissões de quem autorizou (teste)
- [ ] Membros com nome e e-mail, sem identificador cru

---

## S-023 · Runtime multi-tenant: extrair o motor da skill (GHL + Kommo)

- **status:** backlog
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Missão.** `packages/motors` é uma reimplementação mais fraca do motor provado em produção: falta buffer, histórico de conversa, envio pelo Salesbot no Kommo, mídia, alçada fail-closed e gate por tag. Em vez de reescrever o que já funciona, extrair o motor da skill e fazê-lo rodar **multi-tenant** dentro da plataforma.

**Escopo.** Trazer o comum (buffer, loop de IA com tools, histórico, follow-up, prompt editável, evals, guardião) para o runtime compartilhado, com adapters para as três diferenças estruturais entre GHL e Kommo (histórico, envio, modelo de dados). Inclui **portar para o Kommo o prompt editável com testes**, que hoje só existe no GHL. Config e credenciais vêm por conta; nada de infraestrutura por cliente.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| skill: `clientes/metriksales/agente-ia/lib/*` | fonte do motor GHL |
| skill: `clientes/metriksales/agente-ia-kommo/lib/*` | fonte do motor Kommo |
| `packages/core/src/index.ts` | portas onde o motor encaixa |
| `apps/runtime/src/*` | pipeline e composição multi-tenant |
| `packages/motors/` | substituído |

**Relacionados.** Depende de S-025 (credenciais) e S-011 (isolamento). Destrava S-019, S-020, S-024, S-026 e S-028. Aplica o princípio da S-005.

**Checklist**

- [ ] Inventário do que é comum e do que é específico de cada CRM, com as divergências decididas
- [ ] Runtime compartilhado carregando spec e credenciais por conta, sem estado global entre contas
- [ ] Prompt editável com testes funcionando **também no Kommo**
- [ ] Fuso, janela comercial, anti-eco e estado terminal do follow-up conferidos na extração
- [ ] Dogfood da Metrik atendido pelo runtime da plataforma, com evals 10/10 e teste em número real
- [ ] `packages/motors` removido ou reduzido a ponte

**Notas.** O maior risco de prazo da Fase 2 é o Kommo. Não evoluir `packages/motors` em paralelo: só correção de segurança.

---

## S-024 · Estado, filas e idempotência no Redis

- **status:** backlog
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Missão.** Em serverless, estado em memória se perde a cada invocação: o follow-up reenviaria o primeiro toque a cada execução do cron, e um retry do provedor gera resposta duplicada ao lead. Com a plataforma no caminho de cada mensagem, isso atinge todos os clientes.

**Escopo.** Estado de conversa e cadência por conta/agente/contato no Upstash, trava antes de enviar, dedupe de entrada por identificador de mensagem, fila para o trabalho pesado, cron protegido, limite por conta.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `apps/runtime/src/host.ts:66` | estado em memória |
| `packages/motors/src/followup.ts:270-286` | ler → enviar → gravar |
| `apps/web/api/cron.ts` | hoje responde 501 |
| `apps/web/vercel.json` | declarar o cron |

**Relacionados.** Depende de S-023. Relaciona-se com S-004 e S-027.

**Checklist**

- [ ] Estado por conta com namespace, sem vazamento entre contas
- [ ] Mesmo passo de follow-up nunca enviado duas vezes (teste concorrente)
- [ ] Entrada duplicada ignorada por identificador de mensagem
- [ ] Cron protegido por segredo e declarado
- [ ] Follow-up para quando o lead responde
- [ ] Limite de disparos por conta

---

## S-025 · Cofre de credenciais por conta

- **status:** backlog
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Missão.** Com tudo hospedado, a Metrik guarda os tokens de CRM, WhatsApp e IA de todos os clientes. Sem cofre não há produto: o runtime não tem mãos e a credencial não tem onde morar em segurança.

**Escopo.** `VaultPort` implementado com criptografia por conta, cadastro pela interface sem nunca devolver o valor, resolução que confere a conta, refresh automático do OAuth do GHL, acesso registrado. Serve o agente de operação e o token de IA do construtor interno.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `packages/core/src/index.ts` → `VaultPort` | contrato |
| `apps/runtime/src/host.ts:29-31` | injeção no runtime |
| `packages/crm/src/ghl.ts`, `kommo.ts` | Bearer fixo hoje |
| `packages/control/src/index.ts:296-321` | conexões e `vaultRef` livre |

**Relacionados.** Depende de S-003 e S-011. Destrava S-019, S-023, S-026 e S-044.

**Checklist**

- [ ] Credencial criptografada com chave por conta
- [ ] Resolução falha se a credencial não é da conta (teste)
- [ ] Nunca aparece em resposta de API, em log ou para uma IA
- [ ] Refresh do OAuth GHL antes de expirar; 401 dispara refresh uma vez
- [ ] Todo acesso à credencial registrado nos Logs

---

## S-026 · Canais reais de entrada e saída

- **status:** backlog
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Missão.** O envio pela uazapi é um stub que devolve sucesso, a "resposta" no Kommo vira nota interna, o follow-up padrão nunca entrega e o webhook não entende o formato de nenhum provedor. O painel mostraria sucesso sem nenhuma mensagem chegar — a cicatriz mais cara da casa.

**Escopo.** Parsers com verificação de assinatura para GHL e uazapi, envio real pela uazapi, Kommo pelos dois desenhos (Salesbot e uazapi), GHL como WhatsApp com fallback de template fora da janela de 24 h, e validação da combinação remetente × transporte na publicação.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `packages/messaging/src/transports.ts:25-40, 105-118` | GHL só texto; uazapi stub |
| `packages/crm/src/kommo.ts:236-243` | envio como nota |
| `packages/crm/src/ghl.ts:178` | tipo de mensagem padrão SMS |
| `packages/llm/src/index.ts:35` | cérebro falso em produção |
| `apps/web/api/webhook.ts` | entrada |

**Relacionados.** Depende de S-004, S-023 e S-025.

**Checklist**

- [ ] Nenhum transporte devolve sucesso sem confirmação do provedor
- [ ] Sem chave de IA configurada → erro, nunca cérebro falso
- [ ] Parsers de GHL e uazapi com assinatura verificada
- [ ] Kommo entregando nos dois desenhos, verificado no celular
- [ ] GHL enviando como WhatsApp; fora da janela usa template
- [ ] Publicar recusa combinação impossível de remetente e transporte

---

## S-027 · Resiliência e custo das integrações

- **status:** backlog
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Missão.** Nenhuma chamada ao CRM ou à IA tem timeout, retry ou tratamento de 429 (o Kommo limita 7 requisições por segundo), e a OpenAI guarda por padrão os dados dos leads — ponto de LGPD. Num runtime compartilhado, um cliente barulhento pode derrubar os outros.

**Escopo.** Cliente HTTP comum com timeout e backoff respeitando `Retry-After`, tags do Kommo em uma requisição atômica, `store:false`, teto de tokens, modelo configurável por spec, orçamento de IA por conta com alerta.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `packages/crm/src/ghl.ts:45`, `kommo.ts:70, 178-199` | chamadas e tags |
| `packages/llm/src/openai.ts:42, 81` | modelo fixo e chamada |

**Relacionados.** Depende de S-023. Relaciona-se com S-024.

**Checklist**

- [ ] Timeout em toda chamada externa
- [ ] 429 com backoff e `Retry-After` (teste com servidor falso)
- [ ] Tags do Kommo atômicas, em uma requisição
- [ ] `store:false` e teto de tokens nas chamadas de IA
- [ ] Orçamento diário por conta com alerta ao estourar

---

## S-028 · Migrar os clientes atuais para a plataforma

- **status:** backlog
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Missão.** Os clientes de hoje rodam em deploys separados, um por cliente. Trazê-los para o runtime hospedado é a operação mais arriscada do plano: são agentes atendendo leads que pagam a conta.

**Escopo.** Migração em ondas — 0 Metrik (dogfood), 1 um cliente tolerante de cada CRM, 2 o resto —, com importação da configuração e do histórico, bake de 24 h atravessando pico comercial, portão por taxa de erro e volta atrás testada de propósito. Reescreve a antiga migração de pacote por cliente.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `scripts/migrar-cliente.mjs` | planejado — importar config, prompt e mapa de IDs |
| skill: `clientes/*/agente-ia*` | origem da configuração de cada cliente |

**Relacionados.** Depende de S-023 a S-027 e de S-032.

**Checklist**

- [ ] Baseline de erro de 7 dias medido por cliente antes de migrar
- [ ] Importação de prompt, mapa de IDs e credenciais, conferida contra o CRM vivo
- [ ] Onda 0 por 14 dias com erro ≤ baseline
- [ ] Volta atrás testada de propósito em horário morto
- [ ] Onda 1 por 14 dias; onda 2 concluída; deploys antigos desligados

---

## S-029 · Leitor de grupos: fechar o piloto

- **status:** backlog
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Missão.** O piloto de leitura de grupos é o trecho mais cuidadoso do repo, mas o segredo vai na query string (logs do Vercel e URL da UAZAPI), o mesmo segredo grava e lê as mensagens, e o schema é criado em runtime com divergência de índice.

**Escopo.** Segredo de ingestão separado do de leitura, leitura só por header, minimização do nome do remetente, remover a criação de schema em runtime, corrigir o parser de remetente em texto. Decidir o propósito do piloto.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `apps/web/api/group-reader.ts:179-260` | auth, DDL e leitura |
| `apps/web/server/group-reader.ts:131, 271` | parser e salt |
| `packages/db/drizzle/0004_melted_sally_floyd.sql:22` | índice divergente |
| `PILOTO-GRUPOS.md` | doc |

**Relacionados.** Depende de S-002.

**Checklist**

- [ ] Segredos de ingestão e leitura separados; leitura só por header
- [ ] Criação de schema em runtime removida; índice igual à migração
- [ ] Remetente em texto gera hash e últimos 4 dígitos (teste)
- [ ] Salt obrigatório e independente do segredo
- [ ] Propósito e próximo passo do piloto registrados

**Notas.** O propósito de negócio do piloto não está escrito em nenhum doc.

---

## S-030 · Catálogo de módulos

- **status:** backlog
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Missão.** A loja de Módulos é uma lista fixa no código que marca tudo como "já ligado" e aponta para agentes fictícios. O catálogo precisa ser a porta real de instalação, derivada dos manifestos.

**Escopo.** Catálogo gerado dos manifestos dos módulos registrados, com instalação numa conta, versão, dependências (conectores e permissões exigidos) e a ação certa para cada permissão (ligar, pedir, instalar). Módulo Base por CRM instalado automaticamente.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `apps/web/src/views/Modulos.tsx` | tela |
| `apps/web/src/data.ts` → `MODULOS`, `COMPAT` | mock a remover |
| `packages/core/src/index.ts` | registro de módulos |
| `PRODUTO.md` §4 e catálogo de lançamento | o que entra |

**Relacionados.** Depende de S-035 e S-022. Alimenta S-036 e S-039.

**Checklist**

- [ ] Catálogo lido do registro de módulos, não de mock
- [ ] Instalar cria a instância na conta, com versão
- [ ] Módulo que exige conector ausente avisa e não instala pela metade
- [ ] Base do CRM instalado automaticamente na criação da conta
- [ ] Estado "instalado" e "ligado" vem da spec publicada
- [ ] Instalação e remoção aparecem nos Logs

---

## S-031 · Escola: correção do cliente vira regra, exemplo ou tarefa

- **status:** backlog
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Missão.** O jeito mais frequente de manter um agente é corrigir o que ele respondeu errado. A skill já resolveu isso: a pessoa corrige em português, o sistema decide se aquilo vira regra, exemplo ou tarefa, e no modo normal ninguém encosta no prompt cru.

**Escopo.** Portar o fluxo da Escola: captura a partir de uma conversa → triagem (dado volátil vira tarefa, não regra) → proposta → porteiro → aprovação → publicação, com o que aparece variando por permissão e modo.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `packages/control/src/index.ts` | esteira de mudança |
| skill: `ESCOLA.md`, `assets/escola/` | desenho e código de referência |
| `apps/web/src/views/` → Conversas e Studio | pontos de entrada |

**Relacionados.** Depende de S-009, S-036 e S-043.

**Checklist**

- [ ] "Corrigir isso" numa conversa abre o Studio com o exemplo
- [ ] Triagem separa tarefa, regra e exemplo (testes de roteamento portados)
- [ ] Pedido vago recebe pergunta de volta, não uma mudança inventada
- [ ] No modo normal o prompt cru não aparece
- [ ] Um pedido real de cliente feito de ponta a ponta

---

## S-032 · Onboarding de conta

- **status:** backlog
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Missão.** Pôr um cliente no ar custa cerca de 8 horas do dono. Com tudo hospedado, o caminho vira: criar conta → conectar CRM e WhatsApp → instalar módulos → configurar → rampagem. A plataforma pode conduzir isso.

**Escopo.** Fluxo guiado de criação de conta, cadastro de conexões, instalação dos módulos do catálogo, configuração inicial a partir das respostas do compilador de onboarding da skill, gate por tag obrigatório e rampagem 1 → 10 → todos.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `packages/samples/src/kits.ts` | kits existentes |
| skill: `ONBOARDING.md`, `assets/onboarding/` | compilador e schema |

**Relacionados.** Depende de S-019, S-025, S-030 e S-036. Destrava S-028.

**Checklist**

- [ ] Kit escolhido gera rascunho de configuração a partir das respostas
- [ ] Publicação bloqueada enquanto o onboarding estiver incompleto
- [ ] Gate por tag obrigatório na primeira publicação
- [ ] Rampagem com três degraus registrada no histórico
- [ ] Tempo do dono medido num cliente real

---

## S-033 · Planos e cobrança

- **status:** adiado
- **criado:** 2026-09-21 15:47
- **atualizado:** 2026-09-23 12:10

**Missão.** Transformar a plataforma em produto vendável, com planos, limites e cobrança recorrente.

**Escopo.** Planos por conta com franquia de execuções e prazo de retenção, responsável de cobrança, fatura consolidada para quem paga várias contas, cobrança integrada.

**Motivo do adiamento.** Depende da decisão comercial P-5 do `PRODUTO.md` (quem cria conta, quem paga, revenda, unidade de preço, teste grátis), que ainda não foi tomada. Não bloqueia a construção: reabrir quando a P-5 for decidida e a S-021 provar as métricas que sustentam o preço.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `packages/db/src/schema.ts` → `organizations.plan` | campo já existe, sem uso |
| skill: `MONETIZACAO.md` | prova de valor e precificação |

**Relacionados.** Depende de S-021 e da P-5.

**Checklist**

- [ ] P-5 decidida
- [ ] Limites por plano aplicados no control plane
- [ ] Medição de execuções e retenção por conta
- [ ] Cobrança integrada e testada em modo teste

---

## S-034 · Servidor MCP da plataforma

- **status:** backlog
- **criado:** 2026-09-23 12:10
- **atualizado:** 2026-09-23 12:10

**Missão.** É pelo MCP que o Claude Code, o Codex ou outra IA de terminal do assinante trabalha na bancada. É a porta avançada do produto e, junto com o Studio, a razão de a camada de ferramentas existir.

**Escopo.** Servidor MCP remoto com autenticação por usuário e escopo por conta; ferramentas (`conta`, `modulo`, `mudanca`, `crm`, `agente`, `execucoes`, `orientacao`); resources (specs, manifestos, execuções, esquema do CRM, contexto da conta); prompts (playbooks). As permissões de quem autorizou valem para a sessão. O modo de polling fica no S-036.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `apps/web/api/mcp.ts` | planejado — servidor remoto |
| `packages/control/src/index.ts` | as ações que viram ferramentas |
| `PRODUTO.md` §6 | lista de ferramentas |

**Relacionados.** Depende de S-003, S-006 e S-022. Usa S-041 para a orientação.

**Checklist**

- [ ] Autenticação por usuário, com escolha de conta e escopos
- [ ] Ferramentas dos sete grupos, cada uma checando permissão e zona no servidor
- [ ] Toda ação registrada nos Logs com origem "MCP" e autor
- [ ] Resources e prompts servindo manifesto, contexto da conta e playbooks
- [ ] Testado de ponta a ponta com Claude Code e com um segundo cliente MCP
- [ ] Sessão de usuário sem modo desenvolvedor não alcança 🔴 (teste)

---

## S-035 · Manifesto de módulo e motor de configuração

- **status:** backlog
- **criado:** 2026-09-23 12:10
- **atualizado:** 2026-09-23 12:10

**Missão.** O princípio do produto é "o manifesto desenha a tela e define o que pode mudar". Sem um formato de manifesto de verdade, cada módulo vira tela à mão e as zonas de risco viram convenção verbal.

**Escopo.** Formato do manifesto (identidade, versão, config com tipo, validação e zona por campo, conectores e permissões exigidos, gatilhos, ações, telas, provas, skills), validação da configuração contra o esquema, e a renderização automática do formulário. É a base do catálogo, do Studio e da composição.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `packages/core/src/index.ts` | tipos do manifesto |
| `packages/control/src/index.ts` | validação na proposta e na publicação |
| `apps/web/src/views/` | formulário gerado pelo manifesto |
| `PRODUTO.md` §4 | a definição |

**Relacionados.** Depende de S-008. Destrava S-030, S-036, S-037 e S-039.

**Checklist**

- [ ] Formato do manifesto escrito e versionado em `@motor/core`
- [ ] Um módulo real (follow-up) descrito por manifesto, ponta a ponta
- [ ] Configuração inválida recusada com mensagem clara, no servidor
- [ ] Formulário gerado a partir do manifesto, com a zona de cada campo
- [ ] Módulo que exige conector ou permissão ausente é barrado na publicação

---

## S-036 · Studio: o agente construtor interno

- **status:** backlog
- **criado:** 2026-09-23 12:10
- **atualizado:** 2026-09-23 12:10

**Missão.** O construtor interno é o caminho principal do produto: a pessoa pede em português, vê a mudança, o teste e o antes/depois, e aprova. Sem terminal e sem instalar nada.

**Escopo.** A tela Studio com conversa em streaming, chamadas de ferramenta visíveis, estado compartilhado do que está sendo editado e pausa para aprovação (AG-UI); o construtor usando o token de IA da conta e a mesma camada de ferramentas do MCP; o contexto da conta (campo equivalente ao CLAUDE.md), com acréscimos propostos pelo próprio construtor; e a receita de polling documentada para quem quiser usar o construtor externo pela interface.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `apps/web/src/views/Estudio.tsx` | tela atual, a evoluir |
| `packages/control/src/index.ts` | ferramentas e esteira de mudança |
| `PRODUTO.md` §6 | modos do construtor e contexto |

**Relacionados.** Depende de S-008, S-009, S-022, S-025 e S-035. Alimenta S-015, S-031 e S-039.

**Checklist**

- [ ] Conversa em streaming com as chamadas de ferramenta visíveis
- [ ] Toda mudança passa por teste e aprovação antes de publicar
- [ ] Token de IA da conta usado só no servidor
- [ ] Contexto da conta editável no modo desenvolvedor; acréscimos do construtor entram como mudança
- [ ] Sem token de IA cadastrado, a tela explica o que fazer em vez de falhar
- [ ] Receita de polling documentada, com script de referência

---

## S-037 · Painéis declarativos (A2UI)

- **status:** backlog
- **criado:** 2026-09-23 12:10
- **atualizado:** 2026-09-23 12:10

**Missão.** Um dos pedidos mais comuns é "quero um painel com X". Se o construtor gerar código de tela, a plataforma passa a executar código gerado no navegador do cliente. Painel declarado resolve o pedido sem esse risco.

**Escopo.** Catálogo de componentes confiáveis (indicador, gráfico, tabela, funil, lista), formato declarativo do painel, validação contra o catálogo e renderização. Painéis do catálogo de lançamento e painéis criados pelo construtor usam o mesmo formato.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `apps/web/src/views/` | renderizador |
| `packages/core/src/index.ts` | formato do painel |
| skill: `CENTRAL.md` | padrão visual e de conteúdo já provado |

**Relacionados.** Depende de S-035. Alimenta S-021 e S-042.

**Checklist**

- [ ] Catálogo de componentes documentado
- [ ] Painel com componente fora do catálogo é recusado
- [ ] Painéis de lançamento (ao vivo e métricas do dia) declarados nesse formato
- [ ] Construtor cria um painel novo sem código
- [ ] Nenhum código gerado é executado no navegador (revisado)

---

## S-038 · Logs: tabela única de auditoria

- **status:** backlog
- **criado:** 2026-09-23 12:10
- **atualizado:** 2026-09-23 12:10

**Missão.** Com a plataforma guardando conversas e credenciais de todos os clientes, é preciso responder "quem fez o quê, quando e por onde" sem abrir o banco. É a tela que sustenta confiança, suporte e LGPD.

**Escopo.** Tabela única com filtros reunindo execuções dos agentes de operação (conversa completa, ações no CRM, custo, erro, versão do prompt) e registros de mudança (autor, origem, aprovação, antes/depois), mais acessos a credenciais. Inclui retenção declarada e exportação.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `apps/web/src/views/` → Logs | tela nova |
| `packages/db/src/schema.ts` → `runtime_logs`, `change_sets`, `audit_log` | fontes |
| `packages/control/src/index.ts` | consulta com filtros e paginação |

**Relacionados.** Depende de S-011 e S-012. Alimenta S-021, S-042 e a visão de frota.

**Checklist**

- [ ] Consulta com filtros (data, agente, autor, origem, resultado) e paginação
- [ ] Execução e mudança na mesma linha do tempo, distinguíveis
- [ ] Acesso a credencial aparece como evento
- [ ] Prazo de retenção aplicado e visível
- [ ] Exportação da conta para atender pedido do titular (LGPD)
- [ ] Teste de isolamento: conta A não vê linha da conta B

---

## S-039 · Composição de módulos (gatilho → ação)

- **status:** backlog
- **criado:** 2026-09-23 12:10
- **atualizado:** 2026-09-23 12:10

**Missão.** É o nível 2 do que o construtor pode gerar: ligar o gatilho de um módulo à ação de outro ("quando o lead for para Qualificado, avise no grupo e atualize o painel"). É o que atende a maior parte dos pedidos sem escrever código.

**Escopo.** Formato declarativo de composição, validado contra os gatilhos e as ações que os módulos instalados declaram; detecção de ciclo; limite de disparos por conta; passagem pela mesma esteira de teste e aprovação.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `packages/core/src/index.ts` | formato da composição |
| `apps/runtime/src/pipeline.ts` | execução das composições |
| `PRODUTO.md` §5 | limites do nível 2 |

**Relacionados.** Depende de S-023, S-030 e S-035. Usado por S-034 e S-036.

**Checklist**

- [ ] Composição só com gatilhos e ações declarados pelos módulos instalados
- [ ] Ciclo entre automações detectado e recusado (teste)
- [ ] Limite de disparos por conta, com alerta
- [ ] Composição passa por teste e aprovação como qualquer mudança
- [ ] Execução de cada composição aparece nos Logs

---

## S-040 · Conectores declarativos e MCP de terceiros

- **status:** backlog
- **criado:** 2026-09-23 12:10
- **atualizado:** 2026-09-23 12:10

**Missão.** Integração com serviço que ninguém previu é o pedido que mais empurra para "escrever código". O conector declarativo e o uso de servidores MCP de terceiros atendem isso sem executar código gerado.

**Escopo.** Conector descrito por dados (URL base, autenticação, endpoints; ou importado de um OpenAPI) que vira ferramentas para o agente; conexão a servidores MCP de terceiros com credencial no cofre e escolha de quais ferramentas o agente pode chamar. Quando nada disso serve, o pedido vira módulo novo no catálogo.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `packages/core/src/index.ts` | formato do conector declarativo |
| `apps/runtime/src/` | cliente MCP da plataforma |
| `PRODUTO.md` §5 | os quatro degraus |

**Relacionados.** Depende de S-025, S-027 e S-035. Usado por S-036 e S-039.

**Checklist**

- [ ] Conector criado a partir de OpenAPI e a partir de endpoints descritos
- [ ] Credencial do conector no cofre; nunca no manifesto
- [ ] Servidor MCP de terceiro conectado, com lista de ferramentas permitidas
- [ ] Chamadas do conector respeitam timeout, retry e orçamento
- [ ] Pedido que não cabe em nenhum degrau vira registro de "módulo pedido"

---

## S-041 · Orientação sob demanda a partir da skill

- **status:** backlog
- **criado:** 2026-09-23 12:10
- **atualizado:** 2026-09-23 12:10

**Missão.** O que faz qualquer IA trabalhar como um implementador da Metrik é a orientação. Ela precisa chegar ao construtor na hora certa, no tamanho certo, e sair da skill sem reescrita manual — documentação copiada à mão vira mentira em duas semanas.

**Escopo.** Pipeline que gera a versão sanitizada da skill (sem IDs, JIDs e nomes de clientes), as skills embutidas em cada módulo, a busca por tarefa e a entrega automática junto das ferramentas. Vale para o construtor interno e o externo.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| skill: `agente-ia-metrik-completo` + `sync.py` | fonte e sanitização já existentes |
| `packages/core/src/index.ts` | campo `skills` do manifesto |
| `apps/web/api/mcp.ts` | resources e prompts |

**Relacionados.** Depende de S-035. Usado por S-034 e S-036.

**Checklist**

- [ ] Pipeline de sanitização rodando e verificado (nenhum ID, JID ou nome interno)
- [ ] Cada módulo do catálogo de lançamento com sua skill
- [ ] Busca por tarefa devolve o trecho, nunca o dossiê
- [ ] Ferramenta de configuração já devolve a orientação do módulo
- [ ] Consumo de orientação por conta registrado nos Logs

---

## S-042 · Página Início

- **status:** backlog
- **criado:** 2026-09-23 12:10
- **atualizado:** 2026-09-23 12:10

**Missão.** É a primeira tela e precisa responder, em cinco segundos: está funcionando, o que aconteceu e o que precisa de mim.

**Escopo.** Estado da operação (agentes no ar, pausados, conexões quebradas), painéis de resultado do dia e da semana, e a lista "precisa de você" (aprovações pendentes, alertas, conversas pedindo humano). Na visão de várias contas, o consolidado da frota.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `apps/web/src/views/Inicio.tsx` | tela |
| `apps/web/src/views/FechamentoDia.tsx` | fechamento, a incorporar |

**Relacionados.** Depende de S-014, S-021, S-037 e S-038.

**Checklist**

- [ ] Estado da operação vindo de dado real, com estado vazio honesto
- [ ] Painéis do dia e da semana no formato declarativo
- [ ] "Precisa de você" com ação direta em cada item
- [ ] Consolidado de frota para quem tem várias contas
- [ ] Nada de número fictício em nenhum estado (erro, carregando, vazio)

---

## S-043 · Página do agente

- **status:** backlog
- **criado:** 2026-09-23 12:10
- **atualizado:** 2026-09-23 12:10

**Missão.** É onde se acompanha e se ajusta um agente de operação específico. Hoje esse lugar está espalhado entre telas mortas e o Estúdio.

**Escopo.** As abas: Visão geral (o que ele faz, números, módulos e regras ligados), Conversas (texto completo, assumir e devolver, "corrigir isso"), Conhecimento (ofertas, FAQ, objeções, edição direta), Configuração (campos por zona) e Técnico (só no modo desenvolvedor: conexões, gate, alçada, configuração crua).

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `apps/web/src/views/AgentDetail.tsx` | tela atual |
| `apps/web/src/views/Conversas.tsx`, `ConversaDrawer.tsx` | conversas |

**Relacionados.** Depende de S-013, S-022, S-035 e S-038. Alimenta S-031.

**Checklist**

- [ ] As cinco abas implementadas, com a Técnica só no modo desenvolvedor
- [ ] Conversas mostram o texto completo e o que o agente fez em cada uma
- [ ] "Corrigir isso" abre o Studio com o exemplo
- [ ] Conhecimento editável direto, com histórico
- [ ] Configuração gerada pelo manifesto, com a zona de cada campo

---

## S-044 · Página Conta e Conexões

- **status:** backlog
- **criado:** 2026-09-23 12:10
- **atualizado:** 2026-09-23 12:10

**Missão.** É onde a conta ganha acesso ao mundo: CRM, WhatsApp e o token de IA que move o construtor interno. Sem essa tela, nada mais funciona.

**Escopo.** Pessoas e permissões, transferência de titularidade, e a área de Conexões: cadastrar e trocar credenciais (CRM, WhatsApp, IA) com teste imediato, sem nunca devolver o valor à tela. Responsável de cobrança fica para a S-033.

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `apps/web/src/views/Admin.tsx`, `Conexoes.tsx` | telas atuais |
| `packages/control/src/index.ts` | conexões e membros |

**Relacionados.** Depende de S-019, S-022 e S-025.

**Checklist**

- [ ] Cadastrar credencial guarda no cofre e testa na hora
- [ ] Credencial nunca volta à tela; trocar é substituir
- [ ] Pessoas com nome, e-mail e permissões editáveis
- [ ] Transferência de titularidade
- [ ] Token de IA do construtor cadastrado aqui, com aviso de custo

---

## S-045 · Autenticação e gestão de usuários própria

- **status:** backlog
- **criado:** 2026-09-23 14:05
- **atualizado:** 2026-09-23 14:05

**Missão.** Tirar o Clerk e passar a controlar login, convites e permissões dentro da plataforma — sem custo por usuário ativo, sem depender de fornecedor para o modelo de contas e permissões que o produto definiu. É a peça que toda requisição atravessa, então precisa ser feita com cuidado de segurança, não como tela de login.

**Escopo.** Cadastro e entrada sem senha (código enviado por e-mail), sessão por cookie `httpOnly` com token opaco guardado em hash, proteção contra CSRF, convites por e-mail, troca de conta, permissões por conta, transferência de titularidade, limite de tentativas e registro de acesso. Não inclui segundo fator (TOTP), que fica para depois do lançamento, nem senha (entra só se alguém pedir).

**Arquivos e locais**

| Caminho | Papel |
| :--- | :--- |
| `apps/web/api/_auth.ts` | hoje resolve Clerk; passa a resolver sessão própria |
| `apps/web/src/main.tsx`, `lib/auth.tsx`, `lib/clerkTheme.ts` | integração Clerk a remover |
| `apps/web/src/views/` → login, convite, código | telas novas |
| `packages/db/src/schema.ts` | `users`, `sessions`, `invites`, `login_attempts` (planejadas) |
| `packages/control/src/index.ts:26-53` | vínculo usuário-conta, hoje derivado do Clerk |
| `.env.example`, `DEPLOY.md` | variáveis do Clerk trocadas pelas do Resend (`.env.example` já atualizado) |

**Relacionados.** Depende de S-002 e S-010. Destrava S-022 (permissões e modo desenvolvedor) e condiciona S-006. Compartilha as tabelas de token com a S-003.

**Checklist**

- [ ] Entrada por código de e-mail, com token de uso único, validade curta e guardado em hash
- [ ] Sessão em cookie `httpOnly`, `Secure`, `SameSite=Lax`, com token opaco revogável e rotação na entrada
- [ ] Proteção contra CSRF em toda mutação, com conferência de origem
- [ ] Convite, aceite, remoção e troca de permissão, com e-mail de verdade sendo entregue
- [ ] Troca de conta na sessão, com permissões relidas do banco a cada requisição
- [ ] Limite de tentativas por conta e por IP; entrada, saída e falha registradas nos Logs
- [ ] Porta de e-mail com modo seco: em dev e preview escreve o código no console/Logs em vez de enviar; a chave do Resend existe só em Production
- [ ] Clerk removido do código e das variáveis de ambiente
- [ ] Revisão de segurança do fluxo antes de qualquer cliente real (enumeração de e-mail, fixação de sessão, vazamento de token no referer)

**Notas.** Decisão P-11 do `PRODUTO.md`. Duas consequências: sai o token no cabeçalho e entra cookie, o que **cria superfície de CSRF** que não existia; e aparece uma dependência nova, o serviço de envio de e-mail (Resend ou SES, a escolher). Começar sem senha elimina guarda de hash, redefinição e reuso de senha de outro site.
