import { Address, beginCell, Cell, contractAddress, external, toNano } from '@ton/core';
import { Blockchain, createShardAccount, internal } from '@ton/sandbox';
import { keyPairFromSeed, sign } from '@ton/crypto';
import { createHash } from 'crypto';
import { Vault, RegisterMessagingKeys } from '../../build/Vault/Vault_Vault';
import {
  CapsuleHub,
  BindDeploymentManifest as CapsuleBind,
  SealGenesis as CapsuleSeal,
} from '../../build/CapsuleHub/CapsuleHub_CapsuleHub';
import {
  BindDeploymentManifest as VaultBind,
  BindOfficialAthWallet as VaultBindAth,
  BindProfileRegistry as VaultBindProfile,
  BindUsernameRegistry as VaultBindUsername,
  SealGenesis as VaultSeal,
} from '../../build/Vault/Vault_Vault';
import { FeeAccumulator } from '../../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import { ATHWallet } from '../../build/ATHWallet/ATHWallet_ATHWallet';
import {
  finalPrivateBodyCell,
  finalPrivateHeader0Cell,
  finalPrivateHeader1Cell,
  finalPublicBodyCell,
  finalPublicHeaderCell,
} from './capsule-cells';

// Shared VPB2 batch-publish test kit. ONE source of truth for the wire format, id derivation, deploy
// scaffolding, and tx inspection used by every batch suite — so the negative/positive matrices reuse it
// instead of re-deriving (and silently drifting from) the protocol. Cell builders are content-agnostic for
// the publish_id assertions (EPI1/BPI1 derive from ids + indices, not part bytes), so fills are arbitrary.

// ---------------------------------------------------------------------------
// Protocol constants
// ---------------------------------------------------------------------------
export const GENESIS_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn; // Vault standalone genesis/manifest
export const HUB_MANIFEST = 0x777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666n;   // Hub standalone manifest
export const MANIFEST_HASH = HUB_MANIFEST; // alias used by the bound-pair scenario

export const AUTH_KEY_PAIR = keyPairFromSeed(Buffer.alloc(32, 0x66));
export const AUTH_0 = BigInt('0x' + AUTH_KEY_PAIR.publicKey.toString('hex'));

export const OP_PUBLISH_BATCH = 0x7e1f5041n;
export const OP_PUBLISH_BATCH_TO_HUB = 0xa4f862d1n;
export const OP_CAPSULE_HUB_BATCH_ACK = 0x874e5771n;
export const OP_PRUNE_BATCH_PUBLISH = 0x720bdd6en;

export const VAULT_BATCH_PUBLISH_SIGNING_DOMAIN = 0x56504232n; // VPB2
export const VAULT_BATCH_PUBLISH_ID_DOMAIN = 0x42504931n;      // BPI1 (batch id)
export const CAPSULE_ENTRY_PUBLISH_ID_DOMAIN = 0x45504931n;    // EPI1 (per-entry id)

export const KIND_PRIVATE = 1n;
export const KIND_PUBLIC = 2n;
export const VPB2_VERSION = 1n;
export const SUITE_HYBRID = 2n;
export const SIZE_1K = 1n;
export const MARKETING_NOTE = 0x73656e742076696120506c6174686f2e417070n; // "sent via Platho.App"

// receipt action / result / reject codes
export const ACT_PUBLISH_BATCH = 7n;
export const RES_PROCESSING = 0n;
export const RES_CONFIRMED = 0x01n;
export const RES_BOUNCED_REFUNDED = 0x02n;
export const RES_TOMBSTONED = 0x03n;
export const RJ_PART_SHAPE = 0x11n;

export const AIRDROP_REWARD_PER_CAPSULE = 10_000_000_000n; // 10 ATH
export const VAULT_PENDING_PUBLISH_STALE_TTL = 86400n;
export const UINT64_MOD = 1n << 64n;
export const UINT160_MOD = 1n << 160n;

// RegisterMessagingKeys defaults (hybrid suite)
export const ENC_0 = 0x1000000000000000000000000000000000000000000000000000000000000001n;
export const SIG_0 = 0x2000000000000000000000000000000000000000000000000000000000000002n;
export const PQ_HASH = 0x5000000000000000000000000000000000000000000000000000000000000005n;

