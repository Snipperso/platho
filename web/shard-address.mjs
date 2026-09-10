// shard-address — derive clean-17 shard addresses in the BROWSER, with no @ton/core and no build/*.ts.
//
// WHY THIS IS A CORRECTNESS GATE AND NOT PLUMBING. Shards are deployed lazily, so a message sent to a shard
// address that does not yet exist is normal — and TON runs such a message with its COMPUTE PHASE SKIPPED. There
// is no error, no bounce; the wallet reports success and the message is simply gone. A wrong address is therefore
// indistinguishable from a correct one at send time, which makes address derivation the one piece of client code
// that cannot be validated by "it seemed to work".
//
// The live client hand-rolls its TON encoding (web/pwa-contract-transactions.mjs) because @ton/core does not load
// in the browser, and the same applies here. The address is:
//
//   StateInit = [ split_depth:0 | special:0 | code:1 | data:1 | library:0 ] + ^code + ^data      (5 bits, 2 refs)
//   address   = (workchain 0, sha256(StateInit representation))
//
// and the data cell is exactly what Tact's generated wrapper builds: one leading zero bit, then each init argument
// as int257. For the non-negative values these shards use, an int257 is a zero sign bit followed by a 256-bit
// magnitude — which is what lets this be expressed with the unsigned primitives the client already has.
//
// tests/shard-browser-address.test.ts asserts, for many arguments, that every address derived here is IDENTICAL
// to the one @ton/core derives from the compiled wrapper. Two independent implementations agreeing is the only
// evidence worth having, given the failure mode above.

import { beginCell, parseBocBase64, computeCellHashAndDepth } from './pwa-contract-transactions.mjs?v=47';
import {
  RECORDSHARD_CODE_BOC, INTROSHARD_CODE_BOC, RECOVERYSHARD_CODE_BOC, KEYSHARD_CODE_BOC, PUBLICSHARD_CODE_BOC,
} from './shard-code.mjs?v=5';
import { generationForEpoch } from './cutover-epoch.mjs?v=4';

// ── THE GENERATION SEAM [CUTOVER.md items 2 and 3] ──────────────────────────────────────────────────────────
// The three LANE shards' code moves across the clean-17 -> clean-18 flip, so their addresses move with it, and
// a reader must be able to derive BOTH generations for the retention window (a year for CONV/posts, three for
// the avatar bytes). Every derivation below therefore resolves its code cell through this map, keyed by
// generation. RECOVERY/AIRDROP are absent on purpose: their code is byte-identical across generations
// (CUTOVER.md item 0), so they have exactly one address forever.
//
// KEY IS NO LONGER ONE OF THEM [audit 2026-09-02]. The owner's decision to redeploy KeyShard — it registers a key
// bundle with no proof the registrant holds it, which a frozen contract cannot fix — moved its code, and it is in
// this map for the reason the lanes are: so asking for a generation this build cannot supply THROWS instead of
// answering. Before this it took KEYSHARD_CODE_BOC directly, with no generation axis at all, so past the flip it
// would have derived a plausible clean-17 address in silence — no throw, no update screen, identity and avatar
// reads landing on the orphaned shard and a register landing where the new registry does not look. Note the
// SECOND axis it moves on: `profile_registry` is KeyShard's own init argument, and that one self-corrects when
// platho-config points at the new registry.
//
// Generation 18's slots land with the FLIP release: `node scripts/generate_shard_code.mjs --generation 18`
// regenerates web/shard-code-18.mjs from the SEALED contracts18 build (any pre-seal snapshot rots — the code
// hash moved twice on 2026-08-31 alone), the import lands here, and the three entries gain their 18 cells —
// CUTOVER.md items 2 and 4 record that act. Until then asking for 18 THROWS, loudly and by name: deriving a
// plausible address from a wrong or missing cell is exactly the silent-loss failure this module exists to
// refuse.
const LANE_CODE = {
  record: { 17: RECORDSHARD_CODE_BOC },
  intro: { 17: INTROSHARD_CODE_BOC },
  public: { 17: PUBLICSHARD_CODE_BOC },
  key: { 17: KEYSHARD_CODE_BOC },
  // THE VAULT HAS NO GENERATION 17 AND NEVER WILL. FeeVault exists only in clean-18 — clean-17 books fees through
  // FeeAccumulator, which is not the same contract and is not addressed per owner. The empty slot is deliberate:
  // it makes `feeVaultCodeBoc()` throw the SAME tagged refusal every other missing-generation ask throws, so a
  // staking screen or a discounted publish that runs before the seal says "update the app" instead of deriving a
  // plausible address from nothing. FEEVAULT_CODE_BOC_18 lands here with the flip release (CUTOVER.md item 4).
  vault: {},
  report: {},   // ReportShard, clean-18 only, the moderation queue lane (CUTOVER item 15) — lands at the seal
  sanction: {}, // SanctionShard, clean-18 only, a wallet's standing under moderation (CUTOVER item 15) — lands at the seal
};

