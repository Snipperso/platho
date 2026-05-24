# Platho PWA Contract Interface Matrix

Date: 2026-05-22

Status: interface inventory for PWA/contract consistency work. This is not a mainnet production approval.

Purpose: list the contract entrypoints and getters that the production PWA must understand, then compare them with the current PWA implementation. The goal is to avoid deploying immutable contracts whose real user flows are only half-wired in the client.

## Current PWA Reality

The current PWA is mostly a cryptographic/static prototype plus local messenger UI:

- It creates/imports an embedded Platho wallet seed and deterministically derives both the TON wallet key and messaging keys from that seed.
- It derives and sends a `RegisterMessagingKeys` activation transaction through the embedded wallet.
- It can read Vault `get_user` and `get_key_record` through `web/vault-ton-rpc-provider.mjs`.
- It can persist the wallet seed, derive the local messaging identity, export/import the wallet seed, and build encrypted private capsule payload cells for on-chain publish.
- It has local encrypted message history, public channel subscriptions, recipient identity parsing, and message pricing policy.
- It has browser-safe Vault wallet-transaction builders for user-facing Vault messages, with body BoC checked against generated Tact wrappers.
- It has browser-safe ATHWallet and UsernameRegistry wallet-transaction builders for user-facing ATH transfer/deposit/burn/mint and username refund-flush messages, with body BoCs checked against generated Tact wrappers.
- It wires Vault UI actions for `DepositTon`, `WithdrawTon`, `WithdrawAth`, ATH deposit via user `ATHWallet`, `RegisterMessagingKeys`, `ReplaceMessagingKeys`, `RevokeSession`, username mint/refund, payment checks, and public channel publish.
- It wires normal external ATH wallet token actions for `ATHTransferRequest` and `ATHBurn`.
- It can build and sign Vault external private publish BoCs from encrypted capsule payload cells, using a local session key and `get_session_publish_hash`.
- It can build public post body payload cells (up to 1024 bytes), decode public body snake cells, sign Vault external public publish BoCs, expose a basic public publish button, and scan public entries from CapsuleHub when a CapsuleHub provider/address is configured.
- It can compress wallet avatar images into public avatar capsules, publish them through Vault/CapsuleHub, and pay the 100 ATH avatar pointer update through the user's ATHWallet into ProfileRegistry.
- It can call an injected/configured TON RPC `sendBoc` transport for external publish when the provider exposes it.
- It can auto-submit a `SetSession` / `DepositTon` / `TopUpMessageBudget` embedded-wallet transaction when budget/session is missing, then asks the user to publish after confirmation.
- It has a typed CapsuleHub RPC provider for private/public entry getters and hub state; public entry scan is wired into the public feed, and private entries are scanned/decrypted into encrypted local history when the local key can open them.
- It has typed ATHMaster/ATHWallet RPC providers for wallet derivation, jetton data, wallet balance, and pending notification reads.
- It has typed UsernameRegistry/UsernameNFTItem RPC providers for `.ath` price, record, pending/refund/due, registry global, and item-state reads.
- It wires basic `.ath` username mint and username refund flush actions in the profile pane.

Remaining gaps are UI/status polish rather than missing core user-facing contract sends.

## User-Facing Contract Sends The PWA Must Support

These are normal user flows. They should be implemented in the PWA, with tests, because they are not "manual misuse".

