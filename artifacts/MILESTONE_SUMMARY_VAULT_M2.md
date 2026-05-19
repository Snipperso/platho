# Platho Vault milestone 2: KeyRecord + key_generation lifecycle

Scope implemented:

- `contracts/Vault.tact`
- UserStateV1 from milestone 1
- SessionStateV1 from milestone 1
- TON deposit / withdrawal from milestone 1
- Message Budget lifecycle from milestone 1
- `RegisterMessagingKeys`
- `ReplaceMessagingKeys`
- `KeyRecord` storage
- `key_generation` lifecycle
- historical key revocation metadata
- standard vs long-term key-record storage endowment selection
- key id preimage split across refs to avoid cell overflow
- no admin / owner override / pause / upgrade / governance / rescue / fallback paths

Explicitly not implemented:

- ATH deposit / ATH withdraw integration in Vault
- ReceiveIntent
- CompactSessionRequestV1
- external no-popup publish
- PendingPublish
- CapsuleHub ACK/excess routing inside Vault
- seal checks
- deployment manifest vectors

Important implementation note:

The first implementation attempt placed all key id fields in a single cell and hit a cell overflow at runtime. The fixed key id preimage stores large key fields in a referenced cell. This is intentional and tested by successful registration/replacement flows.

Commands run:

```bash
npm run build
npm test -- --reporter=verbose
npm audit --omit=dev
```

Results:

```text
6 test files passed
38 tests passed
npm audit --omit=dev: 0 vulnerabilities
```

Code hashes:

```text
VAULT_CODE_HASH = 55d8f03044c32810ac82002eae2677ebe38f18746d2b9a3c5d46bc2f45e02d2f
VAULT_CODE_BOC_SHA256 = 6dd6f9a309b8875ef74aefde8e4bc3d6f9edd2ae7482cbf096f1d9e1eb1860a3
```

New tests:

```text
VAULT-HAPPY-06: first key registration creates UserState and key_generation 0 record
VAULT-HAPPY-07: key replacement revokes previous key and creates generation 1
VAULT-REJECT: cannot register twice and cannot replace before registration
VAULT-REJECT: invalid suite/key profile is rejected without mutating current key
```
