
import {
  FV_ATOMIC_PER_ATH, FV_DEPLOY_FUNDING, FV_PROTOCOL_FEE, FV_STAKE_MAX_ATH, FV_STAKE_MIN_ATH,
  FV_EXIT_INBOUND, FV_UNSTAKE_UNJAM_GRACE_SECONDS,
  buildVaultDeployMessage, buildVaultEmergencyExitMessage, buildVaultUnstakeMessage, buildVaultWithdrawFloatMessage,
  buildVaultUnstakeUnjamMessage, feeDueForStakedAtoms, feeVaultAddress, stakeBandVerdict, vaultExitDebtWindow,
  vaultStakeTransferParams, FV_RENT_FLOAT, FV_FLOAT_TOPUP_BELOW, FV_FLOAT_RETURN_MIN,
  vaultExitInboundNanotons, vaultStakeAttachNanotons,
} from './fee-vault.mjs?v=39';
import { feeVaultCodeBoc, feeVaultCodeAvailable } from './shard-address.mjs?v=47';
import { createAthWalletMessage } from './pwa-contract-transactions.mjs?v=59';
import { athTransferTopUpNanotons, buildAthWalletTopUpMessage } from './ath-request-reserve.mjs?v=10';
import { buildUnfreezeMessage } from './frozen-account.mjs?v=24';

export const VAULT_UNAVAILABLE = 'unavailable';
export const VAULT_ABSENT = 'absent';
export const VAULT_LIVE = 'live';
export const VAULT_FROZEN = 'frozen';
export const VAULT_UNKNOWN = 'unknown';

export const vaultSupported = () => feeVaultCodeAvailable();

export async function vaultAddressFor(ownerWallet) {
  if (!ownerWallet || !vaultSupported()) return null;
  return feeVaultAddress(feeVaultCodeBoc(), ownerWallet);
}

export { decodeFeeVaultViewStack, createFeeVaultReader, FEE_VAULT_VIEW_ARITY } from './fee-vault-read.mjs?v=54';

export function vaultSnapshot(view, { nowSec = 0, chainSec = nowSec, clockMarginSec = 0, state, frozenHash = null, custodyFrozen = null } = {}) {
  const empty = (kind) => ({
    state: kind, staked: 0n, stakedAth: 0n, bps: 0n, feeDue: FV_PROTOCOL_FEE,
    pending: 0n, pendingAt: 0, exited: 0n, exitedAt: 0,
    exitWindow: { open: false, exited: 0n, secondsLeft: 0 },
    balance: 0n, accruedFee: 0n, nowSec, chainSec, clockMarginSec, frozenHash: null, custodyFrozen: null,
  });
  if (!vaultSupported()) return empty(VAULT_UNAVAILABLE);
  if (state === VAULT_UNKNOWN) return empty(VAULT_UNKNOWN);
  if (state === VAULT_FROZEN) return { ...empty(VAULT_FROZEN), frozenHash: frozenHash ?? null };
  if (!view) return empty(VAULT_ABSENT);
  const staked = BigInt(view.staked ?? 0n);
  const pending = BigInt(view.pending ?? 0n);
  const exited = BigInt(view.exited ?? 0n);
  return {
    state: VAULT_LIVE,
    staked,
    stakedAth: staked / FV_ATOMIC_PER_ATH,
    bps: BigInt(view.discount_bps ?? 0n),
    feeDue: BigInt(view.fee_due ?? feeDueForStakedAtoms(staked)),
    pending,
    pendingAt: Number(view.pending_at ?? 0),
    exited,
    exitedAt: Number(view.exited_at ?? 0),
    exitWindow: vaultExitDebtWindow(view, chainSec - clockMarginSec),
    balance: BigInt(view.balance ?? 0n),
    accruedFee: BigInt(view.accrued_fee ?? 0n),
    nowSec,
    chainSec,
    clockMarginSec,
    frozenHash: null,
    custodyFrozen: custodyFrozen ?? null,
  };
}

export const FV_CUSTODY_TOPUP = 50_000_000n;
export const FV_CUSTODY_TOPUP_BELOW = 50_000_000n;

export function frozenRefusal(snapshot, { custody = false } = {}) {
  if (snapshot?.state === VAULT_FROZEN) return 'vault-frozen';
  if (custody && snapshot?.custodyFrozen) return 'custody-frozen';
  return null;
}

