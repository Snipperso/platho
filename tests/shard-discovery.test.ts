import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { RecoveryShard } from '../build/RecoveryShard/RecoveryShard_RecoveryShard';
import {
  recordShardAddress, introShardAddress, recoveryShardAddress,
  introScanAddresses, epochOf, addrKey,
} from '../web/shard-discovery.mjs';
import { buildConvPublish } from '../web/publish-builder.mjs';
import { ed25519 } from '@noble/curves/ed25519.js';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// SHARD-DISCOVERY — the client computes every shard address LOCALLY and it matches where the contract deploys.
//
// This is what makes sharded discovery cost ZERO requests: no directory, no index walk — the address is a pure
// function of the shard's identity. If the client-derived address ever disagreed with the on-chain address, the
// client would look in the wrong place and see nothing. These tests pin that they agree, and that a real published
// record is found at the client-computed address.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('SHARD-DISCOVERY — client-derived addresses match the on-chain shards', () => {
  it('DISC-01: every shard address the client computes equals where the contract actually deploys', async () => {
    const bucketKey = 0xABCDEFn, epoch = 19675, introBucket = 42n, selfBucket = 0x5E1Fn;

    expect(addrKey(await recordShardAddress(bucketKey, epoch)))
      .toBe(addrKey(contractAddress(0, await RecordShard.init(BigInt(bucketKey), BigInt(epoch)))));
    expect(addrKey(await introShardAddress(epoch, introBucket)))
      .toBe(addrKey(contractAddress(0, await IntroShard.init(BigInt(epoch), introBucket))));
    expect(addrKey(await recoveryShardAddress(selfBucket)))
      .toBe(addrKey(contractAddress(0, await RecoveryShard.init(BigInt(selfBucket)))));
  });

  it('DISC-02: epochOf matches the contract day-epoch convention', () => {
    expect(epochOf(1_700_000_000)).toBe(Math.floor(1_700_000_000 / 86400));
    expect(epochOf(86_400)).toBe(1);
  });

  it('DISC-03: a directly-published CONV record is found at the client-computed address (zero directory)', async () => {
    const blockchain = await Blockchain.create();
    blockchain.now = 1_700_000_000;
    const epoch = epochOf(blockchain.now);
    const payer = await blockchain.treasury('disc-payer');
    const writeSecret = new Uint8Array(32).fill(0x71);
    const writePublicKey = ed25519.getPublicKey(writeSecret);
    const bucketKey = BigInt('0x' + Buffer.from(writePublicKey).toString('hex'));

    // deploy the record shard lazily, then publish straight to it (direct-paid: no token, no relay)
    const init = await RecordShard.init(bucketKey, BigInt(epoch));
    const rs = blockchain.openContract(new RecordShard(contractAddress(0, init), init));
    await rs.send(payer.getSender(), { value: toNano('0.05') }, null);

    const h0 = beginCell().storeUint(0x11, 32).endCell();
    const h1 = beginCell().storeUint(0x22, 32).endCell();
    const body = beginCell().storeBuffer(Buffer.alloc(127, 0x33)).storeRef(beginCell().storeBuffer(Buffer.alloc(1, 0x34)).endCell()).endCell();
    const built = await buildConvPublish({ writePublicKey, writeSecret, seq: 1, epoch, header0: h0, header1: h1, body, value: toNano('0.02') });
    await payer.send({ to: built.to, value: built.value, body: built.body, bounce: true } as any);

    // the CLIENT computes the address from just (bucketKey, epoch) — no lookup — and reads the record there
    const derived = await recordShardAddress(bucketKey, epoch);
    expect(addrKey(derived)).toBe(addrKey(rs.address));
    const found = blockchain.openContract(RecordShard.fromAddress(Address.parse(String(derived))));
    const rec = await found.getGetRecord(0n);
    expect(rec.exists).toBe(true);
    expect(rec.frame_commit).toBe(built.commit);
  }, 120_000);

  it('DISC-04: the INTRO catch-up scan set is the full (epoch x bucket) grid, computed locally', async () => {
    const addrs = await introScanAddresses(100, 102, 4);   // 3 epochs x 4 buckets
    expect(addrs.length).toBe(12);
    expect(addrKey(addrs[0])).toBe(addrKey(contractAddress(0, await IntroShard.init(100n, 0n))));
    expect(addrKey(addrs[11])).toBe(addrKey(contractAddress(0, await IntroShard.init(102n, 3n))));
    expect(new Set(addrs.map(addrKey)).size).toBe(12);
  });
});
