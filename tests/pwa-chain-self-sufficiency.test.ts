import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PLATHO_APP_CONFIG } from '../web/platho-config.mjs';

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
      'get_canonical_publish_charge',
    ]) {
      expect(vault, `Vault must expose ${method}`).toMatch(new RegExp(`get fun ${method}\\b`));
    }
    for (const method of ['get_state', 'get_private_entry', 'get_public_entry', 'get_private_page', 'get_public_page']) {
      expect(capsuleHub, `CapsuleHub must expose ${method}`).toMatch(new RegExp(`get fun ${method}\\b`));
    }
    for (const method of ['get_global', 'get_avatar', 'get_avatar_version', 'get_ath_wallet_address']) {
      expect(profileRegistry, `ProfileRegistry must expose ${method}`).toMatch(new RegExp(`get fun ${method}\\b`));
    }
    for (const method of ['get_global', 'get_name_record', 'get_username_price', 'get_username_item_address', 'get_refund_due']) {
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

    expect(app).toMatch(/provider\.getCanonicalPublishCharge\(/);
    expect(app).toMatch(/provider\.getUsernamePrice\(username\.length/);
    expect(app).toMatch(/provider\.getUser\(walletAddress/);
    expect(app).toMatch(/provider\.getKeyRecord\(currentKeyId/);
    expect(app).toMatch(/readCurrentProfileAvatarPointerFromChain/);

    for (const method of ['get_global', 'get_user', 'get_key_record', 'get_canonical_publish_charge']) {
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
      'custom',
      'toncenter-v3',
      'platho-rpc',
    ]);
    expect(PLATHO_APP_CONFIG.network.tonRpc.fallbackProviderIds).toContain('toncenter-mainnet');
    expect(PLATHO_APP_CONFIG.network.tonRpc.fallbackProviderIds).toContain('platho-rpc-mainnet');
    expect(PLATHO_APP_CONFIG.network.tonRpc.criticalMethods).toContain('get_canonical_publish_charge');
  });
});
