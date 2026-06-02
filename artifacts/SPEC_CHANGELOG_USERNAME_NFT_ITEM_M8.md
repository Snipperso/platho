# Spec Changelog: UsernameNFTItem M8

Accepted a narrow UsernameNFTItem implementation profile without expanding UsernameRegistry behavior.

## Added

- Historical M8 note, superseded by final transferable username NFT semantics:
  `UsernameNFTItemDataV1 { initialized, owner_wallet, username_registry_address, name_hash, username_len, username }`
  and item address derivation is registry + name hash only; current owner is mutable through `NftTransfer`.
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
- No seize, revoke, admin transfer, upgrade, pause, or rescue behavior exists. Final v1 adds standard owner-only
  `NftTransfer` so usernames can be sold or moved as normal NFTs.
