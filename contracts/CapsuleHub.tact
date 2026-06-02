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
const SIZE_CLASS_STANDARD: Int = SIZE_CLASS_1K;
const CRYPTO_SUITE_HYBRID: Int = 2;

const CAPSULEHUB_INDEX_STORAGE_YEARS: Int = 1;
const CAPSULEHUB_INDEX_RETENTION_SECONDS: Int = 31536000;
const CAPSULEHUB_PAGE_SIZE: Int = 256;
const CAPSULEHUB_PRIVATE_HYBRID_1K_EXEC_RESERVE: Int = 4200000;
const CAPSULEHUB_PRIVATE_HYBRID_2K_EXEC_RESERVE: Int = 4300000;
const CAPSULEHUB_PRIVATE_HYBRID_4K_EXEC_RESERVE: Int = 4500000;
const CAPSULEHUB_PRIVATE_HYBRID_8K_EXEC_RESERVE: Int = 5000000;
const CAPSULEHUB_PRIVATE_HYBRID_16K_EXEC_RESERVE: Int = 5800000;
const CAPSULEHUB_PRIVATE_HYBRID_32K_EXEC_RESERVE: Int = 7600000;
const CAPSULEHUB_PUBLIC_EXEC_RESERVE: Int = 2400000;
const CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE: Int = 1000000;
const CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT: Int = 3300000;
const CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT: Int = 7400000;
const CAPSULEHUB_ACK_FORWARD_RESERVE: Int = 30000000;
const CAPSULEHUB_FLUSH_LOCAL_EXEC_RESERVE: Int = 2000000;
const CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE: Int = 2000000;
const CAPSULEHUB_MIN_FEE_FLUSH_TON: Int = PLATO_PUBLIC_POST_FEE_TON;
const CAPSULEHUB_MIN_PROTECTED_RESERVE_TON: Int = 100000000000; // 100 TON
const CAPSULEHUB_STORAGE_RESERVE_BUFFER_NUMERATOR: Int = 125;
const CAPSULEHUB_STORAGE_RESERVE_BUFFER_DENOMINATOR: Int = 100;
const CAPSULEHUB_SWEEP_LOCAL_EXEC_RESERVE: Int = 2000000;
const CAPSULEHUB_MIN_RESERVE_SWEEP_TON: Int = PLATO_PUBLIC_POST_FEE_TON;
const CAPSULEHUB_PRUNE_ENTRY_EXEC_RESERVE: Int = 2000000;
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
const CAPSULEHUB_PUBLIC_BODY_MAX_BITS: Int = 8192; // 1024 bytes
const CAPSULEHUB_PUBLIC_BODY_MAX_CELLS: Int = 9;
const CAPSULEHUB_PUBLIC_BODY_MAX_REFS: Int = 8;


const ENTRY_UID_DOMAIN_VAULT_PRIVATE: Int = 0xD1190201;
const ENTRY_UID_DOMAIN_VAULT_PUBLIC: Int = 0xD1190202;
const CAPSULEHUB_ENTRY_KIND_PRIVATE: Int = 1;
const CAPSULEHUB_ENTRY_KIND_PUBLIC: Int = 2;
const PLATHO_PUBLIC_MARKETING_NOTE_ASCII: Int = 0x73656e742076696120506c6174686f2e417070; // "sent via Platho.App"

message(0x90E2E0CB) BindDeploymentManifest {
    deployment_manifest_hash: Int as uint256;
    counterpart_address: Address;
}

message(0x3A12D1AD) SealGenesis {
    deployment_manifest_hash: Int as uint256;
}

message(0xA4F862C0) PublishPrivateFromVault {
    bounce_id: Int as uint64;
    bounce_tag: Int as uint160;
    publish_id: Int as uint256;
    size_class: Int as uint8;
    crypto_suite: Int as uint8;
    header_0_hash: Int as uint256;
    header_1_hash: Int as uint256;
    body_hash: Int as uint256;
    header_0: Cell;
    header_1: Cell;
    body: Cell;
    protocol_fee_paid: Int as uint128;
}

message(0x8C2A76B7) PublishPublicFromVault {
    bounce_id: Int as uint64;
    bounce_tag: Int as uint160;
    publish_id: Int as uint256;
    marketing_note: Int as uint152;
    author_wallet: Address;
    header_hash: Int as uint256;
    body_hash: Int as uint256;
    header: Cell;
    body: Cell;
    protocol_fee_paid: Int as uint128;
}

