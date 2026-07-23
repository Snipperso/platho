import { describe, expect, it } from 'vitest';
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
// clean-16 L2/#14 (owner: mint=exactly 1 TON): item(829M) + 100M, sized at the real 64962/cell/yr rate.
// The 100M was the per-name record's rent; name_records is gone, so since 2026-07-20 it funds the REGISTRY'S
// OWN storage instead. The number is deliberately unchanged — mint price is pinned client-side at exactly 1 TON,
// so lowering it would return nothing to the buyer, only stop accounting for where the money goes.
const SUCCESSFUL_MINT_REQUIRED_VALUE = 6_000_000n + 829_000_000n + 1_000_000n + 4_000_000n + 100_000_000n;
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

// ── THE ITEM IS THE RECORD ────────────────────────────────────────────────────────────────────────────────
// UsernameRegistry.name_records is DELETED (2026-07-20), and with it get_name_record and get_global().name_record_count.
// The per-name UsernameNFTItem was always the authoritative record; the map was a weaker, staler copy of it.
//
// "Is this name minted?" is answered by the chain, with no map: the item account at the name-derived address
// exists AND its get_state().initialized is true. `owner` is the LIVE owner — unlike the deleted
// NameRecord.minter_wallet, it tracks TEP-62 transfers. The deleted registered_at has no successor anywhere.
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

    // The mint FINALISED: the item at the name-derived address became initialized. That is the stronger claim
    // the deleted name_record_count counter used to stand in for.
    const rec = await readItemRecord(blockchain, registry.address, hash);
    const pending = await registry.getGetPendingMint(hash);
    const global = await registry.getGetGlobal();

    expect(rec.minted).toBe(true);
    expect(rec.owner!.equals(ownerWallet)).toBe(true);
    // The registry's getter and the pure client-side derivation reach the same address — no index required.
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

    // Accepted: the item exists and finalised. (The old name_record_count === 1n proved the same finalisation
    // indirectly; the item becoming initialized is the direct claim.)
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

    await item.send(caller.getSender(), { value: 4_000_000n }, {
      $$type: 'ResendDeployedAck',
    } as ResendDeployedAck);

    const afterRec = await readItemRecord(blockchain, registry.address, hash);
    const afterGlobal = await registry.getGetGlobal();

    // The record that must not mutate now lives in the item, not in a registry map.
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
    const result = await item.send(caller.getSender(), { value: 4_000_000n }, {
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

    // The authoritative address is a pure function of the name, so a TEP-62 transfer cannot move it. What DOES
    // move is the owner — and the item reports the new one. (The deleted NameRecord.minter_wallet never did:
    // it would still have named ownerA here, which is why removing the map removed a wrong source, not a right one.)
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
      // Registry now retains 511M (6M + 500M item deploy reserve + 1M + 4M); the mint notification must carry >= that.
      toNano('1.2'),
      vaultMintNotificationBody(ownerA, 'ackrace', PRICE_6_PLUS, vaultAddress),
    ), { allowParallel: true });

    const registryMintTx = await mintIterator.next();
    expect(registryMintTx.done).toBe(false);
    expect((await registry.getGetPendingMint(hash)).exists).toBe(true);
    // The item has not been deployed yet, so the name is not minted: no account at the derived address.
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

    // The ACK still finalises the mint: pending clears and the dues are credited, even though ownership moved
    // out from under it. The mint is FINALISED — the item is initialized at the name-derived address.
    //
    // DROPPED, deliberately: the old `record.minter_wallet.equals(ownerA)`. NameRecord froze the minter at mint
    // time and nothing replaces it — the item holds the LIVE owner, which is ownerB here by design. There is no
    // longer any on-chain place that remembers who first bought a name, and none is needed: finalisation is
    // proven by pending clearing and the dues below, ownership by the item.
    expect(rec.minted).toBe(true);
    expect(rec.address.equals(itemAddress)).toBe(true);
    expect(rec.owner!.equals(ownerB)).toBe(true);
    expect(itemState.owner_wallet.equals(ownerB)).toBe(true);
    expect((await registry.getGetPendingMint(hash)).exists).toBe(false);
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
    // Rejecting the resend must not touch the pending mint. Note the ORDERING the item-is-the-record model makes
    // explicit: the item is already live and initialized at this point — it was deployed one iterator step ago —
    // while the registry has NOT yet finalised. "Minted" (the item) and "finalised" (pending cleared, dues
    // credited) are now visibly two different facts, and only the second is what this resend must not disturb.
    // The deleted name_record_count conflated them; pending_mints, which does clear itself, is the real subject.
    expect(pending.exists).toBe(true);
    expect(pending.owner_wallet.equals(ownerA)).toBe(true);
    expect((await readItemRecord(blockchain, registry.address, hash)).minted).toBe(true);
    expect(afterGlobal.pending_mint_count).toBe(beforeGlobal.pending_mint_count);
    expect(afterGlobal.treasury_due_ath).toBe(beforeGlobal.treasury_due_ath);
    expect(afterGlobal.burn_due_ath).toBe(beforeGlobal.burn_due_ath);

    expect((await mintIterator.next()).done).toBe(false);
    expect((await readItemRecord(blockchain, registry.address, hash)).minted).toBe(true);
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
    const { blockchain, registry, officialAthWallet } = await deploySealedRegistry();
    const invalidOwner = fixtureAddress('USERNAME_M10_INVALID_UNDERFUNDED_OWNER');
    const validOwner = fixtureAddress('USERNAME_M10_VALID_UNDERFUNDED_OWNER');
    const validHash = nameHash('oldmin');

    await sendMint(registry, officialAthWallet, invalidOwner, 'Larisa', PRICE_6_PLUS, toNano('0.004'));
    await sendMint(registry, officialAthWallet, validOwner, 'oldmin', PRICE_6_PLUS, toNano('0.026'));

    // Nothing stranded: no item was deployed, so the mint did NOT finalise.
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

    // The name was NOT minted. readItemRecord cannot speak here: a foreign contract squats the item address, so
    // there is an active account but no UsernameNFTItem to ask. The direct claim is that the account still
    // carries the squatter's code — the deploy bounced, nothing was ever initialized at that address.
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
    const hash = nameHash('Larisa');

    await sendMint(registry, officialAthWallet, ownerWallet, 'Larisa', PRICE_6_PLUS);

    // The mint did NOT finalise: no item account was ever created for the rejected name.
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

    // The spoofed mint neither finalised nor left a pending entry.
    expect((await readItemRecord(blockchain, registry.address, nameHash('platho'))).minted).toBe(false);
    const global = await registry.getGetGlobal();
    expect(global.pending_mint_count).toBe(0n);
  });

  it('USERNAME-REG-M10-04: duplicate finalized Vault-funded username is refused BY THE ITEM and the second buyer is refunded', async () => {
    // BEHAVIOURAL CHANGE (2026-07-20, name_records deleted). A duplicate is no longer refused synchronously in
    // COMPUTE at the registry's gate 19172 — that gate needed the map. The registry now deploys to the existing
    // item address; because the account is already active the StateInit is ignored but the BODY is still
    // delivered, so the ITEM answers at ITS own gate 18011, the message bounces, and the registry's
    // bounced<InitializeUsernameItem> handler refunds the second buyer's ATH. One extra round trip, same refusal.
    const { blockchain, registry, officialAthWallet } = await deploySealedRegistry();
    const ownerA = fixtureAddress('USERNAME_M10_DUP_OWNER_A');
    const ownerB = fixtureAddress('USERNAME_M10_DUP_OWNER_B');
    const hash = nameHash('larisa');

    await sendMint(registry, officialAthWallet, ownerA, 'larisa', PRICE_6_PLUS);
    const dup = await sendMint(registry, officialAthWallet, ownerB, 'larisa', PRICE_6_PLUS);

    // The first owner keeps the name — the duplicate changed nothing.
    const rec = await readItemRecord(blockchain, registry.address, hash);
    expect(rec.minted).toBe(true);
    expect(rec.owner!.equals(ownerA)).toBe(true);
    expect(rec.owner!.equals(ownerB)).toBe(false);

    // The item refuses re-initialisation in COMPUTE, and the refusal bounces.
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

    // The bounce is what returns the second buyer's money.
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

    // Exact-price mints finalised; the underpaid one did not. The old name_record_count === 2n proved the
    // underpay left no state only by arithmetic — asserting the underpaid name has no item says it directly.
    expect((await readItemRecord(blockchain, registry.address, nameHash('abcd'))).minted).toBe(true);
    expect((await readItemRecord(blockchain, registry.address, nameHash('abcde'))).minted).toBe(true);
    expect((await readItemRecord(blockchain, registry.address, nameHash('abcdef'))).minted).toBe(false);
  });
});
