// NullifierShard — clean-17 sharded anon-publish, PROTOTYPE increment 1.
//
// This is the contract that carries the double-spend ledger the monolithic CapsuleHub could not scale: it holds
// spent nullifiers for exactly ONE (epoch, lane) partition, is deployed lazily (address = f(StateInit)), and dies
// with its epoch. See [[capsulehub-account-state-cell-ceiling]] for why the monolith caps at ~182 users.
//
// WHAT THIS INCREMENT PROVES (and only this): the cross-shard double-spend hole that killed two design rounds is
// closed. A blind spend token is bound to exactly ONE shard by construction, so it cannot be replayed across
// partitions. The last round measured the hole at "1 token accepted by 9 of 9 shards" — unbounded — because two
// gates were missing. Both are here, and tests/nullifier-shard.test.ts drives one token at many shards and asserts
// exactly one accepts.
//
// THE FOUR GATES (the design-round list of three was incomplete — the fourth is the load-bearing find):
//   (1) token epoch within the wall-clock acceptance window            [13600]
//   (2) token epoch == THIS shard's epoch                              [13621]  <-- self.epoch is init-data chosen
//        by whoever deploys the shard, i.e. the attacker. Without this, a token is accepted by a shard of ANY
//        epoch (measured: 9/9). Gate (1) checks the token against the clock; gate (2) checks it against THIS
//        shard's identity. Neither substitutes for the other.
//   (3) serial mod LANE_COUNT == THIS shard's lane                     [13622]  <-- lane was a free field the sender
//        picked; the shard never recomputed it from the serial, so one token walked into every lane (x4096).
//   (4) serial == H(domain || spend_pubkey || epoch || nonce)         [13601]  <-- serial is not an input to trust;
//        it is DERIVED, so the routing in (3) cannot be gamed by declaring a convenient serial.
//
// NOT YET HERE (increment 2, clearly marked): CAC rotation. This prototype freezes ONE issuer root key as a code
// constant (so it lives in the code, not the data — otherwise it would enter the address and let an attacker deploy
// a shard trusting their own key). CAC replaces this frozen key with a root-signed per-epoch subkey carried in the
// message; the double-spend proof below does not depend on which authority scheme is used, only on gates (1)-(4).
//
// EMPTY ACTION PHASE: on success this contract stores the nullifier and sends NOTHING. Zero outgoing messages +
// zero nativeReserve = no ACTION-phase failure surface at all (the class of silent loss that has no bounce). Every
// refusal is a COMPUTE-phase throw, which bounces and refunds the relay. The forward-to-record hop is increment 3.

const NS_ISSUER_SIG_DOMAIN: Int = 0x42534931;   // "BSI1" — MUST mirror CapsuleHub.tact
const NS_NULL_DOMAIN: Int = 0x424E4C31;         // "BNL1" — MUST mirror CapsuleHub.tact
const NS_EPOCH_SECONDS: Int = 86400;
const NS_EPOCH_ACCEPT_PAST: Int = 4;
const NS_EPOCH_ACCEPT_FUTURE: Int = 4;
const NS_LANE_COUNT: Int = 1048576;             // 2^20 lanes per epoch (lazy deploy: only touched lanes are born)
const NS_SAFE_CAP: Int = 4096;                  // per-shard live-nullifier ceiling (SAFE-CAP: refuse in COMPUTE, not code 50 in ACTION)

// [PROTOTYPE, increment 2 replaces this] The frozen issuer key. In CODE, never in data — a key in data would enter
// the shard address and let an attacker deploy a lane-shard that trusts a key they control. Value = keyPairFromSeed
// (Buffer.alloc(32,0x11)).publicKey, i.e. the anon.ts issuerKey() default, so the test signs with the matching key.
const NS_ISSUER_PUBKEY: Int = 0xd04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737;

