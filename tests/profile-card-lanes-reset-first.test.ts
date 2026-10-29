import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';


const app = readFileSync('web/app.js', 'utf8');
const open = code(sourceBlock(app, 'async function openProfileCardDialog(subject) {'));

describe('the profile card\'s lanes start empty before anything can answer', () => {
  it('LANES-01: one reset, right after the subject is set, before every call that can mark a lane', () => {
    const resets = open.split('profileCardLanesDone = new Set();').length - 1;
    expect(resets, 'the opener resets the lanes once').toBe(1);
    const reset = open.indexOf('profileCardLanesDone = new Set();');
    expect(open.indexOf('profileCardLanesPartial = new Set();')).toBeLessThan(reset);
    expect(open.indexOf('profileCardSubject = raw;')).toBeLessThan(open.indexOf('profileCardLanesPartial = new Set();'));
    for (const marker of ['restoreOrQueueLatestPost(raw)', 'driveProfileCardRead(', 'markProfileCardLaneDone(', 'renderProfileCardLatestPost(raw)']) {
      const at = open.indexOf(marker);
      expect(at, `${marker} is in the opener`).toBeGreaterThan(0);
      expect(reset, `MEASURED before: the reset came after ${marker} and wiped its mark`).toBeLessThan(at);
    }
  });

  it('LANES-02: a lane answered at once — the latest post this tab already holds — stays marked', () => {
    const restore = code(sourceBlock(app, 'async function restoreOrQueueLatestPost(raw) {'));
    expect(restore).toMatch(/if \(state && !state\.stale && state\.status !== 'loading' && state\.status !== 'error'\) \{\s*markProfileCardLaneDone\(raw, 'latest'\);/);
    expect(open.indexOf('void restoreOrQueueLatestPost(raw);')).toBeGreaterThan(open.indexOf('profileCardLanesDone = new Set();'));
  });
});
