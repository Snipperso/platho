import { describe, expect, it } from 'vitest';
import { contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import {
  Vault,
  DepositTon,
  CreateReceiveIntent,
  ClaimReceiveIntent,
  CancelReceiveIntent,
} from '../build/Vault/Vault_Vault';

async function setup() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const sender = await blockchain.treasury('receive-sender');
  const recipient = await blockchain.treasury('receive-recipient');
  const attacker = await blockchain.treasury('receive-attacker');
  const athWallet = await blockchain.treasury('vault-ath-wallet');

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
  return { blockchain, vault, sender, recipient, attacker };
}

async function deposit(vault: any, user: any, amount: bigint) {
  await vault.send(user.getSender(), { value: amount + toNano('0.1') }, {
    $$type: 'DepositTon',
    amount,
  } as DepositTon);
}

async function computeIntent(vault: any, sender: any, recipient: any, amount: bigint, clientNonce = 1n, secret = 0x1234n) {
  const intentId = await vault.getGetReceiveIntentId(sender.address, recipient.address, 1n, amount, clientNonce);
  const commitment = await vault.getGetReceiveIntentCommitment(intentId, recipient.address, secret);
  return { intentId, commitment, clientNonce, secret };
}

async function createTonIntent(vault: any, sender: any, recipient: any, amount: bigint, expiresAt: number, clientNonce = 1n, secret = 0x1234n) {
  const { intentId, commitment } = await computeIntent(vault, sender, recipient, amount, clientNonce, secret);
  await vault.send(sender.getSender(), { value: toNano('0.1') }, {
    $$type: 'CreateReceiveIntent',
    asset: 1n,
    amount,
    recipient_wallet: recipient.address,
    commitment,
    expires_at: BigInt(expiresAt),
    client_nonce: clientNonce,
  } as CreateReceiveIntent);
  return { intentId, commitment, secret };
}

