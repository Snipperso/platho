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
  it('CAPHUB-RPC-PROFILE-01: get_public_entry decodes clean-11 14-field (profile_prev_link) AND clean-10 13-field (0n)', async () => {
    const headerMarker = tonCell.beginCell().endCell();
    const baseFields = () => ([
      num(1n),  // exists
      num(7n),  // entry_id
      num(0n),  // entry_uid
      num(0n),  // publish_id
      { type: 'slice', value: encodeTonAddressSliceBoc(AUTHOR) },
      num(0n), num(0n), num(0n), num(0n), num(0n),
      num(0n),  // parent_link
      num(3n),  // prev_link
    ]);
    const transportFor = (fieldCount: number) => ({
      async runGetMethod() {
        const stack = fieldCount === 14
          ? [...baseFields(), num(42n), { type: 'cell', value: cellBoc(headerMarker) }] // profile_prev_link=42 @12, header @13
          : [...baseFields(), { type: 'cell', value: cellBoc(headerMarker) }];          // header @12
        return { stack };
      },
    });
    const clean11 = await createCapsuleHubTonRpcProvider({ capsuleHubAddress: CAPSULE, transport: transportFor(14) }).getPublicEntry(7n, { cacheTtlMs: 0 });
    expect(clean11.prev_link).toBe(3n);
    expect(clean11.profile_prev_link).toBe(42n);
    expect(typeof clean11.header_boc).toBe('string');
    const clean10 = await createCapsuleHubTonRpcProvider({ capsuleHubAddress: CAPSULE, transport: transportFor(13) }).getPublicEntry(7n, { cacheTtlMs: 0 });
    expect(clean10.prev_link).toBe(3n);
    expect(clean10.profile_prev_link).toBe(0n); // clean-10 has no profile_prev_link -> uniform 0n for callers
    expect(typeof clean10.header_boc).toBe('string');
    // A malformed length (not 13 or 14) is rejected.
    await expect(
      createCapsuleHubTonRpcProvider({ capsuleHubAddress: CAPSULE, transport: { async runGetMethod() { return { stack: baseFields() }; } } }).getPublicEntry(7n, { cacheTtlMs: 0 }),
    ).rejects.toThrow(/ABI mismatch/);
  });

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
        if (call.method === 'get_private_recipient_index' || call.method === 'get_private_sender_index') {
          return {
            stack: [
              num(-1n),
              call.stack[0],
              num(8n),
              num(9n),
              num(3n),
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
              num(0n), // parent_link
              num(0n), // prev_link
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
            num(0n),
            num(0n),
            num(0n),
            num(0n),
            num(0n),
            num(1n),
            num(1n),
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
    await provider.getPrivateRecipientIndex(0x123n, {
      cacheTtlMs: 0,
      priority: 'critical',
      verify: true,
    });
    await provider.getPrivateSenderIndex(0x456n, {
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
      method: 'get_private_recipient_index',
      cacheTtlMs: 0,
      priority: 'critical',
      verify: true,
    });
    expect(calls[3]).toMatchObject({
      method: 'get_private_sender_index',
      cacheTtlMs: 0,
      priority: 'critical',
      verify: true,
    });
    expect(calls[4]).toMatchObject({
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
      .uint(1n, 8, 'size_class')
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
              num(6n),
              num(5n),
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
              num(0n), // parent_link
              num(0n), // prev_link
              { type: 'cell', value: cellBoc(publicHeader) },
            ],
          };
        }
        if (call.method === 'get_private_recipient_index' || call.method === 'get_private_sender_index') {
          return {
            stack: [
              ['num', '-0x1'],
              call.stack[0],
              ['num', '0x7'],
              ['num', '0x8'],
              ['num', '0x2'],
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
      sender_prev_link: 6n,
      recipient_prev_link: 5n,
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
      size_class: 1n,
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
    await expect(provider.getPrivateRecipientIndex(0x101n)).resolves.toMatchObject({
      exists: true,
      key_id: 0x101n,
      latest_entry_id: 7n,
      latest_entry_link: 8n,
      entry_count: 2n,
    });
    await expect(provider.getPrivateSenderIndex(0x202n)).resolves.toMatchObject({
      exists: true,
      key_id: 0x202n,
      latest_entry_id: 7n,
      latest_entry_link: 8n,
      entry_count: 2n,
    });
    await expect(provider.getPrivatePage(0n)).resolves.toMatchObject({
      exists: true,
      page_id: 0n,
      entry_count: 8n,
      opened_at: 0n,
      updated_at: 0n,
    });

    expect(calls.map((call) => call.method)).toEqual([
      'get_private_entry',
      'get_public_entry',
      'get_state',
      'get_private_recipient_index',
      'get_private_sender_index',
      'get_private_page',
    ]);
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

  it('CAPHUB-TXSCAN-01: keyless body retrieval scans transactions (no indexer) and hash-verifies the v2 in_msg body', async () => {
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

    let txScanCalls = 0;
    let txScanLimit: number | null = null;
    const transport = {
      async runGetMethod(call: { method: string }) {
        if (call.method === 'get_private_entry') {
          return {
            stack: [
              num(-1n), num(7n), num(6n), num(5n), num(0x777n), num(0xaaaan),
              { type: 'slice', value: encodeTonAddressSliceBoc(AUTHOR) },
              num(0n), num(7n), num(1_700_000_123n),
              num(privateHeader0Hash), num(privateHeader1Hash), num(privateBodyHash),
              { type: 'cell', value: cellBoc(privateHeader0) },
              { type: 'cell', value: cellBoc(privateHeader1) },
            ],
          };
        }
        throw new Error(`unexpected method ${call.method}`);
      },
      // No getMessages (no indexer): the keyless Orbs transport only scans an account's transactions,
      // returning the publish body in the toncenter v2 in_msg.msg_data.body shape.
      async getTransactions(params: any) {
        txScanCalls += 1;
        txScanLimit = params?.limit ?? null;
        return { result: [{ in_msg: { msg_data: { body: privateMessageBody } } }] };
      },
    };

    const provider = createCapsuleHubTonRpcProvider({ capsuleHubAddress: CAPSULE, transport });
    const entry = await provider.getPrivateEntry(7n);
    await expect(provider.resolvePrivateEntryBody(entry, { priority: 'critical', messageCacheTtlMs: 0 }))
      .resolves.toMatchObject({ body_boc: cellBoc(privateBody) });
    expect(txScanCalls).toBeGreaterThan(0);
    // E1: toncenter v2 /getTransactions rejects limit > 100 with an HTTP-200 {ok:false,code:422} body
    // (the keyless Orbs proxy forwards it verbatim). The tx-scan must request the v2 max, NOT the 1000
    // used for the v3 getMessages indexer — sending 1000 made every keyless body scan come back empty.
    expect(txScanLimit).toBe(100);
  });

  it('CAPHUB-TXSCAN-02: keeps paging past a server-clamped short first page (cursor-driven, not length<limit)', async () => {
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
    // A neighbouring non-publish transaction on the busy CapsuleHub account (skipped by the op check).
    const decoyBody = cellBoc(tonCell.beginCell().uint(0x12345678n, 32, 'op').endCell());

    const txPages: any[] = [];
    const transport = {
      async runGetMethod(call: { method: string }) {
        if (call.method === 'get_private_entry') {
          return {
            stack: [
              num(-1n), num(7n), num(6n), num(5n), num(0x777n), num(0xaaaan),
              { type: 'slice', value: encodeTonAddressSliceBoc(AUTHOR) },
              num(0n), num(7n), num(1_700_000_123n),
              num(privateHeader0Hash), num(privateHeader1Hash), num(privateBodyHash),
              { type: 'cell', value: cellBoc(privateHeader0) },
              { type: 'cell', value: cellBoc(privateHeader1) },
            ],
          };
        }
        throw new Error(`unexpected method ${call.method}`);
      },
      // Page 0 is server-clamped to a single (non-matching) tx — length < requested limit — but the
      // account has older history; the body is only on page 2, reachable via the (lt,hash) cursor.
      async getTransactions(params: any) {
        txPages.push(params);
        if (!params.lt) {
          return { result: [{ transaction_id: { lt: '100', hash: 'h0' }, utime: 1_700_000_200, in_msg: { msg_data: { body: decoyBody } } }] };
        }
        return { result: [{ transaction_id: { lt: '50', hash: 'h1' }, utime: 1_700_000_123, in_msg: { msg_data: { body: privateMessageBody } } }] };
      },
    };

    const provider = createCapsuleHubTonRpcProvider({ capsuleHubAddress: CAPSULE, transport });
    const entry = await provider.getPrivateEntry(7n);
    await expect(provider.resolvePrivateEntryBody(entry, { priority: 'critical', messageCacheTtlMs: 0 }))
      .resolves.toMatchObject({ body_boc: cellBoc(privateBody) });
    // It did NOT treat the short first page as exhaustion — it followed the cursor to the next page.
    expect(txPages.length).toBeGreaterThanOrEqual(2);
    expect(txPages[1]).toMatchObject({ lt: '100', hash: 'h0' });
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
    expect(messageCalls[0]).not.toHaveProperty('source');
    expect(messageCalls[1]).not.toHaveProperty('body_hash');
    expect(messageCalls[1]).not.toHaveProperty('source');
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

  it('CAPHUB-RPC-04B: reports message-history HTTP failures as body history gaps', async () => {
    const privateHeader0 = tonCell.snakeCellFromBytes(new Uint8Array([0x10]), 'private header0');
    const privateHeader1 = tonCell.snakeCellFromBytes(privateHeader1Bytes(1_700_000_000), 'private header1');
    const privateBody = tonCell.snakeCellFromBytes(new Uint8Array([0x12]), 'private body');
    const entry = {
      exists: true,
      entry_id: 16n,
      entry_uid: 0x1616n,
      publish_id: 0xfeedn,
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
        const error: any = new Error('TON RPC messages HTTP 403');
        error.status = 403;
        error.code = 'HTTP_ERROR';
        throw error;
      },
    };
    const provider = createCapsuleHubTonRpcProvider({ capsuleHubAddress: CAPSULE, transport });

    await expect(provider.resolvePrivateEntryBody(entry)).rejects.toMatchObject({
      name: 'CapsuleHubTonRpcProviderError',
      code: 'BODY_HISTORY_UNAVAILABLE',
      entryId: '16',
      kind: 'private',
      historyScanIncomplete: true,
      historyError: expect.stringContaining('HTTP 403'),
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

  it('RT-VCAPS-005: refuses a verified publish body from the wrong source address', async () => {
    const wrongVault = `0:${'66'.repeat(32)}`;
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
      .uint(0xcafen, 256, 'publish_id')
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
      entry_id: 16n,
      entry_uid: 0x1616n,
      publish_id: 0xcafen,
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
          kind: 'wrong-source-history',
          async getMessages(params: any) {
            calls.push(`wrong:${params.body_hash ? 'exact' : 'broad'}:${params.source ?? 'no-source'}`);
            return { messages: [{ source: wrongVault, message_content: { body: privateMessageBody } }] };
          },
        },
        {
          kind: 'archive-history',
          async getMessages(params: any) {
            calls.push(`archive:${params.body_hash ? 'exact' : 'broad'}:${params.source ?? 'no-source'}`);
            return { messages: [{ source: VAULT, message_content: { body: privateMessageBody } }] };
          },
        },
      ],
    });
    const provider = createCapsuleHubTonRpcProvider({ capsuleHubAddress: CAPSULE, transport });

    await expect(provider.resolvePrivateEntryBody(entry, { vaultAddress: VAULT })).resolves.toMatchObject({
      body_boc: cellBoc(privateBody),
    });
    expect(calls).toEqual([
      'wrong:exact:no-source',
      'archive:exact:no-source',
    ]);
  });
});
