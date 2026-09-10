import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CUTOVER_EPOCH, WRITES_GENERATION, currentEpochUtc,
  generationForEpochAt, generationForEpoch, cutoverUpdateRequiredAt, cutoverUpdateRequired,
  generationsForEraAt, generationsForEra, generationForUnixSeconds,
} from '../web/cutover-epoch.mjs';
import { laneCodeBoc, hasLaneCode } from '../web/shard-address.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE CUTOVER BOUNDARY [contracts18/docs/CUTOVER.md items 6 and 7]. The plan says "an epoch boundary baked into
// both client versions"; web/cutover-epoch.mjs is that constant's single home, and this file holds it to three
// properties at once:
//   (1) the pure boundary arithmetic is right (every epoch before E is 17, from E on is 18, no boundary = 17);
//   (2) the SHIPPED literals keep the gate dormant — CUTOVER_EPOCH null means today's behavior, bit for bit;
//   (3) the wiring exists at the three places the ruling names — the wallet send funnel refuses, the intro
//       sweep does not arm, and the update screen is in the shell — so the boundary release only ever has to
//       replace one null with a number.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

/** One whole function, sliced by BRACE BALANCE. A fixed-length window over source rots as the prose grows. */
function functionBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  expect(start, `${signature} must still be there`).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced braces after ${signature}`);
}

describe('CUTOVER-EPOCH', () => {
  it('CUTEPOCH-01: the boundary arithmetic — before E is 17, from E on is 18, no boundary is 17 forever', () => {
    const E = 20_800;
    expect(generationForEpochAt(E - 1, E)).toBe(17);
    expect(generationForEpochAt(E, E)).toBe(18);
    expect(generationForEpochAt(E + 365, E)).toBe(18);
    expect(generationForEpochAt(0, E)).toBe(17);
    // No boundary announced: the world is clean-17 at ANY epoch — this is what ships.
    expect(generationForEpochAt(E, null)).toBe(17);
    expect(generationForEpochAt(1_000_000, null)).toBe(17);
    // The epoch is the conversation-day epoch every lane uses: floor(unixSeconds / 86400), UTC.
    expect(currentEpochUtc(0)).toBe(0);
    expect(currentEpochUtc(86_400_000)).toBe(1);
    expect(currentEpochUtc(86_399_999)).toBe(0);
  });

  it('CUTEPOCH-02: the update gate blocks exactly a build whose writes are older than the epoch demands', () => {
    const E = 20_800;
    const msAt = (epoch: number) => epoch * 86_400_000;
    // A clean-17 build (the boundary release): free before E, blocked from the first millisecond of E.
    expect(cutoverUpdateRequiredAt(msAt(E) - 1, E, 17)).toBe(false);
    expect(cutoverUpdateRequiredAt(msAt(E), E, 17)).toBe(true);
    expect(cutoverUpdateRequiredAt(msAt(E + 30), E, 17)).toBe(true);
    // The flip build (writes 18): never blocked — before E it writes 17 by generationForEpoch, from E it writes 18.
    expect(cutoverUpdateRequiredAt(msAt(E) - 1, E, 18)).toBe(false);
    expect(cutoverUpdateRequiredAt(msAt(E), E, 18)).toBe(false);
    // No boundary: nothing is ever blocked.
    expect(cutoverUpdateRequiredAt(msAt(E), null, 17)).toBe(false);
  });

  it('CUTEPOCH-03: the SHIPPED literals keep the gate dormant — null boundary, generation 17, nothing blocked', () => {
    // This is the assertion the boundary release will deliberately break in ONE place: it bakes E and this
    // expectation moves with it. Until then a non-null value here is an accidental early flip — the exact
    // install-time switch the register exists to prevent.
    expect(CUTOVER_EPOCH).toBeNull();
    expect(WRITES_GENERATION).toBe(17);
    expect(generationForEpoch(currentEpochUtc())).toBe(17);
    expect(cutoverUpdateRequired()).toBe(false);
  });

  it('CUTEPOCH-05: an era maps to its generations — one for a clean era, both for the straddling one', () => {
    // The REAL era lengths (web/shard-discovery.mjs): 2,592,000 s (30 days, CHANNEL/THREAD) and 31,536,000 s
    // (1 year, BEACON/AVATAR). Unlike the daily epochs, E almost never sits on an era boundary, so exactly one
    // era per kind straddles it and must be read in BOTH generations.
    const E = 20_800;                                   // boundarySec = 1,797,120,000
    const SHORT = 2_592_000;
    const straddle = Math.floor((E * 86_400) / SHORT);  // era 693: [1,796,256,000 .. 1,798,848,000) contains E
    // A BOUNDARY THAT IS NOT A REAL EPOCH MEANS "NO BOUNDARY" ON THIS SIDE TOO [audit 2026-09-02]. The epoch
    // form was hardened against this in round 14; the era form was not, and tested `boundary === null` alone.
    // MEASURED before the fix: 0, false, '' and -1 each returned [18] — every era pointing at a generation whose
    // shards do not exist, which is an EMPTY PUBLIC FEED network-wide — while NaN and undefined returned
    // [17, 18] and doubled every read address. The flip release bakes a number into this constant.
    for (const notABoundary of [null, 0, false, '', NaN, undefined, -1] as unknown[]) {
      expect(generationsForEraAt(SHORT, 0, notABoundary as number),
        `a boundary of ${String(notABoundary)} must mean "no boundary", not "everything is clean-18"`)
        .toEqual([17]);
      expect(generationsForEraAt(SHORT, 99999, notABoundary as number)).toEqual([17]);
    }
    expect(generationsForEraAt(SHORT, straddle - 1, E)).toEqual([17]);
    expect(generationsForEraAt(SHORT, straddle, E)).toEqual([17, 18]);
    expect(generationsForEraAt(SHORT, straddle + 1, E)).toEqual([18]);
    // A boundary that DOES land on an era edge yields clean single-generation eras on both sides.
    const alignedE = (694 * SHORT) / 86_400;            // exactly era 694's start (an integer epoch: 20,820)
    expect(Number.isInteger(alignedE)).toBe(true);
    expect(generationsForEraAt(SHORT, 693, alignedE)).toEqual([17]);
    expect(generationsForEraAt(SHORT, 694, alignedE)).toEqual([18]);
    // The year-long eras behave identically at their scale.
    const LONG = 31_536_000;
    const longStraddle = Math.floor((E * 86_400) / LONG);
    expect(generationsForEraAt(LONG, longStraddle, E)).toEqual([17, 18]);
    expect(generationsForEraAt(LONG, longStraddle - 1, E)).toEqual([17]);
    // No boundary: every era is clean-17 — what ships.
    expect(generationsForEraAt(SHORT, straddle, null)).toEqual([17]);
    expect(generationsForEra(SHORT, straddle), 'the BAKED wrapper must be dormant').toEqual([17]);
  });

  it('CUTEPOCH-06: the generation seam serves 17 today and REFUSES 18 by name — never a plausible wrong address', () => {
    // A stale or missing code cell derives a well-formed address nobody occupies, and under lazy deploy a
    // message there succeeds with compute skipped — the silent loss the whole address module exists to refuse.
    // So until the seal ships web/shard-code-18.mjs, asking for generation 18 must THROW, loudly and by name.
    // KEY IS IN THIS LIST NOW [audit 2026-09-02]. KeyShard's code sat outside the generation map on the written
    // claim that it was byte-identical across the flip; the owner's decision to redeploy it made that false, and
    // what was left was the SILENT shape rather than the loud one - past the boundary the derivation still
    // ANSWERED, with the clean-17 cell. The three lanes were protected by this refusal all along.
    for (const lane of ['record', 'intro', 'public', 'key']) {
      expect(typeof laneCodeBoc(lane, 17), `${lane} @17 must serve the clean-17 cell`).toBe('string');
      expect(() => laneCodeBoc(lane, 18), `${lane} @18 must refuse until the seal`)
        .toThrow(/shard-code-18|CUTOVER\.md item 2/);
    }
    // And the epoch-keyed derivations really route through the boundary: EPOCH OWNS THE GENERATION, so the
    // intro sweep and the CONV restore walk became dual-read-correct with no caller changes.
    const addr = readFileSync('web/shard-address.mjs', 'utf8');
    expect(addr).toMatch(/introShardAddressBytesFor\(generationForEpoch\(Number\(epoch\)\), epoch, bucket\)/);
    expect(addr).toMatch(/recordShardAddressBytesFor\(generationForEpoch\(Number\(epoch\)\), writePublicKey, epoch\)/);
    expect(addr).toMatch(/introShardStateInitFor\(generationForEpoch\(Number\(epoch\)\), epoch, bucket\)/);
    expect(addr).toMatch(/recordShardStateInitFor\(generationForEpoch\(Number\(epoch\)\), writePublicKey, epoch\)/);
  });

  it('CUTEPOCH-07: the PUBLIC lane is threaded — writes ask the clock, reads expand eras, all dormant today', () => {
    // The seconds variant of the epoch rule (what the writer and the room probe ask); dormant = 17 at any instant.
    expect(generationForUnixSeconds(0)).toBe(17);
    expect(generationForUnixSeconds(20_800 * 86_400 + 5)).toBe(17);
    // The WRITER derives by write-time generation for both the address and the StateInit it attaches — a pair
    // that disagreed would create one account and fund another (the H1 lazy-deploy trap).
    const pub = readFileSync('web/public-publish-browser.mjs', 'utf8');
    expect(pub).toMatch(/publicShardAddressBytesFor\(generation, partitionKey, epochTag\)/);
    expect(pub).toMatch(/publicShardStateInitFor\(generation, partitionKey, epochTag\)/);
    // ONE CLOCK [audit 2026-08-31, round 5]. The builder must take the write instant from the caller and NEVER
    // read one of its own: the caller derives epochTag from its instant, and two reads with an RPC between them
    // can straddle a boundary midnight — writing to (generation 18, the era ENDING at E), which every reader of
    // that era resolves to [17] alone. Silent, permanent loss with the wallet reporting success.
    // The DERIVATION moved to the boundary-injected core so the public lane's flip can be rehearsed the way
    // the CONV twin's already could [2026-09-02] — `boundary` defaults to the baked CUTOVER_EPOCH, so the
    // shipped answer is unchanged. What this pins is unchanged too: the generation comes from the WRITE
    // INSTANT the caller handed in, and from nothing else.
    expect(pub).toContain('generationForEpochAt(Math.floor(writeUnix / 86400), boundary)');
    // Comments stripped first — the note explaining the trap NAMES Date.now, and a gate that reads prose as
    // code fires on its own documentation (the third time this bit today: EXIT-CODE-UNIQUE and the ceremony's
    // tact.config check both learned it).
    const pubCode = pub.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    expect(pubCode.slice(pubCode.indexOf('export async function buildPublicPublishBrowser')),
      'the builder may not read a clock of its own').not.toMatch(/Date\.now\(\)/);
    // And every caller threads it: the five publish sites in app.js plus the two send wrappers.
    const send = readFileSync('web/public-lane-send.mjs', 'utf8');
    expect(send.match(/nowUnix/g)?.length ?? 0, 'the send wrapper forwards the instant').toBeGreaterThanOrEqual(3);
    const appCode = readFileSync('web/app.js', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    expect(appCode.match(/nowUnix[,:]/g)?.length ?? 0,
      'post, comment, profile(x2) and avatar parts carry it').toBeGreaterThanOrEqual(5);
    // COUNTING IS NOT ENOUGH [round 6]: `nowUnix: Math.floor(Date.now / 1000)` at a publish site keeps the
    // count and fully restores the two-clock straddle loss, because the era came from an EARLIER read. The
    // instant must be a VARIABLE the caller already derived its epochTag from — never a fresh clock read here.
    expect(appCode, 'a publish site may not read its own clock into nowUnix')
      .not.toMatch(/nowUnix:\s*(?:Math\.floor\()?\s*Date\.now\(\)/);
    // The guard itself must BITE, and behaviourally — not merely exist in the source [round 6]. Deleting the
    // throw used to leave every assertion above green, and the fallback is not benign: a missing instant makes
    // `Number(undefined)` NaN, `Math.floor(NaN/86400)` NaN, and `NaN < E` is FALSE — so the derivation resolves
    // to generation EIGHTEEN, silently addressing a post-flip shard even before the boundary. MEASURED.
    expect(generationForEpochAt(Math.floor(Number(undefined) / 86_400), 20_500),
      'a missing instant resolves to 18 — which is why the guard may never be optional').toBe(18);
    // Every public-lane read site is era-expanded (posts window, latest-post card, post-at, thread comments),
    // the beacon room probe follows the WRITE generation, and no plain single-generation derivation remains.
    const lane = readFileSync('web/public-lane.mjs', 'utf8');
    expect(lane.match(/publicEraGenerations\(/g)?.length ?? 0,
      'the four era-expanded read sites').toBeGreaterThanOrEqual(4);
    expect(lane).toContain('generationForUnixSeconds(probeUnix)');
    expect(lane).not.toMatch(/publicShardAddressBytes\(/);
    // The three discovery sweeps (beacon directory, channel scan, avatar — the 3-year read) expand per era.
    const disco = readFileSync('web/shard-discovery.mjs', 'utf8');
    expect(disco.match(/publicEraGenerations\(PS_KIND\./g)?.length,
      'beacon + channel + avatar sweeps').toBe(3);
    expect(disco).not.toMatch(/publicShardAddressBytes\(/);
  });

  it('CUTEPOCH-08: a post identity NAMES its generation — the straddle-era twins are two posts, not one', async () => {
    // [audit 2026-08-31, round 5] The flip gave a shard address a generation dimension. In the era that straddles
    // the boundary the gen-17 and gen-18 CHANNEL shards of one channel share an epoch_tag AND a seq, and BOTH
    // number their entries from 0 — so every identity folded from (epoch_tag, seq, entry_id) alone stopped naming
    // one entry. Two faces, both measured before the fix: the FEED id merged two distinct posts into one record
    // (`upsertPublicChainPosts` keys by entryId), and `post_uid` gave them ONE comment thread.
    const { publicPostUid, publicChannelPartitionKey, publicEpochTag } = await import('../web/shard-discovery.mjs');
    const pk = await publicChannelPartitionKey(12345n, 0);
    const tag = publicEpochTag(0, 693);

    // post_uid: generation 17 is EXACTLY what it always was (every existing thread keeps its address), and 18 is
    // a different thread. The default must equal the explicit 17, or legacy posts would silently move.
    const legacy = await publicPostUid(pk, tag, 0n);
    expect(await publicPostUid(pk, tag, 0n, 17), 'generation 17 must be the historic derivation, unchanged')
      .toBe(legacy);
    expect(await publicPostUid(pk, tag, 0n, 18), 'generation 18 must fold to a DIFFERENT thread')
      .not.toBe(legacy);

    // The feed id: three parts stay three parts for 17 (every stored id, share block and permalink in the wild
    // keeps its meaning); 18 appends a fourth. The construction lives in app.js, so pin it at the source.
    const app = readFileSync('web/app.js', 'utf8');
    expect(app).toContain('const postGeneration = Number(sp.generation ?? 17);');
    expect(app).toMatch(/postGeneration === 17\s*\n\s*\?\s*`\$\{sp\.channelEpochTag\}\.\$\{sp\.channelShardSeq \?\? 0\}\.\$\{shardEntryId\}`/);
    expect(app).toMatch(/:\s*`\$\{sp\.channelEpochTag\}\.\$\{sp\.channelShardSeq \?\? 0\}\.\$\{shardEntryId\}\.\$\{postGeneration\}`/);
    // …and the coordinate that rides it: the lane stamps the generation onto every post it hands over, or the
    // id could not carry what the reader never learned.
    const lane = readFileSync('web/public-lane.mjs', 'utf8');
    expect(lane.match(/generation: coord\.generation/g)?.length ?? 0,
      'the sweep and the latest-post read both stamp it').toBeGreaterThanOrEqual(2);
    expect(lane).toContain('coords.push({ address, epochTag, seq, generation });');

    // readPostAt must GATHER both candidates, never stop at the first non-empty one: a SHARE selects by body
    // hash (the wrong generation's post fails it and rendered nothing) and a PERMALINK selects by entry id
    // (which MATCHED across generations, rendering someone else's post under the link).
    const readPostAt = lane.slice(lane.indexOf('async readPostAt('), lane.indexOf('async readThreadComments('));
    expect(readPostAt, 'every candidate is read into one list').toContain('out.push({ ...post');
    expect(readPostAt, 'and none short-circuits on the first hit').not.toMatch(/if \(posts\.length > 0\) \{\s*\n\s*return/);
  });

  it('CUTEPOCH-07B: the write instant is REQUIRED at runtime, and readPostAt gathers every candidate', async () => {
    // [round 6] Both properties were pinned only as source TEXT, and both pins missed the subtle regression that
    // restores the defect: deleting the guard, or re-adding a `break` under different wording. Assert the
    // BEHAVIOUR instead — this is what a future edit actually has to keep true.
    const { buildPublicPublishBrowser } = await import('../web/public-publish-browser.mjs');
    const args = { kind: 0, keyArg: 0n, header: {}, body: {}, value: 1n, partitionKey: 1n, epochTag: 1n };
    await expect(buildPublicPublishBrowser(args), 'no instant, no publish')
      .rejects.toThrow(/nowUnix/);
    await expect(buildPublicPublishBrowser({ ...args, nowUnix: Number.NaN }), 'and NaN is not an instant')
      .rejects.toThrow(/nowUnix/);
    // readPostAt must accumulate: an early exit is what made a SHARE render nothing and a PERMALINK render
    // someone else's post. Pinned structurally over the CANDIDATE LOOP, not against one phrasing of the bug.
    const lane = readFileSync('web/public-lane.mjs', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    const body = lane.slice(lane.indexOf('async readPostAt('), lane.indexOf('async readThreadComments('));
    expect(body, 'every candidate generation is read into one list').toContain('out.push({ ...post');
    // The loop's own text, from its header to the `return out;` that closes the function: no `break` and no
    // `return` may appear inside it. Sliced rather than pattern-matched, so no rewording of the defect can slip
    // past — the round-5 pin named ONE phrasing and a differently-worded early exit went straight through it.
    const loopStart = body.indexOf('for (const gen of candidates)');
    const loopEnd = body.lastIndexOf('return out;');
    expect(loopStart, 'the candidate loop must still be there').toBeGreaterThan(-1);
    expect(loopEnd, 'and it must end at the single accumulated return').toBeGreaterThan(loopStart);
    const loopBody = body.slice(loopStart, loopEnd);
    expect(loopBody, 'no early exit: a break here is the SHARE-renders-nothing / PERMALINK-shows-the-wrong-post bug')
      .not.toMatch(/\bbreak\b/);
    expect(loopBody, 'and no early return either').not.toMatch(/\breturn\b/);
  });

  it('CUTEPOCH-09: with E baked and no gen-18 cell, reads stay READABLE — the boundary release does not go dark', () => {
    // [audit 2026-08-31, round 5 — the composition every isolated test missed.] The BOUNDARY release bakes
    // CUTOVER_EPOCH = E while still shipping as a clean-17 client with NO gen-18 cell (that arrives with the flip
    // release). PUBLIC eras are 30 days and a YEAR, so the era CONTAINING E straddles it for up to a year BEFORE
    // E — and the update gate is driven by the DAILY epoch, so it is still false and the app reports itself
    // healthy. MEASURED before the fix: the expansion handed generation 18 to the sweeps and the derivation threw,
    // taking every avatar, the whole Discover directory, the feed and every comment thread down for weeks to a
    // year, with every test green.
    const E = 20_500;
    const YEAR_ERA = 31_536_000;
    const tenDaysBeforeE = E * 86_400 - 10 * 86_400;
    const era = Math.floor(tenDaysBeforeE / YEAR_ERA);
    // The gate is dormant: the app believes it is fine…
    expect(cutoverUpdateRequiredAt(tenDaysBeforeE * 1000, E, 17)).toBe(false);
    // …the CHAIN truth is that the era straddles…
    expect(generationsForEraAt(YEAR_ERA, era, E)).toEqual([17, 18]);
    // …but a build may only read what it can address, and this one carries no gen-18 cell.
    expect(hasLaneCode('public', 17)).toBe(true);
    expect(hasLaneCode('public', 18)).toBe(false);
    expect(generationsForEraAt(YEAR_ERA, era, E).filter((g) => hasLaneCode('public', g)),
      'the read must fall back to what this build carries, not throw').toEqual([17]);
    // And the wiring really applies that filter — the arithmetic above is only the truth about the chain.
    const disco = readFileSync('web/shard-discovery.mjs', 'utf8');
    expect(disco).toMatch(/publicEraGenerations = \(kind, era\) => generationsForEra\(publicEraLengthOf\(kind\), era\)\s*\n\s*\.filter\(\(generation\) => hasLaneCode\('public', generation\)\)/);
    // The INTRO twin: the sweep looks one epoch AHEAD, so on day E-1 it reaches E itself — generation 18,
    // uncarried. It must SKIP that epoch, not reject the whole pass (the throw sits outside the per-bucket guard).
    expect(readFileSync('web/intro-receive.mjs', 'utf8'))
      .toContain("if (!epochIsDerivable('intro', epoch)) continue;");
    // WRITES still refuse loudly — a write that cannot be addressed must never be redirected to the other
    // generation's live account.
    expect(() => laneCodeBoc('public', 18)).toThrow(/generation 18/);
  });

  it('CUTEPOCH-13: a build that WRITES a generation must have a CONV door that exists in it', () => {
    // MEASURED 2026-09-02, and it is the flip's largest trap. clean-17's RecordShard opens
    // `receive(msg: CapsulePublish)` — the direct door every CONV message uses today. clean-18's RecordShard does
    // NOT: its only publish door is `VaultPublish`, arriving from the payer's own FeeVault (gate 13670 checks the
    // sender IS that vault). A clean-17-shaped CapsulePublish sent to a clean-18 shard was driven in a sandbox
    // against the compiled contract: exit 130, aborted, the shard's balance unmoved. Not "more expensive" —
    // private messaging would stop entirely, on the one day nobody can roll back.
    //
    // THE DOORS ARE READ FROM THE CONTRACTS, never from this file's memory of them, so the day a generation opens
    // or closes a door this gate follows without being edited. What it holds is the pairing: whichever door the
    // written generation offers is the one the client's CONV send must build.
    const dir = WRITES_GENERATION === 17 ? 'contracts' : 'contracts18/contracts';
    const shard = readFileSync(`${dir}/RecordShard.tact`, 'utf8');
    const directDoor = /receive\(msg: CapsulePublish\)/.test(shard);
    const vaultDoor = /receive\(msg: VaultPublish\)/.test(shard);
    expect(directDoor || vaultDoor, `${dir}/RecordShard.tact opens no publish door at all`).toBe(true);

    const send = readFileSync('web/conv-lane-send.mjs', 'utf8');
    const publish = readFileSync('web/conv-publish-browser.mjs', 'utf8');
    const clientBuildsDirect = /CAPSULE_PUBLISH_OPCODE/.test(publish);
    const clientUsesVault = /fee-vault\.mjs/.test(send.replace(/\/\/.*$/gm, ''));

    if (!directDoor) {
      expect(clientUsesVault, `generation ${WRITES_GENERATION} closed the DIRECT CONV door — RecordShard there `
        + 'accepts only VaultPublish, and gate 13670 requires the payer OWN FeeVault as the sender. '
        + 'web/conv-lane-send.mjs must route through web/fee-vault.mjs (buildVaultInternalPublishMessage), and '
        + 'the flip release must ship the FeeVault code cell so the vault address can be derived. Until both, a '
        + 'CONV publish from this build is refused at exit 130 and private messaging is dead.')
        .toBe(true);
    } else {
      // Today: the direct door exists and the client uses it. Pinned so the door cannot quietly stop being used
      // either — a client that stopped building CapsulePublish while the generation still offers it would be
      // paying the vault's transport share for nothing.
      expect(clientBuildsDirect, 'the direct door is open in this generation and the client must use it').toBe(true);
    }
  });

  it('CUTEPOCH-10: a build that WRITES a generation must be able to READ every lane in it', () => {
    // [audit 2026-08-31, round 6] Round 5's cell-aware filter fixed the boundary release going dark, but it
    // converted a LOUD throw into a SILENT empty read — and nothing bound the two halves of the release shape
    // together. MEASURED: a flip release that shipped RecordShard+IntroShard 18 but forgot PublicShard reports
    // `cutoverUpdateRequired === false` (the app calls itself healthy), `publicEraGenerations` returns [], and
    // every sweep emits ZERO addresses — an empty feed and an empty Discover with no error anywhere.
    // This is the invariant that makes the silence impossible: if this build writes generation G, it carries a
    // cell for G on ALL THREE lanes. Today WRITES_GENERATION is 17 and the assertion is trivially satisfied; the
    // flip release flips it to 18 in the same commit that adds shard-code-18.mjs, and this gate is what refuses
    // to let those two land apart.
    for (const lane of ['record', 'intro', 'public', 'key']) {
      expect(hasLaneCode(lane, WRITES_GENERATION),
        `this build writes generation ${WRITES_GENERATION} but carries no ${lane} cell for it — the flip release `
        + 'must ship web/shard-code-18.mjs and WRITES_GENERATION = 18 together, or reads go silently empty')
        .toBe(true);
    }
    // And a boundary is only meaningful if the generation it names is one this build can write.
    if (CUTOVER_EPOCH !== null) {
      expect(generationForEpochAt(CUTOVER_EPOCH, CUTOVER_EPOCH), 'E itself belongs to the new generation').toBe(18);
    }
  });

  it('CUTEPOCH-11: PERSISTED marks carry their generation — a ledger outlives the build that wrote it', async () => {
    // [audit 2026-08-31, round 6] Within one build an epoch owns exactly one generation, so an epoch-keyed mark
    // is unambiguous — and that is exactly why this class hid. These marks are DURABLE: a device scans epochs
    // past E on a boundary-less build (everything is generation 17 there), then updates to a build where those
    // epochs are generation 18, whose shards it has never read. Both marks then lie about work never done.
    const { deliveryKey } = await import('../web/intro-cursor-store.mjs');
    // The INTRO delivered ledger: generation 17 keeps its exact historic key, so nothing already on a device is
    // re-delivered; a later generation appends, so its entry k cannot be mistaken for gen-17's entry k — a
    // genuine first contact silently skipped, which the lane's own header calls the failure it cannot afford.
    expect(deliveryKey({ epoch: 20_800, bucket: 0, entryId: 3 }),
      'dormant, this is byte-for-byte the key it has always been').toBe('20800:0:3');
    // AND THE OTHER ARM, DRIVEN [round 14]. This used to be two toContain assertions over the source —
    // a gate that pins a LINE and not a behaviour, which is the very failure this block's own note below
    // records (a field asserted by grep and dropped one module downstream). CUTOVER_EPOCH is null, so the
    // generation-18 arm was unreachable until deliveryKey gained the same `boundary` seam its two siblings
    // have. On flip day this line decides whether a first contact already shown is shown again, or a new
    // one is skipped as already delivered.
    expect(deliveryKey({ epoch: 20_800, bucket: 0, entryId: 3, boundary: 20_800 }),
      'past the boundary the key appends the generation, so a gen-18 entry k cannot be mistaken for a gen-17 one')
      .toBe('20800:0:3:18');
    expect(deliveryKey({ epoch: 20_799, bucket: 0, entryId: 3, boundary: 20_800 }),
      'and an epoch below the boundary keeps the historic key, so nothing on a device is re-delivered')
      .toBe('20799:0:3');
    expect(deliveryKey({ epoch: 20_800, bucket: 0, entryId: 3, boundary: 0 }),
      'a boundary that is not a real epoch means NO boundary — the safe direction, gen-17')
      .toBe('20800:0:3');
    // The CONV scan cursor: DRIVEN THROUGH A REAL PERSIST ROUND TRIP, not grepped [round 7]. The round-6 version
    // of this assertion pinned the source LINE that writes the field — and the field was silently dropped one
    // module downstream by conv-key-persist's strict whitelist, so the fix was inert in production while this
    // gate stayed green. A mark that must survive a build change has to be proven to survive a WRITE and a LOAD;
    // nothing less tests the thing it exists for.
    const { serializeConvKeyMap, deserializeConvKeyMap } = await import('../web/conv-key-persist.mjs');
    const record = {
      kRootCurrent: new Uint8Array(32).fill(1), kRootsForRead: [], peerKeyId: new Uint8Array(32).fill(2),
      peerEncPublicKey: null, peerWallet: null, adoptedCreatedAt: 5,
      adoptedIntroNonce: new Uint8Array(16).fill(3), outgoingSeq: {},
      lastScannedEpoch: 20_800, lastScannedGeneration: 17,
    };
    const reloaded = deserializeConvKeyMap(serializeConvKeyMap(new Map([['c1', record]]))).get('c1');
    expect(reloaded.lastScannedEpoch, 'the epoch survives, as it always did').toBe(20_800);
    expect(reloaded.lastScannedGeneration,
      'and so must the generation it was earned in — dropped here, the stale-cursor rewind can never fire')
      .toBe(17);
    // A record written before this field existed loads as null, which the consumer treats as "names no
    // generation" — it must not rewind on a guess.
    const legacy = { ...record };
    delete legacy.lastScannedGeneration;
    expect(deserializeConvKeyMap(serializeConvKeyMap(new Map([['c0', legacy]]))).get('c0').lastScannedGeneration,
      'a pre-round-7 record is null, not undefined and not a guess').toBeNull();
    // The STORE stamps it — driven, not grepped — and re-stamps even when the epoch does not advance. That
    // second half matters on the busiest day of the migration: the stamp used to live inside the advance guard,
    // so a cursor rewound to E and caught up on the SAME calendar day could never record what it had covered,
    // and every sync tick rewound it again until UTC midnight.
    const { createConvKeyStore } = await import('../web/conv-key-store.mjs');
    const convStore = createConvKeyStore({});
    const selfKeyId = new Uint8Array(32).fill(7);
    const peerKeyId = new Uint8Array(32).fill(8);
    await convStore.upsertConversationKRoot(selfKeyId, peerKeyId, {
      kRoot: new Uint8Array(32).fill(9), peerEncPublicKey: null, peerWallet: null,
      createdAt: 1, introNonce: new Uint8Array(16).fill(4),
    });
    await convStore.advanceConvScanCursor(selfKeyId, peerKeyId, 20_800);
    const afterFirst = await convStore.getConversation(selfKeyId, peerKeyId);
    expect(afterFirst.lastScannedEpoch).toBe(20_800);
    expect(afterFirst.lastScannedGeneration, 'the advance stamps the generation it covered').toBe(17);
    // Re-advancing to the SAME epoch must leave the stamp set (it is what stops the rewind from re-firing).
    afterFirst.lastScannedGeneration = null;
    await convStore.advanceConvScanCursor(selfKeyId, peerKeyId, 20_800);
    expect((await convStore.getConversation(selfKeyId, peerKeyId)).lastScannedGeneration,
      're-stamping must not require the epoch to advance').toBe(17);
    const app = readFileSync('web/app.js', 'utf8');
    expect(app).toContain('scannedGeneration !== generationForEpoch(Number(record.lastScannedEpoch))');
    expect(app).toContain('Math.min(Number(record.lastScannedEpoch), CUTOVER_EPOCH)');
  });

  it('CUTEPOCH-04: the wiring exists at the three places the ruling names, and the screen speaks i18n', () => {
    // (a) The ONE send funnel refuses past the boundary — every chain write passes through it, so no lane can
    //     forget the check (the same argument that put the send lock there).
    const wallet = readFileSync('web/platho-wallet.mjs', 'utf8');
    expect(wallet).toContain("import { cutoverUpdateRequired } from './cutover-epoch.mjs");
    const funnel = wallet.slice(wallet.indexOf('export async function sendPlathoWalletTransaction'));
    expect(funnel.slice(0, 2200), 'the funnel must check the gate before entering the lane')
      .toContain('cutoverUpdateRequired()');
    expect(funnel.slice(0, 2200), 'and refuse with a machine-readable code')
      .toContain("error.code = 'CUTOVER_UPDATE_REQUIRED'");
    // The idempotent re-broadcast exception must stay: bytes signed before the boundary re-send unchanged.
    expect(funnel.slice(0, 2200)).toContain('options.seqno === undefined && cutoverUpdateRequired()');

    // (b) The intro sweep does not arm past the boundary — 10,240 reads a pass against an inbox that can only
    //     be empty (the scan half of the item 7 ruling).
    const app = readFileSync('web/app.js', 'utf8');
    const arm = app.slice(app.indexOf('async function armIntroReceiveLane'));
    expect(arm.slice(0, 600)).toContain('if (cutoverUpdateRequired()) return;');

    // (c) The gate refresher runs at load and on a minute tick (the epoch flips at UTC midnight and an app
    //     left open must block AT the flip), shows the screen, and stops a running sweep.
    // THE WHOLE FUNCTION, BY BRACE BALANCE — never a fixed-length window. A length slice over prose rots the
    // moment the explanation grows, and this one rotted TWICE: once when round 7 added the inert/focus handling
    // and again when round 8 made the gate reversible. Balance cannot rot [the fixed-length-slice lesson].
    const gate = functionBody(app, 'function refreshCutoverGate');
    expect(gate).toContain('stopIntroReceiveLane()');
    expect(gate).toContain("getElementById('cutoverScreen')");
    // The screen must take the app out of reach, not merely cover it: measured with it up, 43 controls behind
    // it stayed focusable and a composer shortcut could still fire a send the screen calls impossible.
    expect(gate).toContain("setAttribute('inert', '')");
    // …and it must come back off. The gate is Date.now-driven on a 60 s tick, so a clock that runs ahead and
    // is then corrected would otherwise leave the shell permanently inert behind a screen the user has already
    // outlived [audit 2026-08-31, round 8].
    expect(gate, 'the gate must be reversible, not a latch').toContain("removeAttribute('inert')");
    expect(gate, 'and the screen must be able to come down again').toContain('screen.hidden = true');
    expect(app).toContain('setInterval(refreshCutoverGate, 60_000)');
    expect(app).toContain("getElementById('cutoverReloadButton')");

    // (d) The screen is in the shell, hidden by default, and every visible string is an i18n key present in
    //     every locale (tests/i18n.test.ts enforces cross-locale parity on the key set).
    const html = readFileSync('web/index.html', 'utf8');
    // Hidden by default, and OUTSIDE.app-shell — the shell sets isolation:isolate, so a screen in it can
    // never out-paint a body-level dialog whatever its z-index says (measured: the external-link dialog took
    // clicks above it). Announced as a modal, because a covered app that a screen reader still walks is not
    // blocked at all.
    expect(html).toContain('aria-describedby="cutoverBody" hidden>');
    expect(html).toContain('role="dialog" aria-modal="true"');
    const shellEnd = html.indexOf('<!-- Telegram Mini App SDK');
    expect(html.indexOf('id="cutoverScreen"'), 'the screen must sit at body level, after the app shell')
      .toBeGreaterThan(html.lastIndexOf('class="boot-screen"'));
    expect(html.indexOf('id="cutoverScreen"')).toBeLessThan(shellEnd);
    expect(html).toContain('data-i18n="cutover.updateRequiredTitle"');
    expect(html).toContain('data-i18n="cutover.updateRequiredBody"');
    expect(html).toContain('data-i18n="cutover.reloadNow"');
    const strings = readFileSync('web/i18n-strings.mjs', 'utf8');
    for (const key of ['cutover.updateRequiredTitle', 'cutover.updateRequiredBody', 'cutover.reloadNow']) {
      expect(strings.split(`"${key}"`).length - 1, `${key} must exist in all 10 locales`).toBe(10);
    }
  });
  it('CUTEPOCH-12: a cursor stamped by the OTHER generation rewinds to the boundary — driven, not read', () => {
    // [audit 2026-08-31, round 8.] CUTEPOCH-11 proves the stamp survives a write and a load; nothing drove what
    // the stamp is FOR. MEASURED: reverting `record.lastScannedGeneration ?? 17` to
    // `generationForEpoch(Number(record.lastScannedEpoch))` — which makes staleCursor false for every legacy
    // record and reinstates round 6's inertness exactly — left all 76 test files that read web/app.js green but
    // for two content-hash baselines. So the arithmetic is lifted out of app.js and RUN here.
    const app = readFileSync('web/app.js', 'utf8');
    // Anchored on the DECLARATION, not on its right-hand side: the whole point is to let the right-hand side
    // change and have the assertions below rule on it.
    const start = app.indexOf('    const scannedGeneration =');
    expect(start, 'the rewind block must still be there').toBeGreaterThan(-1);
    const end = app.indexOf('const windowW = Math.max(', start);
    expect(end, 'and it must still end at the window width').toBeGreaterThan(start);
    const block = app.slice(start, end);

    // eslint-disable-next-line no-new-func
    const plan = new Function('record', 'ctx', `
      const { cold, forceFull, birthEpoch, steadyFrom, epochNow, CUTOVER_EPOCH, generationForEpoch,
        CONV_SCAN_CATCHUP_CAP_EPOCHS } = ctx;
      ${block}
      return { scannedGeneration, staleCursor, cursorFrom, from, scanFrom };
    `);

    const E = 20_800;
    const ctx = {
      cold: false, forceFull: false, birthEpoch: E - 400, steadyFrom: E + 3, epochNow: E + 5,
      CUTOVER_EPOCH: E, CONV_SCAN_CATCHUP_CAP_EPOCHS: 10_000,
      generationForEpoch: (e: number) => (e >= E ? 18 : 17),
    };

    // A LEGACY record — written by a build that had no such field at all. Its absence PROVES generation 17: the
    // shipped prod line carries neither the field nor web/cutover-epoch.mjs. Its epoch sits past E, so the walk
    // it recorded was a 17-build's walk over 18 epochs: it found nothing and must be re-walked from E.
    const legacy: any = plan({ lastScannedEpoch: E + 4 }, ctx);
    expect(legacy.scannedGeneration, 'a missing stamp means 17, not "whatever that epoch is today"').toBe(17);
    expect(legacy.staleCursor, 'a 17-stamped cursor sitting past E is stale').toBe(true);
    expect(legacy.cursorFrom, 'and rewinds to the boundary, never past it').toBe(E);
    expect(legacy.scanFrom).toBe(E);

    // The same cursor, stamped by the generation that owns those epochs: nothing to redo.
    const fresh: any = plan({ lastScannedEpoch: E + 4, lastScannedGeneration: 18 }, ctx);
    expect(fresh.staleCursor).toBe(false);
    expect(fresh.cursorFrom).toBe(E + 4);

    // A cursor entirely BEFORE the boundary is not stale, and must not be dragged forward to E.
    const old: any = plan({ lastScannedEpoch: E - 6, lastScannedGeneration: 17 }, ctx);
    expect(old.staleCursor).toBe(false);
    expect(old.cursorFrom).toBe(E - 6);

    // And with no boundary announced — which is what ships today — the rewind cannot fire at all.
    const dormant: any = plan({ lastScannedEpoch: E + 4 }, {
      ...ctx, CUTOVER_EPOCH: null, generationForEpoch: () => 17,
    });
    expect(dormant.staleCursor).toBe(false);
    expect(dormant.cursorFrom).toBe(E + 4);
  });
});
