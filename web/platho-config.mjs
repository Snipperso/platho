export const PLATHO_APP_MODES = Object.freeze({
  PREVIEW: 'preview',
  TESTNET: 'testnet',
  PRODUCTION: 'production',
});

const PRODUCTION_MODE = PLATHO_APP_MODES.PRODUCTION;
const VALID_MODES = new Set(Object.values(PLATHO_APP_MODES));

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
    chain: 'testnet',
    label: 'testnet',
  },
  vault: {
    address: null,
    deploymentManifestHash: null,
    provider: {
      globalName: 'plathoVaultChainProvider',
      moduleUrl: null,
      exportName: 'default',
      unavailableStatus: 'provider required',
      requiredInProduction: true,
    },
  },
  tonDns: {
    rootAddress: null,
    provider: {
      globalName: 'plathoTonDnsProvider',
      moduleUrl: null,
      exportName: 'default',
      unavailableStatus: 'TON DNS provider required',
      requiredInProduction: true,
    },
  },
  capsuleHub: {
    address: null,
    publicReadLimit: 50,
  },
  ath: {
    masterAddress: null,
  },
  usernameRegistry: {
    address: null,
  },
  profileRegistry: {
    address: null,
  },
  crypto: {
    signedBundlePurpose: 'pwa-preview',
  },
  messaging: {
    pricing: {
      estimatedNetworkFeeNanotons: '5000000',
      includedNetworkFeeNanotons: '5000000',
      roundingStepNanotons: '1000000',
    },
  },
  publicChannels: [
    {
      id: 'platho.app',
      name: 'platho.app',
      avatar: 'P',
      subtitle: 'official read-only channel',
      sourceUrl: './channels/platho.app/feed.json',
    },
  ],
  ui: {
    brandNetworkLabel: 'testnet',
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
    walletLabel: 'v5r1 testnet',
    networkLabel: 'testnet',
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
  }

  return {
    ok: findings.length === 0,
    mode,
    findings,
  };
}
