// vault-account — THIS USER'S fee vault: where it lives, what state it is in, and what may be done to it.
//
// WHY A LAYER AT ALL. `web/fee-vault.mjs` is a pure builder shelf — every function there takes an address and
// returns a message, and none of them knows whose vault it is or whether that vault exists. That was the right
// shape for proving the wire against the contract, and the wrong shape for a screen: a sweep on 2026-09-02 found
// that FIFTEEN of those builders had ZERO callers anywhere under web/, the whole staking-and-discount mechanism
// among them. The contracts promise a fee discount; the app could not reach it. This is the layer that reaches.
//
// THREE STATES, AND EVERY CALLER MUST HANDLE ALL THREE:
//   * 'unavailable' — this build has no FeeVault code cell. Before the seal that is the honest answer for
//     everyone: FeeVault exists only in clean-18, web/shard-code-18.mjs is a seal-time artifact (CUTOVER.md
//     item 4), and an address derived from a missing cell is a well-formed address that holds nothing. The
//     screen offers nothing and says the feature arrives with the upgrade.
//   * 'absent' — the cell is here, the address derives, and nothing is deployed at it. A first stake creates it.
//   * 'live' — the account answered get_vault, and the view is the truth about staked / pending / fee_due.
//
// NOTHING HERE READS A CLOCK, PICKS A TRANSPORT OR TOUCHES THE DOM. It plans; the caller signs and sends.

import {
  FV_ATOMIC_PER_ATH, FV_DEPLOY_FUNDING, FV_PROTOCOL_FEE, FV_STAKE_MAX_ATH, FV_STAKE_MIN_ATH,
  FV_UNSTAKE_MIN_INBOUND, FV_UNSTAKE_UNJAM_GRACE_SECONDS,
  buildVaultDeployMessage, buildVaultEmergencyExitMessage, buildVaultUnstakeMessage, buildVaultWithdrawFloatMessage,
  buildVaultUnstakeUnjamMessage, feeDueForStakedAtoms, feeVaultAddress, stakeBandVerdict, vaultExitDebtWindow,
  vaultStakeTransferParams, FV_RENT_FLOAT, FV_FLOAT_RETURN_MIN,
} from './fee-vault.mjs?v=8';
import { feeVaultCodeBoc, feeVaultCodeAvailable } from './shard-address.mjs?v=29';
import { createAthWalletMessage } from './pwa-contract-transactions.mjs?v=47';

export const VAULT_UNAVAILABLE = 'unavailable';
export const VAULT_ABSENT = 'absent';
export const VAULT_LIVE = 'live';
// A READ THAT FAILED IS NOT AN ANSWER [audit 2026-09-02]. The reader returns null ONLY for an undeployed
// account; anything else throws. Folding a thrown read into 'absent' told the screen "you have no vault and
// nothing staked" — a positive claim — about a user who might hold 9,000 ATH, and priced the stake field from
// zero, which is how a top-up to "100%" lands above the cap and buys nothing.
export const VAULT_UNKNOWN = 'unknown';

/** Does this build know the vault's code at all — the first question any staking surface asks. */
export const vaultSupported = () => feeVaultCodeAvailable();

/**
 * Where this owner's vault lives, or null when the build cannot say. Null is not an error and must not be
 * reported as one: before the seal it is simply the truth [null-fetch-result-is-later-not-an-error].
 */
export async function vaultAddressFor(ownerWallet) {
  if (!ownerWallet || !vaultSupported()) return null;
  return feeVaultAddress(feeVaultCodeBoc(), ownerWallet);
}

