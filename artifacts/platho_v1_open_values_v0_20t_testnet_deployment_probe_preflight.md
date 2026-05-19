# Platho v1 open values v0.20T — Testnet deployment probe preflight

## Status

`M20T_PREFLIGHT_ONLY`.

This milestone prepares a deterministic testnet deployment/probe workflow for the BuybackBurn path. It does not deploy anything by itself, does not claim production route freeze, and does not enable production BuybackBurn.

## Scope

M20T covers testnet behavior evidence for the already specified flow:

- FeeAccumulator keeps M19I buyback funding envelope semantics: `51.05 TON` total funding envelope, where `50 TON` is principal and `1.05 TON` is conservative route funding.
- A raw `50 TON` buyback amount is not accepted as a complete buyback funding envelope.
- Testnet deployment/probe must use disposable testnet wallets only.
- Testnet addresses and mainnet addresses must never be mixed in the same manifest.
- Testnet evidence cannot set `STONFI_ROUTE_FREEZE_READY=true`.
- Testnet evidence cannot set `BUYBACKBURN_IMPLEMENTATION_READY=true`.

## Non-goals

M20T explicitly does not:

- implement production BuybackBurn;
- freeze the mainnet STON.fi route;
- pin mainnet STON.fi router/pool/pTON code hashes;
- prove mainnet liquidity or quote behavior;
- add admin rescue, fallback routes, route switching, pause controls, owner override, ignored-error sends, or governance surfaces.

## Required artifacts from a live M20T run

A completed M20T live run must produce:

1. `artifacts/m20t_testnet_manifest.json`
2. `artifacts/m20t_testnet_evidence.json`
3. `artifacts/M20T_TESTNET_EVIDENCE.md`
4. full suite output under Vitest `vmThreads`
5. tx hashes and explorer links for all deployed contracts and probe messages
6. account states and balances before/after probe messages
7. explicit `NOT_MAINNET_ROUTE_FREEZE` conclusion

## Success criteria

M20T is successful only if all of these hold:

- disposable testnet deployer is used;
- deployer balance is captured before deployment;
- deployed/probed addresses are marked `testnet`;
- FeeAccumulator buyback envelope behavior remains `51.05 TON`;
- wrong sender is rejected;
- wrong amount is rejected;
- duplicate/replay behavior is captured or explicitly marked not applicable to that harness path;
- refund/excess/bounce behavior is captured when the relevant route/harness exists;
- no production flag is flipped;
- no secret material is committed.

## Relationship to M20F

M20T is a live behavior probe on testnet. M20F is the separate mainnet STON.fi route freeze.

M20T can strengthen confidence in contract behavior. It cannot prove mainnet router, pool, pTON, liquidity, quote, refund, excess, or code-hash identity. Those remain M20F requirements.
