import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { TELEGRAM_GIFT_DISCOVERY_LIMIT, TELEGRAM_GIFT_DISCOVERY_PAGE, discoverTelegramGiftItems } from '../web/telegram-gift-nfts.mjs';


const app = readFileSync('web/app.js', 'utf8');
const OWNER = `0:${'11'.repeat(32)}`;
const GIFT_COLLECTION = `0:${'f0'.repeat(32)}`;
const row = (index: number, uri: string, collection: string) => ({
  address: `0:${index.toString(16).padStart(64, '0')}`,
  collection_address: collection,
  content: { uri },
});

describe('client audit round 37', () => {
  it('R37-01 (F3-1): the discovery reads the index\'s full page — a gift behind 120 NFTs of lower-addressed collections is found', async () => {
    const asked: string[] = [];
    const rows = [
      ...Array.from({ length: 120 }, (_unused, index) => row(index + 1, `https://spam.example/${index}.json`, `0:${'01'.repeat(32)}`)),
      row(500, 'https://nft.fragment.com/gift/hangingstar-24388.json', GIFT_COLLECTION),
    ];
    const fetchImpl = async (url: string) => { asked.push(url); return { ok: true, json: async () => ({ nft_items: rows }) }; };
    const proposed = await discoverTelegramGiftItems({ ownerWallet: OWNER, fetchImpl });
    expect(proposed.map((one: any) => [one.proposedSlug, one.proposedNumber])).toEqual([['hangingstar', 24388]]);
    expect(asked[0]).toContain(`&limit=${TELEGRAM_GIFT_DISCOVERY_PAGE}&offset=0`);
    expect(TELEGRAM_GIFT_DISCOVERY_PAGE).toBe(1000);
  });

  it('R37-02, as round 38 moved it: the discovery proposes every gift-shaped row; the cap is on what the collector READS (R38-01, R38-02)', async () => {
    const rows = Array.from({ length: 300 }, (_unused, index) => row(index + 1, `https://nft.fragment.com/gift/durovscap-${index + 1}.json`, GIFT_COLLECTION));
    const fetchImpl = async () => ({ ok: true, json: async () => ({ nft_items: rows }) });
    expect(await discoverTelegramGiftItems({ ownerWallet: OWNER, fetchImpl })).toHaveLength(300);
    expect(TELEGRAM_GIFT_DISCOVERY_LIMIT).toBe(100);
  });

  it('R37-03: nothing between taking the one-transfer lock and the try that releases it, in the token/NFT send as in the swap', () => {
    const send = code(sourceBlock(app, 'async function runWalletAssetSend(picked) {'));
    expect(send).toMatch(/walletTonTransfersBusy\.add\(pressedBy\);[\s\S]{0,260}?try \{\s*refreshMessagingControls\(\);\s*const sent = /);
    expect(send.indexOf('refreshMessagingControls();'), 'none before the try').toBeGreaterThan(send.indexOf('try {'));
  });
});
