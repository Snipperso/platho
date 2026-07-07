import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { createHash } from 'crypto';
import {
  UsernameRegistry,
  BindOfficialAthWallet,
  BindUsernameVault,
  SealGenesis,
  AthTransferNotificationVaultMintUsername,
  storeAthTransferNotificationVaultMintUsername,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import {
  NftTransfer,
  ResendDeployedAck,
  UsernameNFTItem,
} from '../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';
import { MockAthWalletNoAck } from '../build/MockAthWalletNoAck/MockAthWalletNoAck_MockAthWalletNoAck';

const MANIFEST_HASH = 0x9999888877776666555544443333222211110000ffffeeeeddddccccbbbbaaaan;
const NAME_HASH_DOMAIN = 0xC5CC7CD6n;
const PRICE_4 = 10_000_000_000_000n;
const PRICE_5 = 1_000_000_000_000n;
const PRICE_6_PLUS = 100_000_000_000n;
const OP_ATH_TRANSFER_NOTIFICATION_ACK = 0x472D9D7E;
const OP_ATH_TRANSFER_NOTIFICATION_REFUND = 0x4154481E;
const SUCCESSFUL_MINT_REQUIRED_VALUE = 6_000_000n + 500_000_000n + 1_000_000n + 4_000_000n + 36_000_000n; // + name-record endowment (clean-11)
const USERNAME_ITEM_STORAGE_FLOOR = 15_900_000n;

// TEP-62 transfer body after query_id (new NftTransfer binding carries it as one slice).
function nftTransferPayload(newOwner: Address, responseDestination: Address | null, forwardAmount: bigint) {
  const b = beginCell().storeAddress(newOwner);
  if (responseDestination) b.storeAddress(responseDestination);
  else b.storeUint(0, 2);
  b.storeMaybeRef(null);
  b.storeCoins(forwardAmount);
  b.storeBit(0);
  return b.endCell().beginParse();
}

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

function usernameSlice(name: string) {
  return beginCell().storeBuffer(Buffer.from(name, 'ascii')).endCell().beginParse();
}

function emptySlice() {
  return beginCell().endCell().beginParse();
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
  const vaultAddress = fixtureAddress('USERNAME_REGISTRY_VAULT');

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
    $$type: 'BindUsernameVault',
    deployment_manifest_hash: MANIFEST_HASH,
    vault_address: vaultAddress,
  } as BindUsernameVault);

  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);

  return { blockchain, registry, registryAddress, officialAthWallet, attacker, vaultAddress };
}

async function sendMint(
  registry: any,
  officialAthWallet: any,
  ownerWallet: Address,
  name: string,
  amount: bigint,
  // Registry now retains 511M (6M + 500M item deploy reserve + 1M + 4M), so a successful mint notification must carry >= that.
  value = toNano('0.6'),
  payerWallet = fixtureAddress('USERNAME_REGISTRY_VAULT'),
) {
  return registry.send(officialAthWallet.getSender(), { value }, {
    $$type: 'AthTransferNotificationVaultMintUsername',
    query_id: 1n,
    amount,
    sender_key: 0n,
    payer_wallet: payerWallet,
    owner_wallet: ownerWallet,
    username_len: BigInt(Buffer.from(name, 'ascii').length),
    username: usernameSlice(name),
  } as AthTransferNotificationVaultMintUsername);
}

function vaultMintNotificationBody(ownerWallet: Address, name: string, amount: bigint, payerWallet = fixtureAddress('USERNAME_REGISTRY_VAULT')) {
  return beginCell().store(storeAthTransferNotificationVaultMintUsername({
    $$type: 'AthTransferNotificationVaultMintUsername',
    query_id: 1n,
    amount,
    sender_key: 0n,
    payer_wallet: payerWallet,
    owner_wallet: ownerWallet,
    username_len: BigInt(Buffer.from(name, 'ascii').length),
    username: usernameSlice(name),
  })).endCell();
}

