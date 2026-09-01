# Motor Metrik OS — Arquitetura & Taxonomia (onde cada coisa se encaixa)

> **Lei do projeto.** Toda ideia nova (skill, ação, integração) tem que se encaixar em UM dos tipos abaixo, seguindo a regra de decisão. Isso é o que faz o sistema **crescer sem quebrar** e **aparecer visualmente sozinho**, sem desenhar tela nova pra cada coisa. Se algo não se encaixa, **para e pergunta** — não força.

> **⚠️ Motor = a skill `agente-ia-metrik-completo`.** Este projeto é a **cara/painel NOVO** (visual fresh, look 21st.dev), mas o **motor por baixo segue a skill interna `agente-ia-metrik-completo`**: serverless LLM + GHL/Kommo, tools, Central (CENTRAL.md), ESCOLA, governança (guardião diário / analista / auditora de funil / diário de execuções com custo), eval-porteiro. **Nenhum agente/tool/feature entra aqui sem existir na skill** (biblioteca `common/` + `ghl/` + `kommo/`). O front só lê/escreve o AgentSpec que a skill roda. Fresh na cara, mesma estrutura no motor.
> **Conexão (correção 30/08, ver memória [[reference_ghl_app_vs_pit]] / [[reference_advbox_api]]):** o **token (PIT/OAuth) faz 100% do dado**; o **app do marketplace é opcional** (só Workflow Actions/Providers/SSO/loja). **AdvBox = API pura, sem app e sem webhook → polling.**

## O princípio único: MANIFESTO → a tela se desenha sozinha
Nada tem tela própria. Cada unidade **se declara** (o que faz, quando age, o que muda, como se prova, o que dá pra mexer com segurança) e o Motor **renderiza** no esqueleto fixo. Por isso qualquer ideia entra bonita, clara e no padrão.

**Esqueleto fixo de todo agente (nunca muda):**
`O que faz` (passo a passo + execuções + erros + o que melhorar) · `Trabalho` (a superfície concreta) · `Turbinar` (núcleo blindado + recursos + ligar módulos) · `Melhorar` (pedir por texto/áudio → simular → testar → aprovar + histórico único).

---

## Os 5 tipos (a taxonomia)

### 1. AGENTE
Trabalhador autônomo, com **identidade própria, gatilho próprio e superfície própria**. Roda sozinho. Dois arquétipos:
- **Resposta** — conversa no WhatsApp (Atendente, Qualificador, Agendador, Recuperador).
- **Ação** — executa no CRM, disparado por **etapa do funil / botão no card / seleção em massa / agenda** (Contratos, Petições, Auditor, Rastreador).

### 2. MÓDULO (Upgrade)
**Kit de evolução assinado** que se **pluga num agente existente** pra adicionar/ajustar comportamento. Tem `gatilho → ação`, `config` (knobs), `resultado` (o que acontece), `criterio` (como decide), `onde` (onde cai) e `sinergia`. **É sempre POR AGENTE, nunca global.** Não roda sozinho — precisa do agente hospedeiro.

### 3. FEATURE (Recurso)
Habilidade **liga/desliga** dentro de um agente, sem gatilho→ação próprio (ex: "ouve áudio e lê PDF", "base de conhecimento", "tom mais próximo"). Mais simples que módulo.

### 4. INTEGRAÇÃO
Conexão com **sistema externo** que um agente/módulo **usa** (AdvBox, ZapSign, Meta CAPI, Google Agenda, PDF, uazapi). Não é unidade de tela — aparece como chip `integra com X`. A tomada, não o motor.

### 5. REGRA / TRAVA
Política/limite de comportamento (ex: "não dá desconto sem aprovar", horário comercial, limite de toques). Vive perto do **núcleo blindado**, aparece no **histórico**. Não tem gatilho de ação — é uma condição que segura.

---

## Regra de decisão (classifique QUALQUER ideia nova)
1. Roda sozinho, com gatilho + superfície próprios? → **AGENTE** (Resposta se conversa · Ação se executa no CRM).
2. Precisa de um agente pra existir, mas traz um `gatilho → ação` novo? → **MÓDULO** daquele agente.
3. É só liga/desliga de uma habilidade, sem gatilho próprio? → **FEATURE/RECURSO**.
4. É um sistema externo que algo usa? → **INTEGRAÇÃO** (chip num agente/módulo).
5. É uma política/limite? → **REGRA/TRAVA** (fica no cérebro/histórico).

### Exemplos já mapeados (as ideias do mestre)
| Ideia | Tipo | Onde encaixa |
|---|---|---|
| ZapSign | Integração | usada pelo agente **Contratos** (Ação) |
| AdvBox (protocolar) | Integração | usada por **Petições** (Ação) |
| Ler/gerar PDF | Feature (ler) ou parte de Agente de Ação (gerar) | recurso do Atendente / motor de doc |
| Tag em lead nervoso | Módulo | `gatilho: tom/palavra → ação: põe tag + avisa`, no **Atendente** |
| Notificação WhatsApp | Feature/knob ou Módulo (Alerta) | recurso/módulo do agente relevante |
| Recuperar no-show | Módulo | no **Agendador/Recuperador** |
| Auditoria de funil | Agente de Ação | roda sozinho toda segunda |

