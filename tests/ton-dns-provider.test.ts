import { Address, beginCell } from '@ton/core';
import { describe, expect, it } from 'vitest';
import {
  TON_DNS_RECORD_TAGS,
  createTonDnsProvider,
  decodeTonDnsRecordCell,
  default as defaultTonDnsProvider,
  normalizeTonDnsName,
  tonDnsCategoryHash,
  tonDnsNameToInternalBytes,
} from '../web/ton-dns-provider.mjs';

const ROOT = `-1:${'11'.repeat(32)}`;
const NEXT = `0:${'22'.repeat(32)}`;
const WALLET = `0:${'33'.repeat(32)}`;

function num(value: bigint | number | string) {
  const bigint = typeof value === 'bigint' ? value : BigInt(value);
  return {
    type: 'num',
    value: bigint < 0n ? `-0x${(-bigint).toString(16)}` : `0x${bigint.toString(16)}`,
  };
}

function recordBoc(tag: number, address: string, flags: number | null = null) {
  const builder = beginCell()
    .storeUint(tag, 16)
    .storeAddress(Address.parseRaw(address));
  if (flags !== null) builder.storeUint(flags, 8);
  return builder.endCell().toBoc({ idx: false, crc32: false }).toString('base64');
}

function textDecoder(bytes: Uint8Array) {
  return Array.from(bytes).map((byte) => (byte === 0 ? '\\0' : String.fromCharCode(byte))).join('');
}

describe('TON DNS provider', () => {
  it('TON-DNS-00: module default export is a ready runtime provider', () => {
    expect(defaultTonDnsProvider?.resolveWallet).toBeTypeOf('function');
  });

  it('TON-DNS-01: normalizes and encodes .ton names in TON DNS order', () => {
    expect(normalizeTonDnsName('Alice.TON')).toBe('alice.ton');
    expect(textDecoder(tonDnsNameToInternalBytes('alice.ton'))).toBe('ton\\0alice\\0');
    expect(textDecoder(tonDnsNameToInternalBytes('chat.alice.ton', { leadingZero: true }))).toBe('\\0ton\\0alice\\0chat\\0');
    expect(() => normalizeTonDnsName('@alice')).toThrow(/\.ton/i);
  });

  it('TON-DNS-02: decodes wallet and next-resolver records', () => {
    expect(decodeTonDnsRecordCell(recordBoc(TON_DNS_RECORD_TAGS.WALLET, WALLET, 0))).toMatchObject({
      type: 'wallet',
      address: WALLET,
      flags: 0,
    });
    expect(decodeTonDnsRecordCell(recordBoc(TON_DNS_RECORD_TAGS.NEXT_RESOLVER, NEXT))).toMatchObject({
      type: 'next_resolver',
      address: NEXT,
    });
  });

  it('TON-DNS-03: resolves wallet records through dnsresolve recursion and forwards critical read options', async () => {
    const calls: Array<{ address: string; method: string; stack: any[]; verify?: boolean; priority?: string; cacheTtlMs?: number }> = [];
    const walletCategory = await tonDnsCategoryHash('wallet');
    const provider = createTonDnsProvider({
      rootAddress: ROOT,
      transport: {
        async runGetMethod(call: { address: string; method: string; stack: any[]; verify?: boolean; priority?: string; cacheTtlMs?: number }) {
          calls.push(call);
          expect(call.method).toBe('dnsresolve');
          expect(call.stack[1]).toEqual({ type: 'num', value: `0x${walletCategory.toString(16)}` });
          if (call.address === ROOT) {
            return {
              stack: [
                num(32n),
                { type: 'cell', value: recordBoc(TON_DNS_RECORD_TAGS.NEXT_RESOLVER, NEXT) },
              ],
            };
          }
          if (call.address === NEXT) {
            return {
              stack: [
                num(56n),
                { type: 'cell', value: recordBoc(TON_DNS_RECORD_TAGS.WALLET, WALLET, 0) },
              ],
            };
          }
          throw new Error(`unexpected resolver ${call.address}`);
        },
      },
    });

    await expect(provider.resolveWallet('alice.ton', {
      verify: true,
      priority: 'critical',
      cacheTtlMs: 0,
    })).resolves.toBe(WALLET);
    expect(calls.map((call) => call.address)).toEqual([ROOT, NEXT]);
    expect(calls.every((call) => call.verify === true && call.priority === 'critical' && call.cacheTtlMs === 0)).toBe(true);
  });

  it('TON-DNS-04: stays fail-closed without root, transport, or wallet record', async () => {
    await expect(createTonDnsProvider({ transport: null }).resolveWallet('alice.ton')).rejects.toThrow(/transport/i);
    await expect(createTonDnsProvider({
      transport: { async runGetMethod() { return { stack: [] }; } },
    }).resolveWallet('alice.ton')).rejects.toThrow(/root address/i);
    await expect(createTonDnsProvider({
      rootAddress: ROOT,
      transport: {
        async runGetMethod() {
          return { stack: [num(0n), { type: 'null', value: null }] };
        },
      },
    }).resolveWallet('alice.ton')).rejects.toThrow(/wallet record/i);
  });
});
