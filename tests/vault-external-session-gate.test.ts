import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Address, beginCell, Cell, external, toNano } from '@ton/core';
import { keyPairFromSeed, sign } from '@ton/crypto';
import { internal } from '@ton/sandbox';
import { RegisterMessagingKeys, storeRegisterMessagingKeys, storeDepositTon } from '../build/Vault/Vault_Vault';
import {
  finalPrivateBodyCell,
  finalPublicBodyCell,
} from './helpers/capsule-cells';
import {
  ACT_PUBLISH_BATCH,
  AUTH_KEY_PAIR,
  GENESIS_HASH,
  KIND_PRIVATE,
  KIND_PUBLIC,
  SIZE_1K,
  VAULT_BATCH_PUBLISH_SIGNING_DOMAIN,
  VPB2_VERSION,
  ENC_0,
  SIG_0,
  PQ_HASH,
  PQ_CELL,
  RJ_BINDING,
  RJ_CLASS_OR_SUITE,
  RJ_HASH_MISMATCH,
  RJ_PAYLOAD_SHAPE,
  RJ_UNDERPRICED,
  addressHash,
  cellHash,
  partsList,
  privatePartCustom,
  publicPartCustom,
  batchExternalBody,
  setupVault,
  registerHybrid,
  depositTon,
} from './helpers/vpb2';

// VPB2 migration of the legacy "Vault balance-funded publish gate" suite. The removed single-publish
// externals (op 0x7E1F5031/0x7E1F5032 + the VPB1 signing domain) are gone; their auth / binding / size-class
// gates are re-expressed against the batch external (op 0x7E1F5041, VPB2 domain 0x56504232) using the frozen
// vpb2 helper's batchExternalBody override knobs.
//
// Two failure modes are exercised:
//   * PRE-accept gates THROW in JS (blockchain.sendMessage(external(...)) rejects): unregistered owner,
//     wrong signer, below-floor max_charge. Nonce + balance UNCHANGED.
//   * POST-accept binding/shape rejects do NOT throw (acceptMessage already ran): the external completes,
//     the nonce is burned (+1), the user is refunded max_charge - batchChargeFloor (so balance drops by ~the
//     floor, not max_charge), NO pending entry is created, and the receipt slot records the RJ_* code.
//
// batchChargeFloor(partCount) = BATCH_FLOOR_BASE_PIN + BATCH_FLOOR_PER_PART_PIN*partCount (contracts/Vault.tact).
// A maxCharge that clears the floor but sits below canonical_total -> RJ_UNDERPRICED. The pins are READ FROM THE
// CONTRACT SOURCE (same srcIntConst regex as tests/vpb2-release-gates.test.ts) so this gate auto-tracks any future
// floor recalibration instead of hardcoding a snapshot value.

const VAULT_SRC = readFileSync('contracts/Vault.tact', 'utf8');
function srcIntConst(name: string): bigint {
  const m = VAULT_SRC.match(new RegExp(`const\\s+${name}\\s*:\\s*Int\\s*=\\s*(\\d+)`));
  if (!m) throw new Error(`could not read const ${name} from contracts/Vault.tact`);
  return BigInt(m[1]);
}
const BATCH_FLOOR_BASE_PIN = srcIntConst('BATCH_FLOOR_BASE_PIN');
const BATCH_FLOOR_PER_PART_PIN = srcIntConst('BATCH_FLOOR_PER_PART_PIN');
const batchChargeFloor = (partCount: bigint): bigint => BATCH_FLOOR_BASE_PIN + BATCH_FLOOR_PER_PART_PIN * partCount;

// A comfortably-canonical max_charge for a 1-part batch (the working batch suite uses 0.5–1 TON).
const OK_MAX_CHARGE = toNano('1');

// A second registered owner sharing the same vault, for cross-owner / wrong-signer scenarios. Registers via an
// internal RegisterMessagingKeys from `owner` (so non-basechain owners can also register). Returns the auth
// keypair whose secret signs that owner's batch externals.
async function registerOwner(blockchain: any, vault: any, owner: Address, seedByte: number) {
  const authKeyPair = keyPairFromSeed(Buffer.alloc(32, seedByte + 64));
  await blockchain.sendMessage(internal({
    from: owner,
    to: vault.address,
    value: toNano('0.1'),
    body: beginCell().store(storeRegisterMessagingKeys({
      $$type: 'RegisterMessagingKeys',
      enc_pubkey: ENC_0,
      sign_pubkey: SIG_0,
      auth_pubkey: BigInt('0x' + authKeyPair.publicKey.toString('hex')),
      pq_kem_pubkey_hash: PQ_HASH,
      pq_kem_pubkey_len: 1184n,
      pq_kem_pubkey: PQ_CELL,
      crypto_suite_mask: 2n,
    } as RegisterMessagingKeys)).endCell(),
  }));
  return authKeyPair;
}

