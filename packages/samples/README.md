# @motor/samples

Exemplos REAIS (não mock de tela) que provam a doutrina do Motor Metrik OS:
**os motores são peças reutilizáveis; a mesma peça serve papéis diferentes só trocando a config.**

São `AgentSpec` tipados por `@motor/core` (única dependência) + os evals da Bia.

- **`biaSDR`** — agente de *resposta*. Usa o motor `followup` no papel clássico: reaquecer o **lead** frio.
- **`cobradorEquipe`** — a prova. É o **MESMO** motor `followup` (mesmo `id`), mas com config
  `publico: "humanos"` + canal interno: em vez de reaquecer o lead, cobra o **vendedor humano**
  que deixou a tarefa parada. Não se recria um motor "cobrança" — repluga-se o `followup`.
- **`peticoes`** — agente de *ação*: motor próprio (`peticao`) + integração `advbox`.

`biaEvals` é o porteiro: trava as regras da Bia ("não fala preço sem qualificar",
"não revela que é IA", qualifica no inbound, agenda quando pedem). Custom só sai do sandbox se passar.