describe('Vault milestone 3: ReceiveIntent', () => {
  it('VAULT-HAPPY-14/15: create locks sender TON and claim credits recipient UserState', async () => {
    const { vault, sender, recipient, blockchain } = await setup();
    await deposit(vault, sender, toNano('2'));

    const amount = toNano('0.7');
    const { intentId, secret } = await createTonIntent(vault, sender, recipient, amount, (blockchain.now ?? 0) + 1000);

    let senderState = await vault.getGetUser(sender.address);
    let recipientState = await vault.getGetUser(recipient.address);
    let intent = await vault.getGetReceiveIntent(intentId);
    expect(senderState.ton_balance).toBe(toNano('1.3'));
    expect(recipientState.exists).toBe(false);
    expect(intent.exists).toBe(true);
    expect(intent.sender_wallet.toString()).toBe(sender.address.toString());
    expect(intent.recipient_wallet.toString()).toBe(recipient.address.toString());
    expect(intent.amount).toBe(amount);
    expect((await vault.getGetGlobal()).receive_intent_count).toBe(1n);

    await vault.send(recipient.getSender(), { value: toNano('0.1') }, {
      $$type: 'ClaimReceiveIntent',
      intent_id: intentId,
      secret32: secret,
    } as ClaimReceiveIntent);

    recipientState = await vault.getGetUser(recipient.address);
    intent = await vault.getGetReceiveIntent(intentId);
    expect(recipientState.exists).toBe(true);
    expect(recipientState.ton_balance).toBe(amount);
    expect(intent.exists).toBe(false);
    expect((await vault.getGetGlobal()).receive_intent_count).toBe(0n);
  });

  it('VAULT-HAPPY-16: cancel returns locked TON to sender and deletes intent', async () => {
    const { vault, sender, recipient, blockchain } = await setup();
    await deposit(vault, sender, toNano('1'));

    const amount = toNano('0.4');
    const { intentId } = await createTonIntent(vault, sender, recipient, amount, (blockchain.now ?? 0) + 1000);
    expect((await vault.getGetUser(sender.address)).ton_balance).toBe(toNano('0.6'));

    await vault.send(sender.getSender(), { value: toNano('0.05') }, {
      $$type: 'CancelReceiveIntent',
      intent_id: intentId,
    } as CancelReceiveIntent);

    expect((await vault.getGetUser(sender.address)).ton_balance).toBe(toNano('1'));
    expect((await vault.getGetReceiveIntent(intentId)).exists).toBe(false);
    expect((await vault.getGetGlobal()).receive_intent_count).toBe(0n);
  });

  it('VAULT-REJECT: wrong recipient or wrong secret cannot claim', async () => {
    const { vault, sender, recipient, attacker, blockchain } = await setup();
    await deposit(vault, sender, toNano('1'));

    const amount = toNano('0.3');
    const { intentId } = await createTonIntent(vault, sender, recipient, amount, (blockchain.now ?? 0) + 1000, 2n, 0x9999n);

    await vault.send(attacker.getSender(), { value: toNano('0.1') }, {
      $$type: 'ClaimReceiveIntent',
      intent_id: intentId,
      secret32: 0x9999n,
    } as ClaimReceiveIntent);
    expect((await vault.getGetReceiveIntent(intentId)).exists).toBe(true);
    expect((await vault.getGetUser(attacker.address)).exists).toBe(false);

    await vault.send(recipient.getSender(), { value: toNano('0.1') }, {
      $$type: 'ClaimReceiveIntent',
      intent_id: intentId,
      secret32: 0x8888n,
    } as ClaimReceiveIntent);
    expect((await vault.getGetReceiveIntent(intentId)).exists).toBe(true);
    expect((await vault.getGetUser(recipient.address)).exists).toBe(false);
  });

  it('VAULT-REJECT: duplicate intent_id and insufficient sender balance are rejected without mutation', async () => {
    const { vault, sender, recipient, blockchain } = await setup();
    await deposit(vault, sender, toNano('1'));

    const amount = toNano('0.2');
    const expires = (blockchain.now ?? 0) + 1000;
    const { intentId, commitment } = await computeIntent(vault, sender, recipient, amount, 7n, 0x7777n);

    await vault.send(sender.getSender(), { value: toNano('0.1') }, {
      $$type: 'CreateReceiveIntent',
      asset: 1n,
      amount,
      recipient_wallet: recipient.address,
      commitment,
      expires_at: BigInt(expires),
      client_nonce: 7n,
    } as CreateReceiveIntent);

    await vault.send(sender.getSender(), { value: toNano('0.1') }, {
      $$type: 'CreateReceiveIntent',
      asset: 1n,
      amount,
      recipient_wallet: recipient.address,
      commitment,
      expires_at: BigInt(expires),
      client_nonce: 7n,
    } as CreateReceiveIntent);

    expect((await vault.getGetGlobal()).receive_intent_count).toBe(1n);
    expect((await vault.getGetReceiveIntent(intentId)).exists).toBe(true);
    expect((await vault.getGetUser(sender.address)).ton_balance).toBe(toNano('0.8'));

    const tooMuch = toNano('2');
    const bad = await computeIntent(vault, sender, recipient, tooMuch, 8n, 0x8888n);
    await vault.send(sender.getSender(), { value: toNano('0.1') }, {
      $$type: 'CreateReceiveIntent',
      asset: 1n,
      amount: tooMuch,
      recipient_wallet: recipient.address,
      commitment: bad.commitment,
      expires_at: BigInt(expires),
      client_nonce: 8n,
    } as CreateReceiveIntent);

    expect((await vault.getGetGlobal()).receive_intent_count).toBe(1n);
    expect((await vault.getGetUser(sender.address)).ton_balance).toBe(toNano('0.8'));
  });

  it('VAULT-REJECT: expired intent cannot be claimed but sender can cancel after expiry', async () => {
    const { vault, sender, recipient, blockchain } = await setup();
    const now = blockchain.now ?? 0;
    await deposit(vault, sender, toNano('1'));

    const amount = toNano('0.3');
    const { intentId, secret } = await createTonIntent(vault, sender, recipient, amount, now + 100, 9n, 0x9999n);
    blockchain.now = now + 200;

    await vault.send(recipient.getSender(), { value: toNano('0.1') }, {
      $$type: 'ClaimReceiveIntent',
      intent_id: intentId,
      secret32: secret,
    } as ClaimReceiveIntent);
    expect((await vault.getGetReceiveIntent(intentId)).exists).toBe(true);
    expect((await vault.getGetUser(recipient.address)).exists).toBe(false);

    await vault.send(sender.getSender(), { value: toNano('0.1') }, {
      $$type: 'CancelReceiveIntent',
      intent_id: intentId,
    } as CancelReceiveIntent);
    expect((await vault.getGetReceiveIntent(intentId)).exists).toBe(false);
    expect((await vault.getGetUser(sender.address)).ton_balance).toBe(toNano('1'));
  });

  it('VAULT-REJECT: session-like/non-sender caller cannot create or cancel with someone else balance', async () => {
    const { vault, sender, recipient, attacker, blockchain } = await setup();
    await deposit(vault, sender, toNano('1'));

    const amount = toNano('0.2');
    const expires = (blockchain.now ?? 0) + 1000;
    const attackerIntent = await computeIntent(vault, attacker, recipient, amount, 10n, 0x10n);
    await vault.send(attacker.getSender(), { value: toNano('0.1') }, {
      $$type: 'CreateReceiveIntent',
      asset: 1n,
      amount,
      recipient_wallet: recipient.address,
      commitment: attackerIntent.commitment,
      expires_at: BigInt(expires),
      client_nonce: 10n,
    } as CreateReceiveIntent);
    expect((await vault.getGetGlobal()).receive_intent_count).toBe(0n);

    const { intentId } = await createTonIntent(vault, sender, recipient, amount, expires, 11n, 0x11n);
    await vault.send(attacker.getSender(), { value: toNano('0.1') }, {
      $$type: 'CancelReceiveIntent',
      intent_id: intentId,
    } as CancelReceiveIntent);
    expect((await vault.getGetReceiveIntent(intentId)).exists).toBe(true);
    expect((await vault.getGetUser(sender.address)).ton_balance).toBe(toNano('0.8'));
  });
});
