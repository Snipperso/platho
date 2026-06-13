import { describe, expect, it } from 'vitest';
import { external, toNano } from '@ton/core';
import {
  MANIFEST_HASH,
  KIND_PRIVATE,
  ACT_PUBLISH_BATCH,
  RES_CONFIRMED,
  AIRDROP_REWARD_PER_CAPSULE,
  partsList,
  batchExternalBody,
  computeBatchPublishId,
  computeEntryPublishId,
  deployBoundSealedPair,
  registerHybrid,
  depositTon,
} from './helpers/vpb2';

// End-to-end VPB2: a signed batch external through the REAL bound+sealed Vault + CapsuleHub. One sandbox
// sendMessage chains Vault(accept) -> PublishBatchToHub -> Hub(ingest+store) -> CapsuleHubBatchAck ->
// Vault(settle): the Hub entry, the Vault receipt (CONFIRMED), and the per-capsule airdrop are all asserted.
// Scaffolding (bound-sealed pair, wire format, id derivation) lives in ./helpers/vpb2.

describe('VPB2 end-to-end: Vault batch publish -> CapsuleHub ingest -> ACK settle', () => {
  it('E2E-BATCH-01: a signed 1-part private batch stores a Hub entry, settles the Vault receipt CONFIRMED, and credits the airdrop', async () => {
    const { blockchain, vault, hub, user, vaultAddress } = await deployBoundSealedPair();
    expect((await vault.getGetGlobal()).sealed).toBe(true);
    expect((await hub.getGetState()).sealed).toBe(true);

    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('2'));

    const nonce = (await vault.getGetUser(user.address)).publish_nonce;
    const partsRoot = partsList(KIND_PRIVATE, 1);
    const batchPublishId = computeBatchPublishId({
      owner: user.address, nonce, partsRoot, kind: KIND_PRIVATE, partCount: 1n, genesisHash: MANIFEST_HASH,
    });

    // ONE send drives the full chain: Vault accept -> Hub ingest -> ACK -> Vault settle.
    await blockchain.sendMessage(external({
      to: vaultAddress,
      body: batchExternalBody({
        vaultAddr: vaultAddress, owner: user.address, nonce, maxCharge: toNano('1'),
        partCount: 1n, partsRoot, genesisHash: MANIFEST_HASH,
      }),
    }));

    // Hub stored the capsule as entry 0 with its derived EPI1 publish_id.
    const entry = await hub.getGetPrivateEntry(0n);
    expect(entry.exists).toBe(true);
    expect(entry.publish_id).toBe(computeEntryPublishId(batchPublishId, 0));
    expect((await hub.getGetState()).private_latest_id).toBe(1n);

    // Vault settled: receipt CONFIRMED (aux = first_entry_id 0), pending cleared, per-capsule airdrop credited.
    const afterUser = await vault.getGetUser(user.address);
    expect(afterUser.publish_nonce).toBe(nonce + 1n);
    expect(afterUser.ath_balance).toBe(AIRDROP_REWARD_PER_CAPSULE);
    const slot = (await vault.getGetUserReceipts(user.address)).receipts.get(Number(nonce % 20n));
    expect(slot).toBeDefined();
    expect(slot!.action).toBe(ACT_PUBLISH_BATCH);
    expect(slot!.result).toBe(RES_CONFIRMED);
    expect(slot!.aux).toBe(0n);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });
});