// THE READER IS `web/fee-vault-read.mjs`, AND IT ALREADY EXISTED [audit 2026-09-02, agent facet 1].
//
// This module shipped its own `decodeFeeVaultViewStack` + `createFeeVaultReader`, written hours after the real
// ones, and worse on all three counts that matter:
//   * arity `< 12` instead of `!== 12` — a check that can only catch a getter that SHRANK, under a docstring
//     claiming it caught one that grew. fee-vault-read's own comment documents that exact trap, having been
//     fixed for it on 2026-08-30.
//   * `if (raw.exit_code !== 0) return null` — a branch the PRODUCTION transport can never reach, because
//     ton-rpc-transport.mjs THROWS a TonRpcTransportError on a non-zero exit code instead of returning one.
//     So an undeployed vault (-13) and a rate-limited read arrived identically, as an exception.
//   * no `toWireAddress` normalisation, and no tolerance for the `[type, value]` stack shape.
// And the gate that covers the real one (fee-vault-client.test.ts) was therefore aimed at a module the
// application never loaded. One reader, the one with the tests.
export { decodeFeeVaultViewStack, createFeeVaultReader, FEE_VAULT_VIEW_ARITY } from './fee-vault-read.mjs?v=7';

/**
 * Fold a raw get_vault answer into what a screen needs, with every absence made explicit. `view` is null when
 * the account is not deployed; anything else must carry the fields the contract publishes.
 */
export function vaultSnapshot(view, { nowSec = 0, state } = {}) {
  // ONE SHAPE FOR EVERY BRANCH [audit 2026-09-02]. The empty branches used to return five keys where the live
  // one returns twelve, so `pending` and `exitWindow` were simply absent — and every guard that reads them
  // (`planStake`'s exit-debt refusal, `planUnstake`'s in-flight refusal) fell through to its `??` default and
  // passed. A guard that is present on one branch of a function and missing on another is not a guard.
  const empty = (kind) => ({
    state: kind, staked: 0n, stakedAth: 0n, bps: 0n, feeDue: FV_PROTOCOL_FEE,
    pending: 0n, pendingAt: 0, exited: 0n, exitedAt: 0,
    exitWindow: { open: false, exited: 0n, secondsLeft: 0 },
    balance: 0n, accruedFee: 0n, nowSec,
  });
  if (!vaultSupported()) return empty(VAULT_UNAVAILABLE);
  if (state === VAULT_UNKNOWN) return empty(VAULT_UNKNOWN);
  if (!view) return empty(VAULT_ABSENT);
  const staked = BigInt(view.staked ?? 0n);
  const pending = BigInt(view.pending ?? 0n);
  const exited = BigInt(view.exited ?? 0n);
  return {
    state: VAULT_LIVE,
    staked,
    stakedAth: staked / FV_ATOMIC_PER_ATH,
    // THE VIEW'S OWN NUMBERS WIN WHERE IT HAS THEM. discount_bps and fee_due are what this vault will actually
    // charge; the derived form above exists for the publish path, which has no view in hand.
    bps: BigInt(view.discount_bps ?? 0n),
    feeDue: BigInt(view.fee_due ?? feeDueForStakedAtoms(staked)),
    // AN UNSTAKE IN FLIGHT BLOCKS THE NEXT ONE (gate 28031), so a screen that does not show `pending` shows a
    // button that will be refused. `pending_at` is what tells a stuck one from a fresh one.
    pending,
    pendingAt: Number(view.pending_at ?? 0),
    // THE EMERGENCY DEBT AND ITS ABSORB WINDOW. While this is open a re-stake is SWALLOWED to repay it, which
    // is invisible without these two fields — the vault would report a stake that never raised the discount.
    //
    // THE WINDOW IS RESOLVED HERE, NOT BY THE CALLER, and that is the whole point [audit 2026-09-02]. planStake
    // called `vaultExitDebtWindow(snapshot, ...)` — but that helper reads the RAW view's `exited_at`, and this
    // snapshot had renamed the field to `exitedAt`. MEASURED: with a 4,000 ATH debt opened 100 seconds ago the
    // helper read `exited_at` as 0, computed a window that closed in 1970, and answered `open: false` — so the
    // guard against the one failure these fields exist for passed the stake straight through. One derivation, in
    // the one place both spellings are in scope, is the only shape where the two cannot disagree.
    exited,
    exitedAt: Number(view.exited_at ?? 0),
    exitWindow: vaultExitDebtWindow(view, nowSec),
    balance: BigInt(view.balance ?? 0n),
    // the protocol's booked fees parked here between flushes — reserved with the float by WithdrawFloat, so what is
    // FREE for the owner is balance minus both (planWithdrawFloat)
    accruedFee: BigInt(view.accrued_fee ?? 0n),
    // `athWallet` USED TO SIT HERE and was always null [audit 2026-09-02]: decodeFeeVaultViewStack skips the
    // two address slots, so `view.ath_wallet` never existed, nothing read the field, and it looked like a
    // working piece of the view. Cut rather than filled — a screen that needed the vault's ATH wallet would
    // be deriving it, not trusting a getter slot this reader deliberately does not decode.
    nowSec,
  };
}

