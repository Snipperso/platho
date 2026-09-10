// fee-vault — the M21C discount door, client side.
//
// WHAT THIS DOOR IS. Holding staked ATH in a per-user FeeVault discounts the protocol fee — 1 whole ATH = 1
// bps, inside a band of 100 to 10,000 ATH, so a discount of 1% to 100% and any amount inside it [OWNER
// 2026-09-01]. See stakeBandVerdict below: this module is where the band is enforced, because the input field is
// the only place an out-of-band stake can be refused for free. The vault can only apply the discount to a
// publish it SENDS, so every CONV publish goes through it — RecordShard has no other receiver.
//
// ONE DOOR, AND THE MONEY TRAVELS WITH THE MESSAGE [decided 2026-09-01]. The wallet
// sends the capsule to the vault carrying what the publish costs; the vault keeps its fee and forwards the rest
// to the shard. Nothing of the user's is parked in the vault except the staked ATH the discount is measured
// from, and there is no state in which a user has written a message and cannot send it.
//
// WHAT WAS DELETED, and what it bought. A second, EXTERNAL door let the client sign the publish itself and send
// it straight to the vault, sparing one of the capsule's three message crossings — worth 0.00025 GRAM on a 1 KB
// text and 0.0188 on a 32 KB image (measured, both doors, same capsule, zero stake). It paid for that with a
// standing GRAM float in the vault: an external message carries no value at all, so the money had to be there
// beforehand. That meant a "sending balance" the user tops up, a dead end when it empties, a publish key to
// arm, and a second pot of value in an immutable contract. The owner priced the saving against the risk and
// removed the door. Every constant, receiver and client function that existed only for it went with it.
//
// THE CODE CELL IS AN ARGUMENT, NOT AN IMPORT, and deliberately so. web/shard-code.mjs carries the LIVE
// generation's code and is frozen by a gate; baking an unreleased generation's FeeVault into it would ship code
// for a contract that is not on chain to every user. Callers hand in the BOC, so this module is inert until a
// generation actually configures one — which is also what makes the door impossible to half-enable by accident.

import {
  beginCell, bytesToBase64, computeCellHashAndDepth, serializeBoc,
  estimateAthWalletAttachedValueNanotons,
} from './pwa-contract-transactions.mjs?v=47';
import { shardStateInitCell, rawAddress } from './shard-address.mjs?v=29';
// [2026-09-01: externalInMessageCell, ATH_WALLET_RESERVES_NANOTONS, MAX_EXTERNAL_MESSAGE_BYTES and the whole
// ed25519 vendor curve came in with the external door and were left behind by its deletion. The curve is the one
// that mattered: an unused import is still a module every user downloads and parses on boot.]

// ITS ERROR MESSAGE PROMISED "a non-negative integer" AND IT NEVER CHECKED THE SIGN [audit 2026-09-01, round
// 14]. A bigint bypassed every test, and Number.isSafeInteger(-5) is true — MEASURED, publicPublishRoute with
// capsuleBytes -100000 answered `vault`, because a negative size makes the extra carriage look SMALLER, which is
// the unsafe direction: the payer is routed into the dearer door. The string branch was the only one that
// happened to reject them, and only because /^\d+$/ has no sign.
const toBig = (value, name) => {
  let out;
  if (typeof value === 'bigint') out = value;
  else if (typeof value === 'number' && Number.isSafeInteger(value)) out = BigInt(value);
  else if (typeof value === 'string' && /^\d+$/.test(value)) out = BigInt(value);
  else throw new TypeError(`${name} must be a non-negative integer`);
  if (out < 0n) throw new TypeError(`${name} must be a non-negative integer`);
  return out;
};

// The protocol fee — a mirror of RS_PROTOCOL_FEE / PS_PROTOCOL_FEE (all 10,000,000), pinned by
// contracts18/tests/design-numbers.test.ts NUM-05. Exists here only for vaultActionValue's strip arithmetic;
// the FLOORS themselves stay in publish-price.mjs.
export const FV_PROTOCOL_FEE = 10_000_000n;

// The clean-18 PUBLIC/INTRO fee-transport — a mirror of PS_FEE_TRANSPORT (PS_FEE_SINK_DEPOSIT_RESERVE 400,000 +
// PS_FEE_SINK_FWD_RESERVE 200,000 = 600,000), pinned to the contract by design-numbers.test.ts NUM-08.
// vaultActionValue strips FV_PROTOCOL_FEE + this (10,600,000 = exactly the fee_gap a PUBLIC shard sheds at
// fee_paid=0) out of publish-price's clean-17 directValue to reach the clean-18 arrival target.
// 🔴 IT IS *NOT* the sealed clean-17 direct transport (2,600,000). AVATAR is the tightest kind, and its margin
// over gate 13704's 27,800,000 deploy floor is SMALLEST AT THE SMALLEST CAPSULE — re-measured 2026-09-01 through
// the client's own builder into the built PublicShard: 1 KB arrives 29,439,132 (margin 1,639,132), 8 KB arrives
// 29,543,665 (1,743,665), 32 KB arrives 29,888,731 (2,088,731). Raising this constant to the direct-door figure
// strips 2,000,000 more, which is MORE than the 1 KB margin: the first avatar publish of a small capsule through
// the discount door would be refused 13704 outright, not merely tightened.
// [This paragraph has carried three margins now — "≤ 1,700,000", then 2,070,132, now the measured ladder. Both
// earlier figures named 1 KB while quoting a number that sits between the 8 KB and 32 KB rungs. The conclusion
// never moved; the number did, twice, which is what a prose figure nobody re-measures does.]
// So this tracks PS_FEE_TRANSPORT, never the direct-door figure. CONV declares no transport at all (its fee is
// booked at the vault), so the strip over-covers CONV conservatively; its lower floor clears.
export const FV_FEE_TRANSPORT = 600_000n;

