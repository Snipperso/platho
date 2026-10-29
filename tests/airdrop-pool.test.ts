import { describe, expect, it, beforeEach } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract, createShardAccount } from '@ton/sandbox';
import { keyPairFromSeed } from '@ton/crypto';
import { AirdropPool } from '../build/AirdropPool/AirdropPool_AirdropPool';


const MANIFEST = 0xABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789n;
const PREPAID_UNIT = 10_995_000n;
const TOTAL_POOL = 15_000_000_000_000_000n;
const ATH_PER_CREDIT = 10_000_000_000n;

const issuerPubkey = (i: number) => BigInt('0x' + keyPairFromSeed(Buffer.alloc(32, 100 + i)).publicKey.toString('hex'));

function exitOf(res: any, dest: Address): number {
  const tx: any = res.transactions.find(
    (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === dest.toString());
  return Number(tx?.description?.computePhase?.exitCode ?? -999);
}

async function drainToCredits(pool: any, distributor: any, buyer: Address, targetCreditsLeft: number, startSeq: bigint) {
  let seq = startSeq;
  let left = 1_500_000;
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

async function setup(blockchain: Blockchain) {
  const deployer = await blockchain.treasury('adr-deployer');
  const poolWallet = await blockchain.treasury('adr-pool-wallet');
  const treasury = await blockchain.treasury('adr-treasury');
  const athMaster = await blockchain.treasury('adr-ath-master');
  const distributor = await blockchain.treasury('adr-distributor');

  const pool = blockchain.openContract(await AirdropPool.fromInit(deployer.address, MANIFEST, 0n, false, 0n));
  await pool.send(deployer.getSender(), { value: toNano('1') }, null);

  const dep = (body: any, v = '0.05') => pool.send(deployer.getSender(), { value: toNano(v) }, body);

  await dep({ $$type: 'AirdropBindAthMaster', ath_master_address: athMaster.address, pool_ath_wallet_address: poolWallet.address });
  await dep({ $$type: 'AirdropBindCreditIssuer', credit_issuer_address: distributor.address });
  await dep({ $$type: 'AirdropBindTreasury', treasury_address: treasury.address });
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
    const pool = blockchain.openContract(await AirdropPool.fromInit(deployer.address, MANIFEST, 0n, false, 0n));
    await pool.send(deployer.getSender(), { value: toNano('1') }, null);
    const dep = (body: any, v = '0.05') => pool.send(deployer.getSender(), { value: toNano(v) }, body);

    expect(exitOf(await dep({ $$type: 'AirdropSealGenesis', deployment_manifest_hash: MANIFEST }, '0.1'), pool.address)).toBe(26041);

    await dep({ $$type: 'AirdropBindAthMaster', ath_master_address: other.address, pool_ath_wallet_address: poolWallet.address });
    await dep({ $$type: 'AirdropBindCreditIssuer', credit_issuer_address: other.address });
    await dep({ $$type: 'AirdropBindTreasury', treasury_address: other.address });

    expect(exitOf(await dep({ $$type: 'AirdropSealGenesis', deployment_manifest_hash: MANIFEST }, '0.1'), pool.address)).toBe(26044);

    const forged = await pool.send(other.getSender(), { value: toNano('0.1') }, {
      $$type: 'AthTransferNotification', query_id: 9n, sender_key: 0n, amount: TOTAL_POOL, sender_wallet: other.address,
    } as any);
    expect(exitOf(forged, pool.address)).toBe(26019);
    expect((await pool.getGetGlobal()).funded_amount).toBe(0n);

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
    const deployer = await blockchain.treasury('g2-deployer');
    const poolWallet = await blockchain.treasury('g2-pool-wallet');
    const ciAddr = (await blockchain.treasury('g2-ci')).address;
    const treasuryAddr = (await blockchain.treasury('g2-treasury')).address;
    const athMasterAddr = (await blockchain.treasury('g2-ath-master')).address;
    const pool = blockchain.openContract(await AirdropPool.fromInit(deployer.address, 0n, 0n, false, 0n));
    await pool.send(deployer.getSender(), { value: toNano('1') }, null);
    const dep = (body: any, v = '0.05') => pool.send(deployer.getSender(), { value: toNano(v) }, body);

    expect((await pool.getGetGlobal()).deployment_manifest_hash).toBe(0n);

    await dep({ $$type: 'AirdropBindAthMaster', ath_master_address: athMasterAddr, pool_ath_wallet_address: poolWallet.address });
    await dep({ $$type: 'AirdropBindCreditIssuer', credit_issuer_address: ciAddr });
    await dep({ $$type: 'AirdropBindTreasury', treasury_address: treasuryAddr });
    await pool.send(poolWallet.getSender(), { value: toNano('0.1') }, {
      $$type: 'AthTransferNotification', query_id: 1n, sender_key: 0n, amount: TOTAL_POOL, sender_wallet: treasuryAddr,
    } as any);

    expect(exitOf(await dep({ $$type: 'AirdropSealGenesis', deployment_manifest_hash: 0n }, '0.1'), pool.address)).toBe(26040);
    expect(exitOf(await dep({ $$type: 'AirdropSealGenesis', deployment_manifest_hash: 1n }, '0.1'), pool.address)).toBe(26040);

    expect(exitOf(await dep({ $$type: 'AirdropSealGenesis', deployment_manifest_hash: MANIFEST }, '0.1'), pool.address)).toBe(0);
    const g = await pool.getGetGlobal();
    expect(g.sealed).toBe(true);
    expect(g.deployment_manifest_hash, 'seal bound the real manifest hash into the pool').toBe(MANIFEST);
  }, 120_000);

  it('AIRDROP-ACCRUE-01: a SETTLED accrual credits 10 ATH per credit to the exact buyer', async () => {
    const { pool, poolWallet, distributor } = await setup(blockchain);
    const buyer = await blockchain.treasury('buyer');

    const res = await pool.send(distributor.getSender(), { value: toNano('0.1') }, {
      $$type: 'AirdropAccrue', purchase_id: 1n, buyer: buyer.address, credits_k: 10n,
    } as any);

    const g = await pool.getGetGlobal();
    expect(g.distributed_total, '10 credits x 10 ATH').toBe(10n * ATH_PER_CREDIT);
    expect(g.remaining_budget).toBe(TOTAL_POOL - 10n * ATH_PER_CREDIT);
    expect(g.claim_count).toBe(1n);

    const payout = res.transactions.some((t: any) =>
      t.inMessage?.info?.dest?.toString() === poolWallet.address.toString() && t.inMessage?.info?.type === 'internal');
    expect(payout, 'an ATHTransferRequest must reach the pool wallet').toBe(true);
  }, 180_000);

  it('AIRDROP-BOUNDARY-01: [W3-002] at the 15M edge the pool pays the REMAINDER then nothing — no budget is stranded', async () => {
    const { pool, poolWallet, distributor } = await setup(blockchain);
    const buyer = await blockchain.treasury('boundary-buyer');
    let seq = await drainToCredits(pool, distributor, buyer.address, 55, 1n);
    expect((await pool.getGetGlobal()).remaining_budget, 'drained to the chosen edge').toBe(55n * ATH_PER_CREDIT);

    const edge = await pool.send(distributor.getSender(), { value: toNano('0.1') }, {
      $$type: 'AirdropAccrue', purchase_id: seq, buyer: buyer.address, credits_k: 100n,
    } as any);
    seq += 1n;
    expect(exitOf(edge, pool.address), 'the boundary accrual is accepted, not thrown').toBe(0);
    const g = await pool.getGetGlobal();
    expect(g.remaining_budget, 'the budget is drained to the last whole credit — nothing left to strand').toBe(0n);
    expect(g.distributed_total, 'the 55-credit remainder was delivered (whole 15M now distributed)').toBe(TOTAL_POOL);
    expect(hitPoolWallet(edge, poolWallet.address), 'the partial payout is actually commanded from the pool wallet').toBe(true);

    const empty = await pool.send(distributor.getSender(), { value: toNano('0.1') }, {
      $$type: 'AirdropAccrue', purchase_id: seq, buyer: buyer.address, credits_k: 10n,
    } as any);
    expect(exitOf(empty, pool.address), 'an empty pool still accepts the accrual, it simply pays nothing').toBe(0);
    expect((await pool.getGetGlobal()).remaining_budget, 'stays zero').toBe(0n);
    expect(hitPoolWallet(empty, poolWallet.address), 'no payout leaves an exhausted pool').toBe(false);
  }, 300_000);

  it('AIRDROP-AUTH-01: only the bound CreditIssuer may accrue (26110)', async () => {
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

    expect(exitOf(await pool.send(stranger.getSender(), { value: toNano('0.3') },
      { $$type: 'AirdropSweepResidualToTreasury' } as any), pool.address)).toBe(26140);

    blockchain.now = blockchain.now! + 315360000 + 86400;
    const res = await pool.send(stranger.getSender(), { value: toNano('0.3') },
      { $$type: 'AirdropSweepResidualToTreasury' } as any);
    expect(exitOf(res, pool.address)).toBe(0);
    expect((await pool.getGetGlobal()).remaining_budget).toBe(0n);
    expect(exitOf(await pool.send(stranger.getSender(), { value: toNano('0.3') },
      { $$type: 'AirdropSweepResidualToTreasury' } as any), pool.address)).toBe(26141);
  }, 180_000);

  it('AIRDROP-SWEEP-IDLE-01: [wave-8 MED] a pool that is still PAYING cannot be swept, however old it is', async () => {
    const { pool, distributor } = await setup(blockchain);
    const buyer = await blockchain.treasury('idle-buyer');
    const stranger = await blockchain.treasury('idle-sweeper');

    blockchain.now = blockchain.now! + 315360000 + 86400;
    expect(exitOf(await pool.send(distributor.getSender(), { value: toNano('0.3') }, {
      $$type: 'AirdropAccrue', purchase_id: 1n, buyer: buyer.address, credits_k: 10n,
    } as any), pool.address), 'the accrual itself must succeed').toBe(0);
    const afterAccrual = (await pool.getGetGlobal()).remaining_budget;
    expect(afterAccrual, 'and must really have moved budget').toBeLessThan(TOTAL_POOL);

    expect(exitOf(await pool.send(stranger.getSender(), { value: toNano('0.3') },
      { $$type: 'AirdropSweepResidualToTreasury' } as any), pool.address),
      'a pool that paid out this second is demonstrably alive').toBe(26143);
    expect((await pool.getGetGlobal()).remaining_budget, 'and keeps its budget').toBe(afterAccrual);

    blockchain.now = blockchain.now! + 31536000 + 86400;
    expect(exitOf(await pool.send(stranger.getSender(), { value: toNano('0.3') },
      { $$type: 'AirdropSweepResidualToTreasury' } as any), pool.address)).toBe(0);
    expect((await pool.getGetGlobal()).remaining_budget).toBe(0n);
  }, 180_000);

  it('AIRDROP-SEAL-OVERFUND-01: [wave-8 MED] one extra atomic unit must not brick the genesis seal forever', async () => {
    const deployer = await blockchain.treasury('ovf-deployer');
    const poolWallet = await blockchain.treasury('ovf-pool-wallet');
    const treasury = await blockchain.treasury('ovf-treasury');
    const athMaster = await blockchain.treasury('ovf-ath-master');
    const distributor = await blockchain.treasury('ovf-distributor');
    const pool = blockchain.openContract(await AirdropPool.fromInit(deployer.address, MANIFEST, 0n, false, 0n));
    await pool.send(deployer.getSender(), { value: toNano('1') }, null);
    const dep = (body: any, v = '0.05') => pool.send(deployer.getSender(), { value: toNano(v) }, body);
    await dep({ $$type: 'AirdropBindAthMaster', ath_master_address: athMaster.address, pool_ath_wallet_address: poolWallet.address });
    await dep({ $$type: 'AirdropBindCreditIssuer', credit_issuer_address: distributor.address });
    await dep({ $$type: 'AirdropBindTreasury', treasury_address: treasury.address });

    await pool.send(poolWallet.getSender(), { value: toNano('0.1') }, {
      $$type: 'AthTransferNotification', query_id: 1n, sender_key: 0n, amount: TOTAL_POOL, sender_wallet: treasury.address,
    } as any);
    await pool.send(poolWallet.getSender(), { value: toNano('0.1') }, {
      $$type: 'AthTransferNotification', query_id: 2n, sender_key: 0n, amount: 1n, sender_wallet: treasury.address,
    } as any);
    expect((await pool.getGetGlobal()).funded_amount, 'the fixture must really be overfunded').toBe(TOTAL_POOL + 1n);

    expect(exitOf(await dep({ $$type: 'AirdropSealGenesis', deployment_manifest_hash: MANIFEST }, '0.1'), pool.address),
      'the seal must still be reachable').toBe(0);
    const g = await pool.getGetGlobal();
    expect(g.sealed).toBe(true);
    expect(g.remaining_budget, 'the budget is capped at the airdrop, never more').toBe(TOTAL_POOL);
  }, 180_000);

  it('AIRDROP-TON-EXIT-01: [wave-8 LOW] native TON stranded by payouts can reach the treasury, and only it', async () => {
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

    const g = await pool.getGetGlobal();
    expect(g.remaining_budget, 'the ATH budget is untouched').toBe(budgetBefore);
    expect(g.distributed_total, 'and so is the distribution counter').toBe(distributedBefore);
  }, 180_000);

  it('AIRDROP-GAS-01: an under-funded accrual BOUNCES in COMPUTE — it never fails silently in ACTION', async () => {
    const deployer = await blockchain.treasury('gas-deployer');
    const ci = await blockchain.treasury('gas-ci');
    const buyer = await blockchain.treasury('gas-buyer');
    const poolWallet = await blockchain.treasury('gas-pw');
    const other = await blockchain.treasury('gas-other');

    const p2 = blockchain.openContract(await AirdropPool.fromInit(deployer.address, MANIFEST, 0n, false, 0n));
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

  it('AIRDROP-MATH-01: the tokenomics closes exactly', () => {
    const credits = 1_500_000n;
    expect(credits * ATH_PER_CREDIT).toBe(TOTAL_POOL);
    const collected = credits * PREPAID_UNIT;
    expect(collected / 1_000_000_000n).toBeGreaterThanOrEqual(15_000n);
    expect(collected / 1_000_000_000n).toBeLessThan(20_000n);
  });
});
