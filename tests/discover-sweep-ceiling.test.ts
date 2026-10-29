import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';


const LANE = readFileSync('web/public-lane.mjs', 'utf8');
const APP = readFileSync('web/app.js', 'utf8');

describe('DISCOVER-SWEEP-CEILING', () => {
  it('DSC-01: the sweep has a finite bucket cap by DEFAULT — never null, never Infinity', () => {
    const sig = LANE.match(/async sweepChannelCatalog\(\{([^}]*)\}/);
    expect(sig, 'sweepChannelCatalog must still take a destructured options object').not.toBeNull();
    const topBuckets = sig![1].match(/topBuckets\s*=\s*([A-Za-z0-9_.]+)/);
    expect(topBuckets, 'topBuckets must have a default').not.toBeNull();
    const dflt = topBuckets![1];
    expect(['null', 'Infinity', 'undefined'],
      `the sweep's default bucket cap is ${dflt} — an unbounded sweep is a ceiling on the number of channels the `
      + 'product can have').not.toContain(dflt);

    const capValue = LANE.match(new RegExp(`const ${dflt} = (\\d+);`));
    expect(capValue, `${dflt} must be a literal constant in this file, so the cost is readable`).not.toBeNull();
    const cap = Number(capValue![1]);
    expect(cap, 'the cap must be a real bound').toBeGreaterThan(0);
    expect(cap, 'and small enough that the sweep stays a fixed cost — 96 announcements per bucket is plenty')
      .toBeLessThanOrEqual(64);

    expect(LANE, 'the limit must come from topBuckets, not from the number of live buckets')
      .toMatch(/const limit = [^\n]*topBuckets[^\n]*;/);
    expect(LANE, 'and the bucket set must actually be sliced by that limit')
      .toContain('ordered.slice(0, limit)');
    expect(LANE, 'a limit taken straight from the live set is the cap being ignored')
      .not.toMatch(/const limit = ordered\.length;/);
  });

  it('DSC-02: no caller asks the sweep for an unbounded walk', () => {
    const offenders: string[] = [];
    for (const [name, src] of [['web/app.js', APP], ['web/public-lane.mjs', LANE]] as const) {
      src.split('\n').forEach((line, i) => {
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
        const m = t.match(/topBuckets:\s*(Infinity|null)/);
        if (m) offenders.push(`${name}:${i + 1} passes topBuckets: ${m[1]}`);
      });
    }
    expect(offenders,
      'A caller passing Infinity or null re-opens the unbounded sweep whatever the default is.\n  '
      + offenders.join('\n  ')).toEqual([]);
  });

  it('DSC-03: a large bucket is read at BOTH ends — dropping the head saves nothing and loses channels', () => {
    expect(LANE, 'both windows must be merged for a bucket that outgrew one page')
      .toMatch(/for \(const post of \[\.\.\.tail\.posts, \.\.\.posts\]\)/);
    expect(LANE, 'and the tail must still be read to reach the newest announcements')
      .toMatch(/entry_count > 96n[\s\S]{0,300}entryCount:/);
  });
});
