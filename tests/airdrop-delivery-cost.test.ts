import { describe, expect, it } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { ATHWallet, ATHTransferRequest } from '../build/ATHWallet/ATHWallet_ATHWallet';

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
});
