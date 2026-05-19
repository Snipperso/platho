# Platho v1 Open Values Update v0.18: Artifact Integrity & Reproducibility Lock

**Status:** accepted implemented-subset profile  
**Scope:** generated artifacts, vectors, code hashes, and implemented-subset manifest only  
**Contract code changed:** no  
**Functional surface added:** no

## 1. Purpose

M18 prevents stale generated artifacts from surviving after code hash changes.

The following artifacts MUST be reproducible from the current repository state before any later milestone is accepted:

```text
CURRENT_CODE_HASHES.txt
individual *_CODE_HASH.txt files
ath_wallet_derivation_vectors.json
deployment_ath_wallet_binding_vectors.json
username_nft_item_vectors.json
username_registry_foundation_vectors.json
username_registry_mint_vectors.json
deployment_manifest_implemented_subset_m15.json
m16_conformance_report.json
m17_gas_reserve_sanity_report.json
```

## 2. Deterministic timestamp rule

Generated JSON artifacts MUST NOT depend on wall-clock time for acceptance.

If a generator needs a timestamp-like field, the deterministic artifact value is:

```text
DETERMINISTIC_ARTIFACT
```

The M18 lock normalizes JSON object key order and treats `generated_at` and `generated_at_utc` as deterministic artifact fields.

## 3. Hash consistency rule

For each production contract:

```text
cell_hash(compiled code BOC) == corresponding *_CODE_HASH.txt == CURRENT_CODE_HASHES.txt entry
```

This applies to:

```text
ATHMaster
ATHWallet
CapsuleHub
FeeAccumulator
Vault
UsernameNFTItem
UsernameRegistry
```

Mock hashes may be tracked for test reproducibility, but they are not production genesis commitments.

## 4. Vector freshness rule

Generated vectors MUST use current built code hashes.

Specifically:

```text
ATH wallet derivation vectors use current ATH_WALLET_CODE_HASH
Deployment ATH binding vectors use current ATH_WALLET_CODE_HASH
UsernameNFTItem vectors use current USERNAME_NFT_ITEM_CODE_HASH
UsernameRegistry foundation vectors use current ATH wallet / item / registry hashes
UsernameRegistry mint vectors use current ATH wallet / item / registry hashes
```

The UsernameRegistry mint vector profile is updated to reflect the M13 ACK reserve change:

```text
USERNAME_ITEM_ACK_FORWARD_RESERVE_NANOTONS = 3_000_000
```

## 5. Manifest consistency rule

The implemented-subset manifest is valid only if:

```text
stored JSON manifest == rebuilt manifest from current compiled artifacts
stored manifest hash == rebuilt manifest hash
manifest status == IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS
blockers_before_final_genesis is non-empty
```

M18 does not make the manifest final.

## 6. Remaining final-genesis blockers

```text
BUYBACK_BURN_CONTRACT_NOT_IMPLEMENTED_UNTIL_STONFI_ROUTE_VALUES_ARE_PINNED
STONFI_V2_ROUTE_AND_PAYLOAD_VALUES_NOT_PINNED
FINAL_DEPLOYMENT_MANIFEST_MUST_REPLACE_BUYBACK_BLOCKED_ADDRESS_WITH_REAL_BUYBACKBURN_STATEINIT_ADDRESS
```
