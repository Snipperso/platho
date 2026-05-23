# Platho M27 Interface Decisions

Date: 2026-05-20

Status: superseded by on-chain payload storage fix. This is not a mainnet production approval.

## CapsuleHub v1

Superseded decision: CapsuleHub v1 is **not** counter-only / anchor-only. Accepted private and public entries must store retrievable on-chain payload cells in CapsuleHub state.

The contract records accepted publish metadata, accounting, and payload records:

- private/public latest ids;
- private/public entry counters;
- last private/public entry ids and UIDs;
- private/public entry maps keyed by entry id;
- private header/body payload cell hashes and payload cells;
- public body payload cell hashes and payload cells;
- protocol fee accrual and flush accounting.

It does not need page-map retrieval as the primary API, but it must expose retrievable entry records. Replaceable PWA transports may cache/share encrypted packages, but they are not the source of truth for delivered messages.

Reasoning:

- message bodies must survive without any backend, local config file, IPFS object, or static mirror;
- storing encrypted cells keeps plaintext private while making delivery state self-contained on-chain;
- PWA and contract tests now use CapsuleHub as the message database for encrypted payload cells.

Audit implication: missing retrievable payload cells is a v1 blocker. Entry payload storage, getters, wrappers, tests, code hashes, and release evidence must remain aligned.

Capacity implication: useful message capacity is measured only by bytes that are serialized into the payload cells persisted by CapsuleHub. Hash-only capacity claims, local-cache-only bodies, or off-chain carrier-only bodies are invalid for v1.

Binary layout decision: v1 on-chain private capsule cells are fixed binary bytes, not JSON. `header_0_cell` is exactly 140 bytes (`PH0B`, including the sender wallet avatar pointer), `header_1_cell` is exactly 30 bytes (`PH1B`), and `body_cell` stores `platho.byte-layout.v1`. The canonical byte-for-byte source is `artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md`.

Useful capacity is identical for standard and postquantum capsules: exactly one encrypted 1024-byte user payload slot per capsule. Small messages are zero-padded inside that slot. Long text and images are split into multiple independent capsules whose encrypted metadata carries `stream_id`, `part_index`, and `part_count`. Body sizes are exact: standard body = 1,140 bytes; postquantum body = 2,228 bytes. A single capsule must not contain multiple 1024-byte slots.

Public publish marketing marker: CapsuleHub v1 public publish messages carry a fixed byte-aligned `uint152` marker equal to ASCII `sent via Platho.App` in the transaction message body. Public publish entries store a compact public header cell separately from a raw text body cell, `1..1024` bytes in a snake cell, not padded private capsules. This is an on-chain annotation only; the official messenger UI must not render it as part of the public post text. Private publish messages do not carry the marker.

CapsuleHub does not store page counters. Clients can derive page windows from sequential entry ids. The first entry of a page must not pay a separate page-storage reserve; every capsule of the same publish profile has the same required value.

PWA pricing decision: official public post price is `0.010 TON`; official per-capsule private prices are `0.010 TON` for `classical-v1` and `0.020 TON` for `hybrid-v1`.
Both include `0.005 TON` of estimated network cost. If the current PWA estimate exceeds `0.005 TON`, the PWA adds the
overage rounded upward to `0.001 TON` steps. Final v1 publishes are Vault-only; Vault accepts
`maxCharge >= canonical_max_charge` so the PWA can keep v1 above cost without a contract oracle while applying ATH
discounts to public and private messages consistently.

## Storage Top-Up ABI

Decision: v1 exposes explicit no-authority storage top-up handlers for contracts whose current opcode table pins a top-up operation:

| Contract | Message | Opcode |
|---|---|---:|
| Vault | `TopUpStorageReserve` | `0x3215B5FD` |
| CapsuleHub | `TopUpStorageReserve` | `0x5331B880` |
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