| Flow | Contract target | Message / entrypoint | Signer | PWA status | Notes |
|---|---|---|---|---|---|
| Register messaging keys | `Vault` | `RegisterMessagingKeys(enc_pubkey, sign_pubkey, pq_kem_pubkey_hash, pq_kem_pubkey_len, pq_kem_pubkey, crypto_suite_mask)` | user wallet | Basic UI + transaction builder | Profile action builds and sends an embedded-wallet transaction after reading `get_user`. Hybrid records store the full ML-KEM public key cell so other users can encrypt to this wallet using on-chain truth. |
| Rotate messaging keys | `Vault` | `ReplaceMessagingKeys(...)` | user wallet | Basic UI + transaction builder | Profile action sends the current locally derived key suite as the next on-chain key record. Old key record is revoked on-chain. |
| Deposit TON into Vault ledger | `Vault` | `DepositTon(amount)` | user wallet | Basic UI + transaction builder | Vault action prompts amount and sends exact current-user-aware attach value after reading `get_user`. |
| Withdraw TON from Vault ledger | `Vault` | `WithdrawTon(amount, recipient)` | user wallet | Basic UI + transaction builder | Vault action defaults recipient to connected wallet. |
| Create session key | `Vault` | `SetSession(session_pubkey, expires_at)` | user wallet | Basic composer integration + transaction builder | Required before external session publish. PWA generates/stores a local session key per Vault/wallet and sends `SetSession` when missing/stale. |
| Revoke session | `Vault` | `RevokeSession()` | user wallet | Basic UI + transaction builder | Profile action revokes the active session, clears the local session key, and moves remaining message budget back to `ton_balance`. |
| Top up message budget | `Vault` | `TopUpMessageBudget(amount)` | user wallet | Basic composer integration + transaction builder | Moves internal `ton_balance` into active message budget. Composer can submit deposit+session+topup setup for the exact needed maxCharge when budget is missing. |
| Publish private message | `Vault` external | `COMPACT_MAGIC` external session publish | session key, broadcast by PWA | External BoC builder + provider hook | PWA builds encrypted capsule cells, signs `get_session_publish_hash`, creates external publish BoC, and broadcasts if provider exposes `sendExternalMessage`. Needs confirmation/polling polish. |
| Publish public channel post | `Vault` external | same external publish, `publishKind = public` | session key, broadcast by PWA | Basic UI + payload/external BoC builder | Public body is raw PWA bytes, max `1024`, and final CapsuleHub send still comes from Vault. ATH discount applies only after the 15% activity-distribution gate. |
| Deposit ATH into Vault ledger | user `ATHWallet` | `ATHTransferRequestWithNotify(query_id, amount, recipient = Vault, response_destination = user, notify_destination = Vault, notify_value)` | user wallet to user ATHWallet | Basic UI + transaction builder | PWA derives the user's ATHWallet via `ATHMaster.get_wallet_address(owner)` and sends to that wallet. |
| Withdraw ATH from Vault ledger | `Vault` | `WithdrawAth(query_id, amount, recipient)` | user wallet | Basic UI + transaction builder | Vault sends from official Vault ATHWallet to recipient ATHWallet. PWA can now read pending withdrawal getter. |
| Transfer ATH to another owner | user `ATHWallet` | `ATHTransferRequest(query_id, amount, recipient, response_destination)` | user wallet to user ATHWallet | Basic UI + transaction builder | Normal ATH transfer from the user's external ATH wallet. |
| Burn own ATH | user `ATHWallet` | `ATHBurn(query_id, amount, response_destination)` | user wallet to user ATHWallet | Basic UI + transaction builder | Direct user burn from the user's external ATH wallet. Protocol burns are internal elsewhere. |
| Mint username | user `ATHWallet` | `ATHTransferRequestMintUsername(query_id, amount, recipient = UsernameRegistry, response_destination = user, notify_value, username_len, username)` | user wallet to user ATHWallet | Basic UI + transaction builder + quote/read provider | PWA quotes price via `UsernameRegistry.get_username_price` first and uses `.ath` names only. |
| Flush username refund | `UsernameRegistry` | `FlushAthRefundDue(query_id, owner_wallet)` | usually owner wallet | Basic UI + transaction builder + due/read provider | Needed if a username mint fails and refund due exists. |
| Set wallet avatar | user `ATHWallet` | `ATHTransferRequestProfileAvatar(query_id, amount = 100 ATH, recipient = ProfileRegistry, response_destination = user, notify_value, avatar_hash, avatar_entry_id, avatar_stream_id, avatar_part_count, media_format)` | user wallet to user ATHWallet | Basic UI + transaction builder | PWA first publishes public avatar capsule parts through Vault/CapsuleHub, then pays ProfileRegistry. ProfileRegistry records the authenticated pointer and splits 50 ATH treasury / 50 ATH burn due. |
| Create payment check | `Vault` | `CreateReceiveIntent(asset, amount, recipient_wallet, commitment, client_nonce)` | sender wallet | Basic composer UI + transaction builder + compact encrypted body | Uses internal Vault TON/ATH balance. Encrypted message body carries `asset, amount, intent_id, secret32`; no `tx`, activation time, or expiry. |
| Claim payment check | `Vault` | `ClaimReceiveIntent(intent_id, secret32)` | recipient wallet | Basic payment-message action + transaction builder | UI copy: "check already claimed or cancelled by sender" on failure. |
| Cancel payment check | `Vault` | `CancelReceiveIntent(intent_id)` | sender wallet | Basic payment-message action + transaction builder | Sender can cancel when they want; no activation-time logic. |

## User-Facing Read/Getters The PWA Must Support

These getters are needed for normal UI correctness.