// Mirrors of FeeVault's flush pair [OWNER 2026-08-30: 1 GRAM threshold], pinned to the source by NUM-07.
// The AMORT rides in every take (feeDue > 0), which is how the treasury nets whole fees at the threshold.
export const FV_FLUSH_MIN = 1_000_000_000n;
export const FV_FLUSH_AMORT = 2_000n;

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE STAKING BAND [OWNER 2026-09-01: stake from 100 to 10,000 ATH — a discount from 1% to 100% — and ANY
// amount inside it, 4,567 ATH as readily as 5,000]. Mirrors of FV_BPS_FLOOR / FV_BPS_CAP in
// contracts18/contracts/FeeVault.tact, pinned to that source by CLIENT-VAULT-01. The curve is 1:1, so one whole
// ATH is one basis point and both edges read the same in either unit.
//
// THIS IS WHERE THE BAND IS ENFORCED, because it is the only place a refusal is free. The contract cannot
// refuse an out-of-band stake: the frozen ATHWallet credits its own balance BEFORE it notifies and notifies with
// bounce:false (MEASURED), so a throw there would strand the ATH in the vault's wallet outside the mirror
// instead of returning it — the F1 state EmergencyExit exists to recover from. Returning it is not affordable
// either: the notification arrives carrying 10,000,000 and a return transfer to an already-existing wallet costs
// 36,000,012 (bisected), so the shortfall would come out of the rent cushion keeping the account alive.
//
// What the contract DOES guarantee is the ceiling: whatever reaches a vault, the discount it computes is capped
// at 100% and the fee it charges can never go below zero. The owner named that as the one hard requirement —
// going around the app to stake more or less is harmless, a discount above 100% is not — and BAND-02 drives it
// at every rung up to the entire 100,000,000 ATH supply. (BAND-01 is the band itself, 100 to 10,000; it never
// touches the cap from above, so a reader sent there for the ceiling proof would not find it.)
//
// WHY THERE IS A FLOOR AT ALL: a vault is an account, and it costs 2,143,751 nanoton/year to keep alive. At one
// message a day, 1 ATH staked saves 365,000 a year against that rent — the vault LOSES its owner money. Break
// even is 5.87 ATH; 100 ATH covers the rent seventeen times over. The floor protects the user from building a
// vault that costs more than it saves, which is why it belongs in the input field and not in a fee.
export const FV_STAKE_MIN_ATH = 100n;
export const FV_STAKE_MAX_ATH = 10_000n;
export const FV_ATOMIC_PER_ATH = 1_000_000_000n;

/**
 * WHAT AN AMOUNT TYPED INTO THE STAKE FIELD IS WORTH, and whether it may be sent at all.
 * `ath` is whole ATH (the unit the field takes). Returns
 *   { ok, reason, whole, atoms, bps, percent, feeDue, savedPerPublish }
 * — everything the field needs to bound itself AND to show what the amount buys, from one call, so the number
 * on screen and the number the chain will compute cannot come from two different formulas.
 *
 * THE BOUND IS ON THE RESULTING POSITION, NOT ON THE KEYSTROKE. Pass `stakedAtoms` (view.staked) and the
 * verdict is about where the vault ENDS UP: adding 200 to a vault already holding 9,900 leaves 10,100 and is
 * refused, and topping a bypassed 50 up by 60 reaches 110 and is allowed. A field that bounded only the number
 * typed would happily walk a user out of the band one top-up at a time.
 *
 * `reason` is 'below-band' / 'above-band' / 'not-a-whole-number' when ok is false. Fractions are refused rather
 * than rounded: the contract divides atoms by FV_ATOMIC_PER_ATH and TRUNCATES, so 100.9 ATH buys exactly what
 * 100 buys, and silently charging for the 0.9 would be the app lying about a price.
 */
/**
 * WHAT ONE PUBLISH COSTS AT A GIVEN STAKED POSITION — the contract's own formula, in one place.
 *
 * The PUBLISH path needs this and has no view in hand: `publicPublishRoute` wants `fee_due` on every post, and a
 * chain read per post is the per-pass cost this project refuses to pay. It does not need one — fee_due is a pure
 * function of the staked position, so a cached `staked` answers it for free. `stakeBandVerdict` prices the
 * staking FIELD with the same call, so the number on screen and the number the chain charges cannot come from
 * two expressions that drift apart.
 */
export function feeDueForStakedAtoms(stakedAtoms, protocolFee = FV_PROTOCOL_FEE) {
  const held = toBig(stakedAtoms ?? 0n, 'stakedAtoms') / FV_ATOMIC_PER_ATH;
  const bps = held > FV_STAKE_MAX_ATH ? FV_STAKE_MAX_ATH : held;
  return protocolFee * (FV_STAKE_MAX_ATH - bps) / FV_STAKE_MAX_ATH;
}

export function stakeBandVerdict(ath, { protocolFee = FV_PROTOCOL_FEE, stakedAtoms = 0n } = {}) {
  let typed;
  if (typeof ath === 'bigint') {
    typed = ath;
  } else if (typeof ath === 'number') {
    if (!Number.isFinite(ath) || !Number.isInteger(ath)) {
      return { ok: false, reason: 'not-a-whole-number' };
    }
    typed = BigInt(ath);
  } else if (typeof ath === 'string' && /^\d+$/.test(ath.trim())) {
    typed = BigInt(ath.trim());
  } else {
    return { ok: false, reason: 'not-a-whole-number' };
  }
  if (typed < 0n) return { ok: false, reason: 'not-a-whole-number' };
  // Whole ATH already in the vault, truncated the way the contract truncates it.
  const held = toBig(stakedAtoms, 'stakedAtoms') / FV_ATOMIC_PER_ATH;
  const whole = held + typed;
  const bps = whole > FV_STAKE_MAX_ATH ? FV_STAKE_MAX_ATH : whole;
  const feeDue = feeDueForStakedAtoms(whole * FV_ATOMIC_PER_ATH, protocolFee);
  const shape = {
    whole,
    atoms: typed * FV_ATOMIC_PER_ATH,   // what this message would CARRY, not the resulting position
    bps,
    percent: Number(bps) / 100,
    feeDue,
    savedPerPublish: protocolFee - feeDue,
  };
  if (whole < FV_STAKE_MIN_ATH) return { ok: false, reason: 'below-band', ...shape };
  if (whole > FV_STAKE_MAX_ATH) return { ok: false, reason: 'above-band', ...shape };
  // A ZERO TRANSFER IS NOT A STAKE [audit 2026-09-01, round 14 — MEASURED]. `ok` answers "may this be sent",
  // and the position test alone said yes for a typed 0 against an already-in-band vault. The frozen ATHWallet
  // refuses `throwUnless(14701, msg.amount > 0)`: driven on chain, the transfer died at 14701, the mirror never
  // moved, and the payer was out 757,605 nanoton for a message that could not have worked. A field that enables
  // Send on `ok` must not be told yes here.
  if (typed <= 0n) return { ok: false, reason: 'nothing-to-send', ...shape };
  return { ok: true, reason: 'in-band', ...shape };
}

/** What one publish BOOKS at the vault: the discounted fee plus the flush amortisation; nothing at 100%. */
export function vaultTakeFor(feeDue) {
  const fee = toBig(feeDue, 'feeDue');
  return fee > 0n ? fee + FV_FLUSH_AMORT : 0n;
}

// THE VAULT'S OWN CARRIAGE. The vault sends the publish on with mode 0, so the forward fee of that internal
// message comes OUT of the value before the shard sees it — and it is proportional to the capsule's bytes.
// MEASURED on the built clean-18 pair: 1,102,201 at 64 B and 1,667,534 at 1,024 B, i.e. 588.9/byte over a base of
// ~1,064,500 — the same 585.4/byte carriage this project measures everywhere, rounded up here because the safe
// direction is over-attaching: the surplus comes home on the same hop.
//
// A SECOND, INDEPENDENT MEASUREMENT OF THE SAME SLOPE, kept although the door that produced it is gone
// [2026-09-01]. Bisecting the float at which each rung's external publish stopped landing gave 567.84 nanoton per
// capsule byte over a 25x span (1,357 B → 807,112; 8,693 B → 5,003,374; 34,122 B → 19,403,904; base 54,895,
// residuals inside ±52,148). A carriage costs the same whether the crossing is an external's import fee or an
// internal's forward fee, which is why two doors measured one number — and why the constants below round the
// slope UP and carry a flat cushion, the reasoning FV_FWD_HEADROOM uses in the contract: a fitted figure is exact
// today and wrong after a network repricing, while a rounded one with a cushion survives it.
export const FV_CARRIAGE_BASE = 1_100_000n;
export const FV_CARRIAGE_PER_BYTE = 600n;

// THE DEPLOYING HOP CARRIES THE SHARD'S OWN CODE, AND A CARRIAGE IS CHARGED PER CELL AS WELL AS PER BIT
// [2026-09-05, MEASURED]. The per-byte slope above prices a CAPSULE: 127-byte snake cells, where the cell price
// is a small fixed share of every full cell. A StateInit is the opposite shape — a compiled contract is many small
// cells — so no byte slope can price it, and until this date nothing did: the first publish of an era rode its
// code on FV_FWD_HEADROOM and the direct figure's rounding slack. When the clean-18 PublicShard grew by the
// reaction counters (60 -> 68 cells) that slack ran out, and PDR-01 measured the consequence at the exact client
// figure: attach 14,407,200, the vault forwarded 10,606,532 against the shard's 10,900,000 floor, refused 13704 —
// the deploying discounted post lost under a green wallet, the same shape twice fixed on this door already.
//
// So the StateInit is priced from what it IS: the basechain forward-fee schedule (config 25, msg_forward_prices),
// applied to the cells and bits of the code and data that ride the message. Read from the sandbox's config on
// 2026-09-05 and PINNED against it by PDR-05: lump 66,667; bit 4,369,067; cell 436,906,667, each per 2^16 — i.e.
// 66.667 nanoton a bit and 6,666.67 a cell, the 585.4/byte this project measures everywhere for full snake cells.
// The lump is not repeated here: it is inside FV_CARRIAGE_BASE already. On the PublicShard cell this file was
// fixed against (66 code cells / 30,680 bits + 1 data cell / 515 bits) the term is 2,526,334 nanoton, against the
// 2,407,200 the capsule carriage and headroom had between them.
export const FV_MSG_FORWARD_PRICES = Object.freeze({ lump: 66_667n, bit: 4_369_067n, cell: 436_906_667n });

/** Distinct cells and their bits under `root`, root included — what a forward fee is charged on. */
export function cellTreeStats(root) {
  const seen = new WeakSet();
  let cells = 0n;
  let bits = 0n;
  const visit = (cell) => {
    if (!cell || seen.has(cell)) return;
    seen.add(cell);
    cells += 1n;
    bits += BigInt(cell.bitLength ?? 0);
    for (const ref of cell.refs ?? []) visit(ref);
  };
  visit(root);
  return { cells, bits };
}

/** The basechain forward fee of a message whose body and init together hold `cells` and `bits` (config 25). */
export function forwardFeeNanotons({ cells, bits }, prices = FV_MSG_FORWARD_PRICES) {
  return prices.lump + (prices.bit * BigInt(bits) + prices.cell * BigInt(cells) + 65_535n) / 65_536n;
}

/**
 * What one hop charges for carrying a shard's StateInit — the code and data halves a DEPLOYING publish rides on
 * the vault → shard message. Zero when no halves ride. Half a StateInit is refused, as the message builder
 * refuses it: the two hash to an address nothing occupies, and a publish priced for one would be lost.
 */
export function stateInitCarriageNanotons(code, data, prices = FV_MSG_FORWARD_PRICES) {
  if (!code && !data) return 0n;
  if (!!code !== !!data) throw new RangeError('stateInitCarriageNanotons: code and data must be supplied together');
  const c = cellTreeStats(code);
  const d = cellTreeStats(data);
  return (prices.bit * (c.bits + d.bits) + prices.cell * (c.cells + d.cells) + 65_535n) / 65_536n;
}

// How long an EmergencyExit's debt absorbs incoming credits, mirroring FV_EXIT_ABSORB_WINDOW in
// contracts18/contracts/FeeVault.tact. A re-stake inside it pays the debt down instead of raising the mirror.
export const FV_EXIT_ABSORB_WINDOW = 300;

// HOW LONG A PARKED UNSTAKE MUST SIT BEFORE IT MAY BE RELEASED — the mirror of gate 28052
// (`now() > pending_at + FV_UNSTAKE_UNJAM_GRACE_SECONDS`). Without it on this side the client offers a
// Release the chain aborts: MEASURED at 0s / 60s / 3599s the vault refuses 28052 and at 3601s it accepts.
// The grace is what tells a HEALTHY unstake, whose three-hop ack is simply still in flight, from one that
// never settled — and those two states look identical in `pending` alone.
export const FV_UNSTAKE_UNJAM_GRACE_SECONDS = 3600;


// THE OPS THE OWNER SENDS, mirrored from contracts18/contracts/FeeVault.tact and pinned against it by a gate.
export const FEE_VAULT_OPS = Object.freeze({
  PublishViaVault: 0x4D323144, // "M21D" — the ONE door: the wallet funds the publish it carries
  Unstake: 0x4D323145,         // "M21E"
  UnstakeUnjam: 0x4D323146,    // "M21F"
  WithdrawFloat: 0x4D323148,   // "M21H"
  EmergencyExit: 0x4D323147,   // "M21G"
  FlushFees: 0x4D32314B,       // "M21K" — collect the booked fees to the treasury now
});

// WHAT A VAULT MUST BE DEPLOYED WITH. Its rent is MEASURED at 2,143,751 nanoton/year, and this clears the 1.5x
// margin over ten years of dormancy that gate LR-04 holds every account in the lane to: the gate prints retained
// 49,750,266 against rent 21,437,513, a margin of 2.321x. A vault that froze would strand the very stake it
// exists to custody, and a frozen account cannot be unstaked from.
// [Until 2026-09-01 this read 2,793,373/yr, 24,685,621 and 2.013x — measured while the vault still carried an
// external receiver, which LR-04 went red at 0.03 for the day it was added: a receiver is code and code is
// storage. Deleting the door took the code cell from depth 11 to 8 and the rent down with it. The margin was
// never the binding constraint here, but a number stated as measured has to be the one the gate prints today.]
export const FV_DEPLOY_FUNDING = 50_000_000n;

// Gate 28034: what an Unstake must arrive with, because the leg it sends out has to fund the frozen wallet's
// internal transfer, the recipient-side wallet deploy that rides every transfer there, and the excesses ack back.
export const FV_UNSTAKE_MIN_INBOUND = 55_000_000n;

// WHAT AN UNJAM MUST ARRIVE WITH — a different question, which for a long time borrowed the answer above.
// UnstakeUnjam has no value gate at all (28050 owner, 28051 a leg to release, 28052 the grace) and it sends
// nothing out, so it needs only its own gas; whatever else it carries STAYS in the vault until a later
// WithdrawFloat sweeps it. Defaulting to FV_UNSTAKE_MIN_INBOUND parked 0.035 GRAM per unjam in the one contract
// the owner ruled must hold no user GRAM [OWNER 2026-09-01: the money for sending travels with the message].
// MEASURED 2026-09-01: the receiver returns exit 0 at 20,000,000 and queues no return leg. Room for a gas
// repricing, not a floor anything enforces.
export const FV_UNJAM_INBOUND = 20_000_000n;

// The INTERNAL door's own reserves, mirrored from FeeVault.tact and pinned by CLIENT-VAULT-01: gate 28021 demands
// the attach exceed take + FV_PUBLISH_SELF_RESERVE, and gate 28022 stacks the incoming forward fee plus
// FV_FWD_HEADROOM on top of that. vaultInternalPublishValue folds both into the one number a caller attaches.
export const FV_PUBLISH_SELF_RESERVE = 1_000_000n;
export const FV_FWD_HEADROOM = 1_000_000n;

// WHAT A SWEPT VAULT KEEPS — FV_RENT_FLOAT in FeeVault.tact, mirrored so the profile can show what is FREE above
// it [audit 2026-09-05, round 1]. The vault parks the owner's GRAM on five paths (the stake notification's
// carriage, every publish's unspent self-reserve, every unstake's excesses, a refused publish's un-booked take) and
// only WithdrawFloat brings them home — a receiver the app never called. The contract reserves this float plus the
// booked fees and sends the rest; the client shows the same difference and offers the same message.
export const FV_RENT_FLOAT = 50_000_000n;
// Below this much free GRAM the row stays hidden: a sweep costs a wallet fee, and dust is not worth a transaction.
export const FV_FLOAT_RETURN_MIN = 10_000_000n;

const bytesToBig = (b) => { let x = 0n; for (const byte of b) x = (x << 8n) | BigInt(byte & 0xff); return x; };

/**
 * The vault's StateInit. FeeVault's init takes exactly one argument — the owner wallet — so its data cell is
 * `b{0} + owner address`, the same shape vault-wire.tact hashes on chain when a shard derives the only vault
 * address it will accept a discounted fee from. Reusing shardStateInitCell rather than open-coding it keeps ONE
 * implementation of the StateInit layout in this client.
 */
export function feeVaultStateInitCell(vaultCodeBoc, ownerWallet) {
  return shardStateInitCell(vaultCodeBoc, [['owner', ownerWallet, 'address']]);
}

/** The vault's account address — the same one a shard derives from the payer, so a mismatch here is a refusal. */
export async function feeVaultAddressBytes(vaultCodeBoc, ownerWallet) {
  const { hash } = await computeCellHashAndDepth(feeVaultStateInitCell(vaultCodeBoc, ownerWallet));
  return { workchain: 0, hash };
}

/** Raw "0:hex" form, which is what every builder in this client takes. */
export async function feeVaultAddress(vaultCodeBoc, ownerWallet) {
  return rawAddress(await feeVaultAddressBytes(vaultCodeBoc, ownerWallet));
}




/**
 * WHAT TO PUT IN AN ACTION'S `value` — the number the client did not have.
 *
 * The vault used to publish a per-action floor of its own, `ext_min_value` (the discounted fee plus its
 * execution reserve), and that was the only figure a client had. It cannot land a publish, which is why this
 * function exists: MEASURED at a 100% discount it is 5,000,000 against a shard deploy floor of 6,300,000, and
 * the vault forwards with mode 0, so the carriage comes out of `value` before the shard sees anything — exit
 * 13652 at 64 B and 1 KB, and at 8 KB and above the vault's own ACTION phase failed outright, with no shard
 * transaction at all. The field left the view with the external door on 2026-09-01; the lesson is the reason
 * this docstring keeps it.
 *
 * THE ARITHMETIC [rewritten 2026-08-30 with the fee-routing decision]. No fee rides to any shard on the vault
 * route any more: the shard's floor is flat (what must ARRIVE: endowment + gas — the fee and transport terms
 * left it), and the vault splits the TAKE (feeDue + FV_FLUSH_AMORT, zero at a full discount) out of the
 * action's value before forwarding. So an action must carry, in one number:
 *     what the shard must receive  +  the outgoing carriage  +  the take the vault keeps behind.
 * The first term is derived from the same one-source figure the direct door used
 * (web/publish-price.mjs: publishValueFor / publicPublishValueForKind) by stripping the fee and transport that
 * figure historically included — deriving, not re-declaring, so the floors keep exactly one home. An earlier
 * version computed `direct - fee_gap + carriage`, which lands only because the algebra happens to cancel to
 * within the amortisation; it priced against a gate shape (`fee_gap`) that no longer exists in any contract.
 *
 * NO CLAMP. This used to end by promising the result was "never allowed below the vault's own ext_min_value",
 * and the clamp itself was removed with the door that published that figure — leaving the docstring asserting a
 * guarantee the code twenty lines below already denied. Nothing is lost: the vault's own work is funded by
 * FV_PUBLISH_SELF_RESERVE, which vaultInternalPublishValue adds on top of this number, and gate 28021 refuses
 * anything short of it.
 */
export function vaultActionValue({ directValue, capsuleBytes, feeDue, stateInit = null, protocolFee = FV_PROTOCOL_FEE, feeTransport = FV_FEE_TRANSPORT }) {
  const direct = toBig(directValue, 'directValue');
  // feeDue IS REQUIRED, and it used to default to 0n — the answer that is right at a 100% discount and wrong at
  // every other [audit 2026-09-01, round 12 — MEASURED]. An omitted `feeDue` under-attaches by exactly one
  // feeTake(): at 5,000 ATH staked and 1 KB the value came out 10,214,400 against a needed 15,216,400, and the
  // failure is the silent kind — the vault accepts the message and books its take, and the SHARD refuses 13652
  // with nothing stored. At bps 1 and 8 KB the shortfall reached 9,515,200: exit -14 at the shard, no bounce,
  // and the take left booked for a publish that never happened.
  // The caller always holds `view.fee_due`; a default here only ever silently substituted the wrong discount.
  if (feeDue === undefined || feeDue === null) {
    throw new Error('vaultActionValue: feeDue is required — pass view.fee_due; a default is only right at 100%');
  }
  // AND capsuleBytes IS REQUIRED FOR THE SAME REASON [audit 2026-09-01, round 13]. It defaulted to 0 — the
  // answer that is right at zero bytes and wrong at every real size, the exact shape feeDue's default was
  // removed for a day earlier. MEASURED with a 32,768-byte capsule priced at 0: the attach comes out
  // 11,600,000 against a needed 31,260,800, and the vault refuses 28022 and bounces home. That failure is
  // loud, unlike feeDue's, which is why this one survived a round longer — but a default that silently
  // substitutes the wrong size is the defect either way, and the caller always knows the size.
  if (capsuleBytes === undefined || capsuleBytes === null) {
    throw new Error('vaultActionValue: capsuleBytes is required — the carriage is charged per byte, and a '
      + 'default of 0 prices a publish that nobody sends');
  }
  const due = toBig(feeDue, 'feeDue');
  const fee = toBig(protocolFee, 'protocolFee');
  const transport = toBig(feeTransport, 'feeTransport');
  if (due > fee) throw new Error('vaultActionValue: feeDue exceeds the protocol fee');
  const feeLeg = fee + transport;
  const arrival = direct > feeLeg ? direct - feeLeg : 0n;   // what the shard must actually receive
  // The carriage is ADDED, not assumed to be inside the direct figure. MEASURED: without it the attach lands at
  // 64 B and 1 KB on the direct route's slack alone and is refused 13652 from 8 KB up — the size where the
  // slack runs out is exactly where a real message starts.
  const bytes = BigInt(Math.max(0, Math.trunc(Number(capsuleBytes) || 0)));
  const carriage = FV_CARRIAGE_BASE + FV_CARRIAGE_PER_BYTE * bytes;
  // AND THE SHARD'S STATEINIT, WHEN THIS PUBLISH DEPLOYS THE SHARD [2026-09-05, MEASURED — see
  // FV_MSG_FORWARD_PRICES]. `stateInit` is `{ code, data }`, the same two halves the message builder attaches;
  // the forward fee of the vault -> shard hop is charged on them cell by cell, and the byte slope above does not
  // see them. Absent halves cost nothing; half a pair is refused, as the builder refuses it.
  const init = stateInit ? stateInitCarriageNanotons(stateInit.code, stateInit.data) : 0n;
  // NO `extMinValue` CLAMP ANY MORE [2026-09-01, the external door deleted]. That floor was gate 28114's, on
  // a door that no longer exists; the ONE door's own floor is gate 28021 (`take + FV_PUBLISH_SELF_RESERVE`) and
  // vaultInternalPublishValue adds it on top of this figure, where it belongs. It never bound in practice
  // anyway — it only bites below a direct figure of ~14,498,000 and the smallest real one is 17,810,000.
  return arrival + carriage + init + vaultTakeFor(due);
}







// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE OWNER'S OWN MESSAGES. Each returns the wallet-message shape sendPlathoWalletTransaction consumes —
// { address, amount, payload, stateInit, bounce } — so the app sends them exactly like any other transaction.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const opBody = (op, build) => {
  const b = beginCell().uint(BigInt(op), 32, 'op');
  if (build) build(b);
  return bytesToBase64(serializeBoc(b.endCell()));
};

