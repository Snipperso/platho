import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE INTRO SCAN CEILING — half of this guarantee lives in an IMMUTABLE contract, the other half in mutable
// JavaScript. That split is why it needs a gate. [Found by the 2026-08-28 adversarial audit as the ONE
// remaining path to a silent MESSAGE loss in the messaging lanes.]
//
// A shard of epoch E becomes permissionlessly retireable at
//     retire_at = (E + 2) * 86400 + IS_INTRO_RETENTION + IS_RETIRE_SLACK
// and a client scanning INTRO_SCAN_EPOCHS_BACK epochs behind stops covering that shard once the clock passes
//     scan_end = (E + INTRO_SCAN_EPOCHS_BACK + 1) * 86400.
// While scan_end <= retire_at the recipient always sees a first contact before the shard can be destroyed.
// PAST that point the shard can be retired WHILE STILL IN THE SCAN WINDOW, and the failure is the worst kind
// this project knows: a destroyed account answers exit -256, the reader reads that as "bucket drained", commits
// its cursor, and the first contact vanishes with NO error anywhere (IntroShard.tact documents exactly this).
//
// The contract side is sealed and can never be widened; only the JS constant can move, and widening it is a
// one-line change anyone might make to "scan further back". This gate makes that change fail loudly instead.
// It reads the LIVE sealed contract, so it guards the shipping product, not just the design lane.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const num = (src: string, name: string): number => {
  const m = src.match(new RegExp(`const ${name}: Int = (\\d+);`));
  if (!m) throw new Error(`${name} not found`);
  return Number(m[1]);
};

describe('INTRO-SCAN-CEILING', () => {
  it('INTRO-SCAN-CEILING-01: the client scan window stays inside what the sealed retire gate guarantees', () => {
    const shard = readFileSync('contracts/IntroShard.tact', 'utf8');
    const client = readFileSync('web/intro-receive.mjs', 'utf8');

    const DAY = 86_400;
    const retention = num(shard, 'IS_INTRO_RETENTION');
    const slack = num(shard, 'IS_RETIRE_SLACK');
    const back = Number(client.match(/export const INTRO_SCAN_EPOCHS_BACK = (\d+);/)![1]);

    // retire_at measured in epochs from E, then the last epoch a client may look back over.
    const retireEpochs = (2 * DAY + retention + slack) / DAY;   // 13 for the sealed constants
    const ceiling = retireEpochs - 1;                           // 12 — beyond this the windows overlap

    expect(Number.isInteger(retireEpochs), 'retire_at must land on an epoch boundary').toBe(true);
    expect(back,
      `INTRO_SCAN_EPOCHS_BACK=${back} exceeds the ${ceiling}-epoch ceiling the SEALED IntroShard guarantees `
      + '(retention + retire slack). Widening the scan window past it lets a shard be retired while a recipient '
      + 'is still scanning it — the first contact would vanish with no error. The chain side cannot be changed; '
      + 'lower the client constant instead.')
      .toBeLessThanOrEqual(ceiling);
  });
});