// ML-KEM-768 pubkey snake: the contract (validatePqPubkeyCell) requires the ROOT cell to carry the 41-byte
// remainder ("first chunk") and each deeper cell a full 127 bytes — i.e. a tail-built (backward) snake, NOT
// the leaf-remainder layout of capsule-cells' snakeCell. Build it root-first to satisfy the chunk walk.
function pqSnakeCell(byteLength: number, fill = 0x5a): Cell {
  let tail: Cell | null = null;
  for (let offset = byteLength; offset > 0;) {
    const start = Math.max(0, offset - 127);
    const builder = beginCell().storeBuffer(Buffer.alloc(offset - start, fill));
    if (tail) builder.storeRef(tail);
    tail = builder.endCell();
    offset = start;
  }
  return tail ?? beginCell().endCell();
}
export const PQ_CELL = pqSnakeCell(1184);

// ---------------------------------------------------------------------------
// Cell / address utilities
// ---------------------------------------------------------------------------
export const cellHash = (cell: Cell): bigint => BigInt('0x' + cell.hash().toString('hex'));
export const addressHash = (a: Address): bigint => BigInt('0x' + a.hash.toString('hex'));
export const addressCellHash = (a: Address): bigint => cellHash(beginCell().storeAddress(a).endCell());

export function fixtureAddress(label: string): Address {
  return new Address(0, createHash('sha256').update(`PLATHO.VPB2.${label}`).digest());
}

// ---------------------------------------------------------------------------
// Part builders. A part = size(8) suite(8) hash0(256) hash1(256) [hashBody(256)] refs..., singly linked.
// ---------------------------------------------------------------------------
export function privatePart(opts: { size?: bigint; fillBase?: number; next?: Cell | null } = {}): Cell {
  const size = opts.size ?? SIZE_1K;
  const f = opts.fillBase ?? 0;
  const h0 = finalPrivateHeader0Cell(0x30 + f);
  const h1 = finalPrivateHeader1Cell(0x31 + f);
  const body = finalPrivateBodyCell(size, 0x40 + f);
  const b = beginCell()
    .storeUint(size, 8).storeUint(SUITE_HYBRID, 8)
    .storeUint(cellHash(h0), 256).storeUint(cellHash(h1), 256).storeUint(cellHash(body), 256)
    .storeRef(h0).storeRef(h1).storeRef(body);
  if (opts.next) b.storeRef(opts.next);
  return b.endCell();
}

export function publicPart(opts: { size?: bigint; fillBase?: number; next?: Cell | null } = {}): Cell {
  const size = opts.size ?? SIZE_1K;
  const f = opts.fillBase ?? 0;
  const header = finalPublicHeaderCell(0x50, 8);
  const body = finalPublicBodyCell(0x40 + f, Number(size) * 1024);
  const b = beginCell()
    .storeUint(size, 8).storeUint(0, 8)
    .storeUint(cellHash(header), 256).storeUint(cellHash(body), 256)
    .storeRef(header).storeRef(body);
  if (opts.next) b.storeRef(opts.next);
  return b.endCell();
}

// Singly-linked list of `n` parts (private or public). Per-index fills keep parts distinct.
export function partsList(kind: bigint, n: number, size: bigint = SIZE_1K): Cell {
  let next: Cell | null = null;
  for (let i = n - 1; i >= 0; i -= 1) {
    next = kind === KIND_PRIVATE
      ? privatePart({ size, fillBase: i % 90, next })
      : publicPart({ size, fillBase: i % 90, next });
  }
  return next!;
}

export const marketingCell = (): Cell => beginCell().storeUint(MARKETING_NOTE, 152).endCell();

// A default non-zero batch publish_id for Hub-direct ingest tests (the Vault derives the real BPI1 id; the Hub
// only requires it to be non-zero and uses it as the EPI1 seed).
export const DEFAULT_BATCH_PUBLISH_ID = 0x9999000000000000000000000000000000000000000000000000000000009999n;

