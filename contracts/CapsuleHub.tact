// Platho v1 CapsuleHub.
// Stores compact capsule indexes and headers on-chain. Body cells live in the
// accepted publish transaction body and are authenticated by their stored hash.

const PLATO_PRIVATE_LONG_TERM_FEE_TON: Int = 10000000;
const PLATO_PUBLIC_POST_FEE_TON: Int = 10000000;

const SIZE_CLASS_1K: Int = 1;
const SIZE_CLASS_2K: Int = 2;
const SIZE_CLASS_4K: Int = 4;
const SIZE_CLASS_8K: Int = 8;
const SIZE_CLASS_16K: Int = 16;
const SIZE_CLASS_32K: Int = 32;
const CRYPTO_SUITE_HYBRID: Int = 2;

const CAPSULEHUB_INDEX_STORAGE_YEARS: Int = 1;
const CAPSULEHUB_INDEX_RETENTION_SECONDS: Int = 31536000;
const CAPSULEHUB_PAGE_SIZE: Int = 256;
const CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE: Int = 1000000;
const CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT: Int = 3300000;
const CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT: Int = 9400000; // 7.4M header/entry + ~2M author/parent index slot
// clean-16 ИНК4 INTRO lane (G8-provisional; finalized at ИНК8). INTRO entries store header0(42B)+header1(30B)
// + body_hash with NO index links. CAPSULEHUB_INTRO_SWEEP_CAP bounds the per-batch INTRO eviction, decoupled
// from part_count, so the hot PUBLIC/CONV path pays a fixed, small unconditional intro-sweep cost.
const CAPSULEHUB_INTRO_ENTRY_STORAGE_ENDOWMENT: Int = 2000000;
const CAPSULEHUB_INTRO_SWEEP_CAP: Int = 4;
// clean-16 L6/#11: max entries a single permissionless EvictExpiredCapsules call may sweep (bounds gas per call;
// keepers repeat it to drain a backlog). Lets a QUIET private/public lane shed expired entries without waiting for
// its own next publish (own-kind FIFO eviction was otherwise coupled to publish traffic).
const CAPSULEHUB_STANDALONE_EVICT_CAP: Int = 32;
// clean-16 ИНК6 RECOVERY durability lane (Variant-B). The K_root self-recovery blob is stored ON-CHAIN for the
// full retention (owner: 3 years) so it survives even if archive nodes drop old history; the endowment is prepaid
// once at conversation start. RECOVERY_MAX_SIZE_CLASS caps the on-chain blob. All G8-provisional (finalized ИНК8).
const CAPSULEHUB_RECOVERY_POOL_RETENTION_SECONDS: Int = 94608000; // owner 2026-07-15: 3 years (= 3 × 31536000)
const CAPSULEHUB_RECOVERY_ENTRY_STORAGE_ENDOWMENT: Int = 200000000; // G8-provisional (ИНК6-fix): worst-case RecoveryCapsuleRecord (8K body ~74 cells/75168 bits + headers + wallet) 3yr rent ≈166M nanoTON; (1M keepalive + this) ×1.25 ≈251M ≈1.5× cover. FINALIZE from measured cell.computeDataSize() in Фаза-5
const RECOVERY_MAX_SIZE_CLASS: Int = 8; // 8K cap on the recovery blob
const CAPSULEHUB_ACK_FORWARD_RESERVE: Int = 30000000;
const CAPSULEHUB_FLUSH_LOCAL_EXEC_RESERVE: Int = 2000000;
const CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE: Int = 2000000;
const CAPSULEHUB_MIN_FEE_FLUSH_TON: Int = PLATO_PUBLIC_POST_FEE_TON;
const CAPSULEHUB_MIN_PROTECTED_RESERVE_TON: Int = 100000000000; // 100 TON
const CAPSULEHUB_STORAGE_RESERVE_BUFFER_NUMERATOR: Int = 125;
const CAPSULEHUB_STORAGE_RESERVE_BUFFER_DENOMINATOR: Int = 100;
const CAPSULEHUB_SWEEP_LOCAL_EXEC_RESERVE: Int = 2000000;
const CAPSULEHUB_MIN_RESERVE_SWEEP_TON: Int = PLATO_PUBLIC_POST_FEE_TON;
// Eviction is folded into the publish path (FIFO oldest-first) — there is no standalone prune op. Each batch
// evicts up to part_count entries of its own kind that are past CAPSULEHUB_INDEX_RETENTION_SECONDS, bounding
// live state by construction. CAPSULEHUB_EVICT_PER_PART_GAS is the per-evicted-entry compute folded into the
// publisher's HUB_PART_GAS_* hold (see HUB_PART_GAS_PUBLIC/PRIVATE below).
// clean-16 ИНК2: the private lane splits by header0 shape. CONV (publish_kind=PRIVATE, the ordinary-conversation
// lane) carries a 320-bit / 40-byte header0 = meta(64) + opaque bucketKey(256). INTRO (first contact, wired in
// ИНК4) carries 336 bits / 42 bytes = meta(64) + ephemeral_R(256) + view_tag(16). RECOVERY (ИНК6) reuses the
// CONV 320-bit shape. All private-lane header0s are a single cell with no refs (each fits one 1023-bit cell),
// replacing the pre-clean-16 1120-bit / 2-cell / 1-ref shape. The 784-bit part frame + header1 (240) are unchanged.
const CAPSULEHUB_CONV_HEADER0_BITS: Int = 320; // 40 bytes: meta64 + bucketKey256
const CAPSULEHUB_INTRO_HEADER0_BITS: Int = 336; // 42 bytes: meta64 + ephemeral_R256 + view_tag16
const CAPSULEHUB_PRIVATE_HEADER1_BITS: Int = 240; // 30 bytes
const CAPSULEHUB_PRIVATE_HEADER0_CELLS: Int = 1;
const CAPSULEHUB_PRIVATE_HEADER0_REFS: Int = 0;
const CAPSULEHUB_PRIVATE_HEADER1_CELLS: Int = 1;
const CAPSULEHUB_PRIVATE_HEADER1_REFS: Int = 0;
const CAPSULEHUB_PRIVATE_HYBRID_BODY_OVERHEAD_BYTES: Int = 1204;
// clean-16 ИНК4 (G8-provisional): the INTRO body carries the ML-KEM ct_root (1088B) + handshake identity fields
// on top of the CONV overhead, so its fixed overhead is larger. A wrong value here rejects every valid INTRO.
const CAPSULEHUB_INTRO_HYBRID_BODY_OVERHEAD_BYTES: Int = 2388;
const CAPSULEHUB_PUBLIC_HEADER_MAX_BITS: Int = 576; // 72 bytes
const CAPSULEHUB_PUBLIC_HEADER_MAX_CELLS: Int = 1;
const CAPSULEHUB_PUBLIC_HEADER_MAX_REFS: Int = 0;


const ENTRY_UID_DOMAIN_VAULT_PRIVATE: Int = 0xD1190201;
const ENTRY_UID_DOMAIN_VAULT_PUBLIC: Int = 0xD1190202;
const ENTRY_UID_DOMAIN_VAULT_INTRO: Int = 0xD1190203; // clean-16 ИНК4
const ENTRY_UID_DOMAIN_VAULT_RECOVERY: Int = 0xD1190204; // clean-16 ИНК6
const CAPSULEHUB_ENTRY_KIND_PRIVATE: Int = 1;
const CAPSULEHUB_ENTRY_KIND_PUBLIC: Int = 2;
const CAPSULEHUB_ENTRY_KIND_INTRO: Int = 3; // clean-16 ИНК4: first-contact stealth lane
const CAPSULEHUB_ENTRY_KIND_RECOVERY: Int = 4; // clean-16 ИНК6: K_root self-recovery durability lane

// --- VPB2 batch ingest (mirror the Vault's batch constants so the value model is consistent end-to-end;
// the Session-5 generator pins both sides from one source) ---
const MAX_BATCH_PARTS: Int = 8;
const HUB_BATCH_BASE_GAS: Int = 14000;
const HUB_PART_GAS_PRIVATE: Int = 170000; // add (2 index pushes + payload validation) + auto-evict one (2 index un-pushes + header parse + del); provisional, measured-tightened
const HUB_PART_GAS_PUBLIC: Int = 180000;  // add (1 index push + author-key hash; clean-11 is_profile: +1 profile-index set + head store) + auto-evict one (1 index un-push + del; clean-11: +1 profile-index get, occasional del); provisional, measured-tightened
const HUB_PART_GAS_INTRO: Int = 120000; // clean-16 ИНК4 (G8-provisional): store-only, no index push; cheaper than PRIVATE, plus its own capped intro-sweep
const HUB_PART_GAS_RECOVERY: Int = 150000; // clean-16 ИНК6 (G8-provisional): keyed slot set + on-chain body write, no index push
const HUB_MIN_PER_PART_VALUE: Int = 1000000; // loose O(1) Phase-A lower bound (gross-underfunding early bounce)
const CAPSULE_ENTRY_PUBLISH_ID_DOMAIN: Int = 0x45504931; // "EPI1" per-entry publish_id derivation
const PLATHO_PUBLIC_MARKETING_NOTE_ASCII: Int = 0x73656e742076696120506c6174686f2e417070; // "sent via Platho.App"

message(0x90E2E0CB) BindDeploymentManifest {
    deployment_manifest_hash: Int as uint256;
    counterpart_address: Address;
}

message(0x3A12D1AD) SealGenesis {
    deployment_manifest_hash: Int as uint256;
}

message(0x7A861031) FlushFees {
    amount: Int as uint128;
}

message(0x5331B880) TopUpStorageReserve {}

message(0x53575052) SweepExcessReserve {
    amount: Int as uint128;
}

message(0xFF775609) DepositProtocolFee {
    amount: Int as uint128;
}

// clean-16 ИНК6: permissionless reclaim of an expired RECOVERY slot. Anyone may call it once the slot's
// updated_at + CAPSULEHUB_RECOVERY_POOL_RETENTION_SECONDS is in the past; the slot is deleted and its
// live-count term is released so the endowment it held stops being protected.
message(0x52454332) EvictExpiredRecoverySlot {
    slot_key: Int as uint256;
}

// clean-16 L6/#11: permissionless standalone eviction of expired PRIVATE/PUBLIC/INTRO index entries — decoupled from
// publish traffic so a quiet lane still gets reclaimed. Anyone may call it; the dormancy check IS the gate.
message(0x45564343) EvictExpiredCapsules {
    kind: Int as uint8;      // 1=private, 2=public, 3=intro
    max_count: Int as uint16;
}

// VPB2: the Vault forwards one signed batch (1..MAX_BATCH_PARTS parts) under this op. Wire format mirrors the
// Vault's PublishBatchToHub exactly; op + the 224 recovery bits (bounce_id, bounce_tag) come FIRST so they
// survive bounce truncation.
message(0xA4F862D1) PublishBatchToHub {
    bounce_id: Int as uint64;
    bounce_tag: Int as uint160;
    publish_id: Int as uint256;
    publish_kind: Int as uint8;
    part_count: Int as uint8;
    protocol_fee_total: Int as uint128;
    author_wallet: Address;
    parts: Cell;        // ref[0]: the exact signed part list (singly linked)
    marketing: Cell?;   // ref[1]: public batches only ({marketing_note}); null for private
}

