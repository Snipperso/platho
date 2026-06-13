import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  UsernameRegistry,
  BindOfficialAthWallet,
  BindUsernameVault,
  SealGenesis,
  AthTransferNotificationVaultMintUsername,
  PrunePendingUsernameMint,
  UsernameItemDeployedAck,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import { MockUsernameNFTItemNoAck } from '../build/MockUsernameNFTItemNoAck/MockUsernameNFTItemNoAck_MockUsernameNFTItemNoAck';

const MANIFEST_HASH = 0x9999888877776666555544443333222211110000ffffeeeeddddccccbbbbaaaan;
const NAME_HASH_DOMAIN = 0xC5CC7CD6n;
const PRICE_6_PLUS = 100_000_000_000n;
const STALE_TTL = 86_400;
const PRUNE_EXEC_RESERVE = 2_000_000n;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

function usernameSlice(name: string) {
  return beginCell().storeBuffer(Buffer.from(name, 'ascii')).endCell().beginParse();
}

function nameHash(name: string): bigint {
  return BigInt('0x' + beginCell()
    .storeUint(NAME_HASH_DOMAIN, 32)
    .storeBuffer(Buffer.from(name, 'ascii'))
    .endCell()
    .hash()
    .toString('hex'));
}

function senderForAddress(blockchain: Blockchain, address: Address) {
  return { address, getSender: () => blockchain.sender(address) };
}

async function deploySealedRegistry() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const deployer = await blockchain.treasury('username-registry-m13-deployer');
  const pruner = await blockchain.treasury('username-registry-m13-pruner');
  const placeholderAthWallet = fixtureAddress('USERNAME_REGISTRY_PLACEHOLDER_ATH_WALLET_M13');
  const athMasterAddress = fixtureAddress('USERNAME_REGISTRY_ATH_MASTER_M13');
  const treasuryAthReceiver = fixtureAddress('USERNAME_REGISTRY_TREASURY_ATH_RECEIVER_M13');
  const vaultAddress = fixtureAddress('USERNAME_REGISTRY_VAULT_M13');

  const registryInit = await UsernameRegistry.init(placeholderAthWallet, athMasterAddress, treasuryAthReceiver, false, 0n, 0n, deployer.address);
  const registryAddress = contractAddress(0, registryInit);
  await blockchain.setShardAccount(registryAddress, createShardAccount({
    address: registryAddress,
    code: registryInit.code,
    data: registryInit.data,
    balance: toNano('3'),
    workchain: registryAddress.workChain,
  }));
  const registry = blockchain.openContract(new UsernameRegistry(registryAddress, registryInit));
  const officialAthWalletAddress = await registry.getGetAthWalletAddress(registryAddress);
  const officialAthWallet = senderForAddress(blockchain, officialAthWalletAddress);

  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialAthWalletAddress,
  } as BindOfficialAthWallet);
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindUsernameVault',
    deployment_manifest_hash: MANIFEST_HASH,
    vault_address: vaultAddress,
  } as BindUsernameVault);

  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);

  return { blockchain, registry, officialAthWallet, pruner, vaultAddress };
}

async function installNoAckAt(blockchain: Blockchain, address: Address) {
  const noAckInit = await MockUsernameNFTItemNoAck.init();
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: noAckInit.code,
    data: noAckInit.data,
    balance: toNano('0.05'),
    workchain: address.workChain,
  }));
  return blockchain.openContract(new MockUsernameNFTItemNoAck(address, noAckInit));
}

async function createStuckPendingMint(ctx: Awaited<ReturnType<typeof deploySealedRegistry>>, ownerWallet: Address, name: string) {
  const hash = nameHash(name);
  const itemAddress = await ctx.registry.getGetUsernameItemAddress(hash);
  const noAckItem = await installNoAckAt(ctx.blockchain, itemAddress);

  await ctx.registry.send(ctx.officialAthWallet.getSender(), { value: toNano('0.15') }, {
    $$type: 'AthTransferNotificationVaultMintUsername',
    query_id: 13001n,
    amount: PRICE_6_PLUS,
    sender_key: 0n,
    payer_wallet: ctx.vaultAddress,
    owner_wallet: ownerWallet,
    username_len: BigInt(Buffer.from(name, 'ascii').length),
    username: usernameSlice(name),
  } as AthTransferNotificationVaultMintUsername);

  return { hash, itemAddress, noAckItem };
}

