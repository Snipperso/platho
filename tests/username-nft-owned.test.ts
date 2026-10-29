import { readFileSync } from 'node:fs';
import { Address, Cell } from '@ton/core';
import { describe, expect, it } from 'vitest';
import { serializeBoc } from '../web/pwa-contract-transactions.mjs';
import {
  USERNAME_ITEM_EXCESSES_MIN_VALUE_NANOTONS,
  USERNAME_ITEM_TRANSFER_EXEC_RESERVE_NANOTONS,
  USERNAME_ITEM_TRANSFER_FWD_FEE_ALLOWANCE_NANOTONS,
  USERNAME_NFT_TRANSFER_OPCODE,
  USERNAME_NFT_TRANSFER_VALUE_NANOTONS,
  buildUsernameNftTransferBody,
} from '../web/username-nft-transfer.mjs';
import {
  collectOwnedUsernameNfts,
  discoverUsernameNftAddresses,
  normalizeUsernameLabel,
} from '../web/username-nft-owned.mjs';
import { computeUsernameNameHash } from '../web/username-ton-rpc-provider.mjs';


const OWNER = '0:' + '11'.repeat(32);
const OTHER = '0:' + '22'.repeat(32);
const ITEM_A = '0:' + 'aa'.repeat(32);
const ITEM_B = '0:' + 'bb'.repeat(32);

const bodySlice = (body: ReturnType<typeof buildUsernameNftTransferBody>) =>
  Cell.fromBoc(Buffer.from(serializeBoc(body)))[0].beginParse();

describe('username NFT — transfer body', () => {
  it('UNFT-01: the layout is the one UsernameNFTItem parses by hand', () => {
    const body = buildUsernameNftTransferBody({ queryId: 7n, newOwner: OTHER, responseDestination: OWNER });
    const slice = bodySlice(body);
    expect(BigInt(slice.loadUint(32))).toBe(USERNAME_NFT_TRANSFER_OPCODE);
    expect(slice.loadUintBig(64)).toBe(7n);
    expect(slice.loadAddress().toRawString()).toBe(OTHER);
    expect(slice.loadAddress().toRawString()).toBe(OWNER);
    expect(slice.loadBit()).toBe(false);
    expect(slice.loadCoins()).toBe(0n);
    expect(slice.loadBit()).toBe(false);
    expect(slice.remainingBits).toBe(0);
    expect(slice.remainingRefs).toBe(0);
  });

  it('UNFT-02: no response destination is addr_none, which is what the item preloads to decide', () => {
    const slice = bodySlice(buildUsernameNftTransferBody({ queryId: 1n, newOwner: OTHER, responseDestination: null }));
    slice.loadUint(32);
    slice.loadUintBig(64);
    slice.loadAddress();
    expect(slice.preloadUint(2)).toBe(0);
    expect(slice.loadMaybeAddress()).toBeNull();
    expect(slice.loadBit()).toBe(false);
    expect(slice.loadCoins()).toBe(0n);
  });

  it('UNFT-03: a non-basechain recipient is refused here, not by a bounce', () => {
    expect(() => buildUsernameNftTransferBody({ queryId: 1n, newOwner: '-1:' + '33'.repeat(32), responseDestination: OWNER }))
      .toThrow(/basechain/);
  });

  it('UNFT-04: the mirrored budget constants are the contract\'s own, and the value clears them', () => {
    const item = readFileSync('contracts/UsernameNFTItem.tact', 'utf8');
    expect(item).toContain(`const USERNAME_ITEM_TRANSFER_EXEC_RESERVE: Int = ${USERNAME_ITEM_TRANSFER_EXEC_RESERVE_NANOTONS};`);
    expect(item).toContain(`const USERNAME_ITEM_TRANSFER_FWD_FEE_ALLOWANCE: Int = ${USERNAME_ITEM_TRANSFER_FWD_FEE_ALLOWANCE_NANOTONS};`);
    expect(item).toContain(`const USERNAME_ITEM_EXCESSES_MIN_VALUE: Int = ${USERNAME_ITEM_EXCESSES_MIN_VALUE_NANOTONS};`);
    const floor = USERNAME_ITEM_TRANSFER_EXEC_RESERVE_NANOTONS + USERNAME_ITEM_TRANSFER_FWD_FEE_ALLOWANCE_NANOTONS;
    expect(USERNAME_NFT_TRANSFER_VALUE_NANOTONS).toBeGreaterThan(floor + USERNAME_ITEM_EXCESSES_MIN_VALUE_NANOTONS);
    expect(item).toMatch(/restAmount: Int = context\(\)\.value - USERNAME_ITEM_TRANSFER_EXEC_RESERVE - forwardAmount - fwdFeeAllowance/);
    expect(item).toMatch(/throwUnless\(18035, restAmount >= 0\)/);
  });
});

