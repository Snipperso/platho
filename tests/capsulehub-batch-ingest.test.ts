import { describe, expect, it } from 'vitest';
import { Address, beginCell, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { CapsuleHub } from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import {
  finalPrivateBodyCell,
  finalPrivateHeader0Cell,
  finalPrivateHeader1Cell,
} from './helpers/capsule-cells';

// VPB2 Session 4 — CapsuleHub batch ingest core (spec 5.2). Drives the Hub directly from the bound Vault
// address with a PublishBatchToHub (the exact wire format the Vault forwards) and checks validate-all-then-
// commit-all storage + the per-entry EPI1 publish_id + the CapsuleHubBatchAck reply.

const MANIFEST = 0x777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666n;
const OP_CAPSULE_HUB_BATCH_ACK = 0x874e5771n;
const VAULT_BATCH_PUBLISH_ID_DOMAIN_HUB = 0x45504931n; // EPI1 (per-entry)
const KIND_PRIVATE = 1n;
const SUITE_HYBRID = 2n;
const SIZE_1K = 1n;
const BATCH_PUBLISH_ID = 0x9999000000000000000000000000000000000000000000000000000000009999n;

function cellHash(cell: Cell): bigint {
  return BigInt('0x' + cell.hash().toString('hex'));
}
function computeEntryPublishId(batchPublishId: bigint, partIndex: number): bigint {
  return cellHash(beginCell()
    .storeUint(VAULT_BATCH_PUBLISH_ID_DOMAIN_HUB, 32)
    .storeUint(batchPublishId, 256)
    .storeUint(BigInt(partIndex), 16)
    .endCell());
}

// A valid LAST 1K/hybrid private part (3 refs, no successor).
function privatePartCell(): Cell {
  const header0 = finalPrivateHeader0Cell();
  const header1 = finalPrivateHeader1Cell();
  const body = finalPrivateBodyCell(SIZE_1K);
  return beginCell()
    .storeUint(SIZE_1K, 8)
    .storeUint(SUITE_HYBRID, 8)
    .storeUint(cellHash(header0), 256)
    .storeUint(cellHash(header1), 256)
    .storeUint(cellHash(body), 256)
    .storeRef(header0)
    .storeRef(header1)
    .storeRef(body)
    .endCell();
}

async function setup() {
  const bc = await Blockchain.create();
  bc.now = 1_700_000_000;
  const feeAcc = await bc.treasury('hub-fee-acc');
  const vault = await bc.treasury('hub-vault'); // stands in for the bound Vault (the only allowed sender)
  const controller = await bc.treasury('hub-controller');
  // Deploy the Hub already bound + sealed (genesis ceremony state) so it accepts publishes immediately.
  const init = await CapsuleHub.init(feeAcc.address, vault.address, true, true, MANIFEST, controller.address);
  const addr = contractAddress(0, init);
  await bc.setShardAccount(addr, createShardAccount({
    address: addr, code: init.code, data: init.data, balance: toNano('200'), workchain: 0,
  }));
  const hub = bc.openContract(new CapsuleHub(addr, init));
  return { bc, hub, vault };
}

describe('CapsuleHub VPB2: batch ingest (Session 4)', () => {
  it('HUB-BATCH-01: ingests a 1-part private batch — stores the entry with the EPI1 publish_id and ACKs the Vault', async () => {
    const { bc, hub, vault } = await setup();

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
    const { bc, hub } = await setup();
    const attacker = await bc.treasury('hub-attacker');
    const res = await hub.send(attacker.getSender(), { value: toNano('0.1') }, {
      $$type: 'PublishBatchToHub',
      bounce_id: 1n, bounce_tag: 2n, publish_id: BATCH_PUBLISH_ID, publish_kind: KIND_PRIVATE,
      part_count: 1n, protocol_fee_total: 0n, author_wallet: attacker.address,
      parts: privatePartCell(), marketing: null,
    } as any);
    const hubTx = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === hub.address.toString());
    const cp: any = hubTx?.description?.computePhase;
    expect(cp?.type === 'vm' ? cp.exitCode : 0).toBe(13500);
    expect((await hub.getGetState()).private_latest_id).toBe(0n); // nothing stored
  });
});