| Area | Contract | Getter | PWA status | Needed for |
|---|---|---|---|---|
| Vault account | `Vault` | `get_user(owner)` | Implemented | TON balance, ATH balance, message budget, current key id. |
| Vault session | `Vault` | `get_session(owner)` | Implemented in provider | Active session id, nonce, expiry, budget mirror. Required before external publish. |
| Vault key record | `Vault` | `get_key_record(keyId)` | Implemented | Binding signed public bundle to on-chain key truth. |
| Vault receive intent | `Vault` | `get_receive_intent(intentId)` | Implemented in provider | Payment check status. |
| Vault receive intent id | `Vault` | `get_receive_intent_id(senderWallet, recipientWallet, asset, amount, clientNonce)` | Implemented in provider | Deterministic check id before/after creating a payment check. |
| Vault receive commitment | `Vault` | `get_receive_intent_commitment(intentId, recipientWallet, secret32)` | Implemented in provider | PWA can precompute/check commitment before send/claim. |
| Vault ATH withdrawal | `Vault` | `get_pending_ath_withdrawal_for(ownerWallet, queryId)` | Implemented in provider | Withdrawal pending status. |
| Vault pricing | `Vault` | `get_canonical_session_max_charge(owner, publishKind, sizeClass, cryptoSuite)` | Implemented in provider | Exact maxCharge for external publish and surcharge calculation. |
| Vault signature hash | `Vault` | `get_session_publish_hash(...)` | Implemented in provider | Optional cross-check/debug; PWA can compute locally but should be able to verify against chain ABI. |
| Vault global | `Vault` | `get_global()` | Implemented in provider | Config/status/debug. |
| Capsule private message | `CapsuleHub` | `get_private_entry(entryId)` | Basic chain scan + decrypt implemented | Read private message cells from chain, verify cell hashes/layout, decrypt if addressed to local key, and store in encrypted local history. |
| Capsule public post | `CapsuleHub` | `get_public_entry(entryId)` | Implemented in provider | Read public channel posts from chain. UI feed sync still needed. |
| Capsule counters | `CapsuleHub` | `get_state()` | Implemented in provider | Entry counts, accrued fee, sealed state. |
| ATH wallet address | `ATHMaster` | `get_wallet_address(owner_address)` | Implemented in provider | Derive user ATHWallet address for deposits, transfers, username mint. |
| ATH token data | `ATHMaster` | `get_jetton_data()` | Implemented in provider | Token supply/meta display. |
| ATH wallet balance | `ATHWallet` | `get_wallet_data()` | Implemented in provider | External ATH wallet balance/status. |
| ATH pending notification | `ATHWallet` | `get_pending_notification(query_id, sender_key)` | Implemented in provider | Recovery/debug for notify flows. |
| Username price | `UsernameRegistry` | `get_username_price(name_len)` | Implemented in provider | Quote exact ATH price before mint. |
| Username record | `UsernameRegistry` | `get_name_record(name_hash)` | Implemented in provider | Resolve `.ath` ownership and item address. |
| Username item address | `UsernameRegistry` | `get_username_item_address(owner_wallet, name_hash)` | Implemented in provider | Display/verification/debug. |
| Username pending mint | `UsernameRegistry` | `get_pending_mint(name_hash)` | Implemented in provider | Mint pending UI. |
| Username refund due | `UsernameRegistry` | `get_refund_due(owner_wallet)` | Implemented in provider | Show/flush refund due. |
| Username refund flush | `UsernameRegistry` | `get_refund_flush_id`, `get_pending_refund_flush_for` | Implemented in provider | Refund tracking. |
| Registry global | `UsernameRegistry` | `get_global()` | Implemented in provider | Prices/due/status dashboard. |
| Username NFT item | `UsernameNFTItem` | `get_state()` | Implemented in provider / optional UI | NFT item identity verification. |
| Profile avatar current | `ProfileRegistry` | `get_avatar(owner_wallet)` | Implemented in provider + PWA hydrate path | Resolve current wallet avatar pointer: version, hash, first entry id, stream id, part count, media format. |
| Profile avatar version | `ProfileRegistry` | `get_avatar_version(owner_wallet, version)` | Implemented in provider + PWA hydrate path | Historical avatar pointer for old posts/private headers that carry an older profile version. |
| Profile registry global | `ProfileRegistry` | `get_global()` | Implemented in provider | Avatar fee due buckets and deployment sanity. |

## Contract Entrypoints The Normal PWA Should Not Use Directly

These are contract-to-contract callbacks, operator flows, or maintenance paths. They may need scripts, dashboards, or release gates, but not normal messenger UX.

