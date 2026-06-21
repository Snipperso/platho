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
      // CLIENT-DIRECT RPC (no central gateway). Each client carries its OWN per-client budget:
      //  - orbs-keyless  : keyless decentralized Orbs network, PRIMARY for non-indexed
      //                    reads/account/sendBoc (per-client budget, censorship-resistant, no key).
      //  - user-toncenter: the user's OWN free toncenter API key (10 rps), injected at runtime from
      //                    local storage. Carries the message-history indexer + reads/send.
      //  - keyless-toncenter: anonymous toncenter, last-resort only (weak/throttled).
      // verifyCriticalReads stays false: message bodies self-verify against CapsuleHub hashes, so a
      // single (even untrusted) provider read cannot poison them; routine cross-verify would burn the
      // per-user budget for no security gain.
      primaryProviderId: 'orbs-keyless',
      fallbackProviderIds: ['user-toncenter', 'keyless-toncenter'],
      verifyCriticalReads: false,
      criticalMethods: [...REQUIRED_TON_RPC_CRITICAL_METHODS],
      providers: [
        {
          id: 'orbs-keyless',
          kind: 'ton-access-v2',
          // No message-history indexer; getMessages reads route to a keyed toncenter provider.
        },
        {
          id: 'user-toncenter',
          kind: 'toncenter-v3',
          // The toncenter API key is the user's own free key, injected at runtime via
          // globalThis.plathoToncenterApiKey. When absent the transport runs anonymous (degraded).
          useUserApiKey: true,
          runGetMethodEndpoint: 'https://toncenter.com/api/v3/runGetMethod',
          sendBocEndpoint: 'https://toncenter.com/api/v3/message',
          messagesEndpoint: 'https://toncenter.com/api/v3/messages',
          walletBalanceEndpoint: 'https://toncenter.com/api/v2/getAddressInformation',
          requestSpacingMs: 100,
        },
        {
          id: 'keyless-toncenter',
          kind: 'toncenter-v3',
          verifierOnly: true,
          emergencyFallback: true,
          runGetMethodEndpoint: 'https://toncenter.com/api/v3/runGetMethod',
          sendBocEndpoint: 'https://toncenter.com/api/v3/message',
          messagesEndpoint: 'https://toncenter.com/api/v3/messages',
          walletBalanceEndpoint: 'https://toncenter.com/api/v2/getAddressInformation',
          requestSpacingMs: 1500,
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
      moduleUrl: './vault-ton-rpc-provider.mjs?v=48',
      exportName: 'default',
      unavailableStatus: 'provider required',
      requiredInProduction: true,
    },
  },
  tonDns: {
    rootAddress: '-1:e56754f83426f69b09267bd876ac97c44821345b7e266bd956a7bfbfb98df35c',
    provider: {
      globalName: 'plathoTonDnsProvider',
      moduleUrl: './ton-dns-provider.mjs?v=28',
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
      name: 'platho',
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

// Client-direct architecture guard. Clients talk to TON only through CANONICAL decentralized / public
// endpoints — Orbs (TON Access) for the keyless decentralized path and toncenter.com for the per-user-key
// indexer. ANY other RPC host is a central proxy/gateway: a single point to block or DoS, which the
// client-direct model exists to remove. Enforced as a host ALLOW-LIST (the principle) rather than a
// blacklist of one retired hostname, so it also catches any future central proxy.
function tonRpcEndpointHost(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    const host = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split('/')[0].split(':')[0].toLowerCase();
    return host || null;
  }
}

function isCanonicalTonRpcHost(host) {
  const h = String(host ?? '').toLowerCase();
  return h === 'ton.access.orbs.network' || h.endsWith('.orbs.network')
    || h === 'toncenter.com' || h.endsWith('.toncenter.com');
}

function tonRpcProviderEndpointHosts(provider) {
  return [
    provider?.runGetMethodEndpoint,
    provider?.endpoint,
    provider?.sendBocEndpoint,
    provider?.messagesEndpoint,
    provider?.walletBalanceEndpoint,
    provider?.accountEndpoint,
    provider?.tonAccessHost,
  ].map(tonRpcEndpointHost).filter((host) => host !== null);
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
          'Production PWA config must include a verifier-only emergency fallback provider with read, send, and message-history endpoints so the messenger survives when the primary transports are unreachable.',
        );
      }
      // Client-direct model: each client carries its own per-client RPC budget, so a keyless
      // decentralized provider (Orbs / TON Access) must exist for the no-key / censored survival path.
      const hasKeylessDecentralizedProvider = tonRpcProviders.some((rpcProvider) => (
        ['ton-access-v2', 'ton-access', 'orbs'].includes(String(rpcProvider?.kind ?? '').toLowerCase())
      ));
      if (!hasKeylessDecentralizedProvider) {
        addFinding(
          findings,
          'PWA_TON_RPC_KEYLESS_DECENTRALIZED_REQUIRED',
          'Production PWA config must include a keyless decentralized TON RPC provider (Orbs / TON Access) so reads and sends survive without a per-user API key.',
        );
      }
      // No provider may route through a central RPC proxy/gateway: every explicit endpoint host must be a
      // canonical decentralized/public TON host (Orbs or toncenter.com), so there is no single host to
      // block or DoS. Principle-based (host allow-list) — supersedes and generalizes the retired central
      // gateway ban.
      for (const rpcProvider of tonRpcProviders) {
        const routesThroughCentralProxy = tonRpcProviderEndpointHosts(rpcProvider)
          .some((host) => !isCanonicalTonRpcHost(host));
        if (routesThroughCentralProxy) {
          addFinding(
            findings,
            'PWA_TON_RPC_CENTRAL_GATEWAY_FORBIDDEN',
            'Production PWA must not route through a central RPC proxy/gateway; every provider endpoint must be a canonical decentralized/public TON host (Orbs ton.access.orbs.network or toncenter.com), so clients talk to TON directly with no central host to block or DoS.',
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
