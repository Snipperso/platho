export const PLATHO_APP_MODES = Object.freeze({
  PREVIEW: 'preview',
  TESTNET: 'testnet',
  PRODUCTION: 'production',
});

const PRODUCTION_MODE = PLATHO_APP_MODES.PRODUCTION;
const VALID_MODES = new Set(Object.values(PLATHO_APP_MODES));

export const REQUIRED_TON_RPC_CRITICAL_METHODS = Object.freeze([
  'get_global',
  'get_state',
  'get_private_entry',
  'get_public_entry',
  'get_user',
  'get_key_record',
  'get_canonical_publish_charge',
  'get_name_record',
  'get_username_item_address',
  'get_avatar',
  'get_avatar_version',
  'get_username_price',
  'dnsresolve',
  'get_wallet_address',
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

export const PLATHO_APP_CONFIG = deepFreeze({
  mode: PLATHO_APP_MODES.PREVIEW,
  domain: 'platho.app',
  network: {
    chain: 'mainnet',
    label: 'mainnet',
    tonRpc: {
      primaryProviderId: 'user-custom',
      fallbackProviderIds: ['toncenter-mainnet', 'platho-rpc-mainnet'],
      verifyCriticalReads: true,
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
          runGetMethodEndpoint: 'https://toncenter.com/api/v3/runGetMethod',
          sendBocEndpoint: 'https://toncenter.com/api/v3/message',
          messagesEndpoint: 'https://toncenter.com/api/v3/messages',
          walletBalanceEndpoint: 'https://toncenter.com/api/v2/getAddressInformation',
        },
        {
          id: 'platho-rpc-mainnet',
          kind: 'platho-rpc',
          runGetMethodEndpoint: 'https://rpc.platho.app/api/v3/runGetMethod',
          messagesEndpoint: false,
          walletBalanceEndpoint: 'https://rpc.platho.app/api/v2/getAddressInformation',
        },
      ],
      requestSpacingMs: 1500,
      rateLimitBackoffMs: 60000,
      rateLimitRetries: 0,
      requestTimeoutMs: 15000,
      runGetMethodCacheTtlMs: 15000,
      runGetMethodCacheMaxEntries: 512,
    },
  },
  vault: {
    address: 'UQB9bp-qwLPBX8BA312KKTBFVrfFZwxjzEuZfJFgYSu1YfZm',
    deploymentManifestHash: '570b3ba74eff150ce3317b35f190d8f5053f000dcfb331c0c3c1a31e46b7a234',
    provider: {
      globalName: 'plathoVaultChainProvider',
      moduleUrl: './vault-ton-rpc-provider.mjs?v=20',
      exportName: 'default',
      unavailableStatus: 'provider required',
      requiredInProduction: true,
    },
  },
  tonDns: {
    rootAddress: '-1:e56754f83426f69b09267bd876ac97c44821345b7e266bd956a7bfbfb98df35c',
    provider: {
      globalName: 'plathoTonDnsProvider',
      moduleUrl: './ton-dns-provider.mjs?v=11',
      exportName: 'default',
      unavailableStatus: 'TON DNS provider required',
      requiredInProduction: true,
    },
  },
  capsuleHub: {
    address: 'UQBgFJQvewAICmABKDysX1-i-nrdLsZlJX-efaNEWXnfEWwG',
    publicReadLimit: 128,
  },
  ath: {
    masterAddress: 'UQBYtK4_sxTw2Z7bp8DuzQ2Nz09MWU7nmcHmPzovsUN9v087',
  },
  usernameRegistry: {
    address: 'UQBT1BIkKWCHrqL6tXKw5aUMXJjFbDNrcEVzpzCRxJ8Cf3ls',
  },
  profileRegistry: {
    address: 'UQC4ncVFmD7s4xX7Q-lsjE9hyvaOrtXlNfi_Gha97NDQwUN0',
  },
  crypto: {
    signedBundlePurpose: 'pwa-mainnet-preview',
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
