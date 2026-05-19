# Platho v1 Open Values Profile: UsernameNFTItem M8

**Document status:** accepted implementation profile for UsernameNFTItem milestone 8  
**Base spec:** `platho_v1_spec_v0_3_3_deployment_ath_binding.md`  
**Rule:** if behavior is not pinned here or in the base v1 spec, it is not part of this milestone.

---

## 1. Scope

This profile fixes only the standalone `UsernameNFTItem` artifact needed before implementing `UsernameRegistry` mint finalization.

Implemented now:

```text
UsernameNFTItem StateInit data profile
UsernameNFTItem deterministic address derivation vectors
UsernameNFTItem.ResendDeployedAck
UsernameNFTItem.TopUpStorageReserve
UsernameNFTItem getter for immutable state inspection
```

Not implemented in this milestone:

```text
UsernameRegistry
UsernameRegistry official ATH wallet binding
UsernameRegistry mint / refund / treasury / burn due flows
UsernameNFTItem deploy gas reserve finalization
Username transfer/seize/revoke/admin paths
```

No new admin, owner override, pause, upgrade, governance, rescue, fallback, adapter, migration hook, or compatibility path is introduced.

---

## 2. UsernameNFTItem StateInit Data

The `UsernameNFTItem` initial data cell is:

```text
UsernameNFTItemDataV1 {
  owner_wallet: MsgAddress
  username_registry_address: MsgAddress
  name_hash: uint256
}
```

Rules:

```text
name_hash != 0
owner_wallet is immutable
username_registry_address is immutable
name_hash is immutable
```

The item does not store mutable owner state in M8. The immutable owner field is the source used in the deployed ACK sent back to the registry. Full registry-side mint/finalization rules remain in `UsernameRegistry`.

---

## 3. Deterministic Item Derivation

For a username item:

```text
item_data = build_username_nft_item_data(
  owner_wallet = owner_wallet,
  username_registry_address = UsernameRegistry address,
  name_hash = name_hash
)

item_state_init = StateInit {
  code = USERNAME_NFT_ITEM_CODE_CELL,
  data = item_data
}

username_item_address = addr_std(
  workchain_id = owner_wallet.workchain_id,
  account_id = cell_hash(item_state_init)
)
```

The default workchain is the owner wallet workchain for this milestone's vectors. If registry deployment later requires another workchain policy, that policy must be pinned before registry freeze and reflected in vectors.

---

## 4. Deployed ACK Resend

`UsernameNFTItem.ResendDeployedAck = 0x639CFC6C` is permissionless.

On `ResendDeployedAck`, the item sends to immutable `username_registry_address`:

```text
UsernameRegistry.UsernameItemDeployedAck = 0xBBA3EC19 {
  name_hash: uint256
  owner_wallet: MsgAddress
}
```

The ACK body is derived only from immutable item state.

`ResendDeployedAck` grants no ownership, transfer, mint, burn, treasury, refund, or admin rights.

The resend message uses:

```text
bounce = true
mode = SendRemainingValue
```

The caller funds the resend attempt. The item does not debit or mutate accounting buckets.

---

## 5. Storage Top-Up

`UsernameNFTItem.TopUpStorageReserve = 0x27ACDF8B` accepts TON for storage reserve only.

It must not mutate:

```text
owner_wallet
username_registry_address
name_hash
```

---

## 6. Rejected Behavior

The item rejects empty fallback messages.

The item has no:

```text
owner transfer
admin transfer
seize
revoke
pause
upgrade
rescue
fallback
metadata mutation
registry mutation
```

---

## 7. Test Vector Obligations

Before registry freeze, vectors must include:

```text
USERNAME_NFT_ITEM_CODE_HASH
owner_wallet
username_registry_address
name_hash
item_data_cell_hash
item_state_init_hash
derived_item_address
```

M8 generates fixture vectors for:

```text
platho
larisa
testname in masterchain workchain
```

These are deterministic implementation vectors, not final production registry deployment vectors.
