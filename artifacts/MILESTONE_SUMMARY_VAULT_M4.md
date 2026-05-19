# Platho Vault milestone 4: ATH deposit/withdraw integration

Scope implemented:

- official ATH wallet address stored in Vault init data
- `Vault.AthTransferNotification` accepted only from the stored official ATH wallet
- first ATH deposit creates `UserState` only if enough forwarded TON covers `VAULT_USER_STATE_STORAGE_ENDOWMENT`
- non-official ATH notifications rejected
- `Vault.WithdrawAth` debits internal `ath_balance` and creates pending ATH withdrawal
- ATH withdrawal sends bounceable request to official ATH wallet
- official ATH wallet ack clears pending withdrawal
- bounce/failure restores `ath_balance` and clears pending withdrawal
- test-only `MockVaultAthWallet` for notification/ack/bounce tests

Explicitly not implemented:

- final ATH jetton wallet transfer payload/profile
- downstream seal checks
- real official ATH wallet integration in deployment manifest
- external session publish
- PendingPublish / CapsuleHub ACK routing
- Vault seal checks

Commands run:

```bash
npm run build
npm test -- --reporter=verbose
npm audit --omit=dev
```

Results:

```text
8 test files passed, 50 tests passed
npm audit --omit=dev: 0 vulnerabilities
```

Code hashes:

```text
VAULT_CODE_HASH = e89cb7683510eaeb8541ba0a38509696fb8400d0a2851e8e1fe1c7f442a32d9c
VAULT_CODE_BOC_SHA256 = 3adc50db24fff2ec9c36d163efd2656cf05950dd0defcf8091bd6095b297534e
MOCK_VAULT_ATH_WALLET_CODE_HASH = 9dff854edded531aca8ae603427aa978f14ee45517b9ec97d51760b197353cad
```

Caveat:

`MockVaultAthWallet` is test-only and not part of Platho v1 production contracts. The final ATH jetton wallet transfer body/profile still must be pinned when connecting real ATH wallet transfers.
