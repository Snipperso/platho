// public-lane-send — the SEND half of the clean-17 public/avatar lane, wired to the user's wallet.
//
// The read half (public-lane.mjs) turns shards into posts. This turns a composed capsule into a signed, direct-pay
// wallet transaction to the shard that stores it. It is deliberately thin: buildPublicPublishBrowser already builds
// and pins the message (opcode, StateInit, commit) against the contract, and platho-wallet.sendPlathoWalletTransaction
// already signs and broadcasts the v5 external — this module only marries the two and shapes the wallet message.
//
// DIRECT-PAY, no Vault, no CapsuleHub. The clean-15 client sent an EXTERNAL message to the user's Vault, which
// relayed to the Hub; clean-17 sends an INTERNAL message from the user's own wallet straight to the shard, with the
// StateInit attached so the shard deploys lazily on first publish. The wallet is the payer and the sender, so the
// shard's transaction history carries the real publisher — which is exactly what the reader attributes posts by.
//
// FUNDING: always the deploy figure for the kind (see web/publish-price.mjs for why "always the deploy figure" is
// the only rule that needs no chain read and cannot be forged into a refused publish). The shard keeps only what it
// needs and returns the surplus via mode-128, so overpaying an existing shard costs nothing.

import { buildPublicPublishBrowser } from './public-publish-browser.mjs?v=37';
import { buildVaultInternalPublishMessage, vaultInternalPublishValue, publicPublishRoute }
  from './fee-vault.mjs?v=8';
import { publicShardCodeCellFor, publicShardDataCellFor } from './shard-address.mjs?v=29';
import { CUTOVER_EPOCH } from './cutover-epoch.mjs?v=4';
import { serializeBoc, tonCell } from './pwa-contract-transactions.mjs?v=47';
import { sendPlathoWalletTransaction } from './platho-wallet.mjs?v=57';
import { applyShardSurcharge, surchargeExtraNanotons, LANE_PUBLIC } from './shard-debt.mjs?v=12';

/**
 * Shape a PublicPublish as the wallet-message form sendPlathoWalletTransaction consumes:
 *   { address, amount, payload (base64 BoC of the body), stateInit (cell), bounce }.
 * Returns the built message plus the address/value/commit the caller may want for tracking. `value` is the funding
 * the caller decided (the kind's deploy figure); `header`/`body` are the client cells from createPublicPostPayloadV2.
 */
export async function buildPublicPublishWalletMessage({ kind, keyArg = 0n, shardSeq = 0, header, body, value, partitionKey, epochTag, nowUnix, boundary = CUTOVER_EPOCH, attachStateInit = true }) {
  // `nowUnix` rides through untouched: it must be the SAME instant the caller derived `epochTag` from, or the
  // era and the generation can disagree across a boundary midnight — see buildPublicPublishBrowser [round 5].
  const built = await buildPublicPublishBrowser({ kind, keyArg, shardSeq, header, body, value, partitionKey, epochTag, nowUnix, boundary });
  return {
    to: built.to,
    value: built.value,
    generation: built.generation,
    commit: built.commit,
    init: built.init,
    body: built.body,
    message: {
      address: built.to,
      amount: built.value,
      payload: tonCell.bytesToBase64(serializeBoc(built.body)),
      // storeInternalMessage takes the StateInit cell directly. It rides when the shard may not exist yet; a shard
      // the caller has just read as live is spared the halves' carriage (1.13M nanoton a part on generation 17,
      // 2.53M on 18, paid by the wallet), and every part after the first of one transfer follows a part that
      // deployed the shard [audit 2026-09-05, round 1].
      stateInit: attachStateInit ? built.init : null,
      bounce: true,            // a rejected publish bounces the funds back, exactly like the reference path
    },
  };
}

/**
 * WHICH DOOR, AND THE MESSAGE FOR IT. PUBLIC is the one lane with a real choice: a post already names its author
 * by design, so there is no metadata to protect and the only question left is price. `publicPublishRoute` answers
 * it from the arithmetic — the vault door waives the protocol fee but crosses the capsule ONE MORE TIME, and
 * carriage is per byte while the waived fee is flat, so above a crossover inside the 32 KB range the "discount"
 * is a surcharge. Sending everything through the vault would overcharge exactly the largest stakers on exactly
 * the largest posts.
 *
 * CONV never asks this question and must not: its direct door was closed for PRIVACY [owner 2026-08-30], because
 * the fee deposit named the publisher in cleartext and that was the private-messaging metadata graph, readable
 * from the chain. There the extra carriage is the price of not leaking; here there is nothing to leak.
 *
 * Returns the same shape as the direct builder plus `{ route, reason }`, so a caller can say which door it took.
 */
