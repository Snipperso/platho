import { describe, expect, it, beforeEach } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract, createShardAccount } from '@ton/sandbox';
import { CreditSale } from '../build/CreditSale/CreditSale_CreditSale';
import { AirdropPool } from '../build/AirdropPool/AirdropPool_AirdropPool';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// CREDIT-SALE — the clean-17 credit sale (CARRY/CAC), superseding CreditIssuer's pool + issuer-key machinery.
//
// It does the three things the sharded model leaves for on-chain: collect the protocol fee per credit, accrue the
// airdrop (10 ATH/credit), and route the fee to the DeFi pool. Token authority is CAC (in the shard code); the
// endowment is CARRIED per message — so there is no pool and no FundAnonPool here.
//
// The load-bearing test is CS-DRAIN: accruing the airdrop directly on the buy, which was FATAL in the monolith,
// is SAFE here because the purchase is atomic — there is no bounce/refund path to loop. This suite proves the buy
// accrues correctly and cannot be reversed.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const MANIFEST = 0xABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789n;
const CREDIT_FEE = 10_000_000n;                 // owner's per-credit protocol fee
const ATH_PER_CREDIT = 10_000_000_000n;         // 10 ATH
const TOTAL_POOL = 15_000_000_000_000_000n;     // 15M ATH

