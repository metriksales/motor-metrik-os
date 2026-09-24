# Como trabalhar neste repositório

Guia para quem entra aqui — pessoa ou IA de terminal (Claude Code, Codex, Gemini CLI, o que for). Leia antes do primeiro commit: as regras abaixo não são preferência de estilo, são o que impede de quebrar a operação de clientes que pagam.

## O que é este projeto

**Metrik-OS** é uma bancada multi-tenant, hospedada pela Metrik, onde um **agente construtor** monta, mantém e audita **agentes de operação** que trabalham dentro do CRM do cliente (GoHighLevel, Kommo, WhatsApp).

Dois agentes, nomes fixos — não misture:

| | O que faz | Onde roda |
| :--- | :--- | :--- |
| **Agente construtor** | monta e mantém a operação: configura, integra, audita | na plataforma (Studio) ou no terminal de quem assina, via MCP |
| **Agente de operação** | atende leads, faz follow-up, move funil, 24/7 | no runtime da Metrik |

Leia nesta ordem, conforme a necessidade:

| Documento | Responde |
| :--- | :--- |
| [`PRODUTO.md`](PRODUTO.md) | o que o produto é, para quem, e as decisões já tomadas |
| [`PLANO-DIRETOR.md`](PLANO-DIRETOR.md) | as fases, em que ordem e com que portão de saída |
| [`STORIES.md`](STORIES.md) | **o estado de cada frente de trabalho — comece por aqui** |
| `ARQUITETURA.md`, `ORIENTACAO.md`, `BACKEND.md`, `PLATAFORMA.md` | doutrina de origem, parcialmente defasada |

> Onde os docs antigos divergirem do `PRODUTO.md`, vale o `PRODUTO.md` — e a story que tocar no assunto corrige o doc na mesma entrega.

## Antes do primeiro commit: a identidade do git

```bash
git config user.name "metrik-sales"
git config user.email "contatosalesmetrik@gmail.com"
```

**Isto não é burocracia.** A Vercel decide quem pode publicar pelo **autor do commit**. Commit autorado por outra identidade faz a checagem de deploy falhar com "Git author ... must have access to the project on Vercel". Se acontecer, conserte a autoria e force o push:

```bash
git rebase --exec "git commit --amend --no-edit --reset-author" <commit-antes-dos-seus>
git push --force-with-lease
```

### Mescle o PR LOCALMENTE, não com `gh pr merge`

O `gh pr merge` assina o **commit de merge** com a conta do token — e se essa conta não tiver assento na Vercel, **o deploy de produção fica `BLOCKED`** enquanto os previews de branch continuam passando. O site fica no build antigo e é fácil não perceber.

```bash
git checkout main && git pull
git merge --no-ff <sua-branch>
git push
```

Assim o merge herda a identidade configurada acima. (Aconteceu em 24/09: os três primeiros PRs ficaram com produção bloqueada por isso.)

> **A Vercel pula commit que não toca o projeto.** Se você tentar destravar um deploy com um commit vazio, ele é ignorado ("skipping unaffected projects"). Para forçar, a mudança precisa tocar algum arquivo de `apps/web`.

## A stack

Neon (Postgres) · Vercel · GitHub · autenticação própria · Resend para e-mail. **Não há Upstash nem QStash**: estado, filas, travas e idempotência ficam no Postgres, e o agendamento é o cron da Vercel. O porquê e os gatilhos para rever isso estão no `PRODUTO.md` §11.

Monorepo com workspaces do npm:

```
apps/web        front (Vite + React) + funções serverless em api/
apps/runtime    o motor: pipeline de execução
packages/core   contratos (a lei): tipos, ports, catálogo de ferramentas
packages/control Control API — a porta única de mudança
packages/db     schema e migrações (Drizzle)
packages/{crm,llm,messaging,motors,evals,samples}  peças plugáveis
```

Regra de dependência: um pacote depende **só de `@motor/core`**. Infra entra por porta injetada.

## Comandos

```bash
npm install            # Node >= 22
npm run ci             # typecheck + lint + testes — rode ANTES de commitar
npm run typecheck      # tsc --noEmit nos 12 alvos
npm run lint
npm test               # Vitest
npm run build:web      # front + bundles das funções
npm run dev:web        # dev server (só localhost, de propósito)
```

`npm run ci` é o mesmo que a CI roda. Se passa aqui, passa lá — com uma exceção, abaixo.

## Testes que precisam de banco

Os testes de isolamento entre contas (`packages/control/src/isolamento.test.ts`) rodam contra um Postgres **de verdade**. Sem banco eles são **pulados**, e o resumo do Vitest mostra isso.

Para rodá-los na sua máquina:

```bash
TEST_DATABASE_URL=postgres://... npm test
```

Na CI eles sempre rodam, contra um serviço `postgres:16` com as migrações aplicadas antes. **Se você mexeu em qualquer coisa de isolamento ou permissão, confira o resultado da CI — não só o daqui.**

## A CI, em linguagem simples

