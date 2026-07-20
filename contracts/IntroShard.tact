// IntroShard — clean-17 sharded INTRO lane (first contact, stealth). Partition = (epoch, bucket).
//
// DIRECT-PAID (no tokens, no nullifiers, no issuer) — see RecordShard.tact for the full rationale. [OWNER
// 2026-07-18: all external infrastructure is forbidden in this project and always has been.] The blind-token layer
// that used to gate this lane only bought unlinkability against the issuer and required an external relay to mean
// anything, so it is gone. A publisher simply pays the rent for what it stores.
//
// WHY THIS LANE IS OPEN BY NATURE. Unlike CONV, an INTRO is a first contact from a STRANGER, so there is no shared
// secret yet and the bucket is SENDER-chosen and public — anyone may write here, and that is inherent, not a
// weakness. Leak-freedom comes from the payload, not from access control: the bucket reveals nothing about the
// recipient (who is hidden behind the stealth view_tag), and the recipient SCANS — it reads the compact
// (r, view_tag) of every live intro in its window and tests each against its scan secret. Spam is bounded by three
// things: every intro pays its own rent, SAFE-CAP refuses a full partition in COMPUTE, and the shard's own death
// bounds how long any of it lasts.
//
// SHORT RETENTION + EVICTION (owner decision 2026-07-17: ONE WEEK): an intro only needs to live until the recipient
// scans it. After a week it is evicted, so (a) the persistent intro graph never accumulates in state — the state
// scraper the redesign targets finds nothing — and (b) the live set stays bounded, which is what keeps the
// leak-free full scan feasible. A recipient offline longer than a week misses the first contact; the sender retries.
//
// BODY CARRIAGE: the client publishes DIRECTLY here, so its transaction carries the intro capsule cells and the
// content lives in THIS account's transaction history, authenticated by the stored body_commit. State keeps only
// (r, view_tag, body_commit, created_at) — compact enough that scanning the whole live set stays cheap.
//
// TERMINAL + CARRY: stores the intro, returns the payer's change, keeps only its own rent.

const IS_INTRO_RETENTION: Int = 604800;   // 1 week (owner 2026-07-17)
const IS_SAFE_CAP: Int = 8000;            // intros per (epoch, bucket) — refuse in COMPUTE, not code 50 in ACTION

// RETIRE SLACK — the reason this lane's gate is not the bare death instant. MEASURED 2026-07-19: a shard of epoch
// E leaves the client's scan window at exactly (E+9)*86400 (INTRO_SCAN_EPOCHS_BACK = 8, web/intro-receive.mjs:36),
// and the bare death instant (E+2)*86400 + IS_INTRO_RETENTION is (E+9)*86400 TOO. A margin of ZERO SECONDS.
// Today nothing exercises that edge because nobody evicts; making retirement actually happen would arm it, and
// the failure is SILENT in the worst way this project knows — a destroyed account answers exit -256, the reader
// reads that as "nothing here", marks the bucket drained and commits its cursor. First contacts stop arriving
// with no error anywhere. Worse, the client constant is mutable JavaScript racing an immutable chain constant:
// widening INTRO_SCAN_EPOCHS_BACK is a one-line change anybody might make.
// Four epochs of slack costs about 0.00002 GRAM of extra rent per shard and buys the client room to grow its
// window from 8 to 12 epochs. get_view().retire_at publishes the resulting instant so a client never recomputes it.
const IS_RETIRE_SLACK: Int = 345600;      // 4 epochs
// A scan page carries (r, view_tag) PAIRS, not bare tags. [CORRECTED 2026-07-18 — the tag-only page could not
// serve a scan at all.] The recipient's filter is computePrivateScanViewTag(scan_secret, r): the tag is a function
// of the intro's OWN ephemeral point, so it is unique per intro and the recipient cannot precompute "my tag" once
// and match it against a list. That is not an implementation detail — it is what stealth MEANS. So `r` must be
// downloaded for every live intro no matter how the page is shaped, and a page of bare tags was simply unusable.
//   pair = 256 (r) + 16 (tag) = 272 bits -> 3 per 1023-bit cell (816 used, 79.8% efficient)
// The earlier "2.03 B/intro, 42x cheaper than reading state" figure measured a page that was not sufficient for
// the scan; the honest floor is ~34 B/intro and it cannot be beaten without giving up stealth.
// 256 pairs = 86 cells = ~9 KB per response. Chosen because the EXPENSIVE part of this getter is the 256 dictionary
// lookups, and that count is identical to the tag-only page this replaces — only the cell building grew, which is
// cheap. Measured with the cap temporarily lifted for the probe: 600 pairs (21 KB) still answer, so 256 is not
// near any edge; the cap bounds the response, not the getter. It also sets the SCAN REQUEST COUNT, which is what
// actually limits a phone: a recipient must read every bucket of every epoch in its window, so requests per day
// are max(bucketCount, intros_per_day / IS_SCAN_PAGE_CAP). Raising the cap is the only lever that cuts requests
// without touching privacy — see the budget in PLATHO_CLEAN17_SHARDED_SPEC.md.
const IS_SCAN_PAGE_CAP: Int = 256;
const IS_PAIRS_PER_CELL: Int = 3;         // 1023 bits / 272 — how many (r, tag) pairs fit one cell's data

