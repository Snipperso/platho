# Platho

[![CI](https://github.com/Snipperso/platho/actions/workflows/ci.yml/badge.svg)](https://github.com/Snipperso/platho/actions/workflows/ci.yml)

Platho is a no-backend encrypted messenger PWA and TON smart-contract suite.

The project is designed around a hard constraint: the messenger must remain usable as a static application without a proprietary server. External infrastructure of any kind — backend, issuer, relay, indexer — is forbidden by design, not merely unused. The PWA uses a normal 24-word recovery phrase as the single user secret; wallet keys and messaging keys are derived from that phrase. Identity, key publication, and protocol mechanics are anchored in TON contracts; private messages are encrypted client-side and published directly into per-lane shard accounts whose addresses are derived, not looked up.

## Status

The clean-18 contract generation is deployed and sealed on TON mainnet, and the PWA runs against it. The clean-17 sources
stay in `contracts/` because the client still reads the history written under that generation. Contracts are immutable
after seal.

Platho is still experimental. Every contract has gone through engineering review and extended negative tests, but the
project has not completed an independent external security review.

## Repository layout

- `contracts18/contracts/` - the live clean-18 Tact contracts.
- `contracts/` - the previous generation (clean-17), compiled by `npm run build` for the test suites.
- `web/` - the static PWA: runtime, service worker, user-facing docs, and the vendored browser dependencies it needs to
  run standalone.
- `web-about/` - the about.platho.app page.
- `tests/` - contract, runtime, crypto, and release-machinery tests.
- `scripts/` - build, list and vector generators, code checks, genesis verification, and the static bundle preparation.
- `artifacts/` - code hashes, genesis verification inputs and reports, test vectors, and the data the tests read.

The source files are published without comments.

## Local setup

```sh
npm ci
npm run build
npm test
npm run crypto:selftest
```

`npm run build` compiles the contracts into `build/`; the code hashes it produces can be compared with
`artifacts/*_CODE_HASH.txt`.

## Static PWA

The app in `web/` is intentionally serverless: any static host can serve it. `npm run web:deploy:prepare` writes the
preview and production bundles into `artifacts/`.

## Security notes

- Private messages use the hybrid X25519 + ML-KEM-768 suite; see [web/CRYPTO_PROTOCOL.md](web/CRYPTO_PROTOCOL.md).
- The no-backend architecture and on-chain delivery rules are documented in [web/NO_BACKEND_ARCHITECTURE.md](web/NO_BACKEND_ARCHITECTURE.md).
- Reporting a vulnerability: see [SECURITY.md](SECURITY.md).

## License

The repository is split on purpose:

- **`web/` — the client — is Apache-2.0** ([web/LICENSE](web/LICENSE)). Fork it, change it, ship your own. A forked client speaks to the same contracts and the same people, so more clients make one network stronger.
- **Everything else — contracts, scripts, tests — is Source Available** ([LICENSE](LICENSE)): readable and verifiable by anyone, not re-deployable as a competing "Platho".

Apache-2.0 section 6 grants no trademark rights, and that is deliberate: fork the client freely, but call it something other than Platho.
