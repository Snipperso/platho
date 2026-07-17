import { describe, expect, it } from 'vitest';
import { beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { keyPairFromSeed, sign } from '@ton/crypto';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { RecoveryShard } from '../build/RecoveryShard/RecoveryShard_RecoveryShard';
import { NullifierShard } from '../build/NullifierShard/NullifierShard_NullifierShard';
import {
  recordShardAddress, introShardAddress, recoveryShardAddress, nullifierShardAddress,
  introScanAddresses, laneOf, epochOf, addrKey, LANE_COUNT,
} from '../web/shard-discovery.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// SHARD-DISCOVERY — the client computes every shard address LOCALLY and it matches where the contract deploys.
//
// This is what makes sharded discovery cost ZERO requests: no directory, no index walk — the address is a pure
// function of the shard's identity. If the client-derived address ever disagreed with the on-chain address, the
// client would look in the wrong place and see nothing. These tests pin that they agree, and that a real published
// record/intro is found at the client-computed address.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const ISSUER_SIG_DOMAIN = 0x42534931n;
const CERT_DOMAIN = 0x43414331n;
const SPEND_DOMAIN = 0x42535031n;   // "BSP1"
const FRAME_DOMAIN = 0x4E534652n;   // "NSFR"
const RECOVERY_DOMAIN = 0x42525331n;
const ROOTS = [0x21, 0x22, 0x23].map((s) => keyPairFromSeed(Buffer.alloc(32, s)));
const subkey = keyPairFromSeed(Buffer.alloc(32, 0x30));
const bufToInt = (b: Buffer): bigint => BigInt('0x' + b.toString('hex'));
const sigCell = (b: Buffer) => beginCell().storeBuffer(b).endCell();

// Mirror NullifierShard.frameBindingDigest: inner commit over all frame fields, outer hash over (serial, commit).
function frameBindingDigest(serial: bigint, kind: bigint, bucketKey: bigint, frameCommit: bigint, introBucket: bigint, introR: bigint, introViewTag: bigint): Buffer {
  const fc = bufToInt(beginCell().storeUint(FRAME_DOMAIN, 32).storeUint(kind, 8).storeUint(bucketKey, 256)
    .storeUint(frameCommit, 256).storeUint(introBucket, 32).storeUint(introR, 256).storeUint(introViewTag, 16).endCell().hash());
  return beginCell().storeUint(SPEND_DOMAIN, 32).storeUint(serial, 256).storeUint(fc, 256).endCell().hash();
}

function convSpend(spend: any, epoch: number, nonce: bigint, bucketKey: bigint, frameCommit: bigint) {
  const spendPub = bufToInt(spend.publicKey);
  const serialBuf = beginCell().storeUint(ISSUER_SIG_DOMAIN, 32).storeUint(spendPub, 256)
    .storeUint(BigInt(epoch), 32).storeUint(nonce, 64).endCell().hash();
  const serial = bufToInt(serialBuf);
  const cd = beginCell().storeUint(CERT_DOMAIN, 32).storeUint(bufToInt(subkey.publicKey), 256)
    .storeUint(BigInt(epoch - 3), 32).storeUint(BigInt(epoch + 3), 32).endCell().hash();
  const spendDigest = frameBindingDigest(serial, 1n, bucketKey, frameCommit, 0n, 0n, 0n);
  return {
    serial,
    body: {
      $$type: 'NullifierSpend' as const,
      spend_pubkey: spendPub, epoch: BigInt(epoch), nonce,
      subkey_pubkey: bufToInt(subkey.publicKey), valid_from: BigInt(epoch - 3), valid_to: BigInt(epoch + 3),
      root_idx_a: 0n, root_idx_b: 1n,
      kind: 1n, bucket_key: bucketKey, frame_commit: frameCommit,
      intro_bucket: 0n, intro_r: 0n, intro_view_tag: 0n,
      cert_sig_a: sigCell(sign(cd, ROOTS[0].secretKey)), cert_sig_b: sigCell(sign(cd, ROOTS[1].secretKey)),
      issuer_sig: sigCell(sign(serialBuf, subkey.secretKey)),
      spend_sig: sigCell(sign(spendDigest, spend.secretKey)),
    },
  };
}

describe('SHARD-DISCOVERY — client-derived addresses match the on-chain shards', () => {
  it('DISC-01: every shard address the client computes equals where the contract actually deploys', async () => {
    const bucketKey = 0xABCDEFn, epoch = 19675, introBucket = 42n, selfBucket = 0x5E1Fn, serial = 0x123456789n;

    expect(addrKey(await recordShardAddress(bucketKey, epoch)))
      .toBe(addrKey(contractAddress(0, await RecordShard.init(BigInt(bucketKey), BigInt(epoch)))));
    expect(addrKey(await introShardAddress(epoch, introBucket)))
      .toBe(addrKey(contractAddress(0, await IntroShard.init(BigInt(epoch), introBucket))));
    expect(addrKey(await recoveryShardAddress(selfBucket)))
      .toBe(addrKey(contractAddress(0, await RecoveryShard.init(BigInt(selfBucket)))));
    expect(addrKey(await nullifierShardAddress(epoch, serial)))
      .toBe(addrKey(contractAddress(0, await NullifierShard.init(BigInt(epoch), laneOf(serial)))));
  });

  it('DISC-02: laneOf and epochOf agree with the contract constants', () => {
    expect(LANE_COUNT).toBe(1_048_576n);
    expect(laneOf(0x123456789n)).toBe(0x123456789n % 1_048_576n);
    expect(epochOf(1_700_000_000)).toBe(Math.floor(1_700_000_000 / 86400));
  });

  it('DISC-03: a published CONV record is found at the client-computed RecordShard address (zero directory)', async () => {
    const blockchain = await Blockchain.create();
    blockchain.now = 1_700_000_000;
    const epoch = epochOf(blockchain.now);
    const relay = await blockchain.treasury('disc-relay');
    const bucketKey = 0xC0FFEEn, frameCommit = 0xF00Dn;

    const { serial, body } = convSpend(keyPairFromSeed(Buffer.alloc(32, 0x70)), epoch, 1n, bucketKey, frameCommit);

    // deploy the nullifier shard + the record shard (lazy) and publish
    const nsInit = await NullifierShard.init(BigInt(epoch), laneOf(serial));
    const ns = blockchain.openContract(new NullifierShard(contractAddress(0, nsInit), nsInit));
    await ns.send(relay.getSender(), { value: toNano('0.1') }, null);
    const rsInit = await RecordShard.init(BigInt(bucketKey), BigInt(epoch));
    const rs = blockchain.openContract(new RecordShard(contractAddress(0, rsInit), rsInit));
    await rs.send(relay.getSender(), { value: toNano('0.1') }, null);
    await ns.send(relay.getSender(), { value: toNano('0.2') }, body as any);

    // the CLIENT computes the record shard address from just (bucketKey, epoch) — no lookup — and reads it
    const derived = await recordShardAddress(bucketKey, epoch);
    expect(addrKey(derived)).toBe(addrKey(rs.address));
    const found = blockchain.openContract(RecordShard.fromAddress(derived));
    const rec = await found.getGetRecord(0n);
    expect(rec.exists).toBe(true);
    expect(rec.frame_commit).toBe(frameCommit);
  }, 120_000);

  it('DISC-04: the INTRO catch-up scan set is the full (epoch x bucket) grid, computed locally', async () => {
    const addrs = await introScanAddresses(100, 102, 4);   // 3 epochs x 4 buckets
    expect(addrs.length).toBe(12);
    // each is the real IntroShard address for its (epoch, bucket) — spot-check a couple
    expect(addrKey(addrs[0])).toBe(addrKey(contractAddress(0, await IntroShard.init(100n, 0n))));
    expect(addrKey(addrs[11])).toBe(addrKey(contractAddress(0, await IntroShard.init(102n, 3n))));
    // all distinct
    expect(new Set(addrs.map(addrKey)).size).toBe(12);
  });
});
