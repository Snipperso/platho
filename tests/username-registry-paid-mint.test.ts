import { describe, expect, it } from 'vitest';
import { sealArtAndCollectionMeta } from './helpers/username-registry-genesis';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { createHash } from 'crypto';
import {
  UsernameRegistry,
  BindOfficialAthWallet,
  SealGenesis,
  AthTransferNotificationRegistryMintUsername,
  storeAthTransferNotificationRegistryMintUsername,
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
const ITEM_ACK_RESEND_VALUE = 5_000_000n;
const SUCCESSFUL_MINT_REQUIRED_VALUE = 6_000_000n + 829_000_000n + 1_000_000n + 4_000_000n + 100_000_000n;
const USERNAME_ITEM_STORAGE_FLOOR = 15_900_000n;

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

  await sealArtAndCollectionMeta(registry, deployer);
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
  value = toNano('1.2'),
  payerWallet = fixtureAddress('USERNAME_REGISTRY_VAULT'),
) {
  return registry.send(officialAthWallet.getSender(), { value }, {
    $$type: 'AthTransferNotificationRegistryMintUsername',
    query_id: 1n,
    amount,
    sender_key: 0n,
    payer_wallet: payerWallet,
    owner_wallet: ownerWallet,
    username_len: BigInt(Buffer.from(name, 'ascii').length),
    username: usernameSlice(name).asCell(),
  } as AthTransferNotificationRegistryMintUsername);
}

function vaultMintNotificationBody(ownerWallet: Address, name: string, amount: bigint, payerWallet = fixtureAddress('USERNAME_REGISTRY_VAULT')) {
  return beginCell().store(storeAthTransferNotificationRegistryMintUsername({
    $$type: 'AthTransferNotificationRegistryMintUsername',
    query_id: 1n,
    amount,
    sender_key: 0n,
    payer_wallet: payerWallet,
    owner_wallet: ownerWallet,
    username_len: BigInt(Buffer.from(name, 'ascii').length),
    username: usernameSlice(name).asCell(),
  })).endCell();
}