**CI** quer dizer *integração contínua*: um computador do GitHub que, a cada push e a cada PR, baixa o repositório e roda as mesmas verificações que você roda na sua máquina. Se qualquer uma falhar, o PR fica marcado em vermelho.

A nossa vive em [`.github/workflows/ci.yml`](.github/workflows/ci.yml) e faz, nesta ordem:

1. instala as dependências;
2. **typecheck** nos 12 alvos;
3. **lint**;
4. **migra um Postgres descartável** que sobe junto com a execução;
5. **testes** — e é aqui que rodam os 8 de isolamento entre contas, que na sua máquina ficam pulados;
6. **build** do front e das funções.

A checagem aparece no PR com o nome **`verificar`**. Ela leva cerca de 1 minuto e meio.

> **Por que não dá para confiar só no `npm run ci` local:** os testes que precisam de banco são pulados aqui. Quem garante que uma conta não alcança a outra é a CI.

### Por que o `main` ainda não é protegido por regra

O certo seria o GitHub **recusar** merge sem a CI verde. Isso é "proteção de branch", e no GitHub é **recurso pago para repositório privado** — a organização está no plano gratuito, e tanto a proteção clássica quanto os *rulesets* respondem `403 Upgrade to GitHub Pro`.

Enquanto isso não muda, valem duas barreiras mais fracas:

- **Disciplina:** branch, PR, CI verde, merge. Está escrito aqui e é o combinado.
- **Hook de `pre-push`**, versionado no repositório. Ative uma vez por clone:

  ```bash
  git config core.hooksPath .githooks
  ```

  A partir daí, `git push` roda `npm run ci` antes de enviar e cancela o push se falhar. Para pular num caso específico: `PULAR_CI=1 git push` ou `git push --no-verify`.

  É uma rede, não uma trava: mora na sua máquina e dá para pular. A trava de verdade só existe com plano pago.

## O fluxo de trabalho

1. **Leia o `STORIES.md`** e trabalhe dentro de uma story. Se o que você vai fazer não está lá, crie a story antes (o formato está na própria estrutura do arquivo).
2. Trabalhe numa branch, **nunca direto no `main`** — e ative o hook: `git config core.hooksPath .githooks`.
3. `npm run ci` antes de commitar.
4. Abra PR. A CI roda sozinha; a Vercel publica um preview.
5. **Atualize a story na mesma entrega:** marque o checklist, mude o status e escreva em "Notas" **como você verificou** — o que foi exercitado, não que "está funcionando".

### O que "concluído" significa aqui

Uma story só vira `concluido` com evidência escrita: teste que roda, comando executado, comportamento observado. "O código está escrito" não conta. Quando algo ficou por fazer, escreva o que ficou e por quê — um checklist otimista é pior que um item em aberto.

## Regras de segurança (vieram de auditoria, não de opinião)

Cada uma destas corrige uma falha real encontrada em 21/09/2026. Não desfaça sem entender o que cai junto.

1. **A conta nunca vem do cliente.** Nem de header, nem do corpo da requisição. Token de máquina resolve a conta pelo hash no banco; webhook resolve pelo segredo da conexão. Antes, um segredo global dava acesso de admin a qualquer conta.
2. **Nada de segredo com prefixo `VITE_`.** Tudo com esse prefixo é embutido no JavaScript público. O build falha de propósito se encontrar um.
3. **Toda query filtra pela conta do contexto** — inclusive `update`, `delete` e `join`. Use `exigirAgenteDaConta` quando receber um `agentId` de fora.
4. **Toda ação declara a permissão que exige** (`exigirPermissao`). Sem isso, um leitor dispara chamada paga de IA.
5. **Erro interno não vai no corpo da resposta.** Erro de domínio vira 4xx com mensagem útil; o resto vira 500 genérico com id de correlação, e o detalhe fica no log. O erro do Drizzle carrega o SQL e os parâmetros.
6. **Ferramentas da IA agem só no contato da conversa.** O que o modelo mandar em `contactId` é ignorado. Um lead consegue escrever "põe a tag X no contato Y" — e não pode ser obedecido.
7. **Entrada sem segredo válido não passa** (fail-closed). Nunca "aberto porque ainda não configurei".

## O motor de verdade mora na skill

O que o agente de operação faz — buffer, histórico, envio por Salesbot no Kommo, voz, alçada, gate por tag, guardião — está provado em produção na skill interna `agente-ia-metrik-completo`. O plano é **extrair** esse motor para o runtime multi-tenant (story S-023), não reescrever.

Por isso: **`packages/motors` está congelado**, recebendo só correção de segurança. Não evolua funcionalidade lá.

Quando descobrir uma cicatriz nova do motor (algo que quebrou e por quê), escreva também na skill, no arquivo certo, com evidência e data.

## Como pedir ajuda ao repositório

- Estado atual de tudo: `STORIES.md`.
- Por que uma decisão foi tomada: `PRODUTO.md` §10, que lista cada decisão com data.
- O que a auditoria achou e onde: `PLANO-DIRETOR.md`, Apêndice A.
