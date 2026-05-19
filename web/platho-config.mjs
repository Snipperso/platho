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
  tonConnect: {
    manifestUrl: './tonconnect-manifest.json',
    insecureOriginManifestUrl: 'https://platho.app/tonconnect-manifest.json',
    expectedDomain: 'platho.app',
  },
  vault: {
    address: null,
    provider: {
      globalName: 'plathoVaultChainProvider',
      moduleUrl: null,
      exportName: 'default',
      unavailableStatus: 'provider required',
      requiredInProduction: true,
    },
  },
  crypto: {
    signedBundlePurpose: 'pwa-preview',
  },
  ui: {
    brandNetworkLabel: 'testnet',
    chatCountLabel: '3 active threads',
    publicSubtitle: 'latest capsules',
    vaultSubtitle: 'testnet account',
    profileHandle: '@platho',
    identityName: 'platho.ton',
    identitySubtitle: 'username NFT pending',
    walletLabel: 'v4r2 testnet',
    networkLabel: 'testnet',
    localStateLabel: 'device only',
    publicFeed: [
      {
        meta: ['platho.eth', 'sealed', '1h'],
        title: 'Route evidence waits for on-chain proof',
        text: 'Testnet funding is accumulating for the M20T probe. Production BuybackBurn remains locked.',
      },
      {
        meta: ['vault', 'public', '4h'],
        title: 'ATH wallet reserve hardening passed',
        text: 'Boundary checks cover internal transfers, notify flow, and burn notifications.',
      },
      {
        meta: ['capsulehub', 'ack', 'yesterday'],
        compact: true,
        text: 'ACK reserve and fee backing remain pinned after the final pass.',
      },
    ],
    vaultCards: [
      { label: 'TON', value: '5.9999', caption: 'available' },
      { label: 'ATH', value: '0', caption: 'official wallet' },
      { label: 'M20T', value: '49.0', caption: 'TON left', tone: 'warn' },
    ],
    vaultActions: [
      { label: 'Deposit', icon: 'down' },
      { label: 'Withdraw', icon: 'up' },
      { label: 'Top up', icon: 'bolt' },
    ],
    ledgerRows: [
      { tone: 'green', title: 'Faucet received', detail: '2 TON from testgiver', value: '+2.000' },
      { tone: 'cyan', title: 'Readiness artifact', detail: 'scaled harness ready', value: 'ready' },
      { tone: 'amber', title: 'Full-size M20T', detail: 'needs 55 TON minimum', value: 'locked' },
    ],
  },
  preview: {
    threads: [
      {
        id: 'ari',
        name: 'Ari',
        avatar: 'A',
        subtitle: 'sealed 2 min ago',
        time: '00:41',
        state: 'sealed',
        preview: 'M20T scaled harness is ready.',
        messages: [
          { type: 'system', text: 'session key rotated', meta: 'local' },
          { type: 'in', text: 'Faucet landed. We can run the scaled probe now.', meta: '00:37' },
          { type: 'out', text: 'Keep full-size locked until the 55 TON threshold.', meta: 'sealed' },
          { type: 'in', text: 'Agreed. No route freeze shortcuts.', meta: '00:41' },
        ],
      },
      {
        id: 'vault',
        name: 'Vault Ops',
        avatar: 'V',
        subtitle: 'testnet wallet',
        time: '00:35',
        state: 'ready',
        preview: 'Balance 5.999999996 TON.',
        messages: [
          { type: 'system', text: 'wallet v4r2 linked', meta: 'testnet' },
          { type: 'in', text: 'Scaled harness minimum is covered.', meta: '00:33' },
          { type: 'out', text: 'Full-size M20T still needs 49.000000004 TON.', meta: 'sent' },
        ],
      },
      {
        id: 'audit',
        name: 'Audit Trail',
        avatar: 'T',
        subtitle: '50 files passed',
        time: '00:42',
        state: 'green',
        preview: 'Full suite: 192 tests.',
        messages: [
          { type: 'in', text: 'ATH reserve hardening frozen.', meta: 'green' },
          { type: 'in', text: 'BuybackBurn remains blocked pending M20T and M20F.', meta: 'locked' },
          { type: 'out', text: 'Keep the readiness flags false.', meta: 'sealed' },
        ],
      },
      {
        id: 'route',
        name: 'STON.fi Route',
        avatar: 'S',
        subtitle: 'mainnet evidence missing',
        time: 'yday',
        state: 'locked',
        preview: 'Need on-chain route proof and refund checks.',
        messages: [
          { type: 'system', text: 'mainnet route freeze is not ready', meta: 'M20F' },
          { type: 'in', text: 'No production BuybackBurn until route evidence passes.', meta: 'policy' },
        ],
      },
    ],
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
  }

  return {
    ok: findings.length === 0,
    mode,
    findings,
  };
}
