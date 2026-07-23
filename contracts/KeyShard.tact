// KeyShard — clean-17 per-wallet messaging identity. THE DIRECTORY IS GONE, NOT SHARDED.
//
// WHAT THIS REPLACES AND WHY. KeyRegistry held every wallet's identity in two maps that never shrink
// (`accounts`, `key_records`; the single `.del()` was rotation's own re-fill, net-zero). MEASURED 2026-07-20:
// 17.00 cells per registered wallet, exactly linear, plus 46 cells of code and 1 base data cell. Against the
// ~65536-cell account ceiling that is (65536 - 46 - 1) / 17 = 3852 wallets — for a contract that EVERY wallet
// must register in. [OWNER: миллионы пользователей — порог существования.] Worse, the refusal lands in the
// ACTION phase as code 50 while COMPUTE reports exit 0, so nothing would have gone red: the registry would have
// simply stopped recording identities, silently, at wallet 3853.
//
// The cure is not a sharded directory. It is NO directory: this contract holds ONE wallet's identity, and its
// address IS a function of that wallet. A sender resolving a recipient computes
// contractAddress(0, KeyShard.init(recipient_wallet)) locally and reads it. Nothing indexes anything, so
// nothing can fill up. State here is FIXED SIZE — there is not a single map in this contract, which is why the
// ceiling is not raised but removed.
//
// It also makes resolution cheaper than the registry was: toncenter's accountStates batches >=700 addresses in
// ONE request and omits accounts that never existed, so a client resolves a whole contact list in a single call
// instead of one getter per contact (runGetMethod does not batch at all).
//
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// THE BRICK, AND WHY THERE IS NO SLOT IN THE ADDRESS.
//
// KeyRegistry took auth_pubkey straight from the message with no proof the registrant held it, allowed exactly
// ONE registration per wallet forever (throwUnless 20111), and never deleted an account. A wallet that
// registered an auth key it did not control was bricked PERMANENTLY: rotation needs a signature under that key
// and there was no second chance. That is a live defect independent of the ceiling, found while measuring it.
//
// The project's rule for shards is that a frozen identity must have an escape, and RecoveryShard buys one with
// a slot index in its address. A slot is WRONG here: resolution is the hot path — every contact of every user,
// on every open — and probing S slots multiplies the read space by S for a hazard that has a cheaper answer.
//
// The cheaper answer is that the WALLET is the identity. [Identity is by WALLET; a name is a movable alias.]
// So RegisterKeys is authorised by sender() == owner_wallet and may be sent AGAIN: it replaces the whole bundle
// and bumps the generation. Losing the auth key therefore costs one wallet transaction, not the identity. The
// external rotation path stays for the cheap case (no wallet signature, no gas from the wallet), and the two
// authorities are ordered exactly as they should be — the wallet outranks the key it delegated to.
//
// This is also why one shard per wallet needs no uniqueness check at all: the address already commits to the
// owner, so nobody can write into someone else's shard, and there is nothing to collide over.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// WHAT IS DELIBERATELY NOT CARRIED OVER
//
// * `storageReserve()` — KeyRegistry declared a fail-closed rent floor over its never-shrinking state and the
//   comment above it said so. It was NEVER CALLED: one occurrence in the source, ZERO references in the
//   compiled .fc (Tact removed it as unreachable). It defended nothing. Here the state does not grow, so the
//   floor it wanted is replaced by a fixed endowment that is MEASURED rather than declared.
// * `account_count` / `key_record_count` — protocol-wide telemetry whose only consumer was that dead function.
//   A per-wallet contract cannot maintain them and loses no invariant by not having them.
// * The genesis seal / controller / manifest-hash lifecycle — a lazily-deployed per-wallet contract has no
//   genesis. It is deployed by its own owner, on demand, and there is no pre-seal window to protect.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// WHY THE AVATAR POINTER LIVES HERE, AND WHY THE REGISTRY ADDRESS IS AN INIT ARGUMENT
//
// ProfileRegistry held `current_avatar_versions` + `avatar_records`: MEASURED 2026-07-21 at exactly 5.0000 cells
// per profile, linear over 1200 owners, against 149 cells of code — a ceiling of 13,076 profiles. The same
// silent ACTION-phase-50 death as the key directory, on the same product.
//
// The username cure (delete the map in favour of the contract that already held the record) had no counterpart
// here: NOTHING held a wallet's current avatar pointer authoritatively. The image bytes live in PublicShard under
// the AVATAR domain (CapsuleHub, their clean-16 home, was removed 2026-07-21), so `avatar_entry_id` is a hint, not
// an address. So the pointer needs a per-wallet
// home, and this contract already is one — the client resolving a contact reads this shard anyway, which means
// the avatar now arrives in the SAME batched accountStates read instead of a second getter against a registry.
//
// The write must be authorised by the registry (otherwise avatars are free and the 100 ATH price is bypassed),
// and the registry must derive this shard's address (otherwise it writes wherever a caller points it). Baking the
// registry address into this contract's CODE would make that a genuine build cycle: the registry embeds KeyShard's
// code to derive addresses, so its own address would depend on a constant derived from its own address.
//
// Passing it as an INIT ARGUMENT breaks the cycle outright — the code no longer mentions the registry, so the
// registry may `initOf KeyShard(owner, myAddress())` directly, with no genesis bind and no ceremony step. The
// address stays a pure function of (wallet, registry), and a shard deployed against a FAKE registry is
// self-defeating: it lands on a different address, and no client — which derives with the real registry — will
// ever read it. This is the same property that makes RecordShard's init arguments trustworthy.

