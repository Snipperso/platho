// Platho v1 CapsuleHub.
// Stores private encrypted capsule cells and public raw post cells on-chain.

const PLATO_PRIVATE_STANDARD_FEE_TON: Int = 5000000;
const PLATO_PRIVATE_LONG_TERM_FEE_TON: Int = 10000000;
const PLATO_PUBLIC_POST_FEE_TON: Int = 5000000;

const SIZE_CLASS_STANDARD: Int = 1;
const SIZE_CLASS_LONG_TERM: Int = 2;
const CRYPTO_SUITE_CLASSICAL: Int = 1;
const CRYPTO_SUITE_HYBRID: Int = 2;

const CAPSULEHUB_PRIVATE_STANDARD_EXEC_RESERVE: Int = 3000000;
const CAPSULEHUB_PRIVATE_LONG_TERM_EXEC_RESERVE: Int = 4000000;
const CAPSULEHUB_PUBLIC_EXEC_RESERVE: Int = 3000000;
const CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE: Int = 1000000;
const CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT: Int = 4000000;
const CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT: Int = 1000000;
const CAPSULEHUB_ACK_FORWARD_RESERVE: Int = 30000000;
const CAPSULEHUB_FLUSH_LOCAL_EXEC_RESERVE: Int = 2000000;
const CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE: Int = 2000000;
const CAPSULEHUB_MIN_FEE_FLUSH_TON: Int = PLATO_PUBLIC_POST_FEE_TON;
const CAPSULEHUB_PRIVATE_HEADER0_BITS: Int = 1120; // 140 bytes
const CAPSULEHUB_PRIVATE_HEADER1_BITS: Int = 240; // 30 bytes
const CAPSULEHUB_PRIVATE_HEADER0_CELLS: Int = 2;
const CAPSULEHUB_PRIVATE_HEADER0_REFS: Int = 1;
const CAPSULEHUB_PRIVATE_HEADER1_CELLS: Int = 1;
const CAPSULEHUB_PRIVATE_HEADER1_REFS: Int = 0;
const CAPSULEHUB_PRIVATE_STANDARD_BODY_BITS: Int = 9120; // 1140 bytes
const CAPSULEHUB_PRIVATE_LONG_TERM_BODY_BITS: Int = 17824; // 2228 bytes
const CAPSULEHUB_PRIVATE_STANDARD_BODY_CELLS: Int = 9;
const CAPSULEHUB_PRIVATE_LONG_TERM_BODY_CELLS: Int = 18;
const CAPSULEHUB_PRIVATE_STANDARD_BODY_REFS: Int = 8;
const CAPSULEHUB_PRIVATE_LONG_TERM_BODY_REFS: Int = 17;
const CAPSULEHUB_PUBLIC_HEADER_MAX_BITS: Int = 576; // 72 bytes
const CAPSULEHUB_PUBLIC_HEADER_MAX_CELLS: Int = 1;
const CAPSULEHUB_PUBLIC_HEADER_MAX_REFS: Int = 0;
const CAPSULEHUB_PUBLIC_BODY_MAX_BITS: Int = 8192; // 1024 bytes
const CAPSULEHUB_PUBLIC_BODY_MAX_CELLS: Int = 9;
const CAPSULEHUB_PUBLIC_BODY_MAX_REFS: Int = 8;


const ENTRY_UID_DOMAIN_VAULT_PRIVATE: Int = 0xD1190201;
const ENTRY_UID_DOMAIN_VAULT_PUBLIC: Int = 0xD1190202;
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

message(0xFF775609) DepositProtocolFee {
    amount: Int as uint128;
}

struct CapsuleHubStateView {
    sealed: Bool;
    vault_bound: Bool;
    deployment_manifest_hash: Int;
    private_latest_id: Int;
    public_latest_id: Int;
    accrued_plato_fee_ton: Int;
    fee_accumulator_address: Address;
    vault_address: Address;
    genesis_controller_address: Address;
}

struct PrivateCapsuleEntry {
    entry_id: Int as uint64;
    entry_uid: Int as uint256;
    publish_id: Int as uint256;
    author_wallet: Address;
    size_class: Int as uint8;
    crypto_suite: Int as uint8;
    header_0_hash: Int as uint256;
    header_1_hash: Int as uint256;
    body_hash: Int as uint256;
    header_0: Cell;
    header_1: Cell;
    body: Cell;
    created_at: Int as uint32;
}