// Test seam ONLY — the lane suite injects the real clean-18 build cells to prove the ...For derivations against
// @ton/core before the flip release ships them for real. Never called by product code.
//
// KEPT ON globalThis, NOT IN A MODULE-LEVEL Map [audit 2026-09-02]. Every product importer of this file uses the
// cache-busting `?v=N` suffix, and the plain specifier and the suffixed one are DIFFERENT module
// instances — MEASURED: injecting through the plain specifier and reading through the suffixed one returned the
// refusal, not the injected cell. So a Map closed over one instance was invisible to the code under test, which is
// why this seam had never been called by anything in its life. One map, shared by every instance, is what makes it
// usable at all; the key is namespaced so it cannot collide with anything else parked there.
const LANE_CODE_TEST_OVERRIDES = (globalThis.__plathoLaneCodeOverrides
  ??= new Map());
export function __setLaneGenerationCodeForTests(lane, generation, boc) {
  LANE_CODE_TEST_OVERRIDES.set(`${lane}:${generation}`, boc);
}
export function __resetLaneGenerationCodeOverridesForTests() {
  LANE_CODE_TEST_OVERRIDES.clear();
}

/** The code cell for one lane at one generation — or a LOUD refusal naming the missing piece. */
export function laneCodeBoc(lane, generation) {
  const boc = LANE_CODE_TEST_OVERRIDES.get(`${lane}:${generation}`) ?? LANE_CODE[lane]?.[generation];
  if (!boc) {
    const error = new RangeError(`no ${lane} shard code cell for generation ${generation} in this build — the flip `
      + 'release ships web/shard-code-18.mjs, regenerated at the seal (CUTOVER.md item 2)');
    // THE SAME CODE THE SEND FUNNEL RAISES [audit 2026-08-31, round 7]. This throw fires from inside the address
    // DERIVATION, which every lane reaches before the wallet funnel — so in practice it, not the funnel's own
    // refusal, is what a user meets past the boundary. Untagged it reached the composer as a developer sentence
    // naming a source file ("…the flip release ships web/shard-code-18.mjs…") in every locale. The code is what
    // lets the status layer say "update the app" instead, and what keeps the retry classifier from mistaking a
    // permanent refusal for a network blip.
    error.code = 'CUTOVER_UPDATE_REQUIRED';
    throw error;
  }
  return boc;
}

/**
 * CAN THIS BUILD DERIVE THAT GENERATION AT ALL — the question every READ must ask before it expands.
 *
 * [audit 2026-08-31, round 5 — the boundary-release blackout.] The boundary release bakes CUTOVER_EPOCH = E while
 * still being a clean-17 client: it ships NO gen-18 cell (that arrives with the flip release, item 2). But the
 * read-side expansion keys off the boundary ALONE, and a PUBLIC era is 30 days or a YEAR long — so the era
 * CONTAINING E starts straddling it up to a year BEFORE E. MEASURED ten days before E: the era resolves to
 * [17, 18], `cutoverUpdateRequired()` is still false (the gate is driven by the DAILY epoch, so the app reports
 * itself perfectly healthy), and the gen-18 derivation throws — taking every avatar, the whole Discover
 * directory, the channel feed and every comment thread down with it, for weeks to a year, with every test green.
 *
 * The rule this restores: A BUILD MAY ONLY READ GENERATIONS IT CARRIES THE CELLS FOR. It is not a workaround for
 * the missing cell — before the flip there are NO gen-18 shards on chain, so reading gen-17 alone is not a
 * degradation, it is the truth. WRITES keep throwing (laneCodeBoc above): a write it cannot address must never
 * be silently redirected to the other generation's live account.
 */