const KS_CRYPTO_SUITE_HYBRID: Int = 2;
const KS_MLKEM768_PUBKEY_LEN: Int = 1184;
const KS_MLKEM768_PUBKEY_SNAKE_CHUNK_BYTES: Int = 127;
const KS_MLKEM768_PUBKEY_SNAKE_FIRST_CHUNK_BYTES: Int = 41;
const KS_MLKEM768_PUBKEY_SNAKE_CELLS: Int = 10;
const KS_MLKEM768_PUBKEY_SNAKE_BITS: Int = 9472;
const KS_MLKEM768_PUBKEY_SNAKE_REFS: Int = 9;
const KS_UINT32_MAX: Int = 4294967295;

const KS_KEY_ID_DOMAIN: Int = 0x4b455949;          // "KEYI" — unchanged from KeyRegistry, the id means the same thing
const KS_REPLACE_KEYS_SIGNING_DOMAIN: Int = 0x4b534b31;  // "KSK1" — DIFFERENT from KeyRegistry's "KRK1" on purpose:
// a signature made for the old registry must not verify here, and vice versa.

// [RE-MEASURE BEFORE SEAL] Storage is 64962 nanoton/cell/year (config-18 after the Apr-2026 switch, bits free).
// A shard occupies its own CODE as well as its data — that is the price of not being a singleton, and it is the
// number that decides whether this form is affordable at all. MEASURED 2026-07-20 on the built artifacts:
// the shard form in this project costs 12-20 code cells (AirdropTicket 12, RecordShard/RecoveryShard 17,
// IntroShard 20), against KeyRegistry's 46, ProfileRegistry's 149 and UsernameRegistry's 501.
// KS_BASE_ENDOWMENT is finalised from the measured account size in tests/key-shard.test.ts (KS-RENT-01), which
// reads the storage phase rather than counting a model of the account — the mistake that under-funded
// RecoveryShard by exactly the StateInit wrapper cell.
const KS_YEARS_FUNDED: Int = 10;
const KS_BASE_ENDOWMENT: Int = 45000000;
const KS_REGISTER_GAS: Int = 12000000;
const KS_MIN_REGISTER_VALUE: Int = KS_BASE_ENDOWMENT + KS_REGISTER_GAS;
// A replacement does not grow the account (same shape in, same shape out), so it pays gas only.
const KS_MIN_REPLACE_VALUE: Int = KS_REGISTER_GAS;
// An avatar write does not grow the account either: the pointer fields are fixed-width and are already
// serialised (at zero) from the moment the shard is registered, so their rent is inside KS_BASE_ENDOWMENT and
// this message pays gas only. That is also why 22202 requires registration first — see the receiver.
const KS_AVATAR_WRITE_GAS: Int = 8000000;

// [MIGRATION HOOK] A redeploy gives ProfileRegistry a NEW address, and this shard's address is a function of it
// (see init), so every KeyShard moves and a wallet's published key bundle + avatar pointer would be orphaned.
// KeyShardProveOwnership lets the shard state its own PUBLIC identity to the next generation so it can adopt it
// with no wallet action — the same self-attestation shape as UsernameNFTItem's proof path. Sized exactly like it:
// a fixed forward reserve, an exec reserve, and a cap so the shard can never be turned into a value relay. Value
// rides in from the caller and the shard NEVER pays from its storage endowment.
// [RE-MEASURE BEFORE SEAL] Exec is 4M, not the item's 1M, because the proof body is a larger cell tree (full
// bundle + ML-KEM snake + avatar pointer). MEASURED at the min-value boundary (value = FORWARD + EXEC) with an
// initialised receiver: this tx's gas ~1.37M + separate fwd fee ~0.63M = ~2.0M. At exec=2M the shard netted only
// +3331 nanoton — the "never pays from endowment" invariant held by a hair and would flip negative on any mainnet
// gas/fwd-fee drift. exec=4M (~2x the measured cost) leaves ~+2M of margin at the boundary; the min value is 9M,
// which for a one-time migration trigger is negligible. Pinned by tests/key-shard-prove-ownership.test.ts KS-PROVE-05.
const KS_PROOF_FORWARD_RESERVE: Int = 5000000;
const KS_PROOF_EXEC_RESERVE: Int = 4000000;
const KS_PROOF_MAX_VALUE: Int = 20000000;

