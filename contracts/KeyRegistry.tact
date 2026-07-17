// KeyRegistry — clean-16 Durable-Core (Phase B1, Vault-elimination).
//
// A public, DURABLE directory of messaging identities, decoupled from custody. Verdict
// SHRINK_VAULT_TO_KEYREGISTRY: this is the Vault's key-record subsystem + the UsernameRegistry freeze pattern
// − ALL custody + scan_pubkey + storage-economics. Removing custody KILLS timebombs #1-#6 (all were Vault custody).
//
// Others resolve `owner_wallet -> current messaging keys` (enc/sign/scan/ML-KEM) to encapsulate an INTRO to a
// recipient or verify a claimed sender's signature. Keys are advertised; auth_pubkey (the action key that authorizes
// rotation) is stored but NEVER returned by a getter.
//
// Rotation model is inherited from the clean-16 Vault decision (ReplaceMessagingKeys): DELETE the old record and
// write the new generation — exactly ONE live record per account, O(1), net-zero storage per rotation. The recipient
// decrypts old messages with seed-derived secrets held in the client's versioned-per-keyId contact store, and senders
// re-resolve the current key here, so the on-chain old record is not needed after rotation. (The client historical
// revoked_lt message-time check is NOT implemented here — same residual the Vault flagged — earmarked for the external
// audit before seal; a compact revocation ledger can be added there if the audit requires it.)
//
// Design: artifacts/PLATHO_CLEAN16_KEYREGISTRY_DESIGN.md. NOT part of the custodial Vault; NO ton/ath balance,
// deposits, withdrawals, publish, ATH, receive-intents, receipts.

const KEYREG_CRYPTO_SUITE_HYBRID: Int = 2;
const KEYREG_MLKEM768_PUBKEY_LEN: Int = 1184;
const KEYREG_MLKEM768_PUBKEY_SNAKE_CHUNK_BYTES: Int = 127;
const KEYREG_MLKEM768_PUBKEY_SNAKE_FIRST_CHUNK_BYTES: Int = 41;
const KEYREG_MLKEM768_PUBKEY_SNAKE_CELLS: Int = 10;
const KEYREG_MLKEM768_PUBKEY_SNAKE_BITS: Int = 9472;
const KEYREG_MLKEM768_PUBKEY_SNAKE_REFS: Int = 9;
const KEYREG_UINT32_MAX: Int = 4294967295;
const KEYREG_KEY_ID_DOMAIN: Int = 0x4b455949;              // "KEYI"
const KEYREG_REPLACE_KEYS_SIGNING_DOMAIN: Int = 0x4b524b31; // "KRK1"

// Storage endowments (G8-PROVISIONAL — finalize from measured computeDataSize @ 64962 nanoton/cell/yr, bit=0).
// Mirrors the Vault's per-entry terms (30M HYBRID key record, 10M account). Base endowment funds the singleton
// contract's own code-rent (#19). Each register REQUIRES its record+account endowment up front -> self-financing.
const KEYREG_KEY_RECORD_STORAGE_ENDOWMENT: Int = 30000000;
const KEYREG_ACCOUNT_STORAGE_ENDOWMENT: Int = 10000000;
const KEYREG_STATE_GROWTH_EXEC_RESERVE: Int = 2000000;
const KEYREG_BASE_STORAGE_ENDOWMENT: Int = 100000000;

message(0x4B524731) KeyRegRegisterMessagingKeys {   // "KRG1"
    enc_pubkey: Int as uint256;
    sign_pubkey: Int as uint256;
    scan_pubkey: Int as uint256;
    auth_pubkey: Int as uint256;
    pq_kem_pubkey_hash: Int as uint256;
    pq_kem_pubkey_len: Int as uint16;
    pq_kem_pubkey: Cell;
    crypto_suite_mask: Int as uint16;
}

message(0x4B524732) KeyRegReplaceMessagingKeys {    // "KRG2"
    owner_wallet: Address;
    signature: Slice as bytes64;
    signed_payload: Cell;
    envelope_padding: Slice as remaining;
}

message(0x4B524733) KeyRegBindController {          // "KRG3" (reserved for future consumer binds; controller is set in init)
    deployment_manifest_hash: Int as uint256;
}

message(0x3A12D1AD) KeyRegSealGenesis {
    deployment_manifest_hash: Int as uint256;
}

message(0x4B524734) KeyRegTopUpStorageReserve {}    // "KRG4" (permissionless self-financing top-up)

