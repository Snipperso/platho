import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  PLATHO_APP_CONFIG,
  PLATHO_APP_MODES,
  REQUIRED_TON_RPC_CRITICAL_METHODS,
  validatePlathoAppConfig,
} from '../web/platho-config.mjs';
import {
  DEFAULT_PUBLIC_CHANNEL_AUTHOR_WALLET,
  DEFAULT_PUBLIC_CHANNELS,
} from '../web/public-channel-subscriptions.mjs';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';

// i18n: hundreds of user-facing English literals in web/app.js and web/index.html moved into
// I18N_STRINGS.en (keyed t('...') copy). Source guards that used to pin the English literal in app.js
// now pin the t('key') call there and/or assert the shipped COPY against the en dictionary. `enCopy`
// is the joined en values so "copy must/must-not contain phrase X" guards still cover the dictionary
// (a forbidden phrase must not be able to hide inside the moved copy).
const EN_STRINGS: Record<string, string> = I18N_STRINGS.en as Record<string, string>;
const enCopy: string = Object.values(EN_STRINGS).join('\n');

const productionConfig = {
  mode: PLATHO_APP_MODES.PRODUCTION,
  domain: 'platho.app',
  network: {
    chain: 'mainnet',
    label: 'mainnet',
    tonRpc: {
      primaryProviderId: 'orbs',
      fallbackProviderIds: ['user-toncenter', 'keyless-toncenter'],
      verifyCriticalReads: true,
      criticalMethods: [...PLATHO_APP_CONFIG.network.tonRpc.criticalMethods],
      providers: [
        { id: 'orbs', kind: 'ton-access-v2' },
        {
          id: 'user-toncenter',
          kind: 'toncenter-v3',
          useUserApiKey: true,
          runGetMethodEndpoint: 'https://toncenter.com/api/v3/runGetMethod',
          sendBocEndpoint: 'https://toncenter.com/api/v3/message',
          messagesEndpoint: 'https://toncenter.com/api/v3/messages',
        },
        {
          id: 'keyless-toncenter',
          kind: 'toncenter-v3',
          verifierOnly: true,
          emergencyFallback: true,
          runGetMethodEndpoint: 'https://toncenter.com/api/v3/runGetMethod',
          sendBocEndpoint: 'https://toncenter.com/api/v3/message',
          messagesEndpoint: 'https://toncenter.com/api/v3/messages',
        },
      ],
      requestTimeoutMs: 15000,
    },
  },
  genesis: {
    deploymentManifestHash: `0x${'66'.repeat(32)}`,
  },
  tonDns: {
    rootAddress: '-1:2222222222222222222222222222222222222222222222222222222222222222',
    provider: {
      globalName: 'plathoTonDnsProvider',
      moduleUrl: null,
      exportName: 'default',
      requiredInProduction: true,
    },
  },
  profileRegistry: {
    address: '0:3333333333333333333333333333333333333333333333333333333333333333',
  },
  feeAccumulator: {
    address: '0:4444444444444444444444444444444444444444444444444444444444444444',
  },
  crypto: {
    signedBundlePurpose: 'pwa-production',
  },
  messaging: {
    pricing: {
      estimatedNetworkFeeNanotons: '5000000',
      includedNetworkFeeNanotons: '5000000',
      roundingStepNanotons: '1000000',
      maxNetworkFeeSurchargeNanotons: '50000000',
      highNetworkFeeSurchargeConfirmNanotons: '10000000',
      manualNetworkFeeSurchargeOverrideNanotons: '50000000',
    },
  },
  ui: {
    brandNetworkLabel: 'mainnet',
    networkLabel: 'mainnet',
    walletLabel: 'wallet',
  },
  preview: {
    threads: [],
  },
};

function unique(items: string[]): string[] {
  return Array.from(new Set(items));
}


describe('PWA runtime config guard', () => {
  it('PWA-WALLET-01: receive QR generator renders a TON transfer code', async () => {
    const { createQrSvg, createQrSvgDataUrl } = await import('../web/qr-code.mjs');
    const uri = 'ton://transfer/UQDU48m_nYC12oqHJnKG9nBE4ljGpUYHHLPS-owij9BEOATH';
    const svg = createQrSvg(uri);
    const dataUrl = createQrSvgDataUrl(uri);

    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 45 45"');
    expect(svg).toContain('<rect width="45" height="45" fill="#fff"');
    expect(dataUrl).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });

  it('PWA-CONFIG-01: default workspace config follows the verified-genesis release gate', () => {
    const report = validatePlathoAppConfig(PLATHO_APP_CONFIG);
    const genesisVerified = readFileSync('artifacts/MAINNET_GENESIS_VERIFIED.txt', 'utf8').trim().toLowerCase() === 'true';

    if (genesisVerified) {
      expect(report.ok).toBe(true);
      expect(report.mode).toBe(PLATHO_APP_MODES.PRODUCTION);
      expect(report.findings).toEqual([]);
      expect(PLATHO_APP_CONFIG.crypto.signedBundlePurpose).toBe('pwa-production');
    } else {
      // VPB2 redeploy reset MAINNET_GENESIS_VERIFIED.txt to "false" pending the
      // Session 7 re-verification but left web/platho-config.mjs pinned in
      // PRODUCTION / 'pwa-production'; assert the current committed config state
      // (a clean production validation) rather than the preview fallback.
      expect(report.ok).toBe(true);
      expect(report.mode).toBe(PLATHO_APP_MODES.PRODUCTION);
      expect(report.findings).toEqual([]);
      expect(PLATHO_APP_CONFIG.crypto.signedBundlePurpose).toBe('pwa-production');
    }
    expect(PLATHO_APP_CONFIG.network.chain).toBe('mainnet');
    expect(PLATHO_APP_CONFIG.network.tonRpc.requestSpacingMs).toBe(250);
    expect(PLATHO_APP_CONFIG.network.tonRpc.rateLimitBackoffMs).toBe(7000);
    expect(PLATHO_APP_CONFIG.network.tonRpc.rateLimitRetries).toBe(1);
    expect(PLATHO_APP_CONFIG.network.tonRpc.requestTimeoutMs).toBe(15000);
    expect(PLATHO_APP_CONFIG.network.tonRpc.runGetMethodCacheTtlMs).toBe(15000);
    expect(PLATHO_APP_CONFIG.network.tonRpc.runGetMethodCacheMaxEntries).toBe(512);
    // TONCENTER-ONLY (Orbs removed): keyed user-toncenter is the primary, keyless-toncenter the emergency fallback.
    expect(PLATHO_APP_CONFIG.network.tonRpc.providers.map((provider) => provider.id)).toEqual([
      'user-toncenter',
      'keyless-toncenter',
    ]);
    expect(PLATHO_APP_CONFIG.network.tonRpc.fallbackProviderIds).toEqual([
      'keyless-toncenter',
    ]);
    expect(PLATHO_APP_CONFIG.network.tonRpc.providers.find((provider) => provider.id === 'user-toncenter')).toMatchObject({
      useUserApiKey: true,
      runGetMethodEndpoint: 'https://toncenter.com/api/v3/runGetMethod',
      sendBocEndpoint: 'https://toncenter.com/api/v3/message',
      messagesEndpoint: 'https://toncenter.com/api/v3/messages',
      walletBalanceEndpoint: 'https://toncenter.com/api/v3/addressInformation',
    });
    expect(PLATHO_APP_CONFIG.network.tonRpc.providers.find((provider) => provider.id === 'keyless-toncenter')).toMatchObject({
      verifierOnly: true,
      emergencyFallback: true,
      runGetMethodEndpoint: 'https://toncenter.com/api/v3/runGetMethod',
      requestSpacingMs: 1100,
    });
    // No Orbs / ton-access provider remains.
    expect(PLATHO_APP_CONFIG.network.tonRpc.providers.some((provider) => String(provider.kind) === 'ton-access-v2')).toBe(false);
    expect(PLATHO_APP_CONFIG.network.tonRpc.primaryProviderId).toBe('user-toncenter');
    // Every provider endpoint is the canonical public toncenter.com host, so the validator raises no
    // central-proxy/gateway finding — there is no single bespoke host to block or DoS.
    expect(validatePlathoAppConfig(PLATHO_APP_CONFIG).findings.map((finding) => finding.id))
      .not.toContain('PWA_TON_RPC_CENTRAL_GATEWAY_FORBIDDEN');
    // verifyCriticalReads stays false: a shard message body self-verifies against the hashes in its own header, so a
    // single (even untrusted) provider read cannot poison it, and routine cross-verification would only burn the
    // per-user budget. Keyless toncenter stays strictly an emergency primary/send/history fallback, never
    // an "on equal footing" verifier.
    expect(PLATHO_APP_CONFIG.network.tonRpc.verifyCriticalReads).toBe(false);
    // The clean-17 shard reads. The CapsuleHub entry/index getters that used to be listed here died with the
    // contract — see the not.toContain block below, which is the half that matters: a RETIRED method left pinned
    // as critical silently demands verification of a call nothing makes.
    for (const method of ['get_state', 'get_global']) {
      expect(PLATHO_APP_CONFIG.network.tonRpc.criticalMethods).toContain(method);
    }
    for (const retired of [
      'get_user', 'get_key_record', 'get_user_receipts', 'get_canonical_publish_charge',
      'get_private_entry', 'get_private_recipient_index', 'get_private_sender_index', 'get_private_page',
      'get_public_entry', 'get_public_page',
    ]) {
      expect(PLATHO_APP_CONFIG.network.tonRpc.criticalMethods, `${retired} died with its contract`).not.toContain(retired);
    }
    // The two per-user record reads: a name resolves through its NFT item, an avatar through the wallet's
    // KeyShard get_view. Both replaced registry getters that had to die with the maps behind them.
    expect(PLATHO_APP_CONFIG.network.tonRpc.criticalMethods).toContain('get_username_item_address');
    expect(PLATHO_APP_CONFIG.network.tonRpc.criticalMethods).toContain('get_key_shard_address');
    expect(PLATHO_APP_CONFIG.network.tonRpc.criticalMethods).toContain('get_view');
    expect(PLATHO_APP_CONFIG.network.tonRpc.criticalMethods, 'a retired getter must not stay pinned as critical')
      .not.toContain('get_avatar');
    expect(PLATHO_APP_CONFIG.network.tonRpc.criticalMethods).not.toContain('get_name_record');
    // The Vault and CapsuleHub blocks are gone with their contracts. The genesis binding they carried is a
    // RELEASE property, not a contract one, so it moved to its own block and stays pinned here.
    expect(PLATHO_APP_CONFIG.vault).toBeUndefined();
    expect(PLATHO_APP_CONFIG.capsuleHub).toBeUndefined();
    // [CUTOVER 2026-08-02] clean-17, sealed on mainnet. Pinned as literals rather than imported from the config they
    // guard: a pin that reads its expectation from the thing under test agrees with any value that thing holds.
    expect(PLATHO_APP_CONFIG.genesis.deploymentManifestHash).toBe(
      'ccee504c6b94773e68550dff3a071107f34609b0fdb17be9fad8ab224d482f49',
    );
    expect(PLATHO_APP_CONFIG.feeAccumulator.address).toBe('UQAgWSAucibv2D3SOIhL1wKFwg27wIRkeiObu5uxgOfNpLNB');
    expect(PLATHO_APP_CONFIG.ath.masterAddress).toBe('UQCThzitzPXm2dH9psaVkZlkAcHqzCJjcBpD29b5closNbd7');
    expect(PLATHO_APP_CONFIG.usernameRegistry.address).toBe('UQBR-Ujp5676B3xTiqQ77R2OIjZYBn1GxUvI8V3bmHVV0F_W');
    expect(PLATHO_APP_CONFIG.tonDns.rootAddress).toBe(
      '-1:e56754f83426f69b09267bd876ac97c44821345b7e266bd956a7bfbfb98df35c',
    );
  });

  it('PWA-CONFIG-01B: configured TON DNS provider module exports the requested runtime provider', async () => {
    const providerConfig = PLATHO_APP_CONFIG.tonDns.provider;
    const moduleUrl = providerConfig.moduleUrl;
    // The version is deliberately NOT pinned to a literal here: this test is about the URL naming a module that
    // really exports the requested provider, and MODCONTENT-01 already owns "the version tracks the content".
    // Pinning the number made every unrelated cascade fail here, which teaches people to edit tests to go green.
    expect(moduleUrl).toMatch(/^\.\/ton-dns-provider\.mjs\?v=\d+$/);
    const modulePath = moduleUrl.replace(/^\.\//, '../web/').replace(/\?.*$/, '');
    const module = await import(modulePath);
    const exportName = providerConfig.exportName ?? 'default';
    const provider = module[exportName] ?? module.default ?? module.provider;

    expect(exportName).toBe('default');
    expect(provider?.resolveWallet).toBeTypeOf('function');
  });

  it('PWA-CONFIG-01A: the Wallet tab exposes no internal readiness artifacts', () => {
    // The Vault tab became the WALLET tab. Its three preview arrays (vaultCards / vaultActions / ledgerRows) are
    // gone: they had been empty ever since the Vault contract was removed, their DOM anchors were deleted with it,
    // and their renderers were unreachable — the tab rendered nothing but a note describing a contract that no
    // longer exists. What this guard is actually for outlives them: nothing internal (readiness harnesses,
    // faucets, testgivers) may reach the user-facing wallet surface.
    const html = readFileSync('web/index.html', 'utf8');
    const start = html.indexOf('data-panel="wallet"');
    const walletPanel = html.slice(start, html.indexOf('data-panel="profile"'));
    expect(start, 'the wallet panel exists').toBeGreaterThan(-1);
    expect(walletPanel.length, 'and the slice really covers it').toBeGreaterThan(1000);

    expect(walletPanel).not.toMatch(/M20T|readiness|faucet|testgiver/i);
    expect(JSON.stringify(PLATHO_APP_CONFIG.ui)).not.toMatch(/M20T|readiness|faucet|testgiver/i);
    expect(PLATHO_APP_CONFIG.ui.walletSubtitle).toBe('Wallet');
    // The dead preview arrays must not come back with the tab they belonged to.
    for (const key of ['vaultCards', 'vaultActions', 'ledgerRows']) {
      expect(PLATHO_APP_CONFIG.ui, `${key} belongs to the removed Vault tab`).not.toHaveProperty(key);
    }
  });

  it('PWA-CONFIG-01C: first-run preview threads do not expose internal ops fixtures', () => {
    expect(PLATHO_APP_CONFIG.preview?.threads).toEqual([]);
  });

  it('PWA-CONFIG-01F: official Platho channel pins the mainnet publisher wallet', () => {
    const configChannel = PLATHO_APP_CONFIG.publicChannels.find((channel) => channel.id === 'platho.app');
    const defaultChannel = DEFAULT_PUBLIC_CHANNELS.find((channel) => channel.id === 'platho.app');
    const feed = JSON.parse(readFileSync('web/channels/platho.app/feed.json', 'utf8'));
    const officialWallet = 'UQDU48m_nYC12oqHJnKG9nBE4ljGpUYHHLPS-owij9BEOATH';

    expect(DEFAULT_PUBLIC_CHANNEL_AUTHOR_WALLET).toBe(officialWallet);
    expect(configChannel?.authorWallet).toBe(officialWallet);
    expect(defaultChannel?.authorWallet).toBe(officialWallet);
    expect(feed.posts?.[0]?.authorWallet).toBe(officialWallet);
  });

  it('PWA-CONFIG-01G: Vault request query ids require browser entropy and keep timestamp-scoped unpredictability', () => {
    const app = readFileSync('web/app.js', 'utf8');

    expect(app).toMatch(/function nextQueryId\(\) \{/);
    expect(app).toMatch(/crypto\.getRandomValues is unavailable for query id generation/);
    expect(app).toMatch(/cryptoImpl\.getRandomValues\(entropy\)/);
    expect(app).toMatch(/BigInt\(Math\.floor\(Date\.now\(\) \/ 1000\)\) << 32n/);
    expect(app).toMatch(/\| BigInt\(entropy\[0\]\)/);
    expect(app).not.toMatch(/crypto\?\.getRandomValues\?\.\(entropy\)/);
  });

  it('PWA-CONFIG-01B: chat header exposes only live controls', () => {
    const html = readFileSync('web/index.html', 'utf8');
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');

    expect(html).not.toMatch(/aria-label="Call"|aria-label="More"|aria-label="Attach"/);
    // v637: Public is the primary tab — first in the rail (before Private) and the default view (matches the
    // boot, which sets view=public when there are public channels; activeThreadId is null at boot).
    expect(html).toMatch(/data-tab="public"[\s\S]*data-tab="chats"/);
    expect(html).toMatch(/class="app-shell" data-view="public"/);
    expect(html).toMatch(/class="rail-item is-active" type="button" data-tab="public"/);
    expect(html).toMatch(/class="content-pane public-pane view-panel is-active"/);
    // The sidebar version badge (index.html label) and the runtime const MUST be EQUAL in any given bundle: the
    // update-detect (handleServiceWorkerControllerChange) compares the LIVE index.html label to the running const,
    // and the badge is the one on-device way to tell which build a device runs (TMA webviews cache hard). They had
    // silently drifted (v672 vs v691) — pin the equality so a release bumps both or neither.
    const versionLabel = html.match(/id="appVersionLabel">(v\d+)<\/span>/)?.[1];
    const runtimeVersion = app.match(/const PLATHO_APP_RUNTIME_VERSION = '(v\d+)'/)?.[1];
    expect(versionLabel).toBeTruthy();
    expect(runtimeVersion).toBe(versionLabel);
    expect(Number(String(versionLabel).slice(1))).toBeGreaterThanOrEqual(720);
    // The app.js cache-bust query MUST track the app version — and until 2026-08-02 this comment SAID so while the
    // assertion below pinned an independent literal, so the two could drift and did: a release bumped the ?v= to 801
    // and left the label at v800. The update-detect compares the LIVE label to the RUNNING const, both read v800, it
    // concluded "no new version" and never reloaded. Devices sat on the old build through a full cache clear, because
    // no cache was involved — the server was honestly serving a v800 label.
    //
    // Derived from versionLabel now, so all three move together or the release fails here.
    const versionNumber = String(versionLabel).slice(1);
    expect(html).toContain(`<script src="./app.js?v=${versionNumber}" type="module">`);
    expect(readFileSync('web/sw.js', 'utf8')).toContain(`./app.js?v=${versionNumber}`);
    // Version-agnostic on purpose: MODCONTENT-01 owns "the ?v= tracks the content". A literal number here reddened
    // on every unrelated stylesheet change, which teaches people to edit tests until they go green.
    expect(html).toMatch(/<link rel="stylesheet" href="\.\/styles\.css\?v=\d+">/);
    // The Profile pane mirrors the build badge (the rail is hidden on the narrow mobile / TMA layout, and TMA
    // webviews cache hard — this is the on-device way to verify which build a device runs).
    expect(html).toMatch(/id="profileVersionLabel"/);
    expect(app).toMatch(/setText\(profileVersionLabel, PLATHO_APP_RUNTIME_VERSION\)/);
    expect(app).toMatch(/setText\(appVersionLabel, PLATHO_APP_RUNTIME_VERSION\)/);
    // On-device private-routing diagnostic: tapping either build badge copies a routing snapshot to the clipboard
    // (the console-less TMA/iOS webview way to capture why a message routed to a given dialog). Keep it wired to
    // BOTH badges and keep the per-capsule sender-resolution ring that feeds it — do not strip while the owner is
    // still confirming the private-routing fixes across the device fleet.
    expect(app).toMatch(/function copyPrivateThreadDiagnostic\(\)/);
    expect(app).toMatch(/appVersionLabel\?\.addEventListener\('click', copyPrivateThreadDiagnostic\)/);
    expect(app).toMatch(/profileVersionLabel\?\.addEventListener\('click', copyPrivateThreadDiagnostic\)/);
    // The ring is fed from the LIVE direct-pay receive loop: a shard capsule arrives already bound to a conversation,
    // so the routing record is the (selfKeyId, peerKeyId) pair and the thread it selected — see recordConvRouteDebug.
    expect(app).toMatch(/recordConvRouteDebug\(\{ selfKeyId, peerKeyId, targetThread/);
    expect(app).toMatch(/function recordConvRouteDebug\(/);
    expect(app).toMatch(/senderResolve: plathoSenderResolveDebug/);
    expect(css).toMatch(/\.app-version-label/);
    expect(css).toMatch(/\.message\.out \.bubble\s*\{[\s\S]*?justify-self: end;/);
    expect(css).toMatch(/\.message\.in \.bubble\s*\{[\s\S]*?justify-self: start;/);
    expect(css).toMatch(/\.bubble \{[\s\S]*overflow-wrap:\s*anywhere;[\s\S]*word-break:\s*break-word;/);
    expect(css).toMatch(/\.message-text-block,[\s\S]*\.feed-block-text \{[\s\S]*overflow-wrap:\s*anywhere;[\s\S]*word-break:\s*break-word;/);
    expect(html).toMatch(/<h1>Platho\.app<\/h1>[\s\S]*Private chats/);
    expect(html).toMatch(/<h1>Platho\.app<\/h1>[\s\S]*Public channels/);
    expect(html).toMatch(/<h1>Platho\.app<\/h1>[\s\S]*Vault/);
    expect(html).toMatch(/<h1>Platho\.app<\/h1>[\s\S]*Profile/);
    expect(html).toMatch(/id="backToChatsButton"/);
    expect(html).toMatch(/aria-label="Private"/);
    expect(html).toMatch(/<span data-i18n="nav\.private">Private<\/span>/);
    expect(html).toMatch(/Search private/);
    expect(html).toMatch(/id="recipientLocalLabel"/);
    expect(html).toMatch(/Optional, e\.g\. Anonymous/);
    expect(html).toMatch(/Use a Platho name, \.ath, \.ton, or wallet address/);
    expect(html).toMatch(/alex, alex\.ath, alex\.ton, or EQ\.\.\./);
    expect(html).toMatch(/Local label is only shown on this device/);
    expect(html).toMatch(/id="identityMenuButton"/);
    // v769: the "+" add-menu is gone — image/file/link moved into the formatting toolbar; the
    // anonymous/wallet-visibility button stays on the row. (Payment checks were removed entirely.)
    expect(html).toMatch(/id="privateComposerToolbar"/);
    expect(html).not.toMatch(/id="privateComposerAddButton"/);
    expect(html).not.toMatch(/id="privateComposerAddMenu"/);
    expect(html).not.toMatch(/id="paymentCheckButton"/);
    expect(html).toMatch(/id="privateAnonymousButton"/);
    expect(html).toMatch(/icon-eye-off/);
    expect(enCopy).toMatch(/Recipient will see your wallet address/);
    expect(enCopy).toMatch(/Pseudonymous: wallet address hidden, sender key may still link messages/);
    expect(app).toMatch(/icon\.classList\.toggle\('icon-eye', !anonymous\)/);
    expect(app).toMatch(/icon\.classList\.toggle\('icon-eye-off', anonymous\)/);
    expect(html).toMatch(/aria-label="Choose display name"/);
    // Usernames are shown canonically (no ".ath"): displayIdentityLabel routes the non-wallet branch
    // through canonicalUsernameDisplay. Full coverage in PWA-CANONICAL-USERNAME-01.
    expect(app).toMatch(/function displayIdentityLabel\(identity\)[\s\S]*canonicalUsernameDisplay\(identity\.label \?\? identity\.value \?\? ''\)/);
    expect(css).toMatch(/\.identity-label-ton\s*\{\s*color:\s*#9fd3f2;/);
    expect(css).toMatch(/\.identity-label-platho\s*\{\s*color:\s*#8fdcc8;/);
    expect(app).toMatch(/function identityDisplayOptions\(thread\)[\s\S]*subtitle: t\('chat\.localName'\)[\s\S]*uniqueDisplayIdentityVariants\(thread\)/);
    expect(EN_STRINGS['chat.localName']).toBe('Local name');
    expect(app).toMatch(/thread\.displayIdentity = selected\.identity \?\? null/);
    expect(app).toMatch(/persistThreadDisplayPreference\(thread\)/);
    expect(app).toMatch(/function threadSelectedIdentity\(thread\)[\s\S]*if \(thread\?\.localLabel\) return null/);
    expect(app).toMatch(/async function verifiedPlathoUsernameIdentityForWallet\(label, walletAddress\)/);
    expect(app).toMatch(/resolvePlathoUsernameOwner\(identity\.value\)/);
    expect(app).toMatch(/sameWalletAddress\(resolved\.ownerWallet, rawWallet\)/);
    // (The receive-side senderUsername pickup went with the Hub routers. The SEND side still stamps it —
    // currentPrivateSenderOptions, pinned in PWA-MSG-02B — and the label a dialog wears is revalidated against the
    // chain on open and on receipt, pinned in PWA-USERNAME-TRANSFER-01.)
    // Any thread (incl. one auto-created from an incoming message) can set/edit a private local name from
    // the "Display as" menu — not only threads created via New Chat's local-label field.
    expect(app).toMatch(/async function promptThreadLocalLabel\(thread\)/);
    expect(app).toMatch(/thread\.localLabel = next;\s*thread\.displayIdentity = null/);
    // The local name is edited via a pencil button on its own row (createPencilIcon) instead of a
    // separate "Edit local name" menu item; a plain "Set local name" action only shows when none exists.
    expect(app).toMatch(/function createPencilIcon\(\)/);
    expect(app).toMatch(/className = 'identity-variant-edit'/);
    expect(app).toMatch(/setAttribute\('aria-label', t\('chat\.editLocalName'\)\)/);
    expect(EN_STRINGS['chat.editLocalName']).toBe('Edit local name');
    expect(app).toMatch(/if \(!localLabelExists\) \{[\s\S]*t\('chat\.setLocalName'\)/);
    expect(EN_STRINGS['chat.setLocalName']).toBe('Set local name');
    expect(app).toMatch(/identity-variant-action/);
    expect(app).toMatch(/promptThreadLocalLabel\(thread\)\.catch/);
    // [OWNER 2026-08-03] The chevron no longer counts identities at all. It used to be hidden below a threshold, which
    // silently hid "Set local name" — the popover's own first item, and the only way to rename a dialog. See
    // PEERNAME-07 in tests/peer-username-from-wire.test.ts for the full rule and its counter-case.
    expect(app).toMatch(/identityMenuButton\.hidden = identityMenuHidden\(thread\);/);
  });

  it('PWA-CONFIG-01H: Public wallet channels share the Private "Display as" name + avatar per counterparty', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');

    // Shared, counterparty-keyed display preference store (distinct from the self-presentation store).
    expect(app).toMatch(/CONTACT_DISPLAY_PREFERENCE_STORAGE_PREFIX = 'platho\.contact\.displayPreference\.v1'/);
    expect(app).toMatch(/function readContactDisplayPreference\(counterpartyWallet\)/);
    expect(app).toMatch(/function writeContactDisplayPreference\(counterpartyWallet, preference\)/);
    expect(app).toMatch(/function resolveContactDisplay\(counterpartyWallet\)/);

    // Private -> Public and Public -> Private halves of the sync.
    expect(app).toMatch(/function syncThreadDisplayToContactStore\(thread\)/);
    expect(app).toMatch(/function applyContactDisplaySelection\(counterpartyWallet/);
    expect(app).toMatch(/function hydrateThreadDisplayFromContactStore\(thread\)/);
    expect(app).toMatch(/threads\.forEach\(hydrateThreadDisplayFromContactStore\)/);

    // Public "Display as" menu reuses the same option builder + popover as Private.
    expect(app).toMatch(/function showPublicChannelDisplayPopover\(channel, anchor\)/);
    expect(app).toMatch(/options: identityDisplayOptions\(context\)/);
    expect(app).toMatch(/function renderDisplayAsPopover\(\{ options, selectedKey, localLabelExists, anchor, onSelect, onSetLocalName \}\)/);

    // The user's OWN wallet channel offers their OWN linked username (.ath) as a "Display as" option too: it
    // never arrives via received posts (you don't receive your own), so contactDisplayContextForWallet injects
    // it for the own wallet — otherwise the own channel shows only the wallet address while others see the name.
    expect(app).toMatch(/function baseContactDisplayContextForWallet\(counterpartyWallet\)/);
    expect(app).toMatch(/sameWalletAddress\(counterpartyWallet, plathoWallet\.address\)/);
    expect(app).toMatch(/const ownUsername = readLinkedPlathoUsername\(plathoWallet\.address\)/);
    expect(app).toMatch(/if \(ownIdentity\) extraIdentities\.push\(ownIdentity\)/);
    expect(app).toMatch(/normalizeIdentityVariants\(\[\.\.\.extraIdentities, \.\.\.threadIdentityVariants\(base\)\]\)/);

    // Registry name overlay + per-wallet avatar resolution so feed, channels list and detail all show it.
    expect(app).toMatch(/\.map\(applyContactDisplayToRegistryChannel\)/);
    // Ф2: per-render memo (Map<rawWallet,url>) so the O(threads) findThreadByIdentityVariants scan runs at most once
    // per distinct author in a feed render, not once per item. Signature/call carry the optional memo.
    expect(app).toMatch(/function publicAvatarUrlForWallet\(walletAddress, memo = null\)/);
    expect(app).toMatch(/item\.avatarImageUrl \?\? publicAvatarUrlForWallet\(item\.authorWallet, avatarUrlMemo\)/);
  });

  it('PWA-CONFIG-01I: opening a private chat reuses the existing dialog, and the comments toggle reads its state', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');

    // "Private chat" from a Public wallet channel must land in the SAME dialog opened earlier under a
    // different identity (e.g. an .ath name) or address format, instead of creating a duplicate. Match
    // by exact id, then shared identity variant, then the same counterparty wallet compared as raw.
    expect(app).toMatch(/function findExistingRecipientThread\(newThread\)/);
    expect(app).toMatch(/const existing = findExistingRecipientThread\(result\.thread\)/);
    expect(app).toMatch(/findThreadByIdentityVariants\(threads, threadIdentityVariants\(newThread\)\)/);
    expect(app).toMatch(/sameWalletAddress\(wallet, newWallet\)/);

    // Comments toggle is unambiguous: ON = accent (no slash); OFF = muted with a diagonal slash.
    expect(css).toMatch(/\.composer-post-option::after\s*{[\s\S]*?transform: translate\(-50%, -50%\) rotate\(-45deg\);/);
    expect(css).toMatch(/\.composer-post-option:has\(input:checked\)::after\s*{\s*opacity: 0;/);
    expect(app).toMatch(/function updatePublicCommentsToggleUi\(\)/);
    expect(app).toMatch(/t\('public\.commentsOnTapOff'\) : t\('public\.commentsOffTapOn'\)/);
    expect(EN_STRINGS['public.commentsOnTapOff']).toBe('Comments on - tap to turn off');
    expect(EN_STRINGS['public.commentsOffTapOn']).toBe('Comments off - tap to turn on');

    // Feed-mode posts fill the column width (consistent with the compact cards), not capped to image width.
    expect(css).toMatch(/\.public-feed\[data-public-mode="feed"\] > \.feed-item:not\(\.compact\)\s*{[\s\S]*?width: 100%;/);

    const mjs = readFileSync('web/public-channel-subscriptions.mjs', 'utf8');
    // (1) A wallet post shows its author/channel name ONCE: dropped from message.meta, and no title
    // fallback to the channel name (the live name comes from thread.name in the feed item).
    // v791: the header meta is the DATE only — publishStatus is NOT included here (buildPublicFeedArticle renders it as
    // a separate LIVE .public-publish-status badge, so including it in the meta printed the status TWICE while sending).
    expect(mjs).toMatch(/meta: shortTime\(post\.createdAt\) \?\? ''/);
    expect(mjs).not.toMatch(/meta: \[post\.publishStatus, shortTime/);
    expect(mjs).toMatch(/title: message\.publicPostTitle \?\? null/);
    // (2) Posts are marked read when actually viewed (Public tab active). F2 render cap: only the rendered window
    // (newest publicFeedShownCap items) is marked read -- older posts held behind "show older" are not pre-cleared.
    // (v753: additionally overlay-guarded — not marked while the post detail / discovery / channel view covers
    // the feed; the full guard is pinned in PWA-CHANNEL-VIEW-01.)
    expect(app).toMatch(/isPublicViewActive\(\) && !publicPostDetailOpen && !publicDiscoveryOpen && !publicChannelViewOpen\s*&& markVisiblePublicFeedRead\(windowItems\)/);
    // The "Display as" chevron + Unfollow live on the feed post cards: renderPublicFeed adds the chevron, and the
    // shared post actions add Unfollow when the post's channel is subscribed (incl. the official platho channel).
    expect(app).toMatch(/const feedIdentityButton = publicItemIdentityButton\(item\)/);
    expect(app).toMatch(/if \(!isOwnPost && isPublicChannelSubscribed\(item\.channelId\)\)/);
  });

  it('PWA-CONFIG-01C: profile keeps postquantum messaging fixed without an encryption selector', () => {
    const html = readFileSync('web/index.html', 'utf8');
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    const manifest = readFileSync('web/manifest.webmanifest', 'utf8');

    expect(html).not.toMatch(/id="keySuiteSelect"/);
    expect(html).not.toMatch(/Private message encryption type/);
    expect(html).not.toMatch(/Postquantum - from 0\.0347 TON/);
    expect(app).not.toMatch(/keySuiteSelect|keySuiteStatus|KEY_SUITE_PREF_KEY/);
    expect(html).toMatch(/id="actionDialog"/);
    expect(html).toMatch(/id="createWalletButton"/);
    expect(html).toMatch(/id="createWalletStatus"/);
    expect(html).toMatch(/id="importWalletButton"/);
    expect(html).toMatch(/id="importWalletStatus"/);
    expect(html).toMatch(/id="unlockWalletButton"/);
    expect(html).toMatch(/id="changeWalletPasswordButton"/);
    expect(html).toMatch(/id="receiveWalletTonButton"/);
    expect(html).toMatch(/id="privateSenderModeSelect"/);
    // The row's label and its option read as one sentence — "Send private messages — with wallet address" —
    // because "Private sender" named a person and left the reader hunting for who that was (owner, 2026-08-07).
    // The option carries its OWN key: chat.shareWalletAddress is the composer eye's tooltip, where the same words
    // are an action rather than a choice.
    expect(html).toMatch(/data-i18n="chat\.privateSender">Send private messages</);
    expect(html).toMatch(/data-i18n="chat\.senderModeWithWallet">With wallet address</);
    expect(html).toMatch(/Anonymous/);
    expect(html).toMatch(/id="sendWalletTonButton"/);
    expect(html).toMatch(/id="unlockWalletStatus"/);
    expect(html).toMatch(/Receive GRAM/);
    expect(html).toMatch(/Send GRAM/);
    expect(html).toMatch(/id="exportWalletKeyButton"/);
    expect(html).toMatch(/id="importWalletKeyButton"/);
    expect(html).toMatch(/id="walletKeyBackupInput"/);
    expect(html).toMatch(/Export wallet key/);
    expect(html).toMatch(/Import wallet key/);
    expect(html).toMatch(/id="copyWalletAddressButton"/);
    expect(html).toMatch(/aria-label="Copy wallet address"/);
    expect(html).toMatch(/id="walletDisplayModeSelect"/);
    expect(html).toMatch(/<option value="address" data-i18n="wallet\.optionAddress">Address<\/option>/);
    expect(html).not.toMatch(/<option value="ton_dns"[^>]*>TON DNS<\/option>/);
    expect(html).toMatch(/<option value="platho_nft" data-i18n="wallet\.optionPlathoName">Platho name<\/option>/);
    expect(enCopy).toMatch(/Wallet address copied/);
    expect(app).toMatch(/flashWalletIdentityStatus/);
    expect(app).toMatch(/walletIdentityFlashTimer/);
    expect(app).toMatch(/copyTextToClipboard/);
    expect(app).toMatch(/confirmWalletReplacement/);
    expect(enCopy).toMatch(/Replace local wallet\?/);
    expect(enCopy).toMatch(/Export the current recovery phrase first/);
    expect(app).toMatch(/tone: 'muted'/);
    expect(enCopy).toMatch(/Import and replace/);
    expect(app).toMatch(/platho\.wallet\.encrypted\.v1/);
    expect(app).toMatch(/platho\.wallet\.recovery\.v1/);
    expect(app).toMatch(/AES-GCM-256/);
    expect(app).toMatch(/PBKDF2-SHA256/);
    expect(app).toMatch(/PLATHO_WALLET_PASSWORD_MIN_LENGTH = 10/);
    expect(app).toMatch(/PLATHO_WALLET_PASSWORD_RECOMMENDED_LENGTH = 20/);
    expect(enCopy).toMatch(/Use your browser password manager/);
    expect(app).not.toMatch(/generate-wallet-password/);
    expect(app).not.toMatch(/PasswordCredential/);
    expect(app).not.toMatch(/passwordrules/);
    expect(app).toMatch(/input\.minLength = field\.minLength/);
    expect(app).toMatch(/minLength: create \? PLATHO_WALLET_PASSWORD_MIN_LENGTH : undefined/);
    expect(app).toMatch(/storedNetworkGlobalId/);
    expect(app).toMatch(/PLATHO_WALLET_ADDRESS_METADATA_MISMATCH/);
    expect(enCopy).toMatch(/Password accepted, but stored wallet metadata is inconsistent/);
    expect(app).toMatch(/PLATHO_WALLET_KEY_BACKUP_KIND = 'platho\.wallet\.key\.backup\.v1'/);
    expect(app).toMatch(/walletKeyBackupFromRecord/);
    // The backup EXPORT is the live mechanism (the offer dialog was superseded by the quick-start backup step):
    // it is reachable from the warning row, from the quick-start nudge, and from the activation flow.
    expect(app).toMatch(/async function downloadEncryptedWalletKeyBackup\(/);
    expect(app).toMatch(/if \(walletKeyBackupPendingForStoredWallet\(\)\) \{\s*\n\s*openQuickStartAtBackup\(\);/);
    expect(app).toMatch(/if \(needsKeyBackup\) \{ await downloadEncryptedWalletKeyBackup\(\); \}/);
    // The copy that explains WHY lives on the quick-start backup step, which is the surface the user is actually
    // sent to (the standalone dialog's copy went with the dialog).
    expect(enCopy).toMatch(/Back up your wallet key/);
    expect(enCopy).toMatch(/Browser storage can be cleared - especially on iPhone Safari/);
    expect(app).toMatch(/encryptedWalletRecordFromBackup/);
    expect(app).toMatch(/exportEncryptedWalletKeyFile/);
    expect(app).toMatch(/importEncryptedWalletKeyFile/);
    expect(app).toMatch(/writeEncryptedPlathoWalletRecord/);
    expect(app).toMatch(/safeWalletKeyFilename/);
    expect(app).toMatch(/walletKeyBackupInput\?\.addEventListener\('change'/);
    expect(app).toMatch(/walletBytesToBase64/);
    expect(app).toMatch(/walletBase64ToBytes/);
    expect(app).toMatch(/closeOnBackdropClick/);
    expect(app).toMatch(/pointerStartedOnBackdrop/);
    expect(app).toMatch(/activeActionDialog\?\.dismissOnBackdrop === false/);
    expect(app).toMatch(/actionCancelButton\.hidden = !cancellable/);
    expect(app).toMatch(/actionCancelButton\.disabled = !cancellable/);
    expect(app).toMatch(/activeActionDialog\?\.dismissOnBackdrop !== false\) closeActionDialog\(null\)/);
    expect(app).toMatch(/dismissOnBackdrop = false/);
    expect(app).toMatch(/dismissOnBackdrop,/);
    expect(app).toMatch(/formAutocomplete: 'on'/);
    expect(app).toMatch(/input:not\(\[readonly\]\):not\(\[type="hidden"\]\):not\(\.password-manager-username\)/);
    expect(app).toMatch(/normalizeWalletPasswordInput/);
    expect(app).toMatch(/normalizedPassword === rawPassword/);
    expect(app).toMatch(/autocomplete: create \? 'new-password' : 'current-password'/);
    expect(app).toMatch(/type === 'credential-username'/);
    expect(app).toMatch(/password-manager-username/);
    expect(app).toMatch(/input\.style\.left = '-10000px'/);
    expect(app).toMatch(/input\.setAttribute\('aria-hidden', 'true'\)/);
    expect(app).toMatch(/walletPasswordManagerUsername\(passwordManagerUsername, passwordManagerNetworkGlobalId\)/);
    expect(app).toMatch(/formatTonUserFriendlyAddress\(value/);
    expect(app).toMatch(/testOnly: Number\(networkGlobalId\) === PLATHO_WALLET_NETWORK_GLOBAL_IDS\.TESTNET/);
    expect(app).toMatch(/actionForm\.method = config\.formMethod \?\? 'post'/);
    expect(app).toMatch(/actionForm\.action = config\.formAction \?\? window\.location\.href/);
    expect(app).toMatch(/window\.setTimeout\(\(\) => closeActionDialog\(values\), 0\)/);
    expect(app).toMatch(/spellcheck: false/);
    expect(app).toMatch(/requestPersistentLocalStorage/);
    expect(app).toMatch(/navigator\.storage/);
    expect(app).toMatch(/storageManager\.persisted/);
    expect(app).toMatch(/storageManager\.persist\(\)/);
    expect(app).toMatch(/platho\.storage\.persistence\.v1/);
    expect(app).toMatch(/WALLET_AUTO_LOCK_MS/);
    expect(app).toMatch(/requestNewWalletStoragePassword/);
    expect(app).toMatch(/changeStoredPlathoWalletPassword/);
    expect(enCopy).toMatch(/Change wallet password/);
    expect(enCopy).toMatch(/Set new wallet password/);
    expect(enCopy).toMatch(/Password changed/);
    expect(enCopy).toMatch(/Wallet key exported/);
    expect(enCopy).toMatch(/Wallet key imported/);
    expect(app).toMatch(/showReceiveWalletTonDialog/);
    expect(app).toMatch(/createWalletReceiveQrNode/);
    expect(app).toMatch(/createQrSvgDataUrl/);
    expect(app).toMatch(/submitWalletTonTransfer/);
    // The "Source" row still names where the GRAM comes from. It used to add "not Vault" — copy from an architecture
    // that was deleted, which VAULTWORD-01 now forbids outright (owner, 2026-08-07).
    expect(enCopy).toMatch(/local Platho wallet/);
    expect(app).toMatch(/GRAM transfer submitted/);
    expect(app).toMatch(/confirmWalletPasswordForExport/);
    expect(app).toMatch(/lockPlathoWallet/);
    expect(app).toMatch(/lockPlathoWalletForBackground/);
    expect(app).toMatch(/walletUnlockPromptPending/);
    expect(app).toMatch(/armWalletUnlockPrompt/);
    expect(app).toMatch(/scheduleWalletUnlockPrompt/);
    expect(app).toMatch(/shouldOpenWalletUnlockPrompt/);
    expect(app).toMatch(/promptStoredWalletUnlockOnStartup/);
    expect(app).toMatch(/lastWalletUnlockAt/);
    expect(app).toMatch(/shouldIgnoreTransientWalletLock/);
    expect(app).toMatch(/window\.addEventListener\('pageshow'/);
    expect(app).not.toMatch(/plathoWallet = await loadPlathoWallet\(\);/);
    expect(app).not.toMatch(/scheduleWalletUnlockPromptAfterResume/);
    expect(app).not.toMatch(/walletUnlockPromptAfterResume/);
    expect(app).not.toMatch(/startupWalletUnlockPromptAttempted/);
    expect(app).toMatch(/syncViewportCssVars/);
    expect(app).toMatch(/visualViewport/);
    expect(css).toMatch(/--app-viewport-height/);
    // The on-screen keyboard must RESIZE the layout viewport (so 100dvh/--app-viewport-height shrink and the
    // header stays put), not scroll the full-height layout viewport and push the header off the top.
    expect(html).toMatch(/name="viewport"[^>]*interactive-widget=resizes-content/);
    expect(html).toMatch(/class="profile-scroll-content"/);
    expect(html).toMatch(/class="wallet-scroll-content"/);
    expect(css).toMatch(/\.profile-scroll-content/);
    expect(css).toMatch(/\.wallet-scroll-content/);
    expect(css).toMatch(/overflow-y: auto/);
    // v705: overflow-y:auto alone computes overflow-x to auto, and iOS rubber-bands an auto axis even with
    // zero horizontal overflow — the Vault/Profile scrollers pin the x axis shut and hand horizontal
    // gestures back via pan-y (the same cure the chat strip / feed scrollers use).
    expect(css).toMatch(/\.wallet-scroll-content,\s*\.profile-scroll-content \{[\s\S]*?overflow-x: hidden;[\s\S]*?touch-action: pan-y;[\s\S]*?\}/);
    expect(css).toMatch(/scrollbar-width: none/);
    expect(css).toMatch(/::-webkit-scrollbar/);
    expect(css).not.toMatch(/@media \(min-width: 901px\) and \(max-width: 1180px\)/);
    expect(css).toMatch(/\.app-shell\s*{[\s\S]*max-width: 100vw;[\s\S]*overflow: hidden;/);
    expect(css).toMatch(/\.workspace\s*{[\s\S]*grid-template-columns: minmax\(280px, clamp\(280px, 32vw, 392px\)\) minmax\(0, 1fr\);/);
    // The settings-list grid column must be capped at the container width, else its widest child (the RPC-key
    // row's label + input placeholder + "recommended" + Get) sizes the implicit auto column past a narrow
    // phone viewport and stretches every Profile row off the right edge.
    expect(css).toMatch(/\.settings-list\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\);\s*\}/);
    // A settings/select-row label that wraps to two lines must stay flush-left (buttons default to
    // text-align:center, which would center the wrapped label and look inconsistent with single-line rows).
    expect(css).toMatch(/\.settings-list button > span,\s*\.settings-select-row > span\s*\{\s*text-align: left/);
    expect(css).toMatch(/\.chat-pane\s*{[\s\S]*max-width: 100%;[\s\S]*overflow: hidden;/);
    expect(css).toMatch(/\.conversation-header\s*{[\s\S]*display: grid;[\s\S]*grid-template-columns: 64px minmax\(0, 1fr\) max-content;[\s\S]*overflow: hidden;/);
    expect(css).toMatch(/\.composer\s*{[\s\S]*max-width: 100%;[\s\S]*overflow: hidden;/);
    expect(css).toMatch(/\.message-strip\s*{[\s\S]*display: flex;[\s\S]*flex-direction: column;[\s\S]*overflow-y: auto;/);
    expect(css).toMatch(/\.message-strip::before\s*{[\s\S]*margin-top: auto;/);
    expect(css).toMatch(/\.message\.out\s*{[\s\S]*align-self: flex-end;/);
    expect(css).toMatch(/\.conversation-title h2,\s*\.conversation-title p\s*{\s*overflow: hidden;\s*text-overflow: ellipsis;\s*white-space: nowrap;/);
    expect(css).toMatch(/\.header-actions\s*{\s*display: flex;\s*align-items: center;\s*justify-content: flex-end;\s*gap: 8px;\s*flex: 0 0 auto;\s*min-width: max-content;/);
    // Header geometry is a SINGLE SOURCE OF TRUTH: four :root variables drive every header (pane headers, the
    // public absolute cluster, the conversation/post-detail headers) — no per-class size/offset literals allowed.
    expect(css).toMatch(/--header-top-offset: 11px;\s*--header-height: 50px;\s*--header-button-size: 34px;\s*--header-button-inset: calc\(\(var\(--header-height\) - var\(--header-button-size\)\) \/ 2\);/);
    // ONE container-scoped rule sizes + fills every header control (identity chevron, docs, install, discover,
    // edit, back, refresh) — a new header button can never be missed by a per-class list.
    expect(readFileSync('web/index.html', 'utf8')).toMatch(/class="[^"]*\bidentity-menu-button\b[^"]*"[^>]*id="identityMenuButton"/);
    expect(css).toMatch(/\.pane-header \.icon-button,\s*\.public-header-actions \.icon-button,\s*\.conversation-header \.icon-button\s*{\s*width: var\(--header-button-size\);\s*height: var\(--header-button-size\);\s*background: #0d1012;/);
    // Action clusters pin to the bar TOP at the shared inset (font-scale-proof), same formula as the public
    // absolute cluster (top offset + inset) — so buttons sit at one y on every tab by construction.
    expect(css).toMatch(/\.pane-header \.header-actions,\s*\.conversation-header \.header-actions\s*{\s*align-self: start;\s*margin-top: var\(--header-button-inset\);/);
    expect(css).toMatch(/\.public-pane \.public-header-actions\s*{\s*position: absolute;\s*top: calc\(var\(--header-top-offset\) \+ var\(--header-button-inset\)\);/);
    expect(css).not.toMatch(/\.conversation-header \.docs-header-button,\s*\n?\s*\.conversation-header \.install-header-button\s*{\s*width: 40px/);
    expect(css).not.toMatch(/@media \(min-width: 680px\) and \(max-width: 900px\)/);
    expect(css).toMatch(/\.public-pane,\s*\.wallet-pane,\s*\.profile-pane,\s*\.list-pane\s*{\s*padding: var\(--header-top-offset\) 24px 24px;/);
    expect(css).toMatch(/\.list-pane\s*{\s*gap: 14px;\s*border-right: 0;\s*}/);
    // (v730: an explanatory comment now sits between margin and padding — the mobile composer padding is
    // inset-free because the tab bar below owns the safe area; see the mobile-block pins in PWA-MSG-01.)
    expect(css).toMatch(/\.public-composer\s*{\s*margin: 0 -24px -24px;[\s\S]{0,260}?padding: 8px 14px/);
    // Public composer is consistent with Private: full-bleed (no right gap). v769: the "+" add-menu and its
    // attachment button are gone (moved into the formatting toolbar); the public composer's leading input-row
    // control is the comments toggle, sized like the private anon button at both breakpoints.
    expect(css).toMatch(/\.public-composer\s*{[\s\S]*?max-width: none;/);
    expect(css).toMatch(/\.composer-post-option\s*{[\s\S]*?width: 44px;\s*height: 44px;/);
    expect(css).toMatch(/\.composer \.private-anonymous-button,\s*\.public-composer \.composer-post-option\s*{\s*width: 38px;\s*height: 44px;/);
    expect(css).toMatch(/\.balance-grid,\s*\.action-grid,\s*\.wallet-ton-group\s*{\s*grid-template-columns: 1fr;/);
    expect(app).toMatch(/walletBalanceInfoEndpoint/);
    expect(app).toMatch(/createTonRpcTransport/);
    expect(app).toMatch(/installConfiguredTonRuntime/);
    expect(app).toMatch(/plathoTonRpcTransport/);
    expect(app).toMatch(/plathoTonRpcEndpoint/);
    expect(app).toMatch(/plathoTonSendBocEndpoint/);
    expect(PLATHO_APP_CONFIG.profileRegistry.address).toBe('UQD6tZwZRgWhKv0jzTSN2qyq00ANGR29LVInsFkXwALRKL31');
    expect(PLATHO_APP_CONFIG.ath.masterAddress).toBe('UQCThzitzPXm2dH9psaVkZlkAcHqzCJjcBpD29b5closNbd7');
    expect(app).not.toMatch(/https:\/\/testnet\.toncenter\.com\/api\/v2\/getAddressInformation/);
    expect(app).not.toMatch(/https:\/\/toncenter\.com\/api\/v2\/getAddressInformation/);
    expect(app).toMatch(/fetchTonWalletBalance\(address\)/);
    expect(app).toMatch(/PLATHO_WALLET_PASSWORD_MANAGER_USERNAME = 'platho-local-wallet'/);
    expect(app).toMatch(/name: 'username'/);
    expect(app).toMatch(/autocomplete: 'username'/);
    expect(app).toMatch(/passwordManagerUsername: walletDraft\.address/);
    expect(app).toMatch(/passwordManagerUsername: wallet\.address/);
    expect(app).toMatch(/passwordManagerUsername: record\?\.address/);
    expect(app).toMatch(/passwordManagerNetworkGlobalId: walletDraft\.networkGlobalId/);
    expect(app).toMatch(/passwordManagerNetworkGlobalId: wallet\.networkGlobalId/);
    expect(app).toMatch(/passwordManagerNetworkGlobalId: record\?\.networkGlobalId/);
    expect(app).toMatch(/Encrypted wallet self-check failed/);
    expect(app).toMatch(/storage\?\.setItem\(PLATHO_WALLET_STORAGE_KEY, JSON\.stringify\(record\)\)/);
    expect(app).not.toMatch(/setItem\(PLATHO_WALLET_LEGACY_STORAGE_KEY/);
    expect(app).toMatch(/verifyWalletDisplayIdentity/);
    expect(app).not.toMatch(/LINKED_TON_DNS_STORAGE_PREFIX/);
    expect(app).not.toMatch(/readLinkedTonDnsName/);
    expect(app).not.toMatch(/writeLinkedTonDnsName/);
    expect(app).toMatch(/LINKED_PLATHO_USERNAME_STORAGE_PREFIX/);
    expect(app).toMatch(/readLinkedPlathoUsername/);
    expect(app).toMatch(/writeLinkedPlathoUsername/);
    expect(app).not.toMatch(/name resolves to this wallet/);
    expect(enCopy).toMatch(/permanent name, currently owned by this wallet/);
    expect(app).not.toMatch(/No TON DNS linked/);
    expect(app).not.toMatch(/Optional setup', value: 'Link TON DNS in Usernames and Avatars/);
    expect(enCopy).toMatch(/No \.ath name linked/);
    expect(app).toMatch(/t\('username\.optionalSetup'\), value: t\('username\.linkAthNameValue'\)/);
    expect(EN_STRINGS['username.optionalSetup']).toBe('Optional setup');
    expect(EN_STRINGS['username.linkAthNameValue']).toMatch(/Link \.ath name in Usernames and Avatars/);
    expect(app).not.toMatch(/Copied value/);
    expect(app).toMatch(/suppressProfileAvatarPicker/);
    expect(app).toMatch(/isProfileAvatarPickerSuppressed/);
    expect(app).toMatch(/walletDisplayModeSelect\?\.addEventListener\('pointerdown'/);
    expect(html).toMatch(/id="exportWalletSeedButton"/);
    expect(html).toMatch(/id="clearLocalDataButton"/);
    expect(html).toMatch(/Clear local data[\s\S]*id="clearLocalDataStatus"[\s\S]*device only/);
    expect(app).toMatch(/async function confirmClearLocalData/);
    expect(app).toMatch(/Type CLEAR/);
    expect(app).toMatch(/async function clearPlathoLocalData/);
    // v706: "Clear local data" ALSO wipes the Telegram CloudStorage mirror, FIRST and FAIL-CLOSED — without
    // it the Mini App boot restored the encrypted wallet from the cloud right after the clear (owner report:
    // unlock screen straight after clearing). Keys are ENUMERATED live (getKeys -> removeItems), not a
    // hardcoded list, and the wipe is timeout-bounded (CloudStorage callbacks can hang on mobile Telegram).
    const clearSource = app.slice(
      app.indexOf('async function clearPlathoLocalData'),
      app.indexOf('function refreshVaultTabLock'),
    );
    expect(clearSource).toMatch(/if \(!\(await clearTelegramCloudAppData\(\)\)\) \{\s*throw new Error/);
    const cloudClearSource = app.slice(
      app.indexOf('async function clearTelegramCloudAppData'),
      app.indexOf('function mirrorWalletRecordToTelegramCloud'),
    );
    expect(cloudClearSource).toMatch(/telegramCloudGetKeys\(\)/);
    expect(cloudClearSource).toMatch(/telegramCloudRemoveItems\(keys\)/);
    expect(cloudClearSource).toMatch(/Promise\.race\(\[run, delay\(8_000\)\.then\(\(\) => 'timeout'\)\]\)/);
    expect(cloudClearSource).toMatch(/if \(!telegramCloudStorage\(\)\) return true;/);
    // The remove helper fails CLOSED when the API is missing but keys exist (resolve(false)); an empty key
    // list is a clean success.
    expect(app).toMatch(/function telegramCloudRemoveItems\(keys\) \{[\s\S]*?if \(keys\.length === 0\) \{\s*resolve\(true\);/);
    expect(app).toMatch(/platho-local-message-history-v1/);
    expect(app).toMatch(/platho-local-security-v1/);
    expect(app).toMatch(/function deploymentStorageSuffix/);
    expect(app).toMatch(/function currentMessageHistoryDbName/);
    expect(app).toMatch(/createIndexedDbEncryptedMessageHistoryStore\(\{ dbName: currentMessageHistoryDbName\(\) \}\)/);
    expect(app).toMatch(/createIndexedDbReplayStore\(\{ dbName: currentReplayDbName\(\) \}\)/);
    expect(app).toMatch(/function publicChannelStorage/);
    expect(app).toMatch(/readPublicChannelFeedCache\(publicChannelStorage\(\)\)/);
    expect(app).toMatch(/writePublicChannelSubscriptions\(publicChannelStorage\(\), publicChannelSubscriptions\)/);
    expect(app).toMatch(/scopedStorageKey\(PUBLIC_READ_CURSORS_STORAGE_KEY\)/);
    expect(app).toMatch(/localStorageOrNull\(\)\?\.clear\(\)/);
    expect(app).toMatch(/globalThis\.sessionStorage\?\.clear\?\.\(\)/);
    expect(app).toMatch(/indexedDB\.databases\(\)/);
    expect(app).toMatch(/caches\.keys\(\)/);
    expect(app).toMatch(/navigator\.serviceWorker\?\.getRegistrations/);
    expect(html).toMatch(/<h2 data-i18n="common\.wallet">Wallet<\/h2>[\s\S]*id="createWalletButton"[\s\S]*id="unlockWalletButton"[\s\S]*id="changeWalletPasswordButton"[\s\S]*id="registerVaultKeysButton"/);
    // [OWNER 2026-08-03] The balance BUTTON is gone: the headline card at the top of the section already shows the
    // same number, and a second copy of it right below read as a different figure. The GRAM row is now just the two
    // money actions, and the headline card is the single place the balance is rendered.
    expect(html).toMatch(/Wallet GRAM[\s\S]*id="receiveWalletTonButton"[\s\S]*id="sendWalletTonButton"/);
    expect(html).not.toContain('walletTonBalanceButton');
    expect(html).not.toContain('walletTonBalanceStatus');
    expect(html).toMatch(/Activate Platho account[\s\S]*id="vaultDraftStatus"[\s\S]*wallet required/);
    // "Sync messages" removed 2026-08-07 — the header indicator on every tab already does it, and that row also
    // doubled as a state store, so it went with its accessors rather than being left as a dead node.
    expect(html).toMatch(/<h2 data-i18n="chat\.messages">Messages<\/h2>[\s\S]*id="replaceVaultKeysButton"/);
    expect(html).not.toMatch(/id="syncMessagesButton"|id="messageSyncStatus"/);
    expect(html).toMatch(/Replace message keys[\s\S]*activate account first/);
    expect(enCopy).toMatch(/up to date/);
    expect(app).toMatch(/hasActiveVaultMessagingKeys/);
    expect(app).toMatch(/hasActivePlathoAccount/);
    expect(app).toMatch(/plathoAccountActivationFeeLabel/);
    // The button is gone, and so is every reference to it: a querySelector that can never match plus a handler that
    // can never fire is the shape that made me chase a live control through dead code.
    expect(app).not.toContain('walletTonBalanceButton');
    expect(app).not.toContain('walletTonBalanceStatus');
    expect(app).toMatch(/Activate Platho account before sending/);
    expect(app).toMatch(/item\.disabled = false/);
    expect(app).not.toMatch(/item\.dataset\.tab !== 'profile'/);
    expect(app).not.toMatch(/!hasActivePlathoAccount\(\)[\s\S]*setView\('profile'\)/);
    expect(enCopy).toMatch(/Update ready - reload before sending/);
    expect(enCopy).toMatch(/reload app/);
    expect(app).toMatch(/await refreshVaultActivationStatus\(\{ skipGlobal: true \}\)/);
    expect(app).toMatch(/setText\(vaultRecordStatus, t\('common\.checking'\)/);
    expect(app).toMatch(/setText\(vaultDraftStatus, t\('common\.checking'\)/);
    expect(EN_STRINGS['common.checking']).toBe('checking');
    expect(app).not.toMatch(/rotate blocked/);
    expect(app).not.toMatch(/setText\(vaultRotateStatus, label\)/);
    expect(app).not.toMatch(/vaultDraftStatus\.textContent = 'ready'/);
    expect(enCopy).toMatch(/Export key and activate/);
    expect(app).toMatch(/backupConfirmed/);
    expect(app).toMatch(/activationConfirmed/);
    expect(app).toMatch(/downloadEncryptedWalletKeyBackup\(\)/);
    // Activation forces the key export ONLY when the key is not yet backed up; an imported / already-exported
    // wallet (markWalletKeyBackupDone cleared the pending flag) skips the download + the backup checkbox and
    // just confirms the on-chain activation.
    expect(app).toMatch(/const needsKeyBackup = walletKeyBackupPendingForStoredWallet\(\)/);
    expect(app).toMatch(/if \(needsKeyBackup\) \{ await downloadEncryptedWalletKeyBackup\(\); \}/);
    expect(app).toMatch(/submitLabel: needsKeyBackup \? t\('vault\.exportKeyAndActivate'\) : t\('vault\.activateAccount'\)/);
    expect(EN_STRINGS['vault.exportKeyAndActivate']).toBe('Export key and activate');
    expect(EN_STRINGS['vault.activateAccount']).toBe('Activate account');
    expect(app).toMatch(/VAULT_RECEIVE_CRYPTO_SUITE = CRYPTO_SUITES\.HYBRID_V1/);
    expect(app).toMatch(/loadMessagingIdentityFromWallet\(VAULT_RECEIVE_CRYPTO_SUITE\)/);
    expect(app).not.toMatch(/postquantum only/);
    expect(app).not.toContain('crypto_suite_mask} / ${localVaultDraft.json.pq_kem_pubkey_len}b');
    expect(html).toMatch(/id="setAvatarButton"/);
    expect(html).toMatch(/id="setAvatarStatus"/);
    expect(html).toMatch(/id="mintUsernameStatus"/);
    expect(html).toMatch(/id="profileAvatarInput"/);
    expect(html).toMatch(/Set avatar/);
    expect(app).toMatch(/readCurrentProfileAvatarPointerResultFromChain/);
    expect(app).toMatch(/KeyShard provider is required to read current avatar version/);
    expect(app).toMatch(/if \(view === 'profile' && plathoWallet\?\.address\)/);
    // Direct pay replaced the Vault avatar leg: the registry address is a config+manifest pin, the price is paid
    // as ATH from the user's own wallet, and there is no Vault route/canStart/registration external any more.
    expect(app).toMatch(/requireProfileRegistryAddress\(\)/);
    expect(app).toMatch(/amount: PROFILE_AVATAR_PRICE_ATH/);
    expect(app).not.toMatch(/assertVaultProfileAvatarCanStart|submitVaultProfileAvatarRegistration|requireProfileRegistryVaultRoute/);
    // "History sync" removed 2026-08-07; the Public channels section is now the comments default alone.
    expect(html).toMatch(/<h2 data-i18n="public\.channels">Public channels<\/h2>[\s\S]*id="publicCommentsDefaultSelect"/);
    expect(html).toMatch(/<h2 data-i18n="username\.usernamesAndAvatars">Usernames and Avatars<\/h2>[\s\S]*id="mintUsernameButton"[\s\S]*id="linkUsernameButton"[\s\S]*id="setAvatarButton"/);
    // The fee rows quote a NUMBER, not a currency (owner, 2026-08-07: "лучше явно написать сколько грам"), and it
    // is interpolated at runtime from the constants the wallet is asked to sign — see refreshProfileFeeLabels.
    // The markup keeps a matching literal as the pre-script fallback, so both are pinned to the same figures.
    expect(html).toMatch(/Mint \.ath name[\s\S]*100-10k ATH \+ 1\.1 GRAM/);
    expect(html).toMatch(/Set avatar[\s\S]*100 ATH \+ from 0\.2395 GRAM/);
    expect(html, 'these rows are written by refreshProfileFeeLabels, not by the param-less static pass')
      .not.toMatch(/id="(mintUsernameStatus|setAvatarStatus)"[^>]*data-i18n=/);
    const appSource = readFileSync('web/app.js', 'utf8');
    expect(appSource).toMatch(/function profileAvatarFloorNanotons\(\)/);
    expect(appSource).toMatch(/publicPublishValueForKind\(3\) \+ PROFILE_AVATAR_DIRECT_REQUEST_VALUE_NANOTONS/);
    expect(appSource).toMatch(/t\('username\.mintFee', \{[\s\S]{0,120}estimatedUsernameMintTonFeeNanotons\(\)/);
    expect(html).not.toMatch(/Link TON DNS[\s\S]*id="linkedTonDnsStatus"[\s\S]*verify/);
    expect(html).toMatch(/Link \.ath name[\s\S]*id="linkedUsernameStatus"[\s\S]*verify/);
    expect(app).not.toMatch(/linkTonDnsButton\?\.addEventListener\('click'/);
    expect(app).not.toMatch(/requestWalletDisplayIdentity\(WALLET_DISPLAY_MODES\.TON_DNS\)/);
    expect(app).toMatch(/linkUsernameButton\?\.addEventListener\('click'/);
    expect(app).toMatch(/requestWalletDisplayIdentity\(WALLET_DISPLAY_MODES\.PLATHO_NFT\)/);
    expect(app).toMatch(/setPublicChannelSubscribed/);
    expect(app).toMatch(/Unfollow/);
    expect(app).toMatch(/channel hidden/);
    expect(app).toMatch(/unfollowButton\.title = t\('public\.stopFollowingChannel'\)/);
    expect(EN_STRINGS['public.stopFollowingChannel']).toBe('Stop following this channel');
    expect(app).toMatch(/const linked = readLinkedPlathoUsername\(plathoWallet\.address\)/);
    expect(app).toMatch(/autoLinkMintedUsername/);
    expect(app).toMatch(/waitForPlathoUsernameOwnership/);
    expect(enCopy).toMatch(/mint submitted; link after sync/);
    expect(app).toMatch(/function usernameMintPricePreview/);
    expect(app).toMatch(/usernameMintPricePreview\(raw\)/);
    expect(app).toMatch(/USERNAME_PRICE_6_PLUS_CHARS_ATOMIC = 100_000_000_000n/);
    expect(app).toMatch(/function usernameMintStatusText/);
    expect(app).toMatch(/function setProfileAvatarStatus/);
    expect(app).toMatch(/function setUsernameMintStatus/);
    expect(app).toMatch(/setUsernameMintStatus\(rateLimited \? TON_RPC_CONNECTING_STATUS : usernameMintStatusText\(error\), rateLimited \? 'busy' : 'error'\)/);
    expect(app).toMatch(/estimatedUsernameMintTonFeeNanotons/);
    expect(app).toMatch(/t\('common\.gramCostValue', \{ amount: formatTonNanotons\(estimatedUsernameMintTonFeeNanotons\(\)\) \}\)/);
    expect(EN_STRINGS['common.gramCostValue']).toBe('up to {amount} GRAM from your wallet');
    // The mint dialog's "Route: Vault" line went with the Vault: under direct pay the request goes from the wallet
    // straight to UsernameRegistry, so the line named a hop that no longer exists.
    expect(app, 'no Vault route line survives').not.toMatch(/t\('username\.route'\)/);
    // (The "official ATH wallet is not the derived registry wallet" refusal belonged to the Vault route check —
    // direct pay sends the ATH transfer to the registry address from the config+manifest pin, with no declared
    // route to disagree with.)
    expect(enCopy).toMatch(/ATH; 50% goes to burn/);
    expect(html).toMatch(/Set avatar[\s\S]*100 ATH \+ from 0\.2395 GRAM/);
    expect(enCopy).toMatch(/Set profile avatar/);
    expect(app).toMatch(/requestProfileAvatarUploadDetails/);
    expect(app).toMatch(/estimatedProfileAvatarTonFeeNanotons/);
    expect(app).toMatch(/t\('avatar\.feeUpTo', \{ amount: formatTonNanotons\(estimatedProfileAvatarTonFeeNanotons\(attachment\)\), capsules: capsuleLabel \}\)/);
    expect(EN_STRINGS['avatar.feeUpTo']).toMatch(/up to \{amount\} GRAM/);
    expect(enCopy).toMatch(/Preview final image/);
    expect(html).toMatch(/id="imageLightboxDialog"/);
    expect(html).toMatch(/Full-size preview/);
    expect(html).toMatch(/id="imageLightboxDownloadButton"/);
    expect(html).toMatch(/class="icon icon-download"/);
    expect(html).toMatch(/<div class="image-lightbox-viewport">\s*<img id="imageLightboxImage" alt="Full-size final image preview" draggable="false" data-i18n-alt="dialog\.fullSizeImageAlt">\s*<\/div>\s*<\/section>\s*<\/div>/);
    expect(app).toMatch(/openImageLightbox/);
    expect(app).toMatch(/downloadImageLightboxImage/);
    expect(app).toMatch(/imageLightboxDownloadFilename/);
    expect(app).toMatch(/fullImageSrc/);
    expect(app).toMatch(/messageImageLightboxMeta/);
    expect(app).toMatch(/messageStrip\?\.addEventListener\('click'/);
    expect(app).toMatch(/messageStrip\?\.addEventListener\('keydown'/);
    expect(css).toMatch(/data-full-image-src/);
    expect(css).toMatch(/\.message-image,\s*\.feed-image\[data-full-image-src\]\s*{\s*cursor: zoom-in;/);
    expect(css).toMatch(/image-lightbox-viewport/);
    expect(css).toMatch(/max-height: calc\(var\(--app-viewport-height, 100dvh\)/);
    expect(css).toMatch(/\.image-lightbox-backdrop/);
    expect(css).toMatch(/\.image-lightbox-backdrop\s*{[\s\S]*place-items: center;/);
    expect(css).toMatch(/\.image-lightbox-actions/);
    expect(css).toMatch(/\.icon-download/);
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*\.modal-backdrop\s*{\s*align-items: center;/);
    // v725: on a short viewport (on-screen keyboard up) a dialog TOP-aligns and the backdrop scrolls the WHOLE
    // dialog (dialog max-height:none) so a focused textarea keeps its height instead of collapsing behind the
    // keyboard. MUST come after the max-width:900px block so it wins by source order (both media queries match).
    const shortVpIdx = css.indexOf('@media (max-height: 620px)');
    expect(shortVpIdx).toBeGreaterThan(css.indexOf('@media (max-width: 900px)'));
    const shortVp = css.slice(shortVpIdx, shortVpIdx + 420);
    expect(shortVp).toMatch(/\.modal-backdrop \{\s*align-items: start;\s*overflow-y: auto;/);
    expect(shortVp).toMatch(/\.action-dialog,\s*\n\s*\.quick-start-dialog \{\s*max-height: none;\s*overflow: visible;/);
    // The base action-dialog scrolls as a WHOLE (like quick-start), NOT via an inner .action-fields scroller that
    // trapped the scroll around a tall image preview and buried the quality dropdown below it (owner). So no
    // fields-only overflow scroller, and the whole dialog is capped + scrollable.
    expect(css).toMatch(/\.action-dialog \{\s*\n\s*max-height: calc\(var\(--app-viewport-height, 100dvh\) - 40px\);\s*\n\s*overflow-y: auto;\s*\n\s*\}/);
    expect(css).not.toMatch(/\.action-dialog > \.action-fields \{\s*\n\s*flex: 1 1 auto;/);
    expect(css).toMatch(/icon-open-app/);
    expect(enCopy).toMatch(/On-chain size/);
    expect(app).toMatch(/requestCompressedImageFile/);
    expect(enCopy).toMatch(/The final WebP bytes are encrypted before publish and verified by CapsuleHub hashes/);
    expect(enCopy).toMatch(/The final WebP bytes are public in the accepted TON transaction body and verified by CapsuleHub hashes/);
    expect(app).not.toMatch(/remain in on-chain capsules/);
    expect(app).toMatch(/encodeCanvasToWebp/);
    expect(app).toMatch(/isWebpBytes/);
    expect(app).toMatch(/nativeCanvasWebpEncodeSupported = false/);
    expect(app).toMatch(/Image encoder did not produce WebP bytes/);
    expect(enCopy).toMatch(/avatar media is public/);
    // The ATH block moved to the WALLET tab with the rest of the money surface, and its two stats swapped order on
    // purpose: "activity drop issued" is the number this user's own ATH comes from, so it leads; "current supply"
    // is protocol context and follows. Flush stays last — it is the action, after the numbers that justify it.
    expect(html).toMatch(/<h2>ATH<\/h2>[\s\S]*id="athDropIssuedStatus"[\s\S]*id="athSupplyStatus"[\s\S]*id="flushAthButton"[\s\S]*id="flushAthStatus"/);
    const walletPanel = html.slice(html.indexOf('data-panel="wallet"'), html.indexOf('data-panel="profile"'));
    expect(walletPanel, 'the ATH block lives in the Wallet tab now').toMatch(/id="flushAthButton"/);
    expect(html).toMatch(/id="replaceVaultKeysButton"/);
    expect(html).not.toMatch(/id="keySuiteStatus"/);
    expect(app).toMatch(/installActionState/);
    expect(enCopy).toMatch(/Got it/);
    expect(enCopy).toMatch(/Platho is already installed on this device/);
    expect(app).toMatch(/getInstalledRelatedApps/);
    expect(enCopy).toMatch(/Open Platho app/);
    expect(enCopy).toMatch(/Open or install Platho/);
    expect(enCopy).toMatch(/How to install on iPhone/);
    expect(app).toMatch(/isIosDevice/);
    expect(enCopy).toMatch(/Open platho\.app in Safari/);
    expect(enCopy).toMatch(/Choose Add to Home Screen/);
    expect(html).toMatch(/id="installSteps"/);
    expect(css).toMatch(/install-steps/);
    expect(css).toMatch(/wallet-receive-card/);
    expect(css).toMatch(/wallet-receive-qr/);
    expect(app).toMatch(/icon-open-app/);
    expect(html).toMatch(/aria-label="Open or install Platho"/);
    expect(html).toMatch(/class="icon icon-open-app"/);
    expect(app).toMatch(/const canInstall = state !== 'installed'/);
    expect(app).toMatch(/icon\?\.classList\.toggle\('icon-install', state === 'prompt'\)/);
    expect(app).toMatch(/icon\?\.classList\.toggle\('icon-open-app', state !== 'prompt'\)/);
    expect(app).toMatch(/installDismissButton\.hidden = state !== 'prompt'/);
    expect(app).toMatch(/updateViaCache: 'none'/);
    expect(app).toMatch(/controllerchange/);
    expect(app).toMatch(/handleServiceWorkerControllerChange/);
    expect(app).toMatch(/shouldDeferServiceWorkerReload/);
    expect(app).toMatch(/pendingServiceWorkerAppShellReload/);
    expect(enCopy).toMatch(/Update ready/);
    expect(app).toMatch(/window\.location\.reload\(\)/);
    expect(html).toMatch(/id="installLead"/);
    expect(html).toMatch(/id="installBody"/);
    expect(manifest).toMatch(/"platform": "webapp"/);
    expect(manifest).toMatch(/"url": "https:\/\/platho\.app\/manifest\.webmanifest"/);
    expect(html).toMatch(/id="publicCommentsDefaultSelect"/);
    expect(html).toMatch(/>Closed</);
    expect(html).toMatch(/>Allowed - not recommended</);
    expect(html).toMatch(/<option value="disabled" data-i18n="public\.commentsClosed">Closed<\/option>[\s\S]*<option value="enabled" data-i18n="public\.commentsAllowedNotRecommended">Allowed - not recommended<\/option>/);
    expect(html).toMatch(/id="walletAddressStatus"/);
    expect(html).toMatch(/id="mintUsernameButton"/);
    expect(html).not.toMatch(/id="flushUsernameRefundButton"/);
    expect(html).not.toMatch(/Claim failed mint refund/);
    expect(html).not.toMatch(/Claim username refund/);
    expect(html).not.toMatch(/id="transferAthButton"/);
    // Burn ATH row removed: it burned the external ATH wallet (normally ~0; user ATH lives in the Vault),
    // had no balance validation, and vault-ATH burn is infeasible (burn is wallet->ATHMaster only). The
    // protocol burn-due flush + buyback/burn remain the real supply-reduction path.
    expect(html).not.toMatch(/id="burnAthButton"/);
    expect(html).not.toMatch(/>Burn ATH</);
    expect(html).toMatch(/Flush ATH/);
    // The "Wallet and Vault are separate for security" note is GONE with the Vault tab. It described a contract
    // that no longer exists and funds that can no longer be moved anywhere — the one thing in it that is still
    // true (the ATH protocol-fee discount) is not a Vault property at all: the discount scales with the ATH
    // balance in the WALLET and unlocks when the activity airdrop is fully distributed (athDiscountBps).
    expect(html).not.toMatch(/Wallet and Vault are separate for security/);
    expect(html).not.toMatch(/vault\.pocketNote/);
    expect(html).toMatch(/data-nav-vault-balance/);
    // The headline balances are driven by the SAME refresh as the rail corner, so they cannot disagree with it.
    expect(html).toMatch(/class="wallet-headline is-pending"[^>]*data-nav-vault-balance/);
    // Starts empty (space reserved, content invisible) so there is no flash of the default "0 GRAM/0 ATH".
    expect(html).toMatch(/class="rail-vault-balance is-pending"[^>]*data-nav-vault-balance/);
    expect(html).toMatch(/data-nav-vault-ton>0 GRAM<\/strong>/);
    expect(html).toMatch(/data-nav-vault-ath>0 ATH<\/strong>/);
    expect(css).toMatch(/\.rail-vault-balance/);
    expect(css).toMatch(/\.rail-vault-balance\s*{[\s\S]*grid-template-rows:\s*auto auto auto/);
    expect(css).toMatch(/\.rail-vault-balance strong\s*{[\s\S]*white-space: normal;/);
    // The rail balance shows nothing until known (no spinner — the global sync indicator covers activity), then
    // fades in. The old is-loading/is-placeholder spinner rules are gone; rail-balance-spin keyframe is KEPT for
    // the global header sync indicator.
    expect(css).not.toMatch(/\.rail-vault-balance strong\.is-loading/);
    expect(css).not.toMatch(/\.rail-vault-balance strong\.is-placeholder/);
    expect(css).toMatch(/\.rail-vault-balance-reveal\s*{\s*animation: rail-balance-fade-in/);
    // The block keeps its layout slot while unknown (only the content is invisible via opacity) so the rail buttons
    // do not shift when the balance arrives — NOT display:none.
    expect(css).toMatch(/\.rail-vault-balance\.is-pending\s*{\s*opacity: 0;/);
    expect(css).not.toMatch(/\.rail-vault-balance\[hidden\]/);
    expect(css).toMatch(/@keyframes rail-balance-fade-in/);
    expect(css).toMatch(/@keyframes rail-balance-spin/);
    expect(css).toMatch(/--message-media-width:\s*320px/);
    expect(css).toMatch(/--message-card-width:\s*calc\(var\(--message-media-width\) \+ 28px\)/);
    expect(css).toMatch(/\.message \{[\s\S]*max-width:\s*min\(var\(--message-card-width\), 82%\)/);
    expect(css).toMatch(/\.message \{[\s\S]*min-width:\s*0;[\s\S]*overflow-wrap:\s*anywhere;/);
    expect(css).toMatch(/\.bubble \{[\s\S]*width:\s*fit-content;[\s\S]*min-width:\s*0;[\s\S]*max-width:\s*100%;/);
    // Private chat-bubble images keep the narrow bubble media cap (v747 split .message-image OFF the wider public
    // .feed-image, which is covered by PWA-FEED-IMAGE-FIT-01).
    expect(css).toMatch(/\.message-image \{[\s\S]*max-width:\s*var\(--message-media-width\)/);
    expect(css).toMatch(/\.public-feed\[data-public-mode="feed"\] > \.feed-item:not\(\.compact\) \{[\s\S]*width: 100%;/);
    expect(app).toMatch(/navVaultTonBalances/);
    expect(app).toMatch(/let navVaultBalanceState = \{/);
    expect(app).toMatch(/function markNavVaultBalancePending/);
    expect(app).toMatch(/function markNavVaultBalanceReady/);
    expect(app).toMatch(/function scheduleNavVaultBalanceRetry/);
    expect(app).toMatch(/function navVaultBalanceHasKnownValue/);
    expect(app).toMatch(/refreshNavVaultBalance\(\)/);
    expect(app).toMatch(/function refreshVaultNavBalanceInBackground/);
    expect(app).toMatch(/const navVaultBalanceContainers = \[\.\.\.document\.querySelectorAll\('\[data-nav-vault-balance\]'\)\]/);
    // Empty-but-space-reserved until known (no spinner, no layout shift), one-shot fade-in on first fill.
    const navBalanceFn = app.slice(app.indexOf('function refreshNavVaultBalance()'), app.indexOf('function refreshVaultMoveWidget'));
    expect(navBalanceFn).toMatch(/if \(!navVaultBalanceHasKnownValue\(\)\) \{[\s\S]*container\.classList\.add\('is-pending'\)[\s\S]*container\.classList\.remove\('rail-vault-balance-reveal'\)/);
    expect(navBalanceFn).toMatch(/if \(container\.classList\.contains\('is-pending'\)\) \{[\s\S]*?container\.classList\.remove\('is-pending'\)[\s\S]*?container\.classList\.add\('rail-vault-balance-reveal'\)/);
    expect(navBalanceFn).not.toMatch(/is-loading|is-placeholder|container\.hidden/);
    expect(html).not.toMatch(/Wallet runtime|Key auth|Vault record|Replay store|Local state/);
    expect(app).not.toMatch(/window\.prompt|window\.alert/);
    expect(html).not.toMatch(/Messaging key backup|exportMessagingKeyBackupButton|importMessagingKeyBackupButton|messagingKeyBackupInput/);
    expect(html).not.toMatch(/Transport|QR key|Copy key|Save key|Share capsule|Save capsule|Open file|Paste package JSON/);
    expect(html).not.toMatch(/<option value="hybrid-v1">Postquantum . from 0\.0347 TON<\/option>/);
    expect(html).not.toMatch(/value="classical-v1"/);
    expect(app).toMatch(/return CRYPTO_SUITES\.HYBRID_V1/);
  });

  it('PWA-CONFIG-01D: composers are multiline and wallet-confirmed private mode is one segment', () => {
    const html = readFileSync('web/index.html', 'utf8');
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');

    expect(html).not.toMatch(/<div id="messageInput"[^>]*maxlength=/);
    expect(html).not.toMatch(/<div id="publicMessageInput"[^>]*maxlength=/);
    expect(html).not.toMatch(/1024 bytes max/);
    expect(app).toMatch(/removeAttribute\('maxlength'\)/);
    expect(html).toMatch(/id="privateComposerCostStatus"/);
    expect(html).toMatch(/id="publicComposerCostStatus"/);
    expect(html).not.toMatch(/Price checking\s+Wallet required/);
    expect(app).toMatch(/if \(!plathoWallet\) \{/);
    expect(app).toMatch(/text: t\('common\.walletRequired'\)/);
    expect(EN_STRINGS['common.walletRequired']).toBe('Wallet required');
    expect(app).toMatch(/return publicCommentTarget \? t\('composer\.publicComment'\) : t\('composer\.publicMessage'\)/);
    expect(EN_STRINGS['composer.publicComment']).toBe('Public comment');
    expect(EN_STRINGS['composer.publicMessage']).toBe('Public message');
    expect(app).toMatch(/return t\('composer\.privateMessage'\)/);
    expect(EN_STRINGS['composer.privateMessage']).toBe('Private message');
    expect(html).toMatch(/id="publicComposer"/);
    expect(html).toMatch(/id="publicComposerCommentsCheckbox"/);
    expect(html).toMatch(/id="publicComposer"[\s\S]*id="publicComposerCommentsCheckbox"[\s\S]*<div id="publicMessageInput"[^>]*contenteditable="true"/);
    expect(html).toMatch(/Allow comments/);
    expect(enCopy).toMatch(/Open public comments\?/);
    expect(enCopy).toMatch(/Publish with comments/);
    expect(app).toMatch(/Private chat/);
    expect(app).toMatch(/openPrivateThreadForWallet/);
    expect(enCopy).toMatch(/Add public channel/);
    expect(enCopy).toMatch(/ATH protocol-fee discount/);
    expect(enCopy).toMatch(/locked until activity airdrop is fully distributed/);
    expect(enCopy).toMatch(/Platho fee 0 GRAM/);
    expect(enCopy).toMatch(/max reduction 0.010 GRAM/);
    expect(app).not.toMatch(/ATH discount \$\{percent\}/);
    expect(app).not.toMatch(/locked until 15%/);
    expect(app).toMatch(/messageDiscountUnlocked/);
    expect(app).toMatch(/Cost/);
    expect(app).toMatch(/Hold/);
    expect(app).toMatch(/composerEstimatedNetCostNanotons/);
    expect(app).toMatch(/composerProfileNetPriceNanotons/);
    // The pre-sign price/surcharge dialogs (confirmPublishPriceIncrease, confirmHighNetworkFeeSurcharge) and the
    // surcharge cap gate went with the Vault publish trunk: they guarded a REFUNDABLE contract hold quoted at
    // sign time. A direct-pay part carries a fixed message value, so the composer estimate below is the whole
    // story and there is nothing to re-confirm between quote and signature.
    expect(app).not.toMatch(/confirmPublishPriceIncrease|confirmHighNetworkFeeSurcharge|assertNetworkFeeSurchargeWithinCap/);
    expect(app).not.toMatch(/prepareCapsulesThroughVault|sendPreparedCapsulesThroughVault|publishCapsulesThroughVault/);
    // setPublishPartStatus / confirmCapsuleHubPublishEntries went with the Vault batch (a direct-pay message has no
    // per-part status to set and no Hub entry to scan). The status VOCABULARY the composer renders is still pinned.
    expect(app).toMatch(/function publishStateBroadcastCount/);
    expect(app).toMatch(/CAPSULEHUB_PUBLISH_STATUS_CONFIRMED/);
    expect(app).toMatch(/VAULT_PUBLISH_STATUS_PARTIAL/);
    expect(app).toMatch(/`submitted \$\{landed\}\/\$\{total\}`/);
    expect(app).toMatch(/`confirming \$\{confirmed\}\/\$\{total\}`/);
    expect(app).toMatch(/updateMessageInEncryptedHistory/);
    expect(app).toMatch(/isPublishPriceChangeCancelled/);
    expect(app).toMatch(/publish cancelled/);
    // The Vault publish HOLD preflight (assertVaultHasPrivatePublishHold / "Not enough Vault GRAM") is gone with the
    // custody it reserved against. Direct pay checks the two things that can actually fail — the wallet's ATH and its
    // GRAM — right before signing, and names the shortfall in the error (PWA-PUBLIC-DIRECT-01 pins the call sites).
    expect(app).not.toMatch(/async function assertVaultHasPrivatePublishHold/);
    expect(app).toMatch(/async function assertConnectedAthAtLeast\(requiredAtomic, action\)/);
    expect(app).toMatch(/async function assertWalletGramAtLeast\(requiredNanotons, action\)/);
    // The shortfall message is LOCALIZED (2026-08-04): both handlers print error.message verbatim into the status
    // line, so an English template was a status only English readers could act on — on the one screen where the
    // number is the whole point. The action is no longer in the sentence; it rides on the error for the console.
    expect(app).toMatch(/new Error\(t\('errors\.notEnoughAth', \{ need: formatAthAtomic\(required\), have: formatAthAtomic\(balance\) \}\)\)/);
    expect(app).toMatch(/new Error\(t\('errors\.walletNeedsGram', \{ amount: formatTonNanotons\(required\) \}\)\)/);
    expect(app, 'no English shortfall template survives').not.toMatch(/Not enough ATH to |Wallet needs ~/);
    expect(app, 'which flow refused stays available to the console').toMatch(/error\.action = action;/);
    expect(app).not.toMatch(/Checking Vault balance/);
    expect(app).toMatch(/privateComposerKnownVaultTonShortfall/);
    expect(app).toMatch(/networkFeeSurchargeNanotons/);
    // (The surcharge copy explained where a CapsuleHub reserve surplus went. There is no reserve and no surcharge
    // under direct pay — the publisher pays the message value and the fee flows through the shard to the pool.)
    expect(app).toMatch(/function privateImageAttachmentPartCount/);
    expect(app).toMatch(/partCounter: kind === 'private' \? privateImageAttachmentPartCount : imageAttachmentPartCount/);
    expect(app).toMatch(/partCounter: options\.partCounter/);
    expect(enCopy).toMatch(/Local label/);
    expect(app).not.toMatch(/Shown as/);
    expect(app).toMatch(/resolvePublicChannelIdentity/);
    expect(html).toMatch(/id="privateImageButton"/);
    expect(html).toMatch(/id="publicImageButton"/);
    expect(html).toMatch(/Low 8 KiB/);
    expect(html).toMatch(/Medium 16 KiB/);
    expect(html).toMatch(/Good 32 KiB/);
    expect(html).toMatch(/Maximum 64 KiB/);
    expect(css).toMatch(/\.conversation-title\s*{[\s\S]*max-width: 100%;[\s\S]*overflow: hidden;/);
    expect(app).toMatch(/function threadUnreadCount/);
    expect(app).toMatch(/function markIncomingThreadMessage/);
    expect(app).toMatch(/markThreadRead\(thread\)/);
    expect(app).toMatch(/thread-unread-badge/);
    expect(css).toMatch(/\.thread-unread-badge/);
    // v732: the unread badge is a COUNT-ONLY pill ("3", "99+") — the localized word ("непрочитанное") wrapped it
    // onto two lines in the narrow side column. The localized phrase stays for screen readers (aria-label).
    expect(app).toMatch(/badge\.textContent = unread > 99 \? '99\+' : String\(unread\);/);
    expect(app).toMatch(/badge\.setAttribute\('aria-label', unread > 99 \? t\('chat\.unreadOverflow'\) : tPlural\('chat\.unreadCount', unread\)\);/);
    expect(css).toMatch(/\.thread-unread-badge\s*{[\s\S]{0,400}?text-align: center;\s*\n\s*white-space: nowrap;/);
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*\.conversation-header\s*{[\s\S]*display: grid;[\s\S]*grid-template-columns: var\(--header-button-size\) 44px minmax\(0, 1fr\) max-content;/);
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*\.conversation-header \.conversation-title h2,\s*\.conversation-header \.conversation-title p,\s*\.conversation-header \.identity-title-label\s*{[\s\S]*max-width: 100%;/);
    expect(css).toMatch(/\.composer-cost-status\s*{[\s\S]*overflow-wrap: anywhere;/);
    // v726: the cost/reserve/discount line is capped at 3 lines (line-height 1.35) and scrolls its overflow so it
    // can't push the composer tall on a narrow screen.
    expect(css).toMatch(/\.composer-cost-status\s*{[\s\S]*max-height: calc\(1\.35em \* 3\);\s*\n\s*overflow-y: auto;/);
    // v730: on the MOBILE layout the composer carries NO safe-area-inset-bottom padding — the tab bar (.sidebar)
    // sits below it and reserves the inset itself; duplicating it here left a dead gap between the composer and
    // the tab bar on home-indicator iPhones (inset ~30px). Desktop keeps the base rule's inset (composer IS the
    // bottom edge there). Pin: the mobile block's composer paddings are inset-free, the sidebar reserve remains.
    const mobileBlock = css.slice(css.indexOf('@media (max-width: 900px)'));
    expect(mobileBlock).toMatch(/\.composer\s*{[\s\S]{0,900}?padding: 8px 14px 8px;/);
    expect(mobileBlock).toMatch(/\.public-composer\s*{[\s\S]{0,300}?padding: 8px 14px 8px;/);
    expect(mobileBlock).toMatch(/\.sidebar\s*{[\s\S]{0,700}?padding-bottom: max\(var\(--mobile-nav-bottom-reserve\), var\(--app-safe-area-bottom, env\(safe-area-inset-bottom, 0px\)\)\);/);
    expect(css).toMatch(/\.message\[data-status="sending"\] \.bubble/);
    expect(app).toMatch(/function identityDisplayKey/);
    expect(app).toMatch(/function uniqueDisplayIdentityVariants/);
    expect(app).toMatch(/function messageMetaText/);
    expect(app).toMatch(/function privateMessageHasAutoRecoveryPending/);
    expect(app).toMatch(/privateMessageHasAutoRecoveryPending\(message\)/);
    expect(app).toMatch(/function isTonRpcRecoverableReadError\(error\)/);
    expect(app).toMatch(/isTonRpcVerificationSoftReadError\(error\) \|\| isTonRpcTransientError\(error\)/);
    expect(app).toMatch(/meta: 'sending'/);
    expect(app).toMatch(/function privateSendRetryMeta/);
    expect(app).toMatch(/retrying send/);
    expect(app).toMatch(/checking RPC, retrying/);
    expect(app).toMatch(/PRIVATE_SEND_RETRY_MAX_ATTEMPTS = 8/);
    expect(app).toMatch(/PRIVATE_SEND_PARTIAL_RETRY_MAX_ATTEMPTS = 16/);
    expect(app).toMatch(/PRIVATE_SEND_PARTIAL_RETRY_DEADLINE_MS = 15 \* 60 \* 1000/);
    expect(app).toMatch(/PRIVATE_SEND_RPC_RETRY_MAX_ATTEMPTS = 90/);
    expect(app).toMatch(/function privateSendRetryMaxAttempts/);
    expect(app).toMatch(/privateSendRetryExhaustedStatusText/);
    expect(app).toMatch(/privateSendBlockedStatusText/);
    expect(app).not.toMatch(/message\.meta = 'send failed'/);
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*\.rail-item span:last-child\s*{[\s\S]*text-overflow: ellipsis;/);
  });

  it('PWA-HISTORY-01: local encrypted history and replay stores are deployment- and wallet-scoped', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const bootSource = app.slice(
      app.indexOf('async function bootReplayStore'),
      app.indexOf('function shortKeyId'),
    );
    const cryptoSource = app.slice(
      app.indexOf('async function bootCrypto'),
      app.indexOf('function updatePrivateComposerState'),
    );
    const startupSource = app.slice(
      app.indexOf('customPublicChannels = readCustomPublicChannels()'),
      app.indexOf("bootCrypto()"),
    );

    expect(app).toMatch(/function walletIndexedDbSuffix\(walletAddress = plathoWallet\?\.address\)/);
    expect(app).toMatch(/parseTonAddress\(walletAddress\)\.raw/);
    expect(app).toMatch(/function walletScopedIndexedDbName\(baseName, walletAddress = plathoWallet\?\.address\)/);
    expect(app).toMatch(/return `\$\{scopedIndexedDbName\(baseName\)\}\.\$\{walletIndexedDbSuffix\(walletAddress\)\}`/);
    expect(app).toMatch(/return walletScopedIndexedDbName\(LEGACY_MESSAGE_HISTORY_DB_NAME, walletAddress\)/);
    expect(app).toMatch(/return walletScopedIndexedDbName\(LEGACY_REPLAY_DB_NAME, walletAddress\)/);
    expect(bootSource).toMatch(/if \(!plathoWallet\?\.address\) \{/);
    expect(bootSource).toMatch(/createMemoryReplayStore\(\)/);
    expect(bootSource).toMatch(/t\('common\.unlockRequired'\)/);
    expect(EN_STRINGS['common.unlockRequired']).toBe('unlock required');
    expect(bootSource).toMatch(/encryptedMessageStore = null/);
    expect(bootSource).toMatch(/t\('sync\.historyLocked'\)/);
    expect(EN_STRINGS['sync.historyLocked']).toBe('history locked');
    expect(bootSource).toMatch(/createIndexedDbEncryptedMessageHistoryStore\(\{ dbName: currentMessageHistoryDbName\(\) \}\)/);
    expect(app).toMatch(/t\('vault\.historyLocalCache'/);
    expect(EN_STRINGS['vault.historyLocalCache']).toMatch(/device-encrypted local cache/);
    expect(app).toMatch(/t\('install\.bodyPrompt'\)/);
    expect(EN_STRINGS['install.bodyPrompt']).toMatch(/bounded local encrypted history cache/);
    expect(app).not.toMatch(/`encrypted db \(\$\{limit\}\)`/);
    expect(bootSource).toMatch(/createIndexedDbReplayStore\(\{ dbName: currentReplayDbName\(\) \}\)/);
    expect(cryptoSource).toMatch(/await bootWalletScopedLocalStores\(\)/);
    expect(startupSource).not.toMatch(/bootReplayStore\(\);/);
    expect(startupSource).not.toMatch(/bootEncryptedMessageHistory\(\);/);
  });

  it('PWA-HISTORY-02: corrupt encrypted history records are reported without blocking valid restore', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const store = readFileSync('web/encrypted-message-store.mjs', 'utf8');
    const restoreSource = app.slice(
      app.indexOf('async function restoreEncryptedMessageHistory'),
      app.indexOf('async function bootEncryptedMessageHistory'),
    );

    expect(store).toMatch(/async function openMessageHistoryRecords\(key, records\)/);
    expect(store).toMatch(/const failed = \[\]/);
    expect(store).toMatch(/opened\.push\(await openMessageHistoryRecord\(key, record\)\)/);
    expect(store).toMatch(/failed\.push\(\{/);
    expect(store).toMatch(/return \{ messages: opened, failed \}/);
    expect(store).toMatch(/async listMessagesDetailed\(filter = \{\}\)/);
    expect(store).toMatch(/return \(await this\.listMessagesDetailed\(filter\)\)\.messages/);
    expect(restoreSource).toMatch(/encryptedMessageStore\.listMessagesDetailed/);
    expect(restoreSource).toMatch(/failedRecords: failed/);
    expect(restoreSource).toMatch(/walletAddress: plathoWallet\?\.address \?\? null/);
    expect(restoreSource).toMatch(/failed\.length > 0/);
    expect(restoreSource).toMatch(/historyRestoredBlocked/);
  });

  it('PWA-AVATAR-CACHE-01: cached profile avatar media is hash-verified before reuse', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const cacheSource = app.slice(
      app.indexOf('function webpDataUrlToBytes'),
      app.indexOf('function writeProfileAvatarMediaCache'),
    );
    const avatarReadSource = app.slice(
      app.indexOf('async function readAvatarPartsFromShard'),
      app.indexOf('function avatarPartStreamId'),
    );
    const hydrateSource = app.slice(
      app.indexOf('async function hydrateThreadAvatarFromPointer'),
      app.indexOf('async function readCurrentProfileAvatarPointerResultFromChain'),
    );

    // Avatar media now lives in IndexedDB (per-record writes; localStorage's iOS whole-store re-serialization
    // was the Vault-freeze root). Reuse is still hash-verified: read the stored URL, recompute sha256 of its
    // bytes, and on mismatch delete the record instead of returning a wrong/tampered image.
    expect(cacheSource).toMatch(/data:image\/webp;base64,/);
    expect(cacheSource).toMatch(/const url = \(await store\?\.get\(hash\)\)\?\.url/);
    expect(cacheSource).toMatch(/const bytes = webpDataUrlToBytes\(url\)/);
    expect(cacheSource).toMatch(/const computedHash = await sha256Hex\(bytes\)/);
    expect(cacheSource).toMatch(/computedHash\.toLowerCase\(\) !== hash\.toLowerCase\(\)/);
    expect(cacheSource).toMatch(/await store\?\.delete\(hash\)/);
    expect(avatarReadSource).toMatch(/const cached = await readProfileAvatarMediaCache/);
    expect(hydrateSource).toMatch(/const cached = pointer \? await readProfileAvatarMediaCache/);
    // The boot warm-up must read cached posts via feed.posts — the cache shape is { feed: { posts: [...] } }.
    // Iterating `feed` as an array silently warmed NOTHING (the avatar-flash-on-reload bug). Guard it.
    expect(app).toMatch(/Array\.isArray\(feed\?\.posts\) \? feed\.posts/);
  });

  it('PWA-AVATAR-SERIAL-01: every avatar chain read runs through one serial lane and the post-unlock refresh is serialized in bootCrypto', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const loadAvatarSource = app.slice(
      app.indexOf('async function loadProfileAvatarImage'),
      app.indexOf('function attachAvatarUrlToPublicFeedCache'),
    );
    const loadWalletSource = app.slice(
      app.indexOf('async function loadPlathoWallet'),
      app.indexOf('async function setPlathoWallet'),
    );
    const setWalletSource = app.slice(
      app.indexOf('async function setPlathoWallet'),
      app.indexOf('async function loadMessagingIdentityFromWallet'),
    );
    const syncPublicSource = app.slice(
      app.indexOf('async function syncPublicChannels'),
      app.indexOf('function collectPublicAvatarRequests'),
    );
    const bootSource = app.slice(
      app.indexOf('async function bootCrypto'),
      app.indexOf("if ('serviceWorker' in navigator"),
    );

    // The iOS run-loop freeze (v509) recurs whenever 2+ toncenter reads run concurrently. Avatar hydration
    // fanned out many getAvatar reads through loadProfileAvatarImage with DIFFERENT dedup keys, so they were
    // NOT serialized against each other. A single serial lane caps avatar chain reads to one at a time.
    // [OWNER 2026-08-03] The hand-rolled chain is gone: this lane, the username-hygiene lane and the new
    // outgoing-publish queue were the same eight lines three times. One primitive now, and the duplicates were
    // deleted rather than left unused. Behaviour pinned in tests/private-send-serial-lane.test.ts.
    expect(app).toMatch(/function createSerialLane\(\) \{/);
    expect(app).toMatch(/const enqueueAvatarChainRead = createSerialLane\(\);/);
    expect(loadAvatarSource).toMatch(/const promise = enqueueAvatarChainRead\(async \(\) => \{/);

    // The two public-feed avatar hydrators run sequentially (feed-post authors, then channel authors) instead
    // of two bare fire-and-forget launches that overlapped on iOS.

    // The OWN-profile avatar refresh has ONE canonical spot — bootCrypto's tail, AFTER the activation +
    // private-sync reads and BEFORE the background loop / vault auto-refresh timers are armed. loadPlathoWallet
    // and the wallet-change paths must NOT fire it themselves (that overlapped bootCrypto's reads on iOS).
    expect(loadWalletSource).not.toMatch(/refreshOwnProfileAvatar/);
    expect(setWalletSource).not.toMatch(/refreshOwnProfileAvatar/);
    const avatarRefreshIndex = bootSource.indexOf('await refreshOwnProfileAvatar()');
    const syncIndex = bootSource.indexOf('syncPrivateCapsulesFromChainOnce');
    const autoSyncIndex = bootSource.indexOf('scheduleMessageAutoSync()');
    expect(avatarRefreshIndex).toBeGreaterThanOrEqual(0);
    expect(avatarRefreshIndex).toBeGreaterThan(syncIndex);
    expect(autoSyncIndex).toBeGreaterThan(avatarRefreshIndex);
  });

  it('PWA-AVATAR-OWN-PERSIST-01: the own avatar restores from the media cache into the public-feed map on reload (no letter-tile flash)', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const restoreSource = app.slice(
      app.indexOf('async function restoreOwnAvatarFromCacheFast'),
      app.indexOf('async function refreshOwnProfileAvatar'),
    );
    const refreshSource = app.slice(
      app.indexOf('async function refreshOwnProfileAvatar'),
      app.indexOf('async function readCurrentProfileAvatarPointerResultFromChain'),
    );
    const bootSource = app.slice(
      app.indexOf('async function bootCrypto'),
      app.indexOf("if ('serviceWorker' in navigator"),
    );

    // Counterparty avatars warm from the avatarHash embedded in their feed posts; the OWN wallet often has no feed
    // post carrying its CURRENT avatarHash (a postless official channel; a past comment embeds an older pointer),
    // so the feed-warm path cannot restore it and the own face flashed the letter tile + re-fetched from chain on
    // every reload. The own avatar must restore from the persisted current pointer + media store, into the public
    // feed per-wallet map, with no chain wait.
    expect(restoreSource).toMatch(/readStoredProfileAvatarPointer\(owner\)/);
    expect(restoreSource).toMatch(/readProfileAvatarMediaCache\(pointer\.avatarHash\)/);
    expect(restoreSource).toMatch(/setOwnPublicFeedAvatar\(owner, cachedUrl\)/);
    expect(app).toMatch(/function setOwnPublicFeedAvatar\(owner, imageUrl\)/);
    expect(app).toMatch(/publicChannelAvatarUrlByWallet\.set\(raw, imageUrl\)/);

    // refreshOwnProfileAvatar shows the cached avatar FIRST (no chain wait) and mirrors the result into the feed map.
    expect(refreshSource).toMatch(/await restoreOwnAvatarFromCacheFast\(owner\)/);
    expect(refreshSource).toMatch(/setOwnPublicFeedAvatar\(owner, imageUrl\)/);

    // bootCrypto restores it EARLY — right after unlock, before the sync + first feed render — not only at its tail.
    const earlyRestoreIndex = bootSource.indexOf('await restoreOwnAvatarFromCacheFast(plathoWallet.address)');
    const tailRefreshIndex = bootSource.indexOf('await refreshOwnProfileAvatar()');
    expect(earlyRestoreIndex).toBeGreaterThanOrEqual(0);
    expect(earlyRestoreIndex).toBeLessThan(tailRefreshIndex);
  });

  it('PWA-FUNDS-SERIAL-01: funds-action pre-sign reads and the private-index sync read are serialized, never a concurrent Promise.all', () => {
    const app = readFileSync('web/app.js', 'utf8');

    // The iOS run-loop freeze (v509) fires on 2+ concurrent toncenter reads. Every funds-critical ACTION users
    // hit — setting an avatar, minting a username, moving Vault money — ran its pre-sign user/global/route reads
    // as a Promise.all, and the private sync read both index heads as a Promise.all. Those are the exact paths a
    // freeze would wreck. They are now sequential awaits returning IDENTICAL values (independent pure reads); the
    // nonce floor / waitForVaultPublishNonce barrier / send lock / sendBoc were never inside these read bursts.
    // BLANKET GUARD: no concurrent-read array literal anywhere in app.js. NOTE this deliberately forbids
    // `Promise.all([...])`; the cleanup `Promise.all(arr.map(...))` forms (local IndexedDB/cache, no chain read)
    // and the single-element `Promise.allSettled([job()])` serialization pattern do NOT match and stay allowed.
    expect(app).not.toMatch(/Promise\.all\(\[/);

    // The private receive read (runs on every sync tick, boot and unlock) is serial by construction: the
    // CapsuleHub two-head index read this used to pin is gone with the shared-log model, and the shard sync
    // awaits one conversation, one K_root and one capsule at a time. Concurrency here is the measured iOS
    // run-loop freeze, so the blanket Promise.all([ ban above is the load-bearing half of this guard.
    const syncSource = app.slice(
      app.indexOf('async function syncConvCapsulesFromShards'),
      app.indexOf('async function syncPrivateCapsulesFromChain'),
    );
    expect(syncSource).not.toMatch(/Promise\.all\(/);
    expect(syncSource).toMatch(/entries = await lane\.readIncoming\(\{\s*\n\s*kRoot, selfKeyId, peerKeyId, epochNow, windowW: plan\.windowW, shards, states: shardStates,/);
    expect(syncSource).toMatch(/opened = await openPrivateCapsuleChainEntry\(found\.entry, localRecipientKeyPair/);
    // The shard-state probe that decides WHICH histories to read is one awaited batch before the loop, not a read
    // per conversation racing the others — same serial rule, applied to the pass that was added to make it cheap.
    expect(syncSource).toMatch(/const shardStates = await readConvShardStates\(plans\);/);

    // Spot-check the UsernameRegistry route verifier reads its two checks sequentially. (Its ProfileRegistry twin
    // went with the Vault avatar path — direct pay does no route read at all.)
    const usernameRouteSource = app.slice(
      app.indexOf('function requireUsernameRegistryVaultRoute('),
      app.indexOf('function requireUsernameRegistryVaultRouteForOwnVaultAction('),
    );
  });

  // PWA-CONFIG-01D2 removed with the Vault publish trunk (prepare -> sendPrepared -> publishCapsulesThroughVault).
  // It pinned the pre-sign canonical-charge re-read and the "Price changed" confirm dialog: a Vault publish was
  // priced by the contract at sign time, so the quote could move between quote and sign. A direct-pay publish
  // attaches a FIXED per-part value (publicPublishValueForKind / the conv lane's equivalent) inside one wallet
  // transfer — there is no canonical charge to re-read and no price to re-confirm. Values are pinned in
  // tests/public-lane-send.test.ts and tests/public-lane-e2e.test.ts.

  // PWA-CONFIG-01D3 (amortized batch hold) removed with the Vault publish trunk: the shared-base amortization it
  // guarded existed because one Vault batch external covered N capsules under a single contract charge. Direct
  // parts each carry their own fixed value, so there is no batch hold to amortize.

  it('PWA-AVATAR-PENDING-01: avatar row holds an in-flight lock, retries the preflight truthfully, caps recovery, and pauses timers on lock', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // Dedicated in-flight lock mirroring the v430 activation-row pending flag.
    expect(app).toMatch(/let plathoProfileAvatarPending = false;/);
    expect(app).toMatch(/setAvatarButton\.disabled = plathoProfileAvatarPending/);
    expect(app).toMatch(/function setProfileAvatarPending\(pending\)/);
    // setProfileAvatarStatus releases the lock on any terminal outcome (error / success / active).
    expect(app).toMatch(/if \(state === 'error' \|\| state === '' \|\|/);
    // Input handler reflects the lock via refreshMessagingControls instead of unconditionally re-enabling.
    const handlerSource = app.slice(
      app.indexOf("profileAvatarInput?.addEventListener('change'"),
      app.indexOf("privateClearImageButton?.addEventListener('click'"),
    );
    expect(handlerSource).toMatch(/refreshMessagingControls\(\);/);
    expect(handlerSource).not.toMatch(/setAvatarButton\?\.toggleAttribute\('disabled', false\)/);
    // Terminal statuses are LOCALIZED (the owner's users read ru/zh/es/…): a hardcoded English terminal was
    // the last untranslated string on this row. The three actionable classes are distinguished: unreadable
    // pre-check (nothing spent -> retry), insufficient funds (verbatim shortfall), everything else.
    expect(handlerSource).toMatch(/setProfileAvatarStatus\(t\('avatar\.needsRetry'\), 'error'\)/);
    expect(handlerSource).toMatch(/error\?\.code === 'PLATHO_AVATAR_PRECHECK_UNREADABLE'/);
    expect(handlerSource).toMatch(/error\?\.code === 'PLATHO_ATH_REQUIRED' \|\| error\?\.code === 'PLATHO_WALLET_GRAM_REQUIRED'/);
    expect(EN_STRINGS['avatar.needsRetry']).toBe('avatar needs retry');
    // The direct-pay publish holds the lock across the ONE wallet transfer; the rate-limited pre-publish
    // preflight (and its in-flight retry table) belonged to the deleted Vault submit phase.
    expect(app).toMatch(/setProfileAvatarPending\(true\)/);
    expect(app).not.toMatch(/PROFILE_AVATAR_PREFLIGHT_RETRY_DELAYS_MS/);
    // The whole publish-recovery subsystem (persisted job, capped auto-retry, lock/unlock timer pause+resume,
    // entry-scan confirm) went with the Vault avatar path. It existed because a Vault publish could land
    // half-confirmed and needed healing across sessions; a direct publish is ONE wallet transfer that either
    // lands or throws, so there is no job to persist and no timer to pause. Fail closed on any comeback.
    expect(app).not.toMatch(/ProfileAvatarPublishRecovery/);
    expect(app).not.toMatch(/profileAvatarRecoveryTicksInFlight|profileAvatarInlineSubmitKeys/);
    expect(app).not.toMatch(/platho\.profile\.avatar\.publishRecovery/);
  });

  it('PWA-CONV-DELIVERY-01: a direct send is verified or honestly reddened — never left falsely green', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // This replaces the two Vault confirm-driver guards (PWA-PRIVATE-CONFIRM-RETRY-01, RT-VCAPS-001). Their
    // machine healed a publishState the direct lane never creates; the mechanism that actually decides a direct
    // send's fate is the CONV delivery confirm — and it had NO guard at all until this one.
    const confirm = app.slice(
      app.indexOf('async function runConvDeliveryConfirm'),
      app.indexOf('function markConvDeliveryUnlanded'),
    );
    const rearm = app.slice(
      app.indexOf('function rearmConvDeliveryConfirms'),
      app.indexOf('async function attemptConvMessagePublishDirect'),
    );

    // 1. RESOLVED STATES ARE TERMINAL — a verified/unlanded message is never re-polled.
    expect(confirm).toMatch(/if \(message\.convDelivery === 'verified' \|\| message\.convDelivery === 'unlanded'\) return;/);
    // 2. PROOF upgrades to verified (the shard stored my commits).
    expect(confirm).toMatch(/message\.convDelivery = 'verified';/);
    // 3. A RED terminal needs BOTH: the external is provably dead (past max age) AND the read was authoritative
    // (scan reached the bottom, or the shard is past my seq so it never accepted it). An inconclusive read at the
    // deadline leaves the optimistic green — a false red on an endpoint outage would be worse than a late truth.
    expect(confirm).toMatch(/if \(ageMs >= CONV_CONFIRM_MAX_AGE_MS\) \{\s*\n\s*if \(res\.complete \|\| res\.seqShort\) markConvDeliveryUnlanded\(thread, message\);/);
    // 4. The red terminal is a STATUS, not a button (the owner's chosen model).
    expect(app).toMatch(/message\.meta = 'not delivered: the shard did not store it — resend';/);
    expect(app).toMatch(/message\.privateManualRetryAvailable = false;/);
    // 5. IT SURVIVES A RELOAD: the timers do not, but convDirectSend is persisted with the message and the
    // re-arm sweep restarts every unresolved confirm inside a bounded age window. Without this a bounced send
    // reloaded before its terminal would stay green forever = silent loss.
    expect(app).toMatch(/convDirectSend: safeJsonClone\(message\.convDirectSend\) \?\? null,/);
    expect(rearm).toMatch(/if \(message\.convDelivery === 'verified' \|\| message\.convDelivery === 'unlanded'\) continue;/);
    expect(rearm).toMatch(/if \(\(Date\.now\(\) - Number\(send\.at \?\? 0\)\) >= CONV_CONFIRM_REARM_MAX_AGE_MS\) continue;/);
    expect(rearm).toMatch(/armConvDeliveryConfirm\(thread, message, 0\);/);
    // 6. A RETRY RE-BROADCASTS THE SAME EXTERNAL rather than rebuilding: same seq, same capsule, at most once on
    // chain. Rebuilding would consume a fresh conversation seq and could double-publish a landed message.
    const direct = app.slice(
      app.indexOf('async function attemptConvMessagePublishDirect'),
      app.indexOf('async function attemptPrivateComposerMessagePublish'),
    );
    expect(direct.length).toBeGreaterThan(0);
    expect(direct).toMatch(/if \(captured\?\.boc && \(Date\.now\(\) - captured\.at\) <= DIRECT_SEND_REBROADCAST_WINDOW_MS\)/);
    expect(direct).toMatch(/transport\.sendBoc\(\{ boc: captured\.boc, walletAddress: plathoWallet\.address \}\)/);
  });


  // PWA-INSUFFICIENT-GRAM-01 removed with the Vault confirm re-broadcast loop: "an underfunded Vault stops the loop
  // with a top-up terminal" describes a loop that re-POSTed a Vault batch until its receipt confirmed. Direct pay
  // has no such loop; underfunding is caught BEFORE signing by assertWalletGramAtLeast / assertConnectedAthAtLeast
  // (pinned in PWA-PUBLIC-DIRECT-01 and PWA-CONFIG-06B), which is strictly earlier and cheaper than a terminal.

  // PWA-SEND-01 removed with the Vault publish trunk: the network-surcharge cap gate + high-surcharge confirm
  // guarded the Vault publish HOLD (contract charge + surcharge, refundable). Direct sends pay plain TON message
  // value from the wallet, so there is no hold to cap and no surcharge dialog before signing.

  it('PWA-SEND-01B: private preflight shows actionable blocked reasons instead of generic send blocked', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const helperSource = app.slice(
      app.indexOf('function privateSendPreflightStatusText'),
      app.indexOf('function messageDiscountUnlocked'),
    );
    const submitStart = app.indexOf("composer?.addEventListener('submit'");
    const submitSource = app.slice(
      submitStart,
      app.indexOf('createWalletButton?.addEventListener', submitStart),
    );
    const settleSource = app.slice(
      app.indexOf('async function settlePrivateComposerSendError'),
      app.indexOf('async function runPrivateSendRetry'),
    );
    const markAwaitingSource = app.slice(
      app.indexOf('function markPublishStateAwaitingPartsForRetry'),
      app.indexOf('function markStaleUnconfirmedPublishPartsForRetry'),
    );
    const messageIndex = submitSource.indexOf('const message = {');
    const insertIndex = submitSource.indexOf('insertThreadMessage(thread, message)');
    // The preflight moved INTO the publish (attemptConvMessagePublishDirect's assertConnectedAthAtLeast /
    // assertWalletGramAtLeast), so the ordering invariant is now pinned against the send call itself.
    const preflightIndex = submitSource.indexOf('await enqueueOutgoingPublish(() => attemptPrivateComposerMessagePublish(');

    expect(helperSource).toMatch(/Activate Platho account before sending/);
    expect(helperSource).toMatch(/RPC verification pending/);
    // A funds shortfall is a DETERMINISTIC failure: it must show a clear actionable status AND be classified FATAL so
    // the send stops retrying (terminal manual-recovery) instead of furiously re-trying a balance that cannot appear.
    // Direct pay raises both by CODE, so the classification cannot drift with the wording of the message.
    expect(helperSource).toMatch(/error\?\.code === 'PLATHO_ATH_REQUIRED' \|\| error\?\.code === 'PLATHO_WALLET_GRAM_REQUIRED'/);
    expect(app).toMatch(/function isFatalPrivateSendError\(error\)[\s\S]*error\?\.code === 'PLATHO_ATH_REQUIRED'[\s\S]*error\?\.code === 'PLATHO_WALLET_GRAM_REQUIRED'/);
    // ...and the message the user sees names the asset, the amount needed and the amount held — in their language.
    expect(app).toMatch(/t\('errors\.notEnoughAth', \{ need: formatAthAtomic\(required\), have: formatAthAtomic\(balance\) \}\)/);
    expect(EN_STRINGS['errors.notEnoughAth']).toBe('Not enough ATH: need {need} ATH, have {have} ATH');
    expect(messageIndex).toBeGreaterThanOrEqual(0);
    expect(insertIndex).toBeGreaterThan(messageIndex);
    expect(preflightIndex).toBeGreaterThan(insertIndex);
    expect(submitSource).toMatch(/privateDraft:\s*\{/);
    expect(submitSource).toMatch(/messageInput\.value = ''/);
    // After sending, focus returns to the composer so the user can keep typing without re-tapping the field
    // (clicking the send button moved focus to the button / would drop the mobile keyboard).
    expect(submitSource).toMatch(/messageInput\?\.focus\(\)/);
    expect(submitSource).toMatch(/await settlePrivateComposerSendError\(sendContext, error\)/);
    expect(submitSource).not.toMatch(/restorePrivateDraftAfterUnsentMessage/);
    expect(settleSource).toMatch(/privateSendPreflightStatusText\(error\)/);
    expect(settleSource).toMatch(/markPrivateMessageManualRecovery\(context, error/);
    expect(submitSource).not.toMatch(/\? messageText : 'Send blocked'/);
  });

  // PWA-SEND-02 removed with the Vault publish trunk: it pinned the multi-batch Vault external stream (nonce
  // barrier, per-batch partial state, buildBatchExternalFromPublishItems). Direct sends are wallet transfers
  // chunked by chunkWalletMessages (byte-aware, pinned in tests/platho-wallet.test.ts) with wallet seqno as the
  // ordering primitive — no publish nonce and no per-batch external to stream.

  it('PWA-SEND-02B: pending publish status renders as confirming/retrying, not scary partial failure', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const metaSource = app.slice(
      app.indexOf('function publishStatePendingCount'),
      app.indexOf('function isVaultPublishPartialError'),
    );

    expect(metaSource).toMatch(/function publishStatePendingCount/);
    expect(metaSource).toMatch(/function publishStateBroadcastCount/);
    expect(metaSource).toMatch(/function publishStatePriorAttemptCount/);
    expect(metaSource).toMatch(/function publishStateVisibleSubmittedCount/);
    expect(metaSource).toMatch(/displaySubmittedCount/);
    expect(metaSource).toMatch(/publishStateVisibleSubmittedCount\(publishState\)/);
    expect(metaSource).toMatch(/PUBLISH_PART_STATUS_SENT/);
    expect(metaSource).toMatch(/PUBLISH_PART_STATUS_UNKNOWN/);
    expect(metaSource).toMatch(/const broadcast = Math\.max\(0, publishStateBroadcastCount\(publishState\)\)/);
    // v763: TWO-PHASE live progress (owner ask — the joint "submitted 8/8, confirming 1/8" glued two
    // counters, and its "submitted" jumped instantly because it counted sign-time SENT stamps):
    // phase 1 `submitted L/N` ticks with REAL on-chain landings, phase 2 `confirming C/N` ticks
    // CapsuleHub confirmations; each phase keeps its keyword so the substring gates match both.
    expect(metaSource).toMatch(/const landed = Math\.max\(submitted, confirmed\)/);
    expect(metaSource).toMatch(/landed < total\s*\n\s*\? `submitted \$\{landed\}\/\$\{total\}`\s*\n\s*: `confirming \$\{confirmed\}\/\$\{total\}`/);
    expect(metaSource).toMatch(/return progressMeta\(\)/);
    expect(metaSource).not.toMatch(/confirmingMeta/);
    expect(metaSource).toMatch(/const pending = Math\.max\(submitted, publishStatePendingCount\(publishState\), publishStateVisibleSubmittedCount\(publishState\)\)/);
    expect(metaSource).toMatch(/if \(pending <= 0\) return 'not sent'/);
    // v764: single-part gets the SAME two phases without a 0/1 counter — 'sending' until the external
    // lands on-chain, then 'confirming' (both words are in every substring gate incl. the 24h backstop).
    expect(metaSource).toMatch(/if \(total === 1\) return landed < total \? 'sending' : 'confirming';/);
    // The retrying branch shares the landed-count semantics (counting pending made the visible number
    // JUMP UP when a part flipped FAILED).
    expect(metaSource).toMatch(/submitted \$\{landed\}\/\$\{total\}, retrying/);
    expect(metaSource).not.toMatch(/partial publish/);
    expect(app).toMatch(/text\.includes\('not sent'\)/);
    expect(app).not.toMatch(/text\.includes\('partial'\)\) return 'failed'/);
    // v758: the "- still checking" suffix is gone — the live `confirming C/N` counter IS the liveness
    // signal now (owner request). The confirm driver writes the plain publishStateMeta text.
    expect(app).not.toMatch(/- still checking/);
    expect(app).toMatch(/not confirmed/);
    expect(app).toMatch(/privatePublishConfirmAttempt/);
    expect(app).toMatch(/privatePublishConfirmStopped/);
  });

  // PWA-SEND-02C removed with the per-part publish state: "retry the UNSENT parts" only means something when a
  // message is N independently-signed externals. A direct message is ONE wallet transfer — it is sent or it is not,
  // and its retry re-broadcasts the same signed BOC (PWA-CONV-DELIVERY-01 #6, PUBLISH-RETRY-01).

  it('PWA-SEND-02D: reload/focus resumes pending private send retries, not only confirmation polling', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const resumeSource = app.slice(
      app.indexOf('function hasPendingPrivateSendRetry'),
      app.indexOf('function clearPrivateMessageManualRecovery'),
    );
    const sendRetrySource = app.slice(
      app.indexOf('function privateSendRetryContextForMessage'),
      app.indexOf('function privatePublishConfirmStoppedStatusText'),
    );

    expect(resumeSource).toMatch(/function hasPendingPrivateSendRetry\(message\)/);
    expect(resumeSource).toMatch(/publishStateHasRetryableSendParts\(message\?\.publishState\)/);
    expect(resumeSource).toMatch(/message\?\.privateSendRetryStopped !== true/);
    // The staleness bound is still there, now as an early return rather than a term in an && chain (the predicate
    // grew a second, direct-pay branch). Same rule by De Morgan: a stale message with no publish attempt is out.
    expect(resumeSource).toMatch(/if \(isStalePrivatePendingPublish\(message\) && !privateMessageHasPublishAttempt\(message\)\) return false;/);
    // And it must guard BOTH branches — a direct-pay resume that skipped the age bound would revive a send the
    // user gave up on ten minutes ago.
    const predicate = resumeSource.slice(resumeSource.indexOf('function hasPendingPrivateSendRetry'));
    const predicateBody = predicate.slice(0, predicate.indexOf('\n}\n') + 3);
    expect(predicateBody.indexOf('isStalePrivatePendingPublish'))
      .toBeLessThan(predicateBody.indexOf('directPaySendRetryResumable'));
    expect(app).toMatch(/privateSendRetryAttempt/);
    expect(resumeSource).toMatch(/const hasStoredCapsules = \(Array\.isArray\(message\?\.capsules\) && message\.capsules\.length > 0\) \|\| Boolean\(message\?\.capsule\)/);
    expect(resumeSource).toMatch(/function resumePendingPrivateSendRetries\(\)/);
    expect(resumeSource).toMatch(/ensurePendingPrivateSendRetry\(thread, message/);
    expect(sendRetrySource).toMatch(/const draft = message\?\.privateDraft \?\? \{\}/);
    expect(sendRetrySource).toMatch(/text: draft\.text \?\? message\?\.text \?\? ''/);
    expect(sendRetrySource).toMatch(/attachments: normalizePrivateImageAttachments\(draft\.attachments \?\? \[\]\)/);
    expect(sendRetrySource).toMatch(/selectedSuite: draft\.selectedSuite \?\? VAULT_RECEIVE_CRYPTO_SUITE/);
    expect(app.match(/resumePendingPrivateSendRetries\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(app).toMatch(/const PRIVATE_PENDING_PUBLISH_STALE_AFTER_MS = 10 \* 60 \* 1000/);
    expect(app).toMatch(/function isStalePrivatePendingPublish\(message\)/);
    expect(app).toMatch(/not sent: retry window expired/);
    expect(app).toMatch(/not confirmed: chain lookup expired/);
  });

  it('PWA-SEND-02D2: sync and confirmation watchdogs resume unsent parts for any multipart size', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const syncSource = app.slice(
      app.indexOf('async function syncPrivateCapsulesFromChain'),
      app.indexOf('async function syncPrivateCapsulesFromChainOnce'),
    );
    const confirmRunSource = app.slice(
      app.indexOf('async function runPrivatePublishConfirmationRetry'),
      app.indexOf('function hasPendingPrivatePublishConfirmation'),
    );
    const resumeConfirmSource = app.slice(
      app.indexOf('function resumePendingPrivatePublishConfirmations'),
      app.indexOf('function resumePendingPrivateSendRetries'),
    );
    const sendRetrySource = app.slice(
      app.indexOf('function privateSendRetryContextForMessage'),
      app.indexOf('function privatePublishConfirmStoppedStatusText'),
    );
    const scheduleSendSource = app.slice(
      app.indexOf('function schedulePrivateSendRetry'),
      app.indexOf('function privateSendRetryContextForMessage'),
    );
    const pendingConfirmSource = app.slice(
      app.indexOf('function hasPendingPrivatePublishConfirmation'),
      app.indexOf('function resumePendingPrivatePublishConfirmations'),
    );
    const debugSource = app.slice(
      app.indexOf('function privateDebugPublishMessages'),
      app.indexOf('function refreshConversationSubtitle'),
    );

    // The retry resume used to be re-armed from inside the CapsuleHub sync body (hence a >=3 count over that
    // slice). Under direct pay it is wired at the app's resume hooks instead — assert the hooks, not a count
    // over a function that no longer contains them.
    expect(app.match(/resumePendingPrivateSendRetries\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(sendRetrySource).toMatch(/function ensurePendingPrivateSendRetry\(thread, message/);
    expect(sendRetrySource).toMatch(/function revivePartialPrivateSendRetry\(message\)/);
    expect(sendRetrySource).toMatch(/privatePartialSendRetryExpired\(message\)/);
    expect(sendRetrySource).toMatch(/message\.privateSendRetryStopped = false/);
    expect(sendRetrySource).toMatch(/message\.privateSendRetryAttempt = 0/);
    expect(scheduleSendSource).toMatch(/privateSendRetryNextAt/);
    expect(scheduleSendSource).toMatch(/privateSendRetryLastScheduledAt/);
    expect(scheduleSendSource).toMatch(/attempt >= privateSendRetryMaxAttempts\(error, message\)/);
    expect(scheduleSendSource).toMatch(/PARTIAL_PRIVATE_PUBLISH_RETRY_EXPIRED/);
    expect(scheduleSendSource).toMatch(/stopPartialPrivatePublishRecovery\(context/);
    expect(pendingConfirmSource).toMatch(/!privatePartialSendRetryExpired\(message\)/);
    expect(sendRetrySource).toMatch(/privateSendRetryJobs\.has\(existingKey\)/);
    expect(app).toMatch(/const hasStoredCapsules = \(Array\.isArray\(message\?\.capsules\) && message\.capsules\.length > 0\) \|\| Boolean\(message\?\.capsule\)/);
    expect(app).toMatch(/function privateMessageHasPartialRetryablePublish\(message\)/);
    expect(app).toMatch(/function privatePartialSendRetryAgeMs\(message\)/);
    expect(app).toMatch(/function stopPartialPrivatePublishRecovery\(context/);
    expect(app).toMatch(/not confirmed: partial publish retry window expired/);
    // (The per-PART publish debug lines went with the publishState they printed — a direct-pay message is one
    // wallet transfer, so there are no parts to enumerate. The retry/expiry state above is what the debug panel
    // still has to show, and it is pinned directly rather than through the helper that printed it.)
  });

  it('PWA-SEND-02D3: failed optimistic private sends stay in the chat with retry/cancel actions', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    const renderSource = app.slice(
      app.indexOf('function renderConversation'),
      app.indexOf('async function openImageLightbox'),
    );
    const manualSource = app.slice(
      app.indexOf('function clearPrivateMessageManualRecovery'),
      app.indexOf('async function attemptPrivateComposerMessagePublish'),
    );
    const scheduleSource = app.slice(
      app.indexOf('function schedulePrivateSendRetry'),
      app.indexOf('function privateSendRetryContextForMessage'),
    );
    const settleSource = app.slice(
      app.indexOf('async function settlePrivateComposerSendError'),
      app.indexOf('async function runPrivateSendRetry'),
    );

    expect(app).not.toMatch(/restorePrivateDraftAfterUnsentMessage/);
    expect(renderSource).toMatch(/privateMessageManualActionsElement\(thread, message\)/);
    expect(manualSource).toMatch(/function privateMessageShouldShowManualActions\(message\)/);
    expect(manualSource).toMatch(/privateSendRetryJobs\.has\(message\.privateSendRetryKey\)/);
    expect(manualSource).toMatch(/privatePublishConfirmJobs\.has\(message\.privatePublishConfirmRetryKey\)/);
    expect(manualSource).toMatch(/messageStatusKey\(message\) !== 'failed'/);
    expect(manualSource).toMatch(/meta\.includes\('published'\)/);
    expect(manualSource).toMatch(/meta\.includes\('sending'\)/);
    expect(manualSource).toMatch(/meta\.includes\('submitted'\)/);
    expect(manualSource).toMatch(/message\.privateSendRetryStopped === true \|\| message\.privatePublishConfirmStopped === true/);
    expect(manualSource).toMatch(/function privateMessageCanLocalCancel\(message\)/);
    expect(manualSource).toMatch(/!privateMessageHasPublishAttempt\(message\)/);
    expect(manualSource).toMatch(/!message\.localHistoryId/);
    expect(manualSource).toMatch(/retryPrivateMessageFromUi\(thread, message\)/);
    expect(manualSource).toMatch(/cancelPrivateMessageFromUi\(thread, message\)/);
    expect(manualSource).toMatch(/thread\.messages = \(thread\.messages \?\? \[\]\)\.filter/);
    expect(scheduleSource).toMatch(/markPrivateMessageManualRecovery\(context, error, privateSendRetryExhaustedStatusText\(error\)\)/);
    expect(scheduleSource).toMatch(/clearPrivateMessageManualRecovery\(message\)/);
    expect(settleSource).toMatch(/markPrivateMessageManualRecovery\(context, error, privateSendBlockedStatusText\(error\)\)/);
    expect(css).toMatch(/\.message-actions \{[\s\S]*display: flex;/);
    expect(css).toMatch(/\.message\.out \.message-actions \{[\s\S]*justify-self: end;/);
    expect(css).toMatch(/\.message-actions button \{[\s\S]*min-height:\s*18px;[\s\S]*font-weight:\s*400;/);
  });

  it('PWA-SEND-02E: transient RPC verification outages retry instead of cancelling Vault publish/check flows', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const retrySource = app.slice(
      app.indexOf('function schedulePrivateSendRetry'),
      app.indexOf('function schedulePrivatePublishConfirmationRetry'),
    );
    const settleSource = app.slice(
      app.indexOf('async function settlePrivateComposerSendError'),
      app.indexOf('async function runPrivateSendRetry'),
    );

    expect(app).toMatch(/function isTonRpcVerificationUnavailableError/);
    expect(app).toMatch(/error\?\.code === 'RPC_DISAGREEMENT'/);
    expect(app).toMatch(/TON RPC disagreement\|RPC_DISAGREEMENT/);
    expect(app).toMatch(/PRIVATE_SEND_RPC_RETRY_MAX_ATTEMPTS = 90/);
    expect(retrySource).toMatch(/attempt >= privateSendRetryMaxAttempts\(error, message\)/);
    expect(app).toMatch(/checking RPC, retrying/);
    // The composer status now branches on ONE question — is the error recoverable — because the other three
    // (cancelled price dialog, partial publish, prior publish attempt) were publishState-era outcomes.
    expect(settleSource).toMatch(/if \(isRecoverablePrivateSendError\(error\)\) \{[\s\S]*refreshComposerCostStatus\(\);/);
    expect(settleSource).toMatch(/refreshComposerCostStatus\(\)/);
    expect(settleSource).not.toMatch(/recoverable \? privateSendRetryMeta\(error\)/);
  });

  // clean-17: PWA-RPC-02 removed — it pinned the Vault-only resolveRecipientPeerEntry (getUser/getKeyRecord/
  // publicKeyBundleFromVaultKeyRecord under recipientReadOptions), deleted with the direct-pay cutover. The live
  // direct-pay send resolves the recipient key via resolvePeerReplyBundle / resolveRecipientBundleByWallet with
  // criticalChainReadOptions() (fresh verified reads), covered by the crypto/keyshard module tests.

  it('PWA-SLOW-DEVICE-01: private-sync yields the main thread, self-test is deferred, balance/critical reads have deadlines', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // A+B: cooperative yield after EVERY scanned private entry so a burst of synchronous ML-KEM-768
    // decapsulations cannot starve the main thread (tab clicks/renders) on a slow single-thread device.
    expect(app).toMatch(/const cooperativeYield = \(\) => new Promise\(\(resolve\) => setTimeout\(resolve, 0\)\)/);
    // The yield now lives in the LIVE shard receive loop (the CapsuleHub index walk it used to guard is deleted).
    // Same reason, same shape: one macrotask per OPENED capsule, because the decapsulation between them is
    // synchronous CPU and a microtask-only await never lets the browser paint.
    const convSyncSource = app.slice(
      app.indexOf('async function syncConvCapsulesFromShards'),
      app.indexOf('async function syncPrivateCapsulesFromChain'),
    );
    // The subject here is the YIELD after every open, not the entry's shape — the entry also carries the shard
    // address now (SEQTAIL-07 owns that), so match the push loosely and keep the ordering assertion sharp.
    expect(convSyncSource).toMatch(/collected\.push\(\{ opened, entry: \{ entry_id: found\.seq,[^}]*\} \}\);[\s\S]*await cooperativeYield\(\);/);
    // C: the crypto self-test (diagnostic-only) runs DEFERRED off the unlock critical path, not awaited inline.
    expect(app).toMatch(/setTimeout\(resolve, 0\)\)\s*\.then\(\(\) => runPlathoCryptoSelfTest\(\)\)/);
    expect(app).not.toMatch(/const result = await runPlathoCryptoSelfTest\(\)/);
    // D: external wallet balance fetch has a hard abort timeout; critical chain reads carry a queue deadline
    // so a read cannot hang forever behind the keyless toncenter 60s backoff.
    expect(app).toMatch(/const TON_WALLET_BALANCE_FETCH_TIMEOUT_MS = 10 \* 1000/);
    expect(app).toMatch(/controller\.abort\(\), TON_WALLET_BALANCE_FETCH_TIMEOUT_MS/);
    expect(app).toMatch(/queueTimeoutMs: CRITICAL_CHAIN_READ_QUEUE_TIMEOUT_MS/);
    // E: the progressing-catch-up re-fire is floored at 8s so it cannot re-burst the sync every 2s.
    expect(app).toMatch(/Math\.max\(8_000, Math\.min\(2_000 \* 2 \*\* Math\.min\(messageAutoSyncStallStreak, 5\), MESSAGE_AUTO_SYNC_MS\)\)/);
    // v476 FIX: the with-wallet capture proved the freeze is the ASYNC read burst HANGING (degraded RPC: keyless
    // toncenter fallback + verify cross-check + backoff -> minutes), NOT a CPU loop, so the tab must render from
    // cached state on a deadline instead of awaiting forever. The per-read burst that needed its own deadline
    // (VAULT_OPEN_READ_DEADLINE_MS, the get_user+get_global fan-out) went with the custodial dashboard; what remains
    // is the whole-refresh backstop, which covers every job the tab now runs.
    expect(app).toMatch(/const VAULT_REFRESH_DEADLINE_MS = 16_000/);
    expect(app).toMatch(/Promise\.race\(\[\s*vaultWork,\s*delay\(VAULT_REFRESH_DEADLINE_MS\)\.then\(\(\) => vaultRefreshTimedOut\)/);
    expect(app).toMatch(/vaultWork\.catch\(\(\) => \{\}\)/);
  });

  it('PWA-KEYLESS-SEND-01: a keyless body-gap flood does not starve a first send (E3) nor pin the fast sync cadence (E4)', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const retrySource = app.slice(
      app.indexOf('async function runPrivateSendRetry'),
      app.indexOf('function rememberLocalPublicPost'),
    );
    // E3: the shared read-limiter bail is gated on privateMessageHasPublishAttempt(message). A FIRST
    // broadcast (every part still BUILT, never signed -> hasPublishAttempt false) is allowed through even
    // when tonRpcLimited() is hot — it goes to Orbs sendBoc, a different budget than the throttled
    // toncenter indexer that armed the limiter. An already-attempted message (some part SENT/SUBMITTED/
    // UNKNOWN, possibly in-flight) keeps the bail, so the key-gated no-double-spend re-sign path is NEVER
    // entered while the limiter is hot.
    expect(retrySource).toMatch(/if \(tonRpcLimited\(\) && privateMessageHasPublishAttempt\(message\)\) \{/);
    expect(retrySource).toMatch(/code: 'RATE_LIMITED'/);
    // E4: a sync cycle whose ONLY delta is body-gap skips is treated as a STALL (not progress), so the
    // exponential backoff ramps 8s->60s instead of re-walking the same unfetchable bodies every 8s and
    // keeping the limiter perpetually hot.
    expect(app).toMatch(/const onlyBodyGapSkips = !privateSyncImported\(result\)\s*&& result\?\.reason === 'body_history_unavailable'/);
    expect(app).toMatch(/const progressed = privateSyncImported\(result\)\s*\|\| \(Number\(result\?\.skipped \?\? 0\) > 0 && !onlyBodyGapSkips\)/);
  });

  // PWA-KEYLESS-EFFICIENCY-01 removed with the CapsuleHub index walk. Every efficiency it pinned was a property of
  // walking ONE shared log with a persisted cursor: the body-gap cross-session cap, the early-skip of known-dead
  // entries, the keyless cursor persistence mode. A conversation shard read has no cursor and no shared log — it
  // reads that conversation's own epoch window (syncConvCapsulesFromShards) — so there is nothing to skip past.

  it('PWA-QUICKSTART-01: first-run quick-start onboarding + wallet-key carries the toncenter key', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const html = readFileSync('web/index.html', 'utf8');
    // Wallet-key backup bundles the user's own toncenter key so restoring on a new device brings the RPC key
    // too. v3 ENCRYPTS it under the wallet seed (no plaintext secret in the file); the importer decrypts it,
    // backward-compatible with v2 (legacy plaintext) and v1 (no-key) backups.
    expect(app).toMatch(/kind: PLATHO_WALLET_KEY_BACKUP_KIND,\s*version: 3/);
    expect(app).toMatch(/\.\.\.\(toncenterApiKeyEnc \? \{ toncenterApiKeyEnc \} : \{\}\)/);
    // No plaintext toncenter key is ever written into the backup file.
    expect(app).not.toMatch(/\.\.\.\(toncenterApiKey \? \{ toncenterApiKey \} : \{\}\)/);
    expect(app).toMatch(/decryptToncenterApiKeyFromBackup\(parsed\.toncenterApiKeyEnc, wallet\)/);
    // Quick-start overlay markup (welcome + import buttons + the close affordance).
    expect(html).toMatch(/id="quickStartDialog"/);
    expect(html).toMatch(/id="quickStartBeginButton"/);
    expect(html).toMatch(/id="quickStartImportButton"/);
    // First-run controller: shown only with no wallet and not yet dismissed.
    expect(app).toMatch(/function maybeShowQuickStartOnFirstRun\(\)/);
    expect(app).toMatch(/if \(!hasStoredPlathoWalletRecord\(\)\) \{\s*if \(quickStartDismissedForever\(\)\) return false;\s*openQuickStart\(\);\s*return true;/);
    // The five guided steps reuse the existing flows; create + back-up are mandatory (optional:false).
    expect(app).toMatch(/const QUICK_START_STEPS = \[/);
    expect(app).toMatch(/run: \(\) => runQuickStartCreateWallet\(\)/);
    expect(app).toMatch(/run: \(\) => exportEncryptedWalletKeyFile\(\)/);
    // Step 2 (TON Center key) reads the input and applies the key (after validating it — see PWA-TONCENTER-KEY-VALIDATE-01).
    expect(app).toMatch(/const value = quickStartStepBody\?\.querySelector\('#quickStartKeyInput'\)\?\.value;[\s\S]*applyToncenterApiKey\(trimmed\)/);
    // v708 (owner): the get-a-key CTA sits BELOW the input with a clear gap and wears the shared
    // plate-action button class (the "Add contact" look) — input first in DOM, button second.
    expect(app).toMatch(/wrap\.className = 'quick-start-key-body';/);
    expect(app).toMatch(/getKey\.className = 'discovery-cta-action';[\s\S]{0,220}wrap\.append\(input, getKey\);/);
    const cssQuickKey = readFileSync('web/styles.css', 'utf8');
    expect(cssQuickKey).toMatch(/\.quick-start-key-body \{\s*display: grid;\s*gap: 12px;/);
    expect(cssQuickKey).toMatch(/\.quick-start-key-body > \.discovery-cta-action \{\s*justify-self: start;/);
    // Wired into the boot chain, defensively, after the wallet state is known.
    expect(app).toMatch(/try \{ quickStartShown = maybeShowQuickStartOnFirstRun\(\); \} catch \(error\) \{ console\.error\(error\); \}/);
  });

  it('PWA-QUICKSTART-TMA-01: quick-start works inside the Telegram Mini App (modal stacking, awaitable export, TG link, cloud dismissal)', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    // BLOCKER fix: quick-start steps open the shared #actionDialog (password / TG seed-backup hard gate /
    // manual wallet-key copy) while #quickStartDialog is still visible; both are .modal-backdrop z-index:40 and
    // quick-start is later in the DOM, so it painted on top and buried those prompts. Raise #actionDialog above
    // the quick-start overlay (40) but below the image lightbox (70).
    expect(css).toMatch(/#actionDialog \{\s*z-index: 60;\s*\}/);
    // MEDIUM fix: in Telegram the export is a manual-copy dialog (no file download). Make the whole chain
    // awaitable so the MANDATORY export step only completes once the user acknowledges the copy dialog.
    expect(app).toMatch(/function showTelegramManualExportDialog\(filename, content\) \{\s*return openActionDialog\(/);
    expect(app).toMatch(/async function downloadJsonFile\(filename, value\)[\s\S]*await showTelegramManualExportDialog\(filename, json\)/);
    expect(app).toMatch(/async function downloadEncryptedWalletKeyBackup\([\s\S]*await downloadJsonFile\(/);
    expect(app).toMatch(/if \(!unlocked\) return false;\s*await downloadEncryptedWalletKeyBackup\(record, unlocked\);/);
    // MEDIUM fix: a bare window.open of a t.me/ link is a no-op in the TG WebView; route the @toncenter bot
    // link through the SDK (openTelegramLink) first, fall back to a new tab only outside Telegram.
    expect(app).toMatch(/function openTelegramDeepLink\(href\)[\s\S]*tg\.openTelegramLink\(href\)/);
    expect(app).toMatch(/function openToncenterBotLink\(\) \{\s*if \(openTelegramDeepLink\('https:\/\/t\.me\/toncenter'\)\) return;/);
    expect(app).toMatch(/getKey\.addEventListener\('click', \(\) => \{ openToncenterBotLink\(\); \}\)/);
    // the quick-start step-2 link no longer calls a bare window.open directly in its handler.
    expect(app).not.toMatch(/getKey\.addEventListener\('click', \(\) => \{ try \{ globalThis\.open/);
    // LOW fix: mirror the dismissal into Telegram CloudStorage (iOS evicts localStorage) and restore on boot.
    expect(app).toMatch(/telegramCloudSet\(QUICK_START_DISMISSED_CLOUD_KEY, '1'\)/);
    expect(app).toMatch(/async function restoreQuickStartDismissalFromTelegramCloud\(\)/);
    expect(app).toMatch(/restoreQuickStartDismissalFromTelegramCloud\(\)\.catch\(\(\) => \{\}\)/);
    // LOW fix: the dialog scrolls inside a viewport-bounded box (keyboard-shrunk TG viewport) instead of clipping.
    expect(css).toMatch(/\.quick-start-dialog \{[\s\S]*?max-height: calc\(var\(--app-viewport-height[\s\S]*?overflow-y: auto;[\s\S]*?\}/);
  });

  it('PWA-UNLOCK-MODAL-01: the unlock-wallet dialog closes ONLY via the close button (no click-outside / Escape)', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // openActionDialog decouples the close (✕) button (cancellable) from outside-click/Escape (dismissOnBackdrop).
    expect(app).toMatch(/const cancellable = config\.cancellable \?\? true/);
    expect(app).toMatch(/actionCancelButton\.hidden = !cancellable/);
    // the ✕ handler is gated on cancellable (NOT on dismissOnBackdrop), so the ✕ works even when backdrop-dismiss is off.
    expect(app).toMatch(/actionCancelButton\?\.addEventListener\('click', \(\) => \{\s*if \(activeActionDialog\?\.cancellable === false\) return/);
    // backdrop click + Escape stay gated on dismissOnBackdrop, so dismissOnBackdrop:false blocks BOTH.
    expect(app).toMatch(/activeActionDialog\?\.dismissOnBackdrop === false\) return/);
    expect(app).toMatch(/if \(activeActionDialog\?\.dismissOnBackdrop !== false\) closeActionDialog\(null\)/);
    // the unlock flow opens its password dialog with dismissOnBackdrop:false + cancellable:true.
    const unlockSource = app.slice(
      app.indexOf('async function requestAndDecryptEncryptedWallet'),
      app.indexOf('async function readStoredPlathoWallet'),
    );
    expect(unlockSource).toMatch(/dismissOnBackdrop: false/);
    expect(unlockSource).toMatch(/cancellable: true/);
  });

  it('PWA-MODAL-DISMISS-01: every modal closes ONLY via its ✕ / Cancel — an outside/backdrop tap and Escape no longer dismiss (uniform; the image lightbox viewer is the one opt-in exception)', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // v794 (owner): black modals used to close on a stray tap anywhere outside them, discarding in-progress input.
    // The shared backdrop helper now DEFAULT-DENIES an outside tap; a modal must opt back in.
    expect(app).toMatch(/function closeOnBackdropClick\(backdrop, close, \{ allowOutsideTap = false \} = \{\}\)/);
    expect(app).toMatch(/if \(!allowOutsideTap\) return;/);
    // The action dialog keeps its own per-open opt-in (dismissOnBackdrop, now default OFF); the ✕ stays on by default.
    expect(app).toMatch(/const dismissible = config\.dismissOnBackdrop === true;/);
    expect(app).toMatch(/const cancellable = config\.cancellable \?\? true;/);
    // The three standalone dialogs are wired X-only (NO allowOutsideTap third arg).
    expect(app).toMatch(/closeOnBackdropClick\(newChatDialog, closeNewChatDialog\);/);
    expect(app).toMatch(/closeOnBackdropClick\(docsDialog, closeDocsDialog\);/);
    expect(app).toMatch(/closeOnBackdropClick\(installDialog, \(\) => closeInstallDialog\(\{ dismissed: true \}\)\);/);
    // The image lightbox is a fullscreen viewer, not a data dialog: it alone keeps tap-outside-to-dismiss.
    expect(app).toMatch(/closeOnBackdropClick\(imageLightboxDialog, closeImageLightbox, \{ allowOutsideTap: true \}\);/);
    // The share dialog + the two dynamically-built modals dropped their outside/backdrop click-to-close.
    expect(app).not.toMatch(/event\.target === sharePostDialog/);
    expect(app).not.toMatch(/if \(event\.target === backdrop\) closeExternalLinkModal\(\)/);
    expect(app).not.toMatch(/if \(event\.target === backdrop\) closeLinkComposerModal\(\)/);
    // The link-composer no longer registers an Escape-to-close keydown listener (stored handler is null now).
    expect(app).toMatch(/activeLinkComposerModal = \{ backdrop, onKeydown: null, previousFocus \}/);
    // The global Escape handler no longer dismisses newChat / docs / install (lightbox + popover keep Escape).
    const escBlock = app.slice(
      app.indexOf("if (event.key !== 'Escape') return;"),
      app.indexOf("if (event.key !== 'Escape') return;") + 700,
    );
    expect(escBlock).toMatch(/closeImageLightbox\(\)/);
    expect(escBlock).not.toMatch(/closeNewChatDialog/);
    expect(escBlock).not.toMatch(/closeDocsDialog/);
    expect(escBlock).not.toMatch(/closeInstallDialog/);
  });

  it('PWA-SEND-LOCK-01: an in-flight send defers the background lock (bounded), and keyless resume needs no key', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // Axis A: defer the background auto-lock while a send actively holds the key, bounded by a max grace,
    // set ONCE (never re-armed by later background events) so a wedged send can't pin the wallet unlocked.
    expect(app).toMatch(/const SEND_LOCK_MAX_GRACE_MS = 600 \* 1000/);
    // The Vault publish send-lock counter (vaultPublishSendWaiters) went with the Vault publish trunk; a direct-pay
    // send signs with the WALLET key inside privateOutboundWork, which is what this now counts.
    expect(app).toMatch(/function vaultSendNeedsKeyNow\(\)[\s\S]*const needsKey = privateOutboundWorkActive\(\)/);
    expect(app).not.toMatch(/vaultPublishSendWaiters/);
    expect(app).toMatch(/if \(!needsKey\) vaultSendInFlightUntil = 0/);
    expect(app).toMatch(/if \(vaultSendInFlightUntil === 0\) vaultSendInFlightUntil = now \+ SEND_LOCK_MAX_GRACE_MS/);
    expect(app).toMatch(/function shouldIgnoreTransientWalletLock\(\)[\s\S]*shouldDeferLockForActiveSend\(\)/);
    // Axis C (keyless resume of a Vault publish under the persisted owner address) went with the Vault publish:
    // there is no publishState to resume and no auth key to avoid using. The lock deferral above — the half that
    // is about the WALLET key during a direct send — is the part that still has a subject.
  });

  it('PWA-WALLET-LOCK-TIMING-01: wallet auto-lock timers relaxed per owner (idle 30min, TG background 5min, send grace 10min)', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // Owner-chosen values (2026-06-22): the wallet was auto-locking too eagerly and interrupting slow sends.
    expect(app).toMatch(/const WALLET_AUTO_LOCK_MS = 30 \* 60 \* 1000/);
    expect(app).toMatch(/const TELEGRAM_BACKGROUND_LOCK_GRACE_MS = 300_000/);
    expect(app).toMatch(/const SEND_LOCK_MAX_GRACE_MS = 600 \* 1000/);
    // The hard idle lock still exists (this is a relaxation, not a removal).
    expect(app).toMatch(/walletAutoLockTimer = setTimeout\(\(\) => \{\s*lockPlathoWallet\(t\('wallet\.locked'\)\);\s*\}, WALLET_AUTO_LOCK_MS\)/);
    expect(EN_STRINGS['wallet.locked']).toBe('Wallet locked');
  });

  it('PWA-TONCENTER-KEY-VALIDATE-01: a user-entered TON Center key is validated before it is saved', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // validateToncenterApiKey makes one authenticated call: 200 = ok, 401/403 = invalid, anything else = unverified.
    expect(app).toMatch(/async function validateToncenterApiKey\(rawKey\)/);
    expect(app).toMatch(/fetch\('https:\/\/toncenter\.com\/api\/v3\/masterchainInfo', \{\s*headers: \{ 'X-API-Key': key \}/);
    expect(app).toMatch(/if \(response\.ok\) return \{ ok: true \}/);
    expect(app).toMatch(/response\.status === 401 \|\| response\.status === 403\) return \{ ok: false, reason: 'invalid' \}/);
    // No Save button: the settings field validates + saves on change (blur / Enter). A 401/403 is NOT a hard
    // reject — a brand-new toncenter key needs up to ~1 min to activate — so the key is saved anyway, shown as
    // 'activating', and re-verified in the background (flips to active, or reverts to keyless if still rejected).
    expect(app).toMatch(/async function commitToncenterKeyFromInput\(\)/);
    expect(app).toMatch(/toncenterApiKeyInput\?\.addEventListener\('change'/);
    // Validate on paste/input (debounced), not only on blur, so pasting a key shows feedback right away;
    // and keep "checking..." visible for a perceptible beat even when validation returns fast.
    expect(app).toMatch(/toncenterApiKeyInput\?\.addEventListener\('input', scheduleToncenterKeyCheck\)/);
    expect(app).toMatch(/const minCheckingVisible = new Promise[\s\S]*?setTimeout\(resolve, 450\)[\s\S]*?await validateToncenterApiKey\(trimmed\);\s*await minCheckingVisible;/);
    // Optimistic save BEFORE the invalid-branch: a 401/403 shows 'activating' + schedules a background re-verify
    // instead of hard-rejecting; a persistent reject after the grace window reverts to keyless with a clear status.
    expect(app).toMatch(/await minCheckingVisible;\s*applyToncenterApiKey\(trimmed\);\s*if \(result\.reason === 'invalid'\) \{/);
    // v651: the row status is a single PICTOGRAM (✓ / ✕ / ⏳) with the full text in the tooltip — the old
    // 'key active' text ate half the row on a phone. setToncenterKeyStatusIcon is the ONLY status writer.
    expect(app).toMatch(/setToncenterKeyStatusIcon\('activating'\);/);
    expect(app).toMatch(/scheduleToncenterKeyReverify\(trimmed\)/);
    expect(app).toMatch(/setToncenterKeyStatusIcon\('error'\);/);
    expect(app).toMatch(/setToncenterKeyStatusIcon\('checking'\);/);
    expect(app).toMatch(/const TONCENTER_KEY_STATUS_ICONS = Object\.freeze\(\{/);
    expect(app).toMatch(/toncenterKeyStatus\.title = entry\.title;/);
    // "recommended" lives in the section heading, not the row, so it never crowds the key input on a narrow
    // phone; the in-row status is empty when there is no key.
    expect(app).toMatch(/setToncenterKeyStatusIcon\(key \? 'active' : 'empty'\);/);
    expect(readFileSync('web/index.html', 'utf8')).toMatch(/<h2 data-i18n="profile\.rpcAccessRecommended">RPC access \(recommended\)<\/h2>/);
    // The key input is a distinct dark field box (not frameless/transparent) so it reads as a text input on the row.
    expect(readFileSync('web/styles.css', 'utf8')).toMatch(/\.settings-rpc-row input\s*\{[\s\S]*?background:\s*var\(--panel\)/);
    // The row itself doubles as the Get button (except a click on the field). "Get" no longer dumps the user
    // straight into the bot: it opens an explanatory help modal whose primary action opens the @toncenter bot.
    expect(app).toMatch(/rpcKeyRow\?\.addEventListener\('click'[\s\S]*event\.target === toncenterApiKeyInput[\s\S]*openRpcKeyHelpDialog\(\)/);
    expect(app).toMatch(/async function openRpcKeyHelpDialog\(\)/);
    // The help modal: title + the "any name" and "mainnet" guidance + a bot-link CTA, and it opens the bot
    // ONLY when the user confirms via the CTA (proceed), not on dismiss.
    expect(app).toMatch(/title: t\('wallet\.rpcKeyHelpTitle'\)/);
    expect(EN_STRINGS['wallet.rpcKeyHelpTitle']).toBe('Get an RPC key');
    expect(app).toMatch(/steps: \[[\s\S]*t\('wallet\.rpcKeyHelpStep2'\)[\s\S]*t\('wallet\.rpcKeyHelpStep3'\)/);
    expect(EN_STRINGS['wallet.rpcKeyHelpStep2']).toMatch(/you can enter any name/);
    expect(EN_STRINGS['wallet.rpcKeyHelpStep3']).toMatch(/select mainnet/);
    expect(app).toMatch(/submitLabel: t\('wallet\.rpcKeyHelpOpenBot'\)/);
    expect(EN_STRINGS['wallet.rpcKeyHelpOpenBot']).toBe('Open @toncenter bot');
    expect(app).toMatch(/if \(proceed\) openToncenterBotLink\(\)/);
    // The 'note' field type renders the informational steps block (no input, not collected as a value).
    expect(app).toMatch(/if \(field\.type === 'note'\)/);
    expect(readFileSync('web/styles.css', 'utf8')).toMatch(/\.action-note-steps/);
    // The Save button is gone.
    expect(app).not.toMatch(/saveToncenterKeyButton/);
    // Quick-start step 2 validates too: an invalid key surfaces a message and does NOT advance the stepper.
    expect(app).toMatch(/if \(result\.reason === 'invalid'\) return t\('quickstart\.keyRejected'\)/);
    expect(EN_STRINGS['quickstart.keyRejected']).toBe('That key was rejected by TON Center. Check it and retry, or Skip.');
    // The stepper handler renders a string run() result as a non-advancing failure message.
    expect(app).toMatch(/if \(typeof ok === 'string'\) \{[\s\S]*setText\(quickStartStepStatus, ok\)/);
  });

  it('PWA-WALLET-KEY-BACKUP-SAFETY-01: an un-exported wallet key keeps re-surfacing the backup until done', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const html = readFileSync('web/index.html', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    // A durable per-address "key never exported" flag, mirrored to Telegram CloudStorage (survives iOS eviction).
    expect(app).toMatch(/const WALLET_KEY_BACKUP_PENDING_KEY = 'platho\.wallet\.keybackup\.pending\.v1'/);
    expect(app).toMatch(/function markWalletKeyBackupPending\(address\)/);
    expect(app).toMatch(/function markWalletKeyBackupDone\(address\)/);
    expect(app).toMatch(/function walletKeyBackupPendingForStoredWallet\(\)/);
    expect(app).toMatch(/telegramCloudSet\(WALLET_KEY_BACKUP_PENDING_CLOUD_KEY/);
    expect(app).toMatch(/async function restoreWalletKeyBackupPendingFromTelegramCloud\(\)/);
    // Set pending on EVERY new-wallet creation (manual + quick-start); cleared when the key is actually exported.
    expect(app).toMatch(/await setPlathoWallet\(walletDraft, \{ password \}\);\s*markWalletKeyBackupPending\(walletDraft\.address\)/);
    expect(app).toMatch(/await downloadJsonFile\([\s\S]*markWalletKeyBackupDone\(storedWalletAddressForCopy\(record\)/);
    // Importing an encrypted wallet-key backup proves the key is already exported (the file IS the export), so the
    // import path clears the pending flag (incl. the cloud mirror) for the imported address -- IMPORT is never a
    // pending state. Regression guard: re-importing a wallet wrongly showed the Profile "back up your key" warning.
    expect(app).toMatch(/async function activateImportedEncryptedWalletRecord\([\s\S]*?markWalletKeyBackupDone\(wallet\.address\)/);
    // Re-surface: a wallet that exists but is unbacked-up re-opens the quick-start jumped to the export step.
    expect(app).toMatch(/if \(walletKeyBackupPendingForStoredWallet\(\)\) \{\s*openQuickStartAtBackup\(\);\s*return true;/);
    expect(app).toMatch(/function openQuickStartAtBackup\(\)[\s\S]*quickStartStepIndexByKey\('export'\)/);
    // The export step is keyed so the lookup is robust to reordering.
    expect(app).toMatch(/key: 'export',\s*title: t\('quickstart\.backupKeyTitle'\)/);
    expect(EN_STRINGS['quickstart.backupKeyTitle']).toBe('Back up your wallet key');
    // Closing the backup re-prompt must NOT permanently dismiss onboarding (the backup is still pending).
    expect(app).toMatch(/let quickStartBackupMode = false/);
    expect(app).toMatch(/if \(!quickStartBackupMode\) \{[\s\S]*QUICK_START_DISMISSED_KEY/);
    // Boot restores the flag from cloud and skips the startup unlock prompt while driving the backup (no double password).
    expect(app).toMatch(/restoreWalletKeyBackupPendingFromTelegramCloud\(\)\.catch/);
    expect(app).toMatch(/const drivingBackup = walletKeyBackupPendingForStoredWallet\(\);[\s\S]*if \(!drivingBackup\) promptStoredWalletUnlockOnStartup/);
    // A visible Profile warning row, shown only while pending; tapping it exports.
    expect(html).toMatch(/id="walletBackupWarning"/);
    expect(app).toMatch(/function refreshWalletBackupWarning\(\)[\s\S]*walletBackupWarning\.hidden = !walletKeyBackupPendingForStoredWallet\(\)/);
    expect(css).toMatch(/\.wallet-backup-warning/);
    // The warning is a .settings-list <button>, and `.settings-list button { display: flex }` (specificity
    // 0,1,1) outranks the UA `[hidden] { display: none }` (0,1,0) -- without an explicit guard the row can
    // never hide via its `hidden` attribute. Regression: it kept showing "Save now" after a successful export.
    expect(css).toMatch(/\.settings-list button\[hidden\][\s\S]*?display:\s*none/);
  });

  it('PWA-REGISTRY-CRITICAL-01: identity, avatar, and username registry reads use fresh verified options', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const avatarLoadSource = app.slice(
      app.indexOf('async function loadProfileAvatarImage'),
      app.indexOf('function attachAvatarUrlToPublicFeedCache'),
    );
    const avatarPointerSource = app.slice(
      app.indexOf('async function readCurrentProfileAvatarPointerResultFromChain'),
      app.indexOf('async function readCurrentProfileAvatarPointerFromChain'),
    );
    const usernameResolveSource = app.slice(
      app.indexOf('async function resolvePlathoUsernameOwner'),
      app.indexOf('async function waitForPlathoUsernameOwnership'),
    );
    const usernameMintSource = app.slice(
      app.indexOf('async function submitUsernameMint'),
      app.indexOf('function tonBalanceValue'),
    );

    expect(avatarLoadSource).toMatch(/const readOptions = \{ profileRegistryAddress: resolved\.address, \.\.\.criticalChainReadOptions\(\) \}/);
    expect(avatarLoadSource).toMatch(/getAvatarVersion\(ownerWallet, requestedPointer\.profileVersion, readOptions\)/);
    expect(avatarLoadSource).toMatch(/getAvatar\(ownerWallet, readOptions\)/);
    expect(avatarPointerSource).toMatch(/getAvatar\(ownerWallet, \{\s*profileRegistryAddress: resolved\.address,\s*\.\.\.criticalChainReadOptions\(\),\s*\}\)/);
    // 2026-07-20: the registry's name_records map is gone, so the item address is no longer LOOKED UP — it is
    // DERIVED from the name hash. The derivation read is still a critical (fresh + verified) read, because it is
    // the address the ownership proof is checked against; a stale/unverified derivation would let a wrong item
    // answer for the name.
    expect(usernameResolveSource).toMatch(/const nameHash = await computeUsernameNameHash\(displayLabel\)/);
    expect(usernameResolveSource).toMatch(/getUsernameItemAddress\(nameHash, \{\s*address: registryAddress,\s*\.\.\.criticalChainReadOptions\(\),\s*\}\)/);
    expect(usernameResolveSource).toMatch(/registryCallOptions: \{ address: registryAddress, \.\.\.criticalChainReadOptions\(\) \}/);
    expect(usernameResolveSource).toMatch(/itemCallOptions: \{ address: itemAddress, \.\.\.criticalChainReadOptions\(\) \}/);
    // The removed surface must stay removed: no getNameRecord/getNameRecordByUsername call may come back anywhere
    // in the app (the map named the MINTER and never followed a TEP-62 transfer — reading it is reading a lie).
    expect(app).not.toMatch(/getNameRecord/);
    expect(usernameMintSource).toMatch(/readUsernameMintPriceForOwnVaultAction\(provider, registry, username\)/);
  });

  it('PWA-RPC-03: TON DNS recipient-affecting reads are fresh verified critical reads', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const criticalMethods = PLATHO_APP_CONFIG.network.tonRpc.criticalMethods;
    const publicSource = app.slice(
      app.indexOf('async function resolvePublicChannelIdentity'),
      app.indexOf('function openPrivateThreadForWallet'),
    );
    const recipientSource = app.slice(
      app.indexOf('async function resolveRecipientWalletForThread'),
      app.indexOf('async function submitVaultMessage'),
    );

    expect(criticalMethods).toContain('dnsresolve');
    for (const source of [publicSource, recipientSource]) {
      expect(source).toMatch(/provider\.resolveWallet/);
      expect(source).toMatch(/rootAddress: appConfig\.tonDns\?\.rootAddress \?\? null/);
      expect(source).toMatch(/\.\.\.criticalChainReadOptions\(\)/);
    }
  });

  it('PWA-RPC-04: ATH wallet address reads are fresh verified before local ATH wallet transactions', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const criticalMethods = PLATHO_APP_CONFIG.network.tonRpc.criticalMethods;
    const source = app.slice(
      app.indexOf('async function loadConnectedAthWalletAddress'),
      app.indexOf('async function resolveRecipientWalletForThread'),
    );
    expect(criticalMethods).toContain('get_wallet_address');
    expect(source).toMatch(/provider\.getWalletAddress\(owner, \{/);
    expect(source).toMatch(/address: requireAthMasterAddress\(\)/);
    expect(source).toMatch(/\.\.\.criticalChainReadOptions\(\)/);
    expect(app).not.toMatch(/async function submitUsernameRegistryMessage/);
    expect(app).not.toMatch(/async function submitUsernameRefundFlush/);
  });

  it('PWA-USERNAME-TRANSFER-01: a .ath is a movable alias — routing is wallet-first; addressing reconciles + relabels', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // Routing is by the dialog's WALLET, not by re-resolving the username every send: in resolveRecipientWalletForThread
    // the wallet_address variant is matched BEFORE the platho_nft resolve (reverts the v562 FM-1 band-aid).
    const routeSource = app.slice(
      app.indexOf('async function resolveRecipientWalletForThread'),
      app.indexOf('async function submitVaultMessage'),
    );
    expect(routeSource.indexOf("type === 'wallet_address'")).toBeLessThan(routeSource.indexOf("type === 'platho_nft'"));
    // Transfer is handled at the identity/dialog layer: strip+relabel the old owner, resolve to the current owner.
    expect(app).toMatch(/function dropThreadIdentityVariant\(thread, targetKey\)/);
    expect(app).toMatch(/function reconcileUsernameOwnership\(usernameIdentity, ownerWallet\)/);
    expect(app).toMatch(/async function revalidateThreadUsernameVariants\(thread\)/);
    expect(app).toMatch(/class UsernameNotRegisteredError extends Error/);
    // 2026-07-20: "not registered" used to be `record.exists !== true` off the registry's name_records map. The map
    // is gone; the same fact now comes from the item proof reporting that the per-name contract was never
    // initialised. It must stay a DISTINCT error from a failed read — callers branch on `instanceof` to decide
    // between refusing the dialog outright and retrying, so folding the two together would either strand a real
    // name or invent a dialog for a nonexistent one.
    const usernameOwnerSource = app.slice(
      app.indexOf('async function resolvePlathoUsernameOwner'),
      app.indexOf('async function waitForPlathoUsernameOwnership'),
    );
    expect(usernameOwnerSource).toMatch(/if \(proof\.reason === 'item_not_initialized'\) \{\s*throw new UsernameNotRegisteredError\(/);
    expect(usernameOwnerSource).toMatch(/if \(proof\.authoritative !== true \|\| !proof\.owner_wallet\)/);
    expect(usernameOwnerSource).not.toMatch(/getNameRecord|record\.exists/);
    // The new-chat handler async-resolves a username to its current owner wallet, validates existence, reconciles,
    // then opens the dialog BY WALLET. Guarded against double-submit and self-addressing.
    const newChatSource = app.slice(
      app.indexOf("newChatForm?.addEventListener('submit'"),
      app.indexOf("actionCancelButton?.addEventListener('click'"),
    );
    expect(newChatSource).toMatch(/async \(event\) =>/);
    expect(newChatSource).toMatch(/await resolveRecipientWalletForThread\(parsed\.thread\)/);
    expect(newChatSource).toMatch(/error instanceof UsernameNotRegisteredError/);
    expect(newChatSource).toMatch(/reconcileUsernameOwnership\(identity, ownerWallet\)/);
    // v652: addressing your OWN username no longer errors — it falls through to the standard self dialog (Saved).
    expect(newChatSource).toMatch(/addressing your OWN username opens the Saved thread/);
    // v702: adding a contact ALSO follows their public channel — from BOTH dialog branches (raw wallet +
    // resolved username), NEVER from inside selectOrCreateRecipientThread (the "Private chat" button on
    // public posts routes through it, and auto-(re)following there would fight a deliberate unfollow).
    expect(app).toMatch(/function followContactPublicChannel\(recipientWallet\)/);
    // Normalizes via rawWalletAddress (the dialog hands over UQ/EQ forms; the strict Vault-action gate
    // rejects them) and never follows the own/Saved wallet.
    expect(app).toMatch(/function followContactPublicChannel\(recipientWallet\) \{\s*try \{[\s\S]*?const wallet = rawWalletAddress\(recipientWallet\);/);
    expect(app).toMatch(/if \(plathoWallet\?\.address && sameWalletAddress\(wallet, plathoWallet\.address\)\) return;/);
    expect(newChatSource).toMatch(/followContactPublicChannel\(ownerWalletFromThread\(threads\.find\(\(item\) => item\.id === activeThreadId\)\)\)/);
    expect(newChatSource).toMatch(/followContactPublicChannel\(ownerWallet\);/);
    const selectOrCreateSource = app.slice(
      app.indexOf('function selectOrCreateRecipientThread'),
      app.indexOf('function readCustomPublicChannels'),
    );
    expect(selectOrCreateSource).not.toMatch(/followContactPublicChannel|setPublicChannelSubscribed/);
    // Old-owner dialog is revalidated on open AND on receipt, and our OWN linked .ath is reconciled too — all
    // serialized through the shared username-hygiene queue (never N concurrent resolves -> the v509 iOS freeze).
    expect(app).toMatch(/function queueUsernameHygiene\(task\)/);
    expect(app).toMatch(/queueUsernameHygiene\(\(\) => revalidateThreadUsernameVariants\(thread\)\)/);
    // On RECEIPT: the direct lane resolves a conversation's thread by its peer keyId, and revalidates the label there
    // (the Hub-era routers that carried the identityThread call are gone).
    const convResolve = app.slice(app.indexOf('function resolveConvReceiveThread('), app.indexOf('async function appendConvOpenedCapsules('));
    expect(convResolve).toMatch(/queueUsernameHygiene\(\(\) => revalidateThreadUsernameVariants\(thread\)\)/);
    // The sender stops stamping a .ath it no longer owns; falls back to another owned name or none.
    expect(app).toMatch(/async function reconcileOwnLinkedUsername\(\)/);
    // Cardinal rule: never strip/clear a username off an unverifiable (structurally-degraded / hostile-RPC) read.
    expect(app).toMatch(/if \(tonRpcVerificationStructurallyDegraded\(\)\) \{ backoffOwnLinkedUsernameReconcile/);
  });

  it('PWA-LINK-NAME-PICKER-01: Link Platho name validates input and offers already-known profile usernames', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // A local set of the profile's already-known .ath names (linked/minted), unioning the current linked name.
    expect(app).toMatch(/function readKnownPlathoUsernames\(owner = plathoWallet\?\.address\)/);
    expect(app).toMatch(/function addKnownPlathoUsername\(label, owner = plathoWallet\?\.address\)/);
    // Minting a name records it as known.
    expect(app).toMatch(/writeLinkedPlathoUsername\(linked, owner\);\s*\n\s*addKnownPlathoUsername\(identity\.label, owner\);/);
    // The Link dialog offers the known names as a select, still verifies the chosen/typed name on submit (validation),
    // and records a successfully-linked name as known.
    const linkSource = app.slice(
      app.indexOf('async function requestWalletDisplayIdentity'),
      app.indexOf('async function requestUsernameMintName'),
    );
    expect(linkSource).toMatch(/readKnownPlathoUsernames\(plathoWallet\?\.address\)/);
    expect(linkSource).toMatch(/id: 'pick',\s*\n\s*type: 'select'/);
    // Verification now runs in-place via validateSubmit (close only on success — no flicker), see PWA-LINK-NAME-NO-FLICKER-01.
    expect(linkSource).toMatch(/await verifyWalletDisplayIdentity\(normalizedMode, chosen, plathoWallet\)/);
    expect(linkSource).toMatch(/addKnownPlathoUsername\(result\.label, plathoWallet\?\.address\)/);
  });

  it('PWA-MINT-ATH-PREFLIGHT-01: Mint Platho name validates length and ATH affordability up front', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // Length-based price is the owner's spec (4 chars = 10000 ATH, 5 = 1000, 6+ = 100; <4 rejected).
    expect(app).toMatch(/const USERNAME_PRICE_4_CHARS_ATOMIC = 10_000_000_000_000n/);
    expect(app).toMatch(/const USERNAME_PRICE_5_CHARS_ATOMIC = 1_000_000_000_000n/);
    expect(app).toMatch(/const USERNAME_PRICE_6_PLUS_CHARS_ATOMIC = 100_000_000_000n/);
    expect(app).toMatch(/\/\^\[a-z0-9_-\]\{4,16\}\$\//); // normalizeUsernameInput enforces >= 4 chars
    const mintSource = app.slice(
      app.indexOf('async function requestUsernameMintName'),
      app.indexOf('function avatarCompressionOptions'),
    );
    // Up-front affordability gate: compare the length-based price to the live ATH balance and block before review,
    // only when the Vault user/balance is loaded (no false "not enough" against an unknown balance).
    expect(mintSource).toMatch(/const priceAtomic = localUsernameMintPriceAtomic\(username\)/);
    expect(mintSource).toMatch(/priceAtomic !== null && currentVaultUserSource\(\)/);
    expect(mintSource).toMatch(/athBalance < priceAtomic/);
    expect(mintSource).toMatch(/Insufficient ATH/);
    // The summary surfaces the live ATH balance with a "not enough" flag.
    expect(mintSource).toMatch(/label: t\('username\.yourAth'\)/);
    expect(EN_STRINGS['username.yourAth']).toBe('Your ATH');
  });

  it('PWA-SW-UPDATE-01: pending service worker update blocks new signed sends and reloads after wallet lock', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const swSource = app.slice(
      app.indexOf('function serviceWorkerUpdateReloadError'),
      app.indexOf('function shouldOpenWalletUnlockPrompt'),
    );
    const profileSource = app.slice(
      app.indexOf('async function submitVaultUsernameMint'),
      app.indexOf('async function refreshWalletTonBalanceForProfile'),
    );
    const submitSource = app.slice(
      app.indexOf('async function submitVaultMessage'),
      app.indexOf('async function submitVaultAuthExternalWithNonceConfirmation'),
    );

    expect(swSource).toMatch(/async function liveAppRuntimeVersion/);
    expect(swSource).toMatch(/fetch\(`\.\/\?platho_version_check=\$\{Date\.now\(\)\}`/);
    expect(swSource).toMatch(/html\.match\(\/id="appVersionLabel">v\(\\d\+\)<\\\/span>\/\)/);
    expect(swSource).not.toMatch(/html\.match\(\/\\\.\\\/app\\\.js\\\?v=\(\\d\+\)\/\)/);
    expect(swSource).toMatch(/liveVersion === PLATHO_APP_RUNTIME_VERSION/);
    expect(swSource).toMatch(/pendingServiceWorkerAppShellReload = false/);
    expect(swSource).toMatch(/pendingServiceWorkerAppShellReload = true/);
    expect(swSource).toMatch(/flashWalletIdentityStatus\(t\('wallet\.updateReadyReload'\)\)/);
    expect(EN_STRINGS['wallet.updateReadyReload']).toBe('Update ready - reload before sending');
    expect(app).toMatch(/signedActionsReady = accountActive && !appShellReloadPending/);
    expect(app).toMatch(/registerVaultKeysButton\.disabled = !plathoWallet \|\| accountActive \|\| appShellReloadPending/);
    expect(app).toMatch(/mintUsernameButton\.disabled = false/);
    expect(app).toMatch(/linkUsernameButton\.disabled = false/);
    expect(app).toMatch(/setAvatarButton\.disabled = plathoProfileAvatarPending/);
    expect(app).toMatch(/if \(!plathoWallet\) \{[\s\S]*flashWalletIdentityStatus\(t\('wallet\.createWalletFirst'\)\)/);
    expect(EN_STRINGS['wallet.createWalletFirst']).toBe('create wallet first');
    expect(app).not.toMatch(/mintUsernameButton\.disabled = !plathoWallet \|\| !signedActionsReady/);
    expect(app).not.toMatch(/setAvatarButton\.disabled = !plathoWallet \|\| !signedActionsReady/);
    expect(app).toMatch(/function canAttemptPrivateSend/);
    expect(app).toMatch(/function privateSendBlockReason/);
    expect(app).toMatch(/const reason = privateSendBlockReason\(thread\)/);
    expect(app).toMatch(/const blocked = Boolean\(reason\);[\s\S]*?sendButton\.disabled = blocked/);
    expect(app).toMatch(/sendButton\.title = reason \?\? \(nothingToSend \? t\('composer\.nothingToSend'\) : t\('send\.sendPrivateMessage'\)\)/);
    expect(EN_STRINGS['send.sendPrivateMessage']).toBe('Send private message');
    expect(enCopy).toMatch(/Update ready - reload app/);
    expect(app).toMatch(/pendingServiceWorkerAppShellReload !== true/);
    expect(app).toMatch(/function publicComposerSendBlocked\(\) \{\s*return !plathoWallet \|\| !hasActivePlathoAccount\(\) \|\| pendingServiceWorkerAppShellReload/);
    expect(app).toMatch(/publicSendButton\.disabled = blocked/);
    expect(swSource).toMatch(/throw serviceWorkerUpdateReloadError\(\)/);
    expect(swSource).toMatch(/window\.location\.reload\(\)/);
    expect(swSource).toMatch(/reloadForPendingServiceWorkerAppShellUpdate\(\)/);
    // (The schedule helper was vestigial — the flag is raised by the SW update listener and consumed by the send
    // gates above, both pinned in this test.)
    expect(app).toMatch(/pendingServiceWorkerAppShellReload = true;/);
    expect(submitSource).not.toMatch(/async function submitUsernameRegistryMessage/);
    // prepareCapsulesThroughVault (the Vault publish trunk's pre-sign gate) is gone; the direct-pay send surfaces
    // are gated by publicComposerSendBlocked / privateSendBlockReason above, both of which fail closed on a
    // pending app-shell reload.
  });

  it('PWA-INTERFACE-MATRIX-01: matrix does not claim removed direct identity product actions', () => {
    const matrix = readFileSync('artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md', 'utf8');
    const app = readFileSync('web/app.js', 'utf8');

    expect(app).not.toMatch(/async function submitUsernameRefundFlush/);
    expect(app).not.toMatch(/getRefundDue/);
    expect(matrix).not.toMatch(/ATHTransferRequestMintUsername/);
    expect(matrix).not.toMatch(/ATHTransferRequestProfileAvatar/);
    expect(matrix).not.toMatch(/FlushAthRefundDue/);
    expect(matrix).not.toMatch(/get_refund_due/);
    expect(matrix).not.toMatch(/get_refund_flush_id/);
    expect(matrix).not.toMatch(/get_pending_refund_flush_for/);
    expect(matrix).not.toMatch(/\|\s*Flush username refund\s*\|[\s\S]*\|\s*Implemented\s*\|/);
    // REBASELINED 2026-08-07. The three pins here demanded the OPPOSITE of what clean-17 does. They required the
    // matrix to state that "direct user-wallet username mint [and] profile avatar payment ... are intentionally
    // unsupported" and that both flows are signed with a "Vault auth key" — the design where an intermediary contract
    // held the user's balance and signed on their behalf. `Vault` was deleted; direct user-wallet payment IS the
    // supported path now, through a dedicated registry notify op on the user's own ATHWallet.
    //
    // What the negatives above protect is unchanged and still worth protecting: the refund-flush ABI was removed, and
    // a matrix that lists it as `Implemented` would send an operator looking for an entrypoint that is not there.
    expect(matrix).toMatch(/\|\s*Mint username\s*\|\s*user `ATHWallet`\s*\|[\s\S]{0,200}ATHTransferRequestRegistryMintUsername/);
    expect(matrix).toMatch(/\|\s*Set wallet avatar\s*\|\s*user `ATHWallet`\s*\|[\s\S]{0,200}ATHTransferRequestRegistryProfileAvatar/);
    expect(matrix).not.toMatch(/Vault auth key/);
    expect(matrix).not.toMatch(/from Vault balance/);
  });

  it('PWA-ACTIVATION-01: transient Vault provider errors do not clear an active composer binding', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const activationSource = app.slice(
      app.indexOf('async function refreshVaultActivationStatus'),
      app.indexOf('// ── Boot screen'),
    );

    // clean-15 kept the binding by CLASSIFYING the error (expectedUnavailable && hasCurrentWalletVaultBinding).
    // clean-17 inverts it, which is stronger: the ONLY answer that may clear a binding is a definitive uninit shard;
    // every other failure lands in the catch, which never touches globalThis.plathoVaultBinding and returns it as-is.
    // So no error classification can go wrong and no transient read can clear an active composer binding.
    expect(activationSource).toMatch(/if \(!isKeyShardUninitError\(readError\)\) throw readError;/);
    expect(activationSource).toMatch(/catch \(error\) \{[\s\S]{0,600}?return globalThis\.plathoVaultBinding \?\? null;/);
    expect(activationSource).not.toMatch(/delete globalThis\.plathoVaultBinding/);
    expect(activationSource).toMatch(/setText\(vaultRecordStatus, t\('vault\.keysPending'\)\)/);
    expect(EN_STRINGS['vault.activated']).toBe('activated');
  });

  it('PWA-WALLET-REPLACE-01: replacing the local wallet clears private runtime state in the same tab', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const resetSource = app.slice(
      app.indexOf('function clearWalletScopedRuntimeState'),
      app.indexOf('function displayWalletAddress'),
    );
    const setWalletSource = app.slice(
      app.indexOf('async function setPlathoWallet'),
      app.indexOf('async function loadMessagingIdentityFromWallet'),
    );

    // (The standalone address-comparison helper was vestigial: the live path compares against the recorded
    // activeRuntimeWalletAddress inside prepareWalletScopedRuntimeForWallet, pinned just below.)
    expect(app).toMatch(/let activeRuntimeWalletAddress = null/);
    expect(app).toMatch(/function prepareWalletScopedRuntimeForWallet\(wallet, reason = 'wallet replaced'\)/);
    expect(setWalletSource).toMatch(/prepareWalletScopedRuntimeForWallet\(wallet, 'wallet replaced'\)/);
    expect(resetSource).toMatch(/privateSendRetryJobs\.clear\(\)/);
    expect(resetSource).toMatch(/privatePublishConfirmJobs\.clear\(\)/);
    expect(resetSource).toMatch(/activeRuntimeWalletAddress = null/);
    expect(resetSource).toMatch(/threads = \[\]/);
    expect(resetSource).toMatch(/activeThreadId = null/);
    expect(resetSource).toMatch(/localIdentity = null/);
    expect(resetSource).toMatch(/localVaultAuthKeyPair = null/);
    expect(resetSource).toMatch(/knownVaultKeyOwnerBySignPubkey\.clear\(\)/);
    expect(resetSource).toMatch(/knownVaultKeyRecordByWallet\.clear\(\)/);
    expect(resetSource).toMatch(/encryptedMessageStore = null/);
    expect(resetSource).toMatch(/delete globalThis\.plathoVaultBinding/);
    expect(resetSource).toMatch(/renderThreads\(\)/);
    expect(resetSource).toMatch(/renderConversation\(\)/);
  });

  it('PWA-WALLET-REPLACE-03: encrypted wallet key import clears private runtime state before switching wallets', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const helperSource = app.slice(
      app.indexOf('async function activateImportedEncryptedWalletRecord'),
      app.indexOf('async function importEncryptedWalletKeyFile'),
    );
    const importSource = app.slice(
      app.indexOf('async function importEncryptedWalletKeyFile'),
      app.indexOf('async function requestWalletDisplayIdentity'),
    );
    const prepareIndex = helperSource.indexOf("prepareWalletScopedRuntimeForWallet(wallet, 'wallet key imported')");
    const assignIndex = helperSource.indexOf('plathoWallet = wallet');

    expect(prepareIndex).toBeGreaterThanOrEqual(0);
    expect(assignIndex).toBeGreaterThan(prepareIndex);
    // v472: the call is captured (const restored = await ...) so the bundled toncenter key can be restored
    // AFTER the wallet activates; the wallet-switch still goes through activateImportedEncryptedWalletRecord.
    expect(importSource).toMatch(/const restored = await activateImportedEncryptedWalletRecord\(wallet, record\)/);
    expect(importSource).toMatch(/decryptToncenterApiKeyFromBackup\(parsed\.toncenterApiKeyEnc, wallet\)/);
    expect(importSource).toMatch(/applyToncenterApiKey\(restoredApiKey\.trim\(\)\)/);
    expect(importSource).not.toMatch(/plathoWallet = wallet/);
  });

  it('PWA-WALLET-REPLACE-04: locked wallet replacement still compares against the active runtime owner marker', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const helperSource = app.slice(
      app.indexOf('function activeWalletRuntimeAddress'),
      app.indexOf('function clearWalletScopedRuntimeState'),
    );
    const loadSource = app.slice(
      app.indexOf('async function loadPlathoWallet'),
      app.indexOf('async function setPlathoWallet'),
    );
    const lockSource = app.slice(
      app.indexOf('function lockPlathoWallet'),
      app.indexOf('function lockPlathoWalletForBackground'),
    );
    const bootStoreSource = app.slice(
      app.indexOf('async function bootWalletScopedLocalStores'),
      app.indexOf('function shortKeyId'),
    );

    expect(helperSource).toMatch(/return activeRuntimeWalletAddress \?\? plathoWallet\?\.address \?\? null/);
    expect(helperSource).toMatch(/const currentAddress = activeWalletRuntimeAddress\(\)/);
    expect(helperSource).toMatch(/if \(walletScopedRuntimeChanged\(wallet\)\) \{[\s\S]*clearWalletScopedRuntimeState\(reason\)/);
    expect(helperSource).toMatch(/if \(wallet\?\.address\) activeRuntimeWalletAddress = wallet\.address/);
    expect(lockSource).toMatch(/plathoWallet = null/);
    expect(lockSource).not.toMatch(/activeRuntimeWalletAddress = null/);
    expect(loadSource).toMatch(/if \(wallet\) prepareWalletScopedRuntimeForWallet\(wallet, 'wallet unlocked'\)/);
    expect(loadSource.indexOf("prepareWalletScopedRuntimeForWallet(wallet, 'wallet unlocked')")).toBeLessThan(loadSource.indexOf('plathoWallet = wallet'));
    expect(bootStoreSource).toMatch(/if \(plathoWallet\?\.address\) activeRuntimeWalletAddress = plathoWallet\.address/);
  });

  it('PWA-ACTIVATION-02: private draft input does not depend on flickering chain activation state', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const helpers = app.slice(
      app.indexOf('function canEditPrivateComposerDraft'),
      app.indexOf('function isTonRpcTransientError'),
    );
    const controls = app.slice(
      app.indexOf('function refreshMessagingControls'),
      app.indexOf('function setView'),
    );
    const render = app.slice(
      app.indexOf('function renderConversation'),
      app.indexOf('async function openImageLightbox'),
    );
    const addButton = app.slice(
      app.indexOf("privateComposerAddButton?.addEventListener('click'"),
      app.indexOf("privateComposerAddMenu?.addEventListener('click'"),
    );

    expect(helpers).toMatch(/function canEditPrivateComposerDraft/);
    expect(helpers).toMatch(/function canAttemptPrivateSend/);
    // The draft INPUT must NOT depend on the flickering chain activation state (typing stays stable from the
    // moment a chat opens): canEditPrivateComposerDraft -> messageInput.disabled is activation-free.
    const editDraftHelper = app.slice(
      app.indexOf('function canEditPrivateComposerDraft'),
      app.indexOf('function privateSendBlockReason'),
    );
    expect(editDraftHelper).not.toMatch(/hasActivePlathoAccount/);
    // The SEND button + payment-check ARE gated on activation (mirroring the public button) — this disables the
    // button and surfaces "Activate Platho account before sending" in the cost status, but never the textarea.
    const sendHelpers = app.slice(
      app.indexOf('function privateSendBlockReason'),
      app.indexOf('function isTonRpcTransientError'),
    );
    expect(sendHelpers).toMatch(/hasActivePlathoAccount\(\)/);
    expect(helpers).toMatch(/localIdentity && localRecipientKeyPair && localSignedPublicBundle/);
    expect(controls).toMatch(/const canEditPrivateDraft = canEditPrivateComposerDraft\(thread\)/);
    expect(controls).toMatch(/const canSendPrivate = canAttemptPrivateSend\(thread\)/);
    expect(controls).toMatch(/messageInput\.disabled = !canEditPrivateDraft/);
    // (The payment-check button went with the feature; the send-gate it shared is pinned on the buttons that remain.)
    // The secondary buttons ("+", image) follow the SEND state — an inactive composer (activation pending,
    // Vault reserve short) must not show live-looking buttons (owner, v696). Only the INPUT stays draft-gated.
    expect(controls).toMatch(/privateComposerAddButton\.disabled = !canSendPrivate/);
    expect(controls).not.toMatch(/privateComposerAddButton\.disabled = !canEditPrivateDraft/);
    expect(render).toMatch(/messageInput\.disabled = !canEditPrivateDraft/);
    expect(render).toMatch(/sendButton\) sendButton\.disabled = !canSendPrivate/);
    expect(addButton).toMatch(/if \(!canAttemptPrivateSend\(\)\)/);
  });

  it('PWA-COMPOSER-INACTIVE-01: every secondary composer control follows the send-block state on both surfaces', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    // PRIVATE: the canonical funnel is refreshPrivateSendButtonState (runs at the end of every
    // refreshComposerCostStatus) — emoji, "+", menu items and payment check all dim with the send button.
    const privateFunnel = app.slice(
      app.indexOf('function refreshPrivateSendButtonState'),
      app.indexOf('function refreshPublicSendButtonState'),
    );
    expect(privateFunnel).toMatch(/const blocked = Boolean\(reason\)/);
    expect(privateFunnel).toMatch(/privateEmojiButton\.disabled = blocked/);
    expect(privateFunnel).toMatch(/privateComposerAddButton\.disabled = blocked/);
    expect(privateFunnel).toMatch(/privateComposerAddButton\.title = reason \?\? t\('composer\.addImageOrCheck'\)/);
    expect(privateFunnel).toMatch(/if \(blocked\) hidePrivateComposerAddMenu\(\)/);
    // (see above — the payment-check button is gone with the retired feature)
    expect(privateFunnel).toMatch(/privateImageButton\.disabled = blocked/);
    expect(privateFunnel).toMatch(/privateFileButton\.disabled = blocked/);
    // The eye rides in the SAME funnel (else it goes stale on cost-status-only refresh paths, and a
    // stuck-disabled button can never self-heal from its own click): the funnel passes the already-computed
    // reason into updatePrivateSenderModeUi, whose block reason starts from it (plus the Saved-notes rule).
    expect(privateFunnel).toMatch(/updatePrivateSenderModeUi\(reason\)/);
    expect(app).toMatch(/function privateSenderModeToggleBlockReason\(sendBlock\) \{\s*if \(sendBlock\) return sendBlock;/);
    // PUBLIC: ONE predicate feeds Publish + emoji + attach + the comments toggle (checkbox AND label class —
    // the :has() dim rule no-ops on the iOS floor, so the class is the load-bearing selector).
    const publicFunnel = app.slice(
      app.indexOf('function publicComposerSendBlocked'),
      app.indexOf('async function assertVaultHasPrivatePublishHold'),
    );
    expect(publicFunnel).toMatch(/publicEmojiButton\.disabled = blocked/);
    expect(publicFunnel).toMatch(/publicImageButton\.disabled = blocked/);
    expect(publicFunnel).toMatch(/publicComposerCommentsCheckbox\.disabled = blocked/);
    expect(publicFunnel).toMatch(/publicPostCommentsToggle\?\.classList\.toggle\('is-disabled', blocked\)/);
    // No wallet-only re-enable writes survive outside the funnels (the "some buttons stay active" bug).
    expect(app).not.toMatch(/button\.disabled = !plathoWallet;/);
    expect(app).not.toMatch(/control\.disabled = !canPublish/);
    // The emoji buttons are declared with the composer controls, ABOVE first use (v692 TDZ lesson).
    expect(app.indexOf('const privateEmojiButton')).toBeLessThan(app.indexOf('function refreshPrivateSendButtonState'));
    // CSS: the class-based dim/recolor rules must be STANDALONE — Safari 14 drops a whole rule when any
    // selector in its list is unsupported, so no :has() may share a selector list with them.
    expect(css).toMatch(/\.composer-post-option\.is-disabled \{[^}]*opacity: 0\.62;/);
    expect(css).toMatch(/\.composer-post-option\.is-disabled \{[^}]*background: var\(--panel-3\);/);
    expect(css).not.toMatch(/:has\([^)]*\)[^{]*,[^{]*\.is-disabled[^{]*\{|\.is-disabled[^{]*,[^{]*:has\(/);
    expect(css).not.toMatch(/\.composer \.composer-add-button:disabled,\s*\.composer \.private-anonymous-button:disabled,\s*\.composer-post-option:has/);
  });

  it('PWA-ACTIVATION-03: the activation row shows in-flight progress and stays non-clickable until confirmed', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const submit = app.slice(
      app.indexOf('async function submitVaultRegisterMessagingKeys'),
      app.indexOf('async function confirmPlathoAccountActivation'),
    );
    const controls = app.slice(
      app.indexOf('function refreshMessagingControls'),
      app.indexOf('function setView'),
    );
    const postTx = app.slice(
      app.indexOf('function queueVaultPostTransactionRefresh'),
      app.indexOf('function queueVaultRefreshAfterWalletChange'),
    );
    const walletChange = app.slice(
      app.indexOf('function queueVaultRefreshAfterWalletChange'),
      app.indexOf('async function resolveUsernameRegistryProvider'),
    );
    // The activation submitter is the KeyShard register now — the Vault external it used to sign is gone.
    const submitActivation = app.slice(
      app.indexOf('async function submitKeyShardRegisterDirect'),
      app.indexOf('async function submitVaultRegisterMessagingKeys'),
    );

    // A single in-flight lock declared at module scope.
    expect(app).toMatch(/let plathoAccountActivationPending = false;/);
    // The lock is raised the moment the activation external is broadcast.
    expect(submitActivation).toMatch(/plathoAccountActivationPending = true;[\s\S]*queueVaultPostTransactionRefresh\(\{ pollActivation: true \}\)/);
    // While pending and not yet active, the row stays disabled and shows progress
    // instead of reverting to the clickable "Activate / fee" resting state — the bug
    // where the button looked like it ignored the first press.
    expect(controls).toMatch(/if \(accountActive\) plathoAccountActivationPending = false;/);
    expect(controls).toMatch(/const activationPending = plathoAccountActivationPending && !accountActive/);
    expect(controls).toMatch(/registerVaultKeysButton\.disabled = !plathoWallet \|\| accountActive \|\| appShellReloadPending \|\| activationPending/);
    expect(controls).toMatch(/activationPending\s*\?\s*t\('vault\.statusActivating'\)/);
    expect(EN_STRINGS['vault.statusActivating']).toBe('activating');
    // Hide the dead rows instead of showing disabled placeholders: Unlock only when a stored wallet is
    // locked (actionable); Activate only while activation is actionable or in progress (wallet unlocked AND
    // not yet active) — so the "active"/"unlocked"/"not stored" dead states disappear from the profile.
    expect(controls).toMatch(/unlockWalletButton\.hidden = !\(hasStoredWallet && !plathoWallet\)/);
    expect(controls).toMatch(/registerVaultKeysButton\.hidden = !\(Boolean\(plathoWallet\) && !accountActive && !appShellReloadPending\)/);
    // Safety release so a dropped/failed activation never strands the row spinning.
    expect(postTx).toMatch(/if \(pollActivation\) \{[\s\S]*plathoAccountActivationPending = false;[\s\S]*refreshMessagingControls\(\)/);
    // A wallet switch clears any pending lock left from the previous wallet.
    expect(walletChange).toMatch(/plathoAccountActivationPending = false;/);
  });

  it('PWA-DELIVERY-01: "Synced" is never reported while messages are pending, skipped, or dropped', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // The 'synced' phase requires genuinely nothing pending/skipped/dropped — a
    // false "✓ Synced" while entries are skipped/un-bodied is the receive-gap bug.
    const gate = app.slice(
      app.indexOf('function completeMessageSyncUi'),
      app.indexOf('function failMessageSyncUi'),
    );
    expect(gate).toMatch(/Number\(result\.skipped \?\? 0\) === 0/);
    expect(gate).toMatch(/Number\(result\.incompletePrivateStreamCount \?\? 0\) === 0/);
    expect(gate).toMatch(/'private_key_open_failed'/);
    expect(gate).toMatch(/'partial_stream_pending'/);
    expect(gate).toMatch(/'index_limit_without_cursor'/);
    expect(gate).toMatch(/messageAutoSyncPhase = complete \? 'synced' : 'delayed'/);
    // The incomplete-multipart count is surfaced into the result so the gate + labels see it.
    const resultBuilder = app.slice(
      app.indexOf('function privateSyncResult'),
      app.indexOf('function privateIndexLinkValue'),
    );
    expect(resultBuilder).toMatch(/incompletePrivateStreamCount: Number\(fields\.incompletePrivateStreamCount \?\? 0\)/);
    // Honest labels for the pending / delayed states.
    const statusText = app.slice(
      app.indexOf('function privateSyncStatusText'),
      app.indexOf('async function syncPrivateCapsulesFromChain'),
    );
    expect(statusText).toMatch(/incompletePrivateStreamCount \?\? 0\) > 0/);
    expect(statusText).toMatch(/t\('sync\.partsPending'\)/);
    expect(EN_STRINGS['sync.partsPending']).toBe('message parts pending');
    expect(statusText).toMatch(/Number\(result\.skipped \?\? 0\) > 0/);
  });

  // PWA-RECEIVE-RETRY-01 removed with the CapsuleHub index walk. The stuck-entry ledger existed because a cursor
  // walking a shared log had to advance PAST an entry it could not open, and that entry would then be buried
  // forever. The shard reader re-reads the conversation's whole epoch window every tick, so an entry that failed
  // once is retried by construction; an unreadable capsule is counted as skipped and the scan reports itself
  // incomplete (scanComplete:false) instead of silently claiming to be up to date.

  // PWA-DOUBLEPUBLISH-01 removed with the fresh-sign-vs-re-broadcast split it policed. That split existed because a
  // Vault part carried its own nonce and could be re-signed under a new one. Direct pay makes the same guarantee
  // structurally: the external is bound to the wallet seqno (chain executes it at most once) and an ambiguous
  // broadcast returns the signed BOC for verbatim re-broadcast — pinned in PUBLISH-RETRY-01 and PWA-CONV-DELIVERY-01.

  it('PWA-SEND-RELIABILITY-01: burst-send hardening — no false-fail, no dual-broadcast, no read storm', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const vaultRpc = readFileSync('web/ton-rpc-transport.mjs', 'utf8');

    // #6: the keyword hard-fail guard only fires for definitive client-side <500
    // rejections, so a 5xx (possibly-delivered) broadcast is never marked rejected.
    const ambiguous = app.slice(
      app.indexOf('function isAmbiguousTonRpcBroadcastError'),
      app.indexOf('function privateSendRetryDelayMs'),
    );

    // #2: a pre-send FAILED part (nothing left the device) shows a neutral
    // "queued, retrying", never a red terminal "not sent".
    const meta = app.slice(
      app.indexOf('function publishStateMeta'),
      app.indexOf('function isVaultPublishPartialError'),
    );
    expect(meta).toMatch(/publishStateHasRetryableSendParts\(publishState\) \? 'queued, retrying' : 'not sent'/);

    // #3: the private composer rejects new sends while the RPC is in active
    // rate-limit backoff (backpressure). The "RPC busy" copy is unique to the
    // private gate (the public composer's tonRpcLimited() gate returns silently),
    // so assert it sits directly inside a tonRpcLimited() guard.
    expect(app).toMatch(/if \(tonRpcLimited\(\)\) \{[\s\S]{0,800}?t\('chat\.rpcBusy'\)/);
    expect(EN_STRINGS['chat.rpcBusy']).toBe('RPC busy, send again in a moment');

    // #4: a PRIMARY (non-emergency) gateway HTTP-5xx on sendBoc stops the loop
    // (confirm-via-read) rather than re-broadcasting to the keyless emergency
    // toncenter; connectivity death (no HTTP status) still falls through.
    expect(vaultRpc).toMatch(/&& !isEmergencyFallbackTransport\(transport\)/);
    expect(vaultRpc).toMatch(/\?\? 0\) >= 500\s*\n\s*\) throw error/);

    // #5: the message-history path parks a verifier that 429s and skips parked
    // transports, closing the direct toncenter /messages 429 leak.
    expect(vaultRpc).toMatch(/export function noteTonRpcReadTransportRateLimited\(transport, error\)/);
    // (The CapsuleHub half of this guard went with capsulehub-ton-rpc-provider.mjs; the parking mechanism itself
    // lives in ton-rpc-transport.mjs — the shared RPC pump every clean-17 reader goes through — and is pinned
    // by the assertion above.)
  });

  // PWA-CAPSULE-ENTRY-VERIFY-01 removed with the CapsuleHub publish confirmation it verified end to end: the entry
  // scan, the receipt ring, the sender-index recovery and the per-part matcher all went with the Vault batch, and
  // every symbol it pinned (confirmCapsuleHubPublishEntries*, publishConfirm*, capsuleHubConfirmationProvider-
  // Candidates, createCapsuleHubTonRpcProvider) no longer exists. A direct-pay message is ONE wallet transfer, so
  // its confirmation is the wallet seqno plus the CONV delivery confirm — pinned in PWA-CONV-DELIVERY-01, whose
  // #1..#6 carry this test's actual invariants (never claim delivery without an authoritative read, never turn an
  // inconclusive read into a false red).

  // RT-PWA-CAPS-001 removed with the CapsuleHub publish confirmation: it required a verified, fail-closed read
  // before marking a Vault batch confirmed. The direct lane's equivalent — never claim delivery without an
  // authoritative read, never false-red on an inconclusive one — is pinned in PWA-CONV-DELIVERY-01.

  // RT-PWA-CAPS-001B removed with the CapsuleHub publish/confirm model: it pinned repairing STALE PENDING parts by
  // matching payload hashes against entries of the shared log. A direct-pay send has no publishState to repair —
  // its confirmation is the wallet transfer plus the CONV delivery confirm (armConvDeliveryConfirm).

  // RT-VCAPS-001 removed with the Vault confirm driver: "an already-submitted publish keeps a long
  // background confirmation window" described polling a publishState the direct lane never creates. Its
  // successor — the CONV delivery confirm and its 24h re-arm window — is pinned in PWA-CONV-DELIVERY-01.
  // RT-VCAPS-002 removed with the Vault publish trunk: it pinned the CapsuleHub-global preflight before signing a
  // Vault publish external (sealed / vault_bound / manifest hash / FeeAccumulator binding). A direct publish is
  // addressed to a shard derived from the wallet + epoch and needs no Hub global read at all.

  it('PWA-SEND-18: outbound private work pauses automatic message sync', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const autoSyncSource = app.slice(
      app.indexOf('function scheduleMessageAutoSync'),
      app.indexOf('async function bootReplayStore'),
    );
    // clean-17: the live private SEND is direct-pay and its keyless sync coordination moved to the composer send
    // handler (proven by PWA-SEND-18B). What remains here is the auto-sync pause CONDITION plus the orphaned Vault
    // confirm-retry's use of the same beginPrivateOutboundWork primitive (kept until its follow-up removal batch).
    const confirmSource = app.slice(
      app.indexOf('async function runPrivatePublishConfirmationRetry'),
      app.indexOf('function hasPendingPrivatePublishConfirmation'),
    );

    expect(app).toMatch(/let privateOutboundWorkDepth = 0/);
    expect(app).toMatch(/function beginPrivateOutboundWork\(\)/);
    // Sync pauses for BOTH an in-flight broadcast (privateOutboundWorkActive) AND the full publish-confirm
    // lifecycle (privatePublishConfirmJobs.size > 0) — the confirm phase's reads otherwise compete with the
    // index walk for the keyless ~1 rps budget and 429-storm an image sent during sync.
    // Also yields while account activation is in flight (plathoAccountActivationPending) — activation fires
    // its own vault read burst and concurrent background reads stall the iOS run loop (v509 pattern).
    expect(autoSyncSource).toMatch(/if \(privateOutboundWorkActive\(\) \|\| privatePublishConfirmJobs\.size > 0 \|\| plathoAccountActivationPending\) \{/);
    expect(autoSyncSource).toMatch(/scheduleMessageAutoSync\(PRIVATE_OUTBOUND_SYNC_PAUSE_MS\)/);
    expect(app).toMatch(/const PRIVATE_SEND_SYNC_WAIT_CAP_MS = 2_500/);
  });

  it('PWA-SEND-18B: keyless direct-pay private send coordinates with sync; a keyed send stays latency-free', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // Runtime keyless gate: true ONLY when no toncenter key is active (a rejected key reverts to '').
    expect(app).toMatch(/function usingKeylessTonRpc\(\) \{\s*\n\s*return !\(globalThis\.plathoToncenterApiKey[\s\S]*globalThis\.plathoTonRpcApiKey[\s\S]*appConfig\.network\?\.tonRpc\?\.apiKey\);/);
    // The composer send handler pauses sync + yields to an in-flight pass ONLY on the keyless budget (a keyed send
    // skips both — no added latency); the pause is released in a finally so it can never wedge sync off.
    expect(app).toMatch(/const keylessBudget = usingKeylessTonRpc\(\);\s*\n\s*const endPrivateOutboundWork = keylessBudget \? beginPrivateOutboundWork\(\) : null;/);
    expect(app).toMatch(/if \(keylessBudget && privateChainSyncPromise\) \{[\s\S]*Promise\.race\(\[[\s\S]*PRIVATE_SEND_SYNC_WAIT_CAP_MS/);
    expect(app).toMatch(/await enqueueOutgoingPublish\(\(\) => attemptPrivateComposerMessagePublish\(sendContext\)\);[\s\S]{0,260}?finally \{\s*\n\s*if \(endPrivateOutboundWork\) endPrivateOutboundWork\(\);/);
    // The direct-pay delivery confirm read (armConvDeliveryConfirm -> runConvDeliveryConfirm) pauses sync for THAT
    // read only (bounded, per spaced tick) on the keyless budget — never the whole 24h re-arm window.
    expect(app).toMatch(/const endConfirmOutboundWork = usingKeylessTonRpc\(\) \? beginPrivateOutboundWork\(\) : null;/);
    expect(app).toMatch(/if \(endConfirmOutboundWork\) endConfirmOutboundWork\(\);/);
  });

  it('PWA-MSG-01: default public sync window covers the maximum public multipart image', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const html = readFileSync('web/index.html', 'utf8');

    // The window is no longer a client constant over a shared log: a shard is read as its NEWEST page
    // (PS_PAGE_CAP = 96 rows, tail-anchored) plus a one-page straddle extension. What must hold is that a single
    // post can never need more than that: the composer caps a post at 16 capsules, far below 96, so a multipart
    // post is always closable inside one extension. Measured end-to-end in public-lane-read-window.
    expect(readFileSync('web/public-shard-ton-rpc-provider.mjs', 'utf8')).toMatch(/maxCount = 96n/);
    expect(readFileSync('contracts/PublicShard.tact', 'utf8')).toMatch(/const PS_PAGE_CAP: Int = 96;/);
    expect(app).toMatch(/maximum: Object\.freeze\(\{ id: 'maximum', label: 'Maximum', maxBytes: 64 \* 1024 \}\)/);
    expect(app).toMatch(/function imagePartsForSend\(attachment, label = 'image'\)/);
    // The "History sync" control is GONE (owner, 2026-08-07), and this gate is why it lasted as long as it did:
    // the comment that used to stand here already said the configurable window was a property of paging one
    // shared log and that a shard has no window to configure — and the lines right below it pinned that control's
    // markup and its normaliser anyway. So the gate held a dead switch in place while explaining that it was
    // dead. By the time it was removed, publicSyncCutoffMs() had been returning null unconditionally: both
    // options rendered the same feed, and a user choosing "retained history, up to 1 year" was told they had
    // widened their history and got nothing.
    expect(html).not.toMatch(/publicSyncWindowSelect/);
    expect(html).not.toMatch(/public\.syncWindow/);
    // Anchored on the definitions: the comment explaining the removal names these functions, and a bare
    // substring match would fail against the very note that records why they are gone.
    expect(app).not.toMatch(/function (publicSyncCutoffMs|normalizePublicSyncWindow|isFreshPublicTimestamp)\(/);
    // And the date-filtered feed view it fed goes with it: the feed shows whatever the shard still retains.
    expect(app).not.toMatch(/function publicFeedCacheForCurrentWindow/);
  });

  it('PWA-MSG-02: private composer cannot create streams larger than the default private sync window', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const helperSource = app.slice(
      app.indexOf('function privateComposerRetrievalPartLimit'),
      app.indexOf('function privateComposerPublishProfilesForPlan'),
    );
    const shortfallSource = app.slice(
      app.indexOf('function privateComposerKnownVaultTonShortfall'),
      app.indexOf('function publicComposerKnownVaultTonShortfall'),
    );
    const statusSource = app.slice(
      app.indexOf('function refreshComposerCostStatus'),
      app.indexOf('function normalizePublicSyncWindow'),
    );
    const submitSource = app.slice(
      app.indexOf("composer?.addEventListener('submit'"),
      app.indexOf('async function resolvePaymentCheckRecipientWallet'),
    );
    const capsuleSource = app.slice(
      app.indexOf('async function attemptConvMessagePublishDirect'),
      app.indexOf('async function attemptPrivateComposerMessagePublish'),
    );
    const syncSource = app.slice(
      app.indexOf('async function syncPrivateCapsulesFromChain'),
      app.indexOf('async function syncPrivateCapsulesFromChainOnce'),
    );

    expect(app).toMatch(/const PRIVATE_CHAIN_INDEX_READ_LIMIT = 120/);
    // (The per-hub override went with the Hub config; the limit is the constant, which is what the composer caps on.)
    expect(helperSource).toMatch(/return PRIVATE_CHAIN_INDEX_READ_LIMIT;/);
    // Localized (v697): the part-limit message is a CLDR plural key in all 10 locales, selected by the part
    // count, with the limit as a plain param — no hardcoded-English status/tooltip text.
    expect(helperSource).toMatch(/return tPlural\('composer\.privatePartLimit', parts, \{ limit \}\);/);
    expect(helperSource).toMatch(/return tPlural\('composer\.publicPartLimit', parts, \{ limit: COMPOSER_MAX_MESSAGE_PARTS \}\);/);
    expect(EN_STRINGS['composer.privatePartLimit#other']).toBe('Private message has {count} capsules (limit {limit}); split it into smaller messages');
    expect(EN_STRINGS['composer.publicPartLimit#other']).toBe('Post has {count} capsules (limit {limit}); split it into smaller posts');
    expect(helperSource).toMatch(/function assertPrivateComposerPartLimit/);
    expect(shortfallSource).toMatch(/if \(privateComposerPartLimitMessage\(plan\.length\)\) return true/);
    expect(statusSource).toMatch(/const limitMessage = privateComposerPartLimitMessage\(privatePlan\.length\)/);
    expect(statusSource).toMatch(/\? \{ text: limitMessage, state: 'short' \}/);
    expect(submitSource).toMatch(/const limitMessage = privateComposerPartLimitMessage\(sendPlan\.length\)/);
    expect(submitSource).toMatch(/privateComposerCostStatus\.textContent = limitMessage/);
    expect(capsuleSource).toMatch(/assertPrivateComposerPartLimit\(documentParts\.length\)/);
    // The private receive window is the conversation shard's own history (newest-first), not a Hub index: the
    // composer's capsule cap keeps one message inside one pass, and an incomplete group is held back rather than
    // shown truncated.
    const convReceiveSource = app.slice(
      app.indexOf('async function syncConvCapsulesFromShards'),
      app.indexOf('async function syncPrivateCapsulesFromChain('),
    );
    expect(convReceiveSource).toMatch(/entries = await lane\.readIncoming\(/);
    expect(app).toMatch(/if \(parts\.length < partCount\) continue;/);
    // (The unverified-index read modes and the cursor persistence mode were properties of the CapsuleHub index
    // walk: a shard read has no index to read unverified and no cursor to persist. What replaced the cursor is
    // the per-conversation scan cursor, advanced ONLY on a fully clean pass.)
    expect(convReceiveSource).toMatch(/if \(convClean\) await convKeyStore\.advanceConvScanCursor\(selfKeyId, peerKeyId, epochNow\);/);
    // The rest of this block pinned the CapsuleHub walk's bookkeeping (head-repair links, the pending-publish
    // confirm sweep over hub entries, the body-history ledger, its per-group error capture). The shard receive
    // keeps the two properties that are about the USER's data rather than about the log: an incomplete multipart
    // group is held back (asserted above), and a per-group failure is caught so one bad group cannot abort the
    // pass.
    expect(app).toMatch(/console\.warn\('\[conv\] append failed', error\)/);
    expect(app).toMatch(/pruneEmptyAnonymousPeerThreads\(\)/);
  });

  it('PWA-MSG-02B: private anonymous mode omits sender wallet metadata without merging inbound peers', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const identities = readFileSync('web/recipient-identities.mjs', 'utf8');
    const html = readFileSync('web/index.html', 'utf8');

    expect(html).toMatch(/id="privateAnonymousButton"/);
    expect(html).toMatch(/Send pseudonymously without wallet address/);
    expect(html).toMatch(/Pseudonymous: wallet address hidden, sender key may still link messages/);
    expect(app).toMatch(/const PRIVATE_SENDER_MODE_STORAGE_PREFIX = 'platho\.privateSenderMode\.v1'/);
    expect(app).toMatch(/ANONYMOUS: 'anonymous'/);
    expect(app).toMatch(/function currentPrivateSenderOptions\(\)[\s\S]*includeSenderWalletMetadata,[\s\S]*senderUsername: linkedUsername\?\.label \?\? undefined/);
    expect(app).toMatch(/function privateSenderModeToggleBlockReason\(sendBlock\)/);
    expect(app).toMatch(/function canTogglePrivateSenderMode\(\)/);
    expect(app).toMatch(/privateAnonymousButton\.disabled = Boolean\(blockReason\)/);
    expect(app).toMatch(/privateAnonymousButton\.title = blockReason \?\? \(/);
    expect(app).toMatch(/privateAnonymousButton\?\.addEventListener\('click', \(\) => \{[\s\S]*if \(!canTogglePrivateSenderMode\(\)\)/);
    expect(enCopy).toMatch(/Pseudonymous: wallet address hidden, sender key may still link messages/);
    // The eye's block reason ROUTES THROUGH privateSendBlockReason (v696: the whole composer row follows the
    // send state), but updatePrivateSenderModeUi itself must not grow a direct dependency on the flickering
    // activation read — the reason is computed once by the funnel and passed in (no per-call plan builds).
    const senderModeUiSource = app.slice(
      app.indexOf('function updatePrivateSenderModeUi'),
      app.indexOf('function normalizeLinkedPlathoUsername'),
    );
    expect(senderModeUiSource).not.toMatch(/hasActivePlathoAccount\(\)/);
    expect(app).toMatch(/function updatePrivateSenderModeUi\(sendBlockReason = privateSendBlockReason\(\)\)/);
    expect(app).toMatch(/privateSenderModeToggleBlockReason\(sendBlockReason\)/);
    // clean-17: the anonymous flag (currentPrivateSenderOptions().includeSenderWalletMetadata) is asserted above; the
    // former createPrivateComposerCapsules internals (the senderMetadata ternary) went with the Vault composer path.
    // senderUsername went with them and should NOT have: the recipient has no other source for the peer's .ath (there
    // is no reverse wallet -> name index on chain), so dialogs showed a raw address forever. Restored 2026-08-03 at
    // the direct-pay encode site; the sender WALLET stays out, which is the invariant below.
    expect(app).toMatch(/privateComposerSendPlan\(text, attachments, senderOptions\)/);
    // clean-17 honest payload invariant: the live direct-pay CONV send (attemptConvMessagePublishDirect) seals to the
    // peer's KeyShard bundle and NEVER embeds the sender wallet in the capsule payload — the identity is messaging-keys
    // only, so "omit sender wallet metadata" holds at the payload level regardless of the anonymous toggle. (The removed
    // Vault composer spread ...senderMetadata{senderWallet} into encodeCompactPayload and stripped it when anonymous.)
    // NOTE: the sender wallet is still on-chain as the direct-pay fee publisher — pseudonymity is bounded to third
    // parties (the conversation graph stays hidden), not the recipient. See the pseudonymous-mode privacy memo.
    const convSendSource = app.slice(
      app.indexOf('async function attemptConvMessagePublishDirect'),
      app.indexOf('async function attemptPrivateComposerMessagePublish'),
    );
    expect(convSendSource).toMatch(/encodeCompactPayload\(\{\s*type: 'document', bytes: part\.bytes/);
    expect(convSendSource).not.toMatch(/senderWallet/);
    expect(convSendSource).not.toMatch(/\.\.\.senderMetadata/);
    expect(identities).toMatch(/const anonymousId = normalizedPeerId\(input\.senderKeyId \?\? input\.keyId\)/);
    expect(identities).toMatch(/id: identity \? recipientThreadId\(identity\) : `peer:\$\{encodeURIComponent\(anonymousId\)\}`/);
    expect(identities).toMatch(/`Anonymous \$\{shortPeerId\(anonymousId\)\}`/);
    // (knownPrivateWalletForSigningPubkey and its session cache went with the Hub receive path: they inferred a peer's
    // wallet from the dialog a message currently sits in, which is the "position decides identity" mistake the
    // cross-wallet bleed review named. The direct lane never guesses — the peer wallet is a field of the conversation
    // record, written when the INTRO was adopted and re-verified against the peer's KeyShard on every reply.)
    // v725 hid an unidentified inbound dialog during a grace window when its sender was CLAIMED but not yet verified,
    // so a real dialog only appeared once resolved (no "Anonymous …" flicker); a GENUINELY anonymous sender was shown
    // straight away.
    //
    // The paragraph that used to stand here claimed direct pay only ever produces the second case, "because an INTRO
    // by design carries no sender wallet", and concluded that nothing setting the flags was correct. Both halves were
    // false and cost the owner a week of dialogs named "Anonymous …": the INTRO publish tx SRC *is* the sender's
    // wallet under direct pay, intro-receive-handler has always stored it as peerWallet, and a CONV message brings no
    // wallet at all. The flags now have a writer again (handleIntroFirstContact arms them while the KeyShard
    // verification is in flight), which is what the grace was built for.
    expect(app).toMatch(/function isPendingIdentityResolutionThread\(thread\)/);
    expect(app).toMatch(/function isTransientPendingResolutionThread\(thread\)/);
    expect(app).toMatch(/if \(isTransientPendingResolutionThread\(thread\)\) return false;/);
    expect(app).not.toMatch(/privateChainSyncPromise && isPendingIdentityResolutionThread\(thread\)/);
    expect(app).toMatch(/function pruneEmptyAnonymousPeerThreads\(\)/);
    expect(app).toMatch(/pruneEmptyAnonymousPeerThreads\(\)/);
  });

  it('PWA-MSG-02C: private attachments are composer drafts, not single-slot or immediate-send actions', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const html = readFileSync('web/index.html', 'utf8');
    const submitSource = app.slice(
      app.indexOf("composer?.addEventListener('submit'"),
      app.indexOf('createWalletButton?.addEventListener'),
    );

    expect(app).toMatch(/let privateImageAttachments = \[\]/);
    // Payment checks are RETIRED (they were not anonymous — the codec keeps byte 3 reserved and never reuses it).
    // Nothing in the composer carries a check draft any more; the marker is not even tokenized.
    expect(app).not.toMatch(/privatePaymentCheckDraft/);
    expect(app).not.toMatch(/paymentCheckButton/);
    expect(app).toMatch(/privateImageAttachments = \[\.\.\.privateImageAttachments, attachment\]/);
    expect(app).toMatch(/function composerBlocksFromDraft/);
    expect(app).toMatch(/function messageDocumentBytesFromDraft/);
    expect(submitSource).toMatch(/const attachments = normalizePrivateImageAttachments\(privateImageAttachments\)/);
    expect(submitSource).toMatch(/const draftBlocks = composerBlocksFromDraft\(text,\s*attachments,\s*replyDraft,\s*fileAttachments,\s*shareDraft\)/);
    expect(submitSource).toMatch(/blocks:\s*displayBlocks/);
  });

  it('PWA-MSG-02D: rich private document messages survive encrypted-history restore and chain rehydrate', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const serializeSource = app.slice(
      app.indexOf('function serializeMessageForHistory'),
      app.indexOf('function serializeThreadForHistory'),
    );
    const upsertSource = app.slice(
      app.indexOf('function mergeOpenedPrivateMessage'),
      app.indexOf('function refreshThreadIdentityFromVariants'),
    );
    const appendSingleSource = app.slice(
      app.indexOf('async function appendOpenedCapsuleMessage'),
      app.indexOf('async function appendOpenedPrivatePartsMessage'),
    );
    const appendPartsSource = app.slice(
      app.indexOf('async function appendOpenedPrivatePartsMessage'),
      app.indexOf('function isBodyHistoryUnavailableError'),
    );

    expect(serializeSource).toMatch(/blocks:\s*messageBlocksForHistory\(message\)/);
    expect(app).toMatch(/function messageBlocksForHistory\(message\)[\s\S]*safeJsonClone\(message\.blocks\)/);
    expect(upsertSource).toMatch(/const incomingBlocks = Array\.isArray\(incomingMessage\.blocks\)/);
    expect(upsertSource).toMatch(/existingMessage\.blocks = safeJsonClone\(incomingBlocks\) \?\? incomingBlocks/);
    expect(upsertSource).toMatch(/clearPrivateMessageManualRecovery\(existingMessage\)/);
    expect(upsertSource).toMatch(/await updateMessageInEncryptedHistory\(targetThread, existing\.message\)/);
    expect(appendSingleSource).toMatch(/const message = messageFromOpenedCapsule\(opened, meta, entry\)/);
    expect(appendSingleSource).toMatch(/if \(!targetThread\) throw new Error\('Private chain message target thread could not be resolved'\)/);
    expect(appendSingleSource).toMatch(/if \(existing\) return upsertOpenedPrivateMessage\(existing, targetThread, message\)/);
    expect(appendPartsSource).toMatch(/const message = messageFromOpenedPrivateParts\(parts, meta\)/);
    expect(appendPartsSource).toMatch(/if \(!targetThread\) throw new Error\('Private chain multipart target thread could not be resolved'\)/);
    expect(appendPartsSource).toMatch(/if \(existing\) return upsertOpenedPrivateMessage\(existing, targetThread, message\)/);
    // (threadForOpenedSenderCapsule — the "recovered sent" router that rebuilt a dialog from an OWN capsule read back
    // off the Hub's sender index — went with that index. The direct lane reads a conversation's own RecordShards by
    // bucketKey, so a recovered own message lands in the conversation it was addressed to by construction.)
  });

  // PWA-CONFIG-01D4C removed with submitVaultAuthExternalWithNonceConfirmation — the last Vault auth external is
  // gone, so there is no publish-nonce ladder left to confirm after an ambiguous broadcast. The direct-pay
  // counterpart (an ambiguous broadcast hands back the signed BOC and the retry re-broadcasts it VERBATIM under
  // its original seqno) is pinned in PWA-SEND-02C.

  it('PWA-CONFIG-01D5: public submitted publish creates durable pending feed items', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const source = app.slice(
      app.indexOf('function mergeLocalPendingPublicFeed'),
      app.indexOf('globalThis.plathoVaultTransactions'),
    );

    expect(source).toMatch(/function mergeLocalPendingPublicFeed/);
    expect(source).toMatch(/isPendingPublicFeedItem/);
    expect(source).toMatch(/rememberLocalPublicPost\([^)]*attachments, \{/);
    expect(source).toMatch(/rememberLocalPublicComment\([^)]*attachments, \{/);
    // clean-17 direct-pay: a public post/comment is 'sending' → resolved synchronously (no Vault-only
    // 'submitted'/'partial' intermediate); isPendingPublicFeedItem is status-agnostic (publishStatus + no entryId),
    // so mid-flight records still survive reload and are healed by resumePendingPublicPublishConfirmations.
    expect(source).toMatch(/publishStatus: 'sending'/);
  });

  // PWA-CONFIG-01D3 removed with the Vault publish nonce. It pinned that the nonce poll read UNCACHED and
  // VERIFIED, because signing under a stale nonce produced a permanently-rejected external. A direct-pay external
  // is ordered by the WALLET SEQNO, which the wallet reads for itself before every send — there is no second
  // counter to poll and no cache to bypass.

  // RT-PWA-VLT-002 removed with the Vault pre-sign read helpers: 'own-action reads fail closed while post-broadcast
  // nonce waits may fall back' describes reading a VAULT before signing a Vault external. Both halves are gone.
  // The degradation rule that survived — criticalChainReadOptions as the single choke point for every critical
  // read — is pinned in PWA-CONFIG-01D4B.

  it('PWA-CONFIG-01E: public publishing uses the shared composer and explicit feed controls', () => {
    const html = readFileSync('web/index.html', 'utf8');
    const publicHeader = html.match(/<section class="content-pane public-pane[\s\S]*?<\/header>/)?.[0] ?? '';

    expect(html).toMatch(/id="publicChannelSearch"/);
    // The search rows carry NO "+" icon buttons anymore (owner: a bare plus is unreadable) — the add flows
    // moved onto the labeled CTA plates (public channels plate / private add-a-contact plate).
    expect(html).not.toMatch(/id="addPublicChannelButton"/);
    expect(html).not.toMatch(/id="newChatButton"/);
    expect(html).toMatch(/class="search-row"[\s\S]*id="threadSearch"/);
    expect(html).toMatch(/placeholder="Search public"/);
    expect(html).toMatch(/id="publicJumpDownButton"/);
    expect(html).toMatch(/class="public-jump-down-button" id="publicJumpDownButton"[\s\S]*hidden/);
    expect(publicHeader).not.toMatch(/id="publicJumpDownButton"/);
    expect(html).not.toMatch(/id="refreshVaultButton"/);
  });

  it('PWA-EMPTY-CHANNEL-01: a followed channel with no posts shows a clean card with Unfollow (no Preview-only)', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const mjs = readFileSync('web/public-channel-subscriptions.mjs', 'utf8');
    // The "no posts yet" placeholder for a followed channel is flagged so its card can drop the useless comment button.
    expect(mjs).toMatch(/text: thread\.preview,[\s\S]*?compact: true,[\s\S]*?emptyChannel: true,/);
    // appendPublicItemActions skips the comment button for an empty-channel card (nothing to comment on), leaving
    // Private chat + Unfollow — so an empty channel stays unfollowable, with Unfollow the clear action.
    expect(app).toMatch(/if \(!item\.emptyChannel\) \{[\s\S]*?const commentButton = document\.createElement\('button'\)/);
    // Unfollow is the shared post action, so it also reaches the empty-channel placeholder card.
    expect(app).toMatch(/if \(!isOwnPost && isPublicChannelSubscribed\(item\.channelId\)\)[\s\S]*?textContent = t\('public\.unfollow'\)/);
    expect(EN_STRINGS['public.unfollow']).toBe('Unfollow');
  });

  it('PWA-CONFIG-02: production config passes only with mainnet and provider module configured', () => {
    const report = validatePlathoAppConfig(productionConfig);

    expect(report.ok).toBe(true);
    expect(report.findings).toEqual([]);
    expect(productionConfig.messaging?.pricing?.maxNetworkFeeSurchargeNanotons).toBe('50000000');
    expect(productionConfig.messaging?.pricing?.highNetworkFeeSurchargeConfirmNanotons).toBe('10000000');
    expect(productionConfig.messaging?.pricing?.manualNetworkFeeSurchargeOverrideNanotons).toBe('50000000');
  });

  it('PWA-CONFIG-03: production config rejects hidden testnet or preview strings', () => {
    const report = validatePlathoAppConfig({
      ...productionConfig,
      ui: {
        ...productionConfig.ui,
        networkLabel: 'testnet',
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.id)).toContain('PWA_PRODUCTION_CONFIG_CONTAINS_NON_PROD_MARKERS');
  });

  it('PWA-CONFIG-03B: production config requires a network surcharge guard', () => {
    const report = validatePlathoAppConfig({
      ...productionConfig,
      messaging: {
        pricing: {
          estimatedNetworkFeeNanotons: '5000000',
          includedNetworkFeeNanotons: '5000000',
          roundingStepNanotons: '1000000',
        },
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.id)).toContain('PWA_NETWORK_SURCHARGE_GUARD_REQUIRED');
  });

  it('PWA-CONFIG-03D: production config does not treat high-surcharge consent as a hard cap', () => {
    const report = validatePlathoAppConfig({
      ...productionConfig,
      messaging: {
        pricing: {
          estimatedNetworkFeeNanotons: '5000000',
          includedNetworkFeeNanotons: '5000000',
          roundingStepNanotons: '1000000',
          highNetworkFeeSurchargeConfirmNanotons: '10000000',
          manualNetworkFeeSurchargeOverrideNanotons: '50000000',
        },
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.id)).toContain('PWA_NETWORK_SURCHARGE_GUARD_REQUIRED');
  });

  it('PWA-CONFIG-03C: production config accepts a hard max surcharge even without high-surcharge consent', () => {
    const report = validatePlathoAppConfig({
      ...productionConfig,
      messaging: {
        pricing: {
          estimatedNetworkFeeNanotons: '5000000',
          includedNetworkFeeNanotons: '5000000',
          roundingStepNanotons: '1000000',
          maxNetworkFeeSurchargeNanotons: '60000000',
        },
      },
    });

    expect(report.ok).toBe(true);
  });

  // PWA-CONFIG-03E removed with the fallback it banned. The clean-15 escape hatch fetched a STATIC JSON feed from
  // channel.sourceUrl when a config flag allowed it; production always refused, nothing ever set the flag, and the
  // path is now deleted outright — fetching the feed from a URL is exactly the external dependency this project
  // forbids. A config ban on a code path that does not exist is worse than no ban: it reads as protection.

  it('PWA-CONFIG-03F: production config requires FeeAccumulator address for CapsuleHub preflight', () => {
    const report = validatePlathoAppConfig({
      ...productionConfig,
      feeAccumulator: {},
    });

    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.id)).toContain('PWA_FEE_ACCUMULATOR_ADDRESS_REQUIRED');
  });

  // PWA-CONFIG-04 removed with the Vault's runtime-injected provider bridge. It required a production bundle to NAME
  // a static chain-provider module, because the Vault provider was resolved at runtime off globalThis and could be
  // absent. Every clean-17 reader is a STATIC import in app.js — nothing to configure, nothing that can go missing.

  it('PWA-CONFIG-04A: production config requires replaceable TON RPC providers', () => {
    const report = validatePlathoAppConfig({
      ...productionConfig,
      network: {
        ...productionConfig.network,
        tonRpc: {
          providers: [
            {
              id: 'only',
              kind: 'toncenter-v3',
              runGetMethodEndpoint: 'https://toncenter.example/api/v3/runGetMethod',
              sendBocEndpoint: 'https://toncenter.example/api/v3/message',
            },
          ],
        },
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.id)).toContain('PWA_TON_RPC_REPLACEABLE_PROVIDER_LIST_REQUIRED');
  });

  it('PWA-CONFIG-04AA: production critical reads require two concrete RPC providers', () => {
    const report = validatePlathoAppConfig({
      ...productionConfig,
      network: {
        ...productionConfig.network,
        tonRpc: {
          primaryProviderId: 'custom',
          fallbackProviderIds: ['toncenter'],
          verifyCriticalReads: true,
          providers: [
            { id: 'custom', kind: 'custom', globalName: 'plathoCustomTonRpcTransport' },
            {
              id: 'toncenter',
              kind: 'toncenter-v3',
              runGetMethodEndpoint: 'https://toncenter.example/api/v3/runGetMethod',
              sendBocEndpoint: 'https://toncenter.example/api/v3/message',
            },
          ],
        },
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.id)).toContain('PWA_TON_RPC_TWO_CONCRETE_PROVIDERS_REQUIRED');
  });

  it('PWA-CONFIG-04AB: production config requires a concrete message-history provider', () => {
    const providers = productionConfig.network.tonRpc.providers.map((provider) => {
      const { messagesEndpoint, ...rest } = provider as Record<string, unknown>;
      return rest;
    });
    const report = validatePlathoAppConfig({
      ...productionConfig,
      network: {
        ...productionConfig.network,
        tonRpc: {
          ...productionConfig.network.tonRpc,
          providers,
        },
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.id)).toContain('PWA_TON_RPC_MESSAGE_HISTORY_PROVIDER_REQUIRED');
  });

  it('PWA-CONFIG-04AC: production config requires the full critical read method set', () => {
    expect(PLATHO_APP_CONFIG.network.tonRpc.criticalMethods).toEqual([...REQUIRED_TON_RPC_CRITICAL_METHODS]);

    const report = validatePlathoAppConfig({
      ...productionConfig,
      network: {
        ...productionConfig.network,
        tonRpc: {
          ...productionConfig.network.tonRpc,
          criticalMethods: REQUIRED_TON_RPC_CRITICAL_METHODS.filter(
            (method) => !['dnsresolve', 'get_wallet_address', 'get_view'].includes(method),
          ),
        },
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.id)).toContain('PWA_TON_RPC_CRITICAL_METHOD_REQUIRED');
    expect(report.findings.map((finding) => finding.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('dnsresolve'),
        expect.stringContaining('get_wallet_address'),
        expect.stringContaining('get_view'),
      ]),
    );
  });

  it('PWA-CONFIG-04B: production config requires TON DNS route configuration', () => {
    const report = validatePlathoAppConfig({
      ...productionConfig,
      tonDns: {
        rootAddress: null,
        provider: {
          globalName: null,
          moduleUrl: null,
          requiredInProduction: true,
        },
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.id)).toContain('PWA_TON_DNS_PROVIDER_REQUIRED');
  });

  it('PWA-CONFIG-04C: production config requires ProfileRegistry for paid avatar updates', () => {
    const report = validatePlathoAppConfig({
      ...productionConfig,
      profileRegistry: {
        address: null,
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.id)).toContain('PWA_PROFILE_REGISTRY_ADDRESS_REQUIRED');
  });

  it('PWA-CONFIG-04D: production config requires the genesis deployment manifest hash for signed publish domain', () => {
    const report = validatePlathoAppConfig({
      ...productionConfig,
      genesis: {
        ...productionConfig.genesis,
        deploymentManifestHash: null,
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.id)).toContain('PWA_GENESIS_DEPLOYMENT_MANIFEST_HASH_REQUIRED');
  });

  it('PWA-CONFIG-05: production config does not carry external wallet connector settings', () => {
    expect(JSON.stringify(productionConfig)).not.toMatch(new RegExp('ton' + 'connect', 'i'));
  });

  it('PWA-CONFIG-06: public CapsuleHub sync skips malformed entries per entry', () => {
    const app = readFileSync('web/app.js', 'utf8');

    // Per-ENTRY tolerance survived the move: one unreadable payload must never abort the pass. In the shard
    // readers that is a per-entry try/catch around the PPH2 decode — posts and comments alike.
    // (The Hub entry funnel is gone; the shard readers each carry the per-entry try/catch pinned below.)
    // The decode moved out of the sync loop into publicPostPartsFromShardPosts so the ADDRESSED single-post read (a
    // repost whose original the reader does not hold) decodes through the same code — the tolerance moved with it,
    // which is the point of having one decoder rather than two.
    const shardSync = app.slice(app.indexOf('async function publicPostPartsFromShardPosts'), app.indexOf('async function syncPublicChannelFromChain'));
    expect(shardSync).toMatch(/try \{ payload = readPublicPostPayloadV2\(\{ header: sp\.header, body: sp\.body \}\); \} catch \{ continue; \}/);
    expect(shardSync, 'and the sync still routes through it').toMatch(/await publicPostPartsFromShardPosts\(shardPosts, channel\)/);
    const shardComments = app.slice(app.indexOf('async function loadPublicPostCommentsFromShards'), app.indexOf('async function loadPublicPostComments('));
    expect(shardComments).toMatch(/try \{ payload = readPublicPostPayloadV2\(\{ header: tp\.header, body: tp\.body \}\); \} catch \{ continue; \}/);
    // The avatar readers dropped out of this guard with the Hub: the AVATAR shard reader parses its own parts
    // (readPublicPostPayloadV2 straight off the shard message), it does not walk a shared public entry log.
    // resolvePublicEntryPayload (the shared-log body funnel with its size cap) stays for the paths that still
    // read Hub entries; the shard readers decode the body they were handed by the shard itself.
    expect(app).toMatch(/PUBLIC_POST_BODY_MAX_BYTES/);
    // Incremental append-merge (not a wholesale rebuild from a single walk): the cache is preserved and this
    // cycle's chain posts are upserted in, so a degraded/rate-limited cycle never wipes a channel to the
    // "Waiting for public feed" placeholder (the flicker). Plus the global-head fast-path + commit-gate so a
    // cycle with no new public entry skips the whole walk, and the head only advances after a clean walk.
    // F1 round gate: the per-cycle author-index reads are round-robined at a budget, and the global head advances
    // only to the ROUND-START head and only once every readable channel was covered this round (strand-safe) --
    // NOT unconditionally to latestId. A skipped-this-cycle channel therefore never lets the fast-path skip past it.
    // v753: the commit is additionally EPOCH-guarded (see PWA-CHANNEL-VIEW-01) — an invalidation that landed
    // mid-walk (follow / channel-view preview) blocks the cursor write so the invalidation's walk really runs.
    // (chainBackedPublicFeedOnly filtered a STATIC feed down to chain-anchored posts. With that fallback deleted,
    // every post in the feed comes from a shard read — there is no unverified source left to filter.)
  });

  // PWA-PUBLIC-INCREMENTAL-02 removed with the CapsuleHub feed walk: the per-author cursor, the round-start head and
  // the in-window-gap cursor withholding are all properties of paging one shared log. The shard feed re-reads each
  // channel's newest window every cycle (no cursor to withhold), and the cache-coherency half of this guard — a
  // sync pass must not write back a snapshot invalidated mid-pass — is pinned in PWA-PUBLIC-FASTPATH-01.

  it('PWA-MULTIPART-SEND-01: terminal deadlines + compose caps scale with the capsule count (owner audit 2026-07-03)', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // The no-progress terminal SCALES by part count: base 60s + 150s per external (1 part -> 3.5min, 2 -> the
    // old 6min calibration, 8 -> 21min). The flat constant remains ONLY as the pre-publishState fallback.
    expect(app).toMatch(/const PUBLISH_CONFIRM_NO_PROGRESS_BASE_MS = 60 \* 1000;/);
    expect(app).toMatch(/const PUBLISH_CONFIRM_NO_PROGRESS_PER_PART_MS = 150 \* 1000;/);
    expect(app).toMatch(/function publishConfirmNoProgressDeadlineMs\(publishState\)/);
    // All three live drivers (private pass, private resume sweep, public shim) use the scaled deadline.
    // Two of the three drivers that shared this deadline (the private confirm retry and the public confirm
    // pass) went with the publishState they healed; the channel-profile heal keeps it.
    // The partial-retry window stays ABOVE the scaled terminal (old relation: 15min = 6min + 9min slack).
    expect(app).toMatch(/publishConfirmNoProgressDeadlineMs\(message\?\.publishState\) \+ 9 \* 60 \* 1000/);
    // Batch K's position-scaled background nonce wait went with the Vault publish trunk: direct sends order by
    // wallet seqno (one external per chunk), so there is no publish-nonce queue whose depth needs a scaled wait.
    // ONE message is capped at 8 capsules (= MAX_BATCH_PARTS) on BOTH surfaces — compose-time friendly block +
    // fail-closed asserts on every programmatic path.
    expect(app).toMatch(/const COMPOSER_MAX_MESSAGE_PARTS = MAX_BATCH_PARTS;/);
    expect(app).toMatch(/Math\.min\(privateComposerRetrievalPartLimit\(\), COMPOSER_MAX_MESSAGE_PARTS\)/);
    expect(app).toMatch(/function publicComposerPartLimitMessage\(partCount\)/);
    expect(app).toMatch(/function assertPublicComposerPartLimit\(partCount\)/);
    expect(app).toMatch(/assertPublicComposerPartLimit\(totalParts\);/);
    // The public composer blocks BEFORE clearing/signing, shows the split-it message, and disables the button.
    expect(app).toMatch(/if \(publicComposerPartLimitMessage\(publicComposerSendPlan\(text, attachments, fileAttachments\)\.length\)\) \{/);
    expect(app).toMatch(/const publicLimitMessage = publicComposerPartLimitMessage\(publicPlan\.length\);/);
    expect(app).toMatch(/if \(publicComposerPartLimitMessage\(plan\.length\)\) return true;/);
    // The private button tooltip states the REAL reason (the limit message), not a GRAM-shortfall misattribution.
    const reason = app.slice(app.indexOf('function privateSendBlockReason'), app.indexOf('function privateSendBlockReason') + 2400);
    const limitIdx = reason.indexOf('privateComposerPartLimitMessage(plan.length)');
    const shortfallIdx = reason.indexOf('privateComposerKnownVaultTonShortfall()');
    expect(limitIdx).toBeGreaterThan(-1);
    expect(shortfallIdx).toBeGreaterThan(limitIdx);
    // (The receipt foreign-slot guard — "a nonce-keyed receipt whose partCount differs from OUR batch must never
    // confirm/fail our parts" — went with the receipt ring. It existed because one Vault slot was keyed by a nonce
    // that a racing orphaned external could also occupy. A direct-pay message is bound to the WALLET SEQNO, which no
    // other external can share, so there is no slot to misattribute.)
  });

  // PWA-PRIVATE-STRADDLE-01 removed with the CapsuleHub index walk. A private multipart group could straddle that
  // walk's window because the walk paged a shared log by entry id. The conversation shard reader reads whole
  // messages out of the conversation's own history and groups them by streamId in appendConvOpenedCapsules, which
  // holds an incomplete group back until every part has arrived (`if (parts.length < partCount) continue`).

  // PWA-PUBLIC-STRADDLE-01 removed as a SOURCE-GREP guard — the invariant it protected is now covered twice, and
  // behaviourally: tests/public-lane-read-window.test.ts PL-WINDOW-02 publishes a 3-part post across the read
  // window boundary against a REAL PublicShard and requires it back whole, and tests/straddle-walk-tracking.test.ts
  // exercises the predicate (hasIncompletePublicStream) that drives the extension. Both go red if the extension is
  // inverted; a grep for the old walk's literals would not.

  it('PWA-FILE-01: file attachments — FILE block wire, compose capture, download chip, TG fallback, no public leak', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const html = readFileSync('web/index.html', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    // Wire: FILE=6 delegates to the unit-tested module codec; decode is null-tolerant (never poisons a message).
    expect(app).toMatch(/FILE: 6,/);
    expect(app).toMatch(/content = encodeFileBlockContent\(block\);/);
    expect(app).toMatch(/const file = decodeFileBlockContent\(content\);\s*if \(file\) blocks\.push\(\{ type: 'file', \.\.\.file \}\);/);
    // Display block stores a data: URL STRING (blocks persist through JSON history/caches), never a Uint8Array.
    expect(app).toMatch(/url: block\.url \?\? `data:\$\{block\.mime \?\? 'application\/octet-stream'\};base64,\$\{bytesToBase64\(bytes\)\}`/);
    // Compose: '+' menu item + hidden input + pick-time size gate + capture-at-submit (the v646 rule).
    expect(html).toMatch(/id="privateFileButton"/);
    expect(html).toMatch(/id="privateFileInput"/);
    expect(app).toMatch(/const PRIVATE_FILE_ATTACHMENT_MAX_BYTES = 245 \* 1024;/);
    expect(app).toMatch(/const fileAttachments = normalizePrivateFileAttachments\(privateFileAttachments\);/);
    // clean-17: a retry replays the CAPTURED file attachments. The retry-context builder captures them from the
    // message draft, and BOTH live direct-pay send paths (CONV + INTRO first-contact) prefer the captured value over
    // the live composer draft. (The former Vault composer/retry copies of this were removed with the cutover.)
    expect(app).toMatch(/fileAttachments: normalizePrivateFileAttachments\(draft\.fileAttachments \?\? \[\]\)/);
    expect(app.match(/context\.fileAttachments === undefined \? privateFileAttachments : context\.fileAttachments/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    // Render: download chip on BOTH surfaces; Telegram in-app view gets an explanation instead of a silent fail.
    expect(app).toMatch(/function buildFileBlockChip\(block\)/);
    expect(app.match(/buildFileBlockChip\(block\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(app).toMatch(/async function downloadFileBlock\(block\)/);
    const download = app.slice(app.indexOf('async function downloadFileBlock'), app.indexOf('function buildFileBlockChip'));
    expect(download).toMatch(/isTelegramEnv\(\)/);
    expect(download).toMatch(/URL\.revokeObjectURL/);
    // Previews: thread list + reply snippet know about files; copy ignores them (text-only filter).
    expect(app).toMatch(/if \(fileBlocks\.length === 1\) return String\(fileBlocks\[0\]\.name \?\? 'File'\);/);
    expect(app).toMatch(/if \(blocks\.some\(\(block\) => block\?\.type === 'file'\)\) return 'File';/);
    expect(css).toMatch(/\.message-file-chip \{/);
  });

  it('PWA-PROFILE-01: channel profile — PROFILE block wire, public top-level post, tolerant decode', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // Wire: PROFILE=7 in the shared PDC1 registry; codec branches delegate to the unit-tested module functions.
    expect(app).toMatch(/PROFILE: 7,/);
    expect(app).toMatch(/content = encodeProfileBlockContent\(block\);/);
    expect(app).toMatch(/const profile = decodeProfileBlockContent\(content\);\s*if \(profile\) blocks\.push\(\{ type: 'profile', \.\.\.profile \}\);/);
    // Imported from the policy module (bumped ?v in lockstep with the codec change).
    expect(app).toMatch(/encodeProfileBlockContent,\s*decodeProfileBlockContent,\s*normalizeProfileTags,\s*PROFILE_DESCRIPTION_MAX_BYTES,\s*PROFILE_TAG_MAX_BYTES,\s*PROFILE_MAX_TAGS,\s*utf8ByteLength,\s*encodeShareBlockContent,\s*decodeShareBlockContent,\s*SHARE_SNIPPET_MAX_BYTES,\s*\} from '\.\/capsule-part-policy\.mjs\?v=\d+';/);
  });

  it('PWA-PROFILE-USERNAME-01: channel .ath username is claimed in the profile, verified on-chain, and only the verified name is shown', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // PUBLISH: the channel embeds the wallet's OWN linked .ath (safe canonicalUsernameDisplay, never throwing normalizeUsernameInput).
    expect(app).toMatch(/const linkedLabel = readLinkedPlathoUsername\(plathoWallet\?\.address\)\?\.label \?\? '';\s*const ownerUsername = linkedLabel \? canonicalUsernameDisplay\(linkedLabel\) : '';/);
    expect(app).toMatch(/encodeMessageDocumentBlocks\(\[\{ type: 'profile', description: desc, tags: normalizedTags, ownerUsername \}\]\)/);
    // READ: readProfileDocument carries the claim through (the sole funnel for every chain read path).
    expect(app).toMatch(/ownerUsername: typeof profile\.ownerUsername === 'string' \? profile\.ownerUsername : '',/);
    // ANTI-IMPERSONATION: publicAuthorLabel shows ONLY the registry-verified name, NEVER the raw ownerUsername claim.
    const label = app.slice(app.indexOf('function publicAuthorLabel('), app.indexOf('function publicAuthorLabel(') + 700);
    expect(label).toMatch(/publicChannelProfileCache\[channelProfileCacheKey\(wallet\)\]\?\.verifiedUsername/);
    expect(label).not.toMatch(/\.ownerUsername/); // the raw claim is never read by the label
    // VERIFY: tolerant parse (no throw on hostile claims) + only strip a name on a PROVEN definitive cached-null mismatch.
    const verify = app.slice(app.indexOf('function verifyChannelUsernameClaim('), app.indexOf('function verifyChannelUsernameClaim(') + 1700);
    expect(verify).toMatch(/try \{ identity = plathoUsernameIdentity\(claimedName\); \} catch \{ identity = null; \}/);
    expect(verify).not.toMatch(/normalizeUsernameInput\(/); // the throwing normalizer must not be on this untrusted path
    expect(verify).toMatch(/verifiedPlathoUsernameOwnerCache\.get\(`\$\{identity\.value\}:\$\{rawWallet\}`\)/);
    expect(verify).toMatch(/if \(cached && cached\.value === null\) applyVerifiedChannelUsername\(key, ''\)/);
  });

  it('PWA-DISCOVERY-IDENTITY-01: discovery card carries a "Display as" chevron + a copy-address button on the address row', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');

    // A wallet's VERIFIED channel .ath (never the raw claim) is offered as a "Display as" option for ANY wallet, so
    // the Discovery chevron surfaces e.g. "glasnost" for a channel with no Private dialog. Tolerant parse (no throw).
    const ctx = app.slice(app.indexOf('function contactDisplayContextForWallet('), app.indexOf('function baseContactDisplayContextForWallet('));
    expect(ctx).toMatch(/const verifiedUsername = publicChannelProfileCache\[channelProfileCacheKey\(counterpartyWallet\)\]\?\.verifiedUsername/);
    expect(ctx).toMatch(/try \{ channelIdentity = plathoUsernameIdentity\(verifiedUsername\); \} catch \{ channelIdentity = null; \}/);
    expect(ctx).toMatch(/if \(channelIdentity\) extraIdentities\.push\(channelIdentity\)/);

    // Copy affordance on the raw-address row of the SHARED "Display as" popover (used by Private header + public
    // post chevron + discovery chevron). Separate from selecting: click is stopped, popover stays open.
    expect(app).toMatch(/function createCopyIcon\(\)/);
    const pop = app.slice(app.indexOf('function renderDisplayAsPopover('), app.indexOf('function showIdentityPopover('));
    expect(pop).toMatch(/option\.identity\?\.type === RECIPIENT_IDENTITY_TYPES\.WALLET_ADDRESS && option\.identity\.value/);
    expect(pop).toMatch(/copyButton\.append\(createCopyIcon\(\)\)/);
    expect(pop).toMatch(/await copyTextToClipboard\(addressToCopy\)/);
    expect(pop).toMatch(/event\.stopPropagation\(\)/);
    expect(pop).toMatch(/setAttribute\('aria-label', t\('profile\.copyWalletAddress'\)\)/);

    // Discovery card: chevron opens the SAME public-channel display popover (skips own/wallet-less), and the card
    // label honors an explicit "Display as" choice (resolveWalletChannelDisplay) over the verified username.
    expect(app).toMatch(/function discoveryCardIdentityButton\(authorWallet\)/);
    expect(app).toMatch(/if \(!authorWallet \|\| isOwnPublicAuthor\(authorWallet\)\) return null;/);
    const card = app.slice(app.indexOf('function buildDiscoveryCard('), app.indexOf('function buildDiscoveryCard(') + 3200);
    expect(card).toMatch(/const label = resolveWalletChannelDisplay\(channel\.authorWallet\)\?\.name/);
    expect(card).toMatch(/const identityButton = discoveryCardIdentityButton\(channel\.authorWallet\);\s*if \(identityButton\) head\.append\(identityButton\)/);
    // A choice made from the chevron relabels the (unsubscribed) discovery card too.
    expect(app).toMatch(/renderPublicSurface\(\{ anchorUnread: false \}\);\s*\/\/ A choice made from a Discovery card[\s\S]*?scheduleDiscoveryLabelRefresh\(\);/);

    // Styling: chevron = 30px icon-button pinned right; copied = transient accent tint. No NEW i18n keys (reused).
    expect(css).toMatch(/\.icon-button\.discovery-card-identity \{[\s\S]*?margin-left: auto;/);
    expect(css).toMatch(/\.identity-variant-edit\.identity-variant-copied \{[\s\S]*?color: var\(--accent\);/);
    expect(EN_STRINGS['profile.copyWalletAddress']).toBe('Copy wallet address');
    expect(EN_STRINGS['wallet.addressCopied']).toBe('Wallet address copied');
  });

  it('PWA-CHANNEL-PROFILE-COST-01: the channel-description dialog shows the GRAM publish cost like the mint/avatar modals', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    // The channel-about popover "Add/Edit description" button uses the shared plate-CTA (owner: same style as "Add
    // channel"); .channel-about-edit is now only the popover top-spacing modifier, not its own ghost-button look.
    expect(app).toMatch(/editButton\.className = 'discovery-cta-action channel-about-edit'/);
    expect(css).toMatch(/\.channel-about-edit \{[^}]*margin-top: 8px;[^}]*\}/);
    expect(css).not.toMatch(/\.channel-about-edit \{[^}]*background: transparent/);
    // Estimator mirrors estimatedProfileAvatarTonFeeNanotons but for the PROFILE document (a channel profile is a
    // plain public post): encode the SAME bytes publishChannelProfile does → split → price it.
    const est = app.slice(app.indexOf('function estimatedChannelProfileChargeNanotons('), app.indexOf('function estimatedChannelProfileChargeNanotons(') + 800);
    expect(est).toMatch(/encodeMessageDocumentBlocks\(\[\{ type: 'profile', description: desc, tags: normalizedTags, ownerUsername \}\]\)/);
    expect(est).toMatch(/splitBytesToCapsuleParts\(documentBytes, MAX_CAPSULE_USEFUL_BYTES\)/);
    expect(est).toMatch(/composerEstimatedMaxChargeNanotons\(publicComposerPublishProfilesForPlan\(parts\), 1\)/);

    // AND THAT ESTIMATOR MUST QUOTE THE DIRECT-PAY FIGURE. Reported by the owner 2026-08-04: this dialog said
    // "up to 0.1698 GRAM from Vault". Both halves were wrong. The Vault is deleted, and 0.1698 is what the Vault's
    // batch-hold model computes (127.8M shared base + per-part) — the publish actually attaches 20.3M + surcharge.
    // Eight times the truth, on a money figure, in the dialog whose whole job is to say what saving will cost.
    const maxCharge = app.slice(app.indexOf('function composerEstimatedMaxChargeNanotons('), app.indexOf('function composerEstimatedMaxChargeNanotons(') + 1400);
    expect(maxCharge, 'under direct pay the max charge IS the attached value — there is no hold to reserve')
      .toMatch(/if \(privateLaneDirectPayEnabled\(\)\) return composerEstimatedNetCostNanotons\(profile, parts\);/);

    // The edit dialog surfaces it as a live summary line, sharing the mint modal's GRAM-cost wording.
    const dlg = app.slice(app.indexOf('async function openEditChannelProfileDialog('), app.indexOf('async function openEditChannelProfileDialog(') + 1600);
    expect(dlg).toMatch(/summary: \(values\) =>/);
    expect(dlg).toMatch(/estimatedChannelProfileChargeNanotons\(values\.description, values\.tags\)/);
    // The label is just "Cost": the VALUE already names the unit ("до 0.0203 GRAM с кошелька"), so "GRAM cost:
    // up to 0.0203 GRAM" said GRAM twice in one line. [owner, 2026-08-04]
    expect(dlg).toMatch(/label: t\('common\.cost'\), value: t\('common\.gramCostValue', \{ amount: formatTonNanotons\(charge\) \}\)/);
    expect(EN_STRINGS['common.cost']).toBe('Cost');
    expect(EN_STRINGS['common.gramCostValue']).toBe('up to {amount} GRAM from your wallet');
    // The Vault vocabulary is GONE from this pair, key and value, in every locale — a key called `gramHold` is how
    // the wrong number kept its cover for a release.
    expect(app, 'no caller left on the retired key').not.toMatch(/username\.gramHold/);
    for (const locale of Object.keys(I18N_STRINGS)) {
      const dict = (I18N_STRINGS as Record<string, Record<string, string>>)[locale];
      expect(dict['username.gramHold'], `${locale}: retired key must be gone`).toBeUndefined();
      expect(dict['common.gramCostValue'], `${locale}: replacement must exist`).toBeTruthy();
      expect(dict['common.gramCostValue']).not.toMatch(/Vault|Coffre|Хранилищ/i);
    }
    // v792 (owner): the on-chain profile byte caps were raised (16 cyrillic chars/tag was too tight — long russian tags
    // cut mid-word; 256-char descriptions too short), and the edit dialog shows a LIVE utf-8 byte budget so nothing
    // truncates silently on save. Decode is unchanged (length fields carry any size) — backward-compatible.
    const capsuleMjs = readFileSync('web/capsule-part-policy.mjs', 'utf8');
    expect(capsuleMjs).toMatch(/export const PROFILE_DESCRIPTION_MAX_BYTES = 1536;/);
    expect(capsuleMjs).toMatch(/export const PROFILE_TAG_MAX_BYTES = 64;/);
    // The description + tags fields each carry a counter(value) -> { text, over } computing the UTF-8 byte budget.
    expect(app).toMatch(/const used = utf8ByteLength\(value\);\s*return \{ text: t\('public\.profileDescriptionBudget', \{ used, max: PROFILE_DESCRIPTION_MAX_BYTES \}\), over: used > PROFILE_DESCRIPTION_MAX_BYTES \};/);
    expect(app).toMatch(/const over = raw\.length > PROFILE_MAX_TAGS \|\| raw\.some\(\(tag\) => utf8ByteLength\(tag\) > PROFILE_TAG_MAX_BYTES\);/);
    // The generic dialog field renderer appends a live counter span updated on every input.
    expect(app).toMatch(/if \(typeof field\.counter === 'function'\) \{[\s\S]*?input\.addEventListener\('input', updateCounter\);[\s\S]*?wrapper\.append\(counter\);/);
    // Counter i18n keys exist in EVERY locale (parity enforced elsewhere; presence pinned here) + the CSS is styled.
    for (const locale of Object.keys(I18N_STRINGS)) {
      expect(I18N_STRINGS[locale]['public.profileDescriptionBudget'], `${locale}:descBudget`).toBeTruthy();
      expect(I18N_STRINGS[locale]['public.profileTagsBudget'], `${locale}:tagsBudget`).toBeTruthy();
    }
    expect(css).toMatch(/\.action-dialog-field-counter \{[\s\S]*?text-align: right;/);
    expect(css).toMatch(/\.action-dialog-field-counter\.is-over \{[\s\S]*?color: #ff7a7a;/);
  });

  it('PWA-POPOVER-SCROLL-01: the anchored identity/channel-about popover closes on scroll (not only outside-click)', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // The popover is pinned to a button's screen position, so a scroll drifts it off its anchor -> dismiss it.
    // Scroll doesn't bubble, so capture:true catches a scroll on ANY nested container (the feed, the conversation,
    // the page); a scroll INSIDE the popover (a long description) does NOT close it.
    const scrollClose = app.slice(app.indexOf("window.addEventListener('scroll', (event) => {"), app.indexOf("window.addEventListener('scroll', (event) => {") + 360);
    expect(scrollClose).toMatch(/if \(!identityPopover \|\| identityPopover\.hidden\) return;/);
    expect(scrollClose).toMatch(/if \(identityPopover\.contains\(event\.target\)\) return;/);
    expect(scrollClose).toMatch(/hideIdentityPopover\(\);/);
    expect(scrollClose).toMatch(/\}, \{ capture: true, passive: true \}\);/);
  });

  it('PWA-DOCS-I18N-01: the docs viewer loads the current-locale doc, falling back to the English base', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // English uses the base path; other locales use the <name>.<locale>.md sibling.
    expect(app).toMatch(/function localizedDocPath\(basePath, locale\) \{\s*if \(!locale \|\| locale === 'en'\) return basePath;\s*return basePath\.replace\(\/\\\.md\$\/, `\.\$\{locale\}\.md`\);/);
    // Fetch the localized file first; on a missing/unfetchable localized file, fall back to the English base.
    const fetcher = app.slice(app.indexOf('async function fetchLocalizedDocMarkdown('), app.indexOf('async function fetchLocalizedDocMarkdown(') + 700);
    expect(fetcher).toMatch(/const localizedPath = localizedDocPath\(basePath, locale\)/);
    expect(fetcher).toMatch(/if \(localized\.ok\) return await localized\.text\(\)/);
    expect(fetcher).toMatch(/const response = await fetch\(basePath, \{ cache: 'no-store' \}\)/);
    // selectDoc caches per (doc, locale) and reads currentLocale so a language switch serves the right translation.
    expect(app).toMatch(/const locale = currentLocale\(\);\s*const cacheKey = `\$\{doc\.id\}:\$\{locale\}`;/);
    expect(app).toMatch(/markdown = await fetchLocalizedDocMarkdown\(doc\.path, locale\)/);
  });

  it('PWA-DISCOVERY-01: newcomer discovery — bounded head-of-log scan, described-channel cards, follow flow', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const html = readFileSync('web/index.html', 'utf8');
    // Scale: discovery is bounded by CONSTRUCTION now, not by scan constants over a shared log — it sweeps the
    // BEACON directory (a fixed bucket space), ranks live buckets by entry_count and reads the top K.
    expect(app).toMatch(/async function discoverChannels\(/);
    expect(app).toMatch(/async function discoverChannelsFromBeacon\(/);
    expect(readFileSync('web/public-lane.mjs', 'utf8')).toMatch(/sweepChannelCatalog\(\{ eraWindow = 3, topBuckets = 16 \} = \{\}\)/);
    // (The phase-1 head-of-log loop was the Hub scan itself; the beacon sweep's bounds are asserted above.)
    // Phase 2 resolves each candidate with the shallow discovery maxScan (cache-first, bounded).
    // Follow registers the previously-unknown channel THEN subscribes it (ensure rebuilds the registry first).
    expect(app).toMatch(/const channelId = ensurePublicChannelForAuthorWallet\(authorWallet, \{ activate: false \}\);\s*setPublicChannelSubscribed\(channelId, true\);/);
    // UI: header entry button + discovery panel + the feed-top channels plate.
    // Header compass discover button removed (owner: redundant with the feed-top CTA plate "Find channels").
    expect(html).not.toMatch(/id="publicDiscoverButton"/);
    expect(html).toMatch(/id="publicDiscovery"/);
    // v701 header consistency: the discovery header carries the STANDARD chrome (install + docs + sync
    // indicator) like every other screen, and both public overlays bleed SIDES ONLY — the old -24px top
    // margin (from a 24px-padded pane era) pushed the header 13px past the pane's 11px top offset and
    // clipped the title.
    const css = readFileSync('web/styles.css', 'utf8');
    const discoveryHeader = html.slice(html.indexOf('id="publicDiscovery"'), html.indexOf('id="publicDiscoveryBody"'));
    expect(discoveryHeader).toMatch(/docs-header-button/);
    expect(discoveryHeader).toMatch(/global-sync-indicator/);
    expect(discoveryHeader).toMatch(/install-header-button/);
    expect(css).not.toMatch(/margin: -24px -24px 0;/);
    expect(css).toMatch(/\.public-pane\[data-post-open="true"\] > \.public-post-detail \{[\s\S]*?margin: 0 -24px;/);
    expect(css).toMatch(/\.public-pane\[data-discover-open="true"\] > \.public-discovery \{[\s\S]*?margin: 0 -24px;/);
    expect(app).toMatch(/function buildDiscoveryCtaCard\(\)/);
    expect(app).toMatch(/function shouldShowDiscoveryCta\(\)/);
    // The plate is the ONLY entry point for add-channel-by-address since the search-row "+" was removed:
    // it shows for everyone (hidden only while a channel search filters the feed) and carries BOTH actions.
    expect(app).toMatch(/function shouldShowDiscoveryCta\(\) \{\s*return !publicChannelSearchQuery;\s*\}/);
    expect(app).toMatch(/async function openAddPublicChannelDialog\(\)/);
    const ctaCard = app.slice(app.indexOf('function buildDiscoveryCtaCard()'), app.indexOf('async function loadPublicPostComments'));
    expect(ctaCard).toMatch(/t\('public\.discoverCtaAction'\)/);
    expect(ctaCard).toMatch(/t\('public\.discoverCtaAddAction'\)/);
    expect(ctaCard).toMatch(/openAddPublicChannelDialog\(\)/);
    expect(EN_STRINGS['public.discoverCtaAddAction']).toBe('Add channel');
  });

  it('PWA-CONTACT-CTA-01: private add-a-contact plate replaces the search-row "+" and opens the new-chat dialog', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    // One persistent plate node, pinned FIRST in the thread list; row reconciliation skips it.
    expect(app).toMatch(/function ensureContactCtaCard\(\)/);
    expect(app).toMatch(/add\.addEventListener\('click', openNewChatDialog\);/);
    expect(app).toMatch(/else if \(node !== privateContactCtaCard\) node\.remove\(\);/);
    expect(app).toMatch(/contactCta\.hidden = q\.length > 0;/);
    expect(app).toMatch(/threadList\.insertBefore\(contactCta, threadList\.firstElementChild\)/);
    // The pre-F3 migration probe must look at the first ROW (the plate legitimately has no _refs) —
    // a firstElementChild probe would wipe and rebuild every row on every render.
    expect(app).toMatch(/threadList\.querySelector\(':scope > \[data-thread\]'\)/);
    expect(app).not.toMatch(/threadList\.firstElementChild && !threadList\.firstElementChild\._refs/);
    // hidden must actually hide the flex card (the UA [hidden] rule loses to display:flex).
    expect(css).toMatch(/\.discovery-cta\[hidden\]\s*\{\s*display:\s*none;/);
    expect(EN_STRINGS['chat.contactCtaTitle']).toBe('Add a contact');
    expect(EN_STRINGS['chat.contactCtaAction']).toBe('Add contact');
  });

  it('PWA-SAVED-01: Saved messages — self dialog exists, renders one-sided, never self-badges, name is render-only', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // The self thread is keyed by the STANDARD own-wallet dm identity (chain scans route with zero changes) and
    // is ensured at boot.
    expect(app).toMatch(/function ensureSavedMessagesThread\(\)/);
    expect(app).toMatch(/if \(ensureSavedMessagesThread\(\)\) renderThreads\(\);/);
    expect(app).toMatch(/function isSelfOpenedCapsule\(opened\)/);
    expect(app).toMatch(/function isSavedMessagesThread\(thread\)/);
    // Self messages render own-sided on BOTH open paths (device echo and cross-device restore agree)...
    expect(app).toMatch(/opened\?\.openedAs === 'sender' \|\| isSelfOpenedCapsule\(opened\)/);
    expect(app).toMatch(/first\?\.openedAs === 'sender' \|\| isSelfOpenedCapsule\(first\)/);
    // ...with 'saved' meta wording and no self-unread.
    // (The 'saved' META WORDING came from the Hub receive router's meta chooser and has no direct-lane producer
    // yet — a self-note restored from chain currently reads 'received'. Cosmetic only: DIRECTION is decided by
    // isSelfOpenedCapsule above, and the Saved-relocation heal keys off type+publish meta, neither of which this
    // wording feeds. Tracked on the roadmap with the rest of the self-note lane.)
    expect(app).toMatch(/if \(!thread \|\| isSavedMessagesThread\(thread\) \|\| isThreadConversationVisible\(thread\)\) return;/);
    // 'Saved' is a RENDER-ONLY display name (threadDisplayLabel feeds the contact store + the own public
    // channel name — storing it would rename the channel everywhere).
    expect(app.match(/isSavedMessagesThread\(thread\) \? t\('chat\.myNotes'\) : threadDisplayLabel\(thread\)/g)?.length ?? 0).toBe(2);
    expect(EN_STRINGS['chat.myNotes']).toBe('My notes');
    expect(app).not.toMatch(/localLabel: '(Saved|My notes)'/);
    // Anonymity to yourself is meaningless AND breaks the self detection (payload.senderWallet stripped -> the
    // note renders as incoming): self sends always carry the sender wallet, and the toggle explains why.
    expect(app).toMatch(/const includeSenderWalletMetadata = savedThread \|\| currentPrivateSenderMode\(\) !== PRIVATE_SENDER_MODES\.ANONYMOUS;/);
    expect(app).toMatch(/if \(isSavedMessagesThread\(activeThread\(\)\)\) return t\('chat\.blockSavedAnonymous'\);/);
    expect(EN_STRINGS['chat.blockSavedAnonymous']).toBe('Notes to yourself are never anonymous');
  });

  it('PWA-SAVED-02: My notes pinned first + pencil avatar; thread-time shows the real last-message time', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    const render = app.slice(app.indexOf('function renderThreads()'), app.indexOf('function renderConversation()'));
    // Pinned by a render-time partition — `threads` array order stays owned by sync/restore code. v731: the
    // non-Saved dialogs sort by RECENCY (newest activity first) — active chats on top, dormant ones drift down;
    // a just-created empty dialog floats up via its createdAtMs stamp (threadLastActivityMs fallback).
    expect(render).toMatch(/\.\.\.visibleThreads\.filter\(\(thread\) => isSavedMessagesThread\(thread\)\),\s*\.\.\.visibleThreads\s*\.filter\(\(thread\) => !isSavedMessagesThread\(thread\)\)\s*\.sort\(\(a, b\) => threadLastActivityMs\(b\) - threadLastActivityMs\(a\)\),/);
    expect(app).toMatch(/function threadLastActivityMs\(thread\) \{/);
    // Newest message wins (messages are ascending; scan from the end for a resolvable time); an empty dialog falls
    // back to its creation stamp, unknown -> 0 (sinks).
    expect(app).toMatch(/for \(let index = messages\.length - 1; index >= 0; index -= 1\) \{\s*\n\s*const ms = messageCreatedAtMs\(messages\[index\]\);\s*\n\s*if \(ms !== null\) return ms;/);
    expect(app).toMatch(/return Number\.isFinite\(thread\?\.createdAtMs\) \? thread\.createdAtMs : 0;/);
    expect(app).toMatch(/result\.thread\.createdAtMs = Date\.now\(\);/);
    // Both thread-avatar sites route through the saved-aware setter; the icon branch undoes image state and the
    // shared setter undoes the icon class (nodes are REUSED across threads).
    expect(app).toMatch(/function setThreadAvatarNode\(node, thread\)/);
    expect(render).toMatch(/setThreadAvatarNode\(avatar, thread\);/);
    expect(app).toMatch(/setThreadAvatarNode\(activeAvatar, thread\);/);
    expect(app).toMatch(/node\.classList\.remove\('avatar-saved'\);\s*if \(imageUrl\) \{/);
    expect(app).toMatch(/node\.innerHTML = SAVED_MESSAGES_AVATAR_SVG;/);
    expect(css).toMatch(/\.avatar\.avatar-saved svg \{/);
    // Side label = last message's real timestamp (today -> time, week -> weekday, else date); computed at render,
    // never the constant 'now'/'new' words.
    expect(app).toMatch(/function formatThreadListTimestamp\(ms\)/);
    expect(render).toMatch(/time\.textContent = lastMs !== null \? formatThreadListTimestamp\(lastMs\) : '';/);
    expect(render).not.toMatch(/time\.textContent = thread\.time;/);
  });

  it('PWA-COPY-01: long-press copies message/comment text with a flash (touch); desktop gets a hover Copy button; avatars open the lightbox', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    // Long-press engine: touch-only, hold window, cancel-on-move, release click swallowed, Android contextmenu
    // suppressed for rows (our copy IS the long-press action).
    expect(app).toMatch(/const LONG_PRESS_COPY_MS = 500;/);
    expect(app).toMatch(/function attachLongPressCopy\(container, rowSelector, getText\)/);
    const press = app.slice(app.indexOf('function attachLongPressCopy'), app.indexOf('attachLongPressCopy(messageStrip'));
    expect(press).toMatch(/if \(event\.pointerType !== 'touch'\) return;/);
    expect(press).toMatch(/>= 10 \|\| Math\.abs\(event\.clientY - press\.startY\) >= 10\) cancelPress\(\);/);
    expect(press).toMatch(/container\.addEventListener\('contextmenu'/);
    // Wired on BOTH surfaces with object-resolving text getters (full text, not the reply-snippet cap).
    expect(app).toMatch(/attachLongPressCopy\(messageStrip, '\.message', privateRowCopyText\);/);
    expect(app).toMatch(/attachLongPressCopy\(publicPane, '\.comment-item', publicCommentRowCopyText\);/);
    expect(app).toMatch(/function copyTextFromContent\(item\)/);
    // Clipboard write + flash only on success; the flash is a CSS class (prod CSP).
    expect(app).toMatch(/await navigator\.clipboard\.writeText\(value\);\s*flashCopyFeedback\(row\);/);
    expect(css).toMatch(/@keyframes copy-flash \{/);
    expect(css).toMatch(/\.copy-flash \{\s*animation: copy-flash/);
    // Desktop hover Copy button rendered ONLY for rows with copyable text, on both surfaces.
    expect(app).toMatch(/function appendRowCopyButton\(row, copyText\)/);
    expect(app).toMatch(/appendRowCopyButton\(row, copyTextFromContent\(message\)\);/);
    expect(app).toMatch(/appendRowCopyButton\(row, copyTextFromContent\(comment\)\);/);
    // No per-button offset to pin any more: one flex cluster places whatever actions a row has. The old ordinal
    // geometry (reply -26px, copy -52px) assumed every earlier button exists, and in "My notes" — which has no
    // Reply — it left Copy a dead 26px from the bubble, unreachable because the pointer lost :hover on the way.
    expect(css).toMatch(/\.row-actions \{[\s\S]*?position: absolute;/);
    expect(css).toMatch(/\.message\.out \.row-actions \{[\s\S]*?flex-direction: row-reverse;/);
    // Touch devices: native selection callout suppressed on rows (long-press is the copy action there).
    expect(css).toMatch(/@media \(hover: none\) \{[\s\S]*?-webkit-touch-callout: none;/);
    // Armed swipe ring stays visible on OUTGOING bubbles (their border-color override loses to this rule).
    expect(css).toMatch(/\.message\.out\.swipe-armed \.bubble \{\s*border-color: var\(--accent\);/);
    // Avatar tap-to-view: dataset url + delegated click that skips avatars inside interactive elements.
    expect(app).toMatch(/node\.dataset\.avatarUrl = imageUrl;/);
    expect(app).toMatch(/\.closest\?\.\('\.avatar\[data-avatar-url\]'\)/);
    expect(app).toMatch(/if \(avatar\.closest\('button, a, \[role="button"\]'\)\) return;/);
    expect(app).toMatch(/openImageLightbox\(avatar\.dataset\.avatarUrl, 'Avatar'\);/);
    expect(css).toMatch(/\.avatar\.has-image \{\s*cursor: zoom-in;/);
    // The zoom cursor must MIRROR the JS guard: an avatar inside an interactive row (the private chat list) yields
    // to the row's own click (opening the chat wins), so the zoom cursor there would lie — fall back to inherit.
    expect(css).toMatch(/button \.avatar\.has-image,\s*a \.avatar\.has-image,\s*\[role="button"\] \.avatar\.has-image \{\s*cursor: inherit;/);
  });

  it('PWA-PUBLIC-COMMENTS-BACKGROUND-FREE: comments load ONLY on thread open — no background walker exists (owner scalability requirement 2026-07-02)', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // The background feed sync must never touch the parent (comment) index or the on-demand loader. (The name
    // appears in an explanatory comment inside the sync — forbid the CALL form, not the mention.)
    // The THREAD read has exactly ONE entry point (the on-demand loader) — the shard twin of the old
    // parent-index rule, and the actual scalability requirement: no background walker may read comments.
    expect(app.match(/lane\.readThreadComments\(/g)?.length ?? 0).toBe(1);
    // ...and the loader is invoked ONLY from functions a user action starts. Named rather than counted: the count
    // grew to two when "show earlier comments" landed (2026-08-07), and a bare number would have had to be nudged
    // up without anyone asking the question the rule is actually about — WHO reads comments.
    const callers = [...app.matchAll(/await loadPublicPostComments\(/g)].map((match) => {
      const before = app.slice(0, match.index);
      const start = Math.max(before.lastIndexOf('\nfunction '), before.lastIndexOf('\nasync function '));
      return /function\s+([A-Za-z0-9_$]+)/.exec(app.slice(start, match.index))?.[1] ?? '<anonymous>';
    });
    expect(callers.sort()).toEqual(['loadEarlierPublicPostComments', 'refreshPublicPostDetailComments']);
    // refreshPublicPostDetailComments fires only on user actions: opening the post detail + the retry button.
    expect(app.match(/refreshPublicPostDetailComments\(\);/g)?.length ?? 0).toBe(2);
    // ...and the earlier-page read fires only from its button, never a timer or a sync pass.
    expect(app.match(/loadEarlierPublicPostComments\(\);/g)?.length ?? 0).toBe(1);
    expect(app).toContain("earlier.addEventListener('click', () => { loadEarlierPublicPostComments(); });");
    // The pre-warm on the "Comments" button render is LOCAL-ONLY (IndexedDB) — zero chain reads.
    const warm = app.slice(app.indexOf('async function warmPublicPostCommentsCache'), app.indexOf('function openPublicPostDetail'));
    expect(warm.length).toBeGreaterThan(0);
    expect(warm).not.toMatch(/provider\.|getPublic|resolvePublic|runGetMethod/);
  });

  it('PWA-PUBLIC-IMAGE-LIGHTBOX: public post/comment images are clickable like private ones and the lightbox zooms (pinch/double-tap/wheel)', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    // Every public image (feed post, detail card, comment) is wired for the SAME lightbox as private images:
    // focusable, role button, dataset.fullImageSrc — via one helper used by BOTH appendPublicItemContent branches.
    expect(app).toMatch(/function wirePublicImageLightbox\(image, src\)/);
    expect(app.match(/wirePublicImageLightbox\(image, (block\.url|item\.imageUrl)\);/g)?.length ?? 0).toBe(2);
    const wire = app.slice(app.indexOf('function wirePublicImageLightbox'), app.indexOf('function appendPublicItemContent'));
    expect(wire).toMatch(/image\.tabIndex = 0;/);
    expect(wire).toMatch(/image\.dataset\.fullImageSrc = src;/);
    // Delegated open on the public pane mirrors the private messageStrip wiring (click + keyboard).
    expect(app).toMatch(/publicPane\?\.addEventListener\('click'/);
    expect(app).toMatch(/publicPane\?\.addEventListener\('keydown'/);
    expect(app).toMatch(/target\?\.closest\?\.\('\.feed-image'\)/);
    // The zoom engine: pinch (two-pointer), drag-pan when zoomed, double-tap toggle, wheel — pointer events on
    // the viewport, transform via CSSOM (style.transform assignment; setAttribute('style') is what prod CSP blocks).
    expect(app).toMatch(/const imageLightboxViewport = document\.querySelector\('\.image-lightbox-viewport'\)/);
    expect(app).toMatch(/function zoomImageLightboxAt\(clientX, clientY, nextScale/);
    expect(app).toMatch(/function clampImageLightboxPan\(\)/);
    expect(app).toMatch(/imageLightboxImage\.style\.transform = /);
    expect(app).not.toMatch(/imageLightboxImage\.setAttribute\('style'/);
    expect(app).toMatch(/imageLightboxViewport\?\.addEventListener\('pointerdown'/);
    expect(app).toMatch(/imageLightboxViewport\?\.addEventListener\('pointermove'/);
    expect(app).toMatch(/imageLightboxViewport\?\.addEventListener\('wheel'/);
    expect(app).toMatch(/imageLightboxViewport\?\.addEventListener\('dblclick'/);
    // Zoom state resets on BOTH open and close (a stale transform must never greet the next image).
    const openFn = app.slice(app.indexOf('function openImageLightbox'), app.indexOf('function closeImageLightbox'));
    const closeFn = app.slice(app.indexOf('function closeImageLightbox'), app.indexOf('function imageDownloadExtension'));
    expect(openFn).toMatch(/resetImageLightboxZoom\(\);/);
    expect(closeFn).toMatch(/resetImageLightboxZoom\(\);/);
    // CSS: the viewport owns gestures (touch-action none, no native scroll), the image fits at rest and
    // transforms from origin 0 0 (the zoom math depends on it).
    expect(css).toMatch(/\.image-lightbox-viewport\s*{[\s\S]*?overflow: hidden;[\s\S]*?touch-action: none;/);
    expect(css).toMatch(/\.image-lightbox-viewport img\s*{[\s\S]*?max-width: 100%;[\s\S]*?max-height: 100%;[\s\S]*?transform-origin: 0 0;/);
    expect(css).toMatch(/\.image-lightbox-viewport img\.is-zoom-animated\s*{\s*transition: transform/);
  });

  it('PWA-REPLY-01: swipe-to-reply — REPLY wire block, composer quote strips, gesture engine, quote render on both surfaces', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    const html = readFileSync('web/index.html', 'utf8');
    // Wire: REPLY=5 in the shared PDC1 registry, codec branches delegate to the unit-tested module functions.
    expect(app).toMatch(/REPLY: 5,/);
    expect(app).toMatch(/content = encodeReplyBlockContent\(block\);/);
    expect(app).toMatch(/const reply = decodeReplyBlockContent\(content\);\s*if \(reply\) blocks\.push\(\{ type: 'reply', \.\.\.reply \}\);/);
    // Display blocks pass the quote through; previews ignore it (messagePreviewFromBlocks matches text/payment/image only).
    expect(app).toMatch(/if \(block\.type === 'reply'\) \{\s*return \{ type: 'reply', refEntryId: block\.refEntryId/);
    // Composer threading: the PRIVATE builder defaults to the live draft; retry paths replay the CAPTURED one;
    // the PUBLIC builder pins its OWN draft (never the private one).
    expect(app).toMatch(/function composerBlocksFromDraft\(text, attachments = \[\], replyDraft = privateReplyDraft, fileAttachments = privateFileAttachments, shareDraft = privateShareDraft\)/);
    // The public builder pins its OWN reply draft AND an explicit EMPTY file list — private file drafts must
    // never leak into a public post (v652).
    expect(app).toMatch(/composerBlocksFromDraft\(text, normalizePublicImageAttachments\(attachments\), publicCommentReplyTo, normalizePrivateFileAttachments\(fileAttachments\), publicShareDraft\)/);
    // clean-17: a retry replays the CAPTURED reply draft. The retry-context builder captures it from the message
    // draft, and BOTH live direct-pay send paths (CONV + INTRO first-contact) prefer the captured value over the live
    // composer draft. (The former Vault composer/retry copies of this were removed with the cutover.)
    expect(app).toMatch(/replyDraft: draft\.replyDraft \?\? null/);
    expect(app.match(/context\.replyDraft === undefined \? privateReplyDraft : context\.replyDraft/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(app).toMatch(/const replyDraft = privateReplyDraft \? \{ \.\.\.privateReplyDraft \} : null;/);
    // The reply rides FIRST in the block list, only when the draft has a real chain ref.
    expect(app).toMatch(/blocks\.unshift\(\{ type: 'reply', refEntryId: String\(replyDraft\.refEntryId\)/);
    // Gesture: touch-only leftward swipe with a horizontal-intent lock; rows without a chain anchor are inert.
    expect(app).toMatch(/function attachSwipeToReply\(container, rowSelector, onReply\)/);
    expect(app).toMatch(/if \(event\.pointerType !== 'touch'\) return;/);
    expect(app).toMatch(/if \(!row \|\| !row\.dataset\.entryId\) return;/);
    expect(app).toMatch(/attachSwipeToReply\(messageStrip, '\.message', beginPrivateReplyForRow\);/);
    expect(app).toMatch(/attachSwipeToReply\(publicPane, '\.comment-item', beginPublicCommentReplyForRow\);/);
    // Desktop parity: double-click (images/buttons excluded so the lightbox keeps dblclick zoom).
    expect(app).toMatch(/target\.closest\('img, button, a, textarea, input'\)/);
    // Rows carry the chain anchor; quotes render + scroll within their own surface.
    expect(app).toMatch(/row\.dataset\.entryId = String\(message\.chainEntryId\);/);
    expect(app).toMatch(/row\.dataset\.entryId = String\(comment\.entryId\);/);
    expect(app).toMatch(/function buildReplyQuoteNode\(reply, scroller\)/);
    expect(app).toMatch(/buildReplyQuoteNode\(replyBlock, messageStrip\)/);
    expect(app).toMatch(/buildReplyQuoteNode\(block, publicPostDetailBody\)/);
    // Cancel semantics: public Cancel clears ONLY the reply while in reply mode (comment mode survives on the
    // detail screen); the private strip has its own cancel.
    expect(app).toMatch(/if \(publicCommentReplyTo\) \{\s*setPublicCommentReplyTo\(null\);\s*return;\s*\}/);
    expect(app).toMatch(/privateReplyCancelButton\?\.addEventListener\('click'/);
    // Drafts clear on send, thread switch, and account switch.
    expect(app).toMatch(/setPrivateReplyDraft\(null\);\s*setPrivateShareDraft\(null\);\s*privateFileAttachments = \[\];\s*updatePrivateFileAttachmentUi\(\);\s*updateImageAttachmentUi\('private'\);/);
    expect(app).toMatch(/if \(activeThreadId !== thread\.id\) setPrivateReplyDraft\(null\);/);
    expect(app).toMatch(/setPrivateReplyDraft\(null\);\s*setPublicCommentReplyTo\(null\);/);
    // UI shells + gesture CSS (touch-action pan-y keeps vertical scroll native; position:relative anchors the
    // desktop hover Reply button).
    expect(html).toMatch(/id="privateReplyContext"/);
    // v700 reply-row layout invariant: the mobile grid re-rows around the quote strip via the JS-set
    // .is-replying class (setPrivateReplyDraft) — NOT :has() (no-op on the iOS floor) — and NO ID-scoped
    // #composer[data-publish-mode] layout rule may exist: its (1,x,x) specificity silently beat the reply
    // rows whenever a wallet was present (textarea/send stayed on row 1, overlapping the quote strip).
    // v766: the share chip shares the same composer row — the class stays while EITHER strip is up.
    expect(app).toMatch(/composer\?\.classList\.toggle\('is-replying', Boolean\(privateReplyDraft \|\| privateShareDraft\)\);/);
    // v769: the composer is a flex COLUMN now (no grid reply-row reshuffle). The reply/share context strips are
    // earlier flex children, so DOM order alone puts them directly above the input row on every width — no
    // .is-replying grid juggling needed (the class stays as a harmless hook).
    expect(css).toMatch(/\.composer \{\s*display: flex;\s*flex-direction: column;/);
    expect(html).toMatch(/id="privateReplyContext"[\s\S]*?id="privateShareContext"[\s\S]*?class="composer-input-row"/);
    expect(css).not.toMatch(/#composer\[data-publish-mode/);
    expect(css).not.toMatch(/\.composer:has\(> \.composer-reply-context/);
    expect(css).toMatch(/\.message,\s*\.comment-item \{\s*position: relative;\s*touch-action: pan-y;/);
    // v648 (owner: "дёргается и возвращается"): the swipe CONTAINERS surrender horizontal touch gestures too —
    // a row-LINE swipe starts on the scroller's own space, and without pan-y there the browser claims the
    // gesture and pointercancels the drag mid-flight.
    expect(css).toMatch(/\.message-strip \{[\s\S]*?touch-action: pan-y;/);
    expect(css).toMatch(/\.public-post-detail-body \{[\s\S]*?touch-action: pan-y;/);
    expect(css).toMatch(/\.message-reply-quote \{/);
    expect(css).toMatch(/\.reply-target-flash \{/);
    // v647 UX pass (owner feedback): EITHER direction triggers (a one-letter incoming bubble at the screen edge
    // has no room for a leftward drag), the swipe grabs the whole row LINE (band hit-test — no reaching for a
    // narrow bubble), and hover-capable devices get a VISIBLE Reply button (touch keeps the clean swipe).
    expect(app).toMatch(/function swipeRowAtPoint\(container, rowSelector, target, clientY\)/);
    expect(app).toMatch(/const row = swipeRowAtPoint\(container, rowSelector, event\.target, event\.clientY\);/);
    expect(app).toMatch(/Math\.max\(-SWIPE_REPLY_MAX_PX, Math\.min\(SWIPE_REPLY_MAX_PX, dx\)\)/);
    expect(app).toMatch(/Math\.abs\(clamped\) >= SWIPE_REPLY_TRIGGER_PX/);
    expect(app).toMatch(/if \(axis === 'h' && Math\.abs\(dx\) >= SWIPE_REPLY_TRIGGER_PX\) onReply\(row\);/);
    expect(app).toMatch(/function appendRowReplyButton\(row, onReply\)/);
    expect(app).toMatch(/appendRowReplyButton\(row, beginPrivateReplyForRow\);/);
    expect(app).toMatch(/appendRowReplyButton\(row, beginPublicCommentReplyForRow\);/);
    // A DESCENDANT selector, not a direct child: the cluster hangs off the BUBBLE now (the row is a grid stretched
    // to its max width, so a short incoming message left its row box 240px wider than the bubble). :hover still
    // holds while the pointer is over the cluster because hover follows the DOM tree, not the box.
    expect(css).toMatch(/@media \(hover: hover\) \{[\s\S]*?\.message:hover \.row-actions/);
    // Fullscreen lightbox (v647): the dialog fills the viewport — zooming needs the room, not a content card. v742
    // bounds the height to --app-viewport-height on EVERY platform (bare height:100% didn't resolve on desktop -> a
    // tall image overflowed the window).
    expect(css).toMatch(/\.image-lightbox-dialog \{[\s\S]*?width: 100%;[\s\S]*?height: var\(--app-viewport-height, 100dvh\);\s*\n\s*max-height: var\(--app-viewport-height, 100dvh\);/);
    expect(css).toMatch(/\.image-lightbox-backdrop\.image-lightbox-backdrop \{\s*padding: 0;\s*\}/);
  });

  it('PWA-PUBLIC-FEED-INLINE-COMMENTS-REMOVED: the feed render no longer shows inline comments (they load on the post detail), but the renderer stays for the detail', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const renderFeedSource = app.slice(
      app.indexOf('function renderPublicFeed('),
      app.indexOf('function renderPublicSurface('),
    );
    // The feed render must NOT call appendPublicItemComments (the inline-comment-loading the owner asked to remove).
    expect(renderFeedSource).not.toMatch(/appendPublicItemComments\(/);
    // The renderer itself still exists — the post detail screen reuses it for the comment list.
    expect(app).toMatch(/function appendPublicItemComments\(article, item\)/);
  });

  it('PWA-PUBLIC-BUTTON-COMMENTS-TEXT: the per-post action button is "Comments", viewable without a wallet, and opens the post detail', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const actionsSource = app.slice(
      app.indexOf('function appendPublicItemActions('),
      app.indexOf('function renderPublicFeed('),
    );
    expect(actionsSource).toMatch(/commentButton\.textContent = t\('public\.comments'\);/);
    expect(EN_STRINGS['public.comments']).toBe('Comments');
    // Viewing comments needs no wallet — gated on the on-chain post only, not plathoWallet.
    expect(actionsSource).toMatch(/const canViewComments = Boolean\(commentsAllowed && hasChainCommentTarget\);/);
    expect(actionsSource).toMatch(/commentButton\.disabled = !canViewComments;/);
    expect(actionsSource).toMatch(/openPublicPostDetail\(item\)/);
  });

  it('PWA-PUBLIC-POST-DETAIL: post detail screen state, open/close, on-demand loader, and HTML section exist', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const html = readFileSync('web/index.html', 'utf8');
    expect(app).toMatch(/let publicPostDetailOpen = false;/);
    expect(app).toMatch(/function openPublicPostDetail\(item\)/);
    expect(app).toMatch(/function closePublicPostDetail\(\)/);
    expect(app).toMatch(/async function loadPublicPostComments\(item, options = \{\}\)/);
    // Open/close toggle the pane attribute the CSS keys on, mirroring the private chatOpen overlay.
    expect(app).toMatch(/publicPane\.dataset\.postOpen = 'true';/);
    expect(app).toMatch(/publicPane\.dataset\.postOpen = 'false';/);
    // Back/overlay nav recognises the detail as an open overlay.
    expect(app).toMatch(/publicPane\?\.dataset\?\.postOpen === 'true'/);
    // HTML section lives inside the public pane with a back button and a body container.
    expect(html).toMatch(/<div class="public-post-detail" id="publicPostDetail" hidden>/);
    expect(html).toMatch(/id="publicPostBackButton"/);
    expect(html).toMatch(/id="publicPostDetailBody"/);
  });

  it('PWA-PUBLIC-COMMENT-MODE-PERSISTENCE: publishing a comment from the detail screen keeps the composer in comment mode for that post', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // The shared composer only resets the comment target when NOT on the post detail screen.
    expect(app).toMatch(/if \(!publicPostDetailOpen\) setPublicCommentTarget\(null\);/);
  });

  it('PWA-PUBLIC-COMMENTS-ONDEMAND-DEGRADE: the on-demand comment loader fails closed (no partial list as complete) and binds comments to the parent', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const loaderSource = app.slice(
      app.indexOf('async function loadPublicPostCommentsFromShards'),
      app.indexOf('async function loadPublicPostComments('),
    );
    // Missing parent coordinates -> genuinely zero comments (clean, not degraded).
    expect(loaderSource).toMatch(/if \(item\?\.channelEpochTag == null \|\| item\?\.entryId == null \|\| !item\?\.authorWallet\) \{/);
    expect(loaderSource).toMatch(/return \{ comments: \[\], degraded: false, parentExists: false, latestLink: '0', cursors: null, hasMore: false \};/);
    // The post-detail empties honestly: genuinely-empty (clean read, no index) vs not-loaded (failed read).
    expect(app).toMatch(/publicPostDetailParentExists === false/);
    // A rate-limited read returns degraded:true (the caller keeps "Loading" and retries; never caches a partial).
    // A failed read (rate limit included) degrades AND feeds the shared limiter — never a partial list cached
    // as complete, and never a silent hammering loop.
    expect(loaderSource).toMatch(/if \(!noteTonRpcRateLimit\(error\)\) console\.warn/);
    expect(loaderSource).toMatch(/return \{ comments: \[\], degraded: true \};/);
    // Parent binding identical to the feed sync: drop only when BOTH hashes present AND mismatch (lowercased).
    // Parent binding is STRUCTURAL in the shard model: a thread shard IS the parent's, so every comment read
    // there carries that parent's id and hash.
    expect(loaderSource).toMatch(/parentEntryId: String\(item\.entryId\),/);
    expect(loaderSource).toMatch(/parentHash: item\.bodyHash,/);
    // The retry orchestrator keeps the partial OUT of the authoritative list on a degraded walk.
    const refreshSource = app.slice(
      app.indexOf('async function refreshPublicPostDetailComments('),
      app.indexOf('async function confirmPublicCommentsRisk('),
    );
    expect(refreshSource).toMatch(/if \(token !== publicPostDetailLoadToken\) return;/);
    expect(refreshSource).toMatch(/if \(!result\.degraded\)/);
  });

  it('PWA-OWN-CHANNEL-DEFAULT-01: the own wallet channel is synthesized as a feed source even when not yet registered', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const ownSource = app.slice(
      app.indexOf('function ownPublicChannel()'),
      app.indexOf('function feedSourcePublicChannels('),
    );
    // Falls back to a synthesized channel (same id shape) instead of null when the registry lacks it, so a fresh
    // import / cleared state still has the own channel as a feed source without needing to publish first.
    expect(ownSource).toMatch(/const existing = publicChannelRegistry\.find/);
    expect(ownSource).toMatch(/id: `wallet:\$\{wallet\}`/);
    expect(ownSource).toMatch(/authorWallet: wallet,/);
  });

  it('PWA-PREFS-CHAT-FILTER-01: a prefs capsule is diverted before thread routing and never becomes a chat message', () => {
    const app = readFileSync('web/app.js', 'utf8');
    expect(app).toMatch(/function prefsBytesFromOpenedCapsule\(opened\)/);
    const detect = app.slice(app.indexOf('function prefsBytesFromOpenedCapsule(opened)'), app.indexOf('function messageFromOpenedCapsule('));
    expect(detect).toMatch(/Number\(opened\.payload\.partCount \?\? 1\) > 1\) return null/);
    // SECURITY (v725): a prefs snapshot is only accepted when the capsule was SIGNED BY OUR OWN messaging key — a
    // foreign document capsule carrying a 'prefs' block can't inject subscriptions / a linked username onto a fresh
    // device. The check is the signing key (works cross-device + anonymous mode), NOT payload.senderWallet.
    expect(detect).toMatch(/const ownSig = ownMessagingSignPubkeyValue\(\);\s*\n\s*if \(!ownSig \|\| senderSigningPublicKeyValue\(opened\) !== ownSig\) return null;/);
    expect(app).toMatch(/function ownMessagingSignPubkeyValue\(\) \{[\s\S]*?bytesToBigIntValue\(key\)\.toString\(\)/);
    // Scan diverts AFTER opening the capsule and BEFORE resolving a thread.
    // The shard receive path opens the capsule and hands it to appendOpenedCapsuleMessage, whose defensive
    // divert (asserted below) runs BEFORE the message reaches any thread — so a prefs capsule still never becomes
    // a chat message. The pre-thread divert inside the CapsuleHub walk went with that walk.
    const convScan = app.slice(app.indexOf('async function syncConvCapsulesFromShards'), app.indexOf('async function syncPrivateCapsulesFromChain('));
    expect(convScan).toMatch(/opened = await openPrivateCapsuleChainEntry\(found\.entry, localRecipientKeyPair/);
    expect(app).toMatch(/appendOpenedCapsuleMessage\(parts\[0\]\.opened, targetThread, 'received', parts\[0\]\.entry\)/);
    // Defensive divert at the top of the append path too.
    const appendSrc = app.slice(app.indexOf('async function appendOpenedCapsuleMessage('), app.indexOf('async function appendOpenedPrivatePartsMessage('));
    expect(appendSrc).toMatch(/const prefsBytes = prefsBytesFromOpenedCapsule\(opened\);\s*if \(prefsBytes\) \{ collectRestoredPrefsSnapshot\(prefsBytes\); return true; \}/);
  });

  it('PWA-PREFS-RESTORE-01: restore collects diverted snapshots and auto-applies the newest only on a fresh device', () => {
    const app = readFileSync('web/app.js', 'utf8');
    expect(app).toMatch(/function collectRestoredPrefsSnapshot\(/);
    expect(app).toMatch(/function drainRestoredPrefsSnapshots\(/);
    expect(app).toMatch(/function applyPrefsSnapshot\(snapshot\)/);
    // Drain runs after each private sync pass.
    const wrap = app.slice(app.indexOf('async function syncPrivateCapsulesFromChainOnce('), app.indexOf('function isChatsViewActive('));
    expect(wrap).toMatch(/drainRestoredPrefsSnapshots\(\)/);
    // Conservative auto-restore guard: only on a truly fresh device (never synced, not dirty, no local follows).
    expect(app).toMatch(/prefsLastSyncedAt === null && !prefsDirty && !hasLocalFollows/);
  });

  it('PWA-PREFS-BUTTON-01: Save subscriptions button publishes the snapshot, shows last-synced, disabled when nothing to save', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const html = readFileSync('web/index.html', 'utf8');
    expect(html).toMatch(/id="savePrefsButton"/);
    expect(html).toMatch(/id="savePrefsStatus"/);
    expect(app).toMatch(/savePrefsButton\?\.addEventListener\('click'/);
    expect(app).toMatch(/savePrefsButton\.disabled = !\(Boolean\(plathoWallet && hasActivePlathoAccount\(\)\) && prefsDirty && !prefsSyncInFlight\)/);
    expect(app).toMatch(/t\('sync\.savedAt', \{ date: prefsSyncedDateLabel\(prefsLastSyncedAt\) \}\)/);
    expect(EN_STRINGS['sync.savedAt']).toBe('saved {date}');
    expect(app).toMatch(/refreshPrefsSyncUi\(\);/);
  });

  it('PWA-PREFS-NO-SILENT-FLUSH-01: prefs write only via the explicit button; follow/unfollow only marks dirty', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // No timer-driven / background publish of the snapshot.
    expect(app).not.toMatch(/setTimeout\([^)]*publishPrefsSnapshot/);
    expect(app).not.toMatch(/setInterval\([^)]*publishPrefsSnapshot/);
    // Following / unfollowing marks dirty (does not auto-publish).
    const addSrc = app.slice(app.indexOf('function addCustomPublicChannel('), app.indexOf('function resyncPublicForNewSubscription'));
    expect(addSrc).toMatch(/markPrefsDirty\(\)/);
    const setSrc = app.slice(app.indexOf('function setPublicChannelSubscribed('), app.indexOf('function readPublicReadCursors('));
    expect(setSrc).toMatch(/markPrefsDirty\(\)/);
  });

  it('PWA-PREFS-USERNAMES-01: the prefs snapshot also syncs the wallet .ath names so a cleared device restores its linked-names list', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const build = app.slice(app.indexOf('function buildPrefsSnapshot()'), app.indexOf('function serializePrefsSnapshotBytes'));
    expect(build).toMatch(/readKnownPlathoUsernames\(plathoWallet\?\.address\)/);
    expect(build).toMatch(/readLinkedPlathoUsername\(plathoWallet\?\.address\)\?\.label/);
    expect(build).toMatch(/channels, usernames, linked \}/);
    expect(app).toMatch(/function restoreKnownUsernamesFromSnapshot\(snapshot\)/);
    const restore = app.slice(app.indexOf('function restoreKnownUsernamesFromSnapshot(snapshot)'), app.indexOf('function applyPrefsSnapshot(snapshot)'));
    expect(restore).toMatch(/addKnownPlathoUsername\(label\.trim\(\)\)/);
    const apply = app.slice(app.indexOf('function applyPrefsSnapshot(snapshot)'), app.indexOf('function collectRestoredPrefsSnapshot'));
    expect(apply).toMatch(/restoreKnownUsernamesFromSnapshot\(snapshot\)/);
    // Re-link the remembered display name only when this device has none yet (so a local choice is never clobbered).
    expect(apply).toMatch(/!readLinkedPlathoUsername\(\)[\s\S]*?writeLinkedPlathoUsername\(identity\)/);
    // Additive restore even on a non-fresh device (drain's non-auto-apply branch).
    const drain = app.slice(app.indexOf('function drainRestoredPrefsSnapshots('), app.indexOf('function publicAuthorLabel'));
    expect(drain).toMatch(/restoreKnownUsernamesFromSnapshot\(newest\)/);
  });

  it('PWA-LINK-NAME-NO-FLICKER-01: Link Platho name verifies in-place (no close+reopen flicker)', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    // The dialog's select shows a clearly visible accent down-chevron (the shared chevron-down.svg is fill=#000,
    // invisible on the dark field) so users see it's an expandable dropdown.
    expect(css).toMatch(/\.recipient-dialog select \{[\s\S]*?cursor: pointer;[\s\S]*?data:image\/svg\+xml,[\s\S]*?fill='%2330d5b0'/);
    // openActionDialog supports an async validateSubmit gate; the submit handler keeps the dialog open on ok:false.
    expect(app).toMatch(/validateSubmit: config\.validateSubmit \?\? null/);
    const submit = app.slice(app.indexOf("actionForm?.addEventListener('submit'"), app.indexOf("document.addEventListener('click'"));
    expect(submit).toMatch(/const validate = dialogAtStart\.validateSubmit/);
    expect(submit).toMatch(/if \(outcome && outcome\.ok\) \{\s*closeActionDialog\(outcome\.result \?\? values\)/);
    expect(submit).toMatch(/actionHint\.dataset\.tone = 'error'/);
    // requestWalletDisplayIdentity verifies via validateSubmit in a single open — NOT a close+reopen while-loop.
    const fn = app.slice(app.indexOf('async function requestWalletDisplayIdentity'), app.indexOf('async function requestUsernameMintName'));
    expect(fn).toMatch(/validateSubmit: async \(values\) =>/);
    expect(fn).toMatch(/verifyWalletDisplayIdentity\(normalizedMode, chosen, plathoWallet\)/);
    expect(fn).not.toMatch(/while \(true\)/);
    // The submit button is DISABLED while the async gate runs (no double-submit) and the "checking" hint shows.
    expect(submit).toMatch(/if \(actionSubmitButton\) actionSubmitButton\.disabled = true;\s*\n\s*if \(actionHint\) \{ actionHint\.textContent = dialogAtStart\.checkingHint/);
    // Add-public-channel resolves the channel INSIDE validateSubmit, so the "Add channel" button locks while the
    // .ath/.ton/wallet lookup runs and the dialog no longer closes-then-reopens on a bad name.
    const addChan = app.slice(app.indexOf('async function openAddPublicChannelDialog()'), app.indexOf('async function openAddPublicChannelDialog()') + 2400);
    expect(addChan).toMatch(/validateSubmit: async \(values\) => \{/);
    expect(addChan).toMatch(/const resolved = await resolvePublicChannelIdentity\(values\.channelIdentity\);/);
    expect(addChan).toMatch(/return \{ ok: true, result: \{ \.\.\.values, resolved \} \};/);
    expect(addChan).toMatch(/const \{ identity, authorWallet \} = result\.resolved;/);
  });

  it('PWA-IOS-VAULT-READ-SERIAL-01: nav-balance read defers to an in-flight vault refresh (no concurrent get_user / iOS activation freeze)', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // Two concurrent app-level chain reads hard-freeze iOS WebKit (the permanent "Activate Platho account" freeze
    // on the post-transaction read fan-out). Under clean-17 the balance path reads the WALLET (there is no Vault
    // get_user to collide with), and the rule is enforced two ways: the two balance reads are strictly sequential
    // inside the refresh, and a single-flight promise stops overlapping refreshes stacking a second pair.
    const navFn = app.slice(
      app.indexOf('async function refreshVaultNavBalanceInBackground'),
      app.indexOf('function walletFormattedBalance'),
    );
    expect(navFn).toMatch(/if \(navVaultBalanceRefreshPromise\) return navVaultBalanceRefreshPromise;/);
    expect(navFn).toMatch(/const ton = await loadConnectedTonWalletBalance\(\);\s*\n\s*const ath = await loadConnectedAthWalletBalance\(\)\.catch\(\(\) => null\);/);
    expect(navFn).toMatch(/navVaultBalanceRefreshPromise = null;/);
    // Both leaf reads hold the shared read mutex, so they cannot overlap ANY other app-level read either.
    expect(app).toMatch(/async function loadConnectedTonWalletBalance[\s\S]{0,400}?return withVaultReadLock\(async \(\) => \{/);
    expect(app).toMatch(/withVaultReadLock\(\(\) => provider\.getWalletData\(/);
  });

  it('PWA-VAULT-ACTIVATION-GUARD-01: a not-activated read for a wallet already seen activated never tears down the activated UI', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // Registration is MONOTONIC on-chain (a registered KeyShard never un-registers), so a "not registered" answer
    // that is not a DEFINITIVE uninit shard is a transient bad read (lagging replica / pre-registration height /
    // reorg) and must never flip the UI to "activate your account" until a good read heals it.
    //
    // clean-15 enforced this AFTER the fact, with a downgrade guard that remembered the last wallet seen activated
    // and rejected contradicting reads. clean-17 enforces it at the SOURCE, which is strictly stronger: the only
    // read is the wallet's own KeyShard, and only an uninit shard is accepted as "not registered" — every other
    // failure is rethrown to a catch that PRESERVES the existing binding. A bad read cannot produce a downgrade to
    // guard against, so there is nothing left to remember.
    const activation = app.slice(
      app.indexOf('async function refreshVaultActivationStatus'),
      app.indexOf('// ── Boot screen'),
    );
    expect(activation).toMatch(/if \(!isKeyShardUninitError\(readError\)\) throw readError;\s*\n\s*view = \{ exists: false \};/);
    expect(activation).toMatch(/catch \(error\) \{[\s\S]{0,600}?return globalThis\.plathoVaultBinding \?\? null;/);
    // The downgrade guard and its per-wallet memory are gone with the read that needed them.
    expect(app).not.toMatch(/lastKnownActivatedVaultWalletRaw/);
    expect(app).not.toMatch(/function isTransientVaultActivationDowngrade\(/);
  });

  it('PWA-VAULT-ACTIVATION-XWALLET-02: a stale get_user resolving after a wallet switch never marks the NEW wallet activated', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // The v739 activation guard bound the observation to the AMBIENT wallet at read-resolution time. A get_user issued
    // for wallet A that resolves AFTER an in-app switch to a fresh wallet B then marked B activated, and the guard
    // masked B's genuine not-activated reads all session (the review's cross-wallet poison + a ~1/sec read storm).
    // Fix: STAMP each read with the wallet it was issued for (loadConnectedVaultUser, the single choke point) and
    // attribute note/guard only to a read whose stamp matches the currently-connected wallet.
    // Every wallet-scoped read captures the wallet it is ISSUED for BEFORE the network await and discards itself if
    // the connected wallet changed while it was in flight. Both live paths carry it: the activation read (whose
    // binding would otherwise name B while holding A's registration) and the balance refresh (which would otherwise
    // render A's funds under B).
    const activation = app.slice(
      app.indexOf('async function refreshVaultActivationStatus'),
      app.indexOf('// ── Boot screen'),
    );
    expect(activation).toMatch(/const forWallet = plathoWallet\.address;\s*\n\s*const forWalletRaw = rawWalletAddress\(forWallet\);/);
    expect(activation).toMatch(/if \(!plathoWallet\?\.address \|\| rawWalletAddress\(plathoWallet\.address\) !== forWalletRaw\) return globalThis\.plathoVaultBinding \?\? null;/);
    // ...and the binding is written under the wallet the read was ISSUED for, never the ambient one.
    expect(activation).not.toMatch(/walletAddress: plathoWallet\.address, user/);
    expect(activation).toMatch(/globalThis\.plathoVaultBinding = \{ walletAddress: forWallet, user/);
    const nav = app.slice(
      app.indexOf('async function refreshVaultNavBalanceInBackground'),
      app.indexOf('function walletFormattedBalance'),
    );
    expect(nav).toMatch(/const forWalletRaw = rawWalletAddress\(plathoWallet\.address\);/);
    expect(nav).toMatch(/if \(!plathoWallet\?\.address \|\| rawWalletAddress\(plathoWallet\.address\) !== forWalletRaw\) return null;/);
    // Wallet change also wipes the cached balances so the NEW wallet never inherits wallet A's funds (this is what
    // makes the failed-read carry-forward safe across an in-app A->B switch).
    expect(app).toMatch(/vaultPocketState = \{ wallet: \{ ton_balance: null, ath_balance: null \} \};\s*\n\s*privateImageAttachments = \[\];/);
  });

  it('PWA-WALLET-BALANCE-CARRY-RETRY-01: a failed external-balance read keeps last-known and retries, never a dash-and-give-up', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // loadConnectedTonWalletBalance resolves NULL on a total failure (it does not throw). Rendering that null wiped a
    // known balance to "-" and never re-read. Fix 1: the nav-balance refresh carries forward last-known on null (a
    // real 0 balance is a bigint so it survives; only null/undefined falls through), and marks a retry when BOTH
    // reads failed. Wallet change resets separately.
    expect(app).toMatch(/ton_balance: ton \?\? vaultPocketState\.wallet\?\.ton_balance \?\? null,/);
    expect(app).toMatch(/ath_balance: ath \?\? vaultPocketState\.wallet\?\.ath_balance \?\? null,/);
    expect(app).toMatch(/if \(ton === null && ath === null\) \{\s*\n\s*markNavVaultBalanceRetryNeeded\('balance unavailable'\);/);
    // Fix 2: the Profile external-GRAM reader carries forward on null AND arms a bounded, view-gated retry.
    const prof = app.slice(app.indexOf('async function refreshWalletTonBalanceForProfile'), app.indexOf('function isProfileViewActive'));
    expect(prof).toMatch(/if \(balance === null\) \{\s*\n[\s\S]*?scheduleWalletTonProfileBalanceRetry\(\);[\s\S]*?return vaultPocketState\.wallet\?\.ton_balance \?\? null;/);
    expect(prof).toMatch(/clearWalletTonProfileBalanceRetry\(\);/);
    expect(app).toMatch(/const WALLET_TON_PROFILE_BALANCE_RETRY_DELAYS_MS = \[1500, 3000, 6000, 12000\];/);
    // The retry stops on success, on leaving the Profile tab, or when the wallet goes away.
    const retry = app.slice(app.indexOf('function scheduleWalletTonProfileBalanceRetry'), app.indexOf('function scheduleWalletTonProfileBalanceRetry') + 700);
    expect(retry).toMatch(/if \(!plathoWallet\?\.address \|\| !isProfileViewActive\(\)\) return;/);
    expect(retry).toMatch(/refreshWalletTonBalanceForProfile\(\)\.catch/);
    // Cleared on a wallet change so a stale timer never chases the old wallet's balance.
    const teardown = app.slice(app.indexOf('function clearWalletScopedRuntimeState('), app.indexOf('function lockPlathoWallet('));
    expect(teardown).toMatch(/clearWalletTonProfileBalanceRetry\(\);/);
  });

  it('PWA-IOS-VAULT-READ-MUTEX-01: ALL leaf Vault chain reads serialize through one withVaultReadLock mutex', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // The single tail-chained mutex: at most one app-level Vault read in flight, across every driver. This is the
    // structural fix for the iOS concurrent-read freeze (crumbs localized it to nav:read on the Vault tab and
    // act:posttx-done -> refreshVaultNow on activation), superseding the ad-hoc per-driver single-flights.
    expect(app).toMatch(/let vaultReadMutexTail = Promise\.resolve\(\);/);
    // The mutex serializes reads AND yields a real macrotask (delay(0)) before each read, so a burst of fast-resolving
    // reads (cache hit / fast reject) can never starve the iOS run loop in microtasks (the v604 dead-freeze fix).
    expect(app).toMatch(/function withVaultReadLock\(fn\) \{[\s\S]*?vaultReadMutexTail\.then\(\(\) => delay\(0\)\)\.then\([\s\S]*?return fn\(\);[\s\S]*?vaultReadMutexTail = run\.then\(\(\) => \{\}, \(\) => \{\}\)/);
    // Every leaf read primitive on the Vault-tab / activation paths is wrapped.
    // Every leaf read primitive on the balance / activation paths is wrapped. The Vault leaves (get_user,
    // get_global, get_key_record) are gone; the KeyShard get_view that replaced the activation read inherits the
    // rule — it is the very read that used to freeze iOS on the activation path, so it must not be the one leaf
    // outside the mutex.
    expect(app).toMatch(/withVaultReadLock\(\(\) => provider\.getView\(forWallet/); // activation (own registration)
    expect(app).toMatch(/withVaultReadLock\(\(\) => provider\.getView\(ownerWallet/); // register-or-repair preflight
    expect(app).toMatch(/withVaultReadLock\(\(\) => provider\.getGlobal\(\{ address: requireUsernameRegistryAddress\(\)/); // username registry
    expect(app).toMatch(/withVaultReadLock\(\(\) => provider\.getJettonData\(/); // ATH stats
    expect(app).toMatch(/withVaultReadLock\(\(\) => provider\.getWalletData\(/); // external ATH balance
    expect(app).toMatch(/withVaultReadLock\(\(\) => provider\.getWalletAddress\(owner/); // ATH wallet address
    expect(app).toMatch(/async function loadConnectedTonWalletBalance[\s\S]{0,400}?return withVaultReadLock\(async \(\) => \{/); // external GRAM balance
    // The mutex wraps LEAF reads only — refreshVaultNow (a driver) is NEVER wrapped (it would self-deadlock across
    // its inner wrapped leaves).
    const refreshNow = app.slice(app.indexOf('async function refreshVaultNow'), app.indexOf('async function refreshVaultNow') + 200);
    expect(refreshNow).not.toMatch(/withVaultReadLock/);
  });

  // PWA-IOS-CONFIRM-RECEIPT-ONLY-01 removed with the confirm it split. The iPhone dead-freeze it fixed was the INLINE
  // post-broadcast entry-scan on the send critical path: the sender hung searching CapsuleHub for an entry that was
  // not on chain yet. Direct pay has no entry scan at all — the send ends at the wallet broadcast, and the delivery
  // check is a single deferred read (armConvDeliveryConfirm, pinned in PWA-CONV-DELIVERY-01). There is no longer an
  // inline scan to keep off the critical path.

  // PWA-IOS-LOADUINT-CHUNKED-01 removed with the receipt-ring decoder it made fast. The iPhone-only "freeze on
  // confirming" was tonCellBitReader.loadUint folding ONE BigInt op per bit while decoding the 20-slot Vault
  // get_user_receipts ring (~13k ops, ~0.4s on iOS JavaScriptCore). The ring, the reader and the hashmap walk are
  // all gone with the Vault: a direct-pay confirmation reads a single get-method result, so there is no bulk cell
  // decode left on the confirm path to make fast.

  it('PWA-IOS-PUMP-YIELD-01: the shared RPC pump yields a macrotask before rejecting a backoff-skipped read (no microtask-starvation freeze)', () => {
    const rpc = readFileSync('web/ton-rpc-transport.mjs', 'utf8');
    // ROOT FIX for the iOS dead-freeze that moved between Vault/activation/send: drainToncenterRequestQueue is the one
    // shared pump every read flows through. During a 429 backoff it rejects every skipIfRateLimited read with NO
    // macrotask yield (the only `await delay(waitMs)` is skipped because waitMs<=0), so the microtask queue never
    // empties and setInterval/render/setTimeout never run = the whole app dead on slow iOS JSC. The fix: the
    // skip-rate-limited backoff branch MUST `await delay(0)` (a real setTimeout macrotask) before throwing.
    const drain = rpc.slice(rpc.indexOf('async function drainToncenterRequestQueue'), rpc.indexOf('async function scheduleToncenterRequest'));
    expect(drain).toMatch(/skipIfRateLimited === true && state\.backoffUntil > now/);
    // The yield must come BEFORE the backoff throw, inside that branch.
    const branch = drain.slice(drain.indexOf('skipIfRateLimited === true && state.backoffUntil > now'), drain.indexOf('throw toncenterBackoffError'));
    expect(branch).toMatch(/await delay\(0\)/);
    // delay() is a genuine macrotask (setTimeout), not a microtask.
    expect(rpc).toMatch(/function delay\(ms\)\s*\{\s*return new Promise\(\(resolve\) => setTimeout\(resolve, ms\)\)/);
  });

  it('PWA-IOS-ACT-KEYSHARD-SINGLE-READ-01: activation status costs ONE chain read (the get_key_record freeze is structurally gone)', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // The localized permanent iOS freeze was the get_key_record read on the boot / activation critical path. clean-15
    // dodged it with a fast path that recomputed the contract's binding hash locally and skipped the read on a match,
    // keeping the heavy read as the rotation fallback. clean-17 removes the read itself: registration lives in the
    // wallet's OWN KeyShard, whose ADDRESS is derived from the wallet, so a single get_view answers both "am I
    // registered" and "with which keys" — there is no second record to fetch and no fallback that could reintroduce
    // one. Pin the shape so a future change cannot quietly add a second read back onto this path.
    const fn = app.slice(
      app.indexOf('async function refreshVaultActivationStatus'),
      app.indexOf('// ── Boot screen'),
    );
    expect(fn).not.toMatch(/getKeyRecord|computeVaultMessagingKeyId/);
    expect((fn.match(/await withVaultReadLock\(/g) ?? []).length).toBe(1);
    expect(fn).toMatch(/provider\.getView\(forWallet, \{ verify: true, priority: 'critical', cacheTtlMs: 0 \}\)/);
    // The keys are compared against the LOCAL draft (the address-binding already proves the shard is ours), so a
    // local key change shows as "activate" and prompts the re-register that overwrites the shard.
    expect(fn).toMatch(/BigInt\(view\.enc_pubkey \?\? 0n\) === BigInt\(localVaultDraft\.message\.enc_pubkey \?\? 0n\)/);
    expect(fn).toMatch(/BigInt\(view\.sign_pubkey \?\? 0n\) === BigInt\(localVaultDraft\.message\.sign_pubkey \?\? 0n\)/);
  });

  it('PWA-IOS-SHARED-TONCENTER-QUEUE-01: keyed + keyless toncenter share one limiter queue (no parallel connections / iOS freeze)', () => {
    const config = readFileSync('web/platho-config.mjs', 'utf8');
    const app = readFileSync('web/app.js', 'utf8');
    // BOTH toncenter providers carry the SAME explicit rateLimitKey -> one single-worker request pump, so the
    // keyed primary and the keyless emergency can never fire two simultaneous connections to toncenter.com.
    const shared = config.match(/rateLimitKey: 'toncenter-shared'/g) ?? [];
    expect(shared.length).toBe(2);
    // Wallet teardown cancels the pending rail Vault-balance retry so it can't race the next boot's reads.
    // Window is 1800 (was 1200/900): the reset function legitimately grew (public confirm-job timers, the public
    // post-comments SWR cache, and the per-account public-feed sync cursors are cleared here too). The guard still
    // pins that the nav-balance timer is cleared.
    expect(app).toMatch(/function clearWalletScopedRuntimeState[\s\S]{0,1800}clearNavVaultBalanceRetryTimer\(\)/);
  });

  it('PWA-CANONICAL-USERNAME-01: usernames display canonically (no .ath suffix) via displayIdentityLabel + threadDisplayLabel', () => {
    const app = readFileSync('web/app.js', 'utf8');
    expect(app).toMatch(/function canonicalUsernameDisplay\(label\)/);
    const canon = app.slice(app.indexOf('function canonicalUsernameDisplay(label)'), app.indexOf('function displayIdentityLabel('));
    expect(canon).toMatch(/\.ath/);
    expect(canon).toMatch(/replace/);
    // The shared identity + thread label functions route through the canonical strip.
    const displayFn = app.slice(app.indexOf('function displayIdentityLabel(identity)'), app.indexOf('function verifyWalletDisplayIdentity'));
    expect(displayFn).toMatch(/canonicalUsernameDisplay\(/);
    const threadFn = app.slice(app.indexOf('function threadDisplayLabel(thread)'), app.indexOf('function threadDisplayTone'));
    expect(threadFn).toMatch(/canonicalUsernameDisplay\(thread\?\.name/);
    // Public feed/channel author also canonicalizes: the post/comment author string source (publicAuthorLabel)
    // and the registry-name overlay (applyContactDisplayToRegistryChannel's fallback) both strip ".ath", so the
    // feed card author, channels list, channel-detail header, post-detail title and comment rows are all bare.
    const authorFn = app.slice(app.indexOf('function publicAuthorLabel(authorWallet)'), app.indexOf('function ensurePublicChannelForAuthorWallet'));
    expect(authorFn).toMatch(/canonicalUsernameDisplay\(channelName\)/);
    const overlayFn = app.slice(app.indexOf('function applyContactDisplayToRegistryChannel(channel)'), app.indexOf('function publicChannelAvatar'));
    expect(overlayFn).toMatch(/canonicalUsernameDisplay\(channel\.name\)/);
  });

  it('PWA-HEADER-CONSISTENCY-01: public post header matches the private chat header (tone, grid, compressed height, date on card)', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    const detailFn = app.slice(app.indexOf('function renderPublicPostDetail()'), app.indexOf('function openPublicPostDetail'));
    // The public title carries the author's identity tone (teal ".ath" etc.), mirroring renderConversationIdentity.
    expect(detailFn).toMatch(/resolveWalletChannelDisplay\(item\.authorWallet\)\?\.tone/);
    expect(detailFn).toMatch(/identity-title-label identity-label-\$\{authorTone\}/);
    // Date is no longer in the header subtitle (empty, like the private header) — it moves onto the post card.
    expect(detailFn).toMatch(/setText\(publicPostDetailSubtitle, ''\)/);
    expect(detailFn).toMatch(/className = 'feed-meta public-detail-post-meta'/);
    // The public header grid + gap match the private mobile header exactly so the avatar lines up identically
    // (back column = the shared header-button size, avatar 44).
    expect(css).toMatch(/\.public-pane \.public-post-detail-header \{\s*grid-template-columns: var\(--header-button-size\) 44px minmax\(0, 1fr\) max-content;\s*gap: 10px;/);
    // Both conversation headers are exactly the shared header height, flush (zero vertical padding), matching
    // every other tab's pane header. A comment sits between the two declarations, so skip it.
    expect(css).toMatch(/\.conversation-header \{\s*min-height: var\(--header-height\);[\s\S]*?padding: 0 24px;/);
    // The chat-pane top padding (BOTH breakpoints) then lands the conversation bar at the shared top offset, so
    // its action buttons sit at the same y as every pane header (uniform header-button height across tabs).
    expect(css).toMatch(/\.app-shell\[data-view="chats"\] \.chat-pane \{\s*display: grid;[\s\S]*?padding-top: var\(--header-top-offset\);/);
    expect(css).toMatch(/\.app-shell\[data-chat-open="true"\]\[data-view="chats"\] \.chat-pane \{\s*display: grid;[\s\S]*?padding-top: var\(--header-top-offset\);/);
    // The mobile conversation header carries no vertical padding of its own (the bar is the shared height).
    expect(css).toMatch(/padding: 0 24px 0 14px;/);
  });

  it('PWA-CHAT-SCROLL-01: only the act of sending moves the dialog — status ticks patch in place, restores use the live position', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const renderSource = app.slice(app.indexOf('function renderConversation()'), app.indexOf('docsButtons.forEach'));
    // Live scroll state is read at render entry: the debounced listener snapshot lags an active gesture (the
    // timer resets on every scroll event), so restoring it mid-scroll jumped to a pre-gesture position.
    expect(renderSource).toMatch(/const stripMeasurable = messageStrip\.clientHeight > 0 && messageStrip\.scrollHeight > 0;/);
    expect(renderSource).toMatch(/messageStrip\.scrollTop = prevConversationScrollTop;/);
    // A status-only re-render patches the existing rows in place and never touches the scroller.
    expect(renderSource).toMatch(/!conversationThreadChanged && !conversationNewOutbound && applyConversationStatusOnlyPatch\(thread\)/);
    expect(app).toMatch(/function applyConversationStatusOnlyPatch\(thread\)/);
    // Anything that changes row STRUCTURE falls through to the full rebuild: a meta node appearing or
    // disappearing, payment action buttons (derived from the meta text), the manual Retry affordance.
    expect(app).toMatch(/if \(\(metaText !== ''\) !== row\.hasMeta\) return false;/);
    // (the payment special-case in the incremental-render diff went with the block type it guarded)
    expect(app).toMatch(/privateMessageShouldShowManualActions\(message\)\) !== row\.showManual\) return false;/);
    // The scroll listener tracks the bottom-pin state immediately — no debounce timer to lag behind a gesture.
    const listenerSource = app.slice(app.indexOf('function rememberConversationScroll()'), app.indexOf('function applyConversationStatusOnlyPatch'));
    expect(listenerSource).not.toMatch(/setTimeout/);
    // A fresh outbound tail remains the ONLY smooth scroll-to-end.
    expect(renderSource).toMatch(/else if \(ownSendScrollToEnd\) \{[\s\S]*?behavior: 'smooth'/);
    // PUBLIC twin (the symmetric case): a publish status tick patches the badge text in place via its
    // data-publish-local-id anchor instead of rebuilding the feed/comments through renderPublicSurface;
    // structural transitions (no badge mounted, terminal failed -> retry wiring) fall through to the full render.
    expect(app).toMatch(/function patchPublicPublishBadgesInPlace\(job, item\)/);
    expect(app).toMatch(/if \(!patchPublicPublishBadgesInPlace\(job, patchedItem\)\) renderPublicSurface\(\{ anchorUnread: false \}\);/);
    expect(app).toMatch(/if \(!status \|\| status\.endsWith\('failed'\)\) return false;/);
    expect((app.match(/statusBadge\.dataset\.publishLocalId = /g) ?? []).length).toBe(2);
  });

  it('PWA-CHAT-OPEN-SCROLL-02: opening a dialog lands on the latest, or anchors the first unread at the top when the unread overflow', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const renderSource = app.slice(app.indexOf('function renderConversation()'), app.indexOf('docsButtons.forEach'));
    // The unread count is captured BEFORE markThreadRead clears it, so the open-scroll can find the first unread.
    expect(renderSource).toMatch(/const conversationOpenUnreadCount = conversationThreadChanged \? threadUnreadCount\(thread\) : 0;/);
    expect(app.indexOf('const conversationOpenUnreadCount =')).toBeLessThan(app.indexOf('markThreadRead(thread))'));
    // First unread = the oldest of the last `unreadCount` INCOMING, walking the sorted messages from the tail.
    expect(app).toMatch(/function firstUnreadIncomingMessageRef\(thread, unreadCount\) \{[\s\S]*?messages\[i\]\?\.type === 'in'[\s\S]*?if \(seenIncoming >= n\) return messages\[i\]/);
    // The anchor: land on the latest (bottom) UNLESS the first unread sits above the last screen -> put it at the top.
    expect(app).toMatch(/function applyConversationOpenScroll\(\) \{[\s\S]*?if \(rowTopWithinStrip < maxScrollTop - 4\) \{\s*\n\s*setConversationScrollTop\(rowTopWithinStrip\);[\s\S]*?setConversationScrollTop\(messageStrip\.scrollHeight\);/);
    // Set up on OPEN (thread change), after the sort so the first-unread ref is resolved against the final order.
    expect(renderSource).toMatch(/conversationOpenFirstUnreadRef = firstUnreadIncomingMessageRef\(thread, conversationOpenUnreadCount\);\s*\n\s*conversationOpenScrollUnsettled = true;/);
    // The first-unread row is tagged so applyConversationOpenScroll can find it.
    expect(renderSource).toMatch(/if \(message === conversationOpenFirstUnreadRef\) row\.dataset\.firstUnread = 'true';/);
    // Applied SYNCHRONOUSLY (so the next burst render reads the correct scrollTop, not a transient 0) AND in the rAF.
    expect(renderSource).toMatch(/if \(conversationOpenScrollUnsettled\) applyConversationOpenScroll\(\);\s*\n\s*requestAnimationFrame/);
    expect(renderSource).toMatch(/requestAnimationFrame\(\(\) => \{\s*\n\s*if \(conversationOpenScrollUnsettled\) \{\s*\n\s*[\s\S]*?applyConversationOpenScroll\(\);/);
    // While the open burst is unsettled the render entry must NOT recompute the pin state from the transient scrollTop.
    expect(renderSource).toMatch(/if \(stripMeasurable && !conversationOpenScrollUnsettled\) \{/);
    // The open-anchor clears on the FIRST genuine user scroll (a scroll >150ms after our own programmatic write).
    expect(app).toMatch(/if \(conversationOpenScrollUnsettled && Date\.now\(\) - conversationProgrammaticScrollAt > 150\) \{\s*\n\s*conversationOpenScrollUnsettled = false;/);
    expect(app).toMatch(/function setConversationScrollTop\(top\) \{[\s\S]*?conversationProgrammaticScrollAt = Date\.now\(\);[\s\S]*?messageStrip\.scrollTop = top;/);
    // Review fix A: the thread-list tap must NOT markThreadRead before renderConversation (that zeroed the count so the
    // first-unread anchor never armed on the primary open path). renderConversation captures the count, THEN marks read.
    const clickHandler = app.slice(app.indexOf("item.addEventListener('click', () => {"), app.indexOf("item.addEventListener('click', () => {") + 1100);
    expect(clickHandler).not.toMatch(/markThreadRead\(/);
    expect(clickHandler).toMatch(/renderThreads\(\);\s*\n\s*renderConversation\(\);/);
    // Review fix B: a fresh own-send abandons the open-anchor (else the rAF's unsettled branch re-pins first-unread-top
    // and the just-sent message is left off-screen). Gated on the PRECISE own-send flag (set by the send submit right
    // before it inserts the optimistic message), NOT on conversationNewOutbound — a late out-of-order INCOMING can also
    // leave an 'out' tail with a grown count and would wrongly clear the anchor + yank the reader (re-review finding).
    expect(app).toMatch(/ownSendPendingRender = true; \/\/ the user just sent[\s\S]*?\n\s*insertThreadMessage\(thread, message\);/);
    expect(renderSource).toMatch(/const ownSendScrollToEnd = ownSendPendingRender;\s*\n\s*ownSendPendingRender = false;/);
    expect(renderSource).toMatch(/if \(ownSendScrollToEnd\) conversationOpenScrollUnsettled = false;/);
    expect(renderSource).not.toMatch(/if \(conversationNewOutbound\) conversationOpenScrollUnsettled = false;/);
    // The rAF smooth-scroll-to-end is also gated on the precise flag now (not conversationNewOutbound), so a late
    // out-of-order incoming can't yank a reader who scrolled up to read history.
    expect(renderSource).toMatch(/else if \(ownSendScrollToEnd\) \{[\s\S]*?behavior: 'smooth'/);
  });

  it('PWA-COMPOSER-ORPHAN-MARKER-01: removing an image drops its [image N] marker; an empty/orphan draft can never be sent', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // Attaching an image inserts an "[image N]" text marker; removing the attachment must strip that marker (and
    // renumber the ones after it, since the attachment array re-indexes) — else the orphan marker lingers and sending
    // it builds a capsule with no real block -> "Capsule publish payload is missing" (the owner's screenshot).
    expect(app).toMatch(/function removeImageMarkerForComposer\(kind, removedIndex\) \{[\s\S]*?if \(!droppedOne && n === removedMarkerNum\) \{ droppedOne = true; return ''; \}[\s\S]*?if \(n > removedMarkerNum\) return `\[image \$\{n - 1\}\]`;/);
    // Removal routes through removeComposerImageAt (v773: also used by Backspace on the image atom) — it splices the
    // array then strips + renumbers the marker, so a deleted image is never orphaned into the send.
    expect(app).toMatch(/remove\.addEventListener\('click', \(\) => removeComposerImageAt\('private', index\)\)/);
    expect(app).toMatch(/function removeComposerImageAt\(kind, index\) \{[\s\S]*?filter\(\(_, i\) => i !== index\);[\s\S]*?removeImageMarkerForComposer\(kind, index\);/);
    // FAIL-CLOSED: the private send handler bails on zero resolved blocks instead of inserting an empty bubble.
    expect(app).toMatch(/const draftBlocks = composerBlocksFromDraft\(text, attachments, replyDraft, fileAttachments, shareDraft\);\s*\n\s*if \(draftBlocks\.length === 0\) \{[\s\S]*?t\('composer\.nothingToSend'\)[\s\S]*?return;/);
    // The send BUTTON (only, not the whole composer) is disabled when nothing real resolves to send — so a stray marker
    // can never be published, while the user can still attach to an empty field.
    expect(app).toMatch(/function privateComposerHasSendableContent\(\) \{[\s\S]*?composerBlocksFromDraft\(messageInput\?\.value \?\? ''[\s\S]*?\.length > 0;/);
    expect(app).toMatch(/const nothingToSend = !blocked && !privateComposerHasSendableContent\(\);\s*\n\s*if \(sendButton\) \{\s*\n\s*sendButton\.disabled = blocked \|\| nothingToSend;/);
    // The composer's secondary controls still follow `blocked` ONLY (NOT nothingToSend) — attaching to an empty field must work.
    expect(app).toMatch(/if \(privateComposerAddButton\) \{\s*\n\s*privateComposerAddButton\.disabled = blocked;/);
    // PUBLIC symmetry: same button gate + the publish submit fails closed on zero blocks (orphan marker leaves non-empty
    // text, so the old "!text && no attachments" gate let it through).
    expect(app).toMatch(/function publicComposerHasSendableContent\(\) \{[\s\S]*?publicDocumentBlocksFromDraft\(publicMessageInput\?\.value \?\? ''\)\.length > 0;/);
    expect(app).toMatch(/const documentBlocks = publicDocumentBlocksFromDraft\(resolvedDraft\.text, attachments, fileAttachments\);\s*\n[\s\S]*?if \(documentBlocks\.length === 0\) return null;/);
    // Symmetric public COMMENT path (generalize-symmetric): same zero-block fail-closed gate, not the old "!text" gate.
    const commentFn = app.slice(app.indexOf('async function submitPublicCommentDirect('), app.indexOf('async function submitPublicCommentDirect(') + 1400);
    expect(commentFn).toMatch(/const documentBlocks = publicDocumentBlocksFromDraft\(text, attachments, fileAttachments\);\s*\n[\s\S]*?if \(documentBlocks\.length === 0\) return null;/);
    expect(commentFn).not.toMatch(/if \(!text && attachments\.length === 0\) return null;/);
    // The outer public composer submit gate also checks resolved blocks, so an orphan bails BEFORE the composer clears
    // (a Ctrl+Enter requestSubmit bypasses the disabled button) — symmetric with the private handler's pre-clear guard.
    const pubSubmit = app.slice(app.indexOf("publicComposer?.addEventListener('submit'"), app.indexOf("publicComposer?.addEventListener('submit'") + 800);
    expect(pubSubmit).toMatch(/if \(publicDocumentBlocksFromDraft\(text, attachments, fileAttachments\)\.length === 0\) return;/);
    // i18n key present (all-language parity is enforced by the i18n test; pin EN here).
    expect(EN_STRINGS['composer.nothingToSend']).toBe('Nothing to send');
    // v759: FILE attachments are positional like images — attaching inserts a `[file N]` marker at the
    // cursor (private + public/comments: one public composer serves both), the block builder places the
    // FILE block at the marker, markerless files (old drafts) still append after the body, and the
    // clear-all button strips every file marker. The marker regex keeps the `(?!\()` labeled-link guard.
    expect(app).toMatch(/\|\\\[file\\s\+\(\\d\+\)\\\]\(\?!\\\(\)/);
    expect(app).toMatch(/function insertFileMarkerForComposer\(kind, index\)/);
    expect(app).toMatch(/insertFileMarkerForComposer\('private', privateFileAttachments\.length\)/);
    expect(app).toMatch(/insertFileMarkerForComposer\('public', publicFileAttachments\.length\)/);
    expect(app).toMatch(/function removeAllFileMarkersForComposer\(kind\)/);
    expect(app).toMatch(/removeAllFileMarkersForComposer\('private'\);\s*\n\s*updatePrivateFileAttachmentUi\(\)/);
    expect(app).toMatch(/removeAllFileMarkersForComposer\('public'\);\s*\n\s*updatePublicFileAttachmentUi\(\)/);
    expect(app).toMatch(/else if \(match\[2\] !== undefined\) pushFile\(match\[2\]\);/);
    expect(app).toMatch(/files\.forEach\(\(_, index\) => \{\s*\n\s*if \(!usedFiles\.has\(index\)\) pushFile\(index \+ 1\);/);
    // Review fixes (v759): (a) the private submit's empty-draft early-return counts FILE attachments as
    // content — a file-only draft (marker hand-deleted) must reach the block-based send, not dead-click;
    // (b) clearing files removes each marker LINE locally, never a global \n{3,} rewrite of the draft.
    expect(app).toMatch(/if \(!text && attachments\.length === 0 && !privateShareDraft\s*\n\s*&& normalizePrivateFileAttachments\(privateFileAttachments\)\.length === 0\) \{/);
    const clearFileMarkersFn = app.slice(
      app.indexOf('function removeAllFileMarkersForComposer('),
      app.indexOf('function removeImageMarkerForComposer('),
    );
    expect(clearFileMarkersFn).not.toMatch(/\\n\{3,\}/);
  });

  it('PWA-OWN-CHANNEL-WHILE-LOCKED-01: the own public channel resolves from the stored plaintext address (so it is a feed source even when the wallet is locked)', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // ownPublicChannel must NOT depend on the live plathoWallet (null while locked / at boot) or the user cannot find
    // their OWN channel in the public list. Same plaintext-address fallback isOwnPublicAuthor already uses.
    expect(app).toMatch(/function ownPublicChannel\(\) \{[\s\S]*?const wallet = rawWalletAddress\(plathoWallet\?\.address \?\? storedPlathoWalletRecord\(\)\?\.address\);/);
  });

  it('PWA-PUBLIC-FEED-IMAGE-SIG-01: the feed render signature includes image presence, so a re-hydrated post image repaints', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // The localStorage feed cache strips image data urls on persist (omitHeavyFeedMediaForPersist), so a reloaded post
    // loses its image; the post-reload sync re-hydrates it from the durable body cache. publicFeedItemRenderSignature
    // omitted image content ("post content is immutable"), so the reused article stayed image-less — the sync repaired
    // the DATA but the signature/DOM never changed ("the image showed once then vanished"). Now image presence is in
    // the signature, so the stripped(0)->hydrated(1) transition invalidates the reused article and it rebuilds.
    const sigFn = app.slice(app.indexOf('function publicFeedItemRenderSignature(item, avatarUrlMemo)'), app.indexOf('function publicFeedItemRenderSignature(item, avatarUrlMemo)') + 1600);
    expect(sigFn).toMatch(/block\?\.type === 'image' && block\.url\)\.length\}\$\{item\.imageUrl \? 'i' : ''\}/);
    // The persist strip (the reason image presence is mutable) is unchanged — the heavy data stays out of localStorage.
    const subs = readFileSync('web/public-channel-subscriptions.mjs', 'utf8');
    expect(subs).toMatch(/if \(key === 'imageUrl' \|\| key === 'avatarImageUrl' \|\| key === 'url'\) return undefined;/);
  });

  it('PWA-PUBLIC-POST-IMAGE-WARM-01: a reloaded post image hydrates from IndexedDB before first render (no chain re-walk)', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // Owner: "the image reappears after ~a minute, looks like it re-downloads from the blockchain every time". It does
    // NOT re-download (the body is a durable-cache HIT) — the minute is the serial chain HEADER/INDEX walk that
    // rediscovers the per-part entry ids before the durable body cache can be consulted (its keys + header_boc are not
    // persisted). Fix = mirror the avatar/comment durable-media model: a decoded post-image store warmed BEFORE the
    // first render, so the image appears in ms with zero chain reads.
    // 1) A dedicated IndexedDB store for decoded post images (SAME shape as the avatar media store), NOT localStorage
    //    (which the strip empties). Deployment-scoped so it is readable before unlock.
    expect(app).toMatch(/createProfileAvatarMediaStore\(\{ dbName: scopedIndexedDbName\('platho-public-post-media-v1'\), cap: \d+ \}\)/);
    // 2) Load-time warm overlays the durable media onto the stripped light item, filling only what is MISSING (an
    //    already-hydrated post is never churned), and returns whether anything changed.
    const warmFn = app.slice(app.indexOf('async function warmPublicPostImagesFromCache()'), app.indexOf('async function warmPublicPostImagesFromCache()') + 900);
    expect(warmFn).toMatch(/await store\.getMany\(pending\.map\(\(entry\) => entry\.key\)\)/);
    expect(warmFn).toMatch(/applyPublicPostMediaRecord\(post, media\)/);
    expect(app).toMatch(/function applyPublicPostMediaRecord\(post, media\) \{[\s\S]*?if \(publicPostRenderableImageMedia\(post\)\) return false;/);
    // 3) The warm runs BEFORE the first render, after the avatar warm (SEQUENTIAL — never a concurrent Promise.all,
    //    per the no-concurrent-read guard), bounded by the boot deadline.
    expect(app).toMatch(/await warmPublicChannelAvatarsFromCache\(\);\s*\n\s*const changed = await warmPublicPostImagesFromCache\(\)/);
    expect(app).toMatch(/await Promise\.race\(\[publicBootMediaWarm, delay\(400\)\]\)/);
    expect(app).not.toMatch(/Promise\.all\(\[/); // must not reintroduce the forbidden concurrent-read form
    // 4) Every feed-cache write goes through one choke point that ALSO persists the heavy decoded image to IndexedDB —
    //    symmetric with the localStorage strip — and the chain-sync commit routes through it (no bare writer there).
    expect(app).toMatch(/function commitPublicChannelFeedCache\(\) \{\s*\n\s*writePublicChannelFeedCache\(publicChannelStorage\(\), publicChannelFeedCache\);\s*\n\s*schedulePublicPostImageMediaPersist\(\);/);
    expect(app).toMatch(/if \(syncedFromChain\) \{\s*\n\s*commitPublicChannelFeedCache\(\);/);
    expect(app).toMatch(/await store\.put\(key, JSON\.stringify\(media\)\);/);
    // The persist keys are session-guarded (post media is immutable) so a post persists at most once per session.
    expect(app).toMatch(/const persistedPublicPostMediaKeys = new Set\(\);/);
  });

  it('PWA-STUCK-CONFIRMING-TERMINAL-01: an outbound stuck at "submitted N/N, confirming" past the stale window renders a terminal, not eternal', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // A private OUTBOUND whose publish never confirmed (e.g. an old underpriced/rejected capsule) stayed on
    // "submitted N/N, confirming" forever because the terminal transition lives only inside a running confirm job that
    // may never re-arm. messageMetaText now backstops it at RENDER time: stale (24h) + not CONFIRMED + no active
    // recovery + a progress-style meta -> the durable "not confirmed" terminal (mapped to the red 'failed' class).
    const metaFn = app.slice(app.indexOf('function messageMetaText(message)'), app.indexOf('function messageStatusKey('));
    expect(metaFn).toMatch(/message\?\.type === 'out'\s*\n\s*&& message\.publishState\s*\n\s*&& message\.publishState\.status !== CAPSULEHUB_PUBLISH_STATUS_CONFIRMED\s*\n\s*&& isStalePrivatePendingPublishConfirmation\(message\)\s*\n\s*&& \/submitted\|confirming\|sending\|waiting for chain\/i\.test\(text\)/);
    expect(metaFn).toMatch(/return privatePublishConfirmStoppedStatusText\(\{ code: 'STALE_PRIVATE_PUBLISH' \}\);/);
    // The backstop is gated on !privateMessageHasAutoRecoveryPending (via the else branch), so an actively-recovering
    // or under-window send is never falsely terminalized.
    expect(metaFn).toMatch(/if \(privateMessageHasAutoRecoveryPending\(message\)\) \{[\s\S]*?\} else if \(/);
    // The terminal string maps to the red 'failed' status class.
    expect(app).toMatch(/if \(error\?\.code === 'STALE_PRIVATE_PUBLISH'\) return 'not confirmed: chain lookup expired';/);
  });

  it('PWA-POPOVER-LIGHTBOX-FIT-01: the description popover fits+scrolls; the desktop image lightbox is viewport-bounded', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    // Description popover (.identity-popover) is height-capped to the viewport and scrolls its overflow (a long
    // description was clipped off-screen, unreadable).
    expect(css).toMatch(/\.identity-popover \{[\s\S]*?max-height: calc\(var\(--app-viewport-height, 100dvh\) - 24px\);\s*\n\s*overflow-y: auto;/);
    // Positioning measures the REAL height (no hardcoded 220/280 guess) and lands the whole box on-screen (below the
    // anchor, else above, else clamped), applied to BOTH the channel-about and the "Display as" popovers.
    expect(app).toMatch(/function positionIdentityPopover\(popover, anchor\) \{[\s\S]*?const h = popover\.offsetHeight;[\s\S]*?if \(top \+ h > window\.innerHeight - margin\) \{/);
    expect((app.match(/positionIdentityPopover\(popover, anchor\)/g) ?? []).length).toBeGreaterThanOrEqual(3); // decl-body + 2 call sites (+ async re-position)
    expect(app).not.toMatch(/window\.innerHeight - 220/); // the magic-number clamp is gone
    // Desktop image lightbox: the dialog is bounded to the viewport height (was height:100%, which did not resolve on
    // desktop and let a tall image overflow, bottom clipped).
    expect(css).toMatch(/\.image-lightbox-dialog \{[\s\S]*?height: var\(--app-viewport-height, 100dvh\);/);
    // v746: the viewport must use DEFINITE grid tracks (minmax(0,1fr)) not the implicit auto track. An auto track
    // grows to the img's natural height, so img max-height:100% resolved circularly against that content height and
    // never clamped -> a tall 804x1024 image still overflowed the height-bounded dialog on DESKTOP (a narrow phone hid
    // it because max-width:100% clamped width first). minmax(0,1fr) fills the definite viewport row so max-height:100%
    // finally clamps and a tall image scales to fit (verified in-browser 1024px->708px).
    expect(css).toMatch(/\.image-lightbox-viewport \{[\s\S]*?grid-template-rows: minmax\(0, 1fr\);\s*\n\s*grid-template-columns: minmax\(0, 1fr\);/);
  });

  it('PWA-FEED-IMAGE-FIT-01: a public feed image spans the content width or centers at natural size, never the tiny chat cap', () => {
    const css = readFileSync('web/styles.css', 'utf8');
    const feedImage = css.slice(css.indexOf('.feed-image {'), css.indexOf('.feed-image {') + 900);
    // Owner ask (v747): fill the content column when it is no wider than the image, else center at natural size —
    // never upscaled, never left-stuck. width:auto (no upscale) + max-width:100% (fill the column) + margin-inline:auto
    // (center when narrower). height:auto keeps aspect; a scale-safety max-height bounds a pathological super-tall image.
    expect(feedImage).toMatch(/width: auto;/);
    expect(feedImage).toMatch(/max-width: 100%;/);
    expect(feedImage).toMatch(/margin-inline: auto;/);
    expect(feedImage).toMatch(/height: auto;/);
    expect(feedImage).toMatch(/max-height: 1400px;/);
    // The old 320px chat-bubble cap (var(--message-media-width)) that made feed images tiny is GONE from .feed-image.
    expect(feedImage).not.toMatch(/max-width: var\(--message-media-width\)/);
    // Private chat bubbles keep their own narrow media cap — this change is public-feed only.
    expect(css).toMatch(/--message-media-width: 320px;/);
  });

  it('PWA-PUBLIC-FEED-NEWEST-FIRST-01: the public feed renders newest-FIRST (top), show-older at the bottom, jump-to-newest scrolls up', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const html = readFileSync('web/index.html', 'utf8');
    // Owner ask (v752): newer public posts on TOP, not bottom. renderPublicFeed renders the (newest-N) window
    // REVERSED so the newest article sits first, and the "show older" button is appended AFTER the item loop.
    const render = app.slice(app.indexOf('function renderPublicFeed('), app.indexOf('function renderPublicFeed(') + 5900);
    expect(render).toMatch(/for \(const item of windowItems\.slice\(\)\.reverse\(\)\)/);
    // The show-older button is inserted AFTER the item loop (i.e. at the bottom of the list), not before it.
    expect(render.indexOf('windowItems.slice().reverse()')).toBeLessThan(render.indexOf('buildShowOlderButton(hiddenOlderCount)'));
    // On open (anchorUnread) the feed lands on the newest, which is at the TOP now: scrollTop = 0 (the old
    // scrollPublicToOldestUnread chat-style anchor is gone).
    expect(render).toMatch(/options\.anchorUnread && publicFeed\) \{[\s\S]*?publicFeed\.scrollTop = 0;/);
    expect(app).not.toMatch(/scrollPublicToOldestUnread/);
    // Review fix (missed-coupling): the anchorUnread cap-grow toward the oldest unread is GONE — since we no longer
    // scroll there, growing the window would only bloat the DOM to full history + mark an off-screen post read.
    expect(render).not.toMatch(/publicFeedShownCap = Math\.max\(publicFeedShownCap, allItems\.length - i\)/);
    // Review fix (scroll-ux): a background (non-anchor) re-render preserves the reader's position — the topmost
    // visible article is snapshotted and restored so a new post prepended ABOVE does not shove a scrolled-down
    // reader (iOS/WebKit has no overflow-anchor). At the top (scrollTop 0) it is skipped so new posts just appear.
    expect(render).toMatch(/let scrollAnchor = null;/);
    expect(render).toMatch(/if \(!options\.anchorUnread && publicFeed\.scrollTop > 0\)/);
    expect(render).toMatch(/publicFeed\.scrollTop = Math\.max\(0, publicFeed\.scrollTop \+ \(nodeTop - scrollAnchor\.offset\)\)/);
    // The jump-to-newest button now points UP: it shows once scrolled DOWN from the top, and click scrolls to top.
    expect(app).toMatch(/const awayFromNewest = publicFeed\.scrollTop > 80;/);
    expect(app).toMatch(/publicFeed\?\.scrollTo\?\.\(\{ top: 0, behavior: 'smooth' \}\)/);
    expect(app).not.toMatch(/publicFeed\?\.scrollTo\?\.\(\{ top: publicFeed\.scrollHeight/);
    // The button chrome reflects the up direction + the renamed label key.
    expect(html).toMatch(/id="publicJumpDownButton"[\s\S]*?icon-up[\s\S]*?data-i18n="public\.newest"/);
    expect(I18N_STRINGS.en['public.newest']).toBe('Newest');
    expect(I18N_STRINGS.ru['public.newest']).toBeTruthy();
    expect(I18N_STRINGS.en['public.down']).toBeUndefined(); // key was renamed, not duplicated
  });

  it('PWA-PUBLIC-POST-COLLAPSE-01: long feed/channel posts render clamped with a "Show full post" expander; the detail screen and comments never clamp', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    // Owner ask (v765): long posts collapse to a max height in the FEED and the CHANNEL VIEW with an expand
    // button. Both surfaces render through buildPublicFeedArticle, which wraps title+content in the clamped body.
    const build = app.slice(app.indexOf('function buildPublicFeedArticle('), app.indexOf('function publicFeedItemRenderSignature('));
    expect(build).toMatch(/body\.className = 'feed-post-body';/);
    expect(build).toMatch(/bodyContent\.className = 'feed-post-body-inner';/);
    expect(build).toMatch(/appendPublicItemContent\(bodyContent, item\);/);
    // The clamp machinery is gated on ResizeObserver support (no observer -> no clamp: content must never be cut
    // with no way to reveal it) and skips compact cards. v767: the shared toggle helper wires the button — one
    // button relabeled per state (Show full post <-> Collapse), session state in the expanded Set so rebuilds
    // re-render the current state on every surface.
    expect(build).toMatch(/feedPostClampObserver && !item\.compact\) \{\s*wireClampToggleButton\(article, body, bodyContent, publicFeedExpandedPosts, String\(item\.id\)\);/);
    expect(app).toMatch(/function wireClampToggleButton\(root, body, inner, expandedSet, key\)/);
    const toggle = app.slice(app.indexOf('function wireClampToggleButton('), app.indexOf('// Build one feed <article>'));
    expect(toggle).toMatch(/toggleButton\.textContent = expanded \? t\('public\.collapsePost'\) : t\('public\.showFullPost'\);/);
    expect(toggle).toMatch(/expandedSet\.delete\(key\);[\s\S]*?collapseClampedBody\(root, body\);/);
    expect(toggle).toMatch(/expandedSet\.add\(key\);[\s\S]*?expandClampedBody\(root, body\);/);
    // Expanding/collapsing is ANIMATED (max-height transition via CSSOM, then the clamp drops/re-applies; a
    // timer backstop covers reduced-motion / hidden surfaces where transitionend never fires). Collapse reads
    // the clamp target from the :root var that applies to this root and pulls the card back into view.
    expect(app).toMatch(/function expandClampedBody\(root, body\)/);
    expect(app).toMatch(/function collapseClampedBody\(root, body\)/);
    expect(app).toMatch(/root\.classList\.contains\('shared-post-embed'\) \? '--shared-post-embed-max-height' : '--feed-post-collapsed-max-height'/);
    expect(app).toMatch(/root\.scrollIntoView\(\{ block: 'nearest' \}\);/);
    // v768 regression guard: collapse must PIN the current full height (body.scrollHeight) and turn on the
    // transition BEFORE re-adding the clamp class; adding feed-post-collapsible up front (or reading scrollHeight
    // while it is applied) commits the CLAMPED height as the transition baseline -> the 850->480 change nets to
    // zero and the browser skips the animation ("collapses instantly"). So inside collapseClampedBody the clamp
    // class is re-added ONLY after the inline pin is removed (i.e. in settle), never before the scrollHeight pin.
    const collapseFn = app.slice(app.indexOf('function collapseClampedBody('), app.indexOf('function wireClampToggleButton('));
    // The pin (current full height) is turned into a transition BEFORE the rAF drop to the clamp target...
    expect(collapseFn).toMatch(/body\.style\.maxHeight = `\$\{body\.scrollHeight\}px`;\s*root\.classList\.add\('feed-post-expanding'\);/);
    // ...and the clamp class is re-applied ONLY in settle, AFTER the inline pin is removed — never up front (a
    // classList.add of the clamp before the transition commits the clamped height as the baseline -> no animation).
    expect(collapseFn).toMatch(/body\.style\.removeProperty\('max-height'\);\s*root\.classList\.remove\('feed-post-expanding'\);\s*root\.classList\.add\('feed-post-collapsible', 'feed-post-overflowing'\);/);
    expect(app).toMatch(/body\.style\.removeProperty\('max-height'\);/);
    expect(app).toMatch(/body\.addEventListener\('transitionend', release, \{ once: true \}\);/);
    expect(app).toMatch(/window\.setTimeout\(release, 450\);/);
    expect(css).toMatch(/\.feed-post-expanding > \.feed-post-body \{[^}]*transition: max-height 0\.3s ease;/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.feed-post-expanding > \.feed-post-body \{\s*transition: none;/);
    // ...and the expanded state is part of the render signature, so the OTHER surface's reused article (feed
    // vs channel view render the same item independently) rebuilds expanded too instead of staying collapsed.
    expect(app).toMatch(/publicFeedExpandedPosts\.has\(String\(item\.id\)\) \? 'x' : ''/);
    // The observer watches the UNCLAMPED inner wrapper (the clamped outer box never resizes when a lazy image
    // decodes later) and flags a post only when the clamp actually bites; a near-miss (less than the slack)
    // releases the clamp silently instead of offering a button that reveals a sliver.
    expect(app).toMatch(/const feedPostClampObserver = typeof ResizeObserver === 'function'/);
    expect(app).toMatch(/const clippedHeight = body\.scrollHeight - body\.clientHeight;/);
    expect(app).toMatch(/clippedHeight > FEED_POST_CLAMP_SLACK_PX/);
    // CSS: the clamp height is a :root single-source var; the clamp applies only under .feed-post-collapsible.
    // All rules are DIRECT-CHILD (v766): a shared-post embed nests its own clamp INSIDE a post's clamped body,
    // and a descendant selector would leak the post's clamp onto the embed (and keep clamping an expanded embed).
    expect(css).toMatch(/--feed-post-collapsed-max-height: \d+px;/);
    expect(css).toMatch(/\.feed-post-collapsible > \.feed-post-body \{[^}]*max-height: var\(--feed-post-collapsed-max-height\);[^}]*overflow: hidden;/);
    // The toggle button shows while overflowing (as "Show full post") AND while expanded (as "Collapse").
    expect(css).toMatch(/\.feed-post-overflowing > \.feed-expand-button,\s*\.feed-post-expanded > \.feed-expand-button \{\s*display: block;/);
    // The post DETAIL screen (and its comments) calls appendPublicItemContent directly — no .feed-post-body
    // wrapper — so an opened post always renders in full (the expander is a feed/channel affordance only).
    const detail = app.slice(app.indexOf('function renderPublicPostDetail('), app.indexOf('function openPublicPostDetail('));
    expect(detail).toMatch(/appendPublicItemContent\(post, item\);/);
    expect(detail).not.toMatch(/feed-post-body/);
    // Every locale ships both toggle labels (OPSEC key parity).
    for (const locale of Object.keys(I18N_STRINGS)) {
      const dict = (I18N_STRINGS as Record<string, Record<string, string>>)[locale];
      expect(dict['public.showFullPost']).toBeTruthy();
      expect(dict['public.collapsePost']).toBeTruthy();
    }
  });

  it('PWA-PUBLIC-POST-SHARE-01: a public post shares into My notes / a private contact / the own channel as a SHARE block with a collapsed source-channel embed', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const subs = readFileSync('web/public-channel-subscriptions.mjs', 'utf8');
    const html = readFileSync('web/index.html', 'utf8');
    // Wire: SHARE=8 rides the shared PDC1 container, codec in capsule-part-policy (round-trips pinned by
    // PWA-SHARE-CODEC-01/02); a malformed frame is dropped, never poisons the message (the REPLY/FILE rule).
    expect(app).toMatch(/SHARE: 8,/);
    expect(app).toMatch(/content = encodeShareBlockContent\(block\);/);
    expect(app).toMatch(/const share = decodeShareBlockContent\(content\);\s*if \(share\) blocks\.push\(\{ type: 'share', \.\.\.share \}\);/);
    // Composer: the draft is captured AT SUBMIT (echo/wire/retries byte-identical — the replyDraft contract),
    // threaded through every plan/build/retry path, and the PUBLIC surface reads its OWN draft.
    expect(app).toMatch(/const shareDraft = privateShareDraft \? \{ \.\.\.privateShareDraft \} : null;/);
    expect(app).toMatch(/extras\.shareDraft === undefined \? privateShareDraft : extras\.shareDraft/);
    expect(app).toMatch(/composerBlocksFromDraft\(text, normalizePublicImageAttachments\(attachments\), publicCommentReplyTo, normalizePrivateFileAttachments\(fileAttachments\), publicShareDraft\)/);
    // A share-only draft (no typed text) IS a sendable message: the block builder pushes it even alone, and the
    // private empty-submit early-return lets it through.
    expect(app).toMatch(/if \(shareDraft\?\.entryId && !usedShare\) \{\s*usedShare = true;\s*blocks\.unshift\(\{ type: 'share', \.\.\.shareDraft \}\);/);
    expect(app).toMatch(/!text && attachments\.length === 0 && !privateShareDraft/);
    // ...AND NOTHING MAY QUIETLY UNDO THAT. [OWNER 2026-08-04] Sharing a post into a private chat and typing one
    // character made the attached post vanish and threw the caret to the front of what was typed.
    // reconcileComposerAttachments read "no [post] marker in the text" as "the user cancelled the share" and
    // dropped the draft on the first keystroke; the rebuild that followed moved the caret. It also contradicted
    // the block builder pinned just above, which has always treated a markerless share as a normal leading block.
    // One half of the app called it a legitimate message, the other half deleted it — the half that decides what
    // reaches the wire wins. Cancelling is what the strip's Cancel button is for; a keystroke does not get to
    // discard something the user explicitly attached.
    const reconcileFn = app.slice(app.indexOf('function reconcileComposerAttachments(el) {'), app.indexOf('function composerEditorToggleFormat('));
    expect(reconcileFn.length).toBeGreaterThan(400);
    expect(reconcileFn, 'the share draft is no longer pruned against the marker')
      .not.toMatch(/setPublicShareDraft\(null\)|setPrivateShareDraft\(null\)/);
    expect(reconcileFn, 'images and files still reconcile — only the SHARE stopped').toMatch(/reconcileMarkerArray\(value, imgArr/);
    expect(reconcileFn).toMatch(/reconcileMarkerArray\(value, fileArr/);

    // The [post] marker is positional (like [image]/[file]); cancel strips it with the chip.
    expect(app).toMatch(/\(\\\[post\\\]\)/); // the marker alternative inside COMPOSER_MARKER_RE
    expect(app).toMatch(/function removeShareMarkerForComposer\(textarea\)/);
    // Share gate mirrors the comment gate: chain coordinates required (entryId + 32-byte bodyHash + wallet).
    const payloadFn = app.slice(app.indexOf('function sharePayloadFromPublicItem('), app.indexOf('function truncateUtf8ToShareSnippet('));
    expect(payloadFn).toMatch(/0x\[0-9a-fA-F\]\{64\}/);
    // Targets: own channel + My notes + private contacts (Saved first, contacts by recency — the thread-list order).
    expect(app).toMatch(/function chooseShareTargetOwnChannel\(\)/);
    expect(app).toMatch(/function chooseShareTargetThread\(thread\)/);
    expect(app).toMatch(/openPrivateThreadForWallet\(wallet\)/);
    expect(app).toMatch(/openPublicChannelView\(\{ channelId: own\.id/);
    expect(html).toMatch(/id="sharePostDialog"[\s\S]*?id="sharePostList"/);
    expect(html).toMatch(/id="privateShareContext"[\s\S]*?id="privateShareCancelButton"/);
    expect(html).toMatch(/id="publicShareContext"[\s\S]*?id="publicShareCancelButton"/);
    // Embed: source-channel header resolved by the RECIPIENT (their own resolver; the sender's snapshot label is
    // a fallback only), collapsed with the shared toggle machinery keyed by the shared post's entry id.
    // v767 (owner ask): the snippet LINKIFIES like the original post; v769 renders it through the safe formatting
    // renderer. It rendered INLINE-ONLY inside a <p> until 2026-08-07, when the owner found that a forwarded post
    // showed its headings as literal "#" and "##" while bold worked — a <p> cannot hold the block children the
    // renderer emits, so the container forced the crippled mode. It is a DIV now, exactly like the feed's own body
    // text one function above. Safe for an unverified sender-authored snapshot either way: appendInlineFormatted
    // routes every link through buildExternalLinkAnchor (no live href, activateExternalLink interstitial) and
    // never uses innerHTML.
    const embedFn = app.slice(app.indexOf('function buildSharedPostEmbed('), app.indexOf('function buildPublicFeedArticle('));
    expect(embedFn).toMatch(/resolveWalletChannelDisplay\(wallet\)\?\.name/);
    expect(embedFn).toMatch(/text = document\.createElement\('div'\);/);
    expect(embedFn).toMatch(/appendFormattedMessageText\(text, block\.snippet\);/);
    // Once the original is read the whole body is re-rendered through the feed's own renderer (SHAREREF-08), which
    // keeps the author's block order — so there is no second formatting path here to keep in step.
    expect(embedFn, 'the resolved original renders through the feed renderer').toMatch(/appendPublicItemContent\(real, post, embedDepth \+ 1\);/);
    expect(embedFn).toMatch(/if \(block\.textTruncated\) text\.append\(document\.createTextNode\('…'\)\);/);
    expect(embedFn).toMatch(/wireClampToggleButton\(embed, body, inner, expandedSharedEmbeds, String\(block\.entryId\)\);/);
    // Both display surfaces render the embed (private bubbles + public posts/comments).
    expect(app).toMatch(/bubble\.append\(buildSharedPostEmbed\(block\)\);/);
    // The public renderer threads its nesting depth through, so a repost OF a repost stops fetching after one level.
    expect(app).toMatch(/container\.append\(buildSharedPostEmbed\(block, embedDepth\)\);/);
    // The feed cache round-trip keeps share blocks (normalizeFeedBlocks whitelists them like reply quotes).
    expect(subs).toMatch(/if \(block\.type === 'share'\) \{/);
    expect(subs).toMatch(/textTruncated: block\.textTruncated === true,/);
    // v793 (owner): share modal reordered (Copy to clipboard, then My notes, then own channel, then contacts) + a new
    // Copy-to-clipboard target; My notes uses its pencil icon (setThreadAvatarNode), not the wallet-letter avatar.
    expect(app).toMatch(/function buildShareTargetRow\(\{ label, sublabel, avatarUrl, thread, icon, onChoose \}\)/);
    expect(app).toMatch(/if \(thread\) \{\s*setThreadAvatarNode\(avatar, thread\);/);
    expect(app).toMatch(/\} else if \(icon === 'copy'\) \{[\s\S]*?avatar\.innerHTML = SHARE_COPY_ICON_SVG;/);
    expect(app).toMatch(/function chooseShareCopyToClipboard\(\)/);
    expect(app).toMatch(/copyTextToClipboard\(text\)[\s\S]*?setPublicStatus\(t\('dialog\.shareCopied'\)\)/);
    expect(app).toMatch(/fullText, \/\/ untruncated/); // the copy target uses the untruncated body
    const shareList = app.slice(app.indexOf('function renderSharePostList()'), app.indexOf('function renderSharePostList()') + 1700);
    expect(shareList).toMatch(/label: t\('dialog\.shareCopyToClipboard'\),\s*icon: 'copy',/);
    // order: Copy row -> My notes (Saved, thread icon) -> own channel -> contacts by recency
    expect(shareList).toMatch(/shareCopyToClipboard[\s\S]*?isSavedMessagesThread\(thread\)[\s\S]*?label: t\('chat\.myNotes'\),\s*thread,[\s\S]*?if \(own && ownWallet\)[\s\S]*?const contacts = visible/);
    const shareCss = readFileSync('web/styles.css', 'utf8');
    expect(shareCss).toMatch(/--modal-outline: rgba\(48, 213, 176, 0\.5\);/);
    expect(shareCss).toMatch(/\.recipient-dialog,\s*\.action-dialog,\s*\.docs-dialog,\s*\.install-dialog \{[\s\S]*?border: 1px solid var\(--modal-outline\);/);
    // Every locale ships the share strings (OPSEC key parity) — incl. the v793 copy-to-clipboard trio.
    for (const locale of Object.keys(I18N_STRINGS)) {
      const dict = (I18N_STRINGS as Record<string, Record<string, string>>)[locale];
      for (const key of ['public.share', 'public.sharedPost', 'composer.sharingPost', 'dialog.sharePost', 'dialog.shareToOwnChannel', 'dialog.shareNoTargets', 'dialog.shareCopyToClipboard', 'dialog.shareCopied', 'dialog.shareCopyFailed']) {
        expect(dict[key], `${locale}:${key}`).toBeTruthy();
      }
    }
  });

  it('PWA-CHANNEL-VIEW-01: a channel screen shows one channel\'s posts, previews unfollowed channels via a transient feed source, and never leaks the preview into the main feed', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const html = readFileSync('web/index.html', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    // Owner ask (v753): open a channel and read ONLY its posts. The overlay mirrors post-detail/discovery.
    expect(html).toMatch(/id="publicChannelView"[\s\S]*?id="publicChannelViewBackButton"[\s\S]*?id="publicChannelViewFollowButton"[\s\S]*?id="publicChannelViewBody"/);
    expect(app).toMatch(/function openPublicChannelView\(source = \{\}\)/);
    expect(app).toMatch(/function closePublicChannelView\(options = \{\}\)/);
    expect(app).toMatch(/function renderPublicChannelView\(\)/);
    // The view filters the SAME chronological items by channelId (one data path with the feed, no second store).
    expect(app).toMatch(/item\.channelId === publicChannelViewChannelId && item\.emptyChannel !== true/);
    // NOT-followed channels ride as a TRANSIENT feed source so the standard sync walk fetches the preview...
    expect(app).toMatch(/publicChannelPreviewChannelId && !channels\.some\(\(channel\) => channel\.id === publicChannelPreviewChannelId\)/);
    // ...the preview is EXCLUDED from the main feed render + unread counts until followed...
    expect(app).toMatch(/allItems\.filter\(\(item\) => item\.channelId !== publicChannelPreviewChannelId\)/);
    expect(app).toMatch(/const unread = surfaceItems\.filter\(isUnreadPublicItem\)\.length;/);
    // ...an unregistered wallet is registered UNSUBSCRIBED (not a silent follow), and the open kicks a sync with
    // the same fast-path invalidation the follow flow uses.
    expect(app).toMatch(/channelId = ensurePublicChannelForAuthorWallet\(wallet, \{ activate: false \}\);/);
    const openFn = app.slice(app.indexOf('function openPublicChannelView('), app.indexOf('function openPublicChannelView(') + 4600);
    expect(openFn).toMatch(/invalidatePublicSyncFastPath\(\);/);
    // Review fixes (adversarial, confirmed): (1) the fast-path invalidation is EPOCH-guarded — a walk that was
    // already in flight when a follow/preview invalidated must not re-commit the cursor (else the preview walk
    // fast-paths out and the view shows a permanent false "No posts yet")...
    expect(app).toMatch(/function invalidatePublicSyncFastPath\(\)/);
    expect(app).toMatch(/const invalidationEpochAtStart = publicSyncInvalidationEpoch;/);
    // The shard sync has no cursor to commit; what it must not do is write back a snapshot the user invalidated
    // mid-pass (unfollow / wallet switch), which would resurrect the removed channel's posts.
    expect(app).toMatch(/if \(publicSyncInvalidationEpoch !== invalidationEpochAtStart\) \{/);
    // ...(2) the preview sync's finally is TOKEN-guarded (a previous channel's slow sync must not clear the
    // current channel's loading state)...
    expect(openFn).toMatch(/if \(syncToken !== publicChannelViewOpenToken\) return;/);
    // ...(3) a card-level Unfollow INSIDE the open channel view keeps its posts visible via the preview id (same
    // protocol as the header unfollow)...
    expect(app).toMatch(/if \(publicChannelViewOpen && publicChannelViewChannelId === item\.channelId\) \{\s*publicChannelPreviewChannelId = item\.channelId;/);
    // ...(4) the view rebuild restores the reader's position by ARTICLE ANCHOR, not raw scrollTop (the v752 feed
    // lesson: content prepended above otherwise shoves the reader; WebKit has no overflow-anchor)...
    const renderFn = app.slice(app.indexOf('function renderPublicChannelView('), app.indexOf('function renderPublicChannelView(') + 7200);
    expect(renderFn).toMatch(/scrollAnchor = \{ id: node\.dataset\.itemId, offset: nodeTop \}/);
    expect(renderFn).toMatch(/node\.dataset\.itemId = String\(item\.id\);/);
    // ...(5) posts are NOT marked read while the post detail / discovery is stacked over the view, and (6) the
    // header Back routes through requestNavBack (Telegram BackButton + history sentinel stay consistent).
    expect(renderFn).toMatch(/isPublicViewActive\(\) && !publicPostDetailOpen && !publicDiscoveryOpen && markVisiblePublicFeedRead\(capped\)/);
    expect(app).toMatch(/publicChannelViewBackButton\?\.addEventListener\('click', \(\) => requestNavBack\(\)\);/);
    // Round-2 review fixes: (7) the pending flag is raised BEFORE the first paint (a cold preview channel opens on
    // "Loading posts…", never flashes a false "No posts yet")...
    expect(openFn).toMatch(/publicChannelViewSyncPending = !followed;/);
    // ...and a paint follows the raised flag within the same synchronous open (the flag is set, THEN rendered).
    expect(openFn).toMatch(/publicChannelViewSyncPending = !followed;[\s\S]{0,220}renderPublicChannelView\(\);/);
    // ...(8) the sync walk always reads the preview channel THIS cycle (the F1 budget id-sort could otherwise defer
    // it for cycles on a cold head cache)...
    // The preview channel rides along as a TRANSIENT feed source, and the LIVE shard sync reads exactly that
    // source list — so an unfollowed channel's posts are fetched by the same walk, with no per-cycle read budget
    // to special-case (that budget was a property of the Hub's per-author index round-robin).
    expect(app).toMatch(/const feedChannels = feedSourcePublicChannels\(\);/);
    expect(app).toMatch(/if \(publicChannelPreviewChannelId && !channels\.some\(\(channel\) => channel\.id === publicChannelPreviewChannelId\)\)/);
    // ...(9) a wedged F1 round (wallet switch racing an in-flight walk) self-heals instead of re-reading the full
    // budget every cycle for the rest of the session...
    // ...(10) the FEED's own mark-read is also overlay-guarded (posts arriving while an overlay covers the feed
    // stay unread until actually seen).
    expect(app).toMatch(/isPublicViewActive\(\) && !publicPostDetailOpen && !publicDiscoveryOpen && !publicChannelViewOpen\s*&& markVisiblePublicFeedRead\(windowItems\)/);
    // Round-3/4 review fixes: (11) opening the view closes a floating "Display as" popover (the entry points
    // stopPropagation, so the document click-closer never sees the opening tap) — hoisted ABOVE the same-channel
    // early return, else an author-row tap INSIDE the open view leaves the popover floating...
    expect(openFn).toMatch(/hideIdentityPopover\(\);/);
    expect(openFn.indexOf('hideIdentityPopover();')).toBeLessThan(openFn.indexOf('renderPublicChannelView(); return;'));
    // ...(12) the pre-seeded preview channel is charged against the walk budget exactly ONCE (has(), not own-only,
    // in the headless loop + withHeads).
    // Entry points: feed author NAME/meta block, discovery card NAME + an "Open channel" action, about popover.
    // v754 (owner): the AVATAR is NOT wired — it keeps its v651 tap-to-view lightbox meaning on both surfaces.
    expect(app).toMatch(/openPublicChannelView\(\{ channelId: item\.channelId, authorWallet: item\.authorWallet \}\)/);
    expect(app).toMatch(/openPublicChannelView\(\{ authorWallet: channel\.authorWallet, returnTo: 'discovery' \}\)/);
    expect(app).toMatch(/meta\.addEventListener\('click', openChannel\);/);
    expect(app).not.toMatch(/authorAvatar\.addEventListener\('click', openChannel\)/);
    expect(app).toMatch(/name\.addEventListener\('click', openDiscoveredChannel\);/);
    expect(app).not.toMatch(/head\.addEventListener\('click', openDiscoveredChannel\)/);
    expect(app).toMatch(/openChannelButton\.className = 'discovery-cta-action channel-about-open';/);
    // Back stack: post detail closes FIRST (it stacks on top), then the channel view; Telegram BackButton and the
    // history sentinel both see the channel view as an open overlay.
    expect(app).toMatch(/\|\| publicPane\?\.dataset\?\.channelOpen === 'true';/);
    const nav = app.slice(app.indexOf('function closeNavOverlay('), app.indexOf('function closeNavOverlay(') + 1400);
    expect(nav.indexOf("dataset?.postOpen === 'true'")).toBeGreaterThan(-1);
    expect(nav.indexOf("dataset?.postOpen === 'true'")).toBeLessThan(nav.indexOf("dataset?.channelOpen === 'true'"));
    // CSS: the overlay hides the feed chrome; post detail / discovery stack on top; a FOREIGN channel hides the
    // post composer (own channel keeps it).
    expect(css).toMatch(/\.public-pane\[data-channel-open="true"\] > \.public-channel-view \{\s*display: grid;/);
    expect(css).toMatch(/\.public-pane\[data-post-open="true"\] > \.public-channel-view,\s*\.public-pane\[data-discover-open="true"\] > \.public-channel-view \{\s*display: none;/);
    expect(css).toMatch(/\.public-pane\[data-channel-open="true"\]:not\(\[data-post-open="true"\]\):not\(\[data-channel-own="true"\]\) > \.public-composer \{\s*display: none;/);
    // i18n keys exist (all-locale parity enforced by tests/i18n.test.ts).
    expect(I18N_STRINGS.en['public.openChannel']).toBeTruthy();
    expect(I18N_STRINGS.ru['public.channelPosts']).toBeTruthy();
    expect(I18N_STRINGS.en['public.channelEmpty']).toBeTruthy();
  });

  it('PWA-SAFE-LINK-01: URLs in user text auto-link SAFELY (scheme allowlist, textContent, noopener) and clicking routes through an external-link interstitial', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const html = readFileSync('web/index.html', 'utf8');
    // 1) User message/post text is rendered via appendFormattedMessageText (v769 — the safe formatting renderer,
    //    superseding appendLinkifiedText), NOT a raw textContent assignment, at every user-text render site
    //    (private message block + legacy, public post/comment block + legacy).
    expect(app).toMatch(/appendFormattedMessageText\(text, block\.text\)/);
    expect(app).toMatch(/appendFormattedMessageText\(text, item\.text\)/);
    expect(app).toMatch(/appendFormattedMessageText\(text, message\.text\)/);
    // The old raw assignments for these must be GONE (no user text goes straight to textContent + rendered clickable).
    expect(app).not.toMatch(/text\.textContent = block\.text;/);
    expect(app).not.toMatch(/text\.textContent = message\.text;/);
    // v769: the live inline renderer (appendInlineFormatted, used by appendFormattedMessageText) links ONLY via
    // the interstitial builder — never a live href, never innerHTML — exactly like the appendLinkifiedText path.
    const inlineFn = app.slice(app.indexOf('function appendInlineFormatted('), app.indexOf('function messageTextHasBlockFormatting('));
    expect(inlineFn).toMatch(/const safe = safeExternalUrl\(match\[6\]\);/); // [label](url): url is group 6 (v776: *** shifted groups +1)
    expect(inlineFn).toMatch(/safe \? buildExternalLinkAnchor\(match\[5\], safe\) : document\.createTextNode\(match\[0\]\)/);
    expect(inlineFn).not.toMatch(/innerHTML/);
    expect(inlineFn).not.toMatch(/\.href =/);
    // 2) HARD scheme allowlist: only http:/https: ever become a link; javascript:/data:/etc. are rejected.
    const safeFn = app.slice(app.indexOf('function safeExternalUrl('), app.indexOf('function safeExternalUrl(') + 320);
    expect(safeFn).toMatch(/url\.protocol !== 'https:' && url\.protocol !== 'http:'/);
    // 3) The anchor is built with createElement + textContent (never innerHTML). It carries NO live href/target —
    //    the destination lives in a dataset so a MIDDLE-click (auxclick) or right-click "Open in new tab" cannot
    //    navigate directly and bypass the interstitial (an IP-leak deanonymization vector). role=link + tabIndex
    //    keep it keyboard-reachable.
    const anchorFn = app.slice(app.indexOf('function buildExternalLinkAnchor('), app.indexOf('function buildExternalLinkAnchor(') + 1600);
    expect(anchorFn).toMatch(/anchor\.textContent = displayText;/);
    expect(anchorFn).toMatch(/anchor\.dataset\.externalUrl = safeHref;/);
    expect(anchorFn).not.toMatch(/anchor\.href = safeHref/); // NO live href — that would enable the middle-click bypass
    expect(anchorFn).toMatch(/anchor\.setAttribute\('role', 'link'\)/);
    // 4) EVERY activation path (left click, middle-click auxclick, Enter/Space) preventDefaults and routes through
    //    the interstitial — none navigate directly.
    expect(anchorFn).toMatch(/event\.preventDefault\(\);[\s\S]*activateExternalLink\(safeHref, displayText\)/);
    expect(anchorFn).toMatch(/anchor\.addEventListener\('auxclick', activate\)/);
    expect(anchorFn).toMatch(/anchor\.addEventListener\('keydown'/);
    // 5) The interstitial shows the destination + IP-disclosure warning + a per-domain "don't ask again"; trusted
    //    domains skip the prompt (persisted).
    expect(app).toMatch(/function showExternalLinkConfirm\(safeHref, host, displayText\)/);
    expect(app).toMatch(/ipWarn\.textContent = t\('link\.ipWarning'\)/);
    expect(app).toMatch(/if \(externalLinkDomainTrusted\(host\)\) \{ openExternalUrl\(safeHref\); return; \}/);
    expect(app).toMatch(/function trustExternalDomain\(host\)/);
    // 6) The interstitial strings exist in the dictionaries (all-locale parity is enforced by tests/i18n.test.ts).
    expect(I18N_STRINGS.en['link.confirmTitle']).toBeTruthy();
    expect(I18N_STRINGS.en['link.ipWarning']).toBeTruthy();
    expect(I18N_STRINGS.ru['link.open']).toBeTruthy();

    // 7) v750 — labeled links `[text](url)`: appendLinkifiedText uses the combined tokenizer and links a labeled
    //    form ONLY when the url passes safeExternalUrl (so `[x](javascript:...)` stays literal text), never innerHTML.
    // The linkifier is appendInlineFormatted (it superseded the standalone appendLinkifiedText when message text
    // gained block formatting). It enforces the SAME posture, which is what this guard is really about: a labeled
    // link is built only when its url passes the scheme allowlist, a rejected scheme degrades to the literal typed
    // text, and every anchor is built by buildExternalLinkAnchor (never innerHTML).
    const linkifyFn = app.slice(app.indexOf('function appendInlineFormatted('), app.indexOf('function messageTextHasBlockFormatting('));
    expect(app).toMatch(/const INLINE_FORMAT_RE = \//); // the bold/italic/code | [label](url) | bare-url tokenizer
    expect(linkifyFn).toMatch(/const safe = safeExternalUrl\(match\[6\]\);/); // labeled: url is group 6
    expect(linkifyFn).toMatch(/parent\.append\(safe \? buildExternalLinkAnchor\(match\[5\], safe\) : document\.createTextNode\(match\[0\]\)\)/);
    expect(linkifyFn).toMatch(/const trimmed = trimTrailingUrlPunctuation\(match\[7\]\);/); // bare: url is group 7
    // v750 review fix: the composer markers carry a `(?!\()` lookahead so a labeled link [check](url) / [image 1](url)
    // whose TEXT is a marker word ("check"/"payment"/"image N") is NOT mis-eaten as a composer marker on send.
    expect(app).toMatch(/const COMPOSER_MARKER_RE = [^\n]*\(\?!\\\(\)/);
    // (COMPOSER_MARKER_RE above is the COMBINED tokenizer that superseded the three per-marker regexes; the
    // lookahead lives on every alternative inside it, which is what actually protects a labeled link on send.)
    // 8) v750 anti-phishing: a labeled link whose visible text differs from the destination shows a "shown as" line.
    expect(app).toMatch(/const isLabeled = typeof displayText === 'string' && displayText\.length > 0 && displayText !== safeHref;/);
    expect(app).toMatch(/shownAs\.textContent = t\('link\.shownAs', \{ text: displayText \}\)/);
    // 9) v750 composer "Insert link": a dialog inserts [text](url) markup, url scheme-checked before insert; both
    //    composers have the button. No hand-crafting markup.
    expect(app).toMatch(/function openLinkComposerDialog\(targetInput, editChip = null\)/);
    const linkDlg = app.slice(app.indexOf('function openLinkComposerDialog('), app.indexOf('function openLinkComposerDialog(') + 5600);
    expect(linkDlg).toMatch(/const safe = safeExternalUrl\(raw\);/);
    // v778: always a labeled [display](url) so the editor renders it as a link chip; label defaults to the url.
    expect(linkDlg).toMatch(/const display = label \|\| safe;\s*const markup = `\[\$\{display\}\]\(\$\{encodedUrl\}\)`;/);
    // v780: a SELECTED word pre-fills the link-text field (sanitized), and focus jumps to the URL field when prefilled.
    expect(linkDlg).toMatch(/const selectedText = savedRange && !savedRange\.collapsed \? savedRange\.toString\(\)\.replace\(\/\[\[\\\]\\n\]\/g, ' '\)\.trim\(\)\.slice\(0, 200\) : '';/);
    expect(linkDlg).toMatch(/if \(selectedText\) \{ textInput\.value = selectedText; prefilledText = true; \}/);
    expect(linkDlg).toMatch(/\(prefilledText \? urlInput : textInput\)\.focus\(\);/);
    // v780: composerEditorInsertLinkBlock REPLACES a selection with the link (deleteContents), then ALWAYS lifts the
    // caret OUT of any enclosing fmt span (escape) + prunes the emptied span — else a link on a bold/italic word
    // serializes to a DEAD `**[label](url)**` (recipient renders literal bold text) or a stray `****`.
    const insLink = app.slice(app.indexOf('function composerEditorInsertLinkBlock('), app.indexOf('function composerEditorInsertLinkBlock(') + 1400);
    expect(insLink).toMatch(/const hadSelection = sel && sel\.rangeCount && !sel\.isCollapsed;/);
    // selection replaced -> deleteContents then SPLIT the fmt span at the caret so the link lands at the selection
    // point (word order preserved for a non-trailing partial selection); bare caret -> escape after the whole word.
    expect(insLink).toMatch(/sel\.getRangeAt\(0\)\.deleteContents\(\);[\s\S]*?composerEditorSplitFmtAtCaret\(el\);/);
    expect(insLink).toMatch(/composerEditorEscapeTrailingFmt\(el\);/);
    expect(insLink).toMatch(/range\.insertNode\(block\);[\s\S]*?composerEditorPruneEmptyFmt\(el\);/);
    expect(app).toMatch(/function composerEditorSplitFmtAtCaret\(el\) \{/);
    expect(app).toMatch(/const afterFrag = tail\.extractContents\(\);/);
    expect(app).toMatch(/function composerEditorPruneEmptyFmt\(el\) \{/);
    expect(app).toMatch(/span\.textContent === '' && !span\.querySelector\('br, \[data-marker\]'\)\) span\.remove\(\);/);
    // v778: the dialog captures the editor caret BEFORE it steals focus (savedRange) and inserts a LINK CHIP at it —
    // not raw markdown at the start. The link renders live (composer-block-link) and round-trips via EDITOR_INLINE_RE.
    expect(linkDlg).toMatch(/targetInput\.contains\(r\.commonAncestorContainer\)\) return r\.cloneRange\(\)/);
    expect(linkDlg).toMatch(/composerEditorInsertLinkBlock\(targetInput, markup, display, savedRange\)/);
    expect(app).toMatch(/function buildComposerLinkBlock\(markup, label\)/);
    expect(app).toMatch(/function composerEditorInsertLinkBlock\(el, markup, label, savedRange\)/);
    expect(app).toMatch(/else \{ target\.append\(buildComposerLinkBlock\(`\[\$\{match\[6\]\}\]\(\$\{match\[7\]\}\)`, match\[6\]\)\); \}/);
    expect(readFileSync('web/styles.css', 'utf8')).toMatch(/\.composer-block-link \{[\s\S]*?display: inline-block;[\s\S]*?vertical-align: baseline;[\s\S]*?text-decoration: underline;/); // v779 baseline; v783 inline-block for atomic mouse selection
    expect(app).toMatch(/#privateLinkButton'\)\?\.addEventListener\('click'/);
    expect(app).toMatch(/#publicLinkButton'\)\?\.addEventListener\('click'/);
    expect(html).toMatch(/id="privateLinkButton"/);
    expect(html).toMatch(/id="publicLinkButton"/);
    expect(I18N_STRINGS.en['composer.insertLink']).toBeTruthy();
    expect(I18N_STRINGS.ru['composer.link']).toBeTruthy();
  });

  it('PWA-PUBLIC-COMPOSER-MENU-01: the public composer moves image/file/link into the formatting toolbar (no payment check), with public file attachments', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const html = readFileSync('web/index.html', 'utf8');
    // v769: the "+" add-menu is gone — the public formatting toolbar holds Image / File / Link (payment checks
    // stay private-only). The toolbar buttons keep their ids so the existing handlers still find them.
    expect(html).not.toMatch(/id="publicComposerAddButton"/);
    const pubToolbar = html.slice(html.indexOf('id="publicComposerToolbar"'), html.indexOf('id="publicComposerToolbar"') + 4200);
    expect(pubToolbar).toMatch(/id="publicImageButton"/);
    expect(pubToolbar).toMatch(/id="publicFileButton"/);
    expect(pubToolbar).toMatch(/id="publicLinkButton"/);
    expect(pubToolbar).toMatch(/id="publicEmojiButton"/);
    expect(pubToolbar).not.toMatch(/paymentCheckButton/); // no payment checks in public
    expect(html).toMatch(/id="publicFileInput"/);
    expect(html).toMatch(/id="publicFilePanel"/);
    // Public FILE attachments ride the same FILE document block + publish path as private, threaded as a PARAM so the
    // capture-at-submit (before the composer clears) is not dropped by an already-cleared global.
    expect(app).toMatch(/function publicDocumentBlocksFromDraft\(text, attachments = publicImageAttachments, fileAttachments = publicFileAttachments\)/);
    expect(app).toMatch(/const fileAttachments = normalizePrivateFileAttachments\(publicFileAttachments\);.*captured BEFORE the clear/);
    // Both public submits ride the shared outgoing-publish queue (see tests/private-send-serial-lane.test.ts): a
    // burst of posts overlapped exactly like a burst of messages and buried the RPC pump the same way.
    expect(app).toMatch(/await enqueueOutgoingPublish\(\(\) => submitPublicPostDirect\(\{\s*\n\s*text,\s*\n\s*attachments,\s*\n\s*fileAttachments,/);
    expect(app).toMatch(/await enqueueOutgoingPublish\(\(\) => submitPublicCommentDirect\(draftCommentTarget, text, attachments, fileAttachments\)\)/);
    // The toolbar is wired (▼ hide + delegated format buttons + open-on-field-click).
    expect(app).toMatch(/setupComposerToolbar\(publicComposerToolbar, publicMessageInput, publicToolbarHide\)/);
    expect(I18N_STRINGS.en['composer.formatBar']).toBeTruthy();
  });

  it('PWA-COMPOSER-FORMAT-01: a slide-out formatting toolbar (both composers) inserts safe markdown that renders via a textContent-only formatter, with a live preview', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const html = readFileSync('web/index.html', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');

    // SAFE renderer: inline (bold/italic/code/link) + block (heading/quote/list) + a paragraph alignment prefix.
    // XSS posture: createElement + textContent ONLY, never innerHTML; links via the interstitial builder.
    const inlineFn = app.slice(app.indexOf('function appendInlineFormatted('), app.indexOf('function messageTextHasBlockFormatting('));
    // v776: ***bold+italic*** -> nested <strong><em> (match[1]); then **bold** (2), *italic* (3), `code` (4), link (5/6).
    expect(inlineFn).toMatch(/const strong = document\.createElement\('strong'\);\s*const em = document\.createElement\('em'\);\s*em\.textContent = match\[1\];/);
    expect(inlineFn).toMatch(/const el = document\.createElement\('strong'\);\s*el\.textContent = match\[2\];/);
    expect(inlineFn).toMatch(/const el = document\.createElement\('em'\);\s*el\.textContent = match\[3\];/);
    expect(inlineFn).toMatch(/buildExternalLinkAnchor\(match\[5\], safe\)/);
    expect(app).toMatch(/const INLINE_FORMAT_RE = \/\\\*\\\*\\\*\(\[\^\*\\n\]\+\)\\\*\\\*\\\*\|/); // *** alternative is FIRST
    expect(inlineFn).not.toMatch(/innerHTML/);
    const blockFn = app.slice(app.indexOf('function appendFormattedMessageText('), app.indexOf('function appendFormattedMessageText(') + 3200);
    expect(blockFn).toMatch(/if \(!messageTextHasBlockFormatting\(str\)\)/); // inline fast path
    // NO "inline only" ESCAPE HATCH. It existed for the shared-post embed, whose text lived in a <p> that cannot
    // legally hold these block children — and it made "#"/"##" render as literal characters in a forwarded post
    // while bold worked (owner, 2026-08-07). Every body-text container is a DIV now, so nothing needs it, and an
    // unused switch on a shared renderer is how that bug returns.
    expect(app, 'the inline-only mode must stay gone').not.toMatch(/inlineOnly: true/);
    expect(blockFn).toMatch(/msg-heading/);
    expect(blockFn).toMatch(/document\.createElement\('blockquote'\)/);
    expect(blockFn).toMatch(/document\.createElement\(ordered \? 'ol' : 'ul'\)/);
    expect(blockFn).toMatch(/msg-align-\$\{align\}/);
    expect(blockFn).not.toMatch(/innerHTML/);
    // Block-marker regexes.
    expect(app).toMatch(/const MSG_HEADING_RE = \/\^\(#\{1,3\}\)/);
    expect(app).toMatch(/const MSG_QUOTE_RE = /);
    expect(app).toMatch(/const MSG_ALIGN_RE = \/\^::\(center\|justify\)/);
    // The 5 message render sites go through the formatter (private bubble + legacy, public post/comment + legacy,
    // shared-post embed). Covered by count.
    expect(app.match(/appendFormattedMessageText\(/g)?.length ?? 0).toBeGreaterThanOrEqual(6);

    // Toolbar markup (both composers): emoji FIRST (v770), then the format + attachment buttons + ▼ hide. v770
    // trimmed heading/quote/center/justify (didn't fit one row) — those must NOT be present as buttons.
    for (const bar of ['privateComposerToolbar', 'publicComposerToolbar']) {
      const slice = html.slice(html.indexOf(`id="${bar}"`), html.indexOf(`id="${bar}"`) + 4200);
      // v774: a Select-word button (right after emoji). v830: Heading is BACK, by owner request — v770 had trimmed
      // it for ROW WIDTH ("didn't fit one row"), which was a layout call and not a correctness one, and the row is
      // a horizontal scroller anyway. It is the only block-level format the composer offers.
      for (const fmt of ['bold', 'italic', 'select', 'heading']) {
        expect(slice, `${bar}:${fmt}`).toMatch(new RegExp(`data-format="${fmt}"`));
      }
      // v773 removed preview; v775 removed the list button (just prefixed "- ", easier by hand); quote/align stay gone.
      for (const gone of ['list', 'preview', 'quote', 'center', 'justify']) {
        expect(slice, `${bar}:${gone}-removed`).not.toMatch(new RegExp(`data-format="${gone}"`));
      }
      // Emoji is the first toolbar button, immediately followed by the Select-word button (owner: 'сразу после смайлов').
      expect(slice).toMatch(/composer-toolbar-scroll">\s*<button class="composer-toolbar-button emoji-button"[\s\S]*?<\/button>\s*<button class="composer-toolbar-button" data-format="select"/);
      // v774: a ↕ dock button (flips the toolbar above/below the input) sits next to the ▼ hide button.
      expect(slice).toMatch(/class="composer-toolbar-dock"[\s\S]*?class="composer-toolbar-hide"/);
    }
    // The input row keeps ONLY the leading control + textarea + send.
    expect(html).toMatch(/class="composer-input-row">\s*<button class="icon-button private-anonymous-button"/);

    // Format logic (v771 WYSIWYG): applyComposerFormat is editor-only — live class-span formatting via the
    // composerEditor* Range ops. The legacy textarea helpers (wrapComposerSelection/prefixComposerLines) and the
    // heading/quote/center/justify/alignment cases are GONE (the RENDERER still parses those for received messages
    // — appendFormattedMessageText below — but no composer inserts them).
    expect(app).not.toMatch(/function wrapComposerSelection\(/);
    expect(app).not.toMatch(/function prefixComposerLines\(/);
    expect(app).not.toMatch(/function setComposerAlignment\(/);
    const applyFn = app.slice(app.indexOf('function applyComposerFormat('), app.indexOf('function applyComposerFormat(') + 500);
    expect(applyFn).toMatch(/case 'bold': composerEditorToggleFormat\(editor, 'fmt-bold'\)/);
    expect(applyFn).toMatch(/case 'italic': composerEditorToggleFormat\(editor, 'fmt-italic'\)/);
    expect(applyFn).not.toMatch(/case 'list'|composerEditorInsertAtLineStart/); // v775: list button removed
    expect(applyFn).toMatch(/case 'select': composerEditorSelectWordAtCaret\(editor\)/); // v774
    expect(applyFn).not.toMatch(/wrapComposerSelection|prefixComposerLines|openComposerPreview/);
    expect(applyFn).not.toMatch(/case 'center'/);
    // Driver: open on a deliberate field CLICK (not focus/typing), ▼ hides, mousedown keeps the selection.
    const setupFn = app.slice(app.indexOf('function setupComposerToolbar('), app.indexOf('function setupComposerToolbar(') + 1300);
    expect(setupFn).toMatch(/textarea\.addEventListener\('click', \(\) => showComposerToolbar\(textarea\)\)/);
    expect(setupFn).toMatch(/hideButton\?\.addEventListener\('click', \(\) => hideComposerToolbar\(textarea\)\)/);
    expect(setupFn).toMatch(/toolbar\.addEventListener\('mousedown'/);
    expect(css).toMatch(/\.composer-toolbar \{[\s\S]*?max-height: 0;[\s\S]*?opacity: 0;/);
    expect(css).toMatch(/\.composer-toolbar\.is-open \{[\s\S]*?opacity: 1;/);

    // v773: the preview modal + its code are REMOVED (the WYSIWYG editor renders the real content live).
    expect(html).not.toMatch(/id="composerPreviewDialog"/);
    expect(app).not.toMatch(/function openComposerPreview\(|function renderComposerPreviewBlocks\(/);

    // Every locale ships the ACTIVE toolbar strings (OPSEC key parity). The quote/align/preview keys stay in the
    // dictionaries as reserved (their buttons were trimmed/removed) — parity is unaffected. formatHeading was one
    // of those reserved keys and is now ACTIVE again, so it moves into this list: the strings shipped in all ten
    // locales since v769, which is why re-adding the button needed no translation work.
    for (const locale of Object.keys(I18N_STRINGS)) {
      const dict = (I18N_STRINGS as Record<string, Record<string, string>>)[locale];
      for (const key of ['composer.formatBold', 'composer.formatItalic', 'composer.formatHeading', 'composer.hideFormatBar']) {
        expect(dict[key], `${locale}:${key}`).toBeTruthy();
      }
    }
  });

  it('PWA-COMPOSER-WYSIWYG-01: both composers are contenteditable editors that serialize to the same markdown+marker string, with sanitized paste and no execCommand/innerHTML', () => {
    const html = readFileSync('web/index.html', 'utf8');
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    const sw = readFileSync('web/sw.js', 'utf8');

    // Both inputs are contenteditable .composer-input divs now — NOT <textarea>. role/aria keep them a11y-textboxes.
    expect(html).toMatch(/<div id="messageInput" class="composer-input is-empty" contenteditable="true" role="textbox" aria-multiline="true"[^>]*placeholder="Wallet required"/);
    expect(html).toMatch(/<div id="publicMessageInput" class="composer-input is-empty" contenteditable="true" role="textbox" aria-multiline="true"[^>]*placeholder="Public message"/);
    expect(html).not.toMatch(/<textarea id="messageInput"/);
    expect(html).not.toMatch(/<textarea id="publicMessageInput"/);
    expect(app).toMatch(/initComposerEditor\(messageInput\)/);
    expect(app).toMatch(/initComposerEditor\(publicMessageInput\)/);

    // Editor core: DOM<->string serializer pair.
    expect(app).toMatch(/function serializeComposerEditor\(el, keepTrailingBr = false\)/);
    expect(app).toMatch(/function buildComposerEditorDom\(el, text\)/);
    expect(app).toMatch(/function initComposerEditor\(el\)/);
    // The .value / .disabled / .placeholder accessor shims keep the whole textarea-era send pipeline working.
    const initFn = app.slice(app.indexOf('function initComposerEditor('), app.indexOf('function initComposerEditor(') + 1600);
    expect(initFn).toMatch(/Object\.defineProperty\(el, 'value', \{[\s\S]*?get\(\) \{ return serializeComposerEditor\(this\); \}/);
    expect(initFn).toMatch(/Object\.defineProperty\(el, 'disabled', \{/);
    expect(initFn).toMatch(/Object\.defineProperty\(el, 'placeholder', \{/);
    expect(initFn).toMatch(/this\.contentEditable = disabledFlag \? 'false' : 'true'/);

    // Caret ops (Range-based) exist and the marker/emoji dispatchers delegate to them (legacy textarea paths gone).
    for (const fn of ['composerEditorToggleFormat', 'composerEditorInsertChip', 'composerEditorInsertLineBreak', 'composerEditorInsertText', 'composerEditorInsertPlainMultiline']) {
      expect(app, fn).toMatch(new RegExp(`function ${fn}\\(`));
    }
    expect(app).not.toMatch(/function isComposerEditor\(/);
    expect(app).not.toMatch(/function autoResizeComposerTextarea\(/);
    expect(app).toMatch(/function insertComposerMarker\(editor, marker\) \{[\s\S]*?composerEditorInsertChip\(editor, marker\);/);
    expect(app).toMatch(/function insertEmojiAtCaret\(input, emoji\) \{[\s\S]*?composerEditorInsertText\(input, emoji\);/);
    // Bold/italic wrap in CLASS spans (prod CSP style-src 'self' — never inline styles, never execCommand).
    expect(app).toMatch(/span\.className = className;/);
    expect(app).not.toMatch(/execCommand\((['"])(bold|italic|insertHTML|formatBlock|styleWithCSS)/i);
    expect(app).not.toMatch(/styleWithCSS/);

    // Paste/drop are sanitized to text/plain on BOTH composers (the clipboard-HTML XSS surface never enters the DOM).
    for (const input of ['messageInput', 'publicMessageInput']) {
      const paste = app.slice(app.indexOf(`${input}?.addEventListener('paste'`), app.indexOf(`${input}?.addEventListener('paste'`) + 400);
      expect(paste, `${input}:paste`).toMatch(/event\.preventDefault\(\)/);
      expect(paste, `${input}:paste`).toMatch(/getData\('text\/plain'\)/);
      expect(paste, `${input}:paste`).not.toMatch(/text\/html/);
    }
    // buildComposerEditorDom builds via createElement/textContent only — no innerHTML anywhere in the editor build.
    const buildFn = app.slice(app.indexOf('function appendEditorInline('), app.indexOf('function buildComposerEditorDom(') + 400);
    expect(buildFn).not.toMatch(/innerHTML/);
    expect(buildFn).toMatch(/document\.createElement\('span'\)/);
    expect(buildFn).toMatch(/\.textContent = /);
    // v776: ***bold+italic*** round-trips — EDITOR_INLINE_RE has the *** alternative first, and appendEditorInline
    // builds a NESTED fmt-bold > fmt-italic for match[1] (else a rebuild/receive shows literal `*` around bold).
    expect(app).toMatch(/const EDITOR_INLINE_RE = \/\\\*\\\*\\\*\(\[\^\*\\n\]\+\)\\\*\\\*\\\*\|/);
    expect(buildFn).toMatch(/if \(match\[1\] !== undefined\) \{ \/\/ \*\*\*bold\+italic\*\*\*[\s\S]*?b\.className = 'fmt-bold'[\s\S]*?i\.className = 'fmt-italic'[\s\S]*?b\.append\(i\)/);

    // keydown handles Ctrl/Cmd+Enter = send (IME-guarded); newline + the bleed guard live in a shared BEFOREINPUT
    // handler so Android soft-keyboard Enter (keyCode 229, key!=='Enter') still lands a clean <br>.
    for (const input of ['messageInput', 'publicMessageInput']) {
      const keydown = app.slice(app.indexOf(`${input}?.addEventListener('keydown'`), app.indexOf(`${input}?.addEventListener('keydown'`) + 240);
      expect(keydown, `${input}:ime`).toMatch(/if \(event\.isComposing\) return;/);
      expect(keydown, `${input}:send`).toMatch(/event\.key === 'Enter' && \(event\.ctrlKey \|\| event\.metaKey\)/);
      expect(keydown, `${input}:no-linebreak-in-keydown`).not.toMatch(/composerEditorInsertLineBreak\(/);
      expect(app, `${input}:beforeinput`).toMatch(new RegExp(`${input}\\?\\.addEventListener\\('beforeinput', \\(event\\) => composerEditorBeforeInput\\(${input}, event\\)\\)`));
    }
    // Shared beforeinput: newline via insertParagraph/insertLineBreak + a format-bleed guard on insertText.
    const beforeFn = app.slice(app.indexOf('function composerEditorBeforeInput('), app.indexOf('function composerEditorBeforeInput(') + 2300);
    expect(beforeFn).toMatch(/inputType === 'insertParagraph' \|\| event\.inputType === 'insertLineBreak'/);
    expect(beforeFn).toMatch(/composerEditorInsertLineBreak\(el\)/);
    expect(beforeFn).toMatch(/inputType === 'insertText'/);
    expect(beforeFn).toMatch(/composerEditorTrailingFmtSpan\(sel\.getRangeAt\(0\), el\)/);
    // Toggle-OFF a format over PART of a run splits the run (three-way), it does not clear the whole span.
    const toggleFn = app.slice(app.indexOf('function composerEditorToggleFormat('), app.indexOf('function composerEditorToggleFormat(') + 9500);
    expect(toggleFn).toMatch(/three-way split/);
    expect(toggleFn).toMatch(/const mid = spanText\.slice\(startOff, endOff\)/);
    // A collapsed caret + a format button acts on the WHOLE word under the caret (mobile: tap word + B).
    // v785: the word detector is SPAN-AWARE — it walks the inline text-node run across .fmt-* boundaries (a TreeWalker
    // that SKIPs fmt spans = transparent, but stops at <br>/atoms) so a PARTIALLY-bold word (`**he**llo`) is treated as
    // ONE word. It returns node/offset endpoints (start/end may be in DIFFERENT text nodes) + caretInWord.
    expect(app).toMatch(/function composerEditorWordRangeAtCaret\(range, el\)/);
    const wordFn = app.slice(app.indexOf('function composerEditorWordRangeAtCaret('), app.indexOf('function composerEditorWordRangeAtCaret(') + 4200);
    expect(wordFn).toMatch(/createTreeWalker\(root, NodeFilter\.SHOW_TEXT \| NodeFilter\.SHOW_ELEMENT/);
    // Hard word boundaries mirror serializeComposerEditor's NEWLINE set (BR + DIV/P block wrappers) + atom chips, so a
    // toggle never spans a block boundary and serializes `**foo\nbar**` (a newline trapped in bold -> literal ** for the
    // recipient). DIV/P added in the v785 2nd-review fix.
    expect(wordFn).toMatch(/n\.nodeName === 'BR' \|\| n\.nodeName === 'DIV' \|\| n\.nodeName === 'P' \|\| \(n\.dataset && n\.dataset\.marker\)/);
    // v785 (review fix): FILTER_ACCEPT on the atom element does NOT prune its subtree, so a text node INSIDE an atom
    // chip (the chip's own label) is REJECTED — else a word abutting a chip merges the label into the word run
    // (select-word anchors inside the contenteditable=false chip; Bold/Italic no-ops as the range intersects the atom).
    expect(wordFn).toMatch(/n\.parentElement && n\.parentElement\.closest\('\[data-marker\]'\)\) \? NodeFilter\.FILTER_REJECT : NodeFilter\.FILTER_ACCEPT/);
    expect(wordFn).toMatch(/return \{\s*startNode: startPos\.node, startOffset: startPos\.local,\s*endNode: lastPos\.node, endOffset: lastPos\.local \+ 1,\s*caretInWord: caretGlobal - s,/);
    expect(toggleFn).toMatch(/if \(range\.collapsed\) \{[\s\S]*?composerEditorWordRangeAtCaret\(range, el\)/);
    expect(toggleFn).toMatch(/range\.setStart\(word\.startNode, word\.startOffset\);\s*range\.setEnd\(word\.endNode, word\.endOffset\)/);
    // Toggling a partially-formatted word splits the old span (extractContents) and can leave an EMPTY .fmt-* span
    // behind, which serializes to a stray `****`; the toggle prunes it (and normalizes flattened text so caret-restore
    // by offset lands exactly). Both callers (toggle + select-word) consume the new node/offset return shape.
    expect(toggleFn).toMatch(/span\.normalize\(\); \/\/ merge the adjacent text nodes/);
    expect(toggleFn).toMatch(/composerEditorPruneEmptyFmt\(el\);\s*composerEditorAfterEdit\(el\);/);
    expect(app).toMatch(/const word = composerEditorWordRangeAtCaret\(range, el\);[\s\S]*?r\.setStart\(word\.startNode, word\.startOffset\);\s*r\.setEnd\(word\.endNode, word\.endOffset\)/); // select-word caller

    // CSS for the editor: sizing/placeholder/format spans/blocks.
    expect(css).toMatch(/\.composer \.composer-input \{\s*position: relative;[\s\S]*?min-height: 44px;[\s\S]*?white-space: pre-wrap;/); // v780: relative anchors the absolute placeholder
    // v780: the placeholder is absolutely positioned (out of the inline flow) so the caret in the empty editor sits at
    // offset 0, NOT after the placeholder text (an inline ::before is generated content that precedes offset 0).
    expect(css).toMatch(/\.composer \.composer-input\.is-empty::before \{[\s\S]*?content: attr\(placeholder\);[\s\S]*?position: absolute;/);
    expect(css).toMatch(/\.composer \.composer-input \.fmt-bold \{ font-weight: 700; \}/);
    // v773: marker atoms render REAL content — the image capped + inner display-only (pointer-events off).
    expect(css).toMatch(/\.composer \.composer-input \.composer-block \{/);
    expect(css).toMatch(/\.composer \.composer-input \.composer-block > \* \{\s*pointer-events: none;/);
    expect(css).toMatch(/\.composer \.composer-input \.composer-block-image \{[\s\S]*?max-height: 200px;/);

    // Rich atoms (v773): buildComposerBlock resolves a marker to its real image/file/payment/share, atomic +
    // contenteditable=false + data-marker (so serialize round-trips), pill fallback for an orphan marker.
    expect(app).toMatch(/function buildComposerBlock\(marker, el\)/);
    expect(app).toMatch(/function composerBlockInner\(marker, ctx\)/);
    expect(app).toMatch(/function composerBlockContextForEditor\(el\)/);
    const blockFn = app.slice(app.indexOf('function buildComposerBlock('), app.indexOf('function buildComposerBlock(') + 700);
    expect(blockFn).toMatch(/block\.contentEditable = 'false';/);
    expect(blockFn).toMatch(/block\.dataset\.marker = String\(marker\);/);
    const innerFn = app.slice(app.indexOf('function composerBlockInner('), app.indexOf('function composerBlockInner(') + 1500);
    expect(innerFn).toMatch(/img\.src = bytesToImageDataUrl\(att\.bytes, 'image\/webp'\)/);
    expect(innerFn).not.toMatch(/innerHTML/);

    // Backspace/Delete next to a marker atom removes the atom AND its attachment/draft (no orphan gets sent).
    const beforeFn2 = app.slice(app.indexOf('function composerEditorBeforeInput('), app.indexOf('function composerEditorBeforeInput(') + 1400);
    expect(beforeFn2).toMatch(/deleteContentBackward' \|\| event\.inputType === 'deleteContentForward'/);
    expect(beforeFn2).toMatch(/composerEditorAdjacentAtom\(sel\.getRangeAt\(0\), el,/);
    expect(beforeFn2).toMatch(/removeComposerAtom\(el, atom\)/);
    expect(app).toMatch(/function removeComposerAtom\(el, atom\)/);
    expect(app).toMatch(/function removeComposerImageAt\(kind, index\)/);
    // The format-span chip guard keys on [data-marker] (v773 renamed atoms .composer-chip -> .composer-block), so
    // bolding across an attachment stays a no-op (else the serialized ** splits on the marker -> literal ** sent).
    expect(toggleFn).toMatch(/for \(const block of el\.querySelectorAll\('\[data-marker\]'\)\)/);
    // A non-collapsed delete / Ctrl+A / paste-over can drop an atom's node without the collapsed-delete sync, so an
    // input-time reconcile prunes attachments whose marker vanished (else a "deleted" image is still sent).
    expect(app).toMatch(/function reconcileComposerAttachments\(el\)/);
    expect(app).toMatch(/reconcileComposerAttachments\(messageInput\)/);
    expect(app).toMatch(/reconcileComposerAttachments\(publicMessageInput\)/);

    // v774: a word-toggle (tap-in-word + Bold) collapses the caret afterwards (word not left selected); a REAL
    // selection stays selected. Guarded by startedCollapsed in composerEditorToggleFormat.
    expect(toggleFn).toMatch(/const startedCollapsed = range\.collapsed;/);
    expect(toggleFn).toMatch(/if \(startedCollapsed && sel\.rangeCount\) \{[\s\S]*?const r2 = document\.createRange\(\)/);
    // v777/v779: after a word-toggle the caret rests at the SAME offset it was (caretInWord), inside the word's
    // text node — so pressing Bold/Italic AGAIN un-toggles the same word and the caret does not jump to the word
    // end. The toggle does NOT escape the span itself (the leak on the NEXT Enter/attachment is handled at insert).
    expect(toggleFn).toMatch(/caretInWord = word\.caretInWord;/); // v785: the span-aware detector returns the in-word offset
    // v785 (review fix): the (re)formatted word can span MULTIPLE text nodes (Bold OVER a partially-italic word wraps a
    // NESTED fmt span), so the caret restore walks the word's text nodes IN ORDER (range-bounded via intersectsNode) to
    // land at the caretInWord-th char — clamping to the FIRST text node's length alone put the caret a char early.
    expect(toggleFn).toMatch(/acceptNode: \(tn\) => r\.intersectsNode\(tn\) \? NodeFilter\.FILTER_ACCEPT : NodeFilter\.FILTER_SKIP/);
    expect(toggleFn).toMatch(/if \(acc \+ len >= want\) \{ node = tn; off = from \+ \(want - acc\); placed = true; break; \}/);
    expect(toggleFn).not.toMatch(/composerEditorEscapeTrailingFmt/);
    // v774: Select-word button selects the word under the caret (start a selection without the OS menu).
    // v786: it is a TOGGLE — if text is already selected the press DESELECTS (collapses to a caret); a second press
    // re-selects the whole word (the word-range path below). So a partial-word selection isn't a dead button.
    expect(app).toMatch(/function composerEditorSelectWordAtCaret\(el\)/);
    const selectFn = app.slice(app.indexOf('function composerEditorSelectWordAtCaret('), app.indexOf('function composerEditorSelectWordAtCaret(') + 900);
    expect(selectFn).toMatch(/if \(!range\.collapsed\) \{[\s\S]*?range\.collapse\(true\);[\s\S]*?return;\s*\}/);
    // v775: a newline/attachment/word-toggle steps the caret OUT of a trailing .fmt-* span, so bold never swallows
    // a <br>/image atom (which would serialize to unbalanced ** across the marker -> literal ** at the recipient).
    expect(app).toMatch(/function composerEditorEscapeTrailingFmt\(el\)/);
    expect(app).toMatch(/composerEditorEscapeTrailingFmt\(el\); \/\/ never drop an attachment marker/);
    // escape steps out of the OUTERMOST .fmt-* ancestor (nested bold>italic), not just the innermost (else a marker
    // lands inside the still-open bold -> unbalanced ** on send). No `break` on the first fmt match.
    const escFn = app.slice(app.indexOf('function composerEditorEscapeTrailingFmt('), app.indexOf('function composerEditorEscapeTrailingFmt(') + 1500);
    expect(escFn).toMatch(/if \(isFmt\(n\)\) span = n;/);
    expect(escFn).not.toMatch(/if \(isFmt\(n\)\) \{ span = n; break; \}/);
    // v790: DIRECTION — at the span's LEADING edge (nothing before the caret inside it, e.g. Enter at the START of a
    // bold heading) escape to BEFORE the span so the new line/marker lands ABOVE/before the word; else escape AFTER
    // (the old always-after put the Enter's <br> below the bold heading = new line under it instead of over it).
    expect(escFn).toMatch(/const atLeadingEdge = before\.textContent === '' && !before\.querySelector\('br, \[data-marker\]'\);/);
    expect(escFn).toMatch(/if \(atLeadingEdge\) r\.setStartBefore\(span\); else r\.setStartAfter\(span\);/);
    // v793 (owner): MID-word Enter in a bold/italic word SPLITS the span (second half wraps down, still formatted:
    // **сло**\n**во**) instead of jumping the caret to the word end. Leading/trailing edges fall back to escapeTrailingFmt.
    expect(app).toMatch(/function composerEditorSplitFmtForNewlineIfMidWord\(el\)/);
    expect(app).toMatch(/if \(nothingBefore \|\| nothingAfter\) return false;[\s\S]*?composerEditorSplitFmtAtCaret\(el\); \/\/ MID-word/);
    expect(app).toMatch(/if \(!composerEditorSplitFmtForNewlineIfMidWord\(el\)\) composerEditorEscapeTrailingFmt\(el\);/);
    // Toolbar-button :hover is gated behind @media (hover: hover) — on touch, :hover STICKS after a tap so Bold/
    // Italic stayed accent-green after pressing (owner report). No ungated :hover background rule.
    expect(css).toMatch(/@media \(hover: hover\) \{\s*\.composer-toolbar-button:hover:not\(:disabled\) \{/);
    expect(css).not.toMatch(/^\.composer-toolbar-button:hover:not\(:disabled\) \{/m);
    // v775: a multi-attachment list is capped (~3 rows) and scrolls, so it can't eat the whole screen.
    expect(css).toMatch(/\.composer-attachment\.is-list \{[\s\S]*?max-height: 150px;[\s\S]*?overflow-y: auto;/);
    // v774: ↕ dock button flips the toolbar above/below the input, PERSISTED (localStorage), applied on boot.
    expect(app).toMatch(/function applyComposerDockPosition\(\)/);
    expect(app).toMatch(/function toggleComposerDockPosition\(\)/);
    expect(app).toMatch(/localStorage\.setItem\(COMPOSER_DOCK_STORAGE_KEY/);
    expect(app).toMatch(/classList\.toggle\('is-composer-dock-below', composerDockIsBelow\(\)\)/);
    expect(app).toMatch(/#privateToolbarDock'\)\?\.addEventListener\('click', toggleComposerDockPosition\)/);
    expect(css).toMatch(/:root\.is-composer-dock-below \.composer-toolbar \{ order: 2; \}/);
    // v774 i18n keys present in every locale (parity enforced by the i18n test; presence pinned here).
    for (const locale of Object.keys(I18N_STRINGS)) {
      const dict = (I18N_STRINGS as Record<string, Record<string, string>>)[locale];
      expect(dict['composer.dockToolbar'], `${locale}:dock`).toBeTruthy();
      expect(dict['composer.selectWord'], `${locale}:select`).toBeTruthy();
      expect(dict['composer.maximize'], `${locale}:maximize`).toBeTruthy();
      expect(dict['composer.restore'], `${locale}:restore`).toBeTruthy();
      expect(dict['composer.editLink'], `${locale}:editLink`).toBeTruthy();
    }
    // v780: maximize button expands the composer to a full-screen overlay for long posts. Button in BOTH toolbars,
    // toggles .is-maximized on the FORM (CSS overlay, editor DOM untouched), un-maximizes after a send clears.
    expect(html).toMatch(/id="privateToolbarMaximize"[^>]*aria-pressed="false"[^>]*data-i18n-title="composer\.maximize"/);
    expect(html).toMatch(/id="publicToolbarMaximize"[^>]*aria-pressed="false"[^>]*data-i18n-title="composer\.maximize"/);
    expect(app).toMatch(/function toggleComposerMaximize\(form, button\) \{/);
    expect(app).toMatch(/form\.classList\.add\('is-maximized'\);[\s\S]*?composerMaximizeButtonLabel\(button, true\)/);
    expect(app).toMatch(/function exitComposerMaximize\(\) \{/);
    expect(app).toMatch(/#privateToolbarMaximize'\)\?\.addEventListener\('click', \(event\) => toggleComposerMaximize\(document\.getElementById\('composer'\), event\.currentTarget\)\)/);
    expect(app).toMatch(/#publicToolbarMaximize'\)\?\.addEventListener\('click', \(event\) => toggleComposerMaximize\(document\.getElementById\('publicComposer'\), event\.currentTarget\)\)/);
    // un-maximize is wired into BOTH send-clear paths (public + private) AND both navigation-away paths (setView tab
    // switch + closeNavOverlay back), so the full-screen overlay can never strand the user over another view.
    expect((app.match(/exitComposerMaximize\(\)/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(app).toMatch(/function exitComposerMaximize\(\) \{[\s\S]*?return collapsed;/); // returns whether it collapsed
    expect(app).toMatch(/if \(exitComposerMaximize\(\)\) \{\s*syncNavBackAffordance\(\);\s*return true;/); // back consumes the nav
    expect(app).toMatch(/exitComposerMaximize\(\);\s*\/\/ The Wallet tab is DELIBERATELY ungated/); // setView (tab switch) collapse
    // A cancelled public publish (price-change dialog) hands the draft back into the SAME full-screen editor, not the 144px inline one.
    expect(app).toMatch(/const draftWasMaximized = publicComposer\.classList\.contains\('is-maximized'\);/);
    expect(app).toMatch(/if \(draftWasMaximized && !publicComposer\.classList\.contains\('is-maximized'\)\)/);
    // The emoji picker opens DOWNWARD when there is no room above (a top-docked toolbar in the maximized overlay).
    expect(app).toMatch(/if \(rect\.top >= height \+ 8\) \{[\s\S]*?emojiPicker\.style\.bottom = /);
    expect(app).toMatch(/emojiPicker\.style\.bottom = 'auto';\s*emojiPicker\.style\.top = /);
    // CSS overlay: fixed, sized to the UNFLOORED visual-viewport var (keyboard-safe on short viewports), z-index 30.
    expect(css).toMatch(/\.composer\.is-maximized \{[\s\S]*?position: fixed;[\s\S]*?height: var\(--app-viewport-height-exact, var\(--app-viewport-height, 100dvh\)\);[\s\S]*?z-index: 30;/);
    expect(app).toMatch(/setProperty\('--app-viewport-height-exact'/); // the unfloored height var is published
    expect(css).toMatch(/\.composer\.is-maximized \.composer-input-row \{[\s\S]*?flex: 1 1 auto;[\s\S]*?align-items: stretch;/);
    // v789 (owner): the reply/share quote strip must not overflow a narrow screen — the text-holder flex child gets
    // min-width:0 (a flex item defaults to min-width:auto = its nowrap min-content width, which pushed the Cancel button
    // off-edge), and the .composer-reply-text is display:block so text-overflow:ellipsis actually truncates the snippet.
    expect(css).toMatch(/\.composer-context > span \{\s*min-width: 0;\s*\}/);
    expect(css).toMatch(/\.composer-context \.composer-reply-text \{\s*display: block;[\s\S]*?text-overflow: ellipsis;/);
    // v781: distinct diagonal-arrow maximize icon (was a duplicate of the corner-bracket select-word icon); the ?v=2
    // busts the browser/Caddy cache for the same-URL asset whose CONTENT changed.
    expect(css).toMatch(/\.composer\.is-maximized \.composer-toolbar-maximize \.icon \{\s*--mask: url\("\.\/assets\/icons\/collapse\.svg\?v=2"\);/);
    expect(css).toMatch(/\.icon-expand \{ --mask: url\("\.\/assets\/icons\/expand\.svg\?v=2"\); \}/);
    // icons are precached so the offline shell renders the button both ways.
    expect(sw).toMatch(/\.\/assets\/icons\/expand\.svg/);
    expect(sw).toMatch(/\.\/assets\/icons\/collapse\.svg/);

    // v781: a finished link chip is EDITABLE — clicking it re-opens the dialog pre-filled with its label+url and
    // REPLACES the chip in place (openLinkComposerDialog takes an editChip; the marker's %28/%29 are decoded back).
    expect(app).toMatch(/function openLinkComposerDialog\(targetInput, editChip = null\)/);
    expect(app).toMatch(/function composerEditorLinkClick\(el, event\) \{/);
    expect(app).toMatch(/event\.target\?\.closest\?\.\('\.composer-block-link'\)/);
    expect(app).toMatch(/openLinkComposerDialog\(el, chip\)/);
    expect(app).toMatch(/addEventListener\('click', \(event\) => composerEditorLinkClick\((?:messageInput|publicMessageInput), event\)\)/);
    expect(app).toMatch(/editChip\.replaceWith\(newBlock\)/);
    expect(app).toMatch(/editUrl = m\[2\]\.replace\(\/%28\/g, '\('\)\.replace\(\/%29\/g, '\)'\)/);
    expect(app).toMatch(/title\.textContent = t\(editChip \? 'composer\.editLink' : 'composer\.insertLink'\)/);
    expect(css).toMatch(/\.composer-block-link \{[\s\S]*?cursor: pointer;/); // signals the chip is clickable/editable
    // v781: copy/cut serialize the SELECTED fragment to markers so a link/image chip round-trips (the native copy
    // drops a contenteditable=false chip); paste re-renders those markers via appendEditorInline (text/plain only).
    expect(app).toMatch(/function composerEditorCopySelection\(el, event, isCut\) \{/);
    expect(app).toMatch(/wrapper\.appendChild\(range\.cloneContents\(\)\);/);
    expect(app).toMatch(/event\.clipboardData\.setData\('text\/plain', serializeComposerEditor\(wrapper, keepTrailingBr\)\)/);
    expect(app).toMatch(/addEventListener\('copy', \(event\) => composerEditorCopySelection\((?:messageInput|publicMessageInput), event, false\)\)/);
    expect(app).toMatch(/addEventListener\('cut', \(event\) => composerEditorCopySelection\((?:messageInput|publicMessageInput), event, true\)\)/);
    expect(app).toMatch(/function appendEditorInline\(target, text, context = target, renderAttachmentMarkers = true\)/); // paste passes the real editor as marker context
    // Paste escapes the enclosing fmt span ONLY when it yields a link chip (a link inside **…** = dead wire); v796
    // made that conditional (see PWA-COMPOSER-PASTE-IME-01) so plain/marker text inserts at the caret. Attachment
    // markers stay LITERAL text (renderAttachmentMarkers=false) so a pasted [image N] can't phantom-bind the own attachment.
    expect(app).toMatch(/if \(hasLink\) composerEditorEscapeTrailingFmt\(el\);/);
    expect(app).toMatch(/appendEditorInline\(frag, line, el, false\)/);
    expect(app).toMatch(/renderAttachmentMarkers \? buildComposerBlock\(match\[5\], context\) : document\.createTextNode\(match\[5\]\)/);
    // v782: EVERY atom selects ATOMICALLY (user-select:text via contenteditable=false — no 'all' flicker / no
    // right-to-left block) and copy serializes ALL its markers (link + image/file/payment/post); the earlier
    // attachment-marker STRIP was removed. Paste keeps attachment markers literal so a pasted [image N] can't phantom-bind.
    expect(css).toMatch(/\.composer \.composer-input \.composer-block \{[\s\S]*?user-select: text;/);
    expect(app).not.toMatch(/\.test\(atom\.dataset\.marker \|\| ''\)\) atom\.remove\(\)/); // strip removed
    // Cut still prunes an emptied fmt span (no stray ****); the filler <br> isn't dropped from a real selected newline.
    expect(app).toMatch(/composerEditorPruneEmptyFmt\(el\); \/\/ a cut that emptied a fmt span/);
    expect(app).toMatch(/const keepTrailingBr = !\(fillerBr && range\.intersectsNode\(fillerBr\)\);/);
    expect(app).toMatch(/function serializeComposerEditor\(el, keepTrailingBr = false\)/);
    // v783 animations: dock-toggle slides the toolbar (2x slower, 0.48s); maximize/restore FLIP the composer between
    // its inline footprint and full-screen (a JS transform TRANSITION, not a keyframe — the old keyframes are gone).
    expect(css).toMatch(/@keyframes composerDockShift/);
    expect(css).toMatch(/\.composer-toolbar\.is-docking \{ animation: composerDockShift 0\.48s/);
    expect(css).not.toMatch(/@keyframes composerMaximizeIn/); // replaced by the JS FLIP
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.composer-toolbar\.is-docking \{ animation: none;/);
    expect(app).toMatch(/const composerReducedMotion = \(\) =>/);
    // v784: maximize/restore animates REAL geometry (top/left/width/height) — the content re-lays-out, NOT a
    // transform:scale (which squished it + jerked on collapse). No transform is set.
    expect(app).toMatch(/function composerRunMaximizeGeo\(form, growing\)/);
    expect(app).not.toMatch(/const inlineTransform = `translate/); // the transform-scale FLIP is gone
    expect(app).toMatch(/form\.style\.top = `\$\{r\.top\}px`; form\.style\.left = `\$\{r\.left\}px`/); // setGeo
    expect(app).toMatch(/form\.style\.transition = `top 0\.5s \$\{ease\}, left 0\.5s \$\{ease\}, width 0\.5s \$\{ease\}, height 0\.5s \$\{ease\}`/);
    expect(app).toMatch(/form\.__inlineRect = \{ left: r\.left/); // inline footprint captured at maximize time
    expect(app).toMatch(/if \(isMax && isRestoring\) return; \/\/ mid-shrink/);
    // exit/re-toggle CANCEL an in-flight animation so a stale timer/listener can't fire on a changed composer.
    expect(app).toMatch(/function composerCancelMaxFlip\(form\)/);
    expect(app).toMatch(/clearTimeout\(flip\.timer\); form\.removeEventListener\('transitionend', flip\.onEnd\)/);
    expect(app).toMatch(/composerCancelMaxFlip\(form\); \/\/ kill any in-flight/); // exitComposerMaximize
    expect(app).toMatch(/timer: setTimeout\(finish, 700\), onEnd \}/); // fallback
    expect(app).toMatch(/tb\.style\.setProperty\('--dock-shift', shift\)/);
    // v783: the link chip is inline-BLOCK (atomic mouse selection like the atoms), not inline (letter-by-letter).
    expect(css).toMatch(/\.composer \.composer-input \.composer-block-link \{[\s\S]*?display: inline-block;/);
    // v783 review fix: a maximize FLIP transforms the emoji button too, so close the picker on toggle + re-anchor an
    // open one to the button's FINAL rect when the FLIP finishes (else the fixed picker stays where the mid-flight rect put it).
    expect(app).toMatch(/closeEmojiPicker\(\); \/\/ the emoji button is inside the composer/);
    expect(app).toMatch(/if \(emojiPicker && !emojiPicker\.hidden && emojiPickerTargetButton\) positionEmojiPicker\(emojiPickerTargetButton\)/);
    // v785 #1: while maximized the composer is position:fixed (out of flow) — a same-height spacer holds its inline
    // slot so the chat/feed content doesn't jump down on maximize and up on restore. Reserved at maximize, released at
    // the shrink finish / instant collapse / exit.
    expect(app).toMatch(/function composerReserveSpacer\(form, height\)/);
    expect(app).toMatch(/function composerReleaseSpacer\(form\)/);
    expect(app).toMatch(/spacer\.setAttribute\('aria-hidden', 'true'\);[\s\S]*?spacer\.style\.height = `\$\{height\}px`;[\s\S]*?form\.after\(spacer\);\s*form\.__spacer = spacer;/);
    expect(app).toMatch(/composerReserveSpacer\(form, r\.height\); \/\/ hold the inline slot/); // maximize reserves
    expect(app).toMatch(/form\.classList\.remove\('is-maximized', 'is-restoring'\); composerReleaseSpacer\(form\)/); // shrink finish releases
    expect(app).toMatch(/composerCollapseMaximizeNow\(form\) \{[\s\S]*?composerReleaseSpacer\(form\)/); // instant collapse releases
    expect(app).toMatch(/composerCancelMaxFlip\(form\); \/\/ kill any in-flight[\s\S]*?composerReleaseSpacer\(form\)/); // exit releases
    // v788 (owner cosmetic): the app viewport can change between maximize and restore (the keyboard appeared/dismissed),
    // so the inline TOP captured at maximize is stale — the composer would shrink to the OLD slot then JUMP. The spacer
    // rides the layout, so the shrink shifts the captured top by how far the spacer MOVED since maximize (__spacerTop0),
    // using the DELTA (not the spacer's absolute top, which sits at a small structural offset) so a no-change restore
    // stays seamless. __spacerTop0 is captured in the maximized (form-out-of-flow) layout.
    expect(app).toMatch(/form\.__spacerTop0 = form\.__spacer \? form\.__spacer\.getBoundingClientRect\(\)\.top : null;/);
    expect(app).toMatch(/if \(!growing && inlineRect && form\.__spacer && form\.__spacerTop0 != null\) \{\s*const curTop = form\.__spacer\.getBoundingClientRect\(\)\.top;\s*inlineRect = \{ \.\.\.inlineRect, top: inlineRect\.top \+ \(curTop - form\.__spacerTop0\) \};/);
    // v785-v787 #4: maximize/restore must not pop or hide the mobile keyboard. The maximize button joins the toolbar
    // mousedown-preventDefault so a tap never blurs the editor. On maximize we re-focus ONLY when the keyboard was
    // actually UP (composerKeyboardLikelyOpen = visual-viewport shrunk >150px = typing), keeping the keyboard; keyboard
    // DOWN -> nothing (no re-focus of a dismissed keyboard, no maximize-time blur which dropped the desktop caret).
    expect(app).toMatch(/const wasFocused = !!editorEl && document\.activeElement === editorEl;/);
    expect(app).toMatch(/const keyboardWasOpen = composerKeyboardLikelyOpen\(\);/);
    expect(app).toMatch(/if \(wasFocused && keyboardWasOpen && editorEl && document\.activeElement !== editorEl\) editorEl\.focus\(\{ preventScroll: true \}\);/);
    expect(app).not.toMatch(/composerKeyboardEverOpened/); // the sticky latch + maximize-time blur were removed (desktop caret regression)
    const maxFocusFn = app.slice(app.indexOf('function toggleComposerMaximize('), app.indexOf('function toggleComposerMaximize(') + 2200);
    expect(maxFocusFn).not.toMatch(/editorEl\.blur\(\)/); // no forced blur inside maximize/restore itself
    expect(app).toMatch(/function composerKeyboardLikelyOpen\(\)/);
    expect(app).toMatch(/return \(composerViewportMaxHeight - viewport\.height\) > 150;/);
    // v787 (owner): the ROOT-CAUSE fix for the mobile keyboard re-pop — hiding the keyboard with its own button leaves
    // the field FOCUSED (caret) but the keyboard down, and any later geometry change (maximize/restore) makes a touch
    // browser re-show the keyboard for that still-focused editable. composerHandleKeyboardVisibility() (called from
    // syncViewportCssVars on every visual-viewport resize) detects the keyboard's up->down (dismissed) edge and BLURS a
    // focused .composer-input, eliminating the "focused-but-keyboard-hidden" state at the source. Gated on (pointer:
    // coarse) — a real touch device — so a fine-pointer desktop/touch-laptop window resize never drops the caret.
    expect(app).toMatch(/function composerHandleKeyboardVisibility\(\)/);
    expect(app).toMatch(/const nowOpen = composerKeyboardLikelyOpen\(\);\s*if \(composerKeyboardWasOpen && !nowOpen\)/);
    expect(app).toMatch(/matchMedia\('\(pointer: coarse\)'\)\.matches[\s\S]*?active\.classList\.contains\('composer-input'\)\) active\.blur\(\);/);
    expect(app).toMatch(/composerKeyboardWasOpen = nowOpen;/);
    expect(app).toMatch(/composerHandleKeyboardVisibility\(\); \/\/ blur the composer if the soft keyboard was just dismissed/);
    // v787 review fix: the no-keyboard baseline is keyed to the viewport WIDTH — a soft keyboard changes only HEIGHT, but
    // an orientation flip changes WIDTH; without re-baselining on a width change the monotonic max kept the taller PORTRAIT
    // height, so composerKeyboardLikelyOpen() read "open" forever in LANDSCAPE and the hide-blur never fired there.
    expect(app).toMatch(/if \(visualWidth !== composerViewportBaselineWidth\) \{\s*composerViewportMaxHeight = visual; composerViewportBaselineWidth = visualWidth; composerKeyboardWasOpen = false;/);
    const maxFn = app.slice(app.indexOf('function toggleComposerMaximize('), app.indexOf('function toggleComposerMaximize(') + 1800);
    expect(maxFn).not.toMatch(/\.composer-input'\)\?\.focus\?\.\(\)/); // the old forced focus is gone
    expect(app).toMatch(/\.composer-toolbar-button, \.composer-toolbar-hide, \.composer-toolbar-dock, \.composer-toolbar-maximize'\)\) event\.preventDefault\(\)/);
    // v785 #3: the dock toggle FLIPs the composer's NON-toolbar children (the input row + panels) so the input row
    // SLIDES to its new position instead of jumping when the toolbar order flips (the toolbar keeps its own slide).
    const dockFn = app.slice(app.indexOf('function toggleComposerDockPosition('), app.indexOf('function toggleComposerDockPosition(') + 1600);
    expect(dockFn).toMatch(/document\.querySelectorAll\('\.composer > :not\(\.composer-toolbar\)'\)\]\.filter\(\(el\) => el\.offsetParent !== null && !el\.hidden\)/);
    expect(dockFn).toMatch(/const firstTops = rows\.map\(\(el\) => el\.getBoundingClientRect\(\)\.top\)/); // First
    expect(dockFn).toMatch(/const delta = firstTops\[i\] - el\.getBoundingClientRect\(\)\.top;\s*if \(!delta\) return;/); // Invert
    expect(dockFn).toMatch(/el\.style\.transition = 'transform 0\.48s cubic-bezier\(0\.16, 1, 0\.3, 1\)';\s*el\.style\.transform = 'none';/); // Play
    expect(dockFn).toMatch(/event\.propertyName !== 'transform'\) return; el\.style\.transition = ''; el\.style\.transform = ''/); // cleanup
  });

  it('PWA-COMPOSER-WIRE-SAFE-01: the editor->wire serializer is balanced by construction, and Enter/Delete/typing never trap emphasis (v795 audit)', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // FIX C — serializeComposerEditor emits `delim` around each maximal run of formattable text; a HARD boundary
    // (a <br>, an atom marker, a DIV/P block) FLUSHES the run so a delimiter never spans a newline or straddles a
    // marker, and an empty span (seg stays '') emits nothing. No editor DOM state can emit unbalanced/stray **.
    const ser = app.slice(app.indexOf('function serializeComposerEditor('), app.indexOf('function serializeComposerEditor(') + 2400);
    expect(ser).toContain('const serChildren = (node, delim) => {');
    expect(ser).toContain("const flush = () => { if (seg !== '') { out += delim + seg + delim; seg = ''; } };");
    expect(ser).toContain("else { flush(); out += '\\n'; }"); // a real <br> flushes then emits a raw newline
    expect(ser).toContain('flush(); out += child.dataset.marker;'); // an atom marker flushes then emits raw (never inside emphasis)
    expect(ser).toContain("seg += serChildren(child, '**');");
    expect(app).toContain('return serChildren(el, \'\');');
    // FIX A — Enter collapses a NON-collapsed selection to its END first (keeps the word), so escapeTrailingFmt puts
    // the <br> OUTSIDE the fmt span instead of deleteContents stripping the word + trapping the <br> inside (**\n\n**).
    const ins = app.slice(app.indexOf('function composerEditorInsertLineBreak('), app.indexOf('function composerEditorInsertLineBreak(') + 1400);
    expect(ins).toContain('if (sel && sel.rangeCount && !sel.isCollapsed && el.contains(sel.getRangeAt(0).commonAncestorContainer)) {');
    expect(ins).toContain('const r = sel.getRangeAt(0); r.collapse(false); sel.removeAllRanges(); sel.addRange(r);');
    expect(ins).toContain('composerEditorPruneEmptyFmt(el); // drop any span a prior edit emptied');
    // FIX B — a native delete that empties a fmt span is normalized on the 'input' event: the empty span is dropped
    // and the caret relocated outside it (else typing inherits the format, the toggle no-ops, and it serializes ****).
    expect(app).toContain('function composerEditorNormalizeEmptyFmt(el)');
    expect(app).toContain('if (!event.isComposing) composerEditorNormalizeEmptyFmt(messageInput);');
    expect(app).toContain('if (!event.isComposing) composerEditorNormalizeEmptyFmt(publicMessageInput);');
    // FIX D — the trailing-fmt bleed guard climbs to the OUTERMOST enclosing fmt span, so typing after a nested
    // bold-in-italic run lands fully plain instead of inheriting the outer format (unbalanced * on the wire).
    const trail = app.slice(app.indexOf('function composerEditorTrailingFmtSpan('), app.indexOf('function composerEditorTrailingFmtSpan(') + 900);
    expect(trail).toContain('while (span.parentNode && span.parentNode !== el && span.parentNode.nodeType === 1');
    expect(trail).toContain('&& /\\bfmt-/.test(span.parentNode.className || \'\') && span === span.parentNode.lastChild) {');
  });

  it('PWA-COMPOSER-PASTE-IME-01: paste/cut and IME/replacement input never lose text, an attachment, or leak format (v796 audit)', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // [19] Cutting a selection that spans an ATTACHMENT atom is treated as a COPY (the bytes can't ride the text
    // clipboard, so a real cut+paste would silently lose the image/file); a link atom DOES round-trip so it still cuts.
    const cut = app.slice(app.indexOf('function composerEditorCopySelection('), app.indexOf('function composerEditorCopySelection(') + 2600);
    expect(cut).toContain("const hasAttachmentAtom = [...wrapper.querySelectorAll('[data-marker]')].some((a) => !/\\]\\(/.test(a.dataset.marker || ''));");
    expect(cut).toContain('if (!hasAttachmentAtom) {');
    // [18] Pasted marker-like tokens are neutralized with a zero-width space (kept invisible, `(?!\\()` spares links)
    // so serialize->composerBlocksFromDraft can't re-bind a pasted [image 1] to the editor's own attachment on send.
    expect(app).toContain("raw = raw.replace(/\\[((?:image|img)\\s+\\d+|file\\s+\\d+|post)\\](?!\\()/gi, '[\\u200b$1]');");
    // [25] The paste escape (which jumps the caret to the formatted word's end) fires ONLY when the paste yields a
    // LINK chip; plain/marker text inserts at the real caret (mid-word), so pasting into a bold word stays put.
    expect(app).toContain('const hasLink = /\\[[^\\]\\n]{1,200}\\]\\([^\\s()]{1,2000}\\)/.test(raw);');
    expect(app).toContain('if (hasLink) composerEditorEscapeTrailingFmt(el);');
    // [22] The bleed guard also covers the replacement/composition/autofill insert families (mobile suggestion /
    // desktop autocorrect / autofill), not just plain insertText, so a word inserted at a fmt trailing edge is plain.
    expect(app).toContain("event.inputType === 'insertReplacementText'");
    expect(app).toContain("event.inputType === 'insertFromComposition' || event.inputType === 'insertFromAutofill'");
    // [21] IME composition bypasses beforeinput (isComposing), so a compositionstart listener pre-escapes the caret
    // out of a trailing fmt span before the composed text lands, keeping CJK/mobile-autocorrect words plain.
    expect(app).toContain('function composerEditorEscapeFmtForComposition(el)');
    expect(app).toContain("messageInput?.addEventListener('compositionstart', () => composerEditorEscapeFmtForComposition(messageInput));");
    expect(app).toContain("publicMessageInput?.addEventListener('compositionstart', () => composerEditorEscapeFmtForComposition(publicMessageInput));");
  });

  it('PWA-SHARED-POST-IMAGE-01: a shared post shows the ORIGINAL image — resolved by reference, never copied on the wire', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    const policy = readFileSync('web/capsule-part-policy.mjs', 'utf8');
    // A SHARE is an internal REFERENCE (entryId): the image is RESOLVED, never re-uploaded — a copy would republish
    // the picture on chain at full price. v797 resolved it from the local feed cache only, which is why a repost
    // reached a reader who does not follow that channel with no picture at all; the resolution now falls through to
    // an addressed chain read (SHAREREF-*, and measured against real shards in tests/public-lane-post-at).
    expect(app).toContain('function findCachedPublicPostByEntryId(entryId)');
    expect(app).toContain('function resolveSharedPostOriginal(entryId, expectedBodyHash, authorWallet)');
    expect(app).toContain('async function sharedPostImageUrlWarm(post)');
    expect(app).toContain('const store = await publicPostMediaStore();'); // warm the stripped image from the durable store
    expect(app).toContain('applyPublicPostMediaRecord(post, media);');
    // REFERENCE INTEGRITY: the SHARE block is sender-authored, so the resolved post's bodyHash must match the block's
    // (content-addressed) — else a crafted entryId could show an unrelated post's image under a spoofed label. Both
    // resolution paths carry the check: the cache hit compares, and the chain read PICKS BY it.
    expect(app).toContain('function normalizeBodyHashHex(value)');
    expect(app).toContain('if (cached && want && want === normalizeBodyHashHex(cached.bodyHash)) return Promise.resolve(cached);');
    expect(app).toContain('.find((item) => normalizeBodyHashHex(item.bodyHash) === want) ?? null');
    // buildSharedPostEmbed warms the picture onto the post object and then re-renders the body through the feed's
    // renderer, so the image lands where its author put it rather than at the end of the card.
    expect(app).toContain('await sharedPostImageUrlWarm(post);');
    expect(app).toContain('appendPublicItemContent(real, post, embedDepth + 1);');
    const embed = app.slice(app.indexOf('function buildSharedPostEmbed('), app.indexOf('function buildPublicFeedArticle('));
    expect(embed).not.toMatch(/innerHTML/);
    // The reference the image lookup needs — entryId + bodyHash — rides the SHARE block. It went to version 2 on
    // 2026-08-04 because v1 packed the entry id as a uint64 and clean-17's public feed id is `epochTag.shardSeq.
    // entryId`: BigInt threw on it, so a forward of a real post could never be encoded (nor even rendered — the
    // throw came out of renderConversation). Nothing had ever been written in v1, so there is no v1 reader.
    expect(policy).toContain('export const SHARE_BLOCK_CONTENT_VERSION = 2;');
    expect(policy, 'the id is carried as text, length-prefixed').toContain('out[2] = entryId.length;');
    expect(policy, 'and nothing tries to make a number of it').not.toContain('BigInt(share?.entryId');
    // The resolved image has a feed-style image rule.
    expect(css).toMatch(/\.shared-post-embed-image \{[\s\S]*?max-width: 100%;[\s\S]*?max-height: 260px;/);
  });

  it('PWA-COMPOSER-UNFORMAT-01: a format toggle UN-formats any selection (multi-span/select-all), Enter shows a visible line, and delete-all clears format (v798)', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // The toggle detects "already fully formatted" over the LIVE DOM (not cloneContents, which drops the enclosing
    // span for a single-text-node range) so a select-all / multi-span / multi-line run correctly UN-formats. A single
    // enclosing span keeps the three-way split; a multi-span run unwraps each. (Was: only one enclosing span could be
    // un-formatted — a select-all's commonAncestorContainer is the editor -> no enclosing -> it re-ADDED bold.)
    expect(app).toContain('function composerEditorSelectionFullyFormatted(range, className, el)');
    expect(app).toContain('return range.compareBoundaryPoints(Range.END_TO_START, nr) < 0'); // live-DOM overlap, not cloneContents
    expect(app).toContain('function composerEditorUnformatRange(range, className, el)');
    const toggle = app.slice(app.indexOf('function composerEditorToggleFormat('), app.indexOf('function composerEditorToggleFormat(') + 5200);
    expect(toggle).toContain('const enclosing = composerEditorEnclosingFormat(range, className, el);');
    expect(toggle).toContain('} else if (composerEditorSelectionFullyFormatted(range, className, el)) {');
    expect(toggle).toContain('composerEditorUnformatRange(range, className, el);');
    expect(toggle).toContain('const mid = spanText.slice(startOff, endOff);'); // three-way split retained for one span
    // unformat hoists the insertion point OUT of an emptied enclosing span so a re-insert can't re-format it.
    expect(app).toContain('if (encl) { range.setStartAfter(encl); range.collapse(true); }');
    // Enter drops stray EMPTY text nodes after the <br> so the trailing filler <br> is added and the new line is VISIBLE.
    expect(app).toContain("while (br.nextSibling && br.nextSibling.nodeType === 3 && br.nextSibling.nodeValue === '') br.nextSibling.remove();");
    // Deleting ALL text strips every lingering fmt span (even a <br>-only one) so the next keystroke types PLAIN.
    const norm = app.slice(app.indexOf('function composerEditorNormalizeEmptyFmt('), app.indexOf('function composerEditorNormalizeEmptyFmt(') + 1400);
    expect(norm).toContain("if ((el.textContent || '').trim() === '') {");
    expect(norm).toContain('while (span.firstChild) span.parentNode.insertBefore(span.firstChild, span);');
  });

  it('PWA-COMPOSER-NATIVE-FMT-01: the composer neutralizes native <b>/<strong>/inline-style the browser injects as a typing-style artifact (v799)', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // The composer uses ONLY .fmt-* class spans; a native <b>/<strong>/<i>/<em>/<u>/<font>/inline-style element is
    // a contentEditable typing-style leak (typing right after deleting a bold word). Unwrap every such element on
    // 'input' (keeping its text so the caret survives), NEVER our own .fmt-* spans.
    expect(app).toContain('function composerEditorStripNativeFormatting(el)');
    expect(app).toContain('el.querySelectorAll(\'b, strong, i, em, u, s, font, [style*="font-weight"], [style*="font-style"], [style*="text-decoration"]\');');
    const strip = app.slice(app.indexOf('function composerEditorStripNativeFormatting('), app.indexOf('function composerEditorStripNativeFormatting(') + 700);
    expect(strip).toContain("if (/\\bfmt-/.test(node.className || '')) continue;"); // keep our own toolbar spans
    expect(strip).toContain('while (node.firstChild) node.parentNode.insertBefore(node.firstChild, node);');
    // Wired into BOTH editors' 'input' listeners, before the empty-fmt normalize.
    expect(app).toContain('if (!event.isComposing) composerEditorStripNativeFormatting(messageInput);');
    expect(app).toContain('if (!event.isComposing) composerEditorStripNativeFormatting(publicMessageInput);');
    // Belt-and-suspenders on the WIRE: serializeComposerEditor treats ONLY .fmt-* classes as format — a native
    // <b>/<strong>/<i>/<em>/<code> tag (which the composer never creates) serializes as PLAIN, never as **.
    const ser = app.slice(app.indexOf('function serializeComposerEditor('), app.indexOf('function serializeComposerEditor(') + 2600);
    expect(ser).toContain("} else if (cls.contains('fmt-bold')) {");
    expect(ser).not.toContain("tag === 'STRONG'");
    expect(ser).not.toContain("tag === 'B' ||");
  });

  it('PWA-THREAD-PREVIEW-STRIP-01: the plain-text thread-list preview strips inline markdown markers (v800)', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // thread.preview is shown via textContent (can't render bold), so raw **/*/`/[label](url) markers were noise
    // (owner screenshot: "**пр** **ивет**"). stripInlineFormatting removes them; it's display-only (the bubble
    // renders bold from the message's own blocks, and the wire is untouched).
    expect(app).toContain('function stripInlineFormatting(text)');
    expect(app).toContain("preview.textContent = stripInlineFormatting(thread.preview);");
    const strip = app.slice(app.indexOf('function stripInlineFormatting('), app.indexOf('function stripInlineFormatting(') + 700);
    expect(strip).toContain(".replace(/\\*\\*\\*([^*\\n]+)\\*\\*\\*/g, '$1')"); // ***bold+italic***
    expect(strip).toContain(".replace(/\\*\\*([^*\\n]+)\\*\\*/g, '$1')");        // **bold**
    expect(strip).toContain(".replace(/`([^`\\n]+)`/g, '$1')");                 // `code`
    expect(strip).toContain(".replace(/\\[([^\\]\\n]{1,200})\\]\\(([^\\s()]{1,2000})\\)/g, '$1')"); // [label](url)
  });

  it('PWA-GLOBAL-SYNC-INDICATOR-01: a green sync spinner/check lives in every header; the dialog subtitle no longer carries sync status', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const html = readFileSync('web/index.html', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    expect((html.match(/class="global-sync-indicator"/g) ?? []).length).toBeGreaterThanOrEqual(6);
    expect(css).toMatch(/\.global-sync-indicator\[data-syncing="true"\]::before/);
    expect(css).toMatch(/\.global-sync-indicator\[data-syncing="false"\]::before/);
    expect(app).toMatch(/function isGlobalSyncActive\(\)/);
    expect(app).toMatch(/function refreshGlobalSyncIndicator\(\)/);
    expect(app).toMatch(/const globalSyncIndicators = \[\.\.\.document\.querySelectorAll\('\.global-sync-indicator'\)\]/);
    // v703: the idle indicator is a real BUTTON — a tap runs a context-aware "sync now" (discovery overlay ->
    // fresh channels, Private -> the full manual message walk, Vault/Profile -> their balances, public feed ->
    // the unified cycle); spinning taps no-op. The discovery header's separate refresh button is GONE.
    expect(html).not.toMatch(/<span class="global-sync-indicator"/);
    expect((html.match(/<button type="button" class="global-sync-indicator"/g) ?? []).length).toBeGreaterThanOrEqual(6);
    // v707: the flush is paid by the WALLET (not the Vault shown in the rail) — the submit pre-checks the
    // wallet GRAM balance BEFORE the send (fail-open on an unreadable balance) and maps the shortfall to an
    // actionable localized status instead of "sync delayed"; browser zoom is disabled app-wide (viewport meta
    // + html/body touch-action + the WebKit gesture kill) while the lightbox keeps its OWN pointer/transform
    // zoom (touch-action:none viewport).
    expect(app).toMatch(/const walletBalanceNanotons = await loadConnectedTonWalletBalance\(\)\.catch\(\(\) => null\);/);
    expect(app).toMatch(/if \(walletBalanceNanotons !== null && nonNegativeBigInt\(walletBalanceNanotons\) < requiredNanotons\)/);
    expect(app).toMatch(/error\.code = 'PLATHO_WALLET_GRAM_REQUIRED';/);
    expect(app).toMatch(/if \(state\.errorCode === 'PLATHO_WALLET_GRAM_REQUIRED'\) return t\('profile\.flushNeedsWalletGram'\);/);
    expect(app.indexOf("error.code = 'PLATHO_WALLET_GRAM_REQUIRED'")).toBeLessThan(app.indexOf('const transaction = createWalletTransaction(messages)'));
    expect(EN_STRINGS['profile.flushNeedsWalletGram']).toBe('top up wallet GRAM');
    expect(html).toMatch(/name="viewport"[^>]*maximum-scale=1, user-scalable=no/);
    const cssZoom = readFileSync('web/styles.css', 'utf8');
    expect(cssZoom).toMatch(/html,\s*body \{[\s\S]*?touch-action: pan-x pan-y;/);
    expect(app).toMatch(/for \(const gestureEventType of \['gesturestart', 'gesturechange', 'gestureend'\]\)/);
    // v704 ATH-flush overlay integration: EVERY chain re-read of the flush state routes through the in-flight
    // overlay merge (behavioral coverage in tests/ath-flush-overlay.test.ts), and the post-send optimistic
    // state derives through the SAME merge — a bare overwrite is what re-armed the button mid-flight.
    expect(app).toMatch(/athFlushState = applyAthFlushOptimisticOverlay\(await readAthBurnFlushState\(\)\)/);
    expect(app).toMatch(/athFlushOptimisticFlush = \{\s*username: \{ flushed: flushedBuckets\.includes\('username'\), baselineDue: usernameDue \}/);
    expect(app).toMatch(/\.\.\.applyAthFlushOptimisticOverlay\(state\),/);
    expect(app).not.toMatch(/athFlushState = await readAthBurnFlushState\(\)/);
    expect(app).toMatch(/function syncNowForCurrentScreen\(\)/);
    expect(app).toMatch(/if \(isGlobalSyncActive\(\) \|\| messageSyncManualInFlight\) return;/);
    expect(app).toMatch(/publicPane\?\.dataset\?\.discoverOpen === 'true'\) \{\s*refreshPublicDiscovery\(\)/);
    expect(app).toMatch(/indicator\.addEventListener\('click', \(\) => syncNowForCurrentScreen\(\)\)/);
    expect(app).toMatch(/function runManualPrivateMessageSync\(\)/);
    expect(html).not.toMatch(/publicDiscoveryRefreshButton/);
    expect(app).not.toMatch(/publicDiscoveryRefreshButton/);
    expect(css).toMatch(/\.global-sync-indicator\[data-syncing="false"\] \{\s*cursor: pointer;/);
    expect(EN_STRINGS['sync.syncNow']).toBe('Synced - tap to sync now');
    // The private dialog subtitle is emptied — sync status moved to the global indicator.
    const subtitleSrc = app.slice(app.indexOf('function conversationSubtitleText()'), app.indexOf('function isGlobalSyncActive('));
    expect(subtitleSrc).toMatch(/return '';/);
  });

  it('PWA-PUBLIC-SUBSCRIBE-RESYNC-01: following a channel invalidates the sync fast-path and resyncs so its posts load now', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // The resync helper forces a full walk (clears the global fast-path cursor) and kicks a sync.
    expect(app).toMatch(/function resyncPublicForNewSubscription\(\)/);
    const helper = app.slice(
      app.indexOf('function resyncPublicForNewSubscription()'),
      app.indexOf('function resyncPublicForNewSubscription()') + 260,
    );
    // v753: the invalidation goes through the epoch-bumping helper (guards against a concurrent walk's commit).
    expect(helper).toMatch(/invalidatePublicSyncFastPath\(\);/);
    expect(helper).toMatch(/syncPublicChannels\(\)/);
    // Both follow paths call it (add custom channel + re-follow an existing one).
    const addSource = app.slice(app.indexOf('function addCustomPublicChannel('), app.indexOf('function resyncPublicForNewSubscription'));
    expect(addSource).toMatch(/resyncPublicForNewSubscription\(\)/);
    const setSource = app.slice(app.indexOf('function setPublicChannelSubscribed('), app.indexOf('function readPublicReadCursors('));
    expect(setSource).toMatch(/if \(subscribed\) resyncPublicForNewSubscription\(\)/);
  });

  it('PWA-TONCENTER-KEY-FIELD-REFRESH-01: refreshMessagingControls re-syncs the toncenter key field (so an imported v2 backup key shows)', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const controls = app.slice(
      app.indexOf('function refreshMessagingControls'),
      app.indexOf('function refreshMessagingControls') + 3500,
    );
    expect(controls).toMatch(/refreshToncenterKeyUi\(\);/);
  });

  it('PWA-DIALOG-AVATAR-INCOMING-ONLY-01: the dialog header avatar hydrates only from INCOMING message headers', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // An outgoing ('out') message carries the OWN avatar pointer; the by-hash avatar cache would otherwise paint
    // the counterparty's header with the user's own avatar. Each message-driven hydrate must be gated on incoming.
    const appendSource = app.slice(
      app.indexOf('async function appendOpenedCapsuleMessage'),
      app.indexOf('async function appendOpenedPrivatePartsMessage'),
    );
    expect(appendSource).toMatch(/if \(message\.type !== 'out'\) \{[\s\S]*?hydrateThreadAvatarFromPointer\(/);
    const partsSource = app.slice(
      app.indexOf('async function appendOpenedPrivatePartsMessage'),
      app.indexOf('function isBodyHistoryUnavailableError'),
    );
    expect(partsSource).toMatch(/if \(message\.type !== 'out'\) \{[\s\S]*?hydrateThreadAvatarFromPointer\(/);
    // The encrypted-history restore loop is gated the same way.
    expect(app).toMatch(/if \(message\.type !== 'out'\) \{\s*hydrateThreadAvatarFromPointer\(\s*thread,/);
  });

  it('PWA-SYNC-MESSAGES-INFLIGHT-01: a manual sync cannot be started twice over itself', () => {
    // REBASELINED 2026-08-07. The profile "Sync messages" button was removed — every tab already carries the sync
    // indicator, and the header's tap-to-sync is now the only entry point. The gate used to pin that button's
    // disabled attribute; a disabled control is one way to stop a double run, but it was never the load-bearing
    // one. The flag is: it guards the body itself, so a second tap during an await returns instead of launching a
    // parallel pass over the same shards.
    const app = readFileSync('web/app.js', 'utf8');
    expect(app).toMatch(/let messageSyncManualInFlight = false;/);
    const handlerSource = app.slice(
      app.indexOf('async function runManualPrivateMessageSync()'),
      app.indexOf("publicChannelSearch?.addEventListener('input'"),
    );
    expect(handlerSource.length, 'the slice anchors must actually bracket the function').toBeGreaterThan(200);
    expect(handlerSource, 'a re-entrant call must bail out before doing any work')
      .toMatch(/if \(messageSyncManualInFlight\) return;/);
    expect(handlerSource).toMatch(/messageSyncManualInFlight = true;/);
    // Cleared in `finally`, so a throw cannot wedge the lane shut for the rest of the session.
    expect(handlerSource).toMatch(/finally \{\s*messageSyncManualInFlight = false;/);
  });


  it('PWA-AIRDROP-CLAIM-NOTE-01: the claim note quotes the contract, not a number someone typed', () => {
    // The note tells the user a claim costs the same GRAM whatever it carries, and advises batching up to the
    // per-claim cap. Both halves are only useful if they match the chain: a stale cost misstates what the wallet
    // will be asked to sign, and a stale cap advises a batch AirdropTicket would refuse at gate 26112.
    const app = readFileSync('web/app.js', 'utf8');
    const ticket = readFileSync('contracts/AirdropTicket.tact', 'utf8');

    const contractValue = (name: string): string => {
      const match = ticket.match(new RegExp(`const ${name}: Int = (\\d+);`));
      expect(match, `${name} must exist in AirdropTicket.tact`).toBeTruthy();
      return (match as RegExpMatchArray)[1];
    };
    const clientValue = (name: string): string => {
      const match = app.match(new RegExp(`const ${name} = ([0-9_]+)n;`));
      expect(match, `${name} must exist in web/app.js`).toBeTruthy();
      return (match as RegExpMatchArray)[1].replaceAll('_', '');
    };

    expect(clientValue('AIRDROP_CLAIM_MIN_VALUE_NANOTONS'), 'claim cost mirrors AT_CLAIM_MIN_VALUE')
      .toBe(contractValue('AT_CLAIM_MIN_VALUE'));
    expect(clientValue('AIRDROP_MAX_CREDITS_PER_CLAIM'), 'per-claim cap mirrors AT_MAX_CREDITS_PER_CLAIM')
      .toBe(contractValue('AT_MAX_CREDITS_PER_CLAIM'));

    // The note must actually be rendered from those mirrors, not merely hold them.
    expect(app).toMatch(/flushAthNote\.textContent = maxAth === null/);
    expect(app).toMatch(/athTicketState\.claimMinValue \?\? AIRDROP_CLAIM_MIN_VALUE_NANOTONS/);
    expect(app).toMatch(/AIRDROP_MAX_CREDITS_PER_CLAIM \* perCredit/);
    // ath-per-credit arrives from a chain read; without this the note keeps its cost-only wording all session.
    expect(app).toMatch(/athPerCredit: pool\.athPerCredit,[\s\S]{0,400}refreshProfileFeeLabels\(\)/);

    const html = readFileSync('web/index.html', 'utf8');
    expect(html).toMatch(/<p class="settings-note" id="flushAthNote"><\/p>/);
    // The user never sees the internal credit unit — the note is written in ATH (owner's standing rule).
    for (const locale of ['en', 'ru'] as const) {
      const note = (I18N_STRINGS[locale] as Record<string, string>)['profile.claimCostBatchNote'];
      expect(note, `${locale} batch note exists`).toBeTruthy();
      expect(note).toContain('{cost}');
      expect(note).toContain('{max}');
      expect(note, 'the note speaks ATH, never credits').not.toMatch(/credit|кредит/i);
    }
  });

  it('PWA-CONFIG-06B: profile avatar rides ONE direct-pay wallet transfer (shard bytes + paid pointer)', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // The dispatcher has NO Vault fallback left: the clean-15 submit phase (CapsuleHub publishState, mobilized
    // confirm loop, entry-scan recovery, inline-key exclusion vs recovery ticks) was deleted at cutover — a
    // direct publish is confirmed by its own wallet transfer, so there is no publishState to heal.
    expect(app).toMatch(/async function submitProfileAvatarUpdate\(avatar\) \{\s*return submitProfileAvatarDirect\(avatar\);\s*\}/);
    expect(app).not.toMatch(/runProfileAvatarSubmitPhase\(/);

    const directSource = app.slice(
      app.indexOf('async function submitProfileAvatarDirect'),
      // stop BEFORE the dispatcher's comment — it names the removed Vault machinery, which the negative
      // assertions below would otherwise match.
      app.indexOf('// clean-17 direct-pay: the avatar rides ONE wallet transfer'),
    );
    const shardReadSource = app.slice(
      app.indexOf('async function readAvatarPartsFromShard'),
      app.indexOf('function avatarPartStreamId'),
    );

    // Idempotence BEFORE paying: re-picking the image already on-chain must not spend a second 100 ATH.
    // FAIL-CLOSED: the *Result* reader distinguishes "read failed" (ok:false) from "no avatar" (pointer:null).
    // The old `.catch(() => null)` collapsed both into "go ahead and pay" — one flaky read = 100 ATH.
    expect(directSource).toMatch(/const currentRead = await readCurrentProfileAvatarPointerResultFromChain\(owner, \{ required: false \}\)/);
    expect(directSource).toMatch(/if \(!currentRead\.ok\) \{[\s\S]*PLATHO_AVATAR_PRECHECK_UNREADABLE/);
    expect(directSource).not.toMatch(/readCurrentProfileAvatarPointerFromChain\(owner, \{ required: false \}\)\.catch/);
    expect(directSource).toMatch(/if \(currentPointer\?\.avatarHash\?\.toLowerCase\?\.\(\) === normalizeAvatarHashHex\(avatarHash\)\.toLowerCase\(\)\)/);
    expect(directSource).toMatch(/return \{ status: 'active', registryPointer: currentPointer \}/);
    // AFFORDABILITY before signing. Without it the wallet signs a transfer whose ATH leg cannot settle and
    // SendIgnoreErrors (platho-wallet `sendMode | 2`) drops that leg SILENTLY — bytes land, paid for, no
    // pointer, no error. ATH is fail-closed, GRAM fail-open; the asymmetry is asserted on the helpers.
    expect(directSource).toMatch(/await assertConnectedAthAtLeast\(PROFILE_AVATAR_PRICE_ATH, 'set an avatar'\)/);
    expect(directSource).toMatch(/await assertWalletGramAtLeast\(\s*avatarValue \* BigInt\(shardParts\.length\) \+ PROFILE_AVATAR_DIRECT_REQUEST_VALUE/);
    const athGuardSource = app.slice(
      app.indexOf('async function assertConnectedAthAtLeast'),
      app.indexOf('async function loadConnectedAthWalletBalance'),
    );
    expect(athGuardSource).toMatch(/const balance = await loadConnectedAthWalletBalance\(\);/);   // no .catch: fail-closed
    expect(athGuardSource).not.toMatch(/loadConnectedAthWalletBalance\(\)\.catch/);
    expect(athGuardSource).toMatch(/const balance = await loadConnectedTonWalletBalance\(\)\.catch\(\(\) => null\);\s*\n\s*if \(balance === null\) return;/);
    // AMBIGUOUS broadcast is not a failure: error.builtBoc means the external may have landed, and reporting
    // "failed" is what makes the user re-pick and pay a second 100 ATH. Fall through to the confirm loop.
    expect(directSource).toMatch(/if \(!error\?\.builtBoc\) throw error;/);
    expect(directSource).toMatch(/result = \{ ambiguousBroadcast: true/);
    // CONFIRM the paid pointer: a broadcast is not an outcome (the ATH ride a two-phase registry->KeyShard
    // write that can bounce). Green only on a confirmed pointer; the timeout is RED and retryable.
    expect(directSource).toMatch(/const registryPointer = await confirmProfileAvatarPointer\(owner, avatarHash\)/);
    expect(directSource).toMatch(/setProfileAvatarStatus\(t\('avatar\.active'\), ''\)/);
    expect(directSource).toMatch(/setProfileAvatarStatus\(t\('avatar\.notActiveYet'\), 'error'\)/);
    expect(directSource).not.toMatch(/'avatar submitted'/);
    expect(EN_STRINGS['avatar.active']).toBe('avatar active');
    expect(EN_STRINGS['avatar.notActiveYet']).toBe('avatar not active yet');
    const confirmSource = app.slice(
      app.indexOf('async function confirmProfileAvatarPointer'),
      app.indexOf('async function submitProfileAvatarUpdate'),
    );
    expect(app).toMatch(/const PROFILE_AVATAR_POINTER_CONFIRM_DEADLINE_MS = 120 \* 1000/);
    // DETERMINISTIC streamId: a retry of the same image in the same era merges with the parts already on the
    // shard instead of orphaning them. The era is in the preimage so a re-upload after retention can still
    // produce a NEW pointer (KeyShard gate 22205 rejects an identical one).
    expect(directSource).toMatch(/const streamId = await deriveProfileAvatarStreamId\(owner, avatarHash, publicEraOf\(3, createdAtSec\)\)/);
    expect(directSource).not.toMatch(/const streamId = randomBytes\(16\)/);
    expect(app).toMatch(/'PLATHO-AVATAR-STREAM-V1'/);
    // Part cap is enforced before the transfer is built (an over-long image must fail loud, not half-publish).
    expect(directSource).toMatch(/if \(parts\.length > 16\) throw new Error\('Avatar must fit 16 public capsules'\)/);
    // Bytes go to the owner's AVATAR PublicShard (kind 3), addressed by the avatar partition key + era tag.
    expect(directSource).toMatch(/createPublicPostPayloadV2\(\{\s*type: 'avatar'/);
    expect(directSource).toMatch(/const avatarPartitionKey = await publicAvatarPartitionKey\(walletHash\)/);
    expect(directSource).toMatch(/const avatarEpochTag = publicEpochTag\(3, publicEraOf\(3, createdAtSec\)\)/);
    expect(directSource).toMatch(/const avatarValue = publicPublishValueForKind\(3\)/);
    expect(directSource).toMatch(/kind: 3, keyArg: 0n,[\s\S]*partitionKey: avatarPartitionKey, epochTag: avatarEpochTag/);
    // The PAID pointer write is authorised by the 100 ATH request to ProfileRegistry, and it carries exactly the
    // fields readAvatarPartsFromShard matches on (streamId as uint128 + part count).
    expect(directSource).toMatch(/createAthWalletMessage\('ATHTransferRequestRegistryProfileAvatar'/);
    expect(directSource).toMatch(/amount: PROFILE_AVATAR_PRICE_ATH/);
    expect(directSource).toMatch(/recipient: requireProfileRegistryAddress\(\)/);
    expect(directSource).toMatch(/avatar_stream_id: tonCell\.bytesToBigInt\(streamId\)/);
    expect(directSource).toMatch(/avatar_part_count: BigInt\(parts\.length\)/);
    // ONE wallet transfer carries both legs — bytes without a paid pointer (or the reverse) is the split-state
    // this pins against.
    expect(directSource).toMatch(/publishPublicLaneParts\(\{ wallet: plathoWallet, transport \}, shardParts, \{ extraMessages: \[athRequest\] \}\)/);
    expect(directSource).toMatch(/await writeProfileAvatarMediaCache\(avatarHash, bytesToImageDataUrl\(avatar\.bytes, 'image\/webp'\)\)/);
    // No Vault publish machinery on the direct path.
    expect(directSource).not.toMatch(/publishState/);
    expect(directSource).not.toMatch(/confirmCapsuleHubPublishEntries|retryUnconfirmedVaultPublishBroadcasts/);

    // The reader trusts the PAID pointer, never the part header: PPH2 dropped avatar_hash/profile_version from
    // the header, so a part is matched by streamId + partCount + owner and AUTHENTICATED by whole-image sha256.
    // The reject branch now counts and NAMES the failing gate before continuing (four conditions used to collapse
    // into one silent `false`), so the call is no longer a one-line guard.
    expect(shardReadSource).toMatch(/if \(!publicAvatarPartMatchesShard\(payload, ownerWallet, pointer\)\) \{/);
    expect(shardReadSource).toMatch(/const assembled = await assembledAvatarPartGroup\(parts, pointer\)/);
    expect(app).toMatch(/if \(hash\.toLowerCase\(\) !== pointer\.avatarHash\.toLowerCase\(\)\) return null/);
    expect(app).toMatch(/function publicAvatarPartMatchesShard\(payload, ownerWallet, pointer\)/);
  });

  // PWA-CONFIG-06C removed with readAvatarPartsFromCapsuleHub: the entry-id cursor it guarded does not exist in
  // the shard reader, which fetches the owner's AVATAR shard directly (no entry ids at all) and authenticates the
  // assembled bytes by sha256 against the paid pointer — pinned by PWA-CONFIG-06B.

  it('PWA-CONFIG-04AD: production config forbids routing through ANY central RPC proxy/gateway (canonical hosts only)', () => {
    // The real config (Orbs + toncenter.com only) routes through no central proxy, so it is not flagged.
    expect(validatePlathoAppConfig(productionConfig).findings.map((finding) => finding.id))
      .not.toContain('PWA_TON_RPC_CENTRAL_GATEWAY_FORBIDDEN');
    // But ANY provider on a non-canonical (self-hosted central proxy) host is rejected by principle — not
    // a blacklist of one retired hostname.
    const report = validatePlathoAppConfig({
      ...productionConfig,
      network: {
        ...productionConfig.network,
        tonRpc: {
          ...productionConfig.network.tonRpc,
          providers: [
            ...productionConfig.network.tonRpc.providers,
            {
              id: 'central-proxy',
              kind: 'toncenter-v3',
              runGetMethodEndpoint: 'https://rpc.central-proxy.example/api/v3/runGetMethod',
              sendBocEndpoint: 'https://rpc.central-proxy.example/api/v3/message',
              messagesEndpoint: 'https://rpc.central-proxy.example/api/v3/messages',
            },
          ],
        },
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.id)).toContain('PWA_TON_RPC_CENTRAL_GATEWAY_FORBIDDEN');
  });

  it('PWA-CONFIG-04AF: production config requires a full-capability emergency fallback provider', () => {
    const withoutEmergencyFlag = validatePlathoAppConfig({
      ...productionConfig,
      network: {
        ...productionConfig.network,
        tonRpc: {
          ...productionConfig.network.tonRpc,
          providers: productionConfig.network.tonRpc.providers.map((provider) => {
            if (provider.id !== 'keyless-toncenter') return provider;
            const { emergencyFallback, ...rest } = provider as Record<string, unknown>;
            return rest;
          }),
        },
      },
    });
    expect(withoutEmergencyFlag.ok).toBe(false);
    expect(withoutEmergencyFlag.findings.map((finding) => finding.id)).toContain('PWA_TON_RPC_EMERGENCY_FALLBACK_REQUIRED');

    const withoutSendEndpoint = validatePlathoAppConfig({
      ...productionConfig,
      network: {
        ...productionConfig.network,
        tonRpc: {
          ...productionConfig.network.tonRpc,
          providers: productionConfig.network.tonRpc.providers.map((provider) => (
            provider.id === 'keyless-toncenter'
              ? { ...provider, sendBocEndpoint: false, messagesEndpoint: false }
              : provider
          )),
        },
      },
    });
    expect(withoutSendEndpoint.ok).toBe(false);
    expect(withoutSendEndpoint.findings.map((finding) => finding.id)).toContain('PWA_TON_RPC_EMERGENCY_FALLBACK_REQUIRED');
  });

  // PWA-AVATAR-PART-SCAN-INTERLEAVE-01 removed with the CapsuleHub avatar readers: interleaving was a Hub
  // problem (avatar parts scattered among unrelated public entries in ONE shared log). The AVATAR shard holds
  // only that owner's parts, so there is no scan window to size and no interleaving to tolerate.

  // PWA-VPROF-STRICT-ROUTE-01 removed with the Vault avatar route: direct pay has no Vault global to read a
  // ProfileRegistry route out of — the registry address comes from requireProfileRegistryAddress() (config +
  // manifest pin) and the payment is a plain ATH transfer, pinned by PWA-CONFIG-06B.

  // PWA-VPROF-PENDING-FINALITY-01 removed with the Vault avatar path: there is no two-hop Vault payment to
  // report as "pending" any more. Under direct pay the 100 ATH request rides the same wallet transfer as the
  // shard bytes, and the pointer either lands or does not — pinned by PWA-CONFIG-06B.

  it('RT-VUSER-001: username mint rejects registered or pending names before signing', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const helper = app.slice(
      app.indexOf('async function readUsernameMintAvailabilityForOwnVaultAction'),
      app.indexOf('async function resolveUsernameNftItemProvider'),
    );
    const mintedProbe = app.slice(
      app.indexOf('async function usernameItemIsMinted'),
      app.indexOf('async function readUsernameMintAvailabilityForOwnVaultAction'),
    );
    const submitSource = app.slice(
      app.indexOf('async function submitUsernameMint'),
      app.indexOf('async function submitAthDueFlush'),
    );
    const priceIndex = submitSource.indexOf('readUsernameMintPriceForOwnVaultAction(provider, registry, username)');
    const availabilityIndex = submitSource.indexOf('readUsernameMintAvailabilityForOwnVaultAction(provider, registry, username)');
    const assertIndex = submitSource.indexOf("assertConnectedAthAtLeast(priceAtomic, 'mint a name')");
    const signIndex = submitSource.indexOf('sendPlathoWalletTransaction(requirePlathoWallet()');

    expect(app).toMatch(/computeUsernameNameHash,/);
    expect(helper).toMatch(/provider cannot verify username availability/);
    expect(helper).toMatch(/const readOptions = \{ address: registry, \.\.\.criticalChainReadOptions\(\) \}/);
    expect(helper).toMatch(/const nameHash = await computeUsernameNameHash\(username\)/);
    // 2026-07-20: "is this name taken" is asked of the ITEM (derived from the name hash), not of the deleted
    // name_records map. The guard at the top of the helper must demand the derivation method, or a provider
    // missing it would fail deep inside the read instead of up front.
    expect(helper).toMatch(/!provider\?\.getUsernameItemAddress \|\| !provider\?\.getPendingMint/);
    expect(helper).toMatch(/const itemAddress = await provider\.getUsernameItemAddress\(nameHash, readOptions\)/);
    expect(helper).toMatch(/const minted = await usernameItemIsMinted\(itemAddress\)/);
    expect(helper).toMatch(/provider\.getPendingMint\(nameHash, readOptions\)/);
    expect(helper).toMatch(/if \(minted\) \{\s*throw new Error\('Username is already registered'\)/);
    expect(helper).toMatch(/Username mint is already pending/);
    expect(helper).not.toMatch(/getNameRecord/);
    expect(helper).not.toMatch(/allowUnverifiedCriticalRead/);
    expect(helper).not.toMatch(/callWithVerificationUnavailableReadFallback/);

    // THE SHARPEST EDGE OF THE name_records DELETION. A get-method against an account that does not exist fails
    // exactly the way a get-method fails when toncenter is having a bad minute. If usernameItemIsMinted ever
    // collapses those two, an unreachable RPC reads as "this name is free" and the buyer signs a mint that
    // bounces. So: a thrown get-method error is NEVER an answer.
    expect(mintedProbe).toMatch(/itemProvider\.getState\(\{ address: itemAddress, \.\.\.criticalChainReadOptions\(\) \}\)/);
    expect(mintedProbe).toMatch(/return state\?\.initialized === true/);
    // The catch must not return anything on the error path itself — the only `return false` reachable after a
    // failed get-method comes from the ACCOUNT STATE, which reports "never existed" as DATA rather than as a
    // failure (the walletAccountIsUninitialized pattern).
    expect(mintedProbe).toMatch(/catch \(getMethodError\) \{[\s\S]*transport\.getAccountState\(\{ address: itemAddress \}, \{ skipIfRateLimited: false \}\)/);
    expect(mintedProbe).toMatch(/status === 'uninit' \|\| status === 'uninitialized' \|\| status === 'nonexist' \|\| status === 'non_exist'/);
    // And when NEITHER question can be answered it refuses instead of guessing. A retry costs a second; a wrong
    // "free" costs a failed mint.
    expect(mintedProbe).toMatch(/throw new Error\('Could not verify whether this username is taken'\)|const error = new Error\('Could not verify whether this username is taken'\)[\s\S]*throw error/);
    // No silent optimism anywhere on this path: the probe never answers "not minted" merely because a read failed.
    expect(mintedProbe).not.toMatch(/catch\s*(?:\([^)]*\))?\s*\{\s*return false/);
    expect(mintedProbe).not.toMatch(/allowUnverifiedCriticalRead|callWithVerificationUnavailableReadFallback/);
    // DELIBERATELY FAILING (2026-07-20) — the one hole the rest of this probe was built to close.
    // Reaching the account-state fallback means get_state THREW, so nothing is known about the item yet. Only the
    // never-existed statuses above are evidence of "free". An account reported ACTIVE is evidence of the OPPOSITE:
    // the per-name item contract is deployed, and since the map was deleted that deployment IS the record that the
    // name is taken. `if (status === 'active') return false` answers "this name is free" on the strength of a read
    // that failed — its own trailing comment says "that is a read problem", which is the description of a case that
    // must fall through to the refusal below, not of one that may return an answer. Left red on purpose: fix
    // web/app.js usernameItemIsMinted (drop the line, or return true) rather than relaxing this assertion.
    expect(mintedProbe).not.toMatch(/status === 'active'\)\s*return false/);
    expect(priceIndex).toBeGreaterThanOrEqual(0);
    expect(availabilityIndex).toBeGreaterThan(priceIndex);
    expect(assertIndex).toBeGreaterThan(availabilityIndex);
    expect(signIndex).toBeGreaterThan(assertIndex);
  });

  // RT-VUSER-002 removed with the Vault username lane: it verified the VAULT's registry route (Vault global ->
  // UsernameRegistry -> derived official ATH wallet -> its ATHMaster binding) before a Vault-signed mint. Direct
  // pay has no Vault global to route through — the wallet pays the registry directly, the registry address is a
  // config+manifest pin, and the mint's own ATH-wallet request is pinned byte-exact in tests/ath-* plus
  // USERNAME-ATH-DIRECT-01 (a full e2e against the live contract).

  it('RT-VUSER-003: username mint stays in background finalizing instead of offering a quick repeat', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const submitSource = app.slice(
      app.indexOf('async function submitUsernameMint'),
      app.indexOf('async function submitAthDueFlush'),
    );
    const waitSource = app.slice(
      app.indexOf('async function waitForPlathoUsernameOwnership'),
      app.indexOf('async function resolveTonDnsProvider'),
    );

    expect(app).toMatch(/const USERNAME_MINT_BACKGROUND_CONFIRM_ATTEMPTS = 240/);
    expect(app).toMatch(/const USERNAME_MINT_BACKGROUND_CONFIRM_DELAY_MS = 15_000/);
    expect(app).toMatch(/const USERNAME_MINT_LOCAL_PENDING_MS = USERNAME_MINT_BACKGROUND_CONFIRM_ATTEMPTS \* USERNAME_MINT_BACKGROUND_CONFIRM_DELAY_MS/);
    expect(app).toMatch(/function assertNoPendingUsernameMintRetry/);
    expect(app).toMatch(/Username mint is still finalizing; sync ownership before retrying/);
    expect(waitSource).toMatch(/const attempts = Math\.max\(1, Number\(options\.attempts \?\? USERNAME_MINT_CONFIRM_ATTEMPTS\)\)/);
    expect(waitSource).toMatch(/const delayMs = Math\.max\(250, Number\(options\.delayMs \?\? USERNAME_MINT_CONFIRM_DELAY_MS\)\)/);
    expect(waitSource).toMatch(/waitForPlathoUsernameOwnership\(username, owner, options\)/);
    expect(waitSource).toMatch(/clearPendingUsernameMint\(username, owner\)/);
    expect(submitSource).toMatch(/assertNoPendingUsernameMintRetry\(username, owner\)/);
    expect(submitSource).toMatch(/rememberPendingUsernameMint\(username, owner, result\)/);
    expect(submitSource).toMatch(/t\('username\.mintSubmittedFinalizing'\)/);
    expect(EN_STRINGS['username.mintSubmittedFinalizing']).toBe('mint submitted, finalizing');
    expect(submitSource).toMatch(/attempts: USERNAME_MINT_BACKGROUND_CONFIRM_ATTEMPTS/);
    expect(submitSource).toMatch(/delayMs: USERNAME_MINT_BACKGROUND_CONFIRM_DELAY_MS/);
  });

  it('PWA-CONFIG-07: username mint uses the registry price atomic value', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const source = app.slice(
      app.indexOf('async function submitUsernameMint'),
      app.indexOf('async function submitAthDueFlush'),
    );
    const helper = app.slice(
      app.indexOf('async function readUsernameMintPriceForOwnVaultAction'),
      app.indexOf('async function resolveUsernameNftItemProvider'),
    );

    expect(source).toMatch(/readUsernameMintPriceForOwnVaultAction\(provider, registry, username\)/);
    expect(helper).toMatch(/provider\.getUsernamePrice\(length, \{/);
    expect(helper).toMatch(/price\?\.valid_length !== true/);
    expect(helper).toMatch(/const priceAtomic = BigInt\(price\?\.price_ath_atomic \?\? 0n\)/);
    expect(helper).toMatch(/\.\.\.criticalChainReadOptions\(\)/);
    expect(helper).not.toMatch(/localUsernameMintPriceAtomic\(username\)|isTonRpcVerificationUnavailableForOwnVaultActionError\(error\)|allowUnverifiedCriticalRead/);
    expect(source).toMatch(/priceAtomic/);
    expect(source).not.toMatch(/submitAthWalletMessage\(/);
    expect(source).not.toMatch(/amount: price,/);
  });

  it('PWA-CONFIG-07A: expected missing Vault provider is a quiet preview state', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const activationSource = app.slice(
      app.indexOf('async function refreshVaultActivationStatus'),
      app.indexOf('// ── Boot screen'),
    );

    // The predicate outlived the Vault provider class it was named for: every clean-17 reader (KeyShard, PublicShard,
    // RecordShard, the registries) raises the same degraded-transport conditions, and a degraded read must stay a
    // quiet "RPC busy, retrying" rather than a console error.
    expect(app).toMatch(/function isExpectedVaultProviderUnavailable/);
    expect(app).not.toMatch(/VaultChainProviderUnavailableError/);
    expect(app).toMatch(/const VAULT_AUTO_REFRESH_MS = 60 \* 1000/);
    expect(app).toMatch(/const VAULT_NAV_BACKGROUND_REFRESH_MS = 180 \* 1000/);
    expect(app).toMatch(/const TON_RPC_CONNECTING_STATUS = t\('common\.rpcBusyRetrying'\)/);
    expect(EN_STRINGS['common.rpcBusyRetrying']).toBe('RPC busy - retrying');
    expect(app).toMatch(/let tonRpcLimitedUntil = 0/);
    expect(app).toMatch(/function noteTonRpcRateLimit/);
    expect(app).toMatch(/function markTonRpcLimited/);
    expect(app).toMatch(/function isExpectedVaultProviderUnavailable\(error\) \{[\s\S]*isTonRpcVerificationUnavailableError\(error\)/);
    expect(app).toMatch(/function privateSendBlockReason/);
    expect(app).toMatch(/function canAttemptPrivateSend[\s\S]*&& !privateComposerKnownVaultTonShortfall\(\)/);
    expect(app).not.toMatch(/function canAttemptPrivateSend[\s\S]*&& !tonRpcLimited\(\)/);
    expect(app).toMatch(/function refreshVaultNow/);
    expect(app).toMatch(/function refreshVaultNavBalanceInBackground/);
    expect(app).toMatch(/function queueVaultPostTransactionRefresh/);
    expect(app).toMatch(/function queueVaultPostTransactionRefresh\(options = \{\}\) \{[\s\S]*const pollActivation = options\.pollActivation === true[\s\S]*markNavVaultBalancePending\('transaction submitted'/);
    // Regression: after an activation external is sent, the delayed refreshes must KEEP
    // re-reading activation until it confirms on-chain (otherwise the Activate button stays
    // stale and only a second manual press catches it up).
    expect(app).toMatch(/includeActivation: pollActivation/);
    expect(app).toMatch(/queueVaultPostTransactionRefresh\(\{ pollActivation: true \}\)/);
    expect(app).toMatch(/function queueVaultRefreshAfterWalletChange\(\) \{[\s\S]*markNavVaultBalancePending\('wallet changed'/);
    // (sendVaultExternalBoc went with the Vault action externals — a direct-pay action is a plain wallet transfer,
    // and the balance it moves is refreshed by queueVaultPostTransactionRefresh above.)
    expect(app).toMatch(/function markNavVaultBalanceRetryNeeded[\s\S]*markNavVaultBalancePending\(reason, \{ retry: true \}\)/);
    expect(app).toMatch(/if \(view === 'wallet'\)/);
    expect(app).toMatch(/scheduleVaultAutoRefresh\(2_000\)/);
    expect(app).toMatch(/delayMs === VAULT_AUTO_REFRESH_MS && !isVaultViewActive\(\)/);
    expect(app).toMatch(/document\.addEventListener\('visibilitychange'/);
    expect(app).toMatch(/window\.addEventListener\('focus'/);
    // No wallet, no balance: the binding and the cached pocket are dropped rather than left showing the last one.
    const navFn = app.slice(
      app.indexOf('async function refreshVaultNavBalanceInBackground'),
      app.indexOf('function walletFormattedBalance'),
    );
    expect(navFn).toMatch(/delete globalThis\.plathoVaultBinding;[\s\S]{0,40}?resetVaultPocketState\(\);/);
    expect(app).toMatch(/refreshVaultNavBalanceInBackground\(\)[\s\S]*\.finally\(\(\) => scheduleVaultAutoRefresh\(\)\)/);
    // A degraded read on the activation path stays quiet (no console error) and keeps the existing binding.
    expect(activationSource).toMatch(/if \(!noteTonRpcRateLimit\(error\)\) console\.warn\('\[keyshard\] activation status read failed', error\)/);
    expect(activationSource).toMatch(/keyRecord: null/);
  });

  it('PWA-CONFIG-07C: ATH current supply is a live master getter value, not a hardcoded fallback', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const initialStateSource = app.slice(
      app.indexOf('let athProtocolState ='),
      app.indexOf('function localStorageOrNull'),
    );
    const renderSource = app.slice(
      app.indexOf('function formatAthProfileAmount'),
      app.indexOf('function formatBasisPointsPercent'),
    );
    const refreshSource = app.slice(
      app.indexOf('async function refreshAthProtocolStats'),
      app.indexOf('function queueAthProtocolStatsRefresh'),
    );
    const viewSource = app.slice(
      app.indexOf('function setView(view)'),
      app.indexOf('function renderThreads'),
    );
    const flushSource = app.slice(
      app.indexOf('async function readAthBurnFlushState'),
      app.indexOf('async function submitProfileAvatarUpdate'),
    );

    expect(initialStateSource).toMatch(/total_supply:\s*null/);
    expect(initialStateSource).toMatch(/let athFlushState = \{/);
    expect(renderSource).toMatch(/if \(value === null \|\| value === undefined\) return '-'/);
    expect(app).toMatch(/function renderAthFlushStatus/);
    expect(refreshSource).toMatch(/provider\.getJettonData\(\{ address: requireAthMasterAddress\(\) \}\)/);
    expect(refreshSource).toMatch(/await refreshAthFlushState\(\)/);
    expect(refreshSource).toMatch(/total_supply:\s*data\?\.total_supply === null \|\| data\?\.total_supply === undefined\s*\?\s*null\s*:\s*nonNegativeBigInt\(data\.total_supply\)/);
    expect(refreshSource).not.toMatch(/ATH_TOTAL_SUPPLY_ATOMIC/);
    // Profile reads are serialized (one at a time) to avoid the iOS concurrent-read freeze (v509 pattern):
    // await GRAM balance -> ATH stats -> own avatar.
    expect(viewSource).toMatch(/if \(view === 'profile' && plathoWallet\?\.address\) \{[\s\S]*await refreshAthProtocolStats\(\)/);
    // Burn ATH user row removed (see the index.html assertions). The ATHBurn message primitive itself stays
    // for the protocol buyback/burn-due path; there is no longer a user-facing wallet-burn handler to assert.
    expect(app).not.toMatch(/async function submitAthWalletBurn/);
    expect(app).toMatch(/flushAthButton\?\.addEventListener\('click'/);
    // [OWNER 2026-08-03] Starts at 2s now: the claimed balance took visibly long to appear, and post-April TON
    // settles in well under a second, so a 5s first look was pure waiting.
    expect(app).toMatch(/const ATH_FLUSH_POST_TRANSACTION_REFRESH_DELAYS_MS = \[2_000, 5_000, 10_000, 20_000, 45_000, 90_000, 180_000\]/);
    expect(flushSource).toMatch(/function queueAthFlushPostTransactionRefresh\(\)/);
    expect(flushSource).toMatch(/queueAthFlushPostTransactionRefresh\(\)/);
    expect(flushSource).toMatch(/resolveUsernameRegistryProvider\(\)[\s\S]*provider\.getGlobal/);
    expect(flushSource).toMatch(/resolveProfileRegistryProvider\(\)[\s\S]*provider\.getGlobal/);
    expect(flushSource).toMatch(/createUsernameRegistryMessage\('FlushBurnAthDue'/);
    expect(flushSource).toMatch(/createProfileRegistryMessage\('FlushProfileBurnAthDue'/);
    expect(flushSource).toMatch(/REGISTRY_BURN_FLUSH_MESSAGE_VALUE_NANOTONS/);
    expect(flushSource).toMatch(/createWalletTransaction\(messages\)/);
    expect(app).not.toMatch(/set(?:Interval|Timeout)\(\s*(?:async\s*)?\(\s*\)\s*=>\s*submitAthDueFlush/);
    // Optimistic supply drop: submitting a flush immediately lowers "Current supply" by the flushed amount
    // (display-only overlay set AFTER the successful send), converging to the chain read once the burn lands
    // (supply <= baseline - amount) or on TTL expiry — a downstream failure self-corrects.
    expect(flushSource).toMatch(/athSupplyOptimisticBurn = \{\s*baseline: athProtocolState\.total_supply,\s*amount: flushedAmount,\s*until: Date\.now\(\) \+ ATH_SUPPLY_OPTIMISTIC_BURN_TTL_MS,/);
    expect(app).toMatch(/function athSupplyDisplayValue\(\)/);
    expect(app).toMatch(/setText\(athSupplyStatus, formatAthProfileAmount\(athSupplyDisplayValue\(\)\)\)/);
    expect(app).toMatch(/supply <= baseline - amount/);
  });

  // PWA-CONFIG-07B removed with the CapsuleHub index walk. "Uses the key indexes, never a global tail scan" was the
  // central scalability rule of reading ONE shared log: without the per-key indexes a client would have had to scan
  // the whole hub. A conversation's messages live in ITS OWN shards, addressed from K_root — there is no global log
  // to scan and no index to prefer, so the rule has no subject left. The replacement bound (a conversation is read
  // over its epoch window, cursor advanced only on a clean pass) is pinned in PWA-MSG-02.

  // PWA-CONFIG-07D removed with the CapsuleHub index walk: "skips unreadable entries WITHOUT ABORTING THE INDEX
  // WALK" is a property of a cursor-driven walk over a shared log. The live receive keeps the invariant that
  // matters — one unreadable capsule is counted as skipped and the pass continues, and the pass reports itself
  // incomplete rather than claiming to be up to date — and that is asserted in PWA-CONFIG-07C's transient-vs-
  // unreadable split plus the scanComplete contract in PWA-MSG-02.

  it('PWA-IDENTITY-BLEED-01: cross-wallet identity bleed guards — Saved thread never lends/borrows identity, sends never fall back to it', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // Root bug (owner repro 2026-07-08, fresh iPhone account): the composer's threads[0] fallback echoed an
    // outgoing message into the Saved "My notes" thread, and the later relocate of that capsule to the real peer
    // grafted the OWN wallet variant onto the peer dialog — flipping it to "My notes" and bleeding the peer's
    // avatar onto the user's own "You" channel.
    // A. No threads[0] (== Saved) fallback anywhere on the active-thread path.
    expect(app).toMatch(/function activeThread\(\) \{[\s\S]{0,700}?return threads\.find\(\(item\) => item\.id === activeThreadId\) \?\? null;\s*\n\}/);
    expect(app).not.toMatch(/return threads\.find\(\(item\) => item\.id === activeThreadId\) \?\? threads\[0\]/);
    // Composer submit: resolve-or-abort, never threads[0].
    expect(app).toMatch(/const thread = threads\.find\(\(item\) => item\.id === activeThreadId\) \?\? null;\s*\n\s*if \(!thread\) return;/);
    expect(app).not.toMatch(/const thread = threads\.find\(\(item\) => item\.id === activeThreadId\) \?\? threads\[0\];/);
    // The "selected thread vanished" rebuild branch shows the LIST, never threads[0].
    expect(app).toMatch(/\} else if \(previousActive\) \{[\s\S]{0,400}?activeThreadId = null;/);
    // B. The duplicate-dialog merge never consumes the Saved thread and carries ONLY named (non-wallet) variants.
    const relocate = app.slice(
      app.indexOf('function relocateExistingCapsuleMessage('),
      app.indexOf('async function appendOpenedCapsuleMessage('),
    );
    expect(relocate).toMatch(/if \(!isSavedMessagesThread\(sourceThread\)\) \{/);
    expect(relocate).toMatch(/\.filter\(\(variant\) => variant && variant\.type !== RECIPIENT_IDENTITY_TYPES\.WALLET_ADDRESS\)/);
    // C. The own public channel derives from the own linked .ath ONLY — the own-wallet branch returns
    // unconditionally (never falls through to the contact store / private-thread fallback).
    const ownDisplay = app.slice(
      app.indexOf('function resolveWalletChannelDisplay('),
      app.indexOf('const explicit = resolveContactDisplay(counterpartyWallet);'),
    );
    expect(ownDisplay).toMatch(/return ownIdentity\s*\n\s*\? \{ name: displayIdentityLabel\(ownIdentity\), tone: identityTone\(ownIdentity\), identity: ownIdentity, localLabel: null \}\s*\n\s*: null;/);
    // C2 (v748, owner rule "username главнее адреса"): the DEFAULT channel display falls back to the channel's
    // chain-VERIFIED .ath over the bare wallet address, so a just-subscribed channel shows the username
    // automatically (matching the "Display as" chevron) instead of the address the user then overrides by hand.
    const walletDisplayTail = app.slice(
      app.indexOf('const explicit = resolveContactDisplay(counterpartyWallet);'),
      app.indexOf('const explicit = resolveContactDisplay(counterpartyWallet);') + 2200,
    );
    expect(walletDisplayTail).toMatch(/const verifiedUsername = publicChannelProfileCache\[channelProfileCacheKey\(counterpartyWallet\)\]\?\.verifiedUsername/);
    expect(walletDisplayTail).toMatch(/return \{ name: displayIdentityLabel\(identity\), tone: identityTone\(identity\), identity, localLabel: null \}/);
    // A private thread that only knows the BARE address must not pre-empt the verified username (else the address
    // keeps winning); a thread carrying a username or local name still wins.
    expect(walletDisplayTail).toMatch(/const threadIsBareAddress = !thread\.localLabel/);
    expect(walletDisplayTail).toMatch(/threadIdentity\.type === RECIPIENT_IDENTITY_TYPES\.WALLET_ADDRESS/);
    // D. No contact-display preference is ever stored for the OWN wallet (write path refuses + clears).
    const writePref = app.slice(
      app.indexOf('function writeContactDisplayPreference('),
      app.indexOf('function resolveContactDisplay('),
    );
    expect(writePref).toMatch(/if \(own && sameWalletAddress\(counterpartyWallet, own\)\) \{[\s\S]{0,200}?removeItem\(key\)/);
    // ...and the Saved thread never hydrates a display from the per-counterparty store.
    const hydrate = app.slice(
      app.indexOf('function hydrateThreadDisplayFromContactStore('),
      app.indexOf('function setIdentityLabel('),
    );
    expect(hydrate).toMatch(/if \(own && sameWalletAddress\(wallet, own\)\) \{ thread\.contactDisplaySynced = true; return false; \}/);
    // E. Devices poisoned BEFORE the fix self-heal on history restore: the own-wallet variant may live ONLY on the
    // real Saved thread, the Saved thread carries nothing but the own wallet, and the healed snapshots are rewritten.
    expect(app).toMatch(/function healCrossWalletIdentityBleed\(\{ requeueAnonymous = false, clearOwnContactDisplay = false \} = \{\}\) \{/);
    const heal = app.slice(
      app.indexOf('function healCrossWalletIdentityBleed('),
      app.indexOf('async function restoreEncryptedMessageHistory('),
    );
    // v722: the "which thread is the real Saved" discriminator is RAW-normalized (threadPrimaryWalletRaw ===
    // ownRuntimeWalletRaw), NOT a string-id / string-key compare — a wallet stored in a different friendly form
    // (EQ vs UQ) silently failed the old string compare, so a poisoned Saved thread was never healed. Variant
    // stripping is raw-normalized too (any UQ/EQ/raw form).
    expect(app).toMatch(/function threadPrimaryWalletRaw\(thread\) \{/);
    expect(app).toMatch(/function stripWalletVariantFromThread\(thread, walletRaw\) \{/);
    // v729: the real-Saved branch is keyed on the STRICT isRealSavedThread (id-only); the peer-dialog-carrying-own
    // branch still strips the own variant raw-normalized.
    expect(heal).toMatch(/if \(isRealSavedThread\(thread\)\) \{/);
    expect(heal).toMatch(/\} else if \(stripWalletVariantFromThread\(thread, own\)\) \{/);
    expect(heal).not.toMatch(/savedIds\.has\(thread\.id\)/);
    expect(heal).toMatch(/persistThreadDisplayPreference\(thread\)/);
    // The BOOT heal (restore) passes requeueAnonymous+clearOwnContactDisplay; the per-tick auto-sync heal calls the
    // cheap Saved-only form (no args) so a session poisoned MID-flight self-corrects without a full re-unlock (F3).
    expect(app).toMatch(/if \(healCrossWalletIdentityBleed\(\{ requeueAnonymous: true, clearOwnContactDisplay: true \}\)\) changed = true;/);
    // The per-tick cheap heal moved with the receive path: it ran on every CapsuleHub sync tick and now runs on
    // every SHARD sync tick. Losing it would mean a mid-flight poisoned session only self-corrects on re-unlock.
    const sync = app.slice(app.indexOf('async function syncConvCapsulesFromShards'), app.indexOf('async function syncPrivateCapsulesFromChain('));
    expect(sync).toMatch(/healCrossWalletIdentityBleed\(\);/);
    // The anonymous/pending re-queue (boot-only) relocates messages stuck in an Anonymous peer thread once their
    // sender resolves — the flip side of the own-guard keeping a peer message OUT of Saved.
    expect(heal).toMatch(/if \(requeueAnonymous && \(isAnonymousPeerThread\(thread\) \|\| thread\.pendingIdentityResolution === true\)\)/);
    expect(heal).toMatch(/if \(clearOwnContactDisplay\) writeContactDisplayPreference\(own, null\)/);
    // F3. Messages already stuck inside "My notes" are queued (their chain entry ids) and replayed through the
    // next private scan so they are re-opened, re-routed to their true dialog, and relocated OUT of Saved. TWO
    // misfiling shapes qualify (both need a chainEntryId to re-scan):
    //  - a RECEIVED ('in') message (a genuine self-note is stored 'out'); and
    //  - an OWN SEND misfiled into Saved: type 'out' with origin meta 'published' (privateChainMessageMeta returns
    //    'published' ONLY for an own capsule addressed to a PEER; a self-note is 'saved'). This is the "I write to
    //    glasnost but it lands in my notes" report — the earlier heal queued only 'in', so those never relocated.
    expect(heal).toMatch(/const misfiledIncoming = message\.type === 'in';/);
    expect(heal).toMatch(/const misfiledOwnSend = message\.type === 'out' && \/publish\/i\.test\(String\(message\.meta \?\? ''\)\);/);
    expect(heal).toMatch(/if \(misfiledIncoming \|\| misfiledOwnSend\)/);
    // All requeues go through the SESSION-BOUNDED helper (max 3 per entry per session): the heal also runs on every
    // sync tick, so a permanently-unresolvable stuck entry must not cost an RPC re-read per tick forever.
    expect(heal).toMatch(/queueSavedRelocateEntryId\(message\.chainEntryId\)/);
    expect(app).toMatch(/const SAVED_RELOCATE_MAX_REQUEUES_PER_SESSION = 3;/);
    expect(app).toMatch(/if \(count >= SAVED_RELOCATE_MAX_REQUEUES_PER_SESSION\) return;/);
    expect(app).not.toMatch(/pendingSavedRelocateEntryIds\.add\(String\(message\.chainEntryId\)\)/);
    // The own-raw fallback cache dies with the account on a wallet switch (clearWalletScopedRuntimeState), never on
    // a mere transient lock — the previous owner's address must not leak into the next account's routing guards.
    const walletTeardown = app.slice(app.indexOf('function clearWalletScopedRuntimeState('), app.indexOf('function lockPlathoWallet('));
    expect(walletTeardown).toMatch(/lastKnownOwnWalletRaw = null;/);
    expect(app).toMatch(/let pendingSavedRelocateEntryIds = new Set\(\)/);
    // The healThreadWalletVariantConflict discriminator is raw-normalized too.
    const healTouch = app.slice(
      app.indexOf('function healThreadWalletVariantConflict('),
      app.indexOf('function ownerWalletFromThread('),
    );
    expect(healTouch).toMatch(/if \(threadPrimaryWalletRaw\(thread\) === own\) \{/);
    expect(healTouch).not.toMatch(/savedIds\.has\(thread\.id\)/);
    // G. THE ONGOING ROOT, direct-pay form. The clean-15 shape of this bug was a RESOLUTION failure: the Hub gave
    // only a publisher address, that publisher IS the own wallet on the recipient index, and the fallback therefore
    // filed peer messages into "My notes". Direct pay removes the guess entirely — a shard capsule is addressed by a
    // bucketKey derived from the conversation's K_root, so the (selfKeyId, peerKeyId) pair NAMES the dialog before
    // anything is decrypted (recordConvRouteDebug records exactly that pair). What survives, and is pinned here, is
    // the invariant the resolution bug violated: direction is decided CRYPTOGRAPHICALLY, never by position.
    expect(app).toMatch(/function isSelfOpenedCapsule\(opened\)/);
    expect(app).toMatch(/const isOutgoing = opened\?\.openedAs === 'sender' \|\| isSelfOpenedCapsule\(opened\)/);
    expect(app).toMatch(/const isOutgoing = first\?\.openedAs === 'sender' \|\| isSelfOpenedCapsule\(first\)/);
    // A self-note received on a 2nd device must be verified CRYPTOGRAPHICALLY (a spoofable claimed senderWallet
    // alone would let a peer pin its message into "My notes" as our own).
    expect(app).toMatch(/const ownSig = ownMessagingSignPubkeyValue\(\);\s*\n\s*if \(!ownSig \|\| senderSigningPublicKeyValue\(opened\) !== ownSig\) return false;/);
    // G2. ownRuntimeWalletRaw() must NOT return null mid-session when a background lock nulled both live wallet
    // sources — that skips every own-guard above. It caches the last positively-known own raw and falls back to it
    // (own identity never changes within a session).
    const ownRaw = app.slice(app.indexOf('function ownRuntimeWalletRaw('), app.indexOf('function isSelfOpenedCapsule('));
    expect(app).toMatch(/let lastKnownOwnWalletRaw = null;/);
    expect(ownRaw).toMatch(/if \(raw\) \{ lastKnownOwnWalletRaw = raw; return raw; \}\s*\n\s*return lastKnownOwnWalletRaw;/);
    expect(ownRaw).toMatch(/catch \{\s*\n\s*return lastKnownOwnWalletRaw;/);
    // (G3 removed with knownPrivateWalletForSigningPubkey — the session cache that inferred a peer's wallet from the
    // dialog a message currently sits in. That inference was the "position decides identity" mistake in its purest
    // form, and direct pay has no need of it: the peer wallet is a field of the conversation record, written when the
    // INTRO was adopted and verified against the peer's KeyShard on every reply.)
    // G4. Add-contact must NOT let followContactPublicChannel (which rebuilds threads) drop the just-opened peer
    // dialog to Saved: the peer channel follow keeps the active PRIVATE selection (preserveActive:true), and the
    // handler re-pins activeThreadId to the peer + grafts the username onto the PEER thread (not "My notes").
    const setSub = app.slice(app.indexOf('function setPublicChannelSubscribed('), app.indexOf('function followContactPublicChannel('));
    expect(setSub).toMatch(/rebuildThreadsFromPublicSubscriptions\(\{ preserveActive: true \}\);/);
    expect(app).toMatch(/const openedThreadId = activeThreadId;\s*\n\s*followContactPublicChannel\(ownerWallet\);\s*\n\s*if \(openedThreadId && threads\.some\(\(item\) => item\.id === openedThreadId\)\) activeThreadId = openedThreadId;/);
    // G5. HARD ROUTING INVARIANT: isRealSavedThread is STRICT — the immutable id `dm:wallet_address:<own>`
    // (raw-normalized), NO identity fallback (a named identity grafted elsewhere must not be mistaken for Saved).
    expect(app).toMatch(/function isRealSavedThread\(thread\) \{[\s\S]{0,260}?\/\^dm:wallet_address:\(\.\+\)\$\/\.exec\(String\(thread\.id \?\? ''\)\)/);
    // Saved hygiene is one IDEMPOTENT function: resets Saved to the canonical own-wallet identity (drops foreign
    // wallet + ALL username/DNS variants + a named displayIdentity), returns true ONLY when it actually changed —
    // so the per-sync heal never re-encrypts Saved history on a tick when it is already clean (the persist-storm).
    expect(app).toMatch(/function purgeNamedIdentityFromSavedThread\(savedThread\) \{/);
    expect(app).toMatch(/const changed = isNamed\(savedThread\.displayIdentity\) \|\| isNamed\(savedThread\.identity\) \|\| !variantsClean;/);
    expect(app).toMatch(/if \(!changed\) return false;/);
    // F2. Heal-on-touch at LOOKUP time (covers the pre-restore race + any residual re-poisoning): the recipient-thread
    // lookup resolves a Saved/peer conflict the moment it would hand back the wrong thread — never waiting for the
    // next history restore. (The two receive-router call sites went with the routers; the lookup one is the live path
    // every direct-lane thread resolution goes through.)
    expect(app).toMatch(/function healThreadWalletVariantConflict\(thread, peerWalletRaw\) \{/);
    const findExisting = app.slice(
      app.indexOf('function findExistingRecipientThread('),
      app.indexOf('function selectOrCreateRecipientThread('),
    );
    expect(findExisting).toMatch(/healThreadWalletVariantConflict\(thread, peerRaw\)/);
  });

  it('PWA-PUBLIC-PRIVATE-UI-01: public/private UI fixes — tab-restore, info-button, feed overflow/uid, self-post, self-dialog, display-as', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    const pubMjs = readFileSync('web/public-channel-subscriptions.mjs', 'utf8');
    // 1. Returning to the private tab restores the open conversation (data-chat-open) on mobile.
    expect(app).toMatch(/appShell\.dataset\.chatOpen = activeThreadId \? 'true' : 'false'/);
    // 1a. A PRESERVING rebuild (background sync / resume-after-unlock) must NOT revive threads[0] when the user
    // had NO selection (was on the dialog LIST). Otherwise activeThreadId becomes non-null and a later
    // tab-switch to Private (setView reads activeThreadId) opens threads[0] instead of the list. Only an
    // explicit boot/reset (preserveActive:false) defaults to the first thread.
    const rebuildSrc = app.slice(
      app.indexOf('function rebuildThreadsFromPublicSubscriptions('),
      app.indexOf('function configuredCapsuleHubAddress'),
    );
    expect(rebuildSrc).toMatch(/if \(!preserveActive\) \{[\s\S]{0,180}?activeThreadId = threads\[0\]\?\.id \?\? null;/);
    expect(rebuildSrc).toMatch(/else if \(previousActive && threads\.some\(\(thread\) => thread\.id === previousActive\)\) \{[\s\S]{0,80}?activeThreadId = previousActive;/);
    // The catch-all "no prior selection" branch keeps the list (null), never threads[0].
    expect(rebuildSrc).toMatch(/\} else \{[\s\S]{0,400}?activeThreadId = null;\s*\n\s*\}/);
    // And the OLD buggy catch-all (unconditional threads[0] default) is gone from this function.
    expect(rebuildSrc).not.toMatch(/\} else \{\s*\n\s*activeThreadId = threads\[0\]\?\.id \?\? null;\s*\n\s*\}/);
    // 1b. Symmetric for Public: returning to the Public tab restores the open post detail instead of forcing the
    // feed — setView must NOT close the detail on tab-return; renderPublicSurface re-renders it from the cache.
    const publicViewBranch = app.slice(app.indexOf("if (view === 'public') {", app.indexOf('function setView(view)')), app.indexOf("if (view === 'wallet') {", app.indexOf('function setView(view)')));
    expect(publicViewBranch).not.toMatch(/closePublicPostDetail\(\)/);
    // v753: the channel view also suppresses the tab-restore feed anchor (it overlays the feed like the detail).
    expect(publicViewBranch).toMatch(/renderPublicSurface\(\{ anchorUnread: publicPane\?\.dataset\?\.postOpen !== 'true' && publicPane\?\.dataset\?\.channelOpen !== 'true' \}\)/);
    // 2. The public header keeps its Feed/Channels toggle + info on ONE line with the title (no wrap to a
    // second line). The vestigial diagnostics-panel flex-wrap + the actions' forced min-width are gone, and
    // the install button is hidden on mobile so the toggle + info fit beside the title.
    expect(css).not.toMatch(/min-width: var\(--header-actions-width\)/);
    expect(css).toMatch(/\.public-pane \.pane-header \.install-header-button \{\s*display: none;/);
    // 3a. Feed grid column is capped so a long token cannot stretch the card off-screen.
    expect(css).toMatch(/\.public-feed \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/);
    // 3b. Plain feed post bodies wrap long tokens.
    expect(css).toMatch(/\.feed-item p \{[\s\S]*?overflow-wrap: anywhere;[\s\S]*?word-break: break-word;/);
    // 3c. The technical entry uid is dropped from the feed header meta; v791: publishStatus is dropped too (it prints
    // once as the live .public-publish-status badge — including it here duplicated the status while sending).
    expect(pubMjs).toMatch(/meta: shortTime\(post\.createdAt\) \?\? ''/);
    expect(pubMjs).not.toMatch(/meta: \[post\.publishStatus, shortTime/);
    expect(pubMjs).not.toMatch(/uid \$\{post\.entryUid/);
    // 4. Own posts show in the feed without auto-subscribing (feed source = subscribed + own).
    expect(app).toMatch(/function feedSourcePublicChannels\(\)/);
    expect(app).toMatch(/function ownPublicChannel\(\)/);
    expect(app).toMatch(/publicChannelThreads = publicChannelsToThreads\(\s*feedSourcePublicChannels\(\)/);
    // F1: the sync loop snapshots the feed source once (feedChannels) then iterates it (round-robin selection reads
    // a bounded subset per cycle); the source is still subscribed + own.
    expect(app).toMatch(/const feedChannels = feedSourcePublicChannels\(\);/);
    expect(app).toMatch(/for \(const channel of feedChannels\)/);
    expect(pubMjs).toMatch(/export function publicChannelsToThreads\(channels, feedCache = \{\}\)/);
    // 5. "Private chat" is hidden on your own public post (no self-dialog). Ownership uses isOwnPublicAuthor,
    //    which falls back to the wallet address persisted in storage so own posts are recognised from the FIRST
    //    render (before the full wallet finishes loading) and never flash the author-only actions (▼/Private chat/Unfollow).
    expect(app).toMatch(/function isOwnPublicAuthor\(authorWallet\)/);
    expect(app).toMatch(/const ownAddress = plathoWallet\?\.address \?\? storedPlathoWalletRecord\(\)\?\.address \?\? null/);
    expect(app).toMatch(/const isOwnPost = isOwnPublicAuthor\(authorWallet\)/);
    expect(app).toMatch(/if \(!isOwnPost\) \{[\s\S]*?textContent = t\('public\.privateChat'\)/);
    expect(EN_STRINGS['public.privateChat']).toBe('Private chat');
    // 6A. Feed posts get the "Display as" chevron in the AUTHOR ROW (top-right), FEED mode only — channels mode
    // omits it on post cards (the channel-detail header already carries it). Reuses the shared popover.
    expect(app).toMatch(/function publicItemIdentityButton\(item\)/);
    expect(app).toMatch(/showPublicChannelDisplayPopover\(\{ authorWallet \}, identityButton\)/);
    expect(app).toMatch(/const feedIdentityButton = publicItemIdentityButton\(item\);[\s\S]*?authorRow\.append\(feedIdentityButton\)/);
    // It is pinned right in the compact author row (margin-left:auto, clean square so the chevron centres).
    // v703: ONE auto margin in the author row (the about button) — a second one on the chevron made flexbox
    // split the free space between them, opening a wide gap inside the [about][chevron] cluster.
    expect(css).toMatch(/\.feed-author-about \{[\s\S]*?margin-left: auto;[\s\S]*?padding: 0;/);
    expect(css).toMatch(/\.feed-author-identity \{(?:(?!margin-left)[\s\S])*?padding: 0;\s*\}/);
    expect(css).not.toMatch(/\.feed-actions \.icon-button/);
    // The post-plate channel-about button uses a distinct speech-bubble glyph (createChannelAboutIcon), NOT the (i)
    // info circle the Docs header button uses (owner: the same icon must not sit on two different buttons).
    expect(app).toMatch(/function createChannelAboutIcon\(\)/);
    expect(app).toMatch(/aboutButton\.append\(createChannelAboutIcon\(\)\)/);
    expect(app).not.toMatch(/createInfoIcon/);
    // 6B-own. The user's OWN .ath shows in their own public channel (local, no chain read). Resolved FIRST and via
    // the stored address (so it works before the wallet loads and isn't shadowed by a stray self-entry in the store).
    expect(app).toMatch(/const ownAddress = plathoWallet\?\.address \?\? storedPlathoWalletRecord\(\)\?\.address \?\? null/);
    expect(app).toMatch(/sameWalletAddress\(counterpartyWallet, ownAddress\)\)[\s\S]*?readLinkedPlathoUsername\(ownAddress\)\?\.label/);
    // 6B phase-1: PUBLIC document decode is forward-compat tolerant (skips unknown blocks) so a later phase can
    // embed an author-.ath block without breaking already-updated clients.
    expect(app).toMatch(/function decodeMessageDocumentBlocks\(bytesLike, options = \{\}\)/);
    expect(app).toMatch(/const tolerateUnknownBlocks = options\.tolerateUnknownBlocks === true/);
    expect(app).toMatch(/\} else if \(tolerateUnknownBlocks\) \{[\s\S]*?continue;/);
    expect(app).toMatch(/decodeMessageDocumentBlocks\(documentBytes, \{ tolerateUnknownBlocks: true \}\)/);
    // v646: the private DISPLAY decode is tolerant too — a future block kind must degrade to "block skipped",
    // never throw the whole message into the sync's unknown-error strike machine (stuck entry -> undelivered).
    // The prefs divert keeps its own strict decode (self-sent snapshot, single known block).
    expect(app).toMatch(/decodeMessageDocumentBlocks\(opened\.payload\.bytes, \{ tolerateUnknownBlocks: true \}\)/);
  });

  it('PWA-CONFIG-08: service worker precaches runtime crypto vendor modules', () => {
    const sw = readFileSync('web/sw.js', 'utf8');

    // Membership, not version — the same convention the styles.css line below states explicitly. The invariant is
    // that the precache is NAMED and VERSIONED (a bump is how a changed asset without a ?v= query, e.g. an icon
    // SVG, reaches devices at all); pinning the exact number only manufactured churn on every such bump.
    expect(sw).toMatch(/const CACHE_NAME = 'platho-pwa-prototype-v\d+';/);
    // ...and the bump must actually FETCH. A plain cache.add() goes through the browser HTTP cache, so an asset
    // whose URL has no ?v= (every icon SVG, the manifest) was re-cached from the same stale bytes and the new build
    // shipped the old file — MEASURED on the owner's device, reloaded onto v856 and still showing the old glyph.
    expect(sw).toMatch(/cache\.add\(new Request\(asset, \{ cache: 'reload' \}\)\)/);
    // The navigation network-first MUST bypass the browser HTTP cache (cache:'no-cache'): the server sends no
    // Cache-Control on the shell, so a plain fetch() let webviews (worst: Telegram Mini App) heuristically serve a
    // STALE index.html for hours — devices kept running old builds despite "network-first".
    expect(sw).toMatch(/new Request\(event\.request\.url, \{ cache: 'no-cache', credentials: 'same-origin' \}\)/);
    expect(sw).toMatch(/\.\/styles\.css\?v=\d+/);   // membership, not version — see PWA-CONFIG-01B
    expect(sw).toMatch(/\.\/assets\/icons\/swap-circular\.svg/);
    expect(sw).toMatch(/\.\/assets\/icons\/swap-vertical\.svg/);
    expect(sw).toMatch(/\.\/assets\/icons\/download\.svg/);
    // Derived from index.html's badge, not a literal — this was the FOURTH copy of the app version, and the release
    // that bumped the other three left this one behind. Every copy that can be derived, is.
    const swVersionNumber = String(readFileSync('web/index.html', 'utf8')
      .match(/id="appVersionLabel">v(\d+)<\/span>/)?.[1] ?? '');
    expect(swVersionNumber).toBeTruthy();
    expect(sw).toContain(`./app.js?v=${swVersionNumber}`);
    // [SPLIT 2026-08-02] MEMBERSHIP ONLY below — the `?v=` literals are gone from these assertions.
    //
    // Pinning the version here made this file a THIRD copy of every module version, and on 2026-08-02 that copy
    // CERTIFIED a real defect: it asserted sw.js precached profile-registry-ton-rpc-provider at ?v=44, which was
    // perfectly true, while app.js imported ?v=45. The service worker was warming a URL nothing requests — cold
    // starts fetched the module over the network and an offline start had no copy at all. A guard that compares a
    // file with a number cannot see a disagreement between two files.
    //
    // Versions are now DERIVED in tests/module-version-agreement.test.ts (sw.js against the real importers, and the
    // importers against each other). What belongs here is the question this test actually asks: WHICH modules ship
    // offline. The manifest and icons below keep their literals. styles.css is NO LONGER one of those exceptions:
    // MODCONTENT covers .css since 2026-08-03, after a changed stylesheet shipped behind a stale ?v=276.
    //
    // i18n engine + dictionaries + boot-screen worker/engine are precached (offline).
    expect(sw).toMatch(/\.\/i18n\.mjs/);
    expect(sw).toMatch(/\.\/i18n-strings\.mjs/);
    expect(sw).toMatch(/\.\/boot-signal-field\.mjs/);
    expect(sw).toMatch(/\.\/boot-signal-worker\.js/);
    // The self-hosted Telegram Mini App SDK is precached so it is available offline
    // and on poor networks, same as the rest of the runtime.
    expect(sw).toMatch(/\.\/vendor\/telegram-web-app\.js/);
    expect(sw).toMatch(/\.\/publish-batch-orchestration\.mjs/);
    expect(sw).toMatch(/\.\/platho-config\.mjs/);
    expect(sw).toMatch(/\.\/username-ton-rpc-provider\.mjs/);
    expect(sw).toMatch(/\.\/message-pricing-policy\.mjs/);
    expect(sw).toMatch(/\.\/public-channel-subscriptions\.mjs/);
    expect(sw).toMatch(/\.\/encrypted-message-store\.mjs/);
    expect(sw).toMatch(/\.\/platho-wallet\.mjs/);
    expect(sw).toMatch(/\.\/pwa-contract-transactions\.mjs/);
    expect(sw).toMatch(/\.\/ton-rpc-transport\.mjs/);
    expect(sw).toMatch(/\.\/profile-registry-ton-rpc-provider\.mjs/);
    expect(sw).toMatch(/\.\/ath-ton-rpc-provider\.mjs/);
    expect(sw).toMatch(/\.\/ton-dns-provider\.mjs/);
    expect(sw).toMatch(/\.\/username-ton-rpc-provider\.mjs/);
    expect(sw).toMatch(/\.\/recipient-identities\.mjs/);
    expect(sw).toMatch(/\.\/crypto\/platho-crypto\.mjs/);
    expect(sw).toMatch(/\.\/vendor\/@noble\/curves\/ed25519\.js/);
    expect(sw).toMatch(/\.\/vendor\/@noble\/curves\/abstract\/edwards\.js/);
    expect(sw).toMatch(/\.\/vendor\/@noble\/hashes\/sha2\.js/);
    expect(sw).toMatch(/\.\/vendor\/@noble\/hashes\/_md\.js/);
    expect(sw).toMatch(/\.\/vendor\/@noble\/post-quantum\/ml-kem\.js/);
    expect(sw).toMatch(/\.\/vendor\/@noble\/post-quantum\/_crystals\.js/);
    expect(sw).toMatch(/\.\/webp-encoder\.mjs/);
    expect(sw).toMatch(/\.\/qr-code\.mjs/);
    expect(sw).toMatch(/\.\/vendor\/@jsquash\/webp\/codec\/enc\/webp_enc\.js/);
    expect(sw).toMatch(/\.\/vendor\/@jsquash\/webp\/codec\/enc\/webp_enc\.wasm/);
    expect(sw).toMatch(/\.\/manifest\.webmanifest\?v=3/);
    expect(sw).toMatch(/\.\/assets\/platho-icon-192\.png\?v=3/);
    expect(sw).toMatch(/\.\/assets\/icons\/eye\.svg/);
    expect(sw).toMatch(/\.\/assets\/icons\/eye-off\.svg/);
  });

  it('PWA-CONFIG-08B: service worker install is resilient and navigation is time-bounded', () => {
    const sw = readFileSync('web/sw.js', 'utf8');
    // A single missing/transient asset must not abort install (atomic addAll
    // would strand the device on the previous worker and its stale shell).
    // The invariant is allSettled over per-asset adds, not the exact add argument — see PWA-CONFIG-08, where the
    // add was rebuilt as a cache:'reload' Request so a CACHE_NAME bump actually refetches un-versioned assets.
    expect(sw).toMatch(/Promise\.allSettled\(\s*ASSETS\.map\(\(asset\) => cache\.add\(/);
    expect(sw).not.toMatch(/cache\.addAll\(ASSETS\)/);
    // Navigation is network-first but bounded so a slow/filtered network falls
    // back to the cached shell instead of hanging on a blank screen.
    expect(sw).toMatch(/function fetchWithTimeout\(request, timeoutMs\)/);
    // v721: the shell fetch is rebuilt as a cache:'no-cache' Request (HTTP-cache revalidation — see PWA-CONFIG-08),
    // still through the same time-bounded wrapper.
    expect(sw).toMatch(/fetchWithTimeout\(shellRequest, NAVIGATION_NETWORK_TIMEOUT_MS\)/);
    expect(sw).toMatch(/return await cachedAppShell\(\) \|\| Response\.error\(\)/);
  });

  it('PWA-CONFIG-09: production hosting configs require strict security headers', () => {
    const caddy = readFileSync('deploy/Caddyfile', 'utf8');
    const nginx = readFileSync('deploy/nginx-platho.app.conf', 'utf8');
    const readme = readFileSync('deploy/README.md', 'utf8');
    const serverCaddy = readFileSync('scripts/server/Caddyfile', 'utf8');
    const readiness = readFileSync('PRODUCTION_READINESS.md', 'utf8');

    for (const text of [caddy, nginx, readme, serverCaddy, readiness]) {
      expect(text).toMatch(/Content-Security-Policy/);
      expect(text).toMatch(/default-src 'self'/);
      expect(text).toMatch(/script-src 'self' 'wasm-unsafe-eval'/);
      // The bundle ships no inline scripts and no inline import map, so
      // script-src must stay hash-free: stale hashes hide CSP drift.
      for (const scriptSrc of text.match(/script-src[^;"]*/g) ?? []) {
        expect(scriptSrc).not.toContain('sha256-');
      }
      expect(text).toMatch(/connect-src/);
      expect(text).toMatch(/object-src 'none'/);
      expect(text).toMatch(/base-uri 'none'/);
      // frame-ancestors is relaxed from 'none' to the Telegram web origin so the
      // app can run as a Telegram Mini App (embedded in an iframe on web.telegram.org);
      // this is the single, tightest origin that permits the embed.
      expect(text).toMatch(/frame-ancestors https:\/\/web\.telegram\.org/);
      expect(text).toMatch(/X-Content-Type-Options/);
      expect(text).toMatch(/Referrer-Policy/);
      expect(text).toMatch(/Permissions-Policy/);
    }
  });

  it('PWA-CONFIG-09B: module graph boots without an import map and ships the boot watchdog', () => {
    const html = readFileSync('web/index.html', 'utf8');
    const sw = readFileSync('web/sw.js', 'utf8');
    const bootGuard = readFileSync('web/boot-guard.js', 'utf8');

    // Inline import maps require Safari 16.4+ and CSP content hashes; vendor
    // modules use relative imports instead so older iOS can still boot.
    expect(html).not.toMatch(/type="importmap"/);
    expect(html).not.toMatch(/<script(?![^>]*src=)[^>]*>/);
    expect(html).toMatch(/<script src="\.\/boot-guard\.js\?v=\d+"><\/script>/);
    expect(sw).toMatch(/\.\/boot-guard\.js\?v=\d+/);

    // No reachable vendor module may keep a bare @noble specifier.
    // curves/index.js is not reachable from the runtime graph and keeps an
    // unresolvable upstream specifier; everything else must be relative.
    const vendorFiles = readdirSync('web/vendor/@noble', { recursive: true })
      .map((entry) => String(entry).replace(/\\/g, '/'))
      .filter((entry) => entry.endsWith('.js'))
      .filter((entry) => entry !== 'curves/index.js');
    const offending = vendorFiles.filter((entry) => {
      const source = readFileSync(`web/vendor/@noble/${entry}`, 'utf8');
      return /^(?:import|export)[^'\n]*from '@noble\//m.test(source);
    });
    expect(offending).toEqual([]);

    // The watchdog must stay plain ES5 so it runs where the module graph
    // cannot; it only fires when the app module never started.
    expect(bootGuard).not.toMatch(/=>|\bconst\b|\blet\b|`/);
    expect(bootGuard).toMatch(/data-platho-app-js/);
    // 'ready' is the terminal healthy marker; anything else after the boot
    // window (missing, 'started', 'error') shows the diagnostic overlay.
    expect(bootGuard).toMatch(/=== 'ready'\) return/);
    expect(bootGuard).toMatch(/boot did not finish/);
    expect(readFileSync('web/app.js', 'utf8')).toMatch(/dataset\.plathoAppJs !== 'ready'/);
    expect(bootGuard).toMatch(/addEventListener\('error'/);
    expect(bootGuard).toMatch(/unhandledrejection/);
    // The watchdog measures EXECUTION, not DOWNLOAD: it waits for the window 'load' event
    // (fires only after every script has downloaded AND run — a healthy app is 'ready' by
    // then), so a slow cold load (hard reload / new visitor with no service-worker cache)
    // never false-trips the "did not finish loading" screen. A hard cap still surfaces a
    // load that never completes. Guard against a regression to a fixed download-timeout.
    expect(bootGuard).toMatch(/addEventListener\('load'/);
    expect(bootGuard).toMatch(/readyState === 'complete'/);
    expect(bootGuard).toMatch(/HARD_CAP_MS/);
  });

  it('PWA-BOOT-SCREEN-01: branded boot overlay masks the post-unlock sync and lifts at the core-ready milestone', () => {
    const html = readFileSync('web/index.html', 'utf8');
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');

    // Markup: overlay visible from first paint (NOT hidden), signal canvas, spinner, i18n label + tagline.
    expect(html).toMatch(/<div class="boot-screen" id="bootScreen" data-phase="idle">/);
    // The overlay MUST be nested INSIDE .app-shell (not a body-direct sibling before it): on mobile .app-shell
    // is position:fixed → a stacking context; a sibling overlay traps the unlock dialog (#actionDialog z-60,
    // also inside .app-shell) BENEATH the overlay (z-55) → eternal boot with no visible modal. Co-locating the
    // overlay with the dialogs in the same stacking context lets z-index decide (55 < 60). Guard: #bootScreen
    // appears AFTER the .app-shell opening tag, and there is NO #bootScreen before it.
    const appShellOpenIdx = html.indexOf('<div class="app-shell"');
    const bootIdx = html.indexOf('id="bootScreen"');
    expect(appShellOpenIdx).toBeGreaterThan(-1);
    expect(bootIdx).toBeGreaterThan(appShellOpenIdx);
    expect(html.slice(0, appShellOpenIdx)).not.toMatch(/id="bootScreen"/);
    expect(html).toMatch(/<canvas class="boot-signal" id="bootSignal"/);
    expect(html).toMatch(/class="boot-spinner"/);
    // Pure-CSS div spinner (no SVG) so it composites off the main thread and never freezes under boot crypto.
    expect(html).toMatch(/<div class="boot-spinner-ring boot-spinner-ring-outer"><\/div>/);
    expect(html).toMatch(/<div class="boot-spinner-core"><\/div>/);
    expect(html).not.toMatch(/boot-spinner-arc/);
    expect(html).toMatch(/data-i18n="boot\.loading"/);
    expect(html).toMatch(/data-i18n="boot\.tagline"/);

    // Layering: overlay above the shell, below the unlock dialog (#actionDialog 60) so the password modal
    // sits ON the branded backdrop.
    expect(css).toMatch(/\.boot-screen \{[\s\S]*?z-index: 55;/);
    expect(css).toMatch(/@keyframes bootSpin \{/);
    expect(css).toMatch(/@keyframes bootCorePulse \{/);
    // Spinner animates ONLY transform/opacity (GPU-composited, keeps moving while the main thread is blocked);
    // no `filter` on the boot spinner (that forces main-thread paint and would freeze).
    expect(css).toMatch(/\.boot-spinner-ring-outer \{[\s\S]*?animation: bootSpin/);
    const spinnerCss = css.slice(css.indexOf('.boot-spinner {'), css.indexOf('.boot-loading-label'));
    expect(spinnerCss).not.toMatch(/filter:/);

    // Signal field runs OFF the main thread on an OffscreenCanvas worker (owner: separate thread), with a
    // main-thread fallback; the engine is a shared module.
    expect(app).toMatch(/import \{ createBootSignalField \} from '\.\/boot-signal-field\.mjs\?v=1';/);
    expect(app).toMatch(/new Worker\('\.\/boot-signal-worker\.js\?v=1', \{ type: 'module' \}\)/);
    expect(app).toMatch(/canvas\.transferControlToOffscreen/);
    const worker = readFileSync('web/boot-signal-worker.js', 'utf8');
    expect(worker).toMatch(/import \{ createBootSignalField \} from '\.\/boot-signal-field\.mjs\?v=1';/);
    expect(worker).toMatch(/setTimeout\(loop, 30\)/);
    const field = readFileSync('web/boot-signal-field.mjs', 'utf8');
    expect(field).toMatch(/export function createBootSignalField\(ctx/);
    // ALL Telegram-cloud restores (incl. the wallet-record read) are bounded by a single race so a slow/hung
    // CloudStorage can't stall the chain before the unlock decision — the mobile eternal-boot root.
    expect(app).toMatch(/walletRestore\.then\(\(\) => dismissalRestore\)\.then\(\(\) => backupRestore\),\s*\n\s*delay\(2500\),/);
    // Hard idle failsafe (shared by cold boot + re-unlock): the overlay is never eternal — reveal the app if
    // still idle (no dialog open) after 12s.
    expect(app).toMatch(/function armBootScreenIdleFailsafe\(\)/);
    expect(app).toMatch(/bootScreenIdleFailsafe = setTimeout\(tick, 12_000\)/);
    expect(app).toMatch(/if \(activeActionDialog\) \{ bootScreenIdleFailsafe = setTimeout\(tick, 5_000\)/);
    // Re-unlock on resume (after a background auto-lock) re-shows the branded overlay so the unlock dialog opens
    // ON it, not on the bare locked-but-visible app (privacy). It swaps in a FRESH canvas because the cold-boot
    // OffscreenCanvas was transferred to a now-dead worker and cannot be reused.
    expect(app).toMatch(/function showBootScreenForRelock\(\)/);
    expect(app).toMatch(/bootSignalCanvas\.replaceWith\(fresh\);\s*\n\s*bootSignalCanvas = fresh;/);
    // Wired synchronously into the resume unlock path (before the modal opens → no flash of the bare app):
    // showBootScreenForRelock() runs before the setTimeout that opens the dialog.
    const schedSrc = app.slice(app.indexOf('function scheduleWalletUnlockPrompt('), app.indexOf('function armWalletUnlockPrompt('));
    expect(schedSrc).toMatch(/showBootScreenForRelock\(\);/);
    expect(schedSrc.indexOf('showBootScreenForRelock();')).toBeLessThan(schedSrc.indexOf('walletUnlockPromptTimer = setTimeout('));
    // A boot trace (console-only) surfaces which step a stuck boot stopped on.
    expect(app).toMatch(/function setBootDebug\(step\)/);

    // Controller + failsafe.
    expect(app).toMatch(/function startBootSignalField\(canvas\)/);
    expect(app).toMatch(/function initBootScreen\(\)/);
    expect(app).toMatch(/function setBootScreenPhase\(phase\)/);
    expect(app).toMatch(/function hideBootScreen\(\)/);
    expect(app).toMatch(/function markBootAppReady\(\)/);
    // Failsafe armed on entering the LOADING phase (post-unlock, the only state that can hang); idle resolves
    // on its own via the awaited unlock dialog.
    expect(app).toMatch(/bootScreenSafetyTimer = setTimeout\(\(\) => hideBootScreen\(\), 45_000\)/);
    expect(app).toMatch(/if \(phase === 'loading' && !bootScreenSafetyTimer\)/);
    // Startup unlock is driven directly on the overlay (no visibility-gated deferral that races the overlay
    // on a slow mobile cold-start).
    expect(app).toMatch(/async function runBootScreenUnlock\(\)/);
    expect(app).toMatch(/if \(hasWallet && !plathoWallet\) \{\s*\n\s*\/\/[\s\S]{0,120}?void runBootScreenUnlock\(\);/);

    // Hooks: swap to the spinner on unlock, lift at the vault-core-ready milestone (BEFORE the message sync),
    // lift immediately when there is nothing to unlock, and never strand on a boot error.
    expect(app).toMatch(/setBootScreenPhase\('loading'\);\s*\n\s*markWalletUnlocked\(\);/);
    expect(app).toMatch(/if \(!hasStoredWallet\) markBootAppReady\(\);/);
    // Core-ready lift happens after the activation refresh (keys derived, activation known).
    const activationIdx = app.indexOf('await refreshVaultActivationStatus({ skipGlobal: true });');
    const readyLiftIdx = app.indexOf('markBootAppReady();', activationIdx);
    expect(activationIdx).toBeGreaterThan(-1);
    expect(readyLiftIdx).toBeGreaterThan(activationIdx);
    // markBootAppReady is invoked in the bootCrypto catch (error) path too.
    const bootCryptoCatch = app.slice(app.indexOf('async function bootCrypto()'));
    expect(bootCryptoCatch).toMatch(/setText\(vaultRecordStatus, t\('common\.blocked'\)\);\s*\n\s*\/\/[\s\S]{0,120}?markBootAppReady\(\);/);
    // The lift happens strictly before the private message sync begins (owner: don't wait for everything).
    const readyIdx = app.indexOf("// The wallet+vault core is ready here");
    const syncIdx = app.indexOf('beginMessageSyncUi();', readyIdx);
    expect(readyIdx).toBeGreaterThan(-1);
    expect(syncIdx).toBeGreaterThan(readyIdx);
  });

  it('treats an AMBIGUOUS public broadcast as retryable, never as a failure', () => {
    // Calling an undecided broadcast "failed" is what costs the user money: the post may be on chain, and the only
    // move the UI leaves is to post again — which double-publishes it, two paid records, indistinguishable. Both
    // publish paths must retain the signed external instead and let the resume re-send it under the same seqno.
    const app = readFileSync('web/app.js', 'utf8');

    const ambiguous = app.match(/const ambiguous = publicAmbiguousPublishPatch\(error, '[^']+'\);/g) ?? [];
    expect(ambiguous.length, 'both the post and the comment path classify the throw').toBe(2);
    expect(app.match(/ambiguous \?\? \{ publishStatus: '[^']*failed' \}/g)?.length,
      'and each falls back to the honest terminal only when nothing was signed').toBe(2);

    // The patch is gated on a SIGNED external — its absence is the proof that nothing reached the chain.
    const patch = app.slice(app.indexOf('function publicAmbiguousPublishPatch('));
    expect(patch.slice(0, patch.indexOf('\n}\n')), 'no builtBoc means a clear pre-broadcast failure')
      .toMatch(/if \(!error\?\.builtBoc\) return null;/);

    // The resume re-broadcasts while the external is still valid, and only then falls through to the terminal.
    const resume = app.slice(app.indexOf('function resumePendingPublicPublishConfirmations('));
    const body = resume.slice(0, resume.indexOf('\n}\n') + 3);
    const rebroadcastIdx = body.indexOf('rebroadcastPublicPublish(');
    const terminalIdx = body.indexOf("publishStatus: 'public publish failed'");
    expect(rebroadcastIdx, 'the resume knows how to re-send').toBeGreaterThan(-1);
    expect(terminalIdx, 'and still knows how to give up').toBeGreaterThan(rebroadcastIdx);
    expect(body, 'bounded by the external validity window, not by the give-up deadline')
      .toMatch(/retainedAgeMs <= DIRECT_SEND_REBROADCAST_WINDOW_MS/);
    expect(body, 'and throttled, because the resume fires on every focus')
      .toMatch(/PUBLIC_REBROADCAST_MIN_INTERVAL_MS/);
  });

  it('persists and revives the INTRO send state, and never rebuilds a send that reached the wallet', () => {
    // The two halves of the first-contact fix, pinned where they are wired rather than where they are defined.
    // Persisting without reviving stores a K_root that comes back as an index-keyed object; reviving without
    // persisting reads a field nothing ever wrote. Either way the message looks handled and is not.
    const app = readFileSync('web/app.js', 'utf8');
    expect(app, 'the pending INTRO send goes to the encrypted history')
      .toMatch(/introDirectSend: serializeIntroDirectSend\(message\.introDirectSend\)/);
    expect(app, 'and is decoded on the way back — a spread would leave bytes as numeric-keyed objects')
      .toMatch(/if \(message\.introDirectSend\) message\.introDirectSend = reviveIntroDirectSend\(message\.introDirectSend\);/);

    // The auto-resume may only ever fire for a send that never reached the wallet AND reproduces exactly.
    const resumable = app.slice(app.indexOf('function directPaySendRetryResumable('));
    const body = resumable.slice(0, resumable.indexOf('\n}\n') + 3);
    expect(body, 'nothing broadcast — otherwise the confirm and the idempotent re-broadcast own it')
      .toMatch(/!directSendReachedWallet\(message\)/);
    expect(body, 'and no attachment bytes that a rebuild would silently drop')
      .toMatch(/sendContentSurvivesReload\(message\)/);
    expect(body, 'and a retry really was in flight when the page went away')
      .toMatch(/Number\(message\?\.privateSendRetryAttempt \?\? 0\) > 0/);
    expect(body, 'an exhausted send stays the user\'s call').toMatch(/privateManualRetryAvailable !== true/);
  });

  it('keeps the public lane MEMOISED, so the state it carries can actually be used', () => {
    // The lane used to be rebuilt on every one of its six call sites. That is invisible until something inside
    // the lane keeps state — and then it is worse than visible, it is silent: the thread snapshot cache (an
    // unchanged comment thread must not be re-read) would be born empty on every call and never hit once, while
    // the lane's own tests pass and the app quietly does all the work it was meant to skip.
    const app = readFileSync('web/app.js', 'utf8');
    const reader = app.slice(app.indexOf('function directPublicLaneReader()'));
    const body = reader.slice(0, reader.indexOf('\n}\n') + 3);
    expect(body, 'the built lane is remembered').toMatch(/publicLaneReaderInstance\s*=\s*createPublicLane\(/);
    expect(body, 'and returned again while the transport is the same object')
      .toMatch(/if \(publicLaneReaderInstance && publicLaneReaderTransport === transport\) return publicLaneReaderInstance;/);
    // Keyed on the transport OBJECT: changing the toncenter API key drops and rebuilds it, and the rebuilt one is
    // a different object, so the lane and everything cached under the old key go with it.
    expect(body, 'a dropped transport clears the memo rather than serving a lane bound to a dead one')
      .toMatch(/publicLaneReaderInstance = null;\s*\n\s*publicLaneReaderTransport = null;/);
    expect(app.match(/createPublicLane\(/g)?.length, 'exactly one construction site')
      .toBe(1);
  });

  it('PWA-ROWREF-02: a reply quote scrolls to the nearest match ABOVE it, not the first in the document', () => {
    // [OWNER 2026-08-04] Tapping a reply quote scrolled the conversation somewhere else entirely. The THIRD
    // appearance of one collision: data-entry-id is the RecordShard publish seq, numbered per shard and restarted
    // every epoch, so a conversation spanning two days holds several rows with the same id. querySelector returns
    // the FIRST in document order — the OLDEST — which is why the jump landed far above the target.
    //
    // Copy and reply-targeting were fixed by binding each row to its message object at render time. This one
    // cannot be: the reference arrives ON THE WIRE as a bare id and has to be resolved against the DOM. A reply
    // always refers to something sent before it, so the reply's own position is what disambiguates.
    const app = readFileSync('web/app.js', 'utf8');
    expect(app).toContain('function replyQuoteTargetRow(scroller, quote, refEntryId, snippet) {');
    expect(app, 'the quote resolves through the helper, never by a bare first-match query')
      .toContain('const target = replyQuoteTargetRow(scroller, quote, refEntryId, reply.snippet);');
    expect(app, 'no first-match lookup by entry id survives anywhere')
      .not.toMatch(/querySelector\(`\[data-entry-id=/);

    const fn = app.slice(app.indexOf('function replyQuoteTargetRow('), app.indexOf('// Snippet for a quote strip'));
    expect(fn, 'it considers ALL matches').toMatch(/querySelectorAll\(`\[data-entry-id=/);
    expect(fn, 'and picks by position relative to the replying row')
      .toContain('ownRow.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_PRECEDING');
    // An optimistic reply has no entry id of its own, so the position anchor must fall back to the ROW element —
    // without it every candidate looked equally good and the pick collapsed to "the first one".
    expect(fn).toContain("quote.closest('[data-entry-id]') ?? quote.closest('.message, .comment-item')");
    expect(fn, 'never targeting the reply itself').toContain('if (candidate === ownRow) continue;');
    // Position alone is a COIN FLIP: each direction of a conversation has its own shard and its own seq counter,
    // so within one epoch the user's own message #3 and the peer's #3 both exist. The quoted text is what tells
    // them apart, and it already rides the wire.
    expect(fn, 'the snippet decides').toContain('const matchesSnippet = (row) => {');
    expect(fn).toContain('return snippetAbove ?? snippetAny ?? above ?? matches[0];');
    // Fail SOFT: a target that is not loaded must still scroll somewhere rather than making the tap do nothing.

  });

  it('PWA-ROWREF-01: a rendered row knows its OWN message — never re-derived from a colliding entry id', () => {
    // MEASURED 2026-08-04: long-press-copy a text message on the phone, paste, and the word "Image" came out.
    // A private message's chainEntryId is the RecordShard publish `seq`, numbered PER SHARD and restarted every
    // epoch, so two messages in one conversation share the id and `find` returns the older one — an image-only
    // message whose copy text falls back to the "Image" preview literal. The desktop copy button was right all
    // along because it captures its text at render time; only the path that re-resolved was wrong.
    const app = readFileSync('web/app.js', 'utf8');
    expect(app, 'rows are bound to their message at render time').toMatch(/const messageRowRefs = new WeakMap\(\);/);
    expect(app.match(/(?<!function )rememberMessageForRow\(row, (?:message|comment)\)/g)?.length, 'both row builders bind: private messages AND public comments')
      .toBe(2);
    // Every consumer must ASK THE ROW first. The id lookup stays only as the fallback for a row rendered before
    // this binding existed — it must never be the first answer.
    for (const fn of ['function privateRowCopyText(row) {', 'function publicCommentRowCopyText(row) {', 'function beginPrivateReplyForRow(row) {']) {
      const body = app.slice(app.indexOf(fn), app.indexOf(fn) + 700);
      const boundAt = body.indexOf('messageForRow(row)');
      // The ID lookup specifically — `.find((candidate) => String(candidate.<id>...`. NOT the plain `threads.find`
      // that picks the active thread, which legitimately runs first and matched a looser pattern.
      const lookupAt = body.indexOf('.find((candidate) => String(candidate.');
      expect(boundAt, `${fn} consults the row's own message`).toBeGreaterThan(0);
      expect(boundAt, `${fn} consults it BEFORE the entry-id lookup`).toBeLessThan(lookupAt);
    }
  });

  it('PWA-VAULTWORDS-01: no user-visible string names the deleted Vault, and a label says what its value IS', () => {
    // THIRD TIME TODAY the retired Vault turned up in the interface: "up to X GRAM from Vault" in the channel
    // dialog, "Route: Vault" in the mint dialog, and — spotted by the owner on the unlock modal — "Хранилище:
    // AES-GCM-256 + PBKDF2-SHA256". The last one is the subtle case and worth naming precisely, because it was not
    // a leftover reference at all: `wallet.storageLabel` described the LOCAL encrypted wallet record, which has
    // nothing to do with the Vault contract. It read as a leftover because "Хранилище" is exactly the word the
    // Russian UI used for the Vault, and the label was also simply wrong — its value is a cipher and a KDF, not a
    // place. Renaming it to Encryption fixes the collision and the mislabel in one move.
    const app = readFileSync('web/app.js', 'utf8');
    expect(app).toContain("{ label: t('wallet.encryptionLabel'), value:");
    expect(app, 'the old key is gone from the code').not.toContain('wallet.storageLabel');
    expect(EN_STRINGS['wallet.encryptionLabel']).toBe('Encryption');

    for (const locale of Object.keys(I18N_STRINGS)) {
      const dict = (I18N_STRINGS as Record<string, Record<string, string>>)[locale];
      expect(dict['wallet.storageLabel'], `${locale}: retired key`).toBeUndefined();
      expect(dict['wallet.encryptionLabel'], `${locale}: replacement`).toBeTruthy();
      // vault.name existed only to print "Vault" as a route; the route line went with the Vault itself.
      expect(dict['vault.name'], `${locale}: the Vault's own name is dead copy`).toBeUndefined();
    }
    // The vault.* NAMESPACE stays — it carries the account-activation UI, which is a live feature that merely kept
    // the old prefix. This guard is about STRINGS THE USER READS, not about identifiers.
    expect(app).toContain("t('vault.activateAccount')");
  });

  it('PWA-HONESTGREEN-01: the green means the CHAIN has it, not that the POST returned', () => {
    // OWNER, 2026-08-05: "вижу, что она published и закрываю приложение... придёт это сообщение адресату?" The old
    // answer was "maybe": 'published' was painted the instant toncenter accepted the broadcast, while the external
    // was still in flight — MEASURED at 4-200s to reach a block, and the network demonstrably drops some. With the
    // app closed nothing re-sends it, and the confirm driver only reddened the message on the next launch.
    const app = readFileSync('web/app.js', 'utf8');

    // The broadcast return says 'sending', which is what is actually true at that moment.
    // A confirm-backed lane lands in the sending bucket; the lanes with no verifier opt out — see PWA-HONESTGREEN-03.
    expect(app).toMatch(/function markDirectSendBroadcast\(thread, message, options = \{\}\) \{[\s\S]{0,1600}?: 'sending'\);/);
    expect(app, 'the optimistic-green helper came back').not.toContain('function markDirectSendPublished(');
    // ...and the ONLY place that paints green is the branch that has READ the record out of the shard.
    expect(app).toMatch(/if \(res\.landed\) \{[\s\S]{0,400}?message\.meta = 'published';/);
    // The invariant is not "one place" but "only where the chain was READ". There are exactly two such places, and
    // each is pinned to its proof: the CONV confirm's res.landed branch above, and the INTRO lane's `verified: true`
    // — which is only reachable after confirmIntroCreatedAt matched our entry (see PWA-HONESTGREEN-03).
    expect((app.match(/message\.meta = 'published';/g) ?? []).length, 'a third green appeared — check what proves it').toBe(1);
    expect(app).toMatch(/message\.meta = options\.verified === true\s*\n\s*\? 'published'/);

    // The deadline case that can prove neither side says so, in the SENT bucket — an unverified success, not a failure.
    expect(app).toContain("message.meta = 'sent, not verified';");
    expect(app).toMatch(/else markConvDeliveryUnverified\(thread, message\);/);

    // And the corrected false green must LOOK like a failure. It did not: 'not delivered: ...' matched none of the
    // failure keywords, so the most important negative status in the app rendered as a neutral grey note — visible
    // in the owner's own screenshot next to a genuinely red 'not sent'.
    const bucket = app.slice(app.indexOf('function messageStatusKey'), app.indexOf('function messageStatusKey') + 700);
    expect(bucket).toContain("text.includes('not delivered')");
  });

  it('PWA-HONESTGREEN-04: a pending PUBLIC post is watched while the tab stays open, not only on focus', () => {
    // The public lane's RECORD was already honest — 'public published, confirming' until the feed merge finds the
    // chain twin with the same bodyHash. Two holes around it:
    //   1. The re-broadcast of a retained external and the terminal verdict ran ONLY from focus/pageshow/restore.
    //      A user who published and never left the tab got NEITHER: a dropped external (MEASURED: 2 of 19 in one
    //      session) left the post saying "confirming" forever.
    //   2. The composer status line announced a flat 'public published' on the broadcast return — the same
    //      optimistic claim the private lane was making, just in a different place.
    const app = readFileSync('web/app.js', 'utf8');

    expect(app).toContain("setPublicStatus('public published, confirming');");
    expect(app, 'the flat optimistic claim came back').not.toMatch(/setPublicStatus\('public published'\)/);

    // The visibility loop keeps a tail cadence and drives the resume itself.
    expect(app).toMatch(/const delayMs = PUBLIC_VISIBILITY_SCHEDULE_MS\[attempt\] \?\? PUBLIC_VISIBILITY_TAIL_MS;/);
    expect(app).toMatch(/try \{ await syncPublicChannels\(\); \}[\s\S]{0,260}?resumePendingPublicPublishConfirmations\(\);/);

    // ...and it STOPS. A terminaled record keeps a truthy publishStatus (that flag marks the local copy the merge
    // must carry), so re-arming on "anything pending" would spin forever.
    expect(app).toMatch(/if \(anyPublicPublishStillResolving\(\)\) schedulePublicPublishVisibilityChecks\(attempt \+ 1\);/);
    expect(app).toMatch(/if \(String\(item\.publishStatus \?\? ''\)\.includes\('failed'\)\) continue;/);
    expect(app).toMatch(/if \(Date\.now\(\) - createdAt < PRIVATE_PUBLISH_CONFIRM_NO_PROGRESS_DEADLINE_MS\) return true;/);
  });

  it('PWA-HONESTGREEN-03: only a lane WITH a confirm may leave a message in the sending bucket', () => {
    // A REGRESSION I SHIPPED AND THEN FOUND, twenty minutes live. Making the green conditional on the CONV delivery
    // confirm silently broke the two lanes that have no confirm at all: the INTRO first contact (IntroShard) and
    // self-notes (RecoveryShard slots, never read back). Both called the same helper, so both started saying
    // 'sending' — and nothing anywhere would ever lift them out of it. The message would hang forever.
    //
    // 'sending' is a PROMISE that something resolves it. A lane that cannot keep that promise says 'sent': broadcast,
    // never claimed confirmed. Lying 'published' again would be the other wrong answer.
    const app = readFileSync('web/app.js', 'utf8');
    expect(app).toMatch(/message\.meta = options\.verified === true\s*\n\s*\? 'published'\s*\n\s*: \(options\.awaitsConfirm === false \? 'sent' : 'sending'\);/);

    // EVERY caller is accounted for, and each one must justify its bucket:
    //   armed  — a delivery confirm follows on the next line and will resolve 'sending';
    //   verified — the send already READ the chain itself (INTRO: confirmIntroCreatedAt matches r + view_tag, and
    //              the K_root adoption depends on it, so an unverified INTRO throws rather than reaching here);
    //   opted out — nothing verifies that lane at all, so it must not sit in 'sending' forever.
    const callers = [...app.matchAll(/markDirectSendBroadcast\(thread, message([^)]*)\);\n(.*)/g)]
      .map((m) => ({ opts: m[1], next: m[2] }));
    expect(callers.length, 'a caller appeared or vanished — re-check each one').toBe(4);
    for (const caller of callers) {
      const optedOut = caller.opts.includes('awaitsConfirm: false');
      const verified = caller.opts.includes('verified: true');
      const armed = caller.next.includes('armConvDeliveryConfirm(thread, message)');
      expect(optedOut || verified || armed, `a caller justifies no bucket: ${caller.opts}`).toBe(true);
    }

    // INTRO's green rests on that inline read — if the confirm ever stops gating the adoption, the green becomes a
    // claim nothing supports and this lane must go back to 'sending' with a driver, or to 'sent'.
    const intro = app.slice(app.indexOf('async function attemptIntroFirstContactDirect('),
      app.indexOf("markDirectSendBroadcast(thread, message, { verified: true });"));
    expect(intro, 'INTRO no longer reads its own entry back before adopting').toContain('confirmIntroCreatedAt({');
    expect(intro).toContain('await convKeyStore.upsertConversationKRoot(');
  });

  it('PWA-HONESTGREEN-02: the LAST external keeps a watcher after the send call returns', () => {
    // The final hole in the send path. The wallet re-broadcasts only while a send is RUNNING, so the last external
    // of a message had nobody watching it once the call returned — MEASURED on the owner's wallet at 148s to reach a
    // block on one send, and needing two re-broadcasts on another. Worse, the record that was supposed to enable
    // recovery persisted `result?.result?.boc` — the RPC RESPONSE, which carries no boc — so it stored null on every
    // successful send and the whole idempotent re-broadcast path was dead except after a throw.
    const app = readFileSync('web/app.js', 'utf8');
    const wallet = readFileSync('web/platho-wallet.mjs', 'utf8');

    // The wallet hands back the LAST chunk's signed bytes. The top-level `boc` is the FIRST chunk's (it spreads
    // `first`), which is the wrong one for this job.
    expect(wallet).toContain('pendingBoc: last.boc ?? null,');
    expect(wallet).toContain('pendingValidUntil: last.validUntil ?? null,');
    // ...and the app persists them, with the validity that says when they stop being re-sendable.
    expect(app).toContain('boc: result?.result?.pendingBoc ?? null,');
    expect(app).toContain('validUntil: result?.result?.pendingValidUntil ?? null,');
    expect(app, 'the RPC response was persisted as if it were the external').not.toContain('boc: result?.result?.boc ?? null');

    // The confirm driver re-sends while the shard has not shown the record and the bytes are still alive.
    expect(app).toMatch(/await rebroadcastPendingDirectSend\(send, transport\);\s*\n\s*reArm\(\);/);
    expect(app).toMatch(/if \(now >= validUntilMs\) return;/);
    expect(app).toMatch(/if \(now - Number\(send\.lastRebroadcastAt \?\? 0\) < DIRECT_SEND_CONFIRM_REBROADCAST_MS\) return;/);
    // NEVER a rebuild here: that would bump the conversation seq and seal a new capsule, double-publishing if the
    // first copy was merely late. Only the captured bytes go back out.
    expect(app).toMatch(/await transport\.sendBoc\(\{ boc: send\.boc, walletAddress: plathoWallet\.address \}\)/);
    // Re-armed after a reload too — the record is persisted, which is what covers "the app was closed".
    expect(app).toContain('convDirectSend: safeJsonClone(message.convDirectSend) ?? null,');
  });

  it('PWA-SENDPROFILE-01: a slow publish is measurable by phase, on ONE stopwatch, and it reaches the dump', () => {
    // Owner, 2026-08-04: "скорость важна". Two large images landed 22s and 37s apart on chain — both published, but
    // far past the 1-5s of index lag the seqno fix was expected to cost. Guessing the owner phase is the mistake
    // this project keeps paying for, so the send path gets the same instrument the sync tick has.
    const app = readFileSync('web/app.js', 'utf8');
    const wallet = readFileSync('web/platho-wallet.mjs', 'utf8');
    const transport = readFileSync('web/ton-rpc-transport.mjs', 'utf8');

    // ONE primitive. The sync profile used to carry its own copy of this stopwatch; a second copy in the wallet
    // would make the two lanes' numbers quietly incomparable.
    expect(transport).toContain('export function beginTonRpcPhaseProfile()');
    expect((app.match(/const before = \{ at: startedAt, n: tonRpcRequestCounters\.total/g) ?? []).length,
      'a second copy of the stopwatch reappeared in app.js').toBe(0);
    expect(app).toMatch(/function beginSyncPhaseProfile\(\) \{\s*const profile = beginTonRpcPhaseProfile\(\);/);

    // The phases that answer the question: app work, chain waits, and the per-external gap.
    for (const phase of ['build', 'seqno', 'sign', 'broadcast', 'chunkWait']) {
      expect(wallet, `phase ${phase} is not marked`).toContain(`profile?.mark('${phase}')`);
    }
    // Per-chunk phases are marked more than once and must ACCUMULATE, or a two-external send reports one chunk.
    expect(transport).toMatch(/phases\[name\] = prior\s*\?\s*\{ ms: prior\.ms \+ span\.ms/);
    // Keyed 125ms vs KEYLESS 1100ms multiplies every request-bound phase — a number without it cannot be compared
    // across devices, and part of the userbase runs keyless.
    expect(transport).toMatch(/spacingMs: toncenterScanLaneOptions\(\)\?\.requestSpacingMs \?\? null/);

    // The profiler lives INSIDE the one serial lane, not at the call sites — so a publish path added later is
    // measured automatically instead of silently unmeasured, and the lane's own pins stay byte-identical.
    expect(app).toMatch(/function enqueueOutgoingPublish\(task\) \{\s*\n\s*return outgoingPublishLane\(async \(\) => \{/);
    expect(app).toContain('globalThis.plathoSendPhaseProfile = profile;');
    expect(app).toMatch(/finally \{\s*\n\s*globalThis\.plathoSendPhaseProfile = null;/);
    expect((app.match(/outgoingPublishLane\(/g) ?? []).length, 'the raw lane leaked past the profiler').toBe(1);
    // AND IT IS IN THE DUMP. Twice today I pointed the owner at a counter the dump did not carry; a diagnostic that
    // lives only in a global nobody prints is a note to myself, not a diagnostic.
    expect(app).toContain('sendProfile: globalThis.plathoLastSendProfile ?? null,');
  });

  it('PWA-SPINNER-01: the sync indicator reports WORK, not "has not succeeded yet"', () => {
    // MEASURED on the owner's dump: spinner maxMs 71215, heldBy 'public' — while the public phase of the sync tick
    // itself cost 1974ms and the whole page had spent 16 requests since load. publicSyncPhase was BORN 'syncing'
    // and nothing anywhere set it back to 'syncing': the only transitions in the file were to 'synced'/'delayed'.
    // So the span it drove was "page load -> first successful public sync", regardless of whether anything was
    // running. The private lane never had this because it begins its phase explicitly (beginMessageSyncUi).
    const app = readFileSync('web/app.js', 'utf8');
    expect(app, 'idle until work starts').toMatch(/let publicSyncPhase = 'idle';/);
    const run = app.slice(app.indexOf('async function syncPublicChannelsRun() {'), app.indexOf('async function syncPublicChannelsRun() {') + 400);
    expect(run, 'and the ENTRY is marked, not only the exits').toContain("setPublicSyncPhase('syncing');");
    // Both exits stay — a spinner that starts must always stop, on success and on failure alike.
    expect(app).toContain("setPublicSyncPhase('synced');");
    expect(app).toContain("setPublicSyncPhase('delayed');");
    // The instrument that found it: the spinner's own span, and WHICH flag held it. An OR over three flags hides
    // the culprit completely, which is why measuring the sync tick answered the wrong question.
    expect(app).toContain('globalThis.plathoLastSpinnerSpan = {');
    expect(app).toMatch(/maxHeldBy: spanMs >= Number\(previous\?\.maxMs \?\? 0\) \? heldBy : /);
  });

  it('PWA-PUBCONFIRM-01: a published post stops waiting for the 30s feed timer, and both ladders match the MEASURED index lag', () => {
    // The owner, 2026-08-04: "the private message went in a second, the public post took a while." Both lanes
    // broadcast one wallet transfer and both drop an optimistic record immediately — the difference was what
    // RETIRES the pending badge. Private had its own confirm ladder; public had nothing, so the badge waited for
    // the background feed sync (PUBLIC_BACKGROUND_SYNC_MS = 30s, and it yields to any in-flight send).
    const app = readFileSync('web/app.js', 'utf8');

    // MEASURED against live toncenter: the newest indexed transaction runs 1-5s behind the wall clock (median ~3s)
    // and the masterchain head 1s. The old 12s first tick was calibrated in the Vault era and never re-measured.
    expect(app).toMatch(/const CONV_CONFIRM_SCHEDULE_MS = \[4_000, 9_000, 18_000, 30_000, 45_000, 60_000, 90_000, 120_000\];/);
    expect(app).toMatch(/const PUBLIC_VISIBILITY_SCHEDULE_MS = \[4_000, 9_000, 18_000\];/);

    // Tightening is only safe because the confirm reads bypass the cache — a "has my write landed" question must
    // never be answerable from a cache filled before the write. The spacing is no longer what protects it.
    const confirm = app.slice(app.indexOf('async function runConvDeliveryConfirm('), app.indexOf('async function runConvDeliveryConfirm(') + 2200);
    expect(confirm.match(/cacheTtlMs: 0, priority: 'critical'/g)?.length, 'both readers read fresh').toBe(2);

    // Both publish paths arm the check; a comment is the twin that gets forgotten.
    expect(app.match(/schedulePublicPublishVisibilityChecks\(\);/g)?.length, 'post AND comment').toBe(2);
    // It reuses the existing merge (which already retires a pending record when the chain twin appears) rather
    // than growing a second confirm driver.
    const sched = app.slice(app.indexOf('function schedulePublicPublishVisibilityChecks('), app.indexOf('function schedulePublicPublishVisibilityChecks(') + 1600);
    expect(sched).toMatch(/if \(!anyPendingPublicFeedItem\(\)\) return;/);
    expect(sched).toMatch(/await syncPublicChannels\(\);/);
    // It stops — no standing timer. The re-arm gate is STRICTER than "anything pending": a record that already
    // lost keeps a truthy publishStatus (that flag marks the local copy the merge carries), so the loop also has to
    // stop on it, and on anything past the no-progress deadline. See PWA-HONESTGREEN-04.
    expect(sched, 'no standing timer').toMatch(/if \(anyPublicPublishStillResolving\(\)\) schedulePublicPublishVisibilityChecks\(attempt \+ 1\);/);
    // And it dies with the wallet, like every other timer that holds a transport.
    expect(app.match(/cancelPublicPublishVisibilityChecks\(\);/g)?.length, 'both teardown sites').toBeGreaterThanOrEqual(2);
  });

  it('PWA-HEADING-01: the Heading button reaches the wire as the renderer\'s own markdown', () => {
    // A heading is the one LINE-level format in the composer, so it is the one that cannot be expressed as a pair
    // of delimiters. The chain it has to survive: toolbar -> .fmt-heading span -> serializer -> `# ` on the wire ->
    // MSG_HEADING_RE on the recipient's side -> .msg-heading. A break anywhere in it shows the reader a literal
    // hash, and the writer never sees it.
    const app = readFileSync('web/app.js', 'utf8');
    const html = readFileSync('web/index.html', 'utf8');

    expect(html.match(/data-format="heading"/g)?.length, 'BOTH composers get the button, private and public').toBe(2);
    expect(app, 'and the dispatcher knows it').toMatch(/case 'heading': composerEditorToggleHeading\(editor\); break;/);

    // The serializer emits a PREFIX, not a wrapping delimiter, and starts a line for it — `# ` means nothing
    // mid-line, so a heading that ever ends up after other content must not put a bare hash in the text.
    const ser = app.slice(app.indexOf('function serializeComposerEditor('), app.indexOf('function serializeComposerEditor(') + 5200);
    expect(ser).toMatch(/cls\.contains\('fmt-heading'\)/);
    expect(ser).toMatch(/if \(out && !out\.endsWith\('\\n'\)\) out \+= '\\n';\s*\n\s*const level/);
    expect(ser).toMatch(/out \+= `\$\{'#'\.repeat\(level\)\} \$\{serChildren\(child, ''\)\}`;/);

    // ONE regex for "what is a heading", the receive renderer's own. A second copy in the composer would be free
    // to drift, and the drift is invisible to whoever writes the message.
    const build = app.slice(app.indexOf('function buildComposerEditorDom('), app.indexOf('function buildComposerEditorDom(') + 1400);
    expect(build, 'the rebuild reuses MSG_HEADING_RE').toMatch(/const heading = MSG_HEADING_RE\.exec\(line\);/);
    expect(app.match(/const MSG_HEADING_RE = /g)?.length, 'declared exactly once').toBe(1);
    expect(app, 'no second heading regex anywhere').not.toMatch(/COMPOSER_HEADING_LINE_RE/);
  });
});
