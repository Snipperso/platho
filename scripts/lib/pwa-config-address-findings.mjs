
export const CLEAN18_CEREMONY_RECORD = 'artifacts/mainnet_clean18_ceremony.json';

export function pwaConfigAddressFindings({ config, manifest, clean18, writesGeneration }) {
  const findings = [];
  const flip = Number(writesGeneration) >= 18;
  if (flip && !clean18?.addresses) {
    findings.push({
      id: 'CLEAN18_CEREMONY_RECORD_MISSING',
      file: CLEAN18_CEREMONY_RECORD,
      message: 'This build writes generation 18, so its registry and gate must be checked against the clean-18 ceremony record.',
    });
  }
  const genesisSource = 'the verified final genesis manifest';
  const ceremonySource = `the clean-18 ceremony record (${CLEAN18_CEREMONY_RECORD})`;
  const checks = [
    ['PWA_ATH_MASTER_ADDRESS_MISMATCH', 'ath.masterAddress', config?.ath?.masterAddress, manifest?.addresses?.ath_master, genesisSource],
    ['PWA_USERNAME_REGISTRY_ADDRESS_MISMATCH', 'usernameRegistry.address', config?.usernameRegistry?.address, manifest?.addresses?.username_registry, genesisSource],
    ...(flip
      ? [
        ['PWA_PROFILE_REGISTRY_ADDRESS_MISMATCH', 'profileRegistry.address', config?.profileRegistry?.address, clean18?.addresses?.profile_registry, ceremonySource],
        ['PWA_PROFILE_REGISTRY_PREDECESSOR_MISMATCH', 'profileRegistry.predecessorAddress', config?.profileRegistry?.predecessorAddress, manifest?.addresses?.profile_registry, genesisSource],
        ['PWA_MODERATION_GATE_ADDRESS_MISMATCH', 'moderationGate.address', config?.moderationGate?.address, clean18?.addresses?.moderation_gate, ceremonySource],
      ]
      : [['PWA_PROFILE_REGISTRY_ADDRESS_MISMATCH', 'profileRegistry.address', config?.profileRegistry?.address, manifest?.addresses?.profile_registry, genesisSource]]),
  ];
  for (const [id, field, actual, expected, source] of checks) {
    if (!actual || !expected || actual !== expected) {
      findings.push({ id, file: 'web/platho-config.mjs', message: `PWA ${field} must match the address in ${source}.` });
    }
  }
  return findings;
}
