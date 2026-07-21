// Platho v1 ProfileRegistry.
// Prices and settles paid wallet-level avatar updates: 100 ATH, split 50/50 between treasury and burn due.
// Avatar image bytes live as public CapsuleHub avatar capsules; the authenticated POINTER to them lives in the
// buyer's own KeyShard — see below — and this contract holds no per-profile state at all.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// WHY THE POINTER LEFT THIS CONTRACT (2026-07-21)
//
// `current_avatar_versions` + `avatar_records` MEASURED at exactly 5.0000 cells per profile, linear over 1200
// owners, against 149 cells of code: a ceiling of (65536 - 149 - 3) / 5 = 13,076 profiles on a product whose
// floor is millions of users. The refusal would have landed in the ACTION phase as code 50 while COMPUTE reported
// exit 0 — nothing would have gone red; paid avatar updates would simply have stopped working at profile 13,077.
//
// The cure that worked for names (delete the map in favour of the contract that already held the record) had no
// counterpart here: nothing held a wallet's current pointer authoritatively, and CapsuleHub's entry id is global
// and evictable, so it is a hint rather than an address. The pointer therefore moved to the one per-wallet
// contract that already exists and that a client already reads when resolving a contact: KeyShard.
//
// THE COST OF MOVING IT IS THAT THE PAYMENT IS NO LONGER ATOMIC. It used to settle in one compute phase: validate,
// write, ack. The ack is non-bounceable and closes the payment IRREVOCABLY (the ATH becomes this registry's at
// ATHWallet:1010), and after it `refund_pending_notification` throws 14332 — so acking before the pointer landed
// would mean a buyer who paid and got nothing, with no way back. Hence the two-phase settle below, which is not
// a new invention: UsernameRegistry already works exactly this way (pending_mints + UsernameItemDeployedAck +
// bounced<InitializeUsernameItem>), and this is the same machine with the shard in the item's place.

import "./ATHWallet.tact";
import "./KeyShard.tact";

const PROFILE_AVATAR_PRICE_ATH: Int = 100000000000; // 100 ATH atomic units
const PROFILE_STATE_GROWTH_EXEC_RESERVE: Int = 3000000;
// Value carried by the pointer write to the buyer's KeyShard. It is NOT spent: the shard hands the remainder back
// with the ack (success), or the network hands it back with the bounce (refusal). It is sized so that the BOUNCE
// branch arrives holding more than PROFILE_ATH_NOTIFICATION_REFUND_VALUE, because that branch has to fund the ATH
// refund out of what came home. [MEASURE BEFORE SEAL — pinned in tests/profile-avatar-two-phase.test.ts.]
const PROFILE_KEY_SHARD_WRITE_VALUE: Int = 50000000;
// Identical in value and in reasoning to USERNAME_ATH_NOTIFICATION_REFUND_VALUE, which was raised 12M->45M on
// 2026-07-20 after a REFUND was measured arriving at 6,971,064 against the 26M its recipient demands at gate
// 14212 — the ATH was stranded on the registry's official wallet and the buyer lost 100 ATH. The sender-side gate
// on the same money (14335) asks for only 12M, so the window is invisible unless the arrival is measured. Any
// refund this contract emits travels the identical hop, so it carries the identical floor.
const PROFILE_ATH_NOTIFICATION_REFUND_VALUE: Int = 45000000;
const PROFILE_AVATAR_SETTLE_EXEC_RESERVE: Int = 5000000;
// A pending write is cleared by the ack or by the bounce, both of which arrive within seconds. This TTL exists
// only for the case where NEITHER does — and it refunds rather than merely forgetting, because a stranded entry
// otherwise costs 3 cells of this account FOREVER, which is the second, independent consumer of the same 65536
// budget that the flush maps already demonstrated. Deliberately as long as ATH_REGISTRY_PENDING_TTL: pruning a
// LIVE pending would refund a buyer whose avatar did land, so the window must be far beyond any real settlement.
const PROFILE_AVATAR_WRITE_STALE_TTL: Int = 604800; // 7 days
const PROFILE_ATH_NOTIFICATION_ACK_VALUE: Int = 1000000;
const PROFILE_AVATAR_EXCESS_REFUND_MIN_VALUE: Int = 100000;
const PROFILE_VAULT_EXCESS_REFUND_EXEC_RESERVE: Int = 2000000;
const PROFILE_EXCESS_REFUND_FORWARD_RESERVE: Int = 200000;
const PROFILE_ATH_TRANSFER_EXEC_RESERVE: Int = 48000000; // raised 30M->48M to track the ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT raise (2M->20M, +18M): the official ATH wallet's ATHTransferRequest required_value = EXEC_RESERVE(2M)+INTERNAL_TRANSFER_ACK(3M)+STORAGE_ENDOWMENT(20M)+FWD_FEE_ALLOWANCE(21M)+OWNER_REQUEST_EXEC(2M) = 48M.
const PROFILE_ATH_BURN_EXEC_RESERVE: Int = 5000000;
const PROFILE_DUE_FLUSH_LOCAL_EXEC_RESERVE: Int = 2000000;
const PROFILE_SPLIT_BASE_BPS: Int = 10000;
const PROFILE_TREASURY_SHARE_BPS: Int = 5000;
const PROFILE_AVATAR_MAX_PARTS: Int = 2;
const PROFILE_AVATAR_MEDIA_FORMAT_WEBP: Int = 1;

