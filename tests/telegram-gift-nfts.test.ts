import { beginCell } from '@ton/core';
import { describe, expect, it } from 'vitest';
import {
  TELEGRAM_GIFT_COLLECTION_CODE_HASH,
  TELEGRAM_GIFT_MINTER_KEY,
  collectOwnedTelegramGifts,
  decodeNftAddressByIndexStack,
  decodeNftItemDataStack,
  discoverTelegramGiftItems,
  parseTelegramGiftCollectionUri,
  parseTelegramGiftItemUri,
  readCollectionContentUri,
  readCollectionMinterKey,
  telegramGiftFallbackName,
  telegramGiftImageSources,
  telegramGiftCollectionIsAuthentic,
  verifiedTelegramGiftName,
} from '../web/telegram-gift-nfts.mjs';


const DUROVS_CAPS_DATA_BOC =
  'te6ccgEBBQEArwAESYAAABLfHQ3koaSxignNG3FVwvqf99rxlgTH82d8KEprZvXkTEABAgMEAGYBaHR0cHM6Ly9uZnQu'
  + 'ZnJhZ21lbnQuY29tL2NvbGxlY3Rpb24vZHVyb3ZzY2FwLmpzb24IQgKR2eKsFp/Hhc4A3gqBrydiK5t9F2RBXHdeflDA'
  + 'POmKogAEAQAASwAFAGSADR50Dtpoo0MfqDwLjjaYBAqLqNZOrgycywS72hiTfgWQ';
const DUROVS_CAPS = '0:fd8a466aeb13e02a3ce67411b41b44bcd11bd42636f0807acf6570ca73fc2c13';
const OWNER = '0:' + '11'.repeat(32);
const STRANGER = '0:' + '22'.repeat(32);
const ITEM_A = '0:' + 'aa'.repeat(32);
const ITEM_B = '0:' + 'bb'.repeat(32);
const FAKE_COLLECTION = '0:' + 'cc'.repeat(32);

const offchainContentCell = (uri: string) =>
  beginCell().storeUint(1, 8).storeBuffer(Buffer.from(uri, 'utf8')).endCell().toBoc().toString('base64');

const addressSlice = (raw: string) =>
  beginCell().storeAddress(require('@ton/core').Address.parseRaw(raw)).endCell().toBoc().toString('base64');

const decodeAddressSliceBoc = (boc: string) => {
  const { Cell } = require('@ton/core');
  return Cell.fromBase64(boc).beginParse().loadAddress().toRawString();
};

const giftStack = (opts: { collection?: string; owner?: string; uri?: string; init?: string; index?: string } = {}) => [
  { type: 'num', value: opts.init ?? '-0x1' },
  { type: 'num', value: opts.index ?? '0x1' },
  { type: 'slice', value: addressSlice(opts.collection ?? DUROVS_CAPS) },
  { type: 'slice', value: addressSlice(opts.owner ?? OWNER) },
  { type: 'cell', value: offchainContentCell(opts.uri ?? 'https://nft.fragment.com/gift/durovscap-37.json') },
];

const authenticCollection = { codeHash: TELEGRAM_GIFT_COLLECTION_CODE_HASH, dataBoc: DUROVS_CAPS_DATA_BOC, contentUri: 'https://nft.fragment.com/collection/durovscap.json' };

