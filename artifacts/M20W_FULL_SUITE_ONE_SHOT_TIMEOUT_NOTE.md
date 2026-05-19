# M20W One-shot Full Suite Note

The one-shot `npm test` / full Vitest suite is not used as the M20W proof artifact in this sandbox.

Reason:

- the project uses TON sandbox-heavy tests;
- even with `pool: 'vmThreads'`, this container can hang or time out around process teardown / final summary capture;
- this is an environment/process-lifecycle issue, not an observed assertion failure in M20W.

M20W therefore uses explicit chunked proof artifacts that together cover all test files.

Chunked matrix result:

- 34 / 34 test files covered;
- 142 / 142 tests passed;
- 0 failed chunks.
