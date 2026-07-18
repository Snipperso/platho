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
    blockchain.now = 1_700_000_000;
    epoch = epochOf(blockchain.now);
    payer = await blockchain.treasury('pb-payer');
  });

  async function deploy<T>(c: SandboxContract<T>): Promise<SandboxContract<T>> {
    await (c as any).send(payer.getSender(), { value: toNano('0.05') }, null);
    return c;
  }
  const send = (built: { to: Address; value: bigint; body: any }) =>
    payer.send({ to: built.to, value: built.value, body: built.body, bounce: true } as any);

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

    // the payer sent 1 GRAM and must get almost all of it back: net cost is rent + gas, well under 0.05
    expect(before - (await payer.getBalance())).toBeLessThan(toNano('0.05'));
    // and the shard did NOT pocket the fat value
    expect((await blockchain.getContract(rs.address)).balance).toBeLessThan(toNano('0.05'));
  }, 120_000);

  it('PB-05: a RECOVERY blob is stored on chain at the owner-bound slot, and its frame hashes are now readable', async () => {
    const seed = new Uint8Array(32).fill(0x64);
    const blob = cellOf(0xAB, 128);
    const built = await buildRecoveryPublish({ seed, seq: 1, h0: 0x111n, h1: 0x222n, bh: 0x333n, body: blob, value: toNano('0.05') });

    const init = await RecoveryShard.init(built.slotKey);
    const rs = await deploy(blockchain.openContract(new RecoveryShard(contractAddress(0, init), init)));
    expect(addrKey(built.to)).toBe(addrKey(rs.address));

    expect(exitOf(await send(built), rs.address)).toBe(0);
    const v = await rs.getGetView();
    expect(v.bound).toBe(true);
    expect(v.seq).toBe(1n);
    // this lane alone stores the blob ON CHAIN, and the hashes are now exposed so the read is self-verifying
    expect(v.h0).toBe(0x111n);
    expect(v.bh).toBe(0x333n);
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
    const built = await buildRecoveryPublish({ seed, seq: 1, h0: 0x1n, h1: 0x2n, bh: 0x3n, body: oversized, value: toNano('0.1') });
    const init = await RecoveryShard.init(built.slotKey);
    const rs = await deploy(blockchain.openContract(new RecoveryShard(contractAddress(0, init), init)));

    const res = await send(built);
    // asserted SPECIFICALLY: probing at the cap would make the gate dead code and report an opaque exit 8 instead
    expect(exitOf(res, rs.address), 'oversized blob -> 13560, not a raw cell-overflow').toBe(13560);
    expect((await rs.getGetView()).bound, 'slot stays unbound — nothing was stored').toBe(false);

    // and a blob WITHIN the cap on the same (fresh) slot is accepted, so the cap is not simply rejecting everything
    const okSeed = new Uint8Array(32).fill(0x66);
    const okBuilt = await buildRecoveryPublish({ seed: okSeed, seq: 1, h0: 0x1n, h1: 0x2n, bh: 0x3n, body: cellOf(0xCD, 512), value: toNano('0.1') });
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

  it('PB-07: the client value floors are pinned to the CONTRACT constants — silent drift is impossible', () => {
    // Clients fund a publish against the contract's COMPUTE gates. The shards now EXPOSE min_value in get_view, so a
    // client should read it rather than mirror it; this test pins the arithmetic so a constant change is loud.
    const constOf = (src: string, name: string): bigint => {
      const m = src.match(new RegExp(`const\\s+${name}\\s*:\\s*Int\\s*=\\s*(\\d+)`));
      if (!m) throw new Error(`contract constant ${name} not found — did it get renamed?`);
      return BigInt(m[1]);
    };
    const rec = readFileSync('contracts/RecordShard.tact', 'utf8');
    const intro = readFileSync('contracts/IntroShard.tact', 'utf8');
    const recov = readFileSync('contracts/RecoveryShard.tact', 'utf8');

    // RS_MIN_VALUE = rent + gas + the 0.01 GRAM protocol fee. The fee is the other half of the airdrop economics
    // (1.5M capsules -> 15M ATH out, 15k GRAM in) and is what keeps publishing from being cheaper than the reward.
    expect(constOf(rec, 'RS_PROTOCOL_FEE'), 'the service fee is 0.01 GRAM, as in the deleted CreditSale').toBe(10_000_000n);
    expect(constOf(rec, 'RS_RECORD_ENDOWMENT') + constOf(rec, 'RS_PUBLISH_GAS') + constOf(rec, 'RS_PROTOCOL_FEE'),
      'RecordShard RS_MIN_VALUE').toBe(12_700_000n);
    // the airdrop pays 10 ATH per capsule, so a capsule must never cost LESS than the fee that backs it
    expect(constOf(rec, 'RS_PROTOCOL_FEE') * 1_500_000n, '1.5M capsules collect 15k GRAM').toBe(15_000_000_000_000n);
    expect(constOf(intro, 'IS_INTRO_ENDOWMENT') + constOf(intro, 'IS_PUBLISH_GAS'), 'IntroShard IS_MIN_VALUE').toBe(2_508_000n);
    expect(constOf(recov, 'RS_RECOVERY_ENDOWMENT') + constOf(recov, 'RS_RECOVERY_PATH_GAS'), 'RecoveryShard RS_MIN_VALUE').toBe(31_200_000n);
    // the STORAGE+GAS part is still materially cheaper than the old two-hop floor (7_710_000) — the hop is gone
    expect(constOf(rec, 'RS_RECORD_ENDOWMENT') + constOf(rec, 'RS_PUBLISH_GAS')).toBeLessThan(7_710_000n);
  });
});
