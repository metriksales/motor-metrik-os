# Testar v11 — remover repetição e explicitar ações

## Diagnóstico

O cabeçalho “Laboratório isolado / Converse como um lead” repete o que a aba e o cabeçalho da conversa já dizem, criando uma faixa sem relação com a superfície abaixo. No composer do Testar, trocar o envio por microfone quando vazio esconde a ação principal. No Melhorar, `+` e `Contexto` abrem o mesmo seletor.

## Decisão

```text
abas
┌ conversa começa imediatamente ───────────┬ console ┐
│ Bia · versão · ambiente isolado          │ ...     │
│                                          │         │
│ [Mensagem…]                  [Enviar →]  │         │
└──────────────────────────────────────────┴─────────┘

Melhorar: [+ documento] [Voz] [Ensaio seguro] [enviar]
```

- Remover integralmente a faixa redundante.
- Manter `Enviar` visível e nomeado em todos os estados; vazio apenas desabilita.
- Manter somente `+` para documentos no Melhorar; linguagem de “contexto” sai do controle e do dropzone.

## Autocrítica

Não substituir a faixa por outra barra. A correção é retirar uma camada, não redesenhá-la.