struct KeyAccount {
    owner_wallet: Address;
    current_key_id: Int as uint256;
    auth_pubkey: Int as uint256;      // ed25519 action key (rotation auth). NEVER advertised.
    key_generation: Int as uint32;
    rotation_nonce: Int as uint64;    // anti-replay for the external rotation
    registered_at: Int as uint64;
}

struct KeyRecord {
    owner_wallet: Address;
    key_generation: Int as uint32;
    enc_pubkey: Int as uint256;       // X25519 encryption
    sign_pubkey: Int as uint256;      // ed25519 signing (advertised)
    scan_pubkey: Int as uint256;      // X25519 scan (INTRO view_tag + CONV bucket derivation)
    pq_kem_pubkey_hash: Int as uint256;
    pq_kem_pubkey_len: Int as uint16;
    pq_kem_pubkey: Cell;              // ML-KEM-768 pubkey (~1184 bytes, 10-cell snake)
    crypto_suite_mask: Int as uint16;
    created_at: Int as uint64;
    created_lt: Int as uint64;
    revoked_at: Int as uint64;
    revoked_lt: Int as uint64;
}

struct KeyRegKeyRecordView {
    exists: Bool;
    owner_wallet: Address;
    key_generation: Int;
    enc_pubkey: Int;
    sign_pubkey: Int;
    scan_pubkey: Int;
    pq_kem_pubkey_hash: Int;
    pq_kem_pubkey_len: Int;
    pq_kem_pubkey: Cell;
    crypto_suite_mask: Int;
    created_at: Int;
    created_lt: Int;
    revoked_at: Int;
    revoked_lt: Int;
}

struct KeyRegAccountView {
    exists: Bool;
    owner_wallet: Address;
    current_key_id: Int;
    key_generation: Int;
    rotation_nonce: Int;
    registered_at: Int;
    // auth_pubkey intentionally OMITTED (privacy invariant).
}

struct KeyRegGlobalView {
    sealed: Bool;
    deployment_manifest_hash: Int;
    genesis_config_hash: Int;
    genesis_controller_address: Address;
    account_count: Int;
    key_record_count: Int;
    key_record_storage_endowment: Int;
    account_storage_endowment: Int;
    base_storage_endowment: Int;
}

