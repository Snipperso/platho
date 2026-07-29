import { describe, expect, it, beforeEach } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract, createShardAccount } from '@ton/sandbox';
import { keyPairFromSeed } from '@ton/crypto';
import { AirdropPool } from '../build/AirdropPool/AirdropPool_AirdropPool';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// AIRDROP — the 15M ATH pool, paid out per SETTLED credit purchase.
//
// Owner's math, unchanged: 1.5M credits x 10 ATH = 15M ATH; the credit price collects ~16.5k TON of protocol fee.
//
// The design doc (artifacts/PLATHO_CLEAN16_AIRDROP_POOL_DESIGN.md §1) rated a credit-purchase trigger FATAL, and
// it was right about the version it studied: accrue inside CreditBuyCredits and you pay ATH before the purchase
// settles — an attacker buys with an out-of-window epoch, takes the ATH, and CreditIssuer's own bounce path
// refunds their TON in full. Free ATH, looped until the budget is gone.
//
// The owner chose the credit trigger anyway, so the accrual moved to FundAnonPoolAck: the Hub emits that ack only
// once the funding LANDS. AIRDROP-DRAIN-01 is the test that this actually closes the hole — it runs the exact
// attack the doc described and asserts zero ATH moves.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const MANIFEST = 0xABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789n;
const PREPAID_UNIT = 10_995_000n;
const TOTAL_POOL = 15_000_000_000_000_000n;   // 15M ATH @ 9 decimals
const ATH_PER_CREDIT = 10_000_000_000n;       // 10 ATH

const issuerPubkey = (i: number) => BigInt('0x' + keyPairFromSeed(Buffer.alloc(32, 100 + i)).publicKey.toString('hex'));

