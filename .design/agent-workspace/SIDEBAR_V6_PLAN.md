# V6 — menu lateral como rail de operação

## Tese

O menu não pode parecer uma toolbar anexada. Ele é a coluna estrutural do Motor OS: começa na marca, organiza a operação em grupos e entrega a rota ativa diretamente ao conteúdo.

## Sistema visual

- **Fundo:** `#090b0f` com borda direita `#232932`.
- **Superfície ativa:** âmbar a 8% sobre `#11151b`.
- **Texto:** `#eef1f4` principal, `#8b949f` secundário.
- **Estado:** âmbar indica a rota atual; verde indica somente operação ao vivo.
- **Tipografia:** Inter para navegação e JetBrains Mono para rótulos de grupo/status.

## Estrutura

```text
┌───────────────┐
│ marca         │
│ organização   │
├───────────────┤
│ OPERAR        │
│ Início        │
│ Agentes       │
│ Ao vivo       │
│               │
│ CONSTRUIR     │
│ Módulos       │
│ Conexões      │
│               │
│ Admin         │
├───────────────┤
│ operação ativa│
└───────────────┘
```

No modo foco, a mesma estrutura vira um rail de 76px. Os grupos permanecem através de separadores, os rótulos aparecem em tooltip e a rota ativa toca a borda do conteúdo.

## Assinatura

O item ativo termina numa pequena “ponte” âmbar na borda direita. Ela conecta visualmente navegação e tela sem criar outra caixa ou faixa.

## Corte de ruído

- Retirar o status interno “Claude Code / Codex” do rodapé.
- Uma única leitura de saúde: “Operação ativa · N agentes trabalhando”.
- No Caminho, remover `01/02`; a sequência fica na espinha e nos conectores.
