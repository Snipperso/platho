# Platho v1 Spec Changelog: Deployment ATH Wallet Binding M7

Status: accepted implementation profile.

## Problem found

The previous ATH seal wording required each ATH-notification contract to store its official ATH wallet address in initial StateInit and then prove at seal that:

```text
stored_ath_wallet_address == derive_ath_wallet_address(owner_address = this_contract_address)
```

For self-owned official jetton wallets this creates a circular address dependency:

```text
Vault address = hash(Vault StateInit(vault_ath_wallet_address))
vault_ath_wallet_address = hash(ATHWallet StateInit(owner = Vault address))
```

Changing `vault_ath_wallet_address` inside Vault StateInit changes the Vault address, which changes the derived official ATH wallet again. The new test `DEPLOY-ATH-BIND-00` proves this with actual compiled artifacts.

## Accepted change

`Vault` uses a deployment-only pre-seal binding step for its official ATH wallet:

```text
Vault.BindOfficialAthWallet = 0x18DB2CCB
```

Binding profile:

```text
1. Deploy Vault unsealed with a placeholder ATH wallet address.
2. Compute Vault address from that initial StateInit.
3. Derive official ATH wallet using:
   owner_address = Vault address
   ath_master_address = deployed ATH Master address
   ATH_WALLET_CODE_HASH = compiled ATH Wallet code cell hash
   ATH_WALLET_DERIVATION_FORMULA_V1
4. Deployment verifier proves the derived address.
5. Send Vault.BindOfficialAthWallet before OP_SEAL_GENESIS.
6. OP_SEAL_GENESIS requires the binding to have happened.
7. Post-seal rebinding is rejected forever.
```

## Compactness rationale

The alternative was carrying ATH wallet code / derivation machinery in every dependent contract and doing derivation on-chain during seal. That bloats code and still does not solve the StateInit self-address circularity cleanly.

The accepted profile keeps contracts compact:

```text
- deployment verifier performs derivation proof off-chain
- Vault stores only the final official ATH wallet address after address exists
- runtime ATH notifications still require msg.sender == stored_official_ath_wallet_address
- no post-seal mutation path exists
```

## Non-changes

No admin, owner override, pause, upgrade, governance, rescue, fallback, compatibility route, migration hook, silent fallback behavior, or ignored-error send mode was introduced.

## Scope

Implemented now:

```text
Vault official ATH wallet pre-seal binding
Vault seal requires ATH wallet binding
Vault post-seal official ATH wallet rebinding rejected
Deployment ATH wallet binding vectors
```

Not implemented now:

```text
BuybackBurn official ATH wallet binding
UsernameRegistry official ATH wallet binding
Treasury ATH receiver binding
BuybackBurn
UsernameRegistry
STON.fi route
Vault.PrunePendingPublish
```
