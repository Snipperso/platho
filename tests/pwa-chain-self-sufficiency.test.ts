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

    // get_avatar / get_avatar_version RETIRED 2026-07-21 with the maps behind them: holding a pointer per profile
    // cost a MEASURED 5.0000 cells each against a ~65536-cell account and capped the product at 13,076 profiles,
    // silently. The pointer lives in the buyer's own KeyShard, and get_key_shard_address is how a client reaches
    // it from a wallet — so the self-sufficiency property is unchanged in substance: the PWA still resolves a
    // wallet to its avatar with nothing but chain getters, and now does so against an account that cannot fill up.
    for (const method of ['get_global', 'get_key_shard_address', 'get_ath_wallet_address']) {
      expect(profileRegistry, `ProfileRegistry must expose ${method}`).toMatch(new RegExp(`get fun ${method}\\b`));
    }
    expect(read('contracts/KeyShard.tact'), 'KeyShard must expose get_view').toMatch(/get fun get_view\b/);
    // get_name_record RETIRED 2026-07-20 with the name_records map. The per-name UsernameNFTItem contract is the
    // record, and get_username_item_address is how a client reaches it from a name — so the self-sufficiency
    // property this pins is unchanged in substance: the PWA can still resolve a name to its owner with nothing
    // but chain getters, and now does so against the source that actually follows a TEP-62 transfer.
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
    const vaultProvider = read('web/vault-ton-rpc-provider.mjs');
    const capsuleProvider = read('web/capsulehub-ton-rpc-provider.mjs');
    const profileProvider = read('web/profile-registry-ton-rpc-provider.mjs');
    const usernameProvider = read('web/username-ton-rpc-provider.mjs');
    const athProvider = read('web/ath-ton-rpc-provider.mjs');

    expect(app).toMatch(/readUsernameMintPriceForOwnVaultAction\(provider, registry, username\)/);
    // clean-17: the recipient's messaging bundle is read from their KeyShard contract on the direct-pay send path
    // (not the removed Vault get_user) — resolvePeerReplyBundle for a CONV reply, resolveRecipientBundleByWallet for
    // an INTRO first contact, both through createKeyShardTonRpcProvider. The KeyShard get_view read is pinned below.
    expect(app).toMatch(/resolvePeerReplyBundle\(\{ provider, peerWallet/);
    expect(app).toMatch(/resolveRecipientBundleByWallet\(\{ provider, wallet/);
    expect(app).toMatch(/provider\.getKeyRecord\(currentKeyId/);
    expect(app).toMatch(/readCurrentProfileAvatarPointerResultFromChain/);

    for (const method of ['get_global', 'get_user', 'get_key_record']) {
      expect(vaultProvider).toMatch(new RegExp(`method:\\s*'${method}'`));
    }
    for (const method of ['get_state', 'get_private_entry', 'get_public_entry', 'get_private_page', 'get_public_page']) {
      expect(capsuleProvider).toMatch(new RegExp(`method:\\s*'${method}'`));
    }
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
    const transport = read('web/vault-ton-rpc-provider.mjs');

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
    // TONCENTER-ONLY: the user's own keyed toncenter is the PRIMARY (reads/send/history); anonymous toncenter
    // is the last-resort emergency fallback. No Orbs / ton-access provider remains.
    expect(PLATHO_APP_CONFIG.network.tonRpc.primaryProviderId).toBe('user-toncenter');
    expect(PLATHO_APP_CONFIG.network.tonRpc.fallbackProviderIds).toEqual(['keyless-toncenter']);
    expect(PLATHO_APP_CONFIG.network.tonRpc.providers.some((provider) => String(provider.kind) === 'ton-access-v2')).toBe(false);
    expect(PLATHO_APP_CONFIG.network.tonRpc.providers.find((provider) => provider.id === 'user-toncenter')?.useUserApiKey).toBe(true);
    expect(PLATHO_APP_CONFIG.network.tonRpc.providers.find((provider) => provider.id === 'user-toncenter')?.apiKey).toBeUndefined();
    expect(PLATHO_APP_CONFIG.network.tonRpc.providers.find((provider) => provider.id === 'keyless-toncenter')?.verifierOnly).toBe(true);
    expect(PLATHO_APP_CONFIG.network.tonRpc.providers.find((provider) => provider.id === 'keyless-toncenter')?.emergencyFallback).toBe(true);
    // Every provider endpoint is the canonical public toncenter.com host — no provider routes through a
    // central proxy/gateway.
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
