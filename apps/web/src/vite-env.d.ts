/// <reference types="vite/client" />

// Nenhum segredo aqui: tudo com prefixo VITE_ é embutido no JavaScript público.
interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
