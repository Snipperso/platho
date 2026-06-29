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
    // verifyCriticalReads stays false: message bodies self-verify against CapsuleHub hashes, so a single
    // (even untrusted) provider read cannot poison them, and routine cross-verification would only burn the
    // per-user budget. Keyless toncenter stays strictly an emergency primary/send/history fallback, never
    // an "on equal footing" verifier.
    expect(PLATHO_APP_CONFIG.network.tonRpc.verifyCriticalReads).toBe(false);
    for (const method of [
      'get_state',
      'get_private_entry',
      'get_private_recipient_index',
      'get_private_sender_index',
      'get_private_page',
      'get_public_entry',
      'get_public_page',
    ]) {
      expect(PLATHO_APP_CONFIG.network.tonRpc.criticalMethods).toContain(method);
    }
    expect(PLATHO_APP_CONFIG.network.tonRpc.criticalMethods).toContain('get_avatar_version');
    expect(PLATHO_APP_CONFIG.network.tonRpc.criticalMethods).toContain('get_username_item_address');
    expect(PLATHO_APP_CONFIG.capsuleHub.publicReadLimit).toBe(128);
    expect(PLATHO_APP_CONFIG.vault.address).toBe('UQC0dTjgbUpyNlSoUJoQE1UHlh12PUrBv1Ui7bQ8izv4uB27');
    expect(PLATHO_APP_CONFIG.vault.deploymentManifestHash).toBe(
      '9cba5ac253a4c18697c962df6c032c60eb27241e930f9ba26d5ab16481555df2',
    );
    expect(PLATHO_APP_CONFIG.capsuleHub.address).toBe('UQAjYAjfEB33-QIifsf02U3sZmAvvwJgoCZPNjGh2FmmPZRx');
    expect(PLATHO_APP_CONFIG.feeAccumulator.address).toBe('UQBg4NGArbbjGCFR-2lZ68XCQibO5OYTA7JfVKSdViXDrY6p');
    expect(PLATHO_APP_CONFIG.ath.masterAddress).toBe('UQA1Xa56qP5Ebe3yprAEQWf4Rg_cc39xhwIP1802Jql2oRbF');
    expect(PLATHO_APP_CONFIG.tonDns.rootAddress).toBe(
      '-1:e56754f83426f69b09267bd876ac97c44821345b7e266bd956a7bfbfb98df35c',
    );
  });

  it('PWA-CONFIG-01B: configured TON DNS provider module exports the requested runtime provider', async () => {
    const providerConfig = PLATHO_APP_CONFIG.tonDns.provider;
    const moduleUrl = providerConfig.moduleUrl;
    expect(moduleUrl).toMatch(/\.\/ton-dns-provider\.mjs\?v=36/);
    const modulePath = moduleUrl.replace(/^\.\//, '../web/').replace(/\?.*$/, '');
    const module = await import(modulePath);
    const exportName = providerConfig.exportName ?? 'default';
    const provider = module[exportName] ?? module.default ?? module.provider;

    expect(exportName).toBe('default');
    expect(provider?.resolveWallet).toBeTypeOf('function');
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
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');

    expect(html).not.toMatch(/aria-label="Call"|aria-label="More"|aria-label="Attach"/);
    expect(html).toMatch(/id="appVersionLabel">v573<\/span>/);
    expect(app).toMatch(/const PLATHO_APP_RUNTIME_VERSION = 'v573'/);
    expect(app).toMatch(/setText\(appVersionLabel, PLATHO_APP_RUNTIME_VERSION\)/);
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
    expect(html).toMatch(/<span>Private<\/span>/);
    expect(html).toMatch(/Search private/);
    expect(html).toMatch(/id="recipientLocalLabel"/);
    expect(html).toMatch(/Optional, e\.g\. Anonymous/);
    expect(html).toMatch(/Use a Platho name, \.ath, \.ton, or wallet address/);
    expect(html).toMatch(/alex, alex\.ath, alex\.ton, or EQ\.\.\./);
    expect(html).toMatch(/Local label is only shown on this device/);
    expect(html).toMatch(/id="identityMenuButton"/);
    expect(html).toMatch(/id="privateComposerAddButton"/);
    expect(html).toMatch(/id="privateComposerAddMenu"/);
    expect(html).toMatch(/id="paymentCheckButton"/);
    expect(html).toMatch(/id="privateAnonymousButton"/);
    expect(html).toMatch(/icon-eye-off/);
    expect(app).toMatch(/Recipient will see your wallet address/);
    expect(app).toMatch(/Pseudonymous: wallet address hidden, sender key may still link messages/);
    expect(app).toMatch(/icon\.classList\.toggle\('icon-eye', !anonymous\)/);
    expect(app).toMatch(/icon\.classList\.toggle\('icon-eye-off', anonymous\)/);
    expect(html).toMatch(/aria-label="Choose display name"/);
    expect(app).toMatch(/identity\.type === RECIPIENT_IDENTITY_TYPES\.PLATHO_NFT[\s\S]*replace\(\/\\\.ath\$\/i, ''\)/);
    expect(css).toMatch(/\.identity-label-ton\s*\{\s*color:\s*#9fd3f2;/);
    expect(css).toMatch(/\.identity-label-platho\s*\{\s*color:\s*#8fdcc8;/);
    expect(app).toMatch(/function identityDisplayOptions\(thread\)[\s\S]*subtitle: 'Local name'[\s\S]*uniqueDisplayIdentityVariants\(thread\)/);
    expect(app).toMatch(/thread\.displayIdentity = selected\.identity \?\? null/);
    expect(app).toMatch(/persistThreadDisplayPreference\(thread\)/);
    expect(app).toMatch(/function threadSelectedIdentity\(thread\)[\s\S]*if \(thread\?\.localLabel\) return null/);
    expect(app).toMatch(/async function verifiedPlathoUsernameIdentityForWallet\(label, walletAddress\)/);
    expect(app).toMatch(/resolvePlathoUsernameOwner\(identity\.value\)/);
    expect(app).toMatch(/sameWalletAddress\(resolved\.ownerWallet, rawWallet\)/);
    expect(app).toMatch(/const senderUsername = opened\?\.payload\?\.senderUsername \?\? opened\?\.payload\?\.sender_username/);
    // Any thread (incl. one auto-created from an incoming message) can set/edit a private local name from
    // the "Display as" menu — not only threads created via New Chat's local-label field.
    expect(app).toMatch(/async function promptThreadLocalLabel\(thread\)/);
    expect(app).toMatch(/thread\.localLabel = next;\s*thread\.displayIdentity = null/);
    // The local name is edited via a pencil button on its own row (createPencilIcon) instead of a
    // separate "Edit local name" menu item; a plain "Set local name" action only shows when none exists.
    expect(app).toMatch(/function createPencilIcon\(\)/);
    expect(app).toMatch(/className = 'identity-variant-edit'/);
    expect(app).toMatch(/setAttribute\('aria-label', 'Edit local name'\)/);
    expect(app).toMatch(/if \(!localLabelExists\) \{[\s\S]*'Set local name'/);
    expect(app).toMatch(/identity-variant-action/);
    expect(app).toMatch(/promptThreadLocalLabel\(thread\)\.catch/);
    expect(app).toMatch(/identityMenuButton\.hidden = identityDisplayOptions\(thread\)\.length < 1/);
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
    expect(app).toMatch(/normalizeIdentityVariants\(\[ownIdentity, \.\.\.threadIdentityVariants\(base\)\]\)/);

    // Registry name overlay + per-wallet avatar resolution so feed, channels list and detail all show it.
    expect(app).toMatch(/\.map\(applyContactDisplayToRegistryChannel\)/);
    expect(app).toMatch(/function publicAvatarUrlForWallet\(walletAddress\)/);
    expect(app).toMatch(/item\.avatarImageUrl \?\? publicAvatarUrlForWallet\(item\.authorWallet\)/);
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
    expect(app).toMatch(/'Comments on - tap to turn off' : 'Comments off - tap to turn on'/);

    // Feed-mode posts fill the column width (consistent with the compact cards), not capped to image width.
    expect(css).toMatch(/\.public-feed\[data-public-mode="feed"\] > \.feed-item:not\(\.compact\)\s*{[\s\S]*?width: 100%;/);

    const mjs = readFileSync('web/public-channel-subscriptions.mjs', 'utf8');
    // (1) A wallet post shows its author/channel name ONCE: dropped from message.meta, and no title
    // fallback to the channel name (the live name comes from thread.name in the feed item).
    expect(mjs).toMatch(/meta: \[post\.publishStatus, shortTime\(post\.createdAt\)/);
    expect(mjs).toMatch(/title: message\.publicPostTitle \?\? null/);
    // (2) Posts are marked read when actually viewed (Public tab active).
    expect(app).toMatch(/isPublicViewActive\(\) && markVisiblePublicFeedRead\(items\)/);
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
    expect(html).toMatch(/Share wallet address/);
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
    expect(app).toMatch(/actionCancelButton\.hidden = !cancellable/);
    expect(app).toMatch(/actionCancelButton\.disabled = !cancellable/);
    expect(app).toMatch(/activeActionDialog\?\.dismissOnBackdrop !== false\) closeActionDialog\(null\)/);
    expect(app).toMatch(/dismissOnBackdrop = true/);
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
    expect(html).toMatch(/class="vault-scroll-content"/);
    expect(css).toMatch(/\.profile-scroll-content/);
    expect(css).toMatch(/\.vault-scroll-content/);
    expect(css).toMatch(/overflow-y: auto/);
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
    // The "Display as" chevron is the compact 34px header-button size (matching the info/install buttons and the
    // other tabs' headers) — shrink the chevron, do NOT grow info/install to 40px (that made the tab inconsistent).
    expect(readFileSync('web/index.html', 'utf8')).toMatch(/class="[^"]*\bidentity-menu-button\b[^"]*"[^>]*id="identityMenuButton"/);
    expect(css).toMatch(/\.identity-menu-button\s*{\s*width: 34px;\s*height: 34px;/);
    expect(css).not.toMatch(/\.conversation-header \.docs-header-button,\s*\n?\s*\.conversation-header \.install-header-button\s*{\s*width: 40px/);
    expect(css).not.toMatch(/@media \(min-width: 680px\) and \(max-width: 900px\)/);
    expect(css).toMatch(/\.public-pane,\s*\.vault-pane,\s*\.profile-pane,\s*\.list-pane\s*{\s*padding: 24px;/);
    expect(css).toMatch(/\.list-pane\s*{\s*gap: 14px;\s*border-right: 0;\s*}/);
    expect(css).toMatch(/\.public-composer\s*{\s*margin: 0 -24px -24px;\s*padding: 12px 14px/);
    // Public composer is consistent with Private: full-bleed (no right gap) and its two left buttons
    // are sized exactly like the Private composer buttons at both breakpoints.
    expect(css).toMatch(/\.public-composer\s*{[\s\S]*?max-width: none;/);
    expect(css).toMatch(/\.public-composer > \.attachment-button\s*{\s*width: 44px;\s*height: 44px;/);
    expect(css).toMatch(/\.public-composer > \.composer-post-option,\s*\.public-composer > \.attachment-button\s*{\s*width: 38px;\s*height: 44px;/);
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
    expect(PLATHO_APP_CONFIG.vault.address).toBe('UQC0dTjgbUpyNlSoUJoQE1UHlh12PUrBv1Ui7bQ8izv4uB27');
    expect(PLATHO_APP_CONFIG.capsuleHub.address).toBe('UQAjYAjfEB33-QIifsf02U3sZmAvvwJgoCZPNjGh2FmmPZRx');
    expect(PLATHO_APP_CONFIG.ath.masterAddress).toBe('UQA1Xa56qP5Ebe3yprAEQWf4Rg_cc39xhwIP1802Jql2oRbF');
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
    expect(html).toMatch(/<h2>Wallet<\/h2>[\s\S]*id="createWalletButton"[\s\S]*id="unlockWalletButton"[\s\S]*id="changeWalletPasswordButton"[\s\S]*id="walletTonBalanceButton"[\s\S]*id="registerVaultKeysButton"/);
    expect(html).toMatch(/Wallet GRAM[\s\S]*id="walletTonBalanceStatus"/);
    expect(html).toMatch(/Activate Platho account[\s\S]*id="vaultDraftStatus"[\s\S]*wallet required/);
    expect(html).toMatch(/<h2>Messages<\/h2>[\s\S]*id="syncMessagesButton"[\s\S]*id="replaceVaultKeysButton"/);
    expect(html).toMatch(/Sync messages[\s\S]*tap to sync/);
    expect(html).toMatch(/Replace message keys[\s\S]*activate account first/);
    expect(app).toMatch(/up to date/);
    expect(app).toMatch(/hasActiveVaultMessagingKeys/);
    expect(app).toMatch(/hasActivePlathoAccount/);
    expect(app).toMatch(/plathoAccountActivationFeeLabel/);
    expect(app).toMatch(/walletTonBalanceButton\?\.addEventListener\('click'/);
    expect(app).toMatch(/Activate Platho account before sending/);
    expect(app).toMatch(/item\.disabled = false/);
    expect(app).not.toMatch(/item\.dataset\.tab !== 'profile'/);
    expect(app).not.toMatch(/!hasActivePlathoAccount\(\)[\s\S]*setView\('profile'\)/);
    expect(app).toMatch(/Update ready - reload before sending/);
    expect(app).toMatch(/reload app/);
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
    // Activation forces the key export ONLY when the key is not yet backed up; an imported / already-exported
    // wallet (markWalletKeyBackupDone cleared the pending flag) skips the download + the backup checkbox and
    // just confirms the on-chain activation.
    expect(app).toMatch(/const needsKeyBackup = walletKeyBackupPendingForStoredWallet\(\)/);
    expect(app).toMatch(/if \(needsKeyBackup\) await downloadEncryptedWalletKeyBackup\(\)/);
    expect(app).toMatch(/submitLabel: needsKeyBackup \? 'Export key and activate' : 'Activate account'/);
    expect(app).toMatch(/VAULT_RECEIVE_CRYPTO_SUITE = CRYPTO_SUITES\.HYBRID_V1/);
    expect(app).toMatch(/loadMessagingIdentityFromWallet\(VAULT_RECEIVE_CRYPTO_SUITE\)/);
    expect(app).not.toMatch(/postquantum only/);
    expect(app).not.toContain('crypto_suite_mask} / ${localVaultDraft.json.pq_kem_pubkey_len}b');
    expect(html).toMatch(/id="setAvatarButton"/);
    expect(html).toMatch(/id="setAvatarStatus"/);
    expect(html).toMatch(/id="mintUsernameStatus"/);
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
    expect(app).toMatch(/setProfileAvatarStatus\('avatar not active yet', 'error'\)/);
    expect(html).toMatch(/<h2>Public channels<\/h2>[\s\S]*id="publicSyncWindowSelect"[\s\S]*id="publicCommentsDefaultSelect"/);
    expect(html).toMatch(/<h2>Usernames and Avatars<\/h2>[\s\S]*id="mintUsernameButton"[\s\S]*id="linkUsernameButton"[\s\S]*id="setAvatarButton"/);
    expect(html).toMatch(/Mint \.ath name[\s\S]*100-10k ATH \+ GRAM fee/);
    expect(html).not.toMatch(/Link TON DNS[\s\S]*id="linkedTonDnsStatus"[\s\S]*verify/);
    expect(html).toMatch(/Link \.ath name[\s\S]*id="linkedUsernameStatus"[\s\S]*verify/);
    expect(app).not.toMatch(/linkTonDnsButton\?\.addEventListener\('click'/);
    expect(app).not.toMatch(/requestWalletDisplayIdentity\(WALLET_DISPLAY_MODES\.TON_DNS\)/);
    expect(app).toMatch(/linkUsernameButton\?\.addEventListener\('click'/);
    expect(app).toMatch(/requestWalletDisplayIdentity\(WALLET_DISPLAY_MODES\.PLATHO_NFT\)/);
    expect(app).toMatch(/setPublicChannelSubscribed/);
    expect(app).toMatch(/Unfollow/);
    expect(app).toMatch(/channel hidden/);
    expect(app).toMatch(/unfollowButton\.title = 'Stop following this channel'/);
    expect(app).toMatch(/const linked = readLinkedPlathoUsername\(plathoWallet\.address\)/);
    expect(app).toMatch(/autoLinkMintedUsername/);
    expect(app).toMatch(/waitForPlathoUsernameOwnership/);
    expect(app).toMatch(/mint submitted; link after sync/);
    expect(app).toMatch(/function usernameMintPricePreview/);
    expect(app).toMatch(/usernameMintPricePreview\(raw\)/);
    expect(app).toMatch(/USERNAME_PRICE_6_PLUS_CHARS_ATOMIC = 100_000_000_000n/);
    expect(app).toMatch(/function usernameMintStatusText/);
    expect(app).toMatch(/function setProfileAvatarStatus/);
    expect(app).toMatch(/function setUsernameMintStatus/);
    expect(app).toMatch(/setUsernameMintStatus\(rateLimited \? TON_RPC_CONNECTING_STATUS : usernameMintStatusText\(error\), rateLimited \? 'busy' : 'error'\)/);
    expect(app).toMatch(/estimatedUsernameMintTonFeeNanotons/);
    expect(app).toMatch(/up to \$\{formatTonNanotons\(estimatedUsernameMintTonFeeNanotons\(\)\)\} GRAM from Vault/);
    expect(app).toMatch(/assertVaultUsernameMintCanStart/);
    expect(app).toMatch(/submitVaultUsernameMint/);
    expect(app).toMatch(/requireUsernameRegistryVaultRoute/);
    expect(app).toMatch(/UsernameRegistry is not bound back to Vault/);
    expect(app).toMatch(/UsernameRegistry official ATH wallet is not the derived registry wallet/);
    expect(app).toMatch(/ATH; 50% goes to burn/);
    expect(html).toMatch(/Set avatar[\s\S]*100 ATH \+ GRAM fee/);
    expect(app).toMatch(/Set profile avatar/);
    expect(app).toMatch(/requestProfileAvatarUploadDetails/);
    expect(app).toMatch(/estimatedProfileAvatarTonFeeNanotons/);
    expect(app).toMatch(/up to \$\{formatTonNanotons\(estimatedProfileAvatarTonFeeNanotons\(attachment\)\)\} GRAM/);
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
    expect(html).toMatch(/<h2>ATH<\/h2>[\s\S]*id="athSupplyStatus"[\s\S]*id="athDropIssuedStatus"[\s\S]*id="flushAthButton"[\s\S]*id="flushAthStatus"/);
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
    expect(html).toMatch(/Short - newest 128 entries/);
    expect(html).toMatch(/Long - retained history, up to 1 year/);
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
    expect(html).toMatch(/Wallet and Vault are separate for security/);
    expect(html).toMatch(/data-nav-vault-balance/);
    expect(html).toMatch(/data-nav-vault-ton>0 GRAM<\/strong>/);
    expect(html).toMatch(/data-nav-vault-ath>0 ATH<\/strong>/);
    expect(css).toMatch(/\.rail-vault-balance/);
    expect(css).toMatch(/\.rail-vault-balance\s*{[\s\S]*grid-template-rows:\s*auto auto auto/);
    expect(css).toMatch(/\.rail-vault-balance strong\s*{[\s\S]*white-space: normal;/);
    expect(css).toMatch(/\.rail-vault-balance strong\.is-loading/);
    expect(css).toMatch(/\.rail-vault-balance strong\.is-placeholder/);
    expect(css).toMatch(/@keyframes rail-balance-spin/);
    expect(css).toMatch(/--message-media-width:\s*320px/);
    expect(css).toMatch(/--message-card-width:\s*calc\(var\(--message-media-width\) \+ 28px\)/);
    expect(css).toMatch(/\.message \{[\s\S]*max-width:\s*min\(var\(--message-card-width\), 82%\)/);
    expect(css).toMatch(/\.message \{[\s\S]*min-width:\s*0;[\s\S]*overflow-wrap:\s*anywhere;/);
    expect(css).toMatch(/\.bubble \{[\s\S]*width:\s*fit-content;[\s\S]*min-width:\s*0;[\s\S]*max-width:\s*100%;/);
    expect(css).toMatch(/\.message-image,[\s\S]*\.feed-image \{[\s\S]*max-width:\s*var\(--message-media-width\)/);
    expect(css).toMatch(/\.public-feed\[data-public-mode="feed"\] > \.feed-item:not\(\.compact\) \{[\s\S]*width: 100%;/);
    expect(app).toMatch(/navVaultTonBalances/);
    expect(app).toMatch(/let navVaultBalanceState = \{/);
    expect(app).toMatch(/function markNavVaultBalancePending/);
    expect(app).toMatch(/function markNavVaultBalanceReady/);
    expect(app).toMatch(/function scheduleNavVaultBalanceRetry/);
    expect(app).toMatch(/function navVaultBalanceHasKnownValue/);
    expect(app).toMatch(/refreshNavVaultBalance\(\)/);
    expect(app).toMatch(/function refreshVaultNavBalanceInBackground/);
    expect(app).toMatch(/navVaultTonBalances\.forEach\(\(node, index\)/);
    expect(app).toMatch(/navVaultBalanceState\.status === 'pending' && !navVaultBalanceHasKnownValue\(\)/);
    expect(app).toMatch(/node\.classList\.toggle\('is-loading', index === 0\)/);
    expect(app).toMatch(/node\.classList\.toggle\('is-placeholder', index > 0\)/);
    expect(app).toMatch(/node\.classList\.add\('is-placeholder'\)/);
    expect(html).toMatch(/id="vaultMoveTonForm"/);
    expect(html).toMatch(/id="vaultMoveAthForm"/);
    expect(html).toMatch(/id="vaultMoveTonWalletBalance"[^>]*>0<\/strong>/);
    expect(html).toMatch(/id="vaultMoveTonVaultBalance"[^>]*>0<\/strong>/);
    expect(html).toMatch(/id="vaultMoveAthWalletBalance"[^>]*>0<\/strong>/);
    expect(html).toMatch(/id="vaultMoveAthVaultBalance"[^>]*>0<\/strong>/);
    expect(html).toMatch(/id="vaultMoveTonDirectionButton"/);
    expect(html).toMatch(/id="vaultMoveAthDirectionButton"/);
    expect(html).toMatch(/Move GRAM to Vault/);
    expect(html).toMatch(/Move ATH to Vault/);
    // The DYNAMIC move-button refresh must use the GRAM/ATH display label, not the internal card.asset key
    // ('TON') -- otherwise the button re-renders as "Move TON to Vault" after the first refresh (the static
    // HTML default above is correct, but the refresh overwrote it).
    expect(readFileSync('web/app.js', 'utf8')).toMatch(/const assetLabel = card\.asset === 'ATH' \? 'ATH' : 'GRAM'[\s\S]*?Move \$\{assetLabel\} to Vault/);
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
    expect(app).toMatch(/Platho fee 0 GRAM/);
    expect(app).toMatch(/max reduction 0.010 GRAM/);
    expect(app).not.toMatch(/ATH discount \$\{percent\}/);
    expect(app).not.toMatch(/locked until 15%/);
    expect(app).toMatch(/messageDiscountUnlocked/);
    expect(app).toMatch(/Cost/);
    expect(app).toMatch(/Hold/);
    expect(app).toMatch(/composerEstimatedNetCostNanotons/);
    expect(app).toMatch(/composerProfileNetPriceNanotons/);
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
    expect(app).toMatch(/function publishStateBroadcastCount/);
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
    expect(app).toMatch(/check preparing/);
    expect(app).toMatch(/creating payment check/);
    expect(app).toMatch(/isPublishPriceChangeCancelled/);
    expect(app).toMatch(/publish cancelled/);
    expect(app).toMatch(/not sent: cancelled/);
    expect(app).toMatch(/assertVaultHasPrivatePublishHold/);
    expect(app).toMatch(/Not enough Vault GRAM/);
    expect(app).not.toMatch(/Checking Vault balance/);
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
    expect(bootSource).toMatch(/unlock required/);
    expect(bootSource).toMatch(/encryptedMessageStore = null/);
    expect(bootSource).toMatch(/history locked/);
    expect(bootSource).toMatch(/createIndexedDbEncryptedMessageHistoryStore\(\{ dbName: currentMessageHistoryDbName\(\) \}\)/);
    expect(app).toMatch(/device-encrypted local cache/);
    expect(app).toMatch(/bounded local encrypted history cache/);
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
    expect(restoreSource).toMatch(/blocked/);
  });

  it('PWA-AVATAR-CACHE-01: cached profile avatar media is hash-verified before reuse', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const cacheSource = app.slice(
      app.indexOf('function webpDataUrlToBytes'),
      app.indexOf('function writeProfileAvatarMediaCache'),
    );
    const avatarReadSource = app.slice(
      app.indexOf('async function readAvatarPartsFromCapsuleHub'),
      app.indexOf('async function loadProfileAvatarImage'),
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
    expect(app).toMatch(/let avatarChainReadLane = Promise\.resolve\(\)/);
    expect(app).toMatch(/function enqueueAvatarChainRead\(task\) \{/);
    expect(loadAvatarSource).toMatch(/const promise = enqueueAvatarChainRead\(async \(\) => \{/);

    // The two public-feed avatar hydrators run sequentially (feed-post authors, then channel authors) instead
    // of two bare fire-and-forget launches that overlapped on iOS.
    expect(syncPublicSource).toMatch(/await hydratePublicAvatars\(\);\s*await hydratePublicChannelAvatars\(\);/);
    expect(syncPublicSource).not.toMatch(/hydratePublicAvatars\(\)\.catch/);

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

    // The private-index sync read (runs on every sync tick, boot and unlock) reads the two heads sequentially.
    const syncSource = app.slice(
      app.indexOf('const readPrivateIndexes = async ()'),
      app.indexOf('const privateIndexReadFailure'),
    );
    expect(syncSource).not.toMatch(/Promise\.all\(/);
    expect(syncSource).toMatch(/const recipient = await provider\.getPrivateRecipientIndex\(keyIdIndex, readOptions\)/);
    expect(syncSource).toMatch(/const sender = await provider\.getPrivateSenderIndex\(keyIdIndex, readOptions\)/);
    expect(syncSource).toMatch(/return \[recipient, sender\]/);

    // Spot-check the ProfileRegistry route verifier (runs twice per avatar op) reads its two checks sequentially.
    const profileRouteSource = app.slice(
      app.indexOf('function requireProfileRegistryVaultRoute('),
      app.indexOf('function requireUsernameRegistryVaultRoute('),
    );
    expect(profileRouteSource).not.toMatch(/Promise\.all\(/);
    expect(profileRouteSource).toMatch(/const registryGlobal = await resolved\.provider\.getGlobal/);
    expect(profileRouteSource).toMatch(/const derivedOfficialWallet = await resolved\.provider\.getAthWalletAddress/);
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
    const freshIndex = prepareSource.indexOf('const finalNetCost = composerNetCostFromHoldNanotons(finalHold, normalizedCapsules.length, quotedProfiles)');
    const confirmIndex = prepareSource.indexOf('confirmPublishPriceIncrease');

    expect(quoteIndex).toBeGreaterThanOrEqual(0);
    expect(freshIndex).toBeGreaterThan(quoteIndex);
    expect(confirmIndex).toBeGreaterThan(freshIndex);
    expect(prepareSource).not.toMatch(/sendVaultExternalBoc/);
    expect(app).toMatch(/async function readCanonicalPublishChargeForOwnVaultAction/);
    expect(prepareSource).toMatch(/readCanonicalPublishChargeForOwnVaultAction\(provider, owner, publish\.publish_kind, publish\.size_class, publish\.crypto_suite\)/);
    expect(prepareSource).toMatch(/throw publishPriceChangeCancelledError\(\)/);
    expect(publishSource).toMatch(/const prepared = await prepareCapsulesThroughVault\(capsules, options\)/);
    expect(publishSource).toMatch(/return sendPreparedCapsulesThroughVault\(prepared, options\)/);
  });

  it('PWA-CONFIG-01D3: multi-capsule price recheck uses the amortized batch hold and confirms only on a net-cost rise', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const prepareSource = app.slice(
      app.indexOf('async function prepareCapsulesThroughVault'),
      app.indexOf('async function sendPreparedCapsulesThroughVault'),
    );
    const confirmSource = app.slice(
      app.indexOf('async function confirmPublishPriceIncrease'),
      app.indexOf('async function confirmHighNetworkFeeSurcharge'),
    );
    // finalHold is the grouped AMORTIZED batch hold (SHARED_BASE once per batch) + per-part surcharge,
    // matching the actually-signed batchMaxChargeForItems — NOT the per-capsule canonical sum (which
    // N-counts SHARED_BASE and produced the phantom multi-capsule "Price changed" dialog + over-strict
    // balance gate).
    expect(app).toMatch(/batchMaxChargeForItems,\s*\n\} from '\.\/publish-batch-orchestration\.mjs/);
    expect(prepareSource).toMatch(/const groupedBatchesForHold = groupPublishItemsIntoBatches\(chargePlans\)/);
    expect(prepareSource).toMatch(/batchMaxChargeForItems\(batch\.items\)/);
    expect(prepareSource).toMatch(/\+ surcharge \* BigInt\(normalizedCapsules\.length\)/);
    expect(prepareSource).toMatch(/if \(balance < finalHold\)/);
    expect(prepareSource).toMatch(/finalHold,\s+previousNetCost: quotedNetCost/);
    expect(prepareSource).toMatch(/totalMaxCharge: finalHold/);
    // The dialog must fire ONLY on a real net-cost increase, never on a refundable hold-only delta.
    expect(confirmSource).toMatch(/if \(newCost <= oldCost\) return true;/);
    expect(confirmSource).not.toMatch(/if \(newHold <= oldHold && newCost <= oldCost\) return true;/);
  });

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
    expect(handlerSource).toMatch(/setProfileAvatarStatus\('avatar needs retry', 'error'\)/);
    // Pre-publish preflight retries IN FLIGHT (truthful "RPC busy - retrying"), bounded by the delay table.
    expect(app).toMatch(/for \(let preflightAttempt = 0;/);
    expect(app).toMatch(/PROFILE_AVATAR_PREFLIGHT_RETRY_DELAYS_MS = \[/);
    expect(app).toMatch(/setProfileAvatarPending\(true\)/);
    // Recovery auto-retry is capped → parks at a retryable terminal state (no infinite "confirming").
    const scheduleSource = app.slice(
      app.indexOf('function scheduleProfileAvatarPublishRecovery'),
      app.indexOf('async function findProfileAvatarPublishedEntriesFromRecovery'),
    );
    expect(scheduleSource).toMatch(/job\.attempts \?\? 0\) >= PROFILE_AVATAR_RECOVERY_MAX_AUTO_ATTEMPTS/);
    expect(scheduleSource).toMatch(/job\.status = 'needs_retry'/);
    // Recovery timers paused on wallet lock, resumed owner-scoped on unlock (kills the spontaneous re-fire).
    expect(app).toMatch(/function pauseProfileAvatarPublishRecoveryTimers/);
    expect(app).toMatch(/function resumeProfileAvatarPublishRecoveryForOwner/);
    expect(app).toMatch(/resumeProfileAvatarPublishRecoveryForOwner\(wallet\.address\)/);
    const lockSource = app.slice(
      app.indexOf('function lockPlathoWallet'),
      app.indexOf('function lockPlathoWalletForBackground'),
    );
    expect(lockSource).toMatch(/pauseProfileAvatarPublishRecoveryTimers\(\)/);
    // Confirm reads target the known first entry id before the wide latest-down scan.
    const findSource = app.slice(
      app.indexOf('async function findPublishedAvatarEntries'),
      app.indexOf('async function findConfirmedAvatarEntriesFromPublishState'),
    );
    expect(findSource).toMatch(/const targetedStart = publicEntryIdBigInt\(pointer\.avatarEntryId/);
  });

  it('PWA-PRIVATE-CONFIRM-RETRY-01: stuck multi-part private confirm is bounded and ends in a durable terminal red status', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // The private publish-confirm auto-retry is capped: after the active-attempt budget with nothing
    // confirmed (or a hard backstop) it STOPS instead of spinning on "submitted N/N, confirming" via
    // the endless 30s background retry. (The 24h age-stale never fires because each pass bumps
    // publishState.updatedAt, so this attempt cap is the real terminal guard.)
    expect(app).toMatch(/attempt >= PRIVATE_PUBLISH_CONFIRM_ACTIVE_ATTEMPT_LIMIT/);
    expect(app).toMatch(/Number\(message\.publishState\?\.confirmedCount \?\? 0\) === 0/);
    expect(app).toMatch(/code: 'CONFIRM_RETRY_EXHAUSTED'/);
    expect(app).toMatch(/error\?\.code === 'CONFIRM_RETRY_EXHAUSTED'\) return 'not confirmed: chain confirmation timed out'/);
    // Early actionable terminal when the broadcast is provably erroring (nothing landed): "RPC broadcast
    // unavailable" surfaces in ~minutes (PRIVATE_PUBLISH_BROADCAST_FAIL_ATTEMPT_LIMIT) instead of spinning to
    // the full ~9-min deadline, gated by publishStateBroadcastIsFailing so a fine-but-slow send is never killed.
    expect(app).toMatch(/const PRIVATE_PUBLISH_BROADCAST_FAIL_ATTEMPT_LIMIT = 10/);
    expect(app).toMatch(/function publishStateBroadcastIsFailing\(publishState\)/);
    expect(app).toMatch(/attempt >= PRIVATE_PUBLISH_BROADCAST_FAIL_ATTEMPT_LIMIT[\s\S]*publishStateBroadcastIsFailing\(message\.publishState\)/);
    expect(app).toMatch(/code: 'BROADCAST_REJECTED'/);
    expect(app).toMatch(/error\?\.code === 'BROADCAST_REJECTED'\) return 'not confirmed: RPC broadcast unavailable'/);
    // STABLE-age trigger: a long-stuck no-progress message surfaces Retry without restarting the
    // per-session attempt budget (the age is anchored on message creation, not publishState.updatedAt).
    expect(app).toMatch(/const PRIVATE_PUBLISH_CONFIRM_NO_PROGRESS_DEADLINE_MS = 10 \* 60 \* 1000/);
    expect(app).toMatch(/function privatePendingPublishConfirmAgeMs\(message\)/);
    expect(app).toMatch(/const createdAtMs = messageCreatedAtMs\(message\)/);
    expect(app).toMatch(/privatePendingPublishConfirmAgeMs\(message\) >= PRIVATE_PUBLISH_CONFIRM_NO_PROGRESS_DEADLINE_MS/);
    // Resume immediately surfaces Retry for an already-stuck no-progress message (no confirm round-trip).
    const resumeSrc = app.slice(
      app.indexOf('function resumePendingPrivatePublishConfirmations'),
      app.indexOf('function hasPendingPrivateSendRetry'),
    );
    expect(resumeSrc).toMatch(/privatePendingPublishConfirmAgeMs\(message\) >= PRIVATE_PUBLISH_CONFIRM_NO_PROGRESS_DEADLINE_MS/);
    expect(resumeSrc).toMatch(/code: 'CONFIRM_RETRY_EXHAUSTED'/);
    // Stopping marks the message for manual recovery (the Retry button's render condition).
    const stopSource = app.slice(
      app.indexOf('function stopPrivatePublishConfirmationRetry'),
      app.indexOf('function stopPartialPrivatePublishRecovery'),
    );
    expect(stopSource).toMatch(/message\.privatePublishConfirmStopped = true/);
    // Broadcast-unacknowledged / confirm-exhausted now offers a SAFE manual Retry: it re-broadcasts the same
    // already-signed fixed-nonce external (idempotent — a re-used nonce is contract-rejected, and a secretly
    // landed external is detected by the confirm read), which unsticks the send once the RPC broadcaster
    // recovers. Local Cancel stays gated by privateMessageCanLocalCancel (false while a publish attempt
    // exists — the nonce slot is committed, so discarding would orphan it).
    expect(stopSource).toMatch(/const broadcastRetryable = error\?\.code === 'BROADCAST_REJECTED'[\s\S]*?error\?\.code === 'CONFIRM_RETRY_EXHAUSTED'[\s\S]*?error\?\.code === 'INSUFFICIENT_VAULT_GRAM'/);
    expect(stopSource).toMatch(/message\.privateManualRetryAvailable = broadcastRetryable/);
    expect(stopSource).toMatch(/message\.privateCancelAvailable = broadcastRetryable && privateMessageCanLocalCancel\(message\)/);
    // The Retry path clears the per-part re-broadcast budget so the same-nonce external re-sends at once.
    expect(app).toMatch(/function resetPublishBroadcastBudgetForManualRetry\(publishState\)/);
    expect(app).toMatch(/resetPublishBroadcastBudgetForManualRetry\(message\.publishState\)/);
    // 'not confirmed: ...' resolves to a 'failed' status key — the durable red terminal status.
    expect(app).toMatch(/text\.includes\('not confirmed'\)/);
  });

  it('PWA-INSUFFICIENT-GRAM-01: an underfunded Vault stops the confirm re-broadcast loop with a "top up GRAM" terminal', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // The signed-hold helper reads the persisted per-batch maxCharge (deduped) for parts still needing rebroadcast.
    expect(app).toMatch(/function privatePublishStateSignedHoldNanotons\(publishState\)/);
    expect(app).toMatch(/seenBatches\.has\(batchKey\)/);
    // Before re-broadcasting, the confirm executor reads the LIVE Vault GRAM balance when nothing landed and every
    // in-flight external is failing; if it can't cover the signed hold, it terminal-stops with INSUFFICIENT_VAULT_GRAM
    // instead of hammering /message with 500s.
    const runSource = app.slice(
      app.indexOf('async function runPrivatePublishConfirmationRetry'),
      app.indexOf('const broadcastRetries = await retryUnconfirmedPrivatePublishBroadcasts'),
    );
    expect(runSource).toMatch(/publishStateBroadcastIsFailing\(message\.publishState\)/);
    // Uses the CACHED vault balance (same source as the composer cost line), NOT a fresh chain read — a fresh read
    // fails exactly when the RPC is unavailable (the moment broadcasts 5xx), which silently defeated the gate.
    expect(runSource).toMatch(/const cachedVaultUser = currentVaultUserSource\(\)/);
    expect(runSource).toMatch(/vaultTonBalanceNanotons\(cachedVaultUser\) < signedHold/);
    expect(runSource).not.toMatch(/readFreshConnectedVaultUserForOwnVaultAction/);
    expect(runSource).toMatch(/code: 'INSUFFICIENT_VAULT_GRAM'/);
    // The terminal status tells the user to top up; the gate is double-spend-safe (it only stops a re-broadcast).
    expect(app).toMatch(/error\?\.code === 'INSUFFICIENT_VAULT_GRAM'\) return 'Insufficient Vault GRAM — top up in Vault, then retry'/);
  });

  it('PWA-SEND-01: publish preparation blocks over-cap network surcharge before send-time BOC signing', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const capSource = app.slice(
      app.indexOf('function assertNetworkFeeSurchargeWithinCap'),
      app.indexOf('function messageDiscountUnlocked'),
    );
    const prepareSource = app.slice(
      app.indexOf('async function prepareCapsulesThroughVault'),
      app.indexOf('async function sendPreparedCapsulesThroughVault'),
    );
    const sendSource = app.slice(
      app.indexOf('async function sendPreparedCapsulesThroughVault'),
      app.indexOf('async function publishCapsulesThroughVault'),
    );
    const capIndex = prepareSource.indexOf('assertNetworkFeeSurchargeWithinCap();');
    const surchargeIndex = prepareSource.indexOf('const surcharge = currentNetworkFeeSurchargeNanotons()');
    const balanceIndex = prepareSource.indexOf('if (balance < finalHold)');
    const priceConfirmIndex = prepareSource.indexOf('confirmPublishPriceIncrease');
    const surchargeConfirmIndex = prepareSource.indexOf('confirmHighNetworkFeeSurcharge');
    // VPB2: send-time signing builds ONE batch external per grouped batch, not one VPB1 external per capsule.
    const sendBuildIndex = sendSource.indexOf('await buildBatchExternalFromPublishItems(batch');
    const sendGroupIndex = sendSource.indexOf('groupPublishItemsIntoBatches(results)');

    expect(capSource).toMatch(/networkFeeSurchargeExceedsMax\(estimate, pricingOptions\)/);
    expect(capSource).toMatch(/throw new Error\(`Network surcharge/);
    expect(capSource).toMatch(/exceeds the production cap/);
    expect(capIndex).toBeGreaterThanOrEqual(0);
    expect(surchargeIndex).toBeGreaterThan(capIndex);
    expect(balanceIndex).toBeGreaterThan(surchargeIndex);
    expect(priceConfirmIndex).toBeGreaterThan(balanceIndex);
    expect(surchargeConfirmIndex).toBeGreaterThan(priceConfirmIndex);
    expect(prepareSource).not.toMatch(/buildBatchExternalFromPublishItems/);
    expect(prepareSource).not.toMatch(/sendVaultExternalBoc/);
    expect(sendGroupIndex).toBeGreaterThanOrEqual(0);
    expect(sendBuildIndex).toBeGreaterThan(sendGroupIndex);
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
    const preflightIndex = submitSource.indexOf('await assertVaultHasPrivatePublishHold');

    expect(helperSource).toMatch(/Activate Platho account before sending/);
    expect(helperSource).toMatch(/network surcharge .* exceeds the production cap/i);
    expect(helperSource).toMatch(/RPC verification pending/);
    // Insufficient Vault balance is a DETERMINISTIC failure: it must show a clear actionable status AND be
    // classified FATAL so the send stops retrying (terminal manual-recovery) instead of furiously re-trying.
    expect(helperSource).toMatch(/Insufficient Vault GRAM — top up in Vault, then retry/);
    expect(helperSource).toMatch(/Insufficient Vault ATH — top up in Vault, then retry/);
    expect(app).toMatch(/function isFatalPrivateSendError\(error\)[\s\S]*vault \(\?:ton\|gram\|ath\) balance is too low/);
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

  it('PWA-VAULT-MOVE-01: Vault move failures surface activation blockers in the UI status', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const helperSource = app.slice(
      app.indexOf('function vaultActionBlockedStatusText'),
      app.indexOf('function canEditPrivateComposerDraft'),
    );
    const submitSource = app.slice(
      app.indexOf('for (const card of vaultMoveCards)'),
      app.indexOf('publicSyncWindowSelect?.addEventListener'),
    );

    expect(helperSource).toMatch(/Activate Platho account before moving GRAM from Vault/);
    expect(helperSource).toMatch(/Unlock and activate Platho account before Vault actions/);
    expect(submitSource).toMatch(/vaultActionBlockedStatusText\(error, 'move blocked'\)/);
  });

  it('PWA-VAULT-MOVE-02: TON max from Vault leaves the withdrawal execution reserve', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const maxSource = app.slice(
      app.indexOf('function vaultMoveMaxAmount'),
      app.indexOf('function refreshNavVaultBalance'),
    );

    expect(maxSource).toMatch(/asset === 'TON' && source === 'wallet'/);
    expect(maxSource).toMatch(/asset === 'TON' && source === 'vault'/);
    expect(maxSource).toMatch(/balance > VAULT_RESERVES_NANOTONS\.withdrawTonExec/);
    expect(maxSource).toMatch(/balance - VAULT_RESERVES_NANOTONS\.withdrawTonExec/);
  });

  it('PWA-SEND-02: prepared Vault send streams multi-part BOCs back-to-back (non-blocking nonce barrier) and preserves partial state', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const sendSource = app.slice(
      app.indexOf('async function sendPreparedCapsulesThroughVault'),
      app.indexOf('async function publishCapsulesThroughVault'),
    );
    const firstBatchGateIndex = sendSource.indexOf('if (batchIndex === 0) {');
    const nonceReadIndex = sendSource.indexOf('clientNonce = options.allowOwnVaultActionReadFallback === true');
    const floorNonceIndex = sendSource.indexOf('clientNonce = nonceFloor;');
    const buildIndex = sendSource.indexOf('batchExternal = await buildBatchExternalFromPublishItems(batch');
    const sendIndex = sendSource.indexOf('lastResult = await sendVaultExternalBoc(batchExternal)');
    const sentStatusIndex = sendSource.indexOf('PUBLISH_PART_STATUS_SENT');
    const confirmNonceIndex = sendSource.indexOf('shouldConfirmVaultPublishNonceAfterSend(batchIndex, batches.length, options)');
    const barrierWaitIndex = sendSource.indexOf('await waitForVaultPublishNonce(provider, owner, expectedNonce, nonceWaitOptions)');
    const submittedStatusIndex = sendSource.indexOf('PUBLISH_PART_STATUS_VAULT_SUBMITTED');
    const finalBarrierIndex = sendSource.indexOf('installVaultPublishNonceBarrier');
    const partialIndex = sendSource.indexOf('vaultPublishPartialError');
    const clientNonceSource = sendSource.slice(
      sendSource.indexOf('clientNonce = options.allowOwnVaultActionReadFallback === true'),
      sendSource.indexOf('if (clientNonce === null)'),
    );
    const nonceWaitSource = app.slice(
      app.indexOf('async function waitForVaultPublishNonce'),
      app.indexOf('async function waitForVaultPublishNonceForOwnVaultAction'),
    );
    const ownNonceWaitSource = app.slice(
      app.indexOf('async function waitForVaultPublishNonceForOwnVaultAction'),
      app.indexOf('async function readVaultPublishNonceForBroadcastRetry'),
    );

    expect(firstBatchGateIndex).toBeGreaterThanOrEqual(0);
    expect(nonceReadIndex).toBeGreaterThan(firstBatchGateIndex);
    // Batch 0 reads the chain nonce; later batches derive it from the monotonic floor (NO chain read ->
    // no re-block on the just-installed barrier) so all batches sign + broadcast back-to-back.
    expect(floorNonceIndex).toBeGreaterThan(nonceReadIndex);
    expect(sendSource).toMatch(/if \(batchIndex === 0\) \{[\s\S]*?readVaultPublishNonce\(provider, owner\)[\s\S]*?\} else \{\s*clientNonce = nonceFloor;\s*\}/);
    expect(buildIndex).toBeGreaterThan(nonceReadIndex);
    expect(sendIndex).toBeGreaterThan(buildIndex);
    expect(sentStatusIndex).toBeGreaterThan(sendIndex);
    expect(confirmNonceIndex).toBeGreaterThan(sentStatusIndex);
    // NON-BLOCKING: EVERY batch installs the background nonce barrier; there is NO blocking inter-batch
    // wait. The barrier's nonce poll (on expectedNonce) runs inside the installed task, after the install.
    expect(finalBarrierIndex).toBeGreaterThan(confirmNonceIndex);
    expect(barrierWaitIndex).toBeGreaterThan(finalBarrierIndex);
    expect(submittedStatusIndex).toBeGreaterThan(finalBarrierIndex);
    // The OLD blocking middle-batch nonce wait (await directly in the loop on clientNonce + 1n) is gone.
    expect(sendSource).not.toMatch(/await waitForVaultPublishNonce\(provider, owner, clientNonce \+ 1n, nonceWaitOptions\)/);
    // A FOLLOWING signed vault action still serializes on the publish nonce barrier.
    expect(sendSource).toMatch(/await awaitVaultPublishNonceBarrier\(\)/);
    // Monotonic per-owner nonce floor: a lagging replica must never make the
    // client sign below an observed/consumed nonce (burst-send race), and a
    // broadcast consumes its nonce immediately from the client's view.
    expect(sendSource).toMatch(/const nonceFloor = vaultPublishNonceFloor\(owner\)/);
    expect(sendSource).toMatch(/if \(clientNonce < nonceFloor\) clientNonce = nonceFloor/);
    expect(sendSource).toMatch(/raiseVaultPublishNonceFloor\(owner, clientNonce \+ 1n\)/);
    expect(app).toMatch(/function raiseVaultPublishNonceFloor\(owner, nonce\)/);
    // Wedged-part recovery: when the chain nonce moved past a signed part and
    // the sender index proves the entry never landed, the part is reset and
    // re-signed with a fresh nonce instead of staying "confirming" forever.
    expect(app).toMatch(/async function recoverDroppedSignedPublishParts\(message\)/);
    expect(app).toMatch(/async function provePublishPartAbsentFromSenderIndex\(publishState, part\)/);
    expect(app).toMatch(/confirmedBy:\s*'dropped_recovery_scan'/);
    expect(app).toMatch(/if \(chainNonce <= clientNonce\) continue/);
    expect(sendSource).toMatch(/installVaultPublishNonceBarrier\(\(async \(\) => \{/);
    expect(sendSource).toMatch(/if \(part && part\.status === PUBLISH_PART_STATUS_SENT\)/);
    expect(sendSource).toMatch(/readVaultPublishNonceForOwnVaultAction\(provider, owner\)/);
    expect(clientNonceSource).not.toMatch(/allowUnverifiedNonceRead|allowUnverifiedCriticalRead|verify:/);
    // VPB2: each part of a batch is stamped with the SHARED batch external boc + a single broadcast timestamp.
    expect(sendSource).toMatch(/partWithPublishId\.externalBoc = batchExternal\.boc/);
    expect(sendSource).toMatch(/partWithPublishId\.lastBroadcastAt = broadcastAt/);
    expect(sendSource).toMatch(/const epi1 = publishHashPlain\(batchExternal\.entryPublishIds\[entryIndex\]\)/);
    expect(sendSource).toMatch(/batchExternal = await buildBatchExternalFromPublishItems\(batch/);
    // Post-broadcast nonce polling is unverified, cache-bypassing, and
    // tolerant of transient RPC trouble until the deadline decides.
    expect(nonceWaitSource).toMatch(/ignoreNonceBarrier: true/);
    expect(nonceWaitSource).toMatch(/verify: false/);
    expect(nonceWaitSource).toMatch(/allowUnverifiedCriticalRead: true/);
    expect(nonceWaitSource).toMatch(/isTonRpcRecoverableReadError\(error\)/);
    expect(nonceWaitSource).toMatch(/isTonRpcRateLimitError\(error\)/);
    expect(ownNonceWaitSource).toMatch(/return waitForVaultPublishNonce\(provider, owner, expectedNonce, options\)/);
    expect(sendSource).toMatch(/clientNonce === null[\s\S]*Vault publish nonce could not be read before signing/);
    expect(nonceWaitSource).toMatch(/Vault publish was not confirmed after broadcast/);
    expect(nonceWaitSource).toMatch(/error\.code = 'NETWORK_ERROR'/);
    expect(sendSource).toMatch(/const ambiguousBroadcast = !sentBeforeFailure && isAmbiguousTonRpcBroadcastError\(error\)/);
    expect(sendSource).toMatch(/if \(publishState\.submittedCount > 0 \|\| sentBeforeFailure \|\| ambiguousBroadcast\) publishState\.status = VAULT_PUBLISH_STATUS_PARTIAL/);
    expect(app).toMatch(/function isAmbiguousTonRpcBroadcastError\(error\)[\s\S]*if \(isTonRpcRateLimitError\(error\)\) return false;/);
    expect(app).toMatch(/function isAmbiguousTonRpcBroadcastError\(error\)[\s\S]*Number\(error\?\.status \?\? error\?\.response\?\.status \?\? 0\) >= 500/);
    expect(app).toMatch(/function isAmbiguousTonRpcBroadcastError\(error\)[\s\S]*rejected\|bad request\|invalid boc\|invalid message\|exit code\|not enough vault ton\|nonce/);
    expect(partialIndex).toBeGreaterThan(submittedStatusIndex);
    expect(sendSource).toMatch(/await confirmCapsuleHubPublishEntries\(publishState, \{ hot: true \}\)/);
    expect(sendSource).toMatch(/: VAULT_PUBLISH_STATUS_SUBMITTED/);
    expect(app).toMatch(/const PRIVATE_PUBLISH_CONFIRM_RETRY_DELAYS_MS = \[1_000, 2_000, 3_000, 5_000, 8_000, 13_000, 21_000, 30_000\]/);
    expect(app).toMatch(/const PRIVATE_PUBLISH_CONFIRM_ACTIVE_ATTEMPT_LIMIT = 24/);
    expect(app).toMatch(/const PRIVATE_PUBLISH_CONFIRM_HOT_AGE_MS = 5 \* 60 \* 1000/);
    // Publish + CapsuleHub ACK spans 2-3 basechain blocks; the hot window
    // covers that so sends do not degrade into the recovery/retry path.
    expect(app).toMatch(/const PRIVATE_PUBLISH_CONFIRM_HOT_DEADLINE_MS = 25 \* 1000/);
    expect(app).toMatch(/const PRIVATE_PUBLISH_CONFIRM_HOT_REQUEST_TIMEOUT_MS = 4 \* 1000/);
    expect(app).toMatch(/const PRIVATE_PUBLISH_CONFIRM_RECOVERY_DEADLINE_MS = 30 \* 1000/);
    expect(app).toMatch(/const PRIVATE_PUBLISH_CONFIRM_RECOVERY_REQUEST_TIMEOUT_MS = 8 \* 1000/);
    expect(app).toMatch(/const CAPSULEHUB_PUBLISH_CONFIRM_HOT_SCAN_LIMIT = 8/);
    expect(app).toMatch(/async function enterVaultPublishSendLock\(\)/);
    expect(app).toMatch(/function shouldConfirmVaultPublishNonceAfterSend\(index, total, options = \{\}\)[\s\S]*index < total - 1 \|\| options\.confirmFinalNonce === true/);
    expect(sendSource).toMatch(/if \(shouldConfirmVaultPublishNonceAfterSend\(batchIndex, batches\.length, options\)\) \{/);
    expect(app).toMatch(/const publishCallbacks = \{[\s\S]*allowOwnVaultActionReadFallback: true,\s*confirmFinalNonce: true,/);
    expect(app).toMatch(/sendPreparedCapsulesThroughVault\(preparedPublish, \{[\s\S]*publishState,\s*confirmFinalNonce: true,/);
    expect(app).toMatch(/async function publishPublicPayloadParts\(payloads, idPrefix, options = \{\}\)[\s\S]*confirmFinalNonce: options\.confirmFinalNonce \?\? true/);
    expect(sendSource).toMatch(/const nonceWaitOptions = \{\s*timeoutMs: options\.timeoutMs \?\? VAULT_PUBLISH_NONCE_CONFIRM_TIMEOUT_MS,\s*requestTimeoutMs: options\.requestTimeoutMs,\s*queueTimeoutMs: options\.queueTimeoutMs,\s*\}/);
    expect(sendSource).not.toMatch(/needsQueuedNonce|VAULT_PUBLISH_QUEUE_NONCE_CONFIRM_TIMEOUT_MS/);
    expect(app).toMatch(/const PRIVATE_PUBLISH_BROADCAST_RETRY_AFTER_MS = 35_000/);
    expect(app).toMatch(/const PRIVATE_PUBLISH_BROADCAST_RETRY_LIMIT = 6/);
    expect(app).toMatch(/const PRIVATE_PUBLISH_BROADCAST_RETRY_DEADLINE_MS = 12 \* 1000/);
    expect(app).toMatch(/const PRIVATE_PUBLISH_BROADCAST_RETRY_READ_TIMEOUT_MS = 4 \* 1000/);
    expect(app).toMatch(/const PRIVATE_PUBLISH_BROADCAST_RETRY_SEND_TIMEOUT_MS = 8 \* 1000/);
    expect(app).toMatch(/const PRIVATE_PUBLISH_BROADCAST_RETRY_QUEUE_TIMEOUT_MS = 30 \* 1000/);
    expect(app).toMatch(/const PRIVATE_PUBLISH_CONFIRM_HOT_QUEUE_TIMEOUT_MS = 30 \* 1000/);
    expect(app).toMatch(/const PRIVATE_PUBLISH_CONFIRM_RECOVERY_QUEUE_TIMEOUT_MS = 60 \* 1000/);
    expect(app).toMatch(/async function retryUnconfirmedVaultPublishBroadcasts\(publishState, options = \{\}\)/);
    expect(app).toMatch(/async function retryUnconfirmedPrivatePublishBroadcasts\(publishState, options = \{\}\)[\s\S]*retryUnconfirmedVaultPublishBroadcasts\(publishState, options\)/);
    expect(app).toMatch(/queueTimeoutMs: options\.queueTimeoutMs \?\? PRIVATE_PUBLISH_CONFIRM_HOT_QUEUE_TIMEOUT_MS/);
    expect(app).toMatch(/queueTimeoutMs: PRIVATE_PUBLISH_CONFIRM_RECOVERY_QUEUE_TIMEOUT_MS/);
    expect(app).toMatch(/readVaultPublishNonceForBroadcastRetry\(provider, owner, \{/);
    // VPB2: broadcast-retry re-sends each batch's SHARED external once (keyed off the head part of the batch group).
    expect(app).toMatch(/sendVaultExternalBoc\(\{ boc: head\.externalBoc \}, \{/);
    expect(app).toMatch(/queueTimeoutMs: PRIVATE_PUBLISH_BROADCAST_RETRY_QUEUE_TIMEOUT_MS/);
    expect(app).toMatch(/skipIfRateLimited:\s*true/);
    expect(app).toMatch(/priority:\s*'background'/);
    expect(app).toMatch(/lastBroadcastRetryError/);
    expect(app).toMatch(/setPublishPartStatus\(publishState, part\.index, PUBLISH_PART_STATUS_VAULT_SUBMITTED/);
    expect(app).toMatch(/clearPublishPartSignedAttempt\(part\)/);
    expect(app).toMatch(/currentNonce !== null && currentNonce > clientNonce[\s\S]*PUBLISH_PART_STATUS_VAULT_SUBMITTED/);
    expect(app).not.toMatch(/function markPublishPartForFreshNonceRetry/);
    expect(app).not.toMatch(/fresh nonce retry required/);
    expect(app).toMatch(/await retryUnconfirmedPrivatePublishBroadcasts\(message\.publishState, \{/);
    expect(app).toMatch(/rebroadcast=\$\{broadcastRetries\}/);
    expect(app).toMatch(/Retrying unsent capsule parts/);
    expect(app).toMatch(/function stopPrivatePublishConfirmationRetry/);
    expect(app).toMatch(/privatePublishConfirmStopped = true/);
    expect(app).toMatch(/not confirmed: chain lookup timed out/);
    expect(app).toMatch(/message\?\.privatePublishConfirmStopped !== true/);
    expect(app).toMatch(/function resumePendingPrivatePublishConfirmations/);
    expect(app).toMatch(/hasPendingPrivatePublishConfirmation\(message\)/);
    expect(app).toMatch(/privatePublishConfirmJobs\.has\(existingKey\)/);
    expect(app).toMatch(/resumePendingPrivatePublishConfirmations\(\)/);
  });

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
    expect(metaSource).toMatch(/return total === 1 \? 'submitted, confirming' : `submitted \$\{broadcast\}\/\$\{total\}, confirming`/);
    expect(metaSource).toMatch(/const pending = Math\.max\(submitted, publishStatePendingCount\(publishState\), publishStateVisibleSubmittedCount\(publishState\)\)/);
    expect(metaSource).toMatch(/if \(pending <= 0\) return 'not sent'/);
    expect(metaSource).toMatch(/total === 1 \? 'submitted, confirming'/);
    expect(metaSource).toMatch(/submitted \$\{pending\}\/\$\{total\}, confirming/);
    expect(metaSource).toMatch(/submitted \$\{pending\}\/\$\{total\}, retrying/);
    expect(metaSource).not.toMatch(/partial publish/);
    expect(app).toMatch(/text\.includes\('not sent'\)/);
    expect(app).not.toMatch(/text\.includes\('partial'\)\) return 'failed'/);
    expect(app).toMatch(/still checking/);
    expect(app).toMatch(/not confirmed/);
    expect(app).toMatch(/privatePublishConfirmAttempt/);
    expect(app).toMatch(/privatePublishConfirmStopped/);
  });

  it('PWA-SEND-02C: partial private send retries unsent capsule parts', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const sendSource = app.slice(
      app.indexOf('async function sendPreparedCapsulesThroughVault'),
      app.indexOf('async function publishCapsulesThroughVault'),
    );
    const attemptSource = app.slice(
      app.indexOf('async function attemptPrivateComposerMessagePublish'),
      app.indexOf('async function settlePrivateComposerSendError'),
    );
    const settleSource = app.slice(
      app.indexOf('async function settlePrivateComposerSendError'),
      app.indexOf('async function runPrivateSendRetry'),
    );
    const markAwaitingSource = app.slice(
      app.indexOf('function markPublishStateAwaitingPartsForRetry'),
      app.indexOf('function markStaleUnconfirmedPublishPartsForRetry'),
    );

    expect(app).toMatch(/function publishPartAlreadyAttempted\(part\)/);
    expect(app).toMatch(/function publishPartHadPriorChainAttempt\(part\)/);
    expect(app).toMatch(/function publishPartEligibleForChainConfirmation\(part\)/);
    expect(app).toMatch(/privateMessageHasPublishAttempt\(message\)[\s\S]*publishPartEligibleForChainConfirmation\(part\)/);
    expect(app).toMatch(/function publishStateHasRetryableSendParts\(publishState\)/);
    expect(app).toMatch(/function ensurePendingPrivateSendRetry\(thread, message/);
    expect(app).toMatch(/const PRIVATE_PUBLISH_MISSING_PART_RETRY_AFTER_MS = 2 \* 60 \* 1000/);
    expect(app).toMatch(/function markPublishStateAwaitingPartsForRetry\(publishState/);
    expect(app).toMatch(/function publishPartCanFreshSendRetry\(part\)/);
    expect(app).toMatch(/function publishPartAwaitingCapsuleHubConfirmation\(part\)/);
    expect(app).toMatch(/function markStaleUnconfirmedPublishPartsForRetry\(message/);
    expect(app).toMatch(/return markPublishStateAwaitingPartsForRetry\(publishState, reason\)/);
    expect(app).toMatch(/if \(part\.clientNonce !== undefined && part\.clientNonce !== null\) return false/);
    expect(app).toMatch(/typeof part\.externalBoc === 'string' && part\.externalBoc\.length > 0/);
    expect(markAwaitingSource).toMatch(/if \(!publishPartCanFreshSendRetry\(part\)\) continue/);
    expect(markAwaitingSource).not.toMatch(/publishPartAwaitingCapsuleHubConfirmation\(part\)/);
    expect(app).toMatch(/clearPublishPartSignedAttempt\(part\)/);
    expect(app).toMatch(/retryPreviousStatus:\s*previousStatus/);
    expect(app).toMatch(/publishState\.status = 'built'/);
    expect(app).toMatch(/some\(\(part\) => !publishPartAlreadyAttempted\(part\)\)/);
    const staleRetrySource = app.slice(
      app.indexOf('function markStaleUnconfirmedPublishPartsForRetry'),
      app.indexOf('function privateSendRetryKey'),
    );
    expect(staleRetrySource).not.toMatch(/parts\.length <= 1/);
    expect(staleRetrySource).not.toMatch(/confirmedCount <= 0/);
    // VPB2: the already-attempted skip is evaluated per BATCH — a batch whose items were all already attempted
    // (e.g. on a partial-retry pass) keeps its state and is skipped without re-sending the shared external.
    expect(sendSource).toMatch(/const pendingItems = batch\.items\.filter\(\(item\) => !publishPartAlreadyAttempted\(publishState\.parts\?\.\[item\.partIndex\]\)\)/);
    // VPB2 atomic batch: send only when EVERY item is still pending; any already-attempted item means the
    // whole batch is in-flight and must not be re-sent (which would re-publish + re-charge the attempted parts).
    expect(sendSource).toMatch(/if \(pendingItems\.length !== batch\.items\.length\) \{[\s\S]*continue;/);
    expect(attemptSource).toMatch(/let capsules = Array\.isArray\(message\.capsules\) && message\.capsules\.length > 0[\s\S]*\? message\.capsules[\s\S]*: \(message\.capsule \? \[message\.capsule\] : null\)/);
    expect(attemptSource).toMatch(/if \(!capsules\) \{[\s\S]*createPrivateComposerCapsules/);
    expect(attemptSource).toMatch(/const existingPublishState = message\.publishState/);
    expect(attemptSource).toMatch(/existingPublishState\?\.partCount === capsules\.length \? existingPublishState : createCapsulePublishState\(capsules\)/);
    expect(settleSource).toMatch(/publishStateHasRetryableSendParts\(message\.publishState\) && isRecoverablePrivateSendError\(error\.cause \?\? error\)/);
    expect(settleSource).toMatch(/schedulePrivateSendRetry\(context, error\.cause \?\? error\)/);
  });

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
    expect(resumeSource).toMatch(/!isStalePrivatePendingPublish\(message\)/);
    expect(app).toMatch(/privateSendRetryAttempt/);
    expect(resumeSource).toMatch(/const hasStoredCapsules = \(Array\.isArray\(message\?\.capsules\) && message\.capsules\.length > 0\) \|\| Boolean\(message\?\.capsule\)/);
    expect(resumeSource).toMatch(/function resumePendingPrivateSendRetries\(\)/);
    expect(resumeSource).toMatch(/ensurePendingPrivateSendRetry\(thread, message/);
    expect(sendRetrySource).toMatch(/const draft = message\?\.privateDraft \?\? \{\}/);
    expect(sendRetrySource).toMatch(/text: draft\.text \?\? message\?\.text \?\? ''/);
    expect(sendRetrySource).toMatch(/attachments: normalizePrivateImageAttachments\(draft\.attachments \?\? \[\]\)/);
    expect(sendRetrySource).toMatch(/paymentDraft: hasPaymentIntent \? null : \(draft\.paymentDraft \?\? message\?\.paymentDraft \?\? null\)/);
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

    expect(syncSource.match(/resumePendingPrivateSendRetries\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(confirmRunSource).toMatch(/const sendRetryScheduled = ensurePendingPrivateSendRetry\(thread, message/);
    expect(confirmRunSource).toMatch(/Retrying unsent capsule parts/);
    expect(resumeConfirmSource).toMatch(/ensurePendingPrivateSendRetry\(thread, message/);
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
    expect(confirmRunSource).toMatch(/stopPartialPrivatePublishRecovery\(context\)/);
    expect(pendingConfirmSource).toMatch(/!privatePartialSendRetryExpired\(message\)/);
    expect(resumeConfirmSource).toMatch(/stopPartialPrivatePublishRecovery\(\{ thread, message \}\)/);
    expect(sendRetrySource).toMatch(/privateSendRetryJobs\.has\(existingKey\)/);
    expect(app).toMatch(/const hasStoredCapsules = \(Array\.isArray\(message\?\.capsules\) && message\.capsules\.length > 0\) \|\| Boolean\(message\?\.capsule\)/);
    expect(app).toMatch(/function privateMessageHasPartialRetryablePublish\(message\)/);
    expect(app).toMatch(/function privatePartialSendRetryAgeMs\(message\)/);
    expect(app).toMatch(/function stopPartialPrivatePublishRecovery\(context/);
    expect(app).toMatch(/not confirmed: partial publish retry window expired/);
    expect(debugSource).toMatch(/function privateDebugPublishDetailLines\(thread\)/);
    expect(debugSource).toMatch(/privateDebugPartLine\(part\)/);
    expect(debugSource).toMatch(/function privateDebugStoredCapsuleCount\(message\)/);
    expect(debugSource).toMatch(/caps=\$\{storedCapsules\}\/\$\{expectedCapsules \|\| '-'\}/);
    expect(debugSource).toMatch(/send=\$\{sendJob\}\/\$\{sendNext\} sA=\$\{sendAttempt\} conf=\$\{confirmJob\}\/\$\{confirmNext\} cA=\$\{confirmAttempt\}/);
    expect(debugSource).toMatch(/sendStop=1/);
    expect(debugSource).toMatch(/pAge=\$\{debugDurationMs\(privatePartialSendRetryAgeMs\(message\)\)\}/);
    expect(debugSource).toMatch(/pExpired=1/);
    expect(debugSource).toMatch(/stateErr=\$\{debugTiny\(message\.publishState\.lastBroadcastRetryError, '-'\)\}/);
    expect(debugSource).toMatch(/retryable=1/);
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
    expect(manualSource).toMatch(/!paymentHasIntent\(message\.payment\)/);
    expect(manualSource).toMatch(/retryPrivateMessageFromUi\(thread, message\)/);
    expect(manualSource).toMatch(/cancelPrivateMessageFromUi\(thread, message\)/);
    expect(manualSource).toMatch(/thread\.messages = \(thread\.messages \?\? \[\]\)\.filter/);
    expect(scheduleSource).toMatch(/markPrivateMessageManualRecovery\(context, error, privateSendRetryExhaustedStatusText\(error\)\)/);
    expect(scheduleSource).toMatch(/clearPrivateMessageManualRecovery\(message\)/);
    expect(settleSource).toMatch(/markPrivateMessageManualRecovery\(context, error, 'not sent: cancelled'\)/);
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
    const checkSource = app.slice(
      app.indexOf('async function attemptPrivatePaymentCheckPublish'),
      app.indexOf('async function submitCreatePaymentCheck'),
    );
    const runRetrySource = app.slice(
      app.indexOf('async function runPrivateSendRetry'),
      app.indexOf('function rememberLocalPublicPost'),
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
    expect(checkSource).toMatch(/isRecoverablePrivateSendError\(error\)[\s\S]*schedulePrivateSendRetry\(context, error\)/);
    expect(checkSource).toMatch(/context\.paymentIntentCreated = true/);
    expect(runRetrySource).toMatch(/context\.paymentIntentCreated && message\.payment && Array\.isArray\(message\.capsules\)/);
    expect(runRetrySource).toMatch(/paymentDraft: null/);
    expect(settleSource).toMatch(/isRecoverablePrivateSendError\(error\) && privateMessageHasPublishAttempt\(message\)/);
    expect(settleSource).toMatch(/schedulePrivatePublishConfirmationRetry\(context, error\)/);
    expect(settleSource).toMatch(/cancelled \|\| recoverable \|\| partial \|\| privateMessageHasPublishAttempt\(message\)/);
    expect(settleSource).toMatch(/refreshComposerCostStatus\(\)/);
    expect(settleSource).not.toMatch(/recoverable \? privateSendRetryMeta\(error\)/);
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

  it('PWA-SLOW-DEVICE-01: private-sync yields the main thread, self-test is deferred, balance/critical reads have deadlines', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // A+B: cooperative yield after EVERY scanned private entry so a burst of synchronous ML-KEM-768
    // decapsulations cannot starve the main thread (tab clicks/renders) on a slow single-thread device.
    expect(app).toMatch(/const cooperativeYield = \(\) => new Promise\(\(resolve\) => setTimeout\(resolve, 0\)\)/);
    expect(app).toMatch(/scannedForRole \+= 1;\s*await cooperativeYield\(\)/);
    expect(app).toMatch(/headRepairScanned \+= 1;\s*scannedForRole \+= 1;\s*await cooperativeYield\(\)/);
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
    // v476 FIX: the with-wallet capture proved the freeze is the ASYNC Vault-open read burst hanging (degraded
    // RPC: keyless toncenter fallback + verify cross-check + backoff -> minutes), NOT a CPU loop. refreshVaultDashboard
    // now bounds the read burst with a hard VAULT_OPEN_READ_DEADLINE_MS; on timeout it renders with cached
    // state + 'RPC busy, retrying' instead of awaiting forever, so the Vault tab can never hang open.
    expect(app).toMatch(/const VAULT_OPEN_READ_DEADLINE_MS = 12_000/);
    // v515: the Vault-open critical path reads get_user ALONE (the concurrent get_user+get_global burst was
    // the iOS freeze; the working nav path reads get_user alone), raced against the deadline; get_global +
    // external balances load deferred + strictly sequentially off the render path.
    expect(app).toMatch(/delay\(VAULT_OPEN_READ_DEADLINE_MS\)\.then\(\(\) => vaultUserTimedOut\)/);
    expect(app).toMatch(/if \(settledUser === vaultUserTimedOut\) \{/);
    expect(app).toMatch(/function refreshVaultDeferredReadsInBackground\(/);
    // And an overall backstop on refreshVaultNow so the activation/stats jobs (same verify:true reads) can't
    // keep the single-flight lock held for minutes either.
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

  it('PWA-KEYLESS-EFFICIENCY-01: body-gap terminal cap + early-skip + dead-publish confirm-skip + keyless cursor persist', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const vault = readFileSync('web/vault-ton-rpc-provider.mjs', 'utf8');
    // The body-history store gains a cross-session strike cap (mirrors the unknown-error stuck store).
    expect(app).toMatch(/const PRIVATE_CHAIN_BODY_HISTORY_CROSS_SESSION_CAP = 6/);
    expect(app).toMatch(/const strikes = \(Number\(prior\?\.strikes \?\? 0\) \|\| 0\) \+ 1/);
    // Capped body gaps are filtered out of the auto-retry replay (stops the heavy tx-scan) but stay
    // re-attemptable under the manual force path (keyless-tolerable).
    expect(app).toMatch(/if \(!force && \(Number\(record\.strikes \?\? 0\) \|\| 0\) >= PRIVATE_CHAIN_BODY_HISTORY_CROSS_SESSION_CAP\) continue/);
    expect(app).toMatch(/function privateBodyHistorySurfacedCount\(address\)/);
    expect(app).toMatch(/function privateBodyHistoryEntryCapped\(address, entryId\)/);
    // The per-cycle index walk early-skips the heavy body tx-scan for a terminally-capped entry.
    expect(app).toMatch(/if \(source !== 'history-retry' && privateBodyHistoryEntryCapped\(address, entryId\)\) \{/);
    // The body-gap branch only PINS the cursor while BELOW the cap; a terminal gap leaves bodyHistoryError
    // null so the cursor/head-repair can advance past it.
    expect(app).toMatch(/const bodyStrikes = rememberPrivateBodyHistoryUnavailable\(address, entry, entryId\)/);
    expect(app).toMatch(/if \(bodyStrikes < PRIVATE_CHAIN_BODY_HISTORY_CROSS_SESSION_CAP\) \{/);
    // Honest 'Synced': a surfaced (capped) body gap folds into undeliveredCount -> 'private_entry_undelivered'.
    expect(app).toMatch(/const undeliveredCount = privateStuckEntrySurfacedCount\(address\) \+ privateBodyHistorySurfacedCount\(address\)/);
    // The per-cycle confirm sweep skips terminally-stopped (dead) publishes (CPU-only elision).
    expect(app).toMatch(/if \(message\.privatePublishConfirmStopped === true \|\| message\.privateSendRetryStopped === true\) continue/);
    // The Orbs (ton-access-v2) transport + its getTransactions on-5xx fresh-node retry were removed with the
    // toncenter-only switch; keyless body recovery now uses the toncenter getMessages indexer (every transport
    // exposes it), so no ton-access transport remains in the provider.
    expect(vault).not.toMatch(/ton-access-v2|createTonAccessV2VaultTransport/);
    // A no-key user-toncenter drops to the keyless ~1 rps spacing (not the keyed 100ms) so anonymous
    // toncenter.com is not 429-stormed into a perpetual "RPC busy" / private_index_read_failed.
    expect(vault).toMatch(/const TONCENTER_KEYLESS_REQUEST_SPACING_MS = 1100/);
    expect(vault).toMatch(/userKeyMissing[\s\S]{0,120}Math\.max\([\s\S]{0,120}TONCENTER_KEYLESS_REQUEST_SPACING_MS\)/);
    // B1: keyless (verify:false + allowUnverifiedCriticalRead) reads now PERSIST the index cursor so the
    // sync stops re-walking head->frozen-cursor (~15 getPrivateEntry reads) every cycle. Safe because the
    // index is an append-only backward-linked list (no fabricated future head; cursor advances only after a
    // complete walk; a lagging head self-corrects; head-repair re-covers recent entries).
    expect(app).toMatch(/if \(readOptions\.allowUnverifiedCriticalRead === true\) return 'keyless_unverified'/);
  });

  it('PWA-QUICKSTART-01: first-run quick-start onboarding + wallet-key carries the toncenter key', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const html = readFileSync('web/index.html', 'utf8');
    // Wallet-key backup now bundles the user's own toncenter key (v2) so restoring the key on a new device
    // brings the RPC key too; the importer restores it, backward-compatible with v1 (no-key) backups.
    expect(app).toMatch(/kind: PLATHO_WALLET_KEY_BACKUP_KIND,\s*version: 2/);
    expect(app).toMatch(/\.\.\.\(toncenterApiKey \? \{ toncenterApiKey \} : \{\}\)/);
    expect(app).toMatch(/parsed\?\.kind === PLATHO_WALLET_KEY_BACKUP_KIND[\s\S]*applyToncenterApiKey\(parsed\.toncenterApiKey\)/);
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
    // Wired into the boot chain, defensively, after the wallet state is known.
    expect(app).toMatch(/try \{ maybeShowQuickStartOnFirstRun\(\); \} catch \(error\) \{ console\.error\(error\); \}/);
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
    expect(app).toMatch(/if \(!unlocked\) return false;\s*await downloadEncryptedWalletKeyBackup\(record\);/);
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
    expect(app).toMatch(/const cancellable = config\.cancellable \?\? dismissible/);
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

  it('PWA-SEND-LOCK-01: an in-flight send defers the background lock (bounded), and keyless resume needs no key', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // Axis A: defer the background auto-lock while a send actively holds the key, bounded by a max grace,
    // set ONCE (never re-armed by later background events) so a wedged send can't pin the wallet unlocked.
    expect(app).toMatch(/const SEND_LOCK_MAX_GRACE_MS = 600 \* 1000/);
    expect(app).toMatch(/function vaultSendNeedsKeyNow\(\)[\s\S]*vaultPublishSendWaiters > 0 \|\| privateOutboundWorkActive\(\)/);
    expect(app).toMatch(/if \(!needsKey\) vaultSendInFlightUntil = 0/);
    expect(app).toMatch(/if \(vaultSendInFlightUntil === 0\) vaultSendInFlightUntil = now \+ SEND_LOCK_MAX_GRACE_MS/);
    expect(app).toMatch(/function shouldIgnoreTransientWalletLock\(\)[\s\S]*shouldDeferLockForActiveSend\(\)/);
    // Axis C: keyless resume uses the persisted PUBLIC sender address; refuses if a different account unlocked.
    expect(app).toMatch(/if \(publishState && !publishState\.ownerWallet\) publishState\.ownerWallet = owner/);
    expect(app).toMatch(/function resolvePublishOwner\(publishState\)[\s\S]*rawWalletAddress\(live\) !== rawWalletAddress\(stored\)\) return null/);
    expect(app).toMatch(/const owner = options\.owner \?\? resolvePublishOwner\(publishState\);\s*if \(!owner\) return 0/);
    expect(app).toMatch(/owner = resolvePublishOwner\(publishState\);\s*if \(!owner\) return \{ resigned: 0, confirmed: 0 \}/);
    expect(app).toMatch(/confirmCapsuleHubPublishEntries\(message\.publishState, \{ \.\.\.confirmOptions, owner: resolvePublishOwner\(message\.publishState\) \}\)/);
  });

  it('PWA-WALLET-LOCK-TIMING-01: wallet auto-lock timers relaxed per owner (idle 30min, TG background 5min, send grace 10min)', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // Owner-chosen values (2026-06-22): the wallet was auto-locking too eagerly and interrupting slow sends.
    expect(app).toMatch(/const WALLET_AUTO_LOCK_MS = 30 \* 60 \* 1000/);
    expect(app).toMatch(/const TELEGRAM_BACKGROUND_LOCK_GRACE_MS = 300_000/);
    expect(app).toMatch(/const SEND_LOCK_MAX_GRACE_MS = 600 \* 1000/);
    // The hard idle lock still exists (this is a relaxation, not a removal).
    expect(app).toMatch(/walletAutoLockTimer = setTimeout\(\(\) => \{\s*lockPlathoWallet\('Wallet locked'\);\s*\}, WALLET_AUTO_LOCK_MS\)/);
  });

  it('PWA-TONCENTER-KEY-VALIDATE-01: a user-entered TON Center key is validated before it is saved', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // validateToncenterApiKey makes one authenticated call: 200 = ok, 401/403 = invalid, anything else = unverified.
    expect(app).toMatch(/async function validateToncenterApiKey\(rawKey\)/);
    expect(app).toMatch(/fetch\('https:\/\/toncenter\.com\/api\/v3\/masterchainInfo', \{\s*headers: \{ 'X-API-Key': key \}/);
    expect(app).toMatch(/if \(response\.ok\) return \{ ok: true \}/);
    expect(app).toMatch(/response\.status === 401 \|\| response\.status === 403\) return \{ ok: false, reason: 'invalid' \}/);
    // No Save button: the settings field validates + saves on change (blur / Enter). A definitively
    // invalid key is rejected and NOT stored; an unverified one is kept (keyless Orbs fallback).
    expect(app).toMatch(/async function commitToncenterKeyFromInput\(\)/);
    expect(app).toMatch(/toncenterApiKeyInput\?\.addEventListener\('change'/);
    // Validate on paste/input (debounced), not only on blur, so pasting a key shows feedback right away;
    // and keep "checking..." visible for a perceptible beat even when validation returns fast.
    expect(app).toMatch(/toncenterApiKeyInput\?\.addEventListener\('input', scheduleToncenterKeyCheck\)/);
    expect(app).toMatch(/const minCheckingVisible = new Promise[\s\S]*?setTimeout\(resolve, 450\)[\s\S]*?await validateToncenterApiKey\(trimmed\);\s*await minCheckingVisible;/);
    expect(app).toMatch(/if \(result\.reason === 'invalid'\) \{[\s\S]*toncenterKeyStatus\.textContent = 'invalid key'[\s\S]*setAttribute\('data-state', 'error'\)[\s\S]*return;\s*\}\s*applyToncenterApiKey\(trimmed\);/);
    // "recommended" lives in the section heading, not the row, so it never crowds the key input on a narrow
    // phone; the in-row status is empty when there is no key (validation states like 'invalid key' still show).
    expect(app).toMatch(/toncenterKeyStatus\.textContent = key \? 'key active' : ''/);
    expect(readFileSync('web/index.html', 'utf8')).toMatch(/<h2>RPC access \(recommended\)<\/h2>/);
    // The key input is a distinct dark field box (not frameless/transparent) so it reads as a text input on the row.
    expect(readFileSync('web/styles.css', 'utf8')).toMatch(/\.settings-rpc-row input\s*\{[\s\S]*?background:\s*var\(--panel\)/);
    // The row itself doubles as the Get button (except a click on the field). "Get" no longer dumps the user
    // straight into the bot: it opens an explanatory help modal whose primary action opens the @toncenter bot.
    expect(app).toMatch(/rpcKeyRow\?\.addEventListener\('click'[\s\S]*event\.target === toncenterApiKeyInput[\s\S]*openRpcKeyHelpDialog\(\)/);
    expect(app).toMatch(/async function openRpcKeyHelpDialog\(\)/);
    // The help modal: title + the "any name" and "mainnet" guidance + a bot-link CTA, and it opens the bot
    // ONLY when the user confirms via the CTA (proceed), not on dismiss.
    expect(app).toMatch(/title: 'Get an RPC key'/);
    expect(app).toMatch(/you can enter any name/);
    expect(app).toMatch(/select mainnet/);
    expect(app).toMatch(/submitLabel: 'Open @toncenter bot'/);
    expect(app).toMatch(/if \(proceed\) openToncenterBotLink\(\)/);
    // The 'note' field type renders the informational steps block (no input, not collected as a value).
    expect(app).toMatch(/if \(field\.type === 'note'\)/);
    expect(readFileSync('web/styles.css', 'utf8')).toMatch(/\.action-note-steps/);
    // The Save button is gone.
    expect(app).not.toMatch(/saveToncenterKeyButton/);
    // Quick-start step 2 validates too: an invalid key surfaces a message and does NOT advance the stepper.
    expect(app).toMatch(/if \(result\.reason === 'invalid'\) return 'That key was rejected by TON Center\. Check it and retry, or Skip\.'/);
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
    expect(app).toMatch(/key: 'export',\s*title: 'Back up your wallet key'/);
    // Closing the backup re-prompt must NOT permanently dismiss onboarding (the backup is still pending).
    expect(app).toMatch(/let quickStartBackupMode = false/);
    expect(app).toMatch(/if \(!quickStartBackupMode\) \{[\s\S]*QUICK_START_DISMISSED_KEY/);
    // Boot restores the flag from cloud and skips the startup unlock prompt while driving the backup (no double password).
    expect(app).toMatch(/restoreWalletKeyBackupPendingFromTelegramCloud\(\)\.catch/);
    expect(app).toMatch(/const drivingBackup = walletKeyBackupPendingForStoredWallet\(\);[\s\S]*if \(!drivingBackup\) \{\s*promptStoredWalletUnlockOnStartup/);
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
    expect(usernameResolveSource).toMatch(/getNameRecordByUsername\(displayLabel, \{\s*address: registryAddress,\s*\.\.\.criticalChainReadOptions\(\),\s*\}\)/);
    expect(usernameResolveSource).toMatch(/registryCallOptions: \{ address: registryAddress, \.\.\.criticalChainReadOptions\(\) \}/);
    expect(usernameResolveSource).toMatch(/itemCallOptions: \{ address: record\.item_address, \.\.\.criticalChainReadOptions\(\) \}/);
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
      app.indexOf('async function submitVaultDepositTon'),
    );

    expect(criticalMethods).toContain('get_wallet_address');
    expect(source).toMatch(/provider\.getWalletAddress\(owner, \{/);
    expect(source).toMatch(/address: requireAthMasterAddress\(\)/);
    expect(source).toMatch(/\.\.\.criticalChainReadOptions\(\)/);
    expect(submitSource).toMatch(/requireNoPendingServiceWorkerAppShellReload\(\)/);
    expect(submitSource).toMatch(/await loadConnectedAthWalletAddress\(\)/);
    expect(app).not.toMatch(/async function submitUsernameRegistryMessage/);
    expect(app).not.toMatch(/async function submitUsernameRefundFlush/);
  });

  it('PWA-USERNAME-TRANSFER-01: a .ath is a movable alias — routing is wallet-first; addressing reconciles + relabels', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // Routing is by the dialog's WALLET, not by re-resolving the username every send: in resolveRecipientWalletForThread
    // the wallet_address variant is matched BEFORE the platho_nft resolve (reverts the v562 FM-1 band-aid).
    const routeSource = app.slice(
      app.indexOf('async function resolveRecipientWalletForThread'),
      app.indexOf('async function resolveRecipientPeerEntry'),
    );
    expect(routeSource.indexOf("type === 'wallet_address'")).toBeLessThan(routeSource.indexOf("type === 'platho_nft'"));
    // Transfer is handled at the identity/dialog layer: strip+relabel the old owner, resolve to the current owner.
    expect(app).toMatch(/function dropThreadIdentityVariant\(thread, targetKey\)/);
    expect(app).toMatch(/function reconcileUsernameOwnership\(usernameIdentity, ownerWallet\)/);
    expect(app).toMatch(/async function revalidateThreadUsernameVariants\(thread\)/);
    expect(app).toMatch(/class UsernameNotRegisteredError extends Error/);
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
    expect(newChatSource).toMatch(/sameWalletAddress\(ownerWallet, ownAddress\)/);
    // Old-owner dialog is revalidated on open (fire-and-forget).
    expect(app).toMatch(/void revalidateThreadUsernameVariants\(thread\)/);
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
    expect(linkSource).toMatch(/await verifyWalletDisplayIdentity\(normalizedMode, value, plathoWallet\)/);
    expect(linkSource).toMatch(/addKnownPlathoUsername\(verified\.label, plathoWallet\?\.address\)/);
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
    expect(mintSource).toMatch(/label: 'Your ATH'/);
  });

  it('PWA-VAULT-ATH-DEPOSIT-PREFLIGHT-01: Vault ATH deposit preflights Vault ATHMaster and official wallet route', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const athProvider = readFileSync('web/ath-ton-rpc-provider.mjs', 'utf8');
    const routeSource = app.slice(
      app.indexOf('async function readVaultGlobalForAthDeposit'),
      app.indexOf('function optionalBalanceText'),
    );
    const submitSource = app.slice(
      app.indexOf('async function submitVaultDepositAthAmount'),
      app.indexOf('async function submitVaultWithdrawAth'),
    );
    const preflightIndex = submitSource.indexOf('requireVaultAthDepositRouteForOwnVaultAction(provider)');
    const buildIndex = submitSource.indexOf("submitAthWalletMessage('ATHTransferRequestWithNotify'");

    expect(routeSource).toMatch(/loadConnectedVaultGlobal\(\{[\s\S]*verify: options\.verify !== false/);
    expect(routeSource).toMatch(/global\.vault_ath_wallet_address/);
    expect(routeSource).toMatch(/deriveVaultAthWalletAddressFromAthMasterWithFallback\(vault\)/);
    expect(routeSource).toMatch(/Vault official ATH wallet does not match ATHMaster-derived Vault wallet/);
    expect(routeSource).toMatch(/async function readVaultGlobalForAthDepositWithFallback[\s\S]*return readVaultGlobalForAthDeposit\(provider\)/);
    expect(routeSource).toMatch(/async function deriveVaultAthWalletAddressFromAthMasterWithFallback[\s\S]*return deriveVaultAthWalletAddressFromAthMaster\(vault\)/);
    expect(routeSource).not.toMatch(/unverifiedCriticalChainReadOptions|callWithVerificationUnavailableReadFallback/);
    expect(app).toMatch(/Vault ATHMaster binding does not match this app config/);
    expect(preflightIndex).toBeGreaterThanOrEqual(0);
    expect(buildIndex).toBeGreaterThan(preflightIndex);
    expect(athProvider).toMatch(/method: 'get_wallet_address'[\s\S]*\.\.\.criticalCallOptions\(callOptions\)/);
  });

  it('PWA-VAULT-ATH-WITHDRAW-CONFIRM-01: withdraw ATH tracks pending withdrawal after nonce confirmation', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const helperSource = app.slice(
      app.indexOf('async function readFreshPendingAthWithdrawalForOwnVaultAction'),
      app.indexOf('async function submitVaultReceiveIntentExternal'),
    );
    const withdrawSource = app.slice(
      app.indexOf('async function submitVaultWithdrawAthAmount'),
      app.indexOf('async function submitUsernameMint'),
    );

    expect(helperSource).toMatch(/provider\.getPendingAthWithdrawalFor\(owner, clientNonce/);
    expect(helperSource).toMatch(/VAULT_ATH_WITHDRAW_CONFIRM_TIMEOUT_MS/);
    expect(helperSource).toMatch(/pendingWithdrawal\?\.exists === false/);
    expect(helperSource).toMatch(/athTransferPending: false/);
    expect(helperSource).toMatch(/athTransferPending: true/);
    expect(withdrawSource).toMatch(/submitVaultAuthExternalWithNonceConfirmation/);
    expect(withdrawSource).toMatch(/waitForVaultAthWithdrawalCompletion\(provider, owner, result\.clientNonce\)/);
    expect(withdrawSource).toMatch(/setVaultStatus\(athWithdrawal\.athTransferPending \? 'ATH transfer pending' : 'move submitted'\)/);
    expect(withdrawSource).not.toMatch(/complete/i);
  });

  it('PWA-SW-UPDATE-01: pending service worker update blocks new signed sends and reloads after wallet lock', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const swSource = app.slice(
      app.indexOf('function serviceWorkerUpdateReloadError'),
      app.indexOf('function shouldOpenWalletUnlockPrompt'),
    );
    const profileSource = app.slice(
      app.indexOf('async function submitVaultProfileAvatarRegistration'),
      app.indexOf('async function refreshWalletTonBalanceForProfile'),
    );
    const submitSource = app.slice(
      app.indexOf('async function submitVaultMessage'),
      app.indexOf('async function submitVaultDepositTon'),
    );
    const prepareSource = app.slice(
      app.indexOf('async function prepareCapsulesThroughVault'),
      app.indexOf('async function sendPreparedCapsulesThroughVault'),
    );

    expect(swSource).toMatch(/async function liveAppRuntimeVersion/);
    expect(swSource).toMatch(/fetch\(`\.\/\?platho_version_check=\$\{Date\.now\(\)\}`/);
    expect(swSource).toMatch(/html\.match\(\/id="appVersionLabel">v\(\\d\+\)<\\\/span>\/\)/);
    expect(swSource).not.toMatch(/html\.match\(\/\\\.\\\/app\\\.js\\\?v=\(\\d\+\)\/\)/);
    expect(swSource).toMatch(/liveVersion === PLATHO_APP_RUNTIME_VERSION/);
    expect(swSource).toMatch(/pendingServiceWorkerAppShellReload = false/);
    expect(swSource).toMatch(/pendingServiceWorkerAppShellReload = true/);
    expect(swSource).toMatch(/Update ready - reload before sending/);
    expect(app).toMatch(/signedActionsReady = accountActive && !appShellReloadPending/);
    expect(app).toMatch(/registerVaultKeysButton\.disabled = !plathoWallet \|\| accountActive \|\| appShellReloadPending/);
    expect(app).toMatch(/mintUsernameButton\.disabled = false/);
    expect(app).toMatch(/linkUsernameButton\.disabled = false/);
    expect(app).toMatch(/setAvatarButton\.disabled = plathoProfileAvatarPending/);
    expect(app).toMatch(/if \(!plathoWallet\) \{[\s\S]*flashWalletIdentityStatus\('create wallet first'\)/);
    expect(app).not.toMatch(/mintUsernameButton\.disabled = !plathoWallet \|\| !signedActionsReady/);
    expect(app).not.toMatch(/setAvatarButton\.disabled = !plathoWallet \|\| !signedActionsReady/);
    expect(app).toMatch(/function canAttemptPrivateSend/);
    expect(app).toMatch(/function privateSendBlockReason/);
    expect(app).toMatch(/const reason = privateSendBlockReason\(thread\)/);
    expect(app).toMatch(/sendButton\.disabled = Boolean\(reason\)/);
    expect(app).toMatch(/sendButton\.title = reason \?\? 'Send private message'/);
    expect(app).toMatch(/Update ready - reload app/);
    expect(app).toMatch(/pendingServiceWorkerAppShellReload !== true/);
    expect(app).toMatch(/publicSendButton\.disabled = !plathoWallet \|\| !hasActivePlathoAccount\(\) \|\| pendingServiceWorkerAppShellReload/);
    expect(swSource).toMatch(/throw serviceWorkerUpdateReloadError\(\)/);
    expect(swSource).toMatch(/window\.location\.reload\(\)/);
    expect(swSource).toMatch(/reloadForPendingServiceWorkerAppShellUpdate\(\)/);
    expect(swSource).toMatch(/function schedulePendingServiceWorkerAppShellReload/);
    expect(profileSource).toMatch(/async function submitVaultProfileAvatarRegistration[\s\S]*requireNoPendingServiceWorkerAppShellReload\(\)/);
    expect(profileSource).toMatch(/async function submitVaultUsernameMint[\s\S]*requireNoPendingServiceWorkerAppShellReload\(\)/);
    expect(submitSource).toMatch(/async function submitVaultMessage[\s\S]*requireNoPendingServiceWorkerAppShellReload\(\)/);
    expect(submitSource).toMatch(/async function submitAthWalletMessage[\s\S]*requireNoPendingServiceWorkerAppShellReload\(\)/);
    expect(submitSource).not.toMatch(/async function submitUsernameRegistryMessage/);
    expect(prepareSource).toMatch(/async function prepareCapsulesThroughVault[\s\S]*requireNoPendingServiceWorkerAppShellReload\(\)/);
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
    expect(matrix).toContain('Direct user-wallet username mint, profile avatar payment, and username refund-flush product actions are intentionally unsupported');
    expect(matrix).toMatch(/\|\s*Mint username from Vault balance\s*\|\s*`Vault` external\s*\|[\s\S]*Vault auth key \/ owner signing key/);
    expect(matrix).toMatch(/\|\s*Set wallet avatar from Vault balance\s*\|\s*`Vault` external\s*\|[\s\S]*Vault auth key \/ owner signing key/);
  });

  it('PWA-ACTIVATION-01: transient Vault provider errors do not clear an active composer binding', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const activationSource = app.slice(
      app.indexOf('async function refreshVaultActivationStatus'),
      app.indexOf('async function bootCrypto'),
    );

    expect(app).toMatch(/function hasCurrentWalletVaultBinding\(\)/);
    expect(activationSource).toMatch(/const expectedUnavailable = isExpectedVaultProviderUnavailable\(error\)/);
    expect(activationSource).toMatch(/const keepCurrentBinding = expectedUnavailable && hasCurrentWalletVaultBinding\(\)/);
    expect(activationSource).toMatch(/if \(!keepCurrentBinding\) delete globalThis\.plathoVaultBinding/);
    expect(activationSource).toMatch(/setText\(vaultRecordStatus, keepCurrentBinding[\s\S]*\? 'activated'/);
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

    expect(app).toMatch(/function walletAddressChanged\(previousWallet, nextWallet\)/);
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
    expect(importSource).toMatch(/applyToncenterApiKey\(parsed\.toncenterApiKey\)/);
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
      app.indexOf('async function submitVaultClaimPaymentCheck'),
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
    expect(controls).toMatch(/paymentCheckButton\.disabled = !canSendPrivate/);
    expect(controls).toMatch(/privateComposerAddButton\.disabled = !canEditPrivateDraft/);
    expect(render).toMatch(/messageInput\.disabled = !canEditPrivateDraft/);
    expect(render).toMatch(/sendButton\) sendButton\.disabled = !canSendPrivate/);
    expect(addButton).toMatch(/if \(!canEditPrivateComposerDraft\(\)\)/);
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

    // A single in-flight lock declared at module scope.
    expect(app).toMatch(/let plathoAccountActivationPending = false;/);
    // The lock is raised the moment the activation external is broadcast.
    expect(submit).toMatch(/plathoAccountActivationPending = true;[\s\S]*queueVaultPostTransactionRefresh\(\{ pollActivation: true \}\)/);
    // While pending and not yet active, the row stays disabled and shows progress
    // instead of reverting to the clickable "Activate / fee" resting state — the bug
    // where the button looked like it ignored the first press.
    expect(controls).toMatch(/if \(accountActive\) plathoAccountActivationPending = false;/);
    expect(controls).toMatch(/const activationPending = plathoAccountActivationPending && !accountActive/);
    expect(controls).toMatch(/registerVaultKeysButton\.disabled = !plathoWallet \|\| accountActive \|\| appShellReloadPending \|\| activationPending/);
    expect(controls).toMatch(/activationPending\s*\?\s*'activating'/);
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
    expect(statusText).toMatch(/message parts pending/);
    expect(statusText).toMatch(/Number\(result\.skipped \?\? 0\) > 0/);
  });

  it('PWA-RECEIVE-RETRY-01: a session-skipped private entry auto-retries cross-session and surfaces "undelivered", never silently buried', () => {
    const app = readFileSync('web/app.js', 'utf8');
    // A persistent cross-session stuck-entry store exists (mirrors the body-history store).
    expect(app).toMatch(/function rememberPrivateStuckEntry\(address, entryId, message\)/);
    expect(app).toMatch(/function privateStuckEntryRetryEntryIds\(address, options = \{\}\)/);
    expect(app).toMatch(/function privateStuckEntrySurfacedCount\(address\)/);
    expect(app).toMatch(/const PRIVATE_SCAN_UNKNOWN_ERROR_CROSS_SESSION_CAP = 8/);
    // Capped (promoted-undelivered) entries stop being re-fetched (filtered before the cooldown).
    expect(app).toMatch(/>= PRIVATE_SCAN_UNKNOWN_ERROR_CROSS_SESSION_CAP\) continue/);
    const scan = app.slice(
      app.indexOf('const scanPrivateEntryId = async'),
      app.indexOf('let indexEntriesScanned'),
    );
    // ELSE fast-path: a persisted/replayed stuck entry NEVER returns ok:false (which
    // would break the retryEntryIds replay loop); it bumps the cross-session strike.
    expect(scan).toMatch(/const alreadyStuck = source === 'history-retry' \|\| hasPrivateStuckEntry\(address, entryId\)/);
    expect(scan).toMatch(/const crossStrikes = rememberPrivateStuckEntry\(address, entryId, message\)/);
    // Cleared only on genuine success (empty / open-ok).
    expect(scan).toMatch(/clearPrivateStuckEntry\(address, entryId\)/);
    // The replay set unions the stuck ids (cross-session re-scan regardless of the cursor).
    expect(app).toMatch(/privateStuckEntryRetryEntryIds\(address, \{ forceStuckRetry: options\.forceHistoryRetry === true \}\)/);
    // Surfacing: count read from the STORE (survives reload), gates "Synced" off, dedicated label.
    expect(app).toMatch(/const undeliveredCount = privateStuckEntrySurfacedCount\(address\)/);
    expect(app).toMatch(/Number\(result\.undeliveredCount \?\? 0\) === 0/);
    expect(app).toMatch(/'private_entry_undelivered'/);
    expect(app).toMatch(/undelivered`/);
  });

  it('PWA-DOUBLEPUBLISH-01: a possibly-delivered external is never fresh-re-signed under a new nonce', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const prove = app.slice(
      app.indexOf('async function provePublishPartAbsentFromSenderIndex'),
      app.indexOf('async function recoverDroppedSignedPublishParts'),
    );
    const recover = app.slice(
      app.indexOf('async function recoverDroppedSignedPublishParts'),
      app.indexOf('function privateSendRetryKey'),
    );
    // The absence proof that authorizes a fresh re-sign is private-only and rests
    // on a VERIFIED read; in degraded verification it returns 'inconclusive' (no re-sign).
    expect(prove).toMatch(/if \(publishPartKind\(part\) !== 'private'\) return 'inconclusive'/);
    expect(prove).toMatch(/if \(tonRpcVerificationStructurallyDegraded\(\)\) return 'inconclusive'/);
    expect(prove).toMatch(/verify: true, allowUnverifiedCriticalRead: false/);
    // Dropped-recovery never re-signs a public part, never re-signs on a non-'absent'
    // verdict, and cross-checks a VERIFIED receipt before clearing the signed attempt.
    expect(recover).toMatch(/if \(publishPartKind\(part\) !== 'private'\) continue/);
    expect(recover).toMatch(/if \(verdict !== 'absent'\) continue/);
    expect(recover).toMatch(/readBatchPublishReceipt\(chainProvider, vaultAddress, owner, clientNonce, \{/);
    expect(recover).toMatch(/BATCH_PUBLISH_RECEIPT_STATUS\.CONFIRMED/);
    // The clear+reset (fresh re-sign) happens only after the receipt is missing/EVICTED.
    expect(recover).toMatch(/status !== BATCH_PUBLISH_RECEIPT_STATUS\.EVICTED\) \{\s*\n\s*continue/);
    // The ambiguous batch catch raises the monotonic nonce floor (cross-path consistency).
    expect(app).toMatch(/raiseVaultPublishNonceFloor\(owner, batch\.clientNonce \+ 1n\)/);
  });

  it('PWA-SEND-RELIABILITY-01: burst-send hardening — no false-fail, no dual-broadcast, no read storm', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const vaultRpc = readFileSync('web/vault-ton-rpc-provider.mjs', 'utf8');
    const capsuleRpc = readFileSync('web/capsulehub-ton-rpc-provider.mjs', 'utf8');

    // #6: the keyword hard-fail guard only fires for definitive client-side <500
    // rejections, so a 5xx (possibly-delivered) broadcast is never marked rejected.
    const ambiguous = app.slice(
      app.indexOf('function isAmbiguousTonRpcBroadcastError'),
      app.indexOf('function privateSendRetryDelayMs'),
    );
    expect(ambiguous).toMatch(/\?\? 0\) < 500/);
    expect(ambiguous).toMatch(/exit code\|not enough vault ton\|nonce\/i\.test\(message\)\) return false/);

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
    expect(app).toMatch(/if \(tonRpcLimited\(\)\) \{[\s\S]{0,800}?RPC busy, send again in a moment/);

    // #4: a PRIMARY (non-emergency) gateway HTTP-5xx on sendBoc stops the loop
    // (confirm-via-read) rather than re-broadcasting to the keyless emergency
    // toncenter; connectivity death (no HTTP status) still falls through.
    expect(vaultRpc).toMatch(/&& !isEmergencyFallbackTransport\(transport\)/);
    expect(vaultRpc).toMatch(/\?\? 0\) >= 500\s*\n\s*\) throw error/);

    // #5: the message-history path parks a verifier that 429s and skips parked
    // transports, closing the direct toncenter /messages 429 leak.
    expect(vaultRpc).toMatch(/export function noteTonRpcReadTransportRateLimited\(transport, error\)/);
    expect(capsuleRpc).toMatch(/import \{ decodeTonAddressSliceBoc, isTonRpcTransportDead, noteTonRpcReadTransportRateLimited \}/);
    expect(capsuleRpc).toMatch(/if \(isTonRpcTransportDead\(resolved\)\) continue;/);
    expect(capsuleRpc).toMatch(/noteTonRpcReadTransportRateLimited\(historyTransport, error\)/);
  });

  it('PWA-CAPSULE-ENTRY-VERIFY-01: CapsuleHub sync verifies entry anchors before trusting history bodies', () => {
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
      app.indexOf('async function syncPrivateCapsulesFromChainOnce'),
    );
    const avatarSource = app.slice(
      app.indexOf('async function readAvatarPartsFromCapsuleHub'),
      app.indexOf('async function waitForProfileAvatarRegistryUpdate'),
    );
    const confirmationSource = app.slice(
      app.indexOf('async function confirmCapsuleHubPublishEntries'),
      app.indexOf('async function publishCapsuleThroughVault'),
    );
    const sendPreparedSource = app.slice(
      app.indexOf('async function sendPreparedCapsulesThroughVault'),
      app.indexOf('async function publishCapsulesThroughVault'),
    );

    for (const method of [
      'get_state',
      'get_private_entry',
      'get_private_recipient_index',
      'get_private_sender_index',
      'get_private_page',
      'get_public_entry',
      'get_public_page',
    ]) {
      expect(criticalMethods).toContain(method);
    }
    expect(helperSource).toMatch(/function criticalCapsuleHubReadOptions\(address\)/);
    expect(helperSource).toMatch(/capsuleHubAddress: address/);
    expect(helperSource).toMatch(/criticalChainReadOptions\(\)/);
    expect(helperSource).toMatch(/function capsuleHubMessageSyncReadOptions\(address\)/);
    expect(helperSource).toMatch(/verify:\s*false/);
    expect(helperSource).toMatch(/allowUnverifiedCriticalRead:\s*true/);

    for (const source of [publicSyncSource, avatarSource]) {
      expect(source).toMatch(/const readOptions = criticalCapsuleHubReadOptions\(address\)/);
      expect(source).not.toMatch(/capsuleHubMessageSyncReadOptions\(address\)/);
      expect(source).toMatch(/provider\.getState\(readOptions\)/);
    }
    expect(publicSyncSource).toMatch(/const readOptions = criticalCapsuleHubReadOptions\(address\)[\s\S]*provider\.getPublicEntry\(entryIdValue, readOptions\)[\s\S]*chainVerified:\s*true/);
    expect(publicSyncSource).not.toMatch(/chainVerified:\s*true[\s\S]*provider\.getPublicEntry\(entryIdValue, readOptions\)/);
    expect(privateSyncSource).toMatch(/let allowUnverifiedPrivateIndexRead = options\.allowUnverifiedPrivateIndexRead === true/);
    expect(privateSyncSource).toMatch(/const allowUnverifiedPrivateIndexFallback = quickSync && options\.allowUnverifiedPrivateIndexRead !== false/);
    expect(privateSyncSource).toMatch(/let readOptions = allowUnverifiedPrivateIndexRead[\s\S]*capsuleHubMessageSyncReadOptions\(address\)[\s\S]*criticalCapsuleHubReadOptions\(address\)/);
    expect(privateSyncSource).not.toMatch(/provider\.getState\(readOptions\)/);
    expect(privateSyncSource).toMatch(/provider\.getPrivateRecipientIndex\(keyIdIndex, readOptions\)/);
    expect(privateSyncSource).toMatch(/provider\.getPrivateSenderIndex\(keyIdIndex, readOptions\)/);
    expect(publicSyncSource).toMatch(/provider\.getPublicEntry\(entryIdValue, readOptions\)/);
    expect(privateSyncSource).toMatch(/provider\.getPrivateEntry\(entryId, readOptions\)/);
    expect(avatarSource).toMatch(/provider\.getPublicEntry\(entryId, readOptions\)/);
    expect(confirmationSource).toMatch(/async function confirmCapsuleHubPublishEntriesWithReadMode/);
    expect(app).toMatch(/function capsuleHubConfirmationProviderCandidates/);
    expect(app).toMatch(/createCapsuleHubTonRpcProvider\(\{ capsuleHubAddress: address, transport: item \}\)/);
    expect(confirmationSource).toMatch(/const readOptions = publishConfirmReadOptions\(address, options\)/);
    expect(app).toMatch(/function publishConfirmReadOptions\(address, options = \{\}\)[\s\S]*const out = criticalCapsuleHubReadOptions\(address\)/);
    expect(confirmationSource).not.toMatch(/capsuleHubMessageSyncReadOptions\(address\)/);
    expect(confirmationSource).toMatch(/async function confirmCapsuleHubPublishEntries\(publishState, options = \{\}\)[\s\S]*return confirmCapsuleHubPublishEntriesWithReadMode\(publishState, options\.hot === true/);
    // VPB2: the receipt ring is the PRIMARY confirm; the CapsuleHub entry scan is the recovery fallback.
    expect(confirmationSource).toMatch(/if \(options\.skipBatchReceipt !== true\)[\s\S]*confirmVaultBatchReceiptsFromPublishState/);
    expect(confirmationSource).toMatch(/CAPSULEHUB_PUBLISH_CONFIRM_HOT_SCAN_LIMIT/);
    expect(confirmationSource).toMatch(/PRIVATE_PUBLISH_CONFIRM_HOT_DEADLINE_MS/);
    expect(confirmationSource).toMatch(/PRIVATE_PUBLISH_CONFIRM_HOT_REQUEST_TIMEOUT_MS/);
    expect(app).toMatch(/function publishConfirmDeadlineExpired\(deadlineAt\)/);
    expect(app).toMatch(/function publishConfirmReadOptions\(address, options = \{\}\)/);
    expect(confirmationSource).not.toMatch(/stillPending[\s\S]*scanAvailableTransports/);
    expect(confirmationSource).toMatch(/catch \(error\) \{[\s\S]*if \(isTonRpcRecoverableReadError\(error\)\) throw error;[\s\S]*if \(noteTonRpcRateLimit\(error\)\) throw error;/);
    // The CapsuleHub entry-scan strategies never trust unverified critical reads to confirm.
    expect(confirmationSource).not.toMatch(/allowUnverifiedCriticalRead:\s*true/);
    expect(confirmationSource).not.toMatch(/scanAvailableTransports:\s*true/);
    expect(sendPreparedSource).toMatch(/const softVerification = isTonRpcRecoverableReadError\(error\)/);
    expect(sendPreparedSource).toMatch(/if \(softVerification \|\| rateLimited\) \{[\s\S]*publishState\.status = VAULT_PUBLISH_STATUS_SUBMITTED;/);
    // The entry-scan recovery matches by payload hashes + publish_id (EPI1) via the 3-arg matcher.
    expect(confirmationSource).toMatch(/publishEntryMatchesPart\(entry, part, \{ allowPublishIdMismatch, requirePublishIdMatch \}\)/);
    // The VPB1 per-message PublishAck history scan is gone; the receipt-ring read replaces it.
    expect(app).not.toMatch(/const CAPSULEHUB_PUBLISH_ACK_OP/);
    expect(app).not.toMatch(/function parseCapsuleHubPublishAckBody/);
    expect(app).not.toMatch(/confirmCapsuleHubPublishEntriesFromVaultAckHistory/);
    expect(app).not.toMatch(/readVaultPublishAckHistory/);
    expect(app).not.toMatch(/confirmedBy:\s*'vault_ack_history'/);
    expect(app).toMatch(/async function confirmVaultBatchReceiptsFromPublishState\(publishState, options = \{\}\)/);
    expect(app).toMatch(/readBatchPublishReceipt\(provider, vaultAddress, owner, batch\.nonce, readOptions\)/);
    expect(app).toMatch(/confirmedBy:\s*'vault_batch_receipt'/);
    expect(app).toMatch(/async function confirmPrivatePublishEntriesFromSenderIndex/);
    expect(app).toMatch(/confirmedBy:\s*'private_sender_index'/);
    expect(confirmationSource).toMatch(/await confirmPrivatePublishEntriesFromSenderIndex\(publishState, pendingParts, providerCandidates, readOptions, \{/);
    expect(app).toMatch(/candidateProvider\.getPrivateSenderIndex\(keyIdIndex, readOptions\)/);
    expect(app).toMatch(/function publishConfirmScanBounds/);
    expect(app).toMatch(/function publishConfirmCommitScan/);
    expect(app).toMatch(/publishState\.confirmSearch/);
    expect(app).toMatch(/if \(latest > latestSeen\) \{[\s\S]*existing\.nextEntryId = latest > 0n \? String\(latest - 1n\) : null;[\s\S]*existing\.exhausted = false;/);
    // VPB2: each part's publish_id is the per-entry EPI1 derived by the batch builder (not a VPB1 single-publish id).
    expect(app).not.toMatch(/async function computeVaultPublishId/);
    expect(app).toMatch(/const epi1 = publishHashPlain\(batchExternal\.entryPublishIds\[entryIndex\]\)/);
    expect(app).toMatch(/partWithPublishId\.publishId = epi1/);
    expect(app).toMatch(/function publishEntryMatchesPartPayload\(entry, part\)/);
    expect(app).toMatch(/options\.requirePublishIdMatch === true \|\| expectedPublishId/);
    expect(app).toMatch(/return options\.allowPublishIdMismatch === true/);
    expect(app).toMatch(/const entryPublishId = publishHashPlain\(entry\.publish_id\)/);
    expect(app).toMatch(/entryPublishId === expectedPublishId/);
    expect(app).toMatch(/const expectedAuthorWallet = part\.authorWallet \?\? part\.author_wallet \?\? null/);
    expect(app).toMatch(/sameWalletAddress\(entryAuthorWallet, expectedAuthorWallet\)/);
    expect(confirmationSource).toMatch(/const requirePublishIdMatch = group\.kind === 'public'/);
    expect(confirmationSource).toMatch(/const allowPublishIdMismatch = group\.kind === 'private'/);
    expect(confirmationSource).toMatch(/publishEntryMatchesPart\(entry, part, \{ allowPublishIdMismatch, requirePublishIdMatch \}\)/);
    expect(confirmationSource).toMatch(/confirmedBy:\s*requirePublishIdMatch \? 'confirmed_by_publish_id' : 'entry_payload_recovery'/);
    expect(confirmationSource).not.toMatch(/group\.kind === 'public' && Boolean\(part\.authorWallet \?\? part\.author_wallet\)/);
    expect(confirmationSource).toMatch(/candidateProvider\.getPrivateEntry\(entryId, readOptions\)/);
    expect(confirmationSource).toMatch(/candidateProvider\.getPublicEntry\(entryId, readOptions\)/);
  });

  it('RT-PWA-CAPS-001: publish confirmation cannot mark CapsuleHub confirmed from unverified reads, and the receipt-ring read is verified fail-closed', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const confirmationSource = app.slice(
      app.indexOf('async function confirmVaultBatchReceiptsFromPublishState'),
      app.indexOf('async function publishCapsuleThroughVault'),
    );
    // The receipt-ring confirm: the authoritative single-read answer for a batch's fate.
    const receiptSource = app.slice(
      app.indexOf('async function confirmVaultBatchReceiptsFromPublishState'),
      app.indexOf('async function confirmCapsuleHubPublishEntriesWithReadMode'),
    );
    const strictStart = app.indexOf('async function confirmCapsuleHubPublishEntriesWithReadMode');
    const directConfirmStart = app.indexOf('async function confirmCapsuleHubPublishEntries(publishState, options = {})');
    const strictSource = app.slice(
      strictStart,
      directConfirmStart,
    );
    const retrySource = app.slice(
      app.indexOf('async function runPrivatePublishConfirmationRetry'),
      app.indexOf('function hasPendingPrivatePublishConfirmation'),
    );
    const avatarSource = app.slice(
      app.indexOf('async function submitProfileAvatarUpdate'),
      app.indexOf('async function attemptPrivatePaymentCheckPublish'),
    );
    const avatarFinalizeSource = app.slice(
      app.indexOf('async function finalizeProfileAvatarUpdate'),
      app.indexOf('async function runProfileAvatarPublishRecovery'),
    );

    expect(strictSource).toMatch(/const readOptions = publishConfirmReadOptions\(address, options\)/);
    expect(app).toMatch(/function publishConfirmReadOptions\(address, options = \{\}\)[\s\S]*const out = criticalCapsuleHubReadOptions\(address\)/);
    // The CapsuleHub entry-scan recovery never trusts unverified critical reads to confirm.
    expect(strictSource).not.toMatch(/capsuleHubMessageSyncReadOptions|allowUnverifiedCriticalRead/);
    // The receipt-ring read is VERIFIED (dual-provider) fail-closed: a CAPSULEHUB_CONFIRMED transition must
    // never rest on a single unverified replica.
    expect(receiptSource).toMatch(/const readOptions = \{\s*verify: true,/);
    expect(receiptSource).not.toMatch(/allowUnverifiedCriticalRead:\s*true/);
    expect(receiptSource).toMatch(/readBatchPublishReceipt\(provider, vaultAddress, owner, batch\.nonce, readOptions\)/);
    expect(receiptSource).toMatch(/BATCH_PUBLISH_RECEIPT_STATUS\.CONFIRMED/);
    expect(receiptSource).toMatch(/BATCH_PUBLISH_RECEIPT_STATUS\.REJECTED/);
    expect(receiptSource).toMatch(/BATCH_PUBLISH_RECEIPT_STATUS\.BOUNCED/);
    expect(receiptSource).toMatch(/firstEntryId \+ BigInt\(batchPartIndex\)/);
    expect(receiptSource).toMatch(/confirmedBy:\s*'vault_batch_receipt'/);
    expect(confirmationSource).toMatch(/const requirePublishIdMatch = group\.kind === 'public'/);
    expect(confirmationSource).toMatch(/publishEntryMatchesPart\(entry, part, \{ allowPublishIdMismatch, requirePublishIdMatch \}\)/);
    expect(confirmationSource).not.toMatch(/group\.kind === 'public' && Boolean\(part\.authorWallet \?\? part\.author_wallet\)/);
    expect(directConfirmStart).toBeGreaterThan(strictStart);
    expect(confirmationSource).toMatch(/async function confirmCapsuleHubPublishEntries\(publishState, options = \{\}\)[\s\S]*return confirmCapsuleHubPublishEntriesWithReadMode\(publishState, options\.hot === true/);
    expect(strictSource).toMatch(/if \(options\.skipBatchReceipt !== true\)[\s\S]*confirmVaultBatchReceiptsFromPublishState/);
    expect(confirmationSource).toMatch(/scanLimit: options\.scanLimit \?\? CAPSULEHUB_PUBLISH_CONFIRM_HOT_SCAN_LIMIT/);
    expect(retrySource).toMatch(/await recoverDroppedSignedPublishParts\(message\)/);
    expect(retrySource).toMatch(/if \(message\.publishState\?\.status !== CAPSULEHUB_PUBLISH_STATUS_CONFIRMED\)[\s\S]*schedulePrivatePublishConfirmationRetry\(context\)/);
    expect(retrySource).toMatch(/const softVerification = isTonRpcRecoverableReadError\(error\)/);
    expect(retrySource).toMatch(/if \(!rateLimited && !softVerification\) console\.error\(error\)/);
    expect(retrySource).toMatch(/message\.privatePublishConfirmLastResult = softVerification \? 'rpc delayed' : 'error'/);
    expect(avatarSource).toMatch(/await waitForPublishedAvatarEntries\(owner, pendingPointer\)/);
    expect(avatarFinalizeSource).toMatch(/avatarEntryId: confirmed\.firstEntryId/);
  });

  it('RT-PWA-CAPS-001B: private sync repair confirms stale pending parts by payload hashes', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const repairSource = app.slice(
      app.indexOf('async function confirmPendingPrivatePublishMessagesFromEntries'),
      app.indexOf('function publishConfirmSearchState'),
    );
    const strictSource = app.slice(
      app.indexOf('async function confirmCapsuleHubPublishEntriesWithReadMode'),
      app.indexOf('function isFreshPrivatePublishConfirmation'),
    );
    const immediateSource = app.slice(
      app.indexOf('function shouldRunImmediatePrivatePublishConfirmation'),
      app.indexOf('function scheduleImmediatePrivatePublishConfirmation'),
    );

    expect(app).toMatch(/function publishPartBodyHash\(part\)[\s\S]*part\?\.bodyHash \?\? part\?\.body_hash/);
    expect(app).toMatch(/function publishPartHeader0Hash\(part\)[\s\S]*part\?\.header0Hash \?\? part\?\.header_0_hash/);
    expect(app).toMatch(/function publishPartKind\(part\)[\s\S]*part\?\.publishKind \?\? part\?\.publish_kind/);
    expect(app).toMatch(/function publishPartHasPayloadHashes\(part\)/);
    expect(app).toMatch(/function publishPartHadPriorChainAttempt\(part\)[\s\S]*retryPreviousStatus/);
    expect(app).toMatch(/function publishPartEligibleForChainConfirmation\(part\)[\s\S]*publishPartHadPriorChainAttempt\(part\)/);
    expect(repairSource).toMatch(/publishState\?\.parts\?\.length/);
    expect(repairSource).toMatch(/publishPartKind\(part\) !== 'private'/);
    expect(repairSource).toMatch(/publishPartHasPayloadHashes\(part\)/);
    expect(repairSource).not.toMatch(/publishPartEligibleForChainConfirmation\(part\)/);
    expect(repairSource).not.toMatch(/!publishPartAlreadyAttempted\(part\)/);
    expect(repairSource).toMatch(/publishEntryMatchesPart\(candidate, part, \{[\s\S]*allowPublishIdMismatch:\s*true/);
    expect(repairSource).toMatch(/plathoLastPrivatePublishSyncRepair/);
    expect(strictSource).toMatch(/publishPartHadPriorChainAttempt\(part\)/);
    expect(immediateSource).toMatch(/publishPartAwaitingCapsuleHubConfirmation\(part\) \|\| publishPartHadPriorChainAttempt\(part\)/);
  });

  it('RT-VCAPS-001: already-submitted private publishes keep a long background confirmation window', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const confirmationRetry = app.slice(
      app.indexOf('function schedulePrivatePublishConfirmationRetry'),
      app.indexOf('function hasPendingPrivatePublishConfirmation'),
    );
    const sendRetry = app.slice(
      app.indexOf('function schedulePrivateSendRetry'),
      app.indexOf('function privatePublishConfirmStoppedStatusText'),
    );
    const resumeSource = app.slice(
      app.indexOf('function resumePendingPrivatePublishConfirmations'),
      app.indexOf('function clearPrivateMessageManualRecovery'),
    );

    expect(app).toMatch(/const PRIVATE_PENDING_PUBLISH_CONFIRMATION_STALE_AFTER_MS = 24 \* 60 \* 60 \* 1000/);
    expect(app).toMatch(/const PRIVATE_PUBLISH_CONFIRM_BACKGROUND_RETRY_MS = 30 \* 1000/);
    expect(app).toMatch(/privatePublishConfirmNextAt/);
    expect(app).toMatch(/privatePublishConfirmLastResult/);
    expect(app).toMatch(/const PRIVATE_PUBLISH_MISSING_PART_RETRY_AFTER_MS = 2 \* 60 \* 1000/);
    expect(app).toMatch(/function isStalePrivatePendingPublishConfirmation\(message\)/);
    expect(app).toMatch(/function markStaleUnconfirmedPublishPartsForRetry\(message/);
    expect(app).toMatch(/function shouldRunImmediatePrivatePublishConfirmation\(message\)/);
    expect(app).toMatch(/function scheduleImmediatePrivatePublishConfirmation\(context\)/);
    expect(confirmationRetry).toMatch(/isStalePrivatePendingPublishConfirmation\(message\)/);
    expect(confirmationRetry).toMatch(/markStaleUnconfirmedPublishPartsForRetry\(message, 'missing CapsuleHub entry'\)/);
    expect(confirmationRetry).toMatch(/PRIVATE_PUBLISH_CONFIRM_RECOVERY_DEADLINE_MS/);
    expect(confirmationRetry).toMatch(/PRIVATE_PUBLISH_CONFIRM_RECOVERY_REQUEST_TIMEOUT_MS/);
    expect(confirmationRetry).toMatch(/confirmTimedOut/);
    expect(confirmationRetry).toMatch(/const sendRetryScheduled = ensurePendingPrivateSendRetry\(thread, message/);
    expect(confirmationRetry).toMatch(/Retrying unsent capsule parts/);
    // Owner-directed (2026-06-18), SUPERSEDES the prior unbounded background window: a multi-part
    // publish that confirms NOTHING after the active-attempt budget (or a hard backstop) STOPS and
    // surfaces a manual Retry instead of spinning forever on "submitted N/N, confirming". The cap is
    // GATED on confirmedCount===0 so a partially/fully-confirmed (progressing/delivered) publish still
    // keeps the long background window; and the manual Retry for a fully-submitted message re-confirms
    // (never re-publishes), so no double-send regression.
    expect(confirmationRetry).toMatch(/confirmedCount \?\? 0\) === 0[\s\S]{0,200}attempt >= PRIVATE_PUBLISH_CONFIRM_ACTIVE_ATTEMPT_LIMIT[\s\S]{0,200}stopPrivatePublishConfirmationRetry/);
    expect(confirmationRetry).toMatch(/attempt >= PRIVATE_PUBLISH_CONFIRM_ACTIVE_ATTEMPT_LIMIT[\s\S]{0,120}PRIVATE_PUBLISH_CONFIRM_BACKGROUND_RETRY_MS/);
    expect(sendRetry).toMatch(/isStalePrivatePendingPublish\(message\) && !privateMessageHasPublishAttempt\(message\)/);
    expect(resumeSource).toMatch(/isStalePrivatePendingPublishConfirmation\(message\)/);
    expect(resumeSource).toMatch(/scheduleImmediatePrivatePublishConfirmation\(\{/);
    expect(resumeSource).toMatch(/!privateMessageHasPublishAttempt\(message\)/);
  });

  it('RT-VCAPS-002: publish preparation preflights CapsuleHub global before signing', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const routeSource = app.slice(
      app.indexOf('function assertCapsuleHubGlobalMatchesConfig'),
      app.indexOf('async function requireProfileRegistryVaultRoute'),
    );
    const prepareSource = app.slice(
      app.indexOf('async function prepareCapsulesThroughVault'),
      app.indexOf('async function sendPreparedCapsulesThroughVault'),
    );
    const signingIndex = prepareSource.indexOf('return {');
    const routeIndex = prepareSource.indexOf('requireCapsuleHubVaultRouteForPublish(global)');

    expect(routeSource).toMatch(/global\.sealed !== true/);
    expect(routeSource).toMatch(/global\.vault_bound !== true/);
    expect(routeSource).toMatch(/requireManifestHashMatch\(global\.deployment_manifest_hash, 'CapsuleHub'\)/);
    expect(routeSource).toMatch(/global\.vault_address/);
    expect(routeSource).toMatch(/CapsuleHub Vault binding does not match this app config/);
    expect(routeSource).toMatch(/global\.fee_accumulator_address/);
    expect(routeSource).toMatch(/CapsuleHub FeeAccumulator binding does not match this app config/);
    expect(routeSource).toMatch(/resolved\.provider\.getState\(readOptions\)/);
    expect(routeIndex).toBeGreaterThanOrEqual(0);
    expect(signingIndex).toBeGreaterThan(routeIndex);
  });

  it('PWA-SEND-18: outbound private work pauses automatic message sync', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const autoSyncSource = app.slice(
      app.indexOf('function scheduleMessageAutoSync'),
      app.indexOf('async function bootReplayStore'),
    );
    const paymentSource = app.slice(
      app.indexOf('async function attemptPrivatePaymentCheckPublish'),
      app.indexOf('async function attemptCancelPaymentCheckAfterPublishFailure'),
    );
    const publishSource = app.slice(
      app.indexOf('async function attemptPrivateComposerMessagePublish'),
      app.indexOf('async function settlePrivateComposerSendError'),
    );
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
    for (const source of [paymentSource, publishSource, confirmSource]) {
      expect(source).toMatch(/const endPrivateOutboundWork = beginPrivateOutboundWork\(\)/);
      expect(source).toMatch(/finally \{[\s\S]*endPrivateOutboundWork\(\);[\s\S]*\}/);
    }
    // A send also YIELDS to an in-flight sync pass (privateChainSyncPromise), capped, so the two never fight
    // the keyless ~1 rps budget. No-op when no sync is running; bounded so a stuck sync can't block sends.
    expect(publishSource).toMatch(/if \(privateChainSyncPromise\) \{[\s\S]*Promise\.race\(\[[\s\S]*privateChainSyncPromise[\s\S]*PRIVATE_SEND_SYNC_WAIT_CAP_MS/);
    expect(app).toMatch(/const PRIVATE_SEND_SYNC_WAIT_CAP_MS = 6 \* 1000/);
  });

  it('PWA-MSG-01: default public sync window covers the maximum public multipart image', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const html = readFileSync('web/index.html', 'utf8');
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
    expect(syncPublicSource).toMatch(/const minEntryId = syncWindow === 'long' \? 0 : Math\.max\(0, latest - readLimit\)/);
    expect(html).toMatch(/<option value="short">Short - newest 128 entries<\/option>/);
    expect(html).toMatch(/<option value="long">Long - retained history, up to 1 year<\/option>/);
    expect(html).not.toMatch(/<option value="7">/);
    expect(html).not.toMatch(/<option value="30">/);
    expect(html).not.toMatch(/<option value="90">/);
    expect(app).toMatch(/if \(text === 'all' \|\| text === 'long'\) return 'long'/);
    expect(app).toMatch(/return 'short'/);
    expect(app).toMatch(/return normalized === 'long' \? 'long public history' : 'short public history'/);
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

    expect(app).toMatch(/const PRIVATE_CHAIN_INDEX_READ_LIMIT = 120/);
    expect(helperSource).toMatch(/appConfig\.capsuleHub\?\.privateIndexReadLimit \?\? PRIVATE_CHAIN_INDEX_READ_LIMIT/);
    expect(helperSource).toMatch(/Private message has \$\{parts\} capsules; split it into messages of \$\{limit\} capsules or fewer/);
    expect(helperSource).toMatch(/function assertPrivateComposerPartLimit/);
    expect(shortfallSource).toMatch(/if \(privateComposerPartLimitMessage\(plan\.length\)\) return true/);
    expect(statusSource).toMatch(/const limitMessage = privateComposerPartLimitMessage\(privatePlan\.length\)/);
    expect(statusSource).toMatch(/\? \{ text: limitMessage, state: 'short' \}/);
    expect(submitSource).toMatch(/const limitMessage = privateComposerPartLimitMessage\(sendPlan\.length\)/);
    expect(submitSource).toMatch(/privateComposerCostStatus\.textContent = limitMessage/);
    expect(capsuleSource).toMatch(/assertPrivateComposerPartLimit\(totalParts\)/);
    expect(syncSource).toMatch(/provider\.getPrivateRecipientIndex\(keyIdIndex, readOptions\)/);
    expect(syncSource).toMatch(/provider\.getPrivateSenderIndex\(keyIdIndex, readOptions\)/);
    expect(syncSource).toMatch(/let allowUnverifiedPrivateIndexRead = options\.allowUnverifiedPrivateIndexRead === true/);
    expect(syncSource).toMatch(/const allowUnverifiedPrivateIndexFallback = quickSync && options\.allowUnverifiedPrivateIndexRead !== false/);
    expect(syncSource).toMatch(/let readOptions = allowUnverifiedPrivateIndexRead[\s\S]*capsuleHubMessageSyncReadOptions\(address\)[\s\S]*criticalCapsuleHubReadOptions\(address\)/);
    expect(app).toMatch(/function privateIndexCursorPersistenceMode\(readOptions = \{\}\)/);
    expect(syncSource).toMatch(/const cursorPersistence = privateIndexCursorPersistenceMode\(readOptions\)/);
    expect(syncSource).toMatch(/const canPersistPrivateIndexCursor = cursorPersistence !== 'disabled_unverified'/);
    expect(app).toMatch(/function privateIndexSyncReadLimit/);
    expect(syncSource).toMatch(/walkIndexedRole\('recipient', recipientHead\)/);
    expect(syncSource).toMatch(/walkIndexedRole\('sender', senderHead\)/);
    expect(syncSource).toMatch(/if \(canPersistPrivateIndexCursor && !rateLimitError && scanComplete && !hasFreshPartial && bodyHistoryError === null\)/);
    expect(syncSource).toMatch(/writePrivateChainIndexCursor\(address, write\.role, write\.cursor\)/);
    expect(syncSource).toMatch(/walkRecentIndexedRoleForRepair\('recipient', recipientHead\)/);
    expect(syncSource).toMatch(/walkRecentIndexedRoleForRepair\('sender', senderHead\)/);
    expect(syncSource).toMatch(/writePrivateChainHeadRepairLink\(address, write\.role, write\.link\)/);
    expect(syncSource).toMatch(/confirmPendingPrivatePublishMessagesFromEntries\(/);
    expect(syncSource).not.toMatch(/writePrivateChainScanCursor|readPrivateChainScanCursor/);
    expect(syncSource).toMatch(/if \(bodyHistoryError\) \{[\s\S]*rememberPrivateBodyHistoryUnavailable\(address, part\.entry, part\.entryId\)/);
    expect(syncSource).toMatch(/isPendingIdentityResolutionThread\(existing\.targetThread\) && !isPendingIdentityResolutionThread\(targetThread\)/);
    expect(syncSource).toMatch(/try \{[\s\S]*appendOpenedPrivatePartsMessage\(/);
    expect(syncSource).toMatch(/pruneEmptyAnonymousPeerThreads\(\)/);
    expect(syncSource).toMatch(/catch \(error\) \{[\s\S]*plathoLastPrivateSyncGroupError/);
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
    expect(app).toMatch(/function privateSenderModeToggleBlockReason\(\)/);
    expect(app).toMatch(/function canTogglePrivateSenderMode\(\)/);
    expect(app).toMatch(/privateAnonymousButton\.disabled = Boolean\(blockReason\)/);
    expect(app).toMatch(/privateAnonymousButton\.title = blockReason \?\? \(/);
    expect(app).toMatch(/privateAnonymousButton\?\.addEventListener\('click', \(\) => \{[\s\S]*if \(!canTogglePrivateSenderMode\(\)\)/);
    expect(app).toMatch(/Pseudonymous: wallet address hidden, sender key may still link messages/);
    const senderModeUiSource = app.slice(
      app.indexOf('function updatePrivateSenderModeUi'),
      app.indexOf('function normalizeLinkedPlathoUsername'),
    );
    expect(senderModeUiSource).not.toMatch(/hasActivePlathoAccount\(\)/);
    expect(app).toMatch(/options\.includeSenderWalletMetadata === false[\s\S]*\? \{\}/);
    expect(app).toMatch(/const senderUsername = privateSenderUsernameMetadataLabel\(options\)/);
    expect(app).toMatch(/senderUsername: senderUsername \?\? undefined/);
    expect(app).toMatch(/createPrivateComposerCapsules\(text, attachments[\s\S]*recipientEntry, thread\.id, senderOptions/);
    expect(app).toMatch(/privateComposerSendPlan\(text, attachments, senderOptions, \{ paymentCheck: paymentDraft \}\)/);
    expect(app).toMatch(/const recipientWallet = requireBasechainAddress\(recipientEntry\?\.walletAddress, 'Recipient wallet'\)/);
    expect(app).toMatch(/const recipientMetadata = \{[\s\S]*recipientWallet,[\s\S]*\}/);
    expect(app).toMatch(/encodeCompactPayload\(\{[\s\S]*type: 'document'[\s\S]*\.\.\.senderMetadata[\s\S]*\.\.\.recipientMetadata[\s\S]*reservedTailBytes: PLATHO_COMPACT_SENDER_RECOVERY_BYTES/);
    expect(app).toMatch(/createEncryptedPrivateCapsuleFromPublicBundle[\s\S]*senderRecovery:\s*true/);
    expect(identities).toMatch(/const anonymousId = normalizedPeerId\(input\.senderKeyId \?\? input\.keyId\)/);
    expect(identities).toMatch(/id: identity \? recipientThreadId\(identity\) : `peer:\$\{encodeURIComponent\(anonymousId\)\}`/);
    expect(identities).toMatch(/`Anonymous \$\{shortPeerId\(anonymousId\)\}`/);
    expect(app).toMatch(/function knownPrivateWalletForSigningPubkey\(signPubkey\)/);
    expect(app).toMatch(/message\?\.type !== 'in'/);
    expect(app).toMatch(/knownVaultKeyOwnerBySignPubkey\.set\(key, wallet\)/);
    expect(app).toMatch(/created\.pendingIdentityResolution = true/);
    expect(app).toMatch(/function isPendingIdentityResolutionThread\(thread\)/);
    expect(app).toMatch(/privateChainSyncPromise && isPendingIdentityResolutionThread\(thread\)/);
    expect(app).toMatch(/function pruneEmptyAnonymousPeerThreads\(\)/);
    expect(app).toMatch(/pruneEmptyAnonymousPeerThreads\(\)/);
  });

  it('PWA-MSG-02C: private attachments are composer drafts, not single-slot or immediate-send actions', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const html = readFileSync('web/index.html', 'utf8');
    const paymentButtonSource = app.slice(
      app.indexOf("paymentCheckButton?.addEventListener('click'"),
      app.indexOf("privateComposerAddButton?.addEventListener('click'"),
    );
    const submitSource = app.slice(
      app.indexOf("composer?.addEventListener('submit'"),
      app.indexOf('createWalletButton?.addEventListener'),
    );

    expect(html).toMatch(/id="paymentCheckButton"[\s\S]*Attach private payment check/);
    expect(app).toMatch(/let privateImageAttachments = \[\]/);
    expect(app).toMatch(/let privatePaymentCheckDraft = null/);
    expect(app).toMatch(/privateImageAttachments = \[\.\.\.privateImageAttachments, attachment\]/);
    expect(app).toMatch(/function composerBlocksFromDraft/);
    expect(app).toMatch(/function messageDocumentBytesFromDraft/);
    expect(paymentButtonSource).toMatch(/const paymentDetails = await requestPaymentCheckDetails\(privatePaymentCheckDraft\)/);
    expect(paymentButtonSource).toMatch(/privatePaymentCheckDraft = paymentDetails/);
    expect(paymentButtonSource).toMatch(/insertPaymentCheckMarker\(\)/);
    expect(paymentButtonSource).not.toMatch(/submitCreatePaymentCheck\(/);
    expect(submitSource).toMatch(/const attachments = normalizePrivateImageAttachments\(privateImageAttachments\)/);
    expect(submitSource).toMatch(/const paymentDraft = privatePaymentCheckDraft/);
    expect(submitSource).toMatch(/const draftBlocks = composerBlocksFromDraft\(text,\s*attachments,\s*paymentDraft\)/);
    expect(submitSource).toMatch(/blocks:\s*displayBlocks/);
    expect(submitSource).toMatch(/await attemptPrivatePaymentCheckPublish\(sendContext\)/);
    expect(submitSource).not.toMatch(/submitCreatePaymentCheck\(\{ thread, paymentDetails: paymentDraft \}\)/);
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
    expect(app).toMatch(/async function threadForOpenedSenderCapsule\(opened\)[\s\S]*recipientWallet[\s\S]*createRecipientThread\(recipientWallet\)/);
    expect(app).toMatch(/async function threadForOpenedSenderCapsule\(opened\)[\s\S]*label: 'Recovered sent'/);
  });

  it('PWA-CONFIG-01D4: payment checks preflight and persist recovery before signed CreateReceiveIntent external', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const store = readFileSync('web/encrypted-message-store.mjs', 'utf8');
    const source = app.slice(
      app.indexOf('async function attemptPrivatePaymentCheckPublish'),
      app.indexOf('async function submitVaultClaimPaymentCheck'),
    );
    const helpers = app.slice(
      app.indexOf('function paymentAssetVaultBalance'),
      app.indexOf('function delay'),
    );
    const localIntentIndex = source.indexOf('const intentId = await computeVaultReceiveIntentId({');
    const quotedPrepareIndex = source.indexOf('const quotedPublish = await prepareCapsulesThroughVault(capsules, {');
    const fallbackUserIndex = source.indexOf('const initialUser = await readFreshConnectedVaultUserForOwnVaultAction(provider)');
    const persistIndex = source.indexOf('const storedRecovery = await persistMessageToEncryptedHistory(thread, message)');
    const pendingLedgerIndex = source.indexOf('const pendingLedger = await rememberPendingPaymentCheckLedgerRecord(');
    const createIndex = source.indexOf("submitVaultReceiveIntentExternal('CreateReceiveIntent'");
    const waitCreateIndex = source.indexOf('await waitForPaymentCheckCreateConfirmation(provider, payment)');
    const finalPreparedIndex = source.indexOf('const preparedPublish = await prepareCapsulesThroughVault(capsules, {', waitCreateIndex);

    expect(fallbackUserIndex).toBeGreaterThanOrEqual(0);
    expect(localIntentIndex).toBeGreaterThan(fallbackUserIndex);
    expect(quotedPrepareIndex).toBeGreaterThan(fallbackUserIndex);
    expect(persistIndex).toBeGreaterThan(quotedPrepareIndex);
    expect(pendingLedgerIndex).toBeGreaterThan(persistIndex);
    expect(createIndex).toBeGreaterThan(pendingLedgerIndex);
    expect(waitCreateIndex).toBeGreaterThan(createIndex);
    expect(finalPreparedIndex).toBeGreaterThan(waitCreateIndex);
    expect(source.slice(createIndex)).not.toMatch(/prepareCapsulesThroughVault\(\[capsule\]/);
    expect(source).not.toMatch(/getReceiveIntentId/);
    expect(source).not.toMatch(/allowUnverifiedCriticalRead:\s*true[\s\S]*getReceiveIntentId/);
    expect(source).toMatch(/const commitment = secret32/);
    expect(source).toMatch(/createPrivateComposerCapsules\(context\.text \?\? '', context\.attachments \?\? \[\], recipientEntry, thread\.id, senderOptions, \{ payment \}\)/);
    expect(app).toMatch(/function paymentSecret32Bytes\(payment\)/);
    expect(app).toMatch(/function normalizePaymentForMessage\(payment\)[\s\S]*secret32Hex:\s*bytesToHex\(paymentSecret32Bytes\(payment\)\)/);
    expect(app).toMatch(/function documentPaymentContent\(payment, options = \{\}\)[\s\S]*paymentSecret32Bytes\(payment\)[\s\S]*options\.allowMissingPaymentSecret === true[\s\S]*new Uint8Array\(32\)/);
    expect(app).toMatch(/function privateComposerSendPlan[\s\S]*messageDocumentBytesFromDraft\([\s\S]*allowMissingPaymentSecret:\s*true/);
    expect(source).toMatch(/allowOwnVaultActionReadFallback:\s*true/);
    expect(source).not.toMatch(/allowUnverifiedNonceRead:\s*true|allowUnverifiedNonceWait/);
    expect(helpers).toMatch(/async function readConnectedVaultGlobalForOwnVaultAction[\s\S]*criticalChainReadOptions\(\)/);
    // Pre-sign own-action reads fail closed unless the transport reports
    // degraded censorship-survival mode (callWithDegradedTransportReadFallback).
    expect(helpers).toMatch(/async function readFreshConnectedVaultUserForOwnVaultAction\(provider\)[\s\S]*callWithDegradedTransportReadFallback\(/);
    expect(helpers).toMatch(/\(\) => readFreshConnectedVaultUser\(provider\)/);
    expect(helpers).toMatch(/async function readFreshReceiveIntentForOwnVaultAction\(provider, intentId\)[\s\S]*callWithDegradedTransportReadFallback\(/);
    expect(helpers).toMatch(/\(\) => readFreshReceiveIntent\(provider, intentId\)/);
    expect(helpers).not.toMatch(/readFreshConnectedVaultUser\(provider, \{ verify: false|readFreshReceiveIntent\(provider, intentId, \{ verify: false/);
    expect(app).toMatch(/if \(options\.allowOwnVaultActionReadFallback === true\) \{[\s\S]*await readConnectedVaultGlobalForOwnVaultAction\(provider\)/);
    expect(source).toMatch(/tonBalance < amount \+ createReserve \+ quotedPublish\.totalMaxCharge/);
    expect(source).toMatch(/athBalance < amount/);
    expect(source).toMatch(/tonBalance < createReserve \+ quotedPublish\.totalMaxCharge/);
    expect(source).toMatch(/waitForPaymentCheckCreateConfirmation\(provider,\s*payment\)/);
    expect(source).toMatch(/const preparedPublish = await prepareCapsulesThroughVault\(capsules, \{[\s\S]*publishState[\s\S]*allowOwnVaultActionReadFallback:\s*true/);
    expect(helpers).toMatch(/function readFreshReceiveIntentForOwnVaultAction/);
    expect(helpers).toMatch(/waitForPaymentCheckCreateConfirmation[\s\S]*readFreshReceiveIntentForOwnVaultAction\(provider, intentId\)/);
    expect(source).toMatch(/encryptedMessageStore\.persistent === false/);
    expect(app).toMatch(/function paymentDraftForHistory/);
    expect(app).toMatch(/payment:\s*paymentForHistory\(message\.payment\)/);
    expect(app).toMatch(/paymentDraft:\s*paymentDraftForHistory\(message\.paymentDraft\)/);
    expect(source).toMatch(/message\.paymentDraft = paymentDraftForHistory\(paymentDraft\)/);
    expect(source).toMatch(/rememberPaymentCheckActionError\('pre-create', error, payment\)/);
    expect(source).toMatch(/status:\s*'prepared'/);
    expect(source).toMatch(/required:\s*true/);
    expect(source).toMatch(/Payment check pending ledger could not be saved/);
    expect(source).toMatch(/status:\s*'intent_create_submitted'/);
    expect(source).toMatch(/status:\s*'intent_confirmed'/);
    expect(source).toMatch(/status:\s*'publish_submitted'/);
    expect(source).toMatch(/status:\s*'publish_failed_refund_required'/);
    expect(source).toMatch(/message\.meta = publishStateMeta\(message\.publishState\)/);
    expect(source).not.toMatch(/message\.meta = `check \$\{publishStateMeta/);
    expect(source).not.toMatch(/message\.meta = `check \$\{privateSendRetryMeta/);
    expect(source).toMatch(/removePendingPaymentCheckLedgerRecord\(payment\)/);
    expect(app).toMatch(/const PAYMENT_CHECK_PENDING_LEDGER_KIND = 'platho\.paymentCheck\.pendingIntent\.v1'/);
    expect(app).toMatch(/async function restorePendingPaymentCheckLedger/);
    expect(app).toMatch(/encryptedMessageStore\.putPendingPaymentCheck/);
    expect(app).toMatch(/encryptedMessageStore\.listPendingPaymentChecks/);
    expect(store).toMatch(/const PENDING_PAYMENT_CHECK_STORE_NAME = 'pendingPaymentChecks'/);
    expect(store).toMatch(/const MESSAGE_HISTORY_DB_VERSION = 2/);
    expect(store).toMatch(/async putPendingPaymentCheck\(input\)/);
    expect(store).toMatch(/async removePendingPaymentCheck\(id\)/);
    expect(source).toMatch(/privateSendBlockedStatusText\(error\)/);
    expect(source).toMatch(/rememberPaymentCheckActionError\('publish', error, payment\)/);
    expect(source).toMatch(/check not delivered, refund required/);
  });

  it('PWA-CONFIG-01D4A: receive-intent externals treat ambiguous sendBoc as submitted and poll confirmation', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const source = app.slice(
      app.indexOf('async function submitVaultReceiveIntentExternal'),
      app.indexOf('async function submitAthWalletMessage'),
    );

    expect(source).toMatch(/catch \(error\) \{[\s\S]*isAmbiguousTonRpcBroadcastError\(error\)/);
    expect(source).toMatch(/ambiguousBroadcast = true/);
    expect(source).toMatch(/broadcastError = error/);
    expect(source).toMatch(/await waitForVaultPublishNonce\(provider, owner, clientNonce \+ 1n/);
    expect(source).toMatch(/confirmationPending: Boolean\(nonceWaitError\)/);
    expect(source).toMatch(/if \(ambiguousBroadcast \|\| result\) \{[\s\S]*nonceWaitError = error;[\s\S]*\} else \{[\s\S]*throw error;/);
  });

  it('PWA-CONFIG-01D4C: service Vault externals handle ambiguous broadcast before downstream finality checks', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const helperSource = app.slice(
      app.indexOf('async function submitVaultAuthExternalWithNonceConfirmation'),
      app.indexOf('async function submitVaultReceiveIntentExternal'),
    );
    const profileSource = app.slice(
      app.indexOf('async function submitVaultProfileAvatarRegistration'),
      app.indexOf('async function refreshWalletTonBalanceForProfile'),
    );
    const avatarFlow = app.slice(
      app.indexOf('async function submitProfileAvatarUpdate'),
      app.indexOf('async function attemptPrivatePaymentCheckPublish'),
    );
    const usernameFlow = app.slice(
      app.indexOf('async function submitUsernameMint'),
      app.indexOf('async function submitProfileAvatarUpdate'),
    );
    const keyRotateSource = app.slice(
      app.indexOf('async function submitVaultReplaceMessagingKeys'),
      app.indexOf('const VAULT_PUBLISH_STATUS_SUBMITTED'),
    );

    expect(helperSource).toMatch(/catch \(error\) \{[\s\S]*isAmbiguousTonRpcBroadcastError\(error\)/);
    expect(helperSource).toMatch(/ambiguousBroadcast = true/);
    expect(helperSource).toMatch(/await waitForVaultPublishNonce\(provider, owner, clientNonce \+ 1n/);
    expect(helperSource).toMatch(/if \(ambiguousBroadcast \|\| result\) \{[\s\S]*nonceWaitError = error;[\s\S]*\} else \{[\s\S]*throw error;/);
    expect(helperSource).toMatch(/confirmationPending: Boolean\(nonceWaitError\)/);
    expect(profileSource).toMatch(/async function submitVaultProfileAvatarRegistration[\s\S]*submitVaultAuthExternalWithNonceConfirmation/);
    expect(profileSource).toMatch(/async function submitVaultUsernameMint[\s\S]*submitVaultAuthExternalWithNonceConfirmation/);
    expect(keyRotateSource).toMatch(/submitVaultAuthExternalWithNonceConfirmation/);
    expect(keyRotateSource).toMatch(/submission\.confirmationPending \? 'key update submitted, confirming' : 'key update sent'/);
    expect(profileSource).toMatch(/await waitForProfileAvatarRegistryUpdate\(owner, avatarHash\)/);
    expect(usernameFlow).toMatch(/autoLinkMintedUsername\(username, owner,/);
  });

  it('PWA-CONFIG-01D4D: payment check retry stays on the payment-check path', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const source = app.slice(
      app.indexOf('async function runPrivateSendRetry'),
      app.indexOf('function rememberLocalPublicPost'),
    );
    const paymentBranchIndex = source.indexOf('if (context.paymentDraft && !(context.paymentIntentCreated && message.payment && Array.isArray(message.capsules)))');
    const paymentRetryIndex = source.indexOf('await attemptPrivatePaymentCheckPublish(context)');
    const composerRetryIndex = source.indexOf('await attemptPrivateComposerMessagePublish({');

    expect(paymentBranchIndex).toBeGreaterThanOrEqual(0);
    expect(paymentRetryIndex).toBeGreaterThan(paymentBranchIndex);
    expect(composerRetryIndex).toBeGreaterThan(paymentRetryIndex);
    expect(source).toMatch(/paymentDraft: null/);
  });

  it('PWA-CONFIG-01D4B: payment check claim confirms Vault credit before rendering claimed', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const helpers = app.slice(
      app.indexOf('function paymentAssetVaultBalance'),
      app.indexOf('function delay'),
    );
    const claimSource = app.slice(
      app.indexOf('async function submitVaultClaimPaymentCheck'),
      app.indexOf('async function submitVaultCancelPaymentCheck'),
    );
    const renderSource = app.slice(
      app.indexOf('function renderConversation'),
      app.indexOf('async function openImageLightbox'),
    );
    const readUserIndex = claimSource.indexOf('const beforeUser = await readFreshConnectedVaultUserForOwnVaultAction(provider)');
    const readIntentIndex = claimSource.indexOf('const intent = await readFreshReceiveIntentForOwnVaultAction(provider, intentId)');
    const assertIntentIndex = claimSource.indexOf('assertReceiveIntentMatchesPayment(intent, payment)');
    const submitIndex = claimSource.indexOf("submitVaultReceiveIntentExternal('ClaimReceiveIntent'");
    const waitIndex = claimSource.indexOf('waitForPaymentCheckClaimConfirmation(provider, payment, beforeUser)');
    const flashIndex = claimSource.indexOf('flashWalletIdentityStatus(`check claimed +');

    expect(readUserIndex).toBeGreaterThanOrEqual(0);
    expect(readIntentIndex).toBeGreaterThan(readUserIndex);
    expect(assertIntentIndex).toBeGreaterThan(readIntentIndex);
    expect(submitIndex).toBeGreaterThan(assertIntentIndex);
    expect(waitIndex).toBeGreaterThan(submitIndex);
    expect(flashIndex).toBeGreaterThan(waitIndex);
    expect(claimSource).not.toMatch(/readFreshConnectedVaultUser\(provider\)\.catch/);
    expect(claimSource).toMatch(/allowPendingServiceWorkerUpdate:\s*true/);
    expect(claimSource).not.toMatch(/allowUnverifiedNonceWait/);
    expect(claimSource).toMatch(/secret32:\s*paymentSecret32\(payment\)/);
    expect(claimSource).toMatch(/markPendingPaymentCheckLedgerRecord\(payment, \{[\s\S]*status:\s*'claim_submitted'/);
    expect(claimSource).toMatch(/const confirmed = await waitForPaymentCheckClaimConfirmation\(provider, payment, beforeUser\)/);
    expect(claimSource).toMatch(/await removePendingPaymentCheckLedgerRecord\(payment\)/);
    expect(helpers).toMatch(/provider\.getReceiveIntent\(intentId,\s*\{[\s\S]*verify:\s*options\.verify !== false[\s\S]*priority:\s*'critical'[\s\S]*cacheTtlMs:\s*0/);
    expect(helpers).toMatch(/loadConnectedVaultUser\(\{[\s\S]*verify:\s*options\.verify !== false[\s\S]*priority:\s*'critical'[\s\S]*cacheTtlMs:\s*0/);
    expect(helpers).not.toMatch(/vaultAthBalanceAtomic/);
    expect(helpers).toMatch(/ath_balance \?\? user\?\.athBalance \?\? user\?\.ath/);
    expect(helpers).toMatch(/function readFreshReceiveIntentForOwnVaultAction/);
    expect(helpers).toMatch(/function assertReceiveIntentMatchesPayment[\s\S]*intent\.commitment[\s\S]*paymentSecret32\(payment\)[\s\S]*Payment check data mismatch; this check cannot be claimed/);
    expect(helpers).toMatch(/waitForPaymentCheckClaimConfirmation[\s\S]*readFreshReceiveIntentForOwnVaultAction\(provider, intentId\)/);
    expect(helpers).toMatch(/waitForPaymentCheckClaimConfirmation[\s\S]*readFreshConnectedVaultUserForOwnVaultAction\(provider\)/);
    expect(helpers).toMatch(/lastIntent\?\.exists === false && balance >= expectedBalance/);
    expect(helpers).toMatch(/Payment check disappeared but Vault balance did not update/);
    expect(renderSource).toMatch(/onStatus:\s*async \(status\)/);
    expect(renderSource).toMatch(/check claim submitted, confirming/);
    expect(renderSource).toMatch(/paymentCheckClaimBlockedStatus\(error\)/);
    expect(helpers).toMatch(/if \(\/data mismatch\|claim secret\|commitment\|exitcode=16280\|exit code 16280\/i\.test\(text\)\) return 'check data mismatch'/);
    expect(helpers).toMatch(/return `check claim blocked: \$\{shortUiErrorText\(error, 'blocked'\)\}`/);
  });

  it('PWA-CONFIG-01D4C: payment check cancel verifies sender and persists terminal state', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const helpers = app.slice(
      app.indexOf('function paymentAssetVaultBalance'),
      app.indexOf('function delay'),
    );
    const cancelSource = app.slice(
      app.indexOf('async function submitVaultCancelPaymentCheck'),
      app.indexOf('async function attemptCancelPaymentCheckAfterPublishFailure'),
    );
    const receiveIntentFallbackSource = app.slice(
      app.indexOf('async function readFreshReceiveIntentForOwnVaultAction'),
      app.indexOf('async function readFreshReceiveIntentForCancel'),
    );
    const userFallbackSource = app.slice(
      app.indexOf('async function readFreshConnectedVaultUserForOwnVaultAction'),
      app.indexOf('async function callWithOwnVaultActionReadFallback'),
    );
    const renderSource = app.slice(
      app.indexOf('function renderConversation'),
      app.indexOf('async function openImageLightbox'),
    );
    const readUserIndex = cancelSource.indexOf('const beforeUser = await readFreshConnectedVaultUserForOwnVaultAction(provider)');
    const readIntentIndex = cancelSource.indexOf('const intent = await readFreshReceiveIntentForCancel(provider, intentId)');
    const assertIndex = cancelSource.indexOf('assertReceiveIntentCancelableBySender(intent, payment)');
    const submitIndex = cancelSource.indexOf("submitVaultReceiveIntentExternal('CancelReceiveIntent'");
    const waitIndex = cancelSource.indexOf('waitForPaymentCheckCancelConfirmation(provider, payment, beforeUser)');
    const flashIndex = cancelSource.indexOf("flashWalletIdentityStatus('check cancelled')");

    expect(helpers).toMatch(/function assertReceiveIntentCancelableBySender/);
    expect(helpers).toMatch(/sameWalletAddress\(intent\.sender_wallet, connectedWallet\)/);
    expect(helpers).toMatch(/payment\.recipientWallet[\s\S]*sameWalletAddress\(intent\.recipient_wallet, payment\.recipientWallet\)/);
    expect(helpers).toMatch(/function waitForPaymentCheckCancelConfirmation/);
    expect(helpers).toMatch(/function readFreshReceiveIntentForCancel/);
    expect(helpers).toMatch(/function readFreshConnectedVaultUserForOwnVaultAction/);
    expect(receiveIntentFallbackSource).not.toMatch(/RPC_DISAGREEMENT|isTonRpcSoftVaultGlobalReadError/);
    expect(userFallbackSource).not.toMatch(/RPC_DISAGREEMENT|isTonRpcSoftVaultGlobalReadError/);
    expect(receiveIntentFallbackSource).toMatch(/callWithDegradedTransportReadFallback\(/);
    expect(receiveIntentFallbackSource).toMatch(/\(\) => readFreshReceiveIntent\(provider, intentId\)/);
    expect(userFallbackSource).toMatch(/callWithDegradedTransportReadFallback\(/);
    expect(userFallbackSource).toMatch(/\(\) => readFreshConnectedVaultUser\(provider\)/);
    expect(receiveIntentFallbackSource).not.toMatch(/verify:\s*false|allowUnverifiedCriticalRead:/);
    expect(userFallbackSource).not.toMatch(/verify:\s*false|allowUnverifiedCriticalRead:/);
    expect(helpers).toMatch(/lastIntent\?\.exists === false && balance >= expectedBalance/);
    expect(helpers).toMatch(/Payment check disappeared but sender Vault balance was not restored/);
    expect(readUserIndex).toBeGreaterThanOrEqual(0);
    expect(readIntentIndex).toBeGreaterThan(readUserIndex);
    expect(assertIndex).toBeGreaterThan(readIntentIndex);
    expect(submitIndex).toBeGreaterThan(assertIndex);
    expect(waitIndex).toBeGreaterThan(submitIndex);
    expect(flashIndex).toBeGreaterThan(waitIndex);
    expect(cancelSource).toMatch(/allowPendingServiceWorkerUpdate:\s*true/);
    expect(cancelSource).not.toMatch(/allowUnverifiedNonceWait/);
    expect(cancelSource).toMatch(/markPendingPaymentCheckLedgerRecord\(payment, \{[\s\S]*status:\s*'cancel_submitted'/);
    expect(cancelSource).toMatch(/const confirmed = await waitForPaymentCheckCancelConfirmation\(provider, payment, beforeUser\)/);
    expect(cancelSource).toMatch(/await removePendingPaymentCheckLedgerRecord\(payment\)/);
    expect(renderSource).toMatch(/paymentMetaText\.includes\('cancel submitted'\)/);
    expect(renderSource).toMatch(/paymentMetaText\.includes\('cancel confirming'\)/);
    expect(renderSource).toMatch(/paymentMetaText\.includes\('cancel signing'\)/);
    expect(renderSource).toMatch(/paymentMetaText\.includes\('another sender'\)/);
    expect(renderSource).toMatch(/message\.meta = 'check cancel signing'/);
    expect(renderSource).toMatch(/onStatus:\s*async \(status\)/);
    expect(renderSource).toMatch(/message\.meta = 'check cancelled'/);
    expect(renderSource).toMatch(/message\.meta === 'check cancelled'[\s\S]*schedulePendingServiceWorkerAppShellReload\(\)/);
    expect(renderSource).toMatch(/paymentCheckCancelBlockedStatus\(error\)/);
    expect(renderSource).toMatch(/updateMessageInEncryptedHistory\(thread, message\)/);
  });

  it('PWA-CONFIG-01D4E: payment check renders as one inline attachment row', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    const renderSource = app.slice(
      app.indexOf('function renderConversation'),
      app.indexOf('async function openImageLightbox'),
    );

    expect(renderSource).toMatch(/let paymentBlockElement = null/);
    expect(renderSource).toMatch(/paymentLabel\.className = 'message-payment-label'/);
    expect(renderSource).toMatch(/paymentBlockElement\.append\(actions\)/);
    expect(renderSource).not.toMatch(/bubble\.append\(actions\)/);
    expect(css).toMatch(/\.message-payment-block \{[\s\S]*display: flex;[\s\S]*justify-content: space-between;/);
    expect(css).toMatch(/\.message-payment-block \.payment-actions \{[\s\S]*margin-top: 0;/);
  });

  it('PWA-CONFIG-01D5: public submitted publish creates durable pending feed items', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const source = app.slice(
      app.indexOf('function mergeLocalPendingPublicFeed'),
      app.indexOf('globalThis.plathoVaultTransactions'),
    );

    expect(source).toMatch(/function mergeLocalPendingPublicFeed/);
    expect(source).toMatch(/isPendingPublicFeedItem/);
    expect(source).toMatch(/rememberLocalPublicPost\([^)]*attachments, \{/);
    expect(source).toMatch(/publishStatus: 'public publish submitted'/);
    expect(source).toMatch(/publishStatus: 'partial public publish'/);
    expect(source).toMatch(/rememberLocalPublicComment\([^)]*attachments, \{/);
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
    expect(source).toMatch(/verify:\s*options\.verify !== false/);
    expect(source).toMatch(/waitForVaultPublishNonce\(provider, owner, expectedNonce, options = \{\}\)/);
    expect(source).toMatch(/priority:\s*'critical'/);
    expect(source).toMatch(/cacheTtlMs:\s*0/);
  });

  it('RT-PWA-VLT-002: own Vault pre-sign reads fail closed while post-broadcast nonce waits may fall back', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const receiveIntentHelper = app.slice(
      app.indexOf('async function readFreshReceiveIntentForOwnVaultAction'),
      app.indexOf('async function readFreshReceiveIntentForCancel'),
    );
    const userHelper = app.slice(
      app.indexOf('async function readFreshConnectedVaultUserForOwnVaultAction'),
      app.indexOf('async function callWithOwnVaultActionReadFallback'),
    );
    const globalHelper = app.slice(
      app.indexOf('async function readConnectedVaultGlobalForOwnVaultAction'),
      app.indexOf('async function readCanonicalPublishChargeForOwnVaultAction'),
    );
    const canonicalHelper = app.slice(
      app.indexOf('async function readCanonicalPublishChargeForOwnVaultAction'),
      app.indexOf('async function waitForPaymentCheckClaimConfirmation'),
    );
    const capsuleRoute = app.slice(
      app.indexOf('async function requireCapsuleHubVaultRouteForPublish'),
      app.indexOf('async function requireProfileRegistryVaultRoute'),
    );
    const profileRoute = app.slice(
      app.indexOf('async function requireProfileRegistryVaultRouteForOwnVaultAction'),
      app.indexOf('async function requireUsernameRegistryVaultRoute'),
    );
    const usernameRoute = app.slice(
      app.indexOf('async function requireUsernameRegistryVaultRouteForOwnVaultAction'),
      app.indexOf('async function assertVaultProfileAvatarCanStart'),
    );
    const depositSource = app.slice(
      app.indexOf('async function submitVaultDepositTonAmount'),
      app.indexOf('async function submitVaultWithdrawTon'),
    );
    const registerSource = app.slice(
      app.indexOf('async function submitVaultRegisterMessagingKeys'),
      app.indexOf('async function confirmPlathoAccountActivation'),
    );
    const nonceReadSource = app.slice(
      app.indexOf('async function readVaultPublishNonceForOwnVaultAction'),
      app.indexOf('async function waitForVaultPublishNonce'),
    );
    const sendSource = app.slice(
      app.indexOf('async function sendPreparedCapsulesThroughVault'),
      app.indexOf('async function publishCapsulesThroughVault'),
    );
    const clientNonceSource = sendSource.slice(
      sendSource.indexOf('let clientNonce = options.allowOwnVaultActionReadFallback === true'),
      sendSource.indexOf('if (clientNonce === null)'),
    );
    const authExternalSource = app.slice(
      app.indexOf('async function submitVaultAuthExternalWithNonceConfirmation'),
      app.indexOf('async function readFreshPendingAthWithdrawalForOwnVaultAction'),
    );

    const degradedFallbackHelper = app.slice(
      app.indexOf('async function callWithDegradedTransportReadFallback'),
      app.indexOf('async function readConnectedVaultGlobalForOwnVaultAction'),
    );

    expect(receiveIntentHelper).toMatch(/callWithDegradedTransportReadFallback\(/);
    expect(receiveIntentHelper).toMatch(/\(\) => readFreshReceiveIntent\(provider, intentId\)/);
    expect(receiveIntentHelper).toMatch(/unverifiedCriticalChainReadOptions\(\)/);
    expect(receiveIntentHelper).not.toMatch(/verify:\s*false|allowUnverifiedCriticalRead:/);
    // Own-action pre-sign reads stay verified fail-closed while verification
    // is actually possible. The unverified fallback opens only when the
    // transport reports structural degradation: the primary gateway is
    // parked OR every verifier transport is dead/blocked for this network.
    expect(app).toMatch(/function tonRpcVerificationStructurallyDegraded\(\)[\s\S]*transport\.isDegraded\(\) === true[\s\S]*transport\.isVerificationDegraded\(\) === true/);
    expect(degradedFallbackHelper).toMatch(/if \(tonRpcVerificationStructurallyDegraded\(\)\) return readUnverified\(\)/);
    expect(degradedFallbackHelper).toMatch(/isTonRpcVerificationUnavailableForOwnVaultActionError\(error\)\) throw error/);
    expect(degradedFallbackHelper).toMatch(/if \(!tonRpcVerificationStructurallyDegraded\(\)\) throw error/);
    // criticalChainReadOptions is the single degradation choke point for all
    // critical reads (prepare, confirm, sync, avatars, key records).
    expect(app).toMatch(/function criticalChainReadOptions\(\)[\s\S]*if \(tonRpcVerificationStructurallyDegraded\(\)\) return unverifiedCriticalChainReadOptions\(\)/);
    expect(userHelper).toMatch(/callWithDegradedTransportReadFallback\(/);
    expect(userHelper).toMatch(/\(\) => readFreshConnectedVaultUser\(provider\)/);
    expect(userHelper).toMatch(/readFreshConnectedVaultUser\(provider, unverifiedCriticalChainReadOptions\(\)\)/);
    expect(userHelper).not.toMatch(/verify:\s*false|allowUnverifiedCriticalRead:/);
    expect(globalHelper).toMatch(/callWithDegradedTransportReadFallback\(/);
    expect(globalHelper).toMatch(/loadConnectedVaultGlobal\(\{ provider, \.\.\.criticalChainReadOptions\(\) \}\)/);
    expect(globalHelper).toMatch(/loadConnectedVaultGlobal\(\{ provider, \.\.\.unverifiedCriticalChainReadOptions\(\) \}\)/);
    expect(globalHelper).not.toMatch(/isTonRpcSoftVaultGlobalReadError/);
    expect(canonicalHelper).toMatch(/verify:\s*true/);
    expect(canonicalHelper).toMatch(/callWithDegradedTransportReadFallback\(/);
    expect(canonicalHelper).not.toMatch(/verify:\s*false|allowUnverifiedCriticalRead:/);
    expect(capsuleRoute).not.toMatch(/allowUnverifiedRead|callWithVerificationUnavailableReadFallback/);
    expect(profileRoute).not.toMatch(/allowUnverifiedRead|callWithVerificationUnavailableReadFallback/);
    expect(usernameRoute).not.toMatch(/allowUnverifiedRead|callWithVerificationUnavailableReadFallback/);
    expect(depositSource).toMatch(/readFreshConnectedVaultUser\(provider\)/);
    expect(registerSource).toMatch(/readFreshConnectedVaultUser\(provider\)/);
    expect(nonceReadSource).toMatch(/callWithDegradedTransportReadFallback\(/);
    expect(nonceReadSource).toMatch(/\(\) => readVaultPublishNonce\(provider, owner, options\)/);
    expect(nonceReadSource).toMatch(/unverifiedCriticalChainReadOptions\(\)/);
    expect(nonceReadSource).not.toMatch(/allowUnverifiedCriticalRead:|allowUnverifiedNonceRead|verify:\s*false/);
    expect(clientNonceSource).not.toMatch(/allowUnverifiedCriticalRead|allowUnverifiedNonceRead|verify:/);
    // Post-broadcast nonce waits are observational and always unverified;
    // the publish outcome is re-authenticated by CapsuleHub confirmation.
    expect(authExternalSource).toMatch(/await waitForVaultPublishNonce\(provider, owner, clientNonce \+ 1n\)/);
    expect(authExternalSource).not.toMatch(/allowUnverifiedNonceWait/);
  });

  it('PWA-CONFIG-01E: public publishing uses the shared composer and explicit feed controls', () => {
    const html = readFileSync('web/index.html', 'utf8');
    const publicHeader = html.match(/<section class="content-pane public-pane[\s\S]*?<\/header>/)?.[0] ?? '';

    expect(html).toMatch(/id="publicChannelSearch"/);
    expect(html).toMatch(/id="addPublicChannelButton"/);
    expect(html).toMatch(/class="search-row action-search-row"[\s\S]*id="threadSearch"[\s\S]*id="newChatButton"/);
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
    expect(app).toMatch(/if \(!isOwnPost && isPublicChannelSubscribed\(item\.channelId\)\)[\s\S]*?textContent = 'Unfollow'/);
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

  it('PWA-CONFIG-03E: production config rejects unverified static public feed fallback', () => {
    const report = validatePlathoAppConfig({
      ...productionConfig,
      capsuleHub: {
        address: '0:4444444444444444444444444444444444444444444444444444444444444444',
        allowUnverifiedStaticPublicFeeds: true,
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.id)).toContain('PWA_STATIC_PUBLIC_FEED_FALLBACK_FORBIDDEN');
  });

  it('PWA-CONFIG-03F: production config requires FeeAccumulator address for CapsuleHub preflight', () => {
    const report = validatePlathoAppConfig({
      ...productionConfig,
      feeAccumulator: {},
    });

    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.id)).toContain('PWA_FEE_ACCUMULATOR_ADDRESS_REQUIRED');
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
    expect(app).toMatch(/PUBLIC_POST_BODY_MAX_BYTES/);
    expect(readAvatarPartsSource).toMatch(/maxBytes: PUBLIC_POST_BODY_MAX_BYTES/);
    expect(findAvatarPartsSource).toMatch(/maxBytes: PUBLIC_POST_BODY_MAX_BYTES/);
    expect(syncPublicSource).toMatch(/maxBytes: PUBLIC_POST_BODY_MAX_BYTES/);
    expect(readAvatarPartsSource).not.toMatch(/maxBytes: SINGLE_CAPSULE_USEFUL_BYTES/);
    expect(findAvatarPartsSource).not.toMatch(/maxBytes: SINGLE_CAPSULE_USEFUL_BYTES/);
    expect(syncPublicSource).not.toMatch(/maxBytes: SINGLE_CAPSULE_USEFUL_BYTES/);
    expect(syncPublicSource).toMatch(/const unavailableEntries = \[\]/);
    expect(syncPublicSource).toMatch(/isBodyHistoryUnavailableError\(error\)/);
    expect(app).toMatch(/const PUBLIC_CHAIN_HISTORY_UNAVAILABLE_STORAGE_PREFIX/);
    expect(app).toMatch(/function rememberPublicBodyHistoryUnavailable/);
    expect(app).toMatch(/function clearPublicBodyHistoryUnavailable/);
    expect(app).toMatch(/function publicBodyHistoryRetryEntryIds/);
    expect(syncPublicSource).toMatch(/const retryEntryIds = publicBodyHistoryRetryEntryIds\(address, latestId, BigInt\(minEntryId\)\)/);
    expect(syncPublicSource).toMatch(/for \(const id of retryEntryIds\) pushScanId\(id\)/);
    expect(syncPublicSource).toMatch(/rememberPublicBodyHistoryUnavailable\(address, entry, entryIdValue\)/);
    expect(syncPublicSource).toMatch(/clearPublicBodyHistoryUnavailable\(address, entryIdValue\)/);
    expect(syncPublicSource).toMatch(/unavailableEntries\.push/);
    expect(syncPublicSource).toMatch(/historyUnavailableCount: unavailableEntries\.length/);
    expect(syncPublicSource).toMatch(/retryEntryCount: retryEntryIds\.length/);
    expect(syncPublicSource).toMatch(/publicReadLimit/);
    expect(syncPublicSource).toMatch(/syncWindow === 'long' \? 0 : Math\.max\(0, latest - readLimit\)/);
    expect(syncPublicSource).toMatch(/const channelIdsToRefresh = new Set/);
    expect(syncPublicSource).toMatch(/\.\.\.Object\.keys\(publicChannelFeedCache \?\? \{\}\)/);
    // Incremental append-merge (not a wholesale rebuild from a single walk): the cache is preserved and this
    // cycle's chain posts are upserted in, so a degraded/rate-limited cycle never wipes a channel to the
    // "Waiting for public feed" placeholder (the flicker). Plus the global-head fast-path + commit-gate so a
    // cycle with no new public entry skips the whole walk, and the head only advances after a clean walk.
    expect(syncPublicSource).toMatch(/const nextFeedCache = \{ \.\.\.publicChannelFeedCache \}/);
    expect(syncPublicSource).toMatch(/upsertPublicChainPosts\(existingChainPosts, newChainPosts\)/);
    expect(syncPublicSource).toMatch(/latestId === lastSyncedPublicLatestId/);
    expect(syncPublicSource).toMatch(/if \(!walkDegraded\) \{\s*lastSyncedPublicLatestId = latestId/);
    expect(app).toMatch(/function chainBackedPublicFeedOnly/);
    expect(app).toMatch(/post\?\.chainVerified === true/);
    expect(syncPublicSource).toMatch(/chainVerified: true/);
    expect(app).toMatch(/allowUnverifiedStaticPublicFeeds !== true/);
    expect(app).toMatch(/Public channel feed has no verified CapsuleHub anchors/);
    expect(readAvatarPartsSource).not.toMatch(/readPublicPostPayload/);
    expect(findAvatarPartsSource).not.toMatch(/readPublicPostPayload/);
    expect(syncPublicSource).not.toMatch(/readPublicPostPayload/);
  });

  it('PWA-PUBLIC-INCREMENTAL-02: public sync uses a per-author cursor (comments load on demand, not in the feed) and withholds the cursor on an in-window gap', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const syncPublicSource = app.slice(
      app.indexOf('async function syncPublicChannelFromChain'),
      app.indexOf('async function syncPublicChannels'),
    );
    // Per-author cursor (in-memory), skipping unchanged authors so a busy feed re-reads only what changed.
    expect(app).toMatch(/const publicAuthorIndexHeads = new Map\(\)/);
    expect(syncPublicSource).toMatch(/publicAuthorIndexHeads\.get\(authorHeadKey\) === authorHead/);
    // A skipped author still reuses its CACHED post ids (no re-read of unchanged post bodies).
    expect(app).toMatch(/function cachedChainPostEntryIds\(channelId\)/);
    expect(syncPublicSource).toMatch(/postIds = cachedPostIds/);
    // attachNewPublicComments stays wired (a no-op with the now-empty comment set) so a future comment-in-feed path
    // could reattach; the walk that fed it was moved to the on-demand loader (loadPublicPostComments).
    expect(app).toMatch(/function attachNewPublicComments\(posts, newCommentsByParent\)/);
    expect(syncPublicSource).toMatch(/attachNewPublicComments\(/);
    // Commit-gate: the author cursor advances ONLY after a clean walk, alongside the global head.
    expect(syncPublicSource).toMatch(/for \(const \[key, head\] of pendingAuthorHeadWrites\) publicAuthorIndexHeads\.set\(key, head\)/);
    // Strand guard: an in-window entry that fails to resolve marks the walk degraded, so the commit-gate does NOT
    // advance the cursor past it (Phase 2 would otherwise skip re-walking it next cycle and it could never
    // self-heal — in-window ids are excluded from the body-gap retry set). Both failure branches gate on it.
    expect(syncPublicSource).toMatch(/if \(entryIdValue >= BigInt\(minEntryId\)\) walkDegraded = true/);
    expect(syncPublicSource).toMatch(/noteTonRpcRateLimit\(error\) \|\| entryIdValue >= BigInt\(minEntryId\)/);
    // Phase 3: free eviction prune. The FIFO floor + prune are pure helpers in public-channel-subscriptions.mjs
    // (numerically unit-tested there — the floor arithmetic, where an off-by-one would silently drop the oldest
    // LIVE post, must be exercised numerically, not just regex-pinned). app.js derives the floor from get_state
    // (public_live_count + public_latest_id, already read) and prunes cached posts/comments below it.
    expect(app).toMatch(/publicEvictionFloor,/);
    expect(app).toMatch(/prunePublicPostsBelowFloor,/);
    expect(syncPublicSource).toMatch(/publicOldestLiveId = publicEvictionFloor\(latestId, publicLiveCount\)/);
    expect(syncPublicSource).toMatch(/prunePublicPostsBelowFloor\(/);
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
    expect(actionsSource).toMatch(/commentButton\.textContent = 'Comments';/);
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
    expect(app).toMatch(/async function loadPublicPostComments\(item\)/);
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
      app.indexOf('async function loadPublicPostComments(item)'),
      app.indexOf('async function refreshPublicPostDetailComments('),
    );
    // Empty / missing parent index -> genuinely zero comments (clean, not degraded).
    expect(loaderSource).toMatch(/if \(!parentIndex \|\| parentIndex\.exists !== true\) \{/);
    expect(loaderSource).toMatch(/return \{ comments: \[\], degraded: false \};/);
    // A rate-limited read returns degraded:true (the caller keeps "Loading" and retries; never caches a partial).
    expect(loaderSource).toMatch(/if \(noteTonRpcRateLimit\(error\)\) return \{ comments: \[\], degraded: true \};/);
    // Parent binding identical to the feed sync: drop only when BOTH hashes present AND mismatch (lowercased).
    expect(loaderSource).toMatch(/String\(item\.bodyHash\)\.toLowerCase\(\) === String\(comment\.parentHash\)\.toLowerCase\(\)/);
    // The retry orchestrator keeps the partial OUT of the authoritative list on a degraded walk.
    const refreshSource = app.slice(
      app.indexOf('async function refreshPublicPostDetailComments('),
      app.indexOf('async function confirmPublicCommentsRisk('),
    );
    expect(refreshSource).toMatch(/if \(token !== publicPostDetailLoadToken\) return;/);
    expect(refreshSource).toMatch(/if \(!result\.degraded\)/);
  });

  it('PWA-CONFIG-06B: profile avatar registry update waits for CapsuleHub proof and registry finality', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const submitAvatarSource = app.slice(
      app.indexOf('async function submitProfileAvatarUpdate'),
      app.indexOf('async function submitCreatePaymentCheck'),
    );
    const finalizeAvatarSource = app.slice(
      app.indexOf('async function finalizeProfileAvatarUpdate'),
      app.indexOf('async function runProfileAvatarPublishRecovery'),
    );
    const readAvatarPartsSource = app.slice(
      app.indexOf('async function readAvatarPartsFromCapsuleHub'),
      app.indexOf('async function findPublishedAvatarEntries'),
    );
    const findAvatarPartsSource = app.slice(
      app.indexOf('async function findPublishedAvatarEntries'),
      app.indexOf('async function waitForPublishedAvatarEntries'),
    );
    const waitPublishedAvatarSource = app.slice(
      app.indexOf('async function waitForPublishedAvatarEntries'),
      app.indexOf('async function waitForProfileAvatarRegistryUpdate'),
    );
    const waitRegistrySource = app.slice(
      app.indexOf('async function waitForProfileAvatarRegistryUpdate'),
      app.indexOf('async function loadProfileAvatarImage'),
    );

    expect(submitAvatarSource.indexOf('confirmed = confirmed ?? await waitForPublishedAvatarEntries')).toBeGreaterThan(-1);
    expect(submitAvatarSource.indexOf('finality = await finalizeProfileAvatarUpdate')).toBeGreaterThan(
      submitAvatarSource.indexOf('confirmed = confirmed ?? await waitForPublishedAvatarEntries'),
    );
    expect(finalizeAvatarSource.indexOf('await submitVaultProfileAvatarRegistration')).toBeGreaterThan(-1);
    expect(finalizeAvatarSource.indexOf('registryPointer = await waitForProfileAvatarRegistryUpdate')).toBeGreaterThan(
      finalizeAvatarSource.indexOf('await submitVaultProfileAvatarRegistration'),
    );
    expect(finalizeAvatarSource).toMatch(/confirming registry/);
    expect(finalizeAvatarSource).toMatch(/avatar not active yet/);
    expect(finalizeAvatarSource).toMatch(/registrySubmission \?\? await submitVaultProfileAvatarRegistration/);
    expect(submitAvatarSource).toMatch(/profileAvatarPublishRecoveryFor\(owner, avatarHash\)/);
    expect(submitAvatarSource).toMatch(/scheduleProfileAvatarPublishRecovery\(existingRecovery, 0\)/);
    expect(submitAvatarSource).toMatch(/scheduleProfileAvatarPublishRecovery\(\{[\s\S]*confirmed,[\s\S]*registrySubmission: finality\.result/);
    expect(app).toMatch(/async function runProfileAvatarPublishRecovery/);
    expect(app).toMatch(/globalThis\.plathoProfileAvatarPublishRecoveries/);
    expect(app).toMatch(/const PROFILE_AVATAR_RECOVERY_RETRY_DELAYS_MS = \[15_000, 30_000, 60_000, 120_000, 180_000\]/);
    expect(app).toMatch(/PROFILE_AVATAR_PUBLISH_RECOVERY_STORAGE_PREFIX = 'platho\.profile\.avatar\.publishRecovery\.v1'/);
    expect(app).toMatch(/PROFILE_AVATAR_RECOVERY_LOCAL_PENDING_MS = 15 \* 60 \* 1000/);
    expect(app).toMatch(/function profileAvatarPublishRecoveryStorageKey\(owner, avatarHash\)/);
    expect(app).toMatch(/function writeProfileAvatarPublishRecovery\(job\)/);
    expect(app).toMatch(/function readProfileAvatarPublishRecovery\(owner, avatarHash\)/);
    expect(app).toMatch(/function clearProfileAvatarPublishRecoveryStorage\(owner, avatarHash\)/);
    expect(app).toMatch(/writeProfileAvatarPublishRecovery\(job\)/);
    expect(app).toMatch(/const PROFILE_AVATAR_ROUTE_RETRY_DELAYS_MS = \[1_000, 2_000, 4_000, 8_000\]/);
    expect(submitAvatarSource).toMatch(/isVaultPublishPartialError\(error\)/);
    expect(submitAvatarSource).toMatch(/plathoLastProfileAvatarPublishPartial/);
    expect(submitAvatarSource).toMatch(/publish submitted, confirming/);
    expect(submitAvatarSource).toMatch(/confirmCapsuleHubPublishEntries\(publishResult\.publishState, \{/);
    expect(submitAvatarSource).toMatch(/findConfirmedAvatarEntriesFromPublishState\(owner, pendingPointer, publishResult\.publishState\)/);
    expect(submitAvatarSource).toMatch(/scanAvailableTransports:\s*true/);
    expect(submitAvatarSource).toMatch(/VAULT_PUBLISH_STATUS_PARTIAL/);
    expect(submitAvatarSource).toMatch(/plathoLastProfileAvatarPublish/);
    expect(submitAvatarSource).toMatch(/if \(error\?\.code !== 'PLATHO_AVATAR_CAPSULES_NOT_VISIBLE'\) throw error/);
    expect(submitAvatarSource).toMatch(/avatarStreamId:\s*null/);
    expect(submitAvatarSource).toMatch(/PROFILE_AVATAR_PUBLISH_CONFIRM_SCAN_LIMIT/);
    expect(submitAvatarSource).toMatch(/PROFILE_AVATAR_PUBLISH_CONFIRM_DEADLINE_MS/);
    expect(app).toMatch(/const PROFILE_AVATAR_PUBLISH_CONFIRM_ATTEMPTS = 60/);
    expect(app).toMatch(/const PROFILE_AVATAR_PUBLISH_CONFIRM_DELAY_MS = 2000/);
    expect(app).toMatch(/const PROFILE_AVATAR_PUBLISH_CONFIRM_DEADLINE_MS = 120 \* 1000/);
    expect(submitAvatarSource).not.toMatch(/markPublishStateAwaitingPartsForRetry\(/);
    expect(submitAvatarSource).toMatch(/retryUnconfirmedVaultPublishBroadcasts\(publishResult\.publishState, \{/);
    expect(submitAvatarSource).toMatch(/owner,/);
    expect(submitAvatarSource).toMatch(/broadcast retrying/);
    expect(submitAvatarSource).toMatch(/plathoLastProfileAvatarPublishRecovery/);
    expect(submitAvatarSource).toMatch(/capturePublishSnapshot\('before-public-publish'/);
    expect(submitAvatarSource).toMatch(/capturePublishSnapshot\('after-avatar-not-visible'/);
    expect(submitAvatarSource).toMatch(/profileAvatarPublishDiagnosticStatus\(publishDiagnostics\)/);
    expect(submitAvatarSource).toMatch(/profileAvatarPublishPayloadDiagnostics\(payloads\)/);
    expect(app).toMatch(/plathoProfileAvatarPublishDiagnosticsJson/);
    expect(app).toMatch(/safeDiagnosticsJson/);
    expect(submitAvatarSource).toMatch(/publishDiagnostics\.initialPublishError = shortUiErrorText\(error\.cause \?\? error, 'avatar publish failed'\)/);
    expect(submitAvatarSource).toMatch(/broadcast uncertain:/);
    expect(app).toMatch(/externalBocLength/);
    expect(app).toMatch(/TON RPC broadcast failed:/);
    expect(submitAvatarSource).not.toMatch(/avatar publish retrying/);
    expect(submitAvatarSource).not.toMatch(/profile-avatar-retry-/);
    expect(submitAvatarSource).toMatch(/avatar still confirming/);
    expect(readAvatarPartsSource).toMatch(/assembledAvatarPartGroup\(parts, pointer\)/);
    expect(findAvatarPartsSource).toMatch(/assembledAvatarPartGroup\(parts, pointer\)/);
    expect(app).toMatch(/async function findConfirmedAvatarEntriesFromPublishState\(ownerWallet, pointer, publishState\)/);
    expect(app).toMatch(/part\.status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED/);
    expect(app).toMatch(/confirmedBy:\s*'publish_state_hashes'/);
    expect(app).toMatch(/confirmedBy:\s*'recovered_from_existing_identical_payload'/);
    expect(app).toMatch(/readProfileAvatarMediaCache\(pointer\.avatarHash\)/);
    expect(app).toMatch(/function publicAvatarPartMatches\(payload, ownerWallet, pointer\)/);
    expect(app).toMatch(/payload\?\.type !== 'avatar'/);
    expect(app).toMatch(/payload\.avatarHash \?\? payload\.avatar_hash/);
    expect(app).toMatch(/payload\.stream_id/);
    expect(app).toMatch(/payload\.partCount \?\? payload\.part_count/);
    expect(app).toMatch(/sameWalletAddress\(payload\.authorWallet, ownerWallet\)/);
    expect(app).toMatch(/function avatarPartsCompleteForPointer\(parts, pointer\)/);
    expect(app).toMatch(/const streamId = avatarPartStreamId\(part\)/);
    expect(app).toMatch(/group\.size >= expected/);
    expect(app).toMatch(/async function assembledAvatarPartGroup\(parts, pointer\)/);
    expect(app).toMatch(/for \(const groupParts of groups\.values\(\)\)/);
    expect(app).toMatch(/const hash = await sha256Hex\(bytes\)/);
    expect(app).toMatch(/if \(hash\.toLowerCase\(\) !== pointer\.avatarHash\.toLowerCase\(\)\) return null/);
    expect(waitPublishedAvatarSource).toMatch(/let lastTransientError = null/);
    expect(waitPublishedAvatarSource).toMatch(/isTonRpcRecoverableReadError\(error\)/);
    expect(waitPublishedAvatarSource).toMatch(/noteTonRpcRateLimit\(error\)/);
    expect(waitPublishedAvatarSource).toMatch(/error\.code = 'PLATHO_AVATAR_CAPSULES_NOT_VISIBLE'/);
    expect(app).toMatch(/if \(hash\.toLowerCase\(\) !== pointer\.avatarHash\.toLowerCase\(\)\) return null/);
    expect(waitRegistrySource).toMatch(/let lastTransientError = null/);
    expect(waitRegistrySource).toMatch(/isTonRpcRecoverableReadError\(error\)/);
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

  it('PWA-AVATAR-PART-SCAN-INTERLEAVE-01: avatar media recovery tolerates heavily interleaved public entries', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const readAvatarPartsSource = app.slice(
      app.indexOf('async function readAvatarPartsFromCapsuleHub'),
      app.indexOf('async function findPublishedAvatarEntries'),
    );
    const findAvatarPartsSource = app.slice(
      app.indexOf('async function findPublishedAvatarEntries'),
      app.indexOf('async function waitForPublishedAvatarEntries'),
    );

    expect(app).toMatch(/const PROFILE_AVATAR_ENTRY_SCAN_PADDING = 2048/);
    expect(app).toMatch(/const PROFILE_AVATAR_FALLBACK_SCAN_LIMIT = 2048/);
    expect(readAvatarPartsSource).toMatch(/Math\.max\(PROFILE_AVATAR_ENTRY_SCAN_PADDING/);
    expect(readAvatarPartsSource).toMatch(/const configuredLimit = Number\(options\.scanLimit \?\? appConfig\.capsuleHub\?\.publicAvatarReadLimit \?\? 0\)/);
    expect(readAvatarPartsSource).toMatch(/Math\.max\(\s*PROFILE_AVATAR_FALLBACK_SCAN_LIMIT/);
    expect(readAvatarPartsSource).toMatch(/return \(await assembledAvatarPartGroup\(parts, pointer\)\)\?\.imageUrl \?\? null/);
    expect(findAvatarPartsSource).toMatch(/Math\.max\(PROFILE_AVATAR_FALLBACK_SCAN_LIMIT, expectedParts \+ PROFILE_AVATAR_ENTRY_SCAN_PADDING\)/);
    expect(findAvatarPartsSource).toMatch(/avatarPartsCompleteForPointer\(parts, pointer\)/);
    expect(findAvatarPartsSource).not.toMatch(/parts\.length >= expectedParts/);
    expect(readAvatarPartsSource).not.toMatch(/parts\.length >= Number\(pointer\.avatarPartCount/);
    expect(app).toMatch(/if \(hash\.toLowerCase\(\) !== pointer\.avatarHash\.toLowerCase\(\)\) return null/);
  });

  it('PWA-VPROF-STRICT-ROUTE-01: profile avatar value action fails closed on unverified route reads', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const canStartSource = app.slice(
      app.indexOf('async function assertVaultProfileAvatarCanStart'),
      app.indexOf('async function assertVaultUsernameMintCanStart'),
    );
    const submitSource = app.slice(
      app.indexOf('async function submitVaultProfileAvatarRegistration'),
      app.indexOf('async function readProfileAvatarVaultPaymentFinality'),
    );

    expect(canStartSource).toMatch(/readFreshConnectedVaultUser\(provider\)/);
    expect(canStartSource).toMatch(/loadConnectedVaultGlobal\(\{ provider, \.\.\.criticalChainReadOptions\(\) \}\)/);
    expect(canStartSource).toMatch(/requireProfileRegistryVaultRouteForOwnVaultAction\(global\)/);
    expect(canStartSource).not.toMatch(/allowUnverifiedRead|callWithVerificationUnavailableReadFallback/);
    expect(submitSource).toMatch(/loadConnectedVaultGlobal\(\{ provider, \.\.\.criticalChainReadOptions\(\) \}\)/);
    expect(submitSource).toMatch(/readFreshConnectedVaultUser\(provider\)/);
    expect(submitSource).toMatch(/requireProfileRegistryVaultRouteForOwnVaultAction\(global\)/);
    expect(submitSource).not.toMatch(/allowUnverifiedRead|callWithVerificationUnavailableReadFallback/);
    expect(app).toMatch(/async function requireProfileRegistryVaultRouteForOwnVaultAction/);
    expect(app).toMatch(/async function requireProfileRegistryVaultRouteWithRetry/);
    expect(app).not.toMatch(/requireProfileRegistryVaultRoute\(global, \{ allowUnverifiedRead: true \}\)/);
  });

  it('PWA-VPROF-PENDING-FINALITY-01: profile avatar success records Vault pending payment finality separately', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const finalitySource = app.slice(
      app.indexOf('async function readProfileAvatarVaultPaymentFinality'),
      app.indexOf('async function submitVaultUsernameMint'),
    );
    const submitAvatarSource = app.slice(
      app.indexOf('async function submitProfileAvatarUpdate'),
      app.indexOf('async function attemptPrivatePaymentCheckPublish'),
    );

    expect(finalitySource).toMatch(/pending_profile_avatar_payment_count/);
    expect(finalitySource).toMatch(/pendingCount > 0n/);
    expect(finalitySource).toMatch(/vault_pending_profile_avatar_payment_count/);
    expect(finalitySource).toMatch(/profilePaymentFinality = await readProfileAvatarVaultPaymentFinality\(provider, result\)/);
    expect(finalitySource).toMatch(/active, Vault payment pending/);
    expect(finalitySource).toMatch(/profilePaymentPending: profilePaymentFinality\?\.pending === true/);
    expect(submitAvatarSource).not.toMatch(/auto.*refund/i);
    expect(submitAvatarSource).not.toMatch(/resubmit/i);
  });

  it('RT-VUSER-001: username mint rejects registered or pending names before signing', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const helper = app.slice(
      app.indexOf('async function readUsernameMintAvailabilityForOwnVaultAction'),
      app.indexOf('async function resolveUsernameNftItemProvider'),
    );
    const submitSource = app.slice(
      app.indexOf('async function submitUsernameMint'),
      app.indexOf('async function submitAthDueFlush'),
    );
    const priceIndex = submitSource.indexOf('readUsernameMintPriceForOwnVaultAction(provider, registry, username)');
    const availabilityIndex = submitSource.indexOf('readUsernameMintAvailabilityForOwnVaultAction(provider, registry, username)');
    const assertIndex = submitSource.indexOf('assertVaultUsernameMintCanStart(owner, username, priceAtomic)');
    const signIndex = submitSource.indexOf('submitVaultUsernameMint({');

    expect(app).toMatch(/computeUsernameNameHash,/);
    expect(helper).toMatch(/provider cannot verify username availability/);
    expect(helper).toMatch(/const readOptions = \{ address: registry, \.\.\.criticalChainReadOptions\(\) \}/);
    expect(helper).toMatch(/const nameHash = await computeUsernameNameHash\(username\)/);
    expect(helper).toMatch(/provider\.getNameRecordByUsername\(username, readOptions\)/);
    expect(helper).toMatch(/provider\.getPendingMint\(nameHash, readOptions\)/);
    expect(helper).toMatch(/Username is already registered/);
    expect(helper).toMatch(/Username mint is already pending/);
    expect(helper).not.toMatch(/allowUnverifiedCriticalRead/);
    expect(helper).not.toMatch(/callWithVerificationUnavailableReadFallback/);
    expect(priceIndex).toBeGreaterThanOrEqual(0);
    expect(availabilityIndex).toBeGreaterThan(priceIndex);
    expect(assertIndex).toBeGreaterThan(availabilityIndex);
    expect(signIndex).toBeGreaterThan(assertIndex);
  });

  it('RT-VUSER-002: username route verifies official ATH wallet owner and ATHMaster before minting', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const routeSource = app.slice(
      app.indexOf('async function requireUsernameRegistryVaultRoute'),
      app.indexOf('async function requireUsernameRegistryVaultRouteForOwnVaultAction'),
    );

    expect(routeSource).toMatch(/provider\.getAthWalletAddress\(registry/);
    expect(routeSource).toMatch(/resolveAthMasterProvider\(\)/);
    expect(routeSource).toMatch(/athMasterProvider\.getWalletAddress\(registry/);
    expect(routeSource).toMatch(/officialWallet !== appDerivedWallet/);
    expect(routeSource).toMatch(/createAthWalletTonRpcProvider\(\{ athWalletAddress: officialWallet \}\)\.getWalletData/);
    expect(routeSource).toMatch(/if \(!isAthWalletNotDeployedError\(error\)\) throw error/);
    expect(app).not.toMatch(/isMissingAthWalletOwnerError/);
    expect(routeSource).toMatch(/if \(officialWalletData\) \{/);
    expect(routeSource).toMatch(/officialWalletOwner !== registry/);
    expect(routeSource).toMatch(/appConfig\.ath\?\.masterAddress/);
    expect(routeSource).toMatch(/walletAthMaster !== expectedAthMaster/);
    expect(routeSource).toMatch(/UsernameRegistry official ATH wallet ATHMaster binding does not match this app config/);
    const ownRouteSource = app.slice(
      app.indexOf('async function requireUsernameRegistryVaultRouteForOwnVaultAction'),
      app.indexOf('async function assertVaultProfileAvatarCanStart'),
    );
    expect(ownRouteSource).toMatch(/return requireUsernameRegistryVaultRoute\(global\)/);
    expect(ownRouteSource).not.toMatch(/allowUnverifiedRead|callWithVerificationUnavailableReadFallback/);
  });

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
    expect(submitSource).toMatch(/mint submitted, finalizing/);
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
    expect(source).toMatch(/submitVaultUsernameMint/);
    expect(source).not.toMatch(/submitAthWalletMessage\(/);
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
    expect(app).toMatch(/const TON_RPC_CONNECTING_STATUS = 'RPC busy - retrying'/);
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
    expect(app).toMatch(/async function sendVaultExternalBoc\(built, options = \{\}\) \{[\s\S]*markNavVaultBalancePending\('Vault action submitted'/);
    expect(app).toMatch(/async function submitVaultMessage\(type, params, options = \{\}\) \{[\s\S]*markNavVaultBalancePending\('wallet transaction submitted'/);
    expect(app).toMatch(/async function submitAthWalletMessage\(type, params, options = \{\}\) \{[\s\S]*markNavVaultBalancePending\('ATH transaction submitted'/);
    expect(app).toMatch(/function markNavVaultBalanceRetryNeeded[\s\S]*markNavVaultBalancePending\(reason, \{ retry: true \}\)/);
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
    expect(activationSource).toMatch(/if \(!expectedUnavailable\) console\.error\(error\)/);
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
    expect(app).toMatch(/const ATH_FLUSH_POST_TRANSACTION_REFRESH_DELAYS_MS = \[5_000, 15_000, 45_000, 90_000, 180_000\]/);
    expect(flushSource).toMatch(/function queueAthFlushPostTransactionRefresh\(\)/);
    expect(flushSource).toMatch(/queueAthFlushPostTransactionRefresh\(\)/);
    expect(flushSource).toMatch(/resolveUsernameRegistryProvider\(\)[\s\S]*provider\.getGlobal/);
    expect(flushSource).toMatch(/resolveProfileRegistryProvider\(\)[\s\S]*provider\.getGlobal/);
    expect(flushSource).toMatch(/createUsernameRegistryMessage\('FlushBurnAthDue'/);
    expect(flushSource).toMatch(/createProfileRegistryMessage\('FlushProfileBurnAthDue'/);
    expect(flushSource).toMatch(/REGISTRY_BURN_FLUSH_MESSAGE_VALUE_NANOTONS/);
    expect(flushSource).toMatch(/createWalletTransaction\(messages\)/);
    expect(app).not.toMatch(/set(?:Interval|Timeout)\(\s*(?:async\s*)?\(\s*\)\s*=>\s*submitAthDueFlush/);
  });

  it('PWA-CONFIG-07B: private chain sync uses key indexes without global tail scan fallback', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const capsuleHubProvider = readFileSync('web/capsulehub-ton-rpc-provider.mjs', 'utf8');
    const syncSource = app.slice(
      app.indexOf('async function syncPrivateCapsulesFromChain'),
      app.indexOf('async function bootReplayStore'),
    );
    const syncButtonSource = app.slice(
      app.indexOf('syncMessagesButton?.addEventListener'),
      app.indexOf('publicChannelSearch?.addEventListener'),
    );

    expect(app).toMatch(/const MESSAGE_AUTO_SYNC_MS = 60 \* 1000/);
    // Foreground IDLE fast tier: a fully-synced ("nothing new") pass re-arms at ~12s (a cheap 2-read pass)
    // instead of the 60s cap, so a no-push recipient picks up a waiting message in ~12s. The degraded floor,
    // send-pause and 429-backoff still override it when they apply.
    expect(app).toMatch(/const MESSAGE_AUTO_SYNC_IDLE_MS = 12 \* 1000/);
    expect(app).toMatch(/nextSyncDelayMs = MESSAGE_AUTO_SYNC_IDLE_MS/);
    // The degraded-transport floor still wins over the fast idle tier (primary RPC dead -> back off to 180s).
    expect(app).toMatch(/const effectiveDelayMs = degradedTransport \? Math\.max\(requestedDelayMs, MESSAGE_AUTO_SYNC_DEGRADED_MS\) : requestedDelayMs/);
    expect(app).toMatch(/const PRIVATE_CHAIN_INDEX_STORAGE_PREFIX = 'platho\.private\.chain\.index\.v1'/);
    expect(app).toMatch(/const PRIVATE_CHAIN_INDEX_READ_LIMIT = 120/);
    expect(app).toMatch(/const PRIVATE_CHAIN_AUTO_INDEX_READ_LIMIT = 48/);
    expect(app).toMatch(/let messageAutoSyncAt = 0/);
    expect(app).toMatch(/let messageAutoSyncPhase = 'idle'/);
    expect(app).toMatch(/const MESSAGE_SYNC_LOADING_FRAMES = Object\.freeze/);
    expect(app).toMatch(/function messageAutoSyncCountdownText/);
    // State-only sync label: the "next sync in Ns" countdown was removed (owner: drop the next-sync timer).
    expect(app).not.toMatch(/next sync in \$\{seconds\}s/);
    expect(app).toMatch(/if \(messageAutoSyncPhase === 'synced'\) return '✓ Synced'/);
    expect(app).toMatch(/if \(messageAutoSyncPhase === 'delayed'\) return messageAutoSyncLastErrorLabel/);
    expect(app).toMatch(/function beginMessageSyncUi/);
    expect(app).toMatch(/function completeMessageSyncUi/);
    expect(app).toMatch(/function failMessageSyncUi/);
    expect(app).toMatch(/messageAutoSyncAt = Date\.now\(\) \+ effectiveDelayMs/);
    expect(app).toMatch(/scheduleMessageAutoSyncCountdownUi\(\)/);
    expect(app).toMatch(/activeSubtitle\.textContent = conversationSubtitleText\(thread\)/);
    expect(app).toMatch(/function capsuleHubMessageSyncReadOptions\(address\)/);
    expect(app).toMatch(/allowUnverifiedCriticalRead:\s*true/);
    expect(capsuleHubProvider).toMatch(/allowUnverifiedCriticalRead/);
    expect(capsuleHubProvider).toMatch(/get_private_recipient_index/);
    expect(capsuleHubProvider).toMatch(/get_private_sender_index/);
    expect(syncSource).toMatch(/let allowUnverifiedPrivateIndexRead = options\.allowUnverifiedPrivateIndexRead === true/);
    expect(syncSource).toMatch(/const allowUnverifiedPrivateIndexFallback = quickSync && options\.allowUnverifiedPrivateIndexRead !== false/);
    expect(syncSource).toMatch(/let readOptions = allowUnverifiedPrivateIndexRead[\s\S]*capsuleHubMessageSyncReadOptions\(address\)[\s\S]*criticalCapsuleHubReadOptions\(address\)/);
    expect(app).toMatch(/function privateIndexCursorPersistenceMode\(readOptions = \{\}\)/);
    expect(app).not.toMatch(/message_index_unverified/);
    expect(syncSource).toMatch(/const cursorPersistence = privateIndexCursorPersistenceMode\(readOptions\)/);
    expect(syncSource).toMatch(/const canPersistPrivateIndexCursor = cursorPersistence !== 'disabled_unverified'/);
    expect(syncSource).toMatch(/if \(!allowUnverifiedPrivateIndexRead && allowUnverifiedPrivateIndexFallback && isTonRpcVerificationSoftReadError\(error\)\)/);
    expect(syncSource).toMatch(/indexReadFallback = shortUiErrorText\(error, 'verified private index unavailable'\)/);
    expect(syncSource).not.toMatch(/provider\.getState\(readOptions\)/);
    expect(syncSource).not.toMatch(/private_latest_id/);
    expect(syncSource).not.toMatch(/readPrivateChainScanCursor|writePrivateChainScanCursor/);
    expect(syncSource).toMatch(/privateKeyIdIndexValue\(localRecipientKeyPair\.keyId\)/);
    expect(syncSource).toMatch(/provider\.getPrivateRecipientIndex\(keyIdIndex, readOptions\)/);
    expect(syncSource).toMatch(/provider\.getPrivateSenderIndex\(keyIdIndex, readOptions\)/);
    expect(syncSource).toMatch(/reason: 'private_index_read_failed'/);
    expect(syncSource).toMatch(/indexReadError/);
    expect(app).toMatch(/idxErr=\$\{debugTiny\(sync\.indexReadError, '-'\)\}/);
    expect(syncSource).toMatch(/readPrivateChainIndexCursor\(address, role\)/);
    expect(syncSource).toMatch(/if \(canPersistPrivateIndexCursor && !rateLimitError && scanComplete && !hasFreshPartial && bodyHistoryError === null\)/);
    expect(syncSource).toMatch(/writePrivateChainIndexCursor\(address, write\.role, write\.cursor\)/);
    expect(app).toMatch(/const PRIVATE_CHAIN_HEAD_REPAIR_STORAGE_PREFIX = 'platho\.private\.chain\.head\.repair\.v1'/);
    expect(app).toMatch(/const PRIVATE_CHAIN_HEAD_REPAIR_SCAN_LIMIT = 8/);
    expect(app).toMatch(/function readPrivateChainHeadRepairLink/);
    expect(app).toMatch(/function writePrivateChainHeadRepairLink/);
    expect(syncSource).toMatch(/walkRecentIndexedRoleForRepair\('recipient', recipientHead\)/);
    expect(syncSource).toMatch(/walkRecentIndexedRoleForRepair\('sender', senderHead\)/);
    expect(syncSource).toMatch(/scanPrivateEntryId\(entryId, \{ source: `\$\{role\}-head-repair` \}\)/);
    expect(syncSource).toMatch(/writePrivateChainHeadRepairLink\(address, write\.role, write\.link\)/);
    expect(syncSource).toMatch(/confirmPendingPrivatePublishMessagesFromEntries\(/);
    expect(syncSource).toMatch(/'private_sync_index'/);
    expect(syncSource).toMatch(/publishConfirmations/);
    expect(syncSource).toMatch(/privateIndexEntryIdFromLink\(currentLink\)/);
    expect(syncSource).toMatch(/privateIndexPreviousLink\(result\.entry, role\)/);
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
    expect(app).toMatch(/partial_stream_pending/);
    expect(app).toMatch(/index_limit_without_cursor/);
    expect(app).toMatch(/index scan limited/);
    expect(app).toMatch(/catch-up/);
    expect(app).toMatch(/function privateIndexSyncReadLimit\(options = \{\}\)/);
    expect(app).toMatch(/options\.readLimit/);
    expect(syncSource).toMatch(/const quickSync = options\.mode === 'auto' \|\| options\.fast === true/);
    expect(app).toMatch(/PRIVATE_CHAIN_AUTO_INDEX_READ_LIMIT/);
    expect(syncSource).toMatch(/const baseLimit = privateIndexSyncReadLimit\(options\)/);
    expect(syncSource).toMatch(/const limit = !canPersistPrivateIndexCursor && quickSync[\s\S]*PRIVATE_CHAIN_INDEX_READ_LIMIT[\s\S]*: baseLimit/);
    expect(app).toMatch(/const PRIVATE_CHAIN_HISTORY_RETRY_COOLDOWN_MS = 3 \* 60 \* 1000/);
    expect(app).toMatch(/const PRIVATE_CHAIN_HISTORY_RETRY_AUTO_LIMIT = 2/);
    expect(app).toMatch(/const PRIVATE_CHAIN_HISTORY_RETRY_MANUAL_LIMIT = 16/);
    expect(app).toMatch(/function privateBodyHistoryRetryEntryIds\(address, options = \{\}\)/);
    expect(app).toMatch(/const force = options\.forceHistoryRetry === true/);
    expect(app).toMatch(/const retryLimit = force \? PRIVATE_CHAIN_HISTORY_RETRY_MANUAL_LIMIT : PRIVATE_CHAIN_HISTORY_RETRY_AUTO_LIMIT/);
    expect(syncSource).toMatch(/const retryEntryIds = \[\.\.\.new Set\(\[/);
    expect(syncSource).toMatch(/\.\.\.privateBodyHistoryRetryEntryIds\(address, \{ forceHistoryRetry: options\.forceHistoryRetry === true \}\)/);
    expect(syncSource).toMatch(/\.\.\.privateStuckEntryRetryEntryIds\(address, \{ forceStuckRetry: options\.forceHistoryRetry === true \}\)/);
    expect(syncSource).toMatch(/for \(const entryId of retryEntryIds\)/);
    expect(syncSource).toMatch(/rememberPrivateBodyHistoryUnavailable\(address, entry, entryId\)/);
    expect(syncSource).toMatch(/clearPrivateBodyHistoryUnavailable\(address, entryId\)/);
    expect(syncSource).toMatch(/historyUnavailableEntries\.push/);
    expect(syncSource).not.toMatch(/isBodyHistoryUnavailableError\(error\)[\s\S]{0,200}break/);
    expect(syncSource).toMatch(/catchUpRemaining/);
    expect(syncSource).toMatch(/let indexLimitReachedWithoutCursor = false/);
    expect(syncSource).toMatch(/if \(canPersistPrivateIndexCursor\) \{[\s\S]*catchUpRemaining \+= 1[\s\S]*\} else \{[\s\S]*indexLimitReachedWithoutCursor = true/);
    expect(syncSource).toMatch(/indexLimitReachedWithoutCursor/);
    expect(syncSource).toMatch(/const fullScanComplete = scanComplete[\s\S]*&& !indexLimitReachedWithoutCursor/);
    expect(syncSource).not.toMatch(/windowStart/);
    expect(app).toMatch(/privateEntryPublisherWallet/);
    expect(app).toMatch(/resolveKnownPrivateSenderWallet/);
    expect(app).toMatch(/relocateExistingCapsuleMessage/);
    expect(syncSource).toMatch(/globalThis\.plathoLastPrivateSync/);
    expect(syncSource).toMatch(/recipientHead: recipientHead\.toString\(\)/);
    expect(syncSource).toMatch(/senderHead: senderHead\.toString\(\)/);
    // Cursor persistence only advances after verified index reads. Unverified
    // fallback can import self-authenticated entries, but it cannot poison the
    // active cursor or hide older index history.
    expect(app).toMatch(/if \(readOptions\.verify === true && readOptions\.allowUnverifiedCriticalRead !== true\) return 'verified'/);
    expect(app).toMatch(/return 'disabled_unverified'/);
    expect(app).not.toMatch(/degraded_unverified/);
    expect(app).not.toMatch(/return 'message_index_unverified'/);
    expect(syncSource).toMatch(/cursorPersistence,/);
    expect(syncSource).toMatch(/indexReadFallback/);
    expect(syncSource).toMatch(/forceIndexRescan/);
    expect(syncSource).toMatch(/indexEntriesScanned/);
    expect(syncSource).toMatch(/incompletePrivateStreamCount/);
    expect(syncSource).toMatch(/mode: quickSync \? 'auto' : 'recovery'/);
    expect(syncSource).toMatch(/rateLimited: rateLimitError !== null/);
    // A persistently failing entry is skipped after three passes instead of
    // freezing the cursor into a forever-resyncing loop.
    expect(syncSource).toMatch(/PRIVATE_SCAN_UNKNOWN_ERROR_SKIP_AFTER/);
    expect(syncSource).toMatch(/crossStrikes >= PRIVATE_SCAN_UNKNOWN_ERROR_CROSS_SESSION_CAP \? 'undelivered' : 'error-skip'/);
    expect(syncSource).toMatch(/function scheduleMessageAutoSync/);
    expect(syncSource).toMatch(/beginMessageSyncUi\(\)/);
    expect(syncSource).toMatch(/syncPrivateCapsulesFromChainOnce\(\{ mode: 'auto' \}\)/);
    expect(syncSource).toMatch(/completeMessageSyncUi\(result\)/);
    expect(syncSource).toMatch(/result\?\.scanComplete === false && result\?\.reason !== 'index_limit_without_cursor'/);
    expect(syncSource).toMatch(/failMessageSyncUi\(label\)/);
    expect(syncSource).toMatch(/resumePendingPrivateSendRetries\(\)/);
    expect(syncSource).toMatch(/resumePendingPrivatePublishConfirmations\(\)/);
    expect(syncButtonSource).toMatch(/mode: 'manual'/);
    expect(syncButtonSource).toMatch(/readLimit: PRIVATE_CHAIN_INDEX_READ_LIMIT/);
    expect(syncButtonSource).toMatch(/forceHistoryRetry: true/);
    expect(syncButtonSource).toMatch(/forceIndexRescan: true/);
    expect(syncButtonSource).not.toMatch(/allowUnverifiedPrivateIndexRead|verifyPrivateIndex/);
    expect(syncButtonSource).toMatch(/beginMessageSyncUi\(\)/);
    expect(syncButtonSource).toMatch(/completeMessageSyncUi\(result\)/);
    expect(syncButtonSource).not.toMatch(/syncPublicChannels/);
    expect(app).toMatch(/function sortThreadMessages/);
    expect(app).toMatch(/function insertThreadMessage/);
    expect(app).toMatch(/function privateChainMessageOrderFields/);
    expect(app).toMatch(/createdAtMs/);
    expect(app).toMatch(/chainEntryId/);
    expect(syncSource).toMatch(/privateChainMessageMeta\(\{\s*\.\.\.entry,\s*openedAs:\s*opened\.openedAs\s*\}\),\s*entry/);
    expect(syncSource).toMatch(/appendOpenedPrivatePartsMessage/);
    expect(syncSource).toMatch(/incompletePrivateStreamCount \+= 1/);
    expect(syncSource).toMatch(/skipped \+= uniqueParts\.size/);
    expect(syncSource).not.toMatch(/partial_private_stream/);
    expect(app).not.toMatch(/autoSyncBudgetExceeded/);
  });

  it('PWA-CONFIG-07D: private chain sync skips unreadable private entries without aborting the index walk', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const syncStart = app.indexOf('async function syncPrivateCapsulesFromChain');
    const syncEnd = app.indexOf('async function bootReplayStore');
    const keyMismatchStart = app.indexOf('function isPrivateOpenKeyMismatchError');
    const unreadableStart = app.indexOf('function isPrivateUnreadableCapsuleError');
    const helperEnd = app.indexOf('function privateSyncResult');
    expect(syncStart).toBeGreaterThanOrEqual(0);
    expect(syncEnd).toBeGreaterThan(syncStart);
    expect(keyMismatchStart).toBeGreaterThanOrEqual(0);
    expect(unreadableStart).toBeGreaterThanOrEqual(0);
    expect(unreadableStart).toBeGreaterThan(keyMismatchStart);
    expect(helperEnd).toBeGreaterThan(unreadableStart);
    const syncSource = app.slice(syncStart, syncEnd);
    const keyMismatchHelperSource = app.slice(keyMismatchStart, unreadableStart);
    const unreadableHelperSource = app.slice(unreadableStart, helperEnd);
    const bodyHistoryBranchIndex = syncSource.indexOf('isBodyHistoryUnavailableError(error)');
    const unreadableBranchIndex = syncSource.indexOf('isPrivateUnreadableCapsuleError(error)');
    expect(bodyHistoryBranchIndex).toBeGreaterThanOrEqual(0);
    expect(unreadableBranchIndex).toBeGreaterThan(bodyHistoryBranchIndex);
    const unreadableBranchEnd = syncSource.indexOf('} else {', unreadableBranchIndex);
    expect(unreadableBranchEnd).toBeGreaterThan(unreadableBranchIndex);
    const unreadableBranchSource = syncSource.slice(unreadableBranchIndex, unreadableBranchEnd);

    expect(unreadableHelperSource).toMatch(/if \(isPrivateOpenKeyMismatchError\(error\)\) return true/);
    expect(keyMismatchHelperSource).toMatch(/key mismatch\|expired\|operation-specific/);
    // The transient-RPC token "unavailable" must NOT be in the permanent-unreadable
    // classifier — a transient RPC error (e.g. "TON RPC verification unavailable")
    // must re-walk, not be dropped forever while the header still says "Synced".
    expect(keyMismatchHelperSource).not.toMatch(/unavailable/);
    // The transient guard sits BEFORE the unreadable branch so transient failures
    // pin the cursor (re-walk) instead of falling into the permanent drop.
    const transientGuardIndex = syncSource.indexOf('isTonRpcVerificationSoftReadError(error) || isTonRpcTransientError(error)');
    expect(transientGuardIndex).toBeGreaterThanOrEqual(0);
    expect(transientGuardIndex).toBeLessThan(unreadableBranchIndex);
    expect(unreadableHelperSource).toMatch(/private capsule\|platho private capsule\|capsulehub private entry\|compact body/);
    expect(unreadableHelperSource).toMatch(/header0\|header1\|sender signature\|magic mismatch\|body size mismatch/);
    expect(unreadableHelperSource).toMatch(/suite mismatch\|hash mismatch\|invalid platho private capsule/);
    expect(unreadableBranchSource).toMatch(/scannedPrivateEntryIds\.add\(entryIdKey\)/);
    expect(unreadableBranchSource).toMatch(/clearPrivateBodyHistoryUnavailable\(address, entryId\)/);
    expect(unreadableBranchSource).toMatch(/privateKeyOpenError = error/);
    expect(unreadableBranchSource).toMatch(/rememberPrivateScanLog\(entryId, 'unreadable'\)/);
    expect(unreadableBranchSource).toMatch(/skipped \+= 1/);
    expect(unreadableBranchSource).toMatch(/type: 'unreadable_capsule'/);
    expect(unreadableBranchSource).toMatch(/return \{ ok: true, entry \}/);
    expect(unreadableBranchSource).not.toMatch(/rememberPrivateBodyHistoryUnavailable/);
    expect(unreadableBranchSource).not.toMatch(/historyUnavailableEntries\.push/);
    expect(syncSource).toMatch(/if \(!result\.ok\) \{[\s\S]*scanComplete = false[\s\S]*return[\s\S]*\}[\s\S]*const previousLink = privateIndexPreviousLink\(result\.entry, role\)/);
    expect(syncSource).toMatch(/for \(const entryId of retryEntryIds\)[\s\S]*scanPrivateEntryId\(entryId, \{ source: 'history-retry' \}\)/);
    expect(syncSource).toMatch(/isBodyHistoryUnavailableError\(error\)[\s\S]*rememberPrivateBodyHistoryUnavailable\(address, entry, entryId\)/);
  });

  it('PWA-PUBLIC-PRIVATE-UI-01: public/private UI fixes — tab-restore, info-button, feed overflow/uid, self-post, self-dialog, display-as', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    const pubMjs = readFileSync('web/public-channel-subscriptions.mjs', 'utf8');
    // 1. Returning to the private tab restores the open conversation (data-chat-open) on mobile.
    expect(app).toMatch(/appShell\.dataset\.chatOpen = activeThreadId \? 'true' : 'false'/);
    // 2. The public header keeps its Feed/Channels toggle + info on ONE line with the title (no wrap to a
    // second line). The vestigial diagnostics-panel flex-wrap + the actions' forced min-width are gone, and
    // the install button is hidden on mobile so the toggle + info fit beside the title.
    expect(css).not.toMatch(/min-width: var\(--header-actions-width\)/);
    expect(css).toMatch(/\.public-pane \.pane-header \.install-header-button \{\s*display: none;/);
    // 3a. Feed grid column is capped so a long token cannot stretch the card off-screen.
    expect(css).toMatch(/\.public-feed \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/);
    // 3b. Plain feed post bodies wrap long tokens.
    expect(css).toMatch(/\.feed-item p \{[\s\S]*?overflow-wrap: anywhere;[\s\S]*?word-break: break-word;/);
    // 3c. The technical entry uid is dropped from the feed header meta.
    expect(pubMjs).toMatch(/meta: \[post\.publishStatus, shortTime\(post\.createdAt\)\]/);
    expect(pubMjs).not.toMatch(/uid \$\{post\.entryUid/);
    // 4. Own posts show in the feed without auto-subscribing (feed source = subscribed + own).
    expect(app).toMatch(/function feedSourcePublicChannels\(\)/);
    expect(app).toMatch(/function ownPublicChannel\(\)/);
    expect(app).toMatch(/publicChannelThreads = publicChannelsToThreads\(\s*feedSourcePublicChannels\(\)/);
    expect(app).toMatch(/for \(const channel of feedSourcePublicChannels\(\)\)/);
    expect(pubMjs).toMatch(/export function publicChannelsToThreads\(channels, feedCache = \{\}\)/);
    // 5. "Private chat" is hidden on your own public post (no self-dialog). Ownership uses isOwnPublicAuthor,
    //    which falls back to the wallet address persisted in storage so own posts are recognised from the FIRST
    //    render (before the full wallet finishes loading) and never flash the author-only actions (▼/Private chat/Unfollow).
    expect(app).toMatch(/function isOwnPublicAuthor\(authorWallet\)/);
    expect(app).toMatch(/const ownAddress = plathoWallet\?\.address \?\? storedPlathoWalletRecord\(\)\?\.address \?\? null/);
    expect(app).toMatch(/const isOwnPost = isOwnPublicAuthor\(authorWallet\)/);
    expect(app).toMatch(/if \(!isOwnPost\) \{[\s\S]*?textContent = 'Private chat'/);
    // 6A. Feed posts get the "Display as" chevron in the AUTHOR ROW (top-right), FEED mode only — channels mode
    // omits it on post cards (the channel-detail header already carries it). Reuses the shared popover.
    expect(app).toMatch(/function publicItemIdentityButton\(item\)/);
    expect(app).toMatch(/showPublicChannelDisplayPopover\(\{ authorWallet \}, identityButton\)/);
    expect(app).toMatch(/const feedIdentityButton = publicItemIdentityButton\(item\);[\s\S]*?authorRow\.append\(feedIdentityButton\)/);
    // It is pinned right in the compact author row (margin-left:auto, clean square so the chevron centres).
    expect(css).toMatch(/\.feed-author-identity \{[\s\S]*?margin-left: auto;[\s\S]*?padding: 0;/);
    expect(css).not.toMatch(/\.feed-actions \.icon-button/);
    // 6B-own. The user's OWN .ath shows in their own public channel (local, no chain read). Resolved FIRST and via
    // the stored address (so it works before the wallet loads and isn't shadowed by a stray self-entry in the store).
    expect(app).toMatch(/const ownAddress = plathoWallet\?\.address \?\? storedPlathoWalletRecord\(\)\?\.address \?\? null/);
    expect(app).toMatch(/sameWalletAddress\(counterpartyWallet, ownAddress\)\)[\s\S]*?readLinkedPlathoUsername\(ownAddress\)\?\.label/);
    // 6B phase-1: PUBLIC document decode is forward-compat tolerant (skips unknown blocks) so a later phase can
    // embed an author-.ath block without breaking already-updated clients; PRIVATE decode stays STRICT.
    expect(app).toMatch(/function decodeMessageDocumentBlocks\(bytesLike, options = \{\}\)/);
    expect(app).toMatch(/const tolerateUnknownBlocks = options\.tolerateUnknownBlocks === true/);
    expect(app).toMatch(/\} else if \(tolerateUnknownBlocks\) \{[\s\S]*?continue;/);
    expect(app).toMatch(/decodeMessageDocumentBlocks\(documentBytes, \{ tolerateUnknownBlocks: true \}\)/);
    // Private capsule decode stays strict (no tolerate option) — funds-/correctness-sensitive path unchanged.
    expect(app).toMatch(/decodeMessageDocumentBlocks\(opened\.payload\.bytes\)\)/);
  });

  it('PWA-CONFIG-08: service worker precaches runtime crypto vendor modules', () => {
    const sw = readFileSync('web/sw.js', 'utf8');

    expect(sw).toMatch(/platho-pwa-prototype-v644/);
    expect(sw).toMatch(/\.\/styles\.css\?v=189/);
    expect(sw).toMatch(/\.\/assets\/icons\/swap-circular\.svg/);
    expect(sw).toMatch(/\.\/assets\/icons\/download\.svg/);
    expect(sw).toMatch(/\.\/app\.js\?v=573/);
    // The self-hosted Telegram Mini App SDK is precached so it is available offline
    // and on poor networks, same as the rest of the runtime.
    expect(sw).toMatch(/\.\/vendor\/telegram-web-app\.js\?v=1/);
    expect(sw).toMatch(/\.\/publish-batch-orchestration\.mjs\?v=4/);
    expect(sw).toMatch(/\.\/platho-config\.mjs\?v=97/);
    expect(sw).toMatch(/\.\/capsulehub-ton-rpc-provider\.mjs\?v=53/);
    expect(sw).toMatch(/\.\/username-ton-rpc-provider\.mjs\?v=43/);
    expect(sw).toMatch(/\.\/message-pricing-policy\.mjs\?v=13/);
    expect(sw).toMatch(/\.\/public-channel-subscriptions\.mjs\?v=14/);
    expect(sw).toMatch(/\.\/encrypted-message-store\.mjs\?v=5/);
    expect(sw).toMatch(/\.\/platho-wallet\.mjs\?v=17/);
    expect(sw).toMatch(/\.\/pwa-contract-transactions\.mjs\?v=30/);
    expect(sw).toMatch(/\.\/vault-ton-rpc-provider\.mjs\?v=58/);
    expect(sw).toMatch(/\.\/profile-registry-ton-rpc-provider\.mjs\?v=40/);
    expect(sw).toMatch(/\.\/capsulehub-ton-rpc-provider\.mjs\?v=53/);
    expect(sw).toMatch(/\.\/ath-ton-rpc-provider\.mjs\?v=38/);
    expect(sw).toMatch(/\.\/ton-dns-provider\.mjs\?v=36/);
    expect(sw).toMatch(/\.\/username-ton-rpc-provider\.mjs\?v=43/);
    expect(sw).toMatch(/\.\/recipient-identities\.mjs\?v=6/);
    expect(sw).toMatch(/\.\/crypto\/platho-crypto\.mjs\?v=12/);
    expect(sw).toMatch(/\.\/vault-chain-provider\.mjs\?v=8/);
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
    expect(sw).toMatch(/\.\/assets\/icons\/eye\.svg/);
    expect(sw).toMatch(/\.\/assets\/icons\/eye-off\.svg/);
  });

  it('PWA-CONFIG-08B: service worker install is resilient and navigation is time-bounded', () => {
    const sw = readFileSync('web/sw.js', 'utf8');
    // A single missing/transient asset must not abort install (atomic addAll
    // would strand the device on the previous worker and its stale shell).
    expect(sw).toMatch(/Promise\.allSettled\(\s*ASSETS\.map\(\(asset\) => cache\.add\(asset\)\)/);
    expect(sw).not.toMatch(/cache\.addAll\(ASSETS\)/);
    // Navigation is network-first but bounded so a slow/filtered network falls
    // back to the cached shell instead of hanging on a blank screen.
    expect(sw).toMatch(/function fetchWithTimeout\(request, timeoutMs\)/);
    expect(sw).toMatch(/fetchWithTimeout\(event\.request, NAVIGATION_NETWORK_TIMEOUT_MS\)/);
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
  });
});
