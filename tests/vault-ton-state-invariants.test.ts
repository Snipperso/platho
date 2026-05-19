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
  CreateReceiveIntent,
  ClaimReceiveIntent,
  CancelReceiveIntent,
} from '../build/Vault/Vault_Vault';

const GENESIS_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
const USER_STATE_STORAGE_ENDOWMENT = 10_000_000n;
const DEPOSIT_TON_EXEC_RESERVE = 2_000_000n;
const SESSION_STATE_STORAGE_ENDOWMENT = 5_000_000n;
const RECEIVE_INTENT_STORAGE_ENDOWMENT = 5_000_000n;
const ASSET_TON = 1n;

type ModelUser = {
  exists: boolean;
  ton: bigint;
  budget: bigint;
  budgetEpoch: bigint;
  currentKeyId: bigint;
  sessionExists: boolean;
  sessionActive: boolean;
  sessionPubkey: bigint;
  expiresAt: bigint;
};

type ModelIntent = {
  id: bigint;
  sender: number;
  recipient: number;
  amount: bigint;
  secret: bigint;
};

function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

function emptyModelUser(): ModelUser {
  return {
    exists: false,
    ton: 0n,
    budget: 0n,
    budgetEpoch: 0n,
    currentKeyId: 0n,
    sessionExists: false,
    sessionActive: false,
    sessionPubkey: 0n,
    expiresAt: 0n,
  };
}

async function setup(userCount = 4) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const athWallet = await blockchain.treasury('vault-ton-inv-ath-wallet');
  const capsuleHub = await blockchain.treasury('vault-ton-inv-capsulehub');
  const init = await Vault.init(athWallet.address, athWallet.address, capsuleHub.address, GENESIS_HASH, true, true, 0n);
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: init.code,
    data: init.data,
    balance: toNano('5'),
    workchain: address.workChain,
  }));

  const vault = blockchain.openContract(new Vault(address, init));
  const users = [];
  const recipients = [];
  for (let i = 0; i < userCount; i += 1) {
    users.push(await blockchain.treasury(`vault-ton-inv-user-${i}`));
    recipients.push(await blockchain.treasury(`vault-ton-inv-recipient-${i}`));
  }

  return { blockchain, vault, users, recipients };
}

