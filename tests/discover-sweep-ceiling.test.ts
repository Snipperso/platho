import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// DISCOVER SWEEP CEILING — "Find channels" must cost the same at ten thousand channels and at ten million.
//
// [decided 2026-08-29] The sweep used to ENUMERATE
// the directory: the screen asked for `topBuckets: Infinity` and the lane opened every live bucket, so the cost
// grew linearly with the network. MEASURED against the 30 MiB/day budget this project already uses for a phone,
// one COLD sweep costs 10.6 MiB at 10,000 channels, 89.7 MiB at 91,000 — more than the whole day — and
// gigabytes at millions. Enumeration cannot survive scale however the buckets are arranged; the 192-row read
// window was only the first symptom of it.
//
// This gate is deliberately a SOURCE gate rather than a behavioural one. What it guards is the absence of an
// unbounded read, and the way that regression arrives is a caller writing `Infinity` again, or the default
// quietly going back to null — neither of which any fixture-sized sweep would notice, because a test with two
// buckets reads two buckets whatever the cap says.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

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

    // AND THAT IT IS ACTUALLY APPLIED. Declaring a cap and then ignoring it is the regression this gate could
    // not see: during audit #5 the tree briefly held `const limit = ordered.length;`, the cap defaulted,
    // documented and unused, and all three DSC assertions stayed green while the sweep enumerated the whole
    // directory again. The limit must be derived from topBuckets and the selection must be sliced by it.
    expect(LANE, 'the limit must come from topBuckets, not from the number of live buckets')
      .toMatch(/const limit = [^\n]*topBuckets[^\n]*;/);
    expect(LANE, 'and the bucket set must actually be sliced by that limit')
      .toContain('ordered.slice(0, limit)');
    expect(LANE, 'a limit taken straight from the live set is the cap being ignored')
      .not.toMatch(/const limit = ordered\.length;/);
  });

  it('DSC-02: no caller asks the sweep for an unbounded walk', () => {
    // `topBuckets: Infinity` is what the Discover screen passed until 2026-08-29, and it defeated any default.
    // Comment lines are skipped: the lane's own doc comment names `topBuckets: Infinity` as the deliberate
    // full-walk escape, and a gate that trips on its subject being DESCRIBED is a gate people learn to ignore.
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
    // THIS GATE ASSERTED THE OPPOSITE FOR A FEW HOURS AND WAS WRONG [corrected 2026-08-29]. The claim it pinned
    // — that reading only the newest window is cheaper — does not survive measurement: the head read runs either
    // way, because it is where `entry_count` comes from, so dropping the merge saved NOTHING (identical
    // get_page, /messages and bytes) and lost every channel whose only announcement sits below the newest 96.
    // MEASURED by audit on the same fixture: a bucket holding four quiet channels plus 96 re-saves by one busy
    // wallet yielded 1 channel instead of 5, at byte-identical cost.
    // The reasoning behind the mistake was that a bucket holds one channel's history. It does not: buckets group
    // DIFFERENT channels by walletHash, so the middle of a bucket is other people.
    expect(LANE, 'both windows must be merged for a bucket that outgrew one page')
      .toMatch(/for \(const post of \[\.\.\.tail\.posts, \.\.\.posts\]\)/);
    expect(LANE, 'and the tail must still be read to reach the newest announcements')
      .toMatch(/entry_count > 96n[\s\S]{0,300}entryCount:/);
  });
});
