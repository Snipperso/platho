#!/usr/bin/env node
/*
 * EVERY KEY THE UI ASKS FOR MUST EXIST IN EVERY LOCALE.
 *
 * MEASURED 2026-08-04, reported by the owner as "a status with no translation": `t('username.signing')` was called
 * from the mint flow and defined in NONE of the ten dictionaries. web/i18n.mjs renders a missing key as `[key]`, so
 * the user saw the literal text `[username.signing]` on screen while signing a transaction that spends their ATH.
 * Nothing failed, nothing logged — a missing key is a silent, user-visible defect.
 *
 * It cannot be caught by reading the dictionaries: they are not in strict parity with each other (locales legitimately
 * differ in count, and English is the fallback), so "ru has fewer keys than en" is not the question. The question is
 * "does every key some code path ASKS for resolve", and that is what this checks.
 *
 * PLURALS ARE STORED SUFFIXED (`key#one`, `key#few`, `key#many`, `key#other`) and looked up by Intl.PluralRules, with
 * `#other` as the guaranteed fallback — so a tPlural key is satisfied by `key#other`. A first version of this check
 * did not know that and reported eight healthy plural keys as missing; a checker that cries wolf gets switched off.
 *
 *   node scripts/check_i18n_keys.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';

const { I18N_STRINGS } = await import('../web/i18n-strings.mjs');
const html = readFileSync('web/index.html', 'utf8');

// EVERY MODULE, not just app.js. The first version read app.js alone, which was true of the code at the time and
// stopped being true the moment a module other than app.js called t() — public-channel-subscriptions.mjs does, for
// the words on a channel card. A checker whose input set is narrower than the thing it checks reports "чисто" about
// the part it happened to look at, which is worse than not running: the missing key still renders as [key].
const sources = ['web/app.js'];
for (const name of readdirSync('web')) {
  if (name.endsWith('.mjs') && name !== 'i18n.mjs' && name !== 'i18n-strings.mjs') sources.push(`web/${name}`);
}

const plainKeys = new Set();
const pluralKeys = new Set();
for (const path of sources) {
  const source = readFileSync(path, 'utf8');
  for (const m of source.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) plainKeys.add(m[1]);
  for (const m of source.matchAll(/\btPlural\(\s*'([a-zA-Z0-9_.]+)'/g)) pluralKeys.add(m[1]);
}
// The static markup asks for keys too (data-i18n, -placeholder, -title, -aria-label, -alt).
for (const m of html.matchAll(/data-i18n(?:-[a-z-]+)?="([a-zA-Z0-9_.]+)"/g)) plainKeys.add(m[1]);
for (const key of pluralKeys) plainKeys.delete(key);   // a key used both ways is satisfied by its plural forms

const locales = Object.keys(I18N_STRINGS);
if (locales.length < 2) {
  console.error('[i18n] ABORT: fewer than two locales found — the dictionaries did not load as expected');
  process.exit(1);
}

const missing = [];
for (const key of [...plainKeys].sort()) {
  const absent = locales.filter((locale) => I18N_STRINGS[locale][key] === undefined);
  if (absent.length) missing.push([key, absent]);
}
for (const key of [...pluralKeys].sort()) {
  const absent = locales.filter((locale) => I18N_STRINGS[locale][`${key}#other`] === undefined);
  if (absent.length) missing.push([`${key}#other`, absent]);
}

if (missing.length === 0) {
  console.log(`[i18n] чисто — ${plainKeys.size + pluralKeys.size} ключей, ${locales.length} языков, ни одного пропуска`);
  process.exit(0);
}
console.error('[i18n] ключи, которых нет в словарях (на экране будут как [key]):');
for (const [key, absent] of missing) console.error(`  ${key}  ->  нет в: ${absent.join(', ')}`);
process.exit(1);
