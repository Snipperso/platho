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
const CAPSULEHUB_PRIVATE_HEADER0_BITS: Int = 1120; // 140 bytes
const CAPSULEHUB_PRIVATE_HEADER1_BITS: Int = 240; // 30 bytes
const CAPSULEHUB_PRIVATE_HEADER0_CELLS: Int = 2;
const CAPSULEHUB_PRIVATE_HEADER0_REFS: Int = 1;
const CAPSULEHUB_PRIVATE_HEADER1_CELLS: Int = 1;
const CAPSULEHUB_PRIVATE_HEADER1_REFS: Int = 0;
const CAPSULEHUB_PRIVATE_HYBRID_BODY_OVERHEAD_BYTES: Int = 1204;
const CAPSULEHUB_PUBLIC_HEADER_MAX_BITS: Int = 576; // 72 bytes
const CAPSULEHUB_PUBLIC_HEADER_MAX_CELLS: Int = 1;
const CAPSULEHUB_PUBLIC_HEADER_MAX_REFS: Int = 0;


const ENTRY_UID_DOMAIN_VAULT_PRIVATE: Int = 0xD1190201;
const ENTRY_UID_DOMAIN_VAULT_PUBLIC: Int = 0xD1190202;
const CAPSULEHUB_ENTRY_KIND_PRIVATE: Int = 1;
const CAPSULEHUB_ENTRY_KIND_PUBLIC: Int = 2;

// --- VPB2 batch ingest (mirror the Vault's batch constants so the value model is consistent end-to-end;
// the Session-5 generator pins both sides from one source) ---
const MAX_BATCH_PARTS: Int = 8;
const HUB_BATCH_BASE_GAS: Int = 14000;
const HUB_PART_GAS_PRIVATE: Int = 170000; // add (2 index pushes + payload validation) + auto-evict one (2 index un-pushes + header parse + del); provisional, measured-tightened
const HUB_PART_GAS_PUBLIC: Int = 180000;  // add (1 index push + author-key hash) + auto-evict one (1 index un-push + del); provisional, measured-tightened
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
    sender_prev_link: Int as uint64;
    recipient_prev_link: Int as uint64;
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
    // parent chain for comments). Mirrors PrivateCapsuleEntry.recipient_prev_link.
    prev_link: Int as uint64;
    header: Cell;
}

struct PrivateCapsuleEntryView {
    exists: Bool;
    entry_id: Int;
    sender_prev_link: Int;
    recipient_prev_link: Int;
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

struct PrivateCapsuleKeyIndexView {
    exists: Bool;
    key_id: Int;
    latest_entry_id: Int;
    latest_entry_link: Int;
    entry_count: Int;
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
    private_sender_index: map<Int as uint256, PrivateCapsuleKeyIndex>;
    private_recipient_index: map<Int as uint256, PrivateCapsuleKeyIndex>;
    // Public read-side indexes (symmetric with the private sender/recipient indexes): posts indexed by
    // hashed author wallet, comments indexed by parent entry id. Each lets a client walk only the entries
    // it cares about (a subscribed author's posts, or one post's comments) without a global scan.
    public_author_index: map<Int as uint256, PublicCapsuleKeyIndex>;
    public_parent_index: map<Int as uint64, PublicCapsuleKeyIndex>;
    // FIFO eviction low-water marks: the lowest entry id NOT yet evicted (everything below is gone). Auto-eviction
    // in the publish path advances these, deleting oldest-first past the retention window. Strict FIFO = we only
    // ever delete a chain TAIL, so backward walks never hit a hole and entry_count stays exact.
    public_oldest_live_id: Int as uint64;
    private_oldest_live_id: Int as uint64;

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
        self.private_sender_index = emptyMap();
        self.private_recipient_index = emptyMap();
        self.public_author_index = emptyMap();
        self.public_parent_index = emptyMap();
        self.public_oldest_live_id = 0;
        self.private_oldest_live_id = 0;
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

