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
  FlushTreasuryAthDue,
  FlushBurnAthDue,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';
import { ATHMaster } from '../build/ATHMaster/ATHMaster_ATHMaster';

const MANIFEST_HASH = 0x9999888877776666555544443333222211110000ffffeeeeddddccccbbbbaaaan;
const ATH_TOTAL_SUPPLY_ATOMIC = 100_000_000_000_000_000n;
const PRICE_6_PLUS = 100_000_000_000n;
const HALF_PRICE = 50_000_000_000n;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

function usernameSlice(name: string) {
  return beginCell().storeBuffer(Buffer.from(name, 'ascii')).endCell().beginParse();
}

async function deployRegistryWithAthSystem(options: { officialWalletBalance: bigint; deployMaster: boolean }) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const deployer = await blockchain.treasury('username-registry-m12-deployer');
  const flusher = await blockchain.treasury('username-registry-m12-flusher');
  const placeholderAthWallet = fixtureAddress('USERNAME_REGISTRY_PLACEHOLDER_ATH_WALLET_M12');
  const treasuryAthReceiver = fixtureAddress('USERNAME_REGISTRY_TREASURY_ATH_RECEIVER_M12');
  const vaultAddress = fixtureAddress('USERNAME_REGISTRY_VAULT_M12');
  const masterTreasuryOwner = fixtureAddress('USERNAME_REGISTRY_ATH_MASTER_TREASURY_M12');
  const content = beginCell().storeBuffer(Buffer.from('ATH')).endCell();

  const masterInit = await ATHMaster.init(masterTreasuryOwner, content);
  const athMasterAddress = contractAddress(0, masterInit);

  const registryInit = await UsernameRegistry.init(placeholderAthWallet, athMasterAddress, treasuryAthReceiver, false, 0n, 0n, deployer.address);
  const registryAddress = contractAddress(0, registryInit);

  const officialZeroInit = await ATHWallet.init(0n, registryAddress, athMasterAddress);
  const officialBalanceInit = await ATHWallet.init(options.officialWalletBalance, registryAddress, athMasterAddress);
  const officialAthWalletAddress = contractAddress(registryAddress.workChain, officialZeroInit);

  if (options.deployMaster) {
    await blockchain.setShardAccount(athMasterAddress, createShardAccount({
      address: athMasterAddress,
      code: masterInit.code,
      data: masterInit.data,
      balance: toNano('2'),
      workchain: athMasterAddress.workChain,
    }));
  }

  await blockchain.setShardAccount(registryAddress, createShardAccount({
    address: registryAddress,
    code: registryInit.code,
    data: registryInit.data,
    balance: toNano('3'),
    workchain: registryAddress.workChain,
  }));

  await blockchain.setShardAccount(officialAthWalletAddress, createShardAccount({
    address: officialAthWalletAddress,
    code: officialZeroInit.code,
    data: officialBalanceInit.data,
    balance: toNano('3'),
    workchain: officialAthWalletAddress.workChain,
  }));

  const registry = blockchain.openContract(new UsernameRegistry(registryAddress, registryInit));
  const officialAthWallet = blockchain.openContract(new ATHWallet(officialAthWalletAddress, officialZeroInit));
  const master = blockchain.openContract(new ATHMaster(athMasterAddress, masterInit));

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

  return {
    blockchain,
    registry,
    registryAddress,
    officialAthWallet,
    officialAthWalletAddress,
    athMasterAddress,
    master,
    treasuryAthReceiver,
    flusher,
    vaultAddress,
  };
}

async function mintValidName(blockchain: Blockchain, registry: any, officialAthWalletAddress: Address, ownerWallet: Address, name: string, payerWallet: Address) {
  // Registry now retains 511M (6M + 500M item deploy reserve + 1M + 4M), so the mint notification must carry >= that.
  await registry.send(blockchain.sender(officialAthWalletAddress), { value: toNano('1.2') }, {
    $$type: 'AthTransferNotificationVaultMintUsername',
    query_id: 7001n,
    amount: PRICE_6_PLUS,
    sender_key: 0n,
    payer_wallet: payerWallet,
    owner_wallet: ownerWallet,
    username_len: BigInt(Buffer.from(name, 'ascii').length),
    username: usernameSlice(name),
  } as AthTransferNotificationVaultMintUsername);
}

