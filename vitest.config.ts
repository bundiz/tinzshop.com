import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Component tests render JSX with the React 17+ runtime, as Next.js does.
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
