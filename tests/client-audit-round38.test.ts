import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import {
  TELEGRAM_GIFT_COLLECTION_CODE_HASH,
  TELEGRAM_GIFT_DISCOVERY_LIMIT,
  collectOwnedTelegramGifts,
  discoverTelegramGiftItems,
} from '../web/telegram-gift-nfts.mjs';
import { readJettonBalances } from '../web/wallet-assets.mjs';


const app = readFileSync('web/app.js', 'utf8');
const rpc = readFileSync('web/shard-rpc.mjs', 'utf8');
const transport = readFileSync('web/ton-rpc-transport.mjs', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const OWNER = `0:${'11'.repeat(32)}`;
const DUROVS_CAPS = '0:fd8a466aeb13e02a3ce67411b41b44bcd11bd42636f0807acf6570ca73fc2c13';
const DUROVS_CAPS_DATA_BOC =
  'te6ccgEBBQEArwAESYAAABLfHQ3koaSxignNG3FVwvqf99rxlgTH82d8KEprZvXkTEABAgMEAGYBaHR0cHM6Ly9uZnQu'
  + 'ZnJhZ21lbnQuY29tL2NvbGxlY3Rpb24vZHVyb3ZzY2FwLmpzb24IQgKR2eKsFp/Hhc4A3gqBrydiK5t9F2RBXHdeflDA'
  + 'POmKogAEAQAASwAFAGSADR50Dtpoo0MfqDwLjjaYBAqLqNZOrgycywS72hiTfgWQ';
const GENUINE_ITEM = `0:${'aa'.repeat(32)}`;
const addr = (n: number) => `0:${n.toString(16).padStart(64, '0')}`;

const harness = () => {
  const reads = { items: 0, collections: 0 };
  const genuine = new Map<string, bigint>([[GENUINE_ITEM, 37n]]);
  return {
    reads,
    genuine,
    verifyItem: async (address: string) => {
      reads.items += 1;
      const index = genuine.get(address);
      if (index !== undefined) return { index, collectionAddress: DUROVS_CAPS, ownerWallet: OWNER, contentUri: `https://nft.fragment.com/gift/durovscap-${index}.json` };
      return { index: 1n, collectionAddress: addr(0x10), ownerWallet: OWNER, contentUri: 'https://nft.fragment.com/gift/durovscap-1.json' };
    },
    verifyCollection: async (address: string) => {
      reads.collections += 1;
      return address === DUROVS_CAPS
        ? { codeHash: TELEGRAM_GIFT_COLLECTION_CODE_HASH, dataBoc: DUROVS_CAPS_DATA_BOC, contentUri: 'https://nft.fragment.com/collection/durovscap.json' }
        : { codeHash: 'not-the-anchor', dataBoc: null, contentUri: '' };
    },
    verifyMembership: async (_collection: string, index: bigint) => [...genuine].find(([, i]) => i === index)?.[0] ?? '',
  };
};

describe('client audit round 38', () => {
  it('R38-01 (F1-1, F3-1, F5-1, F6-1): a hundred gift-shaped items of a stranger\'s collection cost one read — the genuine gift behind them is proven', async () => {
    const h = harness();
    const junk = Array.from({ length: 150 }, (_unused, i) => ({ itemAddress: addr(0x1000 + i), collectionAddress: addr(0x10) }));
    const result = await collectOwnedTelegramGifts({ ownerWallet: OWNER, indexerItems: [...junk, { itemAddress: GENUINE_ITEM, collectionAddress: DUROVS_CAPS }],
      verifyItem: h.verifyItem, verifyCollection: h.verifyCollection, verifyMembership: h.verifyMembership });
    expect(result.gifts.map((gift: any) => gift.itemAddress)).toEqual([GENUINE_ITEM]);
    expect(result.complete).toBe(true);
    expect(h.reads, 'one read per collection, an item read only for the gift collection\'s item').toEqual({ items: 1, collections: 2 });
  });

  it('R38-02: what the caps leave out makes the list incomplete — never "no gifts on this wallet"', async () => {
    const h = harness();
    const spread = Array.from({ length: 120 }, (_unused, i) => ({ itemAddress: addr(0x2000 + i), collectionAddress: addr(0x3000 + i) }));
    const cut = await collectOwnedTelegramGifts({ ownerWallet: OWNER, indexerItems: [...spread, { itemAddress: GENUINE_ITEM, collectionAddress: DUROVS_CAPS }],
      verifyItem: h.verifyItem, verifyCollection: h.verifyCollection, verifyMembership: h.verifyMembership });
    expect(cut.complete, 'a cut list').toBe(false);
    expect(h.reads.collections, 'collection reads capped').toBeLessThanOrEqual(TELEGRAM_GIFT_DISCOVERY_LIMIT);
    const g = harness();
    g.genuine.clear();
    const many = Array.from({ length: 150 }, (_unused, i) => { const item = addr(0x5000 + i); g.genuine.set(item, BigInt(1000 + i)); return { itemAddress: item, collectionAddress: DUROVS_CAPS }; });
    const big = await collectOwnedTelegramGifts({ ownerWallet: OWNER, indexerItems: many, verifyItem: g.verifyItem, verifyCollection: g.verifyCollection, verifyMembership: g.verifyMembership });
    expect([big.gifts.length, big.complete, g.reads.items]).toEqual([TELEGRAM_GIFT_DISCOVERY_LIMIT, false, TELEGRAM_GIFT_DISCOVERY_LIMIT]);
  });

  it('R38-03: a profile\'s worn-gift claim (an address alone, no named collection) is proven as before', async () => {
    const h = harness();
    const claim = await collectOwnedTelegramGifts({ ownerWallet: OWNER, indexerItems: [GENUINE_ITEM], verifyItem: h.verifyItem, verifyCollection: h.verifyCollection, verifyMembership: h.verifyMembership });
    expect([claim.gifts.length, claim.complete, h.reads.items]).toEqual([1, true, 1]);
  });

  it('R38-04: the discovery proposes every gift-shaped row of its page, and asks for it uncached', async () => {
    const inits: any[] = [];
    const rows = Array.from({ length: 300 }, (_unused, i) => ({ address: addr(0x7000 + i), collection_address: DUROVS_CAPS, content: { uri: `https://nft.fragment.com/gift/durovscap-${i + 1}.json` } }));
    const proposed = await discoverTelegramGiftItems({ ownerWallet: OWNER, fetchImpl: async (_url: string, init: any) => { inits.push(init); return { ok: true, json: async () => ({ nft_items: rows }) }; } });
    expect(proposed).toHaveLength(300);
    expect(inits[0].cache).toBe('no-store');
  });

  it('R38-05 (F4-1): no toncenter answer is left in the browser\'s disk cache — every fetch init says no-store', async () => {
    const doFetches = code(rpc).split(String.fromCharCode(10)).filter((line) => line.includes('doFetch(') && !line.includes('const doFetch'));
    expect(doFetches.length).toBeGreaterThanOrEqual(6);
    for (const call of doFetches) expect(call, call).toContain("cache: 'no-store'");
    expect(code(transport)).toContain("const fetchOptions = { method: 'GET', headers, cache: 'no-store' };");
    const inits: any[] = [];
    await readJettonBalances({ owner: OWNER, fetchImpl: async (_url: string, init: any) => { inits.push(init); return { ok: true, json: async () => ({ jetton_wallets: [] }) }; } });
    expect(inits[0].cache).toBe('no-store');
    expect(code(fn('function fetchWithin(ms) {'))).toContain("cache: 'no-store'");
    expect(code(fn('function walletPicture(url, { shared = false } = {}) {'))).toContain("cache: shared ? 'default' : 'no-store'");
    expect(readFileSync('web/username-nft-owned.mjs', 'utf8')).toContain("{ headers: { Accept: 'application/json' }, cache: 'no-store' }");
  });

  it('R38-06 (F1-2): the gift and the name are signed only by the wallet the press was made with', () => {
    for (const start of ['async function submitTelegramGiftTransfer(gift, recipient) {', 'async function submitUsernameNftTransfer(nft, recipient) {']) {
      expect(code(fn(start)), start).toContain('await sendPlathoWalletTransaction(requireSameWallet(wallet), createWalletTransaction([{');
    }
  });
});