message(0x4B534731) KeyShardRegisterKeys {          // "KSG1" — internal, wallet-authorised
    enc_pubkey: Int as uint256;
    sign_pubkey: Int as uint256;
    scan_pubkey: Int as uint256;
    auth_pubkey: Int as uint256;
    pq_kem_pubkey_hash: Int as uint256;
    pq_kem_pubkey_len: Int as uint16;
    pq_kem_pubkey: Cell;
    crypto_suite_mask: Int as uint16;
}

message(0x4B534732) KeyShardReplaceKeys {           // "KSG2" — external, auth-key-authorised
    signature: Slice as bytes64;
    signed_payload: Cell;
    envelope_padding: Slice as remaining;
}

message(0x4B534734) KeyShardTopUpStorageReserve {}  // "KSG4" — permissionless; anyone may fund a shard's rent

// "KSG5" — ProfileRegistry-authorised paid avatar pointer write. write_id comes FIRST because a bounced message
// preserves only the first 256 bits of the body: opcode(32) + write_id(64) = 96 bits, so the registry can always
// find its pending entry on the refusal path. owner_wallet is carried even though this shard knows its own — it
// is a cross-check that catches a derivation bug at the registry as a refusal instead of an avatar silently
// written into the wrong wallet's shard.
message(0x4B534735) KeyShardSetAvatarPointer {
    write_id: Int as uint64;
    owner_wallet: Address;
    avatar_hash: Int as uint256;
    avatar_entry_id: Int as uint64;
    avatar_stream_id: Int as uint128;
    avatar_part_count: Int as uint16;
    media_format: Int as uint8;
}

message(0x4B534736) KeyShardAvatarPointerAck {     // "KSG6" — shard -> registry: the write landed, settle the payment
    write_id: Int as uint64;
    version: Int as uint32;
}

// "KSG7" — permissionless migration export request. Anyone may ask the shard to state its public identity to the
// next-generation registry `to`, so an identity is never stranded because its owner went quiet. It names the
// CURRENT owner, so a permissionless trigger cannot steal anything. Mirrors UsernameNFTItem.ProveUsernameOwnership.
message(0x4B534737) KeyShardProveOwnership {
    query_id: Int as uint64;
    to: Address;
}

// "KSG8" — shard -> next generation: everything a new KeyShard/registry needs to adopt this wallet's public
// identity in ONE message. auth_pubkey is NEVER exported (the rotation-key privacy invariant, same as get_view):
// it authorises rotation, so advertising it would hand an observer the key to attack; the owner re-establishes it
// with a fresh registration. All fixed-width fields plus the ML-KEM snake as a ref — no `as remaining`, so Tact
// spills cleanly across the cell tree (the failure mode that broke the username-mint notification lived in an
// inline remaining slice, which this deliberately avoids).
// CONSUMER NOTE (the next generation that adopts this): the bundle and the avatar pointer advance on TWO
// independent monotonic axes — key_generation (bundle) and avatar_version (avatar). A consumer must apply
// last-writer-wins on EACH axis separately, or a proof taken before an avatar change silently loses the newer
// avatar. And auth_pubkey is absent by design: an adopted identity is READABLE immediately but cannot rotate via
// the external path until its owner does one fresh KeyShardRegisterKeys — reachability is preserved, rotation is
// re-established by the owner, not migrated.
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
    exists: Bool;                 // registered at least once
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
    // The paid avatar pointer, formerly ProfileRegistry.avatar_records. avatar_version 0 means "never bought".
    // It rides in the SAME view — and therefore the same batched read — that a client already performs to
    // resolve a contact's keys.
    profile_registry: Address;
    avatar_version: Int;
    avatar_hash: Int;
    avatar_entry_id: Int;
    avatar_stream_id: Int;
    avatar_part_count: Int;
    avatar_media_format: Int;
    avatar_updated_at: Int;
    // auth_pubkey is NEVER returned — the privacy invariant inherited from KeyRegistry. It authorises rotation;
    // advertising it would hand an observer the exact key to attack.
}

