# Platho PWA Contract Interface Matrix

Date: 2026-06-03

Status: current v1 interface inventory for PWA/contract consistency work. This is not a mainnet production approval.

Purpose: list the contract entrypoints and getters that the production PWA must understand, then compare them with the current PWA implementation. The goal is to avoid deploying immutable contracts whose real user flows are only half-wired in the client.

This matrix reflects the clean-17 direct-pay shard model (rebaselined 2026-08-07). `Vault` and `CapsuleHub` were deleted: there is no internal balance, no auth key, no `publish_nonce`, and no discount authority. Every user action is an external message signed by the user's own wallet key and paid straight to the target contract. Older Vault-funded publish surfaces are superseded and are not part of active v1 evidence.

Payment checks were retired. The `CreateReceiveIntent` / `ClaimReceiveIntent` / `CancelReceiveIntent` product flow no longer exists and its capsule content byte is reserved rather than reassigned.

## Current PWA Reality

- It creates/imports a normal 24-word recovery phrase and deterministically derives the wallet key and all messaging keys from that phrase.
- It registers and rotates messaging keys in the wallet's own `KeyShard`, whose address is derived from that wallet address, so a record can only hold keys that wallet registered.
- It reads that record through `web/key-shard-ton-rpc-provider.mjs`, recomputing `keyId` from `enc_pubkey` and the ML-KEM hash before trusting it.
- It persists encrypted local wallet/history data as device-local cache; chain state and accepted transaction bodies remain the protocol source of truth.
- It has browser-safe shard, ATHWallet, UsernameRegistry, and ProfileRegistry transaction builders, with body BoCs checked against generated wrappers.
- It computes every shard address locally — `RecordShard(bucket_key, epoch)`, `IntroShard(epoch, bucket)`, `RecoveryShard(self_bucket_key)`, `PublicShard(kind, coordinates)` — with zero on-chain lookups, and derives them through a second independent implementation that is pinned address-for-address against `@ton/core`.
- It confirms a publish by shard entry/hash visibility. A `200` from an endpoint means queued, not executed; a green status must mean the capsule is on chain.
- It pays usernames and avatars from the user's own ATHWallet through the dedicated registry notify ops, not from any intermediary balance.
- It derives user ATHWallet addresses through ATHMaster and never presents official protocol ATH wallets as user deposit addresses.
- It resolves `.ath` ownership by deriving the item address with `UsernameRegistry.get_username_item_address(name_hash)`, then reading the current owner from `UsernameNFTItem.get_state()`. (`get_name_record` retired 2026-07-20 with the `name_records` map, which capped the registry at ~21,503 names.)
- The item's address IS the name-to-item anchor: the derivation points to exactly one item address, and a `UsernameNFTItem` deployed at any other address is **non-authoritative** and must not be treated as username ownership. Nothing else has to agree, which is what allowed the registry-side map to be deleted.
- The current owner is read from that item's `get_state()`, because the item is what a TEP-62 transfer moves. An owner read from anywhere else — a cached record, an earlier generation's registry — is historical and is not the current owner after transfer.

Remaining gaps are production gates, provider/readiness configuration, and UI/status polish rather than missing core user-facing contract sends.

## User-Facing Contract Sends The PWA Must Support

These are normal user flows. They should be implemented in the PWA, with tests, because they are not manual misuse.

