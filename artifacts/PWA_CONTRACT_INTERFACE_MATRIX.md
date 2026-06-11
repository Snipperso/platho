# Platho PWA Contract Interface Matrix

Date: 2026-06-03

Status: current v1 interface inventory for PWA/contract consistency work. This is not a mainnet production approval.

Purpose: list the contract entrypoints and getters that the production PWA must understand, then compare them with the current PWA implementation. The goal is to avoid deploying immutable contracts whose real user flows are only half-wired in the client.

This matrix reflects the current wallet-like Vault model. The PWA uses internal Vault TON/ATH balances plus signed external publish messages with `publish_nonce`. Older draft publish surfaces are superseded and are not part of active v1 evidence.

Direct user-wallet username mint, profile avatar payment, and username refund-flush product actions are intentionally unsupported in the current V1 PWA. These product flows go through Vault-funded messages so normal user operations do not expose separate external wallet transactions for identity/profile actions.

## Current PWA Reality

- It creates/imports a normal 24-word TON recovery phrase and deterministically derives both the TON wallet key and messaging keys from that phrase.
- It derives and sends `RegisterMessagingKeys` / `ReplaceMessagingKeys` transactions through the embedded wallet.
- It reads Vault `get_user` and `get_key_record` through `web/vault-ton-rpc-provider.mjs`.
- It persists encrypted local wallet/history data as device-local cache; chain state and accepted transaction bodies remain the protocol source of truth.
- It has browser-safe Vault, ATHWallet, UsernameRegistry, and ProfileRegistry transaction builders, with body BoCs checked against generated wrappers.
- It builds and signs `PublishPrivateFromVaultBalance` and `PublishPublicFromVaultBalance` external Vault BoCs using the user's wallet-derived signing key and the current `publish_nonce`.
- It builds and signs Vault service external BoCs (`CreateReceiveIntent`, `ClaimReceiveIntent`, `CancelReceiveIntent`, `SetProfileAvatarFromVaultBalance`, and `MintUsernameFromVaultBalance`) with the same Vault auth key / owner signing key, not as wallet-sender internal transactions.
- It confirms final publish by CapsuleHub entry/hash visibility, not only by Vault nonce advancement.
- It publishes public posts, public comments, and profile avatar capsule parts through Vault -> CapsuleHub.
- It derives user ATHWallet addresses through ATHMaster and never presents official protocol ATH wallets as user deposit addresses.
- It resolves `.ath` ownership by requiring `UsernameRegistry.get_name_record(name_hash)` to point to the deterministic item, then reading the current owner from `UsernameNFTItem.get_state()`.
- A deployed `UsernameNFTItem` without `UsernameRegistry.name_records[name_hash]` pointing to that exact item is non-authoritative and must not be treated as username ownership. The registry record remains the name-to-item anchor; the registry record owner is historical and is not the current owner after transfer.

Remaining gaps are production gates, provider/readiness configuration, and UI/status polish rather than missing core user-facing contract sends.

## User-Facing Contract Sends The PWA Must Support

These are normal user flows. They should be implemented in the PWA, with tests, because they are not manual misuse.

