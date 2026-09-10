import { defineConfig } from 'vitest/config';

// THE CLEAN-18 GATES, WHICH UNTIL NOW RAN UNDER NO CONFIG AT ALL.
//
// vitest.all.config.ts includes `tests/**` only, deliberately (its comment says why: the release evidence counts
// that tree's files on every machine). Nothing included contracts18/tests, so the lane's own gates were only ever
// run by hand — and 34 of them could not pass, because the @ton/test-utils matchers register nowhere under
// vitest. setup-matchers.ts fixes the registration; this config is what makes the run repeatable.
//
// Kept OUT of the canonical suite for the same reason tools/admin is: folding it in would change the file count
// the release-truth guard compares against artifacts/CURRENT_FULL_TEST_SUMMARY.json. Run it with `npm run
// test:c18`, alongside `npm test`, not inside it.
export default defineConfig({
  test: {
    include: ['contracts18/tests/**/*.test.ts'],
    setupFiles: ['./contracts18/tests/setup-matchers.ts'],
    // Same pool settings as the canonical config: the TON sandbox suite completes correctly under the default
    // pools, but vitest 4 can leave threads alive after the summary. vmThreads exits cleanly.
    pool: 'vmThreads',
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
  },
});