// Builds the PublishBatchToHub message the Vault forwards. marketing defaults to the canonical marker for
// public batches and null for private. Reused by every Hub-direct ingest/negative suite.
export function publishBatchToHub(opts: {
  parts: Cell;
  authorWallet: Address;
  publishId?: bigint;
  kind?: bigint;
  partCount?: bigint;
  protocolFeeTotal?: bigint;
  marketing?: Cell | null;
  bounceId?: bigint;
  bounceTag?: bigint;
}) {
  const kind = opts.kind ?? KIND_PRIVATE;
  return {
    $$type: 'PublishBatchToHub',
    bounce_id: opts.bounceId ?? 1n,
    bounce_tag: opts.bounceTag ?? 2n,
    publish_id: opts.publishId ?? DEFAULT_BATCH_PUBLISH_ID,
    publish_kind: kind,
    part_count: opts.partCount ?? 1n,
    protocol_fee_total: opts.protocolFeeTotal ?? 0n,
    author_wallet: opts.authorWallet,
    parts: opts.parts,
    marketing: opts.marketing !== undefined ? opts.marketing : (kind === KIND_PUBLIC ? marketingCell() : null),
  } as any;
}

// ---------------------------------------------------------------------------
// publish_id derivation (mirrors the contracts)
// ---------------------------------------------------------------------------
export function computeBatchPublishId(opts: {
  owner: Address; nonce: bigint; partsRoot: Cell; kind?: bigint; partCount?: bigint; genesisHash?: bigint;
}): bigint {
  return cellHash(beginCell()
    .storeUint(VAULT_BATCH_PUBLISH_ID_DOMAIN, 32)
    .storeUint(opts.genesisHash ?? GENESIS_HASH, 256)
    .storeAddress(opts.owner)
    .storeUint(opts.nonce, 64)
    .storeUint(cellHash(opts.partsRoot), 256)
    .storeUint(opts.kind ?? KIND_PRIVATE, 8)
    .storeUint(opts.partCount ?? 1n, 8)
    .endCell());
}

export function computeEntryPublishId(batchPublishId: bigint, partIndex: number): bigint {
  return cellHash(beginCell()
    .storeUint(CAPSULE_ENTRY_PUBLISH_ID_DOMAIN, 32)
    .storeUint(batchPublishId, 256)
    .storeUint(BigInt(partIndex), 16)
    .endCell());
}

export const bounceIdOf = (publishId: bigint): bigint => publishId % UINT64_MOD;
export const bounceTagOf = (publishId: bigint): bigint =>
  cellHash(beginCell().storeUint(publishId, 256).endCell()) % UINT160_MOD;

// ---------------------------------------------------------------------------
// Signed batch external builder, with negative-test override knobs.
// ---------------------------------------------------------------------------
export interface BatchExternalOpts {
  vaultAddr: Address;
  owner: Address;                 // owner whose nonce/keys sign the batch
  nonce: bigint;
  maxCharge: bigint;
  partCount: bigint;
  partsRoot: Cell;
  kind?: bigint;
  domain?: bigint;                // wrong-domain negative
  version?: bigint;               // wrong-version negative
  genesisHash?: bigint;           // wrong-manifest negative
  vaultHashOverride?: bigint;     // wrong-vault-binding negative
  ownerHashOverride?: bigint;     // owner-hash-field mismatch negative
  signKey?: Buffer;               // wrong-signer negative (default AUTH_KEY_PAIR)
  signRootOverride?: Cell;        // sign a different cell than embedded (cell-hash / pre-domain negatives)
  envOwner?: Address;             // address put in the envelope (owner-spoof / cross-owner replay)
  trailerRef?: Cell;              // extra envelope ref (padding / drain vector)
}

export function batchExternalBody(opts: BatchExternalOpts): Cell {
  const root = beginCell()
    .storeUint(opts.domain ?? VAULT_BATCH_PUBLISH_SIGNING_DOMAIN, 32)
    .storeUint(opts.genesisHash ?? GENESIS_HASH, 256)
    .storeUint(opts.vaultHashOverride ?? addressHash(opts.vaultAddr), 256)
    .storeUint(opts.kind ?? KIND_PRIVATE, 8)
    .storeUint(opts.ownerHashOverride ?? addressHash(opts.owner), 256)
    .storeUint(opts.nonce, 64)
    .storeUint(opts.maxCharge, 128)
    .storeUint(opts.partCount, 8)
    .storeUint(opts.version ?? VPB2_VERSION, 8)
    .storeRef(opts.partsRoot)
    .endCell();
  const sig = sign((opts.signRootOverride ?? root).hash(), opts.signKey ?? AUTH_KEY_PAIR.secretKey);
  const env = beginCell()
    .storeUint(OP_PUBLISH_BATCH, 32)
    .storeAddress(opts.envOwner ?? opts.owner)
    .storeBuffer(sig)
    .storeRef(root);
  if (opts.trailerRef) env.storeRef(opts.trailerRef);
  return env.endCell();
}

