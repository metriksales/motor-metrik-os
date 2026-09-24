# Produto — Metrik-OS

> O que este documento responde: **o que o Metrik-OS é, para quem, e como as peças se encaixam.**
> Estratégia e ordem de execução: [`PLANO-DIRETOR.md`](PLANO-DIRETOR.md). Frentes de trabalho: [`STORIES.md`](STORIES.md).
> Status: **rascunho para validação** — conversa de 2026-09-21 a 23. **Modelo de hospedagem revisto em 23/09: tudo hospedado na Metrik** (§7). Decisões em aberto estão marcadas na §10.

---

## 1. O conceito

**O Metrik-OS é uma bancada multi-tenant para desenvolver, acoplar, auditar e manter agentes de IA integrados a CRM (Kommo, GoHighLevel), WhatsApp e outros serviços.**

A bancada vem com ferramentas prontas (artefatos), com o conhecimento da Metrik para guiar quem trabalha nela, e com a infraestrutura para rodar o que for montado. Quem monta e mantém a operação na bancada é o **agente construtor**: a IA do próprio assinante, conectada por MCP (Claude Code, Codex, Deepseek, qualquer IA de terminal), ou o **construtor interno** da plataforma — o caminho principal —, que usa o token de IA cadastrado pelo cliente. Quem trabalha no dia a dia do cliente (atende leads, faz follow-up, move o funil) é o **agente de operação**, montado pelo construtor.

Em uma linha: **a bancada com as ferramentas, a IA que opera as ferramentas, e a infraestrutura que roda o que ela monta.**

---

## 2. As quatro camadas

| Camada | O que é | De quem é o valor |
|---|---|---|
| **Bancada** | Os artefatos pré-montados: agente SDR, follow-up, painéis de métricas, conectores, auditoria de CRM | Metrik |
| **Orientação do construtor** | As skills que vêm **dentro de cada módulo** (como instalar, configurar e diagnosticar aquele módulo) + o **contexto da conta**, mantido pelo próprio construtor | Metrik (skills) e a conta (contexto) |
| **Agente construtor** | A IA que monta e mantém a operação: externa (MCP) ou interna (chave do cliente) | Intercambiável |
| **Infraestrutura** | Onde o que foi montado roda: runtime, travas de governança, histórico, versões, rollback | Metrik |

**O modelo é intercambiável; a orientação que ele recebe é nossa.** O diferencial é conhecimento que a IA consegue executar — mais as travas que garantem que ela não quebra nada.

Duas consequências de desenho:

1. **As travas moram no servidor, dentro das ferramentas.** Nunca no prompt: não controlamos o prompt da IA do cliente. Validar IDs do CRM, respeitar a alçada, exigir teste antes de publicar — tudo isso é comportamento da plataforma, e vale para qualquer IA.
2. **A orientação é entregue sob demanda.** O agente construtor recebe as skills do módulo em que está mexendo, não o dossiê inteiro. Protege o ativo (o que sai pelo MCP pode ser copiado) e é melhor engenharia de contexto. O que se vende é a atualização contínua, não o texto.

> **Conhecimento × orientação (decidido em 2026-09-22).** "Conhecimento" é só do **agente de operação** (ofertas, FAQ, objeções). O **agente construtor** aprende pelos **módulos**, que trazem as skills junto, e tem gestão própria de contexto (§6).

---

## 3. Contas, pessoas e permissões

**Conta = um cliente.** Tudo o que existe (agentes, artefatos, conexões, execuções, histórico) pertence a uma conta e é isolado dela.

**Um usuário pode acessar várias contas**, e troca entre elas pelo seletor de contas. É o caso típico de quem implementa para vários clientes: uma conta por cliente, todas no mesmo login.

### Dono e usuários com permissões (decidido em 2026-09-22)

A plataforma **não** tem papéis fixos como "implementador" ou "dono de empresa". Tem:

- **O dono da conta** — quem a criou ou recebeu a titularidade. Pode tudo, inclusive gerenciar pessoas e permissões.
- **Usuários com permissões** — cada pessoa convidada recebe um conjunto de permissões naquela conta.

Isso cobre os dois arranjos reais: o dono da conta pode ser o implementador (que dá ao cliente dele um acesso sem área de desenvolvimento), ou o dono pode ser o dono do negócio (que convida um implementador com acesso total).

Permissões propostas (a lista fina será detalhada em story própria):

