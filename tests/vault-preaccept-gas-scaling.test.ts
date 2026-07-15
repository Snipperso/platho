import { describe, it } from 'vitest';
import { contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { Vault, DepositTon } from '../build/Vault/Vault_Vault';
import { registerVaultSigningKeys, sendVaultWithdrawTonExternal } from './helpers/vault-external';

// clean-16 L1 / timebomb #1 — EMPIRICAL harness.
//
// The withdraw externals validate `users.get(owner)` + `checkSignature` + the full binding parse INSIDE the
// ~10k pre-accept gas credit (BEFORE acceptMessage). `users.get` traverses the users patricia-trie, whose depth
// grows ~log2(N). If pre-accept work exceeds the credit, the withdraw external OOGs BEFORE accept and the user
// can NEVER withdraw their funds — a permanent scale-triggered custody lock. This harness measures the actual
// withdraw compute gas as the users-trie grows, to characterise the class and the growth rate (the exact OOG
// threshold needs a much deeper synthetic trie against the live code.boc — full G8 work).
//
// NOTE: total compute gas here = pre-accept (users.get + sig + parse) + post-accept (users.set + send + receipt);
// both the get and the set traverse the trie, so the marginal gas per doubling reflects ~2 trie traversals. The
// pre-accept portion (one get) is what races the 10k credit.

const GENESIS_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;

async function deployVault() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const athWallet = await blockchain.treasury('pa-ath');
  const capsuleHub = await blockchain.treasury('pa-hub');
  const init = await Vault.init(athWallet.address, athWallet.address, capsuleHub.address, GENESIS_HASH, true, true, 0n);
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address, code: init.code, data: init.data, balance: toNano('100000'), workchain: 0,
  }));
  return { blockchain, vault: blockchain.openContract(new Vault(address, init)) };
}

describe('Vault pre-accept gas scaling (#1 timebomb harness)', () => {
  it('PREACCEPT-GAS-01: withdraw compute gas grows with users-trie size', async () => {
    const points = [1, 16, 64, 256];
    const rows: Array<{ N: number; gas: number; success: boolean; exit: number }> = [];

    for (const N of points) {
      const { blockchain, vault } = await deployVault();
      const target = await blockchain.treasury('pa-target');
      const targetKey = await registerVaultSigningKeys(vault, target, 41, 1n);
      await vault.send(target.getSender(), { value: toNano('5') }, { $$type: 'DepositTon', amount: toNano('4') } as DepositTon);

      // Grow the users-trie with N-1 additional distinct users (distinct treasury addresses).
      for (let i = 1; i < N; i += 1) {
        const u = await blockchain.treasury('pa-fill-' + i);
        await registerVaultSigningKeys(vault, u, i % 200, 1n);
      }

      const recipient = await blockchain.treasury('pa-recipient');
      let gas = -1; let success = false; let exit = 0;
      try {
        const res = await sendVaultWithdrawTonExternal(
          blockchain, vault, target, targetKey, GENESIS_HASH, toNano('0.1'), recipient.address,
        );
        const tx: any = res.transactions.find(
          (t: any) => t.inMessage?.info?.dest?.toString() === vault.address.toString(),
        );
        const cp: any = tx ? tx.description.computePhase : null;
        if (cp && cp.type === 'vm') { gas = Number(cp.gasUsed); success = !!cp.success; exit = Number(cp.exitCode); }
      } catch (e: any) {
        exit = -14; // treat a thrown/aborted external as the pre-accept OOG we are hunting
      }
      rows.push({ N, gas, success, exit });
    }

    const out = rows.map(r => `  N=${String(r.N).padStart(5)}  gas=${String(r.gas).padStart(7)}  success=${r.success}  exit=${r.exit}`).join('\n');
    let deltas = '';
    for (let i = 1; i < rows.length; i += 1) {
      const dGas = rows[i].gas - rows[i - 1].gas;
      const dLog = Math.log2(rows[i].N) - Math.log2(rows[i - 1].N);
      deltas += `  ${rows[i - 1].N}->${rows[i].N}: +${dGas} gas over ${dLog.toFixed(1)} trie levels (~${(dGas / Math.max(dLog, 0.001)).toFixed(0)}/level)\n`;
    }
    // eslint-disable-next-line no-console
    console.log(`\n[PREACCEPT-GAS-01] withdraw compute gas vs users-trie size:\n${out}\n\nmarginal:\n${deltas}`);
  }, 240000);
});
