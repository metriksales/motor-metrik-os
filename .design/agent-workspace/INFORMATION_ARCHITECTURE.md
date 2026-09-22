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
3. Caminho do Agente, porque explica a composição e orienta a navegação.
4. Documento da peça selecionada, começando pelo que ela faz.
5. Configuração profunda e histórico, por divulgação progressiva.

### Como funciona

1. Função da peça selecionada.
2. Papel da peça no caminho completo.
3. Como fala e o que oferece.
4. Regras e fatos do cliente.
5. Evidência da última mudança publicada.

## Fluxos críticos

### Entender o agente

1. Abre o Estúdio.
2. Lê função e estado no cabeçalho.
3. Vê o Caminho do Agente.
4. Seleciona uma peça.
5. Lê função, contexto e regras sem sair da tela.

### Corrigir comportamento

1. Escreve ou fala em Melhorar.
2. O sistema esclarece o destino quando necessário.
3. Mostra o antes/depois.
4. Usuário abre Testar.
5. Passando no guardião, publica em Mudanças.

### Investigar problema

1. Abre Ao vivo.
2. Seleciona uma execução com erro.
3. Lê causa e evidência.
4. Envia o caso para Melhorar já contextualizado.

## Vocabulário

| Conceito interno | Rótulo na interface | Regra |
|---|---|---|
| Artifact | Como funciona | “Artefato vivo” pode aparecer só como explicação secundária. |
| Brain | Caminho do Agente | Mostra peças reais e sua ordem. |
| Executions | Ao vivo | O cliente reconhece atividade, não log. |
| History / ledger | Mudanças | Revisões, publicações e decisões. |
| Chat de edições | Melhorar | Verbo e resultado, não mecanismo. |
| Upgrade | Peça disponível | Só aparece se compatível com o agente. |

## Crescimento

- Até quatro peças: trilho horizontal completo.
- Cinco ou mais: trilho com rolagem horizontal, início e fim preservados.
- Regras: agrupamento e busca quando ultrapassarem dez itens.
- Execuções: filtros e paginação/virtualização acima de cinquenta linhas.
- Mudanças: agrupamento por data e estado; pendências sempre antes do histórico.
