# Platho M27 Interface Decisions

Date: 2026-05-20

> **HISTORICAL ONLY — SUPERSEDED.** This records interface decisions of the clean-15 generation, whose `Vault` and
> `CapsuleHub` contracts were deleted in clean-17. Everything below about a single hub, Vault-only publishes, `PH0B`
> 140-byte headers, `maxCharge`, and TON-denominated pricing describes a design that no longer exists.
>
> Current source of truth: `web/CRYPTO_PROTOCOL.md` for the wire protocol and `web/publish-price.mjs` for prices. In
> clean-17 each lane has its own shard account addressed by derivation, a publish is an external message signed by the
> user's own wallet and paid directly to that shard, header0 is 40 bytes on CONV and 42 on INTRO, and the currency is
> labelled GRAM.
>
> Kept because the reasoning survives the rewrite: bodies must be verifiable without a backend, on-chain state stays
> compact while authenticating a body recovered from transaction history, and the storage top-up ABI below still
> describes how no-authority top-ups work.

Status: historical / superseded. This is not a mainnet production approval.

## CapsuleHub v1

Current final decision: CapsuleHub v1 is **not** counter-only / anchor-only, but it also does **not** persist the heavy
private/public body cells in contract state. Accepted private and public publish transactions carry retrievable payload
cells in the Vault -> CapsuleHub transaction body. CapsuleHub validates those cells and persists compact authenticated
entry state.

The contract records accepted publish metadata, accounting, and compact authenticated records:

- private/public latest ids;
- private/public entry counters;
- last private/public entry ids and UIDs;
- private/public entry maps keyed by entry id;
- private header/index state, public header/index state, `body_hash`, and contract `created_at`;
- protocol fee accrual and flush accounting.

The PWA retrieves heavy bodies from TON message history and verifies them against `body_hash` before display or
decryption. Replaceable PWA transports and local encrypted history may cache the bodies, but they are not the source of
truth for delivered messages.

Reasoning:

- message bodies must be verifiable without any proprietary backend, local config file, IPFS object, or static mirror;
- compact on-chain state keeps storage bounded while still authenticating every body recovered from accepted publish transaction history;
- PWA and contract tests use CapsuleHub as the authenticated message index, with body availability depending on TON history provider coverage and local cache.

Audit implication: missing retrievable accepted publish transaction bodies can make a v1 message unreadable even when the
compact entry exists. Entry hashes, getters, wrappers, tests, code hashes, provider-history behavior, and release evidence
must remain aligned.

Capacity implication: useful message capacity is measured only by bytes that are serialized into the body cell carried by
the accepted publish transaction body and authenticated by CapsuleHub. Local-cache-only bodies or unverified off-chain
carrier-only bodies are invalid for v1 delivery.

Binary layout decision: v1 on-chain private capsule cells are fixed binary bytes, not JSON. `header_0_cell` is exactly 140 bytes (`PH0B`, including the sender wallet avatar pointer), `header_1_cell` is exactly 30 bytes (`PH1B`), and `body_cell` stores `platho.byte-layout.v1`. The canonical byte-for-byte source is `artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md`.

Useful private capacity is selected per hybrid capsule from the final 1, 2, 4, 8, 16, or 32 KiB size classes. Small messages are zero-padded inside the selected encrypted slot. Long text and images are split into multiple independent capsules whose encrypted metadata carries `stream_id`, `part_index`, and `part_count`. A single capsule must not mix unrelated payload units; exact body sizes are listed in `artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md`.

Public publish marketing marker: CapsuleHub v1 public publish messages carry a fixed byte-aligned `uint152` marker equal to ASCII `sent via Platho.App` in the transaction message body. Public publish entries store a compact public header cell separately from a raw text/image/avatar body cell using the smallest fitting 1, 2, 4, 8, 16, or 32 KiB public size class, not padded private ciphertext capsules. This is an on-chain annotation only; the official messenger UI must not render it as part of the public post text. Private publish messages do not carry the marker.

CapsuleHub does not store page counters. Clients can derive page windows from sequential entry ids. The first entry of a page must not pay a separate page-storage reserve; every capsule of the same publish profile has the same required value.

PWA pricing decision: official public posts start from `0.0337 TON` net per capsule and `hybrid-v1` private 1 KiB capsules start from `0.0347 TON` net per capsule before ATH discount and network-fee overage. `classical-v1` is not exposed as a publish option in final v1.
Both include the full Platho protocol fee of `0.01 TON`. Separately, both include `0.005 TON` of estimated network cost allowance, which is not a Platho protocol fee. If the current PWA estimate exceeds that allowance, the PWA adds the
overage rounded upward to `0.001 TON` steps. Final v1 publishes are Vault-only; Vault accepts
`maxCharge >= canonical_max_charge` so the PWA can keep v1 above cost without a contract oracle while applying ATH
discounts to public and private messages consistently.

## Storage Top-Up ABI

Decision: v1 exposes explicit no-authority storage top-up handlers for contracts whose current opcode table pins a top-up operation:

| Contract | Message | Opcode |
|---|---|---:|
| ~~Vault~~ (deleted in clean-17) | `TopUpStorageReserve` | `0x3215B5FD` |
| ~~CapsuleHub~~ (deleted in clean-17) | `TopUpStorageReserve` | `0x5331B880` |
| FeeAccumulator | `TopUpStorageReserve` | `0x87A2D2C7` |
| BuybackBurn | `TopUpStorageReserve` | `0x906182D2` |
| UsernameRegistry | `UsernameRegistryTopUpStorageReserve` | `0x0ABA5F1D` |
| UsernameNFTItem | `TopUpStorageReserve` | `0x27ACDF8B` |

These handlers accept TON for contract storage reserve only. They grant no authority, create no withdrawable balance, and do not mutate protocol accounting, owner, binding, route, or user state.

ATHMaster and ATHWallet are not changed by this decision because the current v1 opcode table does not pin ATH jetton top-up operations. Adding token-level top-up entrypoints would be a separate ATH ABI decision.

Regression coverage:

- `tests/storage-topup-abi.test.ts`
- `tests/m16-conformance-static.test.ts`

Verification completed after this decision:

- `npm.cmd run build`: PASS
- focused interface/conformance suite: 4 files / 9 tests PASS
- `npm.cmd test`: 66 files / 274 tests PASS
- `npm.cmd run crypto:selftest`: PASS, `negativeChecksPassed = 27`
- `npm.cmd run preprod:check`: BLOCKED as expected by open production gates
- `npm.cmd run web:deploy:prepare:prod`: BLOCKED as expected by preprod gates
