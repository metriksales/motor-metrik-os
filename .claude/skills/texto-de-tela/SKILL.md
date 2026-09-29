---
name: texto-de-tela
description: Como o Metrik-OS fala com quem o usa. Regras para qualquer texto que a pessoa lê na tela — frases de estado, erros, avisos, rótulos, botões, textos de ajuda. Use antes de escrever ou revisar texto de interface, e antes de escrever a frase que um teste de conexão ou um erro de API devolve, porque ela aparece na tela.
---

# Texto de tela

Vale para tudo que a pessoa lê na interface do Metrik-OS: frases de estado, mensagens de erro, avisos, rótulos de campo, botões, selos, textos de ajuda, estados vazios. Vale também para frases que nascem no servidor e chegam à tela: o `detalhe` de um teste de conexão, a mensagem de um `ErroDeDominio`, o `resumo` de uma execução.

Não vale para comentários de código, `STORIES.md`, mensagens de commit nem log de servidor. Esses têm outro registro.

## O princípio

Quem fala é o sistema, e o sistema não é uma pessoa. Ele informa o que aconteceu e o que fazer, em frases completas, curtas, impessoais, na ordem em que a pessoa precisa saber. Não conversa, não se desculpa, não comemora, não explica por quê a menos que o porquê mude o que a pessoa faz.

O que motivou esta skill: um cartão de conexão dizia `uazapi respondeu agora — a mesma resposta de antes`. Minúscula no início, travessão, segunda parte sem verbo, tom de bate-papo. A frase certa era `Resposta recebida agora. Igual à anterior.`

## Regras

1. **Toda frase tem sujeito e verbo, e o verbo tem os complementos que pede.** Nada de fragmento solto. `a mesma resposta de antes` não é frase. `A resposta é igual à anterior.` é. Objeto direto e indireto explícitos quando o verbo exige: `O GHL recusou o token.` (quem recusou, o quê), `Leia o QR code no painel da uazapi.` (o quê, onde).
2. **Primeira letra maiúscula.** Em frase, rótulo, botão, selo, texto de ajuda. Se a frase começaria por uma marca escrita em minúscula (`uazapi`), reescreva para o artigo vir primeiro: `A uazapi recusou o token.`
3. **Frase termina em ponto.** Rótulo, botão, título, selo e linha de metadados não levam ponto. Exemplos: `Testar agora` (botão), `Sem credencial` (selo), `Canal · Testada agora` (metadados), `Instância desconectada.` (frase).
4. **Uma ideia por frase. Duas frases no máximo por mensagem.** A primeira diz o que aconteceu; a segunda, o que fazer. `Instância desconectada. Leia o QR code no painel da uazapi.`
5. **Impessoal.** Sem `eu`, `a gente`, `nós`, `não consegui`, `deixa comigo`. O sistema não tem primeira pessoa. `Não consegui ler as conexões` vira `Não foi possível ler as conexões.`
6. **Direto.** Instrução no imperativo, sem `você precisa`, `por favor`, `tente`. `Cadastre um token válido.` Evite `você` quando a frase fica clara sem ele.
7. **Sintético.** Corte tudo que não muda o que a pessoa entende ou faz. `Ninguém perguntou ao provedor ainda. Teste agora para saber.` vira `Sem teste até agora.` Até doze palavras por frase é a medida.
8. **Sem travessão, ponto e vírgula, reticências, exclamação, emoji, símbolo no meio do texto.** Ideias separadas viram frases separadas. `✓` e `🎉` não são texto; ícone vem do conjunto de ícones. O ponto do meio (`·`) só separa itens em linha de metadados, nunca dentro de frase.
9. **Estado em andamento é um verbo no gerúndio, sem pontuação.** `Testando`, `Guardando e testando`, `Lendo os dados da conta`. Sem reticências.
10. **Sem nome interno.** Nada de `baseUrl`, `HTTP 503` solto, `orgId`, nome de tabela ou de campo do código. Exceções: a sigla ou o id que a pessoa precisa achar no sistema de origem, entre parênteses, uma vez: `Id da subconta (locationId)`; e o código HTTP como complemento de uma frase inteira: `A uazapi respondeu com erro (HTTP 503).`
11. **Sem promessa que o sistema não conferiu.** `Tudo certo`, `no ar e funcionando`, `ligado` só depois de um teste com data. Sem teste, a tela diz que não houve teste. Esta é a regra da S-007, e o texto é onde ela mais se quebra.
12. **Vocabulário fixo.** Conexão, credencial, cofre, teste, instância, subconta, funil, etapa, calendário, agente de operação, agente construtor. Marcas como elas se escrevem: `uazapi`, `GHL` (ou `GoHighLevel`), `Kommo`, `WhatsApp`. Não invente sinônimo para variar.
13. **Nada se repete no mesmo cartão.** Se o nome de quem respondeu está numa linha, a frase de estado não o repete. Se o selo diz `No ar`, a frase não diz `conectado` de novo sem acrescentar nada.
14. **Sem texto decorativo.** Não entra na tela texto que não muda o que a pessoa entende ou faz: faixa de apresentação, slogan, parágrafo que explica a filosofia da página, cabeçalho de seção que repete o título da página ou descreve o óbvio (`Estado das pontas`, `O que o último teste disse`). O título da página já está na barra de cima. O conteúdo começa pelo conteúdo. Na dúvida, tire: se ninguém sentir falta, não fazia falta.

