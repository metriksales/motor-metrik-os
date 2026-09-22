# Information Architecture: Estúdio do Agente

## Visão estrutural

- Metrik OS
  - Frota de agentes
    - Estúdio de um agente
      - Melhorar: pedir, esclarecer, ensaiar e publicar
      - Como funciona: verdade viva e peças do agente
      - Testar: conversar como lead e rodar guardião
      - Ao vivo: execuções e erros
      - Mudanças: revisão, publicação e histórico

O Estúdio é a tela em que o cliente passa 80% do tempo. Não deve empurrá-lo para subníveis para entender o agente.

## Navegação

- **Primária do produto:** Início, Agentes, Ao vivo, Módulos, Conexões, Admin.
- **Contextual do agente:** Como funciona, Testar, Ao vivo, Mudanças.
- **Ação persistente:** Melhorar, sempre disponível ao lado do conteúdo no desktop e como destino próprio no mobile.
- **Utilidade:** voltar à frota, pausar/ligar, abrir Ao vivo global.
- **Mobile:** Melhorar + quatro destinos, máximo de cinco opções, uma superfície por vez.

## Hierarquia de conteúdo

### Estúdio

1. Identidade, função e estado do agente.
2. Trabalho de hoje e personalizações no ar, como resumo compacto.
3. Documento da peça selecionada, começando pelo que ela faz.
4. Recursos do agente como índice lateral compacto das capacidades instaladas.
5. Configuração profunda e histórico, por divulgação progressiva.

### Como funciona

1. Função da peça selecionada.
2. Como fala e o que oferece.
3. Regras e fatos do cliente.
4. Lista lateral de recursos, para trocar de peça sem sair do documento.
5. Evidência da última mudança publicada, por divulgação progressiva.

## Fluxos críticos

### Entender o agente

1. Abre o Estúdio.
2. Lê função e estado no cabeçalho.
3. Lê função, contexto e regras da peça atual.
4. Usa Recursos quando precisa abrir Prompt, Follow-up, Base de conhecimento, Campos do lead ou outra capacidade instalada.

### Corrigir comportamento

1. Escreve ou fala em Melhorar.
2. O sistema classifica internamente o pedido como Conversa, Automação, Ferramenta ou Documento e confirma o resultado em linguagem humana.
3. O cliente nunca escolhe Lista, Motor, Biblioteca ou outro destino técnico; ele confirma o efeito ou ajusta o pedido.
4. A prova acompanha a natureza da mudança:
   - Conversa: cenário e resposta antes/depois.
   - Automação: gatilho, espera, ação e canal, com a conversa preservada.
   - Ferramenta: direcionamento para Conexões, autenticação e readback; nunca entra como regra do agente.
   - Documento: recebimento e revisão antes de entrar na base.
5. Passando na prova correspondente, a configuração pode ser publicada e aparece em Mudanças.

### Confirmar um pedido em Melhorar

1. Repetir o resultado entendido, não o mecanismo de armazenamento.
2. Explicar em uma frase o que muda na atuação do agente.
3. Para follow-up, agenda ou outro módulo reconhecível, nomear a capacidade em linguagem do cliente e mostrar sua configuração operacional.
4. Se houver documento, explicar honestamente que a Metrik vai prepará-lo antes de entrar nas respostas.
5. A ação principal descreve o próximo passo: “Testar essa mudança” ou “Enviar documento”.
6. “Ajustar pedido” devolve o texto original ao campo para edição.

### Investigar problema

1. Abre Ao vivo.
2. Seleciona uma execução com erro.
3. Lê causa e evidência.
4. Envia o caso para Melhorar já contextualizado.

## Vocabulário

| Conceito interno | Rótulo na interface | Regra |
|---|---|---|
| Artifact | Como funciona | “Artefato vivo” pode aparecer só como explicação secundária. |
| Brain | Recursos | Mostra somente as capacidades que fazem parte do agente; fechado exibe ícone e nome, hover/foco abre uma frase e o clique troca o documento principal. Não representa ordem. |
| Executions | Ao vivo | O cliente reconhece atividade, não log. |
| History / ledger | Mudanças | Revisões, publicações e decisões. |
| Chat de edições | Melhorar | Verbo e resultado, não mecanismo. |
| Upgrade | Peça disponível | Só aparece se compatível com o agente. |
| Conversa / Automação / Ferramenta / Documento | Não aparece como escolha | Classificação interna; a confirmação e a prova mostram apenas o resultado para o cliente. |
| Configuração de automação | Quando / Espera / Então / Por | Nunca representar cadência como resposta de chat ou regra de prompt. |

## Crescimento

- Até quatro peças: espinha vertical completa no rail lateral.
- Cinco ou mais: rail com rolagem vertical independente; peça selecionada preservada.
- Regras: agrupamento e busca quando ultrapassarem dez itens.
- Execuções: filtros e paginação/virtualização acima de cinquenta linhas.
- Mudanças: agrupamento por data e estado; pendências sempre antes do histórico.
