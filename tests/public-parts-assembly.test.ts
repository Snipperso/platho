import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// "Error: Document message has trailing bytes" — every comment on a post gone, and the screen blaming the
// connection. Reported by the owner 2026-08-20 off a live post.
//
// assemblePublicParts checked completeness by counting DISTINCT part indices and then joined EVERY part it held.
// A part read twice therefore passed the check and was concatenated twice, so the assembled document ran past its
// last block and the decoder threw — out of the whole assembly, taking the entire thread with it.
//
// Duplicates are ordinary rather than exotic: a thread's comments are read across several era shards and one
// message can legitimately land in more than one window.
//
// Two further holes came out of the same reading, and both are gated here: the group key had no AUTHOR in it (a
// comment thread accepts writes from anyone, so a stranger reusing a streamId joined their bytes to someone
// else's comment), and one undecodable group aborted every other group in the same pass.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const app = readFileSync('web/app.js', 'utf8');

/** Lift assemblePublicParts out of app.js and run it against stubs for the helpers it calls. */
function loadAssemble() {
  const start = app.indexOf('function assemblePublicParts(items)');
  expect(start).toBeGreaterThan(-1);
  const end = app.indexOf('\n// --- Channel profile cache', start);
  expect(end).toBeGreaterThan(start);
  const source = app.slice(start, end);
  const prelude = `
    // A document is [1-byte block count][block bytes...]; anything after the declared blocks is trailing.
    const decodeMessageDocumentBlocks = (bytes) => {
      const count = bytes[0];
      if (bytes.length !== 1 + count) throw new Error('Document message has trailing bytes');
      return Array.from(bytes.slice(1)).map((b) => ({ type: 'text', text: String.fromCharCode(b) }));
    };
    const displayBlocksFromDocumentBlocks = (blocks) => blocks;
    const messagePreviewFromBlocks = (blocks) => blocks.map((b) => b.text).join('');
    const publicEntryIdBigInt = (id) => { try { return BigInt(String(id).replace(/[^0-9]/g, '') || '0'); } catch { return null; } };
    const bytesToImageDataUrl = () => 'data:image/webp;base64,stub';
    const console = { warn() {} };
  `;
  // eslint-disable-next-line no-new-func
  return new Function(`${prelude}\n${source}\nreturn assemblePublicParts;`)();
}

const docPart = (over: Record<string, unknown>) => ({
  channelId: 'ch', authorWallet: '0:aa', streamId: 's1', parentEntryId: 'p1', parentHash: '0xph',
  entryId: 'c-1', partCount: 2, ...over,
});

describe('PARTS — multipart assembly survives the real world', () => {
  it('PARTS-01: a part delivered twice assembles once, not one-and-a-half times', () => {
    const assemble = loadAssemble();
    const a = docPart({ partIndex: 0, documentBytes: new Uint8Array([2, 72]) });   // count=2, first byte
    const b = docPart({ partIndex: 1, documentBytes: new Uint8Array([73]) });      // second byte
    // The duplicate is the exact shape a two-shard read produces.
    const out = assemble([a, b, { ...a }]);
    expect(out).toHaveLength(1);
    expect(out[0].text, 'the duplicate part was concatenated again').toBe('HI');
  });

  it('PARTS-02: a stranger cannot join their bytes to another author comment', () => {
    const assemble = loadAssemble();
    const mine = [
      docPart({ authorWallet: '0:aa', partIndex: 0, documentBytes: new Uint8Array([2, 72]) }),
      docPart({ authorWallet: '0:aa', partIndex: 1, documentBytes: new Uint8Array([73]) }),
    ];
    // Same channel, same streamId, same parent — everything the old key looked at — but a different publisher.
    const theirs = docPart({ authorWallet: '0:bb', partIndex: 1, documentBytes: new Uint8Array([88]) });
    // THE INTRUDER GOES FIRST, and that ordering is the whole test. With them last, per-index dedup already drops
    // their part as a repeat and the case passes without the author ever being consulted — which is exactly how
    // this gate read green against the unfixed key the first time it ran.
    const out = assemble([theirs, ...mine]);
    const texts = out.map((entry: any) => entry.text);
    expect(texts).toContain('HI');
    expect(texts.join(''), 'the intruder byte reached a comment that was not theirs').not.toContain('X');
  });

  it('PARTS-03: one undecodable group does not empty the thread', () => {
    const assemble = loadAssemble();
    const good = [
      docPart({ streamId: 'ok', entryId: 'c-ok', partIndex: 0, documentBytes: new Uint8Array([2, 79]) }),
      docPart({ streamId: 'ok', entryId: 'c-ok', partIndex: 1, documentBytes: new Uint8Array([75]) }),
    ];
    // Declares one block and carries three bytes: exactly the failure the owner saw.
    const broken = [
      docPart({ streamId: 'bad', entryId: 'c-bad', partIndex: 0, documentBytes: new Uint8Array([1, 66, 66]) }),
      docPart({ streamId: 'bad', entryId: 'c-bad', partIndex: 1, documentBytes: new Uint8Array([66]) }),
    ];
    const out = assemble([...broken, ...good]);
    expect(out.map((entry: any) => entry.text), 'the good comment went down with the bad one').toContain('OK');
  });

  it('PARTS-04: an incomplete multipart group is still dropped', () => {
    const assemble = loadAssemble();
    // Two parts expected, only one present — and now that duplicates collapse, a repeat of part 0 must NOT be
    // mistaken for the missing part 1.
    const only = docPart({ partIndex: 0, documentBytes: new Uint8Array([2, 72]) });
    expect(assemble([only, { ...only }])).toEqual([]);
  });
});
