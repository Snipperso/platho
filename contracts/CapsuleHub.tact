// Platho v1 CapsuleHub milestone 1 implementation.
// Scope: direct publish, sequential entry ids, entry uid metadata, page storage accounting,
// fee accrual, amount-based fee flush with bounce recovery.
// Vault publish paths with ACK/excess are implemented in milestone 2; full Vault contract is not implemented here.

const PLATO_PRIVATE_STANDARD_FEE_TON: Int = 5000000;
const PLATO_PRIVATE_LONG_TERM_FEE_TON: Int = 10000000;
const PLATO_PUBLIC_POST_FEE_TON: Int = 5000000;

const SIZE_CLASS_STANDARD: Int = 1;
const SIZE_CLASS_LONG_TERM: Int = 2;
const CRYPTO_SUITE_CLASSICAL: Int = 1;
const CRYPTO_SUITE_HYBRID: Int = 2;

const CAPSULEHUB_PAGE_SIZE: Int = 256;

const CAPSULEHUB_PRIVATE_STANDARD_EXEC_RESERVE: Int = 3000000;
const CAPSULEHUB_PRIVATE_LONG_TERM_EXEC_RESERVE: Int = 4000000;
const CAPSULEHUB_PUBLIC_EXEC_RESERVE: Int = 3000000;
const CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE: Int = 1000000;
const CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT: Int = 4000000;
const CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT: Int = 3000000;
const CAPSULEHUB_PAGE_STORAGE_ENDOWMENT: Int = 10000000;
const CAPSULEHUB_ACK_FORWARD_RESERVE: Int = 30000000;
const CAPSULEHUB_FLUSH_LOCAL_EXEC_RESERVE: Int = 2000000;
const CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE: Int = 2000000;
const CAPSULEHUB_MIN_FEE_FLUSH_TON: Int = PLATO_PUBLIC_POST_FEE_TON;
const OP_BIND_DEPLOYMENT_MANIFEST: Int = 0x90E2E0CB;
const OP_SEAL_GENESIS: Int = 0x3A12D1AD;


const ENTRY_UID_DOMAIN_DIRECT_PRIVATE: Int = 0xD1190101;
const ENTRY_UID_DOMAIN_DIRECT_PUBLIC: Int = 0xD1190102;
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

message(0x7A0EBFEF) PublishPrivateDirect {
    size_class: Int as uint8;
    crypto_suite: Int as uint8;
    header_0_hash: Int as uint256;
    header_1_hash: Int as uint256;
    body_hash: Int as uint256;
    protocol_fee_paid: Int as uint128;
}

message(0xDD65EEF9) PublishPublicDirect {
    marketing_note: Int as uint152;
    author_wallet: Address;
    body_hash: Int as uint256;
    protocol_fee_paid: Int as uint128;
}

message(0xA4F862C0) PublishPrivateFromVault {
    bounce_id: Int as uint64;
    publish_id: Int as uint256;
    size_class: Int as uint8;
    crypto_suite: Int as uint8;
    header_0_hash: Int as uint256;
    header_1_hash: Int as uint256;
    body_hash: Int as uint256;
    protocol_fee_paid: Int as uint128;
}