// ---------------------------------------------------------------------------
// Transaction inspectors
// ---------------------------------------------------------------------------
export function txTo(res: any, addr: Address) {
  return res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === addr.toString());
}
export function txExitFor(res: any, addr: Address): number {
  const cp: any = txTo(res, addr)?.description?.computePhase;
  return cp?.type === 'vm' ? cp.exitCode : 0;
}
export function txCleanFor(res: any, addr: Address): boolean {
  const tx = txTo(res, addr);
  const cp: any = tx?.description?.computePhase;
  return tx !== undefined && (cp?.type !== 'vm' || cp.exitCode === 0);
}
// Convenience wrappers that accept an opened contract (has `.address`).
export const vaultTxExit = (res: any, vault: any): number => txExitFor(res, vault.address);
export const vaultTxClean = (res: any, vault: any): boolean => txCleanFor(res, vault.address);
export const hubTxExit = (res: any, hub: any): number => txExitFor(res, hub.address);

// ---------------------------------------------------------------------------
// Deploy scaffolding
// ---------------------------------------------------------------------------
export async function registerHybrid(vault: any, user: any, overrides: Partial<RegisterMessagingKeys> = {}) {
  await vault.send(user.getSender(), { value: toNano('0.1') }, {
    $$type: 'RegisterMessagingKeys',
    enc_pubkey: ENC_0, sign_pubkey: SIG_0, auth_pubkey: AUTH_0,
    pq_kem_pubkey_hash: PQ_HASH, pq_kem_pubkey_len: 1184n, pq_kem_pubkey: PQ_CELL,
    crypto_suite_mask: 2n,
    ...overrides,
  } as RegisterMessagingKeys);
}
export async function depositTon(vault: any, user: any, amount: bigint) {
  await vault.send(user.getSender(), { value: amount + 2_000_000n }, { $$type: 'DepositTon', amount } as any);
}

// A standalone pre-bound/pre-sealed Vault (the Hub is a treasury stand-in — the only thing the Vault
// forwards to). genesis_config_hash = GENESIS_HASH so signed batch bodies validate against it.
export async function setupVault(opts: { balance?: bigint } = {}) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const user = await blockchain.treasury('vpb2-user');
  const athWallet = await blockchain.treasury('vpb2-ath');
  const capsuleHub = await blockchain.treasury('vpb2-hub');
  const init = await Vault.init(athWallet.address, athWallet.address, capsuleHub.address, GENESIS_HASH, true, true, 0n);
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address, code: init.code, data: init.data, balance: opts.balance ?? toNano('3'), workchain: address.workChain,
  }));
  const vault = blockchain.openContract(new Vault(address, init));
  return { blockchain, vault, user, athWallet, capsuleHub };
}

// A standalone CapsuleHub. Default = pre-bound + pre-sealed (the Vault is a treasury stand-in, the only
// allowed sender). Pass { sealed:false } / { vaultBound:false } to exercise the genesis ceremony: an unbound
// Hub stands its bound-vault slot in with the controller address until BindDeploymentManifest runs.
export async function setupHub(opts: { balance?: bigint; sealed?: boolean; vaultBound?: boolean } = {}) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const feeAcc = await blockchain.treasury('vpb2-fee-acc');
  const vault = await blockchain.treasury('vpb2-bound-vault');
  const controller = await blockchain.treasury('vpb2-controller');
  const sealed = opts.sealed ?? true;
  const vaultBound = opts.vaultBound ?? true;
  const init = await CapsuleHub.init(
    feeAcc.address,
    vaultBound ? vault.address : controller.address,
    vaultBound,
    sealed,
    sealed ? HUB_MANIFEST : 0n,
    controller.address,
  );
  const addr = contractAddress(0, init);
  await blockchain.setShardAccount(addr, createShardAccount({
    address: addr, code: init.code, data: init.data, balance: opts.balance ?? toNano('200'), workchain: 0,
  }));
  const hub = blockchain.openContract(new CapsuleHub(addr, init));
  return { blockchain, hub, vault, controller, feeAcc };
}