describe('username NFT — the owned list', () => {
  const authoritative = (nameHash: bigint, owner: string) => ({
    authoritative: true, owner_wallet: owner, name_hash: nameHash, item_state: { tier: 1, username_len: 6 },
  });

  it('UNFT-05: the indexer only ever proposes an address, and a bad answer costs at most a read', async () => {
    const response = {
      ok: true,
      json: async () => ({
        nft_items: [
          { address: Address.parse(ITEM_A).toString(), metadata: { name: 'Platho.ATH' } },
          { address: Address.parse(ITEM_A).toString(), metadata: { name: 'duplicate' } },
          { address: 'not-an-address', metadata: { name: 'garbage' } },
          { metadata: { name: 'no address at all' } },
        ],
      }),
    };
    const found = await discoverUsernameNftAddresses({
      ownerWallet: OWNER, collectionAddress: OTHER, fetchImpl: async () => response as never,
    });
    expect(found).toHaveLength(1);
    expect(found[0].itemAddress).toBe(ITEM_A);
    expect(found[0].proposedName).toBe('platho');
  });

  it('UNFT-06: an item is listed only when the CHAIN says it is authoritative and ours', async () => {
    const hash = await computeUsernameNameHash('platho');
    const verdicts: Record<string, unknown> = {
      [ITEM_A]: authoritative(hash, OWNER),
      [ITEM_B]: authoritative(hash, OTHER),
    };
    const result = await collectOwnedUsernameNfts({
      ownerWallet: OWNER,
      candidateAddresses: [{ itemAddress: ITEM_A, label: 'platho' }, { itemAddress: ITEM_B, label: 'other' }],
      indexerAddresses: [],
      verifyItem: async (address: string) => verdicts[address],
    });
    expect(result.owned.map((n) => n.itemAddress)).toEqual([ITEM_A]);

    const impostor = await collectOwnedUsernameNfts({
      ownerWallet: OWNER,
      candidateAddresses: [{ itemAddress: ITEM_A, label: 'platho' }],
      indexerAddresses: [],
      verifyItem: async () => ({ authoritative: false, owner_wallet: OWNER, name_hash: hash }),
    });
    expect(impostor.owned).toEqual([]);
  });

  it('UNFT-07: a proposed name is shown only when its hash reproduces the item\'s name_hash', async () => {
    const hash = await computeUsernameNameHash('platho');
    const collect = (proposed: string) => collectOwnedUsernameNfts({
      ownerWallet: OWNER,
      candidateAddresses: [],
      indexerAddresses: [{ itemAddress: ITEM_A, proposedName: proposed }],
      verifyItem: async () => authoritative(hash, OWNER),
    });
    expect((await collect('platho')).owned[0].label).toBe('platho');
    const lied = await collect('not-my-name');
    expect(lied.owned).toHaveLength(1);
    expect(lied.owned[0].label).toBeNull();
  });

  it('UNFT-08: the local floor is a FLOOR — the indexer adds, never removes, and its silence is reported', async () => {
    const hash = await computeUsernameNameHash('platho');
    const verify = async () => authoritative(hash, OWNER);

    const degraded = await collectOwnedUsernameNfts({
      ownerWallet: OWNER,
      candidateAddresses: [{ itemAddress: ITEM_A, label: 'platho' }],
      indexerAddresses: null,
      indexerError: new Error('indexer unreachable'),
      verifyItem: verify,
    });
    expect(degraded.owned).toHaveLength(1);
    expect(degraded.complete).toBe(false);

    const contradicted = await collectOwnedUsernameNfts({
      ownerWallet: OWNER,
      candidateAddresses: [{ itemAddress: ITEM_A, label: 'platho' }],
      indexerAddresses: [],
      verifyItem: verify,
    });
    expect(contradicted.owned).toHaveLength(1);
    expect(contradicted.complete).toBe(true);

    const both = await collectOwnedUsernameNfts({
      ownerWallet: OWNER,
      candidateAddresses: [{ itemAddress: ITEM_A, label: 'platho' }],
      indexerAddresses: [{ itemAddress: ITEM_A, proposedName: 'something-else' }],
      verifyItem: verify,
    });
    expect(both.owned).toHaveLength(1);
    expect(both.owned[0].label).toBe('platho');
  });

  it('UNFT-09: a read that failed leaves the name out rather than denying it', async () => {
    const hash = await computeUsernameNameHash('platho');
    const result = await collectOwnedUsernameNfts({
      ownerWallet: OWNER,
      candidateAddresses: [{ itemAddress: ITEM_A, label: 'platho' }, { itemAddress: ITEM_B, label: 'second' }],
      indexerAddresses: [],
      verifyItem: async (address: string) => {
        if (address === ITEM_A) throw new Error('rpc down');
        return authoritative(hash, OWNER);
      },
    });
    expect(result.owned.map((n) => n.itemAddress)).toEqual([ITEM_B]);
    expect(result.complete, 'a failed verification leaves the list incomplete').toBe(false);
    expect(result.unverified).toBe(1);
  });

  it('UNFT-10: the label normaliser does NOT carry a second copy of the charset rule', () => {
    expect(normalizeUsernameLabel(' Platho.ATH ')).toBe('platho');
    expect(normalizeUsernameLabel('ЛЮБОЕ')).toBe('любое');
    const source = readFileSync('web/username-nft-owned.mjs', 'utf8');
    const fn = source.slice(source.indexOf('export function normalizeUsernameLabel'), source.indexOf('async function nameHashOrNull'));
    expect(fn, 'the charset rule belongs to normalizeUsername alone').not.toMatch(/a-z0-9/);
  });

  it('UNFT-11: a name is reported TRANSFERRED only on proof — authoritative, another owner, the label proven by hash', async () => {
    const hash = await computeUsernameNameHash('platho');
    const second = await computeUsernameNameHash('second');
    const result = await collectOwnedUsernameNfts({
      ownerWallet: OWNER,
      candidateAddresses: [
        { itemAddress: ITEM_A, label: 'platho' },
        { itemAddress: ITEM_B, label: 'second' },
      ],
      indexerAddresses: [],
      verifyItem: async (address: string) => (address === ITEM_A ? authoritative(hash, OTHER) : authoritative(second, OWNER)),
    });
    expect(result.owned.map((n) => n.label)).toEqual(['second']);
    expect(result.transferred.map((n) => n.label), 'the given-away name is named as transferred').toEqual(['platho']);
    expect(result.complete).toBe(true);
    const weak = await collectOwnedUsernameNfts({
      ownerWallet: OWNER,
      candidateAddresses: [{ itemAddress: ITEM_A, label: 'platho' }, { itemAddress: ITEM_B, label: 'second' }],
      indexerAddresses: [],
      verifyItem: async (address: string) => (address === ITEM_A
        ? { authoritative: false, reason: 'item_not_initialized', owner_wallet: null, name_hash: null }
        : authoritative(hash, OTHER)),
    });
    expect(weak.owned).toEqual([]);
    expect(weak.transferred, 'nothing proven transferred').toEqual([]);
    expect(weak.complete, 'and nothing here made the list incomplete either — it is simply not an answer about those names').toBe(true);
  });
});
