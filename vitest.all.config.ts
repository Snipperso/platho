import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // The TON sandbox suite completes correctly under the default worker pools,
    // but Vitest 4.x can leave its threads/forks pool alive after printing the
    // final "all tests passed" summary. vmThreads exits cleanly while keeping the
    // suite isolated and single-worker deterministic.
    pool: 'vmThreads',
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
  },
});
