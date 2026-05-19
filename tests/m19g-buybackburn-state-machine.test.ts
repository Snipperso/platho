import { describe, expect, it } from 'vitest';
import {
  BUYBACKBURN_M19G,
  createBuybackBurnStateMachineProfileM19G,
  executeBuybackChunkM19G,
  initialBuybackBurnStateM19G,
  onAthBurnFailedM19G,
  onAthBurnFinalizedM19G,
  onOfficialAthReceivedM19G,
  onRouteRefundOrFailureM19G,
} from '../scripts/buybackburn_state_machine_m19g';

const baseStart = {
  routeFreezeReady: true,
  queryId: '1',
  offerAmountNanotons: BUYBACKBURN_M19G.buybackOfferAmountNanotons.toString(),
  routeTotalValueNanotons: BUYBACKBURN_M19G.routeTotalValueNanotons.toString(),
  dexMinOutAtomicAth: '950000000000',
  buybackMinAthOutPer50TonAtomic: '900000000000',
  liveQuoteOutAtomicAth: '1000000000000',
  expectedOfficialAthWallet: 'official-buybackburn-ath-wallet',
  athMasterAddress: 'ath-master',
  now: 1_777_000_000,
};

describe('M19G BuybackBurn route-independent state machine freeze-candidate', () => {
  it('keeps production BuybackBurn blocked until STON.fi route freeze is ready', () => {
    const report = executeBuybackChunkM19G(initialBuybackBurnStateM19G(), { ...baseStart, routeFreezeReady: false });

    expect(report.phase).toBe('IDLE');
    expect(report.pending).toBeNull();
    expect(report.rejectedEvents).toContain('ROUTE_FREEZE_NOT_READY');
  });

  it('accepts the happy path only through official ATH receipt and ATH Master burn finalization', () => {
    let state = executeBuybackChunkM19G(initialBuybackBurnStateM19G(), baseStart);
    expect(state.phase).toBe('PENDING_STONFI_SWAP');

    state = onOfficialAthReceivedM19G(state, baseStart.expectedOfficialAthWallet, '960000000000');
    expect(state.phase).toBe('PENDING_ATH_BURN');

    state = onAthBurnFinalizedM19G(state, baseStart.athMasterAddress, '960000000000');
    expect(state.phase).toBe('IDLE');
    expect(state.pending).toBeNull();
    expect(state.completedBuybacks).toBe(1);
    expect(state.burnedAthAtomic).toBe('960000000000');
    expect(state.rejectedEvents).toEqual([]);
  });

  it('rejects wrong senders and amount mismatches instead of clearing pending state', () => {
    let state = executeBuybackChunkM19G(initialBuybackBurnStateM19G(), baseStart);

    state = onOfficialAthReceivedM19G(state, 'attacker-wallet', '960000000000');
    expect(state.phase).toBe('PENDING_STONFI_SWAP');
    expect(state.rejectedEvents).toContain('ATH_NOTIFICATION_NOT_FROM_OFFICIAL_WALLET');

    state = onOfficialAthReceivedM19G(state, baseStart.expectedOfficialAthWallet, '960000000000');
    state = onAthBurnFinalizedM19G(state, 'fake-master', '960000000000');
    expect(state.phase).toBe('PENDING_ATH_BURN');
    expect(state.rejectedEvents).toContain('BURN_FINALIZED_NOT_FROM_ATH_MASTER');

    state = onAthBurnFinalizedM19G(state, baseStart.athMasterAddress, '1');
    expect(state.phase).toBe('PENDING_ATH_BURN');
    expect(state.rejectedEvents).toContain('BURN_FINALIZED_AMOUNT_MISMATCH');
  });

  it('route refund/failure clears pending swap and records route refund due without pretending burn happened', () => {
    let state = executeBuybackChunkM19G(initialBuybackBurnStateM19G(), baseStart);
    state = onRouteRefundOrFailureM19G(state, BUYBACKBURN_M19G.routeTotalValueNanotons.toString());

    expect(state.phase).toBe('IDLE');
    expect(state.pending).toBeNull();
    expect(state.routeRefundDueNanotons).toBe(BUYBACKBURN_M19G.routeTotalValueNanotons.toString());
    expect(state.burnedAthAtomic).toBe('0');
    expect(state.completedBuybacks).toBe(0);
  });

  it('burn failure from official ATH wallet clears pending burn and moves ATH into retry-due accounting', () => {
    let state = executeBuybackChunkM19G(initialBuybackBurnStateM19G(), baseStart);
    state = onOfficialAthReceivedM19G(state, baseStart.expectedOfficialAthWallet, '960000000000');
    state = onAthBurnFailedM19G(state, baseStart.expectedOfficialAthWallet, '960000000000');

    expect(state.phase).toBe('IDLE');
    expect(state.pending).toBeNull();
    expect(state.athBurnRetryDueAtomic).toBe('960000000000');
    expect(state.burnedAthAtomic).toBe('0');
  });

  it('profile explicitly forbids fake routes, ignored-error sends, and router-claim success', () => {
    const profile = createBuybackBurnStateMachineProfileM19G();

    expect(profile.productionBuybackBurnImplementationReady).toBe(false);
    expect(profile.forbidden).toContain('fallback route');
    expect(profile.forbidden).toContain('ignored-error send mode for money sends');
    expect(profile.forbidden).toContain('clearing pending swap from router payload claims without ATH receipt');
    expect(profile.forbidden).toContain('clearing pending burn without ATHBurnFinalized from ATH Master');
  });
});
