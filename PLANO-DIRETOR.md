# Plano Diretor — Metrik-OS

> O que este documento responde: **para onde o Metrik-OS vai, em que ordem, e por quê.**
> O produto (conceito, módulos, permissões, protocolos, decisões) está em [`PRODUTO.md`](PRODUTO.md).
> O estado de cada frente está em [`STORIES.md`](STORIES.md).
> Doutrina de origem: `ARQUITETURA.md` · `ORIENTACAO.md` · `BACKEND.md` · `PLATAFORMA.md` — parcialmente defasados, corrigidos pelas stories que tocam cada assunto.

Reescrito em 2026-09-23, depois da definição do produto e da decisão de **hospedar tudo na Metrik**. A base técnica é a auditoria de 2026-09-21 (commit `55a7025`).

---

## 1. A tese

**O Metrik-OS é a bancada hospedada onde um agente construtor monta, mantém e audita agentes de IA que trabalham dentro do CRM do cliente.**

O que a Metrik vende não é o modelo de IA — o cliente traz o token dele, e pode até trazer a própria IA de terminal pelo MCP. O que ela vende é:
- **os módulos prontos**, que carregam o que a casa aprendeu em produção;
- **a orientação** que faz qualquer IA trabalhar como um implementador da Metrik;
- **as travas** que impedem que isso quebre o CRM de quem paga;
- **a infraestrutura** que roda tudo isso sem o cliente manter nada.

Duas réguas decidem se algo entra:
1. **Devolve hora do dono** (dele ou nossa)?
2. **Aumenta a confiança no que a IA faz** (prova, histórico, reversibilidade)?

O que não faz nenhuma das duas não entra agora.

---

## 2. Onde estamos

**O que existe e serve de base:**
- Um front com identidade própria e um Estúdio já em evolução rápida.
- Uma Control API com o verbo certo: `inspecionar · propor · testar · publicar · reverter`. É o embrião da camada de ferramentas que o MCP vai expor.
- Adapters GHL e Kommo, motores de follow-up/atendimento/agenda e um porteiro de evals — todos frágeis, mas com os contratos no lugar.
- O motor provado em produção, na skill `agente-ia-metrik-completo`, que é de onde o runtime vai ser extraído.

**O que impede de pôr um cliente real** (auditoria de 21/09, rastreio no Apêndice A):

| Área | Problema | Gravidade |
|---|---|---|
| Segurança | Token de máquina e webhook derivam o tenant do cliente; webhook aberto sem segredo; a IA pode agir em contato de terceiros | 🔴 crítico |
| Isolamento | Escritas sem filtro de conta; sem RLS; papéis não aplicados | 🔴 crítico com hospedagem própria |
| Publicação | Publicar não é atômico (agente pode ficar mudo); porteiro não barra nada | 🟠 alto |
| Runtime | Estado em memória, sem idempotência, envios que dizem `ok` sem entregar, fuso UTC, sem histórico de conversa | 🟠 alto |
| Tela | Dado fictício aparece para cliente logado | 🟠 alto |
| Base | Sem CI, sem lint, um arquivo de teste, ~1.600 linhas mortas | 🟡 médio |

**O que a decisão de hospedar mudou:**
- Cofre de credenciais e isolamento entre contas saem do "depois" e viram **requisito de lançamento** — a Metrik passa a guardar tokens de CRM, WhatsApp e IA, e as conversas completas de todos os clientes.
- A plataforma entra **no caminho de cada mensagem de lead**: fila, idempotência e limite por conta deixam de ser refinamento.
- Somem o contrato entre infraestruturas e o pacote versionado por cliente. **Um runtime só**, nosso, atualizado por nós.
- `packages/motors` continua sendo uma reimplementação mais fraca do motor da skill. Ele será **substituído pela extração do motor provado** (S-023), não evoluído.

---

## 3. As fases

Cada fase tem um **portão de saída**. As estimativas são de esforço com Claude Code, não de calendário.

```
Fase 0            Fase 1               Fase 2                 Fase 3              Fase 4
Contenção         Fundação             Runtime multi-tenant   A bancada           Primeiros clientes
~1 semana         ~2 semanas           ~4 semanas             ~5 semanas          ~3 semanas
   │                 │                    │                      │                   │
   └── portão ───────┴── portão ──────────┴── portão ────────────┴── portão ─────────┘
```

### Fase 0 — Contenção: nada vaza, nada mente

`S-002` CI, lint e testes · `S-003` auth de máquina por conta · `S-004` webhook fail-closed · `S-005` tools presas ao contato · `S-006` isolamento e papéis no control plane · `S-007` tela honesta.

