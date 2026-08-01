// Platho v1 UsernameRegistry implementation through M13.
// Scope: Vault-funded official ATH notification username mint, deterministic UsernameNFTItem deploy + ACK finalization,
// exact price tiers, raw lowercase ASCII username validation, bounce-safe treasury/burn due flushes, and stale pending mint check.
// No admin/owner override/pause/upgrade/governance/rescue/fallback behavior is implemented.
// No BuybackBurn route, adapter, migration, or compatibility path is implemented.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// 2026-07-20 — name_records DELETED. THE ITEM IS THE RECORD.
//
// This contract's last unbounded map is gone. It cost a MEASURED 3.00 cells per name and was never evicted,
// which was the whole of the ~21,500-name ceiling — a silent one, because exceeding the ~65536-cell account
// limit fails in the ACTION phase with code 50 while COMPUTE reports exit 0. Nothing would have gone red; names
// would simply have stopped being recorded. Everything else here is fixed-size or self-clearing, so with the map
// gone the registry has no ceiling at all.
//
// It was deleted rather than sharded because it held nothing of its own. NameRecord was
// { minter_wallet, item_address, registered_at }, and:
//   * item_address  is deriveItemAddress(name_hash) — a pure function anyone can recompute (UNI-02).
//   * minter_wallet is NOT the owner. The struct's own comment said so: a TEP-62 transfer moves the item's
//     owner_wallet and leaves the record naming the minter (UNI-03). Consumers resolving ownership through the
//     map were reading a stale answer, so removing it deletes a WRONG source, not a right one.
//   * registered_at was the only field nothing else held, and no consumer used it.
//
// UNIQUENESS DID NOT LIVE HERE EITHER, which is the part that had to be measured before cutting. The item
// refuses re-initialisation at its own gate 18011, and the mint attaches StateInit to every deploy: on an
// already-active account the StateInit is ignored but the BODY is still delivered, so the item's gate runs and
// the message BOUNCES — into the bounced<InitializeUsernameItem> handler that already existed, which refunds the
// buyer's ATH. Measured in tests/username-item-is-the-record.test.ts UNI-01. Had the message been swallowed
// instead, a duplicate mint would have taken payment and delivered nothing, and this deletion would be a hole.
// In-flight duplicates are still refused synchronously by pending_mints (19173), which is the map that DOES
// clear itself.
//
// A duplicate mint therefore costs one extra round trip and refunds, instead of being refused in COMPUTE. That
// is the entire behavioural change, and it buys a registry that cannot fill up.
//
// Retired gates, kept listed so a reader meeting them in an old client does not think they were lost:
//   19172 — mint-time "name already taken"; now the item's 18011 with a bounce+refund.
//   19135 — the same check repeated at ACK finalisation.
//   19304 — the same check inside PrunePendingUsernameMint, a receiver that throws 19307 unconditionally anyway.
// Retired getter: get_name_record. A client asks the CHAIN instead — derive the item address from the name and
// read the item, which is both authoritative for ownership and one RPC round trip cheaper than asking here first.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

import "./UsernameNFTItem.tact";
import "./ATHWallet.tact";

const USERNAME_PRICE_4_CHARS: Int = 10000000000000;      // 10,000 ATH atomic units
const USERNAME_PRICE_5_CHARS: Int = 1000000000000;       // 1,000 ATH atomic units
const USERNAME_PRICE_6_PLUS_CHARS: Int = 100000000000;   // 100 ATH atomic units
const USERNAME_PENDING_MINT_STORAGE_ENDOWMENT: Int = 6000000;
const USERNAME_STATE_GROWTH_EXEC_RESERVE: Int = 4000000;
// WAS the per-name record's rent; since 2026-07-20 it funds THIS CONTRACT'S OWN life, which is the larger bill.
//
// name_records is gone (see the note at the top of this file), so there is no per-name entry left to fund. The
// value and the floor are UNCHANGED on purpose: the mint price is an owner decision pinned client-side at exactly
// 1 TON, and lowering a floor here would not return a nanoton to the buyer — it would only stop accounting for
// where the money goes.
//
// What it genuinely pays for now is measured, and it is not small: this contract carries 501 CODE CELLS (the
// on-chain SVG art and metadata dominate it), against 149 for ProfileRegistry and 17-33 for every shard in the
// project. At the live 64,962 nanoton/cell-year that is ~32,500,000 a year for the code alone, so each mint's
// contribution buys roughly three years of collection life. That is a self-funding registry rather than one
// leaning on a genesis endowment — and it is the reason a "contract per name" built from THIS code would be
// unaffordable at 0.0326 GRAM/year per name, while deleting the map costs nothing.
//
// The rate itself: 64,962 per cell-year with BITS FREE since config-18 switched on 2026-04-29. The DEAD figure
// is 240,631 (the pre-switch 500/1 schedule, bits billed); this comment once asserted it in the present tense and
// called the live ~67k rounding "WRONG", which would have led a reader to "correct" ATHWallet and ProfileRegistry
// onto a dead rate, on immutable contracts. See [[ton-storage-rate-frozen]].
const USERNAME_REGISTRY_SELF_RENT_CONTRIBUTION: Int = 100000000;
const USERNAME_NFT_ITEM_DEPLOY_RESERVE: Int = 829000000; // clean-16 L2/#14 (owner: mint = EXACTLY 1 TON): sized so client usernameMintTonCharge = 1_000_000_000 exactly. ~412 yr at the REAL rate 64962/cell/yr for the ~31-cell item (the earlier 240,631-rate figures were the STALE pre-2026 config-18 — corrected 2026-07-15). Minter funds once; NFT lives centuries, forever when used. G8-provisional (finalize NFT cell count via computeDataSize). (A masterchain library code-cell would cut per-item rent ~7× — deferred, Фаза-5.)
// [COMMENT CORRECTED 2026-08-01] Was documented as sitting EXACTLY on the wallet's gate. It no longer does: gate
// 14204 is now built from ATH_OWNER_REQUEST_EXEC_RESERVE(2M) + ATH_INTERNAL_TRANSFER_ARRIVAL_MIN(29M) +
// ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE(8M) = 39,000,000, so this leg carries 9,000,000 of margin. The value is
// deliberately NOT trimmed to the new requirement — landing on a gate to the nanoton is what made the old wallet
// constants dangerous to touch, and this contract is immutable once sealed. Pinned by ATHLEG-01..03.
const USERNAME_ATH_TRANSFER_EXEC_RESERVE: Int = 48000000;
const USERNAME_ATH_BURN_EXEC_RESERVE: Int = 5000000;
const USERNAME_DUE_FLUSH_LOCAL_EXEC_RESERVE: Int = 2000000;
const USERNAME_PRUNE_PENDING_MINT_EXEC_RESERVE: Int = 2000000;
const USERNAME_ATH_NOTIFICATION_ACK_VALUE: Int = 1000000;
// [MEASURED 2026-07-20, raised 12M -> 45M] What a refund must carry to actually ARRIVE.
//
// CAUGHT BY A TEST THAT WAS KEPT RED RATHER THAN RELAXED. Deleting name_records moved the duplicate-mint refund
// onto a route it had never taken: gate 19172 used to refuse a duplicate in COMPUTE, so the ATH went home as a
// NOTIFICATION BOUNCE, riding SendRemainingValue out of the payer's 45M notify floor. Now the registry accepts,
// the item refuses at its own gate 18011, the bounce lands here, and this function mints a FRESH message — whose
// value is this constant alone.
//
// 12M sits squarely inside a window ATHWallet.tact already documents on ATH_TRANSFER_NOTIFY_MIN_VALUE: the
// recipient wallet gates an arriving transfer at 14212 (2M + 3M + 1M + 20M = 26M) while the sender-side gate
// 14335 demands only 12M. So the refund was SENT, arrived under-funded, threw 14212, and the buyer's ATH was
// stranded on the registry's official wallet — measured arrival 6,971,064 against the 26M needed.
//
// Sized at 45M to match ATH_TRANSFER_NOTIFY_MIN_VALUE, which was measured on the adjacent path this morning:
// arrival must clear 26M, the measured overhead on this hop is ~5M, so the floor is ~31M and 45M keeps the same
// margin as its sibling rather than inventing a second, thinner one. Unspent value returns as change.
// Pinned by VAULT-ATH-08 in tests/vault-ath-integration.test.ts, which asserts the BUYER's balance is restored —
// not merely that a refund was emitted.
const USERNAME_ATH_NOTIFICATION_REFUND_VALUE: Int = 45000000;
// [ADDED 2026-07-29, wave-8 MED] Dust floor for the TON leg of a bounced mint — below this a send costs more in fees
// than it delivers.
const USERNAME_TON_REFUND_MIN_VALUE: Int = 5000000;
const USERNAME_PENDING_MINT_STALE_TTL: Int = 86400; // 24 hours
const USERNAME_MAX_LENGTH: Int = 16;
const USERNAME_SPLIT_BASE_BPS: Int = 10000;
const USERNAME_TREASURY_SHARE_BPS: Int = 5000;
const USERNAME_NAME_HASH_DOMAIN: Int = 0xC5CC7CD6;
const USERNAME_COLLECTION_METADATA_KEY_NAME: Int = 0x82a3537ff0dbce7eec35d69edc3a189ee6f17d82f353a553f9aa96cb0be3ce89;
const USERNAME_COLLECTION_METADATA_KEY_IMAGE_DATA: Int = 0xd9a88ccec79eef59c84b671136a20ece4cd00caaad5bc47e2c208829154ee9e4;
// clean-11 collection-page metadata keys (sha256 of the TEP-64 key name). description+image match the mainnet-proven probe.
const USERNAME_COLLECTION_METADATA_KEY_DESCRIPTION: Int = 0xc9046f7a37ad0ea7cee73355984fa5428982f8b37c8f7bcec91f7ac71a7cd104; // sha256("description")
const USERNAME_COLLECTION_METADATA_KEY_IMAGE: Int       = 0x6105d6cc76af400325e94d588ce511be5bfdbb73b437dc51eca43917d7a43e3d; // sha256("image")
const USERNAME_COLLECTION_METADATA_KEY_COVER_IMAGE: Int = 0x5ef8ba599c69728c698d4cdca2040e121acb2aa9b6d4a2c8af02dd0b91398ce7; // sha256("cover_image")
// clean-11 meta-dict namespace (uint16 keys): 1=description, 2=image(avatar b64 data-uri), 3=cover_image(banner b64 data-uri).
const USERNAME_META_KEY_DESCRIPTION: Int = 1;
const USERNAME_META_KEY_IMAGE: Int = 2;
const USERNAME_META_KEY_COVER_IMAGE: Int = 3;
const USERNAME_META_PART_COUNT: Int = 3;
const USERNAME_COLLECTION_UNORDERED_NEXT_INDEX: Int = -1;

