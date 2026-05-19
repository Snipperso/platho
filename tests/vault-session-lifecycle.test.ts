import { describe, expect, it } from 'vitest';
import { contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import {
  Vault,
  DepositTon,
  WithdrawTon,
  SetSession,
  RevokeSession,
  TopUpMessageBudget,
} from '../build/Vault/Vault_Vault';

async function setup() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const user = await blockchain.treasury('vault-user');
  const athWallet = await blockchain.treasury('vault-ath-wallet');
  const recipient = await blockchain.treasury('recipient');
  const attacker = await blockchain.treasury('attacker');

  const capsuleHub = await blockchain.treasury('capsule-hub');
  const GENESIS_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
  const init = await Vault.init(athWallet.address, athWallet.address, capsuleHub.address, GENESIS_HASH, true, true, 0n);
  const address = contractAddress(0, init);

  await blockchain.setShardAccount(
    address,
    createShardAccount({
      address,
      code: init.code,
      data: init.data,
      balance: toNano('1'),
      workchain: address.workChain,
    }),
  );

  const vault = blockchain.openContract(new Vault(address, init));
  return { blockchain, vault, user, recipient, attacker };
}

const PUBKEY_1 = 0x111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000n;
const PUBKEY_2 = 0x22223333444455556666777788889999aaaabbbbccccddddeeeeffff00001111n;

async function deposit(vault: any, user: any, amount: bigint) {
  await vault.send(user.getSender(), { value: amount + toNano('0.1') }, {
    $$type: 'DepositTon',
    amount,
  } as DepositTon);
}

async function setSession(vault: any, user: any, pubkey: bigint, expiresAt: number, value = toNano('0.1')) {
  await vault.send(user.getSender(), { value }, {
    $$type: 'SetSession',
    session_pubkey: pubkey,
    expires_at: BigInt(expiresAt),
  } as SetSession);
}

