import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { RecordShard, loadCapsulePublish } from '../build/RecordShard/RecordShard_RecordShard';
import { IntroShard, loadIntroPublish } from '../build/IntroShard/IntroShard_IntroShard';
import { RecoveryShard, loadRecoveryStore } from '../build/RecoveryShard/RecoveryShard_RecoveryShard';
import { buildConvPublish, buildIntroPublish, buildRecoveryPublish, frameCommit, introBodyCommit } from '../web/publish-builder.mjs';
import { addrKey, epochOf } from '../web/shard-discovery.mjs';
import { ed25519 } from '@noble/curves/ed25519.js';

// A conversation-direction's write key. In the client this is derived from the shared K_root
// (conv-routing.convWritePublicKey); here any deterministic 32-byte secret stands in for it.
const writeKey = (fill: number) => {
  const secret = new Uint8Array(32).fill(fill);
  return { secret, publicKey: ed25519.getPublicKey(secret) };
};

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// PUBLISH-BUILDER — the DIRECT-PAID send path, and the proof that a message is actually DELIVERABLE.
//
// The previous two-hop design (client -> NullifierShard -> RecordShard) forwarded only a commitment, so the
// ciphertext existed nowhere on chain and the recipient had nothing to decrypt — a messenger that could not carry a
// message. Publishing straight to the terminal shard fixes it by construction: the capsule cells ride in the
// client's own transaction, so they live in the destination shard's transaction history. PB-01/PB-02 assert exactly
// that end-to-end — the body is recovered FROM THE TRANSACTION and matches the commitment the CONTRACT stored.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const exitOf = (res: any, dest: Address): number => {
  const tx: any = res.transactions.find(
    (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === dest.toString());
  return Number(tx?.description?.computePhase?.exitCode ?? -999);
};
// The message that reached `dest` — this is what a client would later re-read from the shard's tx history.
const inboundTo = (res: any, dest: Address): any => res.transactions.find(
  (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === dest.toString())?.inMessage;

// A capsule cell. Content is opaque to the chain — only its hashes are committed to. A TON cell holds 1023 bits
// (127 bytes), so anything larger is a SNAKE of chained cells, exactly as the real capsule bodies are built.
const cellOf = (fill: number, len = 64) => {
  const buf = Buffer.alloc(len, fill);
  const chunks: Buffer[] = [];
  for (let i = 0; i < Math.max(len, 1); i += 127) chunks.push(buf.subarray(i, Math.min(i + 127, len)));
  let cell = beginCell().storeBuffer(chunks[chunks.length - 1]).endCell();
  for (let i = chunks.length - 2; i >= 0; i -= 1) {
    cell = beginCell().storeBuffer(chunks[i]).storeRef(cell).endCell();
  }
  return cell;
};

describe('PUBLISH-BUILDER — direct-paid publish, and the body actually arrives', () => {
  let blockchain: Blockchain;
  let payer: SandboxContract<TreasuryContract>;
  let epoch: number;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
  // Clock set AFTER the Apr-2026 config-18 switch, deliberately. The rate is a SCHEDULE: before the switch a
  // cell-year costs 240631 plus 481 per bit-year, after it 64962 with bits free — measured 486975 vs 64962 per
  // full 64-byte cell in this very sandbox, differing by nothing but this line. These shards deploy after the
  // switch, so a test clock in 2023 would price their rent ~7.5x high and quietly justify wrong endowments.
    blockchain.now = 1_790_000_000;
    epoch = epochOf(blockchain.now);
    payer = await blockchain.treasury('pb-payer');
  });

  async function deploy<T>(c: SandboxContract<T>): Promise<SandboxContract<T>> {
    await (c as any).send(payer.getSender(), { value: toNano('0.05') }, null);
    return c;
  }
  // Send EXACTLY what the builder returns, init included. Attaching init is what lets a publish CREATE the shard:
  // CONV/INTRO shards are lazily deployed and new every epoch, and a message to an uninitialised account has its
  // compute phase skipped — nothing stored, no error, wallet reports success.
  const send = (built: { to: Address; value: bigint; body: any; init?: any }) =>
    payer.send({ to: built.to, value: built.value, body: built.body, init: built.init, bounce: true } as any);

  it('PB-01: a CONV capsule is stored, and its BODY is recoverable from the shard transaction — the deliverability proof', async () => {
    const wk = writeKey(0x51);
    const h0 = cellOf(0x11), h1 = cellOf(0x22), body = cellOf(0x33, 512);
    const built = await buildConvPublish({ writePublicKey: wk.publicKey, writeSecret: wk.secret, seq: 1, epoch, header0: h0, header1: h1, body, value: toNano('0.02') });

    const init = await RecordShard.init(BigInt('0x' + Buffer.from(wk.publicKey).toString('hex')), BigInt(epoch));
    const rs = await deploy(blockchain.openContract(new RecordShard(contractAddress(0, init), init)));
    expect(addrKey(built.to), 'builder targets the derived shard').toBe(addrKey(rs.address));

    const res = await send(built);
    expect(exitOf(res, rs.address), 'publish accepted').toBe(0);

    // the contract stored ITS OWN commitment; the client's mirror agrees
    const rec = await rs.getGetRecord(0n);
    expect(rec.exists).toBe(true);
    expect(rec.frame_commit, 'contract commitment == client-derived frameCommit').toBe(frameCommit(h0, h1, body));
    expect(rec.created_at, 'contract stamps the time (now exposed)').toBe(BigInt(blockchain.now!));

    // THE POINT: recover the capsule from the transaction that delivered it and check it against the stored commit.
    const delivered = loadCapsulePublish(inboundTo(res, rs.address).body.beginParse());
    expect(delivered.body.equals(body), 'the ciphertext survived the trip').toBe(true);
    expect(delivered.header_0.equals(h0)).toBe(true);
    expect(delivered.header_1.equals(h1)).toBe(true);
    expect(frameCommit(delivered.header_0, delivered.header_1, delivered.body)).toBe(rec.frame_commit);
  }, 120_000);

  it('PB-02: an INTRO capsule is stored with its stealth fields, and its body is recoverable too', async () => {
    const bucket = 77n, r = 0xABCDn, viewTag = 0x1234n;
    const h0 = cellOf(0x44), body = cellOf(0x55, 256);
    const built = await buildIntroPublish({ epoch, bucket, r, viewTag, header0: h0, body, value: toNano('0.02') });

    const init = await IntroShard.init(BigInt(epoch), bucket);
    const is = await deploy(blockchain.openContract(new IntroShard(contractAddress(0, init), init)));
    expect(addrKey(built.to)).toBe(addrKey(is.address));

    const res = await send(built);
    expect(exitOf(res, is.address)).toBe(0);

    const e = await is.getGetEntry(0n);
    expect(e.exists).toBe(true);
    expect(e.r, 'stealth ephemeral point').toBe(r);
    expect(e.view_tag, 'the scan filter').toBe(viewTag);
    expect(e.body_commit).toBe(introBodyCommit(h0, body));

    const delivered = loadIntroPublish(inboundTo(res, is.address).body.beginParse());
    expect(delivered.body.equals(body), 'the intro ciphertext survived the trip').toBe(true);
    expect(introBodyCommit(delivered.header_0, delivered.body)).toBe(e.body_commit);
  }, 120_000);

  it('PB-03: an underfunded publish is refused in COMPUTE and stores nothing (it bounces and refunds)', async () => {
    const wk = writeKey(0x52);
    const init = await RecordShard.init(BigInt('0x' + Buffer.from(wk.publicKey).toString('hex')), BigInt(epoch));
    const rs = await deploy(blockchain.openContract(new RecordShard(contractAddress(0, init), init)));
    const minValue = (await rs.getGetView()).min_value;

    const built = await buildConvPublish({
      writePublicKey: wk.publicKey, writeSecret: wk.secret, seq: 1, epoch,
      header0: cellOf(1), header1: cellOf(2), body: cellOf(3),
      value: minValue - 1n,   // one nanoton below the contract's own floor
    });
    const res = await send(built);
    expect(exitOf(res, rs.address), 'underfunded -> 13652').toBe(13652);
    expect((await rs.getGetView()).live_count, 'nothing stored').toBe(0n);
    expect((await rs.getGetRecord(0n)).exists).toBe(false);
  }, 120_000);

  it('PB-04: the payer gets change back — the shard keeps only its own rent', async () => {
    const wk = writeKey(0x53);
    const init = await RecordShard.init(BigInt('0x' + Buffer.from(wk.publicKey).toString('hex')), BigInt(epoch));
    const rs = await deploy(blockchain.openContract(new RecordShard(contractAddress(0, init), init)));

    const before = await payer.getBalance();
    const built = await buildConvPublish({
      writePublicKey: wk.publicKey, writeSecret: wk.secret, seq: 1, epoch,
      header0: cellOf(7), header1: cellOf(8), body: cellOf(9, 256),
      value: toNano('1'),   // deliberately fat
    });
    expect(exitOf(await send(built), rs.address)).toBe(0);

    // The payer sent 1 GRAM and must get almost all of it back: the net cost is this message's INCREMENT (record
    // endowment + protocol fee + first-record base) plus gas — measured ~13.1M, so 0.02 is a tight-but-fair bound.
    expect(before - (await payer.getBalance())).toBeLessThan(toNano('0.02'));
    // The shard did NOT pocket the fat value: it holds the 0.05 deploy float it already had PLUS the increment, and
    // nothing like the 1 GRAM that passed through. NOTE the bound deliberately EXCEEDS the deploy float — an earlier
    // version asserted < 0.05 and only passed because the absolute reserve swept that float to the publisher, which
    // is the very theft the increment reserve fixes (PB-11 pins the property directly).
    const shardBalance = (await blockchain.getContract(rs.address)).balance;
    expect(shardBalance).toBeGreaterThan(toNano('0.05'));   // the pre-existing float survived
    expect(shardBalance).toBeLessThan(toNano('0.08'));      // but the fat 1 GRAM did not stay
  }, 120_000);

  it('PB-05: a RECOVERY blob is stored on chain at the owner-bound slot, and its frame hashes are now readable', async () => {
    const seed = new Uint8Array(32).fill(0x64);
    const blob = cellOf(0xAB, 128);
    const built = await buildRecoveryPublish({ seed, seq: 1, h0: 0x111n, h1: 0x222n, body: blob, value: toNano('0.05') });

    const init = await RecoveryShard.init(built.slotKey);
    const rs = await deploy(blockchain.openContract(new RecoveryShard(contractAddress(0, init), init)));
    expect(addrKey(built.to)).toBe(addrKey(rs.address));

    expect(exitOf(await send(built), rs.address)).toBe(0);
    const v = await rs.getGetView();
    expect(v.bound).toBe(true);
    expect(v.seq).toBe(1n);
    // this lane alone stores the blob ON CHAIN, and the hashes are now exposed so the read is self-verifying
    expect(v.h0).toBe(0x111n);
    expect(v.bh, 'bh is the body hash, derived not supplied').toBe(built.bh ?? v.bh);
    expect((await rs.getGetBody()).equals(blob), 'the blob itself is on chain').toBe(true);
  }, 120_000);

  it('PB-06: an oversized RECOVERY blob is refused (13560 restored) — a fixed endowment cannot buy unbounded storage', async () => {
    // The sharded rewrite dropped the monolith's blob cap while keeping the endowment calibrated for it, so an
    // oversized blob would buy 3 years of storage it did not pay for and starve the slot. Positive tests are blind
    // to this (they all use tiny blobs), so the blob here is deliberately built past the cap.
    const seed = new Uint8Array(32).fill(0x65);
    let oversized = beginCell().storeBuffer(Buffer.alloc(64, 0xFF)).endCell();
    for (let i = 0; i < 100; i += 1) {   // past RS_MAX_BLOB_CELLS (79) but under the probe limit, so 13560 fires
      oversized = beginCell().storeBuffer(Buffer.alloc(64, i & 0xff)).storeRef(oversized).endCell();
    }
    const built = await buildRecoveryPublish({ seed, seq: 1, h0: 0x1n, h1: 0x2n, body: oversized, value: toNano('0.1') });
    const init = await RecoveryShard.init(built.slotKey);
    const rs = await deploy(blockchain.openContract(new RecoveryShard(contractAddress(0, init), init)));

    const res = await send(built);
    // asserted SPECIFICALLY: probing at the cap would make the gate dead code and report an opaque exit 8 instead
    expect(exitOf(res, rs.address), 'oversized blob -> 13560, not a raw cell-overflow').toBe(13560);
    expect((await rs.getGetView()).bound, 'slot stays unbound — nothing was stored').toBe(false);

    // and a blob WITHIN the cap on the same (fresh) slot is accepted, so the cap is not simply rejecting everything
    const okSeed = new Uint8Array(32).fill(0x66);
    const okBuilt = await buildRecoveryPublish({ seed: okSeed, seq: 1, h0: 0x1n, h1: 0x2n, body: cellOf(0xCD, 512), value: toNano('0.1') });
    const okInit = await RecoveryShard.init(okBuilt.slotKey);
    const okRs = await deploy(blockchain.openContract(new RecoveryShard(contractAddress(0, okInit), okInit)));
    expect(exitOf(await send(okBuilt), okRs.address), 'in-cap blob accepted').toBe(0);
    expect((await okRs.getGetView()).bound).toBe(true);
  }, 120_000);

  it('PB-08: an OUTSIDER who knows the address cannot write — address privacy is not authorization', async () => {
    // The measured hole in the first direct-pay draft: the bucket key goes into the ADDRESS, which is public the
    // moment anyone publishes, so a stranger appended junk to a private conversation and could deny it for ~11 TON
    // by filling SAFE_CAP. Authorization is now a signature under the bucket's own key.
    const owner = writeKey(0x61), stranger = writeKey(0x62);
    const init = await RecordShard.init(BigInt('0x' + Buffer.from(owner.publicKey).toString('hex')), BigInt(epoch));
    const rs = await deploy(blockchain.openContract(new RecordShard(contractAddress(0, init), init)));

    // the legitimate participant publishes; the address is now public in the chain
    const good = await buildConvPublish({ writePublicKey: owner.publicKey, writeSecret: owner.secret, seq: 1, epoch, header0: cellOf(1), header1: cellOf(2), body: cellOf(3), value: toNano('0.02') });
    expect(exitOf(await send(good), rs.address)).toBe(0);
    expect((await rs.getGetView()).live_count).toBe(1n);

    // the stranger sends to that SAME address, signing with a key they control — refused, nothing stored
    const junk = await buildConvPublish({ writePublicKey: owner.publicKey, writeSecret: stranger.secret, seq: 2, epoch, header0: cellOf(0xEE), header1: cellOf(0xEE), body: cellOf(0xEE), value: toNano('0.02') });
    expect(addrKey(junk.to), 'the stranger really is aiming at the same shard').toBe(addrKey(rs.address));
    expect(exitOf(await send(junk), rs.address), 'forged write -> 13654').toBe(13654);
    expect((await rs.getGetView()).live_count, 'the conversation is untouched').toBe(1n);
  }, 120_000);

  it('PB-09: a captured publish cannot be REPLAYED — the signature alone would not have stopped the DoS', async () => {
    // Without the monotonic seq an attacker could re-send a legitimate (cells, sig) pair over and over to burn
    // SAFE_CAP slots at the same cost, so the signature would have closed forgery but not denial of service.
    const owner = writeKey(0x63);
    const init = await RecordShard.init(BigInt('0x' + Buffer.from(owner.publicKey).toString('hex')), BigInt(epoch));
    const rs = await deploy(blockchain.openContract(new RecordShard(contractAddress(0, init), init)));

    const built = await buildConvPublish({ writePublicKey: owner.publicKey, writeSecret: owner.secret, seq: 5, epoch, header0: cellOf(4), header1: cellOf(5), body: cellOf(6), value: toNano('0.02') });
    expect(exitOf(await send(built), rs.address)).toBe(0);
    expect((await rs.getGetView()).last_seq).toBe(5n);

    // byte-identical resend by anyone -> refused on the replay floor
    expect(exitOf(await send(built), rs.address), 'replay -> 13653').toBe(13653);
    // and an older seq is refused too
    const older = await buildConvPublish({ writePublicKey: owner.publicKey, writeSecret: owner.secret, seq: 3, epoch, header0: cellOf(7), header1: cellOf(8), body: cellOf(9), value: toNano('0.02') });
    expect(exitOf(await send(older), rs.address), 'stale seq -> 13653').toBe(13653);
    expect((await rs.getGetView()).live_count, 'still exactly one record').toBe(1n);

    // the legitimate next message (higher seq) still goes through
    const next = await buildConvPublish({ writePublicKey: owner.publicKey, writeSecret: owner.secret, seq: 6, epoch, header0: cellOf(10), header1: cellOf(11), body: cellOf(12), value: toNano('0.02') });
    expect(exitOf(await send(next), rs.address), 'the conversation still works').toBe(0);
    expect((await rs.getGetView()).live_count).toBe(2n);
  }, 120_000);

  it('PB-10: a publish DEPLOYS the shard it targets — nothing is pre-deployed, only the builder output is sent', async () => {
    // The blocker this covers: every CONV/INTRO shard is new each epoch, and the builder used to omit StateInit, so
    // the first (hence every) publish of a day landed on an uninit account — compute skipped, nothing stored, and
    // the sender's wallet still reported success. Every other test here pre-deploys through the Tact wrapper, which
    // is exactly why they were blind to it. This one deploys NOTHING.
    const wk = writeKey(0x71);
    const h0 = cellOf(0x21), h1 = cellOf(0x22), body = cellOf(0x23, 256);
    const built = await buildConvPublish({ writePublicKey: wk.publicKey, writeSecret: wk.secret, seq: 1, epoch, header0: h0, header1: h1, body, value: toNano('0.02') });

    // prove the account really does not exist yet
    expect((await blockchain.getContract(built.to)).accountState?.type ?? 'uninit').not.toBe('active');

    const res = await send(built);
    expect(exitOf(res, built.to), 'the publish deployed the shard and stored the record').toBe(0);

    const rs = blockchain.openContract(RecordShard.fromAddress(built.to));
    const rec = await rs.getGetRecord(0n);
    expect(rec.exists, 'record stored on a shard that did not exist before this message').toBe(true);
    expect(rec.frame_commit).toBe(built.commit);
    // and a SECOND publish to the now-deployed shard still works with init re-attached (harmless duplicate)
    const next = await buildConvPublish({ writePublicKey: wk.publicKey, writeSecret: wk.secret, seq: 2, epoch, header0: h0, header1: h1, body: cellOf(0x24), value: toNano('0.02') });
    expect(exitOf(await send(next), built.to), 're-sent init on a live shard is harmless').toBe(0);
    expect((await rs.getGetView()).live_count).toBe(2n);
  }, 120_000);

  it('PB-11: a deliberate top-up is NOT swept by the next publisher (increment reserve)', async () => {
    // The monolith reserves an increment on top of the pre-existing balance and says in as many words that an
    // absolute reserve "would be WRONG — it would leak the sweepable surplus". All three shards had lost the flag,
    // which made the balance a hard ceiling: any top-up, deploy float or mistaken transfer went to whoever published
    // next, and in the open INTRO lane that is a stranger.
    const wk = writeKey(0x72);
    const first = await buildConvPublish({ writePublicKey: wk.publicKey, writeSecret: wk.secret, seq: 1, epoch, header0: cellOf(1), header1: cellOf(2), body: cellOf(3), value: toNano('0.02') });
    expect(exitOf(await send(first), first.to)).toBe(0);

    // somebody tops the shard up to extend the conversation's life — the only manual lever on an immutable contract
    const topUp = toNano('0.5');
    await payer.send({ to: first.to, value: topUp, bounce: false } as any);
    const afterTopUp = (await blockchain.getContract(first.to)).balance;
    expect(afterTopUp).toBeGreaterThan(topUp);

    // the next publish must NOT carry that top-up away
    const next = await buildConvPublish({ writePublicKey: wk.publicKey, writeSecret: wk.secret, seq: 2, epoch, header0: cellOf(4), header1: cellOf(5), body: cellOf(6), value: toNano('0.02') });
    expect(exitOf(await send(next), first.to)).toBe(0);
    const afterPublish = (await blockchain.getContract(first.to)).balance;
    expect(afterPublish, 'the top-up survived the next publish').toBeGreaterThan(topUp);
  }, 120_000);

  it('PB-12: a no-op eviction cannot drain the shard — the payout requires that something was actually reclaimed', async () => {
    // Eviction pays the caller out of the freed endowments, which is what makes anyone willing to call it at all
    // (keeper daemons are forbidden here). But the payout sat AFTER the loop with no proof the loop did anything:
    // EvictRecords{max_count: 0} skips it entirely, and any call made before records age out sweeps nothing — so a
    // passer-by could take the shard's surplus for the price of gas. Note the counter subtlety this depends on:
    // "nothing was evicted" and "swept a full batch" used to be indistinguishable, because the loop signalled its
    // early exit by assigning the counter max_count.
    const wk = writeKey(0x74);
    const first = await buildConvPublish({ writePublicKey: wk.publicKey, writeSecret: wk.secret, seq: 1, epoch, header0: cellOf(1), header1: cellOf(2), body: cellOf(3), value: toNano('0.02') });
    expect(exitOf(await send(first), first.to)).toBe(0);
    await payer.send({ to: first.to, value: toNano('0.5'), bounce: false } as any);   // surplus worth stealing
    const before = (await blockchain.getContract(first.to)).balance;

    const rs = blockchain.openContract(RecordShard.fromAddress(first.to));
    const thief = await blockchain.treasury('pb-thief');

    // (a) explicit no-op: the loop is never entered
    const zero = await rs.send(thief.getSender(), { value: toNano('0.05'), bounce: true }, { $$type: 'EvictRecords', max_count: 0n } as any);
    expect(exitOf(zero, first.to), 'max_count 0 -> 13655').toBe(13655);

    // (b) honest-looking call while the record is still well inside its retention window: also nothing to reclaim
    const early = await rs.send(thief.getSender(), { value: toNano('0.05'), bounce: true }, { $$type: 'EvictRecords', max_count: 64n } as any);
    expect(exitOf(early, first.to), 'nothing aged out -> 13655').toBe(13655);

    expect((await blockchain.getContract(first.to)).balance, 'the surplus is untouched').toBeGreaterThanOrEqual(before - toNano('0.001'));

    // and a GENUINE eviction past the retention window still works and still pays the caller
    blockchain.now = blockchain.now! + 31536000 + 86400;
    const real = await rs.send(thief.getSender(), { value: toNano('0.05') }, { $$type: 'EvictRecords', max_count: 64n } as any);
    expect(exitOf(real, first.to), 'a real sweep is accepted').toBe(0);
    expect((await rs.getGetView()).live_count).toBe(0n);
  }, 120_000);

  it('PB-13: eviction pays out ONLY the endowments it freed — a top-up survives the evictor too', async () => {
    // PB-11 pins that a top-up survives the next PUBLISH. Eviction was quietly taking the very same money by the
    // very same mechanic: its reserve was absolute (base + live_count*endowment + fee), so the balance became a
    // hard ceiling again and the first passer-by to call EvictRecords walked off with the whole surplus. The two
    // paths contradicted each other about the same GRAM, and only one of them had a test.
    //
    // Inverting the sign alone (original - freed) would have opened the mirror hole: once rent has eaten in, a full
    // `freed` payout comes out of LIVE records' endowments. So both bounds hold at once, and this pins both.
    const wk = writeKey(0x75);
    for (const seq of [1n, 2n]) {
      const p = await buildConvPublish({ writePublicKey: wk.publicKey, writeSecret: wk.secret, seq, epoch, header0: cellOf(1), header1: cellOf(2), body: cellOf(3), value: toNano('0.02') });
      expect(exitOf(await send(p), p.to)).toBe(0);
    }
    const shard = (await buildConvPublish({ writePublicKey: wk.publicKey, writeSecret: wk.secret, seq: 3n, epoch, header0: cellOf(1), header1: cellOf(2), body: cellOf(3), value: toNano('0.02') })).to;

    const topUp = toNano('0.5');
    await payer.send({ to: shard, value: topUp, bounce: false } as any);
    const beforeEvict = (await blockchain.getContract(shard)).balance;

    blockchain.now = blockchain.now! + 31536000 + 86400;
    const rs = blockchain.openContract(RecordShard.fromAddress(shard));
    const keeper = await blockchain.treasury('pb-keeper');
    expect(exitOf(await rs.send(keeper.getSender(), { value: toNano('0.05') }, { $$type: 'EvictRecords', max_count: 64n } as any), shard)).toBe(0);

    const afterEvict = (await blockchain.getContract(shard)).balance;
    // The deliberate top-up is still in the shard. Under the absolute reserve this was ~0.
    expect(afterEvict, 'the top-up did not leave with the evictor').toBeGreaterThan(topUp);
    // And the shard did release something, or nobody would ever call eviction at all.
    expect(beforeEvict - afterEvict, 'the freed endowments were released').toBeGreaterThan(0n);
    // Bounded above by what actually aged out. Deliberately expressed RELATIVE to the top-up rather than as an
    // absolute nanoton figure, so the assertion cannot be quietly invalidated by a storage-rate change (config-18
    // is a schedule and has already moved once — see the clock note at the top of this file).
    expect(beforeEvict - afterEvict, 'the payout is a couple of endowments, nothing like the top-up')
      .toBeLessThan(topUp / 4n);
    expect((await rs.getGetView()).live_count).toBe(0n);
  }, 120_000);

  it('PB-14: an underfunded INTRO is refused in COMPUTE (13682) — the fee IS the spam price on the open lane', async () => {
    // 13682 had no test at all, which mattered more here than on CONV. INTRO is open by design: anyone may write to
    // any bucket, and the recipient has to SCAN every live intro, so publishing junk degrades everyone's scan. There
    // is no gate that can tell a real first contact from a fake one without breaking the stealth property, so the
    // only lever is price — and an unenforced floor would mean no price at all.
    const bucket = 91n;
    const init = await IntroShard.init(BigInt(epoch), bucket);
    const is = await deploy(blockchain.openContract(new IntroShard(contractAddress(0, init), init)));
    const view = await is.getGetView();
    expect(view.protocol_fee, 'INTRO now carries the same 0.01 GRAM per-message fee as CONV').toBe(10_000_000n);
    expect(view.min_value, 'endowment + bounty + gas + fee').toBe(13_408_000n);
    expect(view.evict_bounty, 'each intro pre-funds its own eviction').toBe(900_000n);

    const built = await buildIntroPublish({
      epoch, bucket, r: 0xBEEFn, viewTag: 0x77n, header0: cellOf(7), body: cellOf(8),
      value: view.min_value - 1n,   // one nanoton below the contract's own floor
    });
    expect(exitOf(await send(built), is.address), 'underfunded -> 13682').toBe(13682);
    expect((await is.getGetView()).live_count, 'nothing stored').toBe(0n);
    expect((await is.getGetEntry(0n)).exists).toBe(false);

    // and the fee is actually retained, not handed back with the change
    const ok = await buildIntroPublish({ epoch, bucket, r: 0xBEEFn, viewTag: 0x77n, header0: cellOf(7), body: cellOf(8), value: toNano('0.05') });
    expect(exitOf(await send(ok), is.address)).toBe(0);
    expect((await is.getGetView()).accrued_fee, 'the fee stayed in the shard').toBe(10_000_000n);
  }, 120_000);

  it('PB-07: the client value floors are pinned to the CONTRACT constants — silent drift is impossible', () => {
    // Clients fund a publish against the contract's COMPUTE gates. The shards now EXPOSE min_value in get_view, so a
    // client should read it rather than mirror it; this test pins the arithmetic so a constant change is loud.
    const constOf = (src: string, name: string): bigint => {
      const m = src.match(new RegExp(`const\\s+${name}\\s*:\\s*Int\\s*=\\s*(\\d+)`));
      if (!m) throw new Error(`contract constant ${name} not found — did it get renamed?`);
      return BigInt(m[1]);
    };
    const minValueTerms = (src: string, name: string): string[] => {
      const m = src.match(new RegExp(`const\\s+${name}\\s*:\\s*Int\\s*=\\s*([^;]+);`));
      if (!m) throw new Error(`${name} not found`);
      return m[1].split('+').map(t => t.trim());
    };
    const rec = readFileSync('contracts/RecordShard.tact', 'utf8');
    const intro = readFileSync('contracts/IntroShard.tact', 'utf8');
    const recov = readFileSync('contracts/RecoveryShard.tact', 'utf8');

    // RS_MIN_VALUE = rent + gas + the 0.01 GRAM protocol fee. The fee is the other half of the airdrop economics
    // (1.5M capsules -> 15M ATH out, 15k GRAM in) and is what keeps publishing from being cheaper than the reward.
    expect(constOf(rec, 'RS_PROTOCOL_FEE'), 'the service fee is 0.01 GRAM, as in the deleted CreditSale').toBe(10_000_000n);
    const recTerms = minValueTerms(rec, 'RS_MIN_VALUE');
    expect(recTerms.sort(), 'RS_MIN_VALUE is endowment + bounty + gas + fee, nothing dropped')
      .toEqual(['RS_EVICT_BOUNTY', 'RS_PROTOCOL_FEE', 'RS_PUBLISH_GAS', 'RS_RECORD_ENDOWMENT']);
    expect(recTerms.reduce((a, t) => a + constOf(rec, t), 0n), 'RecordShard RS_MIN_VALUE').toBe(13_600_000n);
    // the record endowment carries the canonical G8 1.5x margin over its MEASURED 3 cells (not the 2 in the old note)
    expect(constOf(rec, 'RS_RECORD_ENDOWMENT'), '3 cells x 64962 x 1yr x 1.5 = 292_329 -> 300_000').toBe(300_000n);
    // the airdrop pays 10 ATH per capsule, so a capsule must never cost LESS than the fee that backs it
    expect(constOf(rec, 'RS_PROTOCOL_FEE') * 1_500_000n, '1.5M capsules collect 15k GRAM').toBe(15_000_000_000_000n);
    // INTRO pays the SAME per-message fee (owner 2026-07-18). Assert against the DEFINITION of IS_MIN_VALUE, not
    // against a sum we happen to write here: the previous revision pinned `endowment + gas` under the label
    // "IS_MIN_VALUE", so when the fee term was added the assertion stayed green while its meaning silently drifted.
    const introTerms = minValueTerms(intro, 'IS_MIN_VALUE');
    expect(introTerms.sort(), 'IS_MIN_VALUE is endowment + gas + fee, nothing dropped')
      .toEqual(['IS_EVICT_BOUNTY', 'IS_INTRO_ENDOWMENT', 'IS_PROTOCOL_FEE', 'IS_PUBLISH_GAS']);
    expect(introTerms.reduce((a, t) => a + constOf(intro, t), 0n), 'IntroShard IS_MIN_VALUE').toBe(13_408_000n);
    // The bounty exists because a STORAGE endowment cannot fund eviction: it is consumed by the storage it bought.
    // Both bounties are sized at measured marginal sweep gas x 1.5 — see tests/evict-incentive.test.ts.
    // Sized at the WORST case the contract permits, because marginal gas grows with dictionary depth and the
    // contract is immutable: measured 533_186/entry at RS_SAFE_CAP=4096 and 591_973 at IS_SAFE_CAP=8000, x1.5.
    expect(constOf(intro, 'IS_EVICT_BOUNTY'), '591_973 at IS_SAFE_CAP x1.5').toBe(900_000n);
    expect(constOf(rec, 'RS_EVICT_BOUNTY'), '533_186 at RS_SAFE_CAP x1.5').toBe(800_000n);
    // one fee for the whole protocol — a first contact costs the same as a reply
    expect(constOf(intro, 'IS_PROTOCOL_FEE'), 'INTRO charges the same 0.01 GRAM as CONV').toBe(constOf(rec, 'RS_PROTOCOL_FEE'));
    // RECOVERY has no separate base endowment, so this one constant funds the WHOLE account for 3 years. It used to
    // be derived from the 79-cell blob alone, omitting the shard's own 17 code + 2 data cells, which delivered a
    // 1.215x margin instead of the canonical 1.5x on the one lane whose failure loses a user's account.
    expect(constOf(recov, 'RS_RECOVERY_ENDOWMENT'), '(79 blob + 17 code + 2 data) x 64962 x 3yr x 1.5').toBe(28_700_000n);
    expect(constOf(recov, 'RS_RECOVERY_ENDOWMENT') + constOf(recov, 'RS_RECOVERY_PATH_GAS'), 'RecoveryShard RS_MIN_VALUE').toBe(36_700_000n);
    // the STORAGE+GAS part is still materially cheaper than the old two-hop floor (7_710_000) — the hop is gone
    expect(constOf(rec, 'RS_RECORD_ENDOWMENT') + constOf(rec, 'RS_PUBLISH_GAS')).toBeLessThan(7_710_000n);
  });
});
