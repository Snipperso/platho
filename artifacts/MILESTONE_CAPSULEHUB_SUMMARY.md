# Platho CapsuleHub milestone 1: direct publish + fee accrual/flush

Scope implemented:

- `contracts/CapsuleHub.tact`
- direct private publish
- direct public publish
- public direct author check: `msg.sender == author_wallet`
- private direct header/body/suite validation
- sequential `entry_id` counters
- internal `entry_uid` metadata hash
- no caller-supplied `entry_id` or `entry_uid`
- no entry-id gaps on failed/underfunded publish
- page counters as metadata only; no per-page storage reserve is charged in final v1
- per-entry storage reserve accounting
- PLATO fee accrual
- `OP_FLUSH_FEES(amount)`
- bounce recovery for fee flush
- no empty fallback behavior

Also updated in this package:

- `contracts/FeeAccumulator.tact` deposit semantics changed to permissionless principal deposits.
- This removes the CapsuleHub <-> FeeAccumulator StateInit address circularity.
- Any sender may donate protocol-fee principal, but only declared `amount` is credited to `accumulated_ton`; surplus TON is execution/storage reserve, not protocol-fee principal.

Explicitly not implemented:

- Vault publish paths
- Vault ACK / excess return
- discounted Vault fees
- private recipient/client sync
- superseded: counter-only / anchor-only is not sufficient for v1; CapsuleHub must store retrievable encrypted payload cells
- deployment/seal checks
- UsernameRegistry
- BuybackBurn STON.fi execution

Commands run:

```bash
npm run build
npm test -- --reporter=verbose
npm audit --omit=dev
```

Results:

```text
CapsuleHub code hash = f93f88078dcdae3886a22ec0dcada3249dc16eb084b315012b91908b90aac4f9
FeeAccumulator code hash = 4bc6e771753e379a5f52b3c33c11b53efeeddbae44bd3f411bd6d62191be9524
vitest: 4 test files passed, 23 tests passed
npm audit --omit=dev: 0 vulnerabilities
```

Important caveat:

`FeeAccumulator` is now intentionally permissionless for protocol-fee principal deposits. This is safe because anyone can only donate real TON into protocol fee accounting. It avoids an otherwise circular deployment dependency between CapsuleHub and FeeAccumulator addresses.
