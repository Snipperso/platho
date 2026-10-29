import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PLATHO_APP_CONFIG, validatePlathoAppConfig } from '../web/platho-config.mjs';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('PWA on-chain self-sufficiency', () => {
  it('PWA-CHAIN-01: immutable V1 contracts expose the get-methods the PWA needs without a Platho backend', () => {
    const profileRegistry = read('contracts/ProfileRegistry.tact');
    const usernameRegistry = read('contracts/UsernameRegistry.tact');
    const athMaster = read('contracts/ATHMaster.tact');
    const athWallet = read('contracts/ATHWallet.tact');
    const feeAccumulator = read('contracts/FeeAccumulator.tact');
    const buybackBurn = read('contracts/BuybackBurn.tact');

    for (const method of ['get_global', 'get_key_shard_address', 'get_ath_wallet_address']) {
      expect(profileRegistry, `ProfileRegistry must expose ${method}`).toMatch(new RegExp(`get fun ${method}\\b`));
    }
    expect(read('contracts/KeyShard.tact'), 'KeyShard must expose get_view').toMatch(/get fun get_view\b/);
    for (const method of ['get_global', 'get_username_price', 'get_username_item_address']) {
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
    const profileProvider = read('web/profile-registry-ton-rpc-provider.mjs');
    const usernameProvider = read('web/username-ton-rpc-provider.mjs');
    const athProvider = read('web/ath-ton-rpc-provider.mjs');

    expect(app).toMatch(/readUsernameMintPriceForOwnVaultAction\(provider, registry, username\)/);
    expect(app).toMatch(/resolvePeerReplyBundle\(\{\s*provider, peerWallet/);
    expect(app).toMatch(/resolveRecipientBundleByWallet\(\{ provider, wallet/);
    expect(app).toMatch(/readCurrentProfileAvatarPointerResultFromChain/);
    expect(read('web/public-shard-ton-rpc-provider.mjs')).toMatch(/method:\s*'get_page'/);
    expect(read('web/intro-transport.mjs')).toMatch(/method:\s*'get_entry'/);
    for (const method of ['get_global', 'get_key_shard_address']) {
      expect(profileProvider).toMatch(new RegExp(`method:\\s*'${method}'`));
    }
    expect(read('web/key-shard-ton-rpc-provider.mjs')).toMatch(/method:\s*'get_view'/);
    for (const method of ['get_global', 'get_username_price', 'get_username_item_address']) {
      expect(usernameProvider).toMatch(new RegExp(`method:\\s*'${method}'`));
    }
    expect(athProvider).toMatch(/method:\s*'get_jetton_data'/);
    expect(athProvider).toMatch(/method:\s*'get_wallet_address'/);
  });

  it('PWA-CHAIN-03: TON RPC is configured as replaceable transport with fallback and critical-read compare', () => {
    const app = read('web/app.js');
    const transport = read('web/ton-rpc-transport.mjs');

    expect(app).toMatch(/createTonRpcTransport\(rpc\)/);
    expect(app).not.toMatch(/scheduleToncenterHttpRequest/);
    expect(app).not.toMatch(/https:\/\/toncenter\.com\/api\/v2\/getAddressInformation/);
    expect(transport).toMatch(/createFallbackTonRpcTransport/);
    expect(transport).toMatch(/RPC_DISAGREEMENT/);
    expect(transport).toMatch(/sendBoc/);
    expect(transport).toMatch(/getAccountState/);
    expect(PLATHO_APP_CONFIG.network.tonRpc.providers.map((provider) => provider.kind)).toEqual([
      'toncenter-v3',
      'toncenter-v3',
    ]);
    expect(PLATHO_APP_CONFIG.network.tonRpc.primaryProviderId).toBe('user-toncenter');
    expect(PLATHO_APP_CONFIG.network.tonRpc.fallbackProviderIds).toEqual(['keyless-toncenter']);
    expect(PLATHO_APP_CONFIG.network.tonRpc.providers.some((provider) => String(provider.kind) === 'ton-access-v2')).toBe(false);
    expect(PLATHO_APP_CONFIG.network.tonRpc.providers.find((provider) => provider.id === 'user-toncenter')?.useUserApiKey).toBe(true);
    expect(PLATHO_APP_CONFIG.network.tonRpc.providers.find((provider) => provider.id === 'user-toncenter')?.apiKey).toBeUndefined();
    expect(PLATHO_APP_CONFIG.network.tonRpc.providers.find((provider) => provider.id === 'keyless-toncenter')?.verifierOnly).toBe(true);
    expect(PLATHO_APP_CONFIG.network.tonRpc.providers.find((provider) => provider.id === 'keyless-toncenter')?.emergencyFallback).toBe(true);
    expect(validatePlathoAppConfig(PLATHO_APP_CONFIG).findings.map((finding) => finding.id))
      .not.toContain('PWA_TON_RPC_CENTRAL_GATEWAY_FORBIDDEN');
  });

  it('PWA-CHAIN-04: a per-user toncenter key is loaded at boot, re-resolves the transport, and has a settings entry', () => {
    const app = read('web/app.js');
    const transport = read('web/ton-rpc-transport.mjs');
    const html = read('web/index.html');

    expect(app).toMatch(/queueMicrotask\(\(\) => \{ void loadSealedToncenterApiKey\(\); \}\);/);
    expect(app).toMatch(/globalThis\.plathoToncenterApiKey = key \|\| null;/);
    expect(app).toMatch(/'platho\.toncenter\.apiKey\.v1'/);
    expect(app).toMatch(/globalThis\.plathoTonRpcConfig = rpc/);
    expect(app).toMatch(/function applyToncenterApiKey/);
    expect(app).toMatch(/globalThis\.plathoTonRpcTransport = null/);
    expect(app).toMatch(/createTonRpcTransport\(globalThis\.plathoTonRpcConfig\)/);
    expect(transport).toMatch(/useUserApiKey/);
    expect(transport).toMatch(/globalThis\.plathoToncenterApiKey/);
    expect(read('web/platho-config.mjs')).not.toMatch(/apiKey:\s*'/);
    expect(html).toMatch(/id="toncenterApiKeyInput"/);
    expect(html).toMatch(/id="rpcKeyRow"/);
  });
});