message(0x874E5771) CapsuleHubBatchAck {
    publish_id: Int as uint256;
    first_entry_id: Int as uint64;
    part_count: Int as uint8;
    batch_uid: Int as uint256;
}

struct CapsuleHubStateView {
    sealed: Bool;
    vault_bound: Bool;
    deployment_manifest_hash: Int;
    private_latest_id: Int;
    public_latest_id: Int;
    private_page_count: Int;
    public_page_count: Int;
    page_size: Int;
    index_storage_years: Int;
    index_retention_seconds: Int;
    accrued_plato_fee_ton: Int;
    fee_accumulator_address: Address;
    vault_address: Address;
    genesis_controller_address: Address;
    private_live_count: Int;
    public_live_count: Int;
    intro_latest_id: Int;
    intro_oldest_live_id: Int;
    intro_live_count: Int;
    recovery_live_count: Int;
    index_storage_reserve_ton: Int;
    protected_reserve_ton: Int;
    reserve_floor_ton: Int;
    reserve_buffer_numerator: Int;
    reserve_buffer_denominator: Int;
}

struct CapsuleHubPageView {
    exists: Bool;
    page_id: Int;
    first_entry_id: Int;
    next_entry_id: Int;
    entry_count: Int;
    // V1 pages are virtual ranges; these fields are reserved and always zero.
    opened_at: Int;
    updated_at: Int;
}

struct PrivateCapsuleEntry {
    publish_id: Int as uint256;
    created_at: Int as uint64;
    body_hash: Int as uint256;
    // clean-16 ИНК1: single backward link in the opaque bucket chain (reuses the old per-publisher link slot).
    // The second, recipient-directed backlink is gone with the recipient graph — a private entry now carries
    // only its position in the opaque bucket chain, no directional link.
    bucket_prev_link: Int as uint64;
    header_0: Cell;
    header_1: Cell;
}

struct PublicCapsuleEntry {
    publish_id: Int as uint256;
    created_at: Int as uint64;
    author_wallet: Address;
    body_hash: Int as uint256;
    // parent_link == 0 -> top-level post (indexed by author); else == parentEntryId+1 -> comment
    // (indexed by parent). Reuses the entryLink convention so entry 0 is unambiguous.
    parent_link: Int as uint64;
    // Backward link in whichever public index this entry lives in (author chain for posts,
    // parent chain for comments). Analogous to the private entry's backward bucket link.
    prev_link: Int as uint64;
    // clean-11: backward link in the GLOBAL profile chain (0 for non-profile posts and for the first profile
    // ever). Threaded ONLY when is_profile is set; lets a client walk EVERY described channel newest-first from
    // public_profile_head without a global scan. Mirrors prev_link's role but across the single global profile list.
    profile_prev_link: Int as uint64;
    header: Cell;
}

struct PrivateCapsuleEntryView {
    exists: Bool;
    entry_id: Int;
    bucket_prev_link: Int;
    entry_uid: Int;
    publish_id: Int;
    author_wallet: Address;
    page_id: Int;
    page_offset: Int;
    created_at: Int;
    header_0_hash: Int;
    header_1_hash: Int;
    body_hash: Int;
    header_0: Cell;
    header_1: Cell;
}

struct PrivateCapsuleKeyIndex {
    latest_entry_link: Int as uint64;
    entry_count: Int as uint64;
}

struct PrivateBucketIndexView {
    exists: Bool;
    bucket_key: Int;
    latest_entry_id: Int;
    latest_entry_link: Int;
    entry_count: Int;
}

// clean-16 ИНК4 INTRO lane. First-contact capsules land here with NO index (the recipient scans ephemeral_R +
// view_tag out of header_0 and trial-decrypts). No author_wallet is stored: identity lives inside the encrypted
// body and is bound by the handshake transcript, verified after decrypt (impersonation is not checkable on-chain).
struct IntroCapsuleEntry {
    publish_id: Int as uint256;
    created_at: Int as uint64;
    body_hash: Int as uint256;
    header_0: Cell;
    header_1: Cell;
}

struct IntroCapsuleEntryView {
    exists: Bool;
    entry_id: Int;
    entry_uid: Int;
    publish_id: Int;
    created_at: Int;
    header_0_hash: Int;
    header_1_hash: Int;
    body_hash: Int;
    header_0: Cell;
    header_1: Cell;
}

// One row of the INTRO scan stream: the client walks [oldest_live_id, latest_id) reading ONLY header_0 to get the
// stealth scan fields (ephemeral_R + view_tag) and trial-decrypts matches; it never needs the body on-chain.
struct IntroScanRecord {
    entry_id: Int;
    created_at: Int;
    view_tag: Int;
    ephemeral_r: Int;
}

struct IntroScanBoundsView {
    oldest_live_id: Int;
    latest_id: Int;
    live_count: Int;
}

struct IntroScanPageView {
    from_entry_id: Int;
    count: Int;
    records: map<Int as uint16, IntroScanRecord>;
}

// clean-16 ИНК6 RECOVERY (Variant-B, keyed latest-wins). One slot per self-bucketKey holds the user's CURRENT
// K_root recovery blob. The body is stored ON-CHAIN (durability) — unlike CONV/INTRO/PUBLIC which keep only a hash
// — so recovery survives even if archive nodes drop old history. updated_at drives the permissionless expiry: a
// fresh publish resets it, so an active user's slot never expires.
struct RecoveryCapsuleRecord {
    publish_id: Int as uint256;
    updated_at: Int as uint64;
    body_hash: Int as uint256;
    // clean-16 ИНК6-fix (adversarial review): the slot is bound to its FIRST publisher's wallet (Variant-B).
    // slotKey is a self-derived value that becomes public on-chain once published; without this bind ANY third
    // party could re-publish the same slotKey with garbage and destroy the owner's K_root recovery blob forever.
    // Only msg.author_wallet == this field may overwrite. Self-recovery has no dialogue partner, so storing the
    // owner's own wallet leaks nothing about the who-to-whom graph (and it is already in the publish tx).
    author_wallet: Address;
    header_0: Cell;
    header_1: Cell;
    body: Cell;
}

struct RecoveryCapsuleView {
    exists: Bool;
    slot_key: Int;
    updated_at: Int;
    body_hash: Int;
    author_wallet: Address;
    header_0: Cell;
    header_1: Cell;
    body: Cell;
}

struct PublicCapsuleEntryView {
    exists: Bool;
    entry_id: Int;
    entry_uid: Int;
    publish_id: Int;
    author_wallet: Address;
    page_id: Int;
    page_offset: Int;
    created_at: Int;
    header_hash: Int;
    body_hash: Int;
    parent_link: Int;
    prev_link: Int;
    profile_prev_link: Int;   // clean-11
    header: Cell;
}

struct PublicCapsuleKeyIndex {
    latest_entry_link: Int as uint64;
    entry_count: Int as uint64;
}

struct PublicCapsuleKeyIndexView {
    exists: Bool;
    key_id: Int;
    latest_entry_id: Int;
    latest_entry_link: Int;
    entry_count: Int;
}

