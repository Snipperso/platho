import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scripts/evidence-runner-fixture/*.test.ts'],
    pool: 'forks',
    fileParallelism: false,
  },
});
