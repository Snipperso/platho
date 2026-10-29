import { describe, it, expect } from 'vitest';
import { hasIncompletePublicStream } from '../web/public-shard-ton-rpc-provider.mjs';


function post(streamIdByte: string, partIndex: number, partCount: number) {
  const header = new Uint8Array(28);
  header.set(new TextEncoder().encode('PPH2'), 0);
  header[4] = 2;
  header[5] = 0;
  header.fill(Number.parseInt(streamIdByte, 16), 8, 24);
  header[24] = (partIndex >> 8) & 0xff;
  header[25] = partIndex & 0xff;
  header[26] = (partCount >> 8) & 0xff;
  header[27] = partCount & 0xff;
  return { header: { data: header, bitLength: header.length * 8, refs: [] } };
}

describe('PUBLIC shard read — multipart straddle detection (hasIncompletePublicStream)', () => {
  it('reports a split stream while a k-part group is missing parts, and clears once every part is seen', () => {
    expect(hasIncompletePublicStream([post('aa', 0, 3)])).toBe(true);
    expect(hasIncompletePublicStream([post('aa', 0, 3), post('aa', 1, 3)])).toBe(true);
    expect(hasIncompletePublicStream([post('aa', 0, 3), post('aa', 1, 3), post('aa', 2, 3)])).toBe(false);
  });

  it('ignores single-part posts (never forces a straddle extension for a normal post)', () => {
    expect(hasIncompletePublicStream([post('bb', 0, 1), post('cc', 0, 1)])).toBe(false);
  });

  it('deduplicates a repeated partIndex — a re-seen part does not falsely close the group', () => {
    expect(hasIncompletePublicStream([post('dd', 0, 3), post('dd', 0, 3), post('dd', 1, 3)])).toBe(true);
  });

  it('tracks several independent streams and reports incomplete if ANY one is open', () => {
    const complete = [post('ee', 0, 2), post('ee', 1, 2)];
    const open = [post('ff', 1, 2)];
    expect(hasIncompletePublicStream(complete)).toBe(false);
    expect(hasIncompletePublicStream([...complete, ...open])).toBe(true);
  });

  it('treats an unparseable header as single-part (a foreign body can never force an endless extension)', () => {
    expect(hasIncompletePublicStream([{ header: null }, { header: { data: new Uint8Array(4), bitLength: 32, refs: [] } }])).toBe(false);
  });
});