async function deriveAthWallet(owner: Address, athMaster: Address): Promise<Address> {
  return contractAddress(owner.workChain, await ATHWallet.init(0n, owner, athMaster));
}

// The real genesis pair: a bound+sealed Vault and CapsuleHub (plus FeeAccumulator) wired to each other, so
// a signed batch external drives the full Vault accept -> PublishBatchToHub -> Hub ingest -> ACK -> settle
// chain end to end. Used by the E2E + real-capsule suites. genesis_config_hash = addressCellHash(deployer).
export async function deployBoundSealedPair() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const deployer = await blockchain.treasury('vpb2-e2e-deployer');
  const user = await blockchain.treasury('vpb2-e2e-user');
  const feeTreasury = await blockchain.treasury('vpb2-e2e-fee-treasury');

  const vaultInit = await Vault.init(deployer.address, deployer.address, fixtureAddress('UNBOUND_HUB'), addressCellHash(deployer.address), false, false, 0n);
  const vaultAddress = contractAddress(0, vaultInit);
  const officialAthWallet = await deriveAthWallet(vaultAddress, deployer.address);
  await blockchain.setShardAccount(vaultAddress, createShardAccount({ address: vaultAddress, code: vaultInit.code, data: vaultInit.data, balance: toNano('5'), workchain: 0 }));
  const vault = blockchain.openContract(new Vault(vaultAddress, vaultInit));

  const feeInit = await FeeAccumulator.init(feeTreasury.address, fixtureAddress('BUYBACK'));
  const feeAddress = contractAddress(0, feeInit);
  await blockchain.setShardAccount(feeAddress, createShardAccount({ address: feeAddress, code: feeInit.code, data: feeInit.data, balance: toNano('2'), workchain: 0 }));

  const hubInit = await CapsuleHub.init(feeAddress, fixtureAddress('UNBOUND_VAULT'), false, false, 0n, deployer.address);
  const hubAddress = contractAddress(0, hubInit);
  await blockchain.setShardAccount(hubAddress, createShardAccount({ address: hubAddress, code: hubInit.code, data: hubInit.data, balance: toNano('200'), workchain: 0 }));
  const hub = blockchain.openContract(new CapsuleHub(hubAddress, hubInit));

  const send = (to: any, body: any) => to.send(deployer.getSender(), { value: toNano('0.05') }, body);
  await send(vault, { $$type: 'BindDeploymentManifest', deployment_manifest_hash: MANIFEST_HASH, counterpart_address: hubAddress } as VaultBind);
  await send(hub, { $$type: 'BindDeploymentManifest', deployment_manifest_hash: MANIFEST_HASH, counterpart_address: vaultAddress } as CapsuleBind);
  await send(vault, { $$type: 'BindOfficialAthWallet', deployment_manifest_hash: MANIFEST_HASH, official_ath_wallet_address: officialAthWallet } as VaultBindAth);
  await send(vault, { $$type: 'BindProfileRegistry', deployment_manifest_hash: MANIFEST_HASH, profile_registry_address: fixtureAddress('PROFILE_REG') } as VaultBindProfile);
  await send(vault, { $$type: 'BindUsernameRegistry', deployment_manifest_hash: MANIFEST_HASH, username_registry_address: fixtureAddress('USERNAME_REG') } as VaultBindUsername);
  await send(vault, { $$type: 'SealGenesis', deployment_manifest_hash: MANIFEST_HASH } as VaultSeal);
  await send(hub, { $$type: 'SealGenesis', deployment_manifest_hash: MANIFEST_HASH } as CapsuleSeal);

  return { blockchain, vault, hub, user, vaultAddress, hubAddress, deployer, genesisHash: addressCellHash(deployer.address) };
}

export { internal, external };
