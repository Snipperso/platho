# Platho v1 Open Values v0.20W — Genesis Auth Hardening

Status: implemented and locally verified in targeted/chunked regression matrix.

## Scope

M20W hardens the pre-seal genesis binding phase for the currently implemented contracts that accept one-shot deployment binding messages.

The milestone fixes the audit finding:

- **C-DEPLOY-01**: permissionless pre-seal genesis binding could be captured by the first arbitrary sender before `SealGenesis`.

Affected contracts:

- `Vault`
- `CapsuleHub`
- `UsernameRegistry`

## Security goal

Pre-seal binding remains a one-time deployment fuse, not an admin/governance surface.

Allowed:

- one-shot deployment controller authority while `sealed == false`;
- binding the expected immutable counterpart/official wallet addresses;
- sealing the contract into final runtime mode.

Forbidden:

- arbitrary sender binding;
- arbitrary sender sealing;
- post-seal controller authority;
- rebind/override/pause/rescue/governance functions;
- changing runtime payment/tokenomics semantics.

## Vault design note

`Vault` is gas-sensitive on its external session path. Adding a persisted controller address field increased external-session pre-accept gas and risked exceeding TON external inbound credit before `acceptMessage()`.

Therefore `Vault` uses the existing `genesis_config_hash` field as a temporary pre-seal commitment to the genesis controller address:

- before seal: `genesis_config_hash = hash(genesis_controller_address)`;
- pre-seal binding handlers require `hash(sender()) == genesis_config_hash`;
- `BindOfficialAthWallet` replaces the placeholder/controller wallet address with the official ATH wallet address;
- `SealGenesis` requires that the official ATH wallet is already bound, then replaces `genesis_config_hash` with the canonical deployment manifest hash;
- after seal: controller has no remaining authority.

This preserves the external-session gas profile while closing the pre-seal capture window.

## CapsuleHub design note

`CapsuleHub` now stores an immutable `genesis_controller_address` in init data and requires it for:

- `BindDeploymentManifest`
- `SealGenesis`

This authority is usable only while unsealed.

## UsernameRegistry design note

`UsernameRegistry` now stores an immutable `genesis_controller_address` in init data and requires it for:

- `BindOfficialAthWallet`
- `SealGenesis`

`BindOfficialAthWallet` is also explicitly one-shot:

- official ATH wallet must not already be bound;
- genesis config must not already be finalized;
- deployment manifest hash must be compatible with the current pending manifest state.

## Non-goals

M20W does not:

- implement production `BuybackBurn`;
- enable `STONFI_ROUTE_FREEZE_READY`;
- enable `BUYBACKBURN_IMPLEMENTATION_READY`;
- change FeeAccumulator 51.05 TON buyback envelope semantics;
- change runtime admin/governance model;
- introduce upgrade/pause/rescue/rebind surfaces.

## Hash changes

Changed code hashes:

- `VAULT_CODE_HASH=98582cf0f2f99d74e095be6dc2b01f511d161983ccf930b2521a42cd69fc1720`
- `CAPSULEHUB_CODE_HASH=d66f03836f43f3e425e0ef0fcf3e65c0f20f364f12a89e4f84960fed15eb5298`
- `USERNAME_REGISTRY_CODE_HASH=0d7c89a953a966deb6f8b6000b902de92907dcfa772b7ac905b65d3b5a06396e`

Unchanged relevant code hash:

- `FEEACCUMULATOR_CODE_HASH=21c767d17e11146315e13834e6d6fabedb484a7964be6cf72e3f72d4401ec423`

Updated implemented subset manifest hash:

- `6819b11b8b2fb6a7361793c2db049ad62629e144ec9096669e070fb8013b1e7a`

## Verification

Chunked/local regression matrix covered all 34 test files and 142 tests.

One-shot `npm test` was not used as the proof artifact in this sandbox because the full Vitest run can hang/time out around process teardown before final summary. M20W uses explicit targeted and chunked proof artifacts instead.