export async function buildPublicPublishRoutedMessage({
  kind, keyArg = 0n, shardSeq = 0, header, body, value, partitionKey, epochTag, nowUnix,
  vaultAddress = null, capsuleBytes, feeDue, boundary = CUTOVER_EPOCH, attachStateInit = true,
}) {
  // THE DIRECT MESSAGE HONOURS `attachStateInit` TOO [audit 2026-09-05, round 2]: it is what a 'direct' verdict below
  // returns, and it used to carry the halves on every part whatever the caller said — the wallet paid their forward
  // fee (2,526,334 nanoton a part on generation 18) while the door decision had modelled a direct door without them.
  const direct = await buildPublicPublishWalletMessage({
    kind, keyArg, shardSeq, header, body, value, partitionKey, epochTag, nowUnix, boundary, attachStateInit,
  });
  // No vault to send through is not a decision, it is an absence: a user who has never staked has no vault, and
  // the direct door is what the routing would have chosen for them anyway.
  if (!vaultAddress) return { ...direct, route: 'direct', reason: 'no-vault' };

  // THE CAPSULE'S SIZE IS MEASURED, NOT DECLARED, when the caller does not state one. The carriage is charged on
  // the message the VAULT forwards, whose body is exactly `direct.body` — so its serialized length IS the number
  // both the decision and the funding need. `vaultActionValue` refuses an OMITTED capsuleBytes because a default
  // of 0 prices a publish nobody sends; a measurement of the real payload is the opposite of that default, and it
  // removes the one figure a caller could restate wrongly. An explicit value still wins, which is what lets the
  // door tests drive each side of the crossover.
  const bytes = capsuleBytes ?? serializeBoc(direct.body).length;
  // ONLY GENERATION 18 HAS A VAULT DOOR [audit 2026-09-02, agent facet 2 — MEASURED]. clean-17's PublicShard
  // has exactly two receivers, `PublicPublish` and `RetirePublicShard`; there is no `VaultPublish` and no
  // fallback. CUTOVER.md's own order ships the clean-18 release — which lands the FeeVault cell and lets a
  // user stake — at step 4, and flips the writers at epoch E in step 5, so between them `vaultSupported()`
  // is true while every publish is still addressed to a generation-17 shard. Routed there the vault exits 0,
  // books its take, forwards, and the shard aborts at exit 130: the wallet is green and the post is gone,
  // for every staked user, for the whole pre-flip window. The generation is already resolved above, so the
  // question costs nothing to ask.
  if (direct.generation < 18) return { ...direct, route: 'direct', reason: 'generation-has-no-vault-door' };

  // THE HALVES TAKE THE GENERATION THE DIRECT BUILDER ALREADY CHOSE — they do not derive one. This used to read
  // `generationForEpochAt(Number(epochTag), boundary)`, and an epochTag is not an epoch: it is `(kind << 32) | era`,
  // with eras of 30 days or a year. MEASURED at unix 1,790,000,000 against a flip epoch of 20,717, where the true
  // generation is 18: CHANNEL's tag is 690 and answered 17, while THREAD, BEACON and AVATAR sit at 4,294,967,986 /
  // 8,589,934,648 / 12,884,901,944 and answer 18 at EVERY instant, including every day before the flip. Wrong in
  // both directions, right only by coincidence. PDR-01 measured the consequence on the CHANNEL side: the vault
  // accepted with exit 0, forwarded a generation-17 StateInit to the generation-18 address the direct builder had
  // just returned, the hashes disagreed so the StateInit was DROPPED, and the shard's compute phase was skipped on
  // an uninitialised account — the post gone, every layer above reporting success. The CONV twin carried the same
  // duplicate derivation. One derivation, in the builder that also derives the address, is the only shape where
  // the two cannot disagree.
  const generation = direct.generation;
  const halves = attachStateInit
    ? { shardCode: publicShardCodeCellFor(generation), shardData: publicShardDataCellFor(partitionKey, epochTag) }
    : { shardCode: null, shardData: null };
  // THE HALVES ARE BUILT BEFORE THE DOOR IS CHOSEN, because they weigh on the choice [2026-09-05, MEASURED]: a
  // deploying publish carries the shard's code on every hop, the vault door has one hop more, and the forward
  // fee of that hop is charged on the code's cells — 2,526,334 nanoton for the clean-18 PublicShard, against a
  // capsule carriage of 1,407,200 at 512 bytes. Priced without them, the first discounted post of an era was
  // forwarded 293,468 short of the shard's floor and refused 13704 under a green wallet (PDR-01, at the exact
  // client figure). The same `stateInit` goes into the decision and into the attach, so they cannot disagree.
  const stateInit = halves.shardCode ? { code: halves.shardCode, data: halves.shardData } : null;
  const decision = publicPublishRoute({ kind, capsuleBytes: bytes, feeDue, stateInit });
  if (decision.route !== 'vault') return { ...direct, ...decision };
  const message = buildVaultInternalPublishMessage(vaultAddress, {
    shard: direct.to,
    record: direct.body,
    ...halves,
    // THE DOOR'S ATTACH IS `vaultInternalPublishValue`, NOT `vaultActionValue` [audit 2026-09-02, agent facet 2
    // — MEASURED]. vaultActionValue prices what the SHARD must receive; the door additionally demands the
    // vault's own self reserve (gate 28021) and the forward headroom (28022), and FeeVault forwards
    // `context().value - take - FV_PUBLISH_SELF_RESERVE`, so the missing 2,000,000 comes straight off what
    // the shard sees. Driven through a REALLY staked vault (10,000 ATH, fee_due 0) into a real clean-18
    // PublicShard at the exact figure this builder produced: CHANNEL 10,987,200 and AVATAR 30,187,200 both
    // gave vault 0 / shard 13704 — the funding gate — and both cleared at exactly +2,000,000. That is a
    // deploying publish lost under a green wallet: the first post of an era, and EVERY part of an avatar
    // upload, whose 100-ATH payment rides the same transfer and lands anyway.
    //
    // PDR-01 did not catch it because the TEST attached `+ toNano('0.1')` of its own headroom — a scene
    // funded by hand, the same blindness ADOPT-08 was fixed for on this very day.
    value: vaultInternalPublishValue({ directValue: direct.value, capsuleBytes: bytes, feeDue, stateInit }),
  });
  return {
    to: message.address, value: message.amount, commit: direct.commit, shard: direct.to,
    message, ...decision,
  };
}

