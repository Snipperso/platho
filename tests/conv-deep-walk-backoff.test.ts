import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';


const APP = readFileSync('web/app.js', 'utf8');
const CODE = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').map((line) => line.replace(/\/\/.*$/, '')).join('\n');

function helpers() {
  const start = APP.indexOf('const CONV_DEEP_WALK_RETRY_BASE_MS');
  const end = APP.indexOf('\n}\n', APP.indexOf('function noteConvDeepWalkShort')) + 3;
  expect(start, 'the backoff constants are still declared').toBeGreaterThan(0);
  expect(end, 'and the helper that notes a short walk').toBeGreaterThan(start);
  // eslint-disable-next-line no-new-func
  return new Function(`${APP.slice(start, end)}\nreturn { convDeepWalkHeldBack, noteConvDeepWalkShort, convDeepWalkShort };`)();
}

describe('CONV deep-walk retry spacing', () => {
  it('DEEPWALK-01: a short deep walk holds the next one back for a minute, doubling to an hour, and a clean pass forgets', () => {
    const h = helpers();
    const t0 = 1_800_000_000_000;
    expect(h.convDeepWalkHeldBack('peer', t0), 'nothing held back before any short walk').toBe(false);
    h.noteConvDeepWalkShort('peer', t0);
    expect(h.convDeepWalkHeldBack('peer', t0 + 59_999), 'one minute after the first').toBe(true);
    expect(h.convDeepWalkHeldBack('peer', t0 + 60_000)).toBe(false);
    h.noteConvDeepWalkShort('peer', t0 + 60_000);
    expect(h.convDeepWalkHeldBack('peer', t0 + 60_000 + 119_999), 'two after the second').toBe(true);
    let at = t0 + 180_000;
    for (let i = 0; i < 20; i += 1) h.noteConvDeepWalkShort('peer', at);
    expect(h.convDeepWalkHeldBack('peer', at + 3_600_000 - 1), 'capped at an hour').toBe(true);
    expect(h.convDeepWalkHeldBack('peer', at + 3_600_000), 'and not a millisecond past it').toBe(false);
    h.convDeepWalkShort.delete('peer');
    expect(h.convDeepWalkHeldBack('peer', at), 'a clean pass forgets the history').toBe(false);
    expect(h.convDeepWalkHeldBack('other', at), 'and the spacing is per conversation').toBe(false);
  });

  it('DEEPWALK-02: the pass consults the clock, a short DEEP walk sets it, a clean pass and a wallet switch clear it', () => {
    expect(CODE, 'a manual Sync is never held back; an owed or cold walk waits for its clock')
      .toMatch(/const deepWalk = forceFull\s*\|\|\s*\(\(plan\.cold === true \|\| convDeepWalkPending\.has\(convKey\)\) && !convDeepWalkHeldBack\(convKey\)\);/);
    expect(CODE, 'only a DEEP walk that gapped is spaced out').toContain('if (deepWalk) deepWalkCameShort = true;');
    expect(CODE, 'and once per pass').toContain('if (deepWalk && deepWalkCameShort) noteConvDeepWalkShort(convKey);');
    expect(CODE, 'a clean pass forgets it').toMatch(/convDeepWalkPending\.delete\(convKey\);\s*convDeepWalkShort\.delete\(convKey\);/);
    expect(CODE, 'and a wallet switch clears it with the rest').toMatch(/convDeepWalkPending\.clear\(\);\s*convDeepWalkShort\.clear\(\);/);
    expect(CODE, 'on a monotonic clock, not the device wall clock').toMatch(/function convDeepWalkHeldBack\(convKey, nowMs = convDeepWalkClockMs\(\)\)/);
  });
});
