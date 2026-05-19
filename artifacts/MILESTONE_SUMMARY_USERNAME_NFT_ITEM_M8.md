# Platho v1 UsernameNFTItem M8 Summary

## Scope

Implemented the standalone `UsernameNFTItem` layer needed before implementing `UsernameRegistry` mint finalization.

This milestone intentionally does **not** implement `UsernameRegistry`, ATH-paid minting, refund due buckets, treasury/burn due buckets, NFT deploy gas reserve finalization, or UsernameRegistry official ATH wallet binding.

## Implemented

- `contracts/UsernameNFTItem.tact`
- Immutable `owner_wallet`, `username_registry_address`, `name_hash`
- `UsernameNFTItem.ResendDeployedAck = 0x639CFC6C`
- `UsernameNFTItem.TopUpStorageReserve = 0x27ACDF8B`
- outbound `UsernameRegistry.UsernameItemDeployedAck = 0xBBA3EC19`
- deterministic StateInit/address vectors
- test mock `contracts/MockUsernameRegistryAckSink.tact`
- tests in `tests/username-nft-item.test.ts`

## Invariants covered

- deterministic StateInit derivation binds owner/registry/name_hash
- ACK resend is permissionless and sends immutable owner/name identity
- storage top-up grants no authority and does not mutate identity
- empty fallback is rejected

## New tests

```text
USERNAME-NFT-01: item StateInit deterministically binds owner wallet, registry address, and name hash
USERNAME-NFT-02: ResendDeployedAck is permissionless and sends immutable owner/name identity to registry
USERNAME-NFT-03: TopUpStorageReserve grants no ownership/name mutation and empty fallback is rejected
```

## Verification

```text
npm run build: OK
npm audit --omit=dev --audit-level=high: found 0 vulnerabilities
npm test -- --reporter=dot: 13 files passed, 66 tests passed
```

## Code hashes

```text
ATH_WALLET_CODE_HASH=b94bf85fa69b23907e2dbd1940c6daad03f71ce36379a0f9cb1c63276d621918
ATHMASTER_CODE_HASH=ee5a80a35387ceafce2a89cc58fb94200152d19ee00347cff95ab1fb329abbcc
CAPSULEHUB_CODE_HASH=add81654c2263f725fcc93cf3c9caf3229c8f164870511b90f967174a953db85
FEEACCUMULATOR_CODE_HASH=ed272b10bc841ce09da511dbe3c10cffa89659791480d0390d3e7bbde08af503
MOCK_VAULT_ATH_WALLET_CODE_HASH=9dff854edded531aca8ae603427aa978f14ee45517b9ec97d51760b197353cad
VAULT_CODE_HASH=7509a56f5a0d38d0d2e0e6d26bcee39457de6b3d7372130db6e817933ad6b927
USERNAME_NFT_ITEM_CODE_HASH=a1420d87f4bf82814dc812f41062f9bdfbecb54b2fcc3982a2b86caf6fdd6a54
MOCK_USERNAME_REGISTRY_ACK_SINK_CODE_HASH=ac502ce67620fc9a9b973824a133e262bcd35312165125b4cf5d4f422fc5b7cb
```

## Still blocked / not implemented

```text
UsernameRegistry
UsernameRegistry official ATH wallet binding
USERNAME_NFT_ITEM_DEPLOY_RESERVE final gas value
BuybackBurn
STON.fi route values
Vault.PrunePendingPublish stale TTL
```
