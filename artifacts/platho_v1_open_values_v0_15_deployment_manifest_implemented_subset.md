# Platho v1 Open Values v0.15 — Deployment Manifest Implemented-Subset Profile

**Document status:** accepted implementation profile for M15 test/deployment-vector layer  
**Rule:** this is **not** the final Platho v1 genesis manifest while listed blockers remain.

This profile pins a canonical manifest hash format for the currently implemented contract subset and refuses to represent it as final genesis until the remaining final-genesis blockers are resolved.

---

## 1. Scope

Included implemented artifacts:

```text
ATH Master
ATH Wallet
Vault
CapsuleHub
FeeAccumulator
UsernameNFTItem
UsernameRegistry
```

Excluded / still blocked:

```text
BuybackBurn
STON.fi v2 route and payload values
final buyback burn receiver StateInit address
```

The implemented-subset manifest is useful for:

```text
- deterministic deployment vectors
- address / StateInit / code-hash consistency checks
- DEPLOY-05 implemented-subset same-manifest-hash checks
- DEPLOY-06 official-client mismatch rejection tests
- DEPLOY-09 StateInit/initial-data checks
```

It MUST NOT be used as final genesis manifest while blockers remain.

---

## 2. Domain and version

```text
MANIFEST_DOMAIN = "PLATHO.V1.DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15"
MANIFEST_VERSION = 15
MANIFEST_STATUS = IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS
```

Root manifest cell:

```text
Cell {
  sha256(MANIFEST_DOMAIN): uint256
  MANIFEST_VERSION: uint16
  implemented_subset_marker: uint1 = 1
  ref addresses_list
  ref hashes_list
  ref constants_list
  ref blockers_list
}
```

Manifest hash:

```text
manifest_hash = cell_hash(root manifest cell)
```

---

## 3. Canonical lists

All labeled lists are sorted by label lexicographically before hashing.

### Address list node

```text
nil  = Cell { 0:uint1 }
node = Cell {
  1:uint1
  sha256(label): uint256
  address: MsgAddress
  ref next
}
```

### Hash list node

```text
nil  = Cell { 0:uint1 }
node = Cell {
  1:uint1
  sha256(label): uint256
  hash: uint256
  ref next
}
```

The hash list includes both compiled code hashes and StateInit hashes. StateInit hashes are label-prefixed as:

```text
state_init.<name>
```

### Constants list node

```text
nil  = Cell { 0:uint1 }
node = Cell {
  1:uint1
  sha256(label): uint256
  value: uint256
  ref next
}
```

### Blockers list node

```text
nil  = Cell { 0:uint1 }
node = Cell {
  1:uint1
  sha256(blocker_text): uint256
  ref next
}
```

---

## 4. Final genesis guard

If `blockers_before_final_genesis` is non-empty, official tooling MUST reject the manifest as final genesis.

M15 blockers:

```text
BUYBACK_BURN_CONTRACT_NOT_IMPLEMENTED_UNTIL_STONFI_ROUTE_VALUES_ARE_PINNED
STONFI_V2_ROUTE_AND_PAYLOAD_VALUES_NOT_PINNED
FINAL_DEPLOYMENT_MANIFEST_MUST_REPLACE_BUYBACK_BLOCKED_ADDRESS_WITH_REAL_BUYBACKBURN_STATEINIT_ADDRESS
```

---

## 5. Required tests

```text
DEPLOY-M15-01: manifest hash is canonical cell hash over sorted addresses, hashes, constants, and blockers
DEPLOY-M15-02/05/09: Vault, CapsuleHub, and UsernameRegistry can seal to the same implemented-subset manifest hash and expose it
DEPLOY-M15-03/06: official client profile rejects final genesis while blockers remain and detects manifest-hash mismatch
```
