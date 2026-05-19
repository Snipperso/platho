# Platho M27 Interface Decisions

Date: 2026-05-20

Status: source-of-truth alignment for audit follow-up. This is not a mainnet production approval.

## CapsuleHub v1

Decision: CapsuleHub v1 is **counter-only / anchor-only**.

The contract records accepted publish metadata and accounting:

- private/public latest ids;
- private/public entry counters;
- private/public page counters;
- last private/public entry ids and UIDs;
- protocol fee accrual and flush accounting.

It does **not** store full retrievable on-chain `private_pages` or `public_pages` maps in v1. Encrypted capsule packages remain carrier-agnostic and move through replaceable no-backend transports such as files, QR, Web Share, static mirrors, IPFS, TON Storage, or other user-selected carriers.

Reasoning:

- full page maps would materially increase storage rent and gas requirements;
- full on-chain retrieval indexes would create stronger metadata permanence than the v1 no-backend privacy model needs;
- current tests, getters, and PWA assumptions use CapsuleHub as an acceptance/accounting anchor, not as a message database.

Audit implication: absence of page maps is not a code bug for v1. Any future on-chain retrieval interface must reopen CapsuleHub storage economics, getters, wrappers, tests, code hashes, and release evidence.

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
