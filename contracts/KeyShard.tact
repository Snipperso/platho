
const KS_CRYPTO_SUITE_HYBRID: Int = 2;
const KS_MLKEM768_PUBKEY_LEN: Int = 1184;
const KS_MLKEM768_PUBKEY_SNAKE_CHUNK_BYTES: Int = 127;
const KS_MLKEM768_PUBKEY_SNAKE_FIRST_CHUNK_BYTES: Int = 41;
const KS_MLKEM768_PUBKEY_SNAKE_CELLS: Int = 10;
const KS_MLKEM768_PUBKEY_SNAKE_BITS: Int = 9472;
const KS_MLKEM768_PUBKEY_SNAKE_REFS: Int = 9;
const KS_UINT32_MAX: Int = 4294967295;

const KS_KEY_ID_DOMAIN: Int = 0x4b455949;
const KS_REPLACE_KEYS_SIGNING_DOMAIN: Int = 0x4b534b31;

const KS_YEARS_FUNDED: Int = 10;
const KS_BASE_ENDOWMENT: Int = 45000000;
const KS_REGISTER_GAS: Int = 12000000;
const KS_MIN_REGISTER_VALUE: Int = KS_BASE_ENDOWMENT + KS_REGISTER_GAS;
const KS_MIN_REPLACE_VALUE: Int = KS_REGISTER_GAS;
const KS_AVATAR_WRITE_GAS: Int = 8000000;

const KS_ROTATION_MIN_BALANCE: Int = 20000000;

const KS_PROOF_FORWARD_RESERVE: Int = 5000000;
const KS_PROOF_EXEC_RESERVE: Int = 4000000;
const KS_PROOF_MAX_VALUE: Int = 20000000;

message(0x4B534731) KeyShardRegisterKeys {
    enc_pubkey: Int as uint256;
    sign_pubkey: Int as uint256;
    scan_pubkey: Int as uint256;
    auth_pubkey: Int as uint256;
    pq_kem_pubkey_hash: Int as uint256;
    pq_kem_pubkey_len: Int as uint16;
    pq_kem_pubkey: Cell;
    crypto_suite_mask: Int as uint16;
}

message(0x4B534732) KeyShardReplaceKeys {
    signature: Slice as bytes64;
    signed_payload: Cell;
    envelope_padding: Slice as remaining;
}

message(0x4B534734) KeyShardTopUpStorageReserve {}

message(0x4B534735) KeyShardSetAvatarPointer {
    write_id: Int as uint64;
    owner_wallet: Address;
    avatar_hash: Int as uint256;
    avatar_entry_id: Int as uint64;
    avatar_stream_id: Int as uint128;
    avatar_part_count: Int as uint16;
    media_format: Int as uint8;
}

message(0x4B534736) KeyShardAvatarPointerAck {
    write_id: Int as uint64;
    version: Int as uint32;
}

message(0x4B534737) KeyShardProveOwnership {
    query_id: Int as uint64;
    to: Address;
}

message(0x4B534738) KeyShardOwnershipProof {
    query_id: Int as uint64;
    owner_wallet: Address;
    key_id: Int as uint256;
    key_generation: Int as uint32;
    rotation_nonce: Int as uint64;
    enc_pubkey: Int as uint256;
    sign_pubkey: Int as uint256;
    scan_pubkey: Int as uint256;
    pq_kem_pubkey_hash: Int as uint256;
    pq_kem_pubkey_len: Int as uint16;
    pq_kem_pubkey: Cell;
    crypto_suite_mask: Int as uint16;
    created_at: Int as uint64;
    avatar_version: Int as uint32;
    avatar_hash: Int as uint256;
    avatar_entry_id: Int as uint64;
    avatar_stream_id: Int as uint128;
    avatar_part_count: Int as uint16;
    avatar_media_format: Int as uint8;
    avatar_updated_at: Int as uint64;
}

struct KeyShardView {
    exists: Bool;
    owner_wallet: Address;
    key_id: Int;
    key_generation: Int;
    rotation_nonce: Int;
    enc_pubkey: Int;
    sign_pubkey: Int;
    scan_pubkey: Int;
    pq_kem_pubkey_hash: Int;
    pq_kem_pubkey_len: Int;
    pq_kem_pubkey: Cell;
    crypto_suite_mask: Int;
    created_at: Int;
    created_lt: Int;
    min_register_value: Int;
    min_replace_value: Int;
    profile_registry: Address;
    avatar_version: Int;
    avatar_hash: Int;
    avatar_entry_id: Int;
    avatar_stream_id: Int;
    avatar_part_count: Int;
    avatar_media_format: Int;
    avatar_updated_at: Int;
    rotation_min_balance: Int;
}