/**
 * WHAT A TYPED STAKE AMOUNT WOULD DO, and the messages that would do it.
 *
 * The band is enforced HERE and only here, because the contract cannot enforce it: the frozen ATHWallet credits
 * its own balance BEFORE it notifies and notifies with bounce:false, so a throw in the vault's credit receiver
 * would strand the ATH outside the mirror rather than return it — and returning it is not affordable either
 * (the notification carries 10,000,000 and a transfer back to an existing wallet needs 36,000,012). The contract
 * holds the CEILING and nothing else, by the owner's decision. [CUTOVER.md item 11]
 *
 * Returns { ok, reason, verdict, messages } — `messages` is empty unless ok.
 */
export function planStake({ ownerWallet, vaultAddress, athWalletAddress, ath, snapshot, queryId = 0n,
  deployValue = FV_DEPLOY_FUNDING }) {
  if (!vaultSupported()) return { ok: false, reason: 'unavailable', messages: [] };
  if (!ownerWallet || !vaultAddress || !athWalletAddress) return { ok: false, reason: 'no-wallet', messages: [] };
  // A MISSING SNAPSHOT IS NOT AN ABSENT VAULT [audit 2026-09-02, round 2]. This defaulted to VAULT_ABSENT, so a
  // null or undefined snapshot — which is exactly what a wallet teardown leaves between a dialog opening and its
  // submit — was priced from zero staked, the very claim the UNKNOWN state was introduced to forbid. The refusal
  // keys on the ABSENCE of a positive answer, not on one particular string.
  const state = snapshot?.state ?? VAULT_UNKNOWN;
  // AN UNKNOWN POSITION CANNOT BE BOUNDED [audit 2026-09-02]. The band is a rule about where the vault ENDS UP,
  // and that is only computable from a position we actually read. When the read threw — a rate limit, a timeout,
  // a dead door — pricing from zero is not a conservative guess, it is the WRONG direction: it says a 10,000 ATH
  // top-up lands exactly on the cap for a user who already holds 9,000, and nine thousand of it then buys
  // nothing. Refusing costs the user a retry; guessing costs them the stake.
  if (state === VAULT_UNKNOWN) return { ok: false, reason: 'position-unknown', messages: [] };
  // THE BOUND IS ON THE RESULTING POSITION, not on the number typed: topping 9,900 up by 200 ends at 10,100 and
  // must be refused, by 100 lands exactly on the cap.
  const verdict = stakeBandVerdict(ath, { stakedAtoms: snapshot?.staked ?? 0n });
  if (!verdict.ok) return { ok: false, reason: verdict.reason, verdict, messages: [] };

  // AN OPEN EXIT DEBT SWALLOWS THE STAKE [audit 2026-09-02 — this layer EXPOSED the two fields and then
  // never read them]. The contract's credit receiver pays the debt down BEFORE it raises the mirror:
  //   let debt = (now() - exited_at) <= FV_EXIT_ABSORB_WINDOW ? exited : 0;
  //   if (debt >= msg.amount) { exited -= msg.amount; } else { staked += msg.amount - debt; exited = 0; }
  // — so inside that 300-second window a stake is absorbed, wholly or in part, and the discount does not
  // move. The screen would have quoted a position the chain then refused to grant, which is the exact
  // failure `exited`/`exited_at` were added to the view to make visible. Refusing is the honest answer:
  // the window is short and the ATH is not lost by waiting it out.
  const debtWindow = snapshot?.exitWindow ?? { open: false, exited: 0n, secondsLeft: 0 };
  if (debtWindow.open) {
    return { ok: false, reason: 'exit-debt-open', verdict, debtWindow, messages: [] };
  }

  // AND AN UNSTAKE IN FLIGHT MAKES THE MIRROR READ LOW [audit 2026-09-02 — the twin `planUnstake` already had].
  // `Unstake` moves the amount OUT of `staked` into `pending`, and `ATHTransferFailed` puts it back
  // (`self.staked = self.staked + self.pending`). So with 9,000 parked out of 10,000 the mirror reads 1,000, the
  // band happily accepts another 9,000 as "exactly the cap" — and if the parked leg then fails the position is
  // 19,000, nine thousand of it above the cap and earning nothing. This module's own docstring names the reason
  // one function below; the guard was on one side of the pair only.
  if ((snapshot?.pending ?? 0n) > 0n) {
    return { ok: false, reason: 'unstake-in-flight', verdict, messages: [] };
  }

  const messages = [];
  // A FIRST STAKE CREATES THE VAULT, and the deploy rides the SAME signature — one password prompt, not two.
  // Ordering is not left to chance: the deploy is ONE hop from the wallet while the credit notification is
  // THREE (wallet -> owner ATH wallet -> vault ATH wallet -> vault), so the account is alive long before the
  // notification looks for it. VAULT-STAKE-02 drives both messages from one transfer and measures that the
  // mirror really moved; a notification arriving at a dead account is the F1 state EmergencyExit exists for.
  // ...AND A VAULT SOMEBODY ELSE DEPLOYED UNDER-FUNDED GETS ITS FLOAT [audit 2026-09-06, round 3]. `init(owner)` is
  // permissionless: a stranger can create a user's vault with a thousandth of a GRAM, the client then reads LIVE and
  // sends no float, and the account lives on ~1M against ~2.1M a year of rent — frozen within the year, the stake
  // custodied inside. A live vault below FV_RENT_FLOAT gets the same funding message a deploy does (a StateInit on an
  // existing account is ignored; the value is the float).
  const lowFloat = state === VAULT_LIVE && BigInt(snapshot?.balance ?? 0n) < FV_RENT_FLOAT;
  if (state !== VAULT_LIVE || lowFloat) {
    messages.push(buildVaultDeployMessage(feeVaultCodeBoc(), ownerWallet, vaultAddress, deployValue));
  }
  const transfer = vaultStakeTransferParams({
    vaultAddress, ownerWallet, amount: verdict.atoms, queryId,
  });
  messages.push(createAthWalletMessage(transfer.type, transfer.params,
    { athWalletAddress, valueNanotons: transfer.attach }));
  // `deploys` says whether the deploy rode along, so the sender can note the vault as existing the moment the
  // transfer is signed — otherwise the private funnel deploys it again on the next message [audit 2026-09-05, round 2].
  return { ok: true, reason: verdict.reason, verdict, messages, deploys: state !== VAULT_LIVE || lowFloat, topsUp: lowFloat };
}