message(0x50A61101) BindProfileOfficialAthWallet {
    deployment_manifest_hash: Int as uint256;
    official_ath_wallet_address: Address;
}

message(0x3A12D1AD) SealGenesis {
    deployment_manifest_hash: Int as uint256;
}

message(0x50A61110) FlushProfileTreasuryAthDue {
    query_id: Int as uint64;
}

message(0x50A61111) FlushProfileBurnAthDue {
    query_id: Int as uint64;
}

message(0x50A61120) ProfileRegistryTopUpStorageReserve {}

message(0x50A61121) ProfileAvatarTonExcessRefund {
    query_id: Int as uint64;
    owner_wallet: Address;
    amount: Int as uint128;
}

message(0x50A61123) PruneStaleAvatarWrite {
    write_id: Int as uint64;
}

// The payment held open while its pointer write is in flight to the buyer's KeyShard. Cleared by the shard's
// ack (settle), by the bounce (refund), or by PruneStaleAvatarWrite after the TTL (refund). Keyed by a
// registry-assigned write_id rather than by the buyer's query_id, so that one buyer cannot occupy an id another
// buyer needs — and so the key survives a bounce, which preserves only the first 256 bits of the body.
struct PendingProfileAvatarWrite {
    query_id: Int as uint64;
    sender_key: Int as uint160;
    amount: Int as uint128;
    owner_wallet: Address;
    created_at: Int as uint64;
}

struct PendingProfileAvatarWriteView {
    exists: Bool;
    query_id: Int;
    sender_key: Int;
    amount: Int;
    owner_wallet: Address;
    created_at: Int;
}

struct PendingProfileTreasuryFlush {
    amount: Int as uint128;
    recipient_ath_wallet: Address;
    created_at: Int as uint64;
}

struct PendingProfileBurnFlush {
    amount: Int as uint128;
    created_at: Int as uint64;
}

struct PendingProfileTreasuryFlushView {
    exists: Bool;
    amount: Int;
    recipient_ath_wallet: Address;
    created_at: Int;
}

struct PendingProfileBurnFlushView {
    exists: Bool;
    amount: Int;
    created_at: Int;
}

struct ProfileRegistryGlobalView {
    sealed: Bool;
    official_ath_wallet_bound: Bool;
    deployment_manifest_hash: Int;
    genesis_config_hash: Int;
    official_ath_wallet_address: Address;
    ath_master_address: Address;
    treasury_ath_receiver_address: Address;
    genesis_controller_address: Address;
    profile_count: Int;
    pending_avatar_write_count: Int;
    next_avatar_write_id: Int;
    treasury_due_ath: Int;
    burn_due_ath: Int;
    pending_treasury_flush_count: Int;
    pending_burn_flush_count: Int;
}

