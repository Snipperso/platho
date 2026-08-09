import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { shouldIncludeWebRuntimeFile } from '../scripts/prepare_static_web_deploy.mjs';
import {
  BUCKETS, BUYBACK_EXECUTE_EXEC, BUYBACK_FUNDING_ENVELOPE, FEE_ACCUMULATOR_FLUSH_EXEC, MARKET_STABILITY_FLUSH_EXEC,
  PROFILE_ATH_BURN_EXEC, PROFILE_ATH_TREASURY_EXEC, USERNAME_ATH_BURN_EXEC, USERNAME_ATH_TREASURY_EXEC,
} from '../tools/admin/buckets.mjs';

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
    let checked = 0;
    for (const bucket of BUCKETS) {
      // Both reads, where a card declares two. The buyback's execution quote lives in a DIFFERENT struct from the
      // rest of its card, so a second-getter row is exactly as exposed to positional drift as a first-getter one —
      // and it feeds a SIGNED message rather than a label, which makes it the worse of the two to get wrong.
      for (const read of [bucket, bucket.extra].filter(Boolean)) {
        const fields = contractFields(bucket.contract, read.struct);
        expect(fields.length, `${read.struct} looks empty — the parser or the struct moved`).toBeGreaterThan(3);
        for (const row of read.rows) {
          expect(
            fields[row.at],
            `${bucket.key}: slot ${row.at} is "${fields[row.at]}" in ${read.struct}, console says "${row.field}"`,
          ).toBe(row.field);
          checked += 1;
        }
      }
    }
    // The loop above proves nothing if `extra` is silently dropped from every bucket, so pin that the second read
    // is actually reached — the completeness half of the assertion.
    expect(BUCKETS.filter((b) => b.extra).length, 'the buyback card reads a second getter').toBeGreaterThan(0);
    expect(checked).toBeGreaterThan(20);
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

    // The registry ATH flushes are a SUM of two reserves, so the mirror can be wrong in a way a single grep would
    // miss — assert the addition, not the presence.
    const sumOf = (source: string, ...names: string[]): bigint => names.reduce((total, name) => {
      const found = new RegExp(`const ${name}: Int = (\\d+);`).exec(source);
      if (!found) throw new Error(`missing constant ${name}`);
      return total + BigInt(found[1]);
    }, 0n);
    const username = readFileSync('contracts/UsernameRegistry.tact', 'utf8');
    const profile = readFileSync('contracts/ProfileRegistry.tact', 'utf8');
    expect(USERNAME_ATH_TREASURY_EXEC).toBe(sumOf(username, 'USERNAME_ATH_TRANSFER_EXEC_RESERVE', 'USERNAME_DUE_FLUSH_LOCAL_EXEC_RESERVE'));
    expect(USERNAME_ATH_BURN_EXEC).toBe(sumOf(username, 'USERNAME_ATH_BURN_EXEC_RESERVE', 'USERNAME_DUE_FLUSH_LOCAL_EXEC_RESERVE'));
    expect(PROFILE_ATH_TREASURY_EXEC).toBe(sumOf(profile, 'PROFILE_ATH_TRANSFER_EXEC_RESERVE', 'PROFILE_DUE_FLUSH_LOCAL_EXEC_RESERVE'));
    expect(PROFILE_ATH_BURN_EXEC).toBe(sumOf(profile, 'PROFILE_ATH_BURN_EXEC_RESERVE', 'PROFILE_DUE_FLUSH_LOCAL_EXEC_RESERVE'));

    // The buyback's two figures mean DIFFERENT things and are mirrored separately: what the caller must attach
    // (gate 22216) and what the contract must have accumulated before a chunk can fire at all (gate 22212). The
    // second is not a value anyone sends — it is what the button waits for, and pinning it is what keeps the
    // "недоступно" line honest as the contract's own envelope changes.
    const buyback = readFileSync('contracts/BuybackBurn.tact', 'utf8');
    expect(buyback).toContain(`const BUYBACK_PTON_TRANSFER_GAS_NANOTONS: Int = ${BUYBACK_EXECUTE_EXEC};`);
    expect(buyback).toContain(`const BUYBACK_FUNDING_ENVELOPE_NANOTONS: Int = ${BUYBACK_FUNDING_ENVELOPE};`);
    expect(buyback).toMatch(/throwUnless\(22216, context\(\)\.value >= BUYBACK_PTON_TRANSFER_GAS_NANOTONS\)/);
    expect(buyback).toMatch(/throwUnless\(22212, self\.reserve_due_ton >= BUYBACK_FUNDING_ENVELOPE_NANOTONS\)/);
  });

  it('ADMIN-03C: the buyback sends only values the contract will compare against itself', () => {
    // This action is the one place the console builds a message from THREE fields at once, and every one of them is
    // checked by the receiver against its own state: query_id against last_terminal + 1, and the quote pair against
    // the frozen route evidence. A typed-in figure could only ever bounce, so there is no input — assert that the
    // body is assembled from the read, in the contract's field order and widths.
    const source = readFileSync('tools/admin/console.mjs', 'utf8');
    expect(source).toMatch(/cell\.uint\(values\.last_terminal_query_id \+ 1n, 64, 'query_id'\)/);
    expect(source).toMatch(/cell\.uint\(values\.evidence_quote_out_atomic_ath, 128, 'quote_out_atomic_ath'\)/);
    expect(source).toMatch(/cell\.uint\(values\.evidence_dex_min_out_atomic_ath, 128, 'dex_min_out_atomic_ath'\)/);

    const contract = readFileSync('contracts/BuybackBurn.tact', 'utf8');
    const message = contract.slice(contract.indexOf('message(0x42594558) ExecuteBuybackChunk'));
    const fields = message.slice(0, message.indexOf('}'));
    expect(fields).toMatch(/query_id: Int as uint64;[\s\S]*quote_out_atomic_ath: Int as uint128;[\s\S]*dex_min_out_atomic_ath: Int as uint128;/);
    expect(contract).toMatch(/throwUnless\(22044, queryId == self\.last_terminal_query_id \+ 1\)/);
    expect(contract).toMatch(/throwUnless\(22046, quoteOut == self\.evidence_quote_out_atomic_ath\)/);
    expect(contract).toMatch(/throwUnless\(22047, dexMinOut == self\.evidence_dex_min_out_atomic_ath\)/);

    // Every field the body reads must be a field the card actually fetches, or the message ships an `undefined`.
    const bucket = BUCKETS.find((b) => b.key === 'buyback_burn')!;
    const fetched = new Set([...bucket.rows, ...(bucket.extra?.rows ?? [])].map((row) => row.field));
    for (const field of ['last_terminal_query_id', 'evidence_quote_out_atomic_ath', 'evidence_dex_min_out_atomic_ath']) {
      expect(fetched.has(field), `${field} is sent but never read`).toBe(true);
    }
  });

  it('ADMIN-03D: an action with preconditions states the unmet one instead of bouncing', () => {
    // The reason this button did not exist for a week: a non-zero balance satisfies ONE of its four conditions, so
    // `enabledBy` alone would have offered the press at 3.27 GRAM accumulated and let the chain answer 22212 — a
    // number that tells the operator nothing. Each rule must carry the sentence shown in its place.
    const source = readFileSync('tools/admin/console.mjs', 'utf8');
    expect(source).toMatch(/function actionBlockedReason\(action, values\)/);
    expect(source).toMatch(/note\.textContent = blocked === null \? \(action\.note \?\? ''\) : `Недоступно: \$\{blocked\}\.`/);
    // Re-checked at press, not only at render: `phase` moves without anyone touching the page.
    expect(source).toMatch(/const blocked = actionBlockedReason\(action, values\);\s*\n\s*if \(blocked !== null\) \{ setStatus/);

    let ruled = 0;
    for (const bucket of BUCKETS) {
      for (const action of bucket.actions) {
        const fetched = new Set([...bucket.rows, ...(bucket.extra?.rows ?? [])].map((row) => row.field));
        for (const rule of action.requires ?? []) {
          expect(fetched.has(rule.field), `${action.id}: rule on "${rule.field}", which the card never reads`).toBe(true);
          expect(rule.unmet, `${action.id}: rule on "${rule.field}" has no sentence for the operator`).toBeTruthy();
          expect(rule.equals !== undefined || rule.atLeast !== undefined, `${action.id}: rule on "${rule.field}" tests nothing`).toBe(true);
          ruled += 1;
        }
      }
    }
    expect(ruled, 'the buyback declares its preconditions').toBeGreaterThanOrEqual(4);
  });

  it('ADMIN-03B: a query_id action is enabled by a bucket, and never sends a zero id', () => {
    // These flush the WHOLE due and carry no amount, so nothing in the message says whether there is anything to
    // flush. Without enabledBy the button would look pressable against an empty registry and bounce on 19221/21261.
    const source = readFileSync('tools/admin/console.mjs', 'utf8');
    expect(source).toMatch(/if \(action\.arg\?\.kind === 'queryId'\) cell\.uint\(BigInt\(Date\.now\(\)\), action\.arg\.bits, 'query_id'\);/);
    expect(source).toMatch(/if \(action\.enabledBy\) return values\[action\.enabledBy\];/);
    for (const bucket of BUCKETS) {
      for (const action of bucket.actions) {
        if (action.arg?.kind !== 'queryId') continue;
        expect(action.enabledBy, `${action.id} must name the bucket that enables it`).toBeTruthy();
        expect(
          bucket.rows.some((row) => row.field === action.enabledBy),
          `${action.id}: enabledBy "${action.enabledBy}" is not a row this card reads`,
        ).toBe(true);
      }
    }
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

  it('ADMIN-05B: there is ONE command to run it, and opening it as a file explains itself', () => {
    // The owner double-clicked index.html and got "Access to script ... from origin 'null' has been blocked by CORS
    // policy" — a message about the mechanism, not the mistake. A page whose only failure mode is unexplained is a
    // page nobody uses twice.
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.scripts.admin, 'npm run admin must exist').toBe('node scripts/serve_admin.mjs');

    // A DOUBLE-CLICKABLE launcher, because two attempts to start this by typing failed for two different reasons and
    // neither was the operator's fault. cmd is not subject to the PowerShell execution policy; %~dp0 makes it work
    // from wherever the repo was cloned; and it refuses with a sentence rather than a flash if node is missing.
    const bat = readFileSync('tools/admin/admin.bat', 'utf8');
    expect(bat, 'CRLF, or Windows reads it as one line').toContain('\r\n');
    expect(bat).toMatch(/cd \/d "%~dp0\.\.\\\.\."/);
    expect(bat).toMatch(/where node >nul 2>nul/);
    expect(bat).toMatch(/node scripts\\serve_admin\.mjs/);
    expect(bat, 'the launcher must not open the browser itself — it would race the port').not.toMatch(/start "" http/);
    // The server opens it instead, from the callback that knows the socket is accepting.
    const opens = readFileSync('scripts/serve_admin.mjs', 'utf8');
    expect(opens).toMatch(/\}\)\.listen\(PORT, '127\.0\.0\.1', \(\) => \{[\s\S]{0,900}spawn\(command, args/);
    const html = readFileSync('tools/admin/index.html', 'utf8');
    expect(html).toMatch(/location\.protocol === 'file:'/);
    // The hint names the NODE form, not npm. On Windows npm ships as a PowerShell script and the default execution
    // policy refuses it outright — the owner's second failure in a row — and telling anyone to relax a machine
    // security setting to look at a balance is not a fix.
    expect(html, 'the hint must name a command that needs no npm').toMatch(/node scripts\/serve_admin\.mjs/);
    // A CLASSIC script: over file:// the module never loads, so only non-module code can report it.
    expect(html).toMatch(/<script>\s*\n\s*if \(location\.protocol === 'file:'\)/);
    const server = readFileSync('scripts/serve_admin.mjs', 'utf8');
    // The root is derived from the SCRIPT, so the command works from any directory. A cwd-based root turns "run it
    // from the wrong folder" into a page of 404s with no explanation.
    expect(server).toMatch(/const ROOT = resolve\(dirname\(fileURLToPath\(import\.meta\.url\)\), '\.\.'\);/);
    expect(server, 'never the working directory').not.toMatch(/const ROOT = resolve\('\.'\)/);
    expect(server).toMatch(/const ALLOWED_PREFIXES = \['tools', 'web', 'artifacts'\];/);
    expect(server, 'a local tool has no business exposing the whole tree').toMatch(/if \(!ALLOWED_PREFIXES\.includes\(top\)\) return null;/);
    expect(server, 'and no business following ..').toMatch(/if \(!full\.startsWith\(ROOT \+ sep\)\) return null;/);
  });

  it('ADMIN-05C: an empty or foreign-derived wallet is named before it can fail on chain', () => {
    // The first real send came back as "inbound external message rejected ... exitcode=0, steps=0, gas_used=0" — the
    // account could not accept the external at all, so nothing in the message was at fault and nothing in that
    // sentence says so. The account was empty, and the reason an operator can fund a wallet and still be looking at
    // an empty one is that this page derives Platho's address: the same 24 words give a DIFFERENT v5r1 address in
    // another wallet app. Both halves have to be said out loud, before the button and before the chain refuses.
    const source = readFileSync('tools/admin/console.mjs', 'utf8');
    expect(source).toMatch(/if \(balance === 0n\) \{[\s\S]{0,200}Этот адрес ПУСТ/);
    expect(source).toMatch(/if \(walletBalance < needed\) \{/);
    expect(source, 'the pre-flight must run BEFORE the confirm').toMatch(
      /if \(walletBalance < needed\) \{[\s\S]{0,400}\}\s*\n\s*if \(!window\.confirm/,
    );
    const html = readFileSync('tools/admin/index.html', 'utf8');
    expect(html).toMatch(/Пополнять нужно адрес, который появится ниже/);
  });

  it('ADMIN-05D: a getter’s exit code is read, and an uninit wallet reports seqno 0', () => {
    // The first real send failed on a wallet holding 2 GRAM: it had never been deployed, `seqno` on an account with
    // no code returns exit_code -13 with garbage on the stack (measured: 0x14c97 = 85143), and the wrapper checked
    // only `ok`. The wallet signed against 85143, which is not zero, so the external went out WITHOUT the StateInit
    // that deploys it — rejected before the VM started, reported as "exitcode=0, steps=0, gas_used=0".
    //
    // This is the one place the console's own thin RPC was allowed to differ from the app's transport, and the
    // difference turned out to be a correctness check rather than pacing.
    const source = readFileSync('tools/admin/console.mjs', 'utf8');
    expect(source).toMatch(/const exit = Number\(result\?\.exit_code \?\? 0\);/);
    expect(source).toMatch(/if \(call\.method === 'seqno' && \(exit === -13 \|\| exit === -256\)\) return \{ \.\.\.result, stack: \[\['num', '0x0'\]\] \};/);
    expect(source, 'any other non-zero exit must be an error, not a value').toMatch(/throw new Error\(`\$\{call\.method\}: геттер вернул \$\{exit\}`\)/);
    // And the bucket reads had this check from the start — assert both halves, so a refactor cannot drop one.
    expect(source).toMatch(/if \(result\.exit_code !== 0\) throw new Error\(`геттер вернул \$\{result\.exit_code\}`\);/);
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