/**
 * Publish into the public/avatar lane from the user's wallet. Thin over the wallet send path; the message is the
 * only new thing, and it is pinned by tests/public-publish-browser.test.ts against the live contract.
 *
 * `wallet` is the app's WalletContractV5R1 handle (address, walletId, walletSecretKey, stateInit); `transport` is
 * the RPC transport with sendBoc (and runGetMethod for seqno). Extra `options` pass through to the wallet send.
 */
export async function publishPublicLane({ wallet, transport, ...args }, options = {}) {
  if (!wallet) throw new Error('publishPublicLane requires a wallet');
  const prepared = await buildPublicPublishWalletMessage(args);
  const result = await sendPlathoWalletTransaction(wallet, { messages: [prepared.message] }, { ...options, transport });
  return { ...prepared, result };
}

/**
 * Publish SEVERAL PublicPublish parts in ONE wallet transfer — the multipart case: a post split across N body cells
 * is N separate entries in the SAME shard (grouped on read by the header's streamId), so one signed transfer carries
 * all N. `parts` is an array of the buildPublicPublishWalletMessage args ({ kind, keyArg, header, body, value,
 * partitionKey, epochTag }); every part shares the same StateInit-bearing shard, so the first deploys it and the
 * rest just publish. Returns the prepared parts (for commit tracking) and the single wallet-send result.
 */
