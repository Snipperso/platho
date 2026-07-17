import { Address, beginCell, Cell, contractAddress, Dictionary, external, toNano } from '@ton/core';
import { Blockchain, createShardAccount, internal } from '@ton/sandbox';
import { keyPairFromSeed, sign } from '@ton/crypto';
import { createHash } from 'crypto';
import { Vault, RegisterMessagingKeys, storeVault$Data } from '../../build/Vault/Vault_Vault';
import {
  CapsuleHub,
  BindDeploymentManifest as CapsuleBind,
  SealGenesis as CapsuleSeal,
  BindCreditIssuer as CapsuleBindCredit,
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
export const KIND_INTRO = 3n; // clean-16 ИНК4: first-contact stealth lane
export const KIND_RECOVERY = 4n; // clean-16 ИНК6: K_root durability lane (self-recovery, latest-wins slot map)
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
// Post-accept batch reject codes — stored in the receipt-ring slot's `result` field (the reject-with-refund
// path: external completes exit 0, nonce burned, balance refunded, receipt.result == one of these).
export const RJ_PART_SHAPE = 0x11n;
export const RJ_CLASS_OR_SUITE = 0x12n;
export const RJ_HASH_MISMATCH = 0x13n;
export const RJ_PAYLOAD_SHAPE = 0x14n;
export const RJ_DUPLICATE_ADJACENT = 0x15n;
export const RJ_UNDERPRICED = 0x16n;
export const RJ_BINDING = 0x17n;
export const RJ_ID_ZERO = 0x18n;
export const RJ_PENDING_COLLISION = 0x19n;

// Private size classes (hybrid). Public allows 1K/2K only.
export const SIZE_2K = 2n;
export const SIZE_4K = 4n;
export const SIZE_8K = 8n;
export const SIZE_16K = 16n;
export const SIZE_32K = 32n;

// Fee / activity-airdrop discount constants (mirror contracts/Vault.tact).
export const PROTOCOL_FEE_TON_BATCH = 10_000_000n;            // full per-part protocol fee (0.01 TON)
export const ATH_FULL_DISCOUNT_AMOUNT = 10_000_000_000_000n;  // ATH balance that fully discounts the fee
export const VAULT_ACTIVITY_AIRDROP_TOTAL_ATH = 15_000_000_000_000_000n; // genesis_config_hash pin at seal
export const VAULT_ACTIVITY_AIRDROP_DISCOUNT_UNLOCK_REMAINING_ATH = 0n;  // discount unlocks when remaining <= this

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

export function publicPart(opts: { size?: bigint; fillBase?: number; parentLink?: bigint; next?: Cell | null } = {}): Cell {
  const size = opts.size ?? SIZE_1K;
  const f = opts.fillBase ?? 0;
  const header = finalPublicHeaderCell(0x50, 8);
  const body = finalPublicBodyCell(0x40 + f, Number(size) * 1024);
  const b = beginCell()
    .storeUint(size, 8).storeUint(0, 8)
    .storeUint(opts.parentLink ?? 0n, 64)
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

// A singly-linked chain of `cells` cells (one ref each) — for public body ref-overflow boundary tests.
export function refChainCell(cells: number, fill = 0x6a): Cell {
  let tail: Cell | null = null;
  for (let i = cells - 1; i >= 0; i -= 1) {
    const b = beginCell().storeUint(fill, 8);
    if (tail) b.storeRef(tail);
    tail = b.endCell();
  }
  return tail ?? beginCell().endCell();
}

// Fully-overridable private part frame (size(8) suite(8) h0(256) h1(256) bh(256) + ref h0,h1,body[,next]). Every
// hash/cell/field is independently settable so negative tests can mismatch a declared hash, zero a field, or feed
// wrong-sized cells (or real crypto-lib cells). Defaults reproduce a valid 1K hybrid part.
export function privatePartCustom(opts: {
  sizeClass?: bigint; suite?: bigint;
  h0Hash?: bigint; h1Hash?: bigint; bodyHash?: bigint;
  h0Cell?: Cell; h1Cell?: Cell; bodyCell?: Cell;
  next?: Cell | null;
} = {}): Cell {
  const size = opts.sizeClass ?? SIZE_1K;
  const h0 = opts.h0Cell ?? finalPrivateHeader0Cell();
  const h1 = opts.h1Cell ?? finalPrivateHeader1Cell();
  const body = opts.bodyCell ?? finalPrivateBodyCell(size);
  const b = beginCell()
    .storeUint(size, 8).storeUint(opts.suite ?? SUITE_HYBRID, 8)
    .storeUint(opts.h0Hash ?? cellHash(h0), 256)
    .storeUint(opts.h1Hash ?? cellHash(h1), 256)
    .storeUint(opts.bodyHash ?? cellHash(body), 256)
    .storeRef(h0).storeRef(h1).storeRef(body);
  if (opts.next) b.storeRef(opts.next);
  return b.endCell();
}

// Fully-overridable public part frame (size(8) reserved(8) h(256) bh(256) + ref header,body[,next]).
export function publicPartCustom(opts: {
  sizeClass?: bigint; reserved?: bigint; parentLink?: bigint;
  hHash?: bigint; bodyHash?: bigint;
  hCell?: Cell; bodyCell?: Cell;
  next?: Cell | null;
} = {}): Cell {
  const size = opts.sizeClass ?? SIZE_1K;
  const header = opts.hCell ?? finalPublicHeaderCell(0x50, 8);
  const body = opts.bodyCell ?? finalPublicBodyCell(0x40, Number(size) * 1024);
  const b = beginCell()
    .storeUint(size, 8).storeUint(opts.reserved ?? 0n, 8)
    .storeUint(opts.parentLink ?? 0n, 64)
    .storeUint(opts.hHash ?? cellHash(header), 256)
    .storeUint(opts.bodyHash ?? cellHash(body), 256)
    .storeRef(header).storeRef(body);
  if (opts.next) b.storeRef(opts.next);
  return b.endCell();
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
  signRootOverride?: Cell;        // sign a different cell than embedded (cell-hash negative)
  rootOverride?: Cell;            // embed AND sign a fully custom root (no-domain / trailing-bit-in-root negatives)
  envOwner?: Address;             // address put in the envelope (owner-spoof / cross-owner replay)
  trailerRef?: Cell;              // extra envelope ref (padding / drain vector)
}

export function batchExternalBody(opts: BatchExternalOpts): Cell {
  const root = opts.rootOverride ?? beginCell()
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
  const feeAccumulator = blockchain.openContract(new FeeAccumulator(feeAddress, feeInit));

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
  // clean-16 B3: the Hub's SealGenesis now requires a bound CreditIssuer (12923) — the anon-publish pool/issuer-mirror
  // wiring must exist before seal (BindCreditIssuer needs unsealed, so a post-seal bind is impossible). A treasury
  // stands in for the CreditIssuer address here: FundAnonPool's gate is sender()==credit_issuer_address, so this
  // treasury can fund the pool directly in the B3 spend tests (no separate CreditIssuer deploy needed on the Hub side).
  const creditIssuer = await blockchain.treasury('vpb2-e2e-credit-issuer');
  await send(hub, { $$type: 'BindCreditIssuer', credit_issuer_address: creditIssuer.address } as CapsuleBindCredit);
  await send(vault, { $$type: 'SealGenesis', deployment_manifest_hash: MANIFEST_HASH } as VaultSeal);
  await send(hub, { $$type: 'SealGenesis', deployment_manifest_hash: MANIFEST_HASH } as CapsuleSeal);

  return { blockchain, vault, hub, user, vaultAddress, hubAddress, deployer, feeAccumulator, feeAddress, creditIssuer, genesisHash: addressCellHash(deployer.address) };
}

// A standalone pre-bound/pre-sealed Vault whose genesis_config_hash is poked to `airdropRemaining` so the
// activity-airdrop fee discount can be exercised: discountedFee unlocks only when genesis_config_hash <=
// VAULT_ACTIVITY_AIRDROP_DISCOUNT_UNLOCK_REMAINING_ATH (0), but init pins it to the airdrop TOTAL at seal — so the
// only way to reach the unlocked state in a sandbox is to write the storage cell directly (matching the live
// Vault$Data layout). manifest = GENESIS_HASH (signed batches validate); binding_flags = 7 (all bound).
export async function setupVaultAirdrop(opts: { airdropRemaining: bigint; balance?: bigint }) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const user = await blockchain.treasury('vpb2-air-user');
  const athWallet = await blockchain.treasury('vpb2-air-ath');
  const capsuleHub = await blockchain.treasury('vpb2-air-hub');
  const init = await Vault.init(athWallet.address, athWallet.address, capsuleHub.address, GENESIS_HASH, true, true, 0n);
  const address = contractAddress(0, init);
  const data = beginCell().storeBit(true).store(storeVault$Data({
    $$type: 'Vault$Data',
    vault_ath_wallet_address: athWallet.address,
    ath_master_address: athWallet.address,
    capsule_hub_address: capsuleHub.address,
    profile_registry_address: capsuleHub.address,
    username_registry_address: capsuleHub.address,
    binding_flags: 7n,
    sealed: true,
    deployment_manifest_hash: GENESIS_HASH,
    genesis_config_hash: opts.airdropRemaining,
    users: Dictionary.empty(),
    key_records: Dictionary.empty(),
    processed_ath_deposits: Dictionary.empty(),
    pending_ath_withdrawals: Dictionary.empty(),
    pending_batch_publishes: Dictionary.empty(),
    pending_profile_avatar_payments: Dictionary.empty(),
    pending_username_mint_payments: Dictionary.empty(),
    user_count: 0n,
    key_record_count: 0n,
    processed_ath_deposit_count: 0n,
    pending_ath_withdrawal_count: 0n,
    pending_publish_count: 0n,
    genesis_ext: beginCell().storeUint(GENESIS_HASH, 256).storeBit(false).endCell(),
  })).endCell();
  await blockchain.setShardAccount(address, createShardAccount({
    address, code: init.code, data, balance: opts.balance ?? toNano('10'), workchain: 0,
  }));
  const vault = blockchain.openContract(new Vault(address, init));
  return { blockchain, vault, user, athWallet, capsuleHub };
}

export { internal, external };