| Flow | Contract target | Message / entrypoint | Signer | PWA status | Notes |
|---|---|---|---|---|---|
| Register messaging keys | `Vault` | `RegisterMessagingKeys(enc_pubkey, sign_pubkey, pq_kem_pubkey_hash, pq_kem_pubkey_len, pq_kem_pubkey, crypto_suite_mask)` | user wallet | Implemented | Profile action builds and sends an embedded-wallet transaction after reading `get_user`. |
| Replace messaging keys | `Vault` | `ReplaceMessagingKeys(...)` | user wallet | Implemented | Sends the current locally derived key suite as the next on-chain key record. |
| Deposit TON into Vault ledger | `Vault` | `DepositTon(amount)` | user wallet | Implemented | Vault action prompts amount and sends current-user-aware attach value after reading `get_user`. |
| Withdraw TON from Vault ledger | `Vault` external | `WithdrawTonFromVaultBalance(amount, recipient)` | Vault auth key / owner signing key | Implemented | Defaults recipient to the connected wallet; execution reserve is paid from internal Vault TON. |
| Deposit ATH into Vault ledger | user `ATHWallet` | `ATHTransferRequestWithNotify(query_id, amount, recipient = Vault, response_destination = user, notify_destination = Vault, notify_value)` | user wallet to user ATHWallet | Implemented | PWA derives the user's ATHWallet via `ATHMaster.get_wallet_address(owner)` and sends the authenticated notify-flow deposit. |
| Withdraw ATH from Vault ledger | `Vault` external | `WithdrawAthFromVaultBalance(amount, recipient)` | Vault auth key / owner signing key | Implemented | Vault sends from official Vault ATHWallet; downstream ATHWallet reserve is paid from internal Vault TON. |
| Publish private message | `Vault` external | `PublishPrivateFromVaultBalance` | owner signing key | Implemented | PWA fetches fresh canonical charge, checks balance, confirms high surcharge when needed, broadcasts, tracks per-capsule state, and confirms CapsuleHub entry hashes. |
| Publish public channel post/comment/avatar capsule | `Vault` external | `PublishPublicFromVaultBalance` | owner signing key | Implemented | Public body is raw PWA bytes in the accepted publish transaction body; final display requires CapsuleHub hash verification. |
| Transfer ATH to another owner | user `ATHWallet` | `ATHTransferRequest(query_id, amount, recipient, response_destination)` | user wallet to user ATHWallet | Implemented | Normal ATH transfer from the user's external ATH wallet. |
| Burn own ATH | user `ATHWallet` | `ATHBurn(query_id, amount, response_destination)` | user wallet to user ATHWallet | Implemented | Direct user burn from the user's external ATH wallet. |
| Mint username from Vault balance | `Vault` external | `MintUsernameFromVaultBalance(...)` | Vault auth key / owner signing key | Implemented | PWA checks Vault and reciprocal UsernameRegistry route state before signing. |
| Set wallet avatar from Vault balance | `Vault` external | `SetProfileAvatarFromVaultBalance(...)` | Vault auth key / owner signing key | Implemented | PWA checks Vault and reciprocal ProfileRegistry route state before signing. |
| Create payment check | `Vault` external | `CreateReceiveIntent(asset, amount, recipient_wallet, commitment, client_nonce)` | Vault auth key / owner signing key | Implemented | PWA persists encrypted local recovery first, creates and confirms the locked intent, then publishes the encrypted check capsule; if post-intent publish fails before ambiguous partial submission, it attempts cancel. |
| Claim payment check | `Vault` external | `ClaimReceiveIntent(intent_id, secret32)` | Vault auth key / owner signing key | Implemented | Recipient claims by secret carried in the encrypted capsule. |
| Cancel payment check | `Vault` external | `CancelReceiveIntent(intent_id)` | Vault auth key / owner signing key | Implemented | Sender can cancel a still-open check. |

## User-Facing Read/Getters The PWA Must Support

