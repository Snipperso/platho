import { Address, beginCell, Cell, contractAddress, external, toNano } from '@ton/core';
import { Blockchain, createShardAccount, defaultConfig, loadConfig } from '@ton/sandbox';
import { keyPairFromSeed, sign } from '@ton/crypto';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import {
  CapsuleHub,
  BindDeploymentManifest as CapsuleBind,
  SealGenesis as CapsuleSeal,
  PublishPrivateFromVault,
  PublishPublicFromVault,
  TopUpStorageReserve as CapsuleTopUpStorageReserve,
} from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';
import {
  Vault,
  BindDeploymentManifest as VaultBind,
  BindOfficialAthWallet as VaultBindAth,
  BindProfileRegistry as VaultBindProfile,
  BindUsernameRegistry as VaultBindUsername,
  SealGenesis as VaultSeal,
  RegisterMessagingKeys,
  TopUpStorageReserve as VaultTopUpStorageReserve,
} from '../build/Vault/Vault_Vault';

const MANIFEST_HASH = 0x777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666n;
const VAULT_PUBLISH_SIGNING_DOMAIN = 0x56504231n;
const PLATHO_PUBLIC_MARKETING_NOTE = 0x73656e742076696120506c6174686f2e417070n;

const KIND_PRIVATE = 1n;
const KIND_PUBLIC = 2n;
const SIZE_CLASSES = [1n, 2n, 4n, 8n, 16n, 32n] as const;
const SUITE_PUBLIC_NONE = 0n;
const SUITE_HYBRID = 2n;

const CURRENT = {
  vaultPublic1kLocalExec: 8_700_000n,
  vaultPublic2kLocalExec: 13_800_000n,
  vaultPublic4kLocalExec: 17_300_000n,
  vaultPublic8kLocalExec: 24_400_000n,
  vaultPublic16kLocalExec: 38_900_000n,
  vaultPublic32kLocalExec: 67_600_000n,
  vaultPrivateHybrid1kLocalExec: 12_000_000n,
  vaultPrivateHybrid2kLocalExec: 13_800_000n,
  vaultPrivateHybrid4kLocalExec: 17_300_000n,
  vaultPrivateHybrid8kLocalExec: 24_400_000n,
  vaultPrivateHybrid16kLocalExec: 38_900_000n,
  vaultPrivateHybrid32kLocalExec: 67_600_000n,
  vaultPendingRefundExec: 4_200_000n,
  privateHybridFee: 10_000_000n,
  publicFee: 10_000_000n,
  privateCapsulehub1kExec: 4_200_000n,
  privateCapsulehub2kExec: 4_300_000n,
  privateCapsulehub4kExec: 4_500_000n,
  privateCapsulehub8kExec: 5_000_000n,
  privateCapsulehub16kExec: 5_800_000n,
  privateCapsulehub32kExec: 7_600_000n,
  public1kExec: 2_400_000n,
  public2kExec: 4_300_000n,
  public4kExec: 4_500_000n,
  public8kExec: 5_000_000n,
  public16kExec: 5_800_000n,
  public32kExec: 7_600_000n,
  storageKeepalive: 1_000_000n,
  privateEntryStorage: 3_300_000n,
  publicEntryStorage: 7_400_000n,
  pageStorage: 0n,
  ackForward: 30_000_000n,
};

type PublishCaseId = string;

type PublishCaseSpec = {
  id: PublishCaseId;
  sizeClass: bigint;
  cryptoSuite: bigint;
  protocolFee: bigint;
  keySeed: number;
};

type TxMetric = {
  role: string;
  inbound_type: string;
  inbound_value_nanotons: string;
  total_fees_nanotons: string;
  storage_fees_nanotons: string;
  gas_used: string;
  gas_fees_nanotons: string;
  action_fees_nanotons: string;
  fwd_fees_nanotons: string;
  out_messages: number;
  aborted: boolean;
  success: boolean;
  exit_code: number | null;
};