describe('telegram gifts — the authenticity anchor', () => {
  it('GIFT-01: the minter key is read out of a REAL mainnet collection, not out of a fixture we invented', () => {
    expect(readCollectionMinterKey(DUROVS_CAPS_DATA_BOC)).toBe(TELEGRAM_GIFT_MINTER_KEY);
    expect(telegramGiftCollectionIsAuthentic(authenticCollection)).toBe(true);
  });

  it('GIFT-02: BOTH halves are required — Telegram\'s code is public, so the key is what a forgery cannot copy', () => {
    const foreignKey = beginCell()
      .storeBit(true)
      .storeUint(37, 32)
      .storeUint(0x1234n, 256)
      .storeRef(beginCell().storeUint(1, 8).storeBuffer(Buffer.from('https://nft.fragment.com/collection/durovscap.json', 'utf8')).endCell())
      .endCell()
      .toBoc()
      .toString('base64');
    expect(readCollectionMinterKey(foreignKey)).not.toBe(TELEGRAM_GIFT_MINTER_KEY);
    expect(telegramGiftCollectionIsAuthentic({ codeHash: TELEGRAM_GIFT_COLLECTION_CODE_HASH, dataBoc: foreignKey })).toBe(false);
    expect(telegramGiftCollectionIsAuthentic({ codeHash: 'someone/else/code/hash=', dataBoc: DUROVS_CAPS_DATA_BOC })).toBe(false);
  });

  it('GIFT-03B: a collection content URI comes out of the SAME bytes, so it costs no second request', () => {
    expect(readCollectionContentUri(DUROVS_CAPS_DATA_BOC)).toBe('https://nft.fragment.com/collection/durovscap.json');
    expect(parseTelegramGiftCollectionUri(readCollectionContentUri(DUROVS_CAPS_DATA_BOC))).toBe('durovscap');
    expect(readCollectionContentUri('not base64 at all !!')).toBe('');
    expect(readCollectionContentUri('')).toBe('');
    expect(readCollectionContentUri(null)).toBe('');
  });

  it('GIFT-03: absent evidence is never a pass — the gate refuses what it cannot read', () => {
    expect(telegramGiftCollectionIsAuthentic({})).toBe(false);
    expect(telegramGiftCollectionIsAuthentic({ codeHash: TELEGRAM_GIFT_COLLECTION_CODE_HASH, dataBoc: null })).toBe(false);
    expect(telegramGiftCollectionIsAuthentic({ codeHash: TELEGRAM_GIFT_COLLECTION_CODE_HASH, dataBoc: 'not base64 at all !!' })).toBe(false);
    expect(readCollectionMinterKey('')).toBeNull();
    expect(readCollectionMinterKey('AAAA')).toBeNull();
  });
});

describe('telegram gifts — what the chain says the item is', () => {
  it('GIFT-04: only fragment\'s own gift URI names a gift; a look-alike host does not', () => {
    expect(parseTelegramGiftItemUri('https://nft.fragment.com/gift/durovscap-37.json')).toEqual({ slug: 'durovscap', number: 37 });
    expect(parseTelegramGiftItemUri('https://nft.fragment.com.evil.example/gift/durovscap-37.json')).toBeNull();
    expect(parseTelegramGiftItemUri('http://nft.fragment.com/gift/durovscap-37.json')).toBeNull();
    expect(parseTelegramGiftItemUri('https://nft.fragment.com/username/platho.json')).toBeNull();
    expect(parseTelegramGiftCollectionUri('https://nft.fragment.com/collection/durovscap.json')).toBe('durovscap');
    expect(parseTelegramGiftCollectionUri('https://nft.fragment.com/gift/durovscap-37.json')).toBeNull();
  });

  it('GIFT-05: get_nft_data is decoded, and a TVM boolean\'s "-0x1" is not mistaken for a parse failure', () => {
    const decoded = decodeNftItemDataStack(giftStack(), { decodeAddressSliceBoc });
    expect(decoded.collectionAddress).toBe(DUROVS_CAPS);
    expect(decoded.ownerWallet).toBe(OWNER);
    expect(decoded.contentUri).toBe('https://nft.fragment.com/gift/durovscap-37.json');
    expect(() => decodeNftItemDataStack(giftStack({ init: '0x0' }), { decodeAddressSliceBoc })).toThrow();
    expect(() => decodeNftItemDataStack([], { decodeAddressSliceBoc })).toThrow();
  });

  it('GIFT-06: the pretty name is checked by arithmetic, so a relabelling indexer cannot rename a gift', () => {
    expect(verifiedTelegramGiftName('Durov’s Cap #37', { slug: 'durovscap', number: 37 })).toBe('Durov’s Cap #37');
    expect(verifiedTelegramGiftName('Plush Pepe #1', { slug: 'durovscap', number: 37 })).toBeNull();
    expect(verifiedTelegramGiftName('', { slug: 'durovscap', number: 37 })).toBeNull();
    expect(telegramGiftFallbackName({ slug: 'durovscap', number: 37 })).toBe('durovscap #37');
  });

  it('GIFT-07: a picture is fetched from a host we already talk to, or from the chain-derived URL — never elsewhere', () => {
    expect(telegramGiftImageSources({ slug: 'durovscap', number: 37, proposedImage: 'https://proxy.toncenter.com/x/pr:medium/y' }))
      .toEqual(['https://proxy.toncenter.com/x/pr:medium/y', 'https://nft.fragment.com/gift/durovscap-37.webp']);
    expect(telegramGiftImageSources({ slug: 'durovscap', number: 37, proposedImage: 'https://tracker.example/pixel.png' }))
      .toEqual(['https://nft.fragment.com/gift/durovscap-37.webp']);
    for (const bad of ['https://evil-toncenter.com/px.webp', 'https://nottoncenter.com/px.webp', 'http://toncenter.com/px.webp', 'https://toncenter.com.evil.io/px.webp']) {
      expect(telegramGiftImageSources({ slug: 'durovscap', number: 37, proposedImage: bad }), bad)
        .toEqual(['https://nft.fragment.com/gift/durovscap-37.webp']);
    }
    expect(telegramGiftImageSources({ slug: 'durovscap', number: 37, proposedImage: 'https://toncenter.com/x.webp' })[0]).toBe('https://toncenter.com/x.webp');
  });
});