**Portão:** CI verde obrigatório no `main`; teste provando que a conta A não lê nem escreve na conta B; webhook sem segredo responde 503; varredura do app logado sem nenhum dado fictício.

### Fase 1 — Fundação: o que uma plataforma hospedada precisa ter

`S-045` autenticação própria · `S-025` cofre de credenciais · `S-010` integridade do banco · `S-011` RLS · `S-008` publicação atômica · `S-009` porteiro de verdade · `S-012` observabilidade · `S-035` manifesto de módulo · `S-013` front enxuto · `S-014` dados ao vivo e fuso · `S-029` piloto de grupos.

**Portão:** login próprio no ar, sem Clerk, com convite e permissões funcionando; credencial de cliente guardada e usada sem nunca voltar à tela; RLS recusando leitura cruzada; mudança reprovada não consegue ser publicada por nenhum caminho; um módulo de exemplo descrito por manifesto se configura sozinho na tela.

### Fase 2 — Runtime multi-tenant: o motor provado, rodando para todos

`S-023` extrair o motor da skill e unificar GHL + Kommo · `S-024` estado, filas e idempotência no Redis · `S-026` canais reais de entrada e saída · `S-027` resiliência e custo · `S-020` controles de operador · `S-019` conexões com teste real.

**Portão:** o dogfood da Metrik atendido pelo runtime da plataforma por 14 dias, com taxa de erro ≤ a do deploy antigo; nenhuma mensagem duplicada nem perdida; pausa funcionando em menos de 1 minuto.

### Fase 3 — A bancada: o produto que o cliente usa

`S-034` servidor MCP · `S-036` Studio com o construtor interno · `S-030` catálogo de módulos · `S-039` composição de módulos · `S-040` conectores declarativos e MCP de terceiros · `S-037` painéis declarativos · `S-038` Logs de auditoria · `S-041` orientação sob demanda · `S-031` Escola · `S-022` permissões e modo desenvolvedor · `S-015` Studio no celular · `S-042` Início · `S-043` página do agente · `S-044` Conta e Conexões.

**Portão:** o recorte de ponta a ponta do `PRODUTO.md` §12 rodando: conta criada, módulos instalados, agente configurado pelo Studio, atendendo, com ajuste pedido pela interface e outro pelo Claude Code, os dois no mesmo histórico.

### Fase 4 — Primeiros clientes

`S-021` métricas que o cliente paga · `S-032` onboarding de conta · `S-028` migrar os clientes atuais para a plataforma · `S-033` planos e cobrança (adiado até a P-5).

**Portão:** três clientes reais operando na plataforma, sem deploy próprio, por 30 dias.

---

## 4. Como medimos

| Métrica | Onde | Meta |
|---|---|---|
| Afirmações falsas na tela (logado) | varredura do S-007 a cada release | **0** |
| Vazamento entre contas | testes de isolamento na CI | **0**, e RLS como segunda barreira |
| Mensagem de lead perdida ou duplicada | Logs × provedor | **0** |
| Publicações que deixaram agente sem spec | consulta ao banco | **0** |
| Tempo para saber o estado de todas as contas | visão de frota | < 30 s |
| Taxa de erro por execução | Logs | ≤ baseline do deploy antigo |
| Hora do dono em operação por cliente | registro mensal | de ~2,4 h para < 0,5 h/mês |
| Custo de infraestrutura por conta | medição desde o dia 1 | dentro da franquia do plano |

---

## 5. Riscos do plano

| Risco | Resposta |
|---|---|
| **Hospedar tudo** põe a operação de todos os clientes num ponto só | Fase 2 com fila, idempotência e limite por conta; pausa e rollback provados antes de migrar alguém |
| **Guardar conversa completa** de todos os clientes (LGPD) | RLS, cofre, retenção declarada, exclusão sob pedido, acesso registrado — Fase 1, antes de qualquer cliente real |
| **Reescrever o motor em vez de extrair** | S-023 é extração do motor da skill; `packages/motors` congelado, só correção de segurança |
| **Front sendo redesenhado a cada semana** | `PRODUTO.md` fixa navegação e papéis; mudança de tela passa por story |
| **Escopo inflando pelo catálogo** | Só entra no catálogo de lançamento o que já foi provado em produção na skill |
| **Kommo atrasando o lançamento** | O Kommo precisa do prompt editável com testes, que hoje só existe no GHL. Isso está dentro do S-023 e é o maior risco de prazo da Fase 2 |

---

## 6. Regras de condução

