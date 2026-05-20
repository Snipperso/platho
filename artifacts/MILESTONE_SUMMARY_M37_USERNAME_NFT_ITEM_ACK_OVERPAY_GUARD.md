# M37 UsernameNFTItem ACK Overpay Guard

Status: PASS.

This milestone closes the local Low value-flow finding where a permissionless
`ResendDeployedAck` caller could attach a large TON value and have the excess
retained in the `UsernameNFTItem` balance.

## Change

- `UsernameNFTItem.ResendDeployedAck` keeps the existing minimum funding check.
- Added a maximum accepted resend value of `20_000_000` nanotons.
- The maximum preserves the existing `UsernameRegistry` deploy-and-ACK path,
  which funds the item with the pinned `USERNAME_NFT_ITEM_DEPLOY_RESERVE`.
- Oversized recovery sends such as `0.05 TON` now reject instead of becoming
  item storage donation.

## Verification

- `npm.cmd run build`: PASS.
- Focused tests:
  `tests\username-nft-item.test.ts`,
  `tests\username-registry-boundary-negative.test.ts`,
  `tests\username-registry-paid-mint.test.ts`,
  `tests\username-registry-prune-pending-mint.test.ts`: 4 files / 20 tests PASS.
- `scripts/conformance_m16.ts`: PASS.
- `scripts/artifact_integrity_m18.ts`: PASS.
- `npm.cmd test`: 67 files / 283 tests PASS.

## Updated Hashes

- `USERNAME_NFT_ITEM_CODE_HASH=bf2735f371ba1eaa77fd37c8eaab847fac40e2357d2e7850c9e444dc3b00df1e`
- `USERNAME_REGISTRY_CODE_HASH=0c4aaf8fd4c5c0d2bed14a8979454d11ed0a38a67d87cf18adc6bdeeeb06d92b`
- `DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15_HASH=2d73f3908e64af8443172376fc096555136d152b589ee60412c09eefd0c241cd`

## Production Note

The implemented-subset manifest is still non-final. Mainnet deployment remains
blocked until route, funding, address, and final-genesis evidence is complete.
