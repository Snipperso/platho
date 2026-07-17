import { describe, expect, it } from 'vitest';
import { beginCell, toNano } from '@ton/core';
import { webcrypto } from 'crypto';
import {
  KIND_PUBLIC,
  OP_CAPSULE_HUB_BATCH_ACK,
  computeEntryPublishId,
  marketingCell,
  hubTxExit,
} from './helpers/vpb2';
import {
  convPartToken,
  publicPartToken,
  anonBatch,
  spendKey,
  deployAnonReady,
} from './helpers/anon';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

// clean-16 B3 migration of the CapsuleHub batch-ingest core (spec 5.2) onto the permissionless PublishAnonBatch path
// that REPLACED the old Vault-forwarded PublishBatchToHub (op 0xA4F862D1, now removed). Every part is now published
// only if its parallel spend-token verifies (issuer_sig over the serial + spend_sig over the frame) and a prepaid pool
// credit for the token's epoch exists; the relay is ANY treasury (permissionless). The validate-all-then-commit-all
// storage, the per-entry EPI1 publish_id, and the CapsuleHubBatchAck reply are UNCHANGED — only the ACK now goes to the
// relay (the arbitrary sender) rather than the bound Vault, and the batch publish_id is supplied directly (it is only
// required to be non-zero and seeds the EPI1 per-entry id).

// A non-zero batch publish_id, used directly as the EPI1 seed (the Hub only requires it != 0).
const BATCH_PUBLISH_ID = 0x9999000000000000000000000000000000000000000000000000000000009999n;

