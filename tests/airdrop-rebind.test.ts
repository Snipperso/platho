import { describe, expect, it, beforeEach } from 'vitest';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, toNano } from '@ton/core';
import { AirdropPool } from '../build/AirdropPool/AirdropPool_AirdropPool';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// AIRDROP-REBIND — the migration hook this whole redeploy round exists for.
//
// The problem it solves is not hypothetical, it already happened: the airdrop allocation lived inside Vault, and
// abandoning Vault stranded it with no way out. AirdropPool was split off so a redeploy could not destroy the
// allocation again — but that only saves the COINS. The distributor is a contract too, and it gets redeployed
// with everything else. Bound one-shot and unsealed-only, the pool would sit after the next redeploy holding 15M
// ATH it could never hand out. A contract is immutable after seal, so the hook has to exist now or never.
//
// Its scope is the narrowest thing that solves it: repoint the distributor, nothing else. These tests pin the
// scope as much as the function, because a migration hook that quietly grew powers would be the worse outcome.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const MANIFEST = 0x5151515151515151515151515151515151515151515151515151515151515151n;
const TOTAL_POOL = 15_000_000_000_000_000n;   // AIRDROP_TOTAL_POOL — 15M ATH at 9 decimals

describe('AIRDROP-REBIND — the distributor can be repointed after seal, and nothing else can', () => {
  let blockchain: Blockchain;
  let controller: SandboxContract<TreasuryContract>;
  let attacker: SandboxContract<TreasuryContract>;
  let pool: SandboxContract<AirdropPool>;
  let poolWallet: SandboxContract<TreasuryContract>;
  let issuerA: Address;
  let issuerB: Address;

  const exitOf = (res: any) => Number(res.transactions.find(
    (t: any) => t.inMessage?.info?.dest?.toString() === pool.address.toString(),
  )?.description?.computePhase?.exitCode ?? -999);

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = 1_790_000_000;
    controller = await blockchain.treasury('rebind-controller');
    attacker = await blockchain.treasury('rebind-attacker');
    issuerA = (await blockchain.treasury('issuer-a')).address;
    issuerB = (await blockchain.treasury('issuer-b')).address;

    poolWallet = await blockchain.treasury('rebind-pool-wallet');
    pool = blockchain.openContract(await AirdropPool.fromInit(controller.address, MANIFEST, 0n, false, 0n));
    await pool.send(controller.getSender(), { value: toNano('1') }, null as any);
    await pool.send(controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'AirdropBindAthMaster',
      ath_master_address: (await blockchain.treasury('rebind-master')).address,
      pool_ath_wallet_address: poolWallet.address,
    } as any);
    await pool.send(controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'AirdropBindCreditIssuer', credit_issuer_address: issuerA,
    } as any);
    await pool.send(controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'AirdropBindTreasury', treasury_address: (await blockchain.treasury('rebind-treasury')).address,
    } as any);
  });

  const rebind = (from: SandboxContract<TreasuryContract>, address: Address, manifest = MANIFEST) =>
    pool.send(from.getSender(), { value: toNano('0.05') }, {
      $$type: 'AirdropRebindCreditIssuer', deployment_manifest_hash: manifest, credit_issuer_address: address,
    } as any);

  /** The real ceremony: the allocation must actually be delivered before the door closes (gate 26044). */
  const seal = async () => {
    await pool.send(poolWallet.getSender(), { value: toNano('0.1') }, {
      $$type: 'AthTransferNotification', query_id: 1n, sender_key: 0n, amount: TOTAL_POOL,
      sender_wallet: (await blockchain.treasury('rebind-treasury')).address,
    } as any);
    await pool.send(controller.getSender(), { value: toNano('0.1') }, {
      $$type: 'AirdropSealGenesis', deployment_manifest_hash: MANIFEST,
    } as any);
  };

  it('REBIND-01: after seal the controller can repoint the distributor — the coins stay reachable', async () => {
    await seal();
    expect((await pool.getGetGlobal()).credit_issuer_address.equals(issuerA)).toBe(true);

    expect(exitOf(await rebind(controller, issuerB)), 'the rebind is accepted').toBe(0);
    const config = await pool.getGetGlobal();
    expect(config.credit_issuer_address.equals(issuerB), 'the distributor moved').toBe(true);
    expect(config.credit_issuer_bound, 'and it is still bound').toBe(true);
  }, 120_000);

  it('REBIND-02: BEFORE the seal it is refused — genesis must not have two ways to set one field', async () => {
    expect(exitOf(await rebind(controller, issuerB)), 'unsealed -> 26100').toBe(26100);
    expect((await pool.getGetGlobal()).credit_issuer_address.equals(issuerA)).toBe(true);
  }, 120_000);

  it('REBIND-03: only the controller, and only for THIS deployment', async () => {
    await seal();
    expect(exitOf(await rebind(attacker, issuerB)), 'a stranger cannot repoint the airdrop').toBe(26033);
    expect(exitOf(await rebind(controller, issuerB, MANIFEST + 1n)), 'nor can it be replayed at another deployment').toBe(26013);
    expect((await pool.getGetGlobal()).credit_issuer_address.equals(issuerA), 'unmoved').toBe(true);
  }, 120_000);

  it('REBIND-04: the address is sanity-checked, so a typo cannot strand the allocation again', async () => {
    await seal();
    expect(exitOf(await rebind(controller, pool.address)), 'the pool may not point at itself').toBe(26016);
    expect((await pool.getGetGlobal()).credit_issuer_address.equals(issuerA)).toBe(true);
  }, 120_000);

  it('REBIND-05: the hook repoints the distributor and NOTHING else — scope is the point', async () => {
    await seal();
    const before = await pool.getGetGlobal();
    const beforeState = await pool.getGetGlobal();
    await rebind(controller, issuerB);
    const after = await pool.getGetGlobal();
    const afterState = await pool.getGetGlobal();

    // everything that is NOT the distributor must be byte-identical: a migration hook that grew powers would be
    // a worse outcome than the problem it solves.
    expect(after.ath_master_address.toString()).toBe(before.ath_master_address.toString());
    expect(after.treasury_address.toString()).toBe(before.treasury_address.toString());
    expect(after.genesis_controller_address.toString()).toBe(before.genesis_controller_address.toString());
    expect(after.sealed).toBe(before.sealed);
    expect(afterState.remaining_budget, 'not one nanoton of the allocation moved').toBe(beforeState.remaining_budget);
    expect(afterState.funded_amount).toBe(beforeState.funded_amount);
  }, 120_000);
});
