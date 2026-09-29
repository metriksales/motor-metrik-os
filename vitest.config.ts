import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Runner único do monorepo. Testes ficam ao lado do que testam (`tests/` do app
// ou `src/**/*.test.ts` dos pacotes) e rodam em Node — nada de navegador por
// padrão. Um teste de TELA (`*.test.tsx`) pede o jsdom na primeira linha:
// `// @vitest-environment jsdom`. Foi o que faltou no dia em que "testar
// agora" gravou a resposta certa e a tela não a mostrou (S-019).
export default defineConfig({
  resolve: {
    alias: {
      // mesmo alias do vite.config do front: os testes de tela importam por "@/"
      "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)),
    },
  },
  esbuild: { jsx: "automatic" },
  test: {
    include: [
      "apps/**/tests/**/*.test.ts",
      "apps/**/tests/**/*.test.tsx",
      "packages/**/src/**/*.test.ts",
      "apps/**/src/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**"],
    environment: "node",
    reporters: "default",
  },
});
