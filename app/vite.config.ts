import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The engine lives one folder up; the screens import it as '@engine'.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@engine': new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') } },
  // the phone app projects churn thousands of files while they build; the dev server needn't watch them
  server: { port: 5173, watch: { ignored: ['**/android/**', '**/ios/**', '**/dist/**'] } },
});