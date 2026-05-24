import { describe, expect, it } from 'vitest';
import {
  createMessagingIdentity,
  createVaultMessagingKeyDraft,
  exportSignedPublicKeyBundle,
  verifySignedPublicKeyBundle,
} from '../web/crypto/platho-crypto.mjs';
import { bindVaultRecordFromChain } from '../web/vault-chain-provider.mjs';
import {
  createTonCenterV3VaultTransport,
  createVaultTonRpcProvider,
  decodeTonAddressSliceBoc,
  encodeTonAddressSliceBoc,
} from '../web/vault-ton-rpc-provider.mjs';
import { tonCell } from '../web/pwa-contract-transactions.mjs';

const NOW = Date.UTC(2026, 0, 3, 10, 0, 0);
const OWNER = `0:${'11'.repeat(32)}`;
const VAULT = `0:${'22'.repeat(32)}`;

function num(value: bigint | number | string) {
  const bigint = typeof value === 'bigint' ? value : BigInt(value);
  return {
    type: 'num',
    value: bigint < 0n ? `-0x${(-bigint).toString(16)}` : `0x${bigint.toString(16)}`,
  };
}

function snakeBoc(bytes: Uint8Array) {
  return tonCell.bytesToBase64(tonCell.serializeBoc(tonCell.snakeCellFromBytes(bytes)));
}

async function keyFixture() {
  const identity = await createMessagingIdentity();
  const signedBundle = await exportSignedPublicKeyBundle(identity, {
    issuedAt: NOW,
    ownerWallet: OWNER,
    purpose: 'vault-ton-rpc-provider-test',
  });
  const verified = await verifySignedPublicKeyBundle(signedBundle, { now: NOW + 1 });
  const draft = await createVaultMessagingKeyDraft(verified.bundle, verified.signingPublicKey);
  return { signedBundle, draft };
}

