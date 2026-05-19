# M20W Test Matrix Summary

M20W uses a chunked regression matrix instead of a single `npm test` proof artifact because the one-shot Vitest process can hang/time out in this sandbox around worker teardown/final summary capture.

## Summary

- Test files covered: 34 / 34
- Tests passed: 142 / 142
- Failed chunks: 0
- Production dependency audit: 0 vulnerabilities via `npm audit --omit=dev`

## Chunks

| Artifact | Files | Tests | Exit |
|---|---:|---:|---:|
| `M20W_AUTH_AND_DEPLOYMENT_TESTS_OUTPUT.txt` | 5 | 14 | 0 |
| `M20W_CONFORMANCE_ARTIFACT_GAS_TESTS_OUTPUT.txt` | 3 | 7 | 0 |
| `M20W_MONEY_ROUTE_REGRESSION_TESTS_OUTPUT.txt` | 13 | 57 | 0 |
| `M20W_RUNTIME_REGRESSION_TESTS_OUTPUT.txt` | 5 | 31 | 0 |
| `M20W_USERNAME_REGISTRY_REGRESSION_TESTS_OUTPUT.txt` | 5 | 18 | 0 |
| `M20W_VAULT_RUNTIME_REGRESSION_TESTS_OUTPUT.txt` | 3 | 15 | 0 |
| **Total** | **34** | **142** | **0 failed chunks** |

## New/security-focused tests

`tests/deployment-genesis-auth.test.ts` covers:

- arbitrary sender cannot call `Vault.BindDeploymentManifest`;
- arbitrary sender cannot call `Vault.BindOfficialAthWallet`;
- arbitrary sender cannot call `Vault.SealGenesis`;
- arbitrary sender cannot bind/seal `CapsuleHub`;
- arbitrary sender cannot bind/seal `UsernameRegistry`;
- genesis controller can perform legitimate bind/seal;
- after seal, genesis controller has no remaining rebind authority.

## Covered test files

1. `ath-burn-finalization.test.ts`
2. `ath-wallet-derivation.test.ts`
3. `ath-wallet-transfer.test.ts`
4. `capsulehub.test.ts`
5. `deployment-ath-wallet-binding.test.ts`
6. `deployment-binding.test.ts`
7. `deployment-genesis-auth.test.ts`
8. `deployment-manifest-m15.test.ts`
9. `fee-accumulator.test.ts`
10. `m16-conformance-static.test.ts`
11. `m17-gas-reserve-sanity.test.ts`
12. `m18-artifact-integrity.test.ts`
13. `m19-stonfi-route-discovery.test.ts`
14. `m19b-stonfi-conservative-gas.test.ts`
15. `m19c-stonfi-route-freeze-gate.test.ts`
16. `m19d-stonfi-route-candidate-intake.test.ts`
17. `m19e-stonfi-live-evidence-collector.test.ts`
18. `m19f-stonfi-route-evidence-dossier.test.ts`
19. `m19g-buybackburn-state-machine.test.ts`
20. `m19h-buybackburn-funding-envelope.test.ts`
21. `m20u-buybackburn-implementation-readiness.test.ts`
22. `username-nft-item.test.ts`
23. `username-registry-due-flush.test.ts`
24. `username-registry-foundation.test.ts`
25. `username-registry-paid-mint.test.ts`
26. `username-registry-prune-pending-mint.test.ts`
27. `username-registry-refund-flush.test.ts`
28. `vault-ath-integration.test.ts`
29. `vault-external-session-gate.test.ts`
30. `vault-key-records.test.ts`
31. `vault-m6-publish.test.ts`
32. `vault-prune-pending-publish.test.ts`
33. `vault-receive-intent.test.ts`
34. `vault-session-lifecycle.test.ts`
