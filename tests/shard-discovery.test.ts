import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { RecoveryShard } from '../build/RecoveryShard/RecoveryShard_RecoveryShard';
import {
  recordShardAddress, introShardAddress, recoveryShardAddress,
  recordShardState, introShardState, recoveryShardState,
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

  it('DISC-05: the StateInit a publish ATTACHES hashes to the address it is SENT to, on every lane', async () => {
    // THIS GATE WAS VACUOUS AND I WROTE IT [corrected 2026-08-29]. It compared
    //   recordShardState(...).address   vs   recordShardAddress(...)
    // which since the address-only fast path landed are THE SAME EXPRESSION — both are
    // friendly(recordShardAddressBytes(...)). It could not fail. An auditor proved it by mocking
    // recordShardStateInit with its arguments swapped, leaving the address derivation correct: the gate stayed
    // green, while every first publish of a new conversation-direction would have attached an init that deploys
    // a DIFFERENT account.
    //
    // The property that actually protects delivery is this one: a shard address IS the hash of its StateInit, so
    // if the init the client attaches does not hash to the address the client sends to, the account is never
    // created. The message then lands on an uninitialised account, its compute phase is SKIPPED, nothing is
    // stored, no bounce comes back, and the wallet reports success — this project's worst failure shape, on the
    // one layer where nothing downstream can notice. Before today that property was pinned for INTRO alone
    // (wallet-internal-stateinit.test.ts, WSI-04); CONV, RECOVERY and PUBLIC had nothing.
    //
    // Checked TWO ways on purpose. Self-consistency (the init hashes to the address the client itself derives)
    // catches one half moving without the other. The cross-check against the COMPILED contract catches both
    // halves moving together, which self-consistency cannot see.
    const { computeCellHashAndDepth } = await import('../web/pwa-contract-transactions.mjs');
    const { parseTonAddress } = await import('../web/crypto/platho-crypto.mjs');
    const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

    const cases: Array<{ lane: string; state: any; onchain: string }> = [
      { lane: 'intro', state: await introShardState(20700, 7),
        onchain: contractAddress(0, (await IntroShard.fromInit(20700n, 7n)).init!).toRawString() },
      { lane: 'conv', state: await recordShardState(12345n, 20700),
        onchain: contractAddress(0, (await RecordShard.fromInit(12345n, 20700n)).init!).toRawString() },
      { lane: 'recovery', state: await recoveryShardState(999n),
        onchain: contractAddress(0, (await RecoveryShard.fromInit(999n)).init!).toRawString() },
    ];

    for (const { lane, state, onchain } of cases) {
      const { hash } = await computeCellHashAndDepth(state.init);
      expect(hex(hash), lane + ': the attached StateInit must hash to the address it is sent to')
        .toBe(hex(parseTonAddress(String(state.address)).hash));
      expect(addrKey(state.address), lane + ': and that address must be where the CONTRACT actually deploys')
        .toBe(addrKey(onchain));
    }
  });
});
