import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';

describe('wallet tab + durable comment cache guard', () => {
  const app = readFileSync('web/app.js', 'utf8');
  const html = readFileSync('web/index.html', 'utf8');
  const css = readFileSync('web/styles.css', 'utf8');

  it('WALLET-TAB-01: the Wallet tab is DELIBERATELY ungated — the way in is not behind a lock', () => {
    expect(app, 'the lock function itself').not.toMatch(/refreshVaultTabLock/);
    expect(app, 'and the setView redirect that enforced it')
      .not.toMatch(/view === 'wallet' && !hasActivePlathoAccount\(\)/);
    expect(app).not.toMatch(/view === 'vault'/);

    const walletPanel = html.slice(html.indexOf('data-panel="wallet"'), html.indexOf('id="profileSettingsDialog"'));
    expect(walletPanel.length, 'the panel slice is real').toBeGreaterThan(1000);
    for (const id of ['createWalletButton', 'importWalletButton', 'unlockWalletButton']) {
      expect(walletPanel, `${id} is what a new user comes here for`).toContain(`id="${id}"`);
    }

    const reenableIdx = app.indexOf("item.disabled = false;\n    item.title = item.getAttribute('aria-label')");
    expect(reenableIdx).toBeGreaterThan(-1);
    expect(app.slice(reenableIdx, reenableIdx + 400)).not.toMatch(/is-locked/);
  });

  it('WALLET-TAB-02: the wallet surface moved OUT of Profile, and nothing was dropped on the way', () => {
    const walletPanel = html.slice(html.indexOf('data-panel="wallet"'), html.indexOf('id="profileSettingsDialog"'));
    const profilePanel = html.slice(html.indexOf('id="profileSettingsDialog"'));
    const moved = [
      'walletBackupWarning', 'createWalletButton', 'importWalletButton', 'unlockWalletButton',
      'changeWalletPasswordButton', 'receiveWalletTonButton', 'sendWalletTonButton',
      'exportWalletKeyButton', 'importWalletKeyButton', 'exportWalletSeedButton',
      'registerVaultKeysButton',
      'athSupplyStatus',
    ];
    for (const id of moved) {
      expect(walletPanel, `${id} lives in the Wallet tab`).toContain(`id="${id}"`);
      expect(profilePanel, `${id} no longer duplicates in Profile`).not.toContain(`id="${id}"`);
    }

    expect(walletPanel.indexOf('id="registerVaultKeysButton"'), 'activation comes after Unlock')
      .toBeGreaterThan(walletPanel.indexOf('id="unlockWalletButton"'));
    const messages = profilePanel.slice(profilePanel.indexOf('aria-label="Messages"'), profilePanel.indexOf('aria-label="Public channels"'));
    expect(messages.length, 'the Messages section slice must be real').toBeGreaterThan(200);
    expect(messages, 'replace-keys stays in the settings').toContain('id="replaceVaultKeysButton"');
    expect((html.match(/id="registerVaultKeysButton"/g) ?? []).length, 'moved, not copied').toBe(1);
    for (const key of ['quickstart.activateWhy', 'quickstart.notEnoughGramHint', 'quickstart.unlockToActivate',
      'quickstart.activationStillConfirming', 'quickstart.foot']) {
      expect(I18N_STRINGS.en[key], `${key} must not send users to a screen the row has left`)
        .not.toMatch(/Profile tab|in Settings|from Settings|use Settings|Settings shows/);
    }

    expect(profilePanel).toContain('id="savePrefsButton"');
    expect(walletPanel).not.toContain('id="savePrefsButton"');

    expect(html).not.toContain('id="walletDisplayModeSelect"');

    expect(profilePanel).toContain('id="clearLocalDataButton"');
    expect(walletPanel).not.toContain('id="clearLocalDataButton"');
    expect(profilePanel.indexOf('aria-label="Device"'))
      .toBeGreaterThan(profilePanel.indexOf('aria-label="RPC access"'));

    for (const id of [...moved, 'savePrefsButton', 'clearLocalDataButton']) {
      expect((html.match(new RegExp(`id="${id}"`, 'g')) ?? []).length, `${id} appears exactly once`).toBe(1);
    }
  });

  it('WALLET-TAB-02B: Send and Swap are doors on the card beside the QR, gone without a wallet; the gear holds the rest; the GRAM rows they press stay, hidden [decided 2026-10-23]', () => {
    const walletPanel = html.slice(html.indexOf('data-panel="wallet"'), html.indexOf('id="walletGroupDialog"'));
    expect(walletPanel).not.toMatch(/id="walletActions"|id="walletReceiveAction"|id="walletAddAction"|id="walletSettingsAction"/);
    expect(walletPanel).toMatch(/<div class="wallet-card-doors">\s*<button class="wallet-card-qr" id="walletCardQr"[\s\S]*?<\/button>\s*<button class="wallet-card-door" id="walletSendAction"[^>]*\shidden>[\s\S]*?<\/button>\s*<button class="wallet-card-door" id="walletSwapAction"[^>]*\shidden>/);
    expect(walletPanel).toContain('id="walletCardSettings"');
    const card = walletPanel.indexOf('id="walletCard"');
    for (const later of ['id="unlockWalletButton"', 'id="registerVaultKeysButton"', 'id="walletTabs"', 'id="walletTokensPanel"']) {
      expect(card, `${later} must come AFTER the card`).toBeLessThan(walletPanel.indexOf(later));
    }
    expect(walletPanel).toMatch(/<div class="wallet-legacy-rows" hidden>[\s\S]*id="walletTonGroup"[\s\S]*id="createWalletButton"[\s\S]*id="importWalletButton"/);
    const app = readFileSync('web/app.js', 'utf8');
    expect(app).toContain('if (walletTonGroup) walletTonGroup.hidden = !plathoWallet;');
    expect(app).toContain('walletSendAction.hidden = !unlocked;');
    expect(app).toContain('walletSwapAction.hidden = !unlocked;');
    expect(app).toContain("document.querySelector('#walletCardQr')?.addEventListener('click', () => receiveWalletTonButton?.click());");
    expect(app).toContain("walletSendAction?.addEventListener('click', doorPress(openWalletSendChooser, { money: true }));");
    expect(app, 'GRAM, chosen there, is the Send GRAM row it always was').toContain("if (picked.kind === 'gram') { sendWalletTonButton?.click(); return; }");
    expect(app).toContain("walletSwapAction?.addEventListener('click', doorPress(() => runWalletSwap(), { money: true }));");
    expect(app).toContain("document.querySelector('#walletCardSettings')?.addEventListener('click', () => openWalletSettingsMenu());");
    expect(app).toContain("document.querySelector('#walletImportPhraseButton')?.addEventListener('click', () => { closeWalletGroup(); importWalletButton?.click(); });");
    expect(app).toContain("document.querySelector('#walletCreateNewButton')?.addEventListener('click', () => { closeWalletGroup(); createWalletButton?.click(); });");
    const dialog = html.slice(html.indexOf('id="walletGroupDialog"'), html.indexOf('id="profileSettingsDialog"'));
    for (const id of ['changeWalletPasswordButton', 'exportWalletKeyButton', 'importWalletKeyButton', 'exportWalletSeedButton', 'buyAthButton', 'feeDiscountButton', 'athSupplyStatus']) {
      expect(dialog, `${id} in the wallet's window`).toContain(`id="${id}"`);
      expect((html.match(new RegExp(`id="${id}"`, 'g')) ?? []).length, `${id} once`).toBe(1);
    }
  });

  it('WALLET-TAB-02D: the doors are sized by the card, side by side; the row of tiles and its word fitting are gone [2026-10-23]', () => {
    const css = readFileSync('web/styles.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
    const rule = (selector: string) => { const at = css.indexOf(`\n${selector} {`); return css.slice(at, css.indexOf('}', at)); };
    expect(css).not.toMatch(/\n\.wallet-actions? \{/);
    expect(rule('.wallet-card-doors')).toMatch(/display: flex;/);
    expect(css).toMatch(/\.wallet-card-qr,\s*\.wallet-card-door \{[\s\S]*?width: clamp\(38px, 11\.3cqw, 52px\);\s*height: clamp\(29px, 8\.7cqw, 40px\);/);
    const app = readFileSync('web/app.js', 'utf8');
    expect(app).not.toMatch(/fitWalletActionLabels|WALLET_ACTION_LABEL_|scheduleWalletActionLabelFit/);
    expect(app).toMatch(/function fitRailLabels\(\) \{\s*fitLabelsOneSize\(/);
  });

  it('WALLET-TAB-02E: the swap window is two tiles like Buy ATH, each ticker an arrow to a searchable list of what that side can take; no network line [2026-10-16]', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const body = (name: string) => { const from = app.indexOf(name); return app.slice(from, app.indexOf('\n}\n', from) + 2); };
    const dialog = body('async function openWalletSwapDialog(start, hold, asked = null) {');
    expect(dialog).toContain("const give = walletSwapTile('give');");
    expect(dialog).toContain("box.className = 'buy-ath-pair swap-pair';");
    expect(dialog, 'the explanation under the button, as Buy ATH has it').toContain("footnotes: [t('wallet.swapHint')],");
    expect(dialog, 'the balance line says the change comes back; the network line went').not.toContain('networkLabel');
    expect(dialog).toContain("t('common.balanceNeeded')");
    expect(dialog, 'what to give, rounded UP to the places shown').toMatch(/\(\(least \+ step - 1n\) \/ step\) \* step/);
    expect(dialog, 'a picker left open goes with its window').toContain(".querySelectorAll('.swap-picker-backdrop')");
    const tile = body('function walletSwapTile(side) {');
    expect(tile).toContain("pick.setAttribute('aria-haspopup', 'dialog');");
    expect(tile).toContain("arrow.className = 'icon icon-chevron-down';");
    const picker = body('function openWalletSwapPicker({ title, items, amountOf, onPick, returnTo }) {');
    expect(picker).toContain("search.type = 'search';");
    expect(picker, 'inside the window: the page behind a modal is inert').toContain('actionDialog.append(backdrop);');
    expect(picker).toMatch(/query\.length >= 5 \? \[item\.symbol, item\.name, item\.friendly, item\.id\] : \[item\.symbol, item\.name\]/);
    expect(picker).toContain("if (event.key !== 'Escape') return;");
    expect(app, 'nor in the token and NFT send windows').not.toContain("t('wallet.networkLabel')");
  });

  it('WALLET-TAB-02F: the headline is a card like Gram Wallet\'s — balances, the .ath name, the address up its side, a QR door — that tilts with the phone or the mouse [2026-10-16]', () => {
    const card = html.slice(html.indexOf('<div class="wallet-card-stage"'), html.indexOf('wallet-state-section'));
    expect(card, 'shipped hidden: its first drawing shows it').toMatch(/class="wallet-card-stage" id="walletCardStage" hidden>/);
    expect(card).toMatch(/class="wallet-headline is-pending" data-nav-vault-balance[\s\S]*data-nav-vault-ton>0 GRAM<\/strong>[\s\S]*data-nav-vault-ath>0 ATH<\/strong>/);
    for (const id of ['walletCardName', 'walletCardQr', 'walletCardAddress']) expect(card).toContain(`id="${id}"`);
    expect(card).toMatch(/class="wallet-card-face">[\s\S]*data-nav-vault-ath[\s\S]*id="walletCardQr"[\s\S]*id="walletCardName"[\s\S]*<\/div>\s*<button class="wallet-card-address[ "]/);
    expect(card).toContain('icon icon-qr');
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    const body = (name: string) => { const from = app.indexOf(name); return app.slice(from, app.indexOf('\n}\n', from) + 2); };
    const render = body('function renderWalletCard() {');
    expect(render).toContain('stage.hidden = false;');
    expect(render).toContain('card.dataset.empty = String(!plathoWallet);');
    expect(render).toContain("writeCardAddress(document.querySelector('#walletCardAddress'), address);");
    expect(render).toContain("writeCardName(document.querySelector('#walletCard'), document.querySelector('#walletCardName'), name);");
    expect(body('function writeCardAddress(column, address) {'), 'the address in two columns, written only when it changes').toContain('column.dataset.address === address) return;');
    expect(render).toContain('readLinkedPlathoUsername()');
    expect(render, 'the name with its .ath, as a card carries it').toContain('`${canonicalUsernameDisplay(linked.label)}.ath`');
    expect(app).toContain("document.querySelector('#walletCardQr')?.addEventListener('click', () => receiveWalletTonButton?.click());");
    expect(css).toMatch(/\.wallet-card-qr \.icon,\s*\.wallet-card-door \.icon \{[^}]*pointer-events: none;/);
    expect(css).toMatch(/\.wallet-card-qr::after,\s*\.wallet-card-door::after \{\s*content: '';\s*position: absolute;\s*inset: -6px;/);
    expect(css, 'the doors sit in a row of their own inside the face, and take presses through it').toMatch(/\.wallet-card-doors > button \{\s*pointer-events: auto;/);
    expect(css).toMatch(/\.wallet-card-face \{[\s\S]*?pointer-events: none;\s*\}\s*\.wallet-card-face > button \{\s*pointer-events: auto;\s*\}/);
    expect(css).toMatch(/\.wallet-card-surface \{\s*position: absolute;\s*inset: 0;\s*overflow: hidden;\s*border-radius: inherit;\s*pointer-events: none;/);
    expect(css).toMatch(/\.wallet-card-gift \{[^}]*pointer-events: none;/);
    expect(css).toMatch(/\.wallet-card \{[\s\S]*?container-type: inline-size;/);
    expect(css).toContain('--address-font: min(9.5px, calc((max(100cqw / 1.72, 176px) - 32px - var(--card-gear-room)) / var(--address-run)));');
    expect(css).toContain('font-size: var(--address-font);');
    expect(card).toMatch(/<button class="wallet-card-name wallet-card-copyable" id="walletCardName" type="button"[^>]*data-i18n-aria-label="wallet\.copyUsername"[^>]*hidden><\/button>/);
    expect(card).toMatch(/<button class="wallet-card-address wallet-card-copyable" id="walletCardAddress"/);
    expect(body('function writeCardName(card, nameNode, name) {'), 'no name, no button').toContain('if (nameNode) nameNode.hidden = !name;');
    expect(body('function copyFromWalletCard(text, copied) {')).toContain('showAppNotice(t(copied))');
    expect(app).toContain("document.querySelector('#walletCardAddress')?.addEventListener('click', (event) => copyFromWalletCard(event.currentTarget?.dataset?.address, 'wallet.addressCopied'));");
    expect(app).toContain("document.querySelector('#walletCardName')?.addEventListener('click', (event) => copyFromWalletCard(event.currentTarget?.textContent?.trim(), 'wallet.nameCopied'));");
    const plain = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
    expect(plain).toMatch(/@media \(hover: hover\) \{\s*\.wallet-card-copyable:hover \{\s*opacity: 1;\s*scale: 1\.08;\s*\}\s*\}/);
    expect(plain).toMatch(/\.wallet-card-copyable:active \{\s*scale: 0\.92;/);
    expect(plain).toMatch(/\.wallet-card-qr:hover,\s*\.wallet-card-door:hover \{[^}]*scale: 1\.08;/);
    expect(plain).toMatch(/\.wallet-card-qr:active,\s*\.wallet-card-door:active \{[^}]*scale: 0\.92;/);
    expect(plain, 'no plate behind the words').not.toMatch(/\.wallet-card-copyable[^{]*\{[^}]*background/);
    expect(plain).not.toContain('.wallet-card-copyable.is-copied');
    const tilt = body('function installCardTilt(card, shown) {');
    const sensorAt = app.indexOf('const cardTiltSensor = (() => {');
    const sensor = app.slice(sensorAt, app.indexOf('\n})();\n', sensorAt));
    expect(app).toContain("walletCardTilt = installCardTilt(document.querySelector('#walletCard'), () => walletCardSeen());");
    expect(sensor, 'it runs while any card is joined').toContain('leave(take) { takers.delete(take); if (takers.size === 0) stop(); },');
    expect(tilt).toContain('if (active) cardTiltSensor.join(take);');
    expect(tilt, 'the mouse on a desktop').toContain("card.addEventListener('pointermove', (event) => {");
    expect(tilt).toContain("if (event.pointerType !== 'mouse' || pressed) return;");
    expect(tilt).toContain("if (event.target?.closest?.('button')) { hold(); return; }");
    expect(tilt).toMatch(/card\.addEventListener\('pointerdown', \(\) => \{\s*pressed = true;\s*hold\(\);/);
    expect(tilt).toContain("window.addEventListener('pointerup', release);");
    expect(tilt, 'the sensor is not followed while pressed').toContain('const take = (x, y) => { if (!pressed && (Math.abs(clamp(x) - aim.x) >= 0.05 || Math.abs(clamp(y) - aim.y) >= 0.05)) point(x, y); };');
    expect(sensor, "Telegram's own sensor inside the Mini App").toMatch(/telegramSupports\('8\.0'\)[\s\S]*tg\.DeviceOrientation\.start\(/);
    expect(sensor, 'Telegram reports radians').toContain('(180 / Math.PI)');
    expect(sensor, "the browser's elsewhere, on a touch device").toContain("window.addEventListener('deviceorientation', onBrowser);");
    expect(sensor, 'iOS asks').toContain('DeviceOrientationEvent?.requestPermission');
    expect(tilt, '...from a tap on the card itself').toContain("card.addEventListener('click', (event) => { if (!event.target?.closest?.('button')) cardTiltSensor.ask(); });");
    expect(sensor).toContain('prefers-reduced-motion: reduce');
    expect(app, 'the sensor listens only while the card is seen').toContain("syncWalletCardLife(view === 'wallet');");
    expect(css).toMatch(/\.wallet-card \{[\s\S]*?transform: rotateX\(calc\(var\(--tilt-y\) \* -9deg\)\) rotateY\(calc\(var\(--tilt-x\) \* 11deg\)\);/);
    expect(css, 'the words float over it').toMatch(/\.wallet-card-face \{[\s\S]*?transform: translate3d\(calc\(var\(--tilt-x\) \* 6px\), calc\(var\(--tilt-y\) \* 6px\), 26px\);/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.wallet-card,/);
    expect(css).toContain('.icon-qr { --mask: url("./assets/icons/qr.svg"); }');
    expect(card).toContain('class="wallet-card-pattern"');
    expect(card).toMatch(/<img class="wallet-card-gift" id="walletCardGift" alt="" hidden>/);
    expect(render).toContain('if (globalThis.__plathoGiftRuntimeReady) dressWalletCardGift();');
    const dress = body('function dressCardGift(card, theme, motion, playing) {');
    expect(body('function dressWalletCardGift() {')).toContain('dressCardGift(document.querySelector(\'#walletCard\'), plathoWallet ? wornGiftTheme : null, walletCardGiftMotion, () => walletCardSeen());');
    expect(dress).toContain('applyGiftHeroTokens(card, theme);');
    expect(dress).toContain('theme.subjectArt ?? telegramGiftArtCache.get(');
    expect(app, 'and whenever the gift is put on, taken off or its artefacts grow').toMatch(/function applyGiftAppearance\(\) \{[\s\S]{0,900}?if \(globalThis\.__plathoGiftRuntimeReady\) dressWalletCardGift\(\);/);
    expect(css).toMatch(/\.wallet-card\[data-gift-hero-ink\] \.wallet-card-surface \{/);
    expect(card).toMatch(/<canvas class="wallet-card-gift" id="walletCardGiftMotion"[^>]*aria-hidden="true" hidden><\/canvas>/);
    expect(dress).toContain("syncCardGiftMotion(motion, card.querySelector('canvas.wallet-card-gift'), picture, theme, playing);");
    const motion = body('function syncCardGiftMotion(state, canvas, picture, theme, playing) {');
    expect(motion).toMatch(/mountGiftMotion\(canvas, theme, state\.motion, \{\s*subjectOnly: true,/);
    expect(motion).toContain('setCardGiftMotionPlaying(state, playing());');
    expect(body('function setWalletCardGiftMotionPlaying(on) {'), 'guarded before the player is read').toMatch(/if \(!globalThis\.__plathoGiftRuntimeReady\) return;\s*setCardGiftMotionPlaying\(walletCardGiftMotion, on\);/);
    expect(body('function syncWalletCardLife(viewIsWallet = isVaultViewActive()) {'), 'the view switch plays it only while seen [round 32 — F6-4]').toContain('setWalletCardGiftMotionPlaying(seen);');
    expect(app.indexOf('const walletCardGiftMotion = { motion: null, token: 0 };'), 'declared with the other players, above the renderers').toBeLessThan(app.indexOf('function renderBrandGift()'));
    expect(body('function writeCardName(card, nameNode, name) {')).toContain('const tier = name ? plathoUsernameTier(name) : null;');
    expect(css).toMatch(/\.wallet-card\[data-tier="epic"\] \{\s*--card-metal: #b8973d 0%, var\(--id-platho-epic-on-dark\) 18%/);
    expect(css).toMatch(/\.wallet-card\[data-tier="rare"\] \{\s*--card-metal: #909ca7 0%, var\(--id-platho-rare-on-dark\) 18%/);
    expect(css).toMatch(/\.wallet-card\[data-tier="common"\] \{\s*--card-metal: #4eb39d 0%, var\(--id-platho-on-dark\) 18%/);
    expect(css).toMatch(/@property --card-shine \{/);
    expect(css).toMatch(/\.wallet-card\[data-tier\] :is\(\.wallet-card-gram, \.wallet-card-ath, \.wallet-card-name\) \{[^}]*background-clip: text;[^}]*text-shadow: none;[^}]*filter: drop-shadow\(0 1px 1px rgba\(0, 0, 0, 0\.55\)\) drop-shadow\(calc\(var\(--tilt-x\) \* -8px\) calc\(5px \+ var\(--tilt-y\) \* -8px\) 3\.5px rgba\(0, 0, 0, 0\.6\)\)/);
    expect(css).not.toContain('--card-metal-edge');
    expect(css, 'no metal of its own for a pale gift').not.toMatch(/\.wallet-card\[data-tier="(epic|rare|common)"\]\[data-gift-hero-ink/);
    expect(css).not.toContain('--card-metal-contour');
    expect(css).toMatch(/\.wallet-card\[data-tier\]:not\(\[data-gift-hero-ink\]\) \.wallet-card-surface \{/);

    expect(css, 'the outline takes no press').toMatch(/\.wallet-card\[data-tier\]::after \{[^}]*pointer-events: none;/);
    expect(css).toMatch(/\.wallet-card \{[\s\S]*?color: #ffffff;[\s\S]*?text-shadow: calc\(var\(--tilt-x\) \* -8px\) calc\(5px \+ var\(--tilt-y\) \* -8px\)/);
    expect(css).toMatch(/\.wallet-card-gift \{[\s\S]*?filter: drop-shadow\(calc\(var\(--tilt-x\) \* -16px\)/);
  });

  it('WALLET-TAB-02C: the GRAM row is a TWO-column grid, matching the two buttons in it', () => {
    const css = readFileSync('web/styles.css', 'utf8');
    const rule = css
      .slice(css.indexOf('.wallet-ton-group {'), css.indexOf('.wallet-ton-group button'))
      .replace(/\/\*[\s\S]*?\*\//g, ' ');
    expect(rule).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);');
    expect(rule, 'a third column with nothing to put in it').not.toMatch(/1\.2fr/);
    expect((rule.match(/minmax\(/g) ?? []).length, 'exactly two columns declared').toBe(2);
  });

  it('WALLET-TAB-03: the headline balances cannot disagree with the rail corner', () => {
    expect(html).toMatch(/class="wallet-headline is-pending"[^>]*data-nav-vault-balance/);
    const headlineStart = html.indexOf('class="wallet-headline is-pending"');
    const headline = html.slice(headlineStart, html.indexOf('</section>', headlineStart));
    expect(headlineStart).toBeGreaterThan(-1);
    expect(headline).toMatch(/data-nav-vault-ton/);
    expect(headline).toMatch(/data-nav-vault-ath/);
    expect(css).toMatch(/\.wallet-headline\.is-pending \{\s*opacity: 0;/);
  });

  it('WALLET-TAB-04: the dead Vault render machinery is gone, not merely unreachable', () => {
    for (const name of ['renderVaultCards', 'renderVaultActions', 'renderLedgerRows', 'balanceGrid', 'actionGrid', 'ledgerRows']) {
      expect(app, `${name} belongs to the removed Vault tab`).not.toMatch(new RegExp(`\\b${name}\\b`));
    }
    expect(html).not.toMatch(/id="actionGrid"|id="ledgerRows"|id="balanceGrid"/);
  });

  it('WALLET-TAB-05: post-detail comments cache durably in IndexedDB (localStorage strips the image data URLs)', () => {
    expect(app).toMatch(/publicComments: Object\.freeze\(\{ plain: 'platho-public-comments-v1', cap: \(\) => \d+ \}\)/);
    expect(app).toMatch(/function publicCommentCacheStore\(\) \{\s*return deviceCacheStore\('publicComments'\);\s*\}/);
    expect(app).toMatch(/function readCachedPublicComments\(cacheKey\)/);
    expect(app).toMatch(/function writeCachedPublicComments\(cacheKey, comments, parentExists, latestLink\)/);
    expect(app).toMatch(/writeCachedPublicComments\(cacheKey, result\.comments, result\.parentExists, result\.latestLink\);/);
    expect(app).toMatch(/readCachedPublicComments\(cacheKey\)\.then\(\(durable\) => \{\s*if \(!durable \|\| publicPostDetailItem !== item \|\| publicPostDetailChainComments\.length > 0\) return;/);
    expect(app).not.toMatch(/function persistLoadedPublicPostComments/);
  });

});