| Contract | Entrypoints | Classification |
|---|---|---|
| `ATHMaster` | `DeployTreasurySupply` | Genesis/operator only. |
| `ATHMaster` | `ATHBurnNotification` | Internal from ATHWallet. |
| `ATHWallet` | `ATHGenesisSupplyCredit`, `ATHInternalTransfer*`, `AthTransferNotificationAck`, bounced handlers | Internal. |
| `ATHWallet` | `PruneStaleNotification` | Permissionless maintenance/recovery, not default PWA UX. |
| `CapsuleHub` | `BindDeploymentManifest`, `SealGenesis` | Genesis/operator only. |
| `CapsuleHub` | `PublishPrivateFromVault`, `PublishPublicFromVault` | Internal from Vault only; PWA must not call directly. |
| `CapsuleHub` | `FlushFees` | Operator/keeper, not user PWA. |
| `CapsuleHub` | `TopUpStorageReserve` | Maintenance only. |
| `FeeAccumulator` | `DepositProtocolFee`, `SplitAccumulated`, `EnableBuybackSplit`, `FlushTreasuryDue`, `FlushBuybackDue`, `TopUpStorageReserve` | Protocol/keeper/operator. Not normal PWA. `EnableBuybackSplit` is the one-way 15% distribution / pool-launch gate. |
| `BuybackBurn` | `Bind*`, `SealBuybackBurnGenesis` | Genesis/operator only. Final genesis seals BuybackBurn before the STON.fi pool exists. |
| `BuybackBurn` | `FreezeBuybackRoute` | One-time post-pool launch operation after the 15% distribution gate; not normal PWA. |
| `BuybackBurn` | `AcceptBurnReserve`, `AthTransferNotification`, `ATHBurnFinalized`, `ATHBurnFailed` | Internal callbacks. |
| `BuybackBurn` | `ExecuteBuybackChunk`, `RetryAthBurnDue`, `RecoverStonfiRouteRefund`, `RecycleRouteRefundReserve` | Keeper/operator. Could be a separate ops panel, not core messenger PWA. |
| `UsernameRegistry` | `BindOfficialAthWallet`, `SealGenesis` | Genesis/operator only. |
| `UsernameRegistry` | `AthTransferNotificationMintUsername`, `UsernameItemDeployedAck`, `ATHTransferAck`, `ATHTransferFailed`, `ATHBurnFinalized`, `ATHBurnFailed` | Internal callbacks. |
| `UsernameRegistry` | `FlushTreasuryAthDue`, `FlushBurnAthDue` | Operator/keeper. |
| `UsernameRegistry` | `PrunePendingUsernameMint` | Permissionless maintenance/recovery, not default PWA UX. |
| `UsernameRegistry` | `UsernameRegistryTopUpStorageReserve` | Maintenance only. |
| `UsernameNFTItem` | `ResendDeployedAck` | Recovery/manual path. Current audit matrix keeps `UNFT-01` acknowledged; do not expose casually in PWA. |
| `UsernameNFTItem` | `TopUpStorageReserve` | Maintenance only. |
| `ProfileRegistry` | `BindProfileOfficialAthWallet`, `SealGenesis` | Genesis/operator only. |
| `ProfileRegistry` | `AthTransferNotificationProfileAvatar`, `ATHTransferAck`, `ATHTransferFailed`, `ATHBurnFinalized`, `ATHBurnFailed` | Internal callbacks. |
| `ProfileRegistry` | `FlushProfileTreasuryAthDue`, `FlushProfileBurnAthDue` | Operator/keeper. |
| `ProfileRegistry` | `ProfileRegistryTopUpStorageReserve` | Maintenance only. |

## PWA Gap List

Priority order for bringing the PWA into consistency with contracts:

1. Transaction builder/sender layer:
   - Status: implemented for user-facing Vault, ATHWallet, and UsernameRegistry messages in `web/pwa-contract-transactions.mjs`; core Vault/ATH/username UI wiring is now basic but still needs polish.
   - Embedded Platho wallet transaction sender.
   - Message BOC serialization for all PWA-user messages listed above. **implemented**
   - Canonical attached value calculation per flow. **implemented for current fixed-reserve user flows**

2. Vault account lifecycle:
   - Status: `DepositTon`, `WithdrawTon`, `WithdrawAth`, ATH deposit, username mint/refund, public publish, `RegisterMessagingKeys`, `ReplaceMessagingKeys`, and `RevokeSession` have basic UI hooks.
   - send `RegisterMessagingKeys`;
   - send `ReplaceMessagingKeys`; **basic profile UI implemented**
   - send/read `SetSession`;
   - send `DepositTon`;
   - send `TopUpMessageBudget`;
   - send `RevokeSession`; **basic profile UI implemented**
   - send `WithdrawTon`.

