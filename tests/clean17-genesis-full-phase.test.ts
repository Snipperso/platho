import { describe, expect, it, beforeEach } from 'vitest';
import { Address, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { AirdropPool } from '../build/AirdropPool/AirdropPool_AirdropPool';
import { FeeAccumulator } from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// clean-17 GENESIS — FULL-PHASE SANDBOX REPLAY of the AirdropPool arc.
//
// The 99 component tests each prove one leg of the migrated ceremony. This suite proves the WHOLE arc runs, in
// the ceremony's real phase order, with the ceremony's real SIGNER ROLES:
//
//     deploy  ->  bind (AirdropPool side + FeeAccumulator side)  ->  fund 15M  ->  seal (binds manifest)
//
// It exists specifically to guard the surface the Vault->AirdropPool migration INTRODUCED and that no other suite
// exercises end to end: the reciprocal FeeAccumulator <-> AirdropPool binding, whose signer is NOT the genesis
// controller. FeeAccumulator.BindAirdropPool is authorised by requireTreasury() (gate 15050) — sender() must be
// the ton_treasury_receiver role, not the controller. A ceremony packet that signs this leg with the controller
// bounces 15050 on the immutable mainnet and the airdrop never wires. The deploy-packet generator special-cases
// exactly this signer; here we prove, against the real compiled contracts, that the correct signer succeeds and
// the wrong one is rejected.
//
// Username/Profile/ATHMaster legs are covered by deployment-genesis-auth / deployment-manifest / ath-* suites;
// this file is the AirdropPool-and-its-reciprocal arc, which is what the migration changed.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const MANIFEST = 0xABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789n;
const TOTAL_POOL = 15_000_000_000_000_000n;   // 15M ATH @ 9 decimals — the whole airdrop budget

function exitOf(res: any, dest: Address): number {
  const tx: any = res.transactions.find(
    (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === dest.toString());
  return Number(tx?.description?.computePhase?.exitCode ?? -999);
}

describe('clean-17 genesis — full-phase AirdropPool <-> FeeAccumulator replay', () => {
  let blockchain: Blockchain;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = 1_790_000_000;   // post-Apr-2026 era (matches the shard suites' clock; immaterial to these gates)
  });

  it('FULL-PHASE-01: the whole arc runs — deploy, both-side bind, fund 15M, seal binds the manifest', async () => {
    const controller = await blockchain.treasury('fp1-controller');
    const treasury = await blockchain.treasury('fp1-treasury');       // == ton_treasury_receiver: signer of the fee leg
    const buyback = await blockchain.treasury('fp1-buyback');
    const athMaster = await blockchain.treasury('fp1-ath-master');
    const poolWallet = await blockchain.treasury('fp1-pool-wallet');  // the pool's OWN ATH wallet — only it may fund

    // ── PHASE: deploy ────────────────────────────────────────────────────────────────────────────────────────
    // The pool deploys with deployment_manifest_hash = 0 (clean-17 breaks the manifest circularity; seal binds the
    // real hash later). FeeAccumulator deploys with its two roles and no deployment_id.
    const pool = blockchain.openContract(await AirdropPool.fromInit(controller.address, 0n, 0n, false, 0n));
    await pool.send(controller.getSender(), { value: toNano('1') }, null);
    const feeAcc = blockchain.openContract(await FeeAccumulator.fromInit(treasury.address, buyback.address));
    await feeAcc.send(controller.getSender(), { value: toNano('1') }, null);

    expect((await pool.getGetGlobal()).deployment_manifest_hash, 'deployed with hash 0').toBe(0n);

    // ── PHASE: bind (AirdropPool side — controller-signed, requireController) ─────────────────────────────────
    // The distributor bound here is the FeeAccumulator ADDRESS. The field is named credit_issuer_address (a
    // clean-16 holdover), but in clean-17 the sole accrual authenticator is the FeeAccumulator.
    const ctl = (body: any, v = '0.05') => pool.send(controller.getSender(), { value: toNano(v) }, body);
    await ctl({ $$type: 'AirdropBindAthMaster', ath_master_address: athMaster.address, pool_ath_wallet_address: poolWallet.address });
    await ctl({ $$type: 'AirdropBindCreditIssuer', credit_issuer_address: feeAcc.address });
    await ctl({ $$type: 'AirdropBindTreasury', treasury_address: treasury.address });

    let g = await pool.getGetGlobal();
    expect(g.ath_master_bound && g.credit_issuer_bound && g.treasury_bound, 'all three pool-side binds set').toBe(true);
    expect(g.credit_issuer_address.equals(feeAcc.address), 'distributor is the FeeAccumulator').toBe(true);

    // ── PHASE: bind (FeeAccumulator side — TREASURY-signed, requireTreasury gate 15050) ──────────────────────
    // This is the reciprocal leg and the migration's real trap: it is signed by the treasury role, NOT the
    // controller. Correct signer => exit 0.
    const bindReciprocal = await feeAcc.send(treasury.getSender(), { value: toNano('0.05') },
      { $$type: 'BindAirdropPool', airdrop_pool_address: pool.address });
    expect(exitOf(bindReciprocal, feeAcc.address), 'treasury-signed reciprocal bind succeeds').toBe(0);

    // ── PHASE: fund (only the pool's own wallet may report a deposit — gate 26019) ───────────────────────────
    //
    // [SCOPE CORRECTED 2026-08-02] `poolWallet` here is a STAND-IN treasury, not a real ATHWallet, and this line
    // hand-delivers the notification. That is legitimate for what this file is about — the reciprocal bind and the
    // signer roles — but it is NOT evidence that the ceremony's funding message produces a notification, and it was
    // read as such. On mainnet F01 was built on the plain lane, which emits nothing to the pool; the ATH arrived,
    // funded_amount stayed 0, and S01 was refused by gate 26044.
    //
    // The end-to-end claim now lives in tests/genesis-funding-really-funds-the-pool.test.ts, which routes the real
    // F01 body through a real ATHMaster and a real ATHWallet and lets the contracts do the talking. Keep this line
    // as the shortcut it is, and do not let it stand in for that one again.
    await pool.send(poolWallet.getSender(), { value: toNano('0.1') }, {
      $$type: 'AthTransferNotification', query_id: 1n, sender_key: 0n, amount: TOTAL_POOL, sender_wallet: treasury.address,
    } as any);
    expect((await pool.getGetGlobal()).funded_amount, 'pool funded to the full 15M').toBe(TOTAL_POOL);

    // ── PHASE: seal (binds the real manifest; requires every bind + a real 15M funding) ──────────────────────
    expect(exitOf(await pool.send(controller.getSender(), { value: toNano('0.1') },
      { $$type: 'AirdropSealGenesis', deployment_manifest_hash: MANIFEST }), pool.address), 'seal succeeds').toBe(0);

    // ── final genesis state ──────────────────────────────────────────────────────────────────────────────────
    g = await pool.getGetGlobal();
    expect(g.sealed, 'pool sealed').toBe(true);
    expect(g.deployment_manifest_hash, 'seal bound the real manifest into the pool').toBe(MANIFEST);
    expect(g.funded_amount).toBe(TOTAL_POOL);
    expect(g.remaining_budget, 'the whole 15M is available to pay out').toBe(TOTAL_POOL);
    expect(g.distributed_total).toBe(0n);
  }, 180_000);

  it('FULL-PHASE-02: the immutable signer trap — the reciprocal fee leg REJECTS the controller (15050), accepts the treasury', async () => {
    const controller = await blockchain.treasury('fp2-controller');
    const treasury = await blockchain.treasury('fp2-treasury');
    const buyback = await blockchain.treasury('fp2-buyback');
    const pool = await blockchain.treasury('fp2-pool');   // a stand-in address is all the fee leg stores

    const feeAcc = blockchain.openContract(await FeeAccumulator.fromInit(treasury.address, buyback.address));
    await feeAcc.send(controller.getSender(), { value: toNano('1') }, null);

    // WRONG signer: the genesis controller. This is exactly what a naive packet (one signer for every bind) would
    // do — and on mainnet it bounces, leaving the airdrop unwired with no obvious cause.
    const wrong = await feeAcc.send(controller.getSender(), { value: toNano('0.05') },
      { $$type: 'BindAirdropPool', airdrop_pool_address: pool.address });
    expect(exitOf(wrong, feeAcc.address), 'controller is refused by requireTreasury').toBe(15050);

    // The field must still be unset: prove it by having the CORRECT signer succeed now (a set field would already
    // be non-null and this would bounce 15053 instead).
    const right = await feeAcc.send(treasury.getSender(), { value: toNano('0.05') },
      { $$type: 'BindAirdropPool', airdrop_pool_address: pool.address });
    expect(exitOf(right, feeAcc.address), 'treasury signer binds the pool').toBe(0);

    // And it is one-shot: a second treasury-signed bind is now refused (15053), which also confirms the first one
    // actually wrote the field — the getter does not expose airdrop_pool_address, so this is the observable.
    const again = await feeAcc.send(treasury.getSender(), { value: toNano('0.05') },
      { $$type: 'BindAirdropPool', airdrop_pool_address: pool.address });
    expect(exitOf(again, feeAcc.address), 'reciprocal bind is one-shot once set').toBe(15053);
  }, 120_000);

  it('FULL-PHASE-03: phase ORDER is load-bearing — seal before fund is refused (26044), seal after fund succeeds', async () => {
    // The broadcast phases run deploy -> ... -> fund -> seal. If a packet sealed before funding, the pool would
    // freeze empty and the 15M could never enter. Gate 26044 is what makes that ordering non-optional.
    const controller = await blockchain.treasury('fp3-controller');
    const treasury = await blockchain.treasury('fp3-treasury');
    const athMaster = await blockchain.treasury('fp3-ath-master');
    const poolWallet = await blockchain.treasury('fp3-pool-wallet');

    const pool = blockchain.openContract(await AirdropPool.fromInit(controller.address, 0n, 0n, false, 0n));
    await pool.send(controller.getSender(), { value: toNano('1') }, null);
    const ctl = (body: any, v = '0.05') => pool.send(controller.getSender(), { value: toNano(v) }, body);

    await ctl({ $$type: 'AirdropBindAthMaster', ath_master_address: athMaster.address, pool_ath_wallet_address: poolWallet.address });
    await ctl({ $$type: 'AirdropBindCreditIssuer', credit_issuer_address: treasury.address });
    await ctl({ $$type: 'AirdropBindTreasury', treasury_address: treasury.address });

    // Bound but not yet funded — sealing here is refused. A ceremony that reordered fund after seal would hit this.
    expect(exitOf(await ctl({ $$type: 'AirdropSealGenesis', deployment_manifest_hash: MANIFEST }, '0.1'), pool.address),
      'seal before fund is refused').toBe(26044);
    expect((await pool.getGetGlobal()).sealed).toBe(false);

    // Fund, then seal — the ceremony's order — succeeds.
    await pool.send(poolWallet.getSender(), { value: toNano('0.1') }, {
      $$type: 'AthTransferNotification', query_id: 1n, sender_key: 0n, amount: TOTAL_POOL, sender_wallet: treasury.address,
    } as any);
    expect(exitOf(await ctl({ $$type: 'AirdropSealGenesis', deployment_manifest_hash: MANIFEST }, '0.1'), pool.address),
      'seal after fund succeeds').toBe(0);
    expect((await pool.getGetGlobal()).sealed).toBe(true);
  }, 180_000);
});
