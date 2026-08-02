import { describe, expect, it } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { ATHWallet, ATHTransferRequest } from '../build/ATHWallet/ATHWallet_ATHWallet';
import { AirdropPool } from '../build/AirdropPool/AirdropPool_AirdropPool';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// WHAT ONE 10-ATH AIRDROP PAYOUT ACTUALLY COSTS.
//
// A previous answer here was WRONG and wrong in the way this project keeps punishing: it SUMMED the constants
// on ATHWallet's ATHTransferRequest path (2M exec + 3M ack + 20M endowment + 21M fwd + 2M owner = 48M) and
// reported 48M as the cost. Those are ATTACH requirements, not spend. FWD_FEE_ALLOWANCE and the endowment are
// allowances: whatever is not consumed is returned as change to response_destination. Summing reserves
// overstates cost by whatever the allowances return, which is most of them.
//
// So this measures the only thing that is real: TON that does not come back. Two separate accountings, because
// one of them being wrong is exactly the failure mode above:
//   1. sum of every transaction's totalFees in the chain  (what the network actually burned)
//   2. net drop across ALL participating accounts          (what left the system, incl. value parked forever)
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const AIRDROP_ATH_PER_CREDIT = 10_000_000_000n;   // 10 ATH, the owner's fixed rate
const AIRDROP_ATHWALLET_LEG_GAS = 50_000_000n;    // what AirdropPool attaches today

const fixtureAddress = (label: string) =>
  new Address(0, createHash('sha256').update(`PLATHO.V1.AIRCOST.${label}`).digest());

async function deployWallet(bc: Blockchain, owner: Address, master: Address, tokens: bigint, ton: string) {
  const zeroInit = await ATHWallet.init(0n, owner, master);
  const dataInit = await ATHWallet.init(tokens, owner, master);
  const address = contractAddress(owner.workChain, zeroInit);
  await bc.setShardAccount(address, createShardAccount({
    address, code: zeroInit.code, data: dataInit.data, balance: toNano(ton), workchain: address.workChain,
  }));
  return bc.openContract(new ATHWallet(address, zeroInit));
}

async function balanceOf(bc: Blockchain, a: Address): Promise<bigint> {
  return (await bc.getContract(a)).balance;
}

/**
 * One payout exactly as AirdropPool performs it: the pool tells its OWN ATHWallet to send `amount` to the
 * recipient, with the pool itself as response_destination (so change comes home to the pool).
 * `freshRecipient` decides whether the recipient's ATHWallet already exists — that is the one leg that can
 * genuinely park value forever, so it must be measured separately rather than assumed.
 */
async function measurePayout(freshRecipient: boolean) {
  const bc = await Blockchain.create();
  // Post-Apr-2026 config-18 rate era. The sandbox default is 2023, where a cell costs 7.5x more — measuring
  // storage-bearing paths on the wrong clock is how this repo produced a false under-funding verdict before.
  bc.now = 1_790_000_000;

  const master = fixtureAddress('MASTER');
  const pool = await bc.treasury('aircost-pool');
  const user = await bc.treasury('aircost-user');

  const poolWallet = await deployWallet(bc, pool.address, master, AIRDROP_ATH_PER_CREDIT * 100n, '5');
  const userWalletAddress = contractAddress(0, await ATHWallet.init(0n, user.address, master));
  if (!freshRecipient) {
    await deployWallet(bc, user.address, master, 0n, '0.1');
  }

  const watched = [poolWallet.address, userWalletAddress, pool.address, user.address];
  const before = await Promise.all(watched.map((a) => balanceOf(bc, a)));

  const result = await poolWallet.send(pool.getSender(), { value: AIRDROP_ATHWALLET_LEG_GAS }, {
    $$type: 'ATHTransferRequest',
    query_id: 1n,
    amount: AIRDROP_ATH_PER_CREDIT,
    recipient: user.address,
    response_destination: pool.address,
  } as ATHTransferRequest);

  const after = await Promise.all(watched.map((a) => balanceOf(bc, a)));

  // (1) what the network burned
  const burned = result.transactions.reduce((sum, tx) => sum + tx.totalFees.coins, 0n);
  // (2) what left the watched set — includes anything parked in a freshly created account
  const netDrop = before.reduce((s, v) => s + v, 0n) - after.reduce((s, v) => s + v, 0n);

  const delivered = (await bc.openContract(new ATHWallet(userWalletAddress)).getGetWalletData()).balance;

  // What the recipient's wallet is left holding. A payout that creates a wallet too poor to pay its own rent
  // would be a slow silent failure, so the cold case must leave a funded account, not just a delivered balance.
  const recipientTon = await balanceOf(bc, userWalletAddress);
  return { burned, netDrop, delivered, recipientTon, txCount: result.transactions.length };
}