/**
 * Create the vault. Body is EMPTY on purpose: FeeVault's plain `receive()` exists so an account can be brought
 * into being — and later topped up — by an ordinary transfer, and a deploy that also tried to do something would
 * couple the account's existence to that something succeeding.
 */
export function buildVaultDeployMessage(vaultCodeBoc, ownerWallet, vaultAddress, value = FV_DEPLOY_FUNDING) {
  return {
    address: vaultAddress,
    amount: toBig(value, 'value'),
    payload: null,
    stateInit: feeVaultStateInitCell(vaultCodeBoc, ownerWallet),
    // NOT bounceable: a deploy must land on an account that does not exist yet, which is exactly what a
    // bounceable message refuses to do.
    bounce: false,
  };
}

/** Move GRAM into the float. Same shape as the deploy minus the StateInit — the vault's plain receive() takes it. */
export function buildVaultTopUpMessage(vaultAddress, amount) {
  return { address: vaultAddress, amount: toBig(amount, 'amount'), payload: null, stateInit: null, bounce: true };
}


/**
 * Withdraw staked ATH. `amount == 0` is refused by the contract rather than read as "all": the staked mirror can
 * read LOW while a previous unstake is in flight, and "all" computed from a low mirror silently strands the rest.
 */
export function buildVaultUnstakeMessage(vaultAddress, amount, value = FV_UNSTAKE_MIN_INBOUND) {
  return {
    address: vaultAddress,
    amount: toBig(value, 'value'),
    payload: opBody(FEE_VAULT_OPS.Unstake, (b) => b.coins(toBig(amount, 'amount'), 'amount')),
    stateInit: null,
    bounce: true,
  };
}