// body_commit preimage tag. The CONTRACT defines the commitment so publisher and scanner cannot disagree.
const IS_BODY_DOMAIN: Int = 0x49534243;   // "ISBC"

// [RE-MEASURE BEFORE SEAL] storage 64962 nanoton/cell/year (config-18, bits free).
//   intro endowment: an intro no longer lives one week. Per-entry eviction is gone, so an entry persists until
//     the whole shard is retired at (epoch+2)*86400 + IS_INTRO_RETENTION + IS_RETIRE_SLACK — about THIRTEEN
//     days from the epoch, not seven. The old derivation (4 cells x 64962 x 7/365 x 1.5 -> 8000) therefore
//     described a lifetime the contract no longer has.
//     MEASURED 2026-07-19 over the real span, from publish to the retire instant: 6_624 per intro
//     (rent 226_875 at n=1 and 644_235 at n=64, so 417_360 over 63 entries). 8000 covered it, but at 1.21x —
//     below this project's G8 1.5x convention, and config-18 is a SCHEDULE that has already moved once. A 21%
//     rise would have made a full shard rent-insolvent before it could be retired, in an immutable contract.
//       6_624 x 1.5 = 9_936 -> 10_000
const IS_INTRO_ENDOWMENT: Int = 10000;
// The shard's own rent PLUS the cost of the one call that ends it (measured 956_872, flat in shard size).
// Raised 1_000_000 -> 2_500_000 when per-entry eviction was deleted; see RecordShard for the full reasoning.
const IS_BASE_ENDOWMENT: Int = 2500000;
const IS_PUBLISH_GAS: Int = 2500000;

// PROTOCOL FEE — 0.01 GRAM per published capsule, the SAME fee RecordShard charges (RS_PROTOCOL_FEE), because the
// owner's economics are stated per MESSAGE and an intro is a message: 1.5M capsules -> 15k GRAM of liquidity.
// [OWNER 2026-07-18: "комиссию берём и с интро".] Charging it here was previously omitted with no reasoning in the
// code, which made a first contact a quarter the price of a reply.
// It also does defensive work that CONV does not need. This lane is OPEN by design — anyone may write to any
// bucket, and the recipient must SCAN every live intro — so the cost of publishing junk IS the cost of degrading
// everyone's scan. The fee raises that cost ~5x (2.508M -> 12.508M per intro), which is the only lever available:
// there is no gate that can distinguish a real first contact from a fake one without breaking the stealth property.
const IS_PROTOCOL_FEE: Int = 10000000;