export async function publishPublicLaneParts({ wallet, transport, vaultAddress = null, feeDue = null },
  parts, options = {}) {
  if (!wallet) throw new Error('publishPublicLaneParts requires a wallet');
  if (!Array.isArray(parts) || parts.length === 0) throw new Error('publishPublicLaneParts requires at least one part');
  const prepared = [];
  // EACH PART ASKS THE DOOR QUESTION FOR ITSELF, because the answer depends on ITS size: a post split into a small
  // header part and a large image part can genuinely want different doors, and the crossover sits inside the
  // capsule range. With no vault (`vaultAddress` null — every user before their first stake, and everyone at all
  // before the seal) the routed builder short-circuits to the direct door and this is byte-identical to what it
  // replaced. `feeDue` is the payer's own discounted fee, cached from their last vault read: it is a pure
  // function of the staked position, so no chain read is spent per publish [quiet-conversation-must-cost-no-history-read].
  // THE HALVES RIDE ONCE PER SHARD, AND ONLY WHEN THAT SHARD MAY NOT EXIST [audit 2026-09-05, rounds 1 and 2]: on the
  // first part addressed to each shard of the transfer, unless the caller read that shard as live (`part.shardLive`,
  // from readWriteShard). Every later part to the same shard follows a first that created it — one source, one
  // destination, delivered in order. PER SHARD, not per transfer: the channel-profile save carries a CHANNEL part and
  // a BEACON part to two different accounts in one transfer, and round 1's "first part only" left the beacon without
  // its StateInit — a first announcement into an unwritten bucket-era bounced while the screen said saved.
  const deploying = new Set();
  for (const part of parts) {
    const shardKey = `${Number(part.kind)}.${BigInt(part.partitionKey ?? 0n)}.${BigInt(part.epochTag ?? 0n)}`;
    const attachStateInit = !deploying.has(shardKey) && part.shardLive !== true;
    deploying.add(shardKey);
    prepared.push(vaultAddress
      ? await buildPublicPublishRoutedMessage({ ...part, vaultAddress, feeDue, attachStateInit })
      : await buildPublicPublishWalletMessage({ ...part, attachStateInit }));
  }
  // THE SQUAT SURCHARGE, PER SHARD [2026-09-03]: every message carries a refundable cushion (a year of an empty shard's
  // rent) and, for an account seen pre-created and starved, the debt its age says it owes — the value gate of every
  // clean-18 shard demands `myStorageDue()` on top of the price (13712/13660/13688) and refuses a publish that cannot
  // cover it, so this is what turns a stranger's squat from a lost post into a few thousandths of a GRAM. The amount is
  // resolved by web/shard-debt.mjs (two reads at most, cached per address; none when the account does not exist) and
  // reported to the caller's `assertAffordable` when it exceeds the cushion the caller already budgeted for.
  const { extraMessages, shardDebt, assertAffordable, ...sendOptions } = options;
  const { cushion } = await applyShardSurcharge(LANE_PUBLIC, prepared, { resolver: shardDebt });
  // EVERYTHING ABOVE THE CALLER'S BUDGET IS ASSERTED BEFORE SIGNING. The caller holds `part.value + cushion` per
  // part; a message routed through the vault carries the door's overhead on top of that, a squatted shard its debt.
  const aboveBudget = surchargeExtraNanotons({ prepared, budgeted: parts.map((part) => part.value), cushion });
  if (aboveBudget > 0n && typeof assertAffordable === 'function') await assertAffordable(aboveBudget);
  // extraMessages lets a caller ride a NON-PublicPublish message in the same v5 transfer — the avatar path attaches
  // the 100-ATH payment request ({address, amount, payload}) alongside the AVATAR shard bytes so both land atomically.
  const extra = Array.isArray(extraMessages) ? extraMessages : [];
  let result;
  try {
    result = await sendPlathoWalletTransaction(wallet, { messages: [...prepared.map((p) => p.message), ...extra] }, { ...sendOptions, transport });
  } catch (error) {
    // The prepared parts ride on the error, as the CONV funnel's do: a caller can arm its confirmation on the SAME
    // commits when the broadcast throws ambiguously, and a gate can see what was built without a wallet.
    if (error && typeof error === 'object' && !error.preparedParts) error.preparedParts = prepared;
    throw error;
  }
  return { parts: prepared, result };
}

