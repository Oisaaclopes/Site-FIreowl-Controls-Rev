import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Resolve o alias '@/…' (mesmo do tsconfig) para os testes do Vitest.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  // O tsconfig do Next usa `jsx: "preserve"`; o Vite 8 (oxc) herdaria isso e
  // deixaria o JSX sem transformar nos testes .tsx. Força o runtime automático.
  oxc: {
    jsx: { runtime: 'automatic' },
  },
});