function internalMessage(from: Address, to: Address, value: bigint, body: any, bounce = true) {
  return {
    info: {
      type: 'internal' as const,
      ihrDisabled: true,
      ihrFee: 0n,
      bounce,
      bounced: false,
      src: from,
      dest: to,
      value: { coins: value },
      forwardFee: 0n,
      createdAt: 0,
      createdLt: 0n,
    },
    body,
  };
}

describe('UsernameRegistry paid mint milestone', () => {
  it('USERNAME-REG-M10-01: valid official ATH username mint deploys deterministic item, consumes pending, and credits treasury/burn due after ACK', async () => {
    const { blockchain, registry, officialAthWallet } = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M10_OWNER');
    const hash = nameHash('platho');
    const itemAddress = await registry.getGetUsernameItemAddress(hash);

    await sendMint(registry, officialAthWallet, ownerWallet, 'platho', PRICE_6_PLUS);

    const record = await registry.getGetNameRecord(hash);
    const pending = await registry.getGetPendingMint(hash);
    const global = await registry.getGetGlobal();

    expect(record.exists).toBe(true);
    expect(record.minter_wallet.equals(ownerWallet)).toBe(true);
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

  it('RT-UNFT-001: predeployed canonical uninitialized item cannot hijack username mint', async () => {
    const { blockchain, registry, officialAthWallet, attacker } = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_PREDEPLOY_OWNER');
    const hash = nameHash('preokx');
    const itemInit = await UsernameNFTItem.init(registry.address, hash);
    const itemAddress = contractAddress(registry.address.workChain, itemInit);

    await blockchain.setShardAccount(itemAddress, createShardAccount({
      address: itemAddress,
      code: itemInit.code,
      data: itemInit.data,
      balance: toNano('0.05'),
      workchain: itemAddress.workChain,
    }));
    const item = blockchain.openContract(new UsernameNFTItem(itemAddress, itemInit));
    const preMintState = await item.getGetState();
    expect(preMintState.initialized).toBe(false);
    expect(preMintState.owner_wallet.equals(registry.address)).toBe(true);

    await sendMint(registry, officialAthWallet, ownerWallet, 'preokx', PRICE_6_PLUS);

    const record = await registry.getGetNameRecord(hash);
    const itemState = await item.getGetState();
    expect(record.exists).toBe(true);
    expect(record.item_address.equals(itemAddress)).toBe(true);
    expect(record.minter_wallet.equals(ownerWallet)).toBe(true);
    expect(itemState.initialized).toBe(true);
    expect(itemState.owner_wallet.equals(ownerWallet)).toBe(true);
    expect(itemState.owner_wallet.equals(attacker.address)).toBe(false);
    expect((await registry.getGetPendingMint(hash)).exists).toBe(false);
  });

  it('USERNAME-REG-M10-01D: canonical usernames allow lowercase letters, digits, underscores, and hyphens only', async () => {
    const { registry, officialAthWallet } = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M10_CANONICAL_CHARS_OWNER');
    const hash = nameHash('platho_1-x');

    await sendMint(registry, officialAthWallet, ownerWallet, 'platho_1-x', PRICE_6_PLUS);

    const record = await registry.getGetNameRecord(hash);
    const global = await registry.getGetGlobal();

    expect(record.exists).toBe(true);
    expect(record.minter_wallet.equals(ownerWallet)).toBe(true);
    expect(global.name_record_count).toBe(1n);
  });

  it('USERNAME-REG-M10-01E: v1 separator policy intentionally permits edge separator names', async () => {
    const { registry, officialAthWallet } = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M10_SEPARATOR_POLICY_OWNER');
    const hash = nameHash('----');

    await sendMint(registry, officialAthWallet, ownerWallet, '----', PRICE_4);

    const record = await registry.getGetNameRecord(hash);
    const global = await registry.getGetGlobal();

    expect(record.exists).toBe(true);
    expect(record.minter_wallet.equals(ownerWallet)).toBe(true);
    expect(global.name_record_count).toBe(1n);
  });

  it('USERNAME-REG-M10-01B: repeated item resend after finalization cannot mutate record or split due again', async () => {
    const { blockchain, registry, officialAthWallet } = await deploySealedRegistry();
    const caller = await blockchain.treasury('username-registry-repeat-resend-caller');
    const ownerWallet = fixtureAddress('USERNAME_M10_REPEAT_RESEND_OWNER');
    const hash = nameHash('repeat');
    const itemAddress = await registry.getGetUsernameItemAddress(hash);

    await sendMint(registry, officialAthWallet, ownerWallet, 'repeat', PRICE_6_PLUS);

    const item = blockchain.openContract(new UsernameNFTItem(itemAddress));
    const beforeRecord = await registry.getGetNameRecord(hash);
    const beforeGlobal = await registry.getGetGlobal();

    await item.send(caller.getSender(), { value: 4_000_000n }, {
      $$type: 'ResendDeployedAck',
    } as ResendDeployedAck);

    const afterRecord = await registry.getGetNameRecord(hash);
    const afterGlobal = await registry.getGetGlobal();

    expect(beforeRecord.exists).toBe(true);
    expect(afterRecord.exists).toBe(true);
    expect(afterRecord.minter_wallet.equals(beforeRecord.minter_wallet)).toBe(true);
    expect(afterRecord.item_address.equals(beforeRecord.item_address)).toBe(true);
    expect(afterGlobal.name_record_count).toBe(beforeGlobal.name_record_count);
    expect(afterGlobal.pending_mint_count).toBe(0n);
    expect(afterGlobal.treasury_due_ath).toBe(beforeGlobal.treasury_due_ath);
    expect(afterGlobal.burn_due_ath).toBe(beforeGlobal.burn_due_ath);
  });

  it('RT-UNFT-002: resend after finalized Registry bounces without dropping item below storage floor', async () => {
    const { blockchain, registry, officialAthWallet } = await deploySealedRegistry();
    const caller = await blockchain.treasury('username-registry-finalized-resend-floor-caller');
    const ownerWallet = fixtureAddress('USERNAME_FINALIZED_RESEND_OWNER');
    const hash = nameHash('floorx');
    const itemAddress = await registry.getGetUsernameItemAddress(hash);

    await sendMint(registry, officialAthWallet, ownerWallet, 'floorx', PRICE_6_PLUS);

    const item = blockchain.openContract(new UsernameNFTItem(itemAddress));
    const beforeGlobal = await registry.getGetGlobal();
    const beforeRecord = await registry.getGetNameRecord(hash);
    const result = await item.send(caller.getSender(), { value: 4_000_000n }, {
      $$type: 'ResendDeployedAck',
    } as ResendDeployedAck);

    const afterGlobal = await registry.getGetGlobal();
    const afterRecord = await registry.getGetNameRecord(hash);
    const itemBalance = (await blockchain.getContract(itemAddress)).balance;

    expect(beforeRecord.exists).toBe(true);
    expect(afterRecord.exists).toBe(true);
    expect(afterRecord.minter_wallet.equals(beforeRecord.minter_wallet)).toBe(true);
    expect(afterRecord.item_address.equals(beforeRecord.item_address)).toBe(true);
    expect(afterGlobal.name_record_count).toBe(beforeGlobal.name_record_count);
    expect(afterGlobal.pending_mint_count).toBe(0n);
    expect(afterGlobal.treasury_due_ath).toBe(beforeGlobal.treasury_due_ath);
    expect(afterGlobal.burn_due_ath).toBe(beforeGlobal.burn_due_ath);
    expect(itemBalance).toBeGreaterThanOrEqual(USERNAME_ITEM_STORAGE_FLOOR);
    expect(findTransaction(result.transactions, {
      from: item.address,
      to: registry.address,
      op: 0xBBA3EC19,
      success: false,
      exitCode: 19130,
    })).toBeDefined();
  });

  it('USERNAME-REG-M10-01C: username item transfer changes NFT owner while registry keeps the same authoritative item address', async () => {
    const { blockchain, registry, officialAthWallet } = await deploySealedRegistry();
    const ownerA = fixtureAddress('USERNAME_M10_TRANSFER_OWNER_A');
    const ownerB = fixtureAddress('USERNAME_M10_TRANSFER_OWNER_B');
    const hash = nameHash('moveme');
    const itemAddress = await registry.getGetUsernameItemAddress(hash);

    await sendMint(registry, officialAthWallet, ownerA, 'moveme', PRICE_6_PLUS);

    const item = blockchain.openContract(new UsernameNFTItem(itemAddress));
    await item.send(blockchain.sender(ownerA), { value: 14_000_000n }, {
      $$type: 'NftTransfer',
      query_id: 901n,
      payload: nftTransferPayload(ownerB, ownerA, 0n),
    } as NftTransfer);

    const record = await registry.getGetNameRecord(hash);
    const itemState = await item.getGetState();
    expect(record.exists).toBe(true);
    expect(record.item_address.equals(itemAddress)).toBe(true);
    expect(itemState.owner_wallet.equals(ownerB)).toBe(true);
  });

  it('RT-UNAMEITEM-002: original ACK still finalizes when item transfers before Registry processes it', async () => {
    const { blockchain, registry, officialAthWallet, vaultAddress } = await deploySealedRegistry();
    const ownerA = fixtureAddress('USERNAME_ACK_RACE_OWNER_A');
    const ownerB = fixtureAddress('USERNAME_ACK_RACE_OWNER_B');
    const hash = nameHash('ackrace');
    const itemAddress = await registry.getGetUsernameItemAddress(hash);
    const item = blockchain.openContract(new UsernameNFTItem(itemAddress));

    const mintIterator = await blockchain.sendMessageIter(internalMessage(
      officialAthWallet.address,
      registry.address,
      // Registry now retains 511M (6M + 500M item deploy reserve + 1M + 4M); the mint notification must carry >= that.
      toNano('0.6'),
      vaultMintNotificationBody(ownerA, 'ackrace', PRICE_6_PLUS, vaultAddress),
    ), { allowParallel: true });

    const registryMintTx = await mintIterator.next();
    expect(registryMintTx.done).toBe(false);
    expect((await registry.getGetPendingMint(hash)).exists).toBe(true);
    expect((await registry.getGetNameRecord(hash)).exists).toBe(false);

    const itemInitTx = await mintIterator.next();
    expect(itemInitTx.done).toBe(false);
    expect((await item.getGetState()).owner_wallet.equals(ownerA)).toBe(true);

    await item.send(blockchain.sender(ownerA), { value: 14_000_000n }, {
      $$type: 'NftTransfer',
      query_id: 902n,
      payload: nftTransferPayload(ownerB, ownerA, 0n),
    } as NftTransfer);
    expect((await item.getGetState()).owner_wallet.equals(ownerB)).toBe(true);

    const ackTx = await mintIterator.next();
    expect(ackTx.done).toBe(false);
    const record = await registry.getGetNameRecord(hash);
    const global = await registry.getGetGlobal();
    const itemState = await item.getGetState();

    expect(record.exists).toBe(true);
    expect(record.minter_wallet.equals(ownerA)).toBe(true);
    expect(record.item_address.equals(itemAddress)).toBe(true);
    expect(itemState.owner_wallet.equals(ownerB)).toBe(true);
    expect((await registry.getGetPendingMint(hash)).exists).toBe(false);
    expect(global.name_record_count).toBe(1n);
    expect(global.treasury_due_ath).toBe(PRICE_6_PLUS / 2n);
    expect(global.burn_due_ath).toBe(PRICE_6_PLUS / 2n);
  });

  it('RT-UNAMEITEM-003: resend after transfer before finalization is rejected without mutating pending due', async () => {
    const { blockchain, registry, officialAthWallet, vaultAddress } = await deploySealedRegistry();
    const caller = await blockchain.treasury('username-resend-before-finalization-caller');
    const ownerA = fixtureAddress('USERNAME_RESEND_RACE_OWNER_A');
    const ownerB = fixtureAddress('USERNAME_RESEND_RACE_OWNER_B');
    const hash = nameHash('resrace');
    const itemAddress = await registry.getGetUsernameItemAddress(hash);
    const item = blockchain.openContract(new UsernameNFTItem(itemAddress));

    const mintIterator = await blockchain.sendMessageIter(internalMessage(
      officialAthWallet.address,
      registry.address,
      // Registry now retains 511M (6M + 500M item deploy reserve + 1M + 4M); the mint notification must carry >= that.
      toNano('0.6'),
      vaultMintNotificationBody(ownerA, 'resrace', PRICE_6_PLUS, vaultAddress),
    ), { allowParallel: true });

    expect((await mintIterator.next()).done).toBe(false);
    expect((await mintIterator.next()).done).toBe(false);
    await item.send(blockchain.sender(ownerA), { value: 14_000_000n }, {
      $$type: 'NftTransfer',
      query_id: 903n,
      payload: nftTransferPayload(ownerB, ownerA, 0n),
    } as NftTransfer);

    const beforeGlobal = await registry.getGetGlobal();
    const resend = await item.send(caller.getSender(), { value: 4_000_000n }, {
      $$type: 'ResendDeployedAck',
    } as ResendDeployedAck);
    const afterGlobal = await registry.getGetGlobal();
    const pending = await registry.getGetPendingMint(hash);

    expect(findTransaction(resend.transactions, {
      from: item.address,
      to: registry.address,
      op: 0xBBA3EC19,
      success: false,
      exitCode: 19136,
    })).toBeDefined();
    expect(pending.exists).toBe(true);
    expect(pending.owner_wallet.equals(ownerA)).toBe(true);
    expect((await registry.getGetNameRecord(hash)).exists).toBe(false);
    expect(afterGlobal.pending_mint_count).toBe(beforeGlobal.pending_mint_count);
    expect(afterGlobal.name_record_count).toBe(beforeGlobal.name_record_count);
    expect(afterGlobal.treasury_due_ath).toBe(beforeGlobal.treasury_due_ath);
    expect(afterGlobal.burn_due_ath).toBe(beforeGlobal.burn_due_ath);

    expect((await mintIterator.next()).done).toBe(false);
    expect((await registry.getGetNameRecord(hash)).exists).toBe(true);
    expect((await registry.getGetPendingMint(hash)).exists).toBe(false);
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

  it('USERNAME-REG-M10-07: rejected Vault-funded mint notification leaves registry state untouched for ATHWallet refund path', async () => {
    const { registry, officialAthWallet } = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M10_INVALID_ACK_OWNER');

    const result = await sendMint(registry, officialAthWallet, ownerWallet, 'Larisa', PRICE_6_PLUS);

    expect(findTransaction(result.transactions, {
      from: registry.address,
      to: officialAthWallet.address,
      op: OP_ATH_TRANSFER_NOTIFICATION_ACK,
    })).toBeUndefined();
  });

  it('USERNAME-REG-M10-08: underfunded official mint notification cannot strand state without ACK reserve', async () => {
    const { registry, officialAthWallet } = await deploySealedRegistry();
    const invalidOwner = fixtureAddress('USERNAME_M10_INVALID_UNDERFUNDED_OWNER');
    const validOwner = fixtureAddress('USERNAME_M10_VALID_UNDERFUNDED_OWNER');
    const validHash = nameHash('oldmin');

    await sendMint(registry, officialAthWallet, invalidOwner, 'Larisa', PRICE_6_PLUS, toNano('0.004'));
    await sendMint(registry, officialAthWallet, validOwner, 'oldmin', PRICE_6_PLUS, toNano('0.026'));

    expect((await registry.getGetNameRecord(validHash)).exists).toBe(false);
    expect((await registry.getGetPendingMint(validHash)).exists).toBe(false);
    const global = await registry.getGetGlobal();
    expect(global.name_record_count).toBe(0n);
    expect(global.pending_mint_count).toBe(0n);
  });

  it('USERNAME-REG-M10-09: successful Vault-funded mint does not send direct owner excess from registry', async () => {
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
    })).toBeUndefined();
  });

  it('USERNAME-REG-M10-10: masterchain owner mint is rejected before pending or name state', async () => {
    const { registry, officialAthWallet } = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M10_MASTERCHAIN_OWNER', -1);
    const hash = nameHash('master');

    await sendMint(registry, officialAthWallet, ownerWallet, 'master', PRICE_6_PLUS);

    expect((await registry.getGetNameRecord(hash)).exists).toBe(false);
    expect((await registry.getGetPendingMint(hash)).exists).toBe(false);
    const global = await registry.getGetGlobal();
    expect(global.pending_mint_count).toBe(0n);
  });

  it('USERNAME-REG-M10-11: bounced item deploy asks the official ATH wallet to refund the pending notification', async () => {
    const { blockchain, registry, officialAthWallet } = await deploySealedRegistry();
    const owner = await blockchain.treasury('username-registry-bounced-item-owner');
    const hash = nameHash('bounce');
    const itemAddress = await registry.getGetUsernameItemAddress(hash);
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
    expect(findTransaction(result.transactions, {
      from: registry.address,
      to: officialAthWallet.address,
      op: OP_ATH_TRANSFER_NOTIFICATION_REFUND,
    })).toBeDefined();
  });

  it('USERNAME-REG-M10-02: invalid uppercase Vault-funded username leaves no pending/name state', async () => {
    const { registry, officialAthWallet } = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M10_UPPERCASE_OWNER');
    const hash = nameHash('Larisa');

    await sendMint(registry, officialAthWallet, ownerWallet, 'Larisa', PRICE_6_PLUS);

    const record = await registry.getGetNameRecord(hash);
    const global = await registry.getGetGlobal();

    expect(record.exists).toBe(false);
    expect(global.name_record_count).toBe(0n);
    expect(global.pending_mint_count).toBe(0n);
  });

  it('USERNAME-REG-M10-03: non-official ATH sender is rejected and cannot create pending or name record', async () => {
    const { registry, attacker } = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M10_SPOOF_OWNER');

    await registry.send(attacker.getSender(), { value: toNano('0.1') }, {
      $$type: 'AthTransferNotificationVaultMintUsername',
      query_id: 1n,
      amount: PRICE_6_PLUS,
      sender_key: 0n,
      payer_wallet: fixtureAddress('USERNAME_REGISTRY_VAULT'),
      owner_wallet: ownerWallet,
      username_len: 6n,
      username: usernameSlice('platho'),
    } as AthTransferNotificationVaultMintUsername);

    const global = await registry.getGetGlobal();
    expect(global.name_record_count).toBe(0n);
    expect(global.pending_mint_count).toBe(0n);
  });

  it('USERNAME-REG-M10-04: duplicate finalized Vault-funded username rejects without changing the existing record', async () => {
    const { registry, officialAthWallet } = await deploySealedRegistry();
    const ownerA = fixtureAddress('USERNAME_M10_DUP_OWNER_A');
    const ownerB = fixtureAddress('USERNAME_M10_DUP_OWNER_B');
    const hash = nameHash('larisa');

    await sendMint(registry, officialAthWallet, ownerA, 'larisa', PRICE_6_PLUS);
    await sendMint(registry, officialAthWallet, ownerB, 'larisa', PRICE_6_PLUS);

    const record = await registry.getGetNameRecord(hash);
    const global = await registry.getGetGlobal();

    expect(record.exists).toBe(true);
    expect(record.minter_wallet.equals(ownerA)).toBe(true);
    expect(global.name_record_count).toBe(1n);
  });

  it('USERNAME-REG-M10-05: price tiers are enforced as exact ATH amounts and Vault underpay leaves no registry state', async () => {
    const { registry, officialAthWallet } = await deploySealedRegistry();
    const owner4 = fixtureAddress('USERNAME_M10_PRICE_4');
    const owner5 = fixtureAddress('USERNAME_M10_PRICE_5');
    const underpayOwner = fixtureAddress('USERNAME_M10_UNDERPAY');

    await sendMint(registry, officialAthWallet, owner4, 'abcd', PRICE_4);
    await sendMint(registry, officialAthWallet, owner5, 'abcde', PRICE_5);
    await sendMint(registry, officialAthWallet, underpayOwner, 'abcdef', PRICE_6_PLUS - 1n);

    expect((await registry.getGetNameRecord(nameHash('abcd'))).exists).toBe(true);
    expect((await registry.getGetNameRecord(nameHash('abcde'))).exists).toBe(true);

    const global = await registry.getGetGlobal();
    expect(global.name_record_count).toBe(2n);
  });
});