export function hasLaneCode(lane, generation) {
  return Boolean(LANE_CODE_TEST_OVERRIDES.get(`${lane}:${generation}`) ?? LANE_CODE[lane]?.[generation]);
}

/** The epoch-keyed twin: can this build address that lane's shard for that day-epoch? The CONV and INTRO sweeps
 *  ask this per epoch, because an epoch names exactly one generation (EPOCH OWNS THE GENERATION). On the
 *  boundary release the intro window's look-ahead epoch (C+1) reaches E on day E-1 — gen-18, uncarried, and
 *  without this the whole scan pass would reject and that day's first contacts would never be delivered. */
export function canDeriveForEpoch(lane, epoch) {
  return hasLaneCode(lane, generationForEpoch(Number(epoch)));
}

const CODE_CACHE = new Map();

// ONE hash memo for the whole module, shared across every derivation. computeCellHashAndDepth defaults to a
// FRESH WeakMap per call, so without this each address re-hashed the entire code tree — 17 cells for a CONV
// shard, 37 for a PUBLIC one, and every one of those is an awaited SubtleCrypto digest. The code cell is the
// same object every time (CODE_CACHE hands it back), so memoizing by cell identity collapses that to the two
// hashes a derivation actually needs: the fresh data cell and the fresh StateInit root.
// SAFE because cells are immutable once built — a cached hash can never go stale for a live cell.
// Measured on this machine before the change: 0.38 ms per CONV address, ~3.9 s for a full intro scan sweep
// (1024 buckets x 10 epochs). The scan is the product's recorded ceiling, so this is on the hottest path.
const HASH_MEMO = new WeakMap();

function codeCell(boc) {
  let cell = CODE_CACHE.get(boc);
  if (!cell) { cell = parseBocBase64(boc); CODE_CACHE.set(boc, cell); }
  return cell;
}

/** Tact stores an init argument as int257. Every value these shards take is non-negative, so that is a zero sign
 *  bit and a 256-bit magnitude — reject anything else rather than silently truncating it into a wrong address. */
function storeInt257(builder, value, name) {
  const v = BigInt(value);
  if (v < 0n) throw new RangeError(`${name} must be non-negative for this derivation, got ${v}`);
  if (v >= (1n << 256n)) throw new RangeError(`${name} does not fit int257 magnitude`);
  builder.uint(0, 1, `${name} sign`);
  builder.uint(v, 256, name);
  return builder;
}

/** Tact stores an Address init argument as a standard address slice: addr_std tag 10, anycast 0, workchain int8,
 *  hash 256. KeyShard is the first shard whose init arguments are addresses rather than integers, and getting the
 *  267-bit layout wrong here would produce a plausible-looking address that no contract occupies — the failure the
 *  header of this file is about. Pinned against @ton/core in tests/shard-browser-address.test.ts. */
function storeAddressArg(builder, value, name) {
  const raw = String(value ?? '');
  const match = /^(-?\d+):([0-9a-fA-F]{64})$/.exec(raw.trim());
  if (!match) throw new RangeError(`${name} must be a raw "workchain:hex" address, got ${JSON.stringify(value)}`);
  const workchain = Number(match[1]);
  if (!Number.isInteger(workchain) || workchain < -128 || workchain > 127) {
    throw new RangeError(`${name} workchain ${workchain} does not fit int8`);
  }
  builder.uint(0b100, 3, `${name} addr_std tag + anycast`);
  builder.uint(BigInt(workchain & 0xff), 8, `${name} workchain`);
  builder.uint(BigInt(`0x${match[2]}`), 256, `${name} hash`);
  return builder;
}

function initDataCell(args) {
  const builder = beginCell();
  builder.uint(0, 1, 'tact init prefix');
  for (const [name, value, kind] of args) {
    if (kind === 'address') storeAddressArg(builder, value, name);
    else storeInt257(builder, value, name);
  }
  return builder.endCell();
}