export function planStake({ ownerWallet, vaultAddress, athWalletAddress, ath, snapshot, queryId = 0n,
  deployValue = FV_DEPLOY_FUNDING, custodyWallet = null, custodyBalance = null }) {
  if (!vaultSupported()) return { ok: false, reason: 'unavailable', messages: [] };
  if (!ownerWallet || !vaultAddress || !athWalletAddress) return { ok: false, reason: 'no-wallet', messages: [] };
  const state = snapshot?.state ?? VAULT_UNKNOWN;
  if (state === VAULT_UNKNOWN) return { ok: false, reason: 'position-unknown', messages: [] };
  const frozen = frozenRefusal(snapshot, { custody: true });
  if (frozen) return { ok: false, reason: frozen, messages: [] };
  const verdict = stakeBandVerdict(ath, { stakedAtoms: snapshot?.staked ?? 0n });
  if (!verdict.ok) return { ok: false, reason: verdict.reason, verdict, messages: [] };

  const debtWindow = snapshot?.exitWindow ?? { open: false, exited: 0n, secondsLeft: 0 };
  if (debtWindow.open) {
    return { ok: false, reason: 'exit-debt-open', verdict, debtWindow, messages: [] };
  }

  if ((snapshot?.pending ?? 0n) > 0n) {
    return { ok: false, reason: 'unstake-in-flight', verdict, messages: [] };
  }

  const messages = [];
  const lowFloat = state === VAULT_LIVE && BigInt(snapshot?.balance ?? 0n) < FV_FLOAT_TOPUP_BELOW;
  if (state !== VAULT_LIVE || lowFloat) {
    messages.push(buildVaultDeployMessage(feeVaultCodeBoc(), ownerWallet, vaultAddress, deployValue));
  }
  const transfer = vaultStakeTransferParams({
    vaultAddress, ownerWallet, amount: verdict.atoms, queryId,
  });
  const athMessageIndex = messages.length;
  messages.push(createAthWalletMessage(transfer.type, transfer.params,
    { athWalletAddress, valueNanotons: transfer.attach }));
  const custodyLow = custodyWallet && custodyBalance !== null && BigInt(custodyBalance) < FV_CUSTODY_TOPUP_BELOW;
  if (custodyLow) {
    messages.push({ address: custodyWallet, amount: FV_CUSTODY_TOPUP.toString(), bounce: false, payload: null });
  }
  return { ok: true, reason: verdict.reason, verdict, messages, deploys: state !== VAULT_LIVE || lowFloat,
    topsUp: lowFloat, fundsCustody: Boolean(custodyLow),
    transfer: { type: transfer.type, params: transfer.params, attach: transfer.attach, athWalletAddress, index: athMessageIndex } };
}

export function planUnstake({ vaultAddress, ath, snapshot, value = FV_EXIT_INBOUND }) {
  if (!vaultSupported()) return { ok: false, reason: 'unavailable', messages: [] };
  const frozen = frozenRefusal(snapshot, { custody: true });
  if (frozen) return { ok: false, reason: frozen, messages: [] };
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
  const staked = typeof snapshot.staked === 'bigint' ? snapshot.staked : null;
  if (staked === null) return { ok: false, reason: 'no-vault', messages: [] };
  if (atoms > staked) return { ok: false, reason: 'more-than-staked', messages: [] };
  return {
    ok: true,
    reason: 'in-band',
    remaining: staked - atoms,
    remainingFeeDue: feeDueForStakedAtoms(staked - atoms),
    messages: [buildVaultUnstakeMessage(vaultAddress, atoms, value)],
    exit: { door: 'unstake', vaultAddress, atoms },
  };
}

export function planUnstakeUnjam({ vaultAddress, snapshot }) {
  if (vaultSupported() && frozenRefusal(snapshot)) return { ok: false, reason: frozenRefusal(snapshot), messages: [] };
  if (!vaultSupported() || !vaultAddress || snapshot?.state !== VAULT_LIVE) {
    return { ok: false, reason: 'no-vault', messages: [] };
  }
  if ((snapshot.pending ?? 0n) <= 0n) return { ok: false, reason: 'nothing-parked', messages: [] };
  const margin = Math.max(0, Number(snapshot.clockMarginSec ?? 0));
  const parkedFor = Number(snapshot.chainSec ?? snapshot.nowSec ?? 0) - (snapshot.pendingAt ?? 0);
  if (parkedFor <= FV_UNSTAKE_UNJAM_GRACE_SECONDS + margin) {
    return { ok: false, reason: 'unjam-too-early',
      secondsLeft: FV_UNSTAKE_UNJAM_GRACE_SECONDS + margin - parkedFor + 1, messages: [] };
  }
  return { ok: true, reason: 'parked', messages: [buildVaultUnstakeUnjamMessage(vaultAddress)] };
}

export function strandedAtoms(snapshot, realAtoms) {
  if (snapshot?.state !== VAULT_LIVE || realAtoms === null || realAtoms === undefined) return null;
  const gap = BigInt(realAtoms) - (snapshot.staked ?? 0n);
  return gap > 0n ? gap : 0n;
}

export const FV_RECOVERY_MIN_ATH = 1n;

export function planRecovery({ vaultAddress, snapshot, realAtoms }) {
  if (vaultSupported() && frozenRefusal(snapshot, { custody: true })) {
    return { ok: false, reason: frozenRefusal(snapshot, { custody: true }), messages: [] };
  }
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
  return { ok: true, reason: 'stranded', stranded, drain, messages: exit.messages, exit: exit.exit };
}