type PublishCaseReport = {
  id: PublishCaseId;
  canonical_max_charge_nanotons: string;
  protocol_fee_nanotons: string;
  user_net_debit_nanotons: string;
  vault_external_fee_nanotons: string;
  capsulehub_publish_fee_nanotons: string;
  vault_ack_fee_nanotons: string;
  one_year_storage_fee_nanotons: string;
  recommended: {
    vault_local_exec_reserve_nanotons: string;
    capsulehub_exec_reserve_nanotons: string;
    vault_pending_refund_exec_reserve_nanotons: string;
    storage_endowment_1y_x2_nanotons: string;
    storage_endowment_3y_x2_nanotons: string;
    storage_endowment_5y_x2_nanotons: string;
    net_price_1y_storage_x2_nanotons: string;
    net_price_3y_storage_x2_nanotons: string;
    net_price_5y_storage_x2_nanotons: string;
  };
  transactions: TxMetric[];
};

type PricingReport = {
  profile: 'PLATHO.V1.PUBLISH_RESERVE_PRICING';
  status: 'PASS';
  generated_at: 'DETERMINISTIC_ARTIFACT';
  code_hashes: {
    vault: string;
    capsulehub: string;
    ath_wallet: string;
  };
  policy: {
    network_fee_basis: string;
    reference_safety_multiplier: string;
    storage_note: string;
    current_code_hash_gate: string;
  };
  fee_config_snapshot: Record<string, string>;
  current_constants_nanotons: Record<string, string>;
  cases: PublishCaseReport[];
};

function codeHash(relPath: string): string {
  return Cell.fromBoc(fs.readFileSync(relPath))[0].hash().toString('hex');
}

