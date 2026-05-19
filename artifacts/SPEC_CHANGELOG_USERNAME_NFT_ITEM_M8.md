# Spec Changelog: UsernameNFTItem M8

Accepted a narrow UsernameNFTItem implementation profile without expanding UsernameRegistry behavior.

## Added

- `UsernameNFTItemDataV1 { owner_wallet, username_registry_address, name_hash }`
- deterministic item address derivation formula
- `UsernameNFTItem.ResendDeployedAck` outbound ACK body:
  - `name_hash:uint256`
  - `owner_wallet:MsgAddress`
- `UsernameNFTItem.TopUpStorageReserve` no-authority behavior
- M8 vector obligations

## Not changed

- UsernameRegistry mint finalization remains unimplemented.
- UsernameRegistry due buckets remain unimplemented.
- Username NFT item deploy reserve remains not final.
- No transfer/seize/revoke/admin behavior exists.
