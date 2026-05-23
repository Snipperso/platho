import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  PLATHO_APP_CONFIG,
  PLATHO_APP_MODES,
  validatePlathoAppConfig,
} from '../web/platho-config.mjs';

const productionConfig = {
  mode: PLATHO_APP_MODES.PRODUCTION,
  domain: 'platho.app',
  network: {
    chain: 'mainnet',
    label: 'mainnet',
  },
  vault: {
    address: '0:1111111111111111111111111111111111111111111111111111111111111111',
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
  ui: {
    brandNetworkLabel: 'mainnet',
    networkLabel: 'mainnet',
    walletLabel: 'wallet',
  },
  preview: {
    threads: [],
  },
};

describe('PWA runtime config guard', () => {
  it('PWA-CONFIG-01: default workspace config is explicitly non-production', () => {
    const report = validatePlathoAppConfig(PLATHO_APP_CONFIG);

    expect(report.ok).toBe(false);
    expect(report.mode).toBe(PLATHO_APP_MODES.PREVIEW);
    expect(report.findings.map((finding) => finding.id)).toContain('PWA_MODE_NOT_PRODUCTION');
    expect(report.findings.map((finding) => finding.id)).toContain('PWA_NETWORK_NOT_MAINNET');
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

  it('PWA-CONFIG-01C: profile exposes encryption suite choice with useful payload capacity', () => {
    const html = readFileSync('web/index.html', 'utf8');
    const app = readFileSync('web/app.js', 'utf8');

    expect(html).toMatch(/id="keySuiteSelect"/);
    expect(html).toMatch(/id="actionDialog"/);
    expect(html).toMatch(/id="createWalletButton"/);
    expect(html).toMatch(/id="importWalletButton"/);
    expect(html).toMatch(/id="exportWalletSeedButton"/);
    expect(html).toMatch(/<h2>Wallet<\/h2>[\s\S]*id="createWalletButton"[\s\S]*id="registerVaultKeysButton"/);
    expect(html).toMatch(/<h2>Messages<\/h2>[\s\S]*id="keySuiteSelect"[\s\S]*id="syncMessagesButton"/);
    expect(html).toMatch(/id="setAvatarButton"/);
    expect(html).toMatch(/id="profileAvatarInput"/);
    expect(html).toMatch(/Set avatar/);
    expect(app).toMatch(/readCurrentProfileAvatarPointerFromChain/);
    expect(app).toMatch(/waitForProfileAvatarRegistryUpdate/);
    expect(app).toMatch(/ProfileRegistry provider is required to read current avatar version/);
    expect(html).toMatch(/<h2>Public channels<\/h2>[\s\S]*id="publicSyncWindowSelect"[\s\S]*id="publicCommentsDefaultSelect"/);
    expect(html).toMatch(/<h2>Names and ATH<\/h2>[\s\S]*id="mintUsernameButton"/);
    expect(html).toMatch(/id="replaceVaultKeysButton"/);
    expect(html).toMatch(/id="syncMessagesButton"/);
    expect(html).toMatch(/id="publicSyncWindowSelect"/);
    expect(html).toMatch(/id="publicCommentsDefaultSelect"/);
    expect(html).toMatch(/>Allowed</);
    expect(html).toMatch(/>Closed</);
    expect(html).toMatch(/All time · slow sync/);
    expect(html).toMatch(/id="walletAddressStatus"/);
    expect(html).toMatch(/id="mintUsernameButton"/);
    expect(html).toMatch(/id="flushUsernameRefundButton"/);
    expect(html).toMatch(/Claim failed mint refund/);
    expect(html).not.toMatch(/Claim username refund/);
    expect(html).not.toMatch(/id="transferAthButton"/);
    expect(html).toMatch(/id="burnAthButton"/);
    expect(html).toMatch(/Wallet and Vault are separate for security/);
    expect(html).toMatch(/id="vaultMoveTonForm"/);
    expect(html).toMatch(/id="vaultMoveAthForm"/);
    expect(html).toMatch(/id="vaultMoveTonWalletBalance"/);
    expect(html).toMatch(/id="vaultMoveTonVaultBalance"/);
    expect(html).toMatch(/id="vaultMoveAthWalletBalance"/);
    expect(html).toMatch(/id="vaultMoveAthVaultBalance"/);
    expect(html).toMatch(/id="vaultMoveTonDirectionButton"/);
    expect(html).toMatch(/id="vaultMoveAthDirectionButton"/);
    expect(html).toMatch(/Move TON to Vault/);
    expect(html).toMatch(/Move ATH to Vault/);
    expect(html).not.toMatch(/Wallet runtime|Key auth|Vault record|Replay store|Local state/);
    expect(app).not.toMatch(/window\.prompt|window\.alert/);
    expect(html).not.toMatch(/Messaging key backup|exportMessagingKeyBackupButton|importMessagingKeyBackupButton|messagingKeyBackupInput/);
    expect(html).not.toMatch(/Transport|QR key|Copy key|Save key|Share capsule|Save capsule|Open file|Paste package JSON/);
    expect(html).toMatch(/Postquantum · 1 KiB\/capsule/);
    expect(html).toMatch(/Standard · 1 KiB\/capsule/);
  });

  it('PWA-CONFIG-01D: composers are multiline and wallet-confirmed private mode is one segment', () => {
    const html = readFileSync('web/index.html', 'utf8');
    const app = readFileSync('web/app.js', 'utf8');

    expect(html).toMatch(/<textarea id="messageInput"[^>]*maxlength="1024"/);
    expect(html).toMatch(/<textarea id="publicMessageInput"[^>]*maxlength="1024"/);
    expect(html).toMatch(/Message \(1024 bytes max\)/);
    expect(html).toMatch(/id="privateComposerCostStatus"/);
    expect(html).toMatch(/id="publicComposerCostStatus"/);
    expect(html).toMatch(/Price checking\s+Wallet required/);
    expect(html).toMatch(/id="publicComposer"/);
    expect(html).toMatch(/id="publicComposerCommentsCheckbox"/);
    expect(html).toMatch(/<textarea id="publicMessageInput"[\s\S]*id="publicComposerCommentsCheckbox"/);
    expect(html).toMatch(/Allow comments/);
    expect(app).toMatch(/Open public comments\?/);
    expect(app).toMatch(/Publish with comments/);
    expect(app).toMatch(/Private chat/);
    expect(app).toMatch(/openPrivateThreadForWallet/);
    expect(app).toMatch(/Add public channel/);
    expect(app).toMatch(/ATH discount/);
    expect(app).toMatch(/Price/);
    expect(app).toMatch(/Hold/);
    expect(app).toMatch(/networkFeeSurchargeNanotons/);
    expect(app).toMatch(/Local label/);
    expect(app).not.toMatch(/Shown as/);
    expect(app).toMatch(/resolvePublicChannelIdentity/);
    expect(html).toMatch(/id="privateImageButton"/);
    expect(html).toMatch(/id="publicImageButton"/);
    expect(html).toMatch(/Low 8 KiB/);
    expect(html).toMatch(/Medium 16 KiB/);
    expect(html).toMatch(/Good 32 KiB/);
    expect(html).toMatch(/Maximum 64 KiB/);
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
    expect(html).toMatch(/id="refreshVaultButton"/);
  });

  it('PWA-CONFIG-02: production config passes only with mainnet and provider module configured', () => {
    const report = validatePlathoAppConfig(productionConfig);

    expect(report.ok).toBe(true);
    expect(report.findings).toEqual([]);
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

  it('PWA-CONFIG-05: production config does not carry external wallet connector settings', () => {
    expect(JSON.stringify(productionConfig)).not.toMatch(new RegExp('ton' + 'connect', 'i'));
  });
});