/** The StateInit cell itself — the same one the address hashes. A publish must ATTACH it, because shards are
 *  deployed lazily: without it the first message to a new shard lands on an uninitialised account, runs with its
 *  compute phase skipped, and is lost while the wallet reports success. */
export function shardStateInitCell(codeBoc, args) {
  const state = beginCell();
  state.uint(0, 1, 'split_depth');
  state.uint(0, 1, 'special');
  state.uint(1, 1, 'code present');
  state.uint(1, 1, 'data present');
  state.uint(0, 1, 'library');
  state.ref(codeCell(codeBoc), 'code');
  state.ref(initDataCell(args), 'data');
  return state.endCell();
}

async function addressFor(codeBoc, args) {
  const state = beginCell();
  state.uint(0, 1, 'split_depth');
  state.uint(0, 1, 'special');
  state.uint(1, 1, 'code present');
  state.uint(1, 1, 'data present');
  state.uint(0, 1, 'library');
  state.ref(codeCell(codeBoc), 'code');
  state.ref(initDataCell(args), 'data');
  const { hash } = await computeCellHashAndDepth(state.endCell(), HASH_MEMO);
  return { workchain: 0, hash };
}

// ── EXPLICIT-GENERATION DERIVATIONS — what the dual-read machinery calls ────────────────────────────────────
// The epoch-keyed exports below choose the generation THEMSELVES (the epoch names it: EPOCH OWNS THE
// GENERATION, the item 7 ruling), so every existing caller — the intro sweep, the CONV restore walk, the
// publish paths — became dual-read-correct without changing a line. These ...For forms exist for the readers
// that must ask for a SPECIFIC generation: the PUBLIC era sweeps (an era can straddle E and needs both) and
// the lane tests that prove the 18 derivation against @ton/core before the flip ships it.
// THE TWO HALVES OF A SHARD'S StateInit, SEPARATELY. The direct publish door attaches the whole StateInit cell,
// but clean-18's vault door takes `shard_code` and `shard_data` as two independent Maybe refs — the shard is
// deployed by the VAULT's outgoing message there, not by the wallet's. Same cells, split the way each door asks
// for them, and derived from the same laneCodeBoc so a generation cannot be right in one door and wrong in the
// other. [audit 2026-09-02: clean-18's RecordShard has no direct door at all, so this is the only way CONV is
// published there.]
export const recordShardCodeCellFor = (generation) => codeCell(laneCodeBoc('record', generation));
export const recordShardDataCellFor = (generation, writePublicKey, epoch) =>
  initDataCell([['write_pubkey', writePublicKey], ['epoch', epoch]]);

export const recordShardStateInitFor = (generation, writePublicKey, epoch) =>
  shardStateInitCell(laneCodeBoc('record', generation), [['write_pubkey', writePublicKey], ['epoch', epoch]]);
export const recordShardAddressBytesFor = (generation, writePublicKey, epoch) =>
  addressFor(laneCodeBoc('record', generation), [['write_pubkey', writePublicKey], ['epoch', epoch]]);
export const introShardStateInitFor = (generation, epoch, bucket) =>
  shardStateInitCell(laneCodeBoc('intro', generation), [['epoch', epoch], ['bucket', bucket]]);
export const introShardAddressBytesFor = (generation, epoch, bucket) =>
  addressFor(laneCodeBoc('intro', generation), [['epoch', epoch], ['bucket', bucket]]);

export const introShardStateInit = (epoch, bucket) =>
  introShardStateInitFor(generationForEpoch(Number(epoch)), epoch, bucket);
export const recordShardStateInit = (writePublicKey, epoch) =>
  recordShardStateInitFor(generationForEpoch(Number(epoch)), writePublicKey, epoch);
export const recoveryShardStateInit = (selfBucketKey) =>
  shardStateInitCell(RECOVERYSHARD_CODE_BOC, [['self_bucket_key', selfBucketKey]]);

/** CONV: one conversation-direction for a day. The day's epoch picks the generation. */
export const recordShardAddressBytes = (writePublicKey, epoch) =>
  recordShardAddressBytesFor(generationForEpoch(Number(epoch)), writePublicKey, epoch);

