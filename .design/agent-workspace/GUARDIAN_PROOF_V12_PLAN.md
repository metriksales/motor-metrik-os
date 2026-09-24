# Guardião V12 — Plano visual e técnico

## Assinatura visual

Um **trilho de evidência** de cinco estados dentro do evento do Guardião. Linhas finas, contraste controlado, azul Metrik apenas para foco e verde/vermelho apenas para veredito. Sem glow decorativo; a sensação tech vem de estrutura, precisão, tipografia mono nos metadados e microanimação de varredura enquanto roda.

## Layout

- Rodada compacta no chat, expandida ao concluir.
- Ataques como tabs verticais ou chips em desktop; scroll horizontal no mobile.
- Evidência em duas colunas: mensagem do lead e resposta do agente.
- Critérios abaixo como checks explicativos.
- Mudanças em master-detail, com seleção persistente no estado local.

## Dados necessários

- Estender o resultado de cada caso com entrada, saída, critérios e ações.
- Fazer `rodarTestes` aceitar `ar | ensaio` e aplicar a mudança pendente no ensaio.
- Retornar id/intenção da mudança aplicada, base, suíte, modo e duração.
- Reusar `impact.ensaio.situacoes` para a comparação antes/agora em Mudanças.

## Critérios de pronto

- A versão indicada na UI é a versão que o backend realmente testa.
- Cada caso concluído mostra uma entrada e a resposta real.
- Cada critério mostra passou/falhou e o esperado.
- Tool calls aparecem como ações executadas; ausência não é inventada.
- Mudanças deixa de ser timeline simples e permite inspecionar a prova.
- Funciona em 1440px e 375px sem scroll horizontal da página.
- Build, checagem visual e deploy de produção concluídos.

