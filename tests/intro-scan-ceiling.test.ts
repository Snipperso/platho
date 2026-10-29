import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';


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

    const retireEpochs = (2 * DAY + retention + slack) / DAY;
    const ceiling = retireEpochs - 1;

    expect(Number.isInteger(retireEpochs), 'retire_at must land on an epoch boundary').toBe(true);
    expect(back,
      `INTRO_SCAN_EPOCHS_BACK=${back} exceeds the ${ceiling}-epoch ceiling the SEALED IntroShard guarantees `
      + '(retention + retire slack). Widening the scan window past it lets a shard be retired while a recipient '
      + 'is still scanning it — the first contact would vanish with no error. The chain side cannot be changed; '
      + 'lower the client constant instead.')
      .toBeLessThanOrEqual(ceiling);
  });
});
