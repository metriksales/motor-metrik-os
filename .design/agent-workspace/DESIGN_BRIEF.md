# Design Brief: Estúdio do Agente

## Produto e público

O Metrik OS entrega agentes já operando no CRM. A tela atende primeiro o dono ou operador do cliente, que não quer configurar tecnologia: ele quer entender o que o agente faz, corrigir o que não gostou e conferir a prova. A Metrik é o público secundário, com acesso à mesma verdade para operar e evoluir o agente.

## Trabalho principal da tela

Em menos de 30 segundos, o usuário deve conseguir responder:

1. O que este agente faz hoje?
2. Quais peças trabalham e em que ordem?
3. O que foi personalizado por mim?
4. Como eu peço uma mudança?
5. Onde eu provo antes de publicar e onde vejo o que aconteceu?

## Problema atual

- Chat, artefato, abas e Cérebro usam a mesma fisionomia: fundo escuro, hairline, card e âmbar.
- A coluna do Cérebro precisa explicar a ordem das peças sem repetir o documento nem virar uma sidebar genérica.
- Cabeçalho + AGORA + cabeçalho de Edições + abas criam barras demais antes do conteúdo.
- A função do agente, sua forma de falar, oferta e regras recebem quase o mesmo peso visual.
- “Artefato”, “Execuções” e “Histórico” são nomes de sistema; o cliente pensa em “como funciona”, “ao vivo” e “mudanças”.

## Leis preservadas

- Experiência de pedir em linguagem natural e ver o artefato mudar, inspirada no Claude.
- Tema escuro do Estúdio, âmbar como acento de autoria/ação e verde como prova/no ar.
- Nada de folha branca, blueprint azul, roxo/rosa genérico ou estética de template de IA.
- O artefato mostra somente verdade viva do motor; teste mora em Testar; publicação mora em Mudanças.
- Peças e capacidades vêm do motor. Nunca preencher vazio com feature falsa.

## Direção visual

### Tokens

- `Casa` `#07080b`: edição e composição.
- `Mesa` `#0b0d11`: área de leitura e trabalho.
- `Peça` `#11151b`: superfícies locais e controles.
- `Linha` `#242a33`: separação estrutural.
- `Autoria` `#e8b04b`: mudança do cliente, foco e ação principal.
- `Prova` `#3fb950`: no ar, passou, execução saudável.

### Tipografia

- Inter: leitura operacional, títulos e ações.
- JetBrains Mono: versão, estado, números e evidência.
- Escala fixa: 12 / 14 / 16 / 20 / 28. Corpo nunca abaixo de 14px no conteúdo principal.

### Layout

```text
┌ AGENTE · estado · resumo do dia · ações ───────────────────────────────────┐
├ MELHORAR ──────────────╫ COMO FUNCIONA · TESTAR · AO VIVO · MUDANÇAS ─────┤
│ conversa e pedidos     ║                                                   │
│                        ║  DOCUMENTO DA PEÇA          CAMINHO DO AGENTE     │
│                        ║  função                     [01 Conversa]         │
│                        ║  contexto                         ↓               │
│                        ║  regras                     [02 Próxima peça]     │
│ composer fixo          ║                                                   │
└────────────────────────╨───────────────────────────────────────────────────┘
```

O separador `╫` pode ser arrastado entre 300 e 520px. No celular, os destinos permanecem explícitos, cada um ocupa a tela inteira e o Caminho vem depois do documento.

## Assinatura

O elemento memorável é o **Caminho do Agente**: módulos verticais, quase quadrados, com peças reais em ordem. Ele funciona como explicação, navegação e estado sem disputar o protagonismo do documento. Selecionar uma peça muda o documento ao lado.

## Critérios de sucesso

- A leitura começa no propósito do agente, não em configurações.
- O Cérebro deixa de ser uma coluna concorrente e vira contexto estrutural.
- Cada superfície tem um papel e um nome reconhecível pelo cliente.
- Menos barras, menos caixas equivalentes, mais contraste de hierarquia.
- Sem overflow em 375px, 768px, 1280px e 1440px.
- Todos os controles de navegação têm alvo mínimo de 44px, foco visível e estado ativo textual.