contract ProfileRegistry {
    official_ath_wallet_address: Address;
    ath_master_address: Address;
    treasury_ath_receiver_address: Address;
    official_ath_wallet_bound: Bool;
    sealed: Bool;
    deployment_manifest_hash: Int as uint256;
    genesis_config_hash: Int as uint256;
    genesis_controller_address: Address;
    profile_count: Int as uint64;
    treasury_due_ath: Int as uint128;
    burn_due_ath: Int as uint128;
    // The ONLY maps left. Every one of them is in-flight state that clears on settlement — none of them grows
    // with the number of profiles, which is the whole point of this contract's 2026-07-21 rewrite.
    pending_avatar_writes: map<Int, PendingProfileAvatarWrite>;
    pending_avatar_write_count: Int as uint64;
    next_avatar_write_id: Int as uint64;
    pending_treasury_flushes: map<Int, PendingProfileTreasuryFlush>;
    pending_treasury_flush_count: Int as uint64;
    pending_burn_flushes: map<Int, PendingProfileBurnFlush>;
    pending_burn_flush_count: Int as uint64;

    init(official_ath_wallet_address: Address, ath_master_address: Address, treasury_ath_receiver_address: Address, sealed: Bool, deployment_manifest_hash: Int, genesis_config_hash: Int, genesis_controller_address: Address) {
        self.official_ath_wallet_address = official_ath_wallet_address;
        self.ath_master_address = ath_master_address;
        self.treasury_ath_receiver_address = treasury_ath_receiver_address;
        self.official_ath_wallet_bound = false;
        self.sealed = sealed;
        self.deployment_manifest_hash = deployment_manifest_hash;
        self.genesis_config_hash = genesis_config_hash;
        self.genesis_controller_address = genesis_controller_address;
        self.profile_count = 0;
        self.treasury_due_ath = 0;
        self.burn_due_ath = 0;
        self.pending_avatar_writes = emptyMap();
        self.pending_avatar_write_count = 0;
        self.next_avatar_write_id = 1;
        self.pending_treasury_flushes = emptyMap();
        self.pending_treasury_flush_count = 0;
        self.pending_burn_flushes = emptyMap();
        self.pending_burn_flush_count = 0;
    }

    fun requireUnsealed() {
        throwUnless(21000, !self.sealed);
    }

    fun requireSealed() {
        throwUnless(21100, self.sealed);
    }

    fun requireGenesisController() {
        throwUnless(21030, sender() == self.genesis_controller_address);
    }

    fun isBasechainAddress(address: Address): Bool {
        let std: StdAddress = parseStdAddress(address.asSlice());
        return std.workchain == 0;
    }

    fun deriveAthWalletAddress(owner_wallet: Address): Address {
        let owner_std: StdAddress = parseStdAddress(owner_wallet.asSlice());
        let wallet_init: StateInit = initOf ATHWallet(0, owner_wallet, self.ath_master_address);
        return contractAddressExt(owner_std.workchain, wallet_init.code, wallet_init.data);
    }

    // Where a wallet's avatar pointer lives. KeyShard takes THIS registry's address as its second init argument,
    // so the derivation is closed — a shard deployed against any other registry lands somewhere no client will
    // ever look — and there is no build cycle to break: KeyShard's code does not mention this contract, so this
    // contract may embed KeyShard's code to derive with. That is why there is no BindKeyShardCode ceremony step.
    fun deriveKeyShardAddress(owner_wallet: Address): Address {
        return contractAddress(initOf KeyShard(owner_wallet, myAddress()));
    }

    fun requireValidAvatarPointerFields(owner_wallet: Address, avatar_hash: Int, avatar_stream_id: Int, avatar_part_count: Int, media_format: Int) {
        throwUnless(21120, self.isBasechainAddress(owner_wallet));
        throwUnless(21121, avatar_hash != 0);
        throwUnless(21122, avatar_stream_id != 0);
        throwUnless(21123, avatar_part_count > 0);
        throwUnless(21124, avatar_part_count <= PROFILE_AVATAR_MAX_PARTS);
        throwUnless(21125, media_format == PROFILE_AVATAR_MEDIA_FORMAT_WEBP);
    }

    // Addressed to the official ATH wallet EXPLICITLY, not to sender(). Under the one-phase design the ack was
    // emitted while still handling the notification, so sender() was the official wallet; it is now emitted while
    // handling the SHARD's ack, where sender() is the shard. This line is the seam where a mechanical port of the
    // old code would have sent the settlement to the wrong contract and stranded every payment.
    fun sendAthNotificationAck(query_id: Int, sender_key: Int, amount: Int) {
        message(MessageParameters {
            to: self.official_ath_wallet_address,
            value: PROFILE_ATH_NOTIFICATION_ACK_VALUE,
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
            value: PROFILE_ATH_NOTIFICATION_REFUND_VALUE,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            body: AthTransferNotificationRefund {
                query_id: query_id,
                sender_key: sender_key,
                amount: amount
            }.toCell()
        });
    }

    // Shared by every path that gives up on a pending write: the bounce and the stale prune. The ATH goes home to
    // the buyer and the entry leaves this account.
    fun abandonPendingAvatarWrite(write_id: Int) {
        let pendingOpt: PendingProfileAvatarWrite? = self.pending_avatar_writes.get(write_id);
        throwUnless(21520, pendingOpt != null);
        let pending: PendingProfileAvatarWrite = pendingOpt!!;
        self.pending_avatar_writes.del(write_id);
        self.pending_avatar_write_count -= 1;
        self.sendAthNotificationRefund(pending.query_id, pending.sender_key, pending.amount);
    }

    fun refundAvatarExcess(query_id: Int, owner_wallet: Address, retained_value: Int) {
        let excess: Int = context().value - retained_value;
        if (excess < PROFILE_AVATAR_EXCESS_REFUND_MIN_VALUE) {
            return;
        }

        if (excess <= PROFILE_VAULT_EXCESS_REFUND_EXEC_RESERVE + PROFILE_EXCESS_REFUND_FORWARD_RESERVE) {
            return;
        }
        let refundValue: Int = excess - PROFILE_EXCESS_REFUND_FORWARD_RESERVE;
        let creditAmount: Int = refundValue - PROFILE_VAULT_EXCESS_REFUND_EXEC_RESERVE;
        if (creditAmount < PROFILE_AVATAR_EXCESS_REFUND_MIN_VALUE) {
            return;
        }
        // clean-16 direct-pay: refund the TON excess straight to the PAYER (== owner_wallet, enforced at 21163),
        // not to a Vault. Plain-TON transfer so the user's own wallet accepts it (no typed Vault receiver needed).
        message(MessageParameters {
            to: owner_wallet,
            value: creditAmount,
            bounce: false,
            mode: SendDefaultMode,
            body: "platho-avatar-excess-refund".asComment()
        });
    }

    fun requireNoDueFlushQuery(query_id: Int) {
        throwUnless(21200, !self.pending_treasury_flushes.exists(query_id));
        throwUnless(21201, !self.pending_burn_flushes.exists(query_id));
    }

    fun restoreTreasuryDue(amount: Int) {
        throwUnless(21210, amount > 0);
        self.treasury_due_ath += amount;
    }

    fun restoreBurnDue(amount: Int) {
        throwUnless(21220, amount > 0);
        self.burn_due_ath += amount;
    }

    fun clearPendingTreasuryFlush(query_id: Int): PendingProfileTreasuryFlush {
        let pendingOpt: PendingProfileTreasuryFlush? = self.pending_treasury_flushes.get(query_id);
        throwUnless(21230, pendingOpt != null);
        let pending: PendingProfileTreasuryFlush = pendingOpt!!;
        self.pending_treasury_flushes.del(query_id);
        self.pending_treasury_flush_count -= 1;
        return pending;
    }

    fun clearPendingBurnFlush(query_id: Int): PendingProfileBurnFlush {
        let pendingOpt: PendingProfileBurnFlush? = self.pending_burn_flushes.get(query_id);
        throwUnless(21240, pendingOpt != null);
        let pending: PendingProfileBurnFlush = pendingOpt!!;
        self.pending_burn_flushes.del(query_id);
        self.pending_burn_flush_count -= 1;
        return pending;
    }

    // PHASE ONE. Validate the payment, book it as pending, and send the pointer to the buyer's shard WITH BOUNCE.
    // Nothing is settled here: no ack, no dues, no profile count. Everything that closes the payment waits for the
    // shard to confirm, because the ack is irreversible and the write can still fail (unregistered wallet,
    // duplicate pointer).
    fun acceptAvatarPayment(query_id: Int, sender_key: Int, amount: Int, owner_wallet: Address, avatar_hash: Int, avatar_entry_id: Int, avatar_stream_id: Int, avatar_part_count: Int, media_format: Int) {
        throwUnless(21111, amount == PROFILE_AVATAR_PRICE_ATH);
        self.requireValidAvatarPointerFields(owner_wallet, avatar_hash, avatar_stream_id, avatar_part_count, media_format);

        // The two per-profile endowments this used to retain (36M record + 9M owner-version) are GONE with the
        // state they funded. What replaces them is the write value, which is not spent but round-tripped, and
        // which on the refusal branch is what pays for the ATH to go home.
        let retainedValue: Int = PROFILE_KEY_SHARD_WRITE_VALUE + PROFILE_AVATAR_SETTLE_EXEC_RESERVE + PROFILE_STATE_GROWTH_EXEC_RESERVE;
        throwUnless(21112, context().value >= retainedValue);

        let writeId: Int = self.next_avatar_write_id;
        self.next_avatar_write_id += 1;
        self.pending_avatar_writes.set(writeId, PendingProfileAvatarWrite {
            query_id: query_id,
            sender_key: sender_key,
            amount: amount,
            owner_wallet: owner_wallet,
            created_at: now()
        });
        self.pending_avatar_write_count += 1;

        message(MessageParameters {
            to: self.deriveKeyShardAddress(owner_wallet),
            value: PROFILE_KEY_SHARD_WRITE_VALUE,
            mode: SendPayFwdFeesSeparately,
            bounce: true,
            body: KeyShardSetAvatarPointer {
                write_id: writeId,
                owner_wallet: owner_wallet,
                avatar_hash: avatar_hash,
                avatar_entry_id: avatar_entry_id,
                avatar_stream_id: avatar_stream_id,
                avatar_part_count: avatar_part_count,
                media_format: media_format
            }.toCell()
        });

        // The TON excess is the buyer's own overpayment in TON and has nothing to do with whether the ATH
        // settles, so it goes back now rather than waiting on the shard. Refunding it here also keeps it out of
        // the settle path, where the value available is the shard's change rather than the notification's.
        self.refundAvatarExcess(query_id, owner_wallet, retainedValue);
    }

    receive(msg: BindProfileOfficialAthWallet) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(21031, msg.deployment_manifest_hash > 1);
        throwUnless(21032, !self.official_ath_wallet_bound);
        throwUnless(21033, self.genesis_config_hash == 0);
        throwUnless(21034, self.deployment_manifest_hash == 0 || self.deployment_manifest_hash == msg.deployment_manifest_hash);
        throwUnless(21035, msg.official_ath_wallet_address == self.deriveAthWalletAddress(myAddress()));
        self.deployment_manifest_hash = msg.deployment_manifest_hash;
        self.genesis_config_hash = 1;
        self.official_ath_wallet_address = msg.official_ath_wallet_address;
        self.official_ath_wallet_bound = true;
    }

    receive(msg: SealGenesis) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(21040, msg.deployment_manifest_hash > 1);
        throwUnless(21041, self.deployment_manifest_hash == msg.deployment_manifest_hash);
        throwUnless(21042, self.official_ath_wallet_bound);
        throwUnless(21043, self.official_ath_wallet_address == self.deriveAthWalletAddress(myAddress()));
        throwUnless(21044, self.isBasechainAddress(self.treasury_ath_receiver_address));
        throwUnless(21049, self.treasury_ath_receiver_address != myAddress());
        throwUnless(21050, self.treasury_ath_receiver_address != self.official_ath_wallet_address);
        throwUnless(21052, self.treasury_ath_receiver_address != self.ath_master_address);
        self.genesis_config_hash = msg.deployment_manifest_hash;
        self.sealed = true;
    }

    // clean-16 migration/Durable-Core: PAYER-AUTHENTICATED avatar update (owner decision 2026-07-15). No longer gated
    // on a one-shot-bound Vault. The official ATH wallet unforgeably stamps payer_wallet=derive_wallet_address(real
    // sender_owner); we require owner_wallet == payer_wallet so a payer can set ONLY THEIR OWN avatar — no Vault,
    // controller, or third party can ever be another user's payer, so the delegated-consent hijack vector is gone.
    // Vault-independent → the registry freezes once and survives every future Vault redeploy.
    receive(msg: AthTransferNotificationRegistryProfileAvatar) {
        self.requireSealed();
        throwUnless(21160, sender() == self.official_ath_wallet_address);
        throwUnless(21163, msg.owner_wallet == msg.payer_wallet);
        self.acceptAvatarPayment(
            msg.query_id,
            msg.sender_key,
            msg.amount,
            msg.owner_wallet,
            msg.avatar_hash,
            msg.avatar_entry_id,
            msg.avatar_stream_id,
            msg.avatar_part_count,
            msg.media_format
        );
    }

    // PHASE TWO, SUCCESS. The pointer is in the buyer's shard; only now does the payment close.
    receive(msg: KeyShardAvatarPointerAck) {
        self.requireSealed();
        let pendingOpt: PendingProfileAvatarWrite? = self.pending_avatar_writes.get(msg.write_id);
        throwUnless(21500, pendingOpt != null);
        let pending: PendingProfileAvatarWrite = pendingOpt!!;
        // Authentication is by DERIVATION, not by a stored address: only the shard belonging to the wallet named
        // in the pending entry can settle that entry. Nothing else can occupy that address.
        throwUnless(21501, sender() == self.deriveKeyShardAddress(pending.owner_wallet));
        self.pending_avatar_writes.del(msg.write_id);
        self.pending_avatar_write_count -= 1;

        // profile_count is now a count of FIRST purchases, reported by the shard that owns the version counter.
        if (msg.version == 1) {
            self.profile_count += 1;
        }

        let treasury_amount: Int = (pending.amount * PROFILE_TREASURY_SHARE_BPS) / PROFILE_SPLIT_BASE_BPS;
        let burn_amount: Int = pending.amount - treasury_amount;
        self.treasury_due_ath += treasury_amount;
        self.burn_due_ath += burn_amount;

        self.sendAthNotificationAck(pending.query_id, pending.sender_key, pending.amount);
    }

    // PHASE TWO, REFUSAL. The shard refused — unregistered wallet (22202) or the identical pointer already current
    // (22205) — or the shard does not exist at all, which also bounces. The buyer gets their 100 ATH back.
    // Only write_id is readable here: a bounce preserves 256 bits of body, and an Address alone is 267.
    bounced(msg: bounced<KeyShardSetAvatarPointer>) {
        self.requireSealed();
        let pendingOpt: PendingProfileAvatarWrite? = self.pending_avatar_writes.get(msg.write_id);
        throwUnless(21510, pendingOpt != null);
        throwUnless(21511, sender() == self.deriveKeyShardAddress((pendingOpt!!).owner_wallet));
        self.abandonPendingAvatarWrite(msg.write_id);
    }

    // Neither ack nor bounce ever came. Permissionless after the TTL — see PROFILE_AVATAR_WRITE_STALE_TTL for why
    // it refunds rather than merely forgetting, and why the window is a week.
    receive(msg: PruneStaleAvatarWrite) {
        self.requireSealed();
        let pendingOpt: PendingProfileAvatarWrite? = self.pending_avatar_writes.get(msg.write_id);
        throwUnless(21530, pendingOpt != null);
        let pending: PendingProfileAvatarWrite = pendingOpt!!;
        throwUnless(21531, now() >= pending.created_at + PROFILE_AVATAR_WRITE_STALE_TTL);
        throwUnless(21532, context().value >= PROFILE_ATH_NOTIFICATION_REFUND_VALUE + PROFILE_AVATAR_SETTLE_EXEC_RESERVE);
        self.abandonPendingAvatarWrite(msg.write_id);
    }

    receive(msg: FlushProfileTreasuryAthDue) {
        self.requireSealed();
        throwUnless(21250, msg.query_id > 0);
        self.requireNoDueFlushQuery(msg.query_id);
        throwUnless(21251, self.treasury_due_ath > 0);
        throwUnless(21252, context().value >= PROFILE_ATH_TRANSFER_EXEC_RESERVE + PROFILE_DUE_FLUSH_LOCAL_EXEC_RESERVE);
        throwUnless(21253, self.isBasechainAddress(self.treasury_ath_receiver_address));

        let amount: Int = self.treasury_due_ath;
        self.treasury_due_ath = 0;
        let recipient_ath_wallet: Address = self.deriveAthWalletAddress(self.treasury_ath_receiver_address);
        self.pending_treasury_flushes.set(msg.query_id, PendingProfileTreasuryFlush {
            amount: amount,
            recipient_ath_wallet: recipient_ath_wallet,
            created_at: now()
        });
        self.pending_treasury_flush_count += 1;

        message(MessageParameters {
            to: self.official_ath_wallet_address,
            value: PROFILE_ATH_TRANSFER_EXEC_RESERVE,
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

    receive(msg: FlushProfileBurnAthDue) {
        self.requireSealed();
        throwUnless(21260, msg.query_id > 0);
        self.requireNoDueFlushQuery(msg.query_id);
        throwUnless(21261, self.burn_due_ath > 0);
        throwUnless(21262, context().value >= PROFILE_ATH_BURN_EXEC_RESERVE + PROFILE_DUE_FLUSH_LOCAL_EXEC_RESERVE);

        let amount: Int = self.burn_due_ath;
        self.burn_due_ath = 0;
        self.pending_burn_flushes.set(msg.query_id, PendingProfileBurnFlush {
            amount: amount,
            created_at: now()
        });
        self.pending_burn_flush_count += 1;

        message(MessageParameters {
            to: self.official_ath_wallet_address,
            value: PROFILE_ATH_BURN_EXEC_RESERVE,
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
        let pending: PendingProfileTreasuryFlush = self.clearPendingTreasuryFlush(msg.query_id);
        throwUnless(21300, pending.amount == msg.amount);
        throwUnless(21301, sender() == pending.recipient_ath_wallet);
    }

    receive(msg: ATHTransferFailed) {
        self.requireSealed();
        throwUnless(21310, sender() == self.official_ath_wallet_address);
        let pending: PendingProfileTreasuryFlush = self.clearPendingTreasuryFlush(msg.query_id);
        throwUnless(21311, pending.amount == msg.amount);
        self.restoreTreasuryDue(pending.amount);
    }

    bounced(msg: bounced<ATHTransferRequest>) {
        self.requireSealed();
        throwUnless(21320, sender() == self.official_ath_wallet_address);
        let pending: PendingProfileTreasuryFlush = self.clearPendingTreasuryFlush(msg.query_id);
        throwUnless(21321, pending.amount == msg.amount);
        self.restoreTreasuryDue(pending.amount);
    }

    receive(msg: ATHBurnFinalized) {
        self.requireSealed();
        throwUnless(21330, sender() == self.ath_master_address);
        throwUnless(21332, msg.owner_address == myAddress());
        let pending: PendingProfileBurnFlush = self.clearPendingBurnFlush(msg.query_id);
        throwUnless(21331, pending.amount == msg.amount);
    }

    receive(msg: ATHBurnFailed) {
        self.requireSealed();
        throwUnless(21340, sender() == self.official_ath_wallet_address);
        let pending: PendingProfileBurnFlush = self.clearPendingBurnFlush(msg.query_id);
        throwUnless(21341, pending.amount == msg.amount);
        self.restoreBurnDue(pending.amount);
    }

    bounced(msg: bounced<ATHBurn>) {
        self.requireSealed();
        throwUnless(21350, sender() == self.official_ath_wallet_address);
        let pending: PendingProfileBurnFlush = self.clearPendingBurnFlush(msg.query_id);
        throwUnless(21351, pending.amount == msg.amount);
        self.restoreBurnDue(pending.amount);
    }

    receive(msg: ProfileRegistryTopUpStorageReserve) {
        // Accept TON for ProfileRegistry storage reserve only. Avatar pointers,
        // ATH due buckets, and deployment bindings are unchanged.
    }

    receive() {
        throw(21400);
    }

    get fun get_global(): ProfileRegistryGlobalView {
        return ProfileRegistryGlobalView {
            sealed: self.sealed,
            official_ath_wallet_bound: self.official_ath_wallet_bound,
            deployment_manifest_hash: self.deployment_manifest_hash,
            genesis_config_hash: self.genesis_config_hash,
            official_ath_wallet_address: self.official_ath_wallet_address,
            ath_master_address: self.ath_master_address,
            treasury_ath_receiver_address: self.treasury_ath_receiver_address,
            genesis_controller_address: self.genesis_controller_address,
            profile_count: self.profile_count,
            pending_avatar_write_count: self.pending_avatar_write_count,
            next_avatar_write_id: self.next_avatar_write_id,
            treasury_due_ath: self.treasury_due_ath,
            burn_due_ath: self.burn_due_ath,
            pending_treasury_flush_count: self.pending_treasury_flush_count,
            pending_burn_flush_count: self.pending_burn_flush_count
        };
    }

    // get_avatar / get_avatar_version RETIRED 2026-07-21 with the maps behind them. A client reads the pointer
    // from KeyShard's get_view — the same read it already performs to resolve that contact's keys — and this
    // getter is how it finds the shard from a wallet. Exactly the shape get_username_item_address took when
    // get_name_record retired the day before: the registry stops answering about a user and starts answering
    // WHERE the user's own contract is.
    get fun get_key_shard_address(owner_wallet: Address): Address {
        return self.deriveKeyShardAddress(owner_wallet);
    }

    get fun get_pending_avatar_write(write_id: Int): PendingProfileAvatarWriteView {
        let pendingOpt: PendingProfileAvatarWrite? = self.pending_avatar_writes.get(write_id);
        if (pendingOpt == null) {
            return PendingProfileAvatarWriteView {
                exists: false,
                query_id: 0,
                sender_key: 0,
                amount: 0,
                owner_wallet: myAddress(),
                created_at: 0
            };
        }
        let pending: PendingProfileAvatarWrite = pendingOpt!!;
        return PendingProfileAvatarWriteView {
            exists: true,
            query_id: pending.query_id,
            sender_key: pending.sender_key,
            amount: pending.amount,
            owner_wallet: pending.owner_wallet,
            created_at: pending.created_at
        };
    }

    get fun get_ath_wallet_address(owner_wallet: Address): Address {
        return self.deriveAthWalletAddress(owner_wallet);
    }

    get fun get_pending_treasury_flush(query_id: Int): PendingProfileTreasuryFlushView {
        let pendingOpt: PendingProfileTreasuryFlush? = self.pending_treasury_flushes.get(query_id);
        if (pendingOpt == null) {
            return PendingProfileTreasuryFlushView {
                exists: false,
                amount: 0,
                recipient_ath_wallet: self.treasury_ath_receiver_address,
                created_at: 0
            };
        }
        let pending: PendingProfileTreasuryFlush = pendingOpt!!;
        return PendingProfileTreasuryFlushView {
            exists: true,
            amount: pending.amount,
            recipient_ath_wallet: pending.recipient_ath_wallet,
            created_at: pending.created_at
        };
    }

    get fun get_pending_burn_flush(query_id: Int): PendingProfileBurnFlushView {
        let pendingOpt: PendingProfileBurnFlush? = self.pending_burn_flushes.get(query_id);
        if (pendingOpt == null) {
            return PendingProfileBurnFlushView {
                exists: false,
                amount: 0,
                created_at: 0
            };
        }
        let pending: PendingProfileBurnFlush = pendingOpt!!;
        return PendingProfileBurnFlushView {
            exists: true,
            amount: pending.amount,
            created_at: pending.created_at
        };
    }
}
