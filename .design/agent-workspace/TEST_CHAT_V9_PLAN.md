# Testar v9 — chat nativo, sem mockup de aparelho

## Correção de leitura

A referência de WhatsApp define a linguagem da conversa — bolhas, avatar, fonte, feedback e composer — não a moldura física. O laboratório deve parecer parte do Motor OS e usar toda a largura disponível.

## Tokens

- Carbono: `#0a0b0d` — fundo do laboratório.
- Painel: `#101419` — superfície do chat.
- Linha: `#293038` — separação estrutural.
- Metrik Blue: `#2563eb` — seleção e ação.
- WhatsApp Green: `#00a884` / `#005c4b` — somente conversa e envio.
- Utility Mono: JetBrains Mono — estado, versão e prova.

## Layout

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Converse como um lead                              sessão de teste   │
├────────────────┬──────────────────────────────┬──────────────────────┤
│ versão         │ Bia · versão no ar           │ guardião automático  │
│ cenários       ├──────────────────────────────┤                      │
│ placar         │ conversa ampla               │ resultados por trava │
│                │                              │                      │
│                ├──────────────────────────────┤                      │
│                │ mensagem…              enviar│                      │
└────────────────┴──────────────────────────────┴──────────────────────┘
```

Em telas intermediárias, o chat ocupa a coluna principal e os controles empilham à direita. No mobile, chat, cenários e guardião viram uma sequência vertical.

## Assinatura

O chat é uma janela operacional do agente: cabeçalho Metrik + linguagem WhatsApp no conteúdo. Sem notch, alto-falante, status bar, home bar, botões laterais ou proporção de celular.

## Autocrítica

O mockup anterior era visualmente reconhecível, mas transformava uma ferramenta de trabalho em demonstração de landing page e desperdiçava espaço. Nesta versão, a referência deixa de comandar o contêiner e passa a comandar apenas a interação.