| Permissão | Permite |
|---|---|
| **Ver** | ver tudo da conta |
| **Operar** | pausar e retomar agentes, assumir e devolver conversas |
| **Ajustar** | pedir mudanças 🟢 🟡 no Studio, editar Conhecimento |
| **Aprovar e publicar** | aprovar e publicar mudanças |
| **Modo desenvolvedor** | entrar no modo desenvolvedor (abaixo) |
| **Gerenciar pessoas** | convidar, remover e mudar permissões |

A permissão é **por conta**: a mesma pessoa pode ter modo desenvolvedor na conta A e só ver na conta B.

**Quem paga** é um atributo da conta (o responsável de cobrança), não uma permissão.

**Visão de frota:** quem acessa várias contas vê, no seletor de contas, um consolidado de todas elas — agentes no ar, versão, taxa de erro, o que está pausado. É a "frota que se reporta" do `ESCALA.md`, como funcionalidade do produto.

### Modo normal e modo desenvolvedor

Inspirado no app do Claude, que alterna entre o Claude normal e o Claude Code: a mesma plataforma tem **dois modos**, e quem tem a permissão alterna entre eles com um clique. O dono sempre pode.

| | Modo normal | Modo desenvolvedor |
|---|---|---|
| Para quê | operar e manter o dia a dia | construir, instalar e mexer no que é técnico |
| Construtor | construtor interno no Studio, em linguagem de negócio | construtor interno com orientação técnica; acesso via MCP para o construtor externo |
| Zonas alcançadas | 🟢 🟡 | 🟢 🟡 🔴 |
| O que aparece a mais | — | conexões técnicas e credenciais, instalar módulos do catálogo, gate por tag e alçada, sessões do construtor externo, configuração crua, acesso MCP |

Regra: **o construtor externo age com as permissões de quem o autorizou.** Um Claude Code conectado via MCP por um usuário sem modo desenvolvedor não alcança o que é 🔴.

Mesmas ferramentas, mesmo histórico, mesmas travas nos dois modos. O modo muda o que aparece e o que se alcança, não as regras.

### Navegação (decidida em 2026-09-22)

Menu lateral:

| Item | O que é |
|---|---|
| **Início** | O dashboard: estado da operação, painéis de resultado, o que precisa de atenção |
| **Studio** | A principal tela de interação com o **construtor interno**. Vale para a conta inteira: pode mexer em qualquer agente e qualquer módulo. Aberto a partir de "corrigir isso" numa conversa, já vem apontado para aquele agente, com a conversa como exemplo |
| **Agentes** | Os agentes de operação da conta; cada um tem sua página (abas provisórias: Visão geral, Conversas, Conhecimento, Configuração e Técnico — esta só no modo desenvolvedor). Detalhamento de cada página fica para stories próprias |
| **Módulos** | O catálogo de artefatos. Todos veem tudo; cada módulo mostra a ação possível para quem está vendo (ligar, pedir, instalar) |
| **Logs** | **Tabela única de auditoria com filtros**: todas as execuções dos agentes de operação e todos os registros de mudança, com autor, origem (interface, Studio, construtor externo) e data |
| **Conta** | Pessoas e permissões, e uma área de **Conexões** — incluindo a chave de API da IA que alimenta o construtor interno |

---

## 4. Módulos e artefatos

**O módulo é a unidade instalável da bancada** (decidido em 2026-09-22). Um módulo é um pacote que contém um ou mais **artefatos** e as **skills** que ensinam o agente construtor a instalá-lo, configurá-lo e diagnosticá-lo. Exemplo: o módulo "Follow-up" traz a automação de follow-up, o painel de recuperação, a regra de horário comercial e a skill de configuração.

Na interface e nas conversas se fala em **módulo**. "Artefato" é o termo técnico interno para as peças de dentro.

**Módulo Base por CRM.** Toda conta recebe automaticamente o módulo Base do seu CRM ("Base GHL", "Base Kommo"). Ele traz o conector, as leis da plataforma (IDs do CRM sempre ao vivo, alçada até "Agendado", gate por tag, teste antes de publicar) e os playbooks que não pertencem a um módulo específico ("o agente parou", "auditar o CRM", "instalar o agente de operação").

Cada **artefato** é uma peça que se declara (o que faz, o que precisa, o que pode mudar, como se prova) e que a plataforma sabe instalar, configurar, testar, rodar, mostrar e versionar.

### Tipos de artefato

