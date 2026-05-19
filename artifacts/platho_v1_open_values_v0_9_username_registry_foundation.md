# Platho v1 Open Values Profile: UsernameRegistry Foundation M9

**Document status:** accepted implementation profile for UsernameRegistry foundation milestone 9  
**Base spec:** `platho_v1_spec_v0_3_3_deployment_ath_binding.md`  
**Companion previous profile:** `platho_v1_open_values_v0_8_username_nft_item.md`  
**Rule:** if behavior is not pinned here or in the base v1 spec/profile set, it is not part of this milestone.

---

## 1. Scope

Implemented now:

```text
UsernameRegistry contract artifact
UsernameRegistry official ATH wallet pre-seal binding
UsernameRegistry seal gate
UsernameRegistry global getter
UsernameRegistry username length price getter
UsernameRegistry deterministic UsernameNFTItem address getter
UsernameRegistry storage top-up receiver
```

Not implemented in this milestone:

```text
ATH-paid username minting
UsernameRegistry.AthTransferNotificationMintUsername exact payload
PendingUsernameMint creation/finalization
UsernameNFTItem deployment from registry
UsernameItemDeployedAck consumption by registry
NameRecord persistence
Treasury/burn due ATH accounting
ATH refund due accounting/flush
PrunePendingUsernameMint
final USERNAME_NFT_ITEM_DEPLOY_RESERVE
```

Reason:

```text
Full paid mint remains blocked until exact ATH transfer notification payload carrying raw username bytes is pinned.
A name_hash alone cannot prove lowercase ASCII / no unicode / no separators.
```

No admin, owner override, pause, upgrade, governance, rescue, fallback, adapter, migration hook, compatibility path, silent fallback behavior, or ignored-error money send mode is introduced.

---

## 2. UsernameRegistry New Opcode

```text
UsernameRegistry.BindOfficialAthWallet = 0x663DF03D
```

Derived from:

```text
first_32_bits(SHA256("PLATHO.V1.UsernameRegistry.BindOfficialAthWallet"))
```

Existing opcodes used:

```text
Global.SealGenesis = 0x3A12D1AD
UsernameRegistry.TopUpStorageReserve = 0x0ABA5F1D
```

---

## 3. UsernameRegistry State

```text
UsernameRegistryDataV1 {
  official_ath_wallet_address: MsgAddress
  official_ath_wallet_bound: Bool
  sealed: Bool
  deployment_manifest_hash: uint256
  genesis_config_hash: uint256
  name_record_count: uint64
  pending_mint_count: uint64
  refund_due_count: uint64
  treasury_due_ath: uint128
  burn_due_ath: uint128
}
```

M9 initializes all counts and due buckets to zero and does not mutate them.

---

## 4. Official ATH Wallet Binding

To avoid StateInit self-address circularity, UsernameRegistry follows the same pre-seal deployment-only binding pattern as Vault.

Deployment flow:

```text
1. Deploy UsernameRegistry unsealed with placeholder official_ath_wallet_address.
2. Compute UsernameRegistry address from StateInit.
3. Deployment verifier derives official ATH wallet from:
   owner = UsernameRegistry address
   ATH master
   ATH wallet code hash
   ATH wallet derivation formula V1
4. Send UsernameRegistry.BindOfficialAthWallet(deployment_manifest_hash, official_ath_wallet_address).
5. Send Global.SealGenesis(deployment_manifest_hash).
```

`BindOfficialAthWallet` requires:

```text
sealed == false
deployment_manifest_hash > 1
```

It sets:

```text
self.deployment_manifest_hash = deployment_manifest_hash
self.genesis_config_hash = 1
self.official_ath_wallet_address = official_ath_wallet_address
self.official_ath_wallet_bound = true
```

`SealGenesis` requires:

```text
sealed == false
deployment_manifest_hash > 1
self.deployment_manifest_hash == deployment_manifest_hash
self.official_ath_wallet_bound == true
```

It sets:

```text
self.genesis_config_hash = deployment_manifest_hash
self.sealed = true
```

Post-seal binding is rejected forever.

---

## 5. Username Price Getter

M9 exposes `get_username_price(name_len)` only for pinned length tiers:

```text
1-3 chars: invalid, price = 0
4 chars: 10_000 ATH = 10_000_000_000_000 atomic ATH
5 chars: 1_000 ATH = 1_000_000_000_000 atomic ATH
6+ chars: 100 ATH = 100_000_000_000 atomic ATH
```

This getter does not validate character bytes. Full mint must validate raw username bytes after the exact mint payload is pinned.

---

## 6. UsernameNFTItem Derivation Getter

M9 exposes:

```text
get_username_item_address(owner_wallet, name_hash) -> username_item_address
```

Formula:

```text
item_data = UsernameNFTItemDataV1 {
  owner_wallet,
  username_registry_address = this UsernameRegistry address,
  name_hash
}

item_state_init = StateInit {
  code = USERNAME_NFT_ITEM_CODE_CELL,
  data = item_data
}

username_item_address = addr_std(
  workchain_id = owner_wallet.workchain_id,
  account_id = cell_hash(item_state_init)
)
```

`name_hash == 0` is rejected.

---

## 7. Storage Top-Up

`UsernameRegistry.TopUpStorageReserve = 0x0ABA5F1D` accepts TON for storage only.

It must not mutate:

```text
official_ath_wallet_address
official_ath_wallet_bound
sealed
deployment_manifest_hash
genesis_config_hash
name_record_count
pending_mint_count
refund_due_count
treasury_due_ath
burn_due_ath
```

---

## 8. Test Vector Obligations

Generated vector artifact:

```text
artifacts/username_registry_foundation_vectors.json
```

Includes:

```text
USERNAME_REGISTRY_CODE_HASH
USERNAME_NFT_ITEM_CODE_HASH
ATH_WALLET_CODE_HASH
UsernameRegistry initial StateInit hash
UsernameRegistry initial address
UsernameRegistry official ATH wallet derivation fixture
username item address vectors for basechain and masterchain owners
price tier vectors
```

---

## 9. Blocker Status

Unblocked now:

```text
UsernameRegistry foundation artifact
UsernameRegistry official ATH wallet binding profile
UsernameRegistry deterministic item address getter
UsernameRegistry length-price tier getter
```

Still blocked / not implemented:

```text
UsernameRegistry paid mint flow
AthTransferNotificationMintUsername exact payload
raw username byte serialization
UsernameNFTItem deploy reserve finalization
PendingUsernameMint prune TTL
Treasury/burn/refund due ATH flushes
BuybackBurn STON.fi route
```
