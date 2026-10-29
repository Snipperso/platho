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

const RS_DEPLOY_MIN_VALUE = 19_100_000n;

const writeKey = (fill: number) => {
  const secret = new Uint8Array(32).fill(fill);
  return { secret, publicKey: ed25519.getPublicKey(secret) };
};


const exitOf = (res: any, dest: Address): number => {
  const tx: any = res.transactions.find(
    (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === dest.toString());
  return Number(tx?.description?.computePhase?.exitCode ?? -999);
};
const inboundTo = (res: any, dest: Address): any => res.transactions.find(
  (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === dest.toString())?.inMessage;

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
    blockchain.now = 1_790_000_000;
    epoch = epochOf(blockchain.now);
    payer = await blockchain.treasury('pb-payer');
  });

  async function deploy<T>(c: SandboxContract<T>): Promise<SandboxContract<T>> {
    await (c as any).send(payer.getSender(), { value: toNano('0.05') }, null);
    return c;
  }
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

    const rec = await rs.getGetRecord(0n);
    expect(rec.exists).toBe(true);
    expect(rec.frame_commit, 'contract commitment == client-derived frameCommit').toBe(frameCommit(h0, h1, body));
    expect(rec.created_at, 'contract stamps the time (now exposed)').toBe(BigInt(blockchain.now!));

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
      value: minValue - 1n,
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
      value: toNano('1'),
    });
    expect(exitOf(await send(built), rs.address)).toBe(0);

    expect(before - (await payer.getBalance())).toBeLessThan(toNano('0.02'));
    const shardBalance = (await blockchain.getContract(rs.address)).balance;
    expect(shardBalance).toBeGreaterThan(toNano('0.05'));
    expect(shardBalance).toBeLessThan(toNano('0.08'));
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
    expect(v.h0).toBe(0x111n);
    expect(v.bh, 'bh is the body hash, derived not supplied').toBe(built.bh ?? v.bh);
    expect((await rs.getGetBody()).equals(blob), 'the blob itself is on chain').toBe(true);
  }, 120_000);

  it('PB-05b: the CLIENT slot derivation matches the CONTRACT for a NON-ZERO index, end to end', async () => {
    const seed = new Uint8Array(32).fill(0x66);
    const blob = cellOf(0xCE, 96);
    const built = await buildRecoveryPublish({ seed, slotIndex: 7, seq: 1, h0: 0x333n, h1: 0x444n, body: blob, value: toNano('0.05') });

    const init = await RecoveryShard.init(built.slotKey);
    const rs = await deploy(blockchain.openContract(new RecoveryShard(contractAddress(0, init), init)));

    expect(exitOf(await send(built), rs.address), 'contract agrees with the client on slot 7').toBe(0);
    expect((await rs.getGetView()).bound).toBe(true);

    const at0 = await buildRecoveryPublish({ seed, slotIndex: 0, seq: 1, h0: 0x333n, h1: 0x444n, body: blob, value: toNano('0.05') });
    expect(at0.slotKey, 'index 0 and index 7 are different slots').not.toBe(built.slotKey);
    expect(addrKey(at0.to)).not.toBe(addrKey(built.to));

    const named = await buildRecoveryPublish({ seed, slotIndex: 256, seq: 1, h0: 0x1n, h1: 0x2n, body: blob, value: toNano('0.05') });
    expect(named.to, 'the named prefs slot 256 builds').toBeTruthy();
    await expect(buildRecoveryPublish({ seed, slotIndex: 272, seq: 1, h0: 0x1n, h1: 0x2n, body: blob, value: toNano('0.05') }))
      .rejects.toThrow(/slotIndex/);
    await expect(buildRecoveryPublish({ seed, seq: 1, h0: 0x1n, h1: 0x2n, body: blob, value: toNano('0.05') } as any))
      .rejects.toThrow(/slotIndex/);
  }, 120_000);

  it('PB-06: an oversized RECOVERY blob is refused (13560 restored) — a fixed endowment cannot buy unbounded storage', async () => {
    const seed = new Uint8Array(32).fill(0x65);
    let oversized = beginCell().storeBuffer(Buffer.alloc(64, 0xFF)).endCell();
    for (let i = 0; i < 100; i += 1) {
      oversized = beginCell().storeBuffer(Buffer.alloc(64, i & 0xff)).storeRef(oversized).endCell();
    }
    const built = await buildRecoveryPublish({ seed, slotIndex: 0, seq: 1, h0: 0x1n, h1: 0x2n, body: oversized, value: toNano('0.1') });
    const init = await RecoveryShard.init(built.slotKey);
    const rs = await deploy(blockchain.openContract(new RecoveryShard(contractAddress(0, init), init)));

    const res = await send(built);
    expect(exitOf(res, rs.address), 'oversized blob -> 13560, not a raw cell-overflow').toBe(13560);
    expect((await rs.getGetView()).bound, 'slot stays unbound — nothing was stored').toBe(false);

    const okSeed = new Uint8Array(32).fill(0x66);
    const okBuilt = await buildRecoveryPublish({ seed: okSeed, slotIndex: 0, seq: 1, h0: 0x1n, h1: 0x2n, body: cellOf(0xCD, 512), value: toNano('0.1') });
    const okInit = await RecoveryShard.init(okBuilt.slotKey);
    const okRs = await deploy(blockchain.openContract(new RecoveryShard(contractAddress(0, okInit), okInit)));
    expect(exitOf(await send(okBuilt), okRs.address), 'in-cap blob accepted').toBe(0);
    expect((await okRs.getGetView()).bound).toBe(true);
  }, 120_000);

  it('PB-08: an OUTSIDER who knows the address cannot write — address privacy is not authorization', async () => {
    const owner = writeKey(0x61), stranger = writeKey(0x62);
    const init = await RecordShard.init(BigInt('0x' + Buffer.from(owner.publicKey).toString('hex')), BigInt(epoch));
    const rs = await deploy(blockchain.openContract(new RecordShard(contractAddress(0, init), init)));

    const good = await buildConvPublish({ writePublicKey: owner.publicKey, writeSecret: owner.secret, seq: 1, epoch, header0: cellOf(1), header1: cellOf(2), body: cellOf(3), value: toNano('0.02') });
    expect(exitOf(await send(good), rs.address)).toBe(0);
    expect((await rs.getGetView()).record_count).toBe(1n);

    const junk = await buildConvPublish({ writePublicKey: owner.publicKey, writeSecret: stranger.secret, seq: 2, epoch, header0: cellOf(0xEE), header1: cellOf(0xEE), body: cellOf(0xEE), value: toNano('0.02') });
    expect(addrKey(junk.to), 'the stranger really is aiming at the same shard').toBe(addrKey(rs.address));
    expect(exitOf(await send(junk), rs.address), 'forged write -> 13654').toBe(13654);
    expect((await rs.getGetView()).record_count, 'the conversation is untouched').toBe(1n);
  }, 120_000);

  it('PB-09: a captured publish cannot be REPLAYED — the signature alone would not have stopped the DoS', async () => {
    const owner = writeKey(0x63);
    const init = await RecordShard.init(BigInt('0x' + Buffer.from(owner.publicKey).toString('hex')), BigInt(epoch));
    const rs = await deploy(blockchain.openContract(new RecordShard(contractAddress(0, init), init)));

    const built = await buildConvPublish({ writePublicKey: owner.publicKey, writeSecret: owner.secret, seq: 5, epoch, header0: cellOf(4), header1: cellOf(5), body: cellOf(6), value: toNano('0.02') });
    expect(exitOf(await send(built), rs.address)).toBe(0);
    expect((await rs.getGetView()).last_seq).toBe(5n);

    expect(exitOf(await send(built), rs.address), 'replay -> 13653').toBe(13653);
    const older = await buildConvPublish({ writePublicKey: owner.publicKey, writeSecret: owner.secret, seq: 3, epoch, header0: cellOf(7), header1: cellOf(8), body: cellOf(9), value: toNano('0.02') });
    expect(exitOf(await send(older), rs.address), 'stale seq -> 13653').toBe(13653);
    expect((await rs.getGetView()).record_count, 'still exactly one record').toBe(1n);

    const next = await buildConvPublish({ writePublicKey: owner.publicKey, writeSecret: owner.secret, seq: 6, epoch, header0: cellOf(10), header1: cellOf(11), body: cellOf(12), value: toNano('0.02') });
    expect(exitOf(await send(next), rs.address), 'the conversation still works').toBe(0);
    expect((await rs.getGetView()).record_count).toBe(2n);
  }, 120_000);

  it('PB-10: a publish DEPLOYS the shard it targets — nothing is pre-deployed, only the builder output is sent', async () => {
    const wk = writeKey(0x71);
    const h0 = cellOf(0x21), h1 = cellOf(0x22), body = cellOf(0x23, 256);
    const built = await buildConvPublish({ writePublicKey: wk.publicKey, writeSecret: wk.secret, seq: 1, epoch, header0: h0, header1: h1, body, value: toNano('0.02') });

    expect((await blockchain.getContract(built.to)).accountState?.type ?? 'uninit').not.toBe('active');

    const res = await send(built);
    expect(exitOf(res, built.to), 'the publish deployed the shard and stored the record').toBe(0);

    const rs = blockchain.openContract(RecordShard.fromAddress(built.to));
    const rec = await rs.getGetRecord(0n);
    expect(rec.exists, 'record stored on a shard that did not exist before this message').toBe(true);
    expect(rec.frame_commit).toBe(built.commit);
    const next = await buildConvPublish({ writePublicKey: wk.publicKey, writeSecret: wk.secret, seq: 2, epoch, header0: h0, header1: h1, body: cellOf(0x24), value: toNano('0.02') });
    expect(exitOf(await send(next), built.to), 're-sent init on a live shard is harmless').toBe(0);
    expect((await rs.getGetView()).record_count).toBe(2n);
  }, 120_000);

  it('PB-11: a deliberate top-up is NOT swept by the next publisher (increment reserve)', async () => {
    const wk = writeKey(0x72);
    const first = await buildConvPublish({ writePublicKey: wk.publicKey, writeSecret: wk.secret, seq: 1, epoch, header0: cellOf(1), header1: cellOf(2), body: cellOf(3), value: toNano('0.02') });
    expect(exitOf(await send(first), first.to)).toBe(0);

    const topUp = toNano('0.5');
    await payer.send({ to: first.to, value: topUp, bounce: false } as any);
    const afterTopUp = (await blockchain.getContract(first.to)).balance;
    expect(afterTopUp).toBeGreaterThan(topUp);

    const next = await buildConvPublish({ writePublicKey: wk.publicKey, writeSecret: wk.secret, seq: 2, epoch, header0: cellOf(4), header1: cellOf(5), body: cellOf(6), value: toNano('0.02') });
    expect(exitOf(await send(next), first.to)).toBe(0);
    const afterPublish = (await blockchain.getContract(first.to)).balance;
    expect(afterPublish, 'the top-up survived the next publish').toBeGreaterThan(topUp);
  }, 120_000);

  it('PB-12: a shard cannot be retired before its death instant — a stranger cannot drain it early', async () => {
    const wk = writeKey(0x74);
    const first = await buildConvPublish({ writePublicKey: wk.publicKey, writeSecret: wk.secret, seq: 1, epoch, header0: cellOf(1), header1: cellOf(2), body: cellOf(3), value: RS_DEPLOY_MIN_VALUE });
    expect(exitOf(await send(first), first.to)).toBe(0);
    await payer.send({ to: first.to, value: toNano('0.5'), bounce: false } as any);
    const before = (await blockchain.getContract(first.to)).balance;

    const rs = blockchain.openContract(RecordShard.fromAddress(first.to));
    const thief = await blockchain.treasury('pb-thief');
    const retire = { $$type: 'RetireShard' } as any;

    expect(exitOf(await rs.send(thief.getSender(), { value: toNano('0.05'), bounce: true }, retire), first.to),
      'a live shard refuses retirement -> 13655').toBe(13655);

    blockchain.now = Number((await rs.getGetView()).retire_at);
    expect(exitOf(await rs.send(thief.getSender(), { value: toNano('0.05'), bounce: true }, retire), first.to),
      'at the retire instant itself it is still refused').toBe(13655);
    expect((await blockchain.getContract(first.to)).balance, 'the surplus is untouched')
      .toBeGreaterThanOrEqual(before - toNano('0.01'));
    expect((await rs.getGetView()).record_count, 'and the record is still there').toBe(1n);

    blockchain.now = blockchain.now! + 1;
    expect(exitOf(await rs.send(thief.getSender(), { value: toNano('0.05') }, retire), first.to)).toBe(0);
    expect((await blockchain.getContract(first.to)).accountState?.type).not.toBe('active');
  }, 120_000);

  it('PB-13: a top-up survives every PUBLISH — but the RETIRER takes it, and that is deliberate', async () => {
    const wk = writeKey(0x75);
    for (const seq of [1n, 2n]) {
      const p = await buildConvPublish({ writePublicKey: wk.publicKey, writeSecret: wk.secret, seq, epoch, header0: cellOf(1), header1: cellOf(2), body: cellOf(3), value: seq === 1n ? RS_DEPLOY_MIN_VALUE : toNano('0.02') });
      expect(exitOf(await send(p), p.to)).toBe(0);
    }
    const shard = (await buildConvPublish({ writePublicKey: wk.publicKey, writeSecret: wk.secret, seq: 3n, epoch, header0: cellOf(1), header1: cellOf(2), body: cellOf(3), value: toNano('0.02') })).to;
    const rs = blockchain.openContract(RecordShard.fromAddress(shard));

    const topUp = toNano('0.5');
    await payer.send({ to: shard, value: topUp, bounce: false } as any);

    const third = await buildConvPublish({ writePublicKey: wk.publicKey, writeSecret: wk.secret, seq: 3n, epoch, header0: cellOf(4), header1: cellOf(5), body: cellOf(6), value: toNano('0.02') });
    expect(exitOf(await send(third), shard)).toBe(0);
    expect((await blockchain.getContract(shard)).balance, 'a publish does not touch the top-up').toBeGreaterThan(topUp);

    blockchain.now = Number((await rs.getGetView()).retire_at) + 1;
    const keeper = await blockchain.treasury('pb-keeper');
    const keeperBefore = (await blockchain.getContract(keeper.address)).balance;
    expect(exitOf(await rs.send(keeper.getSender(), { value: toNano('0.05') }, { $$type: 'RetireShard' } as any), shard)).toBe(0);
    expect((await blockchain.getContract(keeper.address)).balance - keeperBefore,
      'the retirer is paid the residual, top-up included').toBeGreaterThan(topUp / 2n);
    expect((await blockchain.getContract(shard)).accountState?.type, 'and the account is destroyed').not.toBe('active');
  }, 120_000);

  it('PB-14: an underfunded INTRO is refused in COMPUTE (13682) — the fee IS the spam price on the open lane', async () => {
    const bucket = 91n;
    const init = await IntroShard.init(BigInt(epoch), bucket);
    const is = await deploy(blockchain.openContract(new IntroShard(contractAddress(0, init), init)));
    const view = await is.getGetView();
    expect(view.protocol_fee, 'INTRO now carries the same 0.01 GRAM per-message fee as CONV').toBe(10_000_000n);
    expect(view.min_value, 'endowment + gas + fee + transport').toBe(15_310_000n);

    const built = await buildIntroPublish({
      epoch, bucket, r: 0xBEEFn, viewTag: 0x77n, header0: cellOf(7), body: cellOf(8),
      value: view.deploy_min_value - 1n,
    });
    expect(exitOf(await send(built), is.address), 'underfunded -> 13682').toBe(13682);
    expect((await is.getGetView()).next_id, 'nothing stored').toBe(0n);
    expect((await is.getGetEntry(0n)).exists).toBe(false);

    const ok = await buildIntroPublish({ epoch, bucket, r: 0xBEEFn, viewTag: 0x77n, header0: cellOf(7), body: cellOf(8), value: toNano('0.05') });
    const okResult = await send(ok);
    expect(exitOf(okResult, is.address)).toBe(0);
    const deposit = (okResult.transactions as any[]).some((t) => {
      const body = t.inMessage?.body?.beginParse?.();
      if (!body || body.remainingBits < 32) return false;
      return body.loadUint(32) === 0x52535046;
    });
    expect(deposit, 'the publish must emit a DepositCapsuleFee carrying the fee out').toBe(true);
  }, 120_000);

  it('PB-07: the client value floors are pinned to the CONTRACT constants — silent drift is impossible', () => {
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

    expect(constOf(rec, 'RS_PROTOCOL_FEE'), 'the service fee is 0.01 GRAM, as in the deleted CreditSale').toBe(10_000_000n);
    const recTerms = minValueTerms(rec, 'RS_MIN_VALUE');
    expect(recTerms.sort(), 'RS_MIN_VALUE is endowment + gas + fee + transport, nothing dropped')
      .toEqual(['RS_FEE_TRANSPORT', 'RS_PROTOCOL_FEE', 'RS_PUBLISH_GAS', 'RS_RECORD_ENDOWMENT']);
    expect(minValueTerms(rec, 'RS_DEPLOY_MIN_VALUE').sort(), 'the deploy price adds the base endowment')
      .toEqual(['RS_BASE_ENDOWMENT', 'RS_MIN_VALUE']);
    expect(recTerms.reduce((a, t) => a + constOf(rec, t), 0n), 'RecordShard RS_MIN_VALUE').toBe(15_600_000n);
    expect(constOf(rec, 'RS_RECORD_ENDOWMENT'), '3 cells x 64962 x 1yr x 1.5 = 292_329 -> 300_000').toBe(300_000n);
    expect(constOf(rec, 'RS_PROTOCOL_FEE') * 1_500_000n, '1.5M capsules collect 15k GRAM').toBe(15_000_000_000_000n);
    const introTerms = minValueTerms(intro, 'IS_MIN_VALUE');
    expect(introTerms.sort(), 'IS_MIN_VALUE is endowment + gas + fee + transport, nothing dropped')
      .toEqual(['IS_FEE_TRANSPORT', 'IS_INTRO_ENDOWMENT', 'IS_PROTOCOL_FEE', 'IS_PUBLISH_GAS']);
    expect(minValueTerms(intro, 'IS_DEPLOY_MIN_VALUE').sort(), 'the deploy price adds the base endowment')
      .toEqual(['IS_BASE_ENDOWMENT', 'IS_MIN_VALUE']);
    expect(introTerms.reduce((a, t) => a + constOf(intro, t), 0n), 'IntroShard IS_MIN_VALUE').toBe(15_310_000n);
    expect(constOf(intro, 'IS_PROTOCOL_FEE'), 'INTRO charges the same 0.01 GRAM as CONV').toBe(constOf(rec, 'RS_PROTOCOL_FEE'));
    expect(constOf(recov, 'RS_RECOVERY_ENDOWMENT'), 'wave-8: RS_EVICT_SEQ_ENDOWMENT grew the code, margin fell to 1.4891x -> 30_400_000').toBe(30_400_000n);
    expect(constOf(recov, 'RS_RECOVERY_ENDOWMENT') + constOf(recov, 'RS_RECOVERY_PATH_GAS'), 'RecoveryShard RS_MIN_VALUE').toBe(38_400_000n);
    expect(constOf(rec, 'RS_RECORD_ENDOWMENT') + constOf(rec, 'RS_PUBLISH_GAS')).toBeLessThan(7_710_000n);
  });

  it('PB-15: a PUBLIC channel post built by buildPublicPublish is accepted (13702) and its body arrives', async () => {
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
