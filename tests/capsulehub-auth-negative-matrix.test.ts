import { describe, expect, it } from 'vitest';
import { beginCell, Cell, toNano } from '@ton/core';
import { webcrypto } from 'crypto';
import {
  BindDeploymentManifest,
  SealGenesis,
  BindCreditIssuer,
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
  setupHub,
  hubTxExit,
} from './helpers/vpb2';
import {
  EPOCH_SECONDS,
  anonBatch,
  convPartToken,
  deployAnonReady,
  issuerKey,
  spendKey,
} from './helpers/anon';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

// clean-16 B3 migration of the CapsuleHub negative authorization matrix onto the permissionless anon-publish path
// (PublishAnonBatch). The genesis-ceremony bind/seal gates (NEG-01, NEG-02 rebind) are unchanged; the publish gates
// are now the Phase-A scalar checks + lane-parse of the anon receiver. A batch is driven by ANY treasury relay
// (permissionless) with per-part spend tokens minted by the mirrored issuer.
//
// REMOVED (not migrated): the old sender()==vault gate (former 13500 / CAPSULE-AUTH-NEG-03) is gone — the anon path
// captures sender() as the ACK relay with no sender authorization, so there is no non-Vault-sender rejection to assert.

// A private part whose embedded body_hash field is zeroed (otherwise valid 784-bit / 3-ref shape) — trips the bh!=0
// lane-parse gate (13512). The header/body ref cells are well-formed so the frame passes the 13510 shape check first.
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

describe('CapsuleHub negative authorization matrix (B3 anon path)', () => {
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

    // clean-16 B3: the Hub cannot seal until a CreditIssuer is bound (12923) — the anon-publish pool/issuer-mirror
    // must be wired before the surface opens, and BindCreditIssuer needs unsealed. Bind one before the final seal.
    const creditIssuer = await blockchain.treasury('capsule-auth-credit-issuer');
    await hub.send(controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindCreditIssuer', credit_issuer_address: creditIssuer.address,
    } as BindCreditIssuer);

    // The controller seals with the correct manifest.
    await hub.send(controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis', deployment_manifest_hash: HUB_MANIFEST,
    } as SealGenesis);
    expect((await hub.getGetState()).sealed).toBe(true);
  });

  it('CAPSULE-AUTH-NEG-02: an unsealed hub rejects an anon batch publish (12900) and a sealed hub rejects rebinding', async () => {
    // Unsealed hub: a permissionless relay submits a well-formed anon batch, but requireSealed bounces it (12900)
    // before publish_id / kind / token verification — nothing is stored.
    const unsealed = await setupHub({ sealed: false, vaultBound: true });
    const relay = await unsealed.blockchain.treasury('capsule-auth-relay-unsealed');
    const epoch = BigInt(Math.floor(unsealed.blockchain.now! / EPOCH_SECONDS));
    const pt = convPartToken({ issuer: issuerKey(), spend: spendKey(0), slot: 0n, epoch, nonce: 1n });
    const res = await unsealed.hub.send(relay.getSender(), { value: toNano('0.3') }, anonBatch({
      parts: pt.part, tokens: pt.tok, partCount: 1n,
    }));
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
    const { hub, blockchain, issuer, slot, nowEpoch } = await deployAnonReady();
    const relay = await blockchain.treasury('capsule-auth-relay-sealed');

    // Zero publish_id: rejected at the Phase-A scalar gate (before any token/lane work). A valid part+token pair is
    // supplied so the ONLY defect is the zeroed publish_id.
    const okPart = convPartToken({ issuer, spend: spendKey(0), slot, epoch: nowEpoch, nonce: 1n });
    const zeroId = await hub.send(relay.getSender(), { value: toNano('0.3') }, anonBatch({
      parts: okPart.part, tokens: okPart.tok, partCount: 1n, publishId: 0n,
    }));
    expect(hubTxExit(zeroId, hub)).toBe(13501);

    // Zero body_hash: the token is VALID (issuer-side verification passes), so the receiver reaches lane-parse and the
    // bh!=0 gate (13512) fires — the spend_sig/frameCommit check (13605) is downstream and never reached. A distinct
    // nonce keeps the issuer serial unique (it does not collide with the zero-id attempt above, which never stored).
    const validToken = convPartToken({ issuer, spend: spendKey(1), slot, epoch: nowEpoch, nonce: 2n });
    const zeroBodyHash = await hub.send(relay.getSender(), { value: toNano('0.3') }, anonBatch({
      parts: privatePartZeroBodyHash(), tokens: validToken.tok, partCount: 1n,
    }));
    expect(hubTxExit(zeroBodyHash, hub)).toBe(13512);

    expect((await hub.getGetState()).private_latest_id).toBe(0n);
  });
});
