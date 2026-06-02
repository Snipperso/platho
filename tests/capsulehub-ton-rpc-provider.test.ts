import { describe, expect, it } from 'vitest';
import {
  createCapsuleHubTonRpcProvider,
  isCapsuleHubBodyHistoryUnavailable,
} from '../web/capsulehub-ton-rpc-provider.mjs';
import { tonCell } from '../web/pwa-contract-transactions.mjs';
import { createFallbackTonRpcTransport, encodeTonAddressSliceBoc } from '../web/vault-ton-rpc-provider.mjs';

const CAPSULE = `0:${'11'.repeat(32)}`;
const AUTHOR = `0:${'22'.repeat(32)}`;
const FEE = `0:${'33'.repeat(32)}`;
const VAULT = `0:${'44'.repeat(32)}`;
const GENESIS = `0:${'55'.repeat(32)}`;

function cellBoc(cell: any) {
  return tonCell.bytesToBase64(tonCell.serializeBoc(cell));
}

async function cellHashInt(cell: any) {
  const { hash } = await tonCell.computeCellHashAndDepth(cell);
  return BigInt(`0x${tonCell.bytesToHex(hash)}`);
}

function num(value: bigint | number | string) {
  const bigint = typeof value === 'bigint' ? value : BigInt(value);
  return {
    type: 'num',
    value: bigint < 0n ? `-0x${(-bigint).toString(16)}` : `0x${bigint.toString(16)}`,
  };
}

function privateHeader1Bytes(createdAtSec: number) {
  const bytes = new Uint8Array(30);
  bytes.set([0x50, 0x48, 0x31, 0x42, 1, 0], 0);
  bytes[6] = (createdAtSec >>> 24) & 0xff;
  bytes[7] = (createdAtSec >>> 16) & 0xff;
  bytes[8] = (createdAtSec >>> 8) & 0xff;
  bytes[9] = createdAtSec & 0xff;
  return bytes;
}

