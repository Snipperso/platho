# Platho M33 ATHWallet Owner Value Flow Fix

Status: **PASS**

Scope: fixes local ATHWallet owner-facing value-flow findings from the ATHWallet audit section.

## Closed Findings

- ATHW-01: notify and mint-notify owner requests no longer forward large caller overpayment into the recipient ATH wallet. The source wallet forwards only the canonical downstream envelope and refunds excess to the response destination. M46 refines this rule: dust excess below `100_000` nanotons is retained as source-wallet storage reserve instead of attempting a refund that can fail the action phase.
- ATHW-02: owner-facing burn, simple transfer, notify, and mint-notify requests now include a `2_000_000` nanotons first-hop execution reserve before ATH is debited.

## Current Rule

- Burn requires `ATH_BURN_NOTIFICATION_EXEC_RESERVE + ATH_OWNER_REQUEST_EXEC_RESERVE`; it forwards the caller-funded remainder because `ATHMaster` returns remaining value with the burn finalization callback.
- Simple transfer requires `ATH_INTERNAL_TRANSFER_EXEC_RESERVE + ATH_OWNER_REQUEST_EXEC_RESERVE`; it forwards the caller-funded remainder because the recipient ATH wallet returns remaining value with `ATHTransferAck`.
- Notify and mint-notify require the downstream notify envelope plus `ATH_OWNER_REQUEST_EXEC_RESERVE`; they forward only the bounded envelope and refund non-dust overpayment because their downstream path sends fixed notification and ACK values.

## Verification

- `npm.cmd run build`: PASS
- `npm.cmd run test:file -- tests\ath-wallet-transfer.test.ts tests\ath-wallet-boundary-negative.test.ts tests\ath-burn-finalization.test.ts tests\vault-ath-integration.test.ts tests\vault-boundary-negative.test.ts tests\buybackburn-production.test.ts tests\buybackburn-auth-negative-matrix.test.ts tests\username-registry-ath-wallet-integration.test.ts`: 8 files / 50 tests PASS
- `npm.cmd test`: 67 files / 281 tests PASS
- M16 conformance: PASS
- M18 artifact integrity: PASS

## Hashes

- `ATH_WALLET_CODE_HASH=bee2548d5aa56c9c45acd0ad7901052eb578858a6b8b95a57b83950b5a0baeb4`
- `ATHMASTER_CODE_HASH=005fe31e1e3ce7850498b501ca137dba7c38676dd86ccbbe3b563f9a283b2ec3`
- `BUYBACKBURN_CODE_HASH=f76fa64b76e786944003d89437da46b015eda511136fc761fc5b77743300307a`
- `VAULT_CODE_HASH=53c9f01402710f9248c278d9ae5dd03c449cb7ec80f0fd7cea2d0cd052447350`
- `USERNAME_REGISTRY_CODE_HASH=99e7f9f1908026373b0622516426f56e1f45142c9d2b539fba0e12c3cc5a55db`
- `DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15_HASH=c89a46b2d5a077412460da163b0285229973300d65973f9cd7d722fa5ea74a4f`

## Tooling Note

`scripts/tact_build.js` now compiles all configured Tact projects sequentially with bounded per-project retry when no `--project` is supplied. This preserves compiler inputs and outputs, while avoiding transient Windows file-open failures in the shared generated build tree.

## Production Note

This closes the local ATHWallet owner value-flow findings only. The implemented-subset manifest remains non-final while mainnet genesis and STON.fi route blockers remain open.