/**
 * RELEASE AN UNSTAKE WHOSE ACK NEVER CAME. The two-phase unstake parks `pending` while the leg is in flight; a
 * deep failure past our own leg (the frozen wallet restored its balance on its own bounce path and has nothing to
 * tell us) leaves it parked forever. The contract lets the owner release it after
 * FV_UNSTAKE_UNJAM_GRACE_SECONDS, and the mirror rejoins the wallet's truth.
 *
 * [WRITTEN 2026-08-30. This and the hatch below were named by two audits as contract capabilities with no client
 * builder: the ONLY release for a jammed unstake and the ONLY recovery for stranded ATH were unreachable from the
 * app. The contract logic was measured sound on both; what was missing was a way to ask.]
 */
export function buildVaultUnstakeUnjamMessage(vaultAddress, value = FV_UNJAM_INBOUND) {
  return {
    address: vaultAddress,
    amount: toBig(value, 'value'),
    payload: opBody(FEE_VAULT_OPS.UnstakeUnjam, (b) => b),
    stateInit: null,
    bounce: true,
  };
}

/**
 * THE RECOVERY OF LAST RESORT: move ATH the vault's `staked` mirror does not reflect. The mirror can sit BELOW
 * the real balance of the vault's own ATHWallet in four ways the contract enumerates — a stake whose
 * forward_ton_amount was 0 (credited, no notification), a vault that froze and was redeployed, a stray excesses
 * that cleared `pending` early, and a stake sent BEFORE the vault was deployed at all. `Unstake` is bounded by
 * `staked` (gate 28033) and therefore cannot reach any of them; this can, in any state.
 *
 * ⚠️ IT BOOKS A DEBT. The hatch records what it ASKED for, and a credit arriving within FV_EXIT_ABSORB_WINDOW
 * (300 s) pays that debt down instead of raising the mirror — which is correct while the hatch really took the
 * ATH, and is why a re-stake immediately afterwards appears to do nothing. `get_vault` reports `exited` and
 * `exited_at` so a caller can say WAIT rather than let the user think the stake vanished. A hatch whose leg
 * BOUNCES clears the debt on its own (bounced<JettonTransfer>), so a refused over-ask costs nothing.
 */
