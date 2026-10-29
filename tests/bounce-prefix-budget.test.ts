import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';


const WIDTHS: Record<string, number> = {
  uint8: 8, uint16: 16, uint32: 32, uint64: 64, uint128: 128, uint160: 160, uint256: 256,
  int8: 8, int16: 16, int32: 32, int64: 64, int128: 128, int256: 256,
  coins: 124,
  Address: 267,
  Cell: 0,
};

const BOUNCE_FIELD_BUDGET_BITS = 224;

function messageFields(src: string, name: string): Array<[string, number]> {
  const re = new RegExp(`^message\\(0x[0-9A-Fa-f]+\\)\\s+${name}\\s*\\{([^}]*)\\}`, 'm');
  const m = src.match(re);
  if (!m) return [];
  const out: Array<[string, number]> = [];
  for (const raw of m[1].split('\n')) {
    const line = raw.replace(/\/\/.*$/, '').trim();
    if (!line || !line.includes(':')) continue;
    const fm = line.match(/^(\w+)\s*:\s*(.+?);?$/);
    if (!fm) continue;
    const [, field, type] = fm;
    const asMatch = type.match(/as\s+(\w+)/);
    const key = asMatch ? asMatch[1] : type.replace(/\s.*$/, '').trim();
    if (/remaining/.test(type)) break;
    out.push([field, WIDTHS[key] ?? Number.NaN]);
  }
  return out;
}

describe('bounced prefix budget', () => {
  it('BOUNCE-PREFIX-01: every field a bounced receiver reads fits inside the 224-bit budget', () => {
    const files = readdirSync('contracts').filter((f) => f.endsWith('.tact'));
    expect(files.length, 'the sweep must find the contracts').toBeGreaterThan(10);

    const problems: string[] = [];
    let checked = 0;

    for (const file of files) {
      const src = readFileSync(`contracts/${file}`, 'utf8');
      const receivers = [...src.matchAll(/bounced\((?:msg|_)\s*:\s*bounced<(\w+)>\)\s*\{([\s\S]*?)\n    \}/g)];
      for (const [, typeName, body] of receivers) {
        const fields = messageFields(src, typeName);
        if (fields.length === 0) continue;
        const touched = fields.filter(([f]) => new RegExp(`msg\\.${f}\\b`).test(body)).map(([f]) => f);
        if (touched.length === 0) continue;
        checked += 1;

        const lastIndex = Math.max(...touched.map((f) => fields.findIndex(([n]) => n === f)));
        let bits = 0;
        for (let i = 0; i <= lastIndex; i += 1) {
          const [fname, width] = fields[i];
          if (Number.isNaN(width)) {
            problems.push(`${file}: ${typeName}.${fname} — unknown width, teach WIDTHS about its type`);
            bits = Number.NaN;
            break;
          }
          bits += width;
        }
        if (Number.isNaN(bits)) continue;
        if (bits > BOUNCE_FIELD_BUDGET_BITS) {
          problems.push(`${file}: bounced<${typeName}> reads up to ${fields[lastIndex][0]} at ${bits} bits, past the `
            + `${BOUNCE_FIELD_BUDGET_BITS}-bit budget — the parser underflows, the bounce is consumed, and whatever `
            + 'the restore path was going to give back is lost for good');
        }
      }
    }

    expect(checked, 'the sweep must have measured real bounced receivers').toBeGreaterThan(8);
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('BOUNCE-PREFIX-02: the notification lane is AT the budget, so the zero margin is visible, not implied', () => {
    const src = readFileSync('contracts/ATHWallet.tact', 'utf8');
    const fields = messageFields(src, 'AthTransferNotification');
    const upToSenderKey = fields.slice(0, fields.findIndex(([n]) => n === 'sender_key') + 1);
    const bits = upToSenderKey.reduce((s, [, w]) => s + w, 0);
    expect(bits, 'query_id(64) + sender_key(160) is exactly the budget — widening either one loses the payer\'s ATH')
      .toBe(BOUNCE_FIELD_BUDGET_BITS);

    const it2 = messageFields(src, 'ATHInternalTransfer');
    const upToAmount = it2.slice(0, it2.findIndex(([n]) => n === 'amount') + 1);
    expect(upToAmount.reduce((s, [, w]) => s + w, 0)).toBeLessThan(BOUNCE_FIELD_BUDGET_BITS);
  });
});
