import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  UsernameNFTItem,
  InitializeUsernameItem,
  NftTransfer,
  loadUsernameOwnershipProof,
} from '../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';
import {
  MockUsernameRegistryAckSink,
} from '../build/MockUsernameRegistryAckSink/MockUsernameRegistryAckSink_MockUsernameRegistryAckSink';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// USERNAME-OWNERSHIP-PROOF — the half of cross-generation migration that cannot be added later.
//
// A redeploy gives the next registry an empty name map, so every name bought here would look free there. The
// owner would keep the NFT and lose the name in the system that is actually live. Fixing that afterwards is
// impossible: once minted, this item is immutable forever, so a registry that does not exist yet can only
// learn who owns a name if the item can state it itself. That is what this receiver is for, and why it has to
// ship in this generation rather than the one that consumes it.
//
// The design point that makes it safe is what it does NOT do: the item is never transferred. TEP-62's only
// authenticated outbound message is ownership-assigned on transfer, so a transfer-based proof would force the
// claimant to hand over the item first — and if the name were already taken on the other side, they would end
// up with neither the item nor the name, irreversibly. Proving instead of transferring makes a failed claim
// cost nothing and repeatable.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const ITEM_ACK_RESEND_RESERVE = 4_000_000n;
const PROOF_FORWARD_RESERVE = 5_000_000n;
const PROOF_EXEC_RESERVE = 1_000_000n;
const PROOF_MIN_VALUE = PROOF_FORWARD_RESERVE + PROOF_EXEC_RESERVE;
const PROOF_MAX_VALUE = 20_000_000n;

const fixtureAddress = (label: string, workchain = 0) =>
  new Address(workchain, createHash('sha256').update(`PLATHO.V1.PROOF.${label}`).digest());

const nameHash = (name: string) => BigInt('0x' + beginCell()
  .storeUint(0xC5CC7CD6, 32).storeBuffer(Buffer.from(name, 'ascii')).endCell().hash().toString('hex'));

const usernameSlice = (name: string) =>
  beginCell().storeBuffer(Buffer.from(name, 'ascii')).endCell().beginParse();

async function deployItem(name = 'platho') {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_790_000_000;
  const stranger = await blockchain.treasury('proof-stranger');
  const ownerWallet = fixtureAddress('OWNER_WALLET');

  const registryInit = await MockUsernameRegistryAckSink.init(fixtureAddress('REGISTRY_INITIAL_OWNER'));
  const registryAddress = contractAddress(0, registryInit);
  await blockchain.setShardAccount(registryAddress, createShardAccount({
    address: registryAddress, code: registryInit.code, data: registryInit.data,
    balance: toNano('1'), workchain: registryAddress.workChain,
  }));

  const usernameHash = nameHash(name);
  const itemInit = await UsernameNFTItem.init(registryAddress, usernameHash);
  const itemAddress = contractAddress(0, itemInit);
  await blockchain.setShardAccount(itemAddress, createShardAccount({
    address: itemAddress, code: itemInit.code, data: itemInit.data,
    balance: toNano('1'), workchain: itemAddress.workChain,
  }));
  const item = blockchain.openContract(new UsernameNFTItem(itemAddress, itemInit));
  await item.send(blockchain.sender(registryAddress), { value: ITEM_ACK_RESEND_RESERVE }, {
    $$type: 'InitializeUsernameItem',
    owner_wallet: ownerWallet,
    username_len: BigInt(Buffer.from(name, 'ascii').length),
    username: usernameSlice(name),
  } as InitializeUsernameItem);

  return { blockchain, stranger, ownerWallet, registryAddress, item, itemAddress, usernameHash };
}

const exitOf = (res: any, to: Address) => Number(res.transactions.find(
  (t: any) => t.inMessage?.info?.dest?.toString() === to.toString(),
)?.description?.computePhase?.exitCode ?? -999);

