import { beforeEach, describe, expect, it } from 'vitest';
import {
  createTonAccessV2VaultTransport,
  __clearTonAccessNodesCacheForTests,
} from '../web/vault-ton-rpc-provider.mjs';

const ADDR = `0:${'a'.repeat(64)}`;

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

function makeFetch(handlers: Record<string, unknown>, calls: any[] = []) {
  const fetchImpl = async (url: unknown, init: unknown) => {
    const u = String(url);
    calls.push({ url: u, init });
    if (u.includes('/mngr/nodes')) {
      return jsonResponse(handlers.nodes ?? [
        { Healthy: '1', NodeId: 'node1abc', Weight: 1, Mngr: { health: { 'v2-testnet': true } } },
      ]);
    }
    if (u.includes('/jsonRPC')) return jsonResponse(handlers.jsonRPC ?? { ok: true, result: { exit_code: 0, stack: [] } });
    if (u.includes('/sendBoc')) return jsonResponse(handlers.sendBoc ?? { ok: true });
    if (u.includes('/getAddressInformation')) return jsonResponse(handlers.account ?? { ok: true, result: { balance: '123' } });
    if (u.includes('/getTransactions')) return jsonResponse(handlers.transactions ?? { ok: true, transactions: [] });
    return jsonResponse({ error: `unexpected ${u}` }, false, 404);
  };
  return { fetchImpl, calls };
}

function makeTransport(handlers: Record<string, unknown> = {}, calls: any[] = []) {
  const { fetchImpl } = makeFetch(handlers, calls);
  return createTonAccessV2VaultTransport({
    fetch: fetchImpl,
    host: 'orbs.test',
    network: 'testnet',
    requestSpacingMs: 0,
    rateLimitRetries: 0,
  });
}