// THE FEE PASSES THROUGH THIS SHARD — IT DOES NOT LIVE HERE. Identical in shape to RecordShard's; see the long
// note there for why an accumulate-then-remit design existed at all (it was built around FeeAccumulator's
// 2_000_000 deposit reserve, measured at 199_068 and fixed at the source) and why the fee must be routed through
// the shard rather than paid by the client directly (a contract cannot see the other messages of a transaction,
// so gate 13682 is the only thing that can make the fee mandatory).
// The address is a CONSTANT because an IntroShard deploys lazily and unbound, and this lane is OPEN by design:
// a post-deploy bind receiver would let literally any stranger bind their own address and collect the fees of
// every intro published to that bucket that day. Pinned against a fresh derivation in PT-04b, in
// tests/shard-fee-passthrough.test.ts.
// [MOVED 2026-07-19 — AND THIS IS THE ORDERING CONSTRAINT I WRONGLY DECLARED NON-EXISTENT.] Earlier today I
// measured that FeeAccumulator.init carries no deployment_id, concluded its address is fixed forever, and told
// the owner there was no genesis ordering to respect. That was true only while its CODE was untouched. Lowering
// FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE changed its code hash and therefore its address, and the shards kept
// pointing at the old one — every publish's fee bounced straight back, caught by tests/shard-fee-passthrough.
// So the constraint is real and it is this: FeeAccumulator code -> its address -> shard code -> shard addresses.
// No cycle, but it must be walked in that order at genesis, and PT-04/PIN pins the result.
const IS_FEE_SINK: Address = address("EQDG8kf4ikGQRyTZcZ2POIWEqwqAaZWbi9Y6qPp3EXTa_Pq7");

// TRANSPORT, PAID BY THE PUBLISHER [OWNER 2026-07-19], so the fee reaches the pool whole.
// Mirror of FEEACCUMULATOR_CAPSULE_FEE_EXEC_RESERVE (gate 15056); pinned against it in tests.
// 400_000 -> 1_400_000 -> 2_600_000, same reason and the same measurement as RecordShard: authenticating the
// sender by deriving its address costs 636,134 on its own, and the airdrop credit leg costs 1,469,401 more.
// MEASURED 2026-07-20. The 0.01 GRAM fee still reaches the pool whole; only the transport grows.
const IS_FEE_SINK_DEPOSIT_RESERVE: Int = 2600000;
// Forward fee for the deposit message; measured ~75_000 and flat in shard size. Slack here returns to the
// publisher with their change, so generosity is free and tightness is not.
const IS_FEE_SINK_FWD_RESERVE: Int = 200000;
const IS_FEE_TRANSPORT: Int = IS_FEE_SINK_DEPOSIT_RESERVE + IS_FEE_SINK_FWD_RESERVE;

// RETIRING A SHARD replaced per-entry eviction here too — see RecordShard for the measurements. This lane had
// the sharper version of the same defect: IS_INTRO_ENDOWMENT is 8_000 against a 900_000 bounty, 112x apart, and
// an attacker demonstrated that an ordinary full sweep drained a shard to EXACTLY ZERO while leaving the account
// alive forever, because eviction and retirement shared one purse. One mechanism, one purse, no coupling.

// gate 13682, the STEADY-STATE publish. IS_FEE_TRANSPORT is here because the publisher pays it.
const IS_MIN_VALUE: Int = IS_INTRO_ENDOWMENT + IS_PUBLISH_GAS + IS_PROTOCOL_FEE + IS_FEE_TRANSPORT;
// The FIRST intro into a bucket-day also funds the account's life and its retirement. Charged explicitly rather
// than left to ReserveAtMost, which silently clamps and under-endows — see RecordShard.
const IS_DEPLOY_MIN_VALUE: Int = IS_MIN_VALUE + IS_BASE_ENDOWMENT;

// A stealth first-contact publish. header_0 + body ride so they land in this account's transaction history; they are
// NOT stored in state. body_commit is recomputed here from their hashes — nothing is trusted from the sender.
message(0x49535031) IntroPublish {        // "ISP1"
    r: Int as uint256;                    // stealth ephemeral point R = r*G (recipient tests X25519(scan, R))
    view_tag: Int as uint16;              // HKDF(X25519(r, recipient.scan_pub), R)[:2] — the cheap scan filter
    header_0: Cell;
    body: Cell;
}

