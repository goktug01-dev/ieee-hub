import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/seed-demo.test.ts'],
    testTimeout: 120000,
  },
});
