import { describe, expect, it } from 'vitest';
import { contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { Vault, DepositTon } from '../build/Vault/Vault_Vault';
import { registerVaultSigningKeys, sendVaultWithdrawTonExternal } from './helpers/vault-external';

// clean-16 L2/#5 — storage-reserve floor + fail-loud withdrawals + solvency-health getter.
// The Vault must retain vaultStorageReserve() = user_count*10M + key_record_count*30M to fund its never-pruned
// state's rent. A withdrawal that would drain myBalance below that reserve is a safe no-op (funds preserved) rather
// than silently eating custodial balances. get_storage_health exposes the deficit for off-chain monitoring.

const GENESIS_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
const PER_USER = 10_000_000n;
const PER_KEYREC = 30_000_000n;

async function deploy(balance: bigint) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const athWallet = await blockchain.treasury('sr-ath');
  const capsuleHub = await blockchain.treasury('sr-hub');
  const init = await Vault.init(athWallet.address, athWallet.address, capsuleHub.address, GENESIS_HASH, true, true, 0n);
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({ address, code: init.code, data: init.data, balance, workchain: 0 }));
  return { blockchain, vault: blockchain.openContract(new Vault(address, init)), init };
}

// Force the Vault's on-chain balance to `balance`, keeping its CURRENT code+data (simulates rent erosion).
async function forceBalance(blockchain: Blockchain, addr: any, balance: bigint) {
  const sc = await blockchain.getContract(addr);
  const state: any = sc.account.account!.storage.state;
  await blockchain.setShardAccount(addr, createShardAccount({
    address: addr, code: state.state.code, data: state.state.data, balance, workchain: 0,
  }));
}

describe('Vault storage reserve floor + solvency health (clean-16 L2/#5)', () => {
  it('STORAGE-HEALTH-01: get_storage_health reports reserve = counts × per-entry endowment, and surplus', async () => {
    const { blockchain, vault } = await deploy(toNano('5'));
    const user = await blockchain.treasury('sr-user');
    await registerVaultSigningKeys(vault, user, 41);

    const h = await vault.getGetStorageHealth();
    expect(h.user_count).toBe(1n);
    expect(h.key_record_count).toBe(1n);
    expect(h.storage_reserve).toBe(PER_USER + PER_KEYREC); // 40M
    expect(h.balance).toBeGreaterThan(0n);
    expect(h.surplus).toBe(h.balance - h.storage_reserve);
    expect(h.surplus).toBeGreaterThan(0n); // healthy after registration (endowment funds the reserve)
  });

  it('RESERVE-FLOOR-01: a withdrawal that would breach the storage reserve is a safe no-op (custody preserved)', async () => {
    const { blockchain, vault } = await deploy(toNano('5'));
    const user = await blockchain.treasury('sr-user');
    const recipient = await blockchain.treasury('sr-recipient');
    await registerVaultSigningKeys(vault, user, 41);
    await vault.send(user.getSender(), { value: toNano('3') }, { $$type: 'DepositTon', amount: toNano('2') } as DepositTon);

    const balBefore = (await vault.getGetUser(user.address)).ton_balance;
    expect(balBefore).toBe(toNano('2'));

    // Simulate accrued rent eroding the Vault balance to just BELOW reserve+withdrawal (35M < 40M reserve).
    await forceBalance(blockchain, vault.address, 35_000_000n);
    const health = await vault.getGetStorageHealth();
    expect(health.surplus).toBeLessThan(0n); // under-reserved → monitor would flag it

    // Attempt to withdraw: myBalance (35M) < amount + reserve(40M) → fail-loud no-op.
    await sendVaultWithdrawTonExternal(blockchain, vault, user, await recipientKeyOf(blockchain, vault, user), GENESIS_HASH, toNano('0.1'), recipient.address);

    // Custody preserved: the withdrawal AMOUNT (0.1 TON) was NOT debited — the floor no-op'd the transfer. Only the
    // fixed processing exec-reserve (2M, taken at commit before the action) is consumed, NOT the 0.1 TON amount.
    const WITHDRAW_TON_EXEC_RESERVE = 2_000_000n;
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(balBefore - WITHDRAW_TON_EXEC_RESERVE);
  });
});

// The register helper returns the auth keypair; re-derive it deterministically for the withdraw signature.
async function recipientKeyOf(_bc: Blockchain, _vault: any, _user: any) {
  const { keyPairFromSeed } = await import('@ton/crypto');
  return keyPairFromSeed(Buffer.alloc(32, 41 + 64));
}
