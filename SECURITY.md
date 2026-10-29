# Security Policy

Platho is experimental. The public repository is provided for transparency and
review.

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

- TON smart contracts in `contracts18/contracts/` and `contracts/`;
- generated contract artifacts and the genesis scripts;
- the static PWA runtime in `web/`;
- client-side encryption, key exchange, and local storage handling;
- the static bundle preparation.

## Production Gate

The project has not completed an independent external security review. Weigh
that before trusting it with funds or private messages.
