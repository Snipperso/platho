import { describe, expect, it } from 'vitest';
import { beginCell, toNano } from '@ton/core';
import {
  KIND_PRIVATE,
  KIND_PUBLIC,
  OP_CAPSULE_HUB_BATCH_ACK,
  computeEntryPublishId,
  marketingCell,
  partsList,
  setupHub,
  hubTxExit,
} from './helpers/vpb2';

// VPB2 Session 4 — CapsuleHub batch ingest core (spec 5.2). Drives the Hub directly from the bound Vault
// address with a PublishBatchToHub (the exact wire format the Vault forwards) and checks validate-all-then-
// commit-all storage + the per-entry EPI1 publish_id + the CapsuleHubBatchAck reply.

const BATCH_PUBLISH_ID = 0x9999000000000000000000000000000000000000000000000000000000009999n;
const privatePartCell = () => partsList(KIND_PRIVATE, 1);

describe('CapsuleHub VPB2: batch ingest (Session 4)', () => {
  it('HUB-BATCH-01: ingests a 1-part private batch — stores the entry with the EPI1 publish_id and ACKs the Vault', async () => {
    const { hub, vault } = await setupHub();

    const res = await hub.send(vault.getSender(), { value: toNano('0.1') }, {
      $$type: 'PublishBatchToHub',
      bounce_id: 1n,
      bounce_tag: 2n,
      publish_id: BATCH_PUBLISH_ID,
      publish_kind: KIND_PRIVATE,
      part_count: 1n,
      protocol_fee_total: 0n,
      author_wallet: vault.address,
      parts: privatePartCell(),
      marketing: null,
    } as any);

    // Entry stored at id 0 with the derived per-entry publish_id (EPI1), counters advanced.
    const entry = await hub.getGetPrivateEntry(0n);
    expect(entry.exists).toBe(true);
    expect(entry.publish_id).toBe(computeEntryPublishId(BATCH_PUBLISH_ID, 0));
    const state = await hub.getGetState();
    expect(state.private_latest_id).toBe(1n);
    expect(state.private_live_count).toBe(1n);

    // The Hub ACKs the Vault with CapsuleHubBatchAck (first_entry_id = 0).
    const ackTx = res.transactions.find((t: any) =>
      t.inMessage?.info?.type === 'internal' &&
      t.inMessage.info.dest?.toString() === vault.address.toString() &&
      t.inMessage.body && t.inMessage.body.beginParse().remainingBits >= 32);
    expect(ackTx).toBeDefined();
    const ackBody = ackTx!.inMessage!.body.beginParse();
    expect(ackBody.loadUint(32)).toBe(Number(OP_CAPSULE_HUB_BATCH_ACK));
    expect(ackBody.loadUintBig(256)).toBe(BATCH_PUBLISH_ID); // publish_id
    expect(ackBody.loadUintBig(64)).toBe(0n);                // first_entry_id
    expect(ackBody.loadUint(8)).toBe(1);                     // part_count
  });

  it('HUB-BATCH-02: a non-Vault sender cannot publish a batch (13500)', async () => {
    const { blockchain, hub } = await setupHub();
    const attacker = await blockchain.treasury('hub-attacker');
    const res = await hub.send(attacker.getSender(), { value: toNano('0.1') }, {
      $$type: 'PublishBatchToHub',
      bounce_id: 1n, bounce_tag: 2n, publish_id: BATCH_PUBLISH_ID, publish_kind: KIND_PRIVATE,
      part_count: 1n, protocol_fee_total: 0n, author_wallet: attacker.address,
      parts: privatePartCell(), marketing: null,
    } as any);
    expect(hubTxExit(res, hub)).toBe(13500);
    expect((await hub.getGetState()).private_latest_id).toBe(0n); // nothing stored
  });

  it('HUB-BATCH-03: ingests a 1-part public batch (marketing marker required) and stores a public entry', async () => {
    const { hub, vault } = await setupHub();
    await hub.send(vault.getSender(), { value: toNano('0.1') }, {
      $$type: 'PublishBatchToHub',
      bounce_id: 1n, bounce_tag: 2n, publish_id: BATCH_PUBLISH_ID, publish_kind: KIND_PUBLIC,
      part_count: 1n, protocol_fee_total: 0n, author_wallet: vault.address,
      parts: partsList(KIND_PUBLIC, 1), marketing: marketingCell(),
    } as any);
    const entry = await hub.getGetPublicEntry(0n);
    expect(entry.exists).toBe(true);
    expect(entry.publish_id).toBe(computeEntryPublishId(BATCH_PUBLISH_ID, 0));
    expect((await hub.getGetState()).public_latest_id).toBe(1n);
  });

  it('HUB-BATCH-04: a 3-part private batch stores 3 sequential entries, each with its own EPI1 publish_id', async () => {
    const { hub, vault } = await setupHub();
    await hub.send(vault.getSender(), { value: toNano('0.3') }, {
      $$type: 'PublishBatchToHub',
      bounce_id: 1n, bounce_tag: 2n, publish_id: BATCH_PUBLISH_ID, publish_kind: KIND_PRIVATE,
      part_count: 3n, protocol_fee_total: 0n, author_wallet: vault.address,
      parts: partsList(KIND_PRIVATE, 3), marketing: null,
    } as any);
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
    const { hub, vault } = await setupHub();
    const res = await hub.send(vault.getSender(), { value: toNano('0.025') }, { // < fee + 1M + 30M ACK floor
      $$type: 'PublishBatchToHub',
      bounce_id: 1n, bounce_tag: 2n, publish_id: BATCH_PUBLISH_ID, publish_kind: KIND_PRIVATE,
      part_count: 1n, protocol_fee_total: 0n, author_wallet: vault.address,
      parts: privatePartCell(), marketing: null,
    } as any);
    expect(hubTxExit(res, hub)).toBe(13509);
    expect((await hub.getGetState()).private_latest_id).toBe(0n);
  });

  it('HUB-BATCH-06: a malformed part (wrong bit width) aborts the whole batch (13510); nothing stored', async () => {
    const { hub, vault } = await setupHub();
    const res = await hub.send(vault.getSender(), { value: toNano('0.1') }, {
      $$type: 'PublishBatchToHub',
      bounce_id: 1n, bounce_tag: 2n, publish_id: BATCH_PUBLISH_ID, publish_kind: KIND_PRIVATE,
      part_count: 1n, protocol_fee_total: 0n, author_wallet: vault.address,
      parts: beginCell().storeUint(0, 100).endCell(), marketing: null,
    } as any);
    expect(hubTxExit(res, hub)).toBe(13510);
    expect((await hub.getGetState()).private_latest_id).toBe(0n);
  });
});
