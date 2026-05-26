# M21A — Vault activity airdrop economic safety audit

## Summary

M21A audited the new Vault activity airdrop money path after M20Y/M20Z.

No reproducible runtime C/H/M issue was found in the checked Vault airdrop logic.

A final-genesis evidence blocker was added because the Vault cannot verify its own ATH wallet backing balance at runtime. Final genesis must require proof that the official Vault ATH wallet is funded with the full 15,000,000 ATH activity airdrop allocation.

## Changes

- Added manifest blocker:
  - `VAULT_ACTIVITY_AIRDROP_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_VAULT_ATH_WALLET_BEFORE_FINAL_GENESIS`
- Added/strengthened tests around:
  - manifest airdrop constants;
  - manifest blocker;
  - airdrop discount side effect;
  - no reward on prune;
  - no reward on late ACK after prune.

## Verification

- Build: PASS
- Targeted M21A tests: 3 files / 8 tests / EXIT=0
- Chunked full matrix: 34 files / 143 tests / 0 failed chunks
- Production dependency audit: `npm audit --omit=dev` found 0 vulnerabilities

## Hashes

- Contract code hashes unchanged from M20Z.
- Implemented-subset manifest hash changed due to blocker addition:
  - `a56272fd369561163b09e842a22a5ebb9a3789ab566da99d293d02efe2ee29af`
