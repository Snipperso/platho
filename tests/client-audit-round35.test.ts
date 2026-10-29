import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { beginCell, Cell } from '@ton/core';
import { code, sourceBlock } from './helpers/source';
import { parseWalletHistory } from '../web/wallet-assets.mjs';
import {
  TELEGRAM_GIFT_COLLECTION_CODE_HASH,
  TELEGRAM_GIFT_ITEM_CODE_LIBRARIES,
  readCollectionItemCodeLibrary,
  telegramGiftCollectionIsAuthentic,
} from '../web/telegram-gift-nfts.mjs';


const app = readFileSync('web/app.js', 'utf8');
const appCode = code(app);
const css = readFileSync('web/styles.css', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const SELF = `0:${'11'.repeat(32)}`;
const OTHER = `0:${'22'.repeat(32)}`;
const COLLECTION = `0:${'55'.repeat(32)}`;
const ITEM = `0:${'66'.repeat(32)}`;

const DUROVS_CAPS_DATA_BOC =
  'te6ccgEBBQEArwAESYAAABLfHQ3koaSxignNG3FVwvqf99rxlgTH82d8KEprZvXkTEABAgMEAGYBaHR0cHM6Ly9uZnQu'
  + 'ZnJhZ21lbnQuY29tL2NvbGxlY3Rpb24vZHVyb3ZzY2FwLmpzb24IQgKR2eKsFp/Hhc4A3gqBrydiK5t9F2RBXHdeflDA'
  + 'POmKogAEAQAASwAFAGSADR50Dtpoo0MfqDwLjjaYBAqLqNZOrgycywS72hiTfgWQ';

describe('client audit round 35', () => {
  it('R35-01 (F1-1, F2-1): the swap takes the one-transfer lock at its window — a press during its wait is told nothing false', () => {
    const run = code(fn('async function runWalletSwap(start = null, ask = null) {'));
    expect(run, 'not at the press').not.toContain('walletTonTransfersBusy.add(');
    expect(run, 'nor released there').not.toContain('walletTonTransfersBusy.delete(');
    const swap = code(fn('async function openWalletSwapDialog(start, hold, asked = null) {'));
    expect(swap).toMatch(/if \(!walletTilePressStands\(pressedBy\)\) return null;\s*if \(walletTransferOnItsWay\(pressedBy\)\) return null;/);
    expect(swap).toMatch(/walletTonTransfersBusy\.add\(pressedBy\);\s*try \{\s*refreshMessagingControls\(\);\s*const values = await openActionDialog\(\{/);
    expect(swap).toMatch(/\} finally \{\s*walletTonTransfersBusy\.delete\(pressedBy\);/);
    expect(swap.indexOf('walletTonTransfersBusy.add(pressedBy);')).toBeGreaterThan(swap.lastIndexOf('return null;', swap.indexOf('walletTonTransfersBusy.add(pressedBy);')));
  });

  it('R35-02 (F3-1): a gift collection must name Telegram\'s own ITEM code — a clone with the real code and key and its own items is refused', () => {
    expect(TELEGRAM_GIFT_ITEM_CODE_LIBRARIES, 'read off mainnet bytes [round 36: one of two]').toContain(readCollectionItemCodeLibrary(DUROVS_CAPS_DATA_BOC));
    expect(telegramGiftCollectionIsAuthentic({ codeHash: TELEGRAM_GIFT_COLLECTION_CODE_HASH, dataBoc: DUROVS_CAPS_DATA_BOC }), 'the real collection').toBe(true);
    const root = Cell.fromBase64(DUROVS_CAPS_DATA_BOC);
    const forgedLibrary = beginCell().storeUint(2, 8).storeBuffer(Buffer.alloc(32, 0x7a)).endCell({ exotic: true });
    const clone = beginCell().storeBits(root.bits);
    root.refs.forEach((ref, index) => { clone.storeRef(index === 1 ? forgedLibrary : ref); });
    const cloneBoc = clone.endCell().toBoc().toString('base64');
    expect(readCollectionItemCodeLibrary(cloneBoc)).toBe('7a'.repeat(32));
    expect(telegramGiftCollectionIsAuthentic({ codeHash: TELEGRAM_GIFT_COLLECTION_CODE_HASH, dataBoc: cloneBoc }), 'the clone').toBe(false);
    const plain = beginCell().storeBits(root.bits);
    root.refs.forEach((ref, index) => { plain.storeRef(index === 1 ? beginCell().storeUint(2, 8).storeBuffer(Buffer.alloc(32, 0x91)).endCell() : ref); });
    expect(readCollectionItemCodeLibrary(plain.endCell().toBoc().toString('base64'))).toBeNull();
    expect(readCollectionItemCodeLibrary('nonsense')).toBeNull();
  });

  it('R35-03 (F3-2, F4-1): an NFT is called unverified only when the gift proof is known; the NFT tab is drawn again when a late proof lands', () => {
    const payload = { actions: [{ type: 'nft_transfer', success: true, end_utime: 1, action_id: 'a',
      details: { nft_item: ITEM, nft_collection: COLLECTION, old_owner: OTHER, new_owner: SELF } }],
      metadata: { [ITEM.toUpperCase()]: { token_info: [{ valid: true, name: 'Plush Pepe #1' }] } } };
    expect(parseWalletHistory(payload, SELF)[0].verified, 'known: unlisted').toBe(false);
    expect(parseWalletHistory(payload, SELF, { nftVerdictsKnown: false })[0].verified, 'not known yet: no verdict').toBeNull();
    expect(parseWalletHistory(payload, SELF, { nftVerdictsKnown: false, verifiedCollections: [COLLECTION] })[0].verified, 'listed stays verified').toBe(true);
    expect(code(fn('function renderWalletHistory(panel) {')), 'the warning only on a known "no"').toContain("row.verified === false && !stranger ? t('wallet.tokenUnverified') : ''");
    const load = code(fn('async function loadWalletAssets(tab, { force = false, more = false, keep = false } = {}) {'));
    expect(load).toContain('nftVerdictsKnown: Boolean(gifts),');
    expect(load).toMatch(/void proof\.then\(async \(late\) => \{\s*if \(!\(raced \? late\?\.advanced : \(\(late\?\.complete && late !== gifts\) \|\| late\?\.advanced\)\) \|\| owner !== state\.owner\) return;\s*if \(late\?\.advanced\) \{\s*if \(\(state\.proofRuns \?\? 0\) >= WALLET_PROOF_CONTINUATIONS_MAX\) return;\s*state\.proofRuns = \(state\.proofRuns \?\? 0\) \+ 1;\s*\}\s*await state\.loading\.get\('nft'\);\s*if \(owner !== state\.owner\) return;\s*state\.at\.delete\('nft'\);\s*if \(state\.tab === 'nft' && isVaultViewActive\(\)\) void loadWalletAssets\('nft', \{ force: true \}\);/);
  });

  it('R35-04 (F3-3, F5-1): a row that wraps — the name and its warning keep 7em, the amount takes the next line whole', () => {
    expect(css).toMatch(/\.wallet-asset-row \{\s*display: flex;\s*flex-wrap: wrap;\s*align-items: center;\s*gap: 4px 12px;/);
    expect(css).toMatch(/\.wallet-asset-row > \.wallet-asset-text \{\s*flex: 1 1 7em;\s*min-width: 7em;\s*\}/);
    expect(css).toMatch(/\.wallet-asset-row > \.wallet-asset-amount \{\s*flex: 0 1 auto;\s*margin-left: auto;\s*\}/);
    expect(css).toMatch(/\.wallet-asset-row > \.wallet-asset-icon \{\s*flex: none;\s*\}/);
    expect(code(css), 'no viewport cap left on the amount').not.toMatch(/\.wallet-asset-amount \{[^}]*vw\)/);
  });

  it('R35-05 (F6-3, F6-1, F4-3): the feed does not count an unanswered shard; the Settings row asks without a seal; its retry goes with the lock', () => {
    expect(appCode).toMatch(/onChannelError: \(wallet, error\) => \{\s*if \(error\?\.code === 'PUBLIC_CHANNEL_STATE_UNKNOWN'\) return;\s*failedChannels \+= 1;/);
    expect(code(fn('function refreshProfileBalanceCardUi() {'))).not.toContain('personalPublicAwaitingSeal');
    const marks = code(fn('function forgetWalletSessionMarks() {'));
    expect(marks).toContain('clearTimeout(ownProfileReadAsked.timer);');
    expect(code(fn('function refreshProfileBalanceCardUi() {'))).toContain('ownProfileReadAsked.timer = setTimeout(() => {');
  });
});
