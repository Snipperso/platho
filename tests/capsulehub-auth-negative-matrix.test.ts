import { describe, expect, it } from 'vitest';
import { beginCell, Cell, toNano } from '@ton/core';
import {
  BindDeploymentManifest,
  SealGenesis,
} from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import {
  finalPrivateBodyCell,
  finalPrivateHeader0Cell,
  finalPrivateHeader1Cell,
} from './helpers/capsule-cells';
import {
  HUB_MANIFEST,
  SIZE_1K,
  SUITE_HYBRID,
  cellHash,
  partsList,
  publishBatchToHub,
  setupHub,
  hubTxExit,
} from './helpers/vpb2';

// CapsuleHub negative authorization matrix — migrated onto the VPB2 batch ingest (PublishBatchToHub). The
// genesis-ceremony bind/seal gates are unchanged; the publish gates are now the Phase-A scalar checks of the
// batch receiver. Non-Vault-sender rejection (former CAPSULE-AUTH-NEG-03) is covered by HUB-BATCH-02 and not
// duplicated here.

// A private part whose embedded body_hash field is zeroed (otherwise valid shape) — trips the bh!=0 gate.
function privatePartZeroBodyHash(): Cell {
  const h0 = finalPrivateHeader0Cell();
  const h1 = finalPrivateHeader1Cell();
  const body = finalPrivateBodyCell(SIZE_1K);
  return beginCell()
    .storeUint(SIZE_1K, 8).storeUint(SUITE_HYBRID, 8)
    .storeUint(cellHash(h0), 256).storeUint(cellHash(h1), 256).storeUint(0n, 256) // body_hash = 0
    .storeRef(h0).storeRef(h1).storeRef(body)
    .endCell();
}

describe('CapsuleHub negative authorization matrix (VPB2 batch)', () => {
  it('CAPSULE-AUTH-NEG-01: only the genesis controller can bind and seal before the publish surface opens', async () => {
    const { blockchain, hub, vault, controller } = await setupHub({ sealed: false, vaultBound: false });
    const attacker = await blockchain.treasury('capsule-auth-attacker');

    // An attacker cannot bind the Vault.
    await hub.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindDeploymentManifest', deployment_manifest_hash: HUB_MANIFEST, counterpart_address: vault.address,
    } as BindDeploymentManifest);
    expect((await hub.getGetState()).vault_bound).toBe(false);

    // The controller can.
    await hub.send(controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindDeploymentManifest', deployment_manifest_hash: HUB_MANIFEST, counterpart_address: vault.address,
    } as BindDeploymentManifest);
    expect((await hub.getGetState()).vault_bound).toBe(true);

    // Seal with a mismatched manifest does not seal.
    await hub.send(controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis', deployment_manifest_hash: 0n,
    } as SealGenesis);
    expect((await hub.getGetState()).sealed).toBe(false);

    // An attacker cannot seal.
    await hub.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis', deployment_manifest_hash: HUB_MANIFEST,
    } as SealGenesis);
    expect((await hub.getGetState()).sealed).toBe(false);

    // The controller seals with the correct manifest.
    await hub.send(controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis', deployment_manifest_hash: HUB_MANIFEST,
    } as SealGenesis);
    expect((await hub.getGetState()).sealed).toBe(true);
  });

  it('CAPSULE-AUTH-NEG-02: an unsealed hub rejects a batch publish (12900) and a sealed hub rejects rebinding', async () => {
    // Unsealed hub: the bound Vault publishes, but requireSealed bounces it before anything is stored.
    const unsealed = await setupHub({ sealed: false, vaultBound: true });
    const res = await unsealed.hub.send(unsealed.vault.getSender(), { value: toNano('0.1') },
      publishBatchToHub({ parts: partsList(1n, 1), authorWallet: unsealed.vault.address }));
    expect(hubTxExit(res, unsealed.hub)).toBe(12900);
    expect((await unsealed.hub.getGetState()).private_latest_id).toBe(0n);

    // Sealed hub: a controller rebind attempt is rejected; the bound Vault address is unchanged.
    const sealed = await setupHub();
    await sealed.hub.send(sealed.controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindDeploymentManifest', deployment_manifest_hash: HUB_MANIFEST, counterpart_address: sealed.controller.address,
    } as BindDeploymentManifest);
    expect((await sealed.hub.getGetState()).vault_address.toString()).toBe(sealed.vault.address.toString());
  });

  it('CAPSULE-AUTH-NEG-04: a batch with a zero publish_id (13501) or a zero body_hash part (13512) is rejected, nothing stored', async () => {
    const { hub, vault } = await setupHub();

    const zeroId = await hub.send(vault.getSender(), { value: toNano('0.1') },
      publishBatchToHub({ parts: partsList(1n, 1), authorWallet: vault.address, publishId: 0n }));
    expect(hubTxExit(zeroId, hub)).toBe(13501);

    const zeroBodyHash = await hub.send(vault.getSender(), { value: toNano('0.1') },
      publishBatchToHub({ parts: privatePartZeroBodyHash(), authorWallet: vault.address }));
    expect(hubTxExit(zeroBodyHash, hub)).toBe(13512);

    expect((await hub.getGetState()).private_latest_id).toBe(0n);
  });
});
