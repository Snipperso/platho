/*
 * GENESIS CEREMONY TOOL — build artifacts/mainnet_genesis_verify_input.json from the LIVE chain.
 *
 * The verifier's input used to be assembled by hand. That was survivable while one genesis existed; it stopped being
 * survivable the moment a redeploy left the file describing clean-15 — Vault and CapsuleHub sections included, both
 * contracts deleted — while the client claimed clean-17. The release guards bind a production bundle to THIS file, so
 * a stale input means the bundle is bound to evidence about a different chain.
 *
 * Every value here is READ FROM MAINNET. The manifest half (addresses, code hashes, constants) comes from the
 * generated draft; the snapshot half comes from account states and getters. Nothing is transcribed.
 *
 *   ts-node --compiler-options '{"module":"CommonJS"}' scripts/collect_genesis_verify_snapshot.ts
 *   ... --write     overwrite artifacts/mainnet_genesis_verify_input.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { Address, beginCell } from '@ton/core';
import { TonClient } from '@ton/ton';

const WRITE = process.argv.includes('--write');
const OUT = 'artifacts/mainnet_genesis_verify_input.json';
const DRAFT = 'artifacts/local/mainnet_final_manifest_draft.json';

const die = (m: string): never => { console.error('ABORT: ' + m); process.exit(1); return null as never; };

async function main(): Promise<void> {
  const apiKey = readFileSync('artifacts/local/center.txt', 'utf8').trim();
  const draft = JSON.parse(readFileSync(DRAFT, 'utf8')).manifest;
  const client = new TonClient({ endpoint: 'https://toncenter.com/api/v2/jsonRPC', apiKey });
  const A = draft.addresses;

  // toncenter omits an address it has NEVER seen, and returns a 525-byte record for one that was merely touched. So
  // absence is not an error for a wallet — the two registry wallets are born from the first name/avatar purchase and
  // were deliberately left out of the endowment. It IS an error for a deployed contract, hence the required flag:
  // a contract silently reported as uninit would sail through as "nothing to check".
  const accountState = async (addr: string, required = true) => {
    const r = await fetch(`https://toncenter.com/api/v3/accountStates?address=${encodeURIComponent(addr)}`,
      { headers: { 'X-API-Key': apiKey } });
    const j: any = await r.json();
    const a = (j.accounts || [])[0];
    if (!a) {
      if (required) return die(`no account state for ${addr} — a deployed contract must exist`);
      return { account_state: 'nonexist', balance_ton: '0', code_hash: null };
    }
    return {
      account_state: a.status === 'active' ? 'active' : a.status,
      balance_ton: String(a.balance),
      code_hash: a.code_hash ? Buffer.from(a.code_hash, 'base64').toString('hex') : null,
    };
  };
  const open = async (name: string, addr: string) => {
    const mod = await import(`../build/${name}/${name}_${name}`);
    return client.open((mod as any)[name].fromAddress(Address.parse(addr)));
  };
  const bounceable = (a: any) => Address.parse(String(a)).toString({ urlSafe: true, bounceable: true });
  const dec = (v: any) => BigInt(v.toString()).toString();
  const hex64 = (v: any) => BigInt(v.toString()).toString(16).padStart(64, '0');

  // An official ATHWallet section: balance_atomic is the ATH balance, not the TON balance. The two live in the same
  // field name across sections and mean different things — a distinction worth stating rather than inferring.
  const athWalletSection = async (addr: string) => {
    const base = await accountState(addr);
    const d = await client.runMethod(Address.parse(addr), 'get_wallet_data');
    const balance = d.stack.readBigNumber();
    const owner = d.stack.readAddress();
    const master = d.stack.readAddress();
    return {
      address: bounceable(addr),
      account_state: base.account_state,
      balance_atomic: balance.toString(),
      code_hash: base.code_hash,
      owner_address: bounceable(owner),
      ath_master_address: bounceable(master),
    };
  };
  const athWalletOf = async (owner: string) => {
    const r = await client.runMethod(Address.parse(A.ath_master), 'get_wallet_address',
      [{ type: 'slice', cell: beginCell().storeAddress(Address.parse(owner)).endCell() }]);
    return r.stack.readAddress().toString({ urlSafe: true, bounceable: true });
  };

  const snapshot: Record<string, any> = {};

  {
    const base = await accountState(A.ath_master);
    const am: any = await open('ATHMaster', A.ath_master);
    const jd = await am.getGetJettonData();
    snapshot.ath_master = {
      address: bounceable(A.ath_master), account_state: base.account_state,
      balance_atomic: base.balance_ton, code_hash: base.code_hash,
      total_supply_atomic: dec(jd.total_supply),
      treasury_owner_address: bounceable(A.ath_treasury_owner),
      treasury_supply_deployed: jd.mintable === false,
    };
  }
  {
    const base = await accountState(A.airdrop_pool);
    const p: any = await open('AirdropPool', A.airdrop_pool);
    const g = await p.getGetGlobal();
    snapshot.airdrop_pool = {
      address: bounceable(A.airdrop_pool), account_state: base.account_state,
      balance_atomic: base.balance_ton, code_hash: base.code_hash,
      sealed: g.sealed, deployment_manifest_hash: hex64(g.deployment_manifest_hash),
      genesis_config_hash: hex64(g.genesis_config_hash),
      ath_master_address: bounceable(g.ath_master_address),
      pool_ath_wallet_address: bounceable(g.pool_ath_wallet_address),
      credit_issuer_address: bounceable(g.credit_issuer_address),
      treasury_address: bounceable(g.treasury_address),
      ath_per_credit: dec(g.ath_per_credit), total_pool: dec(g.total_pool),
      funded_amount: dec(g.funded_amount), remaining_budget: dec(g.remaining_budget),
      distributed_total: dec(g.distributed_total), claim_count: dec(g.claim_count),
      ath_master_bound: g.ath_master_bound, credit_issuer_bound: g.credit_issuer_bound, treasury_bound: g.treasury_bound,
    };
  }
  {
    const base = await accountState(A.fee_accumulator);
    const f: any = await open('FeeAccumulator', A.fee_accumulator);
    const s = await f.getGetState();
    snapshot.fee_accumulator = {
      address: bounceable(A.fee_accumulator), account_state: base.account_state,
      balance_atomic: base.balance_ton, code_hash: base.code_hash,
      accumulated_ton: dec(s.accumulated_ton), treasury_due_ton: dec(s.treasury_due_ton),
      buyback_due_ton: dec(s.buyback_due_ton), buyback_split_enabled: s.buyback_split_enabled,
      ton_treasury_receiver: bounceable(s.treasury_receiver_address),
      buyback_burn_address: bounceable(s.buyback_burn_address),
      shard_code_bound: s.shard_code_bound, intro_shard_code_bound: s.intro_shard_code_bound,
      public_shard_code_bound: s.public_shard_code_bound, ticket_code_bound: s.ticket_code_bound,
      airdrop_pool_bound: s.airdrop_pool_bound,
    };
  }
  {
    const base = await accountState(A.buyback_burn);
    const b: any = await open('BuybackBurn', A.buyback_burn);
    const c = await b.getGetBuybackBurnConfig();
    const st = await b.getGetBuybackBurnState();
    const t = await b.getGetBuybackBurnTotals();
    snapshot.buyback_burn = {
      address: bounceable(A.buyback_burn), account_state: base.account_state,
      balance_atomic: base.balance_ton, code_hash: base.code_hash,
      sealed: c.sealed, deployment_manifest_hash: hex64(c.deployment_manifest_hash),
      fee_accumulator_address: bounceable(c.fee_accumulator_address),
      official_ath_wallet_address: bounceable(c.official_ath_wallet_address),
      ath_master_address: bounceable(c.ath_master_address),
      genesis_config_hash: hex64(c.genesis_config_hash),
      route_frozen: c.route_frozen, phase: dec(st.phase), reserve_due_ton: dec(st.reserve_due_ton),
      pending_query_id: dec(st.pending_query_id), route_refund_due_ton: dec(st.route_refund_due_ton),
      ath_burn_retry_due_atomic: dec(st.ath_burn_retry_due_atomic),
      last_terminal_query_id: dec(st.last_terminal_query_id),
      accepted_reserve_count: dec(t.accepted_reserve_count), executed_buyback_count: dec(t.executed_buyback_count),
      burned_ath_total_atomic: dec(t.burned_ath_total_atomic),
    };
  }
  {
    const base = await accountState(A.market_stability_seller);
    const m: any = await open('MarketStabilitySeller', A.market_stability_seller);
    const c = await m.getGetMarketStabilitySellerConfig();
    const st = await m.getGetMarketStabilitySellerState();
    const t = await m.getGetMarketStabilitySellerTotals();
    snapshot.market_stability_seller = {
      address: bounceable(A.market_stability_seller), account_state: base.account_state,
      balance_atomic: base.balance_ton, code_hash: base.code_hash,
      sealed: c.sealed, deployment_manifest_hash: hex64(c.deployment_manifest_hash),
      reserve_funder_address: bounceable(c.reserve_funder_address),
      official_ath_wallet_address: bounceable(c.official_ath_wallet_address),
      ton_treasury_receiver_address: bounceable(c.ton_treasury_receiver_address),
      ath_master_address: bounceable(c.ath_master_address),
      genesis_config_hash: hex64(c.genesis_config_hash),
      pricing_frozen: c.pricing_frozen,
      reserve_due_ath: dec(st.reserve_due_ath), reserve_funded_total_ath: dec(t.reserve_funded_total_ath),
      treasury_due_ton: dec(st.treasury_due_ton), sold_ath_total: dec(t.sold_ath_total),
      phase: dec(st.phase), pending_query_id: dec(st.pending_query_id),
      pending_amount_ath: dec(st.pending_amount_ath), pending_paid_ton: dec(st.pending_paid_ton),
      completed_tranche_count: dec(st.completed_tranche_count),
      current_tranche_sold_ath: dec(st.current_tranche_sold_ath),
      last_terminal_query_id: dec(st.last_terminal_query_id),
      treasury_flushed_ton_total: dec(t.treasury_flushed_ton_total),
    };
  }
  {
    const base = await accountState(A.ath_long_term_vesting);
    const v: any = await open('ATHVesting', A.ath_long_term_vesting);
    // The schedule lives in the CONFIG getter, the counters in the STATE getter. The first draft of this section
    // flattened only the state view and the verifier named all eight missing schedule fields one by one.
    const c = await v.getGetVestingConfig();
    const st = await v.getGetVestingState();
    snapshot.ath_long_term_vesting = {
      address: bounceable(A.ath_long_term_vesting), account_state: base.account_state,
      balance_atomic: base.balance_ton, code_hash: base.code_hash,
      ath_master_address: bounceable(c.ath_master_address),
      beneficiary_address: bounceable(c.beneficiary_address),
      official_ath_wallet_address: bounceable(c.official_ath_wallet_address),
      start_time: dec(c.start_time), period_seconds: dec(c.period_seconds),
      period_count: dec(c.period_count), period_unlock_amount: dec(c.period_unlock_amount),
      total_amount: dec(c.total_amount),
      phase: dec(st.phase), claimed_ath: dec(st.claimed_ath), vested_ath: dec(st.vested_ath),
      claimable_ath: dec(await v.getGetClaimableAmount()),
      pending_query_id: dec(st.pending_query_id), pending_amount: dec(st.pending_amount),
      pending_created_at: dec(st.pending_created_at),
      last_terminal_query_id: dec(st.last_terminal_query_id),
    };
  }
  {
    const base = await accountState(A.username_registry);
    const u: any = await open('UsernameRegistry', A.username_registry);
    const g = await u.getGetGlobal();
    snapshot.username_registry = {
      address: bounceable(A.username_registry), account_state: base.account_state,
      balance_atomic: base.balance_ton, code_hash: base.code_hash,
      sealed: g.sealed, official_ath_wallet_bound: g.official_ath_wallet_bound,
      deployment_manifest_hash: hex64(g.deployment_manifest_hash),
      genesis_config_hash: hex64(g.genesis_config_hash),
      official_ath_wallet_address: bounceable(g.official_ath_wallet_address),
      treasury_ath_receiver: bounceable(A.treasury_ath_receiver),
      ath_master_address: bounceable(A.ath_master),
      pending_mint_count: dec(g.pending_mint_count),
      treasury_due_ath: dec(g.treasury_due_ath), burn_due_ath: dec(g.burn_due_ath),
      pending_treasury_flush_count: dec(g.pending_treasury_flush_count),
      pending_burn_flush_count: dec(g.pending_burn_flush_count),
      art_count: dec(await u.getGetArtCount()), art_sealed: await u.getGetArtSealed(),
      meta_count: dec(await u.getGetMetaCount()), meta_sealed: await u.getGetMetaSealed(),
    };
  }
  {
    const base = await accountState(A.profile_registry);
    const p: any = await open('ProfileRegistry', A.profile_registry);
    const g = await p.getGetGlobal();
    snapshot.profile_registry = {
      address: bounceable(A.profile_registry), account_state: base.account_state,
      balance_atomic: base.balance_ton, code_hash: base.code_hash,
      sealed: g.sealed, official_ath_wallet_bound: g.official_ath_wallet_bound,
      deployment_manifest_hash: hex64(g.deployment_manifest_hash),
      genesis_config_hash: hex64(g.genesis_config_hash),
      official_ath_wallet_address: bounceable(g.official_ath_wallet_address),
      ath_master_address: bounceable(g.ath_master_address),
      treasury_ath_receiver: bounceable(g.treasury_ath_receiver_address),
      profile_count: dec(g.profile_count),
      pending_avatar_write_count: dec(g.pending_avatar_write_count),
      treasury_due_ath: dec(g.treasury_due_ath), burn_due_ath: dec(g.burn_due_ath),
      pending_treasury_flush_count: dec(g.pending_treasury_flush_count),
      pending_burn_flush_count: dec(g.pending_burn_flush_count),
    };
  }

  // The six official ATHWallets. W01 and W04 are UNINIT by design at genesis: their owners have not sent ATH yet, so
  // the wallet account does not exist and the endowment simply sits on the address. The verifier has a branch for it.
  const WALLETS: Array<[string, string]> = [
    ['ath_treasury_owner_ath_wallet', A.ath_treasury_owner],
    ['airdrop_pool_official_ath_wallet', A.airdrop_pool],
    ['ath_long_term_vesting_official_ath_wallet', A.ath_long_term_vesting],
    ['market_stability_seller_official_ath_wallet', A.market_stability_seller],
    ['username_registry_official_ath_wallet', A.username_registry],
    ['profile_registry_official_ath_wallet', A.profile_registry],
    ['buyback_burn_official_ath_wallet', A.buyback_burn],
  ];
  for (const [key, owner] of WALLETS) {
    const addr = await athWalletOf(owner);
    const base = await accountState(addr, false);
    if (base.account_state !== 'active') {
      snapshot[key] = {
        address: bounceable(addr), account_state: base.account_state,
        balance_atomic: '0', code_hash: base.code_hash,
        owner_address: bounceable(owner), ath_master_address: bounceable(A.ath_master),
      };
    } else {
      snapshot[key] = await athWalletSection(addr);
    }
  }

  const codeHashesText = readFileSync('artifacts/CURRENT_CODE_HASHES.txt', 'utf8');
  const { createHash } = await import('node:crypto');
  const out = {
    document: 'PLATHO.V1.MAINNET_GENESIS_VERIFY_INPUT',
    network: 'mainnet',
    manifest: JSON.parse(readFileSync(DRAFT, 'utf8')).manifest,
    snapshot,
    evidenceRefs: {
      getterSnapshotSource: 'live-rpc/platho-toncenter/collect_genesis_verify_snapshot.ts',
      codeHashProofSource: `artifacts/CURRENT_CODE_HASHES.txt#sha256=${createHash('sha256').update(codeHashesText).digest('hex')}`,
      finalManifestSource: `${DRAFT}#manifest_hash_hex=${draft.manifest_hash_hex}`,
    },
  };

  console.log(`\n  секций снимка: ${Object.keys(snapshot).length}`);
  for (const [k, v] of Object.entries(snapshot)) {
    console.log(`    ${k.padEnd(44)} ${(v as any).account_state}`);
  }
  console.log(`  манифест: ${draft.manifest_hash_hex}`);
  if (!WRITE) { console.log(`\n  ПРОБНЫЙ ПРОГОН — ничего не записано. Повторить с --write.\n`); return; }
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`\n  записан ${OUT}\n`);
}
main().catch((e) => die(e?.message ?? String(e)));