describe('Vault TON RPC provider', () => {
  it('VAULT-RPC-01: encodes and decodes TON address slice BoC for get_user', () => {
    const boc = encodeTonAddressSliceBoc(OWNER);

    expect(boc).toMatch(/^te6/);
    expect(decodeTonAddressSliceBoc(boc)).toBe(OWNER);
  });

  it('VAULT-RPC-02: calls get_user/get_key_record and binds a signed bundle to Vault record', async () => {
    const { signedBundle, draft } = await keyFixture();
    const calls: Array<{ method: string; address: string; stack: any[] }> = [];
    const transport = {
      kind: 'mock-ton-rpc',
      async runGetMethod(call: { method: string; address: string; stack: any[] }) {
        calls.push(call);
        if (call.method === 'get_user') {
          expect(decodeTonAddressSliceBoc(call.stack[0].value)).toBe(OWNER);
          return {
            stack: [
              num(-1n),
              num(0n),
              num(0n),
              num(7n),
              num(3n),
            ],
          };
        }
        if (call.method === 'get_key_record') {
          expect(call.stack).toEqual([{ type: 'num', value: '0x7' }]);
          return {
            stack: [
              num(-1n),
              { type: 'slice', value: encodeTonAddressSliceBoc(OWNER) },
              num(0n),
              num(draft.message.enc_pubkey),
              num(draft.message.sign_pubkey),
              num(draft.message.pq_kem_pubkey_hash),
              num(draft.message.pq_kem_pubkey_len),
              { type: 'cell', value: snakeBoc(draft.message.pq_kem_pubkey) },
              num(draft.message.crypto_suite_mask),
              num(1_700_000_000n),
              num(10n),
              num(0n),
              num(0n),
            ],
          };
        }
        throw new Error(`unexpected method ${call.method}`);
      },
    };
    const provider = createVaultTonRpcProvider({ vaultAddress: VAULT, transport });

    const binding = await bindVaultRecordFromChain(
      signedBundle,
      { walletAddress: OWNER },
      { provider, vaultAddress: VAULT, now: NOW + 1 },
    );

    expect(binding.active).toBe(true);
    expect(binding.providerKind).toBe('mock-ton-rpc');
    expect(binding.currentKeyId).toBe(7n);
    expect(calls.map((call) => call.method)).toEqual(['get_user', 'get_key_record']);
    expect(calls.every((call) => call.address === VAULT)).toBe(true);
  });

  it('VAULT-RPC-03: stays fail-closed without transport or Vault address', async () => {
    const provider = createVaultTonRpcProvider({ transport: null });

    await expect(provider.getUser(OWNER, { vaultAddress: VAULT })).rejects.toThrow(/transport/i);
    await expect(createVaultTonRpcProvider({
      transport: {
        async runGetMethod() {
          return { stack: [] };
        },
      },
    }).getUser(OWNER)).rejects.toThrow(/Vault contract address/i);
  });

  it('VAULT-RPC-04: wraps TON Center v3 runGetMethod with explicit endpoint and API key', async () => {
    const requests: any[] = [];
    const transport = createTonCenterV3VaultTransport({
      endpoint: 'https://toncenter.example/api/v3/runGetMethod',
      apiKey: 'test-api-key',
      fetch: async (url: string, init: any) => {
        requests.push({ url, init });
        return {
          ok: true,
          status: 200,
          async json() {
            return { exit_code: 0, stack: [num(1n)] };
          },
        };
      },
    });

    await expect(transport.runGetMethod({
      address: VAULT,
      method: 'get_key_record',
      stack: [{ type: 'num', value: '0x7' }],
    })).resolves.toMatchObject({ exit_code: 0 });

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe('https://toncenter.example/api/v3/runGetMethod');
    expect(requests[0].init.headers['X-API-Key']).toBe('test-api-key');
    expect(JSON.parse(requests[0].init.body)).toEqual({
      address: VAULT,
      method: 'get_key_record',
      stack: [{ type: 'num', value: '0x7' }],
    });
  });

  it('VAULT-RPC-04B: wraps configured sendBoc endpoint for embedded wallet broadcasts', async () => {
    const requests: any[] = [];
    const transport = createTonCenterV3VaultTransport({
      endpoint: 'https://toncenter.example/api/v3/runGetMethod',
      sendBocEndpoint: 'https://toncenter.example/api/v3/sendBoc',
      apiKey: 'test-api-key',
      fetch: async (url: string, init: any) => {
        requests.push({ url, init });
        return {
          ok: true,
          status: 200,
          async json() {
            return { ok: true, result: { hash: 'abc' } };
          },
        };
      },
    });

    await expect(transport.sendBoc({ boc: 'te6ccgEBAQEAAgAAAA==' })).resolves.toMatchObject({ ok: true });

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe('https://toncenter.example/api/v3/sendBoc');
    expect(requests[0].init.headers['X-API-Key']).toBe('test-api-key');
    expect(JSON.parse(requests[0].init.body)).toEqual({ boc: 'te6ccgEBAQEAAgAAAA==' });
  });

  it('VAULT-RPC-05: exposes typed Vault getters needed by the PWA', async () => {
    const calls: Array<{ method: string; address: string; stack: any[] }> = [];
    const transport = {
      async runGetMethod(call: { method: string; address: string; stack: any[] }) {
        calls.push(call);
        if (call.method === 'get_receive_intent') {
          return {
            stack: [
              num(-1n),
              { type: 'slice', value: encodeTonAddressSliceBoc(OWNER) },
              { type: 'slice', value: encodeTonAddressSliceBoc(`0:${'44'.repeat(32)}`) },
              num(1n),
              num(100n),
              num(0xabcdn),
              num(77n),
              num(1_700_000_000n),
              num(0n),
            ],
          };
        }
        if (call.method === 'get_receive_intent_id') return { stack: [num(0x1010n)] };
        if (call.method === 'get_receive_intent_commitment') return { stack: [num(0x2020n)] };
        if (call.method === 'get_ath_withdrawal_id') return { stack: [num(0x3030n)] };
        if (call.method === 'get_pending_ath_withdrawal_for') {
          return {
            stack: [
              num(-1n),
              { type: 'slice', value: encodeTonAddressSliceBoc(OWNER) },
              { type: 'slice', value: encodeTonAddressSliceBoc(`0:${'44'.repeat(32)}`) },
              { type: 'slice', value: encodeTonAddressSliceBoc(`0:${'55'.repeat(32)}`) },
              num(500n),
              num(1_700_000_001n),
            ],
          };
        }
        if (call.method === 'get_canonical_publish_charge') return { stack: [num(58_000_000n)] };
        if (call.method === 'get_global') {
          return {
            stack: [
              num(-1n),
              num(-1n),
              num(0x9999n),
              { type: 'slice', value: encodeTonAddressSliceBoc(`0:${'66'.repeat(32)}`) },
              { type: 'slice', value: encodeTonAddressSliceBoc(`0:${'77'.repeat(32)}`) },
              { type: 'slice', value: encodeTonAddressSliceBoc(`0:${'88'.repeat(32)}`) },
              num(1n),
              num(2n),
              num(3n),
              num(4n),
              num(5n),
              num(6n),
              num(7n),
              num(86_400n),
              num(8n),
              num(9n),
              num(10n),
            ],
          };
        }
        throw new Error(`unexpected method ${call.method}`);
      },
    };
    const provider = createVaultTonRpcProvider({ vaultAddress: VAULT, transport });

    await expect(provider.getReceiveIntent(0x999n)).resolves.toMatchObject({
      exists: true,
      sender_wallet: OWNER,
      asset: 1n,
      amount: 100n,
      claimed: false,
    });
    await expect(provider.getReceiveIntentId(OWNER, `0:${'44'.repeat(32)}`, 1n, 100n, 77n)).resolves.toBe(0x1010n);
    await expect(provider.getReceiveIntentCommitment(0x1010n, `0:${'44'.repeat(32)}`, 0x7777n)).resolves.toBe(0x2020n);
    await expect(provider.getAthWithdrawalId(OWNER, 12n)).resolves.toBe(0x3030n);
    await expect(provider.getPendingAthWithdrawalFor(OWNER, 12n)).resolves.toMatchObject({
      exists: true,
      owner_wallet: OWNER,
      amount: 500n,
    });
    await expect(provider.getCanonicalPublishCharge(OWNER, 1n, 1n, 2n)).resolves.toBe(58_000_000n);
    await expect(provider.getGlobal()).resolves.toMatchObject({
      sealed: true,
      capsule_hub_bound: true,
      user_count: 1n,
      airdrop_total_allocation_ath: 10n,
    });

    expect(calls.map((call) => call.method)).toEqual([
      'get_receive_intent',
      'get_receive_intent_id',
      'get_receive_intent_commitment',
      'get_ath_withdrawal_id',
      'get_pending_ath_withdrawal_for',
      'get_canonical_publish_charge',
      'get_global',
    ]);
    expect(decodeTonAddressSliceBoc(calls[5].stack[0].value)).toBe(OWNER);
  });
});