message(0x874E576A) CapsuleHubPublishAck {
    publish_id: Int as uint256;
    entry_id: Int as uint64;
    entry_uid: Int as uint256;
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

message(0x4350524E) PruneCapsuleEntry {
    kind: Int as uint8;
    entry_id: Int as uint64;
    publish_id: Int as uint256;
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
    created_at: Int as uint32;
    body_hash: Int as uint256;
    header_0: Cell;
    header_1: Cell;
}

struct PublicCapsuleEntry {
    publish_id: Int as uint256;
    created_at: Int as uint32;
    author_wallet: Address;
    body_hash: Int as uint256;
    header: Cell;
}

struct PrivateCapsuleEntryView {
    exists: Bool;
    entry_id: Int;
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
    header: Cell;
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

    fun privateFullFee(cryptoSuite: Int): Int {
        if (cryptoSuite == CRYPTO_SUITE_HYBRID) {
            return PLATO_PRIVATE_LONG_TERM_FEE_TON;
        }
        return 0;
    }

    fun privateExecReserve(sizeClass: Int, cryptoSuite: Int): Int {
        throwUnless(12939, self.isAllowedPrivateSizeClass(sizeClass));
        throwUnless(12940, cryptoSuite == CRYPTO_SUITE_HYBRID);
        if (sizeClass == SIZE_CLASS_1K) { return CAPSULEHUB_PRIVATE_HYBRID_1K_EXEC_RESERVE; }
        if (sizeClass == SIZE_CLASS_2K) { return CAPSULEHUB_PRIVATE_HYBRID_2K_EXEC_RESERVE; }
        if (sizeClass == SIZE_CLASS_4K) { return CAPSULEHUB_PRIVATE_HYBRID_4K_EXEC_RESERVE; }
        if (sizeClass == SIZE_CLASS_8K) { return CAPSULEHUB_PRIVATE_HYBRID_8K_EXEC_RESERVE; }
        if (sizeClass == SIZE_CLASS_16K) { return CAPSULEHUB_PRIVATE_HYBRID_16K_EXEC_RESERVE; }
        return CAPSULEHUB_PRIVATE_HYBRID_32K_EXEC_RESERVE;
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

    fun requirePublicPayloadCell(cell: Cell, expectedHash: Int, hashExit: Int, sizeExit: Int) {
        throwUnless(hashExit, cell.hash() == expectedHash);
        try {
            let size: DataSize = cell.computeDataSize(CAPSULEHUB_PUBLIC_BODY_MAX_CELLS);
            throwUnless(sizeExit, size.cells <= CAPSULEHUB_PUBLIC_BODY_MAX_CELLS);
            throwUnless(sizeExit, size.bits > 0);
            throwUnless(sizeExit, size.bits <= CAPSULEHUB_PUBLIC_BODY_MAX_BITS);
            throwUnless(sizeExit, size.bits % 8 == 0);
            throwUnless(sizeExit, size.refs <= CAPSULEHUB_PUBLIC_BODY_MAX_REFS);
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

    fun needsNewPage(entryId: Int): Bool {
        return self.pageOffset(entryId) == 0;
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

    receive(msg: PublishPrivateFromVault) {
        self.requireSealed();
        throwUnless(13300, sender() == self.vault_address);
        throwUnless(13301, self.private_latest_id < 18446744073709551615);
        throwUnless(13302, msg.publish_id != 0);
        throwUnless(13303, self.isAllowedPrivatePair(msg.size_class, msg.crypto_suite));
        throwUnless(13304, msg.header_0_hash != 0);
        throwUnless(13305, msg.header_1_hash != 0);
        throwUnless(13306, msg.body_hash != 0);
        self.requireExactPayloadCell(msg.header_0, msg.header_0_hash, CAPSULEHUB_PRIVATE_HEADER0_CELLS, CAPSULEHUB_PRIVATE_HEADER0_BITS, CAPSULEHUB_PRIVATE_HEADER0_REFS, 13311, 13312);
        self.requireExactPayloadCell(msg.header_1, msg.header_1_hash, CAPSULEHUB_PRIVATE_HEADER1_CELLS, CAPSULEHUB_PRIVATE_HEADER1_BITS, CAPSULEHUB_PRIVATE_HEADER1_REFS, 13313, 13314);
        self.requireExactPayloadCell(msg.body, msg.body_hash, self.privateBodyCells(msg.size_class, msg.crypto_suite), self.privateBodyBits(msg.size_class, msg.crypto_suite), self.privateBodyRefs(msg.size_class, msg.crypto_suite), 13315, 13316);

        let fullFee: Int = self.privateFullFee(msg.crypto_suite);
        throwUnless(13307, fullFee > 0);
        throwUnless(13308, msg.protocol_fee_paid >= 0);
        throwUnless(13309, msg.protocol_fee_paid <= fullFee);

        let entryId: Int = self.private_latest_id;
        let required: Int = msg.protocol_fee_paid + self.privateExecReserve(msg.size_class, msg.crypto_suite) + CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE + CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT + CAPSULEHUB_ACK_FORWARD_RESERVE;
        throwUnless(13310, context().value >= required);
        let ackValue: Int = CAPSULEHUB_ACK_FORWARD_RESERVE;

        let uid: Int = self.computeVaultPrivateEntryUid(entryId, msg.publish_id, msg.header_0_hash, msg.header_1_hash, msg.body_hash);
        self.private_entries.set(entryId, PrivateCapsuleEntry {
            publish_id: msg.publish_id,
            created_at: now(),
            body_hash: msg.body_hash,
            header_0: msg.header_0,
            header_1: msg.header_1
        });

        self.private_latest_id += 1;
        self.private_live_count += 1;
        self.accrued_plato_fee_ton += msg.protocol_fee_paid;

        message(MessageParameters {
            to: self.vault_address,
            value: ackValue,
            bounce: false,
            mode: SendPayFwdFeesSeparately,
            body: CapsuleHubPublishAck { publish_id: msg.publish_id, entry_id: entryId, entry_uid: uid }.toCell()
        });
    }

    receive(msg: PublishPublicFromVault) {
        self.requireSealed();
        throwUnless(13400, sender() == self.vault_address);
        throwUnless(13401, self.public_latest_id < 18446744073709551615);
        throwUnless(13402, msg.publish_id != 0);
        throwUnless(13407, msg.marketing_note == PLATHO_PUBLIC_MARKETING_NOTE_ASCII);
        throwUnless(13410, msg.header_hash != 0);
        throwUnless(13403, msg.body_hash != 0);
        self.requirePublicHeaderCell(msg.header, msg.header_hash, 13411, 13412);
        self.requirePublicPayloadCell(msg.body, msg.body_hash, 13408, 13409);
        throwUnless(13404, msg.protocol_fee_paid >= 0);
        throwUnless(13405, msg.protocol_fee_paid <= PLATO_PUBLIC_POST_FEE_TON);

        let entryId: Int = self.public_latest_id;
        let required: Int = msg.protocol_fee_paid + CAPSULEHUB_PUBLIC_EXEC_RESERVE + CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE + CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT + CAPSULEHUB_ACK_FORWARD_RESERVE;
        throwUnless(13406, context().value >= required);
        let ackValue: Int = CAPSULEHUB_ACK_FORWARD_RESERVE;

        let uid: Int = self.computeVaultPublicEntryUid(entryId, msg.publish_id, msg.author_wallet, msg.header_hash, msg.body_hash);
        self.public_entries.set(entryId, PublicCapsuleEntry {
            publish_id: msg.publish_id,
            created_at: now(),
            author_wallet: msg.author_wallet,
            body_hash: msg.body_hash,
            header: msg.header
        });

        self.public_latest_id += 1;
        self.public_live_count += 1;
        self.accrued_plato_fee_ton += msg.protocol_fee_paid;

        message(MessageParameters {
            to: self.vault_address,
            value: ackValue,
            bounce: false,
            mode: SendPayFwdFeesSeparately,
            body: CapsuleHubPublishAck { publish_id: msg.publish_id, entry_id: entryId, entry_uid: uid }.toCell()
        });
    }

    receive(msg: FlushFees) {
        self.requireSealed();
        throwUnless(13200, msg.amount > 0);
        throwUnless(13201, msg.amount <= self.accrued_plato_fee_ton);
        throwUnless(13205, msg.amount >= CAPSULEHUB_MIN_FEE_FLUSH_TON || msg.amount == self.accrued_plato_fee_ton);
        throwUnless(13202, context().value >= CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE + CAPSULEHUB_FLUSH_LOCAL_EXEC_RESERVE);

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

    receive(msg: PruneCapsuleEntry) {
        self.requireSealed();
        throwUnless(13530, context().value >= CAPSULEHUB_PRUNE_ENTRY_EXEC_RESERVE);
        if (msg.kind == CAPSULEHUB_ENTRY_KIND_PRIVATE) {
            let entryOpt: PrivateCapsuleEntry? = self.private_entries.get(msg.entry_id);
            throwUnless(13500, entryOpt != null);
            let entry: PrivateCapsuleEntry = entryOpt!!;
            throwUnless(13501, entry.publish_id == msg.publish_id);
            throwUnless(13502, now() >= entry.created_at + CAPSULEHUB_INDEX_RETENTION_SECONDS);
            self.private_entries.del(msg.entry_id);
            self.private_live_count -= 1;
        } else {
            if (msg.kind == CAPSULEHUB_ENTRY_KIND_PUBLIC) {
                let entryOpt: PublicCapsuleEntry? = self.public_entries.get(msg.entry_id);
                throwUnless(13510, entryOpt != null);
                let entry: PublicCapsuleEntry = entryOpt!!;
                throwUnless(13511, entry.publish_id == msg.publish_id);
                throwUnless(13512, now() >= entry.created_at + CAPSULEHUB_INDEX_RETENTION_SECONDS);
                self.public_entries.del(msg.entry_id);
                self.public_live_count -= 1;
            } else {
                throw(13520);
            }
        }
    }

    get fun get_private_entry(entryId: Int): PrivateCapsuleEntryView {
        let entryOpt: PrivateCapsuleEntry? = self.private_entries.get(entryId);
        if (entryOpt == null) {
            return PrivateCapsuleEntryView {
                exists: false,
                entry_id: entryId,
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