describe('Vault milestone 1: balances + session lifecycle', () => {
  it('VAULT-HAPPY-01/02: first TON deposit creates UserState, later deposit does not create another user', async () => {
    const { vault, user } = await setup();
    const amount = toNano('1');

    await deposit(vault, user, amount);
    let state = await vault.getGetUser(user.address);
    expect(state.exists).toBe(true);
    expect(state.ton_balance).toBe(amount);
    expect((await vault.getGetGlobal()).user_count).toBe(1n);

    await deposit(vault, user, amount);
    state = await vault.getGetUser(user.address);
    expect(state.ton_balance).toBe(amount * 2n);
    expect((await vault.getGetGlobal()).user_count).toBe(1n);
  });

  it('VAULT-HAPPY-04/REJECT-02B: TON withdrawal debits balance and action failure cannot leave negative state', async () => {
    const { vault, user, recipient } = await setup();
    const amount = toNano('1');
    await deposit(vault, user, amount);

    const beforeRecipient = await recipient.getBalance();
    await vault.send(user.getSender(), { value: toNano('0.1') }, {
      $$type: 'WithdrawTon',
      amount: toNano('0.4'),
      recipient: recipient.address,
    } as WithdrawTon);

    const state = await vault.getGetUser(user.address);
    expect(state.ton_balance).toBe(toNano('0.6'));
    expect(await recipient.getBalance()).toBeGreaterThan(beforeRecipient);

    await vault.send(user.getSender(), { value: toNano('0.1') }, {
      $$type: 'WithdrawTon',
      amount: toNano('2'),
      recipient: recipient.address,
    } as WithdrawTon);

    expect((await vault.getGetUser(user.address)).ton_balance).toBe(toNano('0.6'));
  });

  it('VAULT-HAPPY-08: OP_SET_SESSION can create UserState and SessionState with fresh session_id', async () => {
    const { vault, user, blockchain } = await setup();
    const expires = (blockchain.now ?? 0) + 1000;

    await setSession(vault, user, PUBKEY_1, expires);

    const userState = await vault.getGetUser(user.address);
    const session = await vault.getGetSession(user.address);
    const global = await vault.getGetGlobal();

    expect(userState.exists).toBe(true);
    expect(userState.ton_balance).toBe(0n);
    expect(userState.message_budget_ton).toBe(0n);
    expect(userState.budget_epoch).toBe(0n);
    expect(session.exists).toBe(true);
    expect(session.active).toBe(true);
    expect(session.session_pubkey).toBe(PUBKEY_1);
    expect(session.session_id).not.toBe(0n);
    expect(session.nonce).toBe(0n);
    expect(global.user_count).toBe(1n);
    expect(global.session_count).toBe(1n);
  });

  it('VAULT-HAPPY-08A: OP_SET_SESSION after expired active session installs fresh expiry and keeps Message Budget allocated', async () => {
    const { vault, user, blockchain } = await setup();
    const now = blockchain.now ?? 0;
    await deposit(vault, user, toNano('1'));
    await setSession(vault, user, PUBKEY_1, now + 100);

    await vault.send(user.getSender(), { value: toNano('0.05') }, {
      $$type: 'TopUpMessageBudget',
      amount: toNano('0.4'),
    } as TopUpMessageBudget);

    blockchain.now = now + 200;
    await setSession(vault, user, PUBKEY_2, now + 1000);

    const state = await vault.getGetUser(user.address);
    const session = await vault.getGetSession(user.address);
    expect(state.ton_balance).toBe(toNano('0.6'));
    expect(state.message_budget_ton).toBe(toNano('0.4'));
    expect(state.budget_epoch).toBe(0n);
    expect(session.active).toBe(true);
    expect(session.session_pubkey).toBe(PUBKEY_2);
    expect(session.expires_at).toBe(BigInt(now + 1000));
  });

  it('VAULT-HAPPY-09/10: Message Budget top-up requires active session and revoke returns budget to ton_balance', async () => {
    const { vault, user, blockchain } = await setup();
    const now = blockchain.now ?? 0;
    await deposit(vault, user, toNano('2'));

    await vault.send(user.getSender(), { value: toNano('0.05') }, {
      $$type: 'TopUpMessageBudget',
      amount: toNano('0.5'),
    } as TopUpMessageBudget);
    expect((await vault.getGetUser(user.address)).message_budget_ton).toBe(0n);

    await setSession(vault, user, PUBKEY_1, now + 1000);
    await vault.send(user.getSender(), { value: toNano('0.05') }, {
      $$type: 'TopUpMessageBudget',
      amount: toNano('0.5'),
    } as TopUpMessageBudget);

    let state = await vault.getGetUser(user.address);
    expect(state.ton_balance).toBe(toNano('1.5'));
    expect(state.message_budget_ton).toBe(toNano('0.5'));

    await vault.send(user.getSender(), { value: toNano('0.05') }, {
      $$type: 'RevokeSession',
    } as RevokeSession);

    state = await vault.getGetUser(user.address);
    const session = await vault.getGetSession(user.address);
    expect(state.ton_balance).toBe(toNano('2'));
    expect(state.message_budget_ton).toBe(0n);
    expect(state.budget_epoch).toBe(1n);
    expect(session.active).toBe(false);
  });

  it('VAULT-HAPPY-09A/REJECT-06B: expired active session can revoke but cannot top up Message Budget', async () => {
    const { vault, user, blockchain } = await setup();
    const now = blockchain.now ?? 0;
    await deposit(vault, user, toNano('1'));
    await setSession(vault, user, PUBKEY_1, now + 100);

    blockchain.now = now + 200;
    await vault.send(user.getSender(), { value: toNano('0.05') }, {
      $$type: 'TopUpMessageBudget',
      amount: toNano('0.2'),
    } as TopUpMessageBudget);
    expect((await vault.getGetUser(user.address)).message_budget_ton).toBe(0n);

    await vault.send(user.getSender(), { value: toNano('0.05') }, {
      $$type: 'RevokeSession',
    } as RevokeSession);

    const state = await vault.getGetUser(user.address);
    const session = await vault.getGetSession(user.address);
    expect(state.ton_balance).toBe(toNano('1'));
    expect(state.budget_epoch).toBe(1n);
    expect(session.active).toBe(false);
  });

  it('NO-ADMIN: empty fallback is rejected and cannot mutate Vault accounting', async () => {
    const { vault, attacker } = await setup();
    await vault.send(attacker.getSender(), { value: toNano('0.1') }, null);
    expect((await vault.getGetGlobal()).user_count).toBe(0n);
  });
});