| Tipo | O que é | Exemplos |
|---|---|---|
| **Agente de operação** | Trabalhador com gatilho e canal próprios | SDR no WhatsApp, agente de ação no CRM |
| **Automação** | Gatilho → ação, plugada num agente ou na conta | follow-up, alerta de lead nervoso, recuperação de no-show |
| **Conector** | Acesso a um serviço externo, expondo ferramentas | Kommo, GHL, uazapi, ZapSign, AdvBox, gateway de pagamento |
| **Painel** | Tela de acompanhamento, declarada (A2UI) | métricas em tempo real, funil, fechamento do dia |
| **Regra** | Limite de comportamento | alçada até "Agendado", horário comercial, não dar desconto |
| **Conhecimento** | Base que o agente consulta | catálogo, FAQ, objeções |

Isso substitui a taxonomia antiga (motor, módulo, feature, integração, regra). O "motor" da `ORIENTACAO.md` passa a ser detalhe interno de um artefato; a "feature" liga/desliga vira um campo de configuração.

### O que todo artefato declara (manifesto)

```
id, tipo, versão, nome, descrição (para humano e para IA)
config        → campos, cada um com tipo, validação e ZONA (🟢 🟡 🔴)
precisa       → conectores e permissões (ex.: kommo: leads.escrever)
gatilhos      → quando age (mensagem, etapa do funil, horário, botão)
ferramentas   → o que ele oferece a agentes (ex.: agendar, cobrar)
telas         → painéis A2UI que ele mostra
provas        → testes/evals que precisam passar para publicar
skills        → a orientação que o agente construtor recebe ao instalar, configurar ou diagnosticar este artefato
```

### Catálogo × instância

- **Módulo do catálogo** é da Metrik, versionado, e evolui para todos. Nunca é copiado para dentro de uma conta.
- **Instância** é o módulo instalado numa conta, com a configuração daquela conta.
- Atualizar o catálogo atualiza todas as instâncias (respeitando a versão fixada, em ondas).

É a regra da `ORIENTACAO.md` — "um motor, N configurações; nunca um motor por cliente" — virando estrutura de dados.

---

## 5. O que o agente construtor pode gerar

Três níveis, com custo e risco muito diferentes:

| Nível | O construtor… | Risco |
|---|---|---|
| **1 · Configurar** | preenche a configuração de um artefato do catálogo | baixo |
| **2 · Compor** | instala e liga artefatos entre si, declara painéis e conectores | médio |
| **3 · Programar** | escreve código novo que roda na plataforma | alto |

### O exercício de classificação

| Pedido | Nível | Como |
|---|---|---|
| Ajustar o prompt / o jeito de falar | 1 | config do agente, via "ensinar a IA" |
| Follow-up com N toques em horário comercial | 1 | config da automação follow-up |
| Tag e aviso quando o lead fica nervoso | 2 | automação ligada ao agente |
| Painel de métricas em tempo real | 2 | painel A2UI sobre dados que já existem |
| Integração ZapSign / AdvBox | 1–2 | conector do catálogo |
| Integração com gateway de pagamento | 1–2 | conector do catálogo, ou declarativo (abaixo) |
| Integração com um serviço que ninguém previu | 2 | conector declarativo ou servidor MCP externo |
| Lógica realmente exclusiva de um cliente | 3 | código em sandbox — exceção |

**Conclusão:** quase tudo cabe em configurar e compor, desde que a bancada tenha um bom sistema de conectores. Quando um pedido parece exigir código, geralmente o que falta é um artefato no catálogo.

### Conectores em quatro degraus

1. **Do catálogo** — feitos e mantidos pela Metrik (Kommo, GHL, uazapi, ZapSign…).
2. **Declarativo** — a IA descreve o serviço (URL, autenticação, endpoints; ou importa um OpenAPI) e a plataforma gera as ferramentas. Sem código livre.
3. **Servidor MCP externo** — muitos serviços já oferecem MCP; o agente usa as ferramentas dele. A plataforma guarda a credencial e controla quais ferramentas o agente pode chamar.
4. **Código em sandbox** — último recurso, isolado por conta, com teste obrigatório.

Proposta: **lançar com os níveis 1 e 2 e os conectores 1 a 3.** O nível 3 entra depois, em sandbox.

---


### O que entra no lançamento (P-2, decidido em 2026-09-23)

**Tudo que o construtor produz é declarativo** — dados validados contra o manifesto de um módulo. **Nenhum código gerado é executado**, o que pesa ainda mais com o runtime compartilhado entre todas as contas (§7).