---

## Regras de segurança (o que impede de quebrar)
- **Núcleo blindado nunca é editável direto.** O cliente muda por cima; a inteligência interna fica de pé.
- **Nada liga no escuro:** todo módulo declara `resultado + criterio + config + onde cai` antes de ativar. Botão nunca sozinho.
- **Módulos são por agente**, jamais globais.
- **Zonas de risco decidem o gate:**
  - 🟢 verde (texto, cadência, estilo, liga/desliga) → tempo real, com prévia.
  - 🟡 amarelo (trocar API, regra, campo, comportamento) → `simular → testar → aprovar`.
  - 🔴 vermelho (núcleo, código, ação destrutiva) → nem vira botão; vai pro mecânico (Claude Code/Codex) em **sandbox**.
- **Fonte única / ledger:** toda mudança (chat, botão, Claude Code, Codex, Metrik) vira um registro no **histórico único**, com origem e estado. **Nada duplica, nada se perde.** Se pedir algo que já existe, avisa e ignora (não duplica).
- **MCP = porta avançada opcional**, a mesma esteira/API. Correção por texto/voz do cliente **não precisa de MCP**.

## Ciclo de vida de uma ideia (do pedido ao ar)
`pedido (texto/áudio) → classifica (agente/módulo/feature/integração/regra) → nasce como RASCUNHO/sandbox → simula → testa real → aprova → publica (aparece como recurso/agente com origem) → histórico`.
Skill/código custom só sai do sandbox pra produção depois de **eval-porteiro** passar. `Rascunho ≠ produção; eval pedido ≠ aprovado; deploy ≠ E2E.`

## Front vs. Motor real (honestidade)
Hoje isto é **frontend + mock** — ele **prova e modela** a régua acima. O "sem quebrar em produção" só existe quando o **backend** for construído respeitando este mesmo contrato: manifesto assinado, eval-porteiro real, sandbox pra custom, e o adapter Kommo/GHL. A régua já está desenhada; o backend tem que segui-la.

## Onde isto vive no código
- Tipos: `src/data.ts` (`Agent`, `Upgrade`, `Feature`, `Work`, `Passo`, `integracoes`, `tipo: resposta|acao`).
- Render por manifesto: `src/views/AgentDetail.tsx` (esqueleto O que faz/Trabalho/Turbinar/Melhorar), `src/views/WorkTab.tsx` (superfícies), `src/Robot.tsx` (avatar por estado). Prova de que qualquer manifesto se desenha sozinho: os 8 agentes diversos (conversa/ação/integração) usam exatamente o MESMO esqueleto.
- Módulos são por-agente com compatibilidade explícita (`COMPAT` em `src/views/Modulos.tsx`) — a loja já marca em qual agente cada módulo encaixa e leva o usuário pra ligar lá dentro. (A "Bancada"/Estúdio de criação foi removida do app do cliente por confundir; criar do zero é papel avançado/futuro, fora da navegação do cliente.)

## Runtime — como o botão controla o CRM (de verdade)
**O botão é interruptor, não fio.** A IA não conecta quando você aperta; a conexão é feita 1× no onboarding e o botão só vira uma flag.
1. **Conexão (1× no onboarding):** cliente instala o **app da Metrik no marketplace do GHL/Kommo** → **OAuth** → guardamos o **token** (access+refresh) no vault, escopado à location. É a única vez que credencial é tocada. WhatsApp conecta junto (canal GHL, uazapi/Evolution QR, ou Meta Cloud).
2. **Onde o agente mora:** serviço **serverless (Vercel+Upstash)**, FORA do CRM. O CRM chama por **webhook**; o agente chama o CRM de volta pela **API** com o token.
3. **Ciclo de ação:** `gatilho (msg/etapa/botão no card/cron) → agente pensa (LLM) → tool escreve no CRM`. Tools: moverEtapa, preencherCampo, agendar, addTag, protocolar(AdvBox), enviarContrato(ZapSign), mandarWhatsApp. Resultado no CRM (fonte de verdade) + no log.
4. **O botão on/off:** NÃO abre/fecha conexão — flipa uma **flag na config (AgentSpec)** guardada no nosso store. O agente já-ligado **lê a flag** na próxima execução e obedece. Por isso é seguro/instantâneo, e por isso "botão nunca sozinho": mostrar o que a flag faz antes.
5. **Adapter (1 motor, 2 CRMs):** interface comum (`moverEtapa/preencherCampo/agendar…`) com 2 implementações (GHL, Kommo). O agente fala 1 língua; o adapter traduz.
6. **Cadência de análise:** erro = triagem determinística **zero-token a cada execução** (log na hora); análise semântica pesada (LLM-juiz) = **1×/dia em rotina** (escalável). Nunca LLM-juiz por execução.
Parte disso já existe no dogfood (agente GHL serverless, uazapi, Redis). O front (este projeto) é a janela/painel que lê e escreve essa config e mostra os logs.
