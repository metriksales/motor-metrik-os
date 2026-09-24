# V5 — Caminho como sequência operacional

## Objetivo

Melhorar somente a visualização da lateral direita sem reabrir a poluição eliminada na V4. O Caminho precisa responder, num olhar: qual peça roda agora, o que ela faz e o que vem depois.

## Estrutura

```text
CAMINHO                         1 ATIVA
ordem em que Bia trabalha

  01 ──┌────────────────────────────┐
   │   │ NÚCLEO              NO AR │
   │   │ Conversa                  │
   │   │ fala com o lead           │
   │   │ 2 regras · 0 fatos       →│
   │   └────────────────────────────┘
 depois
   │
  02 ──┌────────────────────────────┐
       │ + Ligar próxima peça       │
       └────────────────────────────┘
```

## Decisões visuais

- Rail passa de 220 para 248px para o texto respirar.
- O número fica fora do módulo e faz parte da espinha; ele representa ordem real, não decoração.
- O módulo ativo é um cartucho de execução: tipo e estado no topo, nome, função e metadado abaixo.
- O conector mostra a condição entre peças sem criar outra caixa.
- A próxima peça vira uma ação compacta e explícita, não um card desabilitado grande.
- Âmbar marca posição/seleção; verde marca somente “no ar”.

## Assinatura

A espinha tem um pulso curto apenas no trecho da peça selecionada. Com `prefers-reduced-motion`, o pulso fica estático.
