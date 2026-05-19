# UsernameRegistry Freeze Summary - 2026-05-17

Status: FROZEN_LOCALLY_REVERIFIED_AFTER_ATH_EXEC_RESERVE_HARDENING

This freezes the current `UsernameRegistry` and `UsernameNFTItem` implementation after the local hardening pass.
The freeze was revalidated after ATHWallet/ATHMaster execution-reserve hardening changed ATH-linked code, StateInit, and deployment manifest hashes.

## Scope

Frozen scope:

- `contracts/UsernameRegistry.tact`
- `contracts/UsernameNFTItem.tact`
- paid username mint from official ATH wallet notification
- deterministic UsernameNFTItem deploy and ACK finalization
- refund due, treasury due, and burn due accounting
- refund/treasury/burn flush callback handling
- stale pending mint prune
- item ACK resend behavior

This is a local engineering freeze. It is not an independent audit, formal proof, or final genesis approval.

## Hardening Added

Added local coverage:

```text
USERNAME-REG-AUTH-NEG-01..04
USERNAME-REG-BND-01..04
USERNAME-REG-INV-01
```

These cover forged callbacks, min-1/exact-min value boundaries, and deterministic state-machine accounting walks.

## Final Verification

Commands completed successfully on 2026-05-17:

```text
npm run build
npm test -- tests/username-nft-item.test.ts tests/username-registry-foundation.test.ts tests/username-registry-paid-mint.test.ts tests/username-registry-refund-flush.test.ts tests/username-registry-due-flush.test.ts tests/username-registry-prune-pending-mint.test.ts tests/username-registry-boundary-negative.test.ts tests/username-registry-auth-negative-matrix.test.ts tests/username-registry-state-invariants.test.ts
npm test -- tests/m17-gas-reserve-sanity.test.ts tests/m18-artifact-integrity.test.ts tests/m16-conformance-static.test.ts tests/deployment-manifest-m15.test.ts
npm test
npm audit --omit=dev
```

Results:

```text
UsernameRegistry/UsernameNFTItem focused suite: 9 files passed, 34 tests passed
Conformance/artifact/gas/deployment suite: 4 files passed, 10 tests passed
Full suite: 41 files passed, 163 tests passed
npm audit --omit=dev: found 0 vulnerabilities
```

Post-ATH execution-reserve revalidation on 2026-05-17:

```text
Impacted ATH/Vault/Username suite: 11 files passed, 42 tests passed
Expanded ATH/artifact suite: 17 files passed, 59 tests passed
Full suite: 46 files passed, 178 tests passed
npm audit --omit=dev: found 0 vulnerabilities
```

Final rerun before freeze on 2026-05-17:

```text
npm run build: PASS
UsernameRegistry/UsernameNFTItem focused suite: 9 files passed, 34 tests passed
Conformance/artifact/gas/deployment suite: 4 files passed, 10 tests passed
Full suite: 41 files passed, 163 tests passed
npm audit --omit=dev: found 0 vulnerabilities
```

## Frozen Hashes

```text
USERNAME_NFT_ITEM_CODE_HASH=23f13b3c91120c089244c411b855c69a71a42bc0244740e1cc6c266f71c1f1ea
USERNAME_REGISTRY_CODE_HASH=6cc5a428588f43a706047ea2ae6595726596b17ee54c8703cdc9c8239a6d0742
IMPLEMENTED_SUBSET_MANIFEST_HASH=a1eecf7c96cc2bd7fdf88cf460d418b431c6d97649c05a0bd93a185c3935765f
```

Current linked hashes:

```text
ATH_WALLET_CODE_HASH=a4ca0258ce36f72c4bab250c5ead87bc6db1b0ebe3832bad8c6961efaaedc730
VAULT_CODE_HASH=ec268816c42d788b55bd171a32b81d40073cb7f242c48138d521185508914353
```

## Residual Non-Code Gates

Before final genesis/mainnet release, these remain outside this local freeze:

- independent Tact/security review;
- testnet/mainnet gas envelope evidence;
- final storage-rent/economic policy for pending/refund state;
- final deployment manifest replacement of non-final global blockers;
- BuybackBurn and STON.fi production route gates where applicable.

## Freeze Rule

Any future change to frozen UsernameRegistry/UsernameNFTItem scope must reopen this freeze and repeat:

```text
npm run build
UsernameRegistry/UsernameNFTItem focused suite
Conformance/artifact/gas/deployment suite
npm test
npm audit --omit=dev
```
