import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // the side-by-side tests check the engine against the prototype exactly, quirks included
    setupFiles: ['test/setup.ts'],
  },
});
