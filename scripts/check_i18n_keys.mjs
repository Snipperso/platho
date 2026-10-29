#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { collectI18nKeysFromSource } from './lib/i18n-key-scan.mjs';

const { I18N_STRINGS } = await import('../web/i18n-strings.mjs');
const html = readFileSync('web/index.html', 'utf8');

const sources = ['web/app.js'];
for (const name of readdirSync('web')) {
  if (name.endsWith('.mjs') && name !== 'i18n.mjs' && name !== 'i18n-strings.mjs') sources.push(`web/${name}`);
}

const plainKeys = new Set();
const pluralKeys = new Set();
const unreadCalls = [];
for (const path of sources) {
  const found = collectI18nKeysFromSource(readFileSync(path, 'utf8'));
  for (const key of found.plain) plainKeys.add(key);
  for (const key of found.plural) pluralKeys.add(key);
  for (const line of found.unread) unreadCalls.push(`${path}:${line}`);
}
if (unreadCalls.length > 0) {
  console.error('[i18n] calls whose first argument could not be read to its end (their keys are unchecked):');
  for (const at of unreadCalls) console.error(`  ${at}`);
  process.exit(1);
}
for (const m of html.matchAll(/data-i18n(?:-[a-z-]+)?="([a-zA-Z0-9_.]+)"/g)) plainKeys.add(m[1]);
for (const key of pluralKeys) plainKeys.delete(key);

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
  console.log(`[i18n] clean — ${plainKeys.size + pluralKeys.size} keys, ${locales.length} locales, none missing`);
  process.exit(0);
}
console.error('[i18n] keys missing from the dictionaries (they would show as [key]):');
for (const [key, absent] of missing) console.error(`  ${key}  ->  missing in: ${absent.join(', ')}`);
process.exit(1);