export function buildVaultEmergencyExitMessage(vaultAddress, amount, value = FV_UNSTAKE_MIN_INBOUND) {
  return {
    address: vaultAddress,
    amount: toBig(value, 'value'),
    payload: opBody(FEE_VAULT_OPS.EmergencyExit, (b) => b.coins(toBig(amount, 'amount'), 'amount')),
    stateInit: null,
    bounce: true,
  };
}

/**
 * IS THE ABSORB WINDOW OPEN, and for how much longer. A re-stake made while it is will be swallowed by the open
 * exit debt instead of raising the mirror, and without this a client cannot tell that apart from a stake that
 * never arrived. `nowSec` is the caller's clock; the window is FV_EXIT_ABSORB_WINDOW seconds from `exited_at`.
 */
export function vaultExitDebtWindow(view, nowSec) {
  const exited = toBig(view?.exited ?? 0n, 'exited');
  if (exited === 0n) return { open: false, exited: 0n, secondsLeft: 0 };
  const at = Number(view?.exited_at ?? 0);
  const left = at + FV_EXIT_ABSORB_WINDOW - Math.floor(Number(nowSec) || 0);
  // INCLUSIVE, because the contract is [audit 2026-09-01, round 12 — MEASURED]. The gate reads
  // `(now() - exited_at) <= FV_EXIT_ABSORB_WINDOW`, so the LAST second of the window still absorbs; `left > 0`
  // here answered "closed" on exactly that second. Measured at exited_at + 300 with a 4,000 ATH debt open: the
  // chain SWALLOWED a 1,000 ATH re-stake while this function said the window had shut. The unsafe direction —
  // a user told it is safe to re-stake loses the credit into the debt, `staked` never reflects it, Unstake
  // (28033) cannot reach it, and every later publish keeps the older, worse discount until they run
  // EmergencyExit and re-stake outside the window. Only reachable below the 10,000 ATH cap, where the mirror
  // still moves a price. CLIENT-VAULT-12 now drives all three of 299/300/301 against the chain.
  return { open: left >= 0, exited, secondsLeft: left > 0 ? left : 0 };
}

