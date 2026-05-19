# UsernameRegistry ACK Hardening - 2026-05-17

Status: implemented and locally verified.

## Summary

This hardening pass covers `UsernameRegistry` and `UsernameNFTItem`.

Fixed:

- accepted `AthTransferNotificationMintUsername` messages now send `AthTransferNotificationAck` back to the official ATH wallet after state is recorded;
- rejected-but-authenticated paid mint notifications now ACK after refund-due accounting is recorded;
- underfunded paid mint notifications cannot create partial registry state without ACK reserve;
- permissionless `UsernameNFTItem.ResendDeployedAck` now requires the caller to fund the fixed ACK reserve before the item sends the registry ACK;
- `UsernameNFTItem.ResendDeployedAck` uses `SendDefaultMode` for the fixed ACK value, preventing underfunded resend spam from draining the item storage reserve.

## Updated Constants

```text
USERNAME_ITEM_ACK_FORWARD_RESERVE_NANOTONS=3000000
USERNAME_ATH_NOTIFICATION_ACK_VALUE_NANOTONS=1000000
```

## Updated Tests

Added coverage:

```text
USERNAME-REG-M10-06: accepted official mint notification sends ATH notification ACK back to official wallet
USERNAME-REG-M10-07: rejected official mint notification still ACKs after recording refund due
USERNAME-REG-M10-08: underfunded official mint notification cannot strand state without ACK reserve
USERNAME-NFT-04: underfunded ResendDeployedAck is rejected to prevent storage-reserve drain
```

## Verification

```text
npm run build: PASS
UsernameRegistry/UsernameNFTItem suite: 6 files passed, 25 tests passed
M17 gas reserve report: PASS
M16 conformance: PASS
M18 artifact integrity: PASS
```

## Current Hashes After ATH Revalidation

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

## Residual Notes

This pass does not add admin, pause, upgrade, rescue, migration, or compatibility paths.

It also does not close final genesis blockers outside UsernameRegistry, including BuybackBurn and STON.fi production route gates.