| Nível | O que faz no lançamento | Limites |
|---|---|---|
| **1 · Configurar** | Campos dos módulos instalados: prompt e jeito de falar, cadência do follow-up, horários, textos, liga/desliga, conhecimento (ofertas, FAQ, objeções), regras | Só campos declarados no manifesto, cada um com sua zona; valor inválido é recusado pelo esquema |
| **2 · Compor** | Instala módulos; liga gatilho de um à ação de outro; cria regras; declara painéis com componentes do catálogo (A2UI); cria conectores declarativos (OpenAPI ou endpoints descritos); conecta servidores MCP de terceiros | Só gatilhos e ações declarados pelos módulos instalados; painel só com componentes do catálogo; conector declarativo vira chamada HTTP configurada, não código |
| **3 · Programar** | **Fora do lançamento.** Exigiria sandbox isolado por conta, limite de recursos, controle de saída de rede e portão de teste próprio | — |

**Escada para pedidos que parecem exigir código:** conector do catálogo → conector declarativo → servidor MCP do serviço → **pedido de módulo novo à Metrik**, que nasce no catálogo para todos. O último degrau é o que impede o retorno do fork por cliente.

**Travas que valem para tudo que o construtor gera:**
- toda composição passa por mudança → teste → aprovação → publicação → Logs;
- a zona manda: 🟢 na hora, 🟡 com teste, 🔴 só no modo desenvolvedor;
- **detecção de ciclo e limite de disparos por conta** — compor gatilho com ação permite laço entre automações;
- o construtor não inventa conector nem permissão: se um módulo exige credencial que a conta não tem, ele para e pede.

## 6. Os protocolos

```
   Construtor externo (Claude Code, Codex…)      Navegador do assinante
              │                                          ▲
             MCP  (ferramentas + conhecimento)   AG-UI (conversa, estado, aprovação)
              │                                          │   └─ A2UI (telas declaradas)
              ▼                                          │
      ┌──────────────── Camada de ferramentas única ───────────────┐
      │  conta · artefato · mudança · crm · execuções · conhecimento│ ◄── construtor interno (chave do cliente)
      └─────────────────────────────────────────────────────────────┘      usa as MESMAS ferramentas
                                  │
                   Runtime: agentes, automações, conectores
```

| Protocolo | Liga o quê | Papel no Metrik-OS |
|---|---|---|
| **MCP** | IA ↔ ferramentas e dados | O Metrik-OS é um **servidor MCP remoto**, com OAuth por usuário e escopo por conta. Ferramentas = ações da bancada; resources = specs, manifestos, execuções, esquema do CRM; prompts = o conhecimento (playbooks). Também é **cliente MCP**, para usar servidores MCP de terceiros como conectores. |
| **AG-UI** | construtor interno ↔ pessoa | Conversa em streaming, chamadas de ferramenta visíveis, estado compartilhado (o artefato sendo editado) e pausas para aprovação. Também mostra ao vivo o que um construtor externo está fazendo via MCP. |
| **A2UI** | O que a IA desenha na tela | Telas em JSON declarativo, montadas só com componentes do catálogo da Metrik (KPI, gráfico, tabela, funil, formulário). Nenhum código gerado roda no navegador. É o princípio "o manifesto desenha a tela" num padrão aberto. |

A Control API atual (`inspecionar · propor · testar · publicar · reverter`) é o embrião da camada de ferramentas; o Estúdio (chat + artefato vivo) é o embrião da experiência AG-UI; o manifesto que desenha a tela é o embrião do catálogo A2UI.

> Conferir o estado atual das especificações de A2UI e da extensão de interface do MCP antes de fixar detalhes — ambas estavam em versões iniciais.

### Primeira lista de ferramentas (usadas pelo construtor, externo ou interno)

| Grupo | Ferramentas |
|---|---|
| `conta` | listar contas acessíveis, ler estado da conta |
| `artefato` | buscar no catálogo, instalar, ler instância, configurar |
| `mudanca` | propor, testar, ver antes/depois, aprovar, publicar, reverter, histórico |
| `crm` | inspecionar esquema, validar mapa de IDs, auditar funil, simular escrita (dry-run) |
| `agente` | pausar, retomar, recado do dia, assumir conversa |
| `execucoes` | listar, ler uma execução, métricas |
| `conhecimento` | buscar orientação para a tarefa atual |

Toda ferramenta aplica, no servidor: conta do token, papel da pessoa, zona do campo, e dry-run antes de qualquer escrita no CRM.

---

### Os três modos do agente construtor