describe('Vault TON/session state-machine invariants', () => {
  it('VAULT-INV-TON-01: deterministic operation walk preserves modeled TON, budget, sessions, and intents', async () => {
    const { blockchain, vault, users, recipients } = await setup();
    const now = BigInt(blockchain.now ?? 0);
    const rng = makeRng(0x7057cafe);
    const model = users.map(() => emptyModelUser());
    const intents = new Map<string, ModelIntent>();
    let debugContext = 'initial';

    async function assertModel() {
      let expectedUserCount = 0n;
      let expectedSessionCount = 0n;
      let expectedTonLiabilities = 0n;
      for (let i = 0; i < users.length; i += 1) {
        const expected = model[i];
        if (expected.exists) {
          expectedUserCount += 1n;
          expectedTonLiabilities += expected.ton + expected.budget;
        }
        if (expected.sessionExists) {
          expectedSessionCount += 1n;
        }

        const userState = await vault.getGetUser(users[i].address);
        const session = await vault.getGetSession(users[i].address);
        expect(userState.exists).toBe(expected.exists);
        if (userState.ton_balance !== expected.ton) {
          throw new Error(`${debugContext}: user ${i} ton mismatch, chain=${userState.ton_balance}, model=${expected.ton}`);
        }
        expect(userState.message_budget_ton).toBe(expected.budget);
        expect(userState.budget_epoch).toBe(expected.budgetEpoch);
        expect(userState.current_key_id).toBe(expected.currentKeyId);

        expect(session.exists).toBe(expected.sessionExists);
        if (expected.sessionExists) {
          expect(session.active).toBe(expected.sessionActive);
          expect(session.session_pubkey).toBe(expected.sessionPubkey);
          expect(session.expires_at).toBe(expected.expiresAt);
        }
      }

      const global = await vault.getGetGlobal();
      expect(global.user_count).toBe(expectedUserCount);
      expect(global.session_count).toBe(expectedSessionCount);
      expect(global.receive_intent_count).toBe(BigInt(intents.size));

      for (const intent of intents.values()) {
        expectedTonLiabilities += intent.amount;
        const view = await vault.getGetReceiveIntent(intent.id);
        expect(view.exists).toBe(true);
        expect(view.sender_wallet.toString()).toBe(users[intent.sender].address.toString());
        expect(view.recipient_wallet.toString()).toBe(users[intent.recipient].address.toString());
        expect(view.asset).toBe(ASSET_TON);
        expect(view.amount).toBe(intent.amount);
      }

      const vaultBalance = (await blockchain.getContract(vault.address)).balance;
      if (vaultBalance < expectedTonLiabilities) {
        throw new Error(`${debugContext}: Vault under-backed, balance=${vaultBalance}, liabilities=${expectedTonLiabilities}`);
      }
    }

    for (let step = 0; step < 90; step += 1) {
      const i = rng() % users.length;
      const op = rng() % 9;

      if (op === 0) {
        const amount = BigInt(100_000 + (rng() % 900_000));
        const required = amount + DEPOSIT_TON_EXEC_RESERVE + (model[i].exists ? 0n : USER_STATE_STORAGE_ENDOWMENT);
        const underfunded = (rng() % 7) === 0;
        debugContext = `step ${step} deposit user=${i} amount=${amount} underfunded=${underfunded}`;
        await vault.send(users[i].getSender(), { value: underfunded ? required - 1n : required + toNano('0.01') }, {
          $$type: 'DepositTon',
          amount,
        } as DepositTon);
        if (!underfunded) {
          if (!model[i].exists) {
            model[i].exists = true;
          }
          model[i].ton += amount;
        }
      } else if (op === 1) {
        const amount = BigInt(50_000 + (rng() % 500_000));
        debugContext = `step ${step} withdraw user=${i} amount=${amount}`;
        await vault.send(users[i].getSender(), { value: toNano('0.01') }, {
          $$type: 'WithdrawTon',
          amount,
          recipient: recipients[i].address,
        } as WithdrawTon);
        if (model[i].exists && model[i].ton >= amount) {
          model[i].ton -= amount;
        }
      } else if (op === 2) {
        const pubkey = BigInt(0x1000_0000 + step * 17 + i);
        const expiresAt = now + 1_000n + BigInt(step);
        const required = (model[i].exists ? 0n : USER_STATE_STORAGE_ENDOWMENT)
          + (model[i].sessionExists ? 0n : SESSION_STATE_STORAGE_ENDOWMENT);
        const underfunded = required > 0n && (rng() % 5) === 0;
        debugContext = `step ${step} set-session user=${i} required=${required} underfunded=${underfunded}`;
        await vault.send(users[i].getSender(), { value: underfunded ? required - 1n : (required > 0n ? required : toNano('0.01')) }, {
          $$type: 'SetSession',
          session_pubkey: pubkey,
          expires_at: expiresAt,
        } as SetSession);
        if (!underfunded) {
          model[i].exists = true;
          model[i].sessionExists = true;
          model[i].sessionActive = true;
          model[i].sessionPubkey = pubkey;
          model[i].expiresAt = expiresAt;
        }
      } else if (op === 3) {
        const amount = BigInt(50_000 + (rng() % 300_000));
        debugContext = `step ${step} top-up user=${i} amount=${amount}`;
        await vault.send(users[i].getSender(), { value: toNano('0.01') }, {
          $$type: 'TopUpMessageBudget',
          amount,
        } as TopUpMessageBudget);
        if (model[i].exists && model[i].sessionExists && model[i].sessionActive && model[i].expiresAt >= now && model[i].ton >= amount) {
          model[i].ton -= amount;
          model[i].budget += amount;
        }
      } else if (op === 4) {
        debugContext = `step ${step} revoke user=${i}`;
        await vault.send(users[i].getSender(), { value: toNano('0.01') }, {
          $$type: 'RevokeSession',
        } as RevokeSession);
        if (model[i].sessionExists && model[i].sessionActive) {
          model[i].sessionActive = false;
          model[i].ton += model[i].budget;
          model[i].budget = 0n;
          model[i].budgetEpoch += 1n;
        }
      } else if (op === 5) {
        const recipient = rng() % users.length;
        const amount = BigInt(40_000 + (rng() % 300_000));
        const clientNonce = BigInt(step % 13);
        const secret = BigInt(0xabc000 + step);
        const intentId = await vault.getGetReceiveIntentId(users[i].address, users[recipient].address, ASSET_TON, amount, clientNonce);
        const commitment = await vault.getGetReceiveIntentCommitment(intentId, users[recipient].address, secret);
        const underfunded = (rng() % 6) === 0;
        await vault.send(users[i].getSender(), { value: underfunded ? RECEIVE_INTENT_STORAGE_ENDOWMENT - 1n : RECEIVE_INTENT_STORAGE_ENDOWMENT }, {
          $$type: 'CreateReceiveIntent',
          asset: ASSET_TON,
          amount,
          recipient_wallet: users[recipient].address,
          commitment,
          expires_at: now + 1_000n,
          client_nonce: clientNonce,
        } as CreateReceiveIntent);
        const key = intentId.toString();
        if (!underfunded && model[i].exists && model[i].ton >= amount && !intents.has(key)) {
          model[i].ton -= amount;
          intents.set(key, { id: intentId, sender: i, recipient, amount, secret });
        }
        debugContext = `step ${step} create-intent sender=${i} recipient=${recipient} amount=${amount} underfunded=${underfunded}`;
      } else if (op === 6 && intents.size > 0) {
        const [key, intent] = [...intents.entries()][rng() % intents.size];
        const wrongSecret = (rng() % 5) === 0;
        const callerIndex = wrongSecret ? intent.recipient : intent.recipient;
        const recipientExistsBefore = model[callerIndex].exists;
        const required = recipientExistsBefore ? 0n : USER_STATE_STORAGE_ENDOWMENT;
        const underfunded = required > 0n && (rng() % 4) === 0;
        debugContext = `step ${step} claim-intent recipient=${callerIndex} amount=${intent.amount} wrongSecret=${wrongSecret} underfunded=${underfunded}`;
        await vault.send(users[callerIndex].getSender(), { value: underfunded ? required - 1n : (required > 0n ? required : toNano('0.01')) }, {
          $$type: 'ClaimReceiveIntent',
          intent_id: intent.id,
          secret32: wrongSecret ? intent.secret + 1n : intent.secret,
        } as ClaimReceiveIntent);
        if (!wrongSecret && !underfunded) {
          if (!model[callerIndex].exists) {
            model[callerIndex].exists = true;
          }
          model[callerIndex].ton += intent.amount;
          intents.delete(key);
        }
      } else if (op === 7 && intents.size > 0) {
        const [key, intent] = [...intents.entries()][rng() % intents.size];
        const wrongCaller = (rng() % 5) === 0;
        const caller = wrongCaller ? (intent.sender + 1) % users.length : intent.sender;
        debugContext = `step ${step} cancel-intent caller=${caller} sender=${intent.sender} amount=${intent.amount} wrongCaller=${wrongCaller}`;
        await vault.send(users[caller].getSender(), { value: toNano('0.01') }, {
          $$type: 'CancelReceiveIntent',
          intent_id: intent.id,
        } as CancelReceiveIntent);
        if (!wrongCaller) {
          model[intent.sender].ton += intent.amount;
          intents.delete(key);
        }
      } else {
        const amount = BigInt(10_000 + (rng() % 100_000));
        debugContext = `step ${step} fallback-top-up user=${i} amount=${amount}`;
        await vault.send(users[i].getSender(), { value: toNano('0.01') }, {
          $$type: 'TopUpMessageBudget',
          amount,
        } as TopUpMessageBudget);
        if (model[i].exists && model[i].sessionExists && model[i].sessionActive && model[i].expiresAt >= now && model[i].ton >= amount) {
          model[i].ton -= amount;
          model[i].budget += amount;
        }
      }

      await assertModel();
    }
  }, 30000);
});
