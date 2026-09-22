# Layout V3: bancada modular do agente

## Direção aprovada para implementação

A composição preserva o fluxo pedido pelo produto: Melhorar à esquerda, conteúdo no meio e o Caminho do Agente à direita. O caminho continua vertical, uma peça embaixo da outra; não vira circuito horizontal.

## Três territórios

1. **Melhorar:** área quente de conversa, sugestões e composer. Tem linguagem e tratamento visual próprios para não parecer parte do artefato.
2. **Conteúdo:** contém as quatro áreas didáticas — Como funciona, Testar, Ao vivo e Mudanças — e exibe a verdade da peça selecionada.
3. **Caminho do Agente:** rail escuro com módulos verticais, índice, função, estado e conexão entre cada peça.

## Navegação principal

Cada uma das quatro áreas mostra ícone, nome e uma descrição curta:

- Como funciona — peças e regras.
- Testar — fale como lead.
- Ao vivo — execuções agora.
- Mudanças — revisar e publicar.

Em telas estreitas, a mesma navegação perde as descrições, mas preserva os nomes e alvos mínimos de toque.

## Redimensionamento

O divisor entre Melhorar e o conteúdo aceita mouse, toque e teclado. A largura do chat varia entre 300 e 520px, `Home` restaura 352px e duplo clique também volta ao padrão. A preferência é persistida em `localStorage`.

## Responsividade

- `>= 1280px`: chat, documento e rail aparecem simultaneamente.
- `< 1280px`: navegação por tarefa em uma superfície única; o documento vem primeiro e o Caminho depois.
- `375px`: sem overflow horizontal; cabeçalho, navegação, documento e módulos ocupam a largura disponível.

## Contraste visual

- Melhorar: fundo mais quente e borda âmbar discreta.
- Documento: superfície neutra de leitura, cantos de 8px e hierarquia editorial.
- Caminho: fundo mais escuro e módulos compactos com borda forte apenas na peça ativa.