message(0x8C2A76B7) PublishPublicFromVault {
    bounce_id: Int as uint64;
    publish_id: Int as uint256;
    marketing_note: Int as uint152;
    author_wallet: Address;
    body_hash: Int as uint256;
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
    private_page_count: Int;
    public_page_count: Int;
    private_entry_count: Int;
    public_entry_count: Int;
    last_private_entry_id: Int;
    last_public_entry_id: Int;
    last_private_entry_uid: Int;
    last_public_entry_uid: Int;
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
    private_page_count: Int as uint64;
    public_page_count: Int as uint64;
    private_entry_count: Int as uint64;
    public_entry_count: Int as uint64;
    last_private_entry_id: Int as uint64;
    last_public_entry_id: Int as uint64;
    last_private_entry_uid: Int as uint256;
    last_public_entry_uid: Int as uint256;

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
        self.private_page_count = 0;
        self.public_page_count = 0;
        self.private_entry_count = 0;
        self.public_entry_count = 0;
        self.last_private_entry_id = 0;
        self.last_public_entry_id = 0;
        self.last_private_entry_uid = 0;
        self.last_public_entry_uid = 0;
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

    fun needsNewPage(entryId: Int): Bool {
        return (entryId % CAPSULEHUB_PAGE_SIZE) == 0;
    }

    fun computePrivateEntryUid(entryId: Int, header0: Int, header1: Int, bodyHash: Int): Int {
        let hashFields: Cell = beginCell()
            .storeUint(header0, 256)
            .storeUint(header1, 256)
            .storeUint(bodyHash, 256)
            .endCell();
        return beginCell()
            .storeUint(ENTRY_UID_DOMAIN_DIRECT_PRIVATE, 32)
            .storeAddress(sender())
            .storeUint(entryId, 64)
            .storeUint(now(), 32)
            .storeRef(hashFields)
            .endCell()
            .hash();
    }

    fun computePublicEntryUid(entryId: Int, author: Address, bodyHash: Int): Int {
        return beginCell()
            .storeUint(ENTRY_UID_DOMAIN_DIRECT_PUBLIC, 32)
            .storeAddress(sender())
            .storeUint(entryId, 64)
            .storeUint(now(), 32)
            .storeAddress(author)
            .storeUint(bodyHash, 256)
            .endCell()
            .hash();
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

    fun computeVaultPublicEntryUid(entryId: Int, publishId: Int, author: Address, bodyHash: Int): Int {
        let payloadFields: Cell = beginCell()
            .storeAddress(author)
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

    receive(msg: PublishPrivateDirect) {
        self.requireSealed();
        throwUnless(13000, self.private_latest_id < 18446744073709551615);
        throwUnless(13001, self.isAllowedPrivatePair(msg.size_class, msg.crypto_suite));
        throwUnless(13002, msg.header_0_hash != 0);
        throwUnless(13003, msg.header_1_hash != 0);
        throwUnless(13004, msg.body_hash != 0);

        let fee: Int = self.privateFullFee(msg.size_class);
        throwUnless(13005, fee > 0);
        throwUnless(13006, msg.protocol_fee_paid == fee);

        let entryId: Int = self.private_latest_id;
        let pageCharge: Int = 0;
        if (self.needsNewPage(entryId)) {
            pageCharge = CAPSULEHUB_PAGE_STORAGE_ENDOWMENT;
        }

        let required: Int = fee + self.privateExecReserve(msg.size_class) + CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE + CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT + pageCharge;
        throwUnless(13007, context().value == required);

        let uid: Int = self.computePrivateEntryUid(entryId, msg.header_0_hash, msg.header_1_hash, msg.body_hash);

        self.last_private_entry_id = entryId;
        self.last_private_entry_uid = uid;
        self.private_entry_count += 1;
        if (pageCharge > 0) {
            self.private_page_count += 1;
        }
        self.private_latest_id += 1;
        self.accrued_plato_fee_ton += msg.protocol_fee_paid;
    }

    receive(msg: PublishPublicDirect) {
        self.requireSealed();
        throwUnless(13100, self.public_latest_id < 18446744073709551615);
        throwUnless(13101, sender() == msg.author_wallet);
        throwUnless(13105, msg.marketing_note == PLATHO_PUBLIC_MARKETING_NOTE_ASCII);
        throwUnless(13102, msg.body_hash != 0);
        throwUnless(13103, msg.protocol_fee_paid == PLATO_PUBLIC_POST_FEE_TON);

        let entryId: Int = self.public_latest_id;
        let pageCharge: Int = 0;
        if (self.needsNewPage(entryId)) {
            pageCharge = CAPSULEHUB_PAGE_STORAGE_ENDOWMENT;
        }

        let required: Int = PLATO_PUBLIC_POST_FEE_TON + CAPSULEHUB_PUBLIC_EXEC_RESERVE + CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE + CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT + pageCharge;
        throwUnless(13104, context().value == required);

        let uid: Int = self.computePublicEntryUid(entryId, msg.author_wallet, msg.body_hash);

        self.last_public_entry_id = entryId;
        self.last_public_entry_uid = uid;
        self.public_entry_count += 1;
        if (pageCharge > 0) {
            self.public_page_count += 1;
        }
        self.public_latest_id += 1;
        self.accrued_plato_fee_ton += msg.protocol_fee_paid;
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

        let fullFee: Int = self.privateFullFee(msg.size_class);
        throwUnless(13307, fullFee > 0);
        throwUnless(13308, msg.protocol_fee_paid >= 0);
        throwUnless(13309, msg.protocol_fee_paid <= fullFee);

        let entryId: Int = self.private_latest_id;
        let pageCharge: Int = 0;
        if (self.needsNewPage(entryId)) {
            pageCharge = CAPSULEHUB_PAGE_STORAGE_ENDOWMENT;
        }

        let required: Int = msg.protocol_fee_paid + self.privateExecReserve(msg.size_class) + CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE + CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT + pageCharge + CAPSULEHUB_ACK_FORWARD_RESERVE;
        throwUnless(13310, context().value >= required);

        let uid: Int = self.computeVaultPrivateEntryUid(entryId, msg.publish_id, msg.header_0_hash, msg.header_1_hash, msg.body_hash);

        self.last_private_entry_id = entryId;
        self.last_private_entry_uid = uid;
        self.private_entry_count += 1;
        if (pageCharge > 0) {
            self.private_page_count += 1;
        }
        self.private_latest_id += 1;
        self.accrued_plato_fee_ton += msg.protocol_fee_paid;

        message(MessageParameters {
            to: self.vault_address,
            value: context().value - (required - CAPSULEHUB_ACK_FORWARD_RESERVE),
            bounce: false,
            mode: SendDefaultMode,
            body: CapsuleHubPublishAck { publish_id: msg.publish_id, entry_id: entryId, entry_uid: uid }.toCell()
        });
    }

    receive(msg: PublishPublicFromVault) {
        self.requireSealed();
        throwUnless(13400, sender() == self.vault_address);
        throwUnless(13401, self.public_latest_id < 18446744073709551615);
        throwUnless(13402, msg.publish_id != 0);
        throwUnless(13407, msg.marketing_note == PLATHO_PUBLIC_MARKETING_NOTE_ASCII);
        throwUnless(13403, msg.body_hash != 0);
        throwUnless(13404, msg.protocol_fee_paid >= 0);
        throwUnless(13405, msg.protocol_fee_paid <= PLATO_PUBLIC_POST_FEE_TON);

        let entryId: Int = self.public_latest_id;
        let pageCharge: Int = 0;
        if (self.needsNewPage(entryId)) {
            pageCharge = CAPSULEHUB_PAGE_STORAGE_ENDOWMENT;
        }

        let required: Int = msg.protocol_fee_paid + CAPSULEHUB_PUBLIC_EXEC_RESERVE + CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE + CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT + pageCharge + CAPSULEHUB_ACK_FORWARD_RESERVE;
        throwUnless(13406, context().value >= required);

        let uid: Int = self.computeVaultPublicEntryUid(entryId, msg.publish_id, msg.author_wallet, msg.body_hash);

        self.last_public_entry_id = entryId;
        self.last_public_entry_uid = uid;
        self.public_entry_count += 1;
        if (pageCharge > 0) {
            self.public_page_count += 1;
        }
        self.public_latest_id += 1;
        self.accrued_plato_fee_ton += msg.protocol_fee_paid;

        message(MessageParameters {
            to: self.vault_address,
            value: context().value - (required - CAPSULEHUB_ACK_FORWARD_RESERVE),
            bounce: false,
            mode: SendDefaultMode,
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
            genesis_controller_address: self.genesis_controller_address,
            private_page_count: self.private_page_count,
            public_page_count: self.public_page_count,
            private_entry_count: self.private_entry_count,
            public_entry_count: self.public_entry_count,
            last_private_entry_id: self.last_private_entry_id,
            last_public_entry_id: self.last_public_entry_id,
            last_private_entry_uid: self.last_private_entry_uid,
            last_public_entry_uid: self.last_public_entry_uid
        };
    }

    receive() {
        throw(13999);
    }
}