| Flow | Contract target | Message / entrypoint | Signer | PWA status | Notes |
|---|---|---|---|---|---|
| Register messaging keys | `KeyShard` | register (enc_pubkey, sign_pubkey, scan_pubkey, pq_kem_pubkey_hash, pq_kem_pubkey_len, pq_kem_pubkey, crypto_suite_mask) | user wallet | Implemented | Address derived from the owner wallet; canonical value `60,000,000` nanotons covers the account's rent float plus register gas. |
| Rotate messaging keys | `KeyShard` | rotate | user wallet | Implemented | Writes a new record into the same account, so a rotation cannot strand a peer at an address nobody reads. |
| Publish first-contact capsule | `IntroShard` | `IntroPublish` | user wallet external | Implemented | Sender-chosen bucket for the epoch; `17,810,000` nanotons. Header carries only `ephemeral_R` and the two-byte `view_tag`. |
| Publish conversation capsule | `RecordShard` | `CapsulePublish` | user wallet external | Implemented | Address is `f(bucket_key, epoch)`; `19,100,000` nanotons. Write authority is knowledge of `bucket_key` plus a per-direction write signature. |
| Publish public post/comment | `PublicShard` | publish | user wallet external | Implemented | Public body is raw PWA bytes in the accepted publish transaction body; display requires verifying it against the stored commitment. `20,300,000` nanotons. |
| Publish avatar media | `PublicShard` (`AVATAR` domain) | publish | user wallet external | Implemented | `39,500,000` nanotons. The authoritative pointer is written to `KeyShard`, not to the post header. |
| Write recovery / prefs / notes slot | `RecoveryShard` | slot write | user wallet external | Implemented | `38,400,000` nanotons; an overwrite returns the surplus. 256 indexed slots plus named slots for prefs and notes. |
| Transfer ATH to another owner | user `ATHWallet` | `ATHTransferRequest(query_id, amount, recipient, response_destination)` | user wallet to user ATHWallet | Implemented | Normal ATH transfer from the user's own ATH wallet. |
| Burn own ATH | user `ATHWallet` | `ATHBurn(query_id, amount, response_destination)` | user wallet to user ATHWallet | Implemented | Direct user burn from the user's own ATH wallet. |
| Mint username | user `ATHWallet` | `ATHTransferRequestRegistryMintUsername` (`0x4154481C`) | user wallet to user ATHWallet | Implemented | Pays `UsernameRegistry` directly through the dedicated notify op; PWA checks reciprocal registry route state before signing. |
| Set wallet avatar | user `ATHWallet` | `ATHTransferRequestRegistryProfileAvatar` (`0x4154481A`) | user wallet to user ATHWallet | Implemented | Pays `ProfileRegistry` directly through the dedicated notify op; the registry prices and settles the 100 ATH split 50/50. |
| Claim airdrop credits | `AirdropTicket` / `AirdropPool` | claim | user wallet | Implemented | Credits accrue per wallet and are redeemed in batches from the pool. |

## User-Facing Read/Getters The PWA Must Support

| Area | Contract | Getter | PWA status | Needed for |
|---|---|---|---|---|
| Conversation entries | `RecordShard` | shard state + transaction history | Implemented | Read the commitment, recover the body from TON message history, verify the write signature, decrypt with the local recipient key. |
| First-contact entries | `IntroShard` | scan page getter | Implemented | Page through `ephemeral_R` / `view_tag` rows; the recipient recomputes the tag before attempting any decryption. |
| Public posts and comments | `PublicShard` | `get_page(from, max_count)` | Implemented | At most 96 rows per call; reads are tail-anchored, since a head-anchored read shows an empty feed once a shard exceeds one page. |
| Recovery / prefs / notes | `RecoveryShard` | slot getter | Implemented | The user's own encrypted slots, epoch-independent. |
| Publish pricing | client policy | `web/publish-price.mjs` | Implemented | Canonical publish values are a client constant pinned by tests, not a contract oracle. |
| ATH wallet address | `ATHMaster` | `get_wallet_address(owner_address)` | Implemented | Derive user and official ATHWallet addresses. |
| ATH token data | `ATHMaster` | `get_jetton_data()` | Implemented | Token supply/meta display. |
| ATH wallet balance | `ATHWallet` | `get_wallet_data()` | Implemented | External ATH wallet balance/status. |
| ATH pending notification | `ATHWallet` | `get_pending_notification(query_id, sender_key)` | Implemented | Recovery/debug for notify flows. |
| Username price | `UsernameRegistry` | `get_username_price(name_len)` | Implemented | Quote exact ATH price before mint. |
| Username item address | `UsernameRegistry` | `get_username_item_address(name_hash)` | Implemented | Derive item address from name hash. |
| Username pending mint | `UsernameRegistry` | `get_pending_mint(name_hash)` | Implemented | Mint pending UI. |
| Username pending mint | `UsernameRegistry` | `get_pending_mint(name_hash)` | Implemented | Mint pending/recovery UI; stale pending mints are non-destructive and do not create registry refund due. |
| Username global | `UsernameRegistry` | `get_global()` | Implemented | Registry route, prices, due/status dashboard. |
| Username NFT item | `UsernameNFTItem` | `get_state()`, `get_nft_data()`, `NftTransfer` | Implemented/optional | Current owner is the item owner, provided the registry points to that exact item. |
| Wallet KeyShard address | `ProfileRegistry` | `get_key_shard_address(owner_wallet)` | Implemented | Where a wallet's identity and avatar pointer live. Client derives the same address locally for batched reads. |
| Wallet identity + avatar | `KeyShard` | `get_view()` | Implemented | Messaging keys AND the paid avatar pointer in ONE read. Replaced `ProfileRegistry.get_avatar` / `get_avatar_version` on 2026-07-21: holding a pointer per profile cost a measured 5.0000 cells each and capped the product at 13,076 profiles, silently. There is no version history to query — an update always replaced the previous record, so the retired getters only ever answered for the current version. |
| Profile global | `ProfileRegistry` | `get_global()` | Implemented | Registry route and fee due buckets. |

