import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// 新客户端 Vite 配置（纯 HTML/JS，无 React）
export default defineConfig({
  root: 'src/client-new',
  publicDir: 'public',
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
      '/api': {
        target: 'http://localhost:3000',
      },
    },
  },
  build: {
    outDir: '../../dist/client-new',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
      },
    },
  },
});