function exitOf(res: any, dest: Address): number {
  const tx: any = res.transactions.find(
    (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === dest.toString());
  return Number(tx?.description?.computePhase?.exitCode ?? -999);
}

describe('CREDIT-SALE — clean-17 fee collection + airdrop accrual (no pool)', () => {
  let blockchain: Blockchain;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = 1_700_000_000;
  });

  // A CreditSale bound to a real AirdropPool (funded + sealed), plus a treasury standing in for the FeeAccumulator.
  async function setup() {
    const deployer = await blockchain.treasury('cs-deployer');
    const poolWallet = await blockchain.treasury('cs-pool-wallet');
    const treasury = await blockchain.treasury('cs-treasury');
    const athMaster = await blockchain.treasury('cs-ath-master');
    const feeReceiver = await blockchain.treasury('cs-fee-receiver');

    const sale = blockchain.openContract(await CreditSale.fromInit(deployer.address, MANIFEST, false));
    await sale.send(deployer.getSender(), { value: toNano('1') }, null);

    const pool = blockchain.openContract(await AirdropPool.fromInit(deployer.address, MANIFEST, 0n, false));
    await pool.send(deployer.getSender(), { value: toNano('1') }, null);

    const dep = (to: any, body: any, v = '0.05') => to.send(deployer.getSender(), { value: toNano(v) }, body);

    // AirdropPool genesis, bound to THIS CreditSale as its sole accruer, funded to 15M, sealed.
    await dep(pool, { $$type: 'AirdropBindAthMaster', ath_master_address: athMaster.address, pool_ath_wallet_address: poolWallet.address });
    await dep(pool, { $$type: 'AirdropBindCreditIssuer', credit_issuer_address: sale.address });
    await dep(pool, { $$type: 'AirdropBindTreasury', treasury_address: treasury.address });
    await pool.send(poolWallet.getSender(), { value: toNano('0.1') }, {
      $$type: 'AthTransferNotification', query_id: 1n, sender_key: 0n, amount: TOTAL_POOL, sender_wallet: treasury.address,
    } as any);
    await dep(pool, { $$type: 'AirdropSealGenesis', deployment_manifest_hash: MANIFEST }, '0.1');

    // CreditSale genesis.
    await dep(sale, { $$type: 'CsBindAirdropPool', airdrop_pool_address: pool.address });
    await dep(sale, { $$type: 'CsBindFeeReceiver', fee_receiver_address: feeReceiver.address });
    await dep(sale, { $$type: 'CsSealGenesis', deployment_manifest_hash: MANIFEST }, '0.1');

    return { deployer, sale, pool, poolWallet, feeReceiver, treasury };
  }

  it('CS-GENESIS-01: seal requires both binds and rejects a buy before seal', async () => {
    const deployer = await blockchain.treasury('g-deployer');
    const other = await blockchain.treasury('g-other');
    const buyer = await blockchain.treasury('g-buyer');
    const sale = blockchain.openContract(await CreditSale.fromInit(deployer.address, MANIFEST, false));
    await sale.send(deployer.getSender(), { value: toNano('1') }, null);
    const dep = (body: any, v = '0.05') => sale.send(deployer.getSender(), { value: toNano(v) }, body);

    expect(exitOf(await sale.send(buyer.getSender(), { value: toNano('0.2') }, { $$type: 'CsBuyCredits', credits_k: 1n, redeem_pubkey: 7n } as any), sale.address)).toBe(27100);
    expect(exitOf(await dep({ $$type: 'CsSealGenesis', deployment_manifest_hash: MANIFEST }, '0.1'), sale.address)).toBe(27041);
    await dep({ $$type: 'CsBindAirdropPool', airdrop_pool_address: other.address });
    expect(exitOf(await dep({ $$type: 'CsSealGenesis', deployment_manifest_hash: MANIFEST }, '0.1'), sale.address)).toBe(27042);
    await dep({ $$type: 'CsBindFeeReceiver', fee_receiver_address: other.address });
    expect(exitOf(await dep({ $$type: 'CsSealGenesis', deployment_manifest_hash: MANIFEST }, '0.1'), sale.address)).toBe(0);
    expect((await sale.getGetGlobal()).sealed).toBe(true);
  }, 120_000);

  it('CS-BUY-01: a buy collects the fee and accrues 10 ATH per credit to the exact buyer', async () => {
    const { sale, pool } = await setup();
    const buyer = await blockchain.treasury('buyer');
    const k = 10n;

    const res = await sale.send(buyer.getSender(), { value: k * CREDIT_FEE + toNano('0.1') }, {
      $$type: 'CsBuyCredits', credits_k: k, redeem_pubkey: 0x1234n,
    } as any);
    expect(exitOf(res, sale.address)).toBe(0);

    const g = await sale.getGetGlobal();
    expect(g.credits_sold).toBe(k);
    expect(g.fees_collected).toBe(k * CREDIT_FEE);
    expect(g.purchase_seq).toBe(1n);

    // the airdrop accrued at the pool for exactly this buyer's k credits
    const ap = await pool.getGetGlobal();
    expect(ap.distributed_total).toBe(k * ATH_PER_CREDIT);
    expect(ap.claim_count).toBe(1n);
  }, 120_000);

  it('CS-BUY-02: an underfunded buy is refused (27102) — fee + accrue gas + exec must all be covered', async () => {
    const { sale } = await setup();
    const buyer = await blockchain.treasury('poor-buyer');
    // fee for 5 credits is 50M, plus 80M accrue + 10M exec = needs ~140M; send only 60M.
    const res = await sale.send(buyer.getSender(), { value: 60_000_000n }, { $$type: 'CsBuyCredits', credits_k: 5n, redeem_pubkey: 1n } as any);
    expect(exitOf(res, sale.address)).toBe(27102);
    expect((await sale.getGetGlobal()).credits_sold).toBe(0n);
  }, 120_000);

  it('CS-DRAIN-01: the airdrop accrual cannot be reversed — there is no bounce/refund path (the monolith\'s FATAL is gone)', async () => {
    // The monolith accrued on a purchase that forwarded FundAnonPool, which could bounce and refund the buyer,
    // leaving them with free ATH. Here the purchase is atomic: once CsBuyCredits succeeds, the fee is collected and
    // the ATH is accrued, with no downstream message that could bounce it back. Prove the buyer's TON is GONE
    // (spent on fee + gas), not refunded, while the ATH accrued.
    const { sale, pool } = await setup();
    const buyer = await blockchain.treasury('drain-buyer');
    const before = await buyer.getBalance();
    await sale.send(buyer.getSender(), { value: 10n * CREDIT_FEE + toNano('0.1') }, { $$type: 'CsBuyCredits', credits_k: 10n, redeem_pubkey: 9n } as any);
    const after = await buyer.getBalance();
    // The buyer spent at least the fee (100M) — not refunded.
    expect(before - after).toBeGreaterThan(10n * CREDIT_FEE);
    // ...and the ATH accrued and stays accrued (no bounce could undo it).
    expect((await pool.getGetGlobal()).distributed_total).toBe(10n * ATH_PER_CREDIT);
  }, 120_000);

  it('CS-AUTH-01: only the bound CreditSale may accrue at the AirdropPool (a stranger is refused 26110)', async () => {
    const { pool } = await setup();
    const stranger = await blockchain.treasury('stranger');
    const res = await pool.send(stranger.getSender(), { value: toNano('0.2') }, {
      $$type: 'AirdropAccrue', purchase_id: 1n, buyer: stranger.address, credits_k: 1000n,
    } as any);
    expect(exitOf(res, pool.address)).toBe(26110);
    expect((await pool.getGetGlobal()).distributed_total).toBe(0n);
  }, 120_000);

  it('CS-FLUSH-01: collected fees push to the DeFi pool feeder and reset', async () => {
    const { sale, feeReceiver } = await setup();
    const buyer = await blockchain.treasury('flush-buyer');
    const k = 100n;
    await sale.send(buyer.getSender(), { value: k * CREDIT_FEE + toNano('0.1') }, { $$type: 'CsBuyCredits', credits_k: k, redeem_pubkey: 2n } as any);
    expect((await sale.getGetGlobal()).fees_collected).toBe(k * CREDIT_FEE);

    const feeBefore = await feeReceiver.getBalance();
    const sweeper = await blockchain.treasury('sweeper');
    const res = await sale.send(sweeper.getSender(), { value: toNano('0.05') }, { $$type: 'CsFlushFees' } as any);
    expect(exitOf(res, sale.address)).toBe(0);
    expect((await sale.getGetGlobal()).fees_collected, 'reset after flush').toBe(0n);
    // the fee receiver got the deposit (amount + a small exec reserve)
    expect(await feeReceiver.getBalance() - feeBefore).toBeGreaterThanOrEqual(k * CREDIT_FEE);
  }, 120_000);

  it('CS-MATH-01: the owner\'s tokenomics closes — 1.5M credits -> 15M ATH and >= 15k GRAM to the DeFi pool', () => {
    const credits = 1_500_000n;
    expect(credits * ATH_PER_CREDIT).toBe(TOTAL_POOL);
    expect((credits * CREDIT_FEE) / 1_000_000_000n).toBeGreaterThanOrEqual(15_000n);
  });
});
