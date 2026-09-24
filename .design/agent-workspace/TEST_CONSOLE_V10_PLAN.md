# Testar v10 — conversa como superfície, controles como console

## Tese

O Testar tem um único trabalho principal: conversar e observar. A conversa não deve parecer um card dentro da página; ela é a página. Versão, cenários, placar e Guardião são instrumentos auxiliares e moram juntos numa coluna de controle à direita.

## Paleta e tipografia

- Canvas do chat `#0b141a`; console `#0d0f12`; divisória `#252a30`.
- Azul Metrik `#2563eb` somente em seleção/ação.
- Verde de conversa `#00a884` / `#005c4b` somente no ambiente WhatsApp.
- Inter para leitura; JetBrains Mono para estado, tempo e prova.

## Composição

```text
┌───────────────────────────────────────────────┬────────────────────────┐
│ Bia · versão no ar · ambiente isolado        │ VERSÃO TESTADA         │
├───────────────────────────────────────────────┤ CENÁRIOS               │
│                                               │ SESSÃO ATUAL           │
│ conversa = a própria tela do Testar           │ GUARDIÃO AUTOMÁTICO    │
│                                               │ [ Rodar os testes ]    │
│  ┌ rodada do Guardião aparece aqui ┐          │                        │
│  │ progresso / 4 travas / corrigir │          │                        │
│  └─────────────────────────────────┘          │                        │
├───────────────────────────────────────────────┤                        │
│ Mensagem…                              enviar │                        │
└───────────────────────────────────────────────┴────────────────────────┘
```

## Assinatura

A rodada automática nasce como um evento de sistema dentro da conversa. Isso conecta teste manual e teste automático na mesma evidência, em vez de separar resultado e contexto em cards laterais.

## Autocrítica

Uma rail direita cheia pode virar um formulário longo. Para evitar isso, cada seção perde borda externa própria: são grupos compactos separados por linhas, dentro de um único console. O destaque fica somente no resultado que aparece no chat.
