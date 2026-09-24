import { defineConfig } from "vitest/config";

// Runner único do monorepo. Testes ficam ao lado do que testam (`tests/` do app
// ou `src/**/*.test.ts` dos pacotes) e rodam em Node — nada de navegador por ora.
export default defineConfig({
  test: {
    include: ["apps/**/tests/**/*.test.ts", "packages/**/src/**/*.test.ts", "apps/**/src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    environment: "node",
    reporters: "default",
  },
});
