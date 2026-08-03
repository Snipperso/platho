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
  // Retired methods are deliberately ABSENT — leaving one here would silently demand verification of a call
  // nothing makes. Gone with their contracts: get_user / get_key_record / get_user_receipts /
  // get_canonical_publish_charge / get_ath_withdrawal_id / get_pending_ath_withdrawal_for (Vault),
  // get_private_entry / get_private_recipient_index / get_private_sender_index / get_private_page /
  // get_public_entry / get_public_page (CapsuleHub), get_name_record (UsernameRegistry.name_records),
  // get_avatar / get_avatar_version (ProfileRegistry's per-profile maps). Both registries now answer WHERE the
  // per-user contract is, and the record itself is read from that contract — get_view on the wallet's KeyShard.
  'get_username_item_address',
  'get_key_shard_address',
  'get_view',
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
      // CLIENT-DIRECT RPC, TONCENTER-ONLY (no central gateway, no Orbs). Each client carries its OWN
      // per-client budget:
      //  - user-toncenter   : the user's OWN free toncenter v3 key (10 rps), injected at runtime via
      //                       globalThis.plathoToncenterApiKey. PRIMARY for ALL reads/account/sendBoc +
      //                       the message-history indexer. When the key is absent the transport runs
      //                       anonymous (~1 rps, 429-prone) but STAYS a non-emergency primary — it is
      //                       NOT demoted to verifierOnly (see ton-rpc-transport.mjs userKeyMissing);
      //                       demoting it would leave zero live primaries once Orbs is gone -> perpetual
      //                       "syncing". Onboarding nudges the user to add a key.
      //  - keyless-toncenter: anonymous toncenter, EMERGENCY/last-resort only (weak/throttled, ~1 rps).
      // Orbs (ton-access-v2) was removed: it is stuck on toncenter API v2 (no v3 indexer / normalized
      // hash to confirm a just-sent message) and lags the post-2026-04 sub-second chain, so as the
      // primary read it stalled confirmations. Both transports are now the same toncenter.com backend
      // (keyed vs anonymous), so there is NO independent second source: verifyCriticalReads stays false
      // and the hot path self-trusts the lone non-emergency primary (message bodies still self-verify
      // against CapsuleHub hashes, so a single provider read cannot poison them). This is a weaker
      // censorship posture than the old decentralized-Orbs fallback — an explicit, owner-approved trade
      // for usability (toncenter.com reachable; if it is ever blocked there is no decentralized fallback).
      primaryProviderId: 'user-toncenter',
      fallbackProviderIds: ['keyless-toncenter'],
      verifyCriticalReads: false,
      criticalMethods: [...REQUIRED_TON_RPC_CRITICAL_METHODS],
      providers: [
        {
          id: 'user-toncenter',
          kind: 'toncenter-v3',
          useUserApiKey: true,
          runGetMethodEndpoint: 'https://toncenter.com/api/v3/runGetMethod',
          sendBocEndpoint: 'https://toncenter.com/api/v3/message',
          messagesEndpoint: 'https://toncenter.com/api/v3/messages',
          walletBalanceEndpoint: 'https://toncenter.com/api/v3/addressInformation',
          // 125ms = 8 rps, a 20% margin under the 10 rps free-key cap. toncenter rate-limits per-second with
          // NO burst grace, so a flat 100ms (=10 rps, zero margin) sporadically tips to 11/sec on jitter -> 429.
          requestSpacingMs: 125,
          // Shared limiter key (see keyless-toncenter): forces the keyed primary and the keyless emergency into
          // ONE single-worker request pump so they can NEVER fire two simultaneous connections to toncenter.com
          // from one IP. iOS WebKit stalls its run loop on parallel connections (the iPhone freeze); the per-task
          // spacing is preserved, so keyed reads keep their 125ms (8 rps) cadence inside the shared queue.
          rateLimitKey: 'toncenter-shared',
        },
        {
          id: 'keyless-toncenter',
          kind: 'toncenter-v3',
          // verifierOnly + emergencyFallback are LOAD-BEARING: they keep this same-backend anonymous
          // source out of the routine verifier role (it would otherwise self-compare against the keyed
          // primary and fail closed). Do NOT drop these flags.
          verifierOnly: true,
          emergencyFallback: true,
          runGetMethodEndpoint: 'https://toncenter.com/api/v3/runGetMethod',
          sendBocEndpoint: 'https://toncenter.com/api/v3/message',
          messagesEndpoint: 'https://toncenter.com/api/v3/messages',
          // 1100ms = ~0.91 rps, the "forsazh" anonymous pacing (shares the #F per-IP budget with a no-key
          // user-toncenter; see TONCENTER_KEYLESS_REQUEST_SPACING_MS). Was 1500ms/0.67 rps.
          requestSpacingMs: 1100,
          // SAME key as user-toncenter -> one shared single-worker pump (no parallel keyed+keyless connections on
          // iOS). This is STRICTER than toncenter's own buckets (keyed per-key, anonymous per-IP) need, but that is
          // the point: serialize on the client so two fetches never race the WebKit run loop. Keyless keeps its own
          // 1100ms per-task spacing. Do NOT split these back into separate keys without re-checking the iPhone freeze.
          rateLimitKey: 'toncenter-shared',
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
  tonDns: {
    rootAddress: '-1:e56754f83426f69b09267bd876ac97c44821345b7e266bd956a7bfbfb98df35c',
    provider: {
      globalName: 'plathoTonDnsProvider',
      moduleUrl: './ton-dns-provider.mjs?v=44',
      exportName: 'default',
      unavailableStatus: 'TON DNS provider required',
      requiredInProduction: true,
    },
  },
  // clean-17 public/avatar lane. DIRECT-PAY is the shipping path: public posts publish straight from the wallet into
  // the author's CHANNEL PublicShard (PPH2, StateInit-lazy-deploy) and the feed reads those shards via public-lane.
  // [CUTOVER 2026-07-24] clean-15 has zero live users and balances are withdrawn — the Vault/CapsuleHub batch path is
  // being removed (capsulehub-vault-removal-plan phase 3), so this defaults ON. On-chain correctness is validated by a
  // live run against the clean-17 PublicShard genesis; the sandbox proves the message + deploy figures.
  publicLane: {
    directPay: true,
  },
  // clean-17 private lane (CONV messages / INTRO first contact / RECOVERY durability). DIRECT-PAY is the shipping path:
  // messages publish straight from the wallet into the shards, first contact is scanned stealthily off IntroShard, and
  // the pairwise K_root is adopted into the local conv key store. [CUTOVER 2026-07-24] see publicLane — Vault path removed.
  privateLane: {
    directPay: true,
  },
  // The genesis this client build claims. It is the DOMAIN SEPARATOR for signed publishes and the value the release
  // guard binds to the verified-genesis evidence (artifacts/mainnet_genesis_verify_input.json): a production bundle
  // that names a different genesis than the one that was verified must not ship. It used to live under `vault` —
  // the contract is gone, the release property is not, so it moved to its own block.
  // [CUTOVER 2026-08-02] Repointed from the clean-15 genesis to clean-17, sealed on mainnet the same day. These five
  // values are not derived from anything the build can recompute — they name a chain that exists — so they move by
  // hand, once, after the seals land, and tests/pwa-runtime-config.test.ts pins every one of them.
  genesis: {
    deploymentManifestHash: 'ccee504c6b94773e68550dff3a071107f34609b0fdb17be9fad8ab224d482f49',
  },
  feeAccumulator: {
    address: 'UQAgWSAucibv2D3SOIhL1wKFwg27wIRkeiObu5uxgOfNpLNB',
  },
  ath: {
    masterAddress: 'UQCThzitzPXm2dH9psaVkZlkAcHqzCJjcBpD29b5closNbd7',
  },
  // [ADDED 2026-08-03] The airdrop pool, so the client can finally answer "how much of the activity airdrop has been
  // distributed". That figure used to come from the Vault global; under clean-17 it lives here, and until the genesis
  // ceremony sealed there was no address to configure — which is why the profile row rendered a dash and said so.
  airdropPool: {
    address: 'UQBa1zD7DySeGO4crmeB7ZAuDu1xDRE6DIOsYfFFYke4Y-xL',
  },
  usernameRegistry: {
    address: 'UQBR-Ujp5676B3xTiqQ77R2OIjZYBn1GxUvI8V3bmHVV0F_W',
  },
  profileRegistry: {
    address: 'UQD6tZwZRgWhKv0jzTSN2qyq00ANGR29LVInsFkXwALRKL31',
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
    walletSubtitle: 'Wallet',
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

// Client-direct architecture guard. Clients talk to TON only through the canonical public toncenter.com
// host (per-user key + anonymous fallback). ANY other RPC host is a central proxy/gateway: a single point
// to block or DoS, which the client-direct model exists to remove. Enforced as a host ALLOW-LIST (the
// principle) rather than a blacklist of one retired hostname, so it also catches any future central proxy.
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
  return h === 'toncenter.com' || h.endsWith('.toncenter.com');
}

function tonRpcProviderEndpointHosts(provider) {
  return [
    provider?.runGetMethodEndpoint,
    provider?.endpoint,
    provider?.sendBocEndpoint,
    provider?.messagesEndpoint,
    provider?.walletBalanceEndpoint,
    provider?.accountEndpoint,
  ].map(tonRpcEndpointHost).filter((host) => host !== null);
}

export function validatePlathoAppConfig(config = PLATHO_APP_CONFIG) {
  const findings = [];
  const mode = config?.mode;

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
    // (The "name a static chain provider module" requirement went with the Vault's runtime-injected provider
    // bridge. Every clean-17 reader — KeyShard, ProfileRegistry, username, ATH, PublicShard — is a STATIC import
    // in app.js, so there is no provider to configure and none that can be silently missing in a production bundle.)
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
      // No provider may route through a central RPC proxy/gateway: every explicit endpoint host must be
      // the canonical public toncenter.com host, so there is no single bespoke host to block or DoS.
      // Principle-based (host allow-list) — supersedes and generalizes the retired central gateway ban.
      // (The old "must have a keyless decentralized Orbs provider" guard was removed with the toncenter-only
      // switch; the emergency-fallback rule above still guarantees a keyless survival transport.)
      for (const rpcProvider of tonRpcProviders) {
        const routesThroughCentralProxy = tonRpcProviderEndpointHosts(rpcProvider)
          .some((host) => !isCanonicalTonRpcHost(host));
        if (routesThroughCentralProxy) {
          addFinding(
            findings,
            'PWA_TON_RPC_CENTRAL_GATEWAY_FORBIDDEN',
            'Production PWA must not route through a central RPC proxy/gateway; every provider endpoint must be the canonical public TON host (toncenter.com), so clients talk to TON directly with no central host to block or DoS.',
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
    if (!config?.genesis?.deploymentManifestHash) {
      addFinding(
        findings,
        'PWA_GENESIS_DEPLOYMENT_MANIFEST_HASH_REQUIRED',
        'Production PWA config must set genesis deploymentManifestHash for domain-separated signed publishes.',
      );
    }
    if (!config?.feeAccumulator?.address) {
      addFinding(
        findings,
        'PWA_FEE_ACCUMULATOR_ADDRESS_REQUIRED',
        'Production PWA config must set FeeAccumulator address — every direct-pay publish routes its fee through it.',
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
  }

  return {
    ok: findings.length === 0,
    mode,
    findings,
  };
}