## Contract Entrypoints The Normal PWA Should Not Use Directly

| Contract | Entrypoints | Classification |
|---|---|---|
| `ATHMaster` | `DeployTreasurySupply`, `ATHBurnNotification` | Genesis/operator or internal only. |
| `ATHWallet` | Internal transfer, notification ACK/refund, bounced handlers, `PruneStaleNotification` | Internal or maintenance only. |
| Shards (`RecordShard`, `IntroShard`, `RecoveryShard`, `PublicShard`, `KeyShard`) | Retire, storage top-up, prune maintenance | Keeper or maintenance only; publish is the normal user action. |
| `FeeAccumulator` | Deposit/split/flush/top-up paths | Protocol/keeper/operator only. |
| `BuybackBurn` | Bind/seal, route freeze, reserve accept, route execution/retry/recovery | Genesis/post-pool/keeper only. |
| `MarketStabilitySeller` | Bind/seal, pricing freeze, reserve funding, sale/recovery paths | Genesis/post-pool/keeper/user sale flow as separately documented. |
| `UsernameRegistry` | Bind/seal, notification callbacks, item ACK, treasury/burn flush, prune/top-up maintenance | Genesis/internal/keeper/maintenance only. |
| `UsernameNFTItem` | `ResendDeployedAck`, storage top-up | Recovery/maintenance only; transfer is standard owner action. |
| `ProfileRegistry` | Bind/seal, notification callbacks, treasury/burn flush, storage top-up | Genesis/internal/keeper/maintenance only. |

## Product Policy

Do not add contract code just because a user could manually send strange values through a block explorer.

ATH payment policy is intentionally narrow:

- ATH-priced actions are paid from the user's own ATHWallet through a dedicated registry notify op, never from an intermediary balance;
- the PWA must not show any official protocol ATH wallet as a user deposit address;
- manual ordinary ATH transfer to an official protocol ATH wallet is unsupported, is not tracked as a credit, and must not be presented as a funding path;
- a contract credits only authenticated ACK/fail/bounce value it actually receives, minus its local refund reserve and capped by the reserved value;
- the airdrop pool must be funded through the notify lane, or the pool does not learn about its own 15,000,000 ATH.

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
- `market-stability:readiness` is a post-pool seller-sale gate after `mainnet:genesis:verify` (which certifies the genesis-funded reserve) and the post-pool pricing freeze; it is not a standalone replacement or substitute for final genesis verification. Seller readiness is production-valid only after that readiness PASS.

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
