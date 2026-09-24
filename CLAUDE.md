# Metrik-OS

As instruções de trabalho deste repositório estão em **[`AGENTS.md`](AGENTS.md)** — mesmo conteúdo para qualquer IA de terminal. **Leia antes do primeiro commit.**

O essencial, para não errar o básico:

1. **Identidade do git** (a Vercel recusa deploy de outro autor):
   ```bash
   git config user.name "metrik-sales"
   git config user.email "contatosalesmetrik@gmail.com"
   ```
2. **`npm run ci` antes de commitar** — typecheck, lint e testes, o mesmo que a CI roda.
3. **Comece pelo [`STORIES.md`](STORIES.md)**: trabalhe dentro de uma story e atualize-a na mesma entrega, escrevendo **como verificou**.
4. **Nunca no `main` direto**: branch, PR, CI verde (`git config core.hooksPath .githooks` roda a esteira antes do push).
5. **Dois agentes, nomes fixos:** *agente construtor* (monta e mantém) × *agente de operação* (atende leads no CRM).
