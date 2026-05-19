# Platho v1 Open Values v0.20Z — Deployment Spec Consistency Cleanup

Status: documentation / generated artifact cleanup after M20W/M20Y.

## Scope

M20Z does not change contract code, runtime behavior, tokenomics, or message surfaces.

M20Z fixes stale deployment documentation and generated vectors that still described the pre-M20W Vault ATH-wallet binding flow as if Vault were deployed with a generic placeholder official ATH wallet and `genesis_config_hash = 0 / 1` sentinel semantics.

That description became stale after M20W hardened genesis binding and M20X/M20Y reused `genesis_config_hash` post-seal for the Vault activity-airdrop remaining bucket.

## Current Vault genesis binding truth

Before seal:

```text
vault_ath_wallet_address = genesis_controller_address
genesis_config_hash = hash(genesis_controller_address)
sealed = false
deployment_manifest_hash = 0
```

The `vault_ath_wallet_address` storage slot is intentionally overloaded only before seal. It temporarily stores the one-shot genesis controller address so `BindOfficialAthWallet` can be authenticated without adding a new persisted Vault field and without breaking the external session gas profile.

During `BindOfficialAthWallet`:

```text
sender == genesis_controller_address
deployment_manifest_hash matches / initializes canonical manifest hash
vault_ath_wallet_address := official Vault ATH wallet
```

During `SealGenesis`:

```text
sender == genesis_controller_address
capsule_hub_bound == true
deployment_manifest_hash matches
sealed := true
genesis_config_hash := vault_activity_airdrop_total_atomic
```

After seal:

```text
vault_ath_wallet_address = official Vault ATH wallet
deployment_manifest_hash = canonical sealed signing/deployment domain
genesis_config_hash = airdrop_remaining_ath
```

The one-shot genesis controller has no post-seal runtime authority.

## Generated artifact cleanup

M20Z updates:

- `scripts/generate_deployment_ath_binding_vectors.ts`
- `scripts/deployment_manifest_m15.ts`
- `artifacts/deployment_ath_wallet_binding_vectors.json`
- `artifacts/deployment_manifest_implemented_subset_m15.json`
- `artifacts/DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15_HASH.txt`
- `artifacts/platho_v1_open_values_v0_7_deployment_ath_binding.md`

The implemented-subset manifest no longer exposes the stale `vault_initial_ath_wallet_placeholder` label. It now exposes:

```text
vault_initial_controller_slot
vault_initial_genesis_controller
vault_official_ath_wallet
```

## Non-goals

M20Z does not:

- change Vault code;
- change CapsuleHub code;
- change UsernameRegistry code;
- change FeeAccumulator code;
- change the 30% activity airdrop bucket;
- change the 10 ATH reward rule;
- enable production BuybackBurn;
- mark STON.fi route freeze as ready;
- create any admin/rescue/governance surface.
