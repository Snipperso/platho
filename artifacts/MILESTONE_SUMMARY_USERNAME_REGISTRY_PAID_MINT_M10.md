# Milestone Summary: UsernameRegistry Paid Mint M10

Implemented:

```text
UsernameRegistry paid mint from official ATH wallet notification
raw username validation
canonical name_hash computation
exact price enforcement
PendingUsernameMint creation
UsernameNFTItem deployment from registry
UsernameItemDeployedAck finalization
NameRecord persistence
ATH refund-due accounting for rejected official mint notifications
treasury_due_ath and burn_due_ath accounting after ACK
```

Key safety rules:

```text
only stored official ATH wallet can trigger mint notification
payload name_hash is not trusted; registry computes it from raw username bytes
invalid official mint attempts do not create pending/name records
ACK accepted only from deterministic UsernameNFTItem address
treasury/burn due credited only after ACK
non-official ATH sender cannot create refund/pending/name record
```

Updated UsernameNFTItem behavior:

```text
ResendDeployedAck sends fixed 0.001 TON ACK with SendPayFwdFeesSeparately
ResendDeployedAck no longer uses SendRemainingValue
```

Not implemented:

```text
FlushTreasuryAthDue
FlushBurnAthDue
FlushAthRefundDue
PrunePendingUsernameMint
BuybackBurn
STON.fi route
ATH burn of burn_due_ath
```

Validation:

```text
npm run build: OK
npm audit --omit=dev --audit-level=high: 0 vulnerabilities
npm test -- --reporter=json --outputFile=artifacts/vitest_m10_npm_results.json --testTimeout=30000: 76/76 tests passed
```

New tests:

```text
USERNAME-REG-M10-01 valid official ATH mint deploys item, finalizes ACK, credits treasury/burn due
USERNAME-REG-M10-02 invalid uppercase username creates refund due and no pending/name record
USERNAME-REG-M10-03 non-official ATH sender rejected with no refund/pending/name record
USERNAME-REG-M10-04 duplicate finalized username refunds second minter without changing record
USERNAME-REG-M10-05 exact price tiers enforced; underpay refunded
```
