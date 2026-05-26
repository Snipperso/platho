# CapsuleHub ACK Backing Hardening - 2026-05-17

Status: implemented and locally verified.

## Summary

This pass covers `CapsuleHub` and the shared Vault publish max-charge constant in `Vault`.

Fixed:

- accepted Vault publishes no longer return the whole remaining inbound value with ACK;
- CapsuleHub now retains backing for `accrued_plato_fee_ton`, execution/storage reserves, keepalive, entry storage, and charged page storage;
- ACK value is limited to `CAPSULEHUB_ACK_FORWARD_RESERVE = 30,000,000` nanotons (`0.030 TON`); after Vault processes that ACK, the user is credited roughly `28,000,000` nanotons in internal Vault TON balance, while later final v1 PWA surcharge above canonical required value is retained by CapsuleHub as network/storage reserve overage;
- `CAPSULEHUB_ACK_FORWARD_RESERVE` increased from `0.001 TON` to `0.030 TON` in both `CapsuleHub` and `Vault`, because the lower reserve could leave Vault unable to process a successful publish ACK.

## Updated Tests

Added coverage:

```text
CAPSULE-VAULT-BACKING-01: Vault publish retains protocol fee backing instead of returning it as ACK excess
CAPSULE-BND-01..03: direct and Vault publish min-1/exact reserve boundaries
CAPSULE-AUTH-01..04: bind/seal authority, unsealed/forged publish rejection, spoof/invalid publish rejection
CAPSULE-INV-01: deterministic state-machine invariant walk across direct/Vault publish and flush bounce paths
```

## Verification

```text
npm run build: PASS
CapsuleHub/Vault ACK regression suite: 7 files passed, 32 tests passed
Vault focused suite: 11 files passed, 40 tests passed
M17 gas reserve report: PASS
M16 conformance: PASS
M18 artifact integrity: PASS
npm test: 44 files passed, 172 tests passed
npm audit --omit=dev: found 0 vulnerabilities
```

## Current Hashes After ATH Revalidation

```text
CAPSULEHUB_CODE_HASH=2522af15971a775b873a335c6637e961ab8a54d29446738f7c8390449c5c6cf6
VAULT_CODE_HASH=ec268816c42d788b55bd171a32b81d40073cb7f242c48138d521185508914353
IMPLEMENTED_SUBSET_MANIFEST_HASH=a1eecf7c96cc2bd7fdf88cf460d418b431c6d97649c05a0bd93a185c3935765f
```

Current linked hashes:

```text
ATH_WALLET_CODE_HASH=a4ca0258ce36f72c4bab250c5ead87bc6db1b0ebe3832bad8c6961efaaedc730
ATHMASTER_CODE_HASH=33e4c62fa48e4f6d8b3b93a00e025485c18a6b81efcd055768508c215b88cfbf
USERNAME_NFT_ITEM_CODE_HASH=23f13b3c91120c089244c411b855c69a71a42bc0244740e1cc6c266f71c1f1ea
USERNAME_REGISTRY_CODE_HASH=6cc5a428588f43a706047ea2ae6595726596b17ee54c8703cdc9c8239a6d0742
```

## Residual Notes

This pass does not add admin, pause, upgrade, rescue, migration, ignored-error sends, or compatibility paths.

It also does not close final genesis blockers outside CapsuleHub/Vault, including BuybackBurn and STON.fi production route gates.
