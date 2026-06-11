import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, external, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { keyPairFromSeed, sign } from '@ton/crypto';
import {
  Vault,
  AthTransferNotification,
  DepositTon,
  RegisterMessagingKeys,
} from '../build/Vault/Vault_Vault';
import { hybridMessagingKeyFields } from './helpers/vault-hybrid-key';

const ASSET_TON = 1n;
const ASSET_ATH = 2n;
const VAULT_RECEIVE_INTENT_SIGNING_DOMAIN = 0x56524331n;
const VAULT_RECEIVE_INTENT_ACTION_CREATE = 1n;
const VAULT_RECEIVE_INTENT_ACTION_CLAIM = 2n;
const VAULT_RECEIVE_INTENT_ACTION_CANCEL = 3n;
const OP_CREATE_RECEIVE_INTENT = 0x7E1F5035n;
const OP_CLAIM_RECEIVE_INTENT = 0x7E1F5036n;
const OP_CANCEL_RECEIVE_INTENT = 0x7E1F5037n;
const RECEIVE_INTENT_CREATE_RESERVE = 9_000_000n;

function addressHashValue(address: Address): bigint {
  return BigInt(`0x${address.hash.toString('hex')}`);
}

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
  return { blockchain, vault, sender, recipient, attacker, athWallet };
}

async function deployExtraVault(blockchain: Blockchain, label: string) {
  const capsuleHub = await blockchain.treasury(`${label}-capsule-hub`);
  const athWallet = await blockchain.treasury(`${label}-ath-wallet`);
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

  return blockchain.openContract(new Vault(address, init));
}

async function deposit(vault: any, user: any, amount: bigint) {
  await vault.send(user.getSender(), { value: amount + toNano('0.1') }, {
    $$type: 'DepositTon',
    amount,
  } as DepositTon);
}

async function contractBalance(blockchain: Blockchain, address: Address): Promise<bigint> {
  return (await blockchain.getContract(address)).balance;
}

async function registerKeys(vault: any, user: any, seedByte: number) {
  const messagingKeyPair = keyPairFromSeed(Buffer.alloc(32, seedByte));
  const authKeyPair = keyPairFromSeed(Buffer.alloc(32, seedByte + 64));
  await vault.send(user.getSender(), { value: toNano('0.05') }, {
    $$type: 'RegisterMessagingKeys',
    ...hybridMessagingKeyFields(
      1n,
      BigInt('0x' + messagingKeyPair.publicKey.toString('hex')),
      BigInt('0x' + authKeyPair.publicKey.toString('hex')),
    ),
  } as RegisterMessagingKeys);
  return authKeyPair;
}

function signedReceiveIntentBody(
  type: 'CreateReceiveIntent' | 'ClaimReceiveIntent' | 'CancelReceiveIntent',
  owner: Address,
  nonce: bigint,
  secretKey: Buffer,
  vaultAddress: Address,
  fields: any,
  outerOwner: Address = owner,
) {
  const action = type === 'CreateReceiveIntent'
    ? VAULT_RECEIVE_INTENT_ACTION_CREATE
    : type === 'ClaimReceiveIntent'
      ? VAULT_RECEIVE_INTENT_ACTION_CLAIM
      : VAULT_RECEIVE_INTENT_ACTION_CANCEL;
  const op = type === 'CreateReceiveIntent'
    ? OP_CREATE_RECEIVE_INTENT
    : type === 'ClaimReceiveIntent'
      ? OP_CLAIM_RECEIVE_INTENT
      : OP_CANCEL_RECEIVE_INTENT;
  const actionPayload = beginCell();
  if (type === 'CreateReceiveIntent') {
    actionPayload
      .storeUint(fields.asset, 8)
      .storeUint(fields.amount, 128)
      .storeAddress(fields.recipient_wallet)
      .storeUint(fields.commitment, 256);
  } else if (type === 'ClaimReceiveIntent') {
    actionPayload
      .storeUint(fields.intent_id, 256)
      .storeUint(fields.secret32, 256);
  } else {
    actionPayload.storeUint(fields.intent_id, 256);
  }
  const signedPayload = beginCell()
    .storeUint(VAULT_RECEIVE_INTENT_SIGNING_DOMAIN, 32)
    .storeUint(0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn, 256)
    .storeUint(addressHashValue(vaultAddress), 256)
    .storeUint(addressHashValue(owner), 256)
    .storeUint(action, 8)
    .storeUint(nonce, 64)
    .storeRef(actionPayload.endCell())
    .endCell();
  return beginCell()
    .storeUint(op, 32)
    .storeAddress(outerOwner)
    .storeBuffer(sign(signedPayload.hash(), secretKey))
    .storeRef(signedPayload)
    .endCell();
}