describe('CapsuleHub TON RPC provider', () => {
  it('CAPHUB-RPC-00: forwards cache, priority, and verify options to shared transport', async () => {
    const calls: any[] = [];
    const transport = {
      async runGetMethod(call: any) {
        calls.push(call);
        if (call.method === 'get_private_entry') {
          return {
            stack: [
              num(0n),
              num(0n),
              num(0n),
              num(0n),
              { type: 'slice', value: encodeTonAddressSliceBoc(AUTHOR) },
              num(0n),
              num(0n),
              num(0n),
              num(0n),
              num(0n),
              num(0n),
              { type: 'cell', value: cellBoc(tonCell.beginCell().endCell()) },
              { type: 'cell', value: cellBoc(tonCell.beginCell().endCell()) },
            ],
          };
        }
        if (call.method === 'get_public_entry') {
          return {
            stack: [
              num(0n),
              num(0n),
              num(0n),
              num(0n),
              { type: 'slice', value: encodeTonAddressSliceBoc(AUTHOR) },
              num(0n),
              num(0n),
              num(0n),
              num(0n),
              num(0n),
              { type: 'cell', value: cellBoc(tonCell.beginCell().endCell()) },
            ],
          };
        }
        return {
          stack: [
            num(0n),
            num(0n),
            num(0n),
            num(0n),
            num(0n),
            num(0n),
            num(0n),
            num(256n),
            num(1n),
            num(31_536_000n),
            num(0n),
            { type: 'slice', value: encodeTonAddressSliceBoc(FEE) },
            { type: 'slice', value: encodeTonAddressSliceBoc(VAULT) },
            { type: 'slice', value: encodeTonAddressSliceBoc(GENESIS) },
          ],
        };
      },
    };
    const provider = createCapsuleHubTonRpcProvider({ capsuleHubAddress: CAPSULE, transport });

    await provider.getState({
      cacheTtlMs: 0,
      priority: 'critical',
      verify: true,
    });
    await provider.getPrivateEntry(1n, {
      cacheTtlMs: 0,
      priority: 'critical',
      verify: true,
    });
    await provider.getPublicEntry(2n, {
      cacheTtlMs: 0,
      priority: 'critical',
      verify: true,
    });

    expect(calls[0]).toMatchObject({
      method: 'get_state',
      cacheTtlMs: 0,
      priority: 'critical',
      verify: true,
    });
    expect(calls[1]).toMatchObject({
      method: 'get_private_entry',
      cacheTtlMs: 0,
      priority: 'critical',
      verify: true,
    });
    expect(calls[2]).toMatchObject({
      method: 'get_public_entry',
      cacheTtlMs: 0,
      priority: 'critical',
      verify: true,
    });
  });

  it('CAPHUB-RPC-01: reads private/public entries and state for PWA chain history', async () => {
    const privateHeader0 = tonCell.snakeCellFromBytes(new Uint8Array([0x10]), 'private header0');
    const privateHeader1 = tonCell.snakeCellFromBytes(privateHeader1Bytes(1_700_000_000), 'private header1');
    const privateBody = tonCell.snakeCellFromBytes(new Uint8Array([0x12]), 'private body');
    const privateHeader0Hash = await cellHashInt(privateHeader0);
    const privateHeader1Hash = await cellHashInt(privateHeader1);
    const privateBodyHash = await cellHashInt(privateBody);
    const privateMessageBody = cellBoc(tonCell.beginCell()
      .uint(0xA4F862C0n, 32, 'op')
      .uint(1n, 64, 'bounce_id')
      .uint(2n, 160, 'bounce_tag')
      .uint(0xaaaan, 256, 'publish_id')
      .uint(1n, 8, 'size_class')
      .uint(2n, 8, 'crypto_suite')
      .uint(privateHeader0Hash, 256, 'header_0_hash')
      .ref(tonCell.beginCell()
        .uint(privateHeader1Hash, 256, 'header_1_hash')
        .uint(privateBodyHash, 256, 'body_hash')
        .ref(privateHeader0, 'header_0')
        .ref(privateHeader1, 'header_1')
        .ref(privateBody, 'body')
        .uint(5_000_000n, 128, 'protocol_fee_paid')
        .endCell(), 'payload')
      .endCell());

    const publicHeader = tonCell.snakeCellFromBytes(new Uint8Array([0x20]), 'public header');
    const publicBody = tonCell.snakeCellFromBytes(new Uint8Array([0x21]), 'public body');
    const publicHeaderHash = await cellHashInt(publicHeader);
    const publicBodyHash = await cellHashInt(publicBody);
    const publicMessageBody = cellBoc(tonCell.beginCell()
      .uint(0x8C2A76B7n, 32, 'op')
      .uint(3n, 64, 'bounce_id')
      .uint(4n, 160, 'bounce_tag')
      .uint(0xbbbbn, 256, 'publish_id')
      .uint(0x73656e742076696120506c6174686f2e417070n, 152, 'marketing_note')
      .address(AUTHOR, 'author_wallet')
      .ref(tonCell.beginCell()
        .uint(publicHeaderHash, 256, 'header_hash')
        .uint(publicBodyHash, 256, 'body_hash')
        .ref(publicHeader, 'header')
        .ref(publicBody, 'body')
        .uint(5_000_000n, 128, 'protocol_fee_paid')
        .endCell(), 'payload')
      .endCell());

    const calls: Array<{ method: string; address: string; stack: any[] }> = [];
    const messageCalls: any[] = [];
    const transport = {
      async runGetMethod(call: { method: string; address: string; stack: any[] }) {
        calls.push(call);
        if (call.method === 'get_private_entry') {
          return {
            stack: [
              num(-1n),
              num(7n),
              num(0x777n),
              num(0xaaaan),
              { type: 'slice', value: encodeTonAddressSliceBoc(AUTHOR) },
              num(0n),
              num(7n),
              num(1_700_000_123n),
              num(privateHeader0Hash),
              num(privateHeader1Hash),
              num(privateBodyHash),
              { type: 'cell', value: cellBoc(privateHeader0) },
              { type: 'cell', value: cellBoc(privateHeader1) },
            ],
          };
        }
        if (call.method === 'get_public_entry') {
          return {
            stack: [
              num(-1n),
              num(3n),
              num(0x333n),
              num(0xbbbbn),
              { type: 'slice', value: encodeTonAddressSliceBoc(AUTHOR) },
              num(0n),
              num(3n),
              num(1_700_000_456n),
              num(publicHeaderHash),
              num(publicBodyHash),
              { type: 'cell', value: cellBoc(publicHeader) },
            ],
          };
        }
        if (call.method === 'get_private_page' || call.method === 'get_public_page') {
          return {
            stack: [
              num(-1n),
              call.stack[0],
              num(0n),
              num(8n),
              num(8n),
              num(0n),
              num(0n),
            ],
          };
        }
        if (call.method === 'get_state') {
          return {
            stack: [
              ['num', '-0x1'],
              ['num', '-0x1'],
              ['num', '0x999'],
              ['num', '0x8'],
              ['num', '0x4'],
              ['num', '0x1'],
              ['num', '0x1'],
              ['num', '0x100'],
              ['num', '0x1'],
              ['num', '0x1e13380'],
              ['num', '0x4c4b40'],
              ['cell', encodeTonAddressSliceBoc(FEE)],
              ['slice', encodeTonAddressSliceBoc(VAULT)],
              ['slice', encodeTonAddressSliceBoc(GENESIS)],
              ['num', '0x7'],
              ['num', '0x4'],
              ['num', '0xf4240'],
              ['num', '0x174876e800'],
              ['num', '0x174876e800'],
              ['num', '0x7d'],
              ['num', '0x64'],
            ],
          };
        }
        throw new Error(`unexpected method ${call.method}`);
      },
      async getMessages(params: any, requestOptions: any) {
        messageCalls.push({ params, requestOptions });
        if (params.opcode === '0xA4F862C0') {
          return { messages: [{ message_content: { body: privateMessageBody } }] };
        }
        if (params.opcode === '0x8C2A76B7') {
          return { messages: [{ message_content: { body: publicMessageBody } }] };
        }
        return { messages: [] };
      },
    };
    const provider = createCapsuleHubTonRpcProvider({ capsuleHubAddress: CAPSULE, transport });

    const privateEntry = await provider.getPrivateEntry(7n);
    expect(privateEntry).toMatchObject({
      exists: true,
      entry_id: 7n,
      author_wallet: AUTHOR,
      body_boc: null,
      page_id: 0n,
      page_offset: 7n,
      created_at: 1_700_000_123n,
    });
    await expect(provider.resolvePrivateEntryBody(privateEntry, { priority: 'critical', messageCacheTtlMs: 0 })).resolves.toMatchObject({
      body_boc: cellBoc(privateBody),
    });
    const publicEntry = await provider.getPublicEntry(3n);
    expect(publicEntry).toMatchObject({
      exists: true,
      entry_id: 3n,
      author_wallet: AUTHOR,
      header_boc: cellBoc(publicHeader),
      body_boc: null,
      page_id: 0n,
      page_offset: 3n,
      created_at: 1_700_000_456n,
    });
    await expect(provider.resolvePublicEntryBody(publicEntry, { priority: 'critical', messageCacheTtlMs: 0 })).resolves.toMatchObject({
      body_boc: cellBoc(publicBody),
    });
    await expect(provider.getState()).resolves.toMatchObject({
      sealed: true,
      vault_bound: true,
      private_latest_id: 8n,
      public_latest_id: 4n,
      page_size: 256n,
      index_storage_years: 1n,
      index_retention_seconds: 31_536_000n,
      private_live_count: 7n,
      public_live_count: 4n,
      index_storage_reserve_ton: 1_000_000n,
      reserve_buffer_numerator: 125n,
      reserve_buffer_denominator: 100n,
      fee_accumulator_address: FEE,
      vault_address: VAULT,
    });
    await expect(provider.getPrivatePage(0n)).resolves.toMatchObject({
      exists: true,
      page_id: 0n,
      entry_count: 8n,
      opened_at: 0n,
      updated_at: 0n,
    });

    expect(calls.map((call) => call.method)).toEqual(['get_private_entry', 'get_public_entry', 'get_state', 'get_private_page']);
    expect(messageCalls.map((call) => call.params.opcode)).toEqual(['0xA4F862C0', '0x8C2A76B7']);
    expect(messageCalls[0].params).toMatchObject({
      body_hash: privateBodyHash.toString(16).padStart(64, '0'),
      limit: 10,
      start_utime: expect.any(Number),
      end_utime: expect.any(Number),
      sort: 'asc',
    });
    expect(messageCalls[1].params).toMatchObject({
      body_hash: publicBodyHash.toString(16).padStart(64, '0'),
      limit: 10,
      start_utime: expect.any(Number),
      end_utime: expect.any(Number),
      sort: 'asc',
    });
    expect(messageCalls.every((call) => call.requestOptions.priority === 'critical')).toBe(true);
    expect(messageCalls.every((call) => call.requestOptions.cacheTtlMs === 0)).toBe(true);
    expect(calls.every((call) => call.address === CAPSULE)).toBe(true);
    expect(calls[0].stack).toEqual([{ type: 'num', value: '0x7' }]);
  });

  it('CAPHUB-RPC-02: falls back to broad history lookup when exact body_hash lookup returns no body', async () => {
    const privateHeader0 = tonCell.snakeCellFromBytes(new Uint8Array([0x10]), 'private header0');
    const privateHeader1 = tonCell.snakeCellFromBytes(privateHeader1Bytes(1_700_000_000), 'private header1');
    const privateBody = tonCell.snakeCellFromBytes(new Uint8Array([0x12]), 'private body');
    const privateHeader0Hash = await cellHashInt(privateHeader0);
    const privateHeader1Hash = await cellHashInt(privateHeader1);
    const privateBodyHash = await cellHashInt(privateBody);
    const privateMessageBody = cellBoc(tonCell.beginCell()
      .uint(0xA4F862C0n, 32, 'op')
      .uint(1n, 64, 'bounce_id')
      .uint(2n, 160, 'bounce_tag')
      .uint(0xcccdn, 256, 'publish_id')
      .uint(1n, 8, 'size_class')
      .uint(2n, 8, 'crypto_suite')
      .uint(privateHeader0Hash, 256, 'header_0_hash')
      .ref(tonCell.beginCell()
        .uint(privateHeader1Hash, 256, 'header_1_hash')
        .uint(privateBodyHash, 256, 'body_hash')
        .ref(privateHeader0, 'header_0')
        .ref(privateHeader1, 'header_1')
        .ref(privateBody, 'body')
        .uint(10_000_000n, 128, 'protocol_fee_paid')
        .endCell(), 'payload')
      .endCell());
    const entry = {
      exists: true,
      entry_id: 11n,
      entry_uid: 0x111n,
      publish_id: 0xcccdn,
      author_wallet: VAULT,
      created_at: 1_700_000_123n,
      header_0_hash: privateHeader0Hash,
      header_1_hash: privateHeader1Hash,
      body_hash: privateBodyHash,
      header_0_boc: cellBoc(privateHeader0),
      header_1_boc: cellBoc(privateHeader1),
      body_boc: null,
    };
    const messageCalls: any[] = [];
    const transport = {
      async runGetMethod() {
        throw new Error('unexpected runGetMethod');
      },
      async getMessages(params: any) {
        messageCalls.push(params);
        if (params.body_hash) return { messages: [] };
        return { messages: [{ message_content: { body: privateMessageBody } }] };
      },
    };
    const provider = createCapsuleHubTonRpcProvider({ capsuleHubAddress: CAPSULE, transport });

    await expect(provider.resolvePrivateEntryBody(entry)).resolves.toMatchObject({
      body_boc: cellBoc(privateBody),
    });

    expect(messageCalls).toHaveLength(2);
    expect(messageCalls[0]).toMatchObject({
      body_hash: privateBodyHash.toString(16).padStart(64, '0'),
      limit: 10,
      sort: 'asc',
    });
    expect(messageCalls[1]).not.toHaveProperty('body_hash');
    expect(messageCalls[1]).toMatchObject({
      limit: 1000,
      sort: 'asc',
    });
  });

  it('CAPHUB-RPC-03: paginates broad message history before reporting a missing body', async () => {
    const privateHeader0 = tonCell.snakeCellFromBytes(new Uint8Array([0x10]), 'private header0');
    const privateHeader1 = tonCell.snakeCellFromBytes(privateHeader1Bytes(1_700_000_000), 'private header1');
    const privateBody = tonCell.snakeCellFromBytes(new Uint8Array([0x12]), 'private body');
    const privateHeader0Hash = await cellHashInt(privateHeader0);
    const privateHeader1Hash = await cellHashInt(privateHeader1);
    const privateBodyHash = await cellHashInt(privateBody);
    const privateMessageBody = cellBoc(tonCell.beginCell()
      .uint(0xA4F862C0n, 32, 'op')
      .uint(1n, 64, 'bounce_id')
      .uint(2n, 160, 'bounce_tag')
      .uint(0xddddn, 256, 'publish_id')
      .uint(1n, 8, 'size_class')
      .uint(2n, 8, 'crypto_suite')
      .uint(privateHeader0Hash, 256, 'header_0_hash')
      .ref(tonCell.beginCell()
        .uint(privateHeader1Hash, 256, 'header_1_hash')
        .uint(privateBodyHash, 256, 'body_hash')
        .ref(privateHeader0, 'header_0')
        .ref(privateHeader1, 'header_1')
        .ref(privateBody, 'body')
        .uint(10_000_000n, 128, 'protocol_fee_paid')
        .endCell(), 'payload')
      .endCell());
    const entry = {
      exists: true,
      entry_id: 12n,
      entry_uid: 0x1212n,
      publish_id: 0xddddn,
      author_wallet: VAULT,
      created_at: 1_700_000_123n,
      header_0_hash: privateHeader0Hash,
      header_1_hash: privateHeader1Hash,
      body_hash: privateBodyHash,
      header_0_boc: cellBoc(privateHeader0),
      header_1_boc: cellBoc(privateHeader1),
      body_boc: null,
    };
    const messageCalls: any[] = [];
    const transport = {
      async runGetMethod() {
        throw new Error('unexpected runGetMethod');
      },
      async getMessages(params: any) {
        messageCalls.push(params);
        if (params.body_hash) return { messages: [] };
        if (Number(params.offset ?? 0) < 1000) {
          return { messages: Array.from({ length: 1000 }, (_item, index) => ({ id: index })) };
        }
        return { messages: [{ message_content: { body: privateMessageBody } }] };
      },
    };
    const provider = createCapsuleHubTonRpcProvider({ capsuleHubAddress: CAPSULE, transport });

    await expect(provider.resolvePrivateEntryBody(entry)).resolves.toMatchObject({
      body_boc: cellBoc(privateBody),
    });

    expect(messageCalls.map((call) => call.offset ?? 0)).toEqual([0, 0, 1000]);
    expect(messageCalls[1]).toMatchObject({ limit: 1000 });
    expect(messageCalls[2]).toMatchObject({ limit: 1000, offset: 1000 });
  });

  it('CAPHUB-RPC-04: reports missing publish body as BODY_HISTORY_UNAVAILABLE', async () => {
    const privateHeader0 = tonCell.snakeCellFromBytes(new Uint8Array([0x10]), 'private header0');
    const privateHeader1 = tonCell.snakeCellFromBytes(privateHeader1Bytes(1_700_000_000), 'private header1');
    const privateBody = tonCell.snakeCellFromBytes(new Uint8Array([0x12]), 'private body');
    const entry = {
      exists: true,
      entry_id: 13n,
      entry_uid: 0x1313n,
      publish_id: 0xeeeen,
      author_wallet: VAULT,
      created_at: 1_700_000_123n,
      header_0_hash: await cellHashInt(privateHeader0),
      header_1_hash: await cellHashInt(privateHeader1),
      body_hash: await cellHashInt(privateBody),
      header_0_boc: cellBoc(privateHeader0),
      header_1_boc: cellBoc(privateHeader1),
      body_boc: null,
    };
    const transport = {
      async runGetMethod() {
        throw new Error('unexpected runGetMethod');
      },
      async getMessages() {
        return { messages: [] };
      },
    };
    const provider = createCapsuleHubTonRpcProvider({ capsuleHubAddress: CAPSULE, transport });

    await expect(provider.resolvePrivateEntryBody(entry)).rejects.toMatchObject({
      name: 'CapsuleHubTonRpcProviderError',
      code: 'BODY_HISTORY_UNAVAILABLE',
      entryId: '13',
      kind: 'private',
    });
    await provider.resolvePrivateEntryBody(entry).catch((error) => {
      expect(isCapsuleHubBodyHistoryUnavailable(error)).toBe(true);
    });
  });

  it('CAPHUB-RPC-05: tries the next message-history provider when the first returns an empty page', async () => {
    const privateHeader0 = tonCell.snakeCellFromBytes(new Uint8Array([0x10]), 'private header0');
    const privateHeader1 = tonCell.snakeCellFromBytes(privateHeader1Bytes(1_700_000_000), 'private header1');
    const privateBody = tonCell.snakeCellFromBytes(new Uint8Array([0x12]), 'private body');
    const privateHeader0Hash = await cellHashInt(privateHeader0);
    const privateHeader1Hash = await cellHashInt(privateHeader1);
    const privateBodyHash = await cellHashInt(privateBody);
    const privateMessageBody = cellBoc(tonCell.beginCell()
      .uint(0xA4F862C0n, 32, 'op')
      .uint(1n, 64, 'bounce_id')
      .uint(2n, 160, 'bounce_tag')
      .uint(0xabcdn, 256, 'publish_id')
      .uint(1n, 8, 'size_class')
      .uint(2n, 8, 'crypto_suite')
      .uint(privateHeader0Hash, 256, 'header_0_hash')
      .ref(tonCell.beginCell()
        .uint(privateHeader1Hash, 256, 'header_1_hash')
        .uint(privateBodyHash, 256, 'body_hash')
        .ref(privateHeader0, 'header_0')
        .ref(privateHeader1, 'header_1')
        .ref(privateBody, 'body')
        .uint(10_000_000n, 128, 'protocol_fee_paid')
        .endCell(), 'payload')
      .endCell());
    const entry = {
      exists: true,
      entry_id: 14n,
      entry_uid: 0x1414n,
      publish_id: 0xabcdn,
      author_wallet: VAULT,
      created_at: 1_700_000_123n,
      header_0_hash: privateHeader0Hash,
      header_1_hash: privateHeader1Hash,
      body_hash: privateBodyHash,
      header_0_boc: cellBoc(privateHeader0),
      header_1_boc: cellBoc(privateHeader1),
      body_boc: null,
    };
    const calls: string[] = [];
    const transport = createFallbackTonRpcTransport({
      transports: [
        {
          kind: 'empty-history',
          async getMessages(params: any) {
            calls.push(`empty:${params.body_hash ? 'exact' : 'broad'}`);
            return { messages: [] };
          },
        },
        {
          kind: 'archive-history',
          async getMessages(params: any) {
            calls.push(`archive:${params.body_hash ? 'exact' : 'broad'}`);
            return { messages: [{ message_content: { body: privateMessageBody } }] };
          },
        },
      ],
    });
    const provider = createCapsuleHubTonRpcProvider({ capsuleHubAddress: CAPSULE, transport });

    await expect(provider.resolvePrivateEntryBody(entry)).resolves.toMatchObject({
      body_boc: cellBoc(privateBody),
    });
    expect(calls).toEqual(['empty:exact', 'archive:exact']);
  });

  it('CAPHUB-RPC-06: rejects a mismatched history body and accepts a later verified provider body', async () => {
    const privateHeader0 = tonCell.snakeCellFromBytes(new Uint8Array([0x10]), 'private header0');
    const privateHeader1 = tonCell.snakeCellFromBytes(privateHeader1Bytes(1_700_000_000), 'private header1');
    const privateBody = tonCell.snakeCellFromBytes(new Uint8Array([0x12]), 'private body');
    const wrongBody = tonCell.snakeCellFromBytes(new Uint8Array([0xff]), 'wrong private body');
    const privateHeader0Hash = await cellHashInt(privateHeader0);
    const privateHeader1Hash = await cellHashInt(privateHeader1);
    const privateBodyHash = await cellHashInt(privateBody);
    const buildMessageBody = (bodyCell: any) => cellBoc(tonCell.beginCell()
      .uint(0xA4F862C0n, 32, 'op')
      .uint(1n, 64, 'bounce_id')
      .uint(2n, 160, 'bounce_tag')
      .uint(0xbcden, 256, 'publish_id')
      .uint(1n, 8, 'size_class')
      .uint(2n, 8, 'crypto_suite')
      .uint(privateHeader0Hash, 256, 'header_0_hash')
      .ref(tonCell.beginCell()
        .uint(privateHeader1Hash, 256, 'header_1_hash')
        .uint(privateBodyHash, 256, 'body_hash')
        .ref(privateHeader0, 'header_0')
        .ref(privateHeader1, 'header_1')
        .ref(bodyCell, 'body')
        .uint(10_000_000n, 128, 'protocol_fee_paid')
        .endCell(), 'payload')
      .endCell());
    const entry = {
      exists: true,
      entry_id: 15n,
      entry_uid: 0x1515n,
      publish_id: 0xbcden,
      author_wallet: VAULT,
      created_at: 1_700_000_123n,
      header_0_hash: privateHeader0Hash,
      header_1_hash: privateHeader1Hash,
      body_hash: privateBodyHash,
      header_0_boc: cellBoc(privateHeader0),
      header_1_boc: cellBoc(privateHeader1),
      body_boc: null,
    };
    const calls: string[] = [];
    const transport = createFallbackTonRpcTransport({
      transports: [
        {
          kind: 'wrong-history',
          async getMessages(params: any) {
            calls.push(`wrong:${params.body_hash ? 'exact' : 'broad'}`);
            return { messages: [{ message_content: { body: buildMessageBody(wrongBody) } }] };
          },
        },
        {
          kind: 'archive-history',
          async getMessages(params: any) {
            calls.push(`archive:${params.body_hash ? 'exact' : 'broad'}`);
            return { messages: [{ message_content: { body: buildMessageBody(privateBody) } }] };
          },
        },
      ],
    });
    const provider = createCapsuleHubTonRpcProvider({ capsuleHubAddress: CAPSULE, transport });

    await expect(provider.resolvePrivateEntryBody(entry)).resolves.toMatchObject({
      body_boc: cellBoc(privateBody),
    });
    expect(calls).toEqual(['wrong:exact', 'archive:exact']);
  });
});
