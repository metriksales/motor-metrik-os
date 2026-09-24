# V4 — Estúdio em modo foco

## Diagnóstico

A tela está correta estruturalmente, mas ainda exige que o olho processe tudo ao mesmo tempo: navegação global aberta, cabeçalho, quatro abas grandes, chat, documento, rail, muitos rótulos técnicos, bordas e cards dentro de cards. O problema principal é competição visual, não falta de organização.

## Regra da nova composição

Em cada território, apenas uma coisa pode chamar atenção:

- **Melhorar:** o pedido do usuário.
- **Como funciona:** o papel da peça selecionada.
- **Caminho:** a ordem dos módulos.

Tudo que for metadado perde caixa, cor e tamanho. Verde fica reservado para “no ar”; âmbar, para seleção e ação.

## Mudanças estruturais

1. O Estúdio abre em **modo foco**, recolhendo a navegação global para um rail de ícones.
2. O cabeçalho do agente vira uma linha de 56px: voltar, identidade, estado, volume do dia e liga/desliga.
3. Como funciona, Testar, Ao vivo e Mudanças viram uma barra compacta de 50px, sem frases e sem caixas individuais.
4. Melhorar começa pela pergunta “O que deve mudar?” e mostra somente dois exemplos discretos.
5. O documento deixa de ser um card: título, propósito, contexto e regras passam a formar uma página contínua.
6. O Caminho vira uma **espinha vertical âmbar** com módulos compactos, sem card grande para cada metadado.
7. O divisor permanece, agora mais fino. Faixa: 296–440px; padrão: 320px.

## Layout

```text
┌── rail 68 ──┬──────────── agente · estado · hoje ────────────────┐
│             ├── Melhorar  ╫  Como funciona · Testar · Ao vivo ──┤
│ ícones      │              ║                                     │
│ globais     │ O que deve   ║  Conversa          Caminho          │
│             │ mudar?       ║  propósito          ● Conversa      │
│             │              ║  contexto           │               │
│             │              ║  regras             ○ Próxima peça │
│             │ [composer]   ║                                     │
└─────────────┴──────────────╨─────────────────────────────────────┘
```

## Tokens

- Casa `#080a0d`
- Conversa `#0c0b09`
- Página `#101318`
- Rail `#090b0e`
- Texto `#f2f4f7`
- Âmbar `#e8b04b`
- Verde `#47c464`

## Assinatura

A única expressão gráfica forte será a **espinha do agente**: uma linha vertical contínua que liga os módulos reais. Todo o restante fica quieto para ela explicar ordem e estado sem parecer mais uma coleção de cards.
