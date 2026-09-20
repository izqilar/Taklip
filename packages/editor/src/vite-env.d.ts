/// <reference types="vite/client" />

// 内核被 web / 运营端通过 Vite 消费，import.meta.env 由 Vite 注入。
// 这里做最小补全，使 @h5design/editor 可独立 typecheck。
interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly [key: string]: unknown;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
