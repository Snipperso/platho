# SPEC CHANGELOG — M20Z Deployment Spec Consistency

## Changed

- Updated the deployment ATH wallet binding profile to match the M20W genesis-controller hardening.
- Replaced stale `genesis_config_hash = 0 / 1` Vault binding sentinel language with the current semantics:
  - pre-seal: `hash(genesis_controller_address)`;
  - post-seal: `airdrop_remaining_ath`.
- Updated deployment ATH wallet vectors to say the initial Vault slot stores the one-shot genesis controller, not a generic ATH wallet placeholder.
- Updated the implemented-subset manifest labels:
  - removed stale `vault_initial_ath_wallet_placeholder`;
  - added `vault_initial_controller_slot`.

## Unchanged

- No contract code changed.
- No tests changed.
- No runtime behavior changed.
- Vault activity airdrop remains `30,000,000 ATH` total and `10 ATH` per successful paid publish.
- `STONFI_ROUTE_FREEZE_READY=false` remains unchanged.
- `BUYBACKBURN_IMPLEMENTATION_READY=false` remains unchanged.
