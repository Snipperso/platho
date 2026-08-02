// THE NUMBER THAT FORKS A GENESIS.
//
// ATHMaster and AirdropPool are the two roots of the address graph: everything else in the ceremony derives from one
// of them (ATHVesting, BuybackBurn, MarketStabilitySeller and both registries take ath_master; FeeAccumulator takes
// BuybackBurn; every ATHWallet takes ath_master), and AirdropPool derives from nothing. Both now carry a
// deployment_id in their init data, so changing THIS ONE NUMBER moves every address in the ceremony at once.
//
// WHY IT EXISTS. On 2026-08-02 a mainnet ceremony was abandoned after S01: F01 had been built on a lane that cannot
// tell AirdropPool it was funded, so funded_amount stayed 0 and the seal was refused. The restart needed fresh
// addresses for everything, because the live contracts held state no new genesis may inherit — a spent one-shot
// supply mint, and a FeeAccumulator permanently bound to the dead pool.
//
// Three earlier restarts that day had got fresh addresses by accident: the wallet's code kept changing, and the
// wallet's code is embedded in nearly every contract. The fourth did not — a fix confined to AirdropPool moved
// AirdropPool alone, and the redeploy would have found seven live contracts, skipped them as "already ACTIVE", and
// rebuilt the genesis on top of the state it existed to escape. That is what depending on a side effect looks like
// when the side effect is absent.
//
// HOW TO USE IT: bump by one, run scripts/rebaseline_cascade.mjs --run, and read the new addresses out of the draft
// before signing anything. The id is init data only. No handler reads it, it grants no authority, and it changes
// nothing about how a contract behaves — that is precisely the property that makes it safe to turn.
export const GENESIS_DEPLOYMENT_ID = 1n;