describe('CapsuleHub VPB2: batch ingest (Session 4) — B3 anon path', () => {
  it('HUB-BATCH-01: ingests a 1-part private batch — stores the entry with the EPI1 publish_id and ACKs the relay', async () => {
    const { blockchain, hub, issuer, slot, nowEpoch } = await deployAnonReady({ credits: 1n });
    const relay = await blockchain.treasury('hub-batch-relay-01');

    const pt = convPartToken({ issuer, spend: spendKey(0), slot, epoch: nowEpoch, nonce: 101n });
    const res = await hub.send(relay.getSender(), { value: toNano('0.2') },
      anonBatch({ parts: pt.part, tokens: pt.tok, partCount: 1n, publishId: BATCH_PUBLISH_ID }));
    expect(hubTxExit(res, hub)).toBe(0);

    // Entry stored at id 0 with the derived per-entry publish_id (EPI1), counters advanced.
    const entry = await hub.getGetPrivateEntry(0n);
    expect(entry.exists).toBe(true);
    expect(entry.publish_id).toBe(computeEntryPublishId(BATCH_PUBLISH_ID, 0));
    const state = await hub.getGetState();
    expect(state.private_latest_id).toBe(1n);
    expect(state.private_live_count).toBe(1n);

    // The Hub ACKs the RELAY (permissionless sender) with CapsuleHubBatchAck (first_entry_id = 0).
    const ackTx = res.transactions.find((t: any) =>
      t.inMessage?.info?.type === 'internal' &&
      t.inMessage.info.dest?.toString() === relay.address.toString() &&
      t.inMessage.body && t.inMessage.body.beginParse().remainingBits >= 32);
    expect(ackTx).toBeDefined();
    const ackBody = ackTx!.inMessage!.body.beginParse();
    expect(ackBody.loadUint(32)).toBe(Number(OP_CAPSULE_HUB_BATCH_ACK));
    expect(ackBody.loadUintBig(256)).toBe(BATCH_PUBLISH_ID); // publish_id
    expect(ackBody.loadUintBig(64)).toBe(0n);                // first_entry_id
    expect(ackBody.loadUint(8)).toBe(1);                     // part_count
  });

  // REMOVED (clean-16 B3): HUB-BATCH-02 asserted the 13500 sender==vault gate. The publish path is now permissionless
  // (any relay treasury can submit a valid spend-token batch), so there is no such gate to test. Relay-permissionlessness
  // is covered by capsulehub-anon-spend.test.ts (HUB-PERM-01).

  it('HUB-BATCH-03: ingests a 1-part public batch (marketing marker required) and stores a public entry', async () => {
    const { blockchain, hub, issuer, slot, nowEpoch } = await deployAnonReady({ credits: 1n });
    const relay = await blockchain.treasury('hub-batch-relay-03');

    const pt = publicPartToken({ issuer, spend: spendKey(0), slot, epoch: nowEpoch, nonce: 103n });
    await hub.send(relay.getSender(), { value: toNano('0.3') }, anonBatch({
      parts: pt.part, tokens: pt.tok, partCount: 1n, kind: KIND_PUBLIC,
      marketing: marketingCell(), publishId: BATCH_PUBLISH_ID,
    }));
    const entry = await hub.getGetPublicEntry(0n);
    expect(entry.exists).toBe(true);
    expect(entry.publish_id).toBe(computeEntryPublishId(BATCH_PUBLISH_ID, 0));
    expect((await hub.getGetState()).public_latest_id).toBe(1n);
  });

  it('HUB-BATCH-04: a 3-part private batch stores 3 sequential entries, each with its own EPI1 publish_id', async () => {
    const { blockchain, hub, issuer, slot, nowEpoch } = await deployAnonReady({ credits: 3n });
    const relay = await blockchain.treasury('hub-batch-relay-04');

    // A 3-part linked CONV chain (built tail-first). Each part uses a DISTINCT spend key + nonce → distinct serial.
    const p2 = convPartToken({ issuer, spend: spendKey(2), slot, epoch: nowEpoch, nonce: 402n, fill: 2, next: null });
    const p1 = convPartToken({ issuer, spend: spendKey(1), slot, epoch: nowEpoch, nonce: 401n, fill: 1, next: p2 });
    const p0 = convPartToken({ issuer, spend: spendKey(0), slot, epoch: nowEpoch, nonce: 400n, fill: 0, next: p1 });

    const res = await hub.send(relay.getSender(), { value: toNano('0.5') },
      anonBatch({ parts: p0.part, tokens: p0.tok, partCount: 3n, publishId: BATCH_PUBLISH_ID }));
    expect(hubTxExit(res, hub)).toBe(0);

    for (let i = 0; i < 3; i += 1) {
      const e = await hub.getGetPrivateEntry(BigInt(i));
      expect(e.exists).toBe(true);
      expect(e.publish_id).toBe(computeEntryPublishId(BATCH_PUBLISH_ID, i));
    }
    const state = await hub.getGetState();
    expect(state.private_latest_id).toBe(3n);
    expect(state.private_live_count).toBe(3n);
  });

  it('HUB-BATCH-05: a grossly underfunded batch bounces in Phase A (13509) before the walk; nothing stored', async () => {
    const { blockchain, hub, issuer, slot, nowEpoch } = await deployAnonReady({ credits: 1n });
    const relay = await blockchain.treasury('hub-batch-relay-05');

    const pt = convPartToken({ issuer, spend: spendKey(0), slot, epoch: nowEpoch, nonce: 105n });
    // value < part_count * HUB_MIN_PER_PART_VALUE (1M) + CAPSULEHUB_ACK_FORWARD_RESERVE (30M) = 0.031 TON.
    const res = await hub.send(relay.getSender(), { value: toNano('0.025') },
      anonBatch({ parts: pt.part, tokens: pt.tok, partCount: 1n, publishId: BATCH_PUBLISH_ID }));
    expect(hubTxExit(res, hub)).toBe(13509);
    expect((await hub.getGetState()).private_latest_id).toBe(0n); // nothing stored
  });

  it('HUB-BATCH-06: a malformed part (wrong bit width) aborts the whole batch (13510); nothing stored', async () => {
    const { blockchain, hub, issuer, slot, nowEpoch } = await deployAnonReady({ credits: 1n });
    const relay = await blockchain.treasury('hub-batch-relay-06');

    // A VALID token (verifyIssuerToken passes first), but a malformed part frame → CONV lane-parse rejects 13510
    // (before the spend_sig check, so the token need only pass issuer verification).
    const pt = convPartToken({ issuer, spend: spendKey(0), slot, epoch: nowEpoch, nonce: 106n });
    const malformed = beginCell().storeUint(0, 100).endCell();
    const res = await hub.send(relay.getSender(), { value: toNano('0.2') },
      anonBatch({ parts: malformed, tokens: pt.tok, partCount: 1n, publishId: BATCH_PUBLISH_ID }));
    expect(hubTxExit(res, hub)).toBe(13510);
    expect((await hub.getGetState()).private_latest_id).toBe(0n);
  });
});