// "ISP3" — permissionless one-shot retirement: drop every intro and destroy the account.
message(0x49535033) RetireShard {}

// Mirrored from FeeAccumulator by opcode (Tact compiles one contract per project) — as CapsuleHub does.
message(0xFF775609) DepositProtocolFee {
    amount: Int as uint128;
}

// The airdrop-bearing deposit, mirroring FeeAccumulator's opcode. Carries the publisher (stamped by the VM from
// sender(), never from the body) and this shard's own init arguments POSITIONALLY, so the sink can rebuild this
// address from its bound code and prove the deposit came from a real shard. `lane` says which code that is —
// the two lanes have different init arguments, so naming the fields would bake in one lane's shape.
message(0x52535046) DepositCapsuleFee {
    amount: Int as uint128;
    lane: Int as uint8;
    init_arg0: Int as int257;
    init_arg1: Int as int257;
    publisher: Address;
}


struct IntroEntry {
    r: Int;
    view_tag: Int;
    body_commit: Int;
    created_at: Int;
}

struct IntroEntryView {
    exists: Bool;
    r: Int;
    view_tag: Int;
    body_commit: Int;
    created_at: Int;
}

// A page of the scan input. Carries the (r, view_tag) pairs the recipient needs and NOTHING else — not the body
// commitment, not created_at. A recipient cannot ask "which of these is mine", so it must look at EVERY live intro
// in the network, and the only question that matters is how many bytes that costs.
//   whole account state read   85 B/intro
//   this page                  34 B/intro   (2.5x less, identical privacy)
// 2.5x is the real ceiling, not the 42x an earlier revision claimed: `r` is 32 of those 34 bytes and the scan
// cannot proceed without it. Cutting further means weakening stealth, which is not on the table.
// The ids are IMPLICIT — pair i of the page is entry (from_id + i). That is sound because eviction is FIFO from the
// bottom while intros append at the top, so the live range [evict_cursor, next_id) is always CONTIGUOUS and has no
// holes to encode. A missing slot packs as (0, 0), which is simply a candidate the second stage rejects.
struct IntroScanPage {
    from_id: Int;        // first entry id in this page
    count: Int;          // how many pairs are packed
    next_id: Int;        // the shard's append cursor, so the caller knows whether more pages remain
    pairs: Cell;         // `count` x (uint256 r, uint16 view_tag), 3 per cell, chained by ref
}
// NOTE: `evict_cursor` was removed from this struct when eviction was deleted — nothing removes an entry any
// more, so the live floor is always 0 and the field carried no information. It is a WIRE FORMAT change: it
// shifts `pairs` from stack index 4 to 3, and web/intro-transport.mjs parseScanPageStack is the production
// decoder that reads it. That decoder is stubbed out in every existing test, so nothing would have caught the
// break — tests/intro-scan-page.test.ts now drives it against a REAL getter stack.

struct IntroShardView {
    epoch: Int;
    bucket: Int;
    next_id: Int;           // intros stored; also the SAFE-CAP counter, since nothing removes one
    retention: Int;
    safe_cap: Int;
    min_value: Int;         // what a further publish must bring (clients read this, never a hardcoded mirror)
    deploy_min_value: Int;  // what the FIRST intro must bring — pay this whenever next_id == 0
    protocol_fee: Int;      // the per-capsule service fee included in both figures
    retire_at: Int;         // the exact second this shard becomes retireable; read it, never recompute it
    fee_sink: Address;      // where each publish forwards the fee; a constant, readable without disassembly
}

