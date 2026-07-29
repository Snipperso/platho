import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  UsernameRegistry,
  BindOfficialAthWallet,
  SealGenesis,
  AthTransferNotificationRegistryMintUsername,
  UsernameItemDeployedAck,
  FlushTreasuryAthDue,
  ATHTransferAck,
  ATHTransferFailed,
  ATHBurnFinalized,
  ATHBurnFailed,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import { MockUsernameNFTItemNoAck } from '../build/MockUsernameNFTItemNoAck/MockUsernameNFTItemNoAck_MockUsernameNFTItemNoAck';
import { MockAthWalletNoAck } from '../build/MockAthWalletNoAck/MockAthWalletNoAck_MockAthWalletNoAck';
import { UsernameNFTItem } from '../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';

const MANIFEST_HASH = 0x9999888877776666555544443333222211110000ffffeeeeddddccccbbbbaaaan;
const NAME_HASH_DOMAIN = 0xC5CC7CD6n;
const PRICE_6_PLUS = 100_000_000_000n;
const HALF_PRICE = 50_000_000_000n;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.USERNAME.AUTH.${label}`).digest());
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

async function deploySealedRegistryWithMockOfficial() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const deployer = await blockchain.treasury('username-auth-deployer');
  const attacker = await blockchain.treasury('username-auth-attacker');
  const flusher = await blockchain.treasury('username-auth-flusher');
  const placeholderAthWallet = fixtureAddress('PLACEHOLDER_ATH_WALLET');
  const athMasterAddress = fixtureAddress('ATH_MASTER');
  const treasuryAthReceiver = fixtureAddress('TREASURY_ATH_RECEIVER');
  const vaultAddress = fixtureAddress('USERNAME_AUTH_VAULT');

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
  const mockOfficialAddress = await registry.getGetAthWalletAddress(registryAddress);
  // Install a no-ACK sink at the official ATH wallet address so a FlushTreasuryAthDue/FlushBurnAthDue transfer is
  // ABSORBED (not bounced) and its pending flush stays OPEN — the invariant NEG-03/NEG-04 assert a forged callback
  // cannot clear. (Was MockVaultAthWallet; that Vault-named mock is gone, MockAthWalletNoAck is the same sink.)
  const mockOfficialInit = await MockAthWalletNoAck.init();
  await blockchain.setShardAccount(mockOfficialAddress, createShardAccount({
    address: mockOfficialAddress,
    code: mockOfficialInit.code,
    data: mockOfficialInit.data,
    balance: toNano('2'),
    workchain: mockOfficialAddress.workChain,
  }));

  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: mockOfficialAddress,
  } as BindOfficialAthWallet);
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);

  return { blockchain, registry, mockOfficialAddress, attacker, flusher, athMasterAddress, treasuryAthReceiver, vaultAddress };
}

async function sendMintFromOfficialAddress(
  blockchain: Blockchain,
  registry: any,
  officialAddress: Address,
  ownerWallet: Address,
  name: string,
  amount = PRICE_6_PLUS,
  payerWallet = fixtureAddress('USERNAME_AUTH_VAULT'),
) {
  // Registry now retains 511M (6M + 500M item deploy reserve + 1M + 4M), so the mint notification must carry >= that.
  await registry.send(blockchain.sender(officialAddress), { value: toNano('1.2') }, {
    $$type: 'AthTransferNotificationRegistryMintUsername',
    query_id: 911n,
    amount,
    sender_key: 0n,
    payer_wallet: payerWallet,
    owner_wallet: ownerWallet,
    username_len: BigInt(Buffer.from(name, 'ascii').length),
    username: usernameSlice(name).asCell(),
  } as AthTransferNotificationRegistryMintUsername);
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
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// THE ITEM IS THE RECORD.
//
// UsernameRegistry.name_records was deleted (2026-07-20) along with get_name_record and the global
// name_record_count. The per-name UsernameNFTItem was always the authoritative record; the map was a
// weaker copy of it. So "does this forged message create a name?" is now asked of the CHAIN:
//   * the item address is a pure function of (registry, name_hash) — nothing needs to index it;
//   * the name exists iff that account is a live UsernameNFTItem with get_state().initialized == true;
//   * get_state().owner_wallet is the LIVE owner and follows TEP-62 transfers, which the record never did.
//
// The registered_at timestamp the record carried is held by nothing now, so no test below asserts it.
//
// Several tests here deliberately park a MockUsernameNFTItemNoAck at the item address to hold a mint
// pending. That account is active but is NOT an item, so the code-hash check below reports it as "no
// name here" — which is exactly correct: no name was ever created at that address.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
async function readUsernameItem(blockchain: Blockchain, registryAddress: Address, name: string) {
  const init = await UsernameNFTItem.init(registryAddress, nameHash(name));
  const address = contractAddress(0, init);
  const account = await blockchain.getContract(address);
  const state = account.accountState;
  if (!state || state.type !== 'active' || !state.state.code || !state.state.code.equals(init.code)) {
    return { address, initialized: false, owner_wallet: null as Address | null };
  }
  const view = await blockchain.openContract(new UsernameNFTItem(address, init)).getGetState();
  return { address, initialized: view.initialized, owner_wallet: view.owner_wallet as Address | null };
}

describe('UsernameRegistry negative authorization matrix', () => {
  it('USERNAME-REG-AUTH-NEG-01: forged mint notification and forged item ACK cannot create a name record', async () => {
    const { blockchain, registry, attacker } = await deploySealedRegistryWithMockOfficial();
    const ownerWallet = fixtureAddress('FORGED_MINT_OWNER');
    const hash = nameHash('forged');

    await registry.send(attacker.getSender(), { value: toNano('0.15') }, {
      $$type: 'AthTransferNotificationRegistryMintUsername',
      query_id: 1n,
      amount: PRICE_6_PLUS,
      sender_key: 0n,
      payer_wallet: fixtureAddress('USERNAME_AUTH_VAULT'),
      owner_wallet: ownerWallet,
      username_len: 6n,
      username: usernameSlice('forged').asCell(),
    } as AthTransferNotificationRegistryMintUsername);
    // Gate 19180 rejects the forged notification, so no item was ever deployed for this name: the
    // account at the derived address does not exist, which is the chain's answer to "is 'forged' taken".
    expect((await readUsernameItem(blockchain, registry.address, 'forged')).initialized).toBe(false);
    expect((await registry.getGetPendingMint(hash)).exists).toBe(false);

    await registry.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'UsernameItemDeployedAck',
      name_hash: hash,
      owner_wallet: ownerWallet,
      mint_nonce: 1n,
    } as UsernameItemDeployedAck);
    // Was: name_record_count still 0 — i.e. the forged ACK finalised no mint. There is no global
    // counter any more, and the stronger claim is the one the chain answers directly: the item for
    // this name never became initialized, so the name is still unminted.
    expect((await readUsernameItem(blockchain, registry.address, 'forged')).initialized).toBe(false);
  });

  it('USERNAME-REG-AUTH-NEG-02: forged item ACK cannot finalize an existing pending mint', async () => {
    const ctx = await deploySealedRegistryWithMockOfficial();
    const ownerWallet = fixtureAddress('PENDING_OWNER');
    const hash = nameHash('stuckx');
    const itemAddress = await ctx.registry.getGetUsernameItemAddress(hash);
    await installNoAckAt(ctx.blockchain, itemAddress);

    await sendMintFromOfficialAddress(ctx.blockchain, ctx.registry, ctx.mockOfficialAddress, ownerWallet, 'stuckx', PRICE_6_PLUS, ctx.vaultAddress);
    expect((await ctx.registry.getGetPendingMint(hash)).exists).toBe(true);

    await ctx.registry.send(ctx.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'UsernameItemDeployedAck',
      name_hash: hash,
      owner_wallet: ownerWallet,
      mint_nonce: 1n,
    } as UsernameItemDeployedAck);

    expect((await ctx.registry.getGetPendingMint(hash)).exists).toBe(true);
    // And no name came into being: the derived address holds the stuck no-ACK mock, never a live item.
    expect((await readUsernameItem(ctx.blockchain, ctx.registry.address, 'stuckx')).initialized).toBe(false);
  });

  it('USERNAME-REG-AUTH-03: item ACK owner must match the pending mint owner before finalization', async () => {
    const ctx = await deploySealedRegistryWithMockOfficial();
    const mintOwner = fixtureAddress('PENDING_TRANSFER_MINT_OWNER');
    const wrongOwner = fixtureAddress('PENDING_TRANSFER_WRONG_OWNER');
    const hash = nameHash('moveme');
    const itemAddress = await ctx.registry.getGetUsernameItemAddress(hash);
    await installNoAckAt(ctx.blockchain, itemAddress);

    await sendMintFromOfficialAddress(ctx.blockchain, ctx.registry, ctx.mockOfficialAddress, mintOwner, 'moveme', PRICE_6_PLUS, ctx.vaultAddress);
    expect((await ctx.registry.getGetPendingMint(hash)).exists).toBe(true);

    await ctx.registry.send(ctx.blockchain.sender(itemAddress), { value: toNano('0.05') }, {
      $$type: 'UsernameItemDeployedAck',
      name_hash: hash,
      owner_wallet: wrongOwner,
      mint_nonce: 1n,
    } as UsernameItemDeployedAck);

    // The wrong-owner ACK is refused at gate 19136 and changes nothing: no name exists, the mint is
    // still pending, and — the claim the deleted record's minter_wallet used to carry — the owner the
    // registry is holding for this mint is still the one the payment named, never the ACK's.
    expect((await readUsernameItem(ctx.blockchain, ctx.registry.address, 'moveme')).initialized).toBe(false);
    const stillPending = await ctx.registry.getGetPendingMint(hash);
    expect(stillPending.exists).toBe(true);
    expect(stillPending.owner_wallet.equals(mintOwner)).toBe(true);
    expect(stillPending.owner_wallet.equals(wrongOwner)).toBe(false);
    // The item address is a pure function of (registry, name_hash), so the record's item_address field
    // was storing something anyone can recompute. Assert the derivation agrees instead.
    expect((await readUsernameItem(ctx.blockchain, ctx.registry.address, 'moveme')).address.equals(itemAddress)).toBe(true);

    await ctx.registry.send(ctx.blockchain.sender(itemAddress), { value: toNano('0.05') }, {
      $$type: 'UsernameItemDeployedAck',
      name_hash: hash,
      owner_wallet: mintOwner,
      mint_nonce: 1n,
    } as UsernameItemDeployedAck);

    // Was: a NameRecord appeared carrying { item_address, minter_wallet, registered_at }. Nothing
    // records a mint inside the registry any more, so finalisation is asserted by what it still does —
    // it clears the pending mint and books the price split. Both only happen on the accepted ACK path.
    //
    // The "who owns this name" half of the old assertion now belongs to the item's own owner_wallet,
    // which tracks TEP-62 transfers; it cannot be read in THIS fixture, because holding the mint
    // pending requires parking a no-ACK mock at the item address instead of a real item. It is
    // measured against a real item in tests/username-item-is-the-record.test.ts (UNI-01, UNI-03).
    // registered_at is held by nothing at all now, so it is asserted nowhere.
    expect((await ctx.registry.getGetPendingMint(hash)).exists).toBe(false);
    const afterFinalize = await ctx.registry.getGetGlobal();
    expect(afterFinalize.treasury_due_ath).toBe(HALF_PRICE);
    expect(afterFinalize.burn_due_ath).toBe(PRICE_6_PLUS - HALF_PRICE);
    expect(afterFinalize.pending_mint_count).toBe(0n);
  });

  it('RT-USER-004: resend ACK with transferred owner cannot spoof the pending mint owner', async () => {
    const ctx = await deploySealedRegistryWithMockOfficial();
    const mintOwner = fixtureAddress('RESEND_PENDING_MINT_OWNER');
    const transferredOwner = fixtureAddress('RESEND_TRANSFERRED_OWNER');
    const hash = nameHash('resendx');
    const itemAddress = await ctx.registry.getGetUsernameItemAddress(hash);
    await installNoAckAt(ctx.blockchain, itemAddress);

    await sendMintFromOfficialAddress(
      ctx.blockchain,
      ctx.registry,
      ctx.mockOfficialAddress,
      mintOwner,
      'resendx',
      PRICE_6_PLUS,
      ctx.vaultAddress,
    );
    const beforePending = await ctx.registry.getGetPendingMint(hash);
    expect(beforePending.exists).toBe(true);
    expect(beforePending.owner_wallet.equals(mintOwner)).toBe(true);

    await ctx.registry.send(ctx.blockchain.sender(itemAddress), { value: toNano('0.05') }, {
      $$type: 'UsernameItemDeployedAck',
      name_hash: hash,
      owner_wallet: transferredOwner,
      mint_nonce: 1n,
    } as UsernameItemDeployedAck);

    const afterPending = await ctx.registry.getGetPendingMint(hash);
    expect(afterPending.exists).toBe(true);
    expect(afterPending.owner_wallet.equals(mintOwner)).toBe(true);
    expect(afterPending.owner_wallet.equals(transferredOwner)).toBe(false);
    // Nothing was minted either — the spoofed ACK finalised no name.
    expect((await readUsernameItem(ctx.blockchain, ctx.registry.address, 'resendx')).initialized).toBe(false);
    expect((await ctx.registry.getGetGlobal()).pending_mint_count).toBe(1n);
  });

  it('USERNAME-REG-AUTH-NEG-03: forged treasury transfer callbacks cannot clear pending flushes', async () => {
    const ctx = await deploySealedRegistryWithMockOfficial();
    const treasuryOwner = fixtureAddress('TREASURY_OWNER');

    await sendMintFromOfficialAddress(ctx.blockchain, ctx.registry, ctx.mockOfficialAddress, treasuryOwner, 'treasy', PRICE_6_PLUS, ctx.vaultAddress);
    expect((await ctx.registry.getGetGlobal()).treasury_due_ath).toBe(HALF_PRICE);
    // This mint installs a REAL item (no no-ACK mock), so it is the one place in this file where the
    // successful case is visible. It also keeps every `.initialized === false` assertion above honest:
    // if readUsernameItem could never return true, they would all pass vacuously.
    const minted = await readUsernameItem(ctx.blockchain, ctx.registry.address, 'treasy');
    expect(minted.initialized).toBe(true);
    expect(minted.owner_wallet!.equals(treasuryOwner)).toBe(true);
    await ctx.registry.send(ctx.flusher.getSender(), { value: toNano('0.05') }, {
      $$type: 'FlushTreasuryAthDue',
      query_id: 8001n,
    } as FlushTreasuryAthDue);
    expect((await ctx.registry.getGetPendingTreasuryFlush(8001n)).exists).toBe(true);
    expect((await ctx.registry.getGetGlobal()).treasury_due_ath).toBe(0n);

    await ctx.registry.send(ctx.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHTransferAck',
      query_id: 8001n,
      amount: HALF_PRICE,
    } as ATHTransferAck);
    await ctx.registry.send(ctx.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHTransferFailed',
      query_id: 8001n,
      amount: HALF_PRICE,
    } as ATHTransferFailed);
    expect((await ctx.registry.getGetPendingTreasuryFlush(8001n)).exists).toBe(true);
    expect((await ctx.registry.getGetGlobal()).treasury_due_ath).toBe(0n);
  });

  it('USERNAME-REG-AUTH-NEG-04: forged burn callbacks cannot mutate burn due without authenticated pending flow', async () => {
    const ctx = await deploySealedRegistryWithMockOfficial();

    await ctx.registry.send(ctx.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHBurnFinalized',
      query_id: 9001n,
      amount: HALF_PRICE,
      owner_address: ctx.registry.address,
    } as ATHBurnFinalized);
    await ctx.registry.send(ctx.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHBurnFailed',
      query_id: 9001n,
      amount: HALF_PRICE,
    } as ATHBurnFailed);

    const global = await ctx.registry.getGetGlobal();
    expect(global.pending_burn_flush_count).toBe(0n);
    expect(global.burn_due_ath).toBe(0n);
  });
});