/**
 * TAKE STAKED ATH BACK OUT. `amount == 0` is refused rather than read as "all": the mirror reads LOW while a
 * previous unstake is in flight, and an "all" computed from a low mirror strands the rest [fee-vault.mjs].
 */
export function planUnstake({ vaultAddress, ath, snapshot, value = FV_UNSTAKE_MIN_INBOUND }) {
  if (!vaultSupported()) return { ok: false, reason: 'unavailable', messages: [] };
  if (!vaultAddress || snapshot?.state !== VAULT_LIVE) return { ok: false, reason: 'no-vault', messages: [] };
  if ((snapshot.pending ?? 0n) > 0n) return { ok: false, reason: 'unstake-in-flight', messages: [] };
  let whole;
  try {
    whole = typeof ath === 'bigint' ? ath : BigInt(String(ath ?? '').trim());
  } catch {
    return { ok: false, reason: 'not-a-whole-number', messages: [] };
  }
  if (whole <= 0n) return { ok: false, reason: 'nothing-to-send', messages: [] };
  const atoms = whole * FV_ATOMIC_PER_ATH;
  // THE MIRROR MUST BE A NUMBER BEFORE IT CAN BE COMPARED [audit 2026-09-02]. This read `snapshot.staked`
  // directly, and a snapshot without the field made `atoms > undefined` FALSE — the guard passed, and the
  // very next line threw `Cannot mix BigInt and other types` from inside a dialog's summary renderer.
  // A guard that says yes to a value it cannot compare is worse than no guard: it fails where nothing is
  // watching. vaultSnapshot always sets it, so this only ever fires on a hand-made snapshot — which is
  // precisely when a silent pass would be believed.
  const staked = typeof snapshot.staked === 'bigint' ? snapshot.staked : null;
  if (staked === null) return { ok: false, reason: 'no-vault', messages: [] };
  if (atoms > staked) return { ok: false, reason: 'more-than-staked', messages: [] };
  return {
    ok: true,
    reason: 'in-band',
    // WHAT IS LEFT AFTER, and what it will be worth: a partial unstake below the floor is legal on chain and
    // leaves a vault whose rent outruns what it saves, so the screen has to be able to say so.
    remaining: staked - atoms,
    remainingFeeDue: feeDueForStakedAtoms(staked - atoms),
    messages: [buildVaultUnstakeMessage(vaultAddress, atoms, value)],
  };
}

