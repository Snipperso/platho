import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { createHash } from 'crypto';
import {
  UsernameRegistry,
  BindOfficialAthWallet,
  SealGenesis,
  AthTransferNotificationMintUsername,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import { UsernameNFTItem } from '../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';
import { MockAthWalletNoAck } from '../build/MockAthWalletNoAck/MockAthWalletNoAck_MockAthWalletNoAck';

const MANIFEST_HASH = 0x9999888877776666555544443333222211110000ffffeeeeddddccccbbbbaaaan;
const NAME_HASH_DOMAIN = 0xC5CC7CD6n;
const PRICE_4 = 10_000_000_000_000n;
const PRICE_5 = 1_000_000_000_000n;
const PRICE_6_PLUS = 100_000_000_000n;
const OP_ATH_TRANSFER_NOTIFICATION_ACK = 0x472D9D7E;
const SUCCESSFUL_MINT_REQUIRED_VALUE = 6_000_000n + 20_000_000n + 1_000_000n + 2_000_000n;

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

  const deployer = await blockchain.treasury('username-registry-deployer');
  const attacker = await blockchain.treasury('username-registry-attacker');
  const placeholderAthWallet = fixtureAddress('USERNAME_REGISTRY_PLACEHOLDER_ATH_WALLET');
  const athMasterAddress = fixtureAddress('USERNAME_REGISTRY_ATH_MASTER');
  const treasuryAthReceiver = fixtureAddress('USERNAME_REGISTRY_TREASURY_ATH_RECEIVER');

  const registryInit = await UsernameRegistry.init(placeholderAthWallet, athMasterAddress, treasuryAthReceiver, false, 0n, 0n, deployer.address);
  const registryAddress = contractAddress(0, registryInit);
  await blockchain.setShardAccount(registryAddress, createShardAccount({
    address: registryAddress,
    code: registryInit.code,
    data: registryInit.data,
    balance: toNano('2'),
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
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);

  return { blockchain, registry, registryAddress, officialAthWallet, attacker };
}

async function sendMint(registry: any, officialAthWallet: any, ownerWallet: Address, name: string, amount: bigint, value = toNano('0.1')) {
  return registry.send(officialAthWallet.getSender(), { value }, {
    $$type: 'AthTransferNotificationMintUsername',
    query_id: 1n,
    amount,
    sender_key: 0n,
    owner_wallet: ownerWallet,
    username_len: BigInt(Buffer.from(name, 'ascii').length),
    username: usernameSlice(name),
  } as AthTransferNotificationMintUsername);
}

describe('UsernameRegistry paid mint milestone', () => {
  it('USERNAME-REG-M10-01: valid official ATH username mint deploys deterministic item, consumes pending, and credits treasury/burn due after ACK', async () => {
    const { blockchain, registry, officialAthWallet } = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M10_OWNER');
    const hash = nameHash('platho');
    const itemAddress = await registry.getGetUsernameItemAddress(ownerWallet, hash);

    await sendMint(registry, officialAthWallet, ownerWallet, 'platho', PRICE_6_PLUS);

    const record = await registry.getGetNameRecord(hash);
    const pending = await registry.getGetPendingMint(hash);
    const global = await registry.getGetGlobal();

    expect(record.exists).toBe(true);
    expect(record.owner_wallet.equals(ownerWallet)).toBe(true);
    expect(record.item_address.equals(itemAddress)).toBe(true);
    expect(pending.exists).toBe(false);
    expect(global.name_record_count).toBe(1n);
    expect(global.pending_mint_count).toBe(0n);
    expect(global.treasury_due_ath).toBe(50_000_000_000n);
    expect(global.burn_due_ath).toBe(50_000_000_000n);

    const item = blockchain.openContract(new UsernameNFTItem(itemAddress));
    const itemState = await item.getGetState();
    expect(itemState.owner_wallet.equals(ownerWallet)).toBe(true);
    expect(itemState.username_registry_address.equals(registry.address)).toBe(true);
    expect(itemState.name_hash).toBe(hash);
  });

  it('USERNAME-REG-M10-06: accepted official mint notification sends ATH notification ACK back to official wallet', async () => {
    const { registry, officialAthWallet } = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M10_ACK_OWNER');

    const result = await sendMint(registry, officialAthWallet, ownerWallet, 'ackok1', PRICE_6_PLUS);

    expect(findTransaction(result.transactions, {
      from: registry.address,
      to: officialAthWallet.address,
      op: OP_ATH_TRANSFER_NOTIFICATION_ACK,
    })).toBeDefined();
  });

  it('USERNAME-REG-M10-07: rejected official mint notification still ACKs after recording refund due', async () => {
    const { registry, officialAthWallet } = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M10_INVALID_ACK_OWNER');

    const result = await sendMint(registry, officialAthWallet, ownerWallet, 'Larisa', PRICE_6_PLUS);

    expect(await registry.getGetRefundDue(ownerWallet)).toBe(PRICE_6_PLUS);
    expect(findTransaction(result.transactions, {
      from: registry.address,
      to: officialAthWallet.address,
      op: OP_ATH_TRANSFER_NOTIFICATION_ACK,
    })).toBeDefined();
  });

  it('USERNAME-REG-M10-08: underfunded official mint notification cannot strand state without ACK reserve', async () => {
    const { registry, officialAthWallet } = await deploySealedRegistry();
    const invalidOwner = fixtureAddress('USERNAME_M10_INVALID_UNDERFUNDED_OWNER');
    const validOwner = fixtureAddress('USERNAME_M10_VALID_UNDERFUNDED_OWNER');
    const validHash = nameHash('oldmin');

    await sendMint(registry, officialAthWallet, invalidOwner, 'Larisa', PRICE_6_PLUS, toNano('0.004'));
    await sendMint(registry, officialAthWallet, validOwner, 'oldmin', PRICE_6_PLUS, toNano('0.026'));

    expect(await registry.getGetRefundDue(invalidOwner)).toBe(0n);
    expect((await registry.getGetNameRecord(validHash)).exists).toBe(false);
    expect((await registry.getGetPendingMint(validHash)).exists).toBe(false);
    const global = await registry.getGetGlobal();
    expect(global.name_record_count).toBe(0n);
    expect(global.pending_mint_count).toBe(0n);
    expect(global.refund_due_count).toBe(0n);
  });

  it('USERNAME-REG-M10-09: successful mint returns meaningful notify excess to the owner wallet', async () => {
    const { blockchain, registry, officialAthWallet } = await deploySealedRegistry();
    const owner = await blockchain.treasury('username-registry-success-excess-owner');
    const hash = nameHash('excess');

    const result = await sendMint(
      registry,
      officialAthWallet,
      owner.address,
      'excess',
      PRICE_6_PLUS,
      SUCCESSFUL_MINT_REQUIRED_VALUE + 1_000_000n,
    );

    expect((await registry.getGetNameRecord(hash)).exists).toBe(true);
    expect(findTransaction(result.transactions, {
      from: registry.address,
      to: owner.address,
    })).toBeDefined();
  });

  it('USERNAME-REG-M10-10: masterchain owner mint is rejected before pending or refund state', async () => {
    const { registry, officialAthWallet } = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M10_MASTERCHAIN_OWNER', -1);
    const hash = nameHash('master');

    await sendMint(registry, officialAthWallet, ownerWallet, 'master', PRICE_6_PLUS);

    expect((await registry.getGetNameRecord(hash)).exists).toBe(false);
    expect((await registry.getGetPendingMint(hash)).exists).toBe(false);
    expect(await registry.getGetRefundDue(ownerWallet)).toBe(0n);
    const global = await registry.getGetGlobal();
    expect(global.pending_mint_count).toBe(0n);
    expect(global.refund_due_count).toBe(0n);
  });

  it('USERNAME-REG-M10-11: bounced item deploy records ATH refund due and returns deploy reserve excess', async () => {
    const { blockchain, registry, officialAthWallet } = await deploySealedRegistry();
    const owner = await blockchain.treasury('username-registry-bounced-item-owner');
    const hash = nameHash('bounce');
    const itemAddress = await registry.getGetUsernameItemAddress(owner.address, hash);
    const rejectInit = await MockAthWalletNoAck.init();
    await blockchain.setShardAccount(itemAddress, createShardAccount({
      address: itemAddress,
      code: rejectInit.code,
      data: rejectInit.data,
      balance: toNano('0.05'),
      workchain: itemAddress.workChain,
    }));

    const result = await sendMint(
      registry,
      officialAthWallet,
      owner.address,
      'bounce',
      PRICE_6_PLUS,
      SUCCESSFUL_MINT_REQUIRED_VALUE,
    );

    expect((await registry.getGetNameRecord(hash)).exists).toBe(false);
    expect((await registry.getGetPendingMint(hash)).exists).toBe(false);
    expect(await registry.getGetRefundDue(owner.address)).toBe(PRICE_6_PLUS);
    expect(findTransaction(result.transactions, {
      from: registry.address,
      to: owner.address,
    })).toBeDefined();
  });

  it('USERNAME-REG-M10-02: invalid uppercase username from official ATH wallet creates refund due and no pending/name record', async () => {
    const { registry, officialAthWallet } = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M10_UPPERCASE_OWNER');
    const hash = nameHash('Larisa');

    await sendMint(registry, officialAthWallet, ownerWallet, 'Larisa', PRICE_6_PLUS);

    const refund = await registry.getGetRefundDue(ownerWallet);
    const record = await registry.getGetNameRecord(hash);
    const global = await registry.getGetGlobal();

    expect(refund).toBe(PRICE_6_PLUS);
    expect(record.exists).toBe(false);
    expect(global.refund_due_count).toBe(1n);
    expect(global.name_record_count).toBe(0n);
    expect(global.pending_mint_count).toBe(0n);
  });

  it('USERNAME-REG-M10-03: non-official ATH sender is rejected and cannot create refund, pending, or name record', async () => {
    const { registry, attacker } = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M10_SPOOF_OWNER');

    await registry.send(attacker.getSender(), { value: toNano('0.1') }, {
      $$type: 'AthTransferNotificationMintUsername',
      query_id: 1n,
      amount: PRICE_6_PLUS,
      sender_key: 0n,
      owner_wallet: ownerWallet,
      username_len: 6n,
      username: usernameSlice('platho'),
    } as AthTransferNotificationMintUsername);

    const global = await registry.getGetGlobal();
    expect(global.name_record_count).toBe(0n);
    expect(global.pending_mint_count).toBe(0n);
    expect(global.refund_due_count).toBe(0n);
    expect(await registry.getGetRefundDue(ownerWallet)).toBe(0n);
  });

  it('USERNAME-REG-M10-04: duplicate finalized username creates refund due for the second minter without changing the existing record', async () => {
    const { registry, officialAthWallet } = await deploySealedRegistry();
    const ownerA = fixtureAddress('USERNAME_M10_DUP_OWNER_A');
    const ownerB = fixtureAddress('USERNAME_M10_DUP_OWNER_B');
    const hash = nameHash('larisa');

    await sendMint(registry, officialAthWallet, ownerA, 'larisa', PRICE_6_PLUS);
    await sendMint(registry, officialAthWallet, ownerB, 'larisa', PRICE_6_PLUS);

    const record = await registry.getGetNameRecord(hash);
    const global = await registry.getGetGlobal();

    expect(record.exists).toBe(true);
    expect(record.owner_wallet.equals(ownerA)).toBe(true);
    expect(await registry.getGetRefundDue(ownerB)).toBe(PRICE_6_PLUS);
    expect(global.name_record_count).toBe(1n);
    expect(global.refund_due_count).toBe(1n);
  });

  it('USERNAME-REG-M10-05: price tiers are enforced as exact ATH amounts and underpay is refunded', async () => {
    const { registry, officialAthWallet } = await deploySealedRegistry();
    const owner4 = fixtureAddress('USERNAME_M10_PRICE_4');
    const owner5 = fixtureAddress('USERNAME_M10_PRICE_5');
    const underpayOwner = fixtureAddress('USERNAME_M10_UNDERPAY');

    await sendMint(registry, officialAthWallet, owner4, 'abcd', PRICE_4);
    await sendMint(registry, officialAthWallet, owner5, 'abcde', PRICE_5);
    await sendMint(registry, officialAthWallet, underpayOwner, 'abcdef', PRICE_6_PLUS - 1n);

    expect((await registry.getGetNameRecord(nameHash('abcd'))).exists).toBe(true);
    expect((await registry.getGetNameRecord(nameHash('abcde'))).exists).toBe(true);
    expect(await registry.getGetRefundDue(underpayOwner)).toBe(PRICE_6_PLUS - 1n);

    const global = await registry.getGetGlobal();
    expect(global.name_record_count).toBe(2n);
    expect(global.refund_due_count).toBe(1n);
  });
});