## Formas

| Peça | Forma | Exemplos |
| :--- | :--- | :--- |
| Botão | Verbo no infinitivo, mais o objeto quando houver | `Testar agora`, `Guardar e testar`, `Ver conexões` |
| Selo (pill) | Uma ou duas palavras, sem verbo | `No ar`, `Com problema`, `Sem credencial`, `Nunca testada` |
| Rótulo de campo | Substantivo, sem ponto | `Rótulo`, `Endereço da instância`, `Token da instância` |
| Texto de ajuda | Frase curta, com ponto | `Opcional. Se preenchido, o teste confere que existe.` |
| Metadados | Itens separados por `·`, sem ponto | `Canal · Testada há 5 min` |
| Estado | O que aconteceu. O que fazer. | `Instância desconectada. Leia o QR code no painel da uazapi.` |
| Erro de sistema | O que não foi possível, mais a referência | `Não foi possível ler as conexões. (ref 3f9a12bc)` |
| Confirmação | O que aconteceu, com o quando | `Resposta recebida agora.` |
| Estado vazio | O que não há, e o próximo passo | `Nenhuma conexão cadastrada nesta conta. Cadastre a primeira abaixo.` |
| Título | Frase nominal ou frase completa, sem ponto | `O que o último teste disse` |

## Antes e depois, do próprio repositório

| Antes | Depois |
| :--- | :--- |
| `uazapi respondeu agora — a mesma resposta de antes` | `Resposta recebida agora. Igual à anterior.` |
| `a instância está desconectada do WhatsApp — reconecte pelo QR code no painel da uazapi` | `Instância desconectada. Leia o QR code no painel da uazapi.` |
| `não consegui ler as conexões da sua conta: erro 500` | `Não foi possível ler as conexões. erro 500` |
| `nada pendente — a frota está rodando sozinha ✓` | `Nada pendente. A frota está rodando sozinha.` |
| `pergunta ao provedor e grava a resposta` | `Pergunta à uazapi e grava a resposta.` |
| `testada há agora` | `Testada agora` |
| `opcional — se preencher, o teste confere que existe` | `Opcional. Se preenchido, o teste confere que existe.` |
| `falta o endereço da instância (baseUrl, ex.: https://minha.uazapi.com)` | `Falta o endereço da instância.` |
| `o funil p9 não existe nesta subconta (existem: Vendas, Pós-venda)` | `O funil p9 não existe nesta subconta. Existem: Vendas, Pós-venda.` |
| `nenhuma credencial "linha-1" do tipo whatsapp guardada no cofre desta conta` | `Nenhuma credencial guardada no cofre para esta conexão (rótulo "linha-1").` |
| Faixa `Conexões da conta` / `O que cada ponta respondeu, não o que foi cadastrado.` / parágrafo sobre o que quebra, mais o cabeçalho `Estado das pontas` / `O que o último teste disse` | Nada. A página abre nos cartões. |

## Antes de entregar uma tela

- Leia cada texto em voz alta como se fosse um aviso na parede. Se soa como alguém falando, reescreva.
- Confira: maiúscula inicial, ponto no fim da frase, nenhum `—`, `;`, `…`, `!`, emoji ou símbolo dentro do texto.
- Confira que nenhuma frase começa com minúscula por causa de uma marca.
- Confira que nada é afirmado sem ter sido conferido, e que o cartão não repete a mesma informação em duas linhas.
- Para cada bloco de texto, pergunte: se ele sumir, a pessoa entende ou faz algo diferente? Se a resposta for não, ele sai.
- Frases que nascem no servidor (testadores, erros de domínio, resumos) passam pelas mesmas regras, e os testes delas conferem o texto exato.