| Area | Contract | Getter | PWA status | Needed for |
|---|---|---|---|---|
| Vault account | `Vault` | `get_user(owner)` | Implemented | TON balance, ATH balance, current key id, `publish_nonce`. |
| Vault key record | `Vault` | `get_key_record(keyId)` | Implemented | Binding public messaging keys to on-chain truth. |
| Vault receive intent | `Vault` | `get_receive_intent(intentId)` | Implemented | Payment check status. |
| Vault receive intent id | `Vault` | `get_receive_intent_id(senderWallet, recipientWallet, asset, amount, clientNonce)` | Implemented | Deterministic check id before/after creation. |
| Vault receive commitment | `Vault` | `get_receive_intent_commitment(intentId, recipientWallet, secret32)` | Implemented | Claim preflight/debug. |
| Vault ATH withdrawal | `Vault` | `get_pending_ath_withdrawal_for(ownerWallet, queryId)` | Implemented | Withdrawal pending status. |
| Vault pricing | `Vault` | `get_canonical_publish_charge(owner, publishKind, sizeClass, cryptoSuite)` | Implemented | Exact hold/charge for external publish and surcharge calculation. |
| Vault global | `Vault` | `get_global()` | Implemented | Config/status/debug and registry route checks. |
| Capsule private message | `CapsuleHub` | `get_private_entry(entryId)` | Implemented | Read compact state, recover body from TON message history, verify hashes, decrypt if addressed to local key. |
| Capsule public post | `CapsuleHub` | `get_public_entry(entryId)` | Implemented | Read public compact state, recover body from TON message history, verify hashes. |
| Capsule counters | `CapsuleHub` | `get_state()` | Implemented | Entry counts, fee state, sealed state. |
| ATH wallet address | `ATHMaster` | `get_wallet_address(owner_address)` | Implemented | Derive user and official ATHWallet addresses. |
| ATH token data | `ATHMaster` | `get_jetton_data()` | Implemented | Token supply/meta display. |
| ATH wallet balance | `ATHWallet` | `get_wallet_data()` | Implemented | External ATH wallet balance/status. |
| ATH pending notification | `ATHWallet` | `get_pending_notification(query_id, sender_key)` | Implemented | Recovery/debug for notify flows. |
| Username price | `UsernameRegistry` | `get_username_price(name_len)` | Implemented | Quote exact ATH price before mint. |
| Username record | `UsernameRegistry` | `get_name_record(name_hash)` | Implemented | Resolve authoritative item address for `.ath` name. |
| Username item address | `UsernameRegistry` | `get_username_item_address(name_hash)` | Implemented | Derive item address from name hash. |
| Username pending mint | `UsernameRegistry` | `get_pending_mint(name_hash)` | Implemented | Mint pending UI. |
| Username pending mint | `UsernameRegistry` | `get_pending_mint(name_hash)` | Implemented | Mint pending/recovery UI; stale pending mints are non-destructive and do not create registry refund due. |
| Username global | `UsernameRegistry` | `get_global()` | Implemented | Registry route, prices, due/status dashboard. |
| Username NFT item | `UsernameNFTItem` | `get_state()`, `get_nft_data()`, `NftTransfer` | Implemented/optional | Current owner is the item owner, provided the registry points to that exact item. |
| Profile avatar current | `ProfileRegistry` | `get_avatar(owner_wallet)` | Implemented | Current wallet avatar pointer. |
| Profile avatar version | `ProfileRegistry` | `get_avatar_version(owner_wallet, version)` | Implemented | Historical avatar pointer for old posts/private headers. |
| Profile global | `ProfileRegistry` | `get_global()` | Implemented | Registry route and fee due buckets. |

## Contract Entrypoints The Normal PWA Should Not Use Directly

| Contract | Entrypoints | Classification |
|---|---|---|
| `ATHMaster` | `DeployTreasurySupply`, `ATHBurnNotification` | Genesis/operator or internal only. |
| `ATHWallet` | Internal transfer, notification ACK/refund, bounced handlers, `PruneStaleNotification` | Internal or maintenance only. |
| `CapsuleHub` | Bind/seal, `PublishPrivateFromVault`, `PublishPublicFromVault`, `FlushFees`, `TopUpStorageReserve`, prune maintenance | Vault/internal, keeper, or maintenance only. |
| `FeeAccumulator` | Deposit/split/flush/top-up paths | Protocol/keeper/operator only. |
| `BuybackBurn` | Bind/seal, route freeze, reserve accept, route execution/retry/recovery | Genesis/post-pool/keeper only. |
| `MarketStabilitySeller` | Bind/seal, pricing freeze, reserve funding, sale/recovery paths | Genesis/post-pool/keeper/user sale flow as separately documented. |
| `UsernameRegistry` | Bind/seal, notification callbacks, item ACK, treasury/burn flush, prune/top-up maintenance | Genesis/internal/keeper/maintenance only. |
| `UsernameNFTItem` | `ResendDeployedAck`, storage top-up | Recovery/maintenance only; transfer is standard owner action. |
| `ProfileRegistry` | Bind/seal, notification callbacks, treasury/burn flush, storage top-up | Genesis/internal/keeper/maintenance only. |