/** Release an unstake whose ack never came — the only way out of a parked `pending`. */
export function planUnstakeUnjam({ vaultAddress, snapshot }) {
  if (!vaultSupported() || !vaultAddress || snapshot?.state !== VAULT_LIVE) {
    return { ok: false, reason: 'no-vault', messages: [] };
  }
  if ((snapshot.pending ?? 0n) <= 0n) return { ok: false, reason: 'nothing-parked', messages: [] };
  // A PARKED UNSTAKE IS NOT A STUCK ONE FOR THE FIRST HOUR [audit 2026-09-02, round 2 — MEASURED]. `pending` is
  // set the moment the unstake is accepted and cleared three hops later by the excesses ack, so for those seconds
  // a perfectly healthy withdrawal looks exactly like a jammed one. This checked `pending > 0` alone, so the app
  // offered "Release" — under a hint reading "This withdrawal never settled" — about a two-second-old unstake,
  // and gate 28052 aborted it: measured 28052 at 0s, 60s and 3599s, exit 0 at 3601s. The send is signed either
  // way and the wallet's seqno advances, so the screen said "sent" for a transaction the chain threw away.
  // EXCLUSIVE, BECAUSE THE CONTRACT IS: gate 28052 reads `now() > pending_at + GRACE`, so the second AT the
  // boundary is still refused. My first cut compared `GRACE - parkedFor > 0` and offered the release at exactly
  // 3600 — one second early, in the direction that burns the user's gas. The exit-absorb window one function up
  // carries the same note for the same reason, in the other direction.
  const parkedFor = (snapshot.nowSec ?? 0) - (snapshot.pendingAt ?? 0);
  if (parkedFor <= FV_UNSTAKE_UNJAM_GRACE_SECONDS) {
    return { ok: false, reason: 'unjam-too-early',
      secondsLeft: FV_UNSTAKE_UNJAM_GRACE_SECONDS - parkedFor + 1, messages: [] };
  }
  return { ok: true, reason: 'parked', messages: [buildVaultUnstakeUnjamMessage(vaultAddress)] };
}

/**
 * ATH THE VAULT HOLDS BUT DOES NOT COUNT — the F1 state. `realAtoms` is the vault's OWN ATHWallet balance (read
 * through the master's getter like the user's own balance is); the mirror is `staked`. `pending` is NOT in the
 * wallet any more — the unstake leg leaves it the instant the vault accepts — so the gap is real minus staked.
 * Null when there is nothing to compare against.
 */
export function strandedAtoms(snapshot, realAtoms) {
  if (snapshot?.state !== VAULT_LIVE || realAtoms === null || realAtoms === undefined) return null;
  const gap = BigInt(realAtoms) - (snapshot.staked ?? 0n);
  return gap > 0n ? gap : 0n;
}

/** Below this the row stays hidden: anyone may donate dust to anyone's vault, and a control for 0.001 ATH is
 *  noise that costs two transfers to act on. */
export const FV_RECOVERY_MIN_ATH = 1n;

