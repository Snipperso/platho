
const KS_CRYPTO_SUITE_HYBRID: Int = 2;
const KS_MLKEM768_PUBKEY_LEN: Int = 1184;
const KS_MLKEM768_PUBKEY_SNAKE_CHUNK_BYTES: Int = 127;
const KS_MLKEM768_PUBKEY_SNAKE_FIRST_CHUNK_BYTES: Int = 41;
const KS_MLKEM768_PUBKEY_SNAKE_CELLS: Int = 10;
const KS_MLKEM768_PUBKEY_SNAKE_BITS: Int = 9472;
const KS_MLKEM768_PUBKEY_SNAKE_REFS: Int = 9;
const KS_UINT32_MAX: Int = 4294967295;

const KS_KEY_ID_DOMAIN: Int = 0x4b455949;
const KS_REGISTER_POP_DOMAIN: Int = 0x4b535031;


const KS_BASE_ENDOWMENT: Int = 45000000;
const KS_ADOPT_MIN_BALANCE: Int = 5000000;
const KS_ADOPT_BUNDLE_WRITTEN_BEFORE: Int = 1791072000;
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
    pop_signature: Slice as bytes64;
    auth_signature: Slice as bytes64;
}



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

message(0x4B534739) KeyShardAdoptIdentity {
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


    fun registerPossessionPayload(encPubkey: Int, signPubkey: Int, scanPubkey: Int, authPubkey: Int,
                                  pqHash: Int, pqLen: Int, cryptoSuiteMask: Int): Cell {
        let shardSlice: Slice = myAddress().asSlice();
        throwUnless(22142, shardSlice.loadUint(11) == 1024);
        let shardHash: Int = shardSlice.loadUint(256);
        let keys: Cell = beginCell()
            .storeUint(encPubkey, 256)
            .storeUint(signPubkey, 256)
            .storeUint(scanPubkey, 256)
            .endCell();
        let rest: Cell = beginCell()
            .storeUint(authPubkey, 256)
            .storeUint(pqHash, 256)
            .endCell();
        return beginCell()
            .storeUint(KS_REGISTER_POP_DOMAIN, 32)
            .storeUint(shardHash, 256)
            .storeUint(pqLen, 16)
            .storeUint(cryptoSuiteMask, 16)
            .storeRef(keys)
            .storeRef(rest)
            .endCell();
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


    receive(msg: KeyShardRegisterKeys) {
        throwUnless(22050, sender() == self.owner_wallet);
        throwUnless(22112, sender().asSlice().preloadUint(11) == 1024);
        let due: Int = myStorageDue();
        throwUnless(22110, context().value >= (self.registered ? KS_MIN_REPLACE_VALUE : KS_MIN_REGISTER_VALUE) + due);
        self.validateKeyProfile(msg.enc_pubkey, msg.sign_pubkey, msg.scan_pubkey, msg.pq_kem_pubkey_hash, msg.pq_kem_pubkey_len, msg.pq_kem_pubkey, msg.crypto_suite_mask);
        throwUnless(22118, msg.auth_pubkey != 0);
        throwUnless(22119, msg.auth_pubkey != msg.sign_pubkey);
        let popHash: Int = self.registerPossessionPayload(msg.enc_pubkey, msg.sign_pubkey, msg.scan_pubkey,
            msg.auth_pubkey, msg.pq_kem_pubkey_hash, msg.pq_kem_pubkey_len, msg.crypto_suite_mask).hash();
        throwUnless(22140, checkSignature(popHash, msg.pop_signature, msg.sign_pubkey));
        throwUnless(22141, checkSignature(popHash, msg.auth_signature, msg.auth_pubkey));
        throwUnless(22117, self.key_generation < KS_UINT32_MAX);

        let wasRegistered: Bool = self.registered;
        let keyGeneration: Int = wasRegistered ? self.key_generation + 1 : 0;
        self.writeBundle(keyGeneration, msg.enc_pubkey, msg.sign_pubkey, msg.scan_pubkey,
                         msg.pq_kem_pubkey_hash, msg.pq_kem_pubkey_len, msg.pq_kem_pubkey, msg.crypto_suite_mask);
        self.rotation_nonce = self.rotation_nonce + 1;

        let priorBalance: Int = myBalance() - context().value;
        if (!wasRegistered) {
            nativeReserve(KS_BASE_ENDOWMENT + due, ReserveAtMost | ReserveAddOriginalBalance);
        } else if (priorBalance < KS_BASE_ENDOWMENT) {
            nativeReserve(KS_BASE_ENDOWMENT + due, ReserveAtMost);
        } else {
            nativeReserve(due, ReserveAtMost | ReserveAddOriginalBalance);
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
            value: 0,
            mode: SendRemainingValue | SendBounceIfActionFail,
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

    receive(msg: KeyShardAdoptIdentity) {
        throwUnless(22240, sender() == self.profile_registry);
        throwUnless(22241, msg.owner_wallet == self.owner_wallet);
        throwUnless(22242, myBalance() - context().value >= KS_ADOPT_MIN_BALANCE);

        let adoptedBundle: Bool = false;
        if (!self.registered && msg.created_at < KS_ADOPT_BUNDLE_WRITTEN_BEFORE) {
            self.validateKeyProfile(msg.enc_pubkey, msg.sign_pubkey, msg.scan_pubkey, msg.pq_kem_pubkey_hash,
                                    msg.pq_kem_pubkey_len, msg.pq_kem_pubkey, msg.crypto_suite_mask);
            throwUnless(22243, msg.key_generation < KS_UINT32_MAX);
            self.writeBundle(msg.key_generation, msg.enc_pubkey, msg.sign_pubkey, msg.scan_pubkey,
                             msg.pq_kem_pubkey_hash, msg.pq_kem_pubkey_len, msg.pq_kem_pubkey, msg.crypto_suite_mask);
            throwUnless(22244, self.key_id == msg.key_id);
            self.created_at = msg.created_at;
            self.rotation_nonce = msg.rotation_nonce;
            adoptedBundle = true;
        }

        let adoptedAvatar: Bool = false;
        if (msg.avatar_version > 0 && msg.avatar_updated_at > self.avatar_updated_at && self.avatar_version < KS_UINT32_MAX) {
            self.avatar_version = max(self.avatar_version + 1, msg.avatar_version);
            self.avatar_hash = msg.avatar_hash;
            self.avatar_entry_id = msg.avatar_entry_id;
            self.avatar_stream_id = msg.avatar_stream_id;
            self.avatar_part_count = msg.avatar_part_count;
            self.avatar_media_format = msg.avatar_media_format;
            self.avatar_updated_at = msg.avatar_updated_at;
            adoptedAvatar = true;
        }

        throwUnless(22245, adoptedBundle || adoptedAvatar);
    }



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
