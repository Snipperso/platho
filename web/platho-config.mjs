export const PLATHO_APP_MODES = Object.freeze({
  PREVIEW: 'preview',
  TESTNET: 'testnet',
  PRODUCTION: 'production',
});

const PRODUCTION_MODE = PLATHO_APP_MODES.PRODUCTION;
const VALID_MODES = new Set(Object.values(PLATHO_APP_MODES));

export const REQUIRED_TON_RPC_CRITICAL_METHODS = Object.freeze([
  'get_global',
  'get_user',
  'get_key_record',
  'get_receive_intent',
  'get_receive_intent_id',
  'get_receive_intent_commitment',
  'get_canonical_publish_charge',
  'get_state',
  'get_private_entry',
  'get_private_recipient_index',
  'get_private_sender_index',
  'get_private_page',
  'get_public_entry',
  'get_public_page',
  'get_name_record',
  'get_username_item_address',
  'get_avatar',
  'get_avatar_version',
  'get_username_price',
  'get_ath_wallet_address',
  'dnsresolve',
  'get_wallet_address',
]);

export const PLATHO_RPC_GATEWAY_GET_METHODS = Object.freeze([
  'dnsresolve',
  'get_ath_wallet_address',
  'get_ath_withdrawal_id',
  'get_avatar',
  'get_avatar_version',
  'get_canonical_publish_charge',
  'get_global',
  'get_jetton_data',
  'get_key_record',
  'get_name_record',
  'get_pending_ath_withdrawal_for',
  'get_pending_burn_flush',
  'get_pending_mint',
  'get_pending_notification',
  'get_pending_treasury_flush',
  'get_private_entry',
  'get_private_recipient_index',
  'get_private_sender_index',
  'get_private_page',
  'get_public_entry',
  'get_public_page',
  'get_receive_intent',
  'get_receive_intent_commitment',
  'get_receive_intent_id',
  'get_state',
  'get_user',
  'get_username_item_address',
  'get_username_price',
  'get_wallet_address',
  'get_wallet_data',
  'seqno',
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

export const PLATHO_APP_CONFIG = deepFreeze({
  mode: PLATHO_APP_MODES.PRODUCTION,
  domain: 'platho.app',
  network: {
    chain: 'mainnet',
    label: 'mainnet',
    tonRpc: {
      primaryProviderId: 'user-custom',
      fallbackProviderIds: ['platho-rpc-mainnet'],
      // The rpc.platho.app gateway is itself multi-source (keyed TonCenter + Orbs, with read
      // fallback + redundant broadcast), so it is the trusted verified source — the PWA does NOT
      // routinely cross-verify every critical read against a 2nd transport. Routine cross-verify
      // would either hammer the keyless emergency toncenter (~1 rps) or fail closed on
      // gateway-vs-gateway hot-state disagreement (the documented 'confirming' freezes). Safety-
      // critical reads that genuinely need a cross-check pass an explicit per-call verify:true,
      // which still NEVER consults the keyless emergency transport (see vault-ton-rpc-provider).
      verifyCriticalReads: false,
      criticalMethods: [...REQUIRED_TON_RPC_CRITICAL_METHODS],
      providers: [
        {
          id: 'user-custom',
          kind: 'custom',
          globalName: 'plathoCustomTonRpcTransport',
        },
        {
          id: 'toncenter-mainnet',
          kind: 'toncenter-v3',
          verifierOnly: true,
          // Censorship survival: if the Platho RPC gateway is blocked or
          // unreachable, keyless TonCenter (~1 rps) takes over reads, sends,
          // and message history until the gateway recovers. It is never a
          // normal read/send fallback while a primary transport is healthy.
          emergencyFallback: true,
          runGetMethodEndpoint: 'https://toncenter.com/api/v3/runGetMethod',
          sendBocEndpoint: 'https://toncenter.com/api/v3/message',
          messagesEndpoint: 'https://toncenter.com/api/v3/messages',
          walletBalanceEndpoint: 'https://toncenter.com/api/v2/getAddressInformation',
          requestSpacingMs: 1500,
        },
        {
          id: 'platho-rpc-mainnet',
          kind: 'platho-rpc',
          runGetMethodEndpoint: 'https://rpc.platho.app/api/v3/runGetMethod',
          sendBocEndpoint: 'https://rpc.platho.app/api/v3/message',
          messagesEndpoint: 'https://rpc.platho.app/api/v3/messages',
          walletBalanceEndpoint: 'https://rpc.platho.app/api/v2/getAddressInformation',
          supportedGetMethods: [...PLATHO_RPC_GATEWAY_GET_METHODS],
        },
      ],
      requestSpacingMs: 250,
      rateLimitBackoffMs: 7000,
      rateLimitRetries: 1,
      requestTimeoutMs: 15000,
      runGetMethodCacheTtlMs: 15000,
      runGetMethodCacheMaxEntries: 512,
    },
  },
  vault: {
    address: 'UQB-EaCRXSL_HyRXhp7YMSuQxKcSYPEvRtq-hEwsfzepfFJT',
    deploymentManifestHash: 'b29aa2598542aa320df5065cc5dbce5d29047e7a44140fd68a49439316dee5ae',
    provider: {
      globalName: 'plathoVaultChainProvider',
      moduleUrl: './vault-ton-rpc-provider.mjs?v=43',
      exportName: 'default',
      unavailableStatus: 'provider required',
      requiredInProduction: true,
    },
  },
  tonDns: {
    rootAddress: '-1:e56754f83426f69b09267bd876ac97c44821345b7e266bd956a7bfbfb98df35c',
    provider: {
      globalName: 'plathoTonDnsProvider',
      moduleUrl: './ton-dns-provider.mjs?v=23',
      exportName: 'default',
      unavailableStatus: 'TON DNS provider required',
      requiredInProduction: true,
    },
  },
  capsuleHub: {
    address: 'UQAYwXnGFHz0yZLDKRNGofomS9yWrzxMnyPO-A-Di5ZQB90G',
    publicReadLimit: 128,
  },
  feeAccumulator: {
    address: 'UQBHCfa5_Kn0JHCniQxrUfVAIg67L2ZvwkLOhBUaQzNP2zM-',
  },
  ath: {
    masterAddress: 'UQBbeKdVpDbcgalNLVEsCrtG3rTmw87vtzuRUM4B3X7IAFFt',
  },
  usernameRegistry: {
    address: 'UQAInh5yk_bApmczqRiPKNSgta-ty_VOsDqs5QrGZgCyONIj',
  },
  profileRegistry: {
    address: 'UQBEVx3u0fNLfEQFBoE3jKcvojt7FQf68pckqsaXunnsJrIn',
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
  publicChannels: [
    {
      id: 'platho.app',
      name: 'platho.app',
      avatar: 'P',
      subtitle: 'official read-only channel',
      authorWallet: 'UQDU48m_nYC12oqHJnKG9nBE4ljGpUYHHLPS-owij9BEOATH',
    },
  ],
  ui: {
    brandNetworkLabel: 'mainnet',
    chatCountLabel: 'Private chats',
    publicSubtitle: 'Public channels',
    vaultSubtitle: 'Vault',
    profileHandle: 'Profile',
    identityName: 'No wallet',
    identitySubtitle: 'Create or import a wallet',
    identityVariants: [
      { type: 'platho_nft', value: 'platho.ath', label: 'platho.ath' },
      { type: 'ton_dns', value: 'platho.ton', label: 'platho.ton' },
    ],
    walletLabel: 'v5r1 mainnet',
    networkLabel: 'mainnet',
    localStateLabel: 'device only',
    vaultCards: [],
    vaultActions: [],
    ledgerRows: [],
  },
  preview: {
    threads: [],
  },
});

function addFinding(findings, id, message, path = 'web/platho-config.mjs') {
  findings.push({ id, file: path, message });
}

function collectMatchingStrings(value, pattern, path = 'config', out = []) {
  if (typeof value === 'string') {
    if (pattern.test(value)) out.push(path);
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectMatchingStrings(item, pattern, `${path}[${index}]`, out));
    return out;
  }
  for (const [key, item] of Object.entries(value)) {
    collectMatchingStrings(item, pattern, `${path}.${key}`, out);
  }
  return out;
}

function hasConcreteTonRpcReadProvider(provider) {
  return Boolean(provider?.runGetMethodEndpoint || provider?.endpoint);
}

function hasConcreteTonRpcMessageHistoryProvider(provider) {
  return Boolean(provider?.messagesEndpoint);
}

function hasTonRpcReadProvider(provider) {
  return Boolean(provider?.globalName || hasConcreteTonRpcReadProvider(provider));
}

function hasTonRpcSendProvider(provider) {
  return Boolean(provider?.globalName || provider?.sendBocEndpoint);
}

function hasConcreteTonRpcSendProvider(provider) {
  return Boolean(provider?.sendBocEndpoint);
}

export function validatePlathoAppConfig(config = PLATHO_APP_CONFIG) {
  const findings = [];
  const mode = config?.mode;
  const provider = config?.vault?.provider ?? {};

  if (!VALID_MODES.has(mode)) {
    addFinding(findings, 'PWA_MODE_INVALID', `PWA mode must be one of ${[...VALID_MODES].join(', ')}.`);
  }
  if (mode !== PRODUCTION_MODE) {
    addFinding(findings, 'PWA_MODE_NOT_PRODUCTION', 'PWA config is not in production mode.');
  }
  if (config?.network?.chain !== 'mainnet') {
    addFinding(findings, 'PWA_NETWORK_NOT_MAINNET', 'PWA config does not target mainnet.');
  }
  if (mode === PRODUCTION_MODE) {
    const markerPaths = collectMatchingStrings(config, /\b(testnet|preview)\b/i);
    if (markerPaths.length > 0) {
      addFinding(
        findings,
        'PWA_PRODUCTION_CONFIG_CONTAINS_NON_PROD_MARKERS',
        `Production config still contains non-production markers: ${markerPaths.join(', ')}.`,
      );
    }
    if (provider.requiredInProduction !== false && !provider.moduleUrl) {
      addFinding(
        findings,
        'PWA_VAULT_CHAIN_PROVIDER_REQUIRED',
        'Production PWA config must name a static Vault chain provider module.',
      );
    }
    const tonRpcProviders = config?.network?.tonRpc?.providers;
    if (!Array.isArray(tonRpcProviders) || tonRpcProviders.length < 2) {
      addFinding(
        findings,
        'PWA_TON_RPC_REPLACEABLE_PROVIDER_LIST_REQUIRED',
        'Production PWA config must define replaceable TON RPC providers with at least one fallback.',
      );
    } else {
      const hasReadProvider = tonRpcProviders.some(hasTonRpcReadProvider);
      const hasSendProvider = tonRpcProviders.some(hasTonRpcSendProvider);
      if (!hasReadProvider || !hasSendProvider) {
        addFinding(
          findings,
          'PWA_TON_RPC_PROVIDER_REQUIRED',
          'Production PWA config must define TON RPC read and send transports.',
        );
      }
      const concreteSendProviders = tonRpcProviders.filter(hasConcreteTonRpcSendProvider);
      if (concreteSendProviders.length < 1) {
        addFinding(
          findings,
          'PWA_TON_RPC_CONCRETE_SEND_PROVIDER_REQUIRED',
          'Production PWA config must include a concrete TON RPC send provider.',
        );
      }
      for (const rpcProvider of tonRpcProviders) {
        const isEmergencyFallbackProvider = rpcProvider?.verifierOnly === true && rpcProvider?.emergencyFallback === true;
        if (
          /toncenter/i.test(String(rpcProvider?.id ?? rpcProvider?.kind ?? ''))
          && rpcProvider?.sendBocEndpoint
          && !isEmergencyFallbackProvider
        ) {
          addFinding(
            findings,
            'PWA_TONCENTER_DIRECT_SEND_FORBIDDEN',
            'Production PWA must broadcast through the Platho RPC gateway; direct TonCenter sendBoc is allowed only on a verifier-only emergency fallback provider.',
          );
        }
      }
      const hasEmergencyFallbackProvider = tonRpcProviders.some((rpcProvider) => (
        rpcProvider?.verifierOnly === true
        && rpcProvider?.emergencyFallback === true
        && hasConcreteTonRpcReadProvider(rpcProvider)
        && hasConcreteTonRpcSendProvider(rpcProvider)
        && hasConcreteTonRpcMessageHistoryProvider(rpcProvider)
      ));
      if (!hasEmergencyFallbackProvider) {
        addFinding(
          findings,
          'PWA_TON_RPC_EMERGENCY_FALLBACK_REQUIRED',
          'Production PWA config must include a verifier-only emergency fallback provider with read, send, and message-history endpoints so the messenger survives a blocked primary gateway.',
        );
      }
      const fallbackIds = new Set((config?.network?.tonRpc?.fallbackProviderIds ?? config?.network?.tonRpc?.fallbackProviders ?? []).map(String));
      for (const rpcProvider of tonRpcProviders) {
        const providerId = String(rpcProvider?.id ?? '');
        if (/toncenter/i.test(String(rpcProvider?.id ?? rpcProvider?.kind ?? '')) && fallbackIds.has(providerId)) {
          addFinding(
            findings,
            'PWA_TONCENTER_DIRECT_READ_FALLBACK_FORBIDDEN',
            'Production PWA must not use direct TonCenter as a normal read fallback; keep it verifier-only.',
          );
        }
        if (/toncenter/i.test(String(rpcProvider?.id ?? rpcProvider?.kind ?? '')) && rpcProvider?.runGetMethodEndpoint && rpcProvider?.verifierOnly !== true) {
          addFinding(
            findings,
            'PWA_TONCENTER_DIRECT_READ_VERIFIER_ONLY_REQUIRED',
            'Production direct TonCenter read provider must be marked verifierOnly.',
          );
        }
      }
      const concreteReadProviders = tonRpcProviders.filter(hasConcreteTonRpcReadProvider);
      if (config?.network?.tonRpc?.verifyCriticalReads !== false && concreteReadProviders.length < 2) {
        addFinding(
          findings,
          'PWA_TON_RPC_TWO_CONCRETE_PROVIDERS_REQUIRED',
          'Production PWA config must include at least two concrete TON RPC read providers for critical-read verification.',
        );
      }
      const concreteMessageHistoryProviders = tonRpcProviders.filter(hasConcreteTonRpcMessageHistoryProvider);
      if (concreteMessageHistoryProviders.length < 1) {
        addFinding(
          findings,
          'PWA_TON_RPC_MESSAGE_HISTORY_PROVIDER_REQUIRED',
          'Production PWA config must include a concrete TON RPC message-history provider for CapsuleHub body retrieval.',
        );
      }
    }
    if (config?.network?.tonRpc?.verifyCriticalReads !== false) {
      const criticalMethods = new Set(config?.network?.tonRpc?.criticalMethods ?? []);
      for (const method of REQUIRED_TON_RPC_CRITICAL_METHODS) {
        if (!criticalMethods.has(method)) {
          addFinding(
            findings,
            'PWA_TON_RPC_CRITICAL_METHOD_REQUIRED',
            `Production PWA config must mark ${method} as a critical verified read.`,
          );
        }
      }
    }
    const tonDnsProvider = config?.tonDns?.provider ?? {};
    if (
      tonDnsProvider.requiredInProduction !== false
      && !tonDnsProvider.moduleUrl
      && !config?.tonDns?.rootAddress
    ) {
      addFinding(
        findings,
        'PWA_TON_DNS_PROVIDER_REQUIRED',
        'Production PWA config must set TON DNS rootAddress or name a static TON DNS provider module.',
      );
    }
    if (!config?.profileRegistry?.address) {
      addFinding(
        findings,
        'PWA_PROFILE_REGISTRY_ADDRESS_REQUIRED',
        'Production PWA config must set ProfileRegistry address for paid wallet avatar updates.',
      );
    }
    if (!config?.vault?.deploymentManifestHash) {
      addFinding(
        findings,
        'PWA_VAULT_DEPLOYMENT_MANIFEST_HASH_REQUIRED',
        'Production PWA config must set Vault deploymentManifestHash for domain-separated signed publishes.',
      );
    }
    if (!config?.feeAccumulator?.address) {
      addFinding(
        findings,
        'PWA_FEE_ACCUMULATOR_ADDRESS_REQUIRED',
        'Production PWA config must set FeeAccumulator address for CapsuleHub preflight verification.',
      );
    }
    const pricing = config?.messaging?.pricing ?? {};
    if (!pricing.maxNetworkFeeSurchargeNanotons) {
      addFinding(
        findings,
        'PWA_NETWORK_SURCHARGE_GUARD_REQUIRED',
        'Production PWA config must set a hard max network fee surcharge.',
      );
    }
    if (config?.capsuleHub?.allowUnverifiedStaticPublicFeeds === true) {
      addFinding(
        findings,
        'PWA_STATIC_PUBLIC_FEED_FALLBACK_FORBIDDEN',
        'Production PWA config must not enable unverified static public feed fallback.',
      );
    }
  }

  return {
    ok: findings.length === 0,
    mode,
    findings,
  };
}
