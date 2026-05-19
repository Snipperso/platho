# Platho

[![CI](https://github.com/Snipperso/platho/actions/workflows/ci.yml/badge.svg)](https://github.com/Snipperso/platho/actions/workflows/ci.yml)

Platho is a no-backend encrypted messenger PWA and TON smart-contract suite.

The project is designed around a hard constraint: the messenger must remain usable as a static application without a proprietary server. Identity, key publication, and protocol mechanics are anchored in TON contracts; messages are encrypted client-side and can move through replaceable transports such as QR, files, Web Share, static mirrors, IPFS, TON Storage, or any other carrier.

## Status

Platho is experimental and pre-mainnet. Several contracts have gone through local engineering review and extended negative tests, but this repository is not a production release and has not completed independent external security review.

Do not deploy mainnet production artifacts until the gates in [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) pass.

## Repository layout

- `contracts/` - Tact smart contracts for Vault, Username Registry, CapsuleHub, ATH, FeeAccumulator, and BuybackBurn.
- `web/` - static PWA messenger runtime, crypto protocol docs, no-backend transport, service worker, and vendored browser dependencies needed for standalone operation.
- `tests/` - contract, runtime, crypto, deployment, and pre-production test suites.
- `scripts/` - build, artifact, route-freeze, readiness, crypto self-test, and static deploy helpers.
- `artifacts/` - audit notes, code hashes, generated evidence, milestone summaries, and reproducibility outputs.
- `deploy/` - static hosting examples for the PWA bundle.

## Local setup

```powershell
npm install
npm run build
npm test
```

Useful focused checks:

```powershell
npm run crypto:selftest
npm run m20f:address-preflight
npm run m20u:readiness
npm run preprod:check
```

`preprod:check` is expected to fail while the project still contains preview/testnet configuration. Treat a passing pre-production check as a release gate, not as a casual lint.

## Static PWA

The app in `web/` is intentionally serverless. A production bundle must use mainnet configuration, a real Vault chain provider, and no testnet fixtures.

Preview bundle:

```powershell
npm run web:deploy:prepare
```

Production bundle:

```powershell
npm run web:deploy:prepare:prod
```

The production command is intentionally blocked until the readiness gates pass.

## Security notes

- Never commit `.env.testnet.local`, wallet seed phrases, private keys, browser profiles, or faucet/testnet scratch files.
- Message encryption includes classical and hybrid post-quantum suites; see [web/CRYPTO_PROTOCOL.md](web/CRYPTO_PROTOCOL.md).
- The no-backend architecture and transport rules are documented in [web/NO_BACKEND_ARCHITECTURE.md](web/NO_BACKEND_ARCHITECTURE.md).
- Production use requires external review of the contracts, the PWA crypto layer, and the release bundle.

## License

No project license is granted yet. The source is public for transparency, but all rights are reserved until a license is explicitly added.