/** Sweep the float back to the owner. Carries no amount: the contract computes what is free above its rent. */
export function buildVaultWithdrawFloatMessage(vaultAddress, value = 20_000_000n) {
  return {
    address: vaultAddress,
    amount: toBig(value, 'value'),
    payload: opBody(FEE_VAULT_OPS.WithdrawFloat),
    stateInit: null,
    bounce: true,
  };
}

/**
 * THE DOOR's attach — the one number a publish needs [CUTOVER item 11]. vaultActionValue (shard arrival +
 * carriage + take) plus the two reserves this door's own gates demand: the vault's self reserve (28021) and the
 * forward headroom (28022). The incoming forward fee those gates price against is bounded by the carriage
 * already inside vaultActionValue (the vault forwards the same capsule with a LIGHTER header), and everything
 * above the real cost comes home: the change goes to the payer, so over-attaching is wallet headroom, never a
 * spend.
 */
export function vaultInternalPublishValue(args) {
  return vaultActionValue(args) + FV_PUBLISH_SELF_RESERVE + FV_FWD_HEADROOM;
}

// THE KIND THE DISCOUNT DOOR REFUSES, mirrored from PublicShard.tact and pinned to it by PDC-02. BEACON writes
// into the shared catalogue, where the only wall against junk is the full fee, so gate 13723 closes the discount
// for it [decided 2026-08-30].
export const PS_KIND_BEACON = 2;