/** The proof message the item emitted, decoded with the generated loader. */
function proofFrom(res: any, itemAddress: Address, to: Address) {
  const tx = res.transactions.find((t: any) =>
    t.inMessage?.info?.dest?.toString() === to.toString()
    && t.inMessage?.info?.src?.toString() === itemAddress.toString());
  if (!tx) return null;
  return loadUsernameOwnershipProof(tx.inMessage.body.beginParse());
}

describe('USERNAME-OWNERSHIP-PROOF — an item can state who owns it, without being given up', () => {
  it('PROOF-01: the proof carries name_hash, owner and the username bytes, and comes FROM the item', async () => {
    const { blockchain, stranger, ownerWallet, item, itemAddress, usernameHash } = await deployItem('platho');
    const consumer = fixtureAddress('NEXT_GENERATION_REGISTRY');

    const res = await item.send(stranger.getSender(), { value: PROOF_MIN_VALUE }, {
      $$type: 'ProveUsernameOwnership', query_id: 77n, to: consumer,
    } as any);
    expect(exitOf(res, itemAddress), 'the item accepted the request').toBe(0);

    const proof = proofFrom(res, itemAddress, consumer);
    expect(proof, 'a proof reached the consumer').not.toBeNull();
    expect(proof!.query_id).toBe(77n);
    expect(proof!.name_hash, 'the name it is about').toBe(usernameHash);
    expect(proof!.owner_wallet.toString(), 'who owns it').toBe(ownerWallet.toString());
    // name_hash is not reversible, so the bytes must travel with it or the next registry cannot recreate
    // the name or initialise a new item for it.
    expect(Number(proof!.username_len)).toBe(6);
    expect(proof!.username.loadBuffer(6).toString('ascii')).toBe('platho');
  }, 120_000);

  it('PROOF-02: the sender is authenticated by ADDRESS, which is what makes the proof unforgeable', async () => {
    // The consuming registry will derive contractAddress(0, initOf UsernameNFTItem(registry, name_hash)) and
    // require sender() to equal it. Nothing else about the message is trusted, so this is the whole security
    // argument: an impostor cannot occupy that address without the registry's own item code and name hash.
    const { blockchain, stranger, item, itemAddress, usernameHash, registryAddress } = await deployItem('platho');
    const consumer = fixtureAddress('NEXT_GENERATION_REGISTRY');

    const res = await item.send(stranger.getSender(), { value: PROOF_MIN_VALUE }, {
      $$type: 'ProveUsernameOwnership', query_id: 1n, to: consumer,
    } as any);

    const derived = contractAddress(0, await UsernameNFTItem.init(registryAddress, usernameHash));
    expect(derived.toString(), 'derivable from (registry, name_hash) alone').toBe(itemAddress.toString());
    const tx = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === consumer.toString());
    expect(tx.inMessage.info.src.toString(), 'the proof is sent from that exact address').toBe(derived.toString());

    // and a different name derives a different address, so one item cannot vouch for another name
    const other = contractAddress(0, await UsernameNFTItem.init(registryAddress, nameHash('someone')));
    expect(other.toString()).not.toBe(derived.toString());
  }, 120_000);

  it('PROOF-03: permissionless, and it always names the CURRENT owner — never the sender', async () => {
    // Permissionless on purpose: it states facts get_nft_data already exposes, it lets a third party migrate
    // names for people who have gone quiet, and it cannot be used to move a name.
    const { blockchain, stranger, ownerWallet, item, itemAddress } = await deployItem('platho');
    const consumer = fixtureAddress('NEXT_GENERATION_REGISTRY');
    const attacker = await blockchain.treasury('proof-attacker');

    const res = await item.send(attacker.getSender(), { value: PROOF_MIN_VALUE }, {
      $$type: 'ProveUsernameOwnership', query_id: 5n, to: consumer,
    } as any);
    expect(exitOf(res, itemAddress), 'a stranger may trigger it').toBe(0);
    const proof = proofFrom(res, itemAddress, consumer)!;
    expect(proof.owner_wallet.toString(), 'the attacker did not become the owner').toBe(ownerWallet.toString());
    expect(proof.owner_wallet.toString()).not.toBe(attacker.address.toString());
  }, 120_000);

  it('PROOF-04: after a transfer the proof follows the new owner', async () => {
    // A migration snapshot must not freeze a stale owner: whoever holds the item when the proof is made is the
    // one the next generation should credit.
    const { blockchain, stranger, ownerWallet, item, itemAddress } = await deployItem('platho');
    const consumer = fixtureAddress('NEXT_GENERATION_REGISTRY');
    const buyer = fixtureAddress('BUYER_WALLET');

    await item.send(blockchain.sender(ownerWallet), { value: toNano('0.1') }, {
      $$type: 'NftTransfer',
      query_id: 9n,
      payload: beginCell()
        .storeAddress(buyer)          // new_owner
        .storeUint(0, 2)              // response_destination: addr_none
        .storeBit(false)              // custom_payload: none
        .storeCoins(1)                // forward_amount
        .storeBit(false)              // forward_payload: empty, inline
        .endCell().beginParse(),
    } as NftTransfer);

    const res = await item.send(stranger.getSender(), { value: PROOF_MIN_VALUE }, {
      $$type: 'ProveUsernameOwnership', query_id: 10n, to: consumer,
    } as any);
    const proof = proofFrom(res, itemAddress, consumer)!;
    expect(proof.owner_wallet.toString(), 'the proof tracks ownership').toBe(buyer.toString());
  }, 120_000);

  it('PROOF-05: the value budget is enforced, so the item is not a relay and never pays from its endowment', async () => {
    const { blockchain, stranger, item, itemAddress } = await deployItem('platho');
    const consumer = fixtureAddress('NEXT_GENERATION_REGISTRY');
    const prove = (value: bigint, to: Address = consumer) => item.send(stranger.getSender(), { value }, {
      $$type: 'ProveUsernameOwnership', query_id: 1n, to,
    } as any);

    expect(exitOf(await prove(PROOF_MIN_VALUE - 1n), itemAddress), 'underfunded -> 18042').toBe(18042);
    // Without a ceiling the item would forward to a caller-chosen address, i.e. act as a value relay.
    expect(exitOf(await prove(PROOF_MAX_VALUE + 1n), itemAddress), 'over the relay cap -> 18043').toBe(18043);
    expect(exitOf(await prove(PROOF_MIN_VALUE, new Address(-1, Buffer.alloc(32, 7))), itemAddress),
      'masterchain destination -> 18041').toBe(18041);

    // The endowment funds ~200 years of storage; a proof must never eat into it, however many are made.
    const before = (await blockchain.getContract(itemAddress)).balance;
    for (let i = 0; i < 5; i += 1) await prove(PROOF_MIN_VALUE);
    const after = (await blockchain.getContract(itemAddress)).balance;
    expect(after >= before, `balance must not fall: ${before} -> ${after}`).toBe(true);
  }, 180_000);

  it('PROOF-06: an uninitialised item proves nothing', async () => {
    // A name that was never minted has no owner to state, and the derived address exists only as a shell.
    const blockchain = await Blockchain.create();
    blockchain.now = 1_790_000_000;
    const stranger = await blockchain.treasury('proof-uninit');
    const registryAddress = fixtureAddress('SOME_REGISTRY');
    const init = await UsernameNFTItem.init(registryAddress, nameHash('neverminted'));
    const addr = contractAddress(0, init);
    await blockchain.setShardAccount(addr, createShardAccount({
      address: addr, code: init.code, data: init.data, balance: toNano('1'), workchain: 0,
    }));
    const item = blockchain.openContract(new UsernameNFTItem(addr, init));

    const res = await item.send(stranger.getSender(), { value: PROOF_MIN_VALUE }, {
      $$type: 'ProveUsernameOwnership', query_id: 1n, to: fixtureAddress('NEXT_GENERATION_REGISTRY'),
    } as any);
    expect(exitOf(res, addr), 'uninitialised -> 18040').toBe(18040);
  }, 120_000);
});