contract CapsuleHub {
    fee_accumulator_address: Address;
    vault_address: Address;
    vault_bound: Bool;
    sealed: Bool;
    deployment_manifest_hash: Int as uint256;
    genesis_controller_address: Address;
    private_latest_id: Int as uint64;
    public_latest_id: Int as uint64;
    private_live_count: Int as uint64;
    public_live_count: Int as uint64;
    accrued_plato_fee_ton: Int as uint128;
    private_entries: map<Int as uint64, PrivateCapsuleEntry>;
    public_entries: map<Int as uint64, PublicCapsuleEntry>;
    // clean-16 ИНК1: the opaque CONV bucket index. Keyed by the client's HKDF bucketKey (header0 bits[64,320)),
    // stored/looked-up purely as an opaque 256-bit map key — the contract derives NO sender/recipient/direction
    // from it (D7-override). Replaces the old per-publisher private index; the open who-to-whom recipient
    // index is deleted, so the on-chain private lane exposes NO directed graph.
    private_bucket_index: map<Int as uint256, PrivateCapsuleKeyIndex>;
    // Public read-side indexes: posts indexed by
    // hashed author wallet, comments indexed by parent entry id. Each lets a client walk only the entries
    // it cares about (a subscribed author's posts, or one post's comments) without a global scan.
    public_author_index: map<Int as uint256, PublicCapsuleKeyIndex>;
    public_parent_index: map<Int as uint64, PublicCapsuleKeyIndex>;
    // FIFO eviction low-water marks: the lowest entry id NOT yet evicted (everything below is gone). Auto-eviction
    // in the publish path advances these, deleting oldest-first past the retention window. Strict FIFO = we only
    // ever delete a chain TAIL, so backward walks never hit a hole and entry_count stays exact.
    public_oldest_live_id: Int as uint64;
    private_oldest_live_id: Int as uint64;
    // clean-11 channel-description discovery:
    //  - public_profile_index: hash(author) -> entryLink of that author's LATEST profile post (O(1) "this channel's
    //    current profile"; may dangle to an evicted entry — readers tolerate via get_public_entry(...).exists).
    //  - public_profile_head: entryLink of the newest profile post globally (0 = none). Head of a singly-linked
    //    global chain threaded through PublicCapsuleEntry.profile_prev_link, walked newest-first for COMPLETE discovery.
    public_profile_index: map<Int as uint256, Int as uint64>;
    public_profile_head: Int as uint64;
    // clean-16 ИНК4 INTRO first-contact pool. A separate FIFO map with NO index (the recipient scans header_0's
    // ephemeral_R + view_tag). The triplet mirrors the private/public counters: latest id (next entry id), oldest
    // live id (FIFO low-water), live count. Swept a capped amount by EVERY batch (own-kind on an INTRO batch, or
    // the unconditional intro-sweep on CONV/PUBLIC batches) so this low-frequency lane still bounds its state.
    intro_entries: map<Int as uint64, IntroCapsuleEntry>;
    intro_latest_id: Int as uint64;
    intro_oldest_live_id: Int as uint64;
    intro_live_count: Int as uint64;
    // clean-16 ИНК6 RECOVERY pool: keyed latest-wins slot map (key = self-bucketKey). NO sequential id; a slot is
    // OVERWRITTEN in place by a fresh recovery publish (live_count grows only on the first insert). Reclaimed via
    // the permissionless EvictExpiredRecoverySlot once a slot's updated_at + retention is in the past.
    recovery_slots: map<Int as uint256, RecoveryCapsuleRecord>;
    recovery_live_count: Int as uint64;

    init(fee_accumulator_address: Address, vault_address: Address, vault_bound: Bool, sealed: Bool, deployment_manifest_hash: Int, genesis_controller_address: Address) {
        self.fee_accumulator_address = fee_accumulator_address;
        self.vault_address = vault_address;
        self.vault_bound = vault_bound;
        self.sealed = sealed;
        self.deployment_manifest_hash = deployment_manifest_hash;
        self.genesis_controller_address = genesis_controller_address;
        self.private_latest_id = 0;
        self.public_latest_id = 0;
        self.private_live_count = 0;
        self.public_live_count = 0;
        self.accrued_plato_fee_ton = 0;
        self.private_entries = emptyMap();
        self.public_entries = emptyMap();
        self.private_bucket_index = emptyMap();
        self.public_author_index = emptyMap();
        self.public_parent_index = emptyMap();
        self.public_oldest_live_id = 0;
        self.private_oldest_live_id = 0;
        self.public_profile_index = emptyMap();   // clean-11
        self.public_profile_head = 0;             // clean-11
        self.intro_entries = emptyMap();          // clean-16 ИНК4
        self.intro_latest_id = 0;
        self.intro_oldest_live_id = 0;
        self.intro_live_count = 0;
        self.recovery_slots = emptyMap();         // clean-16 ИНК6
        self.recovery_live_count = 0;
    }

    fun requireSealed() {
        throwUnless(12900, self.sealed);
    }

    fun requireUnsealed() {
        throwUnless(12901, !self.sealed);
    }

    fun requireGenesisController() {
        throwUnless(12930, sender() == self.genesis_controller_address);
    }

    fun isBasechainAddress(address: Address): Bool {
        let address_std: StdAddress = parseStdAddress(address.asSlice());
        return address_std.workchain == 0;
    }

    fun isAllowedPrivateSizeClass(sizeClass: Int): Bool {
        return sizeClass == SIZE_CLASS_1K
            || sizeClass == SIZE_CLASS_2K
            || sizeClass == SIZE_CLASS_4K
            || sizeClass == SIZE_CLASS_8K
            || sizeClass == SIZE_CLASS_16K
            || sizeClass == SIZE_CLASS_32K;
    }

    fun isAllowedPublicSizeClass(sizeClass: Int): Bool {
        return self.isAllowedPrivateSizeClass(sizeClass);
    }

    fun privateFullFee(cryptoSuite: Int): Int {
        if (cryptoSuite == CRYPTO_SUITE_HYBRID) {
            return PLATO_PRIVATE_LONG_TERM_FEE_TON;
        }
        return 0;
    }

    fun privateIndexStorageReservePerEntry(): Int {
        return CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE + CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT;
    }

    fun publicIndexStorageReservePerEntry(): Int {
        return CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE + CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT;
    }

    // clean-16 ИНК5: INTRO entries are backed the same way — keepalive + INTRO endowment per live entry.
    fun introIndexStorageReservePerEntry(): Int {
        return CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE + CAPSULEHUB_INTRO_ENTRY_STORAGE_ENDOWMENT;
    }

    // clean-16 ИНК6: RECOVERY slots are backed the same way — keepalive + the (larger, on-chain-body) endowment.
    fun recoveryIndexStorageReservePerEntry(): Int {
        return CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE + CAPSULEHUB_RECOVERY_ENTRY_STORAGE_ENDOWMENT;
    }

    fun indexStorageReserve(): Int {
        // clean-16 ИНК5/ИНК6: the intro + recovery terms join the private/public terms so EVERY live pool's
        // endowment sits inside protectedReserve() and cannot be classified as excess and swept out.
        let base: Int = (self.private_live_count * self.privateIndexStorageReservePerEntry())
            + (self.public_live_count * self.publicIndexStorageReservePerEntry())
            + (self.intro_live_count * self.introIndexStorageReservePerEntry())
            + (self.recovery_live_count * self.recoveryIndexStorageReservePerEntry());
        return (base * CAPSULEHUB_STORAGE_RESERVE_BUFFER_NUMERATOR) / CAPSULEHUB_STORAGE_RESERVE_BUFFER_DENOMINATOR;
    }

    fun protectedReserve(): Int {
        let dynamicReserve: Int = self.indexStorageReserve();
        let storageReserve: Int = CAPSULEHUB_MIN_PROTECTED_RESERVE_TON;
        if (dynamicReserve > storageReserve) {
            storageReserve = dynamicReserve;
        }
        return self.accrued_plato_fee_ton + storageReserve;
    }

    fun isAllowedPrivatePair(sizeClass: Int, cryptoSuite: Int): Bool {
        return self.isAllowedPrivateSizeClass(sizeClass)
            && cryptoSuite == CRYPTO_SUITE_HYBRID;
    }

    fun requireExactPayloadCell(cell: Cell, expectedHash: Int, expectedCells: Int, expectedBits: Int, expectedRefs: Int, hashExit: Int, sizeExit: Int) {
        throwUnless(hashExit, cell.hash() == expectedHash);
        try {
            let size: DataSize = cell.computeDataSize(expectedCells);
            throwUnless(sizeExit, size.cells == expectedCells);
            throwUnless(sizeExit, size.bits == expectedBits);
            throwUnless(sizeExit, size.refs == expectedRefs);
        } catch (exitCode) {
            throw(sizeExit);
        }
    }

    fun publicBodyBytes(sizeClass: Int): Int {
        throwUnless(12950, self.isAllowedPublicSizeClass(sizeClass));
        return sizeClass * 1024;
    }

    fun publicBodyBits(sizeClass: Int): Int {
        return self.publicBodyBytes(sizeClass) * 8;
    }

    fun publicBodyCells(sizeClass: Int): Int {
        return (self.publicBodyBytes(sizeClass) + 126) / 127;
    }

    fun publicBodyRefs(sizeClass: Int): Int {
        return self.publicBodyCells(sizeClass) - 1;
    }

    fun requirePublicPayloadCell(cell: Cell, expectedHash: Int, sizeClass: Int, hashExit: Int, sizeExit: Int) {
        throwUnless(hashExit, cell.hash() == expectedHash);
        try {
            let size: DataSize = cell.computeDataSize(self.publicBodyCells(sizeClass));
            throwUnless(sizeExit, size.cells <= self.publicBodyCells(sizeClass));
            throwUnless(sizeExit, size.bits > 0);
            throwUnless(sizeExit, size.bits <= self.publicBodyBits(sizeClass));
            throwUnless(sizeExit, size.bits % 8 == 0);
            throwUnless(sizeExit, size.refs <= self.publicBodyRefs(sizeClass));
        } catch (exitCode) {
            throw(sizeExit);
        }
    }

    fun requirePublicHeaderCell(cell: Cell, expectedHash: Int, hashExit: Int, sizeExit: Int) {
        throwUnless(hashExit, cell.hash() == expectedHash);
        try {
            let size: DataSize = cell.computeDataSize(CAPSULEHUB_PUBLIC_HEADER_MAX_CELLS);
            throwUnless(sizeExit, size.cells <= CAPSULEHUB_PUBLIC_HEADER_MAX_CELLS);
            throwUnless(sizeExit, size.bits > 0);
            throwUnless(sizeExit, size.bits <= CAPSULEHUB_PUBLIC_HEADER_MAX_BITS);
            throwUnless(sizeExit, size.bits % 8 == 0);
            throwUnless(sizeExit, size.refs <= CAPSULEHUB_PUBLIC_HEADER_MAX_REFS);
        } catch (exitCode) {
            throw(sizeExit);
        }
    }

    fun privateUsefulBytes(sizeClass: Int): Int {
        throwUnless(12941, self.isAllowedPrivateSizeClass(sizeClass));
        return sizeClass * 1024;
    }

    fun privateBodyOverheadBytes(cryptoSuite: Int): Int {
        throwUnless(12942, cryptoSuite == CRYPTO_SUITE_HYBRID);
        return CAPSULEHUB_PRIVATE_HYBRID_BODY_OVERHEAD_BYTES;
    }

    fun privateBodyBytes(sizeClass: Int, cryptoSuite: Int): Int {
        return self.privateBodyOverheadBytes(cryptoSuite) + self.privateUsefulBytes(sizeClass);
    }

    fun privateBodyBits(sizeClass: Int, cryptoSuite: Int): Int {
        return self.privateBodyBytes(sizeClass, cryptoSuite) * 8;
    }

    fun privateBodyCells(sizeClass: Int, cryptoSuite: Int): Int {
        return (self.privateBodyBytes(sizeClass, cryptoSuite) + 126) / 127;
    }

    fun privateBodyRefs(sizeClass: Int, cryptoSuite: Int): Int {
        return self.privateBodyCells(sizeClass, cryptoSuite) - 1;
    }

    // clean-16 ИНК4: INTRO body shape uses the larger INTRO overhead (ct_root + handshake fields). INTRO is
    // hybrid-only (first contact is what establishes the PQ K_root), so no cryptoSuite parameter is needed.
    fun introBodyBytes(sizeClass: Int): Int {
        return CAPSULEHUB_INTRO_HYBRID_BODY_OVERHEAD_BYTES + self.privateUsefulBytes(sizeClass);
    }

    fun introBodyBits(sizeClass: Int): Int {
        return self.introBodyBytes(sizeClass) * 8;
    }

    fun introBodyCells(sizeClass: Int): Int {
        return (self.introBodyBytes(sizeClass) + 126) / 127;
    }

    fun introBodyRefs(sizeClass: Int): Int {
        return self.introBodyCells(sizeClass) - 1;
    }

    fun pageId(entryId: Int): Int {
        return entryId / CAPSULEHUB_PAGE_SIZE;
    }

    fun pageOffset(entryId: Int): Int {
        return entryId % CAPSULEHUB_PAGE_SIZE;
    }

    fun pageCount(latestId: Int): Int {
        if (latestId == 0) {
            return 0;
        }
        return ((latestId - 1) / CAPSULEHUB_PAGE_SIZE) + 1;
    }

    fun pageExists(pageId: Int, latestId: Int): Bool {
        return pageId >= 0 && pageId < self.pageCount(latestId);
    }

    fun pageFirstEntryId(pageId: Int): Int {
        return pageId * CAPSULEHUB_PAGE_SIZE;
    }

    fun pageNextEntryId(pageId: Int, latestId: Int): Int {
        let next: Int = (pageId + 1) * CAPSULEHUB_PAGE_SIZE;
        if (next > latestId) {
            return latestId;
        }
        return next;
    }

    fun pageEntryCount(pageId: Int, latestId: Int): Int {
        if (!self.pageExists(pageId, latestId)) {
            return 0;
        }
        return self.pageNextEntryId(pageId, latestId) - self.pageFirstEntryId(pageId);
    }

    fun entryLink(entryId: Int): Int {
        return entryId + 1;
    }

    fun entryIdFromLink(entryLink: Int): Int {
        return entryLink - 1;
    }

    // clean-16 ИНК1: the private-lane index key is the client's OPAQUE HKDF bucketKey, read from the same
    // header0 window the pre-clean-16 sender keyId occupied (bits[64,320): a 64-bit meta skip, then the
    // 256-bit value). The contract treats it as an opaque map key — it derives NO sender/recipient/
    // directionality from it (D7-override). The recipient keyId extractor is deleted with the recipient
    // index: the open who-to-whom graph the redesign exists to close is gone on-chain.
    fun privateHeaderBucketKey(header0: Cell): Int {
        let header: Slice = header0.beginParse();
        header.loadUint(64);
        return header.loadUint(256);
    }

    // Forward-stub for ИНК3 (NOT yet wired into any assert — see the ИНК1/ИНК3 plan). Once CONV and RECOVERY
    // share an identical header0 length, the receive path will cross-check this against the batch publish_kind
    // to stop a CONV capsule landing in the RECOVERY pool (or vice versa). Until ИНК3 wires it, it is an unused
    // pure extractor with no on-chain effect. Layout: skip 40 bits (magic32 + version8), then the 8-bit publishKind.
    fun privateHeaderPublishKind(header0: Cell): Int {
        let header: Slice = header0.beginParse();
        header.loadUint(40);
        return header.loadUint(8);
    }

    // clean-16 ИНК4 INTRO header0 extractors. The 336-bit INTRO header0 layout is meta(64) | ephemeral_R(256) |
    // view_tag(16). ephemeral_R occupies the SAME bits[64,320) window CONV uses for its bucketKey; view_tag is the
    // trailing 16 bits[320,336). Both are read ONLY for the scan getters — they are never stored as an index.
    fun introHeaderEphemeralR(header0: Cell): Int {
        let header: Slice = header0.beginParse();
        header.loadUint(64);
        return header.loadUint(256);
    }

    fun introHeaderViewTag(header0: Cell): Int {
        let header: Slice = header0.beginParse();
        header.loadUint(64);
        header.loadUint(256);
        return header.loadUint(16);
    }

    fun pushPrivateBucketIndex(bucketKey: Int, entryLink: Int): Int {
        let indexOpt: PrivateCapsuleKeyIndex? = self.private_bucket_index.get(bucketKey);
        let prevLink: Int = 0;
        let count: Int = 0;
        if (indexOpt != null) {
            let index: PrivateCapsuleKeyIndex = indexOpt!!;
            prevLink = index.latest_entry_link;
            count = index.entry_count;
        }
        self.private_bucket_index.set(bucketKey, PrivateCapsuleKeyIndex {
            latest_entry_link: entryLink,
            entry_count: count + 1
        });
        return prevLink;
    }

    fun prunePrivateBucketIndex(bucketKey: Int, entryLink: Int, prevLink: Int) {
        // Private bucket indexes are retained-history hints. Pruning an expired middle entry can truncate older expired tail traversal; archive recovery should use page/body-history scans.
        let indexOpt: PrivateCapsuleKeyIndex? = self.private_bucket_index.get(bucketKey);
        if (indexOpt != null) {
            let index: PrivateCapsuleKeyIndex = indexOpt!!;
            if (index.latest_entry_link == entryLink) {
                index.latest_entry_link = prevLink;
            }
            if (index.entry_count > 0) {
                index.entry_count -= 1;
            }
            if (index.entry_count == 0) {
                self.private_bucket_index.del(bucketKey);
            } else {
                self.private_bucket_index.set(bucketKey, index);
            }
        }
    }

    // Public author key id: hash of the standard-address serialization of the author wallet. The client
    // derives the identical key with beginCell().storeAddress(addr).endCell().hash(). Workchain-agnostic.
    fun publicAuthorKeyId(authorWallet: Address): Int {
        return beginCell().storeAddress(authorWallet).endCell().hash();
    }

    // Mirror of the private bucket-index push, for the public author index (posts).
    fun pushPublicAuthorIndex(keyId: Int, entryLink: Int): Int {
        let indexOpt: PublicCapsuleKeyIndex? = self.public_author_index.get(keyId);
        let prevLink: Int = 0;
        let count: Int = 0;
        if (indexOpt != null) {
            let index: PublicCapsuleKeyIndex = indexOpt!!;
            prevLink = index.latest_entry_link;
            count = index.entry_count;
        }
        self.public_author_index.set(keyId, PublicCapsuleKeyIndex {
            latest_entry_link: entryLink,
            entry_count: count + 1
        });
        return prevLink;
    }

    // Mirror of the private bucket-index push, for the public parent index (comments), keyed by parent entry id.
    fun pushPublicParentIndex(parentEntryId: Int, entryLink: Int): Int {
        let indexOpt: PublicCapsuleKeyIndex? = self.public_parent_index.get(parentEntryId);
        let prevLink: Int = 0;
        let count: Int = 0;
        if (indexOpt != null) {
            let index: PublicCapsuleKeyIndex = indexOpt!!;
            prevLink = index.latest_entry_link;
            count = index.entry_count;
        }
        self.public_parent_index.set(parentEntryId, PublicCapsuleKeyIndex {
            latest_entry_link: entryLink,
            entry_count: count + 1
        });
        return prevLink;
    }

    // Mirror of the private bucket-index prune; same retained-history contract (middle links are not rewired).
    fun prunePublicAuthorIndex(keyId: Int, entryLink: Int, prevLink: Int) {
        let indexOpt: PublicCapsuleKeyIndex? = self.public_author_index.get(keyId);
        if (indexOpt != null) {
            let index: PublicCapsuleKeyIndex = indexOpt!!;
            if (index.latest_entry_link == entryLink) {
                index.latest_entry_link = prevLink;
            }
            if (index.entry_count > 0) {
                index.entry_count -= 1;
            }
            if (index.entry_count == 0) {
                self.public_author_index.del(keyId);
            } else {
                self.public_author_index.set(keyId, index);
            }
        }
    }

    fun prunePublicParentIndex(parentEntryId: Int, entryLink: Int, prevLink: Int) {
        let indexOpt: PublicCapsuleKeyIndex? = self.public_parent_index.get(parentEntryId);
        if (indexOpt != null) {
            let index: PublicCapsuleKeyIndex = indexOpt!!;
            if (index.latest_entry_link == entryLink) {
                index.latest_entry_link = prevLink;
            }
            if (index.entry_count > 0) {
                index.entry_count -= 1;
            }
            if (index.entry_count == 0) {
                self.public_parent_index.del(parentEntryId);
            } else {
                self.public_parent_index.set(parentEntryId, index);
            }
        }
    }

    // Auto-eviction (public): delete up to maxEvict oldest entries that are past the retention window, advancing
    // the low-water mark. Strict FIFO by entry id (== creation order, since created_at is monotone with id), so
    // each deleted entry is the TAIL of its author/parent chain — no middle-prune, no truncation, entry_count exact.
    // Stops at the first non-expired entry (nothing older can be expired). O(maxEvict), funded by the publisher.
    fun evictExpiredPublic(maxEvict: Int) {
        let oid: Int = self.public_oldest_live_id;
        let evicted: Int = 0;
        let stop: Bool = false;
        while ((!stop) && (evicted < maxEvict) && (oid < self.public_latest_id)) {
            let entryOpt: PublicCapsuleEntry? = self.public_entries.get(oid);
            if (entryOpt == null) {
                oid += 1; // defensive: FIFO never leaves a live gap, but skip a missing id rather than spin
            } else {
                let entry: PublicCapsuleEntry = entryOpt!!;
                if (now() < entry.created_at + CAPSULEHUB_INDEX_RETENTION_SECONDS) {
                    stop = true;
                } else {
                    let entryLink: Int = self.entryLink(oid);
                    if (entry.parent_link == 0) {
                        let authorKey: Int = self.publicAuthorKeyId(entry.author_wallet);
                        self.prunePublicAuthorIndex(authorKey, entryLink, entry.prev_link);
                        // clean-11: reclaim the per-author profile pointer if THIS evicted post was its target,
                        // so public_profile_index stays bounded by LIVE profiles (mirrors the author-index del-at-zero).
                        let profOpt: Int? = self.public_profile_index.get(authorKey);
                        if ((profOpt != null) && (profOpt!! == entryLink)) {
                            self.public_profile_index.del(authorKey);
                        }
                    } else {
                        self.prunePublicParentIndex(self.entryIdFromLink(entry.parent_link), entryLink, entry.prev_link);
                    }
                    self.public_entries.del(oid);
                    self.public_live_count -= 1;
                    oid += 1;
                    evicted += 1;
                }
            }
        }
        self.public_oldest_live_id = oid;
    }

    // Auto-eviction (private): mirror of the public path; un-pushes the single opaque bucket index of each
    // evicted entry (the opaque bucketKey parsed from header_0). There is no second directional index to prune.
    fun evictExpiredPrivate(maxEvict: Int) {
        let oid: Int = self.private_oldest_live_id;
        let evicted: Int = 0;
        let stop: Bool = false;
        while ((!stop) && (evicted < maxEvict) && (oid < self.private_latest_id)) {
            let entryOpt: PrivateCapsuleEntry? = self.private_entries.get(oid);
            if (entryOpt == null) {
                oid += 1;
            } else {
                let entry: PrivateCapsuleEntry = entryOpt!!;
                if (now() < entry.created_at + CAPSULEHUB_INDEX_RETENTION_SECONDS) {
                    stop = true;
                } else {
                    let entryLink: Int = self.entryLink(oid);
                    self.prunePrivateBucketIndex(self.privateHeaderBucketKey(entry.header_0), entryLink, entry.bucket_prev_link);
                    self.private_entries.del(oid);
                    self.private_live_count -= 1;
                    oid += 1;
                    evicted += 1;
                }
            }
        }
        self.private_oldest_live_id = oid;
    }

    // clean-16 ИНК4: scan-only FIFO eviction of the INTRO pool. Same shape as evictExpiredPrivate but with NO
    // index un-push (INTRO carries no index). Stops at the first non-expired entry; defensively skips holes.
    fun evictExpiredIntro(maxEvict: Int) {
        let oid: Int = self.intro_oldest_live_id;
        let evicted: Int = 0;
        let stop: Bool = false;
        while ((!stop) && (evicted < maxEvict) && (oid < self.intro_latest_id)) {
            let entryOpt: IntroCapsuleEntry? = self.intro_entries.get(oid);
            if (entryOpt == null) {
                oid += 1;
            } else {
                let entry: IntroCapsuleEntry = entryOpt!!;
                if (now() < entry.created_at + CAPSULEHUB_INDEX_RETENTION_SECONDS) {
                    stop = true;
                } else {
                    self.intro_entries.del(oid);
                    self.intro_live_count -= 1;
                    oid += 1;
                    evicted += 1;
                }
            }
        }
        self.intro_oldest_live_id = oid;
    }

    fun computeVaultPrivateEntryUid(entryId: Int, publishId: Int, header0: Int, header1: Int, bodyHash: Int): Int {
        let hashFields: Cell = beginCell()
            .storeUint(header0, 256)
            .storeUint(header1, 256)
            .storeUint(bodyHash, 256)
            .endCell();
        return beginCell()
            .storeUint(ENTRY_UID_DOMAIN_VAULT_PRIVATE, 32)
            .storeAddress(self.vault_address)
            .storeUint(publishId, 256)
            .storeUint(entryId, 64)
            .storeRef(hashFields)
            .endCell()
            .hash();
    }

    // clean-16 ИНК4: INTRO entry uid — same hash-fields shape as the private uid, distinct domain tag so INTRO
    // and CONV/RECOVERY entry ids live in disjoint uid spaces.
    fun computeVaultIntroEntryUid(entryId: Int, publishId: Int, header0: Int, header1: Int, bodyHash: Int): Int {
        let hashFields: Cell = beginCell()
            .storeUint(header0, 256)
            .storeUint(header1, 256)
            .storeUint(bodyHash, 256)
            .endCell();
        return beginCell()
            .storeUint(ENTRY_UID_DOMAIN_VAULT_INTRO, 32)
            .storeAddress(self.vault_address)
            .storeUint(publishId, 256)
            .storeUint(entryId, 64)
            .storeRef(hashFields)
            .endCell()
            .hash();
    }

    // clean-16 ИНК6: RECOVERY entry uid keyed by the slotKey (there is no sequential entry id), distinct domain tag.
    fun computeVaultRecoveryEntryUid(slotKey: Int, publishId: Int, header0: Int, header1: Int, bodyHash: Int): Int {
        let hashFields: Cell = beginCell()
            .storeUint(header0, 256)
            .storeUint(header1, 256)
            .storeUint(bodyHash, 256)
            .endCell();
        return beginCell()
            .storeUint(ENTRY_UID_DOMAIN_VAULT_RECOVERY, 32)
            .storeAddress(self.vault_address)
            .storeUint(publishId, 256)
            .storeUint(slotKey, 256)
            .storeRef(hashFields)
            .endCell()
            .hash();
    }

    fun computeVaultPublicEntryUid(entryId: Int, publishId: Int, author: Address, headerHash: Int, bodyHash: Int): Int {
        let payloadFields: Cell = beginCell()
            .storeAddress(author)
            .storeUint(headerHash, 256)
            .storeUint(bodyHash, 256)
            .endCell();
        return beginCell()
            .storeUint(ENTRY_UID_DOMAIN_VAULT_PUBLIC, 32)
            .storeAddress(self.vault_address)
            .storeUint(publishId, 256)
            .storeUint(entryId, 64)
            .storeRef(payloadFields)
            .endCell()
            .hash();
    }

    receive(msg: BindDeploymentManifest) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(12910, !self.vault_bound);
        throwUnless(12911, msg.deployment_manifest_hash != 0);
        throwUnless(12912, self.deployment_manifest_hash == 0 || self.deployment_manifest_hash == msg.deployment_manifest_hash);
        throwUnless(12913, self.isBasechainAddress(msg.counterpart_address));
        throwUnless(12914, msg.counterpart_address != myAddress());
        self.deployment_manifest_hash = msg.deployment_manifest_hash;
        self.vault_address = msg.counterpart_address;
        self.vault_bound = true;
    }

    receive(msg: SealGenesis) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(12920, msg.deployment_manifest_hash != 0);
        throwUnless(12921, self.deployment_manifest_hash == msg.deployment_manifest_hash);
        throwUnless(12922, self.vault_bound);
        self.sealed = true;
    }

    // entry.publish_id = hash(EPI1 ‖ batch_publish_id ‖ part_index:u16) — a distinct, verifiable id per stored entry.
    fun computeEntryPublishId(batchPublishId: Int, partIndex: Int): Int {
        return beginCell()
            .storeUint(CAPSULE_ENTRY_PUBLISH_ID_DOMAIN, 32)
            .storeUint(batchPublishId, 256)
            .storeUint(partIndex, 16)
            .endCell()
            .hash();
    }

    // Running hash over the part-ordered per-entry uids (client cross-check; no on-chain consumer).
    fun accumulateBatchUid(acc: Int, uid: Int): Int {
        return beginCell().storeUint(acc, 256).storeUint(uid, 256).endCell().hash();
    }

    // Per-entry storage reserve carried IN the batch value, with the 1.25 protectedReserve buffer (S1 finding).
    fun batchStorageReserveWithBuffer(kind: Int): Int {
        // clean-16 ИНК5: exhaustive per-kind endowment; an unrecognized kind THROWS rather than falling through
        // to a wrong default (SAFETY #3 — a forgotten branch must never silently under/over-reserve a new lane).
        let endowment: Int = 0;
        if (kind == CAPSULEHUB_ENTRY_KIND_PRIVATE) { endowment = CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT; }
        else if (kind == CAPSULEHUB_ENTRY_KIND_PUBLIC) { endowment = CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT; }
        else if (kind == CAPSULEHUB_ENTRY_KIND_INTRO) { endowment = CAPSULEHUB_INTRO_ENTRY_STORAGE_ENDOWMENT; }
        else if (kind == CAPSULEHUB_ENTRY_KIND_RECOVERY) { endowment = CAPSULEHUB_RECOVERY_ENTRY_STORAGE_ENDOWMENT; }
        else { throw(13591); }
        return (CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE + endowment)
            * CAPSULEHUB_STORAGE_RESERVE_BUFFER_NUMERATOR / CAPSULEHUB_STORAGE_RESERVE_BUFFER_DENOMINATOR;
    }

    // VPB2 batch ingest (spec 5.2): validate-all-then-commit-all. Tact reverts ALL state on any throw, so a
    // single atomic pass that validates (shape+hash via requireExact*) and stores each part IS "no partial
    // commit": any per-part throw aborts the whole batch (nothing stored, no fee, message bounces). The full
    // value gate is checked after the loop (still atomic). Phase A holds a cheap O(1) lower bound so gross
    // underfunding bounces before the expensive walk.
    receive(msg: PublishBatchToHub) {
        // Phase A — scalars
        self.requireSealed();
        throwUnless(13500, sender() == self.vault_address);
        throwUnless(13501, msg.publish_id != 0);
        throwUnless(13502, (msg.publish_kind == CAPSULEHUB_ENTRY_KIND_PRIVATE) || (msg.publish_kind == CAPSULEHUB_ENTRY_KIND_PUBLIC) || (msg.publish_kind == CAPSULEHUB_ENTRY_KIND_INTRO) || (msg.publish_kind == CAPSULEHUB_ENTRY_KIND_RECOVERY));
        throwUnless(13503, (msg.part_count >= 1) && (msg.part_count <= MAX_BATCH_PARTS));
        // clean-16 ИНК4/ИНК6: CONV (=PRIVATE), INTRO and RECOVERY all ride the 784-bit private part frame; PUBLIC
        // is the else. RECOVERY is keyed latest-wins (no sequential id) and reuses the CONV 320-bit header0 shape.
        let isConv: Bool = (msg.publish_kind == CAPSULEHUB_ENTRY_KIND_PRIVATE);
        let isIntro: Bool = (msg.publish_kind == CAPSULEHUB_ENTRY_KIND_INTRO);
        let isPublic: Bool = (msg.publish_kind == CAPSULEHUB_ENTRY_KIND_PUBLIC);
        let isRecovery: Bool = (msg.publish_kind == CAPSULEHUB_ENTRY_KIND_RECOVERY);

        let firstEntryId: Int = self.public_latest_id;
        let fullFeePerPart: Int = PLATO_PUBLIC_POST_FEE_TON;
        if (isConv) {
            firstEntryId = self.private_latest_id;
            fullFeePerPart = self.privateFullFee(CRYPTO_SUITE_HYBRID);
        } else if (isIntro) {
            firstEntryId = self.intro_latest_id;
            fullFeePerPart = self.privateFullFee(CRYPTO_SUITE_HYBRID);
        } else if (isRecovery) {
            // RECOVERY is keyed (no sequential id); firstEntryId is unused. It pays the private hybrid fee.
            fullFeePerPart = self.privateFullFee(CRYPTO_SUITE_HYBRID);
        }
        throwUnless(13504, firstEntryId + msg.part_count <= 18446744073709551615);
        throwUnless(13505, msg.protocol_fee_total >= 0);
        throwUnless(13506, msg.protocol_fee_total <= msg.part_count * fullFeePerPart);
        if (isPublic) {
            let mk: Cell? = msg.marketing;
            throwUnless(13507, mk != null);
            throwUnless(13508, mk!!.beginParse().loadUint(152) == PLATHO_PUBLIC_MARKETING_NOTE_ASCII);
        }
        // Phase A cheap lower bound (O(1)): bounce gross underfunding before the walk (drift-beyond-cushion case).
        throwUnless(13509, context().value >= msg.protocol_fee_total + msg.part_count * HUB_MIN_PER_PART_VALUE + CAPSULEHUB_ACK_FORWARD_RESERVE);

        // Phases B/C/D — one atomic pass.
        let cursor: Cell = msg.parts;
        let i: Int = 0;
        let requiredValue: Int = msg.protocol_fee_total + getComputeFee(HUB_BATCH_BASE_GAS, false) + CAPSULEHUB_ACK_FORWARD_RESERVE;
        let batchUid: Int = 0;
        // clean-16 ИНК6-fix: number of NEW recovery slots this batch creates (an OVERWRITE reuses an already-funded
        // slot, so its endowment must NOT be charged/kept again — see the RECOVERY branch + the kept computation).
        let recoveryNewSlots: Int = 0;
        while (i < msg.part_count) {
            let isLast: Bool = (i == (msg.part_count - 1));
            let part: Slice = cursor.beginParse();
            let entryId: Int = firstEntryId + i;
            let entryPublishId: Int = self.computeEntryPublishId(msg.publish_id, i);
            let nextCell: Cell = msg.parts; // overwritten when not last; unused on the last iteration
            if (isConv) {
                let wantRefs: Int = 3;
                if (!isLast) { wantRefs = 4; }
                throwUnless(13510, (part.bits() == 784) && (part.refs() == wantRefs));
                let sizeClass: Int = part.loadUint(8);
                let cryptoSuite: Int = part.loadUint(8);
                let h0: Int = part.loadUint(256);
                let h1: Int = part.loadUint(256);
                let bh: Int = part.loadUint(256);
                let header0: Cell = part.loadRef();
                let header1: Cell = part.loadRef();
                let body: Cell = part.loadRef();
                if (!isLast) { nextCell = part.loadRef(); }
                throwUnless(13511, self.isAllowedPrivatePair(sizeClass, cryptoSuite));
                throwUnless(13512, (h0 != 0) && (h1 != 0) && (bh != 0));
                self.requireExactPayloadCell(header0, h0, CAPSULEHUB_PRIVATE_HEADER0_CELLS, CAPSULEHUB_CONV_HEADER0_BITS, CAPSULEHUB_PRIVATE_HEADER0_REFS, 13513, 13514);
                // clean-16 ИНК3 (LOAD-BEARING, do not remove): CONV and (from ИНК6) RECOVERY share the same
                // 320-bit header0 length, so shape alone cannot tell them apart. Bind the header0's embedded
                // publishKind (byte@5) to the batch publish_kind: a mislabeled RECOVERY capsule under CONV kind
                // (or vice versa) would otherwise land in the wrong pool — a CONV-pool RECOVERY capsule is
                // evicted after 1 year, permanently losing the user's K_root. The extractor reads ONLY byte@5.
                throwUnless(13519, self.privateHeaderPublishKind(header0) == msg.publish_kind);
                self.requireExactPayloadCell(header1, h1, CAPSULEHUB_PRIVATE_HEADER1_CELLS, CAPSULEHUB_PRIVATE_HEADER1_BITS, CAPSULEHUB_PRIVATE_HEADER1_REFS, 13515, 13516);
                self.requireExactPayloadCell(body, bh, self.privateBodyCells(sizeClass, cryptoSuite), self.privateBodyBits(sizeClass, cryptoSuite), self.privateBodyRefs(sizeClass, cryptoSuite), 13517, 13518);
                let entryLink: Int = self.entryLink(entryId);
                let bucketPrevLink: Int = self.pushPrivateBucketIndex(self.privateHeaderBucketKey(header0), entryLink);
                let uid: Int = self.computeVaultPrivateEntryUid(entryId, entryPublishId, h0, h1, bh);
                self.private_entries.set(entryId, PrivateCapsuleEntry {
                    publish_id: entryPublishId,
                    created_at: now(),
                    body_hash: bh,
                    bucket_prev_link: bucketPrevLink,
                    header_0: header0,
                    header_1: header1
                });
                self.private_live_count += 1;
                requiredValue += getComputeFee(HUB_PART_GAS_PRIVATE, false) + self.batchStorageReserveWithBuffer(CAPSULEHUB_ENTRY_KIND_PRIVATE);
                batchUid = self.accumulateBatchUid(batchUid, uid);
            } else if (isIntro) {
                // clean-16 ИНК4 INTRO branch: same 784-bit private frame, but a 336-bit header0 (ephemeral_R +
                // view_tag), a larger INTRO body, NO index (the recipient scans), and its own meta-assert (13549).
                let wantRefs: Int = 3;
                if (!isLast) { wantRefs = 4; }
                throwUnless(13540, (part.bits() == 784) && (part.refs() == wantRefs));
                let sizeClass: Int = part.loadUint(8);
                let cryptoSuite: Int = part.loadUint(8);
                let h0: Int = part.loadUint(256);
                let h1: Int = part.loadUint(256);
                let bh: Int = part.loadUint(256);
                let header0: Cell = part.loadRef();
                let header1: Cell = part.loadRef();
                let body: Cell = part.loadRef();
                if (!isLast) { nextCell = part.loadRef(); }
                throwUnless(13541, self.isAllowedPrivatePair(sizeClass, cryptoSuite));
                throwUnless(13542, (h0 != 0) && (h1 != 0) && (bh != 0));
                self.requireExactPayloadCell(header0, h0, CAPSULEHUB_PRIVATE_HEADER0_CELLS, CAPSULEHUB_INTRO_HEADER0_BITS, CAPSULEHUB_PRIVATE_HEADER0_REFS, 13543, 13544);
                throwUnless(13549, self.privateHeaderPublishKind(header0) == msg.publish_kind);
                self.requireExactPayloadCell(header1, h1, CAPSULEHUB_PRIVATE_HEADER1_CELLS, CAPSULEHUB_PRIVATE_HEADER1_BITS, CAPSULEHUB_PRIVATE_HEADER1_REFS, 13545, 13546);
                self.requireExactPayloadCell(body, bh, self.introBodyCells(sizeClass), self.introBodyBits(sizeClass), self.introBodyRefs(sizeClass), 13547, 13548);
                let uid: Int = self.computeVaultIntroEntryUid(entryId, entryPublishId, h0, h1, bh);
                self.intro_entries.set(entryId, IntroCapsuleEntry {
                    publish_id: entryPublishId,
                    created_at: now(),
                    body_hash: bh,
                    header_0: header0,
                    header_1: header1
                });
                self.intro_live_count += 1;
                requiredValue += getComputeFee(HUB_PART_GAS_INTRO, false) + self.batchStorageReserveWithBuffer(CAPSULEHUB_ENTRY_KIND_INTRO);
                batchUid = self.accumulateBatchUid(batchUid, uid);
            } else if (isRecovery) {
                // clean-16 ИНК6 RECOVERY branch: same 784-bit frame + the CONV 320-bit header0, but the body is
                // stored ON-CHAIN in a keyed latest-wins slot (key = self-bucketKey). A repeat publish OVERWRITES
                // the slot; the live count grows ONLY on the first insert. Body size is capped by RECOVERY_MAX_SIZE_CLASS.
                let wantRefs: Int = 3;
                if (!isLast) { wantRefs = 4; }
                throwUnless(13550, (part.bits() == 784) && (part.refs() == wantRefs));
                let sizeClass: Int = part.loadUint(8);
                let cryptoSuite: Int = part.loadUint(8);
                let h0: Int = part.loadUint(256);
                let h1: Int = part.loadUint(256);
                let bh: Int = part.loadUint(256);
                let header0: Cell = part.loadRef();
                let header1: Cell = part.loadRef();
                let body: Cell = part.loadRef();
                if (!isLast) { nextCell = part.loadRef(); }
                throwUnless(13551, self.isAllowedPrivatePair(sizeClass, cryptoSuite));
                throwUnless(13552, (h0 != 0) && (h1 != 0) && (bh != 0));
                throwUnless(13560, sizeClass <= RECOVERY_MAX_SIZE_CLASS);
                self.requireExactPayloadCell(header0, h0, CAPSULEHUB_PRIVATE_HEADER0_CELLS, CAPSULEHUB_CONV_HEADER0_BITS, CAPSULEHUB_PRIVATE_HEADER0_REFS, 13553, 13554);
                throwUnless(13559, self.privateHeaderPublishKind(header0) == msg.publish_kind);
                self.requireExactPayloadCell(header1, h1, CAPSULEHUB_PRIVATE_HEADER1_CELLS, CAPSULEHUB_PRIVATE_HEADER1_BITS, CAPSULEHUB_PRIVATE_HEADER1_REFS, 13555, 13556);
                self.requireExactPayloadCell(body, bh, self.privateBodyCells(sizeClass, cryptoSuite), self.privateBodyBits(sizeClass, cryptoSuite), self.privateBodyRefs(sizeClass, cryptoSuite), 13557, 13558);
                let slotKey: Int = self.privateHeaderBucketKey(header0);
                let existingOpt: RecoveryCapsuleRecord? = self.recovery_slots.get(slotKey);
                let existed: Bool = (existingOpt != null);
                // Variant-B first-publisher bind: only the wallet that created the slot may overwrite it. This is
                // the ONLY defence against a permissionless destructive overwrite of a K_root recovery blob, since
                // slotKey is public once published (map key + header_0 bits[64,320) + cleartext in the publish tx).
                if (existed) { throwUnless(13563, existingOpt!!.author_wallet == msg.author_wallet); }
                self.recovery_slots.set(slotKey, RecoveryCapsuleRecord {
                    publish_id: entryPublishId,
                    updated_at: now(),
                    body_hash: bh,
                    author_wallet: msg.author_wallet,
                    header_0: header0,
                    header_1: header1,
                    body: body
                });
                requiredValue += getComputeFee(HUB_PART_GAS_RECOVERY, false);
                if (!existed) {
                    // A fresh slot's full 3yr endowment is charged/kept ONCE; an OVERWRITE reuses the slot's
                    // already-protected reserve (the retention clock resets but per-entry reserve = full worst-case
                    // 3yr, so it stays covered). Charging it again would leak the surplus to the sweepable pool.
                    self.recovery_live_count += 1;
                    recoveryNewSlots += 1;
                    requiredValue += self.batchStorageReserveWithBuffer(CAPSULEHUB_ENTRY_KIND_RECOVERY);
                }
                let uid: Int = self.computeVaultRecoveryEntryUid(slotKey, entryPublishId, h0, h1, bh);
                batchUid = self.accumulateBatchUid(batchUid, uid);
            } else {
                let wantRefs: Int = 2;
                if (!isLast) { wantRefs = 3; }
                throwUnless(13520, (part.bits() == 592) && (part.refs() == wantRefs));
                let sizeClass: Int = part.loadUint(8);
                let reserved: Int = part.loadUint(8);
                let parentLink: Int = part.loadUint(64);
                let h0: Int = part.loadUint(256);
                let bh: Int = part.loadUint(256);
                let header: Cell = part.loadRef();
                let body: Cell = part.loadRef();
                if (!isLast) { nextCell = part.loadRef(); }
                // clean-11: bit0 (0x01) = is_profile (client PDC1 PROFILE=7 body signal); bits 1..7 stay reserved (0).
                throwUnless(13521, (reserved & 254) == 0);   // 254 == 0b11111110
                let isProfile: Bool = (reserved & 1) == 1;
                throwUnless(13522, self.isAllowedPublicSizeClass(sizeClass));
                throwUnless(13523, (h0 != 0) && (bh != 0));
                // parentLink == 0 -> post; else parentLink == parentEntryId+1 and the parent must strictly precede.
                // The parent is NOT required to still exist (it may have been evicted) nor to be a top-level post
                // (a comment may reply to a comment) — intentional: each entry is independently funded and the
                // thread is reassembled client-side. The only guard is that the parent id precedes this entry.
                // clean-11: an is_profile flag is valid ONLY on a top-level post (a channel's own description).
                // A comment (parentLink != 0) carrying it is malformed -> fail-closed.
                throwUnless(13529, (!isProfile) || (parentLink == 0));
                throwUnless(13528, (parentLink == 0) || (parentLink <= entryId));
                self.requirePublicHeaderCell(header, h0, 13524, 13525);
                self.requirePublicPayloadCell(body, bh, sizeClass, 13526, 13527);
                let uid: Int = self.computeVaultPublicEntryUid(entryId, entryPublishId, msg.author_wallet, h0, bh);
                let entryLink: Int = self.entryLink(entryId);
                let publicPrevLink: Int = 0;
                let profilePrevLink: Int = 0;                       // clean-11: 0 for non-profile posts
                if (parentLink == 0) {
                    let authorKey: Int = self.publicAuthorKeyId(msg.author_wallet);
                    publicPrevLink = self.pushPublicAuthorIndex(authorKey, entryLink);
                    if (isProfile) {
                        // per-author pointer (latest profile for this channel) + global profile chain head-insert
                        self.public_profile_index.set(authorKey, entryLink);
                        profilePrevLink = self.public_profile_head;
                        self.public_profile_head = entryLink;
                    }
                } else {
                    publicPrevLink = self.pushPublicParentIndex(self.entryIdFromLink(parentLink), entryLink);
                }
                self.public_entries.set(entryId, PublicCapsuleEntry {
                    publish_id: entryPublishId,
                    created_at: now(),
                    author_wallet: msg.author_wallet,
                    body_hash: bh,
                    parent_link: parentLink,
                    prev_link: publicPrevLink,
                    profile_prev_link: profilePrevLink,             // clean-11
                    header: header
                });
                self.public_live_count += 1;
                requiredValue += getComputeFee(HUB_PART_GAS_PUBLIC, false) + self.batchStorageReserveWithBuffer(CAPSULEHUB_ENTRY_KIND_PUBLIC);
                batchUid = self.accumulateBatchUid(batchUid, uid);
            }
            cursor = nextCell;
            i += 1;
        }
        // Full value gate (atomic: reverts every store above if the forwarded value is short).
        throwUnless(13530, context().value >= requiredValue);
        // Commit batch-level counters + fee exactly once.
        if (isConv) {
            self.private_latest_id += msg.part_count;
        } else if (isIntro) {
            self.intro_latest_id += msg.part_count;
        } else if (isPublic) {
            self.public_latest_id += msg.part_count;
        }
        // RECOVERY has no sequential id (keyed slot map); recovery_live_count was bumped per-part in the branch above.
        self.accrued_plato_fee_ton += msg.protocol_fee_total;

        // Auto-eviction (FIFO, funded via HUB_PART_GAS_*): each batch evicts up to part_count oldest expired
        // entries of its own kind, bounding live state by construction. Just-added entries are created at now()
        // so they are never expired; the loop stops at the first non-expired entry.
        // Own-kind FIFO eviction (funded by HUB_PART_GAS_*).
        if (isConv) {
            self.evictExpiredPrivate(msg.part_count);
        } else if (isIntro) {
            self.evictExpiredIntro(msg.part_count);
        } else if (isPublic) {
            self.evictExpiredPublic(msg.part_count);
        }
        // RECOVERY has no FIFO eviction (keyed latest-wins map); expired slots are reclaimed permissionlessly via
        // the EvictExpiredRecoverySlot message.
        // clean-16 ИНК4: unconditional capped INTRO sweep. INTRO is low-frequency; without this a quiet INTRO
        // pool would never shed expired first-contact capsules between INTRO batches. Every non-INTRO batch
        // sweeps up to CAPSULEHUB_INTRO_SWEEP_CAP expired intro entries — a fixed small cost on the hot path
        // (G8-provisional: HUB_PART_GAS_* must cover it). An INTRO batch already swept its own pool above.
        if (!isIntro) {
            let introSweep: Int = msg.part_count;
            if (introSweep > CAPSULEHUB_INTRO_SWEEP_CAP) { introSweep = CAPSULEHUB_INTRO_SWEEP_CAP; }
            self.evictExpiredIntro(introSweep);
        }

        // ACK (spec 5.3): keep fee + entry storage (+1.25 buffer), protect pre-existing balance, return the rest
        // (import over-hold + ack float) to the Vault via mode 128. The Vault credits it back to the user ledger.
        // CONV/INTRO/PUBLIC create one new entry per part → keep part_count endowments. RECOVERY is a keyed slot
        // map: an OVERWRITE reuses an already-funded slot, so keep endowment only for the NEW slots (else the
        // redundant endowment is kept as sweepable surplus instead of being returned to the owner).
        let kept: Int = msg.protocol_fee_total + msg.part_count * self.batchStorageReserveWithBuffer(msg.publish_kind);
        if (msg.publish_kind == CAPSULEHUB_ENTRY_KIND_RECOVERY) {
            kept = msg.protocol_fee_total + recoveryNewSlots * self.batchStorageReserveWithBuffer(CAPSULEHUB_ENTRY_KIND_RECOVERY);
        }
        nativeReserve(kept, ReserveAtMost | ReserveAddOriginalBalance);
        message(MessageParameters {
            to: self.vault_address,
            value: 0,
            bounce: false,
            mode: SendRemainingBalance,
            body: CapsuleHubBatchAck {
                publish_id: msg.publish_id,
                first_entry_id: firstEntryId,
                part_count: msg.part_count,
                batch_uid: batchUid
            }.toCell()
        });
    }

    receive(msg: FlushFees) {
        self.requireSealed();
        throwUnless(13200, msg.amount > 0);
        throwUnless(13201, msg.amount <= self.accrued_plato_fee_ton);
        throwUnless(13205, msg.amount >= CAPSULEHUB_MIN_FEE_FLUSH_TON || msg.amount == self.accrued_plato_fee_ton);
        throwUnless(13202, context().value >= CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE + CAPSULEHUB_FLUSH_LOCAL_EXEC_RESERVE);
        let effectiveBalance: Int = myBalance() - context().value;
        throwUnless(13206, effectiveBalance >= self.protectedReserve());

        self.accrued_plato_fee_ton -= msg.amount;

        message(MessageParameters {
            to: self.fee_accumulator_address,
            value: msg.amount + CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            body: DepositProtocolFee { amount: msg.amount }.toCell()
        });
    }

    bounced(msg: bounced<DepositProtocolFee>) {
        self.requireSealed();
        throwUnless(13203, sender() == self.fee_accumulator_address);
        throwUnless(13204, msg.amount > 0);
        // Flush bounces restore debited accrued fees; reserve-sweep bounces reclassify returned excess as backed accrued due for the normal flush path.
        self.accrued_plato_fee_ton += msg.amount;
    }

    receive(msg: TopUpStorageReserve) {
        // Accept TON for CapsuleHub storage reserve only. Counters, fees, and bindings are unchanged.
    }

    receive(msg: SweepExcessReserve) {
        self.requireSealed();
        throwUnless(13220, msg.amount > 0);
        throwUnless(13221, msg.amount >= CAPSULEHUB_MIN_RESERVE_SWEEP_TON);
        throwUnless(13222, context().value >= CAPSULEHUB_SWEEP_LOCAL_EXEC_RESERVE + CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE);

        let effectiveBalance: Int = myBalance() - context().value;
        let protected: Int = self.protectedReserve();
        throwUnless(13223, effectiveBalance > protected);
        let excess: Int = effectiveBalance - protected;
        throwUnless(13224, msg.amount <= excess);

        message(MessageParameters {
            to: self.fee_accumulator_address,
            value: msg.amount + CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            body: DepositProtocolFee { amount: msg.amount }.toCell()
        });
    }

    // clean-16 ИНК6: permissionless reclaim of an EXPIRED RECOVERY slot. The keyed slot map has no FIFO eviction
    // (a page can only hold one current recovery blob), so a slot is only reclaimed once its 3-year retention has
    // lapsed. Deleting it drops the live-count term so the endowment it protected is released to the sweepable
    // surplus. No auth: the expiry check IS the gate.
    receive(msg: EvictExpiredRecoverySlot) {
        self.requireSealed();
        let recOpt: RecoveryCapsuleRecord? = self.recovery_slots.get(msg.slot_key);
        throwUnless(13562, recOpt != null);
        let rec: RecoveryCapsuleRecord = recOpt!!;
        throwUnless(13561, (rec.updated_at + CAPSULEHUB_RECOVERY_POOL_RETENTION_SECONDS) < now());
        self.recovery_slots.set(msg.slot_key, null);
        self.recovery_live_count -= 1;
    }

    // clean-16 L6/#11: permissionless standalone eviction. Reclaims up to CAPSULEHUB_STANDALONE_EVICT_CAP expired
    // entries of the requested lane WITHOUT a publish — so a quiet private/public lane still sheds its backlog. Same
    // FIFO/retention logic as the publish-path eviction; the caller funds the gas. No auth (expiry IS the gate).
    receive(msg: EvictExpiredCapsules) {
        self.requireSealed();
        let n: Int = msg.max_count;
        if (n > CAPSULEHUB_STANDALONE_EVICT_CAP) { n = CAPSULEHUB_STANDALONE_EVICT_CAP; }
        if (msg.kind == CAPSULEHUB_ENTRY_KIND_PRIVATE) {
            self.evictExpiredPrivate(n);
        } else if (msg.kind == CAPSULEHUB_ENTRY_KIND_PUBLIC) {
            self.evictExpiredPublic(n);
        } else if (msg.kind == CAPSULEHUB_ENTRY_KIND_INTRO) {
            self.evictExpiredIntro(n);
        } else {
            throw(13570); // unknown lane
        }
    }

    get fun get_recovery_capsule(slotKey: Int): RecoveryCapsuleView {
        let recOpt: RecoveryCapsuleRecord? = self.recovery_slots.get(slotKey);
        if (recOpt == null) {
            return RecoveryCapsuleView {
                exists: false,
                slot_key: slotKey,
                updated_at: 0,
                body_hash: 0,
                author_wallet: myAddress(),
                header_0: emptyCell(),
                header_1: emptyCell(),
                body: emptyCell()
            };
        }
        let rec: RecoveryCapsuleRecord = recOpt!!;
        return RecoveryCapsuleView {
            exists: true,
            slot_key: slotKey,
            updated_at: rec.updated_at,
            body_hash: rec.body_hash,
            author_wallet: rec.author_wallet,
            header_0: rec.header_0,
            header_1: rec.header_1,
            body: rec.body
        };
    }

    get fun get_private_entry(entryId: Int): PrivateCapsuleEntryView {
        let entryOpt: PrivateCapsuleEntry? = self.private_entries.get(entryId);
        if (entryOpt == null) {
            return PrivateCapsuleEntryView {
                exists: false,
                entry_id: entryId,
                bucket_prev_link: 0,
                entry_uid: 0,
                publish_id: 0,
                author_wallet: myAddress(),
                page_id: self.pageId(entryId),
                page_offset: self.pageOffset(entryId),
                created_at: 0,
                header_0_hash: 0,
                header_1_hash: 0,
                body_hash: 0,
                header_0: emptyCell(),
                header_1: emptyCell()
            };
        }
        let entry: PrivateCapsuleEntry = entryOpt!!;
        let header0Hash: Int = entry.header_0.hash();
        let header1Hash: Int = entry.header_1.hash();
        return PrivateCapsuleEntryView {
            exists: true,
            entry_id: entryId,
            bucket_prev_link: entry.bucket_prev_link,
            entry_uid: self.computeVaultPrivateEntryUid(entryId, entry.publish_id, header0Hash, header1Hash, entry.body_hash),
            publish_id: entry.publish_id,
            author_wallet: self.vault_address,
            page_id: self.pageId(entryId),
            page_offset: self.pageOffset(entryId),
            created_at: entry.created_at,
            header_0_hash: header0Hash,
            header_1_hash: header1Hash,
            body_hash: entry.body_hash,
            header_0: entry.header_0,
            header_1: entry.header_1
        };
    }

    // clean-16 ИНК1: the SOLE private-lane index getter. Keyed by the opaque bucketKey; there is no
    // sender-keyed or recipient-keyed getter anymore, so the on-chain private lane exposes NO who-to-whom
    // edge. A party fetches its own incoming/outgoing CONV entries by deriving its own bucketKeys client-side.
    get fun get_private_bucket_index(bucketKey: Int): PrivateBucketIndexView {
        let indexOpt: PrivateCapsuleKeyIndex? = self.private_bucket_index.get(bucketKey);
        if (indexOpt == null) {
            return PrivateBucketIndexView {
                exists: false,
                bucket_key: bucketKey,
                latest_entry_id: 0,
                latest_entry_link: 0,
                entry_count: 0
            };
        }
        let index: PrivateCapsuleKeyIndex = indexOpt!!;
        return PrivateBucketIndexView {
            exists: true,
            bucket_key: bucketKey,
            latest_entry_id: self.entryIdFromLink(index.latest_entry_link),
            latest_entry_link: index.latest_entry_link,
            entry_count: index.entry_count
        };
    }

    // clean-16 ИНК4 INTRO getters. get_intro_entry returns one stored INTRO capsule; get_intro_scan_bounds gives
    // the live scan window; get_intro_scan_page returns up to 64 scan rows (view_tag + ephemeral_R read straight
    // out of header_0) so the recipient trial-decrypts without fetching bodies. No sender/recipient index exists.
    get fun get_intro_entry(entryId: Int): IntroCapsuleEntryView {
        let entryOpt: IntroCapsuleEntry? = self.intro_entries.get(entryId);
        if (entryOpt == null) {
            return IntroCapsuleEntryView {
                exists: false,
                entry_id: entryId,
                entry_uid: 0,
                publish_id: 0,
                created_at: 0,
                header_0_hash: 0,
                header_1_hash: 0,
                body_hash: 0,
                header_0: emptyCell(),
                header_1: emptyCell()
            };
        }
        let entry: IntroCapsuleEntry = entryOpt!!;
        let header0Hash: Int = entry.header_0.hash();
        let header1Hash: Int = entry.header_1.hash();
        return IntroCapsuleEntryView {
            exists: true,
            entry_id: entryId,
            entry_uid: self.computeVaultIntroEntryUid(entryId, entry.publish_id, header0Hash, header1Hash, entry.body_hash),
            publish_id: entry.publish_id,
            created_at: entry.created_at,
            header_0_hash: header0Hash,
            header_1_hash: header1Hash,
            body_hash: entry.body_hash,
            header_0: entry.header_0,
            header_1: entry.header_1
        };
    }

    get fun get_intro_scan_bounds(): IntroScanBoundsView {
        return IntroScanBoundsView {
            oldest_live_id: self.intro_oldest_live_id,
            latest_id: self.intro_latest_id,
            live_count: self.intro_live_count
        };
    }

    get fun get_intro_scan_page(fromEntryId: Int, count: Int): IntroScanPageView {
        let clamped: Int = count;
        if (clamped > 64) { clamped = 64; }
        if (clamped < 0) { clamped = 0; }
        let records: map<Int as uint16, IntroScanRecord> = emptyMap();
        let i: Int = 0;
        let emitted: Int = 0;
        while (i < clamped) {
            let eid: Int = fromEntryId + i;
            let entryOpt: IntroCapsuleEntry? = self.intro_entries.get(eid);
            if (entryOpt != null) {
                let entry: IntroCapsuleEntry = entryOpt!!;
                records.set(emitted, IntroScanRecord {
                    entry_id: eid,
                    created_at: entry.created_at,
                    view_tag: self.introHeaderViewTag(entry.header_0),
                    ephemeral_r: self.introHeaderEphemeralR(entry.header_0)
                });
                emitted += 1;
            }
            i += 1;
        }
        return IntroScanPageView { from_entry_id: fromEntryId, count: emitted, records: records };
    }

    get fun get_public_author_index(keyId: Int): PublicCapsuleKeyIndexView {
        let indexOpt: PublicCapsuleKeyIndex? = self.public_author_index.get(keyId);
        if (indexOpt == null) {
            return PublicCapsuleKeyIndexView {
                exists: false,
                key_id: keyId,
                latest_entry_id: 0,
                latest_entry_link: 0,
                entry_count: 0
            };
        }
        let index: PublicCapsuleKeyIndex = indexOpt!!;
        return PublicCapsuleKeyIndexView {
            exists: true,
            key_id: keyId,
            latest_entry_id: self.entryIdFromLink(index.latest_entry_link),
            latest_entry_link: index.latest_entry_link,
            entry_count: index.entry_count
        };
    }

    // clean-11: latest profile entry link for a channel (keyId = publicAuthorKeyId(author)). exists=false /
    // entry_link=0 when the channel never published a profile. The returned entry MAY be evicted — the client
    // cross-checks with get_public_entry(entry_id).exists (dangling-tolerant by design).
    get fun get_public_profile_index(keyId: Int): PublicCapsuleKeyIndexView {
        let linkOpt: Int? = self.public_profile_index.get(keyId);
        if (linkOpt == null) {
            return PublicCapsuleKeyIndexView {
                exists: false,
                key_id: keyId,
                latest_entry_id: 0,
                latest_entry_link: 0,
                entry_count: 0
            };
        }
        let link: Int = linkOpt!!;
        return PublicCapsuleKeyIndexView {
            exists: true,
            key_id: keyId,
            latest_entry_id: self.entryIdFromLink(link),
            latest_entry_link: link,
            entry_count: 1
        };
    }

    // clean-11: head link of the global profile chain (0 = no profile ever). The client walks it newest-first via
    // get_public_entry(...).profile_prev_link for COMPLETE described-channel discovery.
    get fun get_public_profile_head(): Int {
        return self.public_profile_head;
    }

    get fun get_public_parent_index(parentEntryId: Int): PublicCapsuleKeyIndexView {
        let indexOpt: PublicCapsuleKeyIndex? = self.public_parent_index.get(parentEntryId);
        if (indexOpt == null) {
            return PublicCapsuleKeyIndexView {
                exists: false,
                key_id: parentEntryId,
                latest_entry_id: 0,
                latest_entry_link: 0,
                entry_count: 0
            };
        }
        let index: PublicCapsuleKeyIndex = indexOpt!!;
        return PublicCapsuleKeyIndexView {
            exists: true,
            key_id: parentEntryId,
            latest_entry_id: self.entryIdFromLink(index.latest_entry_link),
            latest_entry_link: index.latest_entry_link,
            entry_count: index.entry_count
        };
    }

    get fun get_public_entry(entryId: Int): PublicCapsuleEntryView {
        let entryOpt: PublicCapsuleEntry? = self.public_entries.get(entryId);
        if (entryOpt == null) {
            return PublicCapsuleEntryView {
                exists: false,
                entry_id: entryId,
                entry_uid: 0,
                publish_id: 0,
                author_wallet: myAddress(),
                page_id: self.pageId(entryId),
                page_offset: self.pageOffset(entryId),
                created_at: 0,
                header_hash: 0,
                body_hash: 0,
                parent_link: 0,
                prev_link: 0,
                profile_prev_link: 0,
                header: emptyCell()
            };
        }
        let entry: PublicCapsuleEntry = entryOpt!!;
        let headerHash: Int = entry.header.hash();
        return PublicCapsuleEntryView {
            exists: true,
            entry_id: entryId,
            entry_uid: self.computeVaultPublicEntryUid(entryId, entry.publish_id, entry.author_wallet, headerHash, entry.body_hash),
            publish_id: entry.publish_id,
            author_wallet: entry.author_wallet,
            page_id: self.pageId(entryId),
            page_offset: self.pageOffset(entryId),
            created_at: entry.created_at,
            header_hash: headerHash,
            body_hash: entry.body_hash,
            parent_link: entry.parent_link,
            prev_link: entry.prev_link,
            profile_prev_link: entry.profile_prev_link,
            header: entry.header
        };
    }

    get fun get_private_page(pageId: Int): CapsuleHubPageView {
        if (!self.pageExists(pageId, self.private_latest_id)) {
            return CapsuleHubPageView {
                exists: false,
                page_id: pageId,
                first_entry_id: pageId * CAPSULEHUB_PAGE_SIZE,
                next_entry_id: pageId * CAPSULEHUB_PAGE_SIZE,
                entry_count: 0,
                opened_at: 0,
                updated_at: 0
            };
        }
        return CapsuleHubPageView {
            exists: true,
            page_id: pageId,
            first_entry_id: self.pageFirstEntryId(pageId),
            next_entry_id: self.pageNextEntryId(pageId, self.private_latest_id),
            entry_count: self.pageEntryCount(pageId, self.private_latest_id),
            opened_at: 0,
            updated_at: 0
        };
    }

    get fun get_public_page(pageId: Int): CapsuleHubPageView {
        if (!self.pageExists(pageId, self.public_latest_id)) {
            return CapsuleHubPageView {
                exists: false,
                page_id: pageId,
                first_entry_id: pageId * CAPSULEHUB_PAGE_SIZE,
                next_entry_id: pageId * CAPSULEHUB_PAGE_SIZE,
                entry_count: 0,
                opened_at: 0,
                updated_at: 0
            };
        }
        return CapsuleHubPageView {
            exists: true,
            page_id: pageId,
            first_entry_id: self.pageFirstEntryId(pageId),
            next_entry_id: self.pageNextEntryId(pageId, self.public_latest_id),
            entry_count: self.pageEntryCount(pageId, self.public_latest_id),
            opened_at: 0,
            updated_at: 0
        };
    }

    get fun get_state(): CapsuleHubStateView {
        return CapsuleHubStateView {
            sealed: self.sealed,
            vault_bound: self.vault_bound,
            deployment_manifest_hash: self.deployment_manifest_hash,
            private_latest_id: self.private_latest_id,
            public_latest_id: self.public_latest_id,
            private_page_count: self.pageCount(self.private_latest_id),
            public_page_count: self.pageCount(self.public_latest_id),
            page_size: CAPSULEHUB_PAGE_SIZE,
            index_storage_years: CAPSULEHUB_INDEX_STORAGE_YEARS,
            index_retention_seconds: CAPSULEHUB_INDEX_RETENTION_SECONDS,
            accrued_plato_fee_ton: self.accrued_plato_fee_ton,
            fee_accumulator_address: self.fee_accumulator_address,
            vault_address: self.vault_address,
            genesis_controller_address: self.genesis_controller_address,
            private_live_count: self.private_live_count,
            public_live_count: self.public_live_count,
            intro_latest_id: self.intro_latest_id,
            intro_oldest_live_id: self.intro_oldest_live_id,
            intro_live_count: self.intro_live_count,
            recovery_live_count: self.recovery_live_count,
            index_storage_reserve_ton: self.indexStorageReserve(),
            protected_reserve_ton: self.protectedReserve(),
            reserve_floor_ton: CAPSULEHUB_MIN_PROTECTED_RESERVE_TON,
            reserve_buffer_numerator: CAPSULEHUB_STORAGE_RESERVE_BUFFER_NUMERATOR,
            reserve_buffer_denominator: CAPSULEHUB_STORAGE_RESERVE_BUFFER_DENOMINATOR
        };
    }

    receive() {
        throw(13999);
    }
}
