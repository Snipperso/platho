import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PLATHO_APP_CONFIG, validatePlathoAppConfig } from '../web/platho-config.mjs';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('PWA on-chain self-sufficiency', () => {
  it('PWA-CHAIN-01: immutable V1 contracts expose the get-methods the PWA needs without a Platho backend', () => {
    const vault = read('contracts/Vault.tact');
    const capsuleHub = read('contracts/CapsuleHub.tact');
    const profileRegistry = read('contracts/ProfileRegistry.tact');
    const usernameRegistry = read('contracts/UsernameRegistry.tact');
    const athMaster = read('contracts/ATHMaster.tact');
    const athWallet = read('contracts/ATHWallet.tact');
    const feeAccumulator = read('contracts/FeeAccumulator.tact');
    const buybackBurn = read('contracts/BuybackBurn.tact');

    for (const method of [
      'get_global',
      'get_user',
      'get_key_record',
      'get_receive_intent',
      'get_receive_intent_id',
      'get_receive_intent_commitment',
    ]) {
      expect(vault, `Vault must expose ${method}`).toMatch(new RegExp(`get fun ${method}\\b`));
    }
    for (const method of ['get_state', 'get_private_entry', 'get_public_entry', 'get_private_page', 'get_public_page']) {
      expect(capsuleHub, `CapsuleHub must expose ${method}`).toMatch(new RegExp(`get fun ${method}\\b`));
    }
    for (const method of ['get_global', 'get_avatar', 'get_avatar_version', 'get_ath_wallet_address']) {
      expect(profileRegistry, `ProfileRegistry must expose ${method}`).toMatch(new RegExp(`get fun ${method}\\b`));
    }
    for (const method of ['get_global', 'get_name_record', 'get_username_price', 'get_username_item_address']) {
      expect(usernameRegistry, `UsernameRegistry must expose ${method}`).toMatch(new RegExp(`get fun ${method}\\b`));
    }
    expect(athMaster).toMatch(/get fun get_jetton_data\b/);
    expect(athMaster).toMatch(/get fun get_wallet_address\b/);
    expect(athWallet).toMatch(/get fun get_wallet_data\b/);
    expect(feeAccumulator).toMatch(/get fun get_state\b/);
    expect(buybackBurn).toMatch(/get fun get_buyback_burn_state\b/);
  });

  it('PWA-CHAIN-02: PWA reads protocol-critical values through contract providers, not static business config', () => {
    const app = read('web/app.js');
    const vaultProvider = read('web/vault-ton-rpc-provider.mjs');
    const capsuleProvider = read('web/capsulehub-ton-rpc-provider.mjs');
    const profileProvider = read('web/profile-registry-ton-rpc-provider.mjs');
    const usernameProvider = read('web/username-ton-rpc-provider.mjs');
    const athProvider = read('web/ath-ton-rpc-provider.mjs');

    expect(app).toMatch(/readUsernameMintPriceForOwnVaultAction\(provider, registry, username\)/);
    expect(app).toMatch(/provider\.getUser\(walletAddress/);
    expect(app).toMatch(/provider\.getKeyRecord\(currentKeyId/);
    expect(app).toMatch(/readCurrentProfileAvatarPointerFromChain/);

    for (const method of ['get_global', 'get_user', 'get_key_record']) {
      expect(vaultProvider).toMatch(new RegExp(`method:\\s*'${method}'`));
    }
    for (const method of ['get_state', 'get_private_entry', 'get_public_entry', 'get_private_page', 'get_public_page']) {
      expect(capsuleProvider).toMatch(new RegExp(`method:\\s*'${method}'`));
    }
    for (const method of ['get_global', 'get_avatar', 'get_avatar_version']) {
      expect(profileProvider).toMatch(new RegExp(`method:\\s*'${method}'`));
    }
    for (const method of ['get_global', 'get_name_record', 'get_username_price']) {
      expect(usernameProvider).toMatch(new RegExp(`method:\\s*'${method}'`));
    }
    expect(athProvider).toMatch(/method:\s*'get_jetton_data'/);
    expect(athProvider).toMatch(/method:\s*'get_wallet_address'/);
  });

  it('PWA-CHAIN-03: TON RPC is configured as replaceable transport with fallback and critical-read compare', () => {
    const app = read('web/app.js');
    const transport = read('web/vault-ton-rpc-provider.mjs');

    expect(app).toMatch(/createTonRpcTransport\(rpc\)/);
    expect(app).not.toMatch(/scheduleToncenterHttpRequest/);
    expect(app).not.toMatch(/https:\/\/toncenter\.com\/api\/v2\/getAddressInformation/);
    expect(transport).toMatch(/createFallbackTonRpcTransport/);
    expect(transport).toMatch(/RPC_DISAGREEMENT/);
    expect(transport).toMatch(/sendBoc/);
    expect(transport).toMatch(/getAccountState/);
    expect(PLATHO_APP_CONFIG.network.tonRpc.providers.map((provider) => provider.kind)).toEqual([
      'ton-access-v2',
      'toncenter-v3',
      'toncenter-v3',
    ]);
    expect(PLATHO_APP_CONFIG.network.tonRpc.fallbackProviderIds).toContain('user-toncenter');
    expect(PLATHO_APP_CONFIG.network.tonRpc.fallbackProviderIds).not.toContain('orbs-keyless');
    // Client-direct: keyless Orbs is the per-client decentralized PRIMARY; the user's own toncenter
    // key carries the message-history indexer; anonymous toncenter is the last-resort emergency only.
    expect(PLATHO_APP_CONFIG.network.tonRpc.providers.find((provider) => provider.id === 'orbs-keyless')?.kind).toBe('ton-access-v2');
    expect(PLATHO_APP_CONFIG.network.tonRpc.providers.find((provider) => provider.id === 'user-toncenter')?.useUserApiKey).toBe(true);
    expect(PLATHO_APP_CONFIG.network.tonRpc.providers.find((provider) => provider.id === 'user-toncenter')?.apiKey).toBeUndefined();
    expect(PLATHO_APP_CONFIG.network.tonRpc.providers.find((provider) => provider.id === 'keyless-toncenter')?.verifierOnly).toBe(true);
    expect(PLATHO_APP_CONFIG.network.tonRpc.providers.find((provider) => provider.id === 'keyless-toncenter')?.emergencyFallback).toBe(true);
    // Every provider endpoint is a canonical decentralized/public TON host (Orbs or toncenter.com) — no
    // provider routes through a central proxy/gateway.
    expect(validatePlathoAppConfig(PLATHO_APP_CONFIG).findings.map((finding) => finding.id))
      .not.toContain('PWA_TON_RPC_CENTRAL_GATEWAY_FORBIDDEN');
  });

  it('PWA-CHAIN-04: a per-user toncenter key is loaded at boot, re-resolves the transport, and has a settings entry', () => {
    const app = read('web/app.js');
    const transport = read('web/vault-ton-rpc-provider.mjs');
    const html = read('web/index.html');

    // Boot: the saved key is injected into globalThis BEFORE the transport is built (so it is captured).
    expect(app).toMatch(/globalThis\.plathoToncenterApiKey = savedToncenterKey/);
    expect(app).toMatch(/'platho\.toncenter\.apiKey\.v1'/);
    expect(app).toMatch(/globalThis\.plathoTonRpcConfig = rpc/);
    // Changing the key drops + rebuilds the transport so it takes effect immediately.
    expect(app).toMatch(/function applyToncenterApiKey/);
    expect(app).toMatch(/globalThis\.plathoTonRpcTransport = null/);
    expect(app).toMatch(/createTonRpcTransport\(globalThis\.plathoTonRpcConfig\)/);
    // The toncenter transport reads the runtime key for the useUserApiKey provider.
    expect(transport).toMatch(/useUserApiKey/);
    expect(transport).toMatch(/globalThis\.plathoToncenterApiKey/);
    // The key is never hardcoded in the config bundle.
    expect(read('web/platho-config.mjs')).not.toMatch(/apiKey:\s*'/);
    // Settings entry exists so the user can add/clear the key (auto-saved on change — no Save button).
    expect(html).toMatch(/id="toncenterApiKeyInput"/);
    expect(html).toMatch(/id="rpcKeyRow"/);
  });
});