contract IntroShard {
    epoch: Int as uint32;
    bucket: Int as uint32;
    intros: map<Int, IntroEntry>;
    next_id: Int as uint32;        // intros stored; nothing removes one, so this is also the live count

    init(epoch: Int, bucket: Int) {
        self.epoch = epoch;
        self.bucket = bucket;
        self.intros = emptyMap();
        self.next_id = 0;
    }

    fun bodyCommit(h0: Cell, body: Cell): Int {
        return beginCell()
            .storeUint(IS_BODY_DOMAIN, 32)
            .storeUint(h0.hash(), 256)
            .storeUint(body.hash(), 256)
            .endCell()
            .hash();
    }

    receive(msg: IntroPublish) {
        // Funding gated in COMPUTE before any state change, so an underfunded intro bounces and is refunded.
        // THE SHARD MUST BELONG TO ROUGHLY NOW. Without this the epoch was a free parameter: MEASURED — a publish
        // into the shard for an epoch 300 days PAST and one 300 days FUTURE were both accepted with exit 0.
        // Two things go wrong, and the first is a plain product bug rather than an attack. A client whose clock is
        // off publishes into a shard nobody scans; the recipient's window is the retention period, so the message
        // is lost FOREVER while the wallet reports success. That is the same silent-success family as sending to
        // an uninitialised account, and it is the worst failure mode this project has.
        // The second is that it makes past epochs mutable, so nothing derived from a past epoch's state can be
        // trusted to be the same for two readers — an attacker can move it after one client has read it and before
        // another has. Any client-side rule that reads history (for instance sizing the bucket space from observed
        // fill) rests on epochs being closed, and they were not.
        // The tolerance is +/-1 epoch, not exact equality: a message signed just before midnight may well be
        // processed just after it, and bouncing those would be a real bug for no gain. One epoch of slack is safe
        // because the recipient's scan window is the whole retention period, which is far wider than a day.
        let nowEpoch: Int = now() / 86400;
        throwUnless(13684, (nowEpoch >= self.epoch - 1) && (nowEpoch <= self.epoch + 1));
        throwUnless(13682, context().value >= (self.next_id == 0 ? IS_DEPLOY_MIN_VALUE : IS_MIN_VALUE));
        throwUnless(13680, self.next_id < IS_SAFE_CAP);   // SAFE-CAP in COMPUTE

        self.intros.set(self.next_id, IntroEntry{
            r: msg.r,
            view_tag: msg.view_tag,
            body_commit: self.bodyCommit(msg.header_0, msg.body),
            created_at: now(),   // the contract stamps the time, so eviction cannot be gamed by a client field
        });
        self.next_id = self.next_id + 1;

        // THE FEE LEAVES FIRST, AND THE ORDER IS THE SAFETY PROPERTY. Queued ahead of the reserve, the deposit is
        // drawn from the value this message brought, which gate 13682 has already checked covers
        // IS_PROTOCOL_FEE + IS_FEE_TRANSPORT. Behind the reserve it would compete with money just set aside, and a
        // losing explicit send fails the ACTION phase — which does NOT bounce, so the shard would silently swallow
        // the publisher's value. That is the defect three attackers reproduced against the design panel's winner.
        message(MessageParameters {
            to: IS_FEE_SINK,
            value: IS_PROTOCOL_FEE + IS_FEE_SINK_DEPOSIT_RESERVE,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            body: DepositCapsuleFee{ amount: IS_PROTOCOL_FEE, lane: 1,
                                     init_arg0: self.epoch, init_arg1: self.bucket,
                                     publisher: sender() }.toCell(),
        });

        // Reserve the INCREMENT on top of the balance already held (see RecordShard for the full reasoning and the
        // monolith precedent). This lane is OPEN by design, so an absolute reserve was strictly worse here: any
        // surplus on a funded IntroShard could be swept by a stranger publishing one intro.
        // THE FEE IS NOT IN THIS SUM ANY MORE — it has already gone.
        nativeReserve(
            IS_INTRO_ENDOWMENT + (self.next_id == 1 ? IS_BASE_ENDOWMENT : 0),
            ReserveAtMost | ReserveAddOriginalBalance,
        );
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    // RETIRE THE WHOLE SHARD — see RecordShard for the reasoning; the only difference here is IS_RETIRE_SLACK.
    // The gate depends only on `epoch`, an init parameter and therefore part of the address, so no amount of
    // money or timing lets anyone destroy a shard that is still live.
    receive(msg: RetireShard) {
        throwUnless(13683, now() > (self.epoch + 2) * 86400 + IS_INTRO_RETENTION + IS_RETIRE_SLACK);
        self.intros = emptyMap();
        self.next_id = 0;
        send(SendParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingBalance | SendDestroyIfZero | SendIgnoreErrors,
            bounce: false,
        });
    }

    // The sink refused or was unreachable, so the value came back. There is no fee ledger to restore any more —
    // the money stays in this account, mixed with the rent, which is the sole case where that happens and it is
    // an error path rather than the design. Handled explicitly so the bounce does not abort; the sender gate
    // stands because the bounced flag is an ordinary header bit any account may set. Should be unreachable.
    bounced(msg: bounced<DepositCapsuleFee>) {
        throwUnless(13685, sender() == IS_FEE_SINK);
        throwUnless(13686, msg.amount > 0);
    }

    receive() {}

    // Pack the (r, view_tag) pairs of [from_id, from_id+n) into a ref-chained cell, built from the END backwards so
    // each cell can reference the one after it.
    fun packPairs(start: Int, n: Int): Cell {
        let cell: Cell = beginCell().endCell();
        let isTail: Bool = true;
        let remaining: Int = n;
        while (remaining > 0) {
            let chunk: Int = min(remaining, IS_PAIRS_PER_CELL);
            let first: Int = start + remaining - chunk;
            let b: Builder = beginCell();
            let i: Int = 0;
            while (i < chunk) {
                let e: IntroEntry? = self.intros.get(first + i);
                b = b.storeUint(e == null ? 0 : e!!.r, 256).storeUint(e == null ? 0 : e!!.view_tag, 16);
                i = i + 1;
            }
            if (isTail) {
                cell = b.endCell();
                isTail = false;
            } else {
                cell = b.storeRef(cell).endCell();
            }
            remaining = remaining - chunk;
        }
        return cell;
    }

    // THE SCAN PRIMITIVE. A recipient walks every live intro in its catch-up window through this, testing each tag
    // against its own scan secret, and only fetches the full entry (get_entry) for the ~1-in-65536 that match.
    // Clamped to the live range so a caller can never be handed evicted ids, and capped so the page cannot run the
    // get-method out of gas.
    get fun get_scan_page(from_id: Int, max_count: Int): IntroScanPage {
        let start: Int = max(from_id, 0);
        let available: Int = self.next_id > start ? self.next_id - start : 0;
        // max() against 0 as well: a negative max_count would otherwise return count < 0 beside an empty cell,
        // a page that contradicts itself and that a client has no sane way to read.
        let n: Int = max(0, min(min(max_count, IS_SCAN_PAGE_CAP), available));
        return IntroScanPage{
            from_id: start,
            count: n,
            next_id: self.next_id,
            pairs: self.packPairs(start, n),
        };
    }

    get fun get_entry(entry_id: Int): IntroEntryView {
        let e: IntroEntry? = self.intros.get(entry_id);
        if (e == null) {
            return IntroEntryView{ exists: false, r: 0, view_tag: 0, body_commit: 0, created_at: 0 };
        }
        let v: IntroEntry = e!!;
        return IntroEntryView{ exists: true, r: v.r, view_tag: v.view_tag, body_commit: v.body_commit, created_at: v.created_at };
    }

    get fun get_view(): IntroShardView {
        return IntroShardView{
            epoch: self.epoch,
            bucket: self.bucket,
            next_id: self.next_id,
            retention: IS_INTRO_RETENTION,
            safe_cap: IS_SAFE_CAP,
            min_value: IS_MIN_VALUE,
            deploy_min_value: IS_DEPLOY_MIN_VALUE,
            retire_at: (self.epoch + 2) * 86400 + IS_INTRO_RETENTION + IS_RETIRE_SLACK,
            protocol_fee: IS_PROTOCOL_FEE,
            fee_sink: IS_FEE_SINK,
        };
    }
}
