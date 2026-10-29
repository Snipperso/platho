import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createShardMessagesWithSourceReader } from '../web/shard-rpc.mjs';
import { CONV_READ_OPCODES, convReadOpcodesForGeneration } from '../web/conv-lane-read.mjs';


const DIRECT = 0x52535031;
const WRAPPED = 0x4D323143;

function endpointWith(rows: Array<{ opcode: number; lt: string; body: string }>) {
  const calls: string[] = [];
  const fetchImpl = async (url: string) => {
    calls.push(url);
    const asked = new URL(url).searchParams.get('opcode');
    const wanted = asked === null ? null : BigInt(asked);
    const messages = rows
      .filter((r) => wanted === null || BigInt(r.opcode) === wanted)
      .map((r) => ({
        hash: `h-${r.lt}`, source: 'EQD__________________________________________0', created_lt: r.lt,
        created_at: Number(r.lt), opcode: `0x${r.opcode.toString(16)}`,
        message_content: { body: r.body },
      }));
    return { ok: true, status: 200, json: async () => ({ messages }) };
  };
  return { fetchImpl, calls };
}

const EMPTY_BOC = 'te6cckEBAQEAAgAAAEysuc0=';

describe('SHARD-RPC OPCODE SET — every door the lane has, asked for through the transport', () => {
  it('RPCSET-01: a wrapped row is returned when the set names its opcode, and lost when it does not', async () => {
    const rows = [
      { opcode: WRAPPED, lt: '300', body: EMPTY_BOC },
      { opcode: DIRECT, lt: '200', body: EMPTY_BOC },
      { opcode: WRAPPED, lt: '100', body: EMPTY_BOC },
    ];

    const one = endpointWith(rows);
    const readDirectOnly = createShardMessagesWithSourceReader({
      endpoint: 'https://example.invalid', fetch: one.fetchImpl, opcode: DIRECT });
    const onlyDirect = await readDirectOnly('EQCshard');
    expect(onlyDirect.length, 'the direct-only reader sees one of three').toBe(1);
    expect(one.calls.length, 'and pays one request').toBe(1);

    const both = endpointWith(rows);
    const readBoth = createShardMessagesWithSourceReader({
      endpoint: 'https://example.invalid', fetch: both.fetchImpl, opcode: [DIRECT, WRAPPED] });
    const merged = await readBoth('EQCshard');
    expect(merged.length, 'every row is readable').toBe(3);
    expect(merged.map((m: any) => m.createdLt), 'merged newest first, across the two requests')
      .toEqual(['300', '200', '100']);
    expect(both.calls.length, 'one request per opcode').toBe(2);
    expect(both.calls.some((u) => u.includes('opcode=0x52535031')), 'the direct door was asked for').toBe(true);
    expect(both.calls.some((u) => u.includes('opcode=0x4d323143')), 'and the vault door was too').toBe(true);
  });

  it('RPCSET-02: the merged window is capped at `limit`, so a set cannot hand a lane twice its budget', async () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({
      opcode: i % 2 === 0 ? DIRECT : WRAPPED, lt: String(1000 - i), body: EMPTY_BOC }));
    const ep = endpointWith(rows);
    const read = createShardMessagesWithSourceReader({
      endpoint: 'https://example.invalid', fetch: ep.fetchImpl, opcode: [DIRECT, WRAPPED], limit: 5 });
    const out = await read('EQCshard');
    expect(out.length, 'the caller asked for five and gets five').toBe(5);
    expect(out.map((m: any) => m.createdLt), 'and they are the newest five of the merge')
      .toEqual(['1000', '999', '998', '997', '996']);
  });

  it('RPCSET-03: the CONV and PUBLIC lanes name the vault door from the flip — and a KNOWN generation asks its own door alone', () => {
    expect(CONV_READ_OPCODES.length, 'CONV names both doors on the flip build').toBe(2);
    expect(CONV_READ_OPCODES.map((o: any) => BigInt(o)), 'the direct one and the vault one').toEqual([BigInt(DIRECT), BigInt(WRAPPED)]);
    expect(convReadOpcodesForGeneration(17).map((o: any) => BigInt(o)), 'a clean-17 shard: the direct door alone').toEqual([BigInt(DIRECT)]);
    expect(convReadOpcodesForGeneration(18).map((o: any) => BigInt(o)), 'a clean-18 shard: the vault door alone').toEqual([BigInt(WRAPPED)]);
    const lane = readFileSync('web/public-lane.mjs', 'utf8');
    expect(lane, 'PUBLIC narrows a noted generation-17 address to PublicPublish').toContain('publicAddressGenerationOf(address) === 17');

    const conv = readFileSync('web/conv-lane-read.mjs', 'utf8');
    const pub = readFileSync('web/public-lane.mjs', 'utf8');
    for (const [name, src] of [['conv-lane-read', conv], ['public-lane', pub]] as const) {
      expect(src, `${name}: the set must switch on the write generation`).toMatch(/WRITES_GENERATION >= 18/);
      expect(src, `${name}: and must name the vault door on the far side`).toMatch(/M21C_VAULT_PUBLISH_OPCODE/);
    }
  });
});
