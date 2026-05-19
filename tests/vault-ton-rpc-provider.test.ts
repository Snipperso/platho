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
              num(0n),
              num(1n),
              num(7n),
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
});