/**
 * WHICH DOOR SHOULD THIS PUBLIC PUBLISH TAKE? Returns { route: 'vault' | 'direct', reason }.
 * `kind` is the PublicShard kind number 0..3, the same argument publicPublishValueForKind takes.
 *
 * CONV never asks: RecordShard has no direct receiver, so a private message goes through the vault or nowhere.
 * PUBLIC has both doors live, and the answer is genuinely not "always the discount", because the two differ by
 * one message crossing that CARRIES THE CAPSULE:
 *
 *     direct   external(wallet) -> internal(wallet -> shard)                     2 carriages, full fee
 *     vault    external(wallet) -> internal(wallet -> vault) -> internal(shard)  3 carriages, discounted fee
 *
 * A carriage is charged per byte and the waived fee is FLAT, so the third hop eats the discount as the capsule
 * grows. MEASURED in contracts18/tests/public-door-choice.test.ts PDC-01 on the built pair, payer pocket in and
 * out: the crossover sits INSIDE the 32,768-byte capsule range at every stake band, so a large image posted at
 * the 10,000 ATH cap costs MORE through the discount door than through the full-fee one. Routing every publish
 * through the vault would overcharge exactly the largest stakers on exactly the largest posts, which is the
 * standing rule this answers to: an intermediary that carries the load must lose on a big capsule, so count the
 * carriages, and a door that costs the user more is a defect rather than a trade-off.
 *
 * Reasons, in the order they are decided:
 *   'kind-closed'  BEACON — the shard refuses it at 13723, and that refusal costs the payer the whole transport
 *                  while storing nothing. On the channel-save path it splits a pair, saving the description and
 *                  dropping the announcement that makes it findable.
 *   'discount'     the discount is worth more than the extra carriage. Take the vault.
 *   'carriage'     it is not. Take the direct door — which is also what an UNSTAKED user always gets, by the
 *                  same arithmetic and with no special case: with nothing staked the only saving is the 600,000
 *                  of sink transport the vault door sheds, and one carriage costs more than that at every size.
 */
export function publicPublishRoute({ kind, capsuleBytes, feeDue, stateInit = null, protocolFee = FV_PROTOCOL_FEE,
  feeTransport = FV_FEE_TRANSPORT }) {
  const k = Number(kind);
  if (!Number.isInteger(k) || k < 0 || k > 3) {
    throw new RangeError(`publicPublishRoute: ${kind} is not a PublicShard kind (expected 0..3) — CONV and `
      + 'INTRO have one door each, so the question does not arise there');
  }
  if (k === PS_KIND_BEACON) return { route: 'direct', reason: 'kind-closed' };

  const bytes = toBig(capsuleBytes, 'capsuleBytes');
  // What the discount is worth here: the direct door pays the whole fee AND its transport to the sink, while the
  // vault door pays neither and books its take instead.
  const saved = protocolFee + feeTransport - vaultTakeFor(feeDue);
  // What it costs: one more crossing of this capsule — and of the shard's StateInit when this publish deploys
  // the shard, because the direct door carries those halves once (wallet -> shard) and the vault door twice
  // [2026-09-05]. The same constants the attach arithmetic uses, so the decision and the funding cannot drift
  // apart.
  const extra = FV_CARRIAGE_BASE + FV_CARRIAGE_PER_BYTE * bytes
    + (stateInit ? stateInitCarriageNanotons(stateInit.code, stateInit.data) : 0n);
  return saved > extra ? { route: 'vault', reason: 'discount' } : { route: 'direct', reason: 'carriage' };
}

/**
 * PUBLISH: the owner's wallet funds the whole attach, in this very message. This is the ONLY way a CONV capsule
 * reaches a shard — RecordShard has no direct receiver — so "send a private message" and "this message" are the
 * same act. Nothing has to be armed, funded or topped up first.
 *
 * `shardCode`/`shardData` ride ONLY when this publish must also CREATE the shard — the first message of a
 * conversation, whose StateInit lazily deploys it (the H1 onboarding case). Both or neither: half a StateInit
 * hashes to an address nothing occupies, and the publish would land on an uninitialised account and be lost
 * while the send reports success. Wire: PublishViaVault{ shard, ^record, Maybe ^shard_code, Maybe ^shard_data },
 * proven against the real contract by CLIENT-VAULT-13.
 */
