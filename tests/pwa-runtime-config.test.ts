import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
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

const productionConfig = {
  mode: PLATHO_APP_MODES.PRODUCTION,
  domain: 'platho.app',
  network: {
    chain: 'mainnet',
    label: 'mainnet',
    tonRpc: {
      primaryProviderId: 'custom',
      fallbackProviderIds: ['fallback', 'fallback-2'],
      verifyCriticalReads: true,
      criticalMethods: [...PLATHO_APP_CONFIG.network.tonRpc.criticalMethods],
      providers: [
        { id: 'custom', kind: 'custom', globalName: 'plathoCustomTonRpcTransport' },
        {
          id: 'fallback',
          kind: 'toncenter-v3',
          runGetMethodEndpoint: 'https://toncenter.example/api/v3/runGetMethod',
          sendBocEndpoint: 'https://toncenter.example/api/v3/message',
          messagesEndpoint: 'https://toncenter.example/api/v3/messages',
        },
        {
          id: 'fallback-2',
          kind: 'toncenter-v3',
          runGetMethodEndpoint: 'https://toncenter-2.example/api/v3/runGetMethod',
          sendBocEndpoint: 'https://toncenter-2.example/api/v3/message',
          messagesEndpoint: 'https://toncenter-2.example/api/v3/messages',
        },
      ],
      requestTimeoutMs: 15000,
    },
  },
  vault: {
    address: '0:1111111111111111111111111111111111111111111111111111111111111111',
    deploymentManifestHash: `0x${'66'.repeat(32)}`,
    provider: {
      globalName: 'plathoVaultChainProvider',
      moduleUrl: './vault-ton-rpc-provider.mjs',
      exportName: 'default',
      requiredInProduction: true,
    },
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

function currentInlineImportMapCspHashes(): string[] {
  const html = readFileSync('web/index.html', 'utf8');
  const match = html.match(/<script\s+type="importmap">([\s\S]*?)<\/script>/);
  if (!match) throw new Error('web/index.html is missing the inline importmap.');
  const importMap = match[1];
  const canonicalLfImportMap = importMap.replace(/\r\n/g, '\n');
  return unique([
    `sha256-${createHash('sha256').update(importMap).digest('base64')}`,
    `sha256-${createHash('sha256').update(canonicalLfImportMap).digest('base64')}`,
  ]);
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

  it('PWA-CONFIG-01: default workspace config is pinned to verified mainnet production contracts', () => {
    const report = validatePlathoAppConfig(PLATHO_APP_CONFIG);

    expect(report.ok).toBe(true);
    expect(report.mode).toBe(PLATHO_APP_MODES.PRODUCTION);
    expect(PLATHO_APP_CONFIG.network.chain).toBe('mainnet');
    expect(PLATHO_APP_CONFIG.network.tonRpc.requestSpacingMs).toBe(1500);
    expect(PLATHO_APP_CONFIG.network.tonRpc.rateLimitBackoffMs).toBe(60000);
    expect(PLATHO_APP_CONFIG.network.tonRpc.requestTimeoutMs).toBe(15000);
    expect(PLATHO_APP_CONFIG.network.tonRpc.runGetMethodCacheTtlMs).toBe(15000);
    expect(PLATHO_APP_CONFIG.network.tonRpc.runGetMethodCacheMaxEntries).toBe(512);
    expect(PLATHO_APP_CONFIG.network.tonRpc.providers.map((provider) => provider.id)).toEqual([
      'user-custom',
      'toncenter-mainnet',
      'platho-rpc-mainnet',
    ]);
    expect(PLATHO_APP_CONFIG.network.tonRpc.providers.find((provider) => provider.id === 'platho-rpc-mainnet')).toMatchObject({
      runGetMethodEndpoint: 'https://rpc.platho.app/api/v3/runGetMethod',
      messagesEndpoint: false,
      walletBalanceEndpoint: 'https://rpc.platho.app/api/v2/getAddressInformation',
    });
    expect(PLATHO_APP_CONFIG.network.tonRpc.primaryProviderId).toBe('user-custom');
    expect(PLATHO_APP_CONFIG.network.tonRpc.verifyCriticalReads).toBe(true);
    expect(PLATHO_APP_CONFIG.network.tonRpc.criticalMethods).toContain('get_private_entry');
    expect(PLATHO_APP_CONFIG.network.tonRpc.criticalMethods).toContain('get_public_entry');
    expect(PLATHO_APP_CONFIG.network.tonRpc.criticalMethods).toContain('get_avatar_version');
    expect(PLATHO_APP_CONFIG.network.tonRpc.criticalMethods).toContain('get_username_item_address');
    expect(PLATHO_APP_CONFIG.capsuleHub.publicReadLimit).toBe(128);
    expect(PLATHO_APP_CONFIG.vault.address).toBe('UQDjCu9J-a50z8pwgBp9AWpuD9MDQufKiKHPi-1VHRWpQbvc');
    expect(PLATHO_APP_CONFIG.vault.deploymentManifestHash).toBe(
      'a26530cd84ff29b49e3e305eedeead677584ac335277d92cfddb33b665265cdd',
    );
    expect(PLATHO_APP_CONFIG.capsuleHub.address).toBe('UQBgFJQvewAICmABKDysX1-i-nrdLsZlJX-efaNEWXnfEWwG');
    expect(PLATHO_APP_CONFIG.ath.masterAddress).toBe('UQBYtK4_sxTw2Z7bp8DuzQ2Nz09MWU7nmcHmPzovsUN9v087');
    expect(PLATHO_APP_CONFIG.tonDns.rootAddress).toBe(
      '-1:e56754f83426f69b09267bd876ac97c44821345b7e266bd956a7bfbfb98df35c',
    );
    expect(report.findings.map((finding) => finding.id)).not.toContain('PWA_MODE_NOT_PRODUCTION');
    expect(report.findings.map((finding) => finding.id)).not.toContain('PWA_NETWORK_NOT_MAINNET');
    expect(report.findings.map((finding) => finding.id)).toEqual([]);
  });

  it('PWA-CONFIG-01A: Vault preview UI does not expose internal readiness artifacts', () => {
    const vaultText = JSON.stringify({
      cards: PLATHO_APP_CONFIG.ui.vaultCards,
      rows: PLATHO_APP_CONFIG.ui.ledgerRows,
      subtitle: PLATHO_APP_CONFIG.ui.vaultSubtitle,
    });

    expect(PLATHO_APP_CONFIG.ui.vaultCards).toEqual([]);
    expect(PLATHO_APP_CONFIG.ui.vaultActions).toEqual([]);
    expect(PLATHO_APP_CONFIG.ui.ledgerRows).toEqual([]);
    expect(vaultText).not.toMatch(/M20T|readiness|faucet|testgiver/i);
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

    expect(html).not.toMatch(/aria-label="Call"|aria-label="More"|aria-label="Attach"/);
    expect(html).toMatch(/<h1>Platho\.app<\/h1>[\s\S]*Private chats/);
    expect(html).toMatch(/<h1>Platho\.app<\/h1>[\s\S]*Public channels/);
    expect(html).toMatch(/<h1>Platho\.app<\/h1>[\s\S]*Vault/);
    expect(html).toMatch(/<h1>Platho\.app<\/h1>[\s\S]*Profile/);
    expect(html).toMatch(/id="backToChatsButton"/);
    expect(html).toMatch(/aria-label="Private"/);
    expect(html).toMatch(/<span>Private<\/span>/);
    expect(html).toMatch(/Search private/);
    expect(html).toMatch(/id="recipientLocalLabel"/);
    expect(html).toMatch(/Optional, e\.g\. Anonymous/);
    expect(html).toMatch(/xxxx\.ton, or xxxx\.ath/);
    expect(html).toMatch(/Local label is only shown on this device/);
    expect(html).toMatch(/id="identityMenuButton"/);
    expect(html).toMatch(/id="paymentCheckButton"/);
    expect(html).toMatch(/aria-label="Choose display name"/);
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
    expect(html).toMatch(/id="sendWalletTonButton"/);
    expect(html).toMatch(/id="unlockWalletStatus"/);
    expect(html).toMatch(/Receive TON/);
    expect(html).toMatch(/Send TON/);
    expect(html).toMatch(/id="exportWalletKeyButton"/);
    expect(html).toMatch(/id="importWalletKeyButton"/);
    expect(html).toMatch(/id="walletKeyBackupInput"/);
    expect(html).toMatch(/Export wallet key/);
    expect(html).toMatch(/Import wallet key/);
    expect(html).toMatch(/id="copyWalletAddressButton"/);
    expect(html).toMatch(/aria-label="Copy wallet address"/);
    expect(html).toMatch(/id="walletDisplayModeSelect"/);
    expect(html).toMatch(/<option value="address">Address<\/option>/);
    expect(html).not.toMatch(/<option value="ton_dns">TON DNS<\/option>/);
    expect(html).toMatch(/<option value="platho_nft">Platho name<\/option>/);
    expect(app).toMatch(/Wallet address copied/);
    expect(app).toMatch(/flashWalletIdentityStatus/);
    expect(app).toMatch(/walletIdentityFlashTimer/);
    expect(app).toMatch(/copyTextToClipboard/);
    expect(app).toMatch(/confirmWalletReplacement/);
    expect(app).toMatch(/Replace local wallet\?/);
    expect(app).toMatch(/Export the current recovery phrase first/);
    expect(app).toMatch(/tone: 'muted'/);
    expect(app).toMatch(/Import and replace/);
    expect(app).toMatch(/platho\.wallet\.encrypted\.v1/);
    expect(app).toMatch(/platho\.wallet\.recovery\.v1/);
    expect(app).toMatch(/AES-GCM-256/);
    expect(app).toMatch(/PBKDF2-SHA256/);
    expect(app).toMatch(/PLATHO_WALLET_PASSWORD_MIN_LENGTH = 10/);
    expect(app).toMatch(/PLATHO_WALLET_PASSWORD_RECOMMENDED_LENGTH = 20/);
    expect(app).toMatch(/Use your browser password manager/);
    expect(app).not.toMatch(/generate-wallet-password/);
    expect(app).not.toMatch(/PasswordCredential/);
    expect(app).not.toMatch(/passwordrules/);
    expect(app).toMatch(/input\.minLength = field\.minLength/);
    expect(app).toMatch(/minLength: create \? PLATHO_WALLET_PASSWORD_MIN_LENGTH : undefined/);
    expect(app).toMatch(/storedNetworkGlobalId/);
    expect(app).toMatch(/PLATHO_WALLET_ADDRESS_METADATA_MISMATCH/);
    expect(app).toMatch(/Password accepted, but stored wallet metadata is inconsistent/);
    expect(app).toMatch(/PLATHO_WALLET_KEY_BACKUP_KIND = 'platho\.wallet\.key\.backup\.v1'/);
    expect(app).toMatch(/walletKeyBackupFromRecord/);
    expect(app).toMatch(/offerEncryptedWalletKeyBackup/);
    expect(app).toMatch(/Save wallet key backup/);
    expect(app).toMatch(/Save encrypted key/);
    expect(app).toMatch(/browser storage can be cleared, especially on iPhone Safari/);
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
    expect(app).toMatch(/actionCancelButton\.hidden = !dismissible/);
    expect(app).toMatch(/actionCancelButton\.disabled = !dismissible/);
    expect(app).toMatch(/activeActionDialog\?\.dismissOnBackdrop !== false\) closeActionDialog\(null\)/);
    expect(app).toMatch(/dismissOnBackdrop: false/);
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
    expect(app).toMatch(/Change wallet password/);
    expect(app).toMatch(/Set new wallet password/);
    expect(app).toMatch(/Password changed/);
    expect(app).toMatch(/Wallet key exported/);
    expect(app).toMatch(/Wallet key imported/);
    expect(app).toMatch(/showReceiveWalletTonDialog/);
    expect(app).toMatch(/createWalletReceiveQrNode/);
    expect(app).toMatch(/createQrSvgDataUrl/);
    expect(app).toMatch(/submitWalletTonTransfer/);
    expect(app).toMatch(/local Platho wallet, not Vault/);
    expect(app).toMatch(/TON transfer submitted/);
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
    expect(html).toMatch(/class="profile-scroll-content"/);
    expect(html).toMatch(/class="vault-scroll-content"/);
    expect(css).toMatch(/\.profile-scroll-content/);
    expect(css).toMatch(/\.vault-scroll-content/);
    expect(css).toMatch(/overflow-y: auto/);
    expect(css).toMatch(/scrollbar-width: none/);
    expect(css).toMatch(/::-webkit-scrollbar/);
    expect(css).not.toMatch(/@media \(min-width: 901px\) and \(max-width: 1180px\)/);
    expect(css).toMatch(/\.app-shell\s*{[\s\S]*max-width: 100vw;[\s\S]*overflow: hidden;/);
    expect(css).toMatch(/\.workspace\s*{[\s\S]*grid-template-columns: minmax\(280px, clamp\(280px, 32vw, 392px\)\) minmax\(0, 1fr\);/);
    expect(css).toMatch(/\.chat-pane\s*{[\s\S]*max-width: 100%;[\s\S]*overflow: hidden;/);
    expect(css).toMatch(/\.conversation-header\s*{[\s\S]*display: grid;[\s\S]*grid-template-columns: 64px minmax\(0, 1fr\) max-content;[\s\S]*overflow: hidden;/);
    expect(css).toMatch(/\.composer\s*{[\s\S]*max-width: 100%;[\s\S]*overflow: hidden;/);
    expect(css).toMatch(/\.message-strip\s*{[\s\S]*display: flex;[\s\S]*flex-direction: column;[\s\S]*overflow-y: auto;/);
    expect(css).toMatch(/\.message-strip::before\s*{[\s\S]*margin-top: auto;/);
    expect(css).toMatch(/\.message\.out\s*{[\s\S]*align-self: flex-end;/);
    expect(css).toMatch(/\.conversation-title h2,\s*\.conversation-title p\s*{\s*overflow: hidden;\s*text-overflow: ellipsis;\s*white-space: nowrap;/);
    expect(css).toMatch(/\.header-actions\s*{\s*display: flex;\s*align-items: center;\s*justify-content: flex-end;\s*gap: 8px;\s*flex: 0 0 auto;\s*min-width: max-content;/);
    expect(css).not.toMatch(/@media \(min-width: 680px\) and \(max-width: 900px\)/);
    expect(css).toMatch(/\.public-pane,\s*\.vault-pane,\s*\.profile-pane,\s*\.list-pane\s*{\s*padding: 24px;/);
    expect(css).toMatch(/\.list-pane\s*{\s*gap: 14px;\s*border-right: 0;\s*}/);
    expect(css).toMatch(/\.public-composer\s*{\s*margin: 0 -24px -24px;\s*padding: 12px 24px/);
    expect(css).toMatch(/\.vault-move-list\s*{\s*display: grid;\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
    expect(css).toMatch(/\.vault-asset-move-header\s*{\s*grid-template-columns: minmax\(0, 1fr\) auto;/);
    expect(css).toMatch(/\.vault-asset-move-body\s*{\s*grid-template-columns: max-content minmax\(0, 1fr\);/);
    expect(css).toMatch(/\.vault-asset-route\s*{\s*display: grid;[\s\S]*grid-template-columns: 54px 32px 54px;[\s\S]*gap: 4px;[\s\S]*width: max-content;[\s\S]*max-width: 100%;[\s\S]*padding: 4px;/);
    expect(css).toMatch(/\.vault-asset-switch\s*{\s*width: 32px;\s*height: 32px;/);
    expect(css).toMatch(/\.icon-swap-circular\s*{\s*--mask: url\("\.\/assets\/icons\/swap-circular\.svg"\);/);
    expect(html).toMatch(/icon-swap-circular/);
    expect(css).toMatch(/\.vault-asset-amount\s*{\s*display: grid;[\s\S]*grid-template-columns: minmax\(44px, 1fr\) minmax\(58px, auto\);[\s\S]*width: 100%;\s*max-width: none;\s*justify-self: stretch;/);
    expect(css).toMatch(/\.vault-asset-amount button\s*{\s*min-width: 58px;/);
    expect(css).toMatch(/\.balance-grid,\s*\.vault-move-list,\s*\.action-grid,\s*\.wallet-ton-group\s*{\s*grid-template-columns: 1fr;/);
    expect(css).toMatch(/\.vault-asset-move-body\s*{\s*grid-template-columns: max-content minmax\(0, 1fr\);/);
    expect(app).toMatch(/walletBalanceInfoEndpoint/);
    expect(app).toMatch(/createTonRpcTransport/);
    expect(app).toMatch(/installConfiguredTonRuntime/);
    expect(app).toMatch(/plathoTonRpcTransport/);
    expect(app).toMatch(/plathoTonRpcEndpoint/);
    expect(app).toMatch(/plathoTonSendBocEndpoint/);
    expect(PLATHO_APP_CONFIG.vault.address).toBe('UQDjCu9J-a50z8pwgBp9AWpuD9MDQufKiKHPi-1VHRWpQbvc');
    expect(PLATHO_APP_CONFIG.capsuleHub.address).toBe('UQBgFJQvewAICmABKDysX1-i-nrdLsZlJX-efaNEWXnfEWwG');
    expect(PLATHO_APP_CONFIG.ath.masterAddress).toBe('UQBYtK4_sxTw2Z7bp8DuzQ2Nz09MWU7nmcHmPzovsUN9v087');
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
    expect(app).toMatch(/permanent name, currently owned by this wallet/);
    expect(app).not.toMatch(/No TON DNS linked/);
    expect(app).not.toMatch(/Optional setup', value: 'Link TON DNS in Usernames and Avatars/);
    expect(app).toMatch(/No \.ath name linked/);
    expect(app).toMatch(/Optional setup', value: 'Link \.ath name in Usernames and Avatars/);
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
    expect(app).toMatch(/platho-local-message-history-v1/);
    expect(app).toMatch(/platho-local-security-v1/);
    expect(app).toMatch(/localStorageOrNull\(\)\?\.clear\(\)/);
    expect(app).toMatch(/globalThis\.sessionStorage\?\.clear\?\.\(\)/);
    expect(app).toMatch(/caches\.keys\(\)/);
    expect(app).toMatch(/navigator\.serviceWorker\?\.getRegistrations/);
    expect(html).toMatch(/<h2>Wallet<\/h2>[\s\S]*id="createWalletButton"[\s\S]*id="unlockWalletButton"[\s\S]*id="changeWalletPasswordButton"[\s\S]*id="walletTonBalanceButton"[\s\S]*id="registerVaultKeysButton"/);
    expect(html).toMatch(/Wallet TON[\s\S]*id="walletTonBalanceStatus"/);
    expect(html).toMatch(/Activate Platho account[\s\S]*id="vaultDraftStatus"[\s\S]*wallet required/);
    expect(html).toMatch(/<h2>Messages<\/h2>[\s\S]*id="syncMessagesButton"[\s\S]*id="replaceVaultKeysButton"/);
    expect(html).toMatch(/Sync messages[\s\S]*tap to sync/);
    expect(html).toMatch(/Replace message keys[\s\S]*activate account first/);
    expect(app).toMatch(/up to date/);
    expect(app).toMatch(/hasActiveVaultMessagingKeys/);
    expect(app).toMatch(/hasActivePlathoAccount/);
    expect(app).toMatch(/plathoAccountActivationFeeLabel/);
    expect(app).toMatch(/walletTonBalanceButton\?\.addEventListener\('click'/);
    expect(app).toMatch(/Activate Platho account first/);
    expect(app).toMatch(/item\.dataset\.tab !== 'profile'/);
    expect(app).toMatch(/requestAnimationFrame\(\(\) => \{[\s\S]*!hasActivePlathoAccount\(\)[\s\S]*setView\('profile'\)/);
    expect(app).toMatch(/setView\('profile'\)/);
    expect(app).toMatch(/await refreshVaultActivationStatus\(\{ skipGlobal: true \}\)/);
    expect(app).toMatch(/setText\(vaultRecordStatus, 'checking'\)/);
    expect(app).toMatch(/setText\(vaultDraftStatus, 'checking'\)/);
    expect(app).not.toMatch(/rotate blocked/);
    expect(app).not.toMatch(/setText\(vaultRotateStatus, label\)/);
    expect(app).not.toMatch(/vaultDraftStatus\.textContent = 'ready'/);
    expect(app).toMatch(/Export key and activate/);
    expect(app).toMatch(/backupConfirmed/);
    expect(app).toMatch(/activationConfirmed/);
    expect(app).toMatch(/downloadEncryptedWalletKeyBackup\(\)/);
    expect(app).toMatch(/VAULT_RECEIVE_CRYPTO_SUITE = CRYPTO_SUITES\.HYBRID_V1/);
    expect(app).toMatch(/loadMessagingIdentityFromWallet\(VAULT_RECEIVE_CRYPTO_SUITE\)/);
    expect(app).not.toMatch(/postquantum only/);
    expect(app).not.toContain('crypto_suite_mask} / ${localVaultDraft.json.pq_kem_pubkey_len}b');
    expect(html).toMatch(/id="setAvatarButton"/);
    expect(html).toMatch(/id="profileAvatarInput"/);
    expect(html).toMatch(/Set avatar/);
    expect(app).toMatch(/readCurrentProfileAvatarPointerFromChain/);
    expect(app).toMatch(/waitForProfileAvatarRegistryUpdate/);
    expect(app).toMatch(/ProfileRegistry provider is required to read current avatar version/);
    expect(app).toMatch(/if \(view === 'profile' && plathoWallet\?\.address\)/);
    expect(app).toMatch(/assertVaultProfileAvatarCanStart/);
    expect(app).toMatch(/submitVaultProfileAvatarRegistration/);
    expect(app).toMatch(/requireProfileRegistryVaultRoute/);
    expect(app).toMatch(/ProfileRegistry is not bound back to Vault/);
    expect(app).toMatch(/ProfileRegistry official ATH wallet is not the derived registry wallet/);
    expect(app).toMatch(/avatar not active yet/);
    expect(app).toMatch(/avatar registration not confirmed/);
    expect(html).toMatch(/<h2>Public channels<\/h2>[\s\S]*id="publicSyncWindowSelect"[\s\S]*id="publicCommentsDefaultSelect"/);
    expect(html).toMatch(/<h2>Usernames and Avatars<\/h2>[\s\S]*id="mintUsernameButton"[\s\S]*id="linkUsernameButton"[\s\S]*id="setAvatarButton"/);
    expect(html).toMatch(/Mint \.ath name[\s\S]*100-10k ATH \+ TON fee/);
    expect(html).not.toMatch(/Link TON DNS[\s\S]*id="linkedTonDnsStatus"[\s\S]*verify/);
    expect(html).toMatch(/Link \.ath name[\s\S]*id="linkedUsernameStatus"[\s\S]*verify/);
    expect(app).not.toMatch(/linkTonDnsButton\?\.addEventListener\('click'/);
    expect(app).not.toMatch(/requestWalletDisplayIdentity\(WALLET_DISPLAY_MODES\.TON_DNS\)/);
    expect(app).toMatch(/linkUsernameButton\?\.addEventListener\('click'/);
    expect(app).toMatch(/requestWalletDisplayIdentity\(WALLET_DISPLAY_MODES\.PLATHO_NFT\)/);
    expect(app).toMatch(/setPublicChannelSubscribed/);
    expect(app).toMatch(/Unfollow/);
    expect(app).toMatch(/channel hidden/);
    expect(app).toMatch(/Hide \$\{channel\.name\} from Public feed and Channels/);
    expect(app).toMatch(/const linked = readLinkedPlathoUsername\(plathoWallet\.address\)/);
    expect(app).toMatch(/autoLinkMintedUsername/);
    expect(app).toMatch(/waitForPlathoUsernameOwnership/);
    expect(app).toMatch(/mint submitted; link after sync/);
    expect(app).toMatch(/100-10k ATH by length; 50% goes to burn/);
    expect(app).toMatch(/estimatedUsernameMintTonFeeNanotons/);
    expect(app).toMatch(/up to \$\{formatTonNanotons\(estimatedUsernameMintTonFeeNanotons\(\)\)\} TON from Vault/);
    expect(app).toMatch(/assertVaultUsernameMintCanStart/);
    expect(app).toMatch(/submitVaultUsernameMint/);
    expect(app).toMatch(/requireUsernameRegistryVaultRoute/);
    expect(app).toMatch(/UsernameRegistry is not bound back to Vault/);
    expect(app).toMatch(/UsernameRegistry official ATH wallet is not the derived registry wallet/);
    expect(app).toMatch(/ATH; 50% goes to burn/);
    expect(html).toMatch(/Set avatar[\s\S]*100 ATH \+ TON fee/);
    expect(app).toMatch(/Set profile avatar/);
    expect(app).toMatch(/requestProfileAvatarUploadDetails/);
    expect(app).toMatch(/estimatedProfileAvatarTonFeeNanotons/);
    expect(app).toMatch(/up to \$\{formatTonNanotons\(estimatedProfileAvatarTonFeeNanotons\(attachment\)\)\} TON/);
    expect(app).toMatch(/Preview final image/);
    expect(html).toMatch(/id="imageLightboxDialog"/);
    expect(html).toMatch(/Full-size preview/);
    expect(html).toMatch(/id="imageLightboxDownloadButton"/);
    expect(html).toMatch(/class="icon icon-download"/);
    expect(html).toMatch(/<div class="image-lightbox-viewport">\s*<img id="imageLightboxImage" alt="Full-size final image preview">\s*<\/div>\s*<\/section>\s*<\/div>/);
    expect(app).toMatch(/openImageLightbox/);
    expect(app).toMatch(/downloadImageLightboxImage/);
    expect(app).toMatch(/imageLightboxDownloadFilename/);
    expect(app).toMatch(/fullImageSrc/);
    expect(app).toMatch(/messageImageLightboxMeta/);
    expect(app).toMatch(/messageStrip\?\.addEventListener\('click'/);
    expect(app).toMatch(/messageStrip\?\.addEventListener\('keydown'/);
    expect(css).toMatch(/data-full-image-src/);
    expect(css).toMatch(/\.message-image\s*{\s*cursor: zoom-in;/);
    expect(css).toMatch(/image-lightbox-viewport/);
    expect(css).toMatch(/max-height: calc\(var\(--app-viewport-height, 100dvh\)/);
    expect(css).toMatch(/\.image-lightbox-backdrop/);
    expect(css).toMatch(/\.image-lightbox-backdrop\s*{[\s\S]*place-items: center;/);
    expect(css).toMatch(/\.image-lightbox-actions/);
    expect(css).toMatch(/\.icon-download/);
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*\.modal-backdrop\s*{\s*align-items: center;/);
    expect(css).toMatch(/icon-open-app/);
    expect(app).toMatch(/On-chain size/);
    expect(app).toMatch(/requestCompressedImageFile/);
    expect(app).toMatch(/The final WebP bytes are encrypted before publish and verified by CapsuleHub hashes/);
    expect(app).toMatch(/The final WebP bytes are public in the accepted TON transaction body and verified by CapsuleHub hashes/);
    expect(app).not.toMatch(/remain in on-chain capsules/);
    expect(app).toMatch(/encodeCanvasToWebp/);
    expect(app).toMatch(/isWebpBytes/);
    expect(app).toMatch(/nativeCanvasWebpEncodeSupported = false/);
    expect(app).toMatch(/Image encoder did not produce WebP bytes/);
    expect(app).toMatch(/avatar media is public/);
    expect(html).toMatch(/<h2>ATH<\/h2>[\s\S]*id="athSupplyStatus"[\s\S]*id="athDropIssuedStatus"[\s\S]*id="burnAthButton"/);
    expect(html).toMatch(/id="replaceVaultKeysButton"/);
    expect(html).toMatch(/id="syncMessagesButton"/);
    expect(html).not.toMatch(/id="keySuiteStatus"/);
    expect(app).toMatch(/installActionState/);
    expect(app).toMatch(/Got it/);
    expect(app).toMatch(/Platho is already installed on this device/);
    expect(app).toMatch(/getInstalledRelatedApps/);
    expect(app).toMatch(/Open Platho app/);
    expect(app).toMatch(/Open or install Platho/);
    expect(app).toMatch(/How to install on iPhone/);
    expect(app).toMatch(/isIosDevice/);
    expect(app).toMatch(/Open platho\.app in Safari/);
    expect(app).toMatch(/Choose Add to Home Screen/);
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
    expect(app).toMatch(/Update ready/);
    expect(app).toMatch(/window\.location\.reload\(\)/);
    expect(html).toMatch(/id="installLead"/);
    expect(html).toMatch(/id="installBody"/);
    expect(manifest).toMatch(/"platform": "webapp"/);
    expect(manifest).toMatch(/"url": "https:\/\/platho\.app\/manifest\.webmanifest"/);
    expect(html).toMatch(/id="publicSyncWindowSelect"/);
    expect(html).toMatch(/id="publicCommentsDefaultSelect"/);
    expect(html).toMatch(/>Closed</);
    expect(html).toMatch(/>Allowed - not recommended</);
    expect(html).toMatch(/<option value="disabled">Closed<\/option>[\s\S]*<option value="enabled">Allowed - not recommended<\/option>/);
    expect(html).toMatch(/All retained history · slow sync/);
    expect(html).toMatch(/id="walletAddressStatus"/);
    expect(html).toMatch(/id="mintUsernameButton"/);
    expect(html).toMatch(/id="flushUsernameRefundButton"/);
    expect(html).toMatch(/Claim failed mint refund/);
    expect(html).not.toMatch(/Claim username refund/);
    expect(html).not.toMatch(/id="transferAthButton"/);
    expect(html).toMatch(/id="burnAthButton"/);
    expect(html).toMatch(/Wallet and Vault are separate for security/);
    expect(html).toMatch(/data-nav-vault-balance/);
    expect(html).toMatch(/data-nav-vault-ton>0 TON<\/strong>/);
    expect(html).toMatch(/data-nav-vault-ath>0 ATH<\/strong>/);
    expect(css).toMatch(/\.rail-vault-balance/);
    expect(css).toMatch(/\.rail-vault-balance strong\s*{[\s\S]*white-space: normal;/);
    expect(app).toMatch(/navVaultTonBalances/);
    expect(app).toMatch(/refreshNavVaultBalance\(\)/);
    expect(app).toMatch(/function refreshVaultNavBalanceInBackground/);
    expect(html).toMatch(/id="vaultMoveTonForm"/);
    expect(html).toMatch(/id="vaultMoveAthForm"/);
    expect(html).toMatch(/id="vaultMoveTonWalletBalance"[^>]*>0<\/strong>/);
    expect(html).toMatch(/id="vaultMoveTonVaultBalance"[^>]*>0<\/strong>/);
    expect(html).toMatch(/id="vaultMoveAthWalletBalance"[^>]*>0<\/strong>/);
    expect(html).toMatch(/id="vaultMoveAthVaultBalance"[^>]*>0<\/strong>/);
    expect(html).toMatch(/id="vaultMoveTonDirectionButton"/);
    expect(html).toMatch(/id="vaultMoveAthDirectionButton"/);
    expect(html).toMatch(/Move TON to Vault/);
    expect(html).toMatch(/Move ATH to Vault/);
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

    expect(html).not.toMatch(/<textarea id="messageInput"[^>]*maxlength=/);
    expect(html).not.toMatch(/<textarea id="publicMessageInput"[^>]*maxlength=/);
    expect(html).not.toMatch(/1024 bytes max/);
    expect(app).toMatch(/removeAttribute\('maxlength'\)/);
    expect(html).toMatch(/id="privateComposerCostStatus"/);
    expect(html).toMatch(/id="publicComposerCostStatus"/);
    expect(html).not.toMatch(/Price checking\s+Wallet required/);
    expect(app).toMatch(/if \(!plathoWallet\) \{/);
    expect(app).toMatch(/text: 'Wallet required'/);
    expect(app).toMatch(/return publicCommentTarget \? 'Public comment' : 'Public message'/);
    expect(app).toMatch(/return 'Private message'/);
    expect(html).toMatch(/id="publicComposer"/);
    expect(html).toMatch(/id="publicComposerCommentsCheckbox"/);
    expect(html).toMatch(/id="publicComposer"[\s\S]*id="publicComposerCommentsCheckbox"[\s\S]*<textarea id="publicMessageInput"/);
    expect(html).toMatch(/Allow comments/);
    expect(app).toMatch(/Open public comments\?/);
    expect(app).toMatch(/Publish with comments/);
    expect(app).toMatch(/Private chat/);
    expect(app).toMatch(/openPrivateThreadForWallet/);
    expect(app).toMatch(/Add public channel/);
    expect(app).toMatch(/ATH protocol-fee discount/);
    expect(app).toMatch(/locked until activity airdrop is fully distributed/);
    expect(app).toMatch(/Platho fee 0 TON/);
    expect(app).toMatch(/max reduction 0\.010 TON/);
    expect(app).not.toMatch(/ATH discount \$\{percent\}/);
    expect(app).not.toMatch(/locked until 15%/);
    expect(app).toMatch(/messageDiscountUnlocked/);
    expect(app).toMatch(/Cost/);
    expect(app).toMatch(/Hold/);
    expect(app).toMatch(/composerEstimatedNetCostNanotons/);
    expect(app).toMatch(/composerSuccessfulPublishRefundNanotons/);
    expect(app).toMatch(/function confirmPublishPriceIncrease/);
    expect(app).toMatch(/The chain returned a higher fresh price before signing/);
    expect(app).toMatch(/Send with new price/);
    expect(app).toMatch(/function confirmHighNetworkFeeSurcharge/);
    expect(app).toMatch(/High network surcharge/);
    expect(app).toMatch(/Manual network fee override/);
    expect(app).toMatch(/requiresHighNetworkFeeSurchargeConfirmation/);
    expect(app).toMatch(/requiresManualNetworkFeeSurchargeOverride/);
    expect(app).toMatch(/networkFeeSurchargeExceedsMax/);
    expect(app).toMatch(/function assertNetworkFeeSurchargeWithinCap/);
    expect(app).toMatch(/assertNetworkFeeSurchargeWithinCap\(\);[\s\S]*const surcharge = currentNetworkFeeSurchargeNanotons\(\)/);
    expect(app).toMatch(/composerPublishProfilesForCapsules/);
    expect(app).toMatch(/function createCapsulePublishState/);
    expect(app).toMatch(/function setPublishPartStatus/);
    expect(app).toMatch(/function confirmCapsuleHubPublishEntries/);
    expect(app).toMatch(/async function prepareCapsulesThroughVault/);
    expect(app).toMatch(/async function sendPreparedCapsulesThroughVault/);
    expect(app).toMatch(/CAPSULEHUB_PUBLISH_STATUS_CONFIRMED/);
    expect(app).toMatch(/VAULT_PUBLISH_STATUS_PARTIAL/);
    expect(app).toMatch(/submitted \$\{pending\}\/\$\{total\}, confirming/);
    expect(app).toMatch(/publishState: message\.publishState/);
    expect(app).toMatch(/updateMessageInEncryptedHistory/);
    expect(app).toMatch(/attemptCancelPaymentCheckAfterPublishFailure/);
    expect(app).toMatch(/Persistent encrypted local history is required before creating a payment check/);
    expect(app).toMatch(/check intent create pending/);
    expect(app).toMatch(/isPublishPriceChangeCancelled/);
    expect(app).toMatch(/publish cancelled/);
    expect(app).toMatch(/Send cancelled/);
    expect(app).toMatch(/assertVaultHasPrivatePublishHold/);
    expect(app).toMatch(/Not enough Vault TON/);
    expect(app).toMatch(/Checking Vault balance/);
    expect(app).toMatch(/privateComposerKnownVaultTonShortfall/);
    expect(app).toMatch(/networkFeeSurchargeNanotons/);
    expect(app).toMatch(/surcharge is retained by CapsuleHub reserve/);
    expect(app).toMatch(/not accrued_plato_fee_ton at publish time/);
    expect(app).toMatch(/Surplus reserve may later be swept by protocol reserve rules/);
    expect(app).toMatch(/function privateImageAttachmentPartCount/);
    expect(app).toMatch(/partCounter: kind === 'private' \? privateImageAttachmentPartCount : imageAttachmentPartCount/);
    expect(app).toMatch(/partCounter: options\.partCounter/);
    expect(app).toMatch(/Local label/);
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
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*\.conversation-header\s*{[\s\S]*display: grid;[\s\S]*grid-template-columns: 38px 44px minmax\(0, 1fr\) max-content;/);
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*\.conversation-header \.conversation-title h2,\s*\.conversation-header \.conversation-title p,\s*\.conversation-header \.identity-title-label\s*{[\s\S]*max-width: 100%;/);
    expect(css).toMatch(/\.composer-cost-status\s*{[\s\S]*overflow-wrap: anywhere;/);
    expect(css).toMatch(/\.message\[data-status="sending"\] \.bubble/);
    expect(app).toMatch(/function identityDisplayKey/);
    expect(app).toMatch(/function uniqueDisplayIdentityVariants/);
    expect(app).toMatch(/function messageMetaText/);
    expect(app).toMatch(/meta: 'sending'/);
    expect(app).toMatch(/message\.meta = 'send failed'/);
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*\.rail-item span:last-child\s*{[\s\S]*text-overflow: ellipsis;/);
  });

  it('PWA-CONFIG-01D2: publish path confirms fresh chain price increases before sendBoc', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const prepareSource = app.slice(
      app.indexOf('async function prepareCapsulesThroughVault'),
      app.indexOf('async function sendPreparedCapsulesThroughVault'),
    );
    const publishSource = app.slice(
      app.indexOf('async function publishCapsulesThroughVault'),
      app.indexOf('function rememberLocalPublicPost'),
    );
    const quoteIndex = prepareSource.indexOf('const quotedProfiles = composerPublishProfilesForCapsules(normalizedCapsules)');
    const freshIndex = prepareSource.indexOf('const finalNetCost = composerNetCostFromHoldNanotons(totalMaxCharge, normalizedCapsules.length)');
    const confirmIndex = prepareSource.indexOf('confirmPublishPriceIncrease');

    expect(quoteIndex).toBeGreaterThanOrEqual(0);
    expect(freshIndex).toBeGreaterThan(quoteIndex);
    expect(confirmIndex).toBeGreaterThan(freshIndex);
    expect(prepareSource).not.toMatch(/sendVaultExternalBoc/);
    expect(prepareSource).toMatch(/throw publishPriceChangeCancelledError\(\)/);
    expect(publishSource).toMatch(/const prepared = await prepareCapsulesThroughVault\(capsules, options\)/);
    expect(publishSource).toMatch(/return sendPreparedCapsulesThroughVault\(prepared, options\)/);
  });

  it('PWA-SEND-01: publish preparation blocks over-cap network surcharge before signing external BOCs', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const capSource = app.slice(
      app.indexOf('function assertNetworkFeeSurchargeWithinCap'),
      app.indexOf('function messageDiscountUnlocked'),
    );
    const prepareSource = app.slice(
      app.indexOf('async function prepareCapsulesThroughVault'),
      app.indexOf('async function sendPreparedCapsulesThroughVault'),
    );
    const capIndex = prepareSource.indexOf('assertNetworkFeeSurchargeWithinCap();');
    const surchargeIndex = prepareSource.indexOf('const surcharge = currentNetworkFeeSurchargeNanotons()');
    const buildIndex = prepareSource.indexOf('const external = await buildVaultBalancePublishExternalBoc');
    const balanceIndex = prepareSource.indexOf('if (balance < totalMaxCharge)');
    const priceConfirmIndex = prepareSource.indexOf('confirmPublishPriceIncrease');
    const surchargeConfirmIndex = prepareSource.indexOf('confirmHighNetworkFeeSurcharge');

    expect(capSource).toMatch(/networkFeeSurchargeExceedsMax\(estimate, pricingOptions\)/);
    expect(capSource).toMatch(/throw new Error\(`Network surcharge/);
    expect(capSource).toMatch(/exceeds the production cap/);
    expect(capIndex).toBeGreaterThanOrEqual(0);
    expect(surchargeIndex).toBeGreaterThan(capIndex);
    expect(balanceIndex).toBeGreaterThan(surchargeIndex);
    expect(priceConfirmIndex).toBeGreaterThan(balanceIndex);
    expect(surchargeConfirmIndex).toBeGreaterThan(priceConfirmIndex);
    expect(buildIndex).toBeGreaterThan(surchargeConfirmIndex);
    expect(prepareSource).not.toMatch(/sendVaultExternalBoc/);
  });

  it('PWA-SEND-01B: private preflight shows actionable blocked reasons instead of generic send blocked', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const helperSource = app.slice(
      app.indexOf('function privateSendPreflightStatusText'),
      app.indexOf('function messageDiscountUnlocked'),
    );
    const submitStart = app.indexOf("composer?.addEventListener('submit'");
    const submitSource = app.slice(
      submitStart,
      app.indexOf('const message = {', submitStart),
    );

    expect(helperSource).toMatch(/Activate Platho account before sending/);
    expect(helperSource).toMatch(/network surcharge .* exceeds the production cap/i);
    expect(helperSource).toMatch(/RPC verification unavailable/);
    expect(submitSource).toMatch(/privateSendPreflightStatusText\(error\)/);
    expect(submitSource).not.toMatch(/\? messageText : 'Send blocked'/);
  });

  it('PWA-SEND-02: prepared multi-capsule send waits for nonce before the next BOC and preserves partial state', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const sendSource = app.slice(
      app.indexOf('async function sendPreparedCapsulesThroughVault'),
      app.indexOf('async function publishCapsulesThroughVault'),
    );
    const sendIndex = sendSource.indexOf('lastResult = await sendVaultExternalBoc(item.external)');
    const sentStatusIndex = sendSource.indexOf('PUBLISH_PART_STATUS_SENT');
    const nonceIndex = sendSource.indexOf('await waitForVaultPublishNonce(provider, owner, item.clientNonce + 1n)');
    const submittedStatusIndex = sendSource.indexOf('PUBLISH_PART_STATUS_VAULT_SUBMITTED');
    const partialIndex = sendSource.indexOf('vaultPublishPartialError');

    expect(sendIndex).toBeGreaterThanOrEqual(0);
    expect(sentStatusIndex).toBeGreaterThan(sendIndex);
    expect(nonceIndex).toBeGreaterThan(sentStatusIndex);
    expect(submittedStatusIndex).toBeGreaterThan(nonceIndex);
    expect(sendSource).toMatch(/if \(publishState\.submittedCount > 0 \|\| sentBeforeFailure\) publishState\.status = VAULT_PUBLISH_STATUS_PARTIAL/);
    expect(partialIndex).toBeGreaterThan(submittedStatusIndex);
    expect(sendSource).toMatch(/await confirmCapsuleHubPublishEntries\(publishState\)/);
    expect(sendSource).toMatch(/: VAULT_PUBLISH_STATUS_SUBMITTED/);
  });

  it('PWA-SEND-02B: pending single-capsule publish status does not render partial 0/1', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const metaSource = app.slice(
      app.indexOf('function publishStatePendingCount'),
      app.indexOf('function isVaultPublishPartialError'),
    );

    expect(metaSource).toMatch(/function publishStatePendingCount/);
    expect(metaSource).toMatch(/PUBLISH_PART_STATUS_SENT/);
    expect(metaSource).toMatch(/PUBLISH_PART_STATUS_UNKNOWN/);
    expect(metaSource).toMatch(/const pending = Math\.max\(submitted, publishStatePendingCount\(publishState\)\)/);
    expect(metaSource).toMatch(/if \(pending <= 0\) return 'send failed'/);
    expect(metaSource).toMatch(/if \(total === 1\) return 'submitted, confirming'/);
    expect(metaSource).toMatch(/partial publish \$\{pending\}\/\$\{total\}/);
    expect(metaSource).not.toMatch(/partial publish \$\{submitted\}\/\$\{total\}/);
  });

  it('PWA-RPC-02: outbound private encryption resolves the recipient key through fresh verified reads', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const optionsSource = app.slice(
      app.indexOf('function criticalChainReadOptions'),
      app.indexOf('function requireManifestHashMatch'),
    );
    const source = app.slice(
      app.indexOf('async function resolveRecipientPeerEntry'),
      app.indexOf('async function submitVaultMessage'),
    );
    const optionsIndex = source.indexOf('const recipientReadOptions = { vaultAddress: requireVaultAddress(), ...criticalChainReadOptions() }');
    const userIndex = source.indexOf('const user = await provider.getUser(walletAddress, recipientReadOptions)');
    const keyIndex = source.indexOf('const keyRecord = await provider.getKeyRecord(currentKeyId, {');
    const ownerIndex = source.indexOf('ownerWallet: walletAddress');
    const spreadIndex = source.indexOf('...recipientReadOptions');
    const bundleIndex = source.indexOf('publicKeyBundleFromVaultKeyRecord(keyRecord');

    expect(optionsIndex).toBeGreaterThanOrEqual(0);
    expect(userIndex).toBeGreaterThan(optionsIndex);
    expect(keyIndex).toBeGreaterThan(userIndex);
    expect(ownerIndex).toBeGreaterThan(keyIndex);
    expect(spreadIndex).toBeGreaterThan(ownerIndex);
    expect(bundleIndex).toBeGreaterThan(spreadIndex);
    expect(source).toMatch(/function resolveRecipientPeerEntry/);
    expect(source).toMatch(/criticalChainReadOptions\(\)/);
    expect(optionsSource).toMatch(/verify: true/);
    expect(optionsSource).toMatch(/priority: 'critical'/);
    expect(optionsSource).toMatch(/cacheTtlMs: 0/);
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
    expect(usernameResolveSource).toMatch(/getNameRecordByUsername\(displayLabel, \{\s*address: registryAddress,\s*\.\.\.criticalChainReadOptions\(\),\s*\}\)/);
    expect(usernameResolveSource).toMatch(/registryCallOptions: \{ address: registryAddress, \.\.\.criticalChainReadOptions\(\) \}/);
    expect(usernameResolveSource).toMatch(/itemCallOptions: \{ address: record\.item_address, \.\.\.criticalChainReadOptions\(\) \}/);
    expect(usernameMintSource).toMatch(/getUsernamePrice\(username\.length, \{\s*address: registry,\s*\.\.\.criticalChainReadOptions\(\),\s*\}\)/);
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
      app.indexOf('async function resolveRecipientPeerEntry'),
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
    const submitSource = app.slice(
      app.indexOf('async function submitAthWalletMessage'),
      app.indexOf('async function submitUsernameRegistryMessage'),
    );

    expect(criticalMethods).toContain('get_wallet_address');
    expect(source).toMatch(/provider\.getWalletAddress\(owner, \{/);
    expect(source).toMatch(/address: requireAthMasterAddress\(\)/);
    expect(source).toMatch(/\.\.\.criticalChainReadOptions\(\)/);
    expect(submitSource).toMatch(/requireNoPendingServiceWorkerAppShellReload\(\)/);
    expect(submitSource).toMatch(/await loadConnectedAthWalletAddress\(\)/);
  });

  it('PWA-SW-UPDATE-01: pending service worker update blocks new signed sends and reloads after wallet lock', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const swSource = app.slice(
      app.indexOf('function serviceWorkerUpdateReloadError'),
      app.indexOf('function shouldOpenWalletUnlockPrompt'),
    );
    const profileSource = app.slice(
      app.indexOf('async function submitVaultProfileAvatarRegistration'),
      app.indexOf('async function loadConnectedWalletBalances'),
    );
    const submitSource = app.slice(
      app.indexOf('async function submitVaultMessage'),
      app.indexOf('async function submitVaultDepositTon'),
    );
    const prepareSource = app.slice(
      app.indexOf('async function prepareCapsulesThroughVault'),
      app.indexOf('async function sendPreparedCapsulesThroughVault'),
    );

    expect(swSource).toMatch(/pendingServiceWorkerAppShellReload = true/);
    expect(swSource).toMatch(/Update ready - reload before sending/);
    expect(swSource).toMatch(/throw serviceWorkerUpdateReloadError\(\)/);
    expect(swSource).toMatch(/window\.location\.reload\(\)/);
    expect(swSource).toMatch(/reloadForPendingServiceWorkerAppShellUpdate\(\)/);
    expect(profileSource).toMatch(/async function submitVaultProfileAvatarRegistration[\s\S]*requireNoPendingServiceWorkerAppShellReload\(\)/);
    expect(profileSource).toMatch(/async function submitVaultUsernameMint[\s\S]*requireNoPendingServiceWorkerAppShellReload\(\)/);
    expect(submitSource).toMatch(/async function submitVaultMessage[\s\S]*requireNoPendingServiceWorkerAppShellReload\(\)/);
    expect(submitSource).toMatch(/async function submitAthWalletMessage[\s\S]*requireNoPendingServiceWorkerAppShellReload\(\)/);
    expect(submitSource).toMatch(/async function submitUsernameRegistryMessage[\s\S]*requireNoPendingServiceWorkerAppShellReload\(\)/);
    expect(prepareSource).toMatch(/async function prepareCapsulesThroughVault[\s\S]*requireNoPendingServiceWorkerAppShellReload\(\)/);
  });

  it('PWA-CAPSULE-ENTRY-VERIFY-01: CapsuleHub entry reads are fresh verified before body/history trust', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const criticalMethods = PLATHO_APP_CONFIG.network.tonRpc.criticalMethods;
    const helperSource = app.slice(
      app.indexOf('function criticalChainReadOptions'),
      app.indexOf('function requireManifestHashMatch'),
    );
    const publicSyncSource = app.slice(
      app.indexOf('async function syncPublicChannelFromChain'),
      app.indexOf('async function syncPublicChannels'),
    );
    const privateSyncSource = app.slice(
      app.indexOf('async function syncPrivateCapsulesFromChain'),
      app.indexOf('async function loadEncryptedMessageHistory'),
    );
    const avatarSource = app.slice(
      app.indexOf('async function readAvatarPartsFromCapsuleHub'),
      app.indexOf('async function waitForProfileAvatarRegistryUpdate'),
    );
    const confirmationSource = app.slice(
      app.indexOf('async function confirmCapsuleHubPublishEntries'),
      app.indexOf('async function publishCapsuleThroughVault'),
    );

    expect(criticalMethods).toContain('get_state');
    expect(criticalMethods).toContain('get_private_entry');
    expect(criticalMethods).toContain('get_public_entry');
    expect(helperSource).toMatch(/function criticalCapsuleHubReadOptions\(address\)/);
    expect(helperSource).toMatch(/capsuleHubAddress: address/);
    expect(helperSource).toMatch(/criticalChainReadOptions\(\)/);

    for (const source of [publicSyncSource, privateSyncSource, avatarSource, confirmationSource]) {
      expect(source).toMatch(/criticalCapsuleHubReadOptions\(address\)/);
      expect(source).toMatch(/provider\.getState\(readOptions\)/);
    }
    expect(publicSyncSource).toMatch(/provider\.getPublicEntry\(entryIdValue, readOptions\)/);
    expect(privateSyncSource).toMatch(/provider\.getPrivateEntry\(entryId, readOptions\)/);
    expect(avatarSource).toMatch(/provider\.getPublicEntry\(entryId, readOptions\)/);
    expect(confirmationSource).toMatch(/provider\.getPrivateEntry\(entryId, readOptions\)/);
    expect(confirmationSource).toMatch(/provider\.getPublicEntry\(entryId, readOptions\)/);
  });

  it('PWA-MSG-01: default public sync window covers the maximum public multipart image', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const syncPublicSource = app.slice(
      app.indexOf('async function syncPublicChannelFromChain'),
      app.indexOf('async function syncPublicChannels'),
    );

    expect(PLATHO_APP_CONFIG.capsuleHub.publicReadLimit).toBeGreaterThanOrEqual(64);
    expect(app).toMatch(/const PUBLIC_CHAIN_READ_LIMIT = 128/);
    expect(app).toMatch(/maximum: Object\.freeze\(\{ id: 'maximum', label: 'Maximum', maxBytes: 64 \* 1024 \}\)/);
    expect(app).toMatch(/function imagePartsForSend\(attachment, label = 'image'\)/);
    expect(syncPublicSource).toMatch(/publicReadLimit \?\? PUBLIC_CHAIN_READ_LIMIT/);
    expect(syncPublicSource).toMatch(/const readLimit = Number\.isFinite\(configuredLimit\)/);
    expect(syncPublicSource).toMatch(/const minEntryId = syncWindow === 'all' \? 0 : Math\.max\(0, latest - readLimit\)/);
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
      app.indexOf('async function createPrivateComposerCapsules'),
      app.indexOf('function publicPublishDraftFromPayload'),
    );
    const syncSource = app.slice(
      app.indexOf('async function syncPrivateCapsulesFromChain'),
      app.indexOf('async function syncPrivateCapsulesFromChainOnce'),
    );

    expect(app).toMatch(/const PRIVATE_CHAIN_READ_LIMIT = 50/);
    expect(helperSource).toMatch(/appConfig\.capsuleHub\?\.privateReadLimit \?\? PRIVATE_CHAIN_READ_LIMIT/);
    expect(helperSource).toMatch(/Private message has \$\{parts\} capsules; split it into messages of \$\{limit\} capsules or fewer/);
    expect(helperSource).toMatch(/function assertPrivateComposerPartLimit/);
    expect(shortfallSource).toMatch(/if \(privateComposerPartLimitMessage\(plan\.length\)\) return true/);
    expect(statusSource).toMatch(/const limitMessage = privateComposerPartLimitMessage\(privatePlan\.length\)/);
    expect(statusSource).toMatch(/\? \{ text: limitMessage, state: 'short' \}/);
    expect(submitSource).toMatch(/const limitMessage = privateComposerPartLimitMessage\(sendPlan\.length\)/);
    expect(submitSource).toMatch(/privateComposerCostStatus\.textContent = limitMessage/);
    expect(capsuleSource).toMatch(/assertPrivateComposerPartLimit\(totalParts\)/);
    expect(syncSource).toMatch(/privateReadLimit \?\? PRIVATE_CHAIN_READ_LIMIT/);
  });

  it('PWA-CONFIG-01D4: payment checks preflight and persist recovery before CreateReceiveIntent', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const source = app.slice(
      app.indexOf('async function submitCreatePaymentCheck'),
      app.indexOf('async function submitVaultClaimPaymentCheck'),
    );
    const prepareIndex = source.indexOf('const preparedPublish = await prepareCapsulesThroughVault([capsule], { publishState })');
    const persistIndex = source.indexOf('const storedRecovery = await persistMessageToEncryptedHistory(thread, message)');
    const createIndex = source.indexOf("submitVaultMessage('CreateReceiveIntent'");

    expect(prepareIndex).toBeGreaterThanOrEqual(0);
    expect(persistIndex).toBeGreaterThan(prepareIndex);
    expect(createIndex).toBeGreaterThan(persistIndex);
    expect(source).toMatch(/tonBalance < amount \+ preparedPublish\.totalMaxCharge/);
    expect(source).toMatch(/athBalance < amount/);
    expect(source).toMatch(/tonBalance < preparedPublish\.totalMaxCharge/);
    expect(source).toMatch(/encryptedMessageStore\.persistent === false/);
    expect(source).toMatch(/check intent create failed/);
  });

  it('PWA-CONFIG-01D5: public submitted publish creates durable pending feed items', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const source = app.slice(
      app.indexOf('function mergeLocalPendingPublicFeed'),
      app.indexOf('globalThis.plathoVaultTransactions'),
    );

    expect(source).toMatch(/function mergeLocalPendingPublicFeed/);
    expect(source).toMatch(/isPendingPublicFeedItem/);
    expect(source).toMatch(/rememberLocalPublicPost\([^)]*resolvedDraft\.attachment, \{/);
    expect(source).toMatch(/publishStatus: 'public publish submitted'/);
    expect(source).toMatch(/publishStatus: 'partial public publish'/);
    expect(source).toMatch(/rememberLocalPublicComment\([^)]*attachment, \{/);
    expect(source).toMatch(/publishStatus: 'comment submitted'/);
    expect(source).toMatch(/publishStatus: 'partial comment publish'/);
  });

  it('PWA-CONFIG-01D3: publish nonce polling bypasses RPC cache', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const source = app.slice(
      app.indexOf('async function readVaultPublishNonce'),
      app.indexOf('async function publishCapsulesThroughVault'),
    );

    expect(source).toMatch(/provider\.getUser\(owner,\s*\{/);
    expect(source).toMatch(/verify:\s*true/);
    expect(source).toMatch(/priority:\s*'critical'/);
    expect(source).toMatch(/cacheTtlMs:\s*0/);
  });

  it('PWA-CONFIG-01E: public publishing uses the shared composer and explicit feed controls', () => {
    const html = readFileSync('web/index.html', 'utf8');
    const publicHeader = html.match(/<section class="content-pane public-pane[\s\S]*?<\/header>/)?.[0] ?? '';

    expect(html).toMatch(/id="publicFeedModeButton"/);
    expect(html).toMatch(/id="publicChannelsModeButton"/);
    expect(html).toMatch(/id="publicChannelSearch"/);
    expect(html).toMatch(/id="addPublicChannelButton"/);
    expect(html).toMatch(/class="search-row action-search-row"[\s\S]*id="threadSearch"[\s\S]*id="newChatButton"/);
    expect(html).toMatch(/placeholder="Search public"/);
    expect(html).toMatch(/id="publicJumpDownButton"/);
    expect(html).toMatch(/class="public-jump-down-button" id="publicJumpDownButton"[\s\S]*hidden/);
    expect(publicHeader).not.toMatch(/id="publicJumpDownButton"/);
    expect(html).not.toMatch(/id="refreshVaultButton"/);
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

  it('PWA-CONFIG-04: production config requires a Vault provider entry', () => {
    const report = validatePlathoAppConfig({
      ...productionConfig,
      vault: {
        ...productionConfig.vault,
        provider: {
          globalName: null,
          moduleUrl: null,
          requiredInProduction: true,
        },
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.id)).toContain('PWA_VAULT_CHAIN_PROVIDER_REQUIRED');
  });

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
            (method) => !['dnsresolve', 'get_wallet_address', 'get_canonical_publish_charge'].includes(method),
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
        expect.stringContaining('get_canonical_publish_charge'),
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

  it('PWA-CONFIG-04D: production config requires Vault deployment manifest hash for signed publish domain', () => {
    const report = validatePlathoAppConfig({
      ...productionConfig,
      vault: {
        ...productionConfig.vault,
        deploymentManifestHash: null,
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.id)).toContain('PWA_VAULT_DEPLOYMENT_MANIFEST_HASH_REQUIRED');
  });

  it('PWA-CONFIG-05: production config does not carry external wallet connector settings', () => {
    expect(JSON.stringify(productionConfig)).not.toMatch(new RegExp('ton' + 'connect', 'i'));
  });

  it('PWA-CONFIG-06: public CapsuleHub sync skips malformed entries per entry', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const readAvatarPartsSource = app.slice(
      app.indexOf('async function readAvatarPartsFromCapsuleHub'),
      app.indexOf('async function findPublishedAvatarEntries'),
    );
    const findAvatarPartsSource = app.slice(
      app.indexOf('async function findPublishedAvatarEntries'),
      app.indexOf('async function waitForPublishedAvatarEntries'),
    );
    const syncPublicSource = app.slice(
      app.indexOf('async function syncPublicChannelFromChain'),
      app.indexOf('async function syncPublicChannels'),
    );

    expect(app).toMatch(/function tryReadPublicEntryPayload/);
    expect(app).toMatch(/Skipping malformed public CapsuleHub entry/);
    expect(app).toMatch(/Skipping unreadable public CapsuleHub entry/);
    expect(readAvatarPartsSource).toMatch(/resolvePublicEntryPayload/);
    expect(findAvatarPartsSource).toMatch(/resolvePublicEntryPayload/);
    expect(syncPublicSource).toMatch(/resolvePublicEntryPayload/);
    expect(syncPublicSource).toMatch(/const unavailableEntries = \[\]/);
    expect(syncPublicSource).toMatch(/isBodyHistoryUnavailableError\(error\)/);
    expect(app).toMatch(/const PUBLIC_CHAIN_HISTORY_UNAVAILABLE_STORAGE_PREFIX/);
    expect(app).toMatch(/function rememberPublicBodyHistoryUnavailable/);
    expect(app).toMatch(/function clearPublicBodyHistoryUnavailable/);
    expect(app).toMatch(/function publicBodyHistoryRetryEntryIds/);
    expect(syncPublicSource).toMatch(/const retryEntryIds = publicBodyHistoryRetryEntryIds\(address, latestId, BigInt\(minEntryId\)\)/);
    expect(syncPublicSource).toMatch(/entryIdsToScan\.push\(\.\.\.retryEntryIds\)/);
    expect(syncPublicSource).toMatch(/rememberPublicBodyHistoryUnavailable\(address, entry, entryIdValue\)/);
    expect(syncPublicSource).toMatch(/clearPublicBodyHistoryUnavailable\(address, entryIdValue\)/);
    expect(syncPublicSource).toMatch(/unavailableEntries\.push/);
    expect(syncPublicSource).toMatch(/historyUnavailableCount: unavailableEntries\.length/);
    expect(syncPublicSource).toMatch(/retryEntryCount: retryEntryIds\.length/);
    expect(syncPublicSource).toMatch(/publicReadLimit/);
    expect(syncPublicSource).toMatch(/syncWindow === 'all' \? 0 : Math\.max\(0, latest - readLimit\)/);
    expect(app).toMatch(/function chainBackedPublicFeedOnly/);
    expect(app).toMatch(/post\?\.chainVerified === true/);
    expect(syncPublicSource).toMatch(/chainVerified: true/);
    expect(app).toMatch(/allowUnverifiedStaticPublicFeeds !== true/);
    expect(app).toMatch(/Public channel feed has no verified CapsuleHub anchors/);
    expect(readAvatarPartsSource).not.toMatch(/readPublicPostPayload/);
    expect(findAvatarPartsSource).not.toMatch(/readPublicPostPayload/);
    expect(syncPublicSource).not.toMatch(/readPublicPostPayload/);
  });

  it('PWA-CONFIG-06B: profile avatar registry update waits for CapsuleHub proof and registry finality', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const submitAvatarSource = app.slice(
      app.indexOf('async function submitProfileAvatarUpdate'),
      app.indexOf('async function submitCreatePaymentCheck'),
    );
    const readAvatarPartsSource = app.slice(
      app.indexOf('async function readAvatarPartsFromCapsuleHub'),
      app.indexOf('async function findPublishedAvatarEntries'),
    );
    const findAvatarPartsSource = app.slice(
      app.indexOf('async function findPublishedAvatarEntries'),
      app.indexOf('async function waitForPublishedAvatarEntries'),
    );
    const waitRegistrySource = app.slice(
      app.indexOf('async function waitForProfileAvatarRegistryUpdate'),
      app.indexOf('async function loadProfileAvatarImage'),
    );

    expect(submitAvatarSource.indexOf('confirmed = await waitForPublishedAvatarEntries')).toBeGreaterThan(-1);
    expect(submitAvatarSource.indexOf('await submitVaultProfileAvatarRegistration')).toBeGreaterThan(
      submitAvatarSource.indexOf('confirmed = await waitForPublishedAvatarEntries'),
    );
    expect(submitAvatarSource.indexOf('registryPointer = await waitForProfileAvatarRegistryUpdate')).toBeGreaterThan(
      submitAvatarSource.indexOf('await submitVaultProfileAvatarRegistration'),
    );
    expect(submitAvatarSource).toMatch(/avatar registry confirming/);
    expect(submitAvatarSource).toMatch(/avatar not active yet/);
    expect(readAvatarPartsSource).toMatch(/cacheAssembledAvatarParts\(parts, pointer\)/);
    expect(findAvatarPartsSource).toMatch(/cacheAssembledAvatarParts\(parts, pointer\)/);
    expect(app).toMatch(/if \(hash\.toLowerCase\(\) !== pointer\.avatarHash\.toLowerCase\(\)\) return null/);
    expect(waitRegistrySource).toMatch(/readCurrentProfileAvatarPointerFromChain\(ownerWallet, \{ required: true \}\)/);
    expect(waitRegistrySource).toMatch(/pointer\?\.avatarHash\?\.toLowerCase\(\) === expectedHash\.toLowerCase\(\)/);
  });

  it('PWA-CONFIG-06C: profile avatar direct pointer scan accepts CapsuleHub entry id zero', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const readAvatarPartsSource = app.slice(
      app.indexOf('async function readAvatarPartsFromCapsuleHub'),
      app.indexOf('async function findPublishedAvatarEntries'),
    );

    expect(readAvatarPartsSource).toMatch(/publicEntryIdBigInt\(pointer\.avatarEntryId \?\? pointer\.avatar_entry_id\)/);
    expect(readAvatarPartsSource).toMatch(/if \(start !== null && start >= 0n\)/);
    expect(readAvatarPartsSource).not.toMatch(/if \(start !== null && start > 0n\)/);
    expect(readAvatarPartsSource).toMatch(/for \(let entryId = start; entryId <= start \+ maxExtra; entryId \+= 1n\)/);
  });

  it('PWA-CONFIG-07: username mint uses the registry price atomic value', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const source = app.slice(
      app.indexOf('async function submitUsernameMint'),
      app.indexOf('async function submitUsernameRefundFlush'),
    );

    expect(source).toMatch(/provider\.getUsernamePrice\(username\.length/);
    expect(source).toMatch(/price\?\.valid_length !== true/);
    expect(source).toMatch(/const priceAtomic = BigInt\(price\?\.price_ath_atomic \?\? 0n\)/);
    expect(source).toMatch(/priceAtomic/);
    expect(source).toMatch(/submitVaultUsernameMint/);
    expect(source).not.toMatch(/submitAthWalletMessage\('ATHTransferRequestMintUsername'/);
    expect(source).not.toMatch(/amount: price,/);
  });

  it('PWA-CONFIG-07A: expected missing Vault provider is a quiet preview state', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const dashboardSource = app.slice(
      app.indexOf('async function refreshVaultDashboard'),
      app.indexOf('async function resolveAthMasterProvider'),
    );
    const activationSource = app.slice(
      app.indexOf('async function refreshVaultActivationStatus'),
      app.indexOf('async function bootCrypto'),
    );

    expect(app).toMatch(/function isExpectedVaultProviderUnavailable/);
    expect(app).toMatch(/throw new VaultChainProviderUnavailableError\('Vault chain provider is not configured'\)/);
    expect(app).toMatch(/const VAULT_AUTO_REFRESH_MS = 60 \* 1000/);
    expect(app).toMatch(/const VAULT_NAV_BACKGROUND_REFRESH_MS = 180 \* 1000/);
    expect(app).toMatch(/const TON_RPC_CONNECTING_STATUS = 'Connecting\.\.\.'/);
    expect(app).toMatch(/let tonRpcLimitedUntil = 0/);
    expect(app).toMatch(/function noteTonRpcRateLimit/);
    expect(app).toMatch(/function markTonRpcLimited/);
    expect(app).toMatch(/tonRpcLimited\(\) \|\| privateComposerKnownVaultTonShortfall\(\)/);
    expect(app).toMatch(/function refreshVaultNow/);
    expect(app).toMatch(/function refreshVaultNavBalanceInBackground/);
    expect(app).toMatch(/function queueVaultPostTransactionRefresh/);
    expect(app).toMatch(/if \(view === 'vault'\)/);
    expect(app).toMatch(/scheduleVaultAutoRefresh\(2_000\)/);
    expect(app).toMatch(/delayMs === VAULT_AUTO_REFRESH_MS && !isVaultViewActive\(\)/);
    expect(app).toMatch(/dashboardUser \? \{ user: dashboardUser, skipGlobal: true \} : \{\}/);
    expect(app).toMatch(/document\.addEventListener\('visibilitychange'/);
    expect(app).toMatch(/window\.addEventListener\('focus'/);
    expect(dashboardSource).toMatch(/resetVaultPocketState\(\)/);
    expect(app).toMatch(/refreshVaultNavBalanceInBackground\(\)[\s\S]*\.finally\(\(\) => scheduleVaultAutoRefresh\(\)\)/);
    expect(dashboardSource).toMatch(/isExpectedVaultProviderUnavailable\(userError\)/);
    expect(dashboardSource).toMatch(/vaultProviderStatusForError\(userError\)/);
    expect(activationSource).toMatch(/if \(!isExpectedVaultProviderUnavailable\(error\)\) console\.error\(error\)/);
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
    const burnSource = app.slice(
      app.indexOf('async function submitAthWalletBurn'),
      app.indexOf('async function submitProfileAvatarUpdate'),
    );

    expect(initialStateSource).toMatch(/total_supply:\s*null/);
    expect(renderSource).toMatch(/if \(value === null \|\| value === undefined\) return '-'/);
    expect(refreshSource).toMatch(/provider\.getJettonData\(\{ address: requireAthMasterAddress\(\) \}\)/);
    expect(refreshSource).toMatch(/total_supply:\s*data\?\.total_supply === null \|\| data\?\.total_supply === undefined\s*\?\s*null\s*:\s*nonNegativeBigInt\(data\.total_supply\)/);
    expect(refreshSource).not.toMatch(/ATH_TOTAL_SUPPLY_ATOMIC/);
    expect(viewSource).toMatch(/if \(view === 'profile' && plathoWallet\?\.address\) \{[\s\S]*refreshAthProtocolStats\(\)\.catch/);
    expect(burnSource).toMatch(/submitAthWalletMessage\('ATHBurn'/);
    expect(burnSource).toMatch(/queueAthProtocolStatsRefresh\(\)/);
  });

  it('PWA-CONFIG-07B: private chain sync catches up without skipping retained history', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const syncSource = app.slice(
      app.indexOf('async function syncPrivateCapsulesFromChain'),
      app.indexOf('async function bootReplayStore'),
    );
    const syncButtonSource = app.slice(
      app.indexOf('syncMessagesButton?.addEventListener'),
      app.indexOf('publicFeedModeButton?.addEventListener'),
    );

    expect(app).toMatch(/const PRIVATE_CHAIN_RESCAN_OVERLAP = 25/);
    expect(app).toMatch(/const MESSAGE_AUTO_SYNC_MS = 60 \* 1000/);
    expect(app).toMatch(/let messageAutoSyncAt = 0/);
    expect(app).toMatch(/function messageAutoSyncCountdownText/);
    expect(app).toMatch(/Refreshing in \$\{seconds\}s/);
    expect(app).toMatch(/messageAutoSyncAt = Date\.now\(\) \+ effectiveDelayMs/);
    expect(app).toMatch(/scheduleMessageAutoSyncCountdownUi\(\)/);
    expect(app).toMatch(/activeSubtitle\.textContent = conversationSubtitleText\(thread\)/);
    expect(app).toMatch(/latest <= storedCursor/);
    expect(app).toMatch(/unchanged: true/);
    expect(app).toMatch(/function isBodyHistoryUnavailableError/);
    expect(app).toMatch(/const PRIVATE_CHAIN_HISTORY_UNAVAILABLE_STORAGE_PREFIX/);
    expect(app).toMatch(/function rememberPrivateBodyHistoryUnavailable/);
    expect(app).toMatch(/function clearPrivateBodyHistoryUnavailable/);
    expect(app).toMatch(/function privateBodyHistoryRetryEntryIds/);
    expect(app).toMatch(/function privateSyncStatusText/);
    expect(app).toMatch(/body_history_unavailable/);
    expect(app).toMatch(/history unavailable/);
    expect(app).toMatch(/history gaps/);
    expect(app).toMatch(/catch_up_pending/);
    expect(app).toMatch(/catch-up/);
    expect(syncSource).toMatch(/forceRecentRescan/);
    expect(syncSource).toMatch(/let start = storedCursor === null \? 0n : storedCursor/);
    expect(syncSource).toMatch(/storedCursor - BigInt\(overlap\)/);
    expect(syncSource).toMatch(/const scanEnd = start \+ BigInt\(limit\) < latest \? start \+ BigInt\(limit\) : latest/);
    expect(syncSource).toMatch(/const retryEntryIds = privateBodyHistoryRetryEntryIds\(address, latest, start, scanEnd\)/);
    expect(syncSource).toMatch(/for \(const entryId of entryIdsToScan\)/);
    expect(syncSource).toMatch(/writePrivateChainScanCursor\(address, nextCursor\)/);
    expect(syncSource).toMatch(/rememberPrivateBodyHistoryUnavailable\(address, entry, entryId\)/);
    expect(syncSource).toMatch(/clearPrivateBodyHistoryUnavailable\(address, entryId\)/);
    expect(syncSource).toMatch(/historyUnavailableEntries\.push/);
    expect(syncSource).not.toMatch(/isBodyHistoryUnavailableError\(error\)[\s\S]{0,200}break/);
    expect(syncSource).toMatch(/catchUpRemaining/);
    expect(syncSource).not.toMatch(/windowStart/);
    expect(app).toMatch(/privateEntryPublisherWallet/);
    expect(app).toMatch(/resolveKnownPrivateSenderWallet/);
    expect(app).toMatch(/relocateExistingCapsuleMessage/);
    expect(syncSource).toMatch(/globalThis\.plathoLastPrivateSync/);
    expect(syncSource).toMatch(/rateLimited: rateLimitError !== null/);
    expect(syncSource).toMatch(/function scheduleMessageAutoSync/);
    expect(syncButtonSource).toMatch(/forceRecentRescan: true/);
    expect(syncButtonSource).not.toMatch(/syncPublicChannels/);
    expect(app).toMatch(/function sortThreadMessages/);
    expect(app).toMatch(/function insertThreadMessage/);
    expect(app).toMatch(/function privateChainMessageOrderFields/);
    expect(app).toMatch(/createdAtMs/);
    expect(app).toMatch(/chainEntryId/);
    expect(syncSource).toMatch(/privateChainMessageMeta\(entry\),\s*entry/);
    expect(syncSource).toMatch(/appendOpenedPrivatePartsMessage/);
  });

  it('PWA-CONFIG-08: service worker precaches runtime crypto vendor modules', () => {
    const sw = readFileSync('web/sw.js', 'utf8');

    expect(sw).toMatch(/platho-pwa-prototype-v306/);
    expect(sw).toMatch(/\.\/styles\.css\?v=123/);
    expect(sw).toMatch(/\.\/assets\/icons\/swap-circular\.svg/);
    expect(sw).toMatch(/\.\/assets\/icons\/download\.svg/);
    expect(sw).toMatch(/\.\/app\.js\?v=246/);
    expect(sw).toMatch(/\.\/platho-config\.mjs\?v=45/);
    expect(sw).toMatch(/\.\/message-pricing-policy\.mjs\?v=10/);
    expect(sw).toMatch(/\.\/public-channel-subscriptions\.mjs\?v=6/);
    expect(sw).toMatch(/\.\/platho-wallet\.mjs\?v=8/);
    expect(sw).toMatch(/\.\/pwa-contract-transactions\.mjs\?v=15/);
    expect(sw).toMatch(/\.\/vault-ton-rpc-provider\.mjs\?v=16/);
    expect(sw).toMatch(/\.\/profile-registry-ton-rpc-provider\.mjs\?v=12/);
    expect(sw).toMatch(/\.\/capsulehub-ton-rpc-provider\.mjs\?v=16/);
    expect(sw).toMatch(/\.\/ath-ton-rpc-provider\.mjs\?v=9/);
    expect(sw).toMatch(/\.\/ton-dns-provider\.mjs\?v=8/);
    expect(sw).toMatch(/\.\/username-ton-rpc-provider\.mjs\?v=14/);
    expect(sw).toMatch(/\.\/recipient-identities\.mjs\?v=3/);
    expect(sw).toMatch(/\.\/crypto\/platho-crypto\.mjs\?v=5/);
    expect(sw).toMatch(/\.\/vendor\/@noble\/curves\/ed25519\.js/);
    expect(sw).toMatch(/\.\/vendor\/@noble\/curves\/abstract\/edwards\.js/);
    expect(sw).toMatch(/\.\/vendor\/@noble\/hashes\/sha2\.js/);
    expect(sw).toMatch(/\.\/vendor\/@noble\/hashes\/_md\.js/);
    expect(sw).toMatch(/\.\/vendor\/@noble\/post-quantum\/ml-kem\.js/);
    expect(sw).toMatch(/\.\/vendor\/@noble\/post-quantum\/_crystals\.js/);
    expect(sw).toMatch(/\.\/webp-encoder\.mjs\?v=1/);
    expect(sw).toMatch(/\.\/qr-code\.mjs\?v=1/);
    expect(sw).toMatch(/\.\/vendor\/@jsquash\/webp\/codec\/enc\/webp_enc\.js/);
    expect(sw).toMatch(/\.\/vendor\/@jsquash\/webp\/codec\/enc\/webp_enc\.wasm/);
    expect(sw).toMatch(/\.\/manifest\.webmanifest\?v=3/);
    expect(sw).toMatch(/\.\/assets\/platho-icon-192\.png\?v=3/);
  });

  it('PWA-CONFIG-09: production hosting configs require strict security headers', () => {
    const caddy = readFileSync('deploy/Caddyfile', 'utf8');
    const nginx = readFileSync('deploy/nginx-platho.app.conf', 'utf8');
    const readme = readFileSync('deploy/README.md', 'utf8');
    const serverCaddy = readFileSync('scripts/server/Caddyfile', 'utf8');
    const readiness = readFileSync('PRODUCTION_READINESS.md', 'utf8');
    const importMapCspHashes = currentInlineImportMapCspHashes();

    for (const text of [caddy, nginx, readme, serverCaddy, readiness]) {
      expect(text).toMatch(/Content-Security-Policy/);
      expect(text).toMatch(/default-src 'self'/);
      expect(text).toMatch(/script-src 'self' 'wasm-unsafe-eval'/);
      for (const importMapCspHash of importMapCspHashes) {
        expect(text).toContain(`'${importMapCspHash}'`);
      }
      expect(text).toMatch(/connect-src/);
      expect(text).toMatch(/object-src 'none'/);
      expect(text).toMatch(/base-uri 'none'/);
      expect(text).toMatch(/frame-ancestors 'none'/);
      expect(text).toMatch(/X-Content-Type-Options/);
      expect(text).toMatch(/Referrer-Policy/);
      expect(text).toMatch(/Permissions-Policy/);
    }
  });
});
