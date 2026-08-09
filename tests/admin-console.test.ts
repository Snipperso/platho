import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { shouldIncludeWebRuntimeFile } from '../scripts/prepare_static_web_deploy.mjs';
import { BUCKETS, FEE_ACCUMULATOR_FLUSH_EXEC, MARKET_STABILITY_FLUSH_EXEC } from '../tools/admin/buckets.mjs';

// The operator console reads every accounting bucket in the protocol and puts the numbers on one screen. Its whole
// value is being BELIEVED, so the two ways it could quietly lie are what this gate exists for.
//
// 1. POSITIONAL DRIFT. A getter stack has no field names. Every read is by index, and a field appended into the
//    middle of a .tact struct — which the codebase's own comments warn about in three separate places — would hand
//    every later value to the wrong label. Not crash: relabel. So each index is re-derived from the struct here.
// 2. WRONG OPCODE. A one-nibble slip sends a message no receiver matches; the money bounces back and the operator is
//    told nothing useful. Each opcode is checked against its message declaration.
//
// And one thing it must never do: ship.

const contractFields = (file: string, struct: string): string[] => {
  const lines = readFileSync(`contracts/${file}`, 'utf8').split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(`struct ${struct}`));
  if (start < 0) throw new Error(`${file} has no struct ${struct}`);
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const text = lines[i].trim();
    if (text === '}') break;
    const match = /^([a-z_][a-z0-9_]*)\s*:/.exec(text);
    if (match) out.push(match[1]);
  }
  return out;
};

describe('operator console', () => {
  it('ADMIN-01: every field index is the one the .tact struct actually declares', () => {
    for (const bucket of BUCKETS) {
      const fields = contractFields(bucket.contract, bucket.struct);
      expect(fields.length, `${bucket.struct} looks empty — the parser or the struct moved`).toBeGreaterThan(3);
      for (const row of bucket.rows) {
        expect(
          fields[row.at],
          `${bucket.key}: slot ${row.at} is "${fields[row.at]}" in ${bucket.struct}, console says "${row.field}"`,
        ).toBe(row.field);
      }
    }
  });

  it('ADMIN-02: every opcode matches its message declaration', () => {
    for (const bucket of BUCKETS) {
      const src = readFileSync(`contracts/${bucket.contract}`, 'utf8');
      for (const action of bucket.actions) {
        const hex = action.opcode.toString(16).toUpperCase().padStart(8, '0');
        expect(
          new RegExp(`message\\(0x${hex}\\)`, 'i').test(src),
          `${bucket.key}/${action.id}: no message(0x${hex}) in ${bucket.contract}`,
        ).toBe(true);
      }
    }
  });

  it('ADMIN-03: the execution values are the ones the gates require', () => {
    // Under-sending is refused by the gate and the operator sees a bounce with no explanation; both figures come
    // straight back to the caller, so there is no reason to trim them.
    const mss = readFileSync('contracts/MarketStabilitySeller.tact', 'utf8');
    const fee = readFileSync('contracts/FeeAccumulator.tact', 'utf8');
    expect(mss).toContain(`const MARKET_STABILITY_TREASURY_FLUSH_EXEC_RESERVE: Int = ${MARKET_STABILITY_FLUSH_EXEC};`);
    expect(fee).toContain(`const FEEACCUMULATOR_FLUSH_EXEC_RESERVE: Int = ${FEE_ACCUMULATOR_FLUSH_EXEC};`);
  });

  it('ADMIN-04: every bucket names an address the VERIFIED manifest carries', () => {
    // Not artifacts/local. A capture there named "...verify_input.live.json" describes a dead generation, and reading
    // an address off it produced a false report that the 60,000,000 ATH reserve was unfunded.
    const input = JSON.parse(readFileSync('artifacts/mainnet_genesis_verify_input.json', 'utf8'));
    const report = JSON.parse(readFileSync('artifacts/mainnet_genesis_verify_report.json', 'utf8'));
    expect(report.mainnet_genesis_verified).toBe(true);
    for (const bucket of BUCKETS) {
      expect(input.manifest.addresses[bucket.manifest], `manifest has no address for ${bucket.manifest}`).toBeTruthy();
    }
    const console_ = readFileSync('tools/admin/console.mjs', 'utf8');
    expect(console_).toMatch(/const MANIFEST_URL = '\.\.\/\.\.\/artifacts\/mainnet_genesis_verify_input\.json';/);
    // CODE only. The header explains at length why artifacts/local must never be a source, and a naive negative pin
    // catches that explanation instead of a violation — the prose-vs-code trap this codebase has been bitten by
    // before. Strip comments, then look for a real path literal.
    const code = console_.replace(/^\s*\/\/.*$/gm, '');
    expect(code, 'never read addresses out of artifacts/local').not.toMatch(/artifacts\/local/);
  });

  it('ADMIN-05: the console can never reach the production bundle', () => {
    // The deploy walks web/ and selects by allowlist, so tools/ is excluded by construction. This asserts the
    // construction rather than trusting it: a shipped operator page hands an attacker the operational map.
    for (const path of ['tools/admin/index.html', 'tools/admin/console.mjs', 'tools/admin/buckets.mjs', 'tools/admin/console.css']) {
      expect(existsSync(path), `${path} is missing`).toBe(true);
      expect(shouldIncludeWebRuntimeFile(path), `${path} must never be selected for the bundle`).toBe(false);
    }
    // And it must not be reachable from the app's import graph either — the graph walker starts at web/app.js, so a
    // module under tools/ can only get in if somebody imports it from web/.
    const appImports = readFileSync('web/app.js', 'utf8');
    expect(appImports, 'the app must not import the console').not.toMatch(/tools\/admin/);
  });

  it('ADMIN-06: a failed read is never rendered as a zero', () => {
    // The one failure mode that makes the page worse than nothing: showing "0 к выводу" when it could not ask.
    const source = readFileSync('tools/admin/console.mjs', 'utf8');
    expect(source).toMatch(/не прочитано: \$\{error\.message\}/);
    expect(source).toMatch(/if \(item\[0\] !== 'num'\) throw new Error/);
    expect(source, 'a short stack must throw, not read undefined').toMatch(/в стеке нет позиции/);
  });

  it('ADMIN-07: a send bounces rather than burning on refusal, and reuses the app’s wallet path', () => {
    const source = readFileSync('tools/admin/console.mjs', 'utf8');
    expect(source).toMatch(/bounce: true,/);
    expect(source).toMatch(/import \{ importPlathoWallet, sendPlathoWalletTransaction \} from '\.\.\/\.\.\/web\/platho-wallet\.mjs';/);
    expect(source, 'the phrase must not linger in the DOM').toMatch(/\$\('phrase'\)\.value = '';/);
  });
});
