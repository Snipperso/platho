import { defineConfig } from 'vitest/config';

// The gate of the owner's LOCAL operator console. tools/admin is untracked and gitignored (owner, 2026-08-21: nothing
// secret in it, but not for showing), so its test lives beside it rather than under tests/, and runs through THIS
// config — `npm run admin:test` — on a machine that has the folder. It is kept out of vitest.all.config.ts on purpose:
// the release evidence records the canonical run's file count, and the release-truth guard compares that with the
// tests/ tree on every machine, CI included; one extra file on one machine would make the evidence disagree
// everywhere else. Same worker/timeout shape as the canonical config, so a result here means the same thing.
export default defineConfig({
  test: {
    include: ['tools/admin/**/*.test.ts'],
    pool: 'vmThreads',
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
  },
});