describe('TON Access (Orbs) v2 transport', () => {
  beforeEach(() => __clearTonAccessNodesCacheForTests());

  it('ORBS-01: runGetMethod converts v3 stack -> v2 legacy request and normalizes the v2 response to v3', async () => {
    const calls: any[] = [];
    const transport = makeTransport({
      jsonRPC: { ok: true, result: { exit_code: 0, stack: [['num', '0x10'], ['tvm.Slice', 'deadbeef']] } },
    }, calls);

    const result = await transport.runGetMethod({
      address: ADDR,
      method: 'get_global',
      stack: [{ type: 'slice', value: 'abcd' }],
      cacheTtlMs: 0,
    });

    expect(result.exit_code).toBe(0);
    expect(result.stack).toEqual([
      { type: 'num', value: '0x10' },
      { type: 'slice', value: 'deadbeef', boc: 'deadbeef' },
    ]);
    expect(result.result.stack).toEqual(result.stack);

    const jsonRpcCall = calls.find((c) => c.url.includes('/jsonRPC'));
    const body = JSON.parse(jsonRpcCall.init.body);
    expect(body).toMatchObject({ jsonrpc: '2.0', method: 'runGetMethod' });
    expect(body.params.stack).toEqual([['tvm.Slice', 'abcd']]);
  });

  it('ORBS-02: builds the upstream URL from a healthy node id, host and network', async () => {
    const calls: any[] = [];
    const transport = makeTransport({}, calls);
    await transport.runGetMethod({ address: ADDR, method: 'get_global', stack: [], cacheTtlMs: 0 });
    const jsonRpcCall = calls.find((c) => c.url.includes('/jsonRPC'));
    expect(jsonRpcCall.url).toBe('https://orbs.test/node1abc/1/testnet/toncenter-api-v2/jsonRPC');
  });

  it('ORBS-03: getAccountBalance reads the balance from the v2 account read', async () => {
    const transport = makeTransport({ account: { ok: true, result: { balance: '777' } } });
    await expect(transport.getAccountBalance(ADDR, { cacheTtlMs: 0 })).resolves.toBe('777');
  });

  it('ORBS-04: sendBoc posts the boc to the node /sendBoc path', async () => {
    const calls: any[] = [];
    const transport = makeTransport({ sendBoc: { ok: true } }, calls);
    await transport.sendBoc({ boc: 'te6ccgTEST' });
    const sendCall = calls.find((c) => c.url.includes('/sendBoc'));
    expect(sendCall.url).toBe('https://orbs.test/node1abc/1/testnet/toncenter-api-v2/sendBoc');
    expect(JSON.parse(sendCall.init.body)).toEqual({ boc: 'te6ccgTEST' });
  });

  it('ORBS-05: rejects nodes with an invalid NodeId, and fails when none remain', async () => {
    const transport = makeTransport({
      nodes: [{ Healthy: '1', NodeId: 'bad/id../x', Weight: 1, Mngr: { health: { 'v2-testnet': true } } }],
    });
    await expect(transport.getAccountState(ADDR, { cacheTtlMs: 0 }))
      .rejects.toThrow(/no healthy v2 node/i);
  });

  it('ORBS-06: has no message-history indexer (so the fallback layer routes history to a keyed transport)', () => {
    const transport = makeTransport();
    expect(transport.supportsMessageHistory).toBe(false);
    expect(transport.supportsSendBoc).toBe(true);
    expect(typeof (transport as any).getMessages).toBe('undefined');
  });

  it('ORBS-07: getTransactions hits the v2 transactions path (keyless body-scan foundation)', async () => {
    const calls: any[] = [];
    const transport = makeTransport({ transactions: { ok: true, transactions: [{ x: 1 }] } }, calls);
    const out = await transport.getTransactions({ address: ADDR, limit: 5 });
    expect(out.transactions).toEqual([{ x: 1 }]);
    const txCall = calls.find((c) => c.url.includes('/getTransactions'));
    expect(txCall.url).toContain('https://orbs.test/node1abc/1/testnet/toncenter-api-v2/getTransactions');
    expect(txCall.url).toContain(`address=${encodeURIComponent(ADDR)}`);
  });

  it('ORBS-08: a non-zero get-method exit code is surfaced as an error with exitCode', async () => {
    const transport = makeTransport({ jsonRPC: { ok: true, result: { exit_code: 11, stack: [] } } });
    await expect(transport.runGetMethod({ address: ADDR, method: 'get_global', stack: [], cacheTtlMs: 0 }))
      .rejects.toMatchObject({ exitCode: 11 });
  });

  it('ORBS-09: an upstream ok:false (uninitialized account, HTTP 200, no result) throws, preserving the -13 signal', async () => {
    const calls: any[] = [];
    const transport = makeTransport({
      jsonRPC: { ok: false, error: 'smart contract is not active', code: -13 },
    }, calls);
    // Must throw with exitCode -13 (not resolve to an empty-stack success) so the wallet-seqno
    // deploy-on-first-transfer path still recognizes the uninitialized account.
    await expect(transport.runGetMethod({ address: ADDR, method: 'seqno', stack: [], cacheTtlMs: 0 }))
      .rejects.toMatchObject({ exitCode: -13 });
  });

  it('ORBS-10: a non-zero exit code is honored at the top level and in camelCase, matching the toncenter path', async () => {
    const topLevel = makeTransport({ jsonRPC: { ok: true, exit_code: 5, result: { stack: [] } } });
    await expect(topLevel.runGetMethod({ address: ADDR, method: 'get_global', stack: [], cacheTtlMs: 0 }))
      .rejects.toMatchObject({ exitCode: 5 });

    const camel = makeTransport({ jsonRPC: { ok: true, result: { exitCode: 7, stack: [] } } });
    await expect(camel.runGetMethod({ address: ADDR, method: 'get_global', stack: [], cacheTtlMs: 0 }))
      .rejects.toMatchObject({ exitCode: 7 });
  });

  it('ORBS-11: getTransactions surfaces an HTTP-200 {ok:false} (e.g. v2 limit>100 validation, code:422) as a thrown error, not an empty page', async () => {
    // A swallowed {ok:false} reads to the keyless body-scan as "account has no matching tx" and the body
    // recovery gives up forever; it must throw so the scan records a real failure instead of a silent zero.
    const transport = makeTransport({
      transactions: { ok: false, error: 'Validation error: limit must be less than or equal to 100', code: 422 },
    });
    await expect(transport.getTransactions({ address: ADDR, limit: 1000 }))
      .rejects.toThrow(/transactions failed/i);
  });
});