contract KeyShard {
    owner_wallet: Address;
    profile_registry: Address;
    registered: Bool;
    key_id: Int as uint256;
    auth_pubkey: Int as uint256;
    key_generation: Int as uint32;
    rotation_nonce: Int as uint64;
    enc_pubkey: Int as uint256;
    sign_pubkey: Int as uint256;
    scan_pubkey: Int as uint256;
    pq_kem_pubkey_hash: Int as uint256;
    pq_kem_pubkey_len: Int as uint16;
    pq_kem_pubkey: Cell;
    crypto_suite_mask: Int as uint16;
    created_at: Int as uint64;
    created_lt: Int as uint64;
    avatar_version: Int as uint32;
    avatar_hash: Int as uint256;
    avatar_entry_id: Int as uint64;
    avatar_stream_id: Int as uint128;
    avatar_part_count: Int as uint16;
    avatar_media_format: Int as uint8;
    avatar_updated_at: Int as uint64;

    init(owner_wallet: Address, profile_registry: Address) {
        self.owner_wallet = owner_wallet;
        self.profile_registry = profile_registry;
        self.registered = false;
        self.key_id = 0;
        self.auth_pubkey = 0;
        self.key_generation = 0;
        self.rotation_nonce = 0;
        self.enc_pubkey = 0;
        self.sign_pubkey = 0;
        self.scan_pubkey = 0;
        self.pq_kem_pubkey_hash = 0;
        self.pq_kem_pubkey_len = 0;
        self.pq_kem_pubkey = emptyCell();
        self.crypto_suite_mask = 0;
        self.created_at = 0;
        self.created_lt = 0;
        self.avatar_version = 0;
        self.avatar_hash = 0;
        self.avatar_entry_id = 0;
        self.avatar_stream_id = 0;
        self.avatar_part_count = 0;
        self.avatar_media_format = 0;
        self.avatar_updated_at = 0;
    }


    fun validatePqPubkeyCell(pqLen: Int, cryptoSuiteMask: Int, pqPubkey: Cell) {
        throwUnless(22107, cryptoSuiteMask == KS_CRYPTO_SUITE_HYBRID);
        let size: DataSize = pqPubkey.computeDataSize(KS_MLKEM768_PUBKEY_SNAKE_CELLS);
        throwUnless(22108, size.cells == KS_MLKEM768_PUBKEY_SNAKE_CELLS);
        throwUnless(22109, size.bits == KS_MLKEM768_PUBKEY_SNAKE_BITS);
        throwUnless(22113, size.refs == KS_MLKEM768_PUBKEY_SNAKE_REFS);

        let cursor: Cell = pqPubkey;
        let remaining: Int = pqLen;
        while (remaining > 0) {
            let chunkBytes: Int = KS_MLKEM768_PUBKEY_SNAKE_CHUNK_BYTES;
            if (remaining == KS_MLKEM768_PUBKEY_LEN) {
                chunkBytes = KS_MLKEM768_PUBKEY_SNAKE_FIRST_CHUNK_BYTES;
            } else {
                if (remaining < chunkBytes) {
                    chunkBytes = remaining;
                }
            }
            let cursorSlice: Slice = cursor.beginParse();
            throwUnless(22114, cursorSlice.bits() == (chunkBytes * 8));
            if (remaining > chunkBytes) {
                throwUnless(22115, cursorSlice.refs() == 1);
                cursor = cursorSlice.loadRef();
            } else {
                throwUnless(22116, cursorSlice.refs() == 0);
            }
            remaining -= chunkBytes;
        }
    }

    fun isValidPqPubkeyCell(pqLen: Int, cryptoSuiteMask: Int, pqPubkey: Cell): Bool {
        if (cryptoSuiteMask != KS_CRYPTO_SUITE_HYBRID) { return false; }
        let cursor: Cell = pqPubkey;
        let remaining: Int = pqLen;
        while (remaining > 0) {
            let chunkBytes: Int = KS_MLKEM768_PUBKEY_SNAKE_CHUNK_BYTES;
            if (remaining == KS_MLKEM768_PUBKEY_LEN) {
                chunkBytes = KS_MLKEM768_PUBKEY_SNAKE_FIRST_CHUNK_BYTES;
            } else {
                if (remaining < chunkBytes) {
                    chunkBytes = remaining;
                }
            }
            let cursorSlice: Slice = cursor.beginParse();
            if (cursorSlice.bits() != (chunkBytes * 8)) { return false; }
            if (remaining > chunkBytes) {
                if (cursorSlice.refs() != 1) { return false; }
                cursor = cursorSlice.loadRef();
            } else {
                if (cursorSlice.refs() != 0) { return false; }
            }
            remaining -= chunkBytes;
        }
        return true;
    }

    fun isBasechainAddress(address: Address): Bool {
        let std: StdAddress = parseStdAddress(address.asSlice());
        return std.workchain == 0;
    }

    fun validateKeyProfile(encPubkey: Int, signPubkey: Int, scanPubkey: Int, pqHash: Int, pqLen: Int, pqPubkey: Cell, cryptoSuiteMask: Int) {
        throwUnless(22101, encPubkey != 0);
        throwUnless(22102, signPubkey != 0);
        throwUnless(22103, scanPubkey != 0);
        throwUnless(22107, cryptoSuiteMask == KS_CRYPTO_SUITE_HYBRID);
        throwUnless(22105, pqHash != 0);
        throwUnless(22106, pqLen == KS_MLKEM768_PUBKEY_LEN);
        self.validatePqPubkeyCell(pqLen, cryptoSuiteMask, pqPubkey);
    }

    fun isValidKeyProfile(encPubkey: Int, signPubkey: Int, scanPubkey: Int, pqHash: Int, pqLen: Int, pqPubkey: Cell, cryptoSuiteMask: Int): Bool {
        if (encPubkey == 0) { return false; }
        if (signPubkey == 0) { return false; }
        if (scanPubkey == 0) { return false; }
        if (cryptoSuiteMask != KS_CRYPTO_SUITE_HYBRID) { return false; }
        if (pqHash == 0) { return false; }
        if (pqLen != KS_MLKEM768_PUBKEY_LEN) { return false; }
        return self.isValidPqPubkeyCell(pqLen, cryptoSuiteMask, pqPubkey);
    }

    fun computeKeyId(keyGeneration: Int, encPubkey: Int, signPubkey: Int, pqHash: Int, pqLen: Int, cryptoSuiteMask: Int): Int {
        let keyFields: Cell = beginCell()
            .storeUint(encPubkey, 256)
            .storeUint(signPubkey, 256)
            .storeUint(pqHash, 256)
            .endCell();
        return beginCell()
            .storeUint(KS_KEY_ID_DOMAIN, 32)
            .storeAddress(self.owner_wallet)
            .storeUint(keyGeneration, 32)
            .storeUint(pqLen, 16)
            .storeUint(cryptoSuiteMask, 16)
            .storeRef(keyFields)
            .endCell()
            .hash();
    }

    inline fun requireEmptyEnvelopePadding(padding: Slice) {
        throwUnless(22900, padding.bits() == 0);
        throwUnless(22901, padding.refs() == 0);
    }

    receive(msg: KeyShardRegisterKeys) {
        throwUnless(22050, sender() == self.owner_wallet);
        self.validateKeyProfile(msg.enc_pubkey, msg.sign_pubkey, msg.scan_pubkey, msg.pq_kem_pubkey_hash, msg.pq_kem_pubkey_len, msg.pq_kem_pubkey, msg.crypto_suite_mask);
        throwUnless(22118, msg.auth_pubkey != 0);
        throwUnless(22119, msg.auth_pubkey != msg.sign_pubkey);
        throwUnless(22110, context().value >= (self.registered ? KS_MIN_REPLACE_VALUE : KS_MIN_REGISTER_VALUE));
        throwUnless(22117, self.key_generation < KS_UINT32_MAX);

        let wasRegistered: Bool = self.registered;
        let keyGeneration: Int = wasRegistered ? self.key_generation + 1 : 0;
        self.writeBundle(keyGeneration, msg.enc_pubkey, msg.sign_pubkey, msg.scan_pubkey,
                         msg.pq_kem_pubkey_hash, msg.pq_kem_pubkey_len, msg.pq_kem_pubkey, msg.crypto_suite_mask);
        self.auth_pubkey = msg.auth_pubkey;

        let priorBalance: Int = myBalance() - context().value;
        if (!wasRegistered) {
            nativeReserve(KS_BASE_ENDOWMENT, ReserveAtMost | ReserveAddOriginalBalance);
        } else if (priorBalance < KS_BASE_ENDOWMENT) {
            nativeReserve(KS_BASE_ENDOWMENT, ReserveAtMost);
        } else {
            nativeReserve(0, ReserveAtMost | ReserveAddOriginalBalance);
        }
        message(MessageParameters { to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    fun writeBundle(keyGeneration: Int, encPubkey: Int, signPubkey: Int, scanPubkey: Int, pqHash: Int, pqLen: Int, pqPubkey: Cell, cryptoSuiteMask: Int) {
        self.key_id = self.computeKeyId(keyGeneration, encPubkey, signPubkey, pqHash, pqLen, cryptoSuiteMask);
        self.key_generation = keyGeneration;
        self.enc_pubkey = encPubkey;
        self.sign_pubkey = signPubkey;
        self.scan_pubkey = scanPubkey;
        self.pq_kem_pubkey_hash = pqHash;
        self.pq_kem_pubkey_len = pqLen;
        self.pq_kem_pubkey = pqPubkey;
        self.crypto_suite_mask = cryptoSuiteMask;
        self.created_at = now();
        self.created_lt = curLt();
        self.registered = true;
    }

    receive(msg: KeyShardSetAvatarPointer) {
        throwUnless(22200, sender() == self.profile_registry);
        throwUnless(22201, msg.owner_wallet == self.owner_wallet);
        throwUnless(22202, self.registered);
        throwUnless(22203, context().value >= KS_AVATAR_WRITE_GAS);
        throwUnless(22206, self.avatar_version < KS_UINT32_MAX);

        if (self.avatar_version > 0) {
            let samePointer: Bool = (self.avatar_hash == msg.avatar_hash)
                && (self.avatar_stream_id == msg.avatar_stream_id)
                && (self.avatar_entry_id == msg.avatar_entry_id)
                && (self.avatar_media_format == msg.media_format);
            throwUnless(22205, !samePointer);
        }

        self.avatar_version += 1;
        self.avatar_hash = msg.avatar_hash;
        self.avatar_entry_id = msg.avatar_entry_id;
        self.avatar_stream_id = msg.avatar_stream_id;
        self.avatar_part_count = msg.avatar_part_count;
        self.avatar_media_format = msg.media_format;
        self.avatar_updated_at = now();

        message(MessageParameters {
            to: sender(),
            value: 0,
            mode: SendRemainingValue | SendIgnoreErrors,
            bounce: false,
            body: KeyShardAvatarPointerAck { write_id: msg.write_id, version: self.avatar_version }.toCell()
        });
    }

    receive(msg: KeyShardProveOwnership) {
        throwUnless(22220, self.registered);
        throwUnless(22221, self.isBasechainAddress(msg.to));
        throwUnless(22222, context().value >= KS_PROOF_FORWARD_RESERVE + KS_PROOF_EXEC_RESERVE);
        throwUnless(22223, context().value <= KS_PROOF_MAX_VALUE);

        message(MessageParameters {
            to: msg.to,
            value: KS_PROOF_FORWARD_RESERVE,
            mode: SendPayFwdFeesSeparately,
            bounce: true,
            body: KeyShardOwnershipProof {
                query_id: msg.query_id,
                owner_wallet: self.owner_wallet,
                key_id: self.key_id,
                key_generation: self.key_generation,
                rotation_nonce: self.rotation_nonce,
                enc_pubkey: self.enc_pubkey,
                sign_pubkey: self.sign_pubkey,
                scan_pubkey: self.scan_pubkey,
                pq_kem_pubkey_hash: self.pq_kem_pubkey_hash,
                pq_kem_pubkey_len: self.pq_kem_pubkey_len,
                pq_kem_pubkey: self.pq_kem_pubkey,
                crypto_suite_mask: self.crypto_suite_mask,
                created_at: self.created_at,
                avatar_version: self.avatar_version,
                avatar_hash: self.avatar_hash,
                avatar_entry_id: self.avatar_entry_id,
                avatar_stream_id: self.avatar_stream_id,
                avatar_part_count: self.avatar_part_count,
                avatar_media_format: self.avatar_media_format,
                avatar_updated_at: self.avatar_updated_at
            }.toCell()
        });
    }


    external(msg: KeyShardReplaceKeys) {
        self.requireEmptyEnvelopePadding(msg.envelope_padding);
        throwUnless(22120, self.registered);
        throwUnless(22128, self.auth_pubkey != 0);
        throwUnless(22130, checkSignature(msg.signed_payload.hash(), msg.signature, self.auth_pubkey));

        let signedPayload: Slice = msg.signed_payload.beginParse();
        throwUnless(22136, signedPayload.bits() == 352);
        throwUnless(22137, signedPayload.refs() == 1);
        let signedDomain: Int = signedPayload.loadUint(32);
        throwUnless(22131, signedDomain == KS_REPLACE_KEYS_SIGNING_DOMAIN);
        let signedShardHash: Int = signedPayload.loadUint(256);
        let shardSlice: Slice = myAddress().asSlice();
        throwUnless(22133, shardSlice.loadUint(11) == 1024);
        throwUnless(22133, signedShardHash == shardSlice.loadUint(256));
        let signedNonce: Int = signedPayload.loadUint(64);
        throwUnless(22135, signedNonce == self.rotation_nonce);
        throwUnless(22138, myBalance() >= KS_ROTATION_MIN_BALANCE);

        acceptMessage();
        self.rotation_nonce += 1;
        commit();

        let actionPayloadCell: Cell = signedPayload.loadRef();
        let actionPayload: Slice = actionPayloadCell.beginParse();
        if (!(actionPayload.bits() == 800)) { return; }
        if (!(actionPayload.refs() == 2)) { return; }
        let encPubkey: Int = actionPayload.loadUint(256);
        let signPubkey: Int = actionPayload.loadUint(256);
        let scanPubkey: Int = actionPayload.loadUint(256);
        let pqKemPubkeyLen: Int = actionPayload.loadUint(16);
        let cryptoSuiteMask: Int = actionPayload.loadUint(16);
        let pqKemPubkey: Cell = actionPayload.loadRef();
        let pqHashCell: Cell = actionPayload.loadRef();
        let pqHashSlice: Slice = pqHashCell.beginParse();
        if (!(pqHashSlice.bits() == 256)) { return; }
        if (!(pqHashSlice.refs() == 0)) { return; }
        let pqKemPubkeyHash: Int = pqHashSlice.loadUint(256);

        if (!self.isValidKeyProfile(encPubkey, signPubkey, scanPubkey, pqKemPubkeyHash, pqKemPubkeyLen, pqKemPubkey, cryptoSuiteMask)) { return; }
        if (!(signPubkey != self.auth_pubkey)) { return; }
        if (!(self.key_generation < KS_UINT32_MAX)) { return; }

        self.writeBundle(self.key_generation + 1, encPubkey, signPubkey, scanPubkey,
                         pqKemPubkeyHash, pqKemPubkeyLen, pqKemPubkey, cryptoSuiteMask);
    }

    receive(msg: KeyShardTopUpStorageReserve) {}
    receive() {}

    get fun get_view(): KeyShardView {
        return KeyShardView {
            exists: self.registered,
            owner_wallet: self.owner_wallet,
            key_id: self.key_id,
            key_generation: self.key_generation,
            rotation_nonce: self.rotation_nonce,
            enc_pubkey: self.enc_pubkey,
            sign_pubkey: self.sign_pubkey,
            scan_pubkey: self.scan_pubkey,
            pq_kem_pubkey_hash: self.pq_kem_pubkey_hash,
            pq_kem_pubkey_len: self.pq_kem_pubkey_len,
            pq_kem_pubkey: self.pq_kem_pubkey,
            crypto_suite_mask: self.crypto_suite_mask,
            created_at: self.created_at,
            created_lt: self.created_lt,
            min_register_value: KS_MIN_REGISTER_VALUE,
            min_replace_value: KS_MIN_REPLACE_VALUE,
            profile_registry: self.profile_registry,
            avatar_version: self.avatar_version,
            avatar_hash: self.avatar_hash,
            avatar_entry_id: self.avatar_entry_id,
            avatar_stream_id: self.avatar_stream_id,
            avatar_part_count: self.avatar_part_count,
            avatar_media_format: self.avatar_media_format,
            avatar_updated_at: self.avatar_updated_at,
            rotation_min_balance: KS_ROTATION_MIN_BALANCE
        };
    }
}