describe('AIRDROP DELIVERY COST — what paying one user 10 ATH really costs', () => {
  it('AIRCOST-01: measure the payout, both as fees burned and as value that never comes back', async () => {
    const warm = await measurePayout(false);
    const cold = await measurePayout(true);

    expect(warm.delivered, 'the warm payout must actually deliver 10 ATH').toBe(AIRDROP_ATH_PER_CREDIT);
    expect(cold.delivered, 'the cold payout must actually deliver 10 ATH').toBe(AIRDROP_ATH_PER_CREDIT);

    const gram = (n: bigint) => (Number(n) / 1e9).toFixed(6);
    // eslint-disable-next-line no-console
    console.log([
      '[AIRCOST-01] one 10-ATH payout through ATHWallet',
      `  attached by AirdropPool today: ${AIRDROP_ATHWALLET_LEG_GAS} (${gram(AIRDROP_ATHWALLET_LEG_GAS)} GRAM)`,
      '',
      `  EXISTING recipient wallet:  fees burned ${warm.burned} (${gram(warm.burned)} GRAM)   net drop ${warm.netDrop} (${gram(warm.netDrop)} GRAM)   recipient left holding ${warm.recipientTon}   txs ${warm.txCount}`,
      `  FRESH    recipient wallet:  fees burned ${cold.burned} (${gram(cold.burned)} GRAM)   net drop ${cold.netDrop} (${gram(cold.netDrop)} GRAM)   recipient left holding ${cold.recipientTon}   txs ${cold.txCount}`,
      '',
      `  vs the 0.01 GRAM protocol fee one capsule collects:`,
      `    existing recipient: ${(Number(warm.burned) / 1e7).toFixed(3)}x the fee (by burn)`,
      `    fresh recipient:    ${(Number(cold.burned) / 1e7).toFixed(3)}x the fee (by burn)`,
    ].join('\n'));

    // The claim under test: the 48M constant sum is NOT the cost. If this ever fails, the allowances stopped
    // being returned and the airdrop economics need re-deriving from scratch.
    expect(warm.burned, 'real burn must be far below the 48M attach requirement').toBeLessThan(10_000_000n);
  }, 600_000);

  it('AIRCOST-02: the FULL path through AirdropPool — and what the pool keeps forever', async () => {
    // AIRCOST-01 measured only the ATHWallet leg and treated value parked in the recipient's own wallet as
    // not-a-cost. Both were too kind. This measures the path a publish would really trigger — caller ->
    // AirdropPool -> pool's ATHWallet -> recipient — and separates the money by WHERE IT ENDS UP, because the
    // categories have completely different meanings:
    //   * burned            — gone, nobody's
    //   * kept by the pool  — GONE TOO. AirdropSweepResidualToTreasury moves `remaining_budget`, which is ATH.
    //                         There is no TON exit from AirdropPool at all, so every nanoton the caller
    //                         over-attaches is immured for the life of the contract.
    //   * in the recipient's own ATHWallet — the user's money, funding their own wallet's rent, not a loss
    // The decisive question for the wiring is whether this cost is per-CAPSULE or per-DELIVERY, so the same
    // measurement runs at credits_k = 1 and credits_k = 1000.
    const MANIFEST = 0x41495244524f505f504f4f4c5f4d414e49464553545f483031000000000001n;
    const TOTAL_POOL = 15_000_000_000_000_000n;

    async function measureThroughPool(creditsK: bigint) {
      const bc = await Blockchain.create();
      bc.now = 1_790_000_000;
      const deployer = await bc.treasury('aircost-pool-deployer');
      const distributor = await bc.treasury('aircost-distributor');
      const treasury = await bc.treasury('aircost-treasury');
      const user = await bc.treasury('aircost-recipient');
      const athMaster = fixtureAddress('POOL_MASTER');

      const pool = bc.openContract(await AirdropPool.fromInit(deployer.address, MANIFEST, 0n, false, 0n));
      await pool.send(deployer.getSender(), { value: toNano('1') }, null);

      // The pool's OWN ATHWallet, real, holding the whole budget — the leg that actually moves ATH.
      const poolWallet = await deployWallet(bc, pool.address, athMaster, TOTAL_POOL, '1');
      const dep = (body: any, v = '0.05') => pool.send(deployer.getSender(), { value: toNano(v) }, body);
      await dep({ $$type: 'AirdropBindAthMaster', ath_master_address: athMaster, pool_ath_wallet_address: poolWallet.address });
      await dep({ $$type: 'AirdropBindCreditIssuer', credit_issuer_address: distributor.address });
      await dep({ $$type: 'AirdropBindTreasury', treasury_address: treasury.address });
      await pool.send(bc.sender(poolWallet.address), { value: toNano('0.1') }, {
        $$type: 'AthTransferNotification', query_id: 1n, sender_key: 0n, amount: TOTAL_POOL, sender_wallet: treasury.address,
      } as any);
      await dep({ $$type: 'AirdropSealGenesis', deployment_manifest_hash: MANIFEST }, '0.1');

      const recipientWalletAddress = contractAddress(0, await ATHWallet.init(0n, user.address, athMaster));
      const poolBefore = await balanceOf(bc, pool.address);
      const callerBefore = await balanceOf(bc, distributor.address);

      const result = await pool.send(distributor.getSender(), { value: 60_000_000n }, {
        $$type: 'AirdropAccrue', purchase_id: 1n, buyer: user.address, credits_k: creditsK,
      } as any);

      const burned = result.transactions.reduce((s, tx) => s + tx.totalFees.coins, 0n);
      const delivered = (await bc.openContract(new ATHWallet(recipientWalletAddress)).getGetWalletData()).balance;
      return {
        creditsK,
        callerPaid: callerBefore - (await balanceOf(bc, distributor.address)),
        poolKept: (await balanceOf(bc, pool.address)) - poolBefore,
        recipientHolds: await balanceOf(bc, recipientWalletAddress),
        burned,
        delivered,
      };
    }

    const one = await measureThroughPool(1n);
    const many = await measureThroughPool(1000n);

    const gram = (n: bigint) => (Number(n) / 1e9).toFixed(6);
    const row = (r: any) => [
      `  credits_k=${String(r.creditsK).padStart(4)}`,
      `caller paid ${r.callerPaid.toString().padStart(11)} (${gram(r.callerPaid)})`,
      `burned ${r.burned.toString().padStart(9)}`,
      `pool KEEPS ${r.poolKept.toString().padStart(10)}`,
      `recipient wallet ${r.recipientHolds.toString().padStart(10)}`,
      `ATH delivered ${r.delivered}`,
    ].join('  ');

    // eslint-disable-next-line no-console
    console.log([
      '[AIRCOST-02] one delivery through AirdropPool',
      row(one),
      row(many),
      '',
      `  cost is per-DELIVERY, not per-credit: caller pays the same for 1 and for 1000 -> ${one.callerPaid === many.callerPaid}`,
      `  unrecoverable per delivery (burn + pool retention): ${one.burned + one.poolKept} = ${gram(one.burned + one.poolKept)} GRAM`,
      `  against the 10,000,000 fee one capsule collects: ${(Number(one.burned + one.poolKept) / 1e7).toFixed(2)}x`,
    ].join('\n'));

    expect(one.delivered, '1 credit delivers 10 ATH').toBe(AIRDROP_ATH_PER_CREDIT);
    expect(many.delivered, '1000 credits deliver 10000 ATH in ONE message').toBe(AIRDROP_ATH_PER_CREDIT * 1000n);
    // THE FINDING THE WIRING TURNS ON. If this ever becomes false, batching stops being the answer.
    expect(many.callerPaid, 'delivering 1000 credits costs the caller exactly what delivering 1 costs').toBe(one.callerPaid);
    expect(one.poolKept, 'the pool really does keep TON it can never release').toBeGreaterThan(0n);
  }, 600_000);
});
