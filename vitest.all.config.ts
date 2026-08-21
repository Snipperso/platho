import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // tests/ ONLY, deliberately. The owner's local operator console (tools/admin, untracked and gitignored) carries
    // its own gate beside it and runs through vitest.admin.config.ts (`npm run admin:test`). It is NOT folded into
    // this include: the release evidence (artifacts/CURRENT_FULL_TEST_SUMMARY.json) records the canonical run's
    // file count and the release-truth guard compares it with the tests/ tree on EVERY machine, CI included — a
    // run that counted one extra file on the one machine that has the folder would make that evidence disagree
    // with the tree everywhere else.
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