describe('UsernameRegistry stale pending mint prune milestone', () => {
  it('USERNAME-REG-M13-01: stale PendingUsernameMint prune is non-destructive and preserves late ACK recovery', async () => {
    const ctx = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M13_STUCK_OWNER');
    const { hash, itemAddress, noAckItem } = await createStuckPendingMint(ctx, ownerWallet, 'stuck1');

    expect((await noAckItem.getGetAcceptedCount())).toBe(1n);
    expect((await ctx.registry.getGetPendingMint(hash)).exists).toBe(true);
    expect((await ctx.registry.getGetNameRecord(hash)).exists).toBe(false);
    expect((await ctx.registry.getGetGlobal()).pending_mint_count).toBe(1n);

    ctx.blockchain.now = 1_700_000_000 + STALE_TTL + 1;
    await ctx.registry.send(ctx.pruner.getSender(), { value: toNano('0.03') }, {
      $$type: 'PrunePendingUsernameMint',
      name_hash: hash,
    } as PrunePendingUsernameMint);

    expect((await ctx.registry.getGetPendingMint(hash)).exists).toBe(true);
    expect((await ctx.registry.getGetNameRecord(hash)).exists).toBe(false);

    await ctx.registry.send(ctx.blockchain.sender(itemAddress), { value: toNano('0.03') }, {
      $$type: 'UsernameItemDeployedAck',
      name_hash: hash,
      owner_wallet: ownerWallet,
    } as UsernameItemDeployedAck);

    expect((await ctx.registry.getGetNameRecord(hash)).exists).toBe(true);
    expect((await ctx.registry.getGetPendingMint(hash)).exists).toBe(false);
  });

  it('USERNAME-REG-M13-01B: item ACK owner must match the pending mint owner before finalization', async () => {
    const ctx = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M13_ACK_OWNER');
    const wrongOwner = fixtureAddress('USERNAME_M13_ACK_WRONG_OWNER');
    const { hash, itemAddress } = await createStuckPendingMint(ctx, ownerWallet, 'ackown');

    await ctx.registry.send(ctx.blockchain.sender(itemAddress), { value: toNano('0.03') }, {
      $$type: 'UsernameItemDeployedAck',
      name_hash: hash,
      owner_wallet: wrongOwner,
    } as UsernameItemDeployedAck);

    let record = await ctx.registry.getGetNameRecord(hash);
    let global = await ctx.registry.getGetGlobal();
    expect(record.exists).toBe(false);
    expect((await ctx.registry.getGetPendingMint(hash)).exists).toBe(true);
    expect(global.name_record_count).toBe(0n);
    expect(global.treasury_due_ath).toBe(0n);
    expect(global.burn_due_ath).toBe(0n);

    await ctx.registry.send(ctx.blockchain.sender(itemAddress), { value: toNano('0.03') }, {
      $$type: 'UsernameItemDeployedAck',
      name_hash: hash,
      owner_wallet: ownerWallet,
    } as UsernameItemDeployedAck);

    record = await ctx.registry.getGetNameRecord(hash);
    global = await ctx.registry.getGetGlobal();
    expect(record.exists).toBe(true);
    expect(record.minter_wallet.equals(ownerWallet)).toBe(true);
    expect(record.minter_wallet.equals(wrongOwner)).toBe(false);
    expect((await ctx.registry.getGetPendingMint(hash)).exists).toBe(false);
    expect(global.name_record_count).toBe(1n);
    expect(global.treasury_due_ath).toBe(PRICE_6_PLUS / 2n);
    expect(global.burn_due_ath).toBe(PRICE_6_PLUS / 2n);
  });

  it('USERNAME-REG-M13-02: non-stale PendingUsernameMint cannot be pruned and remains pending', async () => {
    const ctx = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M13_EARLY_OWNER');
    const { hash } = await createStuckPendingMint(ctx, ownerWallet, 'early1');

    ctx.blockchain.now = 1_700_000_000 + STALE_TTL - 1;
    await ctx.registry.send(ctx.pruner.getSender(), { value: toNano('0.03') }, {
      $$type: 'PrunePendingUsernameMint',
      name_hash: hash,
    } as PrunePendingUsernameMint);

    expect((await ctx.registry.getGetPendingMint(hash)).exists).toBe(true);
  });

  it('USERNAME-REG-M13-03: stale prune cannot erase pending state or accept duplicate remint state', async () => {
    const ctx = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M13_REMINT_OWNER');
    const { hash, itemAddress } = await createStuckPendingMint(ctx, ownerWallet, 'remint');

    ctx.blockchain.now = 1_700_000_000 + STALE_TTL + 1;
    await ctx.registry.send(ctx.pruner.getSender(), { value: toNano('0.03') }, {
      $$type: 'PrunePendingUsernameMint',
      name_hash: hash,
    } as PrunePendingUsernameMint);

    expect((await ctx.registry.getGetPendingMint(hash)).exists).toBe(true);
    expect((await ctx.registry.getGetNameRecord(hash)).exists).toBe(false);

    await ctx.registry.send(ctx.officialAthWallet.getSender(), { value: toNano('0.15') }, {
      $$type: 'AthTransferNotificationVaultMintUsername',
      query_id: 13002n,
      amount: PRICE_6_PLUS,
      sender_key: 0n,
      payer_wallet: ctx.vaultAddress,
      owner_wallet: ownerWallet,
      username_len: 6n,
      username: usernameSlice('remint'),
    } as AthTransferNotificationVaultMintUsername);

    expect((await ctx.registry.getGetPendingMint(hash)).exists).toBe(true);
    expect((await ctx.registry.getGetNameRecord(hash)).exists).toBe(false);

    await ctx.registry.send(ctx.blockchain.sender(itemAddress), { value: toNano('0.03') }, {
      $$type: 'UsernameItemDeployedAck',
      name_hash: hash,
      owner_wallet: ownerWallet,
    } as UsernameItemDeployedAck);

    const global = await ctx.registry.getGetGlobal();
    const record = await ctx.registry.getGetNameRecord(hash);
    expect(record.exists).toBe(true);
    expect(record.minter_wallet.equals(ownerWallet)).toBe(true);
    expect(record.item_address.equals(itemAddress)).toBe(true);
    expect((await ctx.registry.getGetPendingMint(hash)).exists).toBe(false);
    expect(global.name_record_count).toBe(1n);
    expect(global.pending_mint_count).toBe(0n);
    expect(global.treasury_due_ath).toBe(PRICE_6_PLUS / 2n);
    expect(global.burn_due_ath).toBe(PRICE_6_PLUS / 2n);
  });
});