| Modo | Onde a pessoa conversa | Onde o construtor roda | Como funciona |
|---|---|---|---|
| **1 · Interno** | Interface da plataforma | Na plataforma, com a chave de API do cliente | O construtor interno é só mais um cliente das mesmas ferramentas |
| **2 · Externo pelo terminal** | Terminal do usuário | PC do usuário (Claude Code, Codex…) | Servidor MCP remoto + OAuth; orientação distribuída como plugin (Claude Code) ou `AGENTS.md` (Codex); a interface mostra ao vivo o que ele faz |
| **3 · Externo pela plataforma** | Interface da plataforma | PC do usuário | **Receita de polling**: um script no PC consulta a caixa de entrada da sessão; ao chegar mensagem, aciona o construtor em modo não interativo, que age e responde pelo MCP |

Em todos os modos, **toda ação na bancada passa pelas mesmas ferramentas MCP**; o que muda é só por onde passa a conversa. Toda sessão de construção cai no mesmo histórico, com a origem (interno, terminal, polling).

Modo 3, o que a plataforma oferece: caixa de entrada por sessão, consulta longa de novas mensagens, ferramenta MCP de responder na sessão, e um script de referência na documentação. Cuidados da receita: retomar a mesma sessão do construtor a cada mensagem; acionar só com as ferramentas da Metrik (sem terminal); mostrar "construtor offline" quando o script não consulta há algum tempo; conferir os termos de uso das assinaturas antes de recomendar.

Webhooks servem para a plataforma **avisar** (mudança aguardando aprovação, agente de operação falhando, conector sem token), não para conversar com o construtor.

### Contexto do agente construtor

O agente construtor tem **gestão própria de contexto**, separada do conhecimento do agente de operação. Para começar, cada conta tem um **campo de instruções do construtor**, equivalente ao `CLAUDE.md` do Claude Code: o que o construtor precisa saber sobre aquele cliente para trabalhar bem (particularidades do funil, decisões já tomadas, o que não mexer, como o cliente gosta das coisas).

- Vale para o construtor interno e para o externo: o externo recebe o mesmo campo via MCP.
- Quem edita: pessoas com modo desenvolvedor, direto. O próprio construtor pode **propor acréscimos** quando aprende algo sobre o cliente (ex.: "neste cliente, Qualificado exige orçamento informado"); a proposta vira uma mudança como qualquer outra — aparece nos Logs e alguém aprova.
- Começa com um campo por conta; por agente, depois, se precisar.
- A orientação que o construtor recebe numa tarefa = leis e playbooks do módulo Base + skills do módulo em questão + instruções da conta.

## 7. Os dois agentes, e onde cada um roda

Há dois agentes diferentes, e isso precisa ficar explícito:

- **O agente construtor** monta e mantém a operação. Trabalha em sessões, quando alguém está usando.
- **O agente de operação** (o SDR que atende leads, o follow-up, as automações) roda 24/7 e não depende de ninguém estar com o terminal aberto.

### Decidido (2026-09-23): tudo hospedado na Metrik

O agente de operação roda **na infraestrutura da Metrik**. Não há auto-hospedagem: o cliente não faz deploy de nada, não mantém Vercel nem Redis, e não existe pacote versionado por cliente. Um runtime **compartilhado e multi-tenant** atende todas as contas; o que é por cliente são só os **dados**: configuração, credenciais, execuções, histórico.

| Fica na plataforma (Metrik) | Fica com o cliente |
|---|---|
| O runtime do agente de operação, compartilhado e versionado por nós | As credenciais **de origem**: token do CRM, instância de WhatsApp, chave de LLM — cadastradas na plataforma pela pessoa |
| Configuração, versões publicadas, histórico de mudanças | Nada de infraestrutura |
| Execuções com o texto completo das conversas, painéis, testes, aprovações | |
| Cofre de credenciais por conta, filas, estado das conversas | |

Os webhooks do CRM e do WhatsApp apontam **para a plataforma**. Ela está no caminho de cada mensagem, o que traz três obrigações que antes seriam do cliente: aguentar o volume, não misturar contas e não perder mensagem (idempotência e reenvio).

**O que essa escolha resolve**, comparada à auto-hospedagem: acaba o `cp -r` e a frota desatualizada (um runtime só, atualizado por nós); o dono de negócio sem alguém técnico ao lado consegue usar; as travas são de fato garantidas, porque o código é nosso; e a instalação deixa de exigir modo desenvolvedor.