/**
 * WHICH DIRECTORY BUCKET THIS ANNOUNCEMENT GOES INTO.
 *
 * The home bucket — walletHash % PUBLIC_BEACON_READ_SPACE — is the one to prefer: it spreads the directory evenly
 * and keeps re-saving a profile idempotent within an era. It is a HINT, not an identity: the live contract folds
 * only H(domain, bucket) into a BEACON address and stamps `publisher` from sender(), so an announcement is found
 * and attributed from whichever bucket it lands in.
 *
 * That distinction is what makes the cap escapable. A bucket-era holds PS_SAFE_CAP entries and the BEACON era is a
 * YEAR, so a full bucket refuses every further announcement in it for up to a year — MEASURED by audit at 57.2
 * GRAM to fill one. Against a fixed home bucket that is a permanent, targeted denial for the price of a dinner.
 * Against a rolling one it is not: the attacker cannot know which bucket the victim will pick next, so denying one
 * channel means denying ALL of them, which is 1024 buckets — three orders of magnitude more, and no longer an
 * attack on a person.
 *
 * `roomOf(bucket)` returns how many entries a bucket still accepts, or null when that could not be read. NULL IS
 * NOT FULL: an unreadable probe falls back to the home bucket, because refusing to announce on a failed read would
 * turn a bad minute on the network into a channel that never appears.
 *
 * THE ROLL FIRES ON WHAT A READER CAN SEE, NOT ON WHAT THE SHARD CAN HOLD [audit 2026-09-01, round 9].
 *
 * `margin` was 8, i.e. the roll waited until a bucket was within 8 entries of PS_SAFE_CAP — 4,088 announcements.
 * But the directory sweep does not read a bucket; it reads the HEAD page and the TAIL page, PS_PAGE_CAP rows
 * each. Everything between is on chain, paid for, inside its retention, and reachable by NO client path.
 * MEASURED: a bucket filled to 201 entries with an honest channel's only announcement at index 100 returned ONE
 * channel from the sweep — the spammer — while readBeaconBucketRoom reported room 3,895 and the roll declined to
 * fire. So the only defence sat idle across a 3,896-entry range in which the harm was already total, and burying
 * a named victim cost 192 announcements (measured at 16,128,102 each, i.e. 3.10 GRAM) rather than the 66 GRAM a
 * full bucket costs.
 *
 * It also happens with no attacker at all: any bucket accumulating more than BEACON_READABLE_ENTRIES
 * announcements over its YEAR-long era loses its middle.
 *
 * So the trigger is the reader's own window. Rolling early is cheap — the contract folds only H(domain, bucket)
 * into the address and stamps `publisher` from sender(), so an announcement is found and attributed from
 * whichever bucket it lands in — while rolling late is not recoverable at all.
 */
// MIRRORED from the reader's window in web/public-lane.mjs: PAGE_ROWS (its PS_PAGE_CAP mirror) read from the head
// plus the same again from the tail. Mirrored rather than imported because public-lane imports this module's
// siblings; BEACONROLL-04 keeps the two numbers equal so the mirror cannot drift.
export const BEACON_READABLE_ENTRIES = 192;

export function chooseBeaconBucket({ home, candidates = [], roomOf, entriesOf = null, readableEntries = BEACON_READABLE_ENTRIES, margin = 8 } = {}) {
  const houseHome = Number(home);
  if (!Number.isInteger(houseHome) || houseHome < 0) throw new Error('chooseBeaconBucket requires a home bucket');
  const room = (bucket) => {
    try {
      const value = roomOf(bucket);
      return value === null || value === undefined ? null : Number(value);
    } catch { return null; }
  };
  // A bucket is USABLE while a reader can still see a new row in it. The entry count answers that directly; the
  // free-space form is kept for a caller that can only measure room, and still guards the hard cap.
  const entries = (bucket) => {
    if (typeof entriesOf !== 'function') return null;
    try {
      const value = entriesOf(bucket);
      return value === null || value === undefined ? null : Number(value);
    } catch { return null; }
  };
  const usable = (bucket) => {
    const seen = entries(bucket);
    if (seen !== null && Number.isFinite(seen)) return seen < readableEntries;
    const free = room(bucket);
    // A never-written bucket reports INFINITE room (the shard is deployed by its first entry), so finiteness is
    // the wrong test — only a null or a NaN means "could not be read", and an unreadable probe is NOT full.
    if (free === null || Number.isNaN(free)) return null;
    return free > margin;
  };
  const homeUsable = usable(houseHome);
  // Unknown or roomy: the home bucket, exactly as before this existed.
  if (homeUsable === null || homeUsable) {
    return { bucket: houseHome, rolled: false, reason: homeUsable === null ? 'unknown' : 'home' };
  }
  for (const candidate of candidates) {
    const bucket = Number(candidate);
    if (!Number.isInteger(bucket) || bucket < 0 || bucket === houseHome) continue;
    if (usable(bucket) === true) return { bucket, rolled: true, reason: 'home-full' };
  }
  // Every candidate is full or unreadable. Announce into the home bucket anyway: the publish will bounce and the
  // save will say so, which is a great deal better than writing into a bucket we have no reason to think is freer.
  return { bucket: houseHome, rolled: false, reason: 'no-room-anywhere' };
}