function currentFeeConfigSnapshot(): Record<string, string> {
  const config = loadConfig(defaultConfig) as any;
  const storagePrices = config['18']?.anon0;
  const gas = config['21']?.anon0;
  const forward = config['25']?.anon0;
  if (!storagePrices || !gas || !forward) {
    throw new Error('Bundled sandbox config is missing basechain storage/gas/forward fee params 18/21/25');
  }
  let latestStorage: any = null;
  for (const [, storage] of storagePrices) {
    if (!latestStorage || Number(storage.utime_since) > Number(latestStorage.utime_since)) {
      latestStorage = storage;
    }
  }
  if (!latestStorage) {
    throw new Error('Bundled sandbox config has no basechain storage fee schedule in param 18');
  }
  const gasOther = gas.other;
  const snapshot: Record<string, string> = {
    source: '@ton/sandbox defaultConfig, verified against TON mainnet config on 2026-06-02',
    config_18_latest_utime_since: String(latestStorage.utime_since),
    config_18_latest_bit_price_ps: String(latestStorage.bit_price_ps),
    config_18_latest_cell_price_ps: String(latestStorage._cell_price_ps),
    config_18_latest_mc_bit_price_ps: String(latestStorage.mc_bit_price_ps),
    config_18_latest_mc_cell_price_ps: String(latestStorage.mc_cell_price_ps),
    config_21_flat_gas_limit: String(gas.flat_gas_limit),
    config_21_flat_gas_price: String(gas.flat_gas_price),
    config_21_gas_price: String(gasOther.gas_price),
    config_21_gas_limit: String(gasOther.gas_limit),
    config_21_special_gas_limit: String(gasOther.special_gas_limit),
    config_25_lump_price: String(forward.lump_price),
    config_25_bit_price: String(forward.bit_price),
    config_25_cell_price: String(forward._cell_price),
  };
  const expected: Record<string, string> = {
    config_18_latest_utime_since: '1777500000',
    config_18_latest_bit_price_ps: '0',
    config_18_latest_cell_price_ps: '135',
    config_18_latest_mc_bit_price_ps: '1000',
    config_18_latest_mc_cell_price_ps: '500000',
    config_21_flat_gas_limit: '100',
    config_21_flat_gas_price: '6667',
    config_21_gas_price: '4369067',
    config_25_lump_price: '66667',
    config_25_bit_price: '4369067',
    config_25_cell_price: '436906667',
  };
  for (const [key, value] of Object.entries(expected)) {
    if (snapshot[key] !== value) {
      throw new Error(`Bundled fee config ${key}=${snapshot[key]} does not match the audited 2026-06-02 TON mainnet value ${value}`);
    }
  }
  return snapshot;
}

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.PUBLISH.RESERVE.${label}`).digest());
}

function addressHash(address: Address): bigint {
  return BigInt('0x' + beginCell().storeAddress(address).endCell().hash().toString('hex'));
}

function compactAddressHash(address: Address): bigint {
  if (address.workChain !== 0) {
    throw new Error(`Expected basechain address, got workchain ${address.workChain}`);
  }
  return BigInt('0x' + address.hash.toString('hex'));
}

function snakeCell(byteLength: number, fill: number): Cell {
  const bytes = Buffer.alloc(byteLength, fill);
  return snakeCellFromBytes(bytes);
}

function snakeCellFromBytes(bytes: Buffer): Cell {
  const chunks: Buffer[] = [];
  for (let offset = 0; offset < bytes.length; offset += 127) {
    chunks.push(Buffer.from(bytes.subarray(offset, offset + 127)));
  }
  let tail: Cell | null = null;
  for (let index = chunks.length - 1; index >= 0; index -= 1) {
    const builder = beginCell().storeBuffer(chunks[index]);
    if (tail) {
      builder.storeRef(tail);
    }
    tail = builder.endCell();
  }
  return tail ?? beginCell().endCell();
}

function mlKemPubkeySnakeCell(byteLength: number, fill: number): Cell {
  const bytes = Buffer.alloc(byteLength, fill);
  let tail: Cell | null = null;
  for (let offset = bytes.length; offset > 0;) {
    const start = Math.max(0, offset - 127);
    const builder = beginCell().storeBuffer(bytes.subarray(start, offset));
    if (tail) {
      builder.storeRef(tail);
    }
    tail = builder.endCell();
    offset = start;
  }
  return tail ?? beginCell().endCell();
}

function cellHash(cell: Cell): bigint {
  return BigInt('0x' + cell.hash().toString('hex'));
}

async function deriveAthWallet(owner: Address, athMasterAddress: Address): Promise<Address> {
  const walletInit = await ATHWallet.init(0n, owner, athMasterAddress);
  return contractAddress(owner.workChain, walletInit);
}

async function setupBoundPair(label: string) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const deployer = await blockchain.treasury(`reserve-${label}-deployer`);
  const user = await blockchain.treasury(`reserve-${label}-user`);
  const feeAccumulator = fixtureAddress(`${label}_FEE_ACCUMULATOR`);

  const vaultInit = await Vault.init(deployer.address, deployer.address, fixtureAddress(`${label}_UNBOUND_CAPSULE`), addressHash(deployer.address), false, false, 0n);
  const vaultAddress = contractAddress(0, vaultInit);
  const officialAthWallet = await deriveAthWallet(vaultAddress, deployer.address);
  await blockchain.setShardAccount(vaultAddress, createShardAccount({
    address: vaultAddress,
    code: vaultInit.code,
    data: vaultInit.data,
    balance: toNano('3'),
    workchain: vaultAddress.workChain,
  }));
  const vault = blockchain.openContract(new Vault(vaultAddress, vaultInit));

  const capsuleInit = await CapsuleHub.init(feeAccumulator, fixtureAddress(`${label}_UNBOUND_VAULT`), false, false, 0n, deployer.address);
  const capsuleAddress = contractAddress(0, capsuleInit);
  await blockchain.setShardAccount(capsuleAddress, createShardAccount({
    address: capsuleAddress,
    code: capsuleInit.code,
    data: capsuleInit.data,
    balance: toNano('3'),
    workchain: capsuleAddress.workChain,
  }));
  const capsule = blockchain.openContract(new CapsuleHub(capsuleAddress, capsuleInit));

  await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindDeploymentManifest',
    deployment_manifest_hash: MANIFEST_HASH,
    counterpart_address: capsuleAddress,
  } as VaultBind);
  await capsule.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindDeploymentManifest',
    deployment_manifest_hash: MANIFEST_HASH,
    counterpart_address: vaultAddress,
  } as CapsuleBind);
  await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialAthWallet,
  } as VaultBindAth);
  await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindProfileRegistry',
    deployment_manifest_hash: MANIFEST_HASH,
    profile_registry_address: fixtureAddress(`${label}_PROFILE_REGISTRY`),
  } as VaultBindProfile);
  await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindUsernameRegistry',
    deployment_manifest_hash: MANIFEST_HASH,
    username_registry_address: fixtureAddress(`${label}_USERNAME_REGISTRY`),
  } as VaultBindUsername);
  await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as VaultSeal);
  await capsule.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as CapsuleSeal);

  return { blockchain, deployer, user, vault, capsule };
}

async function registerKeys(vault: any, user: any, seedByte: number) {
  const messagingKeyPair = keyPairFromSeed(Buffer.alloc(32, seedByte));
  const authKeyPair = keyPairFromSeed(Buffer.alloc(32, seedByte + 64));
  const pqKemPubkey = mlKemPubkeySnakeCell(1184, 0x5a);
  await vault.send(user.getSender(), { value: toNano('0.05') }, {
    $$type: 'RegisterMessagingKeys',
    enc_pubkey: 1n,
    sign_pubkey: BigInt('0x' + messagingKeyPair.publicKey.toString('hex')),
    auth_pubkey: BigInt('0x' + authKeyPair.publicKey.toString('hex')),
    pq_kem_pubkey_hash: BigInt('0x' + pqKemPubkey.hash().toString('hex')),
    pq_kem_pubkey_len: 1184n,
    pq_kem_pubkey: pqKemPubkey,
    crypto_suite_mask: SUITE_HYBRID,
  } as RegisterMessagingKeys);
  return authKeyPair;
}

async function topUpVaultTon(vault: any, user: any, amount: bigint) {
  await vault.send(user.getSender(), { value: amount + 12_000_000n }, {
    $$type: 'DepositTon',
    amount,
  });
}

function privateBodyBytes(sizeClass: bigint, cryptoSuite: bigint): number {
  if (cryptoSuite !== SUITE_HYBRID) {
    throw new Error(`unsupported private crypto suite ${cryptoSuite}`);
  }
  const overhead = 1204;
  return overhead + (Number(sizeClass) * 1024);
}

function privateCells(sizeClass: bigint, cryptoSuite: bigint) {
  if (cryptoSuite !== SUITE_HYBRID) {
    throw new Error(`unsupported private crypto suite ${cryptoSuite}`);
  }
  const header0 = snakeCell(140, 0x42);
  const header1 = snakeCell(30, 0x43);
  const body = snakeCell(privateBodyBytes(sizeClass, cryptoSuite), 0x44);
  return { header0, header1, body };
}

function publicCells(sizeClass: bigint) {
  const header = snakeCell(72, 0x50);
  const body = snakeCell(Number(sizeClass) * 1024, 0x70);
  return { header, body };
}

function signedPrivatePublishBody(owner: Address, nonce: bigint, maxCharge: bigint, secretKey: Buffer, vaultAddress: Address, sizeClass: bigint, cryptoSuite: bigint): Cell {
  const cells = privateCells(sizeClass, cryptoSuite);
  const payload = beginCell()
    .storeUint(sizeClass, 8)
    .storeUint(cryptoSuite, 8)
    .storeUint(cellHash(cells.header0), 256)
    .storeUint(cellHash(cells.header1), 256)
    .storeUint(cellHash(cells.body), 256)
    .storeRef(cells.header0)
    .storeRef(cells.header1)
    .storeRef(cells.body)
    .endCell();
  const signedDataCell = beginCell()
    .storeUint(VAULT_PUBLISH_SIGNING_DOMAIN, 32)
    .storeUint(MANIFEST_HASH, 256)
    .storeUint(compactAddressHash(vaultAddress), 256)
    .storeUint(KIND_PRIVATE, 8)
    .storeUint(compactAddressHash(owner), 256)
    .storeUint(nonce, 64)
    .storeUint(maxCharge, 128)
    .storeUint(sizeClass, 8)
    .storeUint(cryptoSuite, 8)
    .storeRef(payload)
    .endCell();
  return beginCell()
    .storeUint(0x7E1F5031, 32)
    .storeAddress(owner)
    .storeBuffer(sign(signedDataCell.hash(), secretKey))
    .storeRef(signedDataCell)
    .endCell();
}

function signedPublicPublishBody(owner: Address, nonce: bigint, maxCharge: bigint, secretKey: Buffer, vaultAddress: Address, sizeClass: bigint): Cell {
  const cells = publicCells(sizeClass);
  const payload = beginCell()
    .storeUint(cellHash(cells.header), 256)
    .storeUint(cellHash(cells.body), 256)
    .storeRef(cells.header)
    .storeRef(cells.body)
    .endCell();
  const signedDataCell = beginCell()
    .storeUint(VAULT_PUBLISH_SIGNING_DOMAIN, 32)
    .storeUint(MANIFEST_HASH, 256)
    .storeUint(compactAddressHash(vaultAddress), 256)
    .storeUint(KIND_PUBLIC, 8)
    .storeUint(compactAddressHash(owner), 256)
    .storeUint(nonce, 64)
    .storeUint(maxCharge, 128)
    .storeUint(sizeClass, 8)
    .storeUint(SUITE_PUBLIC_NONE, 8)
    .storeRef(payload)
    .endCell();
  return beginCell()
    .storeUint(0x7E1F5032, 32)
    .storeAddress(owner)
    .storeBuffer(sign(signedDataCell.hash(), secretKey))
    .storeRef(signedDataCell)
    .endCell();
}

function addressFromTx(tx: any): Address | null {
  const info = tx.inMessage?.info;
  if (info?.type === 'external-in') {
    return info.dest ?? null;
  }
  if (info?.type === 'internal') {
    return info.dest ?? null;
  }
  return null;
}

function inboundType(tx: any): string {
  return tx.inMessage?.info?.type ?? 'unknown';
}

function inboundValue(tx: any): bigint {
  const info = tx.inMessage?.info;
  if (info?.type === 'internal') {
    return info.value?.coins ?? 0n;
  }
  return 0n;
}

function txStorageFees(tx: any): bigint {
  return tx.description?.storagePhase?.storageFeesCollected ?? 0n;
}

function txMetric(tx: any, role: string): TxMetric {
  const desc = tx.description;
  const compute = desc?.computePhase?.type === 'vm' ? desc.computePhase : null;
  const action = desc?.actionPhase;
  return {
    role,
    inbound_type: inboundType(tx),
    inbound_value_nanotons: String(inboundValue(tx)),
    total_fees_nanotons: String(tx.totalFees?.coins ?? 0n),
    storage_fees_nanotons: String(txStorageFees(tx)),
    gas_used: String(compute?.gasUsed ?? 0n),
    gas_fees_nanotons: String(compute?.gasFees ?? 0n),
    action_fees_nanotons: String(action?.totalActionFees ?? 0n),
    fwd_fees_nanotons: String(action?.totalFwdFees ?? 0n),
    out_messages: Number(tx.outMessagesCount ?? 0),
    aborted: Boolean(desc?.aborted),
    success: Boolean(compute?.success ?? true),
    exit_code: compute?.exitCode ?? null,
  };
}

function ceilMul(value: bigint, multiplier: bigint): bigint {
  return value * multiplier;
}

function roundUp(value: bigint, quantum: bigint): bigint {
  return ((value + quantum - 1n) / quantum) * quantum;
}

function txAtRole(tx: any, ctx: { vaultAddress: Address; capsuleAddress: Address }): string {
  const address = addressFromTx(tx);
  if (!address) {
    return 'unknown';
  }
  if (address.equals(ctx.vaultAddress)) {
    return inboundType(tx) === 'external-in' ? 'vault_external_publish' : 'vault_ack_or_bounce';
  }
  if (address.equals(ctx.capsuleAddress)) {
    return 'capsulehub_publish';
  }
  return 'other';
}

function sumFees(metrics: TxMetric[], role: string): bigint {
  return metrics
    .filter((m) => m.role === role)
    .reduce((acc, m) => acc + BigInt(m.total_fees_nanotons), 0n);
}

async function oneYearStorageFee(id: PublishCaseId, sizeClass: bigint, cryptoSuite: bigint): Promise<bigint> {
  const ctx = await setupBoundPair(`storage-${id}`);
  const { blockchain, deployer, user, vault, capsule } = ctx;
  const keyPair = await registerKeys(vault, user, 80 + Number(sizeClass));
  const isPublic = id.startsWith('public_');
  const maxCharge = isPublic
    ? await vault.getGetCanonicalPublishCharge(user.address, KIND_PUBLIC, sizeClass, SUITE_PUBLIC_NONE)
    : await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, sizeClass, cryptoSuite);
  await topUpVaultTon(vault, user, maxCharge * 2n);
  const before = await vault.getGetUser(user.address);
  await blockchain.sendMessage(external({
    to: vault.address,
    body: isPublic
      ? signedPublicPublishBody(user.address, before.publish_nonce, maxCharge, keyPair.secretKey, vault.address, sizeClass)
      : signedPrivatePublishBody(user.address, before.publish_nonce, maxCharge, keyPair.secretKey, vault.address, sizeClass, cryptoSuite),
  }));

  blockchain.now = 1_700_000_000 + 365 * 24 * 60 * 60;
  const touch = await capsule.send(deployer.getSender(), { value: 2_000_000n }, {
    $$type: 'TopUpStorageReserve',
  } as CapsuleTopUpStorageReserve);
  const capsuleTx = touch.transactions.find((tx: any) => {
    const address = addressFromTx(tx);
    return address?.equals(capsule.address);
  });
  if (!capsuleTx) {
    throw new Error(`Missing one-year CapsuleHub storage touch tx for ${id}`);
  }

  const emptyCtx = await setupBoundPair(`storage-empty-${id}`);
  emptyCtx.blockchain.now = 1_700_000_000 + 365 * 24 * 60 * 60;
  const emptyTouch = await emptyCtx.capsule.send(emptyCtx.deployer.getSender(), { value: 2_000_000n }, {
    $$type: 'TopUpStorageReserve',
  } as CapsuleTopUpStorageReserve);
  const emptyTx = emptyTouch.transactions.find((tx: any) => {
    const address = addressFromTx(tx);
    return address?.equals(emptyCtx.capsule.address);
  });
  if (!emptyTx) {
    throw new Error(`Missing empty one-year CapsuleHub storage touch tx for ${id}`);
  }

  return txStorageFees(capsuleTx) - txStorageFees(emptyTx);
}

async function measureCase(spec: PublishCaseSpec): Promise<PublishCaseReport> {
  const { id, sizeClass, cryptoSuite, protocolFee, keySeed } = spec;

  const ctx = await setupBoundPair(id);
  const { blockchain, user, vault, capsule } = ctx;
  const keyPair = await registerKeys(vault, user, keySeed);
  const isPublic = id.startsWith('public_');
  const maxCharge = isPublic
    ? await vault.getGetCanonicalPublishCharge(user.address, KIND_PUBLIC, sizeClass, SUITE_PUBLIC_NONE)
    : await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, sizeClass, cryptoSuite);
  await topUpVaultTon(vault, user, maxCharge * 3n);
  const before = await vault.getGetUser(user.address);
  const result = await blockchain.sendMessage(external({
    to: vault.address,
    body: isPublic
      ? signedPublicPublishBody(user.address, before.publish_nonce, maxCharge, keyPair.secretKey, vault.address, sizeClass)
      : signedPrivatePublishBody(user.address, before.publish_nonce, maxCharge, keyPair.secretKey, vault.address, sizeClass, cryptoSuite),
  }));
  const after = await vault.getGetUser(user.address);
  if (after.publish_nonce !== before.publish_nonce + 1n) {
    throw new Error(`${id}: publish nonce did not advance`);
  }
  if ((await vault.getGetGlobal()).pending_publish_count !== 0n) {
    throw new Error(`${id}: pending publish did not clear`);
  }
  const metrics = result.transactions.map((tx: any) => txMetric(tx, txAtRole(tx, {
    vaultAddress: vault.address,
    capsuleAddress: capsule.address,
  })));
  const capsulePublish = metrics.find((tx) => tx.role === 'capsulehub_publish');
  if (!capsulePublish || capsulePublish.aborted || !capsulePublish.success || capsulePublish.exit_code !== 0) {
    throw new Error(`${id}: CapsuleHub publish did not finalize successfully`);
  }

  const vaultExternalFee = sumFees(metrics, 'vault_external_publish');
  const capsuleHubFee = sumFees(metrics, 'capsulehub_publish');
  const vaultAckFee = sumFees(metrics, 'vault_ack_or_bounce');
  const storageOneYear = await oneYearStorageFee(id, sizeClass, cryptoSuite);

  const vaultLocalRecommended = roundUp(ceilMul(vaultExternalFee, 2n), 100_000n);
  const capsuleRecommended = roundUp(ceilMul(capsuleHubFee, 2n), 100_000n);
  const ackRecommended = roundUp(ceilMul(vaultAckFee, 2n), 100_000n);
  const storage1y = roundUp(storageOneYear * 2n, 100_000n);
  const storage3y = roundUp(storageOneYear * 6n, 100_000n);
  const storage5y = roundUp(storageOneYear * 10n, 100_000n);

  return {
    id,
    canonical_max_charge_nanotons: String(maxCharge),
    protocol_fee_nanotons: String(protocolFee),
    user_net_debit_nanotons: String(before.ton_balance - after.ton_balance),
    vault_external_fee_nanotons: String(vaultExternalFee),
    capsulehub_publish_fee_nanotons: String(capsuleHubFee),
    vault_ack_fee_nanotons: String(vaultAckFee),
    one_year_storage_fee_nanotons: String(storageOneYear),
    recommended: {
      vault_local_exec_reserve_nanotons: String(vaultLocalRecommended),
      capsulehub_exec_reserve_nanotons: String(capsuleRecommended),
      vault_pending_refund_exec_reserve_nanotons: String(ackRecommended),
      storage_endowment_1y_x2_nanotons: String(storage1y),
      storage_endowment_3y_x2_nanotons: String(storage3y),
      storage_endowment_5y_x2_nanotons: String(storage5y),
      net_price_1y_storage_x2_nanotons: String(protocolFee + vaultLocalRecommended + capsuleRecommended + ackRecommended + storage1y),
      net_price_3y_storage_x2_nanotons: String(protocolFee + vaultLocalRecommended + capsuleRecommended + ackRecommended + storage3y),
      net_price_5y_storage_x2_nanotons: String(protocolFee + vaultLocalRecommended + capsuleRecommended + ackRecommended + storage5y),
    },
    transactions: metrics,
  };
}

function renderMarkdown(report: PricingReport): string {
  const lines: string[] = [];
  lines.push('# Publish Reserve Pricing Report');
  lines.push('');
  lines.push(`Status: **${report.status}**`);
  lines.push('');
  lines.push('Current code hashes:');
  lines.push('');
  lines.push(`- Vault: \`${report.code_hashes.vault}\``);
  lines.push(`- CapsuleHub: \`${report.code_hashes.capsulehub}\``);
  lines.push(`- ATHWallet: \`${report.code_hashes.ath_wallet}\``);
  lines.push('');
  lines.push('Policy: current contract constants are the release constants. Observed fees are measured with the bundled sandbox config matching the audited TON mainnet basechain fee snapshot. The x2 columns are reference sizing only; PASS does not require reserves to equal a 2x target.');
  lines.push('');
  lines.push('Fee snapshot:');
  lines.push('');
  lines.push(`- Source: ${report.fee_config_snapshot.source}`);
  lines.push(`- Config 18 latest basechain storage since: \`${report.fee_config_snapshot.config_18_latest_utime_since}\``);
  lines.push(`- Config 18 basechain bit/cell prices ps: \`${report.fee_config_snapshot.config_18_latest_bit_price_ps}\` / \`${report.fee_config_snapshot.config_18_latest_cell_price_ps}\``);
  lines.push(`- Config 21 flat gas price: \`${report.fee_config_snapshot.config_21_flat_gas_price}\``);
  lines.push(`- Config 21 gas price: \`${report.fee_config_snapshot.config_21_gas_price}\``);
  lines.push(`- Config 25 lump/bit/cell prices: \`${report.fee_config_snapshot.config_25_lump_price}\` / \`${report.fee_config_snapshot.config_25_bit_price}\` / \`${report.fee_config_snapshot.config_25_cell_price}\``);
  lines.push('');
  lines.push('| Case | Current net | Vault fee | Capsule fee | ACK fee | 1y storage | Reference x2 net 1y | Reference x2 net 3y | Reference x2 net 5y |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const c of report.cases) {
    lines.push(`| ${c.id} | ${c.user_net_debit_nanotons} | ${c.vault_external_fee_nanotons} | ${c.capsulehub_publish_fee_nanotons} | ${c.vault_ack_fee_nanotons} | ${c.one_year_storage_fee_nanotons} | ${c.recommended.net_price_1y_storage_x2_nanotons} | ${c.recommended.net_price_3y_storage_x2_nanotons} | ${c.recommended.net_price_5y_storage_x2_nanotons} |`);
  }
  lines.push('');
  return lines.join('\n');
}

