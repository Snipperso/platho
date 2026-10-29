import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { argumentKeys, collectI18nKeysFromSource, firstCallArgument } from '../scripts/lib/i18n-key-scan.mjs';
import { sourceBlock } from './helpers/source';


const keysOf = (source: string) => {
  const found = collectI18nKeysFromSource(source);
  return { plain: [...found.plain].sort(), plural: [...found.plural].sort(), unread: found.unread };
};

describe('I18N-SCAN — every key a call can resolve to', () => {
  it('I18N-SCAN-01: a ternary whose condition holds a quoted string, a call, or a template literal still names both arms', () => {
    const source = [
      "line1(t(quote?.state === 'failed' ? 'profile.vaultQuoteUnread' : 'dialog.checking'));",
      "const a = t(isReady(thread, 'x', [1, 2]) ? 'alpha.one' : 'alpha.two', { n: 1 });",
      'const b = t(`${mode}-x` === key ? "beta.one" : \'beta.two\');',
      "const c = t('plain.key');",
      "const d = t('plain.withParams', { amount: formatGram(total, 'up') });",
    ].join('\n');
    expect(keysOf(source)).toEqual({
      plain: ['alpha.one', 'alpha.two', 'beta.one', 'beta.two', 'dialog.checking', 'plain.key', 'plain.withParams', 'profile.vaultQuoteUnread'],
      plural: [],
      unread: [],
    });
  });

  it('I18N-SCAN-02: chains, parentheses, optional chaining, nullish, comments and escapes are read as the language reads them', () => {
    const source = [
      "t(level > 2 ? 'chain.high' : level > 1 ? 'chain.mid' : 'chain.low');",
      "t(open ? ('paren.inner' ) : (closed ? 'paren.a' : 'paren.b'));",
      "t(user?.name ?? fallback ? 'opt.yes' : 'opt.no');",
      "t(x ?? 'not.a.key' ? 'nullish.yes' : 'nullish.no');",
      "t(flag /* 'comment.not.key' */ ? 'comment.yes' : 'comment.no');",
      "t(word === 'it\\'s' ? 'escape.yes' : 'escape.no');",
      "t(ratio ? .5 : 1);",
      "t(name || 'fallback.or');",
      "t(a ?? 'fallback.first' ?? 'fallback.second');",
      "t(cond ? 'arm.literal' : picked ?? 'arm.fallback');",
    ].join('\n');
    expect(keysOf(source).plain).toEqual([
      'arm.fallback', 'arm.literal', 'chain.high', 'chain.low', 'chain.mid', 'comment.no', 'comment.yes', 'escape.no',
      'escape.yes', 'fallback.first', 'fallback.or', 'fallback.second', 'nullish.no', 'nullish.yes', 'opt.no', 'opt.yes',
      'paren.a', 'paren.b', 'paren.inner',
    ]);
  });

  it('I18N-SCAN-03: what is not a key literal is not guessed at — variables, concatenations, substitutions, conditions', () => {
    const source = [
      't(keyVariable);',
      "t(cond ? someKey : 'arm.literal');",
      "t(cond ? 'concat.' + suffix : 'arm.second');",
      't(`template.${part}`);',
      "t(cond ? `tpl.${x}` : `tpl.plain`);",
      "t(prefix + 'tail');",
      "const s = 'not a call: t(';",
    ].join('\n');
    const found = keysOf(source);
    expect(found.plain).toEqual(['arm.literal', 'arm.second', 'tpl.plain']);
    expect(found.plain, 'a condition is never a key').not.toContain('tail');
  });

  it('I18N-SCAN-04: tPlural is read the same way into its own set; a call that cannot be read to its end is reported by line', () => {
    const source = [
      "tPlural(count > 1 ? 'files.many' : 'files.one', count);",
      "tPlural('plain.plural', n);",
      "t('fine.key');",
      "t(broken === 'never closed ? 'a' : 'b');",
    ].join('\n');
    const found = keysOf(source);
    expect(found.plural).toEqual(['files.many', 'files.one', 'plain.plural']);
    expect(found.plain).toEqual(['fine.key']);
    expect(found.unread).toEqual([4]);
  });

  it('I18N-SCAN-05: the walker reads one argument and stops at its comma or its parenthesis', () => {
    const src = "t(a(b, c) ? 'k.one' : 'k.two', { x: [1, 2] }) + rest";
    expect(firstCallArgument(src, 2)).toBe("a(b, c) ? 'k.one' : 'k.two'");
    expect(firstCallArgument("t('only')", 2)).toBe("'only'");
    expect(firstCallArgument("t('unclosed", 2)).toBeNull();
    expect(argumentKeys("a ? 'x.one' : 'x.two'")).toEqual(['x.one', 'x.two']);
    expect(argumentKeys('a ? b : c')).toEqual([]);
  });

  it('I18N-SCAN-06: on the real client it finds every key the regex found, and the ones the regex could not see', () => {
    const sources = ['web/app.js'];
    for (const name of readdirSync('web')) {
      if (name.endsWith('.mjs') && name !== 'i18n.mjs' && name !== 'i18n-strings.mjs') sources.push(`web/${name}`);
    }
    const before = new Set<string>();
    const beforePlural = new Set<string>();
    const now = new Set<string>();
    const nowPlural = new Set<string>();
    const unread: string[] = [];
    for (const path of sources) {
      const source = readFileSync(path, 'utf8');
      for (const m of source.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) before.add(m[1]);
      for (const m of source.matchAll(/\bt\(\s*[^()'"]*?\?\s*'([a-zA-Z0-9_.]+)'\s*:\s*'([a-zA-Z0-9_.]+)'/g)) { before.add(m[1]); before.add(m[2]); }
      for (const m of source.matchAll(/\btPlural\(\s*'([a-zA-Z0-9_.]+)'/g)) beforePlural.add(m[1]);
      const found = collectI18nKeysFromSource(source);
      found.plain.forEach((key: string) => now.add(key));
      found.plural.forEach((key: string) => nowPlural.add(key));
      found.unread.forEach((line: number) => unread.push(`${path}:${line}`));
    }
    expect([...before].filter((key) => !now.has(key)), 'nothing the regex checked goes unchecked').toEqual([]);
    expect([...beforePlural].filter((key) => !nowPlural.has(key))).toEqual([]);
    expect(unread, 'every call in the client is read to its end').toEqual([]);
    for (const key of ['group.privateLabel', 'chat.activateBeforeSending']) {
      expect(before.has(key), `${key}: invisible to the regex`).toBe(false);
      expect(now.has(key), `${key}: read now`).toBe(true);
    }
  });

  it('I18N-SCAN-07: the gate reads keys through the walker, refuses a call it cannot read, and is clean on this tree', () => {
    const checker = readFileSync('scripts/check_i18n_keys.mjs', 'utf8');
    expect(checker).toContain("import { collectI18nKeysFromSource } from './lib/i18n-key-scan.mjs';");
    expect(checker).toContain('const found = collectI18nKeysFromSource(readFileSync(path, \'utf8\'));');
    expect(checker).not.toMatch(/\[\^\(\)'"\]\*\?\\\?/);
    expect(sourceBlock(checker, 'if (unreadCalls.length > 0) {')).toContain('process.exit(1);');
    const run = spawnSync(process.execPath, ['scripts/check_i18n_keys.mjs'], { encoding: 'utf8' });
    expect(run.status, run.stderr).toBe(0);
  });
});