**O que ela cobra:** infraestrutura, disponibilidade e incidentes passam a ser responsabilidade da Metrik; o isolamento entre contas vira requisito de segurança de primeira ordem (é o que as stories S-003, S-006 e S-011 endereçam); e o cofre de credenciais por conta passa a ser obrigatório no lançamento (S-025).

### As chaves de IA

| Para quê | Chave | Onde fica |
|---|---|---|
| **Agente construtor interno** (caminho principal) | token de IA fornecido pelo usuário | cofre da conta; usado só no servidor, nunca devolvido à tela |
| **Agente de operação** | proposta: a mesma chave da conta, ou uma segunda cadastrada para produção | cofre da conta |
| **Agente construtor externo** (Claude Code, Codex) | é a assinatura do próprio usuário, na máquina dele | fora da plataforma |

### O agente construtor: interno primeiro, externo também

- **Interno — o caminho principal.** Roda na plataforma, com o token de IA que o usuário cadastrou. É o Studio. Qualquer pessoa com permissão de ajustar usa, sem terminal e sem instalar nada.
- **Externo — a porta avançada.** Claude Code, Codex ou outra IA de terminal conectada pelo servidor MCP da plataforma. Age com as permissões de quem o autorizou e aparece no mesmo histórico.

---

## 8. Manutenção pela interface

O uso do dia a dia é manter: ajustar o prompt, adicionar uma automação, ligar uma integração. Todos seguem o mesmo caminho:

```
pedido (texto ou voz) → a IA entende e confirma → vira uma MUDANÇA → teste → antes/depois → aprovação → publicação → histórico
```

| Pedido | Zona | O que acontece |
|---|---|---|
| "Fala mais curto", "muda o horário" | 🟢 | aplica com prévia, reversível |
| "Não oferece desconto sem aprovar" | 🟡 | vira regra; passa pelo teste antes de publicar |
| "Adiciona follow-up de 3 toques" | 🟡 | instala a automação com a config; teste; aprovação |
| "Integra com o gateway X" | 🟡 / 🔴 | conector do catálogo (🟡) ou declarativo, no modo desenvolvedor (🔴) |
| "Muda a lógica do agente" | 🔴 | não aparece no modo normal; exige modo desenvolvedor |

Correção de comportamento pelo dono segue o desenho da Escola (`ESCOLA.md` na skill): ele corrige em português, o sistema decide se vira regra, exemplo ou tarefa para quem tem modo desenvolvedor — e, no modo normal, o prompt cru nunca aparece.

Tudo, de qualquer porta (construtor externo, interno ou a própria pessoa na interface), cai no **mesmo histórico**, com origem e autor.

---

## 9. Riscos de produto

| Risco | Por que importa | Resposta |
|---|---|---|
| Conhecimento copiado | o que sai pelo MCP pode ser extraído | entrega sob demanda; travas no servidor; valor na atualização |
| IA externa quebrando o CRM do cliente | ela escreve no CRM real | dry-run, diff, aprovação e desfazer em toda escrita; permissões por conector |
| Código custom por cliente | recria o "inferno do n8n por cliente" | nível 3 só em sandbox e como exceção; o catálogo cresce no lugar |
| Custódia de credenciais | a plataforma guarda tokens de CRM, WhatsApp e IA de todos os clientes | cofre por conta, criptografado, obrigatório no lançamento; credencial nunca volta à tela nem a uma IA; acesso registrado |
| Dados pessoais de leads na plataforma | a telemetria leva o texto completo das conversas; a Metrik vira operadora de dados (LGPD), e o cliente, controlador | contrato de tratamento de dados com o cliente; criptografia em repouso; isolamento por conta no banco (RLS); prazo de retenção; exclusão sob pedido do titular; acesso da equipe Metrik registrado |
| Disponibilidade e volume | a plataforma está no caminho de cada mensagem de lead; se cair, o atendimento de todos para | runtime multi-tenant com fila e reenvio, idempotência por mensagem, limite por conta para um cliente barulhento não derrubar os outros |
| Custo de infraestrutura | agora é da Metrik e cresce com o volume de mensagens e com a retenção do texto completo | preço com franquia de execuções e prazo de retenção; medição por conta desde o dia 1 |
| Suporte do que a IA gerou | cada conta vira única | tudo é composição de artefatos versionados; histórico completo |
| Custo de LLM do assinante | a chave é dele, a surpresa também | orçamento por conta e alerta |

---

## 10. Decisões

### Tomadas

