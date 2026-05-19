# Spec Changelog - M16 Production Conformance & Compactness

## Accepted

M16 adds no runtime protocol surface. It accepts a conformance profile requiring static and manifest-level checks over the implemented subset.

## Added obligations

- No ignored-error money send mode in production contracts.
- No MessageSession or session-spender contract.
- No admin / owner override / pause / upgrade / governance / rescue / fallback message surface.
- Empty receive fallback must explicitly reject in every production contract.
- Built code hashes must match pinned artifact hash files.
- Implemented-subset manifest must remain non-final while BuybackBurn / STON.fi blockers remain.

## Code changes

No contract logic changed in M16.