const OP_USERNAME_BIND_OFFICIAL_ATH_WALLET: Int = 0x663DF03D;
const OP_SEAL_GENESIS: Int = 0x3A12D1AD;

message(0x663DF03D) BindOfficialAthWallet {
    deployment_manifest_hash: Int as uint256;
    official_ath_wallet_address: Address;
}

message(0x3A12D1AD) SealGenesis {
    deployment_manifest_hash: Int as uint256;
}

message(0x60A9BDDB) FlushTreasuryAthDue {
    query_id: Int as uint64;
}

message(0xE9A2C2CB) FlushBurnAthDue {
    query_id: Int as uint64;
}

message(0x3796DF2D) PrunePendingUsernameMint {
    name_hash: Int as uint256;
}

message(0x0ABA5F1D) UsernameRegistryTopUpStorageReserve {}

struct PendingUsernameMint {
    query_id: Int as uint64;
    sender_key: Int as uint160;
    owner_wallet: Address;
    name_hash: Int as uint256;
    price_paid: Int as uint128;
    item_address: Address;
    item_deploy_value: Int as uint128;
    created_at: Int as uint64;
    mint_nonce: Int as uint64;
}

struct UsernameRegistryGlobalView {
    sealed: Bool;
    official_ath_wallet_bound: Bool;
    deployment_manifest_hash: Int;
    genesis_config_hash: Int;
    official_ath_wallet_address: Address;
    genesis_controller_address: Address;
    pending_mint_count: Int;
    treasury_due_ath: Int;
    burn_due_ath: Int;
    pending_treasury_flush_count: Int;
    pending_burn_flush_count: Int;
    pending_mint_stale_ttl: Int;
}

struct UsernamePriceView {
    valid_length: Bool;
    price_ath_atomic: Int;
}

struct PendingUsernameMintView {
    exists: Bool;
    query_id: Int;
    sender_key: Int;
    owner_wallet: Address;
    name_hash: Int;
    price_paid: Int;
    item_address: Address;
    item_deploy_value: Int;
    created_at: Int;
}

struct PendingAthTreasuryFlush {
    amount: Int as uint128;
    recipient_ath_wallet: Address;
    created_at: Int as uint64;
}

struct PendingAthBurnFlush {
    amount: Int as uint128;
    created_at: Int as uint64;
}

struct PendingAthTreasuryFlushView {
    exists: Bool;
    amount: Int;
    recipient_ath_wallet: Address;
    created_at: Int;
}

struct PendingAthBurnFlushView {
    exists: Bool;
    amount: Int;
    created_at: Int;
}

struct UsernameCollectionDataView {
    next_item_index: Int;
    collection_content: Cell;
    owner_address: Address;
}

// clean-11: TEP-66 royalty params (numerator/denominator/destination).
struct RoyaltyParamsView {
    numerator: Int;
    denominator: Int;
    destination: Address;
}

struct UsernameCollectionOnchainContent {
    marker: Int as uint8;
    metadata: map<Int as uint256, Cell>;
}

message UploadArt {
    key: Int as uint16;
    data: Cell;
}
message SealArt {}
// clean-11 collection-metadata upload (mirrors UploadArt): each `data` is a COMPLETE TEP-64 snake value cell
// (0x00 marker + snake, built client-side exactly like the mainnet-proven probe) — served verbatim, no re-wrap.
message UploadCollectionMeta {
    key: Int as uint16;
    data: Cell;
}
message SealCollectionMeta {}