describe('telegram gifts — the owned list', () => {
  const collect = (over: Record<string, unknown> = {}) => collectOwnedTelegramGifts({
    ownerWallet: OWNER,
    indexerItems: [{ itemAddress: ITEM_A, proposedName: 'Durov’s Cap #37' }],
    verifyItem: async () => decodeNftItemDataStack(giftStack(), { decodeAddressSliceBoc }),
    verifyCollection: async () => authenticCollection,
    verifyMembership: async () => ITEM_A,
    ...over,
  });

  it('GIFT-08: a gift is kept only when the collection, the slug and the owner all agree', async () => {
    const ok = await collect();
    expect(ok.gifts).toHaveLength(1);
    expect(ok.gifts[0]).toMatchObject({ slug: 'durovscap', number: 37, name: 'Durov’s Cap #37' });
    expect(ok.complete).toBe(true);

    const crossed = await collect({
      verifyItem: async () => decodeNftItemDataStack(giftStack({ uri: 'https://nft.fragment.com/gift/plushpepe-1.json' }), { decodeAddressSliceBoc }),
    });
    expect(crossed.gifts).toHaveLength(0);

    const forged = await collect({
      verifyItem: async () => decodeNftItemDataStack(giftStack({ collection: FAKE_COLLECTION }), { decodeAddressSliceBoc }),
      verifyCollection: async () => ({ codeHash: 'nope', dataBoc: DUROVS_CAPS_DATA_BOC, contentUri: 'https://nft.fragment.com/collection/durovscap.json' }),
    });
    expect(forged.gifts).toHaveLength(0);
  });

  it('GIFT-09: a gift now held by somebody else is reported as transferred, with proof — never merely missing', async () => {
    const moved = await collect({
      verifyItem: async () => decodeNftItemDataStack(giftStack({ owner: STRANGER }), { decodeAddressSliceBoc }),
    });
    expect(moved.gifts).toHaveLength(0);
    expect(moved.transferred).toEqual([
      { itemAddress: ITEM_A, slug: 'durovscap', number: 37, name: 'Durov’s Cap #37', ownerWallet: STRANGER },
    ]);
    expect(moved.complete).toBe(true);
  });

  it('GIFT-10: a read that failed leaves the list INCOMPLETE — silence is never "you own nothing"', async () => {
    const noIndexer = await collectOwnedTelegramGifts({
      ownerWallet: OWNER,
      indexerItems: null,
      indexerError: new Error('indexer down'),
      verifyItem: async () => { throw new Error('unreachable'); },
      verifyCollection: async () => authenticCollection,
      verifyMembership: async () => { throw new Error('unreachable'); },
    });
    expect(noIndexer.gifts).toHaveLength(0);
    expect(noIndexer.complete).toBe(false);

    const threw = await collect({ verifyItem: async () => { throw new Error('rpc down'); } });
    expect(threw.gifts).toHaveLength(0);
    expect(threw.unverified).toBe(1);
    expect(threw.complete).toBe(false);
  });

  it('GIFT-08B: an item the collection does not name for its index is no gift, whatever it says of itself [client audit round 34 — F4-2]', async () => {
    const asked: Array<[string, bigint]> = [];
    const forged = await collect({ verifyMembership: async (collection: string, index: bigint) => { asked.push([collection, index]); return ITEM_B; } });
    expect(forged.gifts).toHaveLength(0);
    expect(forged.complete, 'a clear no, not an unanswered read').toBe(true);
    expect(asked).toEqual([[DUROVS_CAPS, 1n]]);
    const unanswered = await collect({ verifyMembership: async () => { throw new Error('collection read failed'); } });
    expect([unanswered.gifts.length, unanswered.unverified, unanswered.complete], 'a failed read proves nothing').toEqual([0, 1, false]);
    expect((await collect()).gifts.map((gift: { itemAddress: string }) => gift.itemAddress), 'the item the collection names').toEqual([ITEM_A]);
    await expect(collectOwnedTelegramGifts({ ownerWallet: OWNER, indexerItems: [], verifyItem: async () => null, verifyCollection: async () => null }),
      'no caller can leave the check out').rejects.toThrow(/verifyMembership is required/);
    expect(decodeNftAddressByIndexStack([{ type: 'slice', value: addressSlice(ITEM_A) }], { decodeAddressSliceBoc })).toBe(ITEM_A);
    expect(() => decodeNftAddressByIndexStack([], { decodeAddressSliceBoc })).toThrow();
  });

  it('GIFT-11: one collection is asked about ONCE however many gifts came out of it', async () => {
    let collectionReads = 0;
    const result = await collectOwnedTelegramGifts({
      ownerWallet: OWNER,
      indexerItems: [
        { itemAddress: ITEM_A, proposedName: 'Durov’s Cap #37' },
        { itemAddress: ITEM_B, proposedName: 'Durov’s Cap #14' },
        { itemAddress: ITEM_A, proposedName: 'Durov’s Cap #37' },
      ],
      verifyItem: async (address: string) => decodeNftItemDataStack(
        giftStack({ uri: address === ITEM_B ? 'https://nft.fragment.com/gift/durovscap-14.json' : undefined, index: address === ITEM_B ? '0xe' : '0x25' }),
        { decodeAddressSliceBoc },
      ),
      verifyCollection: async () => { collectionReads += 1; return authenticCollection; },
      verifyMembership: async (_collection: string, index: bigint) => (index === 14n ? ITEM_B : ITEM_A),
    });
    expect(result.gifts.map((gift: { number: number }) => gift.number).sort()).toEqual([14, 37]);
    expect(collectionReads).toBe(1);
  });
});

