import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 15000,
    hookTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['**/*.spec.ts', '**/*.test.ts', '**/__tests__/**', '**/node_modules/**'],
      lines: 80,
      functions: 80,
      branches: 70,
      statements: 80,
    },
  },
});
