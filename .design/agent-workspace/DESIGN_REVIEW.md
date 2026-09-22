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
| `screenshots/layout-v3-desktop-1440.png` | 1440×1000 | Chat redimensionável + documento + módulos verticais |
| `screenshots/layout-v3-desktop-1280.png` | 1280×900 | Composição mínima de três territórios |
| `screenshots/layout-v3-tablet-768.png` | 768×900 | Documento em superfície única |
| `screenshots/layout-v3-mobile-375.png` | 375×812 | Documento sem overflow horizontal |

## Resumo

O Estúdio já tem uma tese forte, pedir em linguagem natural e ver a verdade do motor, mas a composição anterior distribuía peso quase igual para tudo. O documento ficava espremido entre chat e Cérebro; em tablet ele desaparecia. A melhoria troca “três colunas equivalentes” por três territórios com papéis e larguras claros: pedido ajustável, documento principal e caminho modular.

## Must fix

1. **Tablet fica funcionalmente quebrado.** Em `baseline-agent-tablet-768.png`, o breakpoint `md` ativa sidebar, chat fixo e painel direito ao mesmo tempo; o conteúdo principal sai da viewport. Correção: layout de uma superfície até `xl`, com navegação contextual explícita.
2. **Documento principal é a menor área útil.** Em `baseline-agent-desktop-1280.png`, Cérebro e chat consomem mais largura que a verdade viva. Correção: limitar o Caminho a 252px, tornar o chat redimensionável e reservar o restante ao documento.
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

## Verificação do Layout V3

- **Desktop 1440 e 1280:** Melhorar permanece à esquerda; o documento ocupa o centro; o Caminho volta à direita como sequência vertical de módulos. As três superfícies têm fundos, densidades e funções diferentes.
- **Divisor:** arraste validado de 352 para 456px; `Home` restaurou 352px. O valor foi persistido e o separador expõe `role="separator"` com limites acessíveis.
- **Tablet 768:** o chat deixa de competir com o conteúdo. Como funciona ocupa 520px; o documento aparece primeiro e o rail modular continua abaixo.
- **Mobile 375:** viewport e documento medem 375px, sem overflow horizontal. A navegação preserva os cinco destinos com 48px de altura.
- **Navegação:** os quatro destinos do conteúdo ganharam ícone, título, frase de apoio e estados de atividade/pendência em desktop.
- **Hierarquia:** o artefato usa leitura editorial; o rail usa blocos compactos e conectores verticais; Melhorar mantém caráter de conversa.

## Resultado contra os must fix

1. Tablet funcional: resolvido com layout de superfície única até `xl`.
2. Documento espremido: resolvido com larguras controladas e divisor ajustável; o Caminho permanece visível, mas restrito a 252px.
3. Hierarquia rasa: resolvida com abertura editorial, fatos em dupla, regras operacionais e evidência final.
4. Pendência dominante: resolvida com contador compacto em Mudanças.

## V4 — revisão de despoluição

### Capturas

| Arquivo | Breakpoint | Estado |
|---|---:|---|
| `screenshots/declutter-v4-desktop-1440.png` | 1440×1000 | Modo foco completo |
| `screenshots/declutter-v4-desktop-1280.png` | 1280×900 | Desktop mínimo com três territórios |
| `screenshots/declutter-v4-tablet-768.png` | 768×900 | Documento e Caminho empilhados |
| `screenshots/declutter-v4-mobile-375.png` | 375×812 | Documento em uma coluna |

### Diagnóstico aplicado

A V3 acertou a posição das áreas, mas manteve quatro fontes de ruído: menu global expandido, abas com subtítulos e caixas, documento composto por cards e módulo lateral cheio de metadados. A V4 removeu essas camadas sem esconder as tarefas principais.

### Resultado

- **Modo foco:** a navegação global usa 68px dentro do agente. Em 1440px, o documento ganhou 824px; em 1280px, preserva 664px.
- **Uma hierarquia:** o papel da peça é o maior texto; contexto e regras vêm depois; o Caminho é índice, não segundo documento.
- **Menos componentes visuais:** fatos, contexto e regras perderam contêineres internos; as quatro áreas perderam subtítulos e caixas de ícone.
- **Assinatura controlada:** somente a espinha vertical e a peça ativa usam âmbar com força.
- **Interação:** o divisor foi validado de 320 para 388px e `Home` restaurou 320px; preferência persistida.
- **Responsividade:** sem overflow horizontal em 375, 768, 1280 e 1440px. Tablet e mobile colocam o Caminho depois do documento.
- **Acessibilidade:** auditoria axe WCAG 2 A/AA com zero violações; navegação e ações preservam alvo mínimo e foco visível.

## V5 — revisão do Caminho

### Capturas

| Arquivo | Breakpoint | Estado |
|---|---:|---|
| `screenshots/path-v5-desktop-1440.png` | 1440×1000 | Sequência operacional completa à direita |
| `screenshots/path-v5-desktop-1280.png` | 1280×900 | Rail de 248px no desktop mínimo |
| `screenshots/path-v5-tablet-768.png` | 768×900 | Caminho empilhado depois do documento |
| `screenshots/path-v5-mobile-375.png` | 375×812 | Módulo ativo e próxima peça sem overflow |

### Resultado

- **Leitura de fluxo:** os números ficam numa espinha externa e formam a sequência `01 → depois → 02`.
- **Estado inequívoco:** âmbar identifica a peça selecionada; verde fica reservado ao estado “No ar”.
- **Módulo útil:** tipo, nome, função e contagem de regras/fatos aparecem numa única unidade, sem virar outro documento.
- **Próxima ação:** o placeholder vira “Ligar próxima peça”, visualmente subordinado mas legível.
- **Responsividade:** sem overflow horizontal em 375, 768, 1280 e 1440px.
- **Acessibilidade:** auditoria axe WCAG 2 A/AA com zero violações depois do ajuste de contraste da próxima peça.
