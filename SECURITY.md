# Security Policy

Platho is experimental and pre-mainnet. The public repository is provided for
transparency and review, not as a production release.

## Supported Versions

No production version is currently supported. Treat every commit as
pre-release research software unless a release is explicitly marked production
ready.

## Reporting a Vulnerability

If GitHub private vulnerability reporting is enabled for this repository, use
that channel for sensitive reports.

If private reporting is not available, do not publish exploit details, private
keys, seed phrases, deanonymizing information, or reproducible attack steps in a
public issue. Open a minimal issue stating that you need a private security
channel, and include only non-sensitive context.

Useful reports include:

- affected contract, script, or web module;
- expected behavior and observed behavior;
- impact assessment;
- minimal reproduction details that do not expose live secrets or exploitable
  mainnet funds;
- suggested mitigation, if known.

## Scope

Security-sensitive areas include:

- TON smart contracts in `contracts/`;
- generated contract artifacts and deployment scripts;
- the static PWA runtime in `web/`;
- client-side encryption, key exchange, and local storage handling;
- production readiness gates and deployment configuration.

## Production Gate

Do not use Platho for production funds or private production messaging until
the gates in `PRODUCTION_READINESS.md` pass and independent external security
review is complete.