async function sendReceiveIntentExternal(blockchain: Blockchain, vault: any, type: 'CreateReceiveIntent' | 'ClaimReceiveIntent' | 'CancelReceiveIntent', owner: any, keyPair: any, fields: any) {
  const userState = await vault.getGetUser(owner.address);
  return blockchain.sendMessage(external({
    to: vault.address,
    body: signedReceiveIntentBody(type, owner.address, userState.publish_nonce, keyPair.secretKey, vault.address, fields),
  }));
}

function expectSuccessfulExternalVaultCompute(result: any) {
  const tx = result.transactions[0];
  expect(tx.description.type).toBe('generic');
  if (tx.description.type === 'generic') {
    expect(tx.description.computePhase.type).toBe('vm');
    if (tx.description.computePhase.type === 'vm') {
      expect(tx.description.computePhase.exitCode).toBe(0);
      expect(tx.description.computePhase.success).toBe(true);
    }
  }
}

async function computeIntent(vault: any, sender: any, recipient: any, amount: bigint, clientNonce: bigint, secret = 0x1234n) {
  const intentId = await vault.getGetReceiveIntentId(sender.address, recipient.address, ASSET_TON, amount, clientNonce);
  const commitment = await vault.getGetReceiveIntentCommitment(intentId, recipient.address, secret);
  return { intentId, commitment, clientNonce, secret };
}

async function createTonIntent(blockchain: Blockchain, vault: any, sender: any, recipient: any, senderKeyPair: any, amount: bigint, secret = 0x1234n) {
  const clientNonce = (await vault.getGetUser(sender.address)).publish_nonce;
  const { intentId, commitment } = await computeIntent(vault, sender, recipient, amount, clientNonce, secret);
  await sendReceiveIntentExternal(blockchain, vault, 'CreateReceiveIntent', sender, senderKeyPair, {
    asset: ASSET_TON,
    amount,
    recipient_wallet: recipient.address,
    commitment,
  });
  return { intentId, commitment, secret };
}

async function depositAth(vault: any, officialAthWallet: any, user: any, amount: bigint, queryId = 100n) {
  await vault.send(officialAthWallet.getSender(), { value: toNano('0.1') }, {
    $$type: 'AthTransferNotification',
    query_id: queryId,
    amount,
    sender_key: 0n,
    sender_wallet: user.address,
  } as AthTransferNotification);
}

