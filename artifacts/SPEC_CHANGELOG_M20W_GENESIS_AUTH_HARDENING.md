# SPEC CHANGELOG — M20W Genesis Auth Hardening

## Summary

M20W closes a deployment-phase critical issue where pre-seal genesis binding messages could be sent by arbitrary accounts before the official deploy flow completed.

## Changed

### Vault

- Added pre-seal genesis controller authentication to:
  - `BindDeploymentManifest`
  - `BindOfficialAthWallet`
  - `SealGenesis`
- Uses `genesis_config_hash` as a temporary hash commitment to the controller address before seal.
- Final `SealGenesis` replaces the temporary controller hash with the canonical deployment manifest hash.
- Avoids adding a persisted controller field to preserve external inbound pre-accept gas profile.

### CapsuleHub

- Added init-time `genesis_controller_address`.
- Added controller authentication to:
  - `BindDeploymentManifest`
  - `SealGenesis`
- Exposed `genesis_controller_address` in the state view for deterministic verification.

### UsernameRegistry

- Added init-time `genesis_controller_address`.
- Added controller authentication to:
  - `BindOfficialAthWallet`
  - `SealGenesis`
- Made official ATH wallet binding explicitly one-shot.
- Exposed `genesis_controller_address` in the global state view.

### Tests

- Added `tests/deployment-genesis-auth.test.ts`.
- Updated init vectors and deployment-manifest tests for the one-shot genesis controller.
- Updated generated deployment/gas/conformance artifacts.

## Unchanged

- FeeAccumulator 51.05 TON buyback envelope semantics.
- BuybackBurn remains not implemented for production.
- STON.fi route freeze remains blocked.
- No runtime admin/governance/pause/rescue/rebind surface added.
