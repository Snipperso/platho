import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// The Vault tab became the WALLET tab (owner request 2026-07-28), and the gate went with it.
//
// The old rule was sound for what it guarded: moving GRAM into the Vault before activation stranded it (withdraw
// needed the registered auth key), so the tab was inert and dark-grey until activation, which lived in Profile.
// Neither half of that survives. There is no Vault contract to strand funds in, and the Wallet tab now HOLDS the
// activation button along with create/import wallet — the first things a new user touches. Gating it would lock
// the way in, so it is deliberately ungated and that is what this pins.
describe('wallet tab + durable comment cache guard', () => {
  const app = readFileSync('web/app.js', 'utf8');
  const html = readFileSync('web/index.html', 'utf8');
  const css = readFileSync('web/styles.css', 'utf8');

  it('WALLET-TAB-01: the Wallet tab is DELIBERATELY ungated — the way in is not behind a lock', () => {
    // The gate is gone in all three places it used to live.
    expect(app, 'the lock function itself').not.toMatch(/refreshVaultTabLock/);
    expect(app, 'and the setView redirect that enforced it')
      .not.toMatch(/view === 'wallet' && !hasActivePlathoAccount\(\)/);
    expect(app).not.toMatch(/view === 'vault'/);

    // Everything a brand-new user needs is IN this tab, which is why it cannot be gated on having an account.
    const walletPanel = html.slice(html.indexOf('data-panel="wallet"'), html.indexOf('data-panel="profile"'));
    expect(walletPanel.length, 'the panel slice is real').toBeGreaterThan(1000);
    for (const id of ['createWalletButton', 'importWalletButton', 'registerVaultKeysButton']) {
      expect(walletPanel, `${id} is what a new user comes here for`).toContain(`id="${id}"`);
    }

    // The rail still re-enables every item unconditionally; with the gate gone nothing may re-disable one after it.
    const reenableIdx = app.indexOf("item.disabled = false;\n    item.title = item.getAttribute('aria-label')");
    expect(reenableIdx).toBeGreaterThan(-1);
    expect(app.slice(reenableIdx, reenableIdx + 400)).not.toMatch(/is-locked/);
  });

  it('WALLET-TAB-02: the wallet surface moved OUT of Profile, and nothing was dropped on the way', () => {
    // The point of the move was to unload Profile, so these must be in exactly one place — the Wallet tab.
    const walletPanel = html.slice(html.indexOf('data-panel="wallet"'), html.indexOf('data-panel="profile"'));
    const profilePanel = html.slice(html.indexOf('data-panel="profile"'));
    const moved = [
      'walletBackupWarning', 'createWalletButton', 'importWalletButton', 'unlockWalletButton',
      'changeWalletPasswordButton', 'walletTonBalanceButton', 'receiveWalletTonButton', 'sendWalletTonButton',
      'exportWalletKeyButton', 'importWalletKeyButton', 'walletDisplayModeSelect', 'exportWalletSeedButton',
      'registerVaultKeysButton', 'clearLocalDataButton',
      'athDropIssuedStatus', 'athSupplyStatus', 'flushAthButton',
    ];
    for (const id of moved) {
      expect(walletPanel, `${id} lives in the Wallet tab`).toContain(`id="${id}"`);
      expect(profilePanel, `${id} no longer duplicates in Profile`).not.toContain(`id="${id}"`);
    }

    // Saving subscriptions came along for the ride in the old Wallet block but is a PUBLIC-CHANNELS action that
    // merely costs gas. It belongs where a user goes looking for it, not in the wallet.
    expect(profilePanel).toContain('id="savePrefsButton"');
    expect(walletPanel).not.toContain('id="savePrefsButton"');

    // Every id must survive the move exactly once — a lost id is a control app.js can no longer find, and a
    // duplicated one makes querySelector pick the wrong node.
    for (const id of [...moved, 'savePrefsButton']) {
      expect((html.match(new RegExp(`id="${id}"`, 'g')) ?? []).length, `${id} appears exactly once`).toBe(1);
    }
  });

  it('WALLET-TAB-03: the headline balances cannot disagree with the rail corner', () => {
    // They are not a second source: the rail refresh fills every [data-nav-vault-ton]/[data-nav-vault-ath] node
    // and toggles is-pending on every [data-nav-vault-balance] container, so these cards need no JS of their own.
    expect(html).toMatch(/class="wallet-headline is-pending"[^>]*data-nav-vault-balance/);
    // Slice from the headline block itself — the RAIL corner carries the same attributes and comes first in the
    // document, so anchoring on a bare indexOf would measure the rail and pass for the wrong reason.
    const headlineStart = html.indexOf('class="wallet-headline is-pending"');
    const headline = html.slice(headlineStart, html.indexOf('</section>', headlineStart));
    expect(headlineStart).toBeGreaterThan(-1);
    expect(headline).toMatch(/data-nav-vault-ton/);
    expect(headline).toMatch(/data-nav-vault-ath/);
    // Invisible until a real balance lands — no flash of a false "0 GRAM".
    expect(css).toMatch(/\.wallet-headline\.is-pending \{\s*opacity: 0;/);
  });

  it('WALLET-TAB-04: the dead Vault render machinery is gone, not merely unreachable', () => {
    // vaultCards/vaultActions/ledgerRows had been empty since the contract was removed and their DOM anchors were
    // already deleted, so the renderers ran against null and returned. Leaving that in place is how a body with no
    // caller gets mistaken for a working feature later.
    for (const name of ['renderVaultCards', 'renderVaultActions', 'renderLedgerRows', 'balanceGrid', 'actionGrid', 'ledgerRows']) {
      expect(app, `${name} belongs to the removed Vault tab`).not.toMatch(new RegExp(`\\b${name}\\b`));
    }
    expect(html).not.toMatch(/id="actionGrid"|id="ledgerRows"|id="balanceGrid"/);
  });

  it('WALLET-TAB-05: post-detail comments cache durably in IndexedDB (localStorage strips the image data URLs)', () => {
    // A dedicated IndexedDB store (localStorage's omitHeavyFeedMediaForPersist strips imageUrl, so the feed
    // cache can't hold comment images).
    expect(app).toMatch(/const publicCommentCacheStorePromise = \(\(\) => \{[\s\S]*platho-public-comments-v1/);
    expect(app).toMatch(/function readCachedPublicComments\(cacheKey\)/);
    expect(app).toMatch(/function writeCachedPublicComments\(cacheKey, comments, parentExists, latestLink\)/);
    // Written on a fresh load (WITH the incremental cursor), read to seed the detail view instantly on reload.
    expect(app).toMatch(/writeCachedPublicComments\(cacheKey, result\.comments, result\.parentExists, result\.latestLink\);/);
    expect(app).toMatch(/readCachedPublicComments\(cacheKey\)\.then\(\(durable\) => \{\s*if \(!durable \|\| publicPostDetailItem !== item \|\| publicPostDetailChainComments\.length > 0\) return;/);
    // The ineffective localStorage persist (stripped images) is gone.
    expect(app).not.toMatch(/function persistLoadedPublicPostComments/);
  });

  // The note that used to sit here — "an unchanged thread is still re-read; the cheap fix is an entry_count-keyed
  // snapshot" — is CLOSED. The thread snapshot cache landed keyed on the shard's CHANGE MARKER instead, which is
  // strictly cheaper: last_transaction_lt already arrives in the batched accountStates call the read makes anyway,
  // while entry_count would have cost a get_page probe per era shard. See tests/public-lane-thread-cache.test.ts.
});
