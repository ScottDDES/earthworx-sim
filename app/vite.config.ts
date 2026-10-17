import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The engine lives one folder up; the screens import it as '@engine'.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@engine': new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') } },
  server: { port: 5173 },
});
