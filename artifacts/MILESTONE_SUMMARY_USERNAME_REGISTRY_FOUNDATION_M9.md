# Milestone Summary: UsernameRegistry Foundation M9

Implemented the compact UsernameRegistry foundation layer.

## Implemented

```text
contracts/UsernameRegistry.tact
tests/username-registry-foundation.test.ts
scripts/generate_username_registry_foundation_vectors.ts
artifacts/platho_v1_open_values_v0_9_username_registry_foundation.md
artifacts/SPEC_CHANGELOG_USERNAME_REGISTRY_FOUNDATION_M9.md
artifacts/username_registry_foundation_vectors.json
artifacts/USERNAME_REGISTRY_CODE_HASH.txt
```

## Covered Behavior

```text
- price getter for pinned username length tiers
- reject 1-3 char names at price/profile level
- deterministic UsernameNFTItem address getter
- owner workchain is used for item address derivation
- UsernameRegistry official ATH wallet pre-seal binding
- seal requires binding
- post-seal binding rejected forever
- storage top-up grants no authority and mutates no protocol accounting
```

## Tests Added

```text
USERNAME-REG-M9-01: price getter enforces pinned name length tiers without accepting 1-3 char names
USERNAME-REG-M9-02: get_username_item_address equals local UsernameNFTItem StateInit derivation
USERNAME-REG-M9-03: item derivation follows owner workchain, including masterchain owner fixture
USERNAME-REG-M9-04: official ATH wallet binds before seal and cannot be changed after seal
USERNAME-REG-M9-05: seal fails without official ATH wallet binding and storage top-up grants no authority
```

## Test Result

```text
Test Files: 14 passed
Tests: 71 passed
```

## Still Not Implemented

```text
ATH-paid username minting
AthTransferNotificationMintUsername exact payload
PendingUsernameMint creation/finalization
UsernameNFTItem deployment from registry
UsernameItemDeployedAck consumption by registry
NameRecord persistence
Treasury/burn/refund due ATH buckets and flushes
PrunePendingUsernameMint
final USERNAME_NFT_ITEM_DEPLOY_RESERVE
BuybackBurn
STON.fi route
```

## Current Code Hashes

See `artifacts/CURRENT_CODE_HASHES.txt`.
