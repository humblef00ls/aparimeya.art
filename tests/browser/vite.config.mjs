import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// A standalone dev server for the GPU harnesses; never part of the Svelte build.
export default defineConfig({
  root: fileURLToPath(new URL('../../', import.meta.url)),
  cacheDir: '.svelte-kit/browser-tests-cache',
  server: { host: '127.0.0.1', port: 5175, strictPort: true },
});
