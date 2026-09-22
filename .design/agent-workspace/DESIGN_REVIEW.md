# Design Review: Estúdio do Agente

Revisado contra: `DESIGN_BRIEF.md`  
Direção: bancada operacional escura, didática e orientada a prova  
Data: 21/09/2026

## Screenshots capturados

| Arquivo | Breakpoint | Estado |
|---|---:|---|
| `screenshots/baseline-agent-desktop-1280.png` | 1280×800 | Como funciona, peça Conversa |
| `screenshots/baseline-agent-tablet-768.png` | 768×1024 | Layout intermediário quebrado |
| `screenshots/baseline-agent-mobile-375.png` | 375×812 | Melhorar |
| `screenshots/redesign-agent-desktop-1440.png` | 1440×900 | Nova hierarquia completa |
| `screenshots/redesign-agent-desktop-1280.png` | 1280×900 | Nova hierarquia no desktop mínimo |
| `screenshots/redesign-agent-tablet-768.png` | 768×900 | Como funciona em superfície única |
| `screenshots/redesign-agent-mobile-375.png` | 375×812 | Caminho com trilho horizontal |

## Resumo

O Estúdio já tem uma tese forte, pedir em linguagem natural e ver a verdade do motor, mas a composição atual distribui peso quase igual para tudo. O documento que deveria ser o protagonista fica espremido entre chat e Cérebro; em tablet ele desaparece. A melhoria precisa trocar a arquitetura de “três colunas equivalentes” por “pedido persistente + mapa estrutural + documento expansivo”.

## Must fix

1. **Tablet fica funcionalmente quebrado.** Em `baseline-agent-tablet-768.png`, o breakpoint `md` ativa sidebar, chat fixo e painel direito ao mesmo tempo; o conteúdo principal sai da viewport. Correção: layout de uma superfície até `xl`, com navegação contextual explícita.
2. **Documento principal é a menor área útil.** Em `baseline-agent-desktop-1280.png`, Cérebro e chat consomem mais largura que a verdade viva. Correção: Cérebro vira trilho horizontal dentro de Como funciona; o documento usa toda a largura restante.
3. **Hierarquia rasa.** Função, pendência, identidade, oferta e regras repetem card + label + linha. Correção: função como abertura editorial, contexto em fatos compactos, regras como checklist operacional e pendência fora do documento.
4. **Pendência quebra e compete com a função.** O card âmbar quebra “mudança sua esperando você publicar” palavra por palavra. Correção: pendência vira indicador compacto na navegação Mudanças, não bloco dominante no documento.

## Should fix

1. **Barras demais antes do trabalho:** cabeçalho, AGORA, Edições e abas ocupam quatro faixas. Unificar identidade + estado + métricas no topo e manter apenas o cabeçalho local de Melhorar e a navegação do conteúdo.
2. **Nomes técnicos:** Artefato, Execuções e Histórico exigem tradução mental. Usar Como funciona, Ao vivo e Mudanças.
3. **Cérebro sem contexto quando há uma peça:** o placeholder ocupa uma coluna inteira. Mostrar peças disponíveis fora do caminho e somente quando existirem de fato.
4. **Chat explica demais:** a abertura compete com a própria função do agente. Reduzir para uma frase e manter exemplos como ações secundárias.

## Could improve

1. Usar transição curta de seleção entre peças para reforçar continuidade espacial.
2. Exibir contagem de regras/fatos diretamente no nó, sem repetir a peça em outro card.
3. Criar modo de foco recolhendo Melhorar em telas grandes, depois que a nova hierarquia estiver validada.

## O que funciona e deve permanecer

- Tema escuro e âmbar como autoria/ação.
- Composer fixo e linguagem natural.
- Separação conceitual entre verdade viva, teste, execução e mudança.
- Dados honestos vindos do motor.
- Navegação móvel explícita criada na v76.

## Verificação depois da implementação

- **Desktop 1440 e 1280:** Melhorar permanece persistente; Caminho e documento compartilham a área principal sem uma terceira coluna. A peça selecionada recebe a largura útil e a leitura começa pelo papel, não pela configuração.
- **Tablet 768:** o painel antigo que desaparecia para fora da viewport foi substituído por uma superfície de 520px, navegada por tarefas. Não há overflow do documento nem competição com Melhorar.
- **Mobile 375:** a página não cria overflow horizontal; o caminho usa rolagem local e mantém a primeira peça inteira. Os cinco destinos continuam explícitos.
- **Interação:** Como funciona, Testar, Ao vivo e Mudanças foram navegados no breakpoint intermediário; `aria-current` acompanha a área ativa.
- **Acessibilidade:** cabeçalho, navegação contextual e ações móveis preservam alvo de toque; foco permanece visível em âmbar. A animação de entrada foi removida do documento para evitar conteúdo momentaneamente apagado em captura e em condições de movimento reduzido.

## Resultado contra os must fix

1. Tablet funcional: resolvido com layout de superfície única até `xl`.
2. Documento espremido: resolvido ao incorporar o Caminho no fluxo superior.
3. Hierarquia rasa: resolvida com abertura editorial, fatos em dupla, regras operacionais e evidência final.
4. Pendência dominante: resolvida com contador compacto em Mudanças.