/**
 * THE RECOVERY, and why it is a FULL drain [measured 2026-09-02]. The hatch subtracts its amount from the
 * wallet AND from the mirror, so `real - staked` is an INVARIANT under it: with 5,000 mirrored and 1,000
 * stranded, EmergencyExit(1,000) left real 5,000 / mirror 4,000 — the same 1,000 gap, one rung down. Only
 * draining the WHOLE real balance (mirror floors at zero) brings everything home: EmergencyExit(5,000) then gave
 * real 0 / mirror 0 / owner +6,000. So this plans for `realAtoms`, never for the gap, and the screen says so:
 * everything comes back to the wallet, and the stake can be rebuilt once the 300-second absorb window closes —
 * `planStake` refuses inside it on its own.
 *
 * Refused while an unstake is in flight (the wallet balance is mid-move and the reading would be wrong), and
 * below FV_RECOVERY_MIN_ATH of gap (dust).
 */
export function planRecovery({ vaultAddress, snapshot, realAtoms }) {
  if (!vaultSupported() || !vaultAddress || snapshot?.state !== VAULT_LIVE) {
    return { ok: false, reason: 'no-vault', messages: [] };
  }
  if (realAtoms === null || realAtoms === undefined) return { ok: false, reason: 'position-unknown', messages: [] };
  if ((snapshot.pending ?? 0n) > 0n) return { ok: false, reason: 'unstake-in-flight', messages: [] };
  const stranded = strandedAtoms(snapshot, realAtoms);
  if (stranded <= 0n) return { ok: false, reason: 'nothing-stranded', stranded, messages: [] };
  if (stranded < FV_RECOVERY_MIN_ATH * FV_ATOMIC_PER_ATH) return { ok: false, reason: 'dust', stranded, messages: [] };
  const drain = BigInt(realAtoms);
  const exit = planEmergencyExit({ vaultAddress, atoms: drain, snapshot });
  if (!exit.ok) return exit;
  return { ok: true, reason: 'stranded', stranded, drain, messages: exit.messages };
}

/**
 * THE OWNER'S GRAM THE VAULT PARKS, and the one message that brings it home [audit 2026-09-05, round 1]. The contract
 * keeps FV_RENT_FLOAT and the protocol's booked fees and returns everything above them (WithdrawFloat, gate 28081);
 * the client shows the same difference from the view it already reads. Refused below FV_FLOAT_RETURN_MIN — a sweep
 * costs a wallet fee — and while the vault is not read LIVE.
 */
export function planWithdrawFloat({ vaultAddress, snapshot }) {
  if (!vaultSupported() || !vaultAddress || snapshot?.state !== VAULT_LIVE) {
    return { ok: false, reason: 'no-vault', amount: 0n, messages: [] };
  }
  const free = BigInt(snapshot.balance ?? 0n) - FV_RENT_FLOAT - BigInt(snapshot.accruedFee ?? 0n);
  if (free < FV_FLOAT_RETURN_MIN) return { ok: false, reason: 'dust', amount: free > 0n ? free : 0n, messages: [] };
  return { ok: true, reason: 'float', amount: free, messages: [buildVaultWithdrawFloatMessage(vaultAddress)] };
}

/** The hatch for ATH that reached the vault's wallet without crediting the mirror — the F1 recovery.
 *  Reached through planRecovery, which decides the amount; on its own it takes any positive figure. */
export function planEmergencyExit({ vaultAddress, atoms, snapshot }) {
  if (!vaultSupported() || !vaultAddress || snapshot?.state !== VAULT_LIVE) {
    return { ok: false, reason: 'no-vault', messages: [] };
  }
  const amount = atoms === undefined || atoms === null ? 0n : BigInt(atoms);
  if (amount <= 0n) return { ok: false, reason: 'nothing-to-send', messages: [] };
  return { ok: true, reason: 'stranded', messages: [buildVaultEmergencyExitMessage(vaultAddress, amount)] };
}

// RE-EXPORTED so a screen has ONE vault import rather than two: `stakeBandVerdict` prices the field while the
// plans above decide what may be sent, and a caller reaching past this layer for it would be reaching into the
// builder shelf this layer exists to cover.
export { FV_STAKE_MIN_ATH, FV_STAKE_MAX_ATH, FV_ATOMIC_PER_ATH, feeDueForStakedAtoms, stakeBandVerdict };