1. **Uma story em andamento por pessoa.**
2. **Nada é `concluido` sem "Verificado:"** dizendo o que foi exercitado.
3. **Cicatriz nova do motor** vai também para a skill, no arquivo certo (`SKILL.md` §7.1).
4. **Ideia nova** passa pela régua do `PRODUTO.md` (é módulo? artefato de qual tipo? que zona?) antes de virar story.
5. **Doc que mente é corrigido pela story que toca o assunto.**
6. **Nenhum cliente real antes do portão da Fase 2.**

---

## Apêndice A — rastreio dos achados da auditoria (21/09)

| Achado | Onde | Story |
|---|---|---|
| Token de máquina com `org_id` do header, papel admin, comparação não constante | `apps/web/api/_auth.ts:11-16` | S-003 |
| `VITE_MOTOR_TOKEN` pode ir para o bundle público | `apps/web/src/lib/api.ts:10-12` | S-003 |
| Webhook aberto sem segredo, tenant vindo do corpo | `apps/web/api/webhook.ts:15-26` | S-004 |
| Pausa e assumir em fail-open; sem dedupe de mensagem | `apps/web/api/webhook.ts:30-48` | S-020, S-024 |
| `contactId` da tool vem do LLM (injeção entre contatos) | `packages/motors/src/atendimento.ts:46` | S-005 |
| Tools sem schema de parâmetros | `packages/llm/src/openai.ts:73-77` | S-005 |
| Escritas sem `org_id`; agente de outra conta aceito; join vazando | `packages/control/src/index.ts:195, 79-97, 125, 733` | S-006 |
| Papéis não aplicados (viewer dispara LLM e grava valor) | `packages/control/src/index.ts` | S-006, S-022 |
| Erro interno devolvido ao cliente; 500 para tudo; sem log | `apps/web/api/control.ts:21,92` | S-006, S-012 |
| Dado demo para cliente logado | `lib/agents.tsx:86`, `views/Inicio.tsx`, `FechamentoDia.tsx`, `Conexoes.tsx`, `Modulos.tsx`, `Estudio.tsx:654` | S-007 |
| `live-run` grava execuções sintéticas no banco real | `apps/runtime/src/live-run.ts` | S-007 |
| Publicar não atômico; CAS sem versão-base; publica sem checar status | `packages/control/src/index.ts:146-198, 629-648` | S-008 |
| Eval tautológico; eval real sem tools; `gate()` nunca chamado | `packages/evals/src/runner.ts:55`, `packages/control/src/index.ts:347,407` | S-009 |
| Sem FKs de `org_id`, sem uniques, ledger e releases mutáveis | `packages/db/` | S-010 |
| RLS prometido nos docs e inexistente | `packages/db/drizzle/*.sql` | S-011 |
| Log duplicado e fire-and-forget; health sem banco | `apps/runtime/src/host.ts:70-84`, `pipeline.ts:57` | S-012 |
| ~1.600 linhas mortas, `any`, sem lint | `apps/web/src/views/AgentDetail.tsx` | S-013 |
| Polling duplicado, `getToken` instável, contagem sobre 50 logs, fuso UTC | `apps/web/src/lib/live.ts`, `main.tsx:76` | S-014 |
| Estúdio sem layout mobile | `apps/web/src/views/Estudio.tsx:366` | S-015 |
| Conexões e Módulos 100% maquete | `apps/web/src/views/Conexoes.tsx`, `Modulos.tsx` | S-019, S-030 |
| Estado de follow-up em memória; envio sem idempotência | `apps/runtime/src/host.ts:66`, `packages/motors/src/followup.ts:270-286` | S-024 |
| Janela comercial em UTC; janela noturna liberando tudo; sem anti-eco | `packages/motors/src/followup.ts:78-90` | S-023, S-024 |
| Vault inexistente; `vaultRef` livre; token GHL sem refresh | `apps/runtime/src/host.ts:29`, `packages/crm/src/ghl.ts` | S-025 |
| uazapi stub com `ok:true`; Kommo "envia" como nota; FakeBrain em produção; follow-up padrão não entrega | `packages/messaging/src/transports.ts:113`, `crm/src/kommo.ts:236`, `llm/src/index.ts:35`, `runtime/src/host.ts:118-125` | S-026 |
| Sem retry/429/timeout; tags Kommo por ler-modificar-gravar; OpenAI guardando PII | `packages/crm/src/*.ts`, `packages/llm/src/openai.ts` | S-027 |
| DDL em runtime, drift de índice e segredo na query string no piloto de grupos | `apps/web/api/group-reader.ts:179-211` | S-029 |
