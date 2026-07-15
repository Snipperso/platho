// Pre-seal verification of the clean-14 live genesis: confirm bindings + fund distributions
// are correct BEFORE the irreversible seal. Run: ts-node --compiler-options '{"module":"CommonJS"}'
import { readFileSync } from 'fs';
import { Address, TupleReader } from '@ton/core';
import { TonClient } from '@ton/ton';
import { BuybackBurn } from '../build/BuybackBurn/BuybackBurn_BuybackBurn';
import { FeeAccumulator } from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import { Vault } from '../build/Vault/Vault_Vault';
import { MarketStabilitySeller } from '../build/MarketStabilitySeller/MarketStabilitySeller_MarketStabilitySeller';

function j(x: any) { return JSON.stringify(x, (_k, v) => typeof v === 'bigint' ? v.toString() : (v?.toString && v.toString().startsWith('EQ') || v?.toString && v.toString().startsWith('UQ') ? v.toString() : v), 0); }
const fr = (a: Address) => a.toString({ testOnly: false, bounceable: true });

async function main() {
  const key = readFileSync('artifacts/local/center.txt', 'utf8').trim();
  const client = new TonClient({ endpoint: 'https://toncenter.com/api/v2/jsonRPC', apiKey: key });
  const A = JSON.parse(readFileSync('artifacts/local/mainnet_final_manifest_draft.json', 'utf8')).manifest.addresses;
  const expManifest = JSON.parse(readFileSync('artifacts/local/mainnet_final_manifest_draft.json', 'utf8')).manifest.manifest_hash_hex;
  console.log('expected manifest:', expManifest);

  const bb = client.open(BuybackBurn.fromAddress(Address.parse(A.buyback_burn)));
  const cfg = await bb.getGetBuybackBurnConfig();
  console.log('\nBuybackBurn config:', j({ sealed: (cfg as any).sealed, fee_bound: (cfg as any).fee_bound, official_ath_wallet_bound: (cfg as any).official_ath_wallet_bound, route_frozen: (cfg as any).route_frozen, fee_accumulator: (cfg as any).fee_accumulator_address?.toString(), official_ath_wallet: (cfg as any).official_ath_wallet_address?.toString() }));
  console.log('  expect fee_accumulator ==', A.fee_accumulator, '| official_ath_wallet ==', A.buyback_burn_official_ath_wallet);

  const fa = client.open(FeeAccumulator.fromAddress(Address.parse(A.fee_accumulator)));
  const fas = await fa.getGetState();
  console.log('\nFeeAccumulator state:', j({ sealed: (fas as any).sealed, buyback_burn: (fas as any).buyback_burn_address?.toString() }));
  console.log('  expect buyback_burn ==', A.buyback_burn);

  const ms = client.open(MarketStabilitySeller.fromAddress(Address.parse(A.market_stability_seller)));
  const mscfg = await ms.getGetMarketStabilitySellerConfig();
  console.log('\nMSS config:', j({ sealed: (mscfg as any).sealed, official_ath_wallet_bound: (mscfg as any).official_ath_wallet_bound, official_ath_wallet: (mscfg as any).official_ath_wallet_address?.toString() }));

  const v = client.open(Vault.fromAddress(Address.parse(A.vault)));
  const vg = await v.getGetGlobal();
  console.log('\nVault global:', j({ sealed: (vg as any).sealed, ath_master: (vg as any).ath_master_address?.toString(), capsulehub: (vg as any).capsulehub_address?.toString() }));

  // fund distributions: MSS + Vesting official ATH wallet balances
  async function athBal(addr: string) {
    try { const r = await client.runMethod(Address.parse(addr), 'get_wallet_data'); return r.stack.readBigNumber(); } catch { return -1n; }
  }
  const mssBal = await athBal(A.market_stability_seller_official_ath_wallet);
  const vestBal = await athBal(A.ath_long_term_vesting_official_ath_wallet);
  console.log('\nFund distributions:');
  console.log('  MSS reserve ATH wallet:', (Number(mssBal) / 1e9).toLocaleString(), 'ATH');
  console.log('  Vesting ATH wallet:', (Number(vestBal) / 1e9).toLocaleString(), 'ATH');
}
main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1); });
