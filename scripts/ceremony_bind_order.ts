// THE ONE PLACE THAT DECIDES WHAT "B06" MEANS.
//
// Found 2026-07-31, between the genesis deploy and the binds. Two generated operator documents disagreed on the
// step ids, and they disagreed at exactly the step both of them name out loud:
//
//   mainnet_tx_dry_run_packet.json  (what the broadcaster SIGNS)   B06 = AirdropPool.AirdropBindAthMaster
//   mainnet_deploy_packet.json      (the human-readable sheet)     B06 = BuybackBurn.BindBuybackTreasury
//
// DEPLOYMENT_RUNBOOK.md and the packet's own execution_order both say "B06 must precede the funding: without
// ath_master_bound the pool refuses the deposit notification". An operator holding the deploy sheet would have
// verified BuybackBurn's treasury bind, seen it green, and funded 15,000,000 ATH into a pool whose ath_master was
// never bound — which fails at gate 26011, and then again at 26044 when the seal demands funded_amount == 15M.
//
// The cause is that the two generators counted DIFFERENT THINGS from the same draft. The draft lists seventeen
// BOUND FIELDS; the ceremony signs sixteen MESSAGES, because AirdropBindAthMaster carries two fields in one body.
// The deploy sheet numbered fields 1..17, the tx packet numbered messages 1..16, and from the seventh row onward
// every id in one document pointed at a different step in the other.
//
// So the ids live here now, once, in signing order, and both generators derive from this array. The order itself is
// the tx packet's, because that is the order actually broadcast and the one ceremony-order-satisfies-gates.test.ts
// checks against the on-chain gates.
export const CEREMONY_BIND_ORDER: readonly string[] = [
  'BuybackBurn.BindBuybackFeeAccumulator',                        // B01
  'BuybackBurn.BindBuybackOfficialAthWallet',                     // B02
  'MarketStabilitySeller.BindMarketStabilityReserveFunder',       // B03
  'MarketStabilitySeller.BindMarketStabilityOfficialAthWallet',   // B04
  'MarketStabilitySeller.BindMarketStabilityTreasury',            // B05
  'AirdropPool.AirdropBindAthMaster',                             // B06 <- the one the funding waits on
  'AirdropPool.AirdropBindCreditIssuer',                          // B07
  'AirdropPool.AirdropBindTreasury',                              // B08
  'FeeAccumulator.BindAirdropPool',                               // B09
  'UsernameRegistry.BindOfficialAthWallet',                       // B10
  'ProfileRegistry.BindProfileOfficialAthWallet',                 // B11
  'BuybackBurn.BindBuybackTreasury',                              // B12
  'FeeAccumulator.BindShardCode',                                 // B13
  'FeeAccumulator.BindIntroShardCode',                            // B14
  'FeeAccumulator.BindPublicShardCode',                           // B15
  'FeeAccumulator.BindTicketCode',                                // B16
];

/** `AirdropPool.AirdropBindAthMaster.ath_master_address` -> `AirdropPool.AirdropBindAthMaster`. */
export function bindMessageKey(draftLabel: string): string {
  const parts = draftLabel.split('.');
  return parts.length > 2 ? `${parts[0]}.${parts[1]}` : draftLabel;
}

/** The `Bnn` id a bind message is signed under. Throws rather than guessing — an unknown bind must not get a number. */
export function bindStepId(messageKey: string): string {
  const index = CEREMONY_BIND_ORDER.indexOf(messageKey);
  if (index < 0) {
    throw new Error(`ceremony bind "${messageKey}" has no step id. Add it to CEREMONY_BIND_ORDER in the position it `
      + 'is signed, and check that the tx packet signs it in the same place — the two must not diverge again.');
  }
  return `B${String(index + 1).padStart(2, '0')}`;
}
