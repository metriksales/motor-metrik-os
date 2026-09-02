/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  readonly VITE_MOTOR_TOKEN?: string;
  readonly VITE_ORG_ID?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