message(0x4E535031) NullifierSpend {            // "NSP1"
    spend_pubkey: Int as uint256;
    epoch: Int as uint32;
    nonce: Int as uint64;
    issuer_sig: Slice as remaining;             // ed25519 over the 256-bit serial
}

struct NullifierShardView {
    epoch: Int;
    lane: Int;
    spent_count: Int;
    lane_count: Int;
    safe_cap: Int;
}

contract NullifierShard {
    // Identity, fixed at deploy. These are the ONLY things that vary the address — so a shard is exactly one
    // (epoch, lane) partition and nothing an attacker supplies at spend time can change which shard they hit.
    epoch: Int as uint32;
    lane: Int as uint32;
    // The ledger for this partition. Bounded by NS_SAFE_CAP and by the epoch's death (the whole account is
    // reclaimed once the epoch ages out — the nullifier only needs to outlive its re-spend window).
    spent: map<Int, Bool>;
    spent_count: Int as uint32;

    init(epoch: Int, lane: Int) {
        self.epoch = epoch;
        self.lane = lane;
        self.spent = emptyMap();
        self.spent_count = 0;
    }

    fun computeSerial(spendPubkey: Int, epoch: Int, nonce: Int): Int {
        return beginCell()
            .storeUint(NS_ISSUER_SIG_DOMAIN, 32)
            .storeUint(spendPubkey, 256)
            .storeUint(epoch, 32)
            .storeUint(nonce, 64)
            .endCell()
            .hash();
    }

    fun nullifierKey(serial: Int): Int {
        return beginCell().storeUint(NS_NULL_DOMAIN, 32).storeUint(serial, 256).endCell().hash();
    }

    receive(msg: NullifierSpend) {
        let nowEpoch: Int = now() / NS_EPOCH_SECONDS;

        // (1) wall-clock window — the token's epoch must be current-ish. Cheapest gate first so a stale/absurd
        //     token is refused before any hashing or signature work (keeps the refusal bounceable).
        throwUnless(13600, (msg.epoch >= nowEpoch - NS_EPOCH_ACCEPT_PAST) && (msg.epoch <= nowEpoch + NS_EPOCH_ACCEPT_FUTURE));
        // (2) THIS shard's epoch. self.epoch is init-data; without this gate a token is accepted by a shard of any
        //     epoch the attacker chose to deploy. THE load-bearing fourth gate.
        throwUnless(13621, msg.epoch == self.epoch);

        let serial: Int = self.computeSerial(msg.spend_pubkey, msg.epoch, msg.nonce);

        // (3) lane routing, RECOMPUTED from the serial — not taken from the sender. Binds the token to exactly one
        //     lane, so it cannot be replayed across the 2^20 partitions.
        throwUnless(13622, (serial % NS_LANE_COUNT) == self.lane);

        // (4) the issuer actually signed THIS serial (over the frozen key, increment 1). Splicing a different
        //     serial fails here.
        throwUnless(13601, checkSignature(serial, msg.issuer_sig, NS_ISSUER_PUBKEY));

        let nk: Int = self.nullifierKey(serial);
        // double spend within this partition
        throwUnless(13604, self.spent.get(nk) == null);
        // SAFE-CAP: refuse in COMPUTE (bounces) rather than let state growth hit code 50 in ACTION (silent).
        throwUnless(13623, self.spent_count < NS_SAFE_CAP);

        self.spent.set(nk, true);
        self.spent_count = self.spent_count + 1;
        // EMPTY ACTION PHASE: no send, no reserve. Success = the nullifier is burnt. Nothing can fail after this.
    }

    receive() {}   // plain top-up / lazy deploy carrier

    get fun get_view(): NullifierShardView {
        return NullifierShardView{
            epoch: self.epoch,
            lane: self.lane,
            spent_count: self.spent_count,
            lane_count: NS_LANE_COUNT,
            safe_cap: NS_SAFE_CAP,
        };
    }

    get fun is_spent(serial: Int): Bool {
        return self.spent.get(self.nullifierKey(serial)) != null;
    }
}
