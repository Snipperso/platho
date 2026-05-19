# Spec Changelog: UsernameRegistry Foundation M9

Accepted a narrow UsernameRegistry foundation profile without implementing the paid mint flow.

## Added

```text
UsernameRegistry.BindOfficialAthWallet = 0x663DF03D
UsernameRegistryDataV1 foundation state
UsernameRegistry official ATH wallet pre-seal binding profile
UsernameRegistry seal requirements
UsernameRegistry get_username_price(name_len)
UsernameRegistry get_username_item_address(owner_wallet, name_hash)
```

## Rationale

The full paid mint path cannot be implemented correctly from the current base spec alone because the exact `AthTransferNotificationMintUsername` payload is not pinned.

A `name_hash` alone is insufficient to prove:

```text
lowercase ASCII only
no unicode
no uppercase
no hyphen/underscore/dot/space
actual character length used for price
```

Therefore M9 implements only the parts that are fully pinned and testable.

## Explicitly Not Added

```text
admin / owner override / pause / upgrade / governance / rescue / fallback
compatibility paths
migration hooks
silent fallback behavior
ignored-error send mode
ATH-paid mint placeholders
fake PendingUsernameMint implementation
```
