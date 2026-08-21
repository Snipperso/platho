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

// Moving a .ath name from inside Platho. Two things here are worth a gate rather than a reading:
//
//   THE BODY. UsernameNFTItem parses the transfer payload BY HAND as a raw slice, so a field of the wrong width or
//   in the wrong order is not a type error anywhere — it is a transfer that assigns the name to whatever the item
//   reads out of the misaligned bits. The layout is pinned against that receiver field by field.
//
//   THE LIST. "Which names do you own" has no on-chain answer (unordered collection, zero per-name state), so it is
//   assembled from a local floor plus an INDEXER, and the indexer is untrusted input. What must hold no matter what
//   it answers: it can only ever ADD a name the chain confirms, never remove one, and a name it proposes is
//   displayed only when hashing it reproduces the name_hash the item itself carries.

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
    expect(slice.loadAddress().toRawString()).toBe(OWNER);   // response_destination
    expect(slice.loadBit()).toBe(false);                      // custom_payload: Maybe ^Cell
    expect(slice.loadCoins()).toBe(0n);                       // forward_amount — see the module header
    expect(slice.loadBit()).toBe(false);                      // forward_payload: Either, inline and empty
    expect(slice.remainingBits).toBe(0);
    expect(slice.remainingRefs).toBe(0);
  });

  it('UNFT-02: no response destination is addr_none, which is what the item preloads to decide', () => {
    // The item reads `body.preloadUint(2) != 0` to tell "send me the change" from "do not". addr_none is two ZERO
    // bits and addr_std's tag is 0b10, so this single field is the one that must not always be an address.
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
    // Gate 18035 with forward_amount = 0, plus enough left over that the change actually comes BACK rather than
    // settling into the item's balance. Trimming this to the floor is what starts bouncing when fees rise.
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
      [ITEM_B]: authoritative(hash, OTHER),            // somebody else's
    };
    const result = await collectOwnedUsernameNfts({
      ownerWallet: OWNER,
      candidateAddresses: [{ itemAddress: ITEM_A, label: 'platho' }, { itemAddress: ITEM_B, label: 'other' }],
      indexerAddresses: [],
      verifyItem: async (address: string) => verdicts[address],
    });
    expect(result.owned.map((n) => n.itemAddress)).toEqual([ITEM_A]);

    // Non-authoritative is dropped just as hard: an impostor at a plausible address is exactly what the derivation
    // check exists for, and it must never reach a list the user reads as "your property".
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
    // A wrong name fails ARITHMETIC rather than being trusted — the item is still listed (the chain says it is
    // ours), it simply refuses to carry a name nobody could prove.
    const lied = await collect('not-my-name');
    expect(lied.owned).toHaveLength(1);
    expect(lied.owned[0].label).toBeNull();
  });

  it('UNFT-08: the local floor is a FLOOR — the indexer adds, never removes, and its silence is reported', async () => {
    const hash = await computeUsernameNameHash('platho');
    const verify = async () => authoritative(hash, OWNER);

    // Indexer down: the known name still shows, and `complete` says the list may be short. An empty list rendered as
    // "you own nothing" is the failure this whole shape exists to prevent.
    const degraded = await collectOwnedUsernameNfts({
      ownerWallet: OWNER,
      candidateAddresses: [{ itemAddress: ITEM_A, label: 'platho' }],
      indexerAddresses: null,
      indexerError: new Error('indexer unreachable'),
      verifyItem: verify,
    });
    expect(degraded.owned).toHaveLength(1);
    expect(degraded.complete).toBe(false);

    // Indexer answers EMPTY while we hold a name: it must not be able to delete it.
    const contradicted = await collectOwnedUsernameNfts({
      ownerWallet: OWNER,
      candidateAddresses: [{ itemAddress: ITEM_A, label: 'platho' }],
      indexerAddresses: [],
      verifyItem: verify,
    });
    expect(contradicted.owned).toHaveLength(1);
    expect(contradicted.complete).toBe(true);

    // And a local label is not displaced by a proposal for the same item.
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
    // And the list says it is SHORT: a caller that reconciles the device's remembered names against a complete list
    // must not be handed a "complete" one with a read missing from it — it would forget a name the user still owns.
    expect(result.complete, 'a failed verification leaves the list incomplete').toBe(false);
    expect(result.unverified).toBe(1);
  });

  it('UNFT-10: the label normaliser does NOT carry a second copy of the charset rule', () => {
    // The rule for what a legal name is lives in normalizeUsername, inside the hash function. A copy here would go
    // stale the day the registry's charset moves and would silently reject names the chain accepts.
    expect(normalizeUsernameLabel(' Platho.ATH ')).toBe('platho');
    expect(normalizeUsernameLabel('ЛЮБОЕ')).toBe('любое');
    const source = readFileSync('web/username-nft-owned.mjs', 'utf8');
    const fn = source.slice(source.indexOf('export function normalizeUsernameLabel'), source.indexOf('async function nameHashOrNull'));
    expect(fn, 'the charset rule belongs to normalizeUsername alone').not.toMatch(/a-z0-9/);
  });
});
