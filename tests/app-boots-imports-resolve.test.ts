import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';


describe('APP-BOOT', () => {
  it('APPBOOT-01: every name app.js uses is imported, and every name it imports really exists', () => {
    const run = spawnSync(process.execPath, ['scripts/check_app_imports.mjs'], { encoding: 'utf8' });
    const output = `${run.stdout ?? ''}${run.stderr ?? ''}`.trim();
    expect(run.status, `scripts/check_app_imports.mjs failed:\n${output}`).toBe(0);
  });
});