    fun indexStorageReserve(): Int {
        let base: Int = (self.private_live_count * self.privateIndexStorageReservePerEntry()) + (self.public_live_count * self.publicIndexStorageReservePerEntry());
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

    fun privateHeaderSenderKeyId(header0: Cell): Int {
        let header: Slice = header0.beginParse();
        header.loadUint(64);
        return header.loadUint(256);
    }

    fun privateHeaderRecipientKeyId(header0: Cell): Int {
        let header: Slice = header0.beginParse();
        header.loadUint(64);
        header.loadUint(256);
        return header.loadUint(256);
    }

    fun pushPrivateSenderIndex(keyId: Int, entryLink: Int): Int {
        let indexOpt: PrivateCapsuleKeyIndex? = self.private_sender_index.get(keyId);
        let prevLink: Int = 0;
        let count: Int = 0;
        if (indexOpt != null) {
            let index: PrivateCapsuleKeyIndex = indexOpt!!;
            prevLink = index.latest_entry_link;
            count = index.entry_count;
        }
        self.private_sender_index.set(keyId, PrivateCapsuleKeyIndex {
            latest_entry_link: entryLink,
            entry_count: count + 1
        });
        return prevLink;
    }

    fun pushPrivateRecipientIndex(keyId: Int, entryLink: Int): Int {
        let indexOpt: PrivateCapsuleKeyIndex? = self.private_recipient_index.get(keyId);
        let prevLink: Int = 0;
        let count: Int = 0;
        if (indexOpt != null) {
            let index: PrivateCapsuleKeyIndex = indexOpt!!;
            prevLink = index.latest_entry_link;
            count = index.entry_count;
        }
        self.private_recipient_index.set(keyId, PrivateCapsuleKeyIndex {
            latest_entry_link: entryLink,
            entry_count: count + 1
        });
        return prevLink;
    }

    fun prunePrivateSenderIndex(keyId: Int, entryLink: Int, prevLink: Int) {
        // Private key indexes are retained-history hints. Pruning an expired middle entry can truncate older expired tail traversal; archive recovery should use page/body-history scans.
        let indexOpt: PrivateCapsuleKeyIndex? = self.private_sender_index.get(keyId);
        if (indexOpt != null) {
            let index: PrivateCapsuleKeyIndex = indexOpt!!;
            if (index.latest_entry_link == entryLink) {
                index.latest_entry_link = prevLink;
            }
            if (index.entry_count > 0) {
                index.entry_count -= 1;
            }
            if (index.entry_count == 0) {
                self.private_sender_index.del(keyId);
            } else {
                self.private_sender_index.set(keyId, index);
            }
        }
    }

    fun prunePrivateRecipientIndex(keyId: Int, entryLink: Int, prevLink: Int) {
        // Same retained-history contract as sender index: do not spend gas rewiring middle links beyond the pruned expired entry.
        let indexOpt: PrivateCapsuleKeyIndex? = self.private_recipient_index.get(keyId);
        if (indexOpt != null) {
            let index: PrivateCapsuleKeyIndex = indexOpt!!;
            if (index.latest_entry_link == entryLink) {
                index.latest_entry_link = prevLink;
            }
            if (index.entry_count > 0) {
                index.entry_count -= 1;
            }
            if (index.entry_count == 0) {
                self.private_recipient_index.del(keyId);
            } else {
                self.private_recipient_index.set(keyId, index);
            }
        }
    }

    // Public author key id: hash of the standard-address serialization of the author wallet. The client
    // derives the identical key with beginCell().storeAddress(addr).endCell().hash(). Workchain-agnostic.
    fun publicAuthorKeyId(authorWallet: Address): Int {
        return beginCell().storeAddress(authorWallet).endCell().hash();
    }

    // Mirror of pushPrivateRecipientIndex for the public author index (posts).
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

    // Mirror of pushPrivateRecipientIndex for the public parent index (comments), keyed by parent entry id.
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

    // Mirror of prunePrivateRecipientIndex; same retained-history contract (middle links are not rewired).
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
                        self.prunePublicAuthorIndex(self.publicAuthorKeyId(entry.author_wallet), entryLink, entry.prev_link);
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

    // Auto-eviction (private): mirror of the public path; un-pushes BOTH the sender and recipient index of each
    // evicted entry (key ids parsed from header_0, exactly as the old prune path did).
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
                    self.prunePrivateSenderIndex(self.privateHeaderSenderKeyId(entry.header_0), entryLink, entry.sender_prev_link);
                    self.prunePrivateRecipientIndex(self.privateHeaderRecipientKeyId(entry.header_0), entryLink, entry.recipient_prev_link);
                    self.private_entries.del(oid);
                    self.private_live_count -= 1;
                    oid += 1;
                    evicted += 1;
                }
            }
        }
        self.private_oldest_live_id = oid;
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
        let endowment: Int = CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT;
        if (kind == CAPSULEHUB_ENTRY_KIND_PRIVATE) { endowment = CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT; }
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
        throwUnless(13502, (msg.publish_kind == CAPSULEHUB_ENTRY_KIND_PRIVATE) || (msg.publish_kind == CAPSULEHUB_ENTRY_KIND_PUBLIC));
        throwUnless(13503, (msg.part_count >= 1) && (msg.part_count <= MAX_BATCH_PARTS));
        let isPrivate: Bool = (msg.publish_kind == CAPSULEHUB_ENTRY_KIND_PRIVATE);

        let firstEntryId: Int = self.public_latest_id;
        let fullFeePerPart: Int = PLATO_PUBLIC_POST_FEE_TON;
        if (isPrivate) {
            firstEntryId = self.private_latest_id;
            fullFeePerPart = self.privateFullFee(CRYPTO_SUITE_HYBRID);
        }
        throwUnless(13504, firstEntryId + msg.part_count <= 18446744073709551615);
        throwUnless(13505, msg.protocol_fee_total >= 0);
        throwUnless(13506, msg.protocol_fee_total <= msg.part_count * fullFeePerPart);
        if (!isPrivate) {
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
        while (i < msg.part_count) {
            let isLast: Bool = (i == (msg.part_count - 1));
            let part: Slice = cursor.beginParse();
            let entryId: Int = firstEntryId + i;
            let entryPublishId: Int = self.computeEntryPublishId(msg.publish_id, i);
            let nextCell: Cell = msg.parts; // overwritten when not last; unused on the last iteration
            if (isPrivate) {
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
                self.requireExactPayloadCell(header0, h0, CAPSULEHUB_PRIVATE_HEADER0_CELLS, CAPSULEHUB_PRIVATE_HEADER0_BITS, CAPSULEHUB_PRIVATE_HEADER0_REFS, 13513, 13514);
                self.requireExactPayloadCell(header1, h1, CAPSULEHUB_PRIVATE_HEADER1_CELLS, CAPSULEHUB_PRIVATE_HEADER1_BITS, CAPSULEHUB_PRIVATE_HEADER1_REFS, 13515, 13516);
                self.requireExactPayloadCell(body, bh, self.privateBodyCells(sizeClass, cryptoSuite), self.privateBodyBits(sizeClass, cryptoSuite), self.privateBodyRefs(sizeClass, cryptoSuite), 13517, 13518);
                let entryLink: Int = self.entryLink(entryId);
                let senderPrevLink: Int = self.pushPrivateSenderIndex(self.privateHeaderSenderKeyId(header0), entryLink);
                let recipientPrevLink: Int = self.pushPrivateRecipientIndex(self.privateHeaderRecipientKeyId(header0), entryLink);
                let uid: Int = self.computeVaultPrivateEntryUid(entryId, entryPublishId, h0, h1, bh);
                self.private_entries.set(entryId, PrivateCapsuleEntry {
                    publish_id: entryPublishId,
                    created_at: now(),
                    body_hash: bh,
                    sender_prev_link: senderPrevLink,
                    recipient_prev_link: recipientPrevLink,
                    header_0: header0,
                    header_1: header1
                });
                self.private_live_count += 1;
                requiredValue += getComputeFee(HUB_PART_GAS_PRIVATE, false) + self.batchStorageReserveWithBuffer(CAPSULEHUB_ENTRY_KIND_PRIVATE);
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
                throwUnless(13521, reserved == 0);
                throwUnless(13522, self.isAllowedPublicSizeClass(sizeClass));
                throwUnless(13523, (h0 != 0) && (bh != 0));
                // parentLink == 0 -> post; else parentLink == parentEntryId+1 and the parent must strictly precede.
                // The parent is NOT required to still exist (it may have been evicted) nor to be a top-level post
                // (a comment may reply to a comment) — intentional: each entry is independently funded and the
                // thread is reassembled client-side. The only guard is that the parent id precedes this entry.
                throwUnless(13528, (parentLink == 0) || (parentLink <= entryId));
                self.requirePublicHeaderCell(header, h0, 13524, 13525);
                self.requirePublicPayloadCell(body, bh, sizeClass, 13526, 13527);
                let uid: Int = self.computeVaultPublicEntryUid(entryId, entryPublishId, msg.author_wallet, h0, bh);
                let publicPrevLink: Int = 0;
                if (parentLink == 0) {
                    publicPrevLink = self.pushPublicAuthorIndex(self.publicAuthorKeyId(msg.author_wallet), self.entryLink(entryId));
                } else {
                    publicPrevLink = self.pushPublicParentIndex(self.entryIdFromLink(parentLink), self.entryLink(entryId));
                }
                self.public_entries.set(entryId, PublicCapsuleEntry {
                    publish_id: entryPublishId,
                    created_at: now(),
                    author_wallet: msg.author_wallet,
                    body_hash: bh,
                    parent_link: parentLink,
                    prev_link: publicPrevLink,
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
        if (isPrivate) {
            self.private_latest_id += msg.part_count;
        } else {
            self.public_latest_id += msg.part_count;
        }
        self.accrued_plato_fee_ton += msg.protocol_fee_total;

        // Auto-eviction (FIFO, funded via HUB_PART_GAS_*): each batch evicts up to part_count oldest expired
        // entries of its own kind, bounding live state by construction. Just-added entries are created at now()
        // so they are never expired; the loop stops at the first non-expired entry.
        if (isPrivate) {
            self.evictExpiredPrivate(msg.part_count);
        } else {
            self.evictExpiredPublic(msg.part_count);
        }

        // ACK (spec 5.3): keep fee + entry storage (+1.25 buffer), protect pre-existing balance, return the rest
        // (import over-hold + ack float) to the Vault via mode 128. The Vault credits it back to the user ledger.
        let kept: Int = msg.protocol_fee_total + msg.part_count * self.batchStorageReserveWithBuffer(msg.publish_kind);
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

    get fun get_private_entry(entryId: Int): PrivateCapsuleEntryView {
        let entryOpt: PrivateCapsuleEntry? = self.private_entries.get(entryId);
        if (entryOpt == null) {
            return PrivateCapsuleEntryView {
                exists: false,
                entry_id: entryId,
                sender_prev_link: 0,
                recipient_prev_link: 0,
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
            sender_prev_link: entry.sender_prev_link,
            recipient_prev_link: entry.recipient_prev_link,
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

    get fun get_private_sender_index(keyId: Int): PrivateCapsuleKeyIndexView {
        let indexOpt: PrivateCapsuleKeyIndex? = self.private_sender_index.get(keyId);
        if (indexOpt == null) {
            return PrivateCapsuleKeyIndexView {
                exists: false,
                key_id: keyId,
                latest_entry_id: 0,
                latest_entry_link: 0,
                entry_count: 0
            };
        }
        let index: PrivateCapsuleKeyIndex = indexOpt!!;
        return PrivateCapsuleKeyIndexView {
            exists: true,
            key_id: keyId,
            latest_entry_id: self.entryIdFromLink(index.latest_entry_link),
            latest_entry_link: index.latest_entry_link,
            entry_count: index.entry_count
        };
    }

    get fun get_private_recipient_index(keyId: Int): PrivateCapsuleKeyIndexView {
        let indexOpt: PrivateCapsuleKeyIndex? = self.private_recipient_index.get(keyId);
        if (indexOpt == null) {
            return PrivateCapsuleKeyIndexView {
                exists: false,
                key_id: keyId,
                latest_entry_id: 0,
                latest_entry_link: 0,
                entry_count: 0
            };
        }
        let index: PrivateCapsuleKeyIndex = indexOpt!!;
        return PrivateCapsuleKeyIndexView {
            exists: true,
            key_id: keyId,
            latest_entry_id: self.entryIdFromLink(index.latest_entry_link),
            latest_entry_link: index.latest_entry_link,
            entry_count: index.entry_count
        };
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
