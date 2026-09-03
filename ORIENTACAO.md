# ORIENTAÇÃO — como levar coisa nova (pra skill E pro Motor OS)

> Feito pra matar a confusão "minha skill tem que ser toda separada em partes? ou jogo tudo dentro dela? o que é agente, feature, módulo?". Vale pros dois: a skill `agente-ia-metrik-completo` e o Motor OS.

## Regra nº 1 — UMA skill (a fábrica). Você ADICIONA, não separa.
A skill é **uma** = a **fábrica de MOTORES**. Toda ideia nova entra **DENTRO dela, na gaveta certa** (a própria skill tem a tabela "onde escrever", §7.1). **Você NÃO quebra em várias skills.** Ela cresce organizada, não fatiada.

**Vira skill PRÓPRIA só quando é PRODUTO ADJACENTE**, com público e execução próprios (ex: o widget público do Kommo; a migração Kommo→GHL). Isso é **raro**. 99% das ideias ficam dentro da skill.

## Pense em LEGO — 3 níveis (é isso que destrava tudo)
- **MOTOR (função/órgão):** um *jeito de fazer algo*, reutilizável. Ex: **cadência de follow-up**, atendimento, agenda, rastreio, voz, mãos-no-CRM. Escreve **uma vez** na skill.
- **AGENTE:** um *trabalhador* = uma **combinação de motores** apontada pra um **público + canal + config**. Ex: **SDR** = atendimento + qualificação + agenda + follow-up, apontado pra **LEADS no WhatsApp**.
- **MÓDULO / FEATURE / INTEGRAÇÃO / REGRA:** os ajustes por cima — módulo turbina um motor num agente; feature liga/desliga; integração é sistema externo (AdvBox/ZapSign); regra é um limite.

> **A sacada:** o MESMO motor serve vários agentes. Follow-up é UM motor; o SDR usa pra caçar leads; um "Cobrador de equipe" usa o MESMO motor pra caçar humanos. **Você não recria o motor — você compõe um agente novo.**

## A régua pra QUALQUER ideia nova (decide em 5 segundos)
1. É um **jeito novo** de fazer algo que ainda não existe? → **MOTOR** (escreve na skill, 1×).
2. É **combinar motores que já existem** pra um público/propósito novo? → **AGENTE** (compõe, não recria).
3. É **turbinar um motor** num agente? → **MÓDULO**.
4. É **liga/desliga** de uma habilidade? → **FEATURE**.
5. É **sistema externo** que um motor usa? → **INTEGRAÇÃO**.
6. É **limite/política**? → **REGRA/TRAVA**.

## Exemplos resolvidos
| Ideia | O que é | Como entra |
|---|---|---|
| **"Follow-up pros HUMANOS"** (cobrar quem não responde: time, aluno, parceiro — não lead) | **AGENTE novo** que **reusa o motor de follow-up** | NÃO faz skill nova, NÃO faz motor novo. Cria um agente (ex: "Cobrador/Lembrete") com o motor de cadência apontado pra **humanos + canal interno**. Config: quem, canal, cadência, texto. No OS aparece como um agente na frota. |
| **"Gerar petição"** | **MOTOR novo** + vira **AGENTE de Ação** (Petições) | Escreve o motor "gerar peça" na skill → compõe o agente Petições. |
| **"Tag em lead nervoso"** | **MÓDULO** | Turbina o motor de atendimento do Atendente. |
| **"Integrar AdvBox"** | **INTEGRAÇÃO** | Chip usado pelo agente de Ação. |
| **"Não passa do Agendado"** | **REGRA/TRAVA** | Fica no núcleo blindado. |

## Os 3 TIPOS de agente (público/propósito)
- **Resposta** — fala com o **lead** (o SDR/organismo).
- **Ação** — **executa no CRM** (Petições, Contratos), por etapa/botão/massa.
- **Insight/Interno** — produz **pra HUMANO** (briefing, análise, auditoria, **o "follow-up pros humanos"**). Não fala com lead.

## Como isso "sobe" no Motor OS (a ponte)
Você **não sobe no OS separado**. Escreve na skill com um **manifesto** (o que faz, gatilho, ação, config, evals) → o **OS renderiza sozinho**: motor → recurso do agente; módulo → loja + liga num agente; agente → aparece na frota; integração → chip; regra → trava. É o contrato do `ARQUITETURA.md`.

## Pros alunos (aulas)
Ensina os **MOTORES + o porquê** (o método), não o dump da skill. Uma aula = **um motor/conceito reusável** na linguagem do aluno. As derivadas (curso/webinar) são **recortes** da mesma fábrica.

## E se um cliente precisar do motor DIFERENTE do outro?
**O motor é o MESMO. O que muda é a CONFIG.** Motor não é bloco rígido — é motor com **botões** (parâmetros). Cada cliente é uma **combinação de botões**, não um motor próprio.

Exemplo — o **mesmo** motor de follow-up, dois clientes:
| Botão | Cliente A | Cliente B |
|---|---|---|
| Público | vendedores (humanos) | leads |
| Fonte da conversa | conversa dos vendedores | conversa da IA |
| Janela | seg–sex, horário comercial | 24h |
| Canal | interno | WhatsApp do lead |
| Cadência / texto | do A | do B |

**1 motor (código compartilhado) + N configs (uma por cliente).** Zero código novo. É o que a skill diz: *só 3 coisas mudam por cliente — prompt, IDs, env*; o resto é botão. No nosso código = 1 motor em `packages/` + 1 **AgentSpec** por org (a config), isolado por `org_id`.

**Quando toca no código?** SÓ quando aparece um **botão que não existe ainda** (ex: "cobrar por LIGAÇÃO de voz" e o motor só manda texto). Aí **adiciona o botão AO motor único** (1×) → fica disponível **pra todos** como mais uma opção.

⛔ **NUNCA um motor por cliente** — isso é o inferno do n8n-por-cliente (bug = consertar em 40 lugares). Motor único = **conserta 1×, todos recebem**. Escape raríssimo (lógica 100% exclusiva): `custom/` do cliente, em **sandbox + trava de eval**, nunca um fork do motor.

## Modo de operação — o SaaS invertido (QUEM faz o quê)
**Compor NUNCA é do cliente.** A superfície de montagem é o **cockpit da Metrik**, não a tela do cliente.

- **🛠️ Modo Metrik (você + Claude, ao vivo na call):** você **fala** (não clica botão a botão) → o **Claude pluga via MCP (a tomada)** → o OS **desenha ao vivo**. O cliente vê o agente dele **nascer** na call. Minutos.
- **👤 Modo Cliente (depois, sozinho):** recebe a solução **pronta e funcionando**. Não constrói. Só **ajusta o seguro** (texto, horário, liga/desliga do que já foi entregue, ver ao vivo). Zonas: 🟢 na hora · 🟡 simula→testa→aprova · 🔴 nem aparece (só mecânico).
- **Não engessado:** por baixo é contrato+peças plugáveis → cliente pede algo novo, você pluga a peça **em minutos, ao vivo**, sem reescrever nem forkar.
- **Visual:** cada peça **se declara (manifesto)** e o OS **desenha sozinho** → ligar uma peça = ela **aparece como feature funcionando**. É como você e o cliente enxergam na call.

---
**Frase de parede:** *A Metrik + Claude configuram ao vivo (cockpit, voz/texto, MCP na tomada). O cliente recebe pronto e só ajusta o verde. Os motores já funcionam. Ninguém constrói apertando botão — você fala, a tela desenha.*
