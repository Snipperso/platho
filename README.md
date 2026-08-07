# Platho

[![CI](https://github.com/Snipperso/platho/actions/workflows/ci.yml/badge.svg)](https://github.com/Snipperso/platho/actions/workflows/ci.yml)

Platho is a no-backend encrypted messenger PWA and TON smart-contract suite.

The project is designed around a hard constraint: the messenger must remain usable as a static application without a proprietary server. External infrastructure of any kind — backend, issuer, relay, indexer — is forbidden by design, not merely unused. The PWA uses a normal 24-word recovery phrase as the single user secret; wallet keys and messaging keys are derived from that phrase. Identity, key publication, and protocol mechanics are anchored in TON contracts; private messages are encrypted client-side and published directly into per-lane shard accounts whose addresses are derived, not looked up.

## Status

The clean-17 contract generation is deployed and sealed on mainnet, and the PWA runs against it. Contracts are immutable after seal; migration hooks are built in for the next generation.

The genesis ceremony is complete: the supply is minted, the activity airdrop is funded and paying, and the live verifier passes against the sealed manifest. What has not happened yet is the ATH/GRAM pool launch, so protocol-fee discounts stay locked until the activity airdrop is fully distributed, and the post-pool route and pricing freezes remain outstanding by design.

Platho is still experimental. Every contract has gone through local engineering review and extended negative tests, but the project has not completed independent external security review. Treat the gates in [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) as the authority on what is and is not live.

## Repository layout

- `contracts/` - Tact smart contracts: the message lanes (RecordShard, IntroShard, RecoveryShard, PublicShard, KeyShard), identity (UsernameRegistry, UsernameNFTItem, ProfileRegistry), and the ATH economy (ATHMaster, ATHWallet, AirdropPool, AirdropTicket, ATHVesting, MarketStabilitySeller, FeeAccumulator, BuybackBurn).
- `web/` - static PWA messenger runtime, crypto protocol docs, service worker, and vendored browser dependencies needed for standalone operation.
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

The app in `web/` is intentionally serverless. A production bundle must use mainnet configuration, real contract addresses, and no testnet fixtures.

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

- Never commit `.env.testnet.local`, wallet recovery phrases, private keys, browser profiles, or faucet/testnet scratch files.
- Final v1 private publish uses the hybrid X25519 + ML-KEM-768 suite; see [web/CRYPTO_PROTOCOL.md](web/CRYPTO_PROTOCOL.md).
- The no-backend architecture and on-chain delivery rules are documented in [web/NO_BACKEND_ARCHITECTURE.md](web/NO_BACKEND_ARCHITECTURE.md).
- Production use requires external review of the contracts, the PWA crypto layer, and the release bundle.

## License

No project license is granted yet. The source is public for transparency, but all rights are reserved until a license is explicitly added.
