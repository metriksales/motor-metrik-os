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

---
**Frase de parede:** *Uma skill (a fábrica). Você adiciona MOTORES. Agente é combinação de motores pra um público. Só produto adjacente vira skill nova.*