| # | Decisão | Resultado | Data |
|---|---|---|---|
| P-1 | Onde roda o agente de operação | **Tudo hospedado na Metrik**: runtime compartilhado multi-tenant, sem auto-hospedagem e sem pacote por cliente. Revoga a decisão de 22/09 | 2026-09-23 |
| P-3 | De quem é a chave de IA | Do cliente, cadastrada na plataforma e guardada no cofre da conta — para o construtor interno (token fornecido pelo usuário) e para o agente de operação | 2026-09-23 |
| P-7 | O que a telemetria leva à plataforma | Texto completo das conversas, com as obrigações de LGPD da §9 | 2026-09-22 |
| P-6 | Catálogo de lançamento | Ver tabela abaixo — só o que já está provado em produção na skill | 2026-09-22 |
| P-8 | CRMs no lançamento | **GHL e Kommo juntos**, mais uazapi. Consequência: o pacote v1 unifica os dois motores da skill; o sistema de prompt editável com testes (hoje só no GHL) precisa ser portado para o Kommo antes do lançamento | 2026-09-22 |
| P-9 | Construtor interno | **Caminho principal**, com token de IA cadastrado pelo usuário (Conta → Conexões); o construtor externo via MCP é a porta avançada. Consequência: a plataforma guarda um segredo por conta — cofre pequeno, criptografado, usado só no servidor, nunca devolvido à tela nem a uma IA | 2026-09-22 |
| — | Navegação | Início (dashboard) · Studio (conta inteira) · Agentes (com Conversas e Conhecimento dentro) · Módulos (todos veem) · Logs (tabela única de auditoria) · Conta (com Conexões) | 2026-09-22 |
| — | Conhecimento × orientação | Conhecimento é só do agente de operação; o agente construtor aprende pelos módulos (que trazem as skills) e tem um campo de instruções por conta, equivalente ao CLAUDE.md | 2026-09-22 |
| P-2 | O que o construtor pode gerar no lançamento | **Níveis 1 e 2 (configurar e compor), tudo declarativo**; conectores nos degraus 1 a 3; nível 3 (código em sandbox) fora do lançamento; pedido que exige código vira módulo novo no catálogo | 2026-09-23 |
| P-4 | "Puramente WhatsApp" (sem CRM) | Módulo **Base WhatsApp**: contatos e histórico no Redis da plataforma; o agente de operação atende, qualifica, faz follow-up e passa para humano; sem funil; agendar exige conector de agenda. Entra **logo depois** do lançamento (base provada: skill derivada `agente-whatsapp`) | 2026-09-22 |
| — | Módulos | Módulo = pacote instalável com artefatos + skills do construtor; módulo Base por CRM instalado em toda conta; instruções do construtor editadas no modo desenvolvedor, com o construtor propondo acréscimos que passam por aprovação | 2026-09-22 |
| P-10 | Stack | Neon + Vercel + GitHub, sem Upstash e sem QStash; estado e filas no Postgres; cron do Vercel (§11) | 2026-09-23 |
| P-11 | Autenticação | **Sistema próprio**, sem Clerk: sessão por cookie com token opaco, convites e permissões por conta; exige serviço de envio de e-mail — **Resend** (S-045) | 2026-09-23 |
| — | Pessoas | Dono da conta + usuários com permissões por conta; sem papéis fixos. Modo normal × modo desenvolvedor, alternável por quem tem a permissão; construtor externo age com as permissões de quem o autorizou | 2026-09-22 |
| — | Nomes dos agentes | **Agente construtor** (monta e mantém) e **agente de operação** (trabalha no CRM e no atendimento) | 2026-09-22 |
| — | Modo 3 do construtor | Receita de polling documentada + script de referência, sem programa-ponte da Metrik | 2026-09-22 |

### Em aberto

| # | Decisão | Proposta |
|---|---|---|
| P-5 | Como se criam e adquirem contas (quem cria, quem paga, revenda) | A definir junto com cobrança |

### Catálogo de lançamento (P-6)

Critério: entra no lançamento só o que já está provado em produção na skill `agente-ia-metrik-completo`. O catálogo é o que o pacote v1 do agente de operação sabe fazer.