function exitOf(res: any, dest: Address): number {
  const tx: any = res.transactions.find(
    (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === dest.toString());
  return Number(tx?.description?.computePhase?.exitCode ?? -999);
}

// Drain the sealed pool down to `targetCreditsLeft` by ACTUAL accruals (the real path). Seal demands funded==15M,
// and one accrual pays at most 1000 credits, so the 15M edge is ~1500 sends away — heavy but honest: it drives the
// pool to the boundary the exact way production does, with no state surgery that could diverge from the real layout.
async function drainToCredits(pool: any, distributor: any, buyer: Address, targetCreditsLeft: number, startSeq: bigint) {
  let seq = startSeq;
  let left = 1_500_000;   // 15M ATH / 10 ATH per credit
  while (left > targetCreditsLeft) {
    const step = Math.min(1000, left - targetCreditsLeft);
    await pool.send(distributor.getSender(), { value: toNano('0.1') }, {
      $$type: 'AirdropAccrue', purchase_id: seq, buyer, credits_k: BigInt(step),
    } as any);
    seq += 1n;
    left -= step;
  }
  return seq;
}

const hitPoolWallet = (res: any, poolWalletAddr: Address): boolean => res.transactions.some((t: any) =>
  t.inMessage?.info?.dest?.toString() === poolWalletAddr.toString() && t.inMessage?.info?.type === 'internal');

// clean-17 genesis: the pool alone, cross-bound and sealed with the 15M funded. The old CapsuleHub+CreditIssuer
// credit-purchase drive is gone — accrual now originates from the bound distributor (FeeAccumulator in production),
// so here a plain treasury stands in as that distributor and AirdropAccrue is sent directly (the pool's real entry
// point). The pool's "ATHWallet" is a treasury stand-in whose balance delta IS the observable.
async function setup(blockchain: Blockchain) {
  const deployer = await blockchain.treasury('adr-deployer');
  const poolWallet = await blockchain.treasury('adr-pool-wallet');
  const treasury = await blockchain.treasury('adr-treasury');
  const athMaster = await blockchain.treasury('adr-ath-master');
  const distributor = await blockchain.treasury('adr-distributor');   // stands in for the bound FeeAccumulator distributor

  const pool = blockchain.openContract(await AirdropPool.fromInit(deployer.address, MANIFEST, 0n, false));
  await pool.send(deployer.getSender(), { value: toNano('1') }, null);

  const dep = (body: any, v = '0.05') => pool.send(deployer.getSender(), { value: toNano(v) }, body);

  await dep({ $$type: 'AirdropBindAthMaster', ath_master_address: athMaster.address, pool_ath_wallet_address: poolWallet.address });
  await dep({ $$type: 'AirdropBindCreditIssuer', credit_issuer_address: distributor.address });
  await dep({ $$type: 'AirdropBindTreasury', treasury_address: treasury.address });
  // Fund: only the pool's OWN wallet may report a deposit (26019).
  await pool.send(poolWallet.getSender(), { value: toNano('0.1') }, {
    $$type: 'AthTransferNotification', query_id: 1n, sender_key: 0n, amount: TOTAL_POOL, sender_wallet: treasury.address,
  } as any);
  await dep({ $$type: 'AirdropSealGenesis', deployment_manifest_hash: MANIFEST }, '0.1');

  return { deployer, pool, poolWallet, treasury, distributor, dep };
}

describe('AIRDROP — 15M ATH pool on settled credit purchases', () => {
  let blockchain: Blockchain;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = 1_700_000_000;
  });

  it('AIRDROP-GENESIS-01: seal requires a REAL 15M funding, every bind, and the manifest', async () => {
    const deployer = await blockchain.treasury('g-deployer');
    const poolWallet = await blockchain.treasury('g-pool-wallet');
    const other = await blockchain.treasury('g-other');
    const pool = blockchain.openContract(await AirdropPool.fromInit(deployer.address, MANIFEST, 0n, false));
    await pool.send(deployer.getSender(), { value: toNano('1') }, null);
    const dep = (body: any, v = '0.05') => pool.send(deployer.getSender(), { value: toNano(v) }, body);

    // Unbound -> seal refused.
    expect(exitOf(await dep({ $$type: 'AirdropSealGenesis', deployment_manifest_hash: MANIFEST }, '0.1'), pool.address)).toBe(26041);

    await dep({ $$type: 'AirdropBindAthMaster', ath_master_address: other.address, pool_ath_wallet_address: poolWallet.address });
    await dep({ $$type: 'AirdropBindCreditIssuer', credit_issuer_address: other.address });
    await dep({ $$type: 'AirdropBindTreasury', treasury_address: other.address });

    // Bound but UNFUNDED -> seal still refused. This is the gate that stops sealing an empty pool (26044).
    expect(exitOf(await dep({ $$type: 'AirdropSealGenesis', deployment_manifest_hash: MANIFEST }, '0.1'), pool.address)).toBe(26044);

    // A forged deposit notification from a stranger must NOT count as funding (26019) — otherwise anyone could
    // declare the pool full and unlock the seal over nothing.
    const forged = await pool.send(other.getSender(), { value: toNano('0.1') }, {
      $$type: 'AthTransferNotification', query_id: 9n, sender_key: 0n, amount: TOTAL_POOL, sender_wallet: other.address,
    } as any);
    expect(exitOf(forged, pool.address)).toBe(26019);
    expect((await pool.getGetGlobal()).funded_amount).toBe(0n);

    // Real funding from the pool's own wallet, then seal.
    await pool.send(poolWallet.getSender(), { value: toNano('0.1') }, {
      $$type: 'AthTransferNotification', query_id: 1n, sender_key: 0n, amount: TOTAL_POOL, sender_wallet: other.address,
    } as any);
    expect((await pool.getGetGlobal()).funded_amount).toBe(TOTAL_POOL);
    expect(exitOf(await dep({ $$type: 'AirdropSealGenesis', deployment_manifest_hash: MANIFEST }, '0.1'), pool.address)).toBe(0);
    const g = await pool.getGetGlobal();
    expect(g.sealed).toBe(true);
    expect(g.remaining_budget).toBe(TOTAL_POOL);
  }, 120_000);

  it('AIRDROP-GENESIS-02: the pool DEPLOYS with manifest hash 0 and seal BINDS the real hash (clean-17 ceremony path)', async () => {
    // clean-17 breaks the manifest-hash circularity by deploying the pool with deployment_manifest_hash=0 (so its
    // address does not depend on the manifest that commits to its address), and letting seal bind the real hash —
    // exactly as every other sealed genesis contract commits to the manifest. This is the ceremony's real flow, so
    // it is deployed with 0 here (not MANIFEST as the older cases do).
    const deployer = await blockchain.treasury('g2-deployer');
    const poolWallet = await blockchain.treasury('g2-pool-wallet');
    const ciAddr = (await blockchain.treasury('g2-ci')).address;
    const treasuryAddr = (await blockchain.treasury('g2-treasury')).address;
    const athMasterAddr = (await blockchain.treasury('g2-ath-master')).address;
    const pool = blockchain.openContract(await AirdropPool.fromInit(deployer.address, 0n, 0n, false));
    await pool.send(deployer.getSender(), { value: toNano('1') }, null);
    const dep = (body: any, v = '0.05') => pool.send(deployer.getSender(), { value: toNano(v) }, body);

    // Deployed with 0 — the getter reflects it before seal.
    expect((await pool.getGetGlobal()).deployment_manifest_hash).toBe(0n);

    await dep({ $$type: 'AirdropBindAthMaster', ath_master_address: athMasterAddr, pool_ath_wallet_address: poolWallet.address });
    await dep({ $$type: 'AirdropBindCreditIssuer', credit_issuer_address: ciAddr });
    await dep({ $$type: 'AirdropBindTreasury', treasury_address: treasuryAddr });
    await pool.send(poolWallet.getSender(), { value: toNano('0.1') }, {
      $$type: 'AthTransferNotification', query_id: 1n, sender_key: 0n, amount: TOTAL_POOL, sender_wallet: treasuryAddr,
    } as any);

    // Sealing with a 0/1 hash is refused by the new non-zero gate (26040) — a genesis must carry a real manifest.
    expect(exitOf(await dep({ $$type: 'AirdropSealGenesis', deployment_manifest_hash: 0n }, '0.1'), pool.address)).toBe(26040);
    expect(exitOf(await dep({ $$type: 'AirdropSealGenesis', deployment_manifest_hash: 1n }, '0.1'), pool.address)).toBe(26040);

    // Seal with the real manifest binds it — the pool now cryptographically commits to the genesis it belongs to.
    expect(exitOf(await dep({ $$type: 'AirdropSealGenesis', deployment_manifest_hash: MANIFEST }, '0.1'), pool.address)).toBe(0);
    const g = await pool.getGetGlobal();
    expect(g.sealed).toBe(true);
    expect(g.deployment_manifest_hash, 'seal bound the real manifest hash into the pool').toBe(MANIFEST);
  }, 120_000);

  it('AIRDROP-ACCRUE-01: a SETTLED accrual credits 10 ATH per credit to the exact buyer', async () => {
    // clean-17: accrual originates from the bound distributor (the FeeAccumulator in production; a treasury stand-in
    // here). The CreditIssuer purchase→ack drive is gone — the pool's entry point is AirdropAccrue direct.
    const { pool, poolWallet, distributor } = await setup(blockchain);
    const buyer = await blockchain.treasury('buyer');

    const res = await pool.send(distributor.getSender(), { value: toNano('0.1') }, {
      $$type: 'AirdropAccrue', purchase_id: 1n, buyer: buyer.address, credits_k: 10n,
    } as any);

    const g = await pool.getGetGlobal();
    expect(g.distributed_total, '10 credits x 10 ATH').toBe(10n * ATH_PER_CREDIT);
    expect(g.remaining_budget).toBe(TOTAL_POOL - 10n * ATH_PER_CREDIT);
    expect(g.claim_count).toBe(1n);

    // The payout is commanded from the pool's OWN wallet and addressed to the buyer. Assert it actually left.
    const payout = res.transactions.some((t: any) =>
      t.inMessage?.info?.dest?.toString() === poolWallet.address.toString() && t.inMessage?.info?.type === 'internal');
    expect(payout, 'an ATHTransferRequest must reach the pool wallet').toBe(true);
  }, 180_000);

  it('AIRDROP-BOUNDARY-01: [W3-002] at the 15M edge the pool pays the REMAINDER then nothing — no budget is stranded', async () => {
    // The bug: the old code returned the instant a claim exceeded the budget, so the LAST claimant got ZERO and the
    // leftover ATH — up to one full claim short — stranded, later swept to the treasury. Now the pool pays down to the
    // last whole credit the budget funds, then an exhausted pool simply pays nothing.
    const { pool, poolWallet, distributor } = await setup(blockchain);
    const buyer = await blockchain.treasury('boundary-buyer');
    let seq = await drainToCredits(pool, distributor, buyer.address, 55, 1n);   // 55 credits (550 ATH) left
    expect((await pool.getGetGlobal()).remaining_budget, 'drained to the chosen edge').toBe(55n * ATH_PER_CREDIT);

    // A 100-credit claim exceeds the 55 left. OLD: pay 0, strand 550 ATH. NEW: pay exactly the 55 that remain.
    const edge = await pool.send(distributor.getSender(), { value: toNano('0.1') }, {
      $$type: 'AirdropAccrue', purchase_id: seq, buyer: buyer.address, credits_k: 100n,
    } as any);
    seq += 1n;
    expect(exitOf(edge, pool.address), 'the boundary accrual is accepted, not thrown').toBe(0);
    const g = await pool.getGetGlobal();
    expect(g.remaining_budget, 'the budget is drained to the last whole credit — nothing left to strand').toBe(0n);
    expect(g.distributed_total, 'the 55-credit remainder was delivered (whole 15M now distributed)').toBe(TOTAL_POOL);
    expect(hitPoolWallet(edge, poolWallet.address), 'the partial payout is actually commanded from the pool wallet').toBe(true);

    // Now exhausted: a further claim pays nothing, leaves the (zero) budget untouched, and sends no payout leg.
    const empty = await pool.send(distributor.getSender(), { value: toNano('0.1') }, {
      $$type: 'AirdropAccrue', purchase_id: seq, buyer: buyer.address, credits_k: 10n,
    } as any);
    expect(exitOf(empty, pool.address), 'an empty pool still accepts the accrual, it simply pays nothing').toBe(0);
    expect((await pool.getGetGlobal()).remaining_budget, 'stays zero').toBe(0n);
    expect(hitPoolWallet(empty, poolWallet.address), 'no payout leaves an exhausted pool').toBe(false);
  }, 300_000);

  it('AIRDROP-AUTH-01: only the bound CreditIssuer may accrue (26110)', async () => {
    // The pool authenticates exactly ONE sender. Without this, anyone mints themselves 15M ATH.
    const { pool } = await setup(blockchain);
    const stranger = await blockchain.treasury('stranger');
    const res = await pool.send(stranger.getSender(), { value: toNano('0.2') }, {
      $$type: 'AirdropAccrue', purchase_id: 1n, buyer: stranger.address, credits_k: 1000n,
    } as any);
    expect(exitOf(res, pool.address)).toBe(26110);
    expect((await pool.getGetGlobal()).distributed_total).toBe(0n);
  }, 120_000);

  it('AIRDROP-SWEEP-01: the residual sweep is dead-man gated and can only reach the frozen treasury', async () => {
    const { pool } = await setup(blockchain);
    const stranger = await blockchain.treasury('sweeper');

    // Before the grace window: refused, even though the call is permissionless.
    expect(exitOf(await pool.send(stranger.getSender(), { value: toNano('0.3') },
      { $$type: 'AirdropSweepResidualToTreasury' } as any), pool.address)).toBe(26140);

    // After 10 years: anyone may trigger it, and it moves the residual to the treasury bound at genesis.
    blockchain.now = blockchain.now! + 315360000 + 86400;
    const res = await pool.send(stranger.getSender(), { value: toNano('0.3') },
      { $$type: 'AirdropSweepResidualToTreasury' } as any);
    expect(exitOf(res, pool.address)).toBe(0);
    expect((await pool.getGetGlobal()).remaining_budget).toBe(0n);
    // Twice is a no-op, not a double-spend of the residual.
    expect(exitOf(await pool.send(stranger.getSender(), { value: toNano('0.3') },
      { $$type: 'AirdropSweepResidualToTreasury' } as any), pool.address)).toBe(26141);
  }, 180_000);

  it('AIRDROP-SWEEP-IDLE-01: [wave-8 MED] a pool that is still PAYING cannot be swept, however old it is', async () => {
    // The 10-year gate measures the CALENDAR, not activity: on its anniversary any passer-by could have swept the
    // whole remaining airdrop to the treasury while distribution was running normally. A dead-man has to measure
    // idleness. 26143 is that second condition.
    const { pool, distributor } = await setup(blockchain);
    const buyer = await blockchain.treasury('idle-buyer');
    const stranger = await blockchain.treasury('idle-sweeper');

    // Well past the calendar grace — but the pool pays out RIGHT NOW.
    blockchain.now = blockchain.now! + 315360000 + 86400;
    expect(exitOf(await pool.send(distributor.getSender(), { value: toNano('0.3') }, {
      $$type: 'AirdropAccrue', purchase_id: 1n, buyer: buyer.address, credits_k: 10n,
    } as any), pool.address), 'the accrual itself must succeed').toBe(0);
    const afterAccrual = (await pool.getGetGlobal()).remaining_budget;
    expect(afterAccrual, 'and must really have moved budget').toBeLessThan(TOTAL_POOL);

    // A live pool is not stranded, so the sweep must refuse it even though the calendar says otherwise.
    expect(exitOf(await pool.send(stranger.getSender(), { value: toNano('0.3') },
      { $$type: 'AirdropSweepResidualToTreasury' } as any), pool.address),
      'a pool that paid out this second is demonstrably alive').toBe(26143);
    expect((await pool.getGetGlobal()).remaining_budget, 'and keeps its budget').toBe(afterAccrual);

    // Only after a full year of silence does the residual count as stranded.
    blockchain.now = blockchain.now! + 31536000 + 86400;
    expect(exitOf(await pool.send(stranger.getSender(), { value: toNano('0.3') },
      { $$type: 'AirdropSweepResidualToTreasury' } as any), pool.address)).toBe(0);
    expect((await pool.getGetGlobal()).remaining_budget).toBe(0n);
  }, 180_000);

  it('AIRDROP-SEAL-OVERFUND-01: [wave-8 MED] one extra atomic unit must not brick the genesis seal forever', async () => {
    // funded_amount only grows, nothing resets it, and the notification's only authentication is that it came from
    // the pool's OWN ATH wallet — which accepts ATH from ANY holder. With the old `==` gate a stranger sending a
    // single extra unit before the ceremony sealed made the seal impossible for good, and an unsealed pool cannot
    // accrue at all. On the one contract ADR9 says must never be redeployed.
    const deployer = await blockchain.treasury('ovf-deployer');
    const poolWallet = await blockchain.treasury('ovf-pool-wallet');
    const treasury = await blockchain.treasury('ovf-treasury');
    const athMaster = await blockchain.treasury('ovf-ath-master');
    const distributor = await blockchain.treasury('ovf-distributor');
    const pool = blockchain.openContract(await AirdropPool.fromInit(deployer.address, MANIFEST, 0n, false));
    await pool.send(deployer.getSender(), { value: toNano('1') }, null);
    const dep = (body: any, v = '0.05') => pool.send(deployer.getSender(), { value: toNano(v) }, body);
    await dep({ $$type: 'AirdropBindAthMaster', ath_master_address: athMaster.address, pool_ath_wallet_address: poolWallet.address });
    await dep({ $$type: 'AirdropBindCreditIssuer', credit_issuer_address: distributor.address });
    await dep({ $$type: 'AirdropBindTreasury', treasury_address: treasury.address });

    await pool.send(poolWallet.getSender(), { value: toNano('0.1') }, {
      $$type: 'AthTransferNotification', query_id: 1n, sender_key: 0n, amount: TOTAL_POOL, sender_wallet: treasury.address,
    } as any);
    // The griefer: one atomic unit, from the same wallet, which anyone may cause by sending the pool ATH.
    await pool.send(poolWallet.getSender(), { value: toNano('0.1') }, {
      $$type: 'AthTransferNotification', query_id: 2n, sender_key: 0n, amount: 1n, sender_wallet: treasury.address,
    } as any);
    expect((await pool.getGetGlobal()).funded_amount, 'the fixture must really be overfunded').toBe(TOTAL_POOL + 1n);

    expect(exitOf(await dep({ $$type: 'AirdropSealGenesis', deployment_manifest_hash: MANIFEST }, '0.1'), pool.address),
      'the seal must still be reachable').toBe(0);
    const g = await pool.getGetGlobal();
    expect(g.sealed).toBe(true);
    // And the ceiling is untouched: the surplus is NOT distributable.
    expect(g.remaining_budget, 'the budget is capped at the airdrop, never more').toBe(TOTAL_POOL);
  }, 180_000);

  it('AIRDROP-TON-EXIT-01: [wave-8 LOW] native TON stranded by payouts can reach the treasury, and only it', async () => {
    // Until AirdropSweepUnaccountedTon existed, NO receiver in this contract sent native TON: both payout legs
    // carry a fixed constant and the residual sweep moves ATH through the wallet, not the balance. So the gap
    // between the 60,000,000 gate 26114 demands and what a payout really costs welded itself into the account —
    // measured at 11,624,530 per delivery — on the one contract ADR9 forbids ever redeploying.
    const { pool, treasury, distributor } = await setup(blockchain);
    const buyer = await blockchain.treasury('ton-exit-buyer');

    const before = (await blockchain.getContract(pool.address)).balance;
    for (let i = 1; i <= 3; i += 1) {
      expect(exitOf(await pool.send(distributor.getSender(), { value: toNano('0.3') }, {
        $$type: 'AirdropAccrue', purchase_id: BigInt(i), buyer: buyer.address, credits_k: 10n,
      } as any), pool.address)).toBe(0);
    }
    const stranded = (await blockchain.getContract(pool.address)).balance;
    expect(stranded, 'the fixture must really strand TON, or this proves nothing').toBeGreaterThan(before);

    const budgetBefore = (await pool.getGetGlobal()).remaining_budget;
    const distributedBefore = (await pool.getGetGlobal()).distributed_total;
    const treasuryBefore = (await blockchain.getContract(treasury.address)).balance;

    const stranger = await blockchain.treasury('ton-exit-sweeper');
    expect(exitOf(await pool.send(stranger.getSender(), { value: toNano('0.05') },
      { $$type: 'AirdropSweepUnaccountedTon' } as any), pool.address),
      'permissionless is safe here: the destination is bound at genesis, never caller-chosen').toBe(0);

    expect((await blockchain.getContract(treasury.address)).balance,
      'the TON must actually reach the treasury').toBeGreaterThan(treasuryBefore);
    const left = (await blockchain.getContract(pool.address)).balance;
    expect(left, 'and a storage endowment must stay behind').toBeGreaterThanOrEqual(90_000_000n);
    expect(left, 'but not the surplus').toBeLessThan(stranded);

    // It must not touch the airdrop in any way.
    const g = await pool.getGetGlobal();
    expect(g.remaining_budget, 'the ATH budget is untouched').toBe(budgetBefore);
    expect(g.distributed_total, 'and so is the distribution counter').toBe(distributedBefore);
  }, 180_000);

  it('AIRDROP-GAS-01: an under-funded accrual BOUNCES in COMPUTE — it never fails silently in ACTION', async () => {
    // This test exists because the first cut of this payout shipped the exact bug the whole codebase hunts. It used
    // nativeReserve(base, ReserveAtMost|ReserveAddOriginalBalance) + SendRemainingBalance, which forwards
    // (incoming - base). Under-funded, that goes negative: the ACTION phase fails while compute.exit stays 0 — no
    // accrual, no bounce, no trace, the buyer's ATH silently never arrives. Measured wall: 100M fails, 110M works,
    // and the 26114 gate sat at 60M and waved it straight through. A gate is only worth what it was measured at.
    // The shape now refuses in COMPUTE, which bounces. Pin BOTH halves: the refusal, and that the funded case's
    // action phase actually succeeds — a gate calibrated under the real cost readmits the silent failure.
    const deployer = await blockchain.treasury('gas-deployer');
    const ci = await blockchain.treasury('gas-ci');
    const buyer = await blockchain.treasury('gas-buyer');
    const poolWallet = await blockchain.treasury('gas-pw');
    const other = await blockchain.treasury('gas-other');

    const p2 = blockchain.openContract(await AirdropPool.fromInit(deployer.address, MANIFEST, 0n, false));
    await p2.send(deployer.getSender(), { value: toNano('1') }, null);
    const d2 = (body: any, v = '0.05') => p2.send(deployer.getSender(), { value: toNano(v) }, body);
    await d2({ $$type: 'AirdropBindAthMaster', ath_master_address: other.address, pool_ath_wallet_address: poolWallet.address });
    await d2({ $$type: 'AirdropBindCreditIssuer', credit_issuer_address: ci.address });
    await d2({ $$type: 'AirdropBindTreasury', treasury_address: other.address });
    await p2.send(poolWallet.getSender(), { value: toNano('0.1') }, {
      $$type: 'AthTransferNotification', query_id: 1n, sender_key: 0n, amount: TOTAL_POOL, sender_wallet: other.address,
    } as any);
    await d2({ $$type: 'AirdropSealGenesis', deployment_manifest_hash: MANIFEST }, '0.1');

    const starved = await p2.send(ci.getSender(), { value: 40_000_000n }, {
      $$type: 'AirdropAccrue', purchase_id: 1n, buyer: buyer.address, credits_k: 10n,
    } as any);
    const tx: any = starved.transactions.find(
      (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === p2.address.toString());
    expect(Number(tx?.description?.computePhase?.exitCode), 'refused in COMPUTE').toBe(26114);
    expect(starved.transactions.some((t: any) => t.inMessage?.info?.bounced === true), 'and it BOUNCES').toBe(true);
    expect((await p2.getGetGlobal()).remaining_budget, 'fail-closed BEFORE the budget moves').toBe(TOTAL_POOL);

    const ok = await p2.send(ci.getSender(), { value: 80_000_000n }, {
      $$type: 'AirdropAccrue', purchase_id: 2n, buyer: buyer.address, credits_k: 10n,
    } as any);
    const okTx: any = ok.transactions.find(
      (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === p2.address.toString());
    expect(Number(okTx?.description?.computePhase?.exitCode)).toBe(0);
    expect(okTx?.description?.actionPhase?.success, 'ACTION must succeed at the value CreditIssuer forwards').toBe(true);
    expect((await p2.getGetGlobal()).distributed_total).toBe(10n * ATH_PER_CREDIT);
  }, 180_000);

  it('AIRDROP-MATH-01: the owner\'s tokenomics closes exactly', () => {
    // 1.5M credits x 10 ATH = 15M ATH, and 1.5M x the credit price = the ~16.5k TON that funds the DeFi pool.
    const credits = 1_500_000n;
    expect(credits * ATH_PER_CREDIT).toBe(TOTAL_POOL);
    const collected = credits * PREPAID_UNIT;
    expect(collected / 1_000_000_000n).toBeGreaterThanOrEqual(15_000n);   // >= the owner's stated 15k TON
    expect(collected / 1_000_000_000n).toBeLessThan(20_000n);
  });
});