describe('telegram gifts — discovery is a proposal, and a bounded one', () => {
  const indexerPayload = {
    nft_items: [
      { address: ITEM_A, collection_address: DUROVS_CAPS, content: { uri: 'https://nft.fragment.com/gift/durovscap-37.json' } },
      { address: ITEM_B, collection_address: FAKE_COLLECTION, content: { uri: 'https://scam.example/prize.json' } },
      { address: ITEM_B, collection_address: FAKE_COLLECTION, content: {} },
    ],
    metadata: {
      [ITEM_A.toUpperCase()]: { token_info: [{ name: 'Durov’s Cap #37', extra: { _image_medium: 'https://proxy.toncenter.com/x/pr:medium/y' } }] },
    },
  };

  it('GIFT-12: only gift-shaped items are proposed, and the indexer\'s picture rides along as a proposal', async () => {
    const fetchImpl = async () => ({ ok: true, json: async () => indexerPayload });
    const proposed = await discoverTelegramGiftItems({ ownerWallet: OWNER, fetchImpl });
    expect(proposed).toHaveLength(1);
    expect(proposed[0]).toMatchObject({
      itemAddress: ITEM_A,
      proposedSlug: 'durovscap',
      proposedNumber: 37,
      proposedName: 'Durov’s Cap #37',
      proposedImage: 'https://proxy.toncenter.com/x/pr:medium/y',
    });
  });

  it('GIFT-13: an indexer that refuses is an ERROR, never an empty list', async () => {
    const fetchImpl = async () => ({ ok: false, status: 503 });
    await expect(discoverTelegramGiftItems({ ownerWallet: OWNER, fetchImpl })).rejects.toThrow(/503/);
  });

  it('GIFT-15: a rate limit is distinguishable from a refusal, or a busy minute reads as an empty wallet', async () => {
    const refused = async () => ({ ok: false, status: 503 });
    const limited = async () => ({ ok: false, status: 429 });
    await expect(discoverTelegramGiftItems({ ownerWallet: OWNER, fetchImpl: refused }))
      .rejects.toMatchObject({ status: 503 });
    await expect(discoverTelegramGiftItems({ ownerWallet: OWNER, fetchImpl: limited }))
      .rejects.toMatchObject({ status: 429 });
  });

  it('GIFT-14: the answer is capped — an untrusted list is otherwise a free denial of service', async () => {
    const many = Array.from({ length: 40 }, (_unused, index) => ({
      address: '0:' + index.toString(16).padStart(64, '0'),
      collection_address: DUROVS_CAPS,
      content: { uri: `https://nft.fragment.com/gift/durovscap-${index}.json` },
    }));
    const fetchImpl = async () => ({ ok: true, json: async () => ({ nft_items: many }) });
    const proposed = await discoverTelegramGiftItems({ ownerWallet: OWNER, fetchImpl, limit: 5 });
    expect(proposed).toHaveLength(5);
  });
});