export function buildVaultInternalPublishMessage(vaultAddress, { shard, record, shardCode = null, shardData = null, value }) {
  if (!record) throw new TypeError('record is required');
  if (!!shardCode !== !!shardData) throw new RangeError('shardCode and shardData must be supplied together');
  return {
    address: vaultAddress,
    amount: toBig(value, 'value'),
    payload: opBody(FEE_VAULT_OPS.PublishViaVault, (b) => {
      b.address(shard, 'shard').ref(record, 'record');
      b.customPayloadMaybe(shardCode, 'shard_code');   // Tact `Cell?` IS TEP-74's Maybe ^Cell: one bit, then the ref
      b.customPayloadMaybe(shardData, 'shard_data');
    }),
    stateInit: null,
    bounce: true,
  };
}

/**
 * COLLECT THE BOOKED FEES NOW — the client hand for the one remedy the dormant-vault parking residue has. The
 * vault flushes itself whenever a publish carries `accrued_fee` past FV_FLUSH_MIN; a vault that stops publishing
 * parks whatever sits below that line until someone asks. The OWNER may ask at any accrued > 0 (gate 28131's
 * first arm); a stranger only at >= FV_FLUSH_MIN, so a sub-threshold vault cannot be made to announce itself to
 * the treasury (the anti-metadata-tap property). The trigger value returns to the sender (SendRemainingValue), so
 * the call costs gas only.
 *
 * ⚠️ THE DUST CASE IS NOW A NAMED REFUSAL — gate 28133 [MEASURED 2026-09-01, round 11; this note has been wrong
 * TWICE and both corrections are kept so the shape is recognisable]. An `accrued_fee` below the flush's own
 * forward fee cannot physically travel, because flushAccrued sends mode 0 and the carriage comes out of the sum.
 *   - Round 4 said the call "bounces back with the trigger, visible and refunded, never silent". False.
 *   - Round 5 replaced that with "compute SUCCEEDS, then the send fails in ACTION with code 37, and the trigger
 *     is absorbed into the owner's float". True at the time, and false since 28133 landed.
 * What happens today, measured: `accrued_fee` from 1 to 66,668 refuses in COMPUTE at **28133**, the action phase
 * never runs, the treasury receives nothing, and — because the refusal is a compute throw on a bounceable
 * message — the trigger BOUNCES HOME rather than settling into the float. 66,669 flushes and the treasury
 * receives 2; the measured carriage is 66,667 and the gate's bound is `context().readForwardFee()` = 66,668.
 * Only the OWNER can reach this band (28131 blocks a stranger below FV_FLUSH_MIN), and it is narrow — a take
 * under the forward fee means a discount above ~99.3%.
 *
 * ⚠️ AND AT A DEEP DISCOUNT A RESIDUE FLUSH IS MOSTLY CARRIAGE. The flush is mode 0 and the carriage is a flat
 * ~66,667, while FV_FLUSH_AMORT accumulates per PUBLISH — so a residue built from few publishes has little
 * amortisation behind it. Measured, smallest residue that clears 28133 at each rung: at 0 bps one publish books
 * 10,002,000 and the treasury nets 9,935,333 (0.6% lost to carriage); at 9,999 bps twenty-four publishes book
 * 72,000 and the treasury nets **5,333 — 77.8% lost**. Nothing is stolen and the owner gains nothing either way
 * (the money leaves their float regardless), but a client offering this button at any `accrued > 0` should say
 * that waiting for the automatic threshold delivers essentially all of it and an early residue flush may not.
 */
export function buildVaultFlushFeesMessage(vaultAddress, value = 20_000_000n) {
  return {
    address: vaultAddress,
    amount: toBig(value, 'value'),
    payload: opBody(FEE_VAULT_OPS.FlushFees),
    stateInit: null,
    bounce: true,
  };
}

/**
 * STAKING PARAMETERS, and why this is a helper rather than a builder. ATH moves on the frozen token cluster's own
 * wire, which this client already speaks (buildAthWalletMessageBody 'ATHTransferRequestWithNotify'), so there is
 * nothing here to build — what there IS to state is that the NOTIFY lane is mandatory. The vault credits a stake
 * only on the JettonTransferNotification its own derived wallet emits, and the frozen wallet emits that
 * notification only when forward_ton_amount is positive. A plain transfer moves the ATH and credits NOTHING: the
 * balance lands in the vault's wallet while the mirror stays at zero, so the discount never appears and the only
 * way back out is the emergency hatch. Returns the params to hand that builder.
 */
export function vaultStakeTransferParams({ vaultAddress, ownerWallet, amount, queryId = 0n, forwardTonAmount = 10_000_000n }) {
  // THE LANE MATTERS MORE THAN THE NUMBERS. The frozen wallet serves two notify lanes: TEP-74's JettonTransfer,
  // whose recipient emits the standard JettonTransferNotification, and Platho's ATHTransferRequestWithNotify,
  // whose recipient emits AthTransferNotification. FeeVault credits a stake ONLY on the standard one — the custom
  // one lands in its unknown-body receiver and throws. [2026-08-29: this helper named the custom lane and the
  // lifecycle gate caught it as exit 28090; the ATH would have moved into the vault's wallet while the mirror
  // stayed at zero, so the discount would never appear and the only way back out is the emergency hatch.]
  const forward = toBig(forwardTonAmount, 'forwardTonAmount');
  // A stake with forward_ton_amount == 0 credits the WALLET and fires NO notification — the F1 failure the
  // vault's emergency hatch exists to recover from. Refuse it here rather than discover it on chain.
  if (forward <= 0n) throw new RangeError('staking requires a positive forward amount, or the vault credits nothing');
  const params = {
    query_id: toBig(queryId, 'queryId'),
    amount: toBig(amount, 'amount'),
    destination: vaultAddress,
    response_destination: ownerWallet,
    custom_payload: null,
    forward_ton_amount: forward,
  };
  return {
    type: 'JettonTransfer',
    params,
    // What the wallet message must CARRY, computed by the same estimator every other ATH path here uses rather
    // than restated: gate 14704 checks this sum and a short one is another silent non-credit.
    attach: estimateAthWalletAttachedValueNanotons('JettonTransfer', params),
  };
}