/** INTRO: a sender-chosen bucket for a day — the addresses a recipient scans. The epoch picks the generation,
 *  which is what keeps the sweep at its 10,240 addresses across the flip: each epoch belongs to exactly ONE
 *  generation, so the old-generation tail leaves the scan window by itself ~9 days after E. */
export const introShardAddressBytes = (epoch, bucket) =>
  introShardAddressBytesFor(generationForEpoch(Number(epoch)), epoch, bucket);

/** RECOVERY: the user's own slot, epoch-independent. */
export const recoveryShardAddressBytes = (selfBucketKey) =>
  addressFor(RECOVERYSHARD_CODE_BOC, [['self_bucket_key', selfBucketKey]]);

/**
 * KEY: a wallet's identity — public keys, and since 2026-07-21 the paid avatar pointer that ProfileRegistry used
 * to hold in a map with a 13,076-profile ceiling.
 *
 * The registry address is the SECOND init argument, not a constant in the shard's code, which is what let the
 * registry embed KeyShard's code and derive these addresses itself with no build cycle and no genesis bind. It
 * must therefore be the SAME registry the client reads from: derive against a different one and you get a live,
 * well-formed address that simply holds nothing — the exact silent failure this module exists to prevent.
 *
 * Both arguments are raw `workchain:hex` addresses, the form rawAddress() produces.
 */
export const keyShardAddressBytesFor = (generation, ownerWallet, profileRegistry) =>
  addressFor(laneCodeBoc('key', generation), [['owner_wallet', ownerWallet, 'address'], ['profile_registry', profileRegistry, 'address']]);

export const keyShardStateInitFor = (generation, ownerWallet, profileRegistry) =>
  shardStateInitCell(laneCodeBoc('key', generation), [['owner_wallet', ownerWallet, 'address'], ['profile_registry', profileRegistry, 'address']]);

// The generation defaults to 17, today's live one, so every existing caller keeps today's answer. What changed is
// what happens when someone asks for 18 before this build can supply it: laneCodeBoc throws, tagged, and the
// status layer says "update the app". It used to answer with the clean-17 cell and be quietly wrong.
export const keyShardAddressBytes = (ownerWallet, profileRegistry, generation = 17) =>
  keyShardAddressBytesFor(generation, ownerWallet, profileRegistry);

export const keyShardStateInit = (ownerWallet, profileRegistry, generation = 17) =>
  keyShardStateInitFor(generation, ownerWallet, profileRegistry);

/**
 * PUBLIC: one partition of the public/avatar lane. init(partition_key: Int, epoch_tag: Int) — two int257, the
 * simple integer case like RecordShard. partition_key is a 256-bit domain-separated hash (of the channel wallet,
 * a post_uid, or a beacon bucket — computed in the discovery layer); epoch_tag = (kind << 32) | era_index.
 *
 * The kind lives in epoch_tag, NOT in a separate argument, so this same two-int derivation serves all four kinds
 * (channel/thread/beacon/avatar). A wrong epoch_tag is the silent-loss failure this whole module guards against:
 * it is a live, well-formed address nobody reads, so it is pinned BOTH ways against @ton/core in
 * tests/shard-browser-address.test.ts.
 */
// 🔴 CUTOVER: contracts18/docs/CUTOVER.md items 2 and 3. The generation seam above holds both generations'
// cells (18's slots land at the seal); CONV/INTRO choose per-epoch automatically. PUBLIC is the one lane whose
// partition is an ERA, which can STRADDLE the boundary — so its readers must ask for a specific generation per
// era (generationsForEra in cutover-epoch.mjs expands a straddling era to both). The epoch-tag exports below
// stay single-generation-17 until the PUBLIC read sweeps are threaded (the remaining half of item 3): that
// literal is today's truth — every deployed PublicShard is clean-17 and the funnel gate blocks writes past the
// boundary — and the ...For forms are what the threaded sweeps will call.
export const publicShardAddressBytesFor = (generation, partitionKey, epochTag) =>
  addressFor(laneCodeBoc('public', generation), [['partition_key', partitionKey], ['epoch_tag', epochTag]]);