async function readItemRecord(blockchain: Blockchain, registryAddress: Address, hash: bigint) {
  const init = await UsernameNFTItem.init(registryAddress, hash);
  const address = contractAddress(0, init);
  const account = await blockchain.getContract(address);
  if (account.accountState?.type !== 'active') {
    return { address, minted: false, owner: null as Address | null };
  }
  const state = await blockchain.openContract(new UsernameNFTItem(address, init)).getGetState();
  return { address, minted: state.initialized, owner: state.owner_wallet as Address | null };
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

    const rec = await readItemRecord(blockchain, registry.address, hash);
    const pending = await registry.getGetPendingMint(hash);
    const global = await registry.getGetGlobal();

    expect(rec.minted).toBe(true);
    expect(rec.owner!.equals(ownerWallet)).toBe(true);
    expect(rec.address.equals(itemAddress)).toBe(true);
    expect(pending.exists).toBe(false);
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

    const rec = await readItemRecord(blockchain, registry.address, hash);
    const itemState = await item.getGetState();
    expect(rec.minted).toBe(true);
    expect(rec.address.equals(itemAddress)).toBe(true);
    expect(rec.owner!.equals(ownerWallet)).toBe(true);
    expect(itemState.initialized).toBe(true);
    expect(itemState.owner_wallet.equals(ownerWallet)).toBe(true);
    expect(itemState.owner_wallet.equals(attacker.address)).toBe(false);
    expect((await registry.getGetPendingMint(hash)).exists).toBe(false);
  });

  it('USERNAME-REG-M10-01D: canonical usernames allow lowercase letters, digits, underscores, and hyphens only', async () => {
    const { blockchain, registry, officialAthWallet } = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M10_CANONICAL_CHARS_OWNER');
    const hash = nameHash('platho_1-x');

    await sendMint(registry, officialAthWallet, ownerWallet, 'platho_1-x', PRICE_6_PLUS);

    const rec = await readItemRecord(blockchain, registry.address, hash);
    expect(rec.minted).toBe(true);
    expect(rec.owner!.equals(ownerWallet)).toBe(true);
  });

  it('USERNAME-REG-M10-01E: v1 separator policy intentionally permits edge separator names', async () => {
    const { blockchain, registry, officialAthWallet } = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M10_SEPARATOR_POLICY_OWNER');
    const hash = nameHash('----');

    await sendMint(registry, officialAthWallet, ownerWallet, '----', PRICE_4);

    const rec = await readItemRecord(blockchain, registry.address, hash);
    expect(rec.minted).toBe(true);
    expect(rec.owner!.equals(ownerWallet)).toBe(true);
  });

  it('USERNAME-REG-M10-01B: repeated item resend after finalization cannot mutate record or split due again', async () => {
    const { blockchain, registry, officialAthWallet } = await deploySealedRegistry();
    const caller = await blockchain.treasury('username-registry-repeat-resend-caller');
    const ownerWallet = fixtureAddress('USERNAME_M10_REPEAT_RESEND_OWNER');
    const hash = nameHash('repeat');
    const itemAddress = await registry.getGetUsernameItemAddress(hash);

    await sendMint(registry, officialAthWallet, ownerWallet, 'repeat', PRICE_6_PLUS);

    const item = blockchain.openContract(new UsernameNFTItem(itemAddress));
    const beforeRec = await readItemRecord(blockchain, registry.address, hash);
    const beforeGlobal = await registry.getGetGlobal();

    await item.send(caller.getSender(), { value: ITEM_ACK_RESEND_VALUE }, {
      $$type: 'ResendDeployedAck',
    } as ResendDeployedAck);

    const afterRec = await readItemRecord(blockchain, registry.address, hash);
    const afterGlobal = await registry.getGetGlobal();

    expect(beforeRec.minted).toBe(true);
    expect(afterRec.minted).toBe(true);
    expect(afterRec.owner!.equals(beforeRec.owner!)).toBe(true);
    expect(afterRec.address.equals(beforeRec.address)).toBe(true);
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
    const beforeRec = await readItemRecord(blockchain, registry.address, hash);
    const result = await item.send(caller.getSender(), { value: ITEM_ACK_RESEND_VALUE }, {
      $$type: 'ResendDeployedAck',
    } as ResendDeployedAck);

    const afterGlobal = await registry.getGetGlobal();
    const afterRec = await readItemRecord(blockchain, registry.address, hash);
    const itemBalance = (await blockchain.getContract(itemAddress)).balance;

    expect(beforeRec.minted).toBe(true);
    expect(afterRec.minted).toBe(true);
    expect(afterRec.owner!.equals(beforeRec.owner!)).toBe(true);
    expect(afterRec.address.equals(beforeRec.address)).toBe(true);
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

    const rec = await readItemRecord(blockchain, registry.address, hash);
    const itemState = await item.getGetState();
    expect(rec.minted).toBe(true);
    expect(rec.address.equals(itemAddress)).toBe(true);
    expect(rec.owner!.equals(ownerB)).toBe(true);
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
      toNano('1.2'),
      vaultMintNotificationBody(ownerA, 'ackrace', PRICE_6_PLUS, vaultAddress),
    ), { allowParallel: true });

    const registryMintTx = await mintIterator.next();
    expect(registryMintTx.done).toBe(false);
    expect((await registry.getGetPendingMint(hash)).exists).toBe(true);
    expect((await readItemRecord(blockchain, registry.address, hash)).minted).toBe(false);

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
    const rec = await readItemRecord(blockchain, registry.address, hash);
    const global = await registry.getGetGlobal();
    const itemState = await item.getGetState();

    expect(rec.minted).toBe(true);
    expect(rec.address.equals(itemAddress)).toBe(true);
    expect(rec.owner!.equals(ownerB)).toBe(true);
    expect(itemState.owner_wallet.equals(ownerB)).toBe(true);
    expect((await registry.getGetPendingMint(hash)).exists).toBe(false);
    expect(global.treasury_due_ath).toBe(PRICE_6_PLUS / 2n);
    expect(global.burn_due_ath).toBe(PRICE_6_PLUS / 2n);
  });

  it('RT-UNAMEITEM-003: a resend after transfer still FINALIZES the mint it belongs to — recovery is not lost to a transfer', async () => {
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
      toNano('1.2'),
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
    const resend = await item.send(caller.getSender(), { value: ITEM_ACK_RESEND_VALUE }, {
      $$type: 'ResendDeployedAck',
    } as ResendDeployedAck);
    const afterGlobal = await registry.getGetGlobal();
    const pending = await registry.getGetPendingMint(hash);

    expect(findTransaction(resend.transactions, {
      from: item.address,
      to: registry.address,
      op: 0xBBA3EC19,
      success: true,
    })).toBeDefined();
    expect(pending.exists, 'the pending mint is resolved, not stranded').toBe(false);
    expect((await readItemRecord(blockchain, registry.address, hash)).minted).toBe(true);
    expect(afterGlobal.pending_mint_count).toBe(beforeGlobal.pending_mint_count - 1n);
    expect(afterGlobal.treasury_due_ath, 'the price is booked').toBeGreaterThan(beforeGlobal.treasury_due_ath);
    expect(afterGlobal.burn_due_ath).toBeGreaterThan(beforeGlobal.burn_due_ath);

    expect((await mintIterator.next()).done).toBe(false);
    expect((await readItemRecord(blockchain, registry.address, hash)).minted).toBe(true);
    expect((await registry.getGetPendingMint(hash)).exists).toBe(false);
  });

  it('RT-UNAMEITEM-004: a STALE ack from a long-initialized item cannot finalize a later mint (gate 19137)', async () => {
    const { blockchain, registry, officialAthWallet, vaultAddress } = await deploySealedRegistry();
    const attacker = await blockchain.treasury('username-stale-ack-attacker');
    const owner = fixtureAddress('USERNAME_STALE_ACK_OWNER');
    const hash = nameHash('staleak');
    const itemAddress = await registry.getGetUsernameItemAddress(hash);
    const item = blockchain.openContract(new UsernameNFTItem(itemAddress));

    await sendMint(registry, officialAthWallet, owner, 'staleak', PRICE_6_PLUS);
    expect((await registry.getGetPendingMint(hash)).exists).toBe(false);
    expect((await item.getGetState()).initialized).toBe(true);

    const iter = await blockchain.sendMessageIter(internalMessage(
      officialAthWallet.address,
      registry.address,
      toNano('1.2'),
      vaultMintNotificationBody(owner, 'staleak', PRICE_6_PLUS, vaultAddress),
    ), { allowParallel: true });
    expect((await iter.next()).done).toBe(false);
    expect((await registry.getGetPendingMint(hash)).exists, 'the duplicate is pending, awaiting its bounce').toBe(true);

    const before = await registry.getGetGlobal();
    const resend = await item.send(attacker.getSender(), { value: ITEM_ACK_RESEND_VALUE }, {
      $$type: 'ResendDeployedAck',
    } as ResendDeployedAck);
    const after = await registry.getGetGlobal();

    expect(findTransaction(resend.transactions, {
      from: item.address,
      to: registry.address,
      op: 0xBBA3EC19,
      success: false,
      exitCode: 19137,
    }), 'the stale ack is refused on the nonce, not on luck').toBeDefined();
    expect((await registry.getGetPendingMint(hash)).exists).toBe(true);
    expect(after.treasury_due_ath, 'no price booked for a mint that did not happen').toBe(before.treasury_due_ath);
    expect(after.burn_due_ath).toBe(before.burn_due_ath);
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

    const result = await sendMint(registry, officialAthWallet, ownerWallet, 'Marble', PRICE_6_PLUS);

    expect(findTransaction(result.transactions, {
      from: registry.address,
      to: officialAthWallet.address,
      op: OP_ATH_TRANSFER_NOTIFICATION_ACK,
    })).toBeUndefined();
  });

  it('USERNAME-REG-M10-08: underfunded official mint notification cannot strand state without ACK reserve', async () => {
    const { blockchain, registry, officialAthWallet } = await deploySealedRegistry();
    const invalidOwner = fixtureAddress('USERNAME_M10_INVALID_UNDERFUNDED_OWNER');
    const validOwner = fixtureAddress('USERNAME_M10_VALID_UNDERFUNDED_OWNER');
    const validHash = nameHash('oldmin');

    await sendMint(registry, officialAthWallet, invalidOwner, 'Marble', PRICE_6_PLUS, toNano('0.004'));
    await sendMint(registry, officialAthWallet, validOwner, 'oldmin', PRICE_6_PLUS, toNano('0.026'));

    expect((await readItemRecord(blockchain, registry.address, validHash)).minted).toBe(false);
    expect((await registry.getGetPendingMint(validHash)).exists).toBe(false);
    const global = await registry.getGetGlobal();
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

    expect((await readItemRecord(blockchain, registry.address, hash)).minted).toBe(true);
    expect(findTransaction(result.transactions, {
      from: registry.address,
      to: owner.address,
    })).toBeUndefined();
  });

  it('USERNAME-REG-M10-10: masterchain owner mint is rejected before pending or name state', async () => {
    const { blockchain, registry, officialAthWallet } = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M10_MASTERCHAIN_OWNER', -1);
    const hash = nameHash('master');

    await sendMint(registry, officialAthWallet, ownerWallet, 'master', PRICE_6_PLUS);

    expect((await readItemRecord(blockchain, registry.address, hash)).minted).toBe(false);
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

    const squattedState = (await blockchain.getContract(itemAddress)).accountState as any;
    const itemInit = await UsernameNFTItem.init(registry.address, hash);
    expect(squattedState?.type).toBe('active');
    expect(squattedState.state.code.equals(rejectInit.code)).toBe(true);
    expect(squattedState.state.code.equals(itemInit.code)).toBe(false);
    expect((await registry.getGetPendingMint(hash)).exists).toBe(false);
    expect(findTransaction(result.transactions, {
      from: registry.address,
      to: officialAthWallet.address,
      op: OP_ATH_TRANSFER_NOTIFICATION_REFUND,
    })).toBeDefined();
  });

  it('USERNAME-REG-M10-02: invalid uppercase Vault-funded username leaves no pending/name state', async () => {
    const { blockchain, registry, officialAthWallet } = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M10_UPPERCASE_OWNER');
    const hash = nameHash('Marble');

    await sendMint(registry, officialAthWallet, ownerWallet, 'Marble', PRICE_6_PLUS);

    const rec = await readItemRecord(blockchain, registry.address, hash);
    const global = await registry.getGetGlobal();

    expect(rec.minted).toBe(false);
    expect(global.pending_mint_count).toBe(0n);
  });

  it('USERNAME-REG-M10-03: non-official ATH sender is rejected and cannot create pending or name record', async () => {
    const { blockchain, registry, attacker } = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M10_SPOOF_OWNER');

    await registry.send(attacker.getSender(), { value: toNano('0.1') }, {
      $$type: 'AthTransferNotificationRegistryMintUsername',
      query_id: 1n,
      amount: PRICE_6_PLUS,
      sender_key: 0n,
      payer_wallet: fixtureAddress('USERNAME_REGISTRY_VAULT'),
      owner_wallet: ownerWallet,
      username_len: 6n,
      username: usernameSlice('platho').asCell(),
    } as AthTransferNotificationRegistryMintUsername);

    expect((await readItemRecord(blockchain, registry.address, nameHash('platho'))).minted).toBe(false);
    const global = await registry.getGetGlobal();
    expect(global.pending_mint_count).toBe(0n);
  });

  it('USERNAME-REG-M10-04: duplicate finalized Vault-funded username is refused BY THE ITEM and the second buyer is refunded', async () => {
    const { blockchain, registry, officialAthWallet } = await deploySealedRegistry();
    const ownerA = fixtureAddress('USERNAME_M10_DUP_OWNER_A');
    const ownerB = fixtureAddress('USERNAME_M10_DUP_OWNER_B');
    const hash = nameHash('marble');

    await sendMint(registry, officialAthWallet, ownerA, 'marble', PRICE_6_PLUS);
    const dup = await sendMint(registry, officialAthWallet, ownerB, 'marble', PRICE_6_PLUS);

    const tonBack = dup.transactions
      .flatMap((t: any) => t.outMessages?.values?.() ?? [])
      .filter((m: any) => m.info?.dest?.equals?.(ownerB) && m.info?.type === 'internal');
    expect(tonBack.length, 'the second buyer gets their TON back').toBe(1);
    expect(tonBack[0].info.value.coins, 'and it is the deploy reserve, not dust').toBeGreaterThan(100_000_000n);

    const rec = await readItemRecord(blockchain, registry.address, hash);
    expect(rec.minted).toBe(true);
    expect(rec.owner!.equals(ownerA)).toBe(true);
    expect(rec.owner!.equals(ownerB)).toBe(false);

    expect(findTransaction(dup.transactions, {
      from: registry.address,
      to: rec.address,
      success: false,
      exitCode: 18011,
    })).toBeDefined();
    expect(findTransaction(dup.transactions, {
      from: rec.address,
      to: registry.address,
      inMessageBounced: true,
    })).toBeDefined();

    expect(findTransaction(dup.transactions, {
      from: registry.address,
      to: officialAthWallet.address,
      op: OP_ATH_TRANSFER_NOTIFICATION_REFUND,
    })).toBeDefined();
    expect((await registry.getGetPendingMint(hash)).exists).toBe(false);
  });

  it('USERNAME-REG-M10-05: price tiers are enforced as exact ATH amounts and Vault underpay leaves no registry state', async () => {
    const { blockchain, registry, officialAthWallet } = await deploySealedRegistry();
    const owner4 = fixtureAddress('USERNAME_M10_PRICE_4');
    const owner5 = fixtureAddress('USERNAME_M10_PRICE_5');
    const underpayOwner = fixtureAddress('USERNAME_M10_UNDERPAY');

    await sendMint(registry, officialAthWallet, owner4, 'abcd', PRICE_4);
    await sendMint(registry, officialAthWallet, owner5, 'abcde', PRICE_5);
    await sendMint(registry, officialAthWallet, underpayOwner, 'abcdef', PRICE_6_PLUS - 1n);

    expect((await readItemRecord(blockchain, registry.address, nameHash('abcd'))).minted).toBe(true);
    expect((await readItemRecord(blockchain, registry.address, nameHash('abcde'))).minted).toBe(true);
    expect((await readItemRecord(blockchain, registry.address, nameHash('abcdef'))).minted).toBe(false);
  });
});