export function planWithdrawFloat({ vaultAddress, snapshot }) {
  if (vaultSupported() && frozenRefusal(snapshot)) return { ok: false, reason: frozenRefusal(snapshot), amount: 0n, messages: [] };
  if (!vaultSupported() || !vaultAddress || snapshot?.state !== VAULT_LIVE) {
    return { ok: false, reason: 'no-vault', amount: 0n, messages: [] };
  }
  const free = BigInt(snapshot.balance ?? 0n) - FV_RENT_FLOAT - BigInt(snapshot.accruedFee ?? 0n);
  if (free < FV_FLOAT_RETURN_MIN) return { ok: false, reason: 'dust', amount: free > 0n ? free : 0n, messages: [] };
  return { ok: true, reason: 'float', amount: free, messages: [buildVaultWithdrawFloatMessage(vaultAddress)] };
}

export function planEmergencyExit({ vaultAddress, atoms, snapshot }) {
  if (vaultSupported() && frozenRefusal(snapshot, { custody: true })) {
    return { ok: false, reason: frozenRefusal(snapshot, { custody: true }), messages: [] };
  }
  if (!vaultSupported() || !vaultAddress || snapshot?.state !== VAULT_LIVE) {
    return { ok: false, reason: 'no-vault', messages: [] };
  }
  const amount = atoms === undefined || atoms === null ? 0n : BigInt(atoms);
  if (amount <= 0n) return { ok: false, reason: 'nothing-to-send', messages: [] };
  return { ok: true, reason: 'stranded', messages: [buildVaultEmergencyExitMessage(vaultAddress, amount)],
    exit: { door: 'hatch', vaultAddress, atoms: amount } };
}

export function priceVaultExit(plan, { prices, custodyWallet = null, custodyTon = 0n, custodyRentOwed = 0n }) {
  if (!plan?.ok || !plan.exit) return plan;
  const { door, vaultAddress, atoms } = plan.exit;
  const value = vaultExitInboundNanotons(prices.fwd);
  const exit = door === 'unstake'
    ? buildVaultUnstakeMessage(vaultAddress, atoms, value)
    : buildVaultEmergencyExitMessage(vaultAddress, atoms, value);
  const topUp = athTransferTopUpNanotons({ lane: 'custodyExit', prices, walletTon: custodyTon, rentOwed: custodyRentOwed });
  if (topUp > 0n && !custodyWallet) throw new Error('the custody wallet was not read, and at these prices its balance decides the exit');
  return { ...plan, value, custodyTopUp: topUp,
    messages: topUp > 0n ? [buildAthWalletTopUpMessage(custodyWallet, topUp), exit] : [exit] };
}

export function priceVaultStake(plan, { prices, athWalletTon = 0n, athWalletRentOwed = 0n }) {
  if (!plan?.ok || !plan.transfer) return plan;
  const { type, params, attach, athWalletAddress, index } = plan.transfer;
  const value = vaultStakeAttachNanotons(attach, params.forward_ton_amount, prices.fwd);
  const messages = plan.messages.slice();
  messages[index] = createAthWalletMessage(type, params, { athWalletAddress, valueNanotons: value });
  const topUp = athTransferTopUpNanotons({ lane: 'stake', prices, walletTon: athWalletTon, rentOwed: athWalletRentOwed });
  return { ...plan, attach: value, ownerTopUp: topUp,
    messages: topUp > 0n ? [buildAthWalletTopUpMessage(athWalletAddress, topUp), ...messages] : messages };
}

export function planVaultRestore({ vaultAddress, vault = null, custody = null }) {
  if (!vaultSupported()) return { ok: false, reason: 'unavailable', messages: [] };
  const parts = [];
  for (const [account, held, address, kept] of [
    ['vault', vault, vaultAddress, FV_DEPLOY_FUNDING],
    ['custody', custody, custody?.address ?? null, FV_CUSTODY_TOPUP],
  ]) {
    if (!held) continue;
    if (!address) return { ok: false, reason: 'no-vault', account, messages: [] };
    if (!held.frozen?.codeBoc || !held.frozen?.dataBoc) return { ok: false, reason: 'state-unfound', account, messages: [] };
    if (held.debt === null || held.debt === undefined) return { ok: false, reason: 'debt-unread', account, messages: [] };
    const debt = BigInt(held.debt);
    const amount = debt + kept;
    const payload = account === 'custody' ? buildAthWalletTopUpMessage(address, amount).payload : null;
    parts.push({ account, debt, kept, amount,
      message: buildUnfreezeMessage({ address, codeBoc: held.frozen.codeBoc, dataBoc: held.frozen.dataBoc, amount, payload }) });
  }
  if (parts.length === 0) return { ok: false, reason: 'nothing-frozen', messages: [] };
  const sum = (key) => parts.reduce((total, part) => total + part[key], 0n);
  return { ok: true, reason: 'frozen', parts: parts.map(({ message, ...part }) => part), messages: parts.map((part) => part.message),
    debt: sum('debt'), kept: sum('kept'), total: sum('amount') };
}

export { FV_STAKE_MIN_ATH, FV_STAKE_MAX_ATH, FV_ATOMIC_PER_ATH, feeDueForStakedAtoms, stakeBandVerdict };