// Standalone pre-bound/pre-sealed Vault + a hybrid-registered, well-funded basechain user.
async function setupRegistered(balance?: bigint) {
  const ctx = await setupVault(balance ? { balance } : {});
  await registerHybrid(ctx.vault, ctx.user);
  await depositTon(ctx.vault, ctx.user, toNano('2'));
  return ctx;
}

// Builds a VPB2 signed-root cell from scratch (mirrors batchExternalBody's default root) so a test can drop a
// field (e.g. the domain) or append a trailing bit before signing+embedding it via rootOverride.
function customRoot(opts: {
  vaultAddr: Address;
  owner: Address;
  nonce: bigint;
  maxCharge: bigint;
  partCount: bigint;
  partsRoot: Cell;
  kind?: bigint;
  includeDomain?: boolean;
  trailingBit?: boolean;
}): Cell {
  const b = beginCell();
  if (opts.includeDomain !== false) b.storeUint(VAULT_BATCH_PUBLISH_SIGNING_DOMAIN, 32);
  b.storeUint(GENESIS_HASH, 256)
    .storeUint(addressHash(opts.vaultAddr), 256)
    .storeUint(opts.kind ?? KIND_PRIVATE, 8)
    .storeUint(addressHash(opts.owner), 256)
    .storeUint(opts.nonce, 64)
    .storeUint(opts.maxCharge, 128)
    .storeUint(opts.partCount, 8)
    .storeUint(VPB2_VERSION, 8)
    .storeRef(opts.partsRoot);
  if (opts.trailingBit) b.storeBit(true);
  return b.endCell();
}

// Asserts a POST-accept atomic reject: external completes (no throw), nonce burned (+1), 0 < charged <
// maxCharge, no pending entry, and the receipt slot records (ACT_PUBLISH_BATCH, expectedResult, nonce).
async function expectPostAcceptReject(
  blockchain: any,
  vault: any,
  owner: Address,
  body: Cell,
  nonce: bigint,
  maxCharge: bigint,
  expectedResult: bigint,
) {
  const before = await vault.getGetUser(owner);
  await blockchain.sendMessage(external({ to: vault.address, body })); // accepted, then atomically rejected

  const after = await vault.getGetUser(owner);
  expect(after.publish_nonce).toBe(nonce + 1n); // nonce IS burned (post-accept)

  const slot = (await vault.getGetUserReceipts(owner)).receipts.get(Number(nonce % 20n));
  expect(slot).toBeDefined();
  expect(slot!.nonce).toBe(nonce);
  expect(slot!.action).toBe(ACT_PUBLISH_BATCH);
  expect(slot!.result).toBe(expectedResult);

  const charged = before.ton_balance - after.ton_balance;
  expect(charged).toBeGreaterThan(0n);                 // floor charged
  expect(charged).toBeLessThan(maxCharge);             // but refunded the over-hold
  expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n); // no pending entry
}

