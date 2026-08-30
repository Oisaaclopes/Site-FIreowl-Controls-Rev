import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Resolve o alias '@/…' (mesmo do tsconfig) para os testes do Vitest.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
