# Spec Changelog: M18 Artifact Integrity & Reproducibility Lock

## Accepted changes

1. Added an implemented-subset artifact integrity profile.
2. Made generated artifact timestamp fields deterministic for acceptance.
3. Required current built code hashes to match all pinned code hash artifacts.
4. Required generated vectors to match current built code hashes.
5. Required the implemented-subset manifest artifact to match a rebuild from current source/build artifacts.
6. Updated UsernameRegistry mint vector constants to reflect the M13 ACK reserve change:

```text
USERNAME_ITEM_ACK_FORWARD_RESERVE_NANOTONS = 3_000_000
```

## Not changed

```text
No contract logic changed.
No opcodes changed.
No storage layout changed.
No reserve constants changed by M18.
No final genesis manifest introduced.
No BuybackBurn implementation introduced.
```

## Reason

Several historical vector artifacts still referenced earlier code hashes after later milestones changed ATHWallet, UsernameNFTItem, and UsernameRegistry artifacts. M18 makes this impossible to miss by locking vectors and manifests against the current build.