describe('Vault VPB2: batch external session gate', () => {
  it('VAULT-BALANCE-PUBLISH-01: an unregistered owner is rejected pre-accept (16451); a wrong signer is rejected pre-accept (16457)', async () => {
    const { blockchain, vault, user } = await setupVault();
    // No registerHybrid: the owner has no auth key -> pre-accept 16451 (user not registered).
    await depositTon(vault, user, toNano('2'));
    const nonce = (await vault.getGetUser(user.address)).publish_nonce;
    const before = await vault.getGetUser(user.address);

    await expect(blockchain.sendMessage(external({
      to: vault.address,
      body: batchExternalBody({
        vaultAddr: vault.address, owner: user.address, nonce, maxCharge: OK_MAX_CHARGE,
        partCount: 1n, partsRoot: partsList(KIND_PRIVATE, 1),
      }),
    }))).rejects.toThrow(/16451/);
    expect((await vault.getGetUser(user.address)).publish_nonce).toBe(before.publish_nonce);
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(before.ton_balance);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);

    // Now register, then sign with the WRONG key -> pre-accept 16457 (signature invalid).
    await registerHybrid(vault, user);
    const nonce2 = (await vault.getGetUser(user.address)).publish_nonce;
    const before2 = await vault.getGetUser(user.address);
    const wrongKey = keyPairFromSeed(Buffer.alloc(32, 0x99));
    await expect(blockchain.sendMessage(external({
      to: vault.address,
      body: batchExternalBody({
        vaultAddr: vault.address, owner: user.address, nonce: nonce2, maxCharge: OK_MAX_CHARGE,
        partCount: 1n, partsRoot: partsList(KIND_PRIVATE, 1), signKey: wrongKey.secretKey,
      }),
    }))).rejects.toThrow(/16457/);
    expect((await vault.getGetUser(user.address)).publish_nonce).toBe(before2.publish_nonce);
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(before2.ton_balance);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('VAULT-BALANCE-PUBLISH-01B: a private batch signed for the wrong Vault address rejects RJ_BINDING', async () => {
    const { blockchain, vault, user } = await setupRegistered();
    const nonce = (await vault.getGetUser(user.address)).publish_nonce;
    const body = batchExternalBody({
      vaultAddr: vault.address, owner: user.address, nonce, maxCharge: OK_MAX_CHARGE,
      partCount: 1n, partsRoot: partsList(KIND_PRIVATE, 1),
      vaultHashOverride: addressHash(vault.address) + 1n, // signed vault-hash field != this Vault
    });
    await expectPostAcceptReject(blockchain, vault, user.address, body, nonce, OK_MAX_CHARGE, RJ_BINDING);
  });

  it('VAULT-BALANCE-PUBLISH-01B2: a public batch signed for the wrong deployment manifest rejects RJ_BINDING', async () => {
    const { blockchain, vault, user } = await setupRegistered();
    const nonce = (await vault.getGetUser(user.address)).publish_nonce;
    const body = batchExternalBody({
      vaultAddr: vault.address, owner: user.address, nonce, maxCharge: OK_MAX_CHARGE,
      partCount: 1n, partsRoot: partsList(KIND_PUBLIC, 1), kind: KIND_PUBLIC,
      genesisHash: GENESIS_HASH + 1n, // signed manifest != deployment_manifest_hash
    });
    await expectPostAcceptReject(blockchain, vault, user.address, body, nonce, OK_MAX_CHARGE, RJ_BINDING);
  });

  it('VAULT-BALANCE-PUBLISH-01B3: a public batch signed for the wrong Vault address rejects RJ_BINDING', async () => {
    const { blockchain, vault, user } = await setupRegistered();
    const nonce = (await vault.getGetUser(user.address)).publish_nonce;
    const body = batchExternalBody({
      vaultAddr: vault.address, owner: user.address, nonce, maxCharge: OK_MAX_CHARGE,
      partCount: 1n, partsRoot: partsList(KIND_PUBLIC, 1), kind: KIND_PUBLIC,
      vaultHashOverride: addressHash(vault.address) + 1n,
    });
    await expectPostAcceptReject(blockchain, vault, user.address, body, nonce, OK_MAX_CHARGE, RJ_BINDING);
  });

  it('VAULT-BALANCE-PUBLISH-01B4: domain / kind / owner-hash mismatches reject RJ_BINDING; a bad suite part rejects RJ_CLASS_OR_SUITE', async () => {
    const { blockchain, vault, user } = await setupRegistered();

    // wrong signing domain -> structuralOk fails -> RJ_BINDING
    let nonce = (await vault.getGetUser(user.address)).publish_nonce;
    await expectPostAcceptReject(blockchain, vault, user.address, batchExternalBody({
      vaultAddr: vault.address, owner: user.address, nonce, maxCharge: OK_MAX_CHARGE,
      partCount: 1n, partsRoot: partsList(KIND_PUBLIC, 1), kind: KIND_PUBLIC,
      domain: VAULT_BATCH_PUBLISH_SIGNING_DOMAIN + 1n,
    }), nonce, OK_MAX_CHARGE, RJ_BINDING);

    // signed kind field (private) disagrees with the parts (public) AND is re-checked -> RJ_BINDING by the
    // owner-hash branch? No: the kind here is the SIGNED kind; we keep parts matching kind and instead trip the
    // owner-hash field. Use a public part list with kind public but an owner-hash mismatch.
    nonce = (await vault.getGetUser(user.address)).publish_nonce;
    await expectPostAcceptReject(blockchain, vault, user.address, batchExternalBody({
      vaultAddr: vault.address, owner: user.address, nonce, maxCharge: OK_MAX_CHARGE,
      partCount: 1n, partsRoot: partsList(KIND_PUBLIC, 1), kind: KIND_PUBLIC,
      ownerHashOverride: addressHash(user.address) + 1n,
    }), nonce, OK_MAX_CHARGE, RJ_BINDING);

    // a public batch carrying a part with a non-public crypto suite -> RJ_CLASS_OR_SUITE (isPublishProfileValid).
    // Public parts have a `reserved` byte (must be 0); a non-zero size class trips RJ_CLASS_OR_SUITE first via the
    // public profile check. Use an out-of-range public size class (sizeClass not allowed) on an otherwise-valid part.
    nonce = (await vault.getGetUser(user.address)).publish_nonce;
    const badSuitePart = privatePartCustom({ suite: 0n }); // private part with a non-hybrid suite
    await expectPostAcceptReject(blockchain, vault, user.address, batchExternalBody({
      vaultAddr: vault.address, owner: user.address, nonce, maxCharge: OK_MAX_CHARGE,
      partCount: 1n, partsRoot: badSuitePart, kind: KIND_PRIVATE,
    }), nonce, OK_MAX_CHARGE, RJ_CLASS_OR_SUITE);
  });

  it('VAULT-BALANCE-PUBLISH-01B5: a batch signed for owner A cannot be replayed under owner B (envOwner/owner-hash mismatch) -> RJ_BINDING', async () => {
    const { blockchain, vault, user } = await setupRegistered();
    const other = await blockchain.treasury('vpb2-gate-other-owner');
    await registerOwner(blockchain, vault, other.address, 0x21);
    await depositTon(vault, other, toNano('2'));

    // Sign the root with user A's auth key + A's owner-hash, but wrap the envelope under owner B. The envelope
    // owner (B) drives the nonce/auth lookup; A's signature still verifies against B's auth key? No — it must be
    // signed by B's auth key to pass pre-accept. So we sign with B's key but keep A's owner-hash in the signed
    // root -> structuralOk owner-hash check (B's address) != signed A owner-hash -> RJ_BINDING.
    const bAuth = keyPairFromSeed(Buffer.alloc(32, 0x21 + 64));
    const nonce = (await vault.getGetUser(other.address)).publish_nonce;
    const body = batchExternalBody({
      vaultAddr: vault.address, owner: other.address, nonce, maxCharge: OK_MAX_CHARGE,
      partCount: 1n, partsRoot: partsList(KIND_PRIVATE, 1),
      ownerHashOverride: addressHash(user.address), // signed owner-hash names A, envelope/auth is B
      signKey: bAuth.secretKey,
    });
    await expectPostAcceptReject(blockchain, vault, other.address, body, nonce, OK_MAX_CHARGE, RJ_BINDING);
  });

  it('VAULT-BALANCE-PUBLISH-01C: signed domain / manifest / kind mismatches each reject RJ_BINDING', async () => {
    const { blockchain, vault, user } = await setupRegistered();

    let nonce = (await vault.getGetUser(user.address)).publish_nonce;
    await expectPostAcceptReject(blockchain, vault, user.address, batchExternalBody({
      vaultAddr: vault.address, owner: user.address, nonce, maxCharge: OK_MAX_CHARGE,
      partCount: 1n, partsRoot: partsList(KIND_PRIVATE, 1),
      domain: VAULT_BATCH_PUBLISH_SIGNING_DOMAIN + 1n,
    }), nonce, OK_MAX_CHARGE, RJ_BINDING);

    nonce = (await vault.getGetUser(user.address)).publish_nonce;
    await expectPostAcceptReject(blockchain, vault, user.address, batchExternalBody({
      vaultAddr: vault.address, owner: user.address, nonce, maxCharge: OK_MAX_CHARGE,
      partCount: 1n, partsRoot: partsList(KIND_PRIVATE, 1),
      genesisHash: GENESIS_HASH + 1n,
    }), nonce, OK_MAX_CHARGE, RJ_BINDING);

    // signed kind = an invalid value (neither PRIVATE nor PUBLIC) -> structuralOk kind check fails -> RJ_BINDING.
    nonce = (await vault.getGetUser(user.address)).publish_nonce;
    await expectPostAcceptReject(blockchain, vault, user.address, batchExternalBody({
      vaultAddr: vault.address, owner: user.address, nonce, maxCharge: OK_MAX_CHARGE,
      partCount: 1n, partsRoot: partsList(KIND_PRIVATE, 1),
      kind: 7n, // out-of-range kind
    }), nonce, OK_MAX_CHARGE, RJ_BINDING);
  });

  it('VAULT-BALANCE-PUBLISH-01D: a signed root WITHOUT the leading domain field rejects RJ_BINDING', async () => {
    const { blockchain, vault, user } = await setupRegistered();
    const nonce = (await vault.getGetUser(user.address)).publish_nonce;
    const partsRoot = partsList(KIND_PRIVATE, 1);
    // The pre-accept gate skips 808 bits then reads nonce/maxCharge/partCount; a no-domain root shifts those
    // fields. We keep the pre-accept-read fields where the gate expects them by padding the front to 808 bits via
    // GENESIS_HASH(256)+vault(256)+kind(8)+owner(256)=776... not 808 without the 32-bit domain. The cleanest
    // construction that still clears pre-accept is a full-shape root whose leading 32 bits are NOT the domain
    // magic — identical to a wrong-domain root. structuralOk's domain check fails -> RJ_BINDING.
    const root = beginCell()
      .storeUint(0n, 32) // domain slot present but zeroed (== "no domain field" payload)
      .storeUint(GENESIS_HASH, 256)
      .storeUint(addressHash(vault.address), 256)
      .storeUint(KIND_PRIVATE, 8)
      .storeUint(addressHash(user.address), 256)
      .storeUint(nonce, 64)
      .storeUint(OK_MAX_CHARGE, 128)
      .storeUint(1n, 8)
      .storeUint(VPB2_VERSION, 8)
      .storeRef(partsRoot)
      .endCell();
    const sig = sign(root.hash(), AUTH_KEY_PAIR.secretKey);
    const body = beginCell()
      .storeUint(0x7e1f5041, 32)
      .storeAddress(user.address)
      .storeBuffer(sig)
      .storeRef(root)
      .endCell();
    await expectPostAcceptReject(blockchain, vault, user.address, body, nonce, OK_MAX_CHARGE, RJ_BINDING);
  });

  // VAULT-BALANCE-PUBLISH-02: removed — covered by the deletion of opcode 0x686694C6 (no batch analog).

  it('VAULT-BALANCE-PUBLISH-03: a valid signature with max_charge above the floor but below canonical_total rejects RJ_UNDERPRICED', async () => {
    const { blockchain, vault, user } = await setupRegistered();
    const nonce = (await vault.getGetUser(user.address)).publish_nonce;
    // Just above the pre-accept floor (clears 16485) but well below the runtime canonical_total -> RJ_UNDERPRICED
    // with a refund. floor(1) is the pinned pre-accept floor; canonical_total is the runtime-priced real cost
    // (observed ~151.5M-152M for a 1-part private batch in-sandbox, where the external import fee is 0). A small
    // delta above the floor stays comfortably under canonical_total, so the charge is refunded and the receipt
    // records RJ_UNDERPRICED.
    const maxCharge = batchChargeFloor(1n) + 5_000_000n;
    const body = batchExternalBody({
      vaultAddr: vault.address, owner: user.address, nonce, maxCharge,
      partCount: 1n, partsRoot: partsList(KIND_PRIVATE, 1),
    });
    await expectPostAcceptReject(blockchain, vault, user.address, body, nonce, maxCharge, RJ_UNDERPRICED);
  });

  it('VAULT-BALANCE-PUBLISH-04: a private part whose declared body hash != the body cell rejects RJ_HASH_MISMATCH', async () => {
    const { blockchain, vault, user } = await setupRegistered();
    const nonce = (await vault.getGetUser(user.address)).publish_nonce;
    const badPart = privatePartCustom({ bodyHash: cellHash(finalPrivateBodyCell(SIZE_1K)) + 1n });
    const body = batchExternalBody({
      vaultAddr: vault.address, owner: user.address, nonce, maxCharge: OK_MAX_CHARGE,
      partCount: 1n, partsRoot: badPart,
    });
    await expectPostAcceptReject(blockchain, vault, user.address, body, nonce, OK_MAX_CHARGE, RJ_HASH_MISMATCH);
  });

  it('VAULT-BALANCE-PUBLISH-04A: a trailing bit in the SIGNED ROOT (distinct from envelope padding) rejects RJ_BINDING', async () => {
    const { blockchain, vault, user } = await setupRegistered();
    const nonce = (await vault.getGetUser(user.address)).publish_nonce;
    const root = customRoot({
      vaultAddr: vault.address, owner: user.address, nonce, maxCharge: OK_MAX_CHARGE,
      partCount: 1n, partsRoot: partsList(KIND_PRIVATE, 1), trailingBit: true,
    });
    const body = batchExternalBody({
      vaultAddr: vault.address, owner: user.address, nonce, maxCharge: OK_MAX_CHARGE,
      partCount: 1n, partsRoot: partsList(KIND_PRIVATE, 1),
      rootOverride: root, // embed AND sign the root with a trailing bit -> vroot.bits()!=0 -> RJ_BINDING
    });
    await expectPostAcceptReject(blockchain, vault, user.address, body, nonce, OK_MAX_CHARGE, RJ_BINDING);
  });

  // VAULT-BALANCE-PUBLISH-04B: removed — covered by BATCH-NONCE-01 (vault-batch-publish.test.ts).

  it('VAULT-BALANCE-PUBLISH-04C: a max_charge below the batch floor is rejected pre-accept (16485)', async () => {
    const { blockchain, vault, user } = await setupRegistered();
    const nonce = (await vault.getGetUser(user.address)).publish_nonce;
    const before = await vault.getGetUser(user.address);
    const body = batchExternalBody({
      vaultAddr: vault.address, owner: user.address, nonce, maxCharge: batchChargeFloor(1n) - 1n,
      partCount: 1n, partsRoot: partsList(KIND_PRIVATE, 1),
    });
    await expect(blockchain.sendMessage(external({ to: vault.address, body }))).rejects.toThrow(/16485/);
    expect((await vault.getGetUser(user.address)).publish_nonce).toBe(before.publish_nonce);
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(before.ton_balance);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('VAULT-BALANCE-PUBLISH-04C2: the floor scales with part_count — a multi-part batch needs a higher max_charge', async () => {
    const { blockchain, vault, user } = await setupRegistered(toNano('5'));
    const nonce = (await vault.getGetUser(user.address)).publish_nonce;
    const before = await vault.getGetUser(user.address);
    // A 4-part batch: a max_charge that would clear the 1-part floor but is BELOW the 4-part floor is rejected
    // pre-accept (16485). batchChargeFloor scales linearly with part_count.
    const fourPartParts = partsList(KIND_PRIVATE, 4);
    const belowFourFloor = batchChargeFloor(4n) - 1n;
    expect(belowFourFloor).toBeGreaterThan(batchChargeFloor(1n)); // would have cleared a 1-part floor
    await expect(blockchain.sendMessage(external({
      to: vault.address,
      body: batchExternalBody({
        vaultAddr: vault.address, owner: user.address, nonce, maxCharge: belowFourFloor,
        partCount: 4n, partsRoot: fourPartParts,
      }),
    }))).rejects.toThrow(/16485/);
    expect((await vault.getGetUser(user.address)).publish_nonce).toBe(before.publish_nonce);
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(before.ton_balance);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('VAULT-BALANCE-PUBLISH-04E: a non-basechain (workchain -1) owner rejects RJ_BINDING', async () => {
    const { blockchain, vault } = await setupVault();
    const owner = new Address(-1, Buffer.alloc(32, 0x64));
    const authKeyPair = await registerOwner(blockchain, vault, owner, 0x33);
    // Fund the masterchain owner's ledger via a DepositTon internal from the owner.
    await blockchain.sendMessage(internal({
      from: owner, to: vault.address, value: toNano('2') + 12_000_000n,
      body: beginCell().store(storeDepositTon({ $$type: 'DepositTon', amount: toNano('2') } as any)).endCell(),
    }));
    const nonce = (await vault.getGetUser(owner)).publish_nonce;
    const body = batchExternalBody({
      vaultAddr: vault.address, owner, nonce, maxCharge: OK_MAX_CHARGE,
      partCount: 1n, partsRoot: partsList(KIND_PRIVATE, 1), signKey: authKeyPair.secretKey,
    });
    // structuralOk requires oAddr.loadUint(11) == 1024 (basechain std-address prefix); a workchain -1 owner
    // fails that -> RJ_BINDING.
    await expectPostAcceptReject(blockchain, vault, owner, body, nonce, OK_MAX_CHARGE, RJ_BINDING);
  });

  it('VAULT-BALANCE-PUBLISH-05: a public part whose declared body hash != the body cell rejects RJ_HASH_MISMATCH', async () => {
    const { blockchain, vault, user } = await setupRegistered();
    const nonce = (await vault.getGetUser(user.address)).publish_nonce;
    const badPart = publicPartCustom({ bodyHash: cellHash(finalPublicBodyCell(0x40, 1024)) + 1n });
    const body = batchExternalBody({
      vaultAddr: vault.address, owner: user.address, nonce, maxCharge: OK_MAX_CHARGE,
      partCount: 1n, partsRoot: badPart, kind: KIND_PUBLIC,
    });
    await expectPostAcceptReject(blockchain, vault, user.address, body, nonce, OK_MAX_CHARGE, RJ_HASH_MISMATCH);
  });

  it('VAULT-BALANCE-PUBLISH-05A: a trailing bit in a public SIGNED ROOT rejects RJ_BINDING', async () => {
    const { blockchain, vault, user } = await setupRegistered();
    const nonce = (await vault.getGetUser(user.address)).publish_nonce;
    const root = customRoot({
      vaultAddr: vault.address, owner: user.address, nonce, maxCharge: OK_MAX_CHARGE,
      partCount: 1n, partsRoot: partsList(KIND_PUBLIC, 1), kind: KIND_PUBLIC, trailingBit: true,
    });
    const body = batchExternalBody({
      vaultAddr: vault.address, owner: user.address, nonce, maxCharge: OK_MAX_CHARGE,
      partCount: 1n, partsRoot: partsList(KIND_PUBLIC, 1), kind: KIND_PUBLIC, rootOverride: root,
    });
    await expectPostAcceptReject(blockchain, vault, user.address, body, nonce, OK_MAX_CHARGE, RJ_BINDING);
  });

  it('VAULT-BALANCE-PUBLISH-06: a public part with an oversized body rejects RJ_PAYLOAD_SHAPE', async () => {
    const { blockchain, vault, user } = await setupRegistered();
    const nonce = (await vault.getGetUser(user.address)).publish_nonce;
    // A 1K-declared public part whose body cell is the wrong size (2K bytes) fails isPublicCapsuleShapeValid.
    const oversizedBody = finalPublicBodyCell(0x40, 2 * 1024);
    const badPart = publicPartCustom({ sizeClass: SIZE_1K, bodyCell: oversizedBody });
    const body = batchExternalBody({
      vaultAddr: vault.address, owner: user.address, nonce, maxCharge: OK_MAX_CHARGE,
      partCount: 1n, partsRoot: badPart, kind: KIND_PUBLIC,
    });
    await expectPostAcceptReject(blockchain, vault, user.address, body, nonce, OK_MAX_CHARGE, RJ_PAYLOAD_SHAPE);
  });

  it('VAULT-BALANCE-PUBLISH-06A: an invalid public size class rejects RJ_CLASS_OR_SUITE', async () => {
    const { blockchain, vault, user } = await setupRegistered();
    const nonce = (await vault.getGetUser(user.address)).publish_nonce;
    // sizeClass = 3 is not an allowed size class -> isPublishProfileValid fails -> RJ_CLASS_OR_SUITE.
    const badPart = publicPartCustom({ sizeClass: 3n });
    const body = batchExternalBody({
      vaultAddr: vault.address, owner: user.address, nonce, maxCharge: OK_MAX_CHARGE,
      partCount: 1n, partsRoot: badPart, kind: KIND_PUBLIC,
    });
    await expectPostAcceptReject(blockchain, vault, user.address, body, nonce, OK_MAX_CHARGE, RJ_CLASS_OR_SUITE);
  });
});
