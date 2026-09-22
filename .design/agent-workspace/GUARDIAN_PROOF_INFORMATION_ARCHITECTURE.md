# Guardião V12 — Arquitetura da informação

## Modelo mental

- **Guardião**: sistema que tenta quebrar o comportamento antes da publicação.
- **Rodada**: conjunto de situações testadas contra uma versão específica.
- **Ataque**: uma situação individual da rodada.
- **Critério**: condição objetiva que precisa passar.
- **Prova**: entrada, saída, critérios e ações reais de um ataque.
- **Mudança**: pedido do cliente ligado à prova e ao estado de publicação.

## Fluxo principal

1. Cliente pede uma correção em Melhorar.
2. Motor compila uma prévia e registra o pedido.
3. Cliente escolhe “Mudança nova” em Testar.
4. Guardião roda a suíte contra essa prévia — nunca silenciosamente contra outra versão.
5. O chat recebe a rodada e abre o primeiro ataque.
6. Cliente navega pelas provas e corrige uma falha ou abre Mudanças.
7. Mudanças mostra pedido, comparação antes/agora, prova do Guardião e estado.
8. Cliente publica ou mantém a mudança fora do ar.

## Prioridade de conteúdo — Testar

1. Versão realmente testada.
2. Veredito da rodada.
3. Lista curta de ataques.
4. Entrada e resposta do ataque selecionado.
5. Critérios conferidos e ações executadas.
6. Base, suíte e duração como metadados secundários.

## Prioridade de conteúdo — Mudanças

1. Pedido e estado: preparando, provada, no ar ou segurada.
2. Consequência concreta: antes versus agora.
3. Confiança: taxa e casos do Guardião.
4. Proveniência: suíte, base e horário.
5. Ação seguinte: testar, corrigir ou publicar.

## Estrutura de tela

### Testar

- Canvas principal: conversa + evento “Prova do Guardião”.
- Console lateral: seleção de versão, cenários, resumo da sessão e gatilho da rodada.
- O evento da conversa contém um rail de ataques e um painel de evidência selecionável.

### Mudanças

- Cabeçalho: resumo operacional.
- Rail esquerdo: mudanças ordenadas por recência e status.
- Workspace direito:
  - pedido;
  - comparação antes/agora;
  - prova do Guardião;
  - metadados e ações.

## Rotulagem

Evitar “eval”, “assertion” e “patch” na interface. Usar “rodada”, “ataque”, “critério”, “ação executada”, “antes”, “agora” e “prova”.