struct PublicCapsuleEntry {
    entry_id: Int as uint64;
    entry_uid: Int as uint256;
    publish_id: Int as uint256;
    author_wallet: Address;
    header_hash: Int as uint256;
    body_hash: Int as uint256;
    header: Cell;
    body: Cell;
    created_at: Int as uint32;
}

struct PrivateCapsuleEntryView {
    exists: Bool;
    entry_id: Int;
    entry_uid: Int;
    publish_id: Int;
    author_wallet: Address;
    size_class: Int;
    crypto_suite: Int;
    header_0_hash: Int;
    header_1_hash: Int;
    body_hash: Int;
    header_0: Cell;
    header_1: Cell;
    body: Cell;
    created_at: Int;
}

struct PublicCapsuleEntryView {
    exists: Bool;
    entry_id: Int;
    entry_uid: Int;
    publish_id: Int;
    author_wallet: Address;
    header_hash: Int;
    body_hash: Int;
    header: Cell;
    body: Cell;
    created_at: Int;
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
    accrued_plato_fee_ton: Int as uint128;
    private_entries: map<Int, PrivateCapsuleEntry>;
    public_entries: map<Int, PublicCapsuleEntry>;

    init(fee_accumulator_address: Address, vault_address: Address, vault_bound: Bool, sealed: Bool, deployment_manifest_hash: Int, genesis_controller_address: Address) {
        self.fee_accumulator_address = fee_accumulator_address;
        self.vault_address = vault_address;
        self.vault_bound = vault_bound;
        self.sealed = sealed;
        self.deployment_manifest_hash = deployment_manifest_hash;
        self.genesis_controller_address = genesis_controller_address;
        self.private_latest_id = 0;
        self.public_latest_id = 0;
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

    fun privateFullFee(sizeClass: Int): Int {
        if (sizeClass == SIZE_CLASS_STANDARD) {
            return PLATO_PRIVATE_STANDARD_FEE_TON;
        }
        if (sizeClass == SIZE_CLASS_LONG_TERM) {
            return PLATO_PRIVATE_LONG_TERM_FEE_TON;
        }
        return 0;
    }

    fun privateExecReserve(sizeClass: Int): Int {
        if (sizeClass == SIZE_CLASS_LONG_TERM) {
            return CAPSULEHUB_PRIVATE_LONG_TERM_EXEC_RESERVE;
        }
        return CAPSULEHUB_PRIVATE_STANDARD_EXEC_RESERVE;
    }

    fun isAllowedPrivatePair(sizeClass: Int, cryptoSuite: Int): Bool {
        if (sizeClass == SIZE_CLASS_STANDARD && cryptoSuite == CRYPTO_SUITE_CLASSICAL) {
            return true;
        }
        if (sizeClass == SIZE_CLASS_LONG_TERM && cryptoSuite == CRYPTO_SUITE_HYBRID) {
            return true;
        }
        return false;
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

    fun privateBodyBits(sizeClass: Int): Int {
        if (sizeClass == SIZE_CLASS_LONG_TERM) {
            return CAPSULEHUB_PRIVATE_LONG_TERM_BODY_BITS;
        }
        return CAPSULEHUB_PRIVATE_STANDARD_BODY_BITS;
    }

    fun privateBodyCells(sizeClass: Int): Int {
        if (sizeClass == SIZE_CLASS_LONG_TERM) {
            return CAPSULEHUB_PRIVATE_LONG_TERM_BODY_CELLS;
        }
        return CAPSULEHUB_PRIVATE_STANDARD_BODY_CELLS;
    }

    fun privateBodyRefs(sizeClass: Int): Int {
        if (sizeClass == SIZE_CLASS_LONG_TERM) {
            return CAPSULEHUB_PRIVATE_LONG_TERM_BODY_REFS;
        }
        return CAPSULEHUB_PRIVATE_STANDARD_BODY_REFS;
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
        self.requireExactPayloadCell(msg.body, msg.body_hash, self.privateBodyCells(msg.size_class), self.privateBodyBits(msg.size_class), self.privateBodyRefs(msg.size_class), 13315, 13316);

        let fullFee: Int = self.privateFullFee(msg.size_class);
        throwUnless(13307, fullFee > 0);
        throwUnless(13308, msg.protocol_fee_paid >= 0);
        throwUnless(13309, msg.protocol_fee_paid <= fullFee);

        let entryId: Int = self.private_latest_id;
        let required: Int = msg.protocol_fee_paid + self.privateExecReserve(msg.size_class) + CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE + CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT + CAPSULEHUB_ACK_FORWARD_RESERVE;
        throwUnless(13310, context().value >= required);

        let uid: Int = self.computeVaultPrivateEntryUid(entryId, msg.publish_id, msg.header_0_hash, msg.header_1_hash, msg.body_hash);
        self.private_entries.set(entryId, PrivateCapsuleEntry {
            entry_id: entryId,
            entry_uid: uid,
            publish_id: msg.publish_id,
            author_wallet: self.vault_address,
            size_class: msg.size_class,
            crypto_suite: msg.crypto_suite,
            header_0_hash: msg.header_0_hash,
            header_1_hash: msg.header_1_hash,
            body_hash: msg.body_hash,
            header_0: msg.header_0,
            header_1: msg.header_1,
            body: msg.body,
            created_at: now()
        });

        self.private_latest_id += 1;
        self.accrued_plato_fee_ton += msg.protocol_fee_paid;

        message(MessageParameters {
            to: self.vault_address,
            value: CAPSULEHUB_ACK_FORWARD_RESERVE,
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

        let uid: Int = self.computeVaultPublicEntryUid(entryId, msg.publish_id, msg.author_wallet, msg.header_hash, msg.body_hash);
        self.public_entries.set(entryId, PublicCapsuleEntry {
            entry_id: entryId,
            entry_uid: uid,
            publish_id: msg.publish_id,
            author_wallet: msg.author_wallet,
            header_hash: msg.header_hash,
            body_hash: msg.body_hash,
            header: msg.header,
            body: msg.body,
            created_at: now()
        });

        self.public_latest_id += 1;
        self.accrued_plato_fee_ton += msg.protocol_fee_paid;

        message(MessageParameters {
            to: self.vault_address,
            value: CAPSULEHUB_ACK_FORWARD_RESERVE,
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

    get fun get_private_entry(entryId: Int): PrivateCapsuleEntryView {
        let entryOpt: PrivateCapsuleEntry? = self.private_entries.get(entryId);
        if (entryOpt == null) {
            return PrivateCapsuleEntryView {
                exists: false,
                entry_id: entryId,
                entry_uid: 0,
                publish_id: 0,
                author_wallet: myAddress(),
                size_class: 0,
                crypto_suite: 0,
                header_0_hash: 0,
                header_1_hash: 0,
                body_hash: 0,
                header_0: emptyCell(),
                header_1: emptyCell(),
                body: emptyCell(),
                created_at: 0
            };
        }
        let entry: PrivateCapsuleEntry = entryOpt!!;
        return PrivateCapsuleEntryView {
            exists: true,
            entry_id: entry.entry_id,
            entry_uid: entry.entry_uid,
            publish_id: entry.publish_id,
            author_wallet: entry.author_wallet,
            size_class: entry.size_class,
            crypto_suite: entry.crypto_suite,
            header_0_hash: entry.header_0_hash,
            header_1_hash: entry.header_1_hash,
            body_hash: entry.body_hash,
            header_0: entry.header_0,
            header_1: entry.header_1,
            body: entry.body,
            created_at: entry.created_at
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
                header_hash: 0,
                body_hash: 0,
                header: emptyCell(),
                body: emptyCell(),
                created_at: 0
            };
        }
        let entry: PublicCapsuleEntry = entryOpt!!;
        return PublicCapsuleEntryView {
            exists: true,
            entry_id: entry.entry_id,
            entry_uid: entry.entry_uid,
            publish_id: entry.publish_id,
            author_wallet: entry.author_wallet,
            header_hash: entry.header_hash,
            body_hash: entry.body_hash,
            header: entry.header,
            body: entry.body,
            created_at: entry.created_at
        };
    }

    get fun get_state(): CapsuleHubStateView {
        return CapsuleHubStateView {
            sealed: self.sealed,
            vault_bound: self.vault_bound,
            deployment_manifest_hash: self.deployment_manifest_hash,
            private_latest_id: self.private_latest_id,
            public_latest_id: self.public_latest_id,
            accrued_plato_fee_ton: self.accrued_plato_fee_ton,
            fee_accumulator_address: self.fee_accumulator_address,
            vault_address: self.vault_address,
            genesis_controller_address: self.genesis_controller_address
        };
    }

    receive() {
        throw(13999);
    }
}