// The PUBLIC lane's StateInit halves, for the same reason RecordShard has them: clean-18's vault door takes
// `shard_code` and `shard_data` as two independent Maybe refs rather than one StateInit cell, because there the
// shard is deployed by the VAULT's outgoing message and not by the wallet's.
export const publicShardCodeCellFor = (generation) => codeCell(laneCodeBoc('public', generation));
export const publicShardDataCellFor = (partitionKey, epochTag) =>
  initDataCell([['partition_key', partitionKey], ['epoch_tag', epochTag]]);

export const publicShardStateInitFor = (generation, partitionKey, epochTag) =>
  shardStateInitCell(laneCodeBoc('public', generation), [['partition_key', partitionKey], ['epoch_tag', epochTag]]);

export const publicShardAddressBytes = (partitionKey, epochTag) =>
  publicShardAddressBytesFor(17, partitionKey, epochTag);

export const publicShardStateInit = (partitionKey, epochTag) =>
  publicShardStateInitFor(17, partitionKey, epochTag);

/**
 * THE FEE VAULT'S CODE CELL — the one thing the staking screen and the discounted publish cannot derive without.
 *
 * Hash and depth would be enough to compute the address, but not to DEPLOY: a first stake creates the vault, and
 * its StateInit rides the wallet's own message, so the full cell has to be in the browser. Until the seal it is
 * not, and this refuses by name rather than guessing (CUTOVER.md item 4).
 */
// THE REPORT LANE [2026-09-03, CUTOVER item 15]: one ReportShard per (30-day era, bucket of 64), derivable by every
// client from the target it reports. Init arguments are (era, bucket), both plain ints, in that order.
export const reportShardCodeCellFor = (generation) => codeCell(laneCodeBoc('report', generation));
export const reportShardDataCellFor = (era, bucket) => initDataCell([['era', era], ['bucket', bucket]]);
export const reportShardStateInitFor = (generation, era, bucket) =>
  shardStateInitCell(laneCodeBoc('report', generation), [['era', era], ['bucket', bucket]]);
export const reportShardAddressBytesFor = (generation, era, bucket) =>
  addressFor(laneCodeBoc('report', generation), [['era', era], ['bucket', bucket]]);
// THE SANCTION LANE [2026-09-04, CUTOVER item 15]: one SanctionShard per wallet bucket of 64, deployed by the
// ledger's forward, READ by every client for the authors on its screen. Init arguments are (gate: Address,
// bucket: Int) — the gate's address first, as a standard address slice, then the bucket as int257.
export const sanctionShardDataCellFor = (gateAddress, bucket) => initDataCell([['gate', gateAddress, 'address'], ['bucket', bucket]]);
export const sanctionShardAddressBytesFor = (generation, gateAddress, bucket) =>
  addressFor(laneCodeBoc('sanction', generation), [['gate', gateAddress, 'address'], ['bucket', bucket]]);
export function sanctionShardCodeAvailable(generation = 18) {
  try {
    laneCodeBoc('sanction', generation);
    return true;
  } catch {
    return false;
  }
}

export function reportShardCodeAvailable(generation = 18) {
  try {
    laneCodeBoc('report', generation);
    return true;
  } catch (error) {
    if (error?.code === 'CUTOVER_UPDATE_REQUIRED') return false;
    throw error;
  }
}

export const feeVaultCodeBoc = (generation = 18) => laneCodeBoc('vault', generation);

/** Whether this build can talk to a vault at all — the question a screen asks before it offers staking. */
export function feeVaultCodeAvailable(generation = 18) {
  try {
    feeVaultCodeBoc(generation);
    return true;
  } catch (error) {
    // Only the missing-cell refusal answers "not yet"; anything else is a real fault and must not be swallowed
    // into a quiet false [missing-import-dies-inside-a-bare-catch].
    if (error?.code === 'CUTOVER_UPDATE_REQUIRED') return false;
    throw error;
  }
}

/** Raw `workchain:hex` form — what toncenter accepts, and what a test can compare without an Address class. */
export function rawAddress({ workchain, hash }) {
  const hex = Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${workchain}:${hex}`;
}
