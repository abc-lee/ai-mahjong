/// <reference types="vite/client" />

// CSS Modules 类型声明
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.css' {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  readonly VITE_SOCKET_URL: string;
}

interface ImportMetaMeta {
  readonly env: ImportMetaEnv;
}
