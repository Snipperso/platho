# Platho v1 Open Values Profile v0.7: Deployment ATH Wallet Binding

**Document status:** accepted implementation profile  
**Companion:** `platho_v1_spec_v0_3_2_vault_m6_aligned.md`  
**Rule:** if behavior is not pinned here or in the main spec/profile set, it is not part of Platho v1.

---

## 1. New opcode

```text
Vault.BindOfficialAthWallet = 0x18DB2CCB
```

Derived from:

```text
first_32_bits(SHA256("PLATHO.V1.Vault.BindOfficialAthWallet"))
```

---

## 2. Why pre-seal ATH wallet binding exists

A contract official ATH wallet is derived from the contract address:

```text
official_ath_wallet = derive_ath_wallet_address(owner_address = contract_address)
```

But contract address is derived from the contract StateInit. Therefore, storing the final official ATH wallet address directly inside StateInit creates a self-address circularity:

```text
contract_address = hash(StateInit(stored_official_ath_wallet))
stored_official_ath_wallet = hash(ATHWallet StateInit(owner = contract_address))
```

This profile fixes that by using deployment-only pre-seal binding after the contract address exists.

---

## 3. Vault official ATH wallet binding profile

Vault deployment uses the M20W hardened one-shot genesis controller profile:

```text
Vault.init(
  vault_ath_wallet_address = genesis_controller_address,
  capsule_hub_address = placeholder_or_bound_address,
  genesis_config_hash = hash(genesis_controller_address),
  capsule_hub_bound = false unless prebound,
  sealed = false,
  deployment_manifest_hash = 0
)
```

The `vault_ath_wallet_address` storage slot is intentionally overloaded only before seal: before `BindOfficialAthWallet`, it stores the one-shot genesis controller address so the controller can authenticate the ATH-wallet binding without adding a new persisted Vault field. This is a deployment-only gas-preservation tradeoff. After `BindOfficialAthWallet`, the same slot stores the real official Vault ATH wallet forever.

Then deployment verifier computes:

```text
vault_address = contractAddress(workchain, Vault initial StateInit)

vault_official_ath_wallet = derive_ath_wallet_address(
  owner_address = vault_address,
  ath_master = ATH_MASTER_ADDRESS,
  wallet_code_hash = ATH_WALLET_CODE_HASH,
  wallet_derivation_formula = ATH_WALLET_DERIVATION_FORMULA_V1
)
```

Then, before seal, only the one-shot genesis controller may send:

```text
Vault.BindOfficialAthWallet(
  deployment_manifest_hash,
  official_ath_wallet_address = vault_official_ath_wallet
)
```

Vault stores `official_ath_wallet_address` as immutable post-seal runtime truth. Arbitrary senders must not be able to bind or seal genesis state.

---

## 4. Seal requirements

`Vault.OP_SEAL_GENESIS` must reject unless:

```text
deployment_manifest_hash > 1
self.deployment_manifest_hash == deployment_manifest_hash
capsule_hub_bound == true
official ATH wallet binding already happened
```

Implementation note after M20W/M20X/M20Y:

```text
Before seal:
  vault_ath_wallet_address = genesis_controller_address
  genesis_config_hash = hash(genesis_controller_address)

BindOfficialAthWallet:
  requires sender == genesis_controller_address
  stores the real official Vault ATH wallet in vault_ath_wallet_address

SealGenesis:
  requires sender == genesis_controller_address
  requires deployment_manifest_hash match
  requires CapsuleHub binding
  stores the activity-airdrop remaining bucket in genesis_config_hash

After seal:
  vault_ath_wallet_address = official Vault ATH wallet
  genesis_config_hash = airdrop_remaining_ath
  deployment_manifest_hash = canonical sealed signing/deployment domain
```

`deployment_manifest_hash > 1` remains required so deployment sentinel values cannot collide with a real genesis hash.

---

## 5. Runtime ATH notification check

Runtime behavior is unchanged:

```text
Vault accepts ATH transfer notifications only if:
msg.sender == stored_official_ath_wallet_address
```

Payload claims about master/owner/amount remain insufficient.

---

## 6. DEPLOY-04A interpretation

For Vault, `DEPLOY-04A` is satisfied by:

```text
- deployment verifier derives official ATH wallet after Vault address exists
- derived official ATH wallet is recorded in deployment manifest
- Vault.BindOfficialAthWallet stores that address before seal
- OP_SEAL_GENESIS rejects if binding did not happen
- post-seal rebinding is rejected forever
- runtime ATH notification sender check uses the stored address
```

The contract does not carry ATH wallet code or rederive the wallet on-chain during seal. That keeps Vault compact and avoids duplicating ATH wallet derivation logic inside every dependent contract.

---

## 7. Test vectors

Generated vector artifact:

```text
artifacts/deployment_ath_wallet_binding_vectors.json
```

Required fields:

```text
ath_master_address
ATH_WALLET_CODE_HASH / ath_wallet_code_cell_hash
vault_initial_address
vault_official_ath_wallet_address
vault_official_ath_wallet_data_cell_hash
vault_official_ath_wallet_state_init_hash
circular_stateinit_address_if_official_wallet_were_stored_initially
circularity_proof_address_changes == true
```

---

## 8. Blocker status

Unblocked now:

```text
Vault official ATH wallet deployment binding
Vault DEPLOY-04A profile without on-chain derivation bloat
```

Still blocked / not implemented:

```text
BuybackBurn official ATH wallet binding until BuybackBurn exists
UsernameRegistry official ATH wallet binding until UsernameRegistry exists
Treasury ATH receiver vector until treasury receiver profile/address is selected
STON.fi route values
Vault.PrunePendingPublish stale TTL
```
