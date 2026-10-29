import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { UsernameNFTItem } from '../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';


const ITEM_ACK_RESERVE = 5_000_000n;

const fixtureAddress = (label: string) =>
  new Address(0, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());

const nameHash = (name: string) => BigInt('0x' + beginCell()
  .storeUint(0xC5CC7CD6, 32)
  .storeBuffer(Buffer.from(name, 'ascii'))
  .endCell().hash().toString('hex'));

const usernameSlice = (name: string) => beginCell().storeBuffer(Buffer.from(name, 'ascii')).endCell().beginParse();

const initMsg = (owner: Address, name: string) => ({
  $$type: 'InitializeUsernameItem' as const,
  owner_wallet: owner,
  mint_nonce: 1n,
  username_len: BigInt(Buffer.from(name, 'ascii').length),
  username: usernameSlice(name),
});

async function liveItem(bc: Blockchain, registry: Address, name: string, owner: Address) {
  const init = await UsernameNFTItem.init(registry, nameHash(name));
  const addr = contractAddress(0, init);
  await bc.setShardAccount(addr, createShardAccount({
    address: addr, code: init.code, data: init.data, balance: toNano('1'), workchain: 0,
  }));
  return { item: bc.openContract(new UsernameNFTItem(addr, init)), addr };
}

describe('THE ITEM IS THE RECORD — what name_records duplicates', () => {
  it('UNI-01: a second mint of a live name is refused BY THE ITEM, in COMPUTE, and it bounces', async () => {
    const bc = await Blockchain.create();
    bc.now = 1_790_000_000;
    const registry = fixtureAddress('UNI_REGISTRY');
    const first = fixtureAddress('UNI_FIRST_OWNER');
    const second = fixtureAddress('UNI_SECOND_OWNER');

    const { item, addr } = await liveItem(bc, registry, 'taken', first);
    await item.send(bc.sender(registry), { value: ITEM_ACK_RESERVE }, initMsg(first, 'taken') as any);
    expect((await item.getGetState()).initialized, 'the name is now live').toBe(true);

    const init = await UsernameNFTItem.init(registry, nameHash('taken'));
    const r = await bc.sendMessage({
      info: {
        type: 'internal', ihrDisabled: true, bounce: true, bounced: false,
        src: registry, dest: addr, value: { coins: toNano('0.05') },
        ihrFee: 0n, forwardFee: 0n, createdLt: 0n, createdAt: 0,
      },
      init: { code: init.code, data: init.data },
      body: beginCell()
        .storeUint(0x554E494E, 32)
        .storeAddress(second)
        .storeUint(2, 64)
        .storeUint(5, 8)
        .storeSlice(usernameSlice('taken'))
        .endCell(),
    } as any);

    const itemTx = (r.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(addr) && !t.inMessage?.info?.bounced);
    expect(itemTx?.description?.computePhase?.exitCode, 'the item refuses re-initialisation at gate 18011').toBe(18011);
    expect((r.transactions as any[]).some((t) => t.inMessage?.info?.bounced === true),
      'and it BOUNCES — which is what pays the second buyer back').toBe(true);

    const st = await item.getGetState();
    expect(st.owner_wallet.equals(first), 'the first owner is untouched').toBe(true);
  }, 120_000);

  it('UNI-02: the item address is a pure function of (registry, name) — nothing needs to index it', async () => {
    const bc = await Blockchain.create();
    const registry = fixtureAddress('UNI_REGISTRY');
    const a = contractAddress(0, await UsernameNFTItem.init(registry, nameHash('alice')));
    const b = contractAddress(0, await UsernameNFTItem.init(registry, nameHash('alice')));
    const c = contractAddress(0, await UsernameNFTItem.init(registry, nameHash('bob')));
    expect(a.equals(b), 'deterministic').toBe(true);
    expect(a.equals(c), 'and distinct per name').toBe(false);

    expect((await bc.getContract(a)).accountState?.type, 'an unminted name has no account').not.toBe('active');
  }, 120_000);

  it('UNI-03: name_records CANNOT answer "who owns this name" — a transfer moves the item, not the record', async () => {
    const bc = await Blockchain.create();
    bc.now = 1_790_000_000;
    const registry = fixtureAddress('UNI_REGISTRY');
    const minter = await bc.treasury('uni-minter');
    const buyer = fixtureAddress('UNI_BUYER');

    const { item } = await liveItem(bc, registry, 'movable', minter.address);
    await item.send(bc.sender(registry), { value: ITEM_ACK_RESERVE }, initMsg(minter.address, 'movable') as any);
    expect((await item.getGetState()).owner_wallet.equals(minter.address)).toBe(true);

    const transferPayload = beginCell()
      .storeAddress(buyer)
      .storeAddress(minter.address)
      .storeMaybeRef(null)
      .storeCoins(0n)
      .storeSlice(beginCell().endCell().beginParse())
      .endCell().beginParse();
    await item.send(minter.getSender(), { value: toNano('0.2') }, {
      $$type: 'NftTransfer', query_id: 1n, payload: transferPayload,
    } as any);

    const after = await item.getGetState();
    expect(after.owner_wallet.equals(buyer), 'the ITEM knows the new owner').toBe(true);
  }, 120_000);
});
