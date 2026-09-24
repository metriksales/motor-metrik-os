import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Runner único do monorepo. Testes ficam ao lado do que testam (`tests/` do app
// ou `src/**/*.test.ts` dos pacotes) e rodam em Node — nada de navegador por ora.
export default defineConfig({
  resolve: {
    alias: {
      // mesmo alias do vite.config do front: os testes de tela importam por "@/"
      "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)),
    },
  },
  test: {
    include: [
      "apps/**/tests/**/*.test.ts",
      "packages/**/src/**/*.test.ts",
      "apps/**/src/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**"],
    environment: "node",
    reporters: "default",
  },
});
