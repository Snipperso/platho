import { describe, expect, it } from 'vitest';
import { contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { Vault, DepositTon } from '../build/Vault/Vault_Vault';
import { registerVaultSigningKeys } from './helpers/vault-external';

// clean-16 L2/#4 — permissionless dormant-account eviction. A ZERO-balance account inactive for
// VAULT_DORMANT_EVICTION_SECONDS (2 years) may be reclaimed by anyone, bounding the never-pruned users/key_records
// state. Custody is safe: any ton/ath balance blocks eviction. A returning user re-registers (keys seed-derived).

const GENESIS_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
const T0 = 1_700_000_000;
const TWO_YEARS = 63072000;

async function deploy() {
  const blockchain = await Blockchain.create();
  blockchain.now = T0;
  const athWallet = await blockchain.treasury('ev-ath');
  const capsuleHub = await blockchain.treasury('ev-hub');
  const init = await Vault.init(athWallet.address, athWallet.address, capsuleHub.address, GENESIS_HASH, true, true, 0n);
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address, code: init.code, data: init.data, balance: toNano('10'), workchain: 0,
  }));
  return { blockchain, vault: blockchain.openContract(new Vault(address, init)) };
}

function txExit(res: any, vault: any): number {
  const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === vault.address.toString());
  const cp: any = tx?.description?.computePhase;
  return cp && cp.type === 'vm' ? Number(cp.exitCode) : 0;
}

async function evict(blockchain: Blockchain, vault: any, owner: any) {
  const evictor = await blockchain.treasury('ev-caller');
  return vault.send(evictor.getSender(), { value: toNano('0.05') }, { $$type: 'EvictDormantUser', owner_wallet: owner.address } as any);
}

describe('Vault dormant-account eviction (clean-16 L2/#4)', () => {
  it('EVICT-01: a zero-balance account inactive > 2 years is permissionlessly reclaimed', async () => {
    const { blockchain, vault } = await deploy();
    const user = await blockchain.treasury('ev-user');
    await registerVaultSigningKeys(vault, user, 41);

    expect((await vault.getGetUser(user.address)).exists).toBe(true);
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(0n);
    expect((await vault.getGetUser(user.address)).last_active).toBe(BigInt(T0));
    expect((await vault.getGetGlobal()).user_count).toBe(1n);
    expect((await vault.getGetGlobal()).key_record_count).toBe(1n);

    blockchain.now = T0 + TWO_YEARS + 60;
    await evict(blockchain, vault, user);

    // Account + its key record are gone; counters decremented.
    expect((await vault.getGetUser(user.address)).exists).toBe(false);
    expect((await vault.getGetGlobal()).user_count).toBe(0n);
    expect((await vault.getGetGlobal()).key_record_count).toBe(0n);
  });

  it('EVICT-02: an account holding TON balance is NOT evictable (custody-safe, 16901)', async () => {
    const { blockchain, vault } = await deploy();
    const user = await blockchain.treasury('ev-user');
    await registerVaultSigningKeys(vault, user, 41);
    await vault.send(user.getSender(), { value: toNano('2') }, { $$type: 'DepositTon', amount: toNano('1') } as DepositTon);

    blockchain.now = T0 + TWO_YEARS + 60; // dormant by time, but holds balance
    const res = await evict(blockchain, vault, user);
    expect(txExit(res, vault)).toBe(16901);
    expect((await vault.getGetUser(user.address)).exists).toBe(true);
  });

  it('EVICT-03: a recently-active account is NOT evictable (16903)', async () => {
    const { blockchain, vault } = await deploy();
    const user = await blockchain.treasury('ev-user');
    await registerVaultSigningKeys(vault, user, 41);

    blockchain.now = T0 + TWO_YEARS - 100; // just shy of the dormancy window
    const res = await evict(blockchain, vault, user);
    expect(txExit(res, vault)).toBe(16903);
    expect((await vault.getGetUser(user.address)).exists).toBe(true);
  });

  it('EVICT-04: a non-existent account cannot be evicted (16900)', async () => {
    const { blockchain, vault } = await deploy();
    const ghost = await blockchain.treasury('ev-ghost');
    blockchain.now = T0 + TWO_YEARS + 60;
    const res = await evict(blockchain, vault, ghost);
    expect(txExit(res, vault)).toBe(16900);
  });

  it('EVICT-05: a deposit refreshes the dormancy clock (activity keeps an account alive)', async () => {
    const { blockchain, vault } = await deploy();
    const user = await blockchain.treasury('ev-user');
    await registerVaultSigningKeys(vault, user, 41);
    // near the edge, the user deposits then fully withdraws — activity bumps last_active
    blockchain.now = T0 + TWO_YEARS - 100;
    await vault.send(user.getSender(), { value: toNano('2') }, { $$type: 'DepositTon', amount: toNano('1') } as DepositTon);
    expect((await vault.getGetUser(user.address)).last_active).toBe(BigInt(T0 + TWO_YEARS - 100));

    // advance another almost-2-years from the deposit — still holds balance, still safe
    blockchain.now = T0 + TWO_YEARS - 100 + TWO_YEARS - 100;
    const res = await evict(blockchain, vault, user);
    // blocked by BOTH the fresh clock AND the balance; the balance gate (16901) fires first
    expect(txExit(res, vault)).toBe(16901);
  });
});