export async function runPublishReservePricing(writeArtifacts = true): Promise<PricingReport> {
  const publicCases: PublishCaseSpec[] = [];
  for (const sizeClass of SIZE_CLASSES) {
    publicCases.push({
      id: `public_${sizeClass}k`,
      sizeClass,
      cryptoSuite: SUITE_PUBLIC_NONE,
      protocolFee: CURRENT.publicFee,
      keySeed: 10 + Number(sizeClass),
    });
  }
  const privateCases: PublishCaseSpec[] = [];
  for (const sizeClass of SIZE_CLASSES) {
    privateCases.push({
      id: `private_hybrid_${sizeClass}k`,
      sizeClass,
      cryptoSuite: SUITE_HYBRID,
      protocolFee: CURRENT.privateHybridFee,
      keySeed: 40 + Number(sizeClass),
    });
  }
  const cases = [
    ...(await Promise.all(publicCases.map((item) => measureCase(item)))),
    ...(await Promise.all(privateCases.map((item) => measureCase(item)))),
  ];
  const report: PricingReport = {
    profile: 'PLATHO.V1.PUBLISH_RESERVE_PRICING',
    status: 'PASS',
    generated_at: 'DETERMINISTIC_ARTIFACT',
    code_hashes: {
      vault: codeHash(path.join('build', 'Vault', 'Vault_Vault.code.boc')),
      capsulehub: codeHash(path.join('build', 'CapsuleHub', 'CapsuleHub_CapsuleHub.code.boc')),
      ath_wallet: codeHash(path.join('build', 'ATHWallet', 'ATHWallet_ATHWallet.code.boc')),
    },
    policy: {
      network_fee_basis: 'Measured on @ton/sandbox defaultConfig matching the audited 2026-06-02 TON mainnet basechain storage/gas/forward fee snapshot.',
      reference_safety_multiplier: '2',
      storage_note: 'Storage is continuous rent, not a one-shot fee. The report gives 1y/3y/5y reference options at 2x observed incremental yearly CapsuleHub index/header rent; pages are virtual entry-id ranges.',
      current_code_hash_gate: 'This report is deploy evidence only when code_hashes match artifacts/CURRENT_CODE_HASHES.txt for the release being verified.',
    },
    fee_config_snapshot: currentFeeConfigSnapshot(),
    current_constants_nanotons: Object.fromEntries(Object.entries(CURRENT).map(([key, value]) => [key, String(value)])),
    cases,
  };
  if (writeArtifacts) {
    fs.mkdirSync('artifacts', { recursive: true });
    fs.writeFileSync(path.join('artifacts', 'publish_reserve_pricing_report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join('artifacts', 'publish_reserve_pricing_summary.md'), renderMarkdown(report));
  }
  return report;
}

if (require.main === module) {
  runPublishReservePricing(true)
    .then((report) => {
      console.log(JSON.stringify({
        status: report.status,
        cases: report.cases.map((item) => ({
          id: item.id,
          current_net: item.user_net_debit_nanotons,
          reference_x2_1y_net: item.recommended.net_price_1y_storage_x2_nanotons,
          reference_x2_3y_net: item.recommended.net_price_3y_storage_x2_nanotons,
          reference_x2_5y_net: item.recommended.net_price_5y_storage_x2_nanotons,
        })),
      }, null, 2));
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