contract KeyShard {
    owner_wallet: Address;          // init argument: THIS is what the address commits to
    profile_registry: Address;      // init argument: the ONLY sender that may write the avatar pointer
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

    // ---- ML-KEM-768 pubkey shape (ported from KeyRegistry; the snake is what makes a record 10 of its cells) ----

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
        let size: DataSize = pqPubkey.computeDataSize(KS_MLKEM768_PUBKEY_SNAKE_CELLS);
        if (size.cells != KS_MLKEM768_PUBKEY_SNAKE_CELLS) { return false; }
        if (size.bits != KS_MLKEM768_PUBKEY_SNAKE_BITS) { return false; }
        if (size.refs != KS_MLKEM768_PUBKEY_SNAKE_REFS) { return false; }

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

    // keyId binds owner+generation+enc/sign/pqHash, verbatim from KeyRegistry so an id computed by either side
    // means the same thing. key_generation is unique per shard and increments on every write, so it alone
    // guarantees a fresh id; scan_pubkey need not enter it (it is stored and advertised in the view).
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
        // Canonical, non-malleable external form: reject extra refs/bits appended OUTSIDE the signature. They
        // would be charged as import fee but are not covered by the signature. Checked PRE-ACCEPT.
        throwUnless(22900, padding.bits() == 0);
        throwUnless(22901, padding.refs() == 0);
    }

    // ---- register / replace, authorised by the WALLET ----
    //
    // The address commits to owner_wallet, so this single comparison is the whole authorisation: nobody can
    // reach another wallet's shard, and there is no directory in which to collide. Sending it AGAIN replaces the
    // bundle — that is the escape hatch that makes a lost auth key cost one transaction instead of the identity.
    receive(msg: KeyShardRegisterKeys) {
        throwUnless(22050, sender() == self.owner_wallet);
        self.validateKeyProfile(msg.enc_pubkey, msg.sign_pubkey, msg.scan_pubkey, msg.pq_kem_pubkey_hash, msg.pq_kem_pubkey_len, msg.pq_kem_pubkey, msg.crypto_suite_mask);
        throwUnless(22118, msg.auth_pubkey != 0);
        throwUnless(22119, msg.auth_pubkey != msg.sign_pubkey);
        // A FIRST registration funds the account's life; a replacement changes nothing about its size.
        throwUnless(22110, context().value >= (self.registered ? KS_MIN_REPLACE_VALUE : KS_MIN_REGISTER_VALUE));
        throwUnless(22117, self.key_generation < KS_UINT32_MAX);

        let wasRegistered: Bool = self.registered;
        let keyGeneration: Int = wasRegistered ? self.key_generation + 1 : 0;
        self.writeBundle(keyGeneration, msg.enc_pubkey, msg.sign_pubkey, msg.scan_pubkey,
                         msg.pq_kem_pubkey_hash, msg.pq_kem_pubkey_len, msg.pq_kem_pubkey, msg.crypto_suite_mask);
        self.auth_pubkey = msg.auth_pubkey;

        // Keep the account's own rent and return the rest. ReserveAddOriginalBalance so the reserve is the
        // INCREMENT this message adds rather than an absolute target — an absolute target turns the balance into
        // a ceiling and strands every later top-up. A REPLACEMENT adds no state, so its increment is ZERO:
        // reserving the base endowment again would silently swallow the caller's change on every rotation and
        // let the shard accrete a fresh endowment per key change.
        nativeReserve(wasRegistered ? 0 : KS_BASE_ENDOWMENT, ReserveAtMost | ReserveAddOriginalBalance);
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

    // ---- avatar pointer, authorised by ProfileRegistry (which is where the 100 ATH was paid) ----
    //
    // The pointer fields are NOT re-validated here. ProfileRegistry gates them at 21120-21125 before it ever
    // sends this message, both contracts are immutable after seal, and 22200 admits no other sender — so a second
    // copy of the same checks would buy nothing and cost code cells, which in a per-wallet contract are a rent
    // levy on every user. Leanness here is an economic property, not a style preference.
    receive(msg: KeyShardSetAvatarPointer) {
        throwUnless(22200, sender() == self.profile_registry);
        throwUnless(22201, msg.owner_wallet == self.owner_wallet);
        // 22202: an avatar with no identity behind it cannot be resolved by anyone — a client reaches this shard
        // by deriving it from a wallet it is already trying to resolve. Requiring registration first also keeps
        // this message free of a deploy path: the pointer fields are serialised from registration onward, so
        // their rent is already inside KS_BASE_ENDOWMENT and nothing here grows the account. A purchase for an
        // unregistered wallet bounces, and the registry refunds the ATH.
        throwUnless(22202, self.registered);
        throwUnless(22203, context().value >= KS_AVATAR_WRITE_GAS);
        throwUnless(22206, self.avatar_version < KS_UINT32_MAX);

        // IDEMPOTENCY (22205), inherited verbatim from ProfileRegistry gate 21115 which lived where the pointer
        // used to. ATHWallet's permanent replay tombstone was deleted 2026-07-19 because it capped the whole
        // product; replay safety moved to the SEMANTIC key at the consumer, and this is that key for the avatar
        // lane. A payment that would rewrite the CURRENT pointer with the identical pointer is refused, so an
        // accidental duplicate submit bounces and is REFUNDED instead of charging the user 100 ATH twice.
        //
        // Compared against the CURRENT pointer only — never a map of every pointer ever seen, which would rebuild
        // the exact unbounded state this whole change removed. And the FULL pointer, not avatar_hash alone: the
        // same image re-uploaded after retention is a new stream, and a hash-only gate would refuse it forever,
        // permanently costing the user the ability to restore their own avatar. A->B->A stays legal.
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

        // The ack is what SETTLES the payment at the registry, so it must not be able to fail for want of value:
        // SendRemainingValue hands back exactly what this message brought, less this transaction's gas.
        message(MessageParameters {
            to: sender(),
            value: 0,
            mode: SendRemainingValue | SendIgnoreErrors,
            bounce: false,
            body: KeyShardAvatarPointerAck { write_id: msg.write_id, version: self.avatar_version }.toCell()
        });
    }

    // ---- migration export, permissionless (mirrors UsernameNFTItem.ProveUsernameOwnership) ----
    //
    // The shard states its own PUBLIC facts — the exact fields get_view already exposes, minus auth_pubkey — so the
    // next generation can adopt this wallet's identity with no wallet action after a redeploy moves the address.
    // Permissionless so a quiet owner is never stranded; the proof names the CURRENT owner, so it cannot be abused
    // to move an identity. The shard is NOT consumed and may prove as many times as needed, so a refused or
    // mistimed claim costs nothing. Value rides in from the caller and is capped, and the shard never pays out of
    // its storage endowment — the cost of a mistimed claim falls on the triggerer, not the shard.
    receive(msg: KeyShardProveOwnership) {
        throwUnless(22220, self.registered);
        throwUnless(22221, self.isBasechainAddress(msg.to));
        throwUnless(22222, context().value >= KS_PROOF_FORWARD_RESERVE + KS_PROOF_EXEC_RESERVE);
        throwUnless(22223, context().value <= KS_PROOF_MAX_VALUE);

        message(MessageParameters {
            to: msg.to,
            value: KS_PROOF_FORWARD_RESERVE,
            mode: SendPayFwdFeesSeparately,
            // Bounceable so a proof aimed at a non-existent or refusing registry returns the value here instead of
            // burning it into an uninitialised account.
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

    // ---- rotate, authorised by the auth key (external: no wallet signature, no gas from the wallet) ----

    external(msg: KeyShardReplaceKeys) {
        self.requireEmptyEnvelopePadding(msg.envelope_padding);
        throwUnless(22120, self.registered);
        throwUnless(22128, self.auth_pubkey != 0);
        throwUnless(22130, checkSignature(msg.signed_payload.hash(), msg.signature, self.auth_pubkey));

        // signed payload: domain(32) | shard address hash(256) | nonce(64) | ref = action payload.
        // The shard's OWN address is in the signature, so a payload signed for one wallet's shard cannot be
        // replayed against another's — the registry bound this to its single address, which no longer exists.
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

        acceptMessage();
        // Burn the nonce FIRST and commit, so a replay of this exact payload cannot be re-run even if the work
        // below bails out. Everything after commit() is a silent `return` rather than a throw for the same
        // reason: a throw would roll the nonce back.
        self.rotation_nonce += 1;
        commit();

        // action payload: enc(256)|sign(256)|scan(256)|pqLen(16)|suite(16) = 800 bits inline,
        // ref[0] = ML-KEM snake, ref[1] = cell{ pqHash(256) }. Spilled to stay under the 1023-bit cell limit.
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

    receive(msg: KeyShardTopUpStorageReserve) {}   // anyone may fund a shard's rent
    receive() {}                                   // plain top-up / lazy deploy carrier

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
            avatar_updated_at: self.avatar_updated_at
        };
    }
}
