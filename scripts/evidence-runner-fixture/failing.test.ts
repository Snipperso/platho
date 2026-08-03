import { describe, expect, it } from 'vitest';

// Deliberately red. Driven ONLY by tests/evidence-runner-writes-on-red.test.ts through a private vitest config, to
// prove that scripts/run_evidence_suite.mjs writes the evidence summary even when the suite fails. It lives outside
// tests/ so the canonical suite (include: tests/**/*.test.ts) never collects it.
describe('FIXTURE — always red on purpose', () => {
  it('fails so the runner has a failure to record', () => {
    expect(1).toBe(2);
  });
});