## Product Policy

Do not add contract code just because a user could manually send strange values through a block explorer.

Vault ATH policy is intentionally narrow:

- the PWA must use the user ATHWallet `ATHTransferRequestWithNotify` notify-flow for Vault ATH deposits;
- the PWA must not show the official Vault ATHWallet as a direct deposit address;
- manual ordinary ATH transfer to the official Vault ATHWallet is unsupported and may not credit the Vault internal ledger;
- Vault ATH withdrawal reserve is internal Vault TON, and PWA wording must not promise a complete excess refund;
- Vault credits only authenticated ACK/fail/bounce value it receives, minus local refund reserve and capped by the reserved internal value.

FeeAccumulator and buyback policy:

- `EnableBuybackSplit` is a one-time / one-way authority held by the immutable treasury receiver;
- it is not admin/rescue/pause and cannot steal funds, but it permanently changes FeeAccumulator economics to the 50/50 treasury/buyback split;
- PWA/release tooling must treat it as preflight-gated and must not generate the transaction before buyback route readiness passes;
- buyback burn success is proven only when BuybackBurn receives `ATHBurnFinalized` from ATHMaster;
- an `ATHBurnNotification`, outbound burn request, or burn attempt is not a success signal and must not be counted as completed buyback burn.

MarketStabilitySeller reserve policy is also intentionally narrow:

- full seller readiness requires `reserve_due_ath == 60,000,000 ATH`, `reserve_funded_total_ath == 60,000,000 ATH`, and official seller ATH wallet backing of at least `60,000,000 ATH`;
- partial reserve funding and partial sales are valid runtime states, but they are not full-launch readiness;
- reserve funding must use the bound reserve funder notify-flow into the official seller ATH wallet;
- manual ordinary ATH transfer to the official seller ATH wallet is unsupported, is not tracked reserve, does not expand sellable supply, and must not be shown as a PWA deposit/funding path;
- `market-stability:readiness` is a post-pool seller gate after `mainnet:genesis:verify`, pricing freeze, and reserve funding; it is not a standalone replacement or substitute for final genesis verification. Seller readiness is production-valid only after that readiness PASS.

Authority wording policy:

- do not claim that launch authority is absent from every step;
- do claim that there is no rescue, pause, upgrade, admin drain, or arbitrary balance-control authority;
- keep narrow one-shot or one-way authorities explicit: treasury owner one-shot `DeployTreasurySupply`, genesis controller pre-seal bind/seal actions, BuybackBurn route freeze, MarketStabilitySeller pricing freeze, and FeeAccumulator treasury receiver `EnableBuybackSplit`;
- the current manifest intentionally reuses the `genesis_controller_one_shot` address as the BuybackBurn and MarketStabilitySeller launch controller until post-pool freeze, so operators must not retire that key until `BuybackBurn.route_frozen == true`, `MarketStabilitySeller.pricing_frozen == true`, and both launch contracts report `genesis_config_hash == 0`;
- M20T harness evidence, M20F route preflight, and MarketStabilitySeller readiness must not replace or substitute for `mainnet:genesis:verify`.

For this matrix, missing protections should be fixed in the PWA/tests when:

- the official PWA can accidentally send the bad value;
- the official PWA can create a stuck state;
- the official PWA displays a misleading balance/status;
- the official PWA fails to use a contract capability required by v1.

Contract fixes should be reserved for theft/corruption paths, official-flow liveness bugs, unclaimable protocol/user funds caused by normal contract-to-contract flow, or immutable deployment/config mistakes that cannot be reliably blocked in release gates.