contract KeyRegistry {
    sealed: Bool;
    genesis_controller_address: Address;
    deployment_manifest_hash: Int as uint256;
    genesis_config_hash: Int as uint256;
    account_count: Int as uint64;
    key_record_count: Int as uint64;
    accounts: map<Int, KeyAccount>;
    key_records: map<Int, KeyRecord>;

    init(genesis_controller_address: Address, deployment_manifest_hash: Int, genesis_config_hash: Int, sealed: Bool) {
        self.sealed = sealed;
        self.genesis_controller_address = genesis_controller_address;
        self.deployment_manifest_hash = deployment_manifest_hash;
        self.genesis_config_hash = genesis_config_hash;
        self.account_count = 0;
        self.key_record_count = 0;
    }

    // ---- lifecycle guards (mirror UsernameRegistry) ----

    fun requireUnsealed() {
        throwUnless(20000, !self.sealed);
    }

    fun requireSealed() {
        throwUnless(20100, self.sealed);
    }

    fun requireGenesisController() {
        throwUnless(20033, sender() == self.genesis_controller_address);
    }

    fun isBasechainAddress(address: Address): Bool {
        let std: StdAddress = parseStdAddress(address.asSlice());
        return std.workchain == 0;
    }

    fun accountKey(owner: Address): Int {
        let ownerSlice: Slice = owner.asSlice();
        throwUnless(20050, ownerSlice.loadUint(11) == 1024);
        return ownerSlice.loadUint(256);
    }

    // ---- storage economics ----

    // The TON the contract MUST retain to fund its never-shrinking state's rent (#5/#19). Each register collects the
    // per-entry endowment up front; rotation is net-zero (delete old record + write new same-size). Fail-closed floor.
    // G8-provisional: finalize per-entry terms from measured DataSize.
    fun storageReserve(): Int {
        return KEYREG_BASE_STORAGE_ENDOWMENT
            + self.account_count * KEYREG_ACCOUNT_STORAGE_ENDOWMENT
            + self.key_record_count * KEYREG_KEY_RECORD_STORAGE_ENDOWMENT;
    }

    // ---- key-profile validation (ported from Vault) ----

    fun validatePqPubkeyCell(pqLen: Int, cryptoSuiteMask: Int, pqPubkey: Cell) {
        throwUnless(20107, cryptoSuiteMask == KEYREG_CRYPTO_SUITE_HYBRID);
        let size: DataSize = pqPubkey.computeDataSize(KEYREG_MLKEM768_PUBKEY_SNAKE_CELLS);
        throwUnless(20108, size.cells == KEYREG_MLKEM768_PUBKEY_SNAKE_CELLS);
        throwUnless(20109, size.bits == KEYREG_MLKEM768_PUBKEY_SNAKE_BITS);
        throwUnless(20113, size.refs == KEYREG_MLKEM768_PUBKEY_SNAKE_REFS);

        let cursor: Cell = pqPubkey;
        let remaining: Int = pqLen;
        while (remaining > 0) {
            let chunkBytes: Int = KEYREG_MLKEM768_PUBKEY_SNAKE_CHUNK_BYTES;
            if (remaining == KEYREG_MLKEM768_PUBKEY_LEN) {
                chunkBytes = KEYREG_MLKEM768_PUBKEY_SNAKE_FIRST_CHUNK_BYTES;
            } else {
                if (remaining < chunkBytes) {
                    chunkBytes = remaining;
                }
            }
            let cursorSlice: Slice = cursor.beginParse();
            throwUnless(20114, cursorSlice.bits() == (chunkBytes * 8));
            if (remaining > chunkBytes) {
                throwUnless(20115, cursorSlice.refs() == 1);
                cursor = cursorSlice.loadRef();
            } else {
                throwUnless(20116, cursorSlice.refs() == 0);
            }
            remaining -= chunkBytes;
        }
    }

    fun isValidPqPubkeyCell(pqLen: Int, cryptoSuiteMask: Int, pqPubkey: Cell): Bool {
        if (cryptoSuiteMask != KEYREG_CRYPTO_SUITE_HYBRID) {
            return false;
        }
        let size: DataSize = pqPubkey.computeDataSize(KEYREG_MLKEM768_PUBKEY_SNAKE_CELLS);
        if (size.cells != KEYREG_MLKEM768_PUBKEY_SNAKE_CELLS) {
            return false;
        }
        if (size.bits != KEYREG_MLKEM768_PUBKEY_SNAKE_BITS) {
            return false;
        }
        if (size.refs != KEYREG_MLKEM768_PUBKEY_SNAKE_REFS) {
            return false;
        }

        let cursor: Cell = pqPubkey;
        let remaining: Int = pqLen;
        while (remaining > 0) {
            let chunkBytes: Int = KEYREG_MLKEM768_PUBKEY_SNAKE_CHUNK_BYTES;
            if (remaining == KEYREG_MLKEM768_PUBKEY_LEN) {
                chunkBytes = KEYREG_MLKEM768_PUBKEY_SNAKE_FIRST_CHUNK_BYTES;
            } else {
                if (remaining < chunkBytes) {
                    chunkBytes = remaining;
                }
            }
            let cursorSlice: Slice = cursor.beginParse();
            if (cursorSlice.bits() != (chunkBytes * 8)) {
                return false;
            }
            if (remaining > chunkBytes) {
                if (cursorSlice.refs() != 1) {
                    return false;
                }
                cursor = cursorSlice.loadRef();
            } else {
                if (cursorSlice.refs() != 0) {
                    return false;
                }
            }
            remaining -= chunkBytes;
        }
        return true;
    }

    fun validateKeyProfile(encPubkey: Int, signPubkey: Int, scanPubkey: Int, pqHash: Int, pqLen: Int, pqPubkey: Cell, cryptoSuiteMask: Int) {
        throwUnless(20101, encPubkey != 0);
        throwUnless(20102, signPubkey != 0);
        throwUnless(20103, scanPubkey != 0);
        throwUnless(20107, cryptoSuiteMask == KEYREG_CRYPTO_SUITE_HYBRID);
        throwUnless(20105, pqHash != 0);
        throwUnless(20106, pqLen == KEYREG_MLKEM768_PUBKEY_LEN);
        self.validatePqPubkeyCell(pqLen, cryptoSuiteMask, pqPubkey);
    }

    fun isValidKeyProfile(encPubkey: Int, signPubkey: Int, scanPubkey: Int, pqHash: Int, pqLen: Int, pqPubkey: Cell, cryptoSuiteMask: Int): Bool {
        if (encPubkey == 0) { return false; }
        if (signPubkey == 0) { return false; }
        if (scanPubkey == 0) { return false; }
        if (cryptoSuiteMask != KEYREG_CRYPTO_SUITE_HYBRID) { return false; }
        if (pqHash == 0) { return false; }
        if (pqLen != KEYREG_MLKEM768_PUBKEY_LEN) { return false; }
        return self.isValidPqPubkeyCell(pqLen, cryptoSuiteMask, pqPubkey);
    }

    // keyId binds owner+generation+enc/sign/pqHash (ported verbatim from the Vault). key_generation is unique per
    // account and increments on every rotation, so it alone guarantees a fresh keyId per record — scan_pubkey need
    // NOT enter the id (it is stored+advertised in the KeyRecord). Keeping enc+sign+pqHash = 768 bits (< 1023).
    fun computeKeyId(owner: Address, keyGeneration: Int, encPubkey: Int, signPubkey: Int, pqHash: Int, pqLen: Int, cryptoSuiteMask: Int): Int {
        let keyFields: Cell = beginCell()
            .storeUint(encPubkey, 256)
            .storeUint(signPubkey, 256)
            .storeUint(pqHash, 256)
            .endCell();
        return beginCell()
            .storeUint(KEYREG_KEY_ID_DOMAIN, 32)
            .storeAddress(owner)
            .storeUint(keyGeneration, 32)
            .storeUint(pqLen, 16)
            .storeUint(cryptoSuiteMask, 16)
            .storeRef(keyFields)
            .endCell()
            .hash();
    }

    inline fun requireEmptyEnvelopePadding(padding: Slice) {
        // Canonical, non-malleable external form: reject any extra refs/bits appended OUTSIDE the signature
        // (they would be charged to the pool as import fee but are not covered by the signature). Pre-accept.
        throwUnless(20900, padding.bits() == 0);
        throwUnless(20901, padding.refs() == 0);
    }

    // ---- genesis lifecycle ----

    receive(msg: KeyRegSealGenesis) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(20040, msg.deployment_manifest_hash > 1);
        throwUnless(20041, self.deployment_manifest_hash == msg.deployment_manifest_hash);
        self.genesis_config_hash = msg.deployment_manifest_hash;
        self.sealed = true;
    }

    // ---- register: first messaging identity for a wallet (sender-auth) ----

    receive(msg: KeyRegRegisterMessagingKeys) {
        self.requireSealed();
        self.validateKeyProfile(msg.enc_pubkey, msg.sign_pubkey, msg.scan_pubkey, msg.pq_kem_pubkey_hash, msg.pq_kem_pubkey_len, msg.pq_kem_pubkey, msg.crypto_suite_mask);
        throwUnless(20118, msg.auth_pubkey != 0);
        throwUnless(20119, msg.auth_pubkey != msg.sign_pubkey);
        throwUnless(20051, self.isBasechainAddress(sender()));

        let accKey: Int = self.accountKey(sender());
        throwUnless(20111, !self.accounts.exists(accKey));

        let required: Int = KEYREG_KEY_RECORD_STORAGE_ENDOWMENT + KEYREG_ACCOUNT_STORAGE_ENDOWMENT + KEYREG_STATE_GROWTH_EXEC_RESERVE;
        throwUnless(20110, context().value >= required);

        let keyGeneration: Int = 0;
        let keyId: Int = self.computeKeyId(sender(), keyGeneration, msg.enc_pubkey, msg.sign_pubkey, msg.pq_kem_pubkey_hash, msg.pq_kem_pubkey_len, msg.crypto_suite_mask);
        throwUnless(20112, !self.key_records.exists(keyId));

        self.key_records.set(keyId, KeyRecord {
            owner_wallet: sender(),
            key_generation: keyGeneration,
            enc_pubkey: msg.enc_pubkey,
            sign_pubkey: msg.sign_pubkey,
            scan_pubkey: msg.scan_pubkey,
            pq_kem_pubkey_hash: msg.pq_kem_pubkey_hash,
            pq_kem_pubkey_len: msg.pq_kem_pubkey_len,
            pq_kem_pubkey: msg.pq_kem_pubkey,
            crypto_suite_mask: msg.crypto_suite_mask,
            created_at: now(),
            created_lt: curLt(),
            revoked_at: 0,
            revoked_lt: 0
        });
        self.key_record_count += 1;
        self.accounts.set(accKey, KeyAccount {
            owner_wallet: sender(),
            current_key_id: keyId,
            auth_pubkey: msg.auth_pubkey,
            key_generation: keyGeneration,
            rotation_nonce: 0,
            registered_at: now()
        });
        self.account_count += 1;
    }

    // ---- rotate: replace messaging keys (external, signature-auth) ----

    external(msg: KeyRegReplaceMessagingKeys) {
        self.requireEmptyEnvelopePadding(msg.envelope_padding);
        self.requireSealed();

        let accKey: Int = self.accountKey(msg.owner_wallet);
        let accOpt: KeyAccount? = self.accounts.get(accKey);
        throwUnless(20120, accOpt != null);
        let account: KeyAccount = accOpt!!;
        throwUnless(20121, account.current_key_id != 0);
        throwUnless(20128, account.auth_pubkey != 0);
        throwUnless(20130, checkSignature(msg.signed_payload.hash(), msg.signature, account.auth_pubkey));

        let signedPayload: Slice = msg.signed_payload.beginParse();
        throwUnless(20136, signedPayload.bits() == 864);
        throwUnless(20137, signedPayload.refs() == 1);
        let signedDomain: Int = signedPayload.loadUint(32);
        throwUnless(20131, signedDomain == KEYREG_REPLACE_KEYS_SIGNING_DOMAIN);
        let signedManifestHash: Int = signedPayload.loadUint(256);
        throwUnless(20132, signedManifestHash == self.deployment_manifest_hash);
        let signedRegistryHash: Int = signedPayload.loadUint(256);
        let registrySlice: Slice = myAddress().asSlice();
        throwUnless(20133, registrySlice.loadUint(11) == 1024);
        throwUnless(20133, signedRegistryHash == registrySlice.loadUint(256));
        let signedOwnerHash: Int = signedPayload.loadUint(256);
        throwUnless(20134, signedOwnerHash == accKey);
        let signedNonce: Int = signedPayload.loadUint(64);
        throwUnless(20135, signedNonce == account.rotation_nonce);

        acceptMessage();
        account.rotation_nonce += 1;
        self.accounts.set(accKey, account);
        commit();

        // actionPayload layout (spilled to stay under the 1023-bit cell limit): enc(256)|sign(256)|scan(256)|
        // pqLen(16)|suite(16) = 800 bits inline, ref[0] = ML-KEM pubkey snake, ref[1] = cell{ pqHash(256) }.
        let actionPayloadCell: Cell = signedPayload.loadRef();
        let actionPayloadPreview: Slice = actionPayloadCell.beginParse();
        if (!(actionPayloadPreview.bits() == 800)) { return; }
        if (!(actionPayloadPreview.refs() == 2)) { return; }

        let actionPayload: Slice = actionPayloadCell.beginParse();
        let encPubkey: Int = actionPayload.loadUint(256);
        let signPubkey: Int = actionPayload.loadUint(256);
        let scanPubkey: Int = actionPayload.loadUint(256);
        let pqKemPubkeyLen: Int = actionPayload.loadUint(16);
        let cryptoSuiteMask: Int = actionPayload.loadUint(16);
        let pqKemPubkey: Cell = actionPayload.loadRef();
        let pqHashCell: Cell = actionPayload.loadRef();
        if (!(actionPayload.bits() == 0)) { return; }
        if (!(actionPayload.refs() == 0)) { return; }
        let pqHashSlice: Slice = pqHashCell.beginParse();
        if (!(pqHashSlice.bits() == 256)) { return; }
        if (!(pqHashSlice.refs() == 0)) { return; }
        let pqKemPubkeyHash: Int = pqHashSlice.loadUint(256);

        if (!self.isValidKeyProfile(encPubkey, signPubkey, scanPubkey, pqKemPubkeyHash, pqKemPubkeyLen, pqKemPubkey, cryptoSuiteMask)) {
            return;
        }
        if (!(signPubkey != account.auth_pubkey)) { return; }

        let oldRecordOpt: KeyRecord? = self.key_records.get(account.current_key_id);
        if (oldRecordOpt == null) { return; }
        let oldRecord: KeyRecord = oldRecordOpt!!;
        if (!(oldRecord.owner_wallet == msg.owner_wallet)) { return; }
        if (!(oldRecord.revoked_lt == 0)) { return; }
        if (!(oldRecord.key_generation < KEYREG_UINT32_MAX)) { return; }

        let keyGeneration: Int = oldRecord.key_generation + 1;
        let newKeyId: Int = self.computeKeyId(msg.owner_wallet, keyGeneration, encPubkey, signPubkey, pqKemPubkeyHash, pqKemPubkeyLen, cryptoSuiteMask);
        if (self.key_records.exists(newKeyId)) { return; }

        // clean-16 model (inherited from the Vault): DELETE the old record and keep exactly ONE live record per
        // account -> O(1), net-zero storage per rotation. Old-message decryption uses the client's seed-derived,
        // versioned-per-keyId secret store; senders re-resolve the current key here.
        self.key_records.del(account.current_key_id);
        self.key_records.set(newKeyId, KeyRecord {
            owner_wallet: msg.owner_wallet,
            key_generation: keyGeneration,
            enc_pubkey: encPubkey,
            sign_pubkey: signPubkey,
            scan_pubkey: scanPubkey,
            pq_kem_pubkey_hash: pqKemPubkeyHash,
            pq_kem_pubkey_len: pqKemPubkeyLen,
            pq_kem_pubkey: pqKemPubkey,
            crypto_suite_mask: cryptoSuiteMask,
            created_at: now(),
            created_lt: curLt(),
            revoked_at: 0,
            revoked_lt: 0
        });
        // key_record_count unchanged (one deleted, one added).

        account.current_key_id = newKeyId;
        account.key_generation = keyGeneration;
        self.accounts.set(accKey, account);
    }

    // ---- permissionless self-financing top-up ----

    receive(msg: KeyRegTopUpStorageReserve) {
        // Accept value into the pool; no state change. Anyone may fund the contract's rent.
    }

    receive() {}

    // ---- getters ----

    get fun get_key_record(keyId: Int): KeyRegKeyRecordView {
        let recordOpt: KeyRecord? = self.key_records.get(keyId);
        if (recordOpt == null) {
            return KeyRegKeyRecordView {
                exists: false,
                owner_wallet: myAddress(),
                key_generation: 0,
                enc_pubkey: 0,
                sign_pubkey: 0,
                scan_pubkey: 0,
                pq_kem_pubkey_hash: 0,
                pq_kem_pubkey_len: 0,
                pq_kem_pubkey: emptyCell(),
                crypto_suite_mask: 0,
                created_at: 0,
                created_lt: 0,
                revoked_at: 0,
                revoked_lt: 0
            };
        }
        let record: KeyRecord = recordOpt!!;
        return KeyRegKeyRecordView {
            exists: true,
            owner_wallet: record.owner_wallet,
            key_generation: record.key_generation,
            enc_pubkey: record.enc_pubkey,
            sign_pubkey: record.sign_pubkey,
            scan_pubkey: record.scan_pubkey,
            pq_kem_pubkey_hash: record.pq_kem_pubkey_hash,
            pq_kem_pubkey_len: record.pq_kem_pubkey_len,
            pq_kem_pubkey: record.pq_kem_pubkey,
            crypto_suite_mask: record.crypto_suite_mask,
            created_at: record.created_at,
            created_lt: record.created_lt,
            revoked_at: record.revoked_at,
            revoked_lt: record.revoked_lt
        };
    }

    get fun get_account(owner_wallet: Address): KeyRegAccountView {
        let accOpt: KeyAccount? = self.accounts.get(self.accountKey(owner_wallet));
        if (accOpt == null) {
            return KeyRegAccountView {
                exists: false,
                owner_wallet: myAddress(),
                current_key_id: 0,
                key_generation: 0,
                rotation_nonce: 0,
                registered_at: 0
            };
        }
        let account: KeyAccount = accOpt!!;
        return KeyRegAccountView {
            exists: true,
            owner_wallet: account.owner_wallet,
            current_key_id: account.current_key_id,
            key_generation: account.key_generation,
            rotation_nonce: account.rotation_nonce,
            registered_at: account.registered_at
        };
    }

    get fun get_current_key_record(owner_wallet: Address): KeyRegKeyRecordView {
        let accOpt: KeyAccount? = self.accounts.get(self.accountKey(owner_wallet));
        if (accOpt == null) {
            return self.get_key_record(0);
        }
        let account: KeyAccount = accOpt!!;
        return self.get_key_record(account.current_key_id);
    }

    get fun get_global(): KeyRegGlobalView {
        return KeyRegGlobalView {
            sealed: self.sealed,
            deployment_manifest_hash: self.deployment_manifest_hash,
            genesis_config_hash: self.genesis_config_hash,
            genesis_controller_address: self.genesis_controller_address,
            account_count: self.account_count,
            key_record_count: self.key_record_count,
            key_record_storage_endowment: KEYREG_KEY_RECORD_STORAGE_ENDOWMENT,
            account_storage_endowment: KEYREG_ACCOUNT_STORAGE_ENDOWMENT,
            base_storage_endowment: KEYREG_BASE_STORAGE_ENDOWMENT
        };
    }
}