| Tipo | No lançamento | Logo depois |
|---|---|---|
| **Agente de operação** | SDR: atende, qualifica, agenda; entende áudio, imagem e PDF | Agente de ação no CRM (contratos, petições) |
| **Automação** | Follow-up/recuperação · alerta de problema no grupo de WhatsApp · guardião diário (confere IDs do CRM e erros das 24 h) | Briefing diário às 7h · analista semanal · auditoria de funil · resposta por voz |
| **Conector** | GHL · Kommo · uazapi (WhatsApp) | Base WhatsApp (sem CRM) · Google Agenda · Rastreador de origem/UTM · ZapSign · AdvBox · gateway de pagamento · conector declarativo |
| **Painel** | Ao vivo (caixa-preta das execuções) · métricas do dia (atendimentos, agendamentos, custo) | Radar de dinheiro · funil com e sem IA · recibo de valor |
| **Regra** | Alçada até "Agendado" · gate por tag · horário comercial · "não revelar X" | Regras criadas pelo dono via Escola |
| **Conhecimento** | Ofertas e preços · FAQ · objeções | Base maior com busca |

---

## 11. Stack (decidida em 2026-09-23)

| Camada | Escolha | Observação |
|---|---|---|
| **Hospedagem** | Vercel (plano Pro) | funções serverless + front |
| **Banco** | Neon (Postgres) + Drizzle | fonte de verdade; **também guarda estado, filas, travas e idempotência** |
| **Código** | GitHub | com CI obrigatória (S-002) |
| **Autenticação** | **sistema próprio** | sem Clerk; sessão por cookie com token opaco, permissões por conta (S-045) |
| **Agendamento** | cron do Vercel | incluído no Pro: 100 jobs por projeto, granularidade de minuto |
| **E-mail** | **Resend** | código de entrada, convite e verificação; atrás de uma porta no código, para trocar sem migração. Chave da plataforma em variável de ambiente, nunca no cofre nem com prefixo `VITE_` |
| **IA** | chave do cliente, por conta | provedor compatível com OpenAI; cofre guarda a chave |
| **Front** | React + Vite + Tailwind | como já está |
| **Testes** | Vitest | só dependência de desenvolvimento |
| **Observabilidade** | Vercel + tabela de Logs própria | Sentry só se não bastar |

**Fora, por ora:** Upstash Redis e QStash. Tudo que o Redis faria (estado com validade, travas, contadores, fila) é feito no Postgres: `expires_at` com limpeza, restrição de unicidade para idempotência, `advisory lock`, `SELECT ... FOR UPDATE SKIP LOCKED` para fila. Isso também põe o estado das conversas sob a mesma RLS do resto — no Redis, o isolamento dependeria só do prefixo da chave.

Custo não foi o critério: no volume previsto, Upstash e QStash ficariam entre grátis e poucos dólares por mês. O critério foi **menos dependências e isolamento uniforme**.

**Gatilhos para reavaliar** (medidos, não supostos):
- **Entra Redis** se as operações de estado passarem de ~50 ms no percentil 95, ou se a rotatividade dessas tabelas encarecer o compute do Neon.
- **Entra fila dedicada (QStash)** se precisarmos agendar mensagem por mensagem com retentativa e fila de mortos, ou quando a varredura por minuto ficar pesada.
- **Entra VPS** se as sessões longas do construtor e o streaming esbarrarem nos limites de função, ou se o custo do gerenciado crescer desproporcional ao número de contas. Nesse caso o formato preferido é híbrido: runtime na VPS, banco no Neon.

Como estado e fila entram por porta no código, trocar depois é contido.

---

## 12. O primeiro recorte de ponta a ponta

Uma fatia fina que prova o conceito inteiro, antes de alargar:

1. Um usuário cria uma conta na plataforma (é o dono dela) e, em Conta → Conexões, cadastra o token do GHL, a instância de WhatsApp e o token de IA.
2. Instala do catálogo o módulo **SDR** e o módulo **Follow-up** (o Base GHL vem junto).
3. No **Studio**, o construtor interno configura os dois seguindo a orientação dos módulos, e a publicação passa pelo teste.
4. Os webhooks do CRM e do WhatsApp apontam para a plataforma; o agente de operação atende um número de teste no runtime da Metrik.
5. Um **painel** pré-montado mostra as execuções em tempo real, e os **Logs** mostram cada execução com autor e origem.
6. Um usuário convidado sem modo desenvolvedor (o dono do negócio), no Studio em modo normal, pede "fala mais curto" e "não oferece desconto" — os dois pedidos passam por teste e publicação.
7. O mesmo usuário conecta o Claude Code dele pelo MCP e repete um ajuste pelo terminal; o histórico mostra as duas origens.

Se essa fatia funcionar com um cliente real, o resto é alargar o catálogo.