contract UsernameRegistry {
    official_ath_wallet_address: Address;
    ath_master_address: Address;
    treasury_ath_receiver_address: Address;
    official_ath_wallet_bound: Bool;
    sealed: Bool;
    deployment_manifest_hash: Int as uint256;
    genesis_config_hash: Int as uint256;
    pending_mint_count: Int as uint64;
    mint_seq: Int as uint64;   // monotonic pending-mint nonce; see gate 19137
    treasury_due_ath: Int as uint128;
    burn_due_ath: Int as uint128;
    pending_mints: map<Int, PendingUsernameMint>;
    pending_item_to_name_hash: map<Address, Int>;
    pending_treasury_flushes: map<Int, PendingAthTreasuryFlush>;
    pending_treasury_flush_count: Int as uint64;
    pending_burn_flushes: map<Int, PendingAthBurnFlush>;
    pending_burn_flush_count: Int as uint64;
    genesis_controller_address: Address;
    // On-chain SVG art parts (Arimo glyph/static path-`d` strings), keyed by glyph id.
    // Uploaded by the genesis controller while UNSEALED; locked by SealGenesis. Kept OUT
    // of code (full glyph set would blow the ~64KB deploy-external limit). art_count tracks
    // distinct keys so SealGenesis can refuse an INCOMPLETE art set (would render broken).
    art: map<Int as uint16, Cell>;
    art_count: Int as uint16;
    art_sealed: Bool;
    // clean-11: collection-level TEP-64 metadata (avatar/banner data-URIs + description) as COMPLETE snake value
    // cells, uploaded at genesis like `art` (base64 data-URIs would blow the ~64KB deploy-external). meta_sealed locks it.
    meta: map<Int as uint16, Cell>;
    meta_count: Int as uint16;
    meta_sealed: Bool;

    init(official_ath_wallet_address: Address, ath_master_address: Address, treasury_ath_receiver_address: Address, sealed: Bool, deployment_manifest_hash: Int, genesis_config_hash: Int, genesis_controller_address: Address) {
        self.official_ath_wallet_address = official_ath_wallet_address;
        self.ath_master_address = ath_master_address;
        self.treasury_ath_receiver_address = treasury_ath_receiver_address;
        self.official_ath_wallet_bound = false;
        self.sealed = sealed;
        self.genesis_controller_address = genesis_controller_address;
        self.deployment_manifest_hash = deployment_manifest_hash;
        self.genesis_config_hash = genesis_config_hash;
        self.pending_mint_count = 0;
        self.mint_seq = 0;
        self.treasury_due_ath = 0;
        self.burn_due_ath = 0;
        self.pending_treasury_flush_count = 0;
        self.pending_burn_flush_count = 0;
        self.art_count = 0;
        self.art_sealed = false;
        self.meta_count = 0;      // clean-11
        self.meta_sealed = false; // clean-11
    }

    fun requireUnsealed() {
        throwUnless(19000, !self.sealed);
    }

    fun requireSealed() {
        throwUnless(19100, self.sealed);
    }

    fun requireGenesisController() {
        throwUnless(19033, sender() == self.genesis_controller_address);
    }

    fun priceForLength(name_len: Int): Int {
        throwUnless(19010, name_len >= 4);
        throwUnless(19011, name_len <= USERNAME_MAX_LENGTH);
        if (name_len == 4) {
            return USERNAME_PRICE_4_CHARS;
        }
        if (name_len == 5) {
            return USERNAME_PRICE_5_CHARS;
        }
        return USERNAME_PRICE_6_PLUS_CHARS;
    }

    fun isValidNameLength(name_len: Int): Bool {
        return (name_len >= 4) && (name_len <= USERNAME_MAX_LENGTH);
    }

    fun isValidUsernameBytes(name_len: Int, username: Slice): Bool {
        if (!self.isValidNameLength(name_len)) {
            return false;
        }
        if (username.bits() != (name_len * 8)) {
            return false;
        }
        if (!username.refsEmpty()) {
            return false;
        }

        let cursor: Slice = username;
        let i: Int = 0;
        while (i < name_len) {
            let ch: Int = cursor.loadUint(8);
            let lower: Bool = (ch >= 97) && (ch <= 122);
            let digit: Bool = (ch >= 48) && (ch <= 57);
            let separator: Bool = (ch == 45) || (ch == 95);
            if (!(lower || digit || separator)) {
                return false;
            }
            i += 1;
        }
        return cursor.empty();
    }

    fun computeNameHash(username: Slice): Int {
        return beginCell()
            .storeUint(USERNAME_NAME_HASH_DOMAIN, 32)
            .storeSlice(username)
            .endCell()
            .hash();
    }

    fun collectionNameCell(): Cell {
        return beginCell()
            .storeUint(0, 8)
            .storeUint(0x506c6174686f20757365726e616d6573, 128) // "Platho usernames"
            .endCell();
    }

    fun collectionContent(): Cell {
        throwUnless(19360, self.meta_sealed); // never expose half-built collection metadata
        let metadata: map<Int as uint256, Cell> = emptyMap();
        metadata.set(USERNAME_COLLECTION_METADATA_KEY_NAME, self.collectionNameCell());
        metadata.set(USERNAME_COLLECTION_METADATA_KEY_DESCRIPTION, self.metaCell(USERNAME_META_KEY_DESCRIPTION));
        metadata.set(USERNAME_COLLECTION_METADATA_KEY_IMAGE,       self.metaCell(USERNAME_META_KEY_IMAGE));
        metadata.set(USERNAME_COLLECTION_METADATA_KEY_COVER_IMAGE, self.metaCell(USERNAME_META_KEY_COVER_IMAGE));
        return UsernameCollectionOnchainContent {
            marker: 0,
            metadata: metadata
        }.toCell();
    }

    // clean-11: a collection-meta part (description / avatar data-URI / banner data-URI) stored as a COMPLETE TEP-64
    // snake value (0x00 marker + snake, built client-side like the mainnet-proven probe). Served verbatim into the
    // collection_content dict as a ref — NO re-wrap (avoids the multi-cell asString truncation hazard for the banner).
    fun metaCell(key: Int): Cell {
        let c: Cell? = self.meta.get(key);
        throwUnless(19361, c != null);
        return c!!;
    }

    fun deriveItemAddress(name_hash: Int): Address {
        throwUnless(19020, name_hash > 0);
        let registry_std: StdAddress = parseStdAddress(myAddress().asSlice());
        let item_init: StateInit = initOf UsernameNFTItem(myAddress(), name_hash);
        return contractAddressExt(registry_std.workchain, item_init.code, item_init.data);
    }

    fun deriveAthWalletAddress(owner_wallet: Address): Address {
        let owner_std: StdAddress = parseStdAddress(owner_wallet.asSlice());
        let wallet_init: StateInit = initOf ATHWallet(0, owner_wallet, self.ath_master_address);
        return contractAddressExt(owner_std.workchain, wallet_init.code, wallet_init.data);
    }

    fun isBasechainAddress(address: Address): Bool {
        let std: StdAddress = parseStdAddress(address.asSlice());
        return std.workchain == 0;
    }

    fun sendAthNotificationAck(destination: Address, query_id: Int, sender_key: Int, amount: Int) {
        message(MessageParameters {
            to: destination,
            value: USERNAME_ATH_NOTIFICATION_ACK_VALUE,
            bounce: false,
            mode: SendDefaultMode,
            body: AthTransferNotificationAck {
                query_id: query_id,
                sender_key: sender_key,
                amount: amount
            }.toCell()
        });
    }

    fun sendAthNotificationRefund(query_id: Int, sender_key: Int, amount: Int) {
        message(MessageParameters {
            to: self.official_ath_wallet_address,
            value: USERNAME_ATH_NOTIFICATION_REFUND_VALUE,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            body: AthTransferNotificationRefund {
                query_id: query_id,
                sender_key: sender_key,
                amount: amount
            }.toCell()
        });
    }

    fun clearPendingTreasuryFlush(query_id: Int): PendingAthTreasuryFlush {
        let pendingOpt: PendingAthTreasuryFlush? = self.pending_treasury_flushes.get(query_id);
        throwUnless(19250, pendingOpt != null);
        let pending: PendingAthTreasuryFlush = pendingOpt!!;
        self.pending_treasury_flushes.del(query_id);
        self.pending_treasury_flush_count -= 1;
        return pending;
    }

    fun clearPendingBurnFlush(query_id: Int): PendingAthBurnFlush {
        let pendingOpt: PendingAthBurnFlush? = self.pending_burn_flushes.get(query_id);
        throwUnless(19260, pendingOpt != null);
        let pending: PendingAthBurnFlush = pendingOpt!!;
        self.pending_burn_flushes.del(query_id);
        self.pending_burn_flush_count -= 1;
        return pending;
    }

    fun requireNoDueFlushQuery(query_id: Int) {
        throwUnless(19201, !self.pending_treasury_flushes.exists(query_id));
        throwUnless(19202, !self.pending_burn_flushes.exists(query_id));
    }

    fun clearPendingMint(name_hash: Int): PendingUsernameMint {
        let pendingOpt: PendingUsernameMint? = self.pending_mints.get(name_hash);
        throwUnless(19300, pendingOpt != null);
        let pending: PendingUsernameMint = pendingOpt!!;
        self.pending_mints.del(name_hash);
        self.pending_item_to_name_hash.del(pending.item_address);
        self.pending_mint_count -= 1;
        return pending;
    }

    fun acceptUsernameMint(query_id: Int, sender_key: Int, amount: Int, owner_wallet: Address, username_len: Int, username: Slice) {
        throwUnless(19121, amount > 0);
        throwUnless(19126, self.isBasechainAddress(owner_wallet));

        if (!self.isValidUsernameBytes(username_len, username)) {
            throw(19170);
        }

        let name_hash: Int = self.computeNameHash(username);
        let price: Int = self.priceForLength(username_len);

        if (amount != price) {
            throw(19171);
        }


        if (self.pending_mints.exists(name_hash)) {
            throw(19173);
        }

        let retainedValue: Int = USERNAME_PENDING_MINT_STORAGE_ENDOWMENT + USERNAME_NFT_ITEM_DEPLOY_RESERVE + USERNAME_ATH_NOTIFICATION_ACK_VALUE + USERNAME_STATE_GROWTH_EXEC_RESERVE + USERNAME_REGISTRY_SELF_RENT_CONTRIBUTION;
        throwUnless(19122, context().value >= retainedValue);

        let item_address: Address = self.deriveItemAddress(name_hash);
        throwUnless(19123, !self.pending_item_to_name_hash.exists(item_address));

        // [ADDED 2026-07-29, wave-8 HIGH] Strictly increasing, so no two pending mints ever share a nonce and an ACK
        // can name the one initialization it actually came from. See the UsernameItemDeployedAck receiver.
        self.mint_seq += 1;

        self.pending_mints.set(name_hash, PendingUsernameMint {
            query_id: query_id,
            sender_key: sender_key,
            owner_wallet: owner_wallet,
            name_hash: name_hash,
            price_paid: amount,
            item_address: item_address,
            item_deploy_value: USERNAME_NFT_ITEM_DEPLOY_RESERVE,
            created_at: now(),
            mint_nonce: self.mint_seq
        });
        self.pending_item_to_name_hash.set(item_address, name_hash);
        self.pending_mint_count += 1;

        let item_init: StateInit = initOf UsernameNFTItem(myAddress(), name_hash);
        send(SendParameters {
            to: item_address,
            value: USERNAME_NFT_ITEM_DEPLOY_RESERVE,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            code: item_init.code,
            data: item_init.data,
            body: InitializeUsernameItem {
                owner_wallet: owner_wallet,
                mint_nonce: self.mint_seq,
                username_len: username_len,
                username: username
            }.toCell()
        });

    }

    receive(msg: BindOfficialAthWallet) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(19030, msg.deployment_manifest_hash > 1);
        throwUnless(19031, !self.official_ath_wallet_bound);
        throwUnless(19032, self.genesis_config_hash == 0);
        throwUnless(19034, self.deployment_manifest_hash == 0 || self.deployment_manifest_hash == msg.deployment_manifest_hash);
        throwUnless(19035, msg.official_ath_wallet_address == self.deriveAthWalletAddress(myAddress()));
        self.deployment_manifest_hash = msg.deployment_manifest_hash;
        self.genesis_config_hash = 1;
        self.official_ath_wallet_address = msg.official_ath_wallet_address;
        self.official_ath_wallet_bound = true;
    }

    receive(msg: SealGenesis) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(19040, msg.deployment_manifest_hash > 1);
        throwUnless(19041, self.deployment_manifest_hash == msg.deployment_manifest_hash);
        throwUnless(19042, self.official_ath_wallet_bound);
        throwUnless(19043, self.official_ath_wallet_address == self.deriveAthWalletAddress(myAddress()));
        // [ADDED 2026-07-30, tier-4 HIGH] The genesis seal is the ONLY one-way door this contract has, and until now it
        // left the art and the collection metadata outside it.
        //
        // requireGenesisController compares sender() to an init field that SealGenesis never clears — unlike
        // MarketStabilitySeller, which zeroes genesis_config_hash and kills its controller outright. So UploadArt
        // (gated only on !art_sealed) and UploadCollectionMeta (gated only on !meta_sealed) stayed callable FOREVER
        // after the seal if the ceremony skipped SealArt / SealCollectionMeta. The genesis controller is a hot wallet,
        // and that left it permanent write authority over the SVG every .ath NFT renders and over the collection's
        // name, description and images — an admin backdoor over user-visible content in a contract whose whole claim
        // is that nothing can be changed after genesis.
        //
        // Nothing would have caught the skip: get_art_sealed / get_meta_sealed are read ONLY by the two upload scripts
        // themselves, while the headers of both scripts assert "Genesis verify asserts art_sealed == true". That
        // verification did not exist. Third time in this repo that prose claimed a guard nobody had built.
        //
        // Gating the seal — rather than gating the uploads on `sealed` — is what closes BOTH failure modes at once:
        // forbidding uploads after the seal would have frozen an INCOMPLETE art set permanently if the ceremony sealed
        // early, which is the opposite mistake and just as unrepairable. Demanding both locks up front means the art
        // is complete and immutable before the seal, and afterwards neither flag can go back (nothing unsets them),
        // so UploadArt dies on 19061 and UploadCollectionMeta on 19071 for good. Together with requireUnsealed on the
        // remaining controller paths, `sealed == true` now means the genesis controller has NO authority left at all.
        throwUnless(19044, self.isBasechainAddress(self.treasury_ath_receiver_address));
        throwUnless(19049, self.treasury_ath_receiver_address != myAddress());
        throwUnless(19050, self.treasury_ath_receiver_address != self.official_ath_wallet_address);
        throwUnless(19052, self.treasury_ath_receiver_address != self.ath_master_address);
        // Deliberately LAST, after every pre-existing gate: ordering a throw earlier would have made the treasury and
        // wallet negative tests stop here and pass for the wrong reason, which is how a real gate gets hollowed out.
        throwUnless(19045, self.art_sealed);
        throwUnless(19046, self.meta_sealed);
        self.genesis_config_hash = msg.deployment_manifest_hash;
        self.sealed = true;
    }

    // The 56 art keys, and only those. Kept next to the gate that uses it so the two cannot drift apart.
    fun isValidArtKey(key: Int): Bool {
        if (key == 45) { return true; }                       // '-'
        if ((key >= 48) && (key <= 57)) { return true; }      // '0'..'9'
        if (key == 95) { return true; }                       // '_'
        if ((key >= 97) && (key <= 122)) { return true; }     // 'a'..'z'
        if ((key >= 200) && (key <= 209)) { return true; }    // caption digits
        if ((key >= 300) && (key <= 307)) { return true; }    // statics
        return false;
    }

    // UploadArt: the genesis controller stores one art part (plain-snake path-`d`) until the art
    // is sealed. DECOUPLED from the genesis seal so mint/integration flows can seal the genesis
    // without art; SealArt locks the art for production once all 56 parts are present.
    receive(msg: UploadArt) {
        self.requireGenesisController();
        throwUnless(19061, !self.art_sealed);
        // [ADDED 2026-07-29, wave-8 MED] key is a uint16 and every one of its 65,536 values was accepted, while
        // art_count only ever goes UP — there is no art.del and no decrement anywhere in this contract. SealArt
        // demands art_count == 56 EXACTLY. So a single upload with a key outside the working set pushed the count
        // past 56 permanently, 19060 could never pass again, and genesis verification asserts art_sealed == true.
        // The registry's address derives from its code and init arguments, so there is no retry that is not a
        // different registry. The twin handler below already had its range gate (19072); this one did not.
        //
        // The set is VERIFIED against artifacts/username_art_v2/art_payload.json, not transcribed from a comment:
        // 45 ('-'), 48-57 ('0'-'9'), 95 ('_'), 97-122 ('a'-'z'), 200-209 (caption digits), 300-307 (statics) = 56.
        throwUnless(19062, self.isValidArtKey(msg.key));
        if (self.art.get(msg.key) == null) {
            self.art_count += 1;
        }
        self.art.set(msg.key, msg.data);
    }

    // SealArt: one-way lock once all 56 parts (38 glyphs + 10 caption digits + 8 statics) are
    // present, after which the art is immutable. Genesis verification asserts art_sealed == true.
    receive(msg: SealArt) {
        self.requireGenesisController();
        throwUnless(19060, self.art_count == 56);
        self.art_sealed = true;
    }

    // clean-11: genesis controller uploads one collection-meta part (a complete TEP-64 snake value cell) until sealed.
    // DECOUPLED from SealGenesis (like UploadArt); genesis verification asserts meta_sealed == true.
    receive(msg: UploadCollectionMeta) {
        self.requireGenesisController();
        throwUnless(19071, !self.meta_sealed);
        throwUnless(19072, (msg.key >= 1) && (msg.key <= USERNAME_META_PART_COUNT));
        if (self.meta.get(msg.key) == null) {
            self.meta_count += 1;
        }
        self.meta.set(msg.key, msg.data);
    }

    // clean-11: one-way lock once all 3 parts (description + image + cover_image) are present.
    receive(msg: SealCollectionMeta) {
        self.requireGenesisController();
        throwUnless(19070, self.meta_count == USERNAME_META_PART_COUNT);
        self.meta_sealed = true;
    }

    // clean-16 migration/Durable-Core: PAYER-AUTHENTICATED mint (owner decision 2026-07-15). The mint is no longer
    // gated on a one-shot-bound Vault — it is authenticated by the UNFORGEABLE payer identity the official ATH wallet
    // already stamps (sender()==official_ath_wallet guarantees the notify came from OUR wallet, which itself only
    // stamps payer_wallet=derive_wallet_address(real sender_owner)). Any basechain ATH payer who pays the price may
    // mint an UNOWNED name (to the client-supplied owner_wallet) — owned-name theft stays impossible (acceptUsernameMint
    // rejects a taken/pending name; the NFT item is one-shot + transfer owner-only). Because nothing references a Vault,
    // the registry is Vault-INDEPENDENT and survives every future Vault redeploy → frozen once, reused forever.
    receive(msg: AthTransferNotificationRegistryMintUsername) {
        self.requireSealed();
        throwUnless(19180, sender() == self.official_ath_wallet_address);
        throwUnless(19183, self.isBasechainAddress(msg.payer_wallet));
        // §4c: username now arrives as its own ref cell (see ATHWallet decl). Parse to a flat slice; acceptUsernameMint's
        // isValidUsernameBytes still enforces refsEmpty + bits==len*8, so a malformed cell is rejected there.
        self.acceptUsernameMint(msg.query_id, msg.sender_key, msg.amount, msg.owner_wallet, msg.username_len, msg.username.beginParse());
    }

    receive(msg: UsernameItemDeployedAck) {
        self.requireSealed();
        let nameFromItem: Int? = self.pending_item_to_name_hash.get(sender());
        throwUnless(19130, nameFromItem != null);
        throwUnless(19131, nameFromItem!! == msg.name_hash);

        let pendingOpt: PendingUsernameMint? = self.pending_mints.get(msg.name_hash);
        throwUnless(19132, pendingOpt != null);
        let pending: PendingUsernameMint = pendingOpt!!;
        throwUnless(19133, self.isBasechainAddress(msg.owner_wallet));
        throwUnless(19134, pending.item_address == sender());
        throwUnless(19136, msg.owner_wallet == pending.owner_wallet);
        // [ADDED 2026-07-29, wave-8 HIGH] The ACK must come from the initialization THIS pending mint caused.
        //
        // Nothing else in this receiver establishes freshness. The item initializes exactly once (its gate 18011),
        // so a name that already exists can never produce a new ACK — yet ResendDeployedAck is open to anyone, for
        // 4,000,000, without limit, and used to replay an ACK carrying the item's current owner. Whenever that owner
        // matched a later pending mint's owner_wallet — a repeat purchase of one's own name, a gift to a wallet that
        // already holds it, a client retry after an unseen confirmation — 19136 was satisfied by coincidence and the
        // registry finalized a mint that had not happened: price booked to treasury_due/burn_due, the payer's ATH
        // acked as ACCEPTED, and the genuine bounce arriving afterwards dying on 19140 because the pending was gone.
        // The buyer paid and received nothing, permanently, and it cost the attacker 4,000,000 nanoton.
        //
        // The nonce is issued here and stored by the item at initialization, so a replay reports the nonce of the
        // initialization that really occurred — never the one this pending mint is waiting for.
        throwUnless(19137, msg.mint_nonce == pending.mint_nonce);

        let pendingToFinalize: PendingUsernameMint = self.clearPendingMint(msg.name_hash);


        let treasury_amount: Int = (pendingToFinalize.price_paid * USERNAME_TREASURY_SHARE_BPS) / USERNAME_SPLIT_BASE_BPS;
        let burn_amount: Int = pendingToFinalize.price_paid - treasury_amount;
        self.treasury_due_ath += treasury_amount;
        self.burn_due_ath += burn_amount;
        self.sendAthNotificationAck(self.official_ath_wallet_address, pendingToFinalize.query_id, pendingToFinalize.sender_key, pendingToFinalize.price_paid);
    }

    bounced(msg: bounced<InitializeUsernameItem>) {
        // Username mint finality is intentionally item-driven: pending mints clear only on deterministic item ACK or deploy bounce/refund, not on arbitrary timeout prune.
        self.requireSealed();
        let nameFromItem: Int? = self.pending_item_to_name_hash.get(sender());
        throwUnless(19140, nameFromItem != null);
        let pendingOpt: PendingUsernameMint? = self.pending_mints.get(nameFromItem!!);
        throwUnless(19141, pendingOpt != null);

        let cleared: PendingUsernameMint = self.clearPendingMint(nameFromItem!!);
        self.sendAthNotificationRefund(cleared.query_id, cleared.sender_key, cleared.price_paid);

        // [ADDED 2026-07-29, wave-8 MED] Give the TON back too. The file header said a duplicate mint "costs one extra
        // round trip and is refunded" — only the ATH was. Since name_records was deleted, a repeat purchase of a live
        // name is ACCEPTED: the registry takes the payment, books a pending mint, and deploys to an item that refuses
        // at 18011 and bounces. That bounce returned the item deploy reserve here and it simply stayed: this contract
        // has no handler anywhere that sends TON to a payer or an owner, so roughly 0.9 GRAM per duplicate was immured
        // in an immutable registry. Zero live users today, which is the only reason this is a MED and not worse.
        //
        // The amount is EXPLICIT, never SendRemainingValue: mode 64 after an earlier explicit leg has drained a
        // balance elsewhere in this codebase, and here the earlier leg (the ATH refund) is charged to balance with
        // fees separately. Subtracting it can go negative if the bounce came back thin, hence the floor.
        //
        // Destination is owner_wallet, the wallet the mint was FOR. It is the payer in every ordinary purchase; on a
        // gift it is the recipient rather than the giver, which is imperfect and still strictly better than immuring
        // it — the registry never learns the payer's own wallet address, only the ATH wallet's escrow key does.
        let tonRefund: Int = context().value - USERNAME_ATH_NOTIFICATION_REFUND_VALUE;
        if (tonRefund >= USERNAME_TON_REFUND_MIN_VALUE) {
            message(MessageParameters {
                to: cleared.owner_wallet,
                value: tonRefund,
                bounce: false,
                mode: SendPayFwdFeesSeparately,
                body: null
            });
        }
    }

    receive(msg: FlushTreasuryAthDue) {
        self.requireSealed();
        throwUnless(19210, msg.query_id > 0);
        self.requireNoDueFlushQuery(msg.query_id);
        throwUnless(19211, self.treasury_due_ath > 0);
        throwUnless(19212, context().value >= USERNAME_ATH_TRANSFER_EXEC_RESERVE + USERNAME_DUE_FLUSH_LOCAL_EXEC_RESERVE);
        throwUnless(19213, self.isBasechainAddress(self.treasury_ath_receiver_address));

        let amount: Int = self.treasury_due_ath;
        self.treasury_due_ath = 0;
        let recipient_ath_wallet: Address = self.deriveAthWalletAddress(self.treasury_ath_receiver_address);

        self.pending_treasury_flushes.set(msg.query_id, PendingAthTreasuryFlush {
            amount: amount,
            recipient_ath_wallet: recipient_ath_wallet,
            created_at: now()
        });
        self.pending_treasury_flush_count += 1;

        message(MessageParameters {
            to: self.official_ath_wallet_address,
            value: USERNAME_ATH_TRANSFER_EXEC_RESERVE,
            mode: SendPayFwdFeesSeparately,
            bounce: true,
            body: ATHTransferRequest {
                query_id: msg.query_id,
                amount: amount,
                recipient: self.treasury_ath_receiver_address,
                response_destination: myAddress()
            }.toCell()
        });
    }

    receive(msg: FlushBurnAthDue) {
        self.requireSealed();
        throwUnless(19220, msg.query_id > 0);
        self.requireNoDueFlushQuery(msg.query_id);
        throwUnless(19221, self.burn_due_ath > 0);
        throwUnless(19222, context().value >= USERNAME_ATH_BURN_EXEC_RESERVE + USERNAME_DUE_FLUSH_LOCAL_EXEC_RESERVE);

        let amount: Int = self.burn_due_ath;
        self.burn_due_ath = 0;

        self.pending_burn_flushes.set(msg.query_id, PendingAthBurnFlush {
            amount: amount,
            created_at: now()
        });
        self.pending_burn_flush_count += 1;

        message(MessageParameters {
            to: self.official_ath_wallet_address,
            value: USERNAME_ATH_BURN_EXEC_RESERVE,
            mode: SendPayFwdFeesSeparately,
            bounce: true,
            body: ATHBurn {
                query_id: msg.query_id,
                amount: amount,
                response_destination: myAddress()
            }.toCell()
        });
    }

    receive(msg: ATHTransferAck) {
        self.requireSealed();
        let treasuryPendingOpt: PendingAthTreasuryFlush? = self.pending_treasury_flushes.get(msg.query_id);
        throwUnless(19230, treasuryPendingOpt != null);
        let treasuryPending: PendingAthTreasuryFlush = self.clearPendingTreasuryFlush(msg.query_id);
        throwUnless(19231, msg.amount == treasuryPending.amount);
        throwUnless(19232, sender() == treasuryPending.recipient_ath_wallet);
    }

    receive(msg: ATHTransferFailed) {
        self.requireSealed();
        throwUnless(19158, sender() == self.official_ath_wallet_address);
        let treasuryPendingOpt: PendingAthTreasuryFlush? = self.pending_treasury_flushes.get(msg.query_id);
        throwUnless(19240, treasuryPendingOpt != null);
        let treasuryPending: PendingAthTreasuryFlush = self.clearPendingTreasuryFlush(msg.query_id);
        throwUnless(19241, msg.amount == treasuryPending.amount);
        self.treasury_due_ath += treasuryPending.amount;
    }

    receive(msg: ATHBurnFinalized) {
        self.requireSealed();
        throwUnless(19270, sender() == self.ath_master_address);
        throwUnless(19271, msg.owner_address == myAddress());
        let pending: PendingAthBurnFlush = self.clearPendingBurnFlush(msg.query_id);
        throwUnless(19272, msg.amount == pending.amount);
    }

    receive(msg: ATHBurnFailed) {
        self.requireSealed();
        throwUnless(19280, sender() == self.official_ath_wallet_address);
        let pending: PendingAthBurnFlush = self.clearPendingBurnFlush(msg.query_id);
        throwUnless(19281, msg.amount == pending.amount);
        self.burn_due_ath += pending.amount;
    }

    bounced(msg: bounced<ATHTransferRequest>) {
        self.requireSealed();
        throwUnless(19160, sender() == self.official_ath_wallet_address);
        let treasuryPendingOpt: PendingAthTreasuryFlush? = self.pending_treasury_flushes.get(msg.query_id);
        throwUnless(19242, treasuryPendingOpt != null);
        let treasuryPending: PendingAthTreasuryFlush = self.clearPendingTreasuryFlush(msg.query_id);
        throwUnless(19243, msg.amount == treasuryPending.amount);
        self.treasury_due_ath += treasuryPending.amount;
    }

    bounced(msg: bounced<ATHBurn>) {
        self.requireSealed();
        throwUnless(19290, sender() == self.official_ath_wallet_address);
        let pending: PendingAthBurnFlush = self.clearPendingBurnFlush(msg.query_id);
        throwUnless(19291, msg.amount == pending.amount);
        self.burn_due_ath += pending.amount;
    }

    receive(msg: PrunePendingUsernameMint) {
        self.requireSealed();
        throwUnless(19305, context().value >= USERNAME_PRUNE_PENDING_MINT_EXEC_RESERVE);
        throwUnless(19301, msg.name_hash != 0);
        let pendingOpt: PendingUsernameMint? = self.pending_mints.get(msg.name_hash);
        throwUnless(19302, pendingOpt != null);
        let pending: PendingUsernameMint = pendingOpt!!;
        throwUnless(19303, now() >= pending.created_at + USERNAME_PENDING_MINT_STALE_TTL);
        // DELIBERATELY UNREACHABLE — this handler always refuses, and that is the design, not an oversight.
        //
        // The old note here said "do not refund a Vault-funded mint until item deployment finality". There is no
        // Vault in clean-17, and describing a LIVE mechanism through a deleted one invites the wrong conclusion:
        // that a pending mint has no exit and this stub is a gap someone forgot to fill. It has one, and a timeout
        // prune would be strictly worse than it.
        //
        // Mint finality is ITEM-DRIVEN and complete. A pending mint clears on exactly one of:
        //   * UsernameItemDeployedAck  — the item initialised (and ResendDeployedAck, permissionless, re-fires the
        //                                ack if the first one was lost, so "the ack went missing" is recoverable);
        //   * bounced<InitializeUsernameItem> — the item refused (18011: the name already exists), which refunds
        //                                the ATH and returns the TON.
        // Both outcomes are DETERMINISTIC facts about the item. A time-based prune would instead guess: refund on a
        // schedule while the item may still be mid-deploy, and the same name could be minted twice — once by the
        // prune's refund path and once by the ack that arrives afterwards. The gates above are kept so the refusal
        // is 19307 (a stated policy) rather than 19302 (a missing record), which tells a caller which one it hit.
        throw(19307);
    }

    receive(msg: UsernameRegistryTopUpStorageReserve) {
        // Accept TON for storage reserve only. Grants no authority and mutates no protocol state.
    }

    fun appendUsernameSvgChar(b: StringBuilder, ch: Int): StringBuilder {
        if (ch == 45) { return b.concat("-"); }
        if (ch == 48) { return b.concat("0"); }
        if (ch == 49) { return b.concat("1"); }
        if (ch == 50) { return b.concat("2"); }
        if (ch == 51) { return b.concat("3"); }
        if (ch == 52) { return b.concat("4"); }
        if (ch == 53) { return b.concat("5"); }
        if (ch == 54) { return b.concat("6"); }
        if (ch == 55) { return b.concat("7"); }
        if (ch == 56) { return b.concat("8"); }
        if (ch == 57) { return b.concat("9"); }
        if (ch == 95) { return b.concat("_"); }
        if (ch == 97) { return b.concat("a"); }
        if (ch == 98) { return b.concat("b"); }
        if (ch == 99) { return b.concat("c"); }
        if (ch == 100) { return b.concat("d"); }
        if (ch == 101) { return b.concat("e"); }
        if (ch == 102) { return b.concat("f"); }
        if (ch == 103) { return b.concat("g"); }
        if (ch == 104) { return b.concat("h"); }
        if (ch == 105) { return b.concat("i"); }
        if (ch == 106) { return b.concat("j"); }
        if (ch == 107) { return b.concat("k"); }
        if (ch == 108) { return b.concat("l"); }
        if (ch == 109) { return b.concat("m"); }
        if (ch == 110) { return b.concat("n"); }
        if (ch == 111) { return b.concat("o"); }
        if (ch == 112) { return b.concat("p"); }
        if (ch == 113) { return b.concat("q"); }
        if (ch == 114) { return b.concat("r"); }
        if (ch == 115) { return b.concat("s"); }
        if (ch == 116) { return b.concat("t"); }
        if (ch == 117) { return b.concat("u"); }
        if (ch == 118) { return b.concat("v"); }
        if (ch == 119) { return b.concat("w"); }
        if (ch == 120) { return b.concat("x"); }
        if (ch == 121) { return b.concat("y"); }
        if (ch == 122) { return b.concat("z"); }
        return b;
    }

    // ===== GENERATED (text-as-paths from sealed art dict): image_data renders WITHOUT fonts =====
    // Glyph/static path-d strings live in self.art (uploaded at genesis, locked by SealGenesis).
    // Structural literals stay in code; each part is read via cell.asSlice().asString().
    fun appendArt(b: StringBuilder, key: Int): StringBuilder {
        let c: Cell? = self.art.get(key);
        if (c != null) { b.append(c!!.asSlice().asString()); }
        return b;
    }

    fun appendTileGlyph(b: StringBuilder, rect: String, xform: String, ch: Int): StringBuilder {
        b.append(rect);
        b.append("<path fill=\"#f4f7f5\" transform=\"");
        b.append(xform);
        b.append("\" d=\"");
        b = self.appendArt(b, ch);
        b.append("\"/>");
        return b;
    }

    fun appendEpicTile(b: StringBuilder, i: Int, ch: Int): StringBuilder {
        if (i == 0) { return self.appendTileGlyph(b, "<rect x=\"169\" y=\"374\" width=\"152\" height=\"152\" rx=\"20\" fill=\"#151a1d\" stroke=\"url(#tier-tile)\" stroke-width=\"4\"/>", "matrix(0.97 0 0 0.97 245 478)", ch); }
        if (i == 1) { return self.appendTileGlyph(b, "<rect x=\"347\" y=\"374\" width=\"152\" height=\"152\" rx=\"20\" fill=\"#151a1d\" stroke=\"url(#tier-tile)\" stroke-width=\"4\"/>", "matrix(0.97 0 0 0.97 423 478)", ch); }
        if (i == 2) { return self.appendTileGlyph(b, "<rect x=\"525\" y=\"374\" width=\"152\" height=\"152\" rx=\"20\" fill=\"#151a1d\" stroke=\"url(#tier-tile)\" stroke-width=\"4\"/>", "matrix(0.97 0 0 0.97 601 478)", ch); }
        if (i == 3) { return self.appendTileGlyph(b, "<rect x=\"703\" y=\"374\" width=\"152\" height=\"152\" rx=\"20\" fill=\"#151a1d\" stroke=\"url(#tier-tile)\" stroke-width=\"4\"/>", "matrix(0.97 0 0 0.97 779 478)", ch); }
        return b;
    }

    fun appendRareTile(b: StringBuilder, i: Int, ch: Int): StringBuilder {
        if (i == 0) { return self.appendTileGlyph(b, "<rect x=\"162\" y=\"386\" width=\"132\" height=\"132\" rx=\"17\" fill=\"#151a1d\" stroke=\"url(#tier-tile)\" stroke-width=\"4\"/>", "matrix(0.84 0 0 0.84 228 476)", ch); }
        if (i == 1) { return self.appendTileGlyph(b, "<rect x=\"304\" y=\"386\" width=\"132\" height=\"132\" rx=\"17\" fill=\"#151a1d\" stroke=\"url(#tier-tile)\" stroke-width=\"4\"/>", "matrix(0.84 0 0 0.84 370 476)", ch); }
        if (i == 2) { return self.appendTileGlyph(b, "<rect x=\"446\" y=\"386\" width=\"132\" height=\"132\" rx=\"17\" fill=\"#151a1d\" stroke=\"url(#tier-tile)\" stroke-width=\"4\"/>", "matrix(0.84 0 0 0.84 512 476)", ch); }
        if (i == 3) { return self.appendTileGlyph(b, "<rect x=\"588\" y=\"386\" width=\"132\" height=\"132\" rx=\"17\" fill=\"#151a1d\" stroke=\"url(#tier-tile)\" stroke-width=\"4\"/>", "matrix(0.84 0 0 0.84 654 476)", ch); }
        if (i == 4) { return self.appendTileGlyph(b, "<rect x=\"730\" y=\"386\" width=\"132\" height=\"132\" rx=\"17\" fill=\"#151a1d\" stroke=\"url(#tier-tile)\" stroke-width=\"4\"/>", "matrix(0.84 0 0 0.84 796 476)", ch); }
        return b;
    }

    fun appendCommonSingleTile(b: StringBuilder, len: Int, i: Int, ch: Int): StringBuilder {
        if (len == 6) {
            if (i == 0) { return self.appendTileGlyph(b, "<rect x=\"252\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 292 474)", ch); }
            if (i == 1) { return self.appendTileGlyph(b, "<rect x=\"340\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 380 474)", ch); }
            if (i == 2) { return self.appendTileGlyph(b, "<rect x=\"428\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 468 474)", ch); }
            if (i == 3) { return self.appendTileGlyph(b, "<rect x=\"516\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 556 474)", ch); }
            if (i == 4) { return self.appendTileGlyph(b, "<rect x=\"604\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 644 474)", ch); }
            if (i == 5) { return self.appendTileGlyph(b, "<rect x=\"692\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 732 474)", ch); }
        }
        if (len == 7) {
            if (i == 0) { return self.appendTileGlyph(b, "<rect x=\"208\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 248 474)", ch); }
            if (i == 1) { return self.appendTileGlyph(b, "<rect x=\"296\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 336 474)", ch); }
            if (i == 2) { return self.appendTileGlyph(b, "<rect x=\"384\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 424 474)", ch); }
            if (i == 3) { return self.appendTileGlyph(b, "<rect x=\"472\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 512 474)", ch); }
            if (i == 4) { return self.appendTileGlyph(b, "<rect x=\"560\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 600 474)", ch); }
            if (i == 5) { return self.appendTileGlyph(b, "<rect x=\"648\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 688 474)", ch); }
            if (i == 6) { return self.appendTileGlyph(b, "<rect x=\"736\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 776 474)", ch); }
        }
        if (len == 8) {
            if (i == 0) { return self.appendTileGlyph(b, "<rect x=\"164\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 204 474)", ch); }
            if (i == 1) { return self.appendTileGlyph(b, "<rect x=\"252\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 292 474)", ch); }
            if (i == 2) { return self.appendTileGlyph(b, "<rect x=\"340\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 380 474)", ch); }
            if (i == 3) { return self.appendTileGlyph(b, "<rect x=\"428\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 468 474)", ch); }
            if (i == 4) { return self.appendTileGlyph(b, "<rect x=\"516\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 556 474)", ch); }
            if (i == 5) { return self.appendTileGlyph(b, "<rect x=\"604\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 644 474)", ch); }
            if (i == 6) { return self.appendTileGlyph(b, "<rect x=\"692\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 732 474)", ch); }
            if (i == 7) { return self.appendTileGlyph(b, "<rect x=\"780\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 820 474)", ch); }
        }
        return b;
    }

    fun appendCommonTopTile(b: StringBuilder, i: Int, ch: Int): StringBuilder {
        if (i == 0) { return self.appendTileGlyph(b, "<rect x=\"164\" y=\"372\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 204 428)", ch); }
        if (i == 1) { return self.appendTileGlyph(b, "<rect x=\"252\" y=\"372\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 292 428)", ch); }
        if (i == 2) { return self.appendTileGlyph(b, "<rect x=\"340\" y=\"372\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 380 428)", ch); }
        if (i == 3) { return self.appendTileGlyph(b, "<rect x=\"428\" y=\"372\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 468 428)", ch); }
        if (i == 4) { return self.appendTileGlyph(b, "<rect x=\"516\" y=\"372\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 556 428)", ch); }
        if (i == 5) { return self.appendTileGlyph(b, "<rect x=\"604\" y=\"372\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 644 428)", ch); }
        if (i == 6) { return self.appendTileGlyph(b, "<rect x=\"692\" y=\"372\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 732 428)", ch); }
        if (i == 7) { return self.appendTileGlyph(b, "<rect x=\"780\" y=\"372\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 820 428)", ch); }
        return b;
    }

    fun appendCommonSecondTile(b: StringBuilder, rem: Int, i: Int, ch: Int): StringBuilder {
        if (rem == 1) {
            if (i == 0) { return self.appendTileGlyph(b, "<rect x=\"472\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 512 520)", ch); }
        }
        if (rem == 2) {
            if (i == 0) { return self.appendTileGlyph(b, "<rect x=\"428\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 468 520)", ch); }
            if (i == 1) { return self.appendTileGlyph(b, "<rect x=\"516\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 556 520)", ch); }
        }
        if (rem == 3) {
            if (i == 0) { return self.appendTileGlyph(b, "<rect x=\"384\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 424 520)", ch); }
            if (i == 1) { return self.appendTileGlyph(b, "<rect x=\"472\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 512 520)", ch); }
            if (i == 2) { return self.appendTileGlyph(b, "<rect x=\"560\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 600 520)", ch); }
        }
        if (rem == 4) {
            if (i == 0) { return self.appendTileGlyph(b, "<rect x=\"340\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 380 520)", ch); }
            if (i == 1) { return self.appendTileGlyph(b, "<rect x=\"428\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 468 520)", ch); }
            if (i == 2) { return self.appendTileGlyph(b, "<rect x=\"516\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 556 520)", ch); }
            if (i == 3) { return self.appendTileGlyph(b, "<rect x=\"604\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 644 520)", ch); }
        }
        if (rem == 5) {
            if (i == 0) { return self.appendTileGlyph(b, "<rect x=\"296\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 336 520)", ch); }
            if (i == 1) { return self.appendTileGlyph(b, "<rect x=\"384\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 424 520)", ch); }
            if (i == 2) { return self.appendTileGlyph(b, "<rect x=\"472\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 512 520)", ch); }
            if (i == 3) { return self.appendTileGlyph(b, "<rect x=\"560\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 600 520)", ch); }
            if (i == 4) { return self.appendTileGlyph(b, "<rect x=\"648\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 688 520)", ch); }
        }
        if (rem == 6) {
            if (i == 0) { return self.appendTileGlyph(b, "<rect x=\"252\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 292 520)", ch); }
            if (i == 1) { return self.appendTileGlyph(b, "<rect x=\"340\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 380 520)", ch); }
            if (i == 2) { return self.appendTileGlyph(b, "<rect x=\"428\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 468 520)", ch); }
            if (i == 3) { return self.appendTileGlyph(b, "<rect x=\"516\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 556 520)", ch); }
            if (i == 4) { return self.appendTileGlyph(b, "<rect x=\"604\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 644 520)", ch); }
            if (i == 5) { return self.appendTileGlyph(b, "<rect x=\"692\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 732 520)", ch); }
        }
        if (rem == 7) {
            if (i == 0) { return self.appendTileGlyph(b, "<rect x=\"208\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 248 520)", ch); }
            if (i == 1) { return self.appendTileGlyph(b, "<rect x=\"296\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 336 520)", ch); }
            if (i == 2) { return self.appendTileGlyph(b, "<rect x=\"384\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 424 520)", ch); }
            if (i == 3) { return self.appendTileGlyph(b, "<rect x=\"472\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 512 520)", ch); }
            if (i == 4) { return self.appendTileGlyph(b, "<rect x=\"560\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 600 520)", ch); }
            if (i == 5) { return self.appendTileGlyph(b, "<rect x=\"648\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 688 520)", ch); }
            if (i == 6) { return self.appendTileGlyph(b, "<rect x=\"736\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 776 520)", ch); }
        }
        if (rem == 8) {
            if (i == 0) { return self.appendTileGlyph(b, "<rect x=\"164\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 204 520)", ch); }
            if (i == 1) { return self.appendTileGlyph(b, "<rect x=\"252\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 292 520)", ch); }
            if (i == 2) { return self.appendTileGlyph(b, "<rect x=\"340\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 380 520)", ch); }
            if (i == 3) { return self.appendTileGlyph(b, "<rect x=\"428\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 468 520)", ch); }
            if (i == 4) { return self.appendTileGlyph(b, "<rect x=\"516\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 556 520)", ch); }
            if (i == 5) { return self.appendTileGlyph(b, "<rect x=\"604\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 644 520)", ch); }
            if (i == 6) { return self.appendTileGlyph(b, "<rect x=\"692\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 732 520)", ch); }
            if (i == 7) { return self.appendTileGlyph(b, "<rect x=\"780\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/>", "matrix(0.52 0 0 0.52 820 520)", ch); }
        }
        return b;
    }

    fun appendUsernameTiles(b: StringBuilder, usernameCell: Cell, username_len: Int): StringBuilder {
        let cursor: Slice = usernameCell.beginParse();
        let i: Int = 0;
        if (username_len == 4) {
            while (i < 4) {
                let ch: Int = cursor.loadUint(8);
                b = self.appendEpicTile(b, i, ch);
                i += 1;
            }
            return b;
        }
        if (username_len == 5) {
            while (i < 5) {
                let ch: Int = cursor.loadUint(8);
                b = self.appendRareTile(b, i, ch);
                i += 1;
            }
            return b;
        }
        if (username_len <= 8) {
            while (i < username_len) {
                let ch: Int = cursor.loadUint(8);
                b = self.appendCommonSingleTile(b, username_len, i, ch);
                i += 1;
            }
            return b;
        }
        while (i < 8) {
            let ch: Int = cursor.loadUint(8);
            b = self.appendCommonTopTile(b, i, ch);
            i += 1;
        }
        let j: Int = 0;
        let rem: Int = username_len - 8;
        while (j < rem) {
            let ch: Int = cursor.loadUint(8);
            b = self.appendCommonSecondTile(b, rem, j, ch);
            j += 1;
        }
        return b;
    }

    fun appendSvgUsernameLine(b: StringBuilder, usernameCell: Cell, username_len: Int): StringBuilder {
        let cursor: Slice = usernameCell.beginParse();
        let i: Int = 0;
        while (i < username_len) {
            let ch: Int = cursor.loadUint(8);
            b = self.appendUsernameSvgChar(b, ch);
            i += 1;
        }
        return b;
    }

    fun appendLengthNumber(b: StringBuilder, n: Int): StringBuilder {
        if (n >= 10) {
            let tens: Int = n / 10;
            b = self.appendUsernameSvgChar(b, 48 + tens);
        }
        b = self.appendUsernameSvgChar(b, 48 + (n % 10));
        return b;
    }

    fun appendSvgDefs(b: StringBuilder, username_len: Int): StringBuilder {
        b.append("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1024 1024\" role=\"img\"><defs><linearGradient id=\"bg\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#0d1113\"/><stop offset=\"1\" stop-color=\"#0b0d0f\"/></linearGradient><linearGradient id=\"teal\" x1=\"0\" y1=\"1\" x2=\"1\" y2=\"0\"><stop offset=\"0\" stop-color=\"#2be6ad\"/><stop offset=\".55\" stop-color=\"#30d5b0\"/><stop offset=\"1\" stop-color=\"#25c99b\"/></linearGradient>");
        if (username_len == 4) {
            b.append("<linearGradient id=\"common-line\" x1=\"104\" y1=\"0\" x2=\"920\" y2=\"0\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#0b0d0f\" stop-opacity=\"0\"/><stop offset=\".06\" stop-color=\"#8d6727\" stop-opacity=\".74\"/><stop offset=\".5\" stop-color=\"#f0c76b\"/><stop offset=\".94\" stop-color=\"#8d6727\" stop-opacity=\".74\"/><stop offset=\"1\" stop-color=\"#0b0d0f\" stop-opacity=\"0\"/></linearGradient><linearGradient id=\"tier-tile\" x1=\"0\" y1=\"374\" x2=\"0\" y2=\"526\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#f6d98b\"/><stop offset=\".48\" stop-color=\"#d7ad57\"/><stop offset=\"1\" stop-color=\"#8d6727\"/></linearGradient>");
        } else {
            if (username_len == 5) {
                b.append("<linearGradient id=\"common-line\" x1=\"104\" y1=\"0\" x2=\"920\" y2=\"0\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#0b0d0f\" stop-opacity=\"0\"/><stop offset=\".06\" stop-color=\"#727b80\" stop-opacity=\".78\"/><stop offset=\".5\" stop-color=\"#e1e8e6\"/><stop offset=\".94\" stop-color=\"#727b80\" stop-opacity=\".78\"/><stop offset=\"1\" stop-color=\"#0b0d0f\" stop-opacity=\"0\"/></linearGradient><linearGradient id=\"tier-tile\" x1=\"0\" y1=\"386\" x2=\"0\" y2=\"518\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#eef4f2\"/><stop offset=\".48\" stop-color=\"#b9c3c3\"/><stop offset=\"1\" stop-color=\"#687279\"/></linearGradient>");
            } else {
                b.append("<linearGradient id=\"common-line\" x1=\"104\" y1=\"0\" x2=\"920\" y2=\"0\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#0b0d0f\" stop-opacity=\"0\"/><stop offset=\".06\" stop-color=\"#1e262a\" stop-opacity=\".62\"/><stop offset=\".5\" stop-color=\"#30d5b0\"/><stop offset=\".94\" stop-color=\"#1e262a\" stop-opacity=\".62\"/><stop offset=\"1\" stop-color=\"#0b0d0f\" stop-opacity=\"0\"/></linearGradient>");
            }
        }
        b.append("</defs>");
        return b;
    }

    fun appendCaption(b: StringBuilder, username_len: Int): StringBuilder {
        if (username_len == 4) {
            b.append("<path fill=\"#b7aa8e\" transform=\"translate(384 640)\" d=\"");
            b = self.appendArt(b, 204);
            b.append("\"/>");
            b.append("<path fill=\"#b7aa8e\" transform=\"translate(397 640)\" d=\"");
            b = self.appendArt(b, 306);
            b.append("\"/>");
            return b;
        }
        if (username_len == 5) {
            b.append("<path fill=\"#aeb8b8\" transform=\"translate(384 640)\" d=\"");
            b = self.appendArt(b, 205);
            b.append("\"/>");
            b.append("<path fill=\"#aeb8b8\" transform=\"translate(397 640)\" d=\"");
            b = self.appendArt(b, 306);
            b.append("\"/>");
            return b;
        }
        if (username_len == 6) {
            b.append("<path fill=\"#96a19c\" transform=\"translate(354 640)\" d=\"");
            b = self.appendArt(b, 206);
            b.append("\"/>");
            b.append("<path fill=\"#96a19c\" transform=\"translate(367 640)\" d=\"");
            b = self.appendArt(b, 307);
            b.append("\"/>");
            return b;
        }
        if (username_len == 7) {
            b.append("<path fill=\"#96a19c\" transform=\"translate(354 640)\" d=\"");
            b = self.appendArt(b, 207);
            b.append("\"/>");
            b.append("<path fill=\"#96a19c\" transform=\"translate(367 640)\" d=\"");
            b = self.appendArt(b, 307);
            b.append("\"/>");
            return b;
        }
        if (username_len == 8) {
            b.append("<path fill=\"#96a19c\" transform=\"translate(354 640)\" d=\"");
            b = self.appendArt(b, 208);
            b.append("\"/>");
            b.append("<path fill=\"#96a19c\" transform=\"translate(367 640)\" d=\"");
            b = self.appendArt(b, 307);
            b.append("\"/>");
            return b;
        }
        if (username_len == 9) {
            b.append("<path fill=\"#96a19c\" transform=\"translate(354 640)\" d=\"");
            b = self.appendArt(b, 209);
            b.append("\"/>");
            b.append("<path fill=\"#96a19c\" transform=\"translate(367 640)\" d=\"");
            b = self.appendArt(b, 307);
            b.append("\"/>");
            return b;
        }
        if (username_len == 10) {
            b.append("<path fill=\"#96a19c\" transform=\"translate(348 640)\" d=\"");
            b = self.appendArt(b, 201);
            b.append("\"/>");
            b.append("<path fill=\"#96a19c\" transform=\"translate(361 640)\" d=\"");
            b = self.appendArt(b, 200);
            b.append("\"/>");
            b.append("<path fill=\"#96a19c\" transform=\"translate(374 640)\" d=\"");
            b = self.appendArt(b, 307);
            b.append("\"/>");
            return b;
        }
        if (username_len == 11) {
            b.append("<path fill=\"#96a19c\" transform=\"translate(348 640)\" d=\"");
            b = self.appendArt(b, 201);
            b.append("\"/>");
            b.append("<path fill=\"#96a19c\" transform=\"translate(361 640)\" d=\"");
            b = self.appendArt(b, 201);
            b.append("\"/>");
            b.append("<path fill=\"#96a19c\" transform=\"translate(374 640)\" d=\"");
            b = self.appendArt(b, 307);
            b.append("\"/>");
            return b;
        }
        if (username_len == 12) {
            b.append("<path fill=\"#96a19c\" transform=\"translate(348 640)\" d=\"");
            b = self.appendArt(b, 201);
            b.append("\"/>");
            b.append("<path fill=\"#96a19c\" transform=\"translate(361 640)\" d=\"");
            b = self.appendArt(b, 202);
            b.append("\"/>");
            b.append("<path fill=\"#96a19c\" transform=\"translate(374 640)\" d=\"");
            b = self.appendArt(b, 307);
            b.append("\"/>");
            return b;
        }
        if (username_len == 13) {
            b.append("<path fill=\"#96a19c\" transform=\"translate(348 640)\" d=\"");
            b = self.appendArt(b, 201);
            b.append("\"/>");
            b.append("<path fill=\"#96a19c\" transform=\"translate(361 640)\" d=\"");
            b = self.appendArt(b, 203);
            b.append("\"/>");
            b.append("<path fill=\"#96a19c\" transform=\"translate(374 640)\" d=\"");
            b = self.appendArt(b, 307);
            b.append("\"/>");
            return b;
        }
        if (username_len == 14) {
            b.append("<path fill=\"#96a19c\" transform=\"translate(348 640)\" d=\"");
            b = self.appendArt(b, 201);
            b.append("\"/>");
            b.append("<path fill=\"#96a19c\" transform=\"translate(361 640)\" d=\"");
            b = self.appendArt(b, 204);
            b.append("\"/>");
            b.append("<path fill=\"#96a19c\" transform=\"translate(374 640)\" d=\"");
            b = self.appendArt(b, 307);
            b.append("\"/>");
            return b;
        }
        if (username_len == 15) {
            b.append("<path fill=\"#96a19c\" transform=\"translate(348 640)\" d=\"");
            b = self.appendArt(b, 201);
            b.append("\"/>");
            b.append("<path fill=\"#96a19c\" transform=\"translate(361 640)\" d=\"");
            b = self.appendArt(b, 205);
            b.append("\"/>");
            b.append("<path fill=\"#96a19c\" transform=\"translate(374 640)\" d=\"");
            b = self.appendArt(b, 307);
            b.append("\"/>");
            return b;
        }
        if (username_len == 16) {
            b.append("<path fill=\"#96a19c\" transform=\"translate(348 640)\" d=\"");
            b = self.appendArt(b, 201);
            b.append("\"/>");
            b.append("<path fill=\"#96a19c\" transform=\"translate(361 640)\" d=\"");
            b = self.appendArt(b, 206);
            b.append("\"/>");
            b.append("<path fill=\"#96a19c\" transform=\"translate(374 640)\" d=\"");
            b = self.appendArt(b, 307);
            b.append("\"/>");
            return b;
        }
        return b;
    }

    fun appendSvgShell(b: StringBuilder, usernameCell: Cell, username_len: Int): StringBuilder {
        b = self.appendSvgDefs(b, username_len);
        b.append("<rect width=\"1024\" height=\"1024\" fill=\"url(#bg)\"/><rect x=\"76\" y=\"76\" width=\"872\" height=\"872\" rx=\"44\" fill=\"#111417\" stroke=\"#283136\" stroke-width=\"2\"/><rect x=\"104\" y=\"104\" width=\"816\" height=\"816\" rx=\"28\" fill=\"#0b0d0f\" stroke=\"#1e262a\" stroke-width=\"2\"/>");
        b.append("<path d=\"M104 104h816\" stroke=\"url(#common-line)\" stroke-width=\"6\" stroke-linecap=\"round\"/><path d=\"M104 920h816\" stroke=\"url(#common-line)\" stroke-width=\"4\" stroke-linecap=\"round\" opacity=\".44\"/>");
        b.append("<rect x=\"124\" y=\"122\" width=\"94\" height=\"94\" rx=\"22\" fill=\"#111417\" stroke=\"#1e262a\"/><g transform=\"matrix(0.160156 0 0 -0.160156 130 210)\"><path fill=\"url(#teal)\" fill-rule=\"evenodd\" d=\"M167.5 432.1 L330.5 432.1 L346.5 429.9 L364.5 424.8 L380.5 417.7 L393.5 409.6 L404.5 401.0 L416.0 389.5 L425.8 376.5 L435.9 358.5 L441.7 343.5 L445.9 325.5 L446.9 296.5 L445.8 285.5 L442.8 271.5 L435.7 251.5 L425.9 233.5 L416.9 221.5 L402.5 207.1 L387.5 196.1 L362.5 184.1 L348.5 180.1 L334.5 178.0 L221.5 177.2 L220.5 79.2 L137.5 79.4 L137.2 139.5 L166.5 140.2 L166.8 174.5 L136.5 175.1 L135.6 174.5 L135.7 163.5 L134.5 162.8 L104.1 163.5 L104.5 192.7 L134.5 192.9 L135.5 193.5 L135.4 220.5 L136.2 221.5 L166.8 222.5 L166.5 253.0 L135.5 253.3 L134.5 235.2 L105.5 235.1 L104.1 236.5 L104.3 264.5 L134.5 265.3 L135.5 292.5 L197.5 292.7 L198.4 293.5 L198.0 323.5 L166.8 324.5 L167.3 364.5 L198.4 365.5 L198.3 394.5 L166.9 395.5 L166.7 430.5 L167.5 432.1 Z M104.5 407.6 L134.9 407.5 L134.5 377.7 L104.5 377.9 L104.5 407.6 Z M221.5 372.3 L221.5 237.2 L322.5 237.1 L329.5 238.1 L342.5 242.1 L352.5 247.4 L359.5 252.8 L369.6 263.5 L377.0 275.5 L381.5 288.5 L383.1 298.5 L382.7 316.5 L379.7 327.5 L374.8 338.5 L368.9 347.5 L358.5 357.9 L344.5 366.7 L332.5 370.8 L322.5 372.4 L221.5 372.3 Z M65.5 324.3 L93.5 324.3 L93.9 294.5 L64.9 294.5 L64.6 322.5 L65.5 324.3 Z\"/></g>");
        b.append("<path fill=\"#f4f7f5\" d=\""); b = self.appendArt(b, 300); b.append("\"/>");
        if (username_len == 4) { b.append("<rect x=\"732\" y=\"134\" width=\"156\" height=\"58\" rx=\"12\" fill=\"#17130b\" stroke=\"#d7ad57\" stroke-opacity=\".68\"/>"); b.append("<path fill=\"#f0c76b\" d=\""); b = self.appendArt(b, 302); b.append("\"/>"); b.append("<circle cx=\"512\" cy=\"512\" r=\"280\" fill=\"none\" stroke=\"#d7ad57\" stroke-width=\"2\" opacity=\".09\"/><circle cx=\"512\" cy=\"512\" r=\"218\" fill=\"none\" stroke=\"#f0c76b\" stroke-width=\"2\" opacity=\".13\"/>"); }
        else { if (username_len == 5) { b.append("<rect x=\"732\" y=\"134\" width=\"156\" height=\"58\" rx=\"12\" fill=\"#14171a\" stroke=\"#b9c3c3\" stroke-opacity=\".68\"/>"); b.append("<path fill=\"#d9e0df\" d=\""); b = self.appendArt(b, 303); b.append("\"/>"); b.append("<circle cx=\"512\" cy=\"512\" r=\"280\" fill=\"none\" stroke=\"#b9c3c3\" stroke-width=\"2\" opacity=\".09\"/><circle cx=\"512\" cy=\"512\" r=\"218\" fill=\"none\" stroke=\"#d9e0df\" stroke-width=\"2\" opacity=\".13\"/>"); } else { b.append("<rect x=\"732\" y=\"134\" width=\"156\" height=\"58\" rx=\"12\" fill=\"#111417\" stroke=\"#283136\"/>"); b.append("<path fill=\"#96a19c\" d=\""); b = self.appendArt(b, 304); b.append("\"/>"); b.append("<circle cx=\"512\" cy=\"512\" r=\"280\" fill=\"none\" stroke=\"#30d5b0\" stroke-width=\"2\" opacity=\".09\"/><circle cx=\"512\" cy=\"512\" r=\"218\" fill=\"none\" stroke=\"#66726d\" stroke-width=\"2\" opacity=\".13\"/>"); } }
        b.append("<rect x=\"122\" y=\"312\" width=\"780\" height=\"350\" rx=\"32\" fill=\"#111417\" fill-opacity=\".94\" stroke=\"#283136\" stroke-width=\"2\"/><g>");
        b = self.appendUsernameTiles(b, usernameCell, username_len);
        b.append("</g>");
        if (username_len == 4) { b.append("<path fill=\"#f0c76b\" d=\""); b = self.appendArt(b, 301); b.append("\"/>"); }
        else { if (username_len == 5) { b.append("<path fill=\"#d9e0df\" d=\""); b = self.appendArt(b, 301); b.append("\"/>"); } else { b.append("<path fill=\"#30d5b0\" d=\""); b = self.appendArt(b, 301); b.append("\"/>"); } }
        if (username_len == 4) { b.append("<path d=\"M176 612h672\" stroke=\"#d7ad57\" stroke-width=\"4\" stroke-linecap=\"round\" opacity=\".70\"/>"); }
        else { if (username_len == 5) { b.append("<path d=\"M176 612h672\" stroke=\"#b9c3c3\" stroke-width=\"4\" stroke-linecap=\"round\" opacity=\".70\"/>"); } else { b.append("<path d=\"M176 612h672\" stroke=\"#30d5b0\" stroke-width=\"4\" stroke-linecap=\"round\" opacity=\".65\"/>"); } }
        b = self.appendCaption(b, username_len);
        b.append("<path fill=\"#66726d\" d=\""); b = self.appendArt(b, 305); b.append("\"/></svg>");
        return b;
    }

    fun imageDataCell(usernameCell: Cell, username_len: Int): Cell {
        let b: StringBuilder = beginTailString();
        b = self.appendSvgShell(b, usernameCell, username_len);
        return b.toCell();
    }


    get fun get_username_price(name_len: Int): UsernamePriceView {
        if (!self.isValidNameLength(name_len)) {
            return UsernamePriceView { valid_length: false, price_ath_atomic: 0 };
        }
        return UsernamePriceView { valid_length: true, price_ath_atomic: self.priceForLength(name_len) };
    }

    get fun get_username_item_address(name_hash: Int): Address {
        return self.deriveItemAddress(name_hash);
    }

    get fun get_nft_address_by_index(index: Int): Address {
        return self.deriveItemAddress(index);
    }

    get fun get_art_count(): Int { return self.art_count; }
    get fun get_art_sealed(): Bool { return self.art_sealed; }
    get fun get_meta_count(): Int { return self.meta_count; }       // clean-11
    get fun get_meta_sealed(): Bool { return self.meta_sealed; }    // clean-11

    // clean-11: TEP-66 royalty — 5% of each secondary sale to a fixed owner-chosen wallet_v5r1.
    // TEP-66 mandates the get-method be named exactly `royalty_params` (NOT `get_`-prefixed) — marketplaces
    // resolve the royalty by that method id; a `get_royalty_params` name would silently hide the royalty.
    get fun royalty_params(): RoyaltyParamsView {
        return RoyaltyParamsView {
            numerator: 5,
            denominator: 100,
            destination: address("UQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOATH")
        };
    }

    get fun get_nft_content(index: Int, individual_content: Cell): Cell {
        // Collection completes the item partial content (TEP-62): read the username from the
        // item name and ADD the rendered on-chain SVG image keys. The item carries no art.
        let content: UsernameNftOnchainContent = UsernameNftOnchainContent.fromCell(individual_content);
        let nameOpt: Cell? = content.metadata.get(USERNAME_COLLECTION_METADATA_KEY_NAME);
        throwUnless(19350, nameOpt != null);
        let s: Slice = nameOpt!!.beginParse();
        s.loadUint(8);                       // skip snake-string marker byte
        let remaining: Int = s.bits();       // username_len*8 + 32 (".ath")
        throwUnless(19351, remaining >= 64);
        throwUnless(19352, (remaining - 32) % 8 == 0);
        let username_len: Int = (remaining - 32) / 8;
        throwUnless(19353, (username_len >= 4) && (username_len <= USERNAME_MAX_LENGTH));
        let usernameCell: Cell = beginCell().storeSlice(s.loadBits(username_len * 8)).endCell();
        let metadata: map<Int as uint256, Cell> = content.metadata;
        // image_data = on-chain raw SVG (text-as-paths) — renders fontless on tonapi/Tonkeeper
        // AND GetGems (verified live on an image_data-only probe). The percent `image` field was
        // REMOVED: its font-based statics bloated the registry code past the 65535 deploy limit.
        metadata.set(USERNAME_COLLECTION_METADATA_KEY_IMAGE_DATA, self.imageDataCell(usernameCell, username_len));
        return UsernameNftOnchainContent { marker: 0, metadata: metadata }.toCell();
    }

    get fun get_collection_data(): UsernameCollectionDataView {
        return UsernameCollectionDataView {
            next_item_index: USERNAME_COLLECTION_UNORDERED_NEXT_INDEX,
            collection_content: self.collectionContent(),
            owner_address: self.treasury_ath_receiver_address
        };
    }


    get fun get_pending_mint(name_hash: Int): PendingUsernameMintView {
        let pendingOpt: PendingUsernameMint? = self.pending_mints.get(name_hash);
        if (pendingOpt == null) {
            return PendingUsernameMintView {
                exists: false,
                query_id: 0,
                sender_key: 0,
                owner_wallet: self.official_ath_wallet_address,
                name_hash: 0,
                price_paid: 0,
                item_address: self.official_ath_wallet_address,
                item_deploy_value: 0,
                created_at: 0
            };
        }
        let pending: PendingUsernameMint = pendingOpt!!;
        return PendingUsernameMintView {
            exists: true,
            query_id: pending.query_id,
            sender_key: pending.sender_key,
            owner_wallet: pending.owner_wallet,
            name_hash: pending.name_hash,
            price_paid: pending.price_paid,
            item_address: pending.item_address,
            item_deploy_value: pending.item_deploy_value,
            created_at: pending.created_at
        };
    }

    get fun get_pending_treasury_flush(query_id: Int): PendingAthTreasuryFlushView {
        let pendingOpt: PendingAthTreasuryFlush? = self.pending_treasury_flushes.get(query_id);
        if (pendingOpt == null) {
            return PendingAthTreasuryFlushView {
                exists: false,
                amount: 0,
                recipient_ath_wallet: self.official_ath_wallet_address,
                created_at: 0
            };
        }
        let pending: PendingAthTreasuryFlush = pendingOpt!!;
        return PendingAthTreasuryFlushView {
            exists: true,
            amount: pending.amount,
            recipient_ath_wallet: pending.recipient_ath_wallet,
            created_at: pending.created_at
        };
    }

    get fun get_pending_burn_flush(query_id: Int): PendingAthBurnFlushView {
        let pendingOpt: PendingAthBurnFlush? = self.pending_burn_flushes.get(query_id);
        if (pendingOpt == null) {
            return PendingAthBurnFlushView {
                exists: false,
                amount: 0,
                created_at: 0
            };
        }
        let pending: PendingAthBurnFlush = pendingOpt!!;
        return PendingAthBurnFlushView {
            exists: true,
            amount: pending.amount,
            created_at: pending.created_at
        };
    }

    get fun get_ath_wallet_address(owner_wallet: Address): Address {
        return self.deriveAthWalletAddress(owner_wallet);
    }

    get fun get_global(): UsernameRegistryGlobalView {
        return UsernameRegistryGlobalView {
            sealed: self.sealed,
            official_ath_wallet_bound: self.official_ath_wallet_bound,
            deployment_manifest_hash: self.deployment_manifest_hash,
            genesis_config_hash: self.genesis_config_hash,
            official_ath_wallet_address: self.official_ath_wallet_address,
            genesis_controller_address: self.genesis_controller_address,
            pending_mint_count: self.pending_mint_count,
            treasury_due_ath: self.treasury_due_ath,
            burn_due_ath: self.burn_due_ath,
            pending_treasury_flush_count: self.pending_treasury_flush_count,
            pending_burn_flush_count: self.pending_burn_flush_count,
            pending_mint_stale_ttl: USERNAME_PENDING_MINT_STALE_TTL
        };
    }

    receive() {
        throw(19099);
    }
}