3. On-chain message publishing:
   - fetch `get_session` and `get_canonical_session_max_charge`; **implemented**
   - build external session publish body; **implemented for private and public publish**
   - broadcast external message to Vault through TON RPC; **implemented as provider `sendExternalMessage` hook**
   - poll `Vault`/`CapsuleHub` until ACK/pending resolves;
   - read accepted public entries back from `CapsuleHub`; **basic public feed sync implemented**
   - read accepted private entries back from `CapsuleHub`; **basic decrypt/history loop implemented**

4. Chain message history:
   - use `CapsuleHub.get_state()` counters; **provider implemented**
   - page/scan `get_public_entry`; **basic public UI loop implemented**
   - page/scan `get_private_entry`; **basic private decrypt UI loop implemented**
   - verify hashes and decrypt private cells; **implemented for Platho byte-layout v1 cells**
   - render public channel posts from chain, not from local fixture messages; **implemented when CapsuleHub address/provider is configured**

5. ATH flows:
   - derive ATH wallet address via `ATHMaster.get_wallet_address`; **provider implemented**
   - read ATH wallet balance via `ATHWallet.get_wallet_data`; **provider implemented**
   - send Vault ATH deposit through `ATHTransferRequestWithNotify`; **basic UI + transaction builder implemented**
   - send Vault ATH withdrawal through `Vault.WithdrawAth`; **basic UI + transaction builder implemented**
   - send normal ATH transfer and burn; **basic UI + transaction builders implemented**
   - send avatar profile update payment through `ATHTransferRequestProfileAvatar`; **basic UI + transaction builder implemented**

6. Username flows:
   - resolve `.ath` using `UsernameRegistry.get_name_record`; **provider implemented**
   - quote via `get_username_price`; **provider implemented**
   - mint through `ATHTransferRequestMintUsername`; **basic UI + transaction builder implemented**
   - show pending mint and refund due; **provider implemented, UI still minimal**
   - let owner flush refund due with `FlushAthRefundDue`; **basic UI + transaction builder implemented**

7. Profile avatar flows:
   - Status: avatar image compression, public avatar capsule publish, ProfileRegistry payment, chain read provider, and PWA display hydration are wired.
   - read `ProfileRegistry.get_avatar` / `get_avatar_version` from chain for other wallets; **implemented**
   - reconstruct avatar bytes from `CapsuleHub` avatar entries by first entry id, stream id, and part count; **implemented**
   - verify reconstructed WebP bytes against `avatar_hash` before caching/display; **implemented**

8. Payment checks:
   - Status: basic composer/check-message UI implemented.
   - create `secret32`, `client_nonce`, `intent_id`, and `commitment`; **implemented**
   - send `CreateReceiveIntent`; **implemented**
   - embed compact payment body in encrypted capsule; **implemented**
   - recipient sends `ClaimReceiveIntent`; **implemented**
   - sender sends `CancelReceiveIntent`; **implemented**
   - UI distinguishes "claimed by you" vs "already claimed or cancelled by sender"; **implemented in the payment-message action state**

9. Production provider expansion:
   - `web/vault-ton-rpc-provider.mjs` now supports Vault account/session/key/receive-intent/pending-withdrawal/pricing/global getters and external `sendBoc`.
   - `web/capsulehub-ton-rpc-provider.mjs` now supports private/public entry getters and hub state.
   - `web/ath-ton-rpc-provider.mjs` now supports ATHMaster and ATHWallet getters needed by the PWA.
   - `web/username-ton-rpc-provider.mjs` now supports UsernameRegistry and UsernameNFTItem getters needed by the PWA.
   - `web/profile-registry-ton-rpc-provider.mjs` now supports ProfileRegistry avatar/global getters needed by the PWA.

## Important Product Policy

Do not add contract code just because a user could manually send strange values through a block explorer.

For this matrix, missing protections should be fixed in the PWA/tests when:

- the official PWA can accidentally send the bad value;
- the official PWA can create a stuck state;
- the official PWA displays a misleading balance/status;
- the official PWA fails to use a contract capability required by v1.

Contract fixes should be reserved for:

- theft/corruption paths;
- official flow liveness bugs;
- unclaimable protocol/user funds caused by normal contract-to-contract flow;
- immutable deployment/config mistakes that cannot be reliably blocked in release gates.