describe('UsernameRegistry treasury/burn due flush milestone', () => {
  it('USERNAME-REG-M12-01: FlushTreasuryAthDue transfers treasury due to immutable treasury ATH receiver and clears pending on ACK', async () => {
    const ctx = await deployRegistryWithAthSystem({ officialWalletBalance: PRICE_6_PLUS, deployMaster: true });
    const ownerWallet = fixtureAddress('USERNAME_M12_TREASURY_OWNER');

    await mintValidName(ctx.blockchain, ctx.registry, ctx.officialAthWalletAddress, ownerWallet, 'platho', ctx.vaultAddress);
    expect((await ctx.registry.getGetGlobal()).treasury_due_ath).toBe(HALF_PRICE);

    const treasuryAthWalletAddress = await ctx.registry.getGetAthWalletAddress(ctx.treasuryAthReceiver);
    await ctx.registry.send(ctx.flusher.getSender(), { value: toNano('0.2') }, {
      $$type: 'FlushTreasuryAthDue',
      query_id: 12001n,
    } as FlushTreasuryAthDue);

    const treasuryWalletInit = await ATHWallet.init(0n, ctx.treasuryAthReceiver, ctx.athMasterAddress);
    const treasuryWallet = ctx.blockchain.openContract(new ATHWallet(treasuryAthWalletAddress, treasuryWalletInit));
    const global = await ctx.registry.getGetGlobal();

    expect(global.treasury_due_ath).toBe(0n);
    expect(global.pending_treasury_flush_count).toBe(0n);
    expect((await ctx.registry.getGetPendingTreasuryFlush(12001n)).exists).toBe(false);
    expect((await treasuryWallet.getGetWalletData()).balance).toBe(HALF_PRICE);
    expect((await ctx.officialAthWallet.getGetWalletData()).balance).toBe(HALF_PRICE);
  });

  it('USERNAME-REG-M12-02: FlushBurnAthDue burns through official ATH wallet, authenticated master ACK clears pending, and total_supply decreases exactly', async () => {
    const ctx = await deployRegistryWithAthSystem({ officialWalletBalance: PRICE_6_PLUS, deployMaster: true });
    const ownerWallet = fixtureAddress('USERNAME_M12_BURN_OWNER');

    await mintValidName(ctx.blockchain, ctx.registry, ctx.officialAthWalletAddress, ownerWallet, 'larisa', ctx.vaultAddress);
    const beforeMaster = await ctx.master.getGetJettonData();
    expect(beforeMaster.total_supply).toBe(ATH_TOTAL_SUPPLY_ATOMIC);
    expect((await ctx.registry.getGetGlobal()).burn_due_ath).toBe(HALF_PRICE);

    await ctx.registry.send(ctx.flusher.getSender(), { value: toNano('0.2') }, {
      $$type: 'FlushBurnAthDue',
      query_id: 12002n,
    } as FlushBurnAthDue);

    const afterMaster = await ctx.master.getGetJettonData();
    const global = await ctx.registry.getGetGlobal();

    expect(afterMaster.total_supply).toBe(ATH_TOTAL_SUPPLY_ATOMIC - HALF_PRICE);
    expect(global.burn_due_ath).toBe(0n);
    expect(global.pending_burn_flush_count).toBe(0n);
    expect((await ctx.registry.getGetPendingBurnFlush(12002n)).exists).toBe(false);
    expect((await ctx.officialAthWallet.getGetWalletData()).balance).toBe(HALF_PRICE);
  });

  it('USERNAME-REG-M12-03: treasury transfer failure restores treasury_due_ath and clears pending', async () => {
    const ctx = await deployRegistryWithAthSystem({ officialWalletBalance: 0n, deployMaster: true });
    const ownerWallet = fixtureAddress('USERNAME_M12_TREASURY_FAIL_OWNER');

    await mintValidName(ctx.blockchain, ctx.registry, ctx.officialAthWalletAddress, ownerWallet, 'refund', ctx.vaultAddress);
    expect((await ctx.registry.getGetGlobal()).treasury_due_ath).toBe(HALF_PRICE);

    await ctx.registry.send(ctx.flusher.getSender(), { value: toNano('0.2') }, {
      $$type: 'FlushTreasuryAthDue',
      query_id: 12003n,
    } as FlushTreasuryAthDue);

    const global = await ctx.registry.getGetGlobal();
    expect(global.treasury_due_ath).toBe(HALF_PRICE);
    expect(global.pending_treasury_flush_count).toBe(0n);
    expect((await ctx.registry.getGetPendingTreasuryFlush(12003n)).exists).toBe(false);
  });

  it('USERNAME-REG-M12-04: burn notification failure restores burn_due_ath, clears pending, and restores official wallet balance', async () => {
    const ctx = await deployRegistryWithAthSystem({ officialWalletBalance: PRICE_6_PLUS, deployMaster: false });
    const ownerWallet = fixtureAddress('USERNAME_M12_BURN_FAIL_OWNER');

    await mintValidName(ctx.blockchain, ctx.registry, ctx.officialAthWalletAddress, ownerWallet, 'burner', ctx.vaultAddress);
    expect((await ctx.registry.getGetGlobal()).burn_due_ath).toBe(HALF_PRICE);

    await ctx.registry.send(ctx.flusher.getSender(), { value: toNano('0.2') }, {
      $$type: 'FlushBurnAthDue',
      query_id: 12004n,
    } as FlushBurnAthDue);

    const global = await ctx.registry.getGetGlobal();
    expect(global.burn_due_ath).toBe(HALF_PRICE);
    expect(global.pending_burn_flush_count).toBe(0n);
    expect((await ctx.registry.getGetPendingBurnFlush(12004n)).exists).toBe(false);
    expect((await ctx.officialAthWallet.getGetWalletData()).balance).toBe(PRICE_6_PLUS);
  });
});
