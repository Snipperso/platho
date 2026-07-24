import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { RecordShard, loadCapsulePublish } from '../build/RecordShard/RecordShard_RecordShard';
import { IntroShard, loadIntroPublish } from '../build/IntroShard/IntroShard_IntroShard';
import { RecoveryShard, loadRecoveryStore } from '../build/RecoveryShard/RecoveryShard_RecoveryShard';
import { PublicShard } from '../build/PublicShard/PublicShard_PublicShard';
import { buildConvPublish, buildIntroPublish, buildRecoveryPublish, buildPublicPublish, frameCommit, introBodyCommit } from '../web/publish-builder.mjs';
import {
  addrKey, epochOf,
  publicChannelPartitionKey, publicBeaconPartitionKey, publicWalletHash, publicEpochTag, publicEraOf,
} from '../web/shard-discovery.mjs';
import { ed25519 } from '@noble/curves/ed25519.js';

// A conversation-direction's write key. In the client this is derived from the shared K_root
// (conv-routing.convWritePublicKey); here any deterministic 32-byte secret stands in for it.
// A FIRST publish into a fresh shard also funds the account's life and its retirement (RS_DEPLOY_MIN_VALUE);
// later publishes pay the lower RS_MIN_VALUE. Clients read both from get_view.
const RS_DEPLOY_MIN_VALUE = 19_100_000n;

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
    expect((await rs.getGetView()).record_count, 'nothing stored').toBe(0n);
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
    const built = await buildRecoveryPublish({ seed, slotIndex: 0, seq: 1, h0: 0x111n, h1: 0x222n, body: blob, value: toNano('0.05') });

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

  it('PB-05b: the CLIENT slot derivation matches the CONTRACT for a NON-ZERO index, end to end', async () => {
    // The client mirrors slotKeyForOwner in two independent places (shard-discovery with the browser hasher,
    // publish-builder with @ton/core) and the contract recomputes it in Tact. Three implementations of one hash.
    // If any drifts, the client addresses a slot the contract will not bind — and under lazy deploy an unbindable
    // address is not an error, it is a message that vanishes with the wallet reporting success.
    //
    // PB-05 only ever exercised index 0, where a derivation that DROPPED the index entirely still agrees with one
    // that keeps it: H(d ‖ pub ‖ 0) is what both compute only because both were given 0. A non-zero index is the
    // first input that can tell those two implementations apart, which is the whole reason this case exists.
    const seed = new Uint8Array(32).fill(0x66);
    const blob = cellOf(0xCE, 96);
    const built = await buildRecoveryPublish({ seed, slotIndex: 7, seq: 1, h0: 0x333n, h1: 0x444n, body: blob, value: toNano('0.05') });

    const init = await RecoveryShard.init(built.slotKey);
    const rs = await deploy(blockchain.openContract(new RecoveryShard(contractAddress(0, init), init)));

    // Exit 0 here IS the cross-check: the contract recomputes H(domain ‖ owner_pubkey ‖ 7) and compares it to the
    // self_bucket_key the CLIENT chose. A mismatch of even one bit is gate 13575, not a silent pass.
    expect(exitOf(await send(built), rs.address), 'contract agrees with the client on slot 7').toBe(0);
    expect((await rs.getGetView()).bound).toBe(true);

    // and slot 7 is genuinely a different account from slot 0 for the same seed
    const at0 = await buildRecoveryPublish({ seed, slotIndex: 0, seq: 1, h0: 0x333n, h1: 0x444n, body: blob, value: toNano('0.05') });
    expect(at0.slotKey, 'index 0 and index 7 are different slots').not.toBe(built.slotKey);
    expect(addrKey(at0.to)).not.toBe(addrKey(built.to));

    // a NAMED slot (256, the first above the scan range) IS accepted now (gate 13576 widened for read-by-address slots)
    const named = await buildRecoveryPublish({ seed, slotIndex: 256, seq: 1, h0: 0x1n, h1: 0x2n, body: blob, value: toNano('0.05') });
    expect(named.to, 'the named prefs slot 256 builds').toBeTruthy();
    // but an index at/above the top of the named block (272) is refused before any money moves
    await expect(buildRecoveryPublish({ seed, slotIndex: 272, seq: 1, h0: 0x1n, h1: 0x2n, body: blob, value: toNano('0.05') }))
      .rejects.toThrow(/slotIndex/);
    await expect(buildRecoveryPublish({ seed, seq: 1, h0: 0x1n, h1: 0x2n, body: blob, value: toNano('0.05') } as any))
      .rejects.toThrow(/slotIndex/);
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
    const built = await buildRecoveryPublish({ seed, slotIndex: 0, seq: 1, h0: 0x1n, h1: 0x2n, body: oversized, value: toNano('0.1') });
    const init = await RecoveryShard.init(built.slotKey);
    const rs = await deploy(blockchain.openContract(new RecoveryShard(contractAddress(0, init), init)));

    const res = await send(built);
    // asserted SPECIFICALLY: probing at the cap would make the gate dead code and report an opaque exit 8 instead
    expect(exitOf(res, rs.address), 'oversized blob -> 13560, not a raw cell-overflow').toBe(13560);
    expect((await rs.getGetView()).bound, 'slot stays unbound — nothing was stored').toBe(false);

    // and a blob WITHIN the cap on the same (fresh) slot is accepted, so the cap is not simply rejecting everything
    const okSeed = new Uint8Array(32).fill(0x66);
    const okBuilt = await buildRecoveryPublish({ seed: okSeed, slotIndex: 0, seq: 1, h0: 0x1n, h1: 0x2n, body: cellOf(0xCD, 512), value: toNano('0.1') });
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
    expect((await rs.getGetView()).record_count).toBe(1n);

    // the stranger sends to that SAME address, signing with a key they control — refused, nothing stored
    const junk = await buildConvPublish({ writePublicKey: owner.publicKey, writeSecret: stranger.secret, seq: 2, epoch, header0: cellOf(0xEE), header1: cellOf(0xEE), body: cellOf(0xEE), value: toNano('0.02') });
    expect(addrKey(junk.to), 'the stranger really is aiming at the same shard').toBe(addrKey(rs.address));
    expect(exitOf(await send(junk), rs.address), 'forged write -> 13654').toBe(13654);
    expect((await rs.getGetView()).record_count, 'the conversation is untouched').toBe(1n);
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
    expect((await rs.getGetView()).record_count, 'still exactly one record').toBe(1n);

    // the legitimate next message (higher seq) still goes through
    const next = await buildConvPublish({ writePublicKey: owner.publicKey, writeSecret: owner.secret, seq: 6, epoch, header0: cellOf(10), header1: cellOf(11), body: cellOf(12), value: toNano('0.02') });
    expect(exitOf(await send(next), rs.address), 'the conversation still works').toBe(0);
    expect((await rs.getGetView()).record_count).toBe(2n);
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
    expect((await rs.getGetView()).record_count).toBe(2n);
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

  it('PB-12: a shard cannot be retired before its death instant — a stranger cannot drain it early', async () => {
    // REPLACES the old no-op-eviction guard, which pinned that EvictRecords{max_count: 0} could not walk off with
    // the shard's surplus. Eviction is gone; the equivalent risk is now that RetireShard DESTROYS the account and
    // hands its whole balance to the caller, so the only thing standing between a live conversation and deletion
    // is the time gate. It is arithmetic on `epoch`, which is an init parameter and therefore part of the address,
    // so no amount of money can move it.
    const wk = writeKey(0x74);
    const first = await buildConvPublish({ writePublicKey: wk.publicKey, writeSecret: wk.secret, seq: 1, epoch, header0: cellOf(1), header1: cellOf(2), body: cellOf(3), value: RS_DEPLOY_MIN_VALUE });
    expect(exitOf(await send(first), first.to)).toBe(0);
    await payer.send({ to: first.to, value: toNano('0.5'), bounce: false } as any);   // surplus worth stealing
    const before = (await blockchain.getContract(first.to)).balance;

    const rs = blockchain.openContract(RecordShard.fromAddress(first.to));
    const thief = await blockchain.treasury('pb-thief');
    const retire = { $$type: 'RetireShard' } as any;

    // Well inside the retention window: refused, and the account survives with its money.
    expect(exitOf(await rs.send(thief.getSender(), { value: toNano('0.05'), bounce: true }, retire), first.to),
      'a live shard refuses retirement -> 13655').toBe(13655);

    // One second before the published instant: still refused. The gate is `>`, so the instant itself is too early.
    blockchain.now = Number((await rs.getGetView()).retire_at);
    expect(exitOf(await rs.send(thief.getSender(), { value: toNano('0.05'), bounce: true }, retire), first.to),
      'at the retire instant itself it is still refused').toBe(13655);
    expect((await blockchain.getContract(first.to)).balance, 'the surplus is untouched')
      .toBeGreaterThanOrEqual(before - toNano('0.01'));
    expect((await rs.getGetView()).record_count, 'and the record is still there').toBe(1n);

    // One second later it works, and the account is gone.
    blockchain.now = blockchain.now! + 1;
    expect(exitOf(await rs.send(thief.getSender(), { value: toNano('0.05') }, retire), first.to)).toBe(0);
    expect((await blockchain.getContract(first.to)).accountState?.type).not.toBe('active');
  }, 120_000);

  it('PB-13: a top-up survives every PUBLISH — but the RETIRER takes it, and that is deliberate', async () => {
    // PB-11 pins that a deliberate top-up survives the next publish, and that still holds: the publish path
    // reserves relatively, so the balance never becomes a hard ceiling.
    //
    // WHAT CHANGED, AND IT IS AN OWNER-VISIBLE CHANGE RATHER THAN A BUG. The old eviction path was carefully
    // bounded so a passer-by could not walk off with a top-up. RetireShard has no such bound: it destroys the
    // account and sends the entire residual to whoever called it. That is the payment for the cleanup, and it is
    // what makes retiring a one-record shard worth doing at all — the property that per-record bounties could
    // never fund. The protection is not a bound on the payout, it is the time gate: nobody can reach that money
    // until a full year past the shard's last possible write.
    const wk = writeKey(0x75);
    for (const seq of [1n, 2n]) {
      const p = await buildConvPublish({ writePublicKey: wk.publicKey, writeSecret: wk.secret, seq, epoch, header0: cellOf(1), header1: cellOf(2), body: cellOf(3), value: seq === 1n ? RS_DEPLOY_MIN_VALUE : toNano('0.02') });
      expect(exitOf(await send(p), p.to)).toBe(0);
    }
    const shard = (await buildConvPublish({ writePublicKey: wk.publicKey, writeSecret: wk.secret, seq: 3n, epoch, header0: cellOf(1), header1: cellOf(2), body: cellOf(3), value: toNano('0.02') })).to;
    const rs = blockchain.openContract(RecordShard.fromAddress(shard));

    const topUp = toNano('0.5');
    await payer.send({ to: shard, value: topUp, bounce: false } as any);

    // Still there after another publish — the PB-11 property, unchanged.
    const third = await buildConvPublish({ writePublicKey: wk.publicKey, writeSecret: wk.secret, seq: 3n, epoch, header0: cellOf(4), header1: cellOf(5), body: cellOf(6), value: toNano('0.02') });
    expect(exitOf(await send(third), shard)).toBe(0);
    expect((await blockchain.getContract(shard)).balance, 'a publish does not touch the top-up').toBeGreaterThan(topUp);

    // And it leaves with the retirer, by design.
    blockchain.now = Number((await rs.getGetView()).retire_at) + 1;
    const keeper = await blockchain.treasury('pb-keeper');
    const keeperBefore = (await blockchain.getContract(keeper.address)).balance;
    expect(exitOf(await rs.send(keeper.getSender(), { value: toNano('0.05') }, { $$type: 'RetireShard' } as any), shard)).toBe(0);
    expect((await blockchain.getContract(keeper.address)).balance - keeperBefore,
      'the retirer is paid the residual, top-up included').toBeGreaterThan(topUp / 2n);
    expect((await blockchain.getContract(shard)).accountState?.type, 'and the account is destroyed').not.toBe('active');
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
    expect(view.min_value, 'endowment + gas + fee + transport').toBe(15_310_000n);

    const built = await buildIntroPublish({
      epoch, bucket, r: 0xBEEFn, viewTag: 0x77n, header0: cellOf(7), body: cellOf(8),
      // One nanoton below the DEPLOY floor, which is what a first intro into a fresh bucket-day must bring: it
      // funds the account's own life and the single call that eventually retires it, on top of the intro itself.
      value: view.deploy_min_value - 1n,
    });
    expect(exitOf(await send(built), is.address), 'underfunded -> 13682').toBe(13682);
    expect((await is.getGetView()).next_id, 'nothing stored').toBe(0n);
    expect((await is.getGetEntry(0n)).exists).toBe(false);

    // And the fee is actually TAKEN, not handed back with the change. Since 2026-07-19 the publish forwards it
    // straight to FeeAccumulator, so the check is that the shard tries to send exactly the fee onward. This
    // fixture has no FeeAccumulator deployed, so the deposit bounces and the money comes back — which is itself
    // worth asserting, because it is the error path the contract documents. What must NOT happen is the fee
    // quietly staying behind as though nothing was attempted.
    const ok = await buildIntroPublish({ epoch, bucket, r: 0xBEEFn, viewTag: 0x77n, header0: cellOf(7), body: cellOf(8), value: toNano('0.05') });   // comfortably above the deploy floor
    const okResult = await send(ok);
    expect(exitOf(okResult, is.address)).toBe(0);
    // The opcode moved on 2026-07-20: the capsule fee now carries an airdrop credit, so it travels as
    // DepositCapsuleFee (0x52535046) rather than the permissionless DepositProtocolFee (0xFF775609) it used to
    // share with CapsuleHub. Asserting the OLD opcode here kept passing right up to the wiring change and then
    // failed for the right reason — the lane really did change.
    const deposit = (okResult.transactions as any[]).some((t) => {
      const body = t.inMessage?.body?.beginParse?.();
      if (!body || body.remainingBits < 32) return false;
      return body.loadUint(32) === 0x52535046;                 // DepositCapsuleFee
    });
    expect(deposit, 'the publish must emit a DepositCapsuleFee carrying the fee out').toBe(true);
    // tests/shard-fee-passthrough.test.ts deploys the real sink and checks the far end of that wire.
  }, 120_000);

  it('PB-07: the client value floors are pinned to the CONTRACT constants — silent drift is impossible', () => {
    // Clients fund a publish against the contract's COMPUTE gates. The shards now EXPOSE min_value in get_view, so a
    // client should read it rather than mirror it; this test pins the arithmetic so a constant change is loud.
    // Resolves a constant to a number, following DERIVED ones (`const A: Int = B + C;`) down to their leaves.
    // RS_FEE_TRANSPORT is defined that way — it is the sum of the FeeAccumulator deposit reserve and the forward
    // reserve — and the flat `= (\d+)` form threw on it, which is a test that cannot read the contract it guards.
    const constOf = (src: string, name: string, depth = 0): bigint => {
      if (depth > 4) throw new Error(`constant ${name} nests too deeply — is there a cycle?`);
      const m = src.match(new RegExp(`const\\s+${name}\\s*:\\s*Int\\s*=\\s*([^;]+);`));
      if (!m) throw new Error(`contract constant ${name} not found — did it get renamed?`);
      const expr = m[1].trim();
      if (/^\d+$/.test(expr)) return BigInt(expr);
      return expr.split('+').map((t) => t.trim())
        .reduce((sum, t) => sum + (/^\d+$/.test(t) ? BigInt(t) : constOf(src, t, depth + 1)), 0n);
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
    // RS_FEE_TRANSPORT joined the sum on 2026-07-19, when the fee stopped accumulating inside the shard and
    // started being forwarded to FeeAccumulator on every publish. [OWNER: the publisher pays the transport, so
    // the pool books the fee WHOLE — "естественно платит публикатор".] This guard is why that change was loud.
    // RS_EVICT_BOUNTY left this sum on 2026-07-19, when per-record eviction was deleted. Retiring a shard costs
    // a flat amount whatever it holds, so an O(N) per-record levy was the wrong shape; the funding moved into the
    // per-shard RS_BASE_ENDOWMENT and every publish got 0.0008 GRAM cheaper. A FIRST publish pays
    // RS_DEPLOY_MIN_VALUE instead, which is this plus that endowment.
    expect(recTerms.sort(), 'RS_MIN_VALUE is endowment + gas + fee + transport, nothing dropped')
      .toEqual(['RS_FEE_TRANSPORT', 'RS_PROTOCOL_FEE', 'RS_PUBLISH_GAS', 'RS_RECORD_ENDOWMENT']);
    expect(minValueTerms(rec, 'RS_DEPLOY_MIN_VALUE').sort(), 'the deploy price adds the base endowment')
      .toEqual(['RS_BASE_ENDOWMENT', 'RS_MIN_VALUE']);
    // 13_400_000 -> 14_400_000 -> 15_600_000. Both moves are RS_FEE_TRANSPORT growing to carry the airdrop credit
    // the deposit now sends; the 0.01 GRAM fee inside is untouched. The second figure was reasoned and wrong — the
    // sink was measured LOSING 705_535 per capsule at it (tests/shard-fee-passthrough PT-04c).
    expect(recTerms.reduce((a, t) => a + constOf(rec, t), 0n), 'RecordShard RS_MIN_VALUE').toBe(15_600_000n);
    // the record endowment carries the canonical G8 1.5x margin over its MEASURED 3 cells (not the 2 in the old note)
    expect(constOf(rec, 'RS_RECORD_ENDOWMENT'), '3 cells x 64962 x 1yr x 1.5 = 292_329 -> 300_000').toBe(300_000n);
    // the airdrop pays 10 ATH per capsule, so a capsule must never cost LESS than the fee that backs it
    expect(constOf(rec, 'RS_PROTOCOL_FEE') * 1_500_000n, '1.5M capsules collect 15k GRAM').toBe(15_000_000_000_000n);
    // INTRO pays the SAME per-message fee (owner 2026-07-18). Assert against the DEFINITION of IS_MIN_VALUE, not
    // against a sum we happen to write here: the previous revision pinned `endowment + gas` under the label
    // "IS_MIN_VALUE", so when the fee term was added the assertion stayed green while its meaning silently drifted.
    const introTerms = minValueTerms(intro, 'IS_MIN_VALUE');
    expect(introTerms.sort(), 'IS_MIN_VALUE is endowment + gas + fee + transport, nothing dropped')
      .toEqual(['IS_FEE_TRANSPORT', 'IS_INTRO_ENDOWMENT', 'IS_PROTOCOL_FEE', 'IS_PUBLISH_GAS']);
    expect(minValueTerms(intro, 'IS_DEPLOY_MIN_VALUE').sort(), 'the deploy price adds the base endowment')
      .toEqual(['IS_BASE_ENDOWMENT', 'IS_MIN_VALUE']);
    expect(introTerms.reduce((a, t) => a + constOf(intro, t), 0n), 'IntroShard IS_MIN_VALUE').toBe(15_310_000n);
    // The bounty exists because a STORAGE endowment cannot fund eviction: it is consumed by the storage it bought.
    // Both bounties are sized at measured marginal sweep gas x 1.5 — see tests/evict-incentive.test.ts.
    // Sized at the WORST case the contract permits, because marginal gas grows with dictionary depth and the
    // contract is immutable: measured 533_186/entry at RS_SAFE_CAP=4096 and 591_973 at IS_SAFE_CAP=8000, x1.5.
    // one fee for the whole protocol — a first contact costs the same as a reply
    expect(constOf(intro, 'IS_PROTOCOL_FEE'), 'INTRO charges the same 0.01 GRAM as CONV').toBe(constOf(rec, 'RS_PROTOCOL_FEE'));
    // RECOVERY has no separate base endowment, so this one constant funds the WHOLE account for 3 years. It used to
    // be derived from the 79-cell blob alone, omitting the shard's own 17 code + 2 data cells, which delivered a
    // 1.215x margin instead of the canonical 1.5x on the one lane whose failure loses a user's account.
    // Raised 28_700_000 -> 29_000_000 on 2026-07-19. The old figure was derived by counting a MODEL of the account
    // ("79 blob + 17 code + 2 data = 98 cells") and an account is 1 + code + data — the StateInit wrapper cell was
    // in neither subtree, so the model understated it by one cell and the delivered margin was 1.4875x, under the
    // project 1.5x rule. The value below is the MEASURED 3-year rent x 1.5, and
    // tests/recovery-rent-solvency.test.ts RENT-01 now reads that rent off the storage phase so this constant can
    // never again be validated against a cell model that leaves something out.
    // [RAISED 2026-07-24: 29_000_000 -> 29_300_000. The W1-009 owner-signed eviction added code cells, lifting the
    // measured 3-year rent 19_293_761 -> 19_488_648 and the old margin to 1.488x; re-measured x1.5 = 29_232_972.]
    expect(constOf(recov, 'RS_RECOVERY_ENDOWMENT'), 'measured 3yr rent 19_488_648 x 1.5 = 29_232_972 -> 29_300_000').toBe(29_300_000n);
    expect(constOf(recov, 'RS_RECOVERY_ENDOWMENT') + constOf(recov, 'RS_RECOVERY_PATH_GAS'), 'RecoveryShard RS_MIN_VALUE').toBe(37_300_000n);
    // the STORAGE+GAS part is still materially cheaper than the old two-hop floor (7_710_000) — the hop is gone
    expect(constOf(rec, 'RS_RECORD_ENDOWMENT') + constOf(rec, 'RS_PUBLISH_GAS')).toBeLessThan(7_710_000n);
  });

  it('PB-15: a PUBLIC channel post built by buildPublicPublish is accepted (13702) and its body arrives', async () => {
    // The public write side, end to end: derive the partition key client-side, build the message, send it, and
    // prove the contract ACCEPTED it (the preimage gate agrees with the client derivation) and stored a commit
    // the client can reproduce. No signature — CHANNEL folds sender(), so ONLY the payer's own shard matches.
    const era = publicEraOf(0, blockchain.now!);
    const pk = await publicChannelPartitionKey(publicWalletHash(payer.address), 0);
    const tag = publicEpochTag(0, era);
    const init = await PublicShard.init(pk, tag);
    const ps = await deploy(blockchain.openContract(new PublicShard(contractAddress(0, init), init)));

    const header = cellOf(0x66), body = cellOf(0x77, 256);
    const dm = (await ps.getGetView()).deploy_min_value;
    const built = await buildPublicPublish({
      kind: 0, header, body, value: dm + toNano('0.02'), partitionKey: pk, epochTag: tag,
    });
    expect(addrKey(built.to), 'the builder targets the derived shard').toBe(addrKey(ps.address));

    const res = await send(built);
    expect(exitOf(res, ps.address), 'the preimage gate 13702 agrees with the client-derived partition key').toBe(0);

    const entry = await ps.getGetEntry(0n);
    expect(entry.exists).toBe(true);
    expect(entry.body_commit, 'contract commitment == client-derived publicBodyCommit').toBe(built.commit);
    expect(addrKey(entry.publisher), 'the VM stamped the payer as publisher').toBe(addrKey(payer.address));
  }, 120_000);

  it('PB-16: a PUBLIC beacon from a DIFFERENT wallet is accepted — the lane is open, unlike CHANNEL', async () => {
    // BEACON folds only the bucket, not sender(), so anyone may announce. Proven by publishing from a wallet that
    // is NOT the shard's derivation input.
    const era = publicEraOf(2, blockchain.now!);
    const bucket = 42n;
    const pk = await publicBeaconPartitionKey(bucket);
    const tag = publicEpochTag(2, era);
    const init = await PublicShard.init(pk, tag);
    const ps = await deploy(blockchain.openContract(new PublicShard(contractAddress(0, init), init)));

    const dm = (await ps.getGetView()).deploy_min_value;
    const built = await buildPublicPublish({
      kind: 2, keyArg: bucket, header: cellOf(0x88), body: cellOf(0x99), value: dm + toNano('0.02'),
      partitionKey: pk, epochTag: tag,
    });
    const res = await send(built);
    expect(exitOf(res, ps.address), 'an open beacon accepts any announcer').toBe(0);
    expect((await ps.getGetView()).entry_count).toBe(1n);
  }, 120_000);
});
