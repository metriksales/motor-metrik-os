# Guardião V12 — Prova viva da mudança

## Enquadramento

O problema não é “falta de informação”. O produto já calcula nota, casos, ensaio antes/depois e versão. O problema é que esses elementos aparecem separados e sem causalidade. O cliente vê que algo rodou, mas não consegue responder com segurança:

- qual versão foi testada;
- que situação tentou quebrá-la;
- o que o agente respondeu de verdade;
- qual regra, ação ou critério decidiu o resultado;
- como a correção altera o atendimento;
- se isso já está no ar.

Job-to-be-done: “Quando eu peço uma mudança no agente, quero ver uma prova compreensível de que ela funciona antes de publicar, para mudar o atendimento sem medo.”

## Alternativas exploradas

1. **Placar maior** — melhora leitura, mas continua sendo uma caixa-preta.
2. **Terminal ao vivo** — parece técnico, porém transfere complexidade ao cliente.
3. **Evento no chat** — conecta teste e conversa, mas sozinho esconde o antes/depois.
4. **Teatro de testes** — visual forte, porém vira uma segunda interface pesada.
5. **Relatório forense** — muita prova, baixa velocidade para decisões diárias.
6. **Espelho antes/agora** — prova a mudança, mas não mostra as travas permanentes.
7. **Gravador de voo** — uma rodada guarda entrada, saída, critérios, ações, versão e veredito.

## Direção escolhida

Combinar **gravador de voo + espelho antes/agora** em uma linguagem de produto chamada **Prova viva**.

No Testar, cada rodada aparece dentro da conversa como uma cadeia compacta:

`Ataque → Resposta → Critérios → Ações → Veredito`

O caso selecionado abre a evidência real. Em Mudanças, a mesma prova é persistida como uma história completa:

`Pedido → Antes/Agora → Guardião → Estado de publicação`

## Tese e risco

A tese é que confiança nasce de evidência legível, não de uma porcentagem. O maior risco é trocar obscuridade por excesso de dados. A mitigação é master-detail: resumo sempre visível, um caso aberto por vez e detalhes técnicos nomeados em linguagem natural.

Não inventar fontes. “O que foi consultado” significa apenas dados reais disponíveis: base testada, suíte, regra solicitada, critérios da suíte e ações disparadas.