describe('Vault milestone 3: ReceiveIntent', () => {
  it('VLT-01: receive-intent signed externals are bound to the target Vault hash', async () => {
    const { vault, sender, recipient, blockchain } = await setup();
    const otherVault = await deployExtraVault(blockchain, 'receive-intent-other');
    const senderKey = await registerKeys(vault, sender, 1);
    const recipientKey = await registerKeys(vault, recipient, 2);
    await registerKeys(otherVault, sender, 1);
    await registerKeys(otherVault, recipient, 2);
    await deposit(otherVault, sender, toNano('2'));

    const amount = toNano('0.25');
    const otherCreateNonce = (await otherVault.getGetUser(sender.address)).publish_nonce;
    const otherCreate = await computeIntent(otherVault, sender, recipient, amount, otherCreateNonce, 0x1111n);
    const createBodyForFirstVault = signedReceiveIntentBody('CreateReceiveIntent', sender.address, otherCreateNonce, senderKey.secretKey, vault.address, {
      asset: ASSET_TON,
      amount,
      recipient_wallet: recipient.address,
      commitment: otherCreate.commitment,
    });
    const otherBeforeCreate = await otherVault.getGetUser(sender.address);
    const rawBeforeCreate = await contractBalance(blockchain, otherVault.address);

    await expect(blockchain.sendMessage(external({
      to: otherVault.address,
      body: createBodyForFirstVault,
    }))).rejects.toThrow(/16225/);

    const otherAfterCreate = await otherVault.getGetUser(sender.address);
    expect(otherAfterCreate.publish_nonce).toBe(otherBeforeCreate.publish_nonce);
    expect(otherAfterCreate.ton_balance).toBe(otherBeforeCreate.ton_balance);
    expect(await contractBalance(blockchain, otherVault.address)).toBe(rawBeforeCreate);
    expect((await otherVault.getGetGlobal()).receive_intent_count).toBe(0n);

    const { intentId, secret } = await createTonIntent(blockchain, otherVault, sender, recipient, senderKey, amount, 0x2222n);
    const recipientBeforeClaim = await otherVault.getGetUser(recipient.address);
    const claimBodyForFirstVault = signedReceiveIntentBody('ClaimReceiveIntent', recipient.address, recipientBeforeClaim.publish_nonce, recipientKey.secretKey, vault.address, {
      intent_id: intentId,
      secret32: secret,
    });
    const rawBeforeClaim = await contractBalance(blockchain, otherVault.address);

    await expect(blockchain.sendMessage(external({
      to: otherVault.address,
      body: claimBodyForFirstVault,
    }))).rejects.toThrow(/16244/);

    const recipientAfterClaim = await otherVault.getGetUser(recipient.address);
    expect(recipientAfterClaim.publish_nonce).toBe(recipientBeforeClaim.publish_nonce);
    expect(recipientAfterClaim.ton_balance).toBe(recipientBeforeClaim.ton_balance);
    expect((await otherVault.getGetReceiveIntent(intentId)).exists).toBe(true);
    expect(await contractBalance(blockchain, otherVault.address)).toBe(rawBeforeClaim);

    const senderBeforeCancel = await otherVault.getGetUser(sender.address);
    const cancelBodyForFirstVault = signedReceiveIntentBody('CancelReceiveIntent', sender.address, senderBeforeCancel.publish_nonce, senderKey.secretKey, vault.address, {
      intent_id: intentId,
    });
    const rawBeforeCancel = await contractBalance(blockchain, otherVault.address);

    await expect(blockchain.sendMessage(external({
      to: otherVault.address,
      body: cancelBodyForFirstVault,
    }))).rejects.toThrow(/16257/);

    const senderAfterCancel = await otherVault.getGetUser(sender.address);
    expect(senderAfterCancel.publish_nonce).toBe(senderBeforeCancel.publish_nonce);
    expect(senderAfterCancel.ton_balance).toBe(senderBeforeCancel.ton_balance);
    expect((await otherVault.getGetReceiveIntent(intentId)).exists).toBe(true);
    expect(await contractBalance(blockchain, otherVault.address)).toBe(rawBeforeCancel);
  });

  it('VAULT-HAPPY-14/15: create locks sender TON and claim credits recipient UserState', async () => {
    const { vault, sender, recipient, blockchain } = await setup();
    const senderKey = await registerKeys(vault, sender, 1);
    const recipientKey = await registerKeys(vault, recipient, 2);
    await deposit(vault, sender, toNano('2'));

    const amount = toNano('0.7');
    const { intentId, secret } = await createTonIntent(blockchain, vault, sender, recipient, senderKey, amount);

    let senderState = await vault.getGetUser(sender.address);
    let recipientState = await vault.getGetUser(recipient.address);
    let intent = await vault.getGetReceiveIntent(intentId);
    expect(senderState.ton_balance).toBe(toNano('1.3') - RECEIVE_INTENT_CREATE_RESERVE);
    expect(recipientState.exists).toBe(true);
    expect(recipientState.ton_balance).toBe(0n);
    expect(intent.exists).toBe(true);
    expect(intent.sender_wallet.toString()).toBe(sender.address.toString());
    expect(intent.recipient_wallet.toString()).toBe(recipient.address.toString());
    expect(intent.amount).toBe(amount);
    expect(intent.settlement_reserve_ton).toBe(2_000_000n);
    expect((await vault.getGetGlobal()).receive_intent_count).toBe(1n);

    await sendReceiveIntentExternal(blockchain, vault, 'ClaimReceiveIntent', recipient, recipientKey, {
      intent_id: intentId,
      secret32: secret,
    });

    recipientState = await vault.getGetUser(recipient.address);
    intent = await vault.getGetReceiveIntent(intentId);
    expect(recipientState.exists).toBe(true);
    expect(recipientState.ton_balance).toBe(amount);
    expect(intent.exists).toBe(false);
    expect((await vault.getGetGlobal()).receive_intent_count).toBe(0n);
  });

  it('VAULT-HAPPY-15B: claim remains accepted with a populated receive-intent dictionary', async () => {
    const { vault, sender, recipient, blockchain } = await setup();
    const senderKey = await registerKeys(vault, sender, 31);
    const recipientKey = await registerKeys(vault, recipient, 32);
    await deposit(vault, sender, toNano('2'));

    const amount = 1_000_000n;
    const intents: Array<{ intentId: bigint; secret: bigint }> = [];
    for (let i = 0; i < 48; i += 1) {
      intents.push(await createTonIntent(
        blockchain,
        vault,
        sender,
        recipient,
        senderKey,
        amount,
        0x9000n + BigInt(i),
      ));
    }
    expect((await vault.getGetGlobal()).receive_intent_count).toBe(48n);

    const claimResult = await sendReceiveIntentExternal(blockchain, vault, 'ClaimReceiveIntent', recipient, recipientKey, {
      intent_id: intents[0].intentId,
      secret32: intents[0].secret,
    });
    expectSuccessfulExternalVaultCompute(claimResult);

    expect((await vault.getGetReceiveIntent(intents[0].intentId)).exists).toBe(false);
    expect((await vault.getGetUser(recipient.address)).ton_balance).toBe(amount);
    expect((await vault.getGetGlobal()).receive_intent_count).toBe(47n);
  });

  it('VAULT-HAPPY-16: cancel returns locked TON to sender and deletes intent', async () => {
    const { vault, sender, recipient, blockchain } = await setup();
    const senderKey = await registerKeys(vault, sender, 3);
    await registerKeys(vault, recipient, 4);
    await deposit(vault, sender, toNano('1'));

    const amount = toNano('0.4');
    const { intentId } = await createTonIntent(blockchain, vault, sender, recipient, senderKey, amount);
    expect((await vault.getGetUser(sender.address)).ton_balance).toBe(toNano('0.6') - RECEIVE_INTENT_CREATE_RESERVE);

    await sendReceiveIntentExternal(blockchain, vault, 'CancelReceiveIntent', sender, senderKey, {
      intent_id: intentId,
    });

    expect((await vault.getGetUser(sender.address)).ton_balance).toBe(toNano('1') - RECEIVE_INTENT_CREATE_RESERVE);
    expect((await vault.getGetReceiveIntent(intentId)).exists).toBe(false);
    expect((await vault.getGetGlobal()).receive_intent_count).toBe(0n);
  });

  it('VAULT-REJECT: wrong recipient or wrong secret cannot claim', async () => {
    const { vault, sender, recipient, attacker, blockchain } = await setup();
    const senderKey = await registerKeys(vault, sender, 5);
    const recipientKey = await registerKeys(vault, recipient, 6);
    const attackerKey = await registerKeys(vault, attacker, 7);
    await deposit(vault, sender, toNano('1'));

    const amount = toNano('0.3');
    const { intentId } = await createTonIntent(blockchain, vault, sender, recipient, senderKey, amount, 0x9999n);

    const rawBeforeWrongRecipient = await contractBalance(blockchain, vault.address);
    const attackerBeforeWrongRecipient = await vault.getGetUser(attacker.address);
    await expect(sendReceiveIntentExternal(blockchain, vault, 'ClaimReceiveIntent', attacker, attackerKey, {
      intent_id: intentId,
      secret32: 0x9999n,
    })).rejects.toThrow(/16278/);
    const attackerAfterWrongRecipient = await vault.getGetUser(attacker.address);
    expect(await contractBalance(blockchain, vault.address)).toBe(rawBeforeWrongRecipient);
    expect((await vault.getGetReceiveIntent(intentId)).exists).toBe(true);
    expect(attackerAfterWrongRecipient.publish_nonce).toBe(attackerBeforeWrongRecipient.publish_nonce);
    expect(attackerAfterWrongRecipient.ton_balance).toBe(attackerBeforeWrongRecipient.ton_balance);

    const rawBeforeWrongSecret = await contractBalance(blockchain, vault.address);
    const recipientBeforeWrongSecret = await vault.getGetUser(recipient.address);
    await expect(sendReceiveIntentExternal(blockchain, vault, 'ClaimReceiveIntent', recipient, recipientKey, {
      intent_id: intentId,
      secret32: 0x8888n,
    })).rejects.toThrow(/16280/);
    const recipientAfterWrongSecret = await vault.getGetUser(recipient.address);
    expect(await contractBalance(blockchain, vault.address)).toBe(rawBeforeWrongSecret);
    expect((await vault.getGetReceiveIntent(intentId)).exists).toBe(true);
    expect(recipientAfterWrongSecret.publish_nonce).toBe(recipientBeforeWrongSecret.publish_nonce);
    expect(recipientAfterWrongSecret.ton_balance).toBe(recipientBeforeWrongSecret.ton_balance);
  });

  it('VAULT-REJECT: missing receive intent claim/cancel reject before accept without nonce or balance mutation', async () => {
    const { vault, sender, recipient, blockchain } = await setup();
    const senderKey = await registerKeys(vault, sender, 18);
    const recipientKey = await registerKeys(vault, recipient, 19);

    const rawBeforeClaim = await contractBalance(blockchain, vault.address);
    const recipientBefore = await vault.getGetUser(recipient.address);
    await expect(sendReceiveIntentExternal(blockchain, vault, 'ClaimReceiveIntent', recipient, recipientKey, {
      intent_id: 0xdeadn,
      secret32: 0xbeefn,
    })).rejects.toThrow(/16276/);
    const recipientAfter = await vault.getGetUser(recipient.address);
    expect(await contractBalance(blockchain, vault.address)).toBe(rawBeforeClaim);
    expect(recipientAfter.publish_nonce).toBe(recipientBefore.publish_nonce);
    expect(recipientAfter.ton_balance).toBe(recipientBefore.ton_balance);
    expect((await vault.getGetGlobal()).receive_intent_count).toBe(0n);

    const rawBeforeCancel = await contractBalance(blockchain, vault.address);
    const senderBefore = await vault.getGetUser(sender.address);
    await expect(sendReceiveIntentExternal(blockchain, vault, 'CancelReceiveIntent', sender, senderKey, {
      intent_id: 0xfeedn,
    })).rejects.toThrow(/16285/);
    const senderAfter = await vault.getGetUser(sender.address);
    expect(await contractBalance(blockchain, vault.address)).toBe(rawBeforeCancel);
    expect(senderAfter.publish_nonce).toBe(senderBefore.publish_nonce);
    expect(senderAfter.ton_balance).toBe(senderBefore.ton_balance);
    expect((await vault.getGetGlobal()).receive_intent_count).toBe(0n);
  });

  it('VAULT-REJECT: replayed create and insufficient sender balance are rejected without mutation', async () => {
    const { vault, sender, recipient, blockchain } = await setup();
    const senderKey = await registerKeys(vault, sender, 8);
    await registerKeys(vault, recipient, 9);
    await deposit(vault, sender, toNano('1'));

    const amount = toNano('0.2');
    const nonce = (await vault.getGetUser(sender.address)).publish_nonce;
    const { intentId, commitment } = await computeIntent(vault, sender, recipient, amount, nonce, 0x7777n);
    const createBody = signedReceiveIntentBody('CreateReceiveIntent', sender.address, nonce, senderKey.secretKey, vault.address, {
      asset: ASSET_TON,
      amount,
      recipient_wallet: recipient.address,
      commitment,
    });

    await blockchain.sendMessage(external({ to: vault.address, body: createBody }));
    await expect(blockchain.sendMessage(external({ to: vault.address, body: createBody }))).rejects.toThrow(/16233/);

    expect((await vault.getGetGlobal()).receive_intent_count).toBe(1n);
    expect((await vault.getGetReceiveIntent(intentId)).exists).toBe(true);
    expect((await vault.getGetUser(sender.address)).ton_balance).toBe(toNano('0.8') - RECEIVE_INTENT_CREATE_RESERVE);

    const tooMuch = toNano('2');
    const badNonce = (await vault.getGetUser(sender.address)).publish_nonce;
    const bad = await computeIntent(vault, sender, recipient, tooMuch, badNonce, 0x8888n);
    await sendReceiveIntentExternal(blockchain, vault, 'CreateReceiveIntent', sender, senderKey, {
      asset: ASSET_TON,
      amount: tooMuch,
      recipient_wallet: recipient.address,
      commitment: bad.commitment,
    });

    expect((await vault.getGetGlobal()).receive_intent_count).toBe(1n);
    expect((await vault.getGetUser(sender.address)).ton_balance).toBe(toNano('0.8') - RECEIVE_INTENT_CREATE_RESERVE - 2_000_000n);
  });

  it('VAULT-REJECT: ATH receive intent cannot target a non-basechain recipient', async () => {
    const { vault, sender, athWallet, blockchain } = await setup();
    const senderKey = await registerKeys(vault, sender, 10);
    const nonBasechainRecipient = new Address(-1, Buffer.alloc(32, 0x44));
    const amount = 500n;
    const secret = 0x2121n;

    await deposit(vault, sender, toNano('0.1'));
    await depositAth(vault, athWallet, sender, 1_000n, 21n);
    const before = await vault.getGetUser(sender.address);
    const clientNonce = before.publish_nonce;
    const intentId = await vault.getGetReceiveIntentId(sender.address, nonBasechainRecipient, ASSET_ATH, amount, clientNonce);
    const commitment = await vault.getGetReceiveIntentCommitment(intentId, nonBasechainRecipient, secret);

    await sendReceiveIntentExternal(blockchain, vault, 'CreateReceiveIntent', sender, senderKey, {
      asset: ASSET_ATH,
      amount,
      recipient_wallet: nonBasechainRecipient,
      commitment,
    });

    const after = await vault.getGetUser(sender.address);
    expect(after.ath_balance).toBe(before.ath_balance);
    expect(after.ton_balance).toBe(before.ton_balance - 2_000_000n);
    expect((await vault.getGetReceiveIntent(intentId)).exists).toBe(false);
    expect((await vault.getGetGlobal()).receive_intent_count).toBe(0n);
  });

  it('VAULT-HAPPY: payment check has no expiry and can be claimed later', async () => {
    const { vault, sender, recipient, blockchain } = await setup();
    const senderKey = await registerKeys(vault, sender, 11);
    const recipientKey = await registerKeys(vault, recipient, 12);
    const now = blockchain.now ?? 0;
    await deposit(vault, sender, toNano('1'));

    const amount = toNano('0.3');
    const { intentId, secret } = await createTonIntent(blockchain, vault, sender, recipient, senderKey, amount, 0x9999n);
    blockchain.now = now + 31 * 24 * 60 * 60;

    await sendReceiveIntentExternal(blockchain, vault, 'ClaimReceiveIntent', recipient, recipientKey, {
      intent_id: intentId,
      secret32: secret,
    });
    expect((await vault.getGetReceiveIntent(intentId)).exists).toBe(false);
    expect((await vault.getGetUser(recipient.address)).ton_balance).toBe(amount);
  });

  it('VAULT-REJECT: session-like/non-sender caller cannot create or cancel with someone else balance', async () => {
    const { vault, sender, recipient, attacker, blockchain } = await setup();
    const senderKey = await registerKeys(vault, sender, 13);
    const attackerKey = await registerKeys(vault, attacker, 14);
    await registerKeys(vault, recipient, 15);
    await deposit(vault, sender, toNano('1'));

    const amount = toNano('0.2');
    const attackerNonce = (await vault.getGetUser(attacker.address)).publish_nonce;
    const attackerIntent = await computeIntent(vault, attacker, recipient, amount, attackerNonce, 0x10n);
    const rawBeforeAttackerCreate = await contractBalance(blockchain, vault.address);
    await expect(sendReceiveIntentExternal(blockchain, vault, 'CreateReceiveIntent', attacker, attackerKey, {
      asset: ASSET_TON,
      amount,
      recipient_wallet: recipient.address,
      commitment: attackerIntent.commitment,
    })).rejects.toThrow(/16265/);
    expect(await contractBalance(blockchain, vault.address)).toBe(rawBeforeAttackerCreate);
    expect((await vault.getGetGlobal()).receive_intent_count).toBe(0n);

    const { intentId } = await createTonIntent(blockchain, vault, sender, recipient, senderKey, amount, 0x11n);
    const rawBeforeAttackerCancel = await contractBalance(blockchain, vault.address);
    const attackerBeforeCancel = await vault.getGetUser(attacker.address);
    await expect(sendReceiveIntentExternal(blockchain, vault, 'CancelReceiveIntent', attacker, attackerKey, {
      intent_id: intentId,
    })).rejects.toThrow(/16286/);
    const attackerAfterCancel = await vault.getGetUser(attacker.address);
    expect(await contractBalance(blockchain, vault.address)).toBe(rawBeforeAttackerCancel);
    expect((await vault.getGetReceiveIntent(intentId)).exists).toBe(true);
    expect(attackerAfterCancel.publish_nonce).toBe(attackerBeforeCancel.publish_nonce);
    expect(attackerAfterCancel.ton_balance).toBe(attackerBeforeCancel.ton_balance);
    expect((await vault.getGetUser(sender.address)).ton_balance).toBe(toNano('0.8') - RECEIVE_INTENT_CREATE_RESERVE);
  });

  it('VAULT-REJECT: same-auth two-wallet receive-intent replay is owner-domain separated', async () => {
    const { vault, sender, recipient, attacker, blockchain } = await setup();
    const sharedKey = await registerKeys(vault, sender, 16);
    await registerKeys(vault, attacker, 16);
    await registerKeys(vault, recipient, 17);
    await deposit(vault, sender, toNano('1'));
    await deposit(vault, attacker, toNano('1'));

    const amount = toNano('0.2');
    const senderNonce = (await vault.getGetUser(sender.address)).publish_nonce;
    const attackerBefore = await vault.getGetUser(attacker.address);
    expect(attackerBefore.publish_nonce).toBe(senderNonce);
    const { commitment } = await computeIntent(vault, sender, recipient, amount, senderNonce, 0x2020n);
    const body = signedReceiveIntentBody('CreateReceiveIntent', sender.address, senderNonce, sharedKey.secretKey, vault.address, {
      asset: ASSET_TON,
      amount,
      recipient_wallet: recipient.address,
      commitment,
    }, attacker.address);

    const rawBefore = await contractBalance(blockchain, vault.address);
    await expect(blockchain.sendMessage(external({ to: vault.address, body }))).rejects.toThrow(/16288/);
    const attackerAfter = await vault.getGetUser(attacker.address);
    expect(attackerAfter.publish_nonce).toBe(attackerBefore.publish_nonce);
    expect(attackerAfter.ton_balance).toBe(attackerBefore.ton_balance);
    expect((await vault.getGetGlobal()).receive_intent_count).toBe(0n);
    expect(await contractBalance(blockchain, vault.address)).toBe(rawBefore);
  });
});
