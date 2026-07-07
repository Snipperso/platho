// Platho i18n engine. All translated CONTENT lives in i18n-strings.mjs (the single file allowed to carry
// non-English text — see OPSEC-LOCALE-01: every locale ships with identical key coverage, so no dictionary
// stands out); this module is pure logic and must stay English-only.
import { I18N_STRINGS, I18N_LOCALES } from './i18n-strings.mjs?v=17';

const I18N_STORAGE_KEY = 'platho.locale.v1';
const DEFAULT_LOCALE = 'en';

let activeLocale = DEFAULT_LOCALE;

export { I18N_LOCALES };

function normalizeLocaleCode(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return null;
  // 'pt-BR' -> 'pt', 'zh-Hans-CN' -> 'zh'; dictionaries are keyed by base language.
  const base = raw.split(/[-_]/)[0];
  return I18N_STRINGS[base] ? base : null;
}

// Preference order: explicit user choice -> Telegram profile language -> browser languages -> English.
export function detectPreferredLocale() {
  try {
    const stored = normalizeLocaleCode(localStorage.getItem(I18N_STORAGE_KEY));
    if (stored) return stored;
  } catch { /* storage unavailable (private mode) — fall through to detection */ }
  const tgLocale = normalizeLocaleCode(globalThis.Telegram?.WebApp?.initDataUnsafe?.user?.language_code);
  if (tgLocale) return tgLocale;
  const candidates = Array.isArray(navigator?.languages) && navigator.languages.length > 0
    ? navigator.languages
    : [navigator?.language];
  for (const candidate of candidates) {
    const code = normalizeLocaleCode(candidate);
    if (code) return code;
  }
  return DEFAULT_LOCALE;
}

export function initI18n() {
  activeLocale = detectPreferredLocale();
  reflectDocumentLocale();
  return activeLocale;
}

export function currentLocale() {
  return activeLocale;
}

// Persists the choice; the caller decides how to refresh rendered content (instant re-render or reload).
export function setLocale(code) {
  const normalized = normalizeLocaleCode(code) ?? DEFAULT_LOCALE;
  activeLocale = normalized;
  try { localStorage.setItem(I18N_STORAGE_KEY, normalized); } catch { /* best-effort persist */ }
  reflectDocumentLocale();
  return normalized;
}

function reflectDocumentLocale() {
  try { document.documentElement.lang = activeLocale; } catch { /* no DOM (tests) */ }
}

function lookup(key, locale) {
  const dict = I18N_STRINGS[locale];
  const value = dict ? dict[key] : undefined;
  return typeof value === 'string' ? value : undefined;
}

function interpolate(template, params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole
  ));
}

// Missing keys fall back to English, then to the key itself — a visible '[key]' beats a blank UI and the
// parity test keeps real gaps out of releases.
export function t(key, params = null) {
  const template = lookup(key, activeLocale) ?? lookup(key, DEFAULT_LOCALE);
  if (template === undefined) return `[${key}]`;
  return interpolate(template, params);
}

// Plural-aware lookup: dictionaries define `key#one` / `key#few` / `key#many` / `key#other` variants and
// Intl.PluralRules picks the right category per locale (Russian few/many, CJK other-only, etc).
export function tPlural(key, count, params = null) {
  const merged = { count, ...(params ?? {}) };
  let category = 'other';
  try {
    category = new Intl.PluralRules(activeLocale).select(count);
  } catch { /* unknown locale in the runtime — 'other' always exists */ }
  const template = lookup(`${key}#${category}`, activeLocale)
    ?? lookup(`${key}#other`, activeLocale)
    ?? lookup(`${key}#${category}`, DEFAULT_LOCALE)
    ?? lookup(`${key}#other`, DEFAULT_LOCALE);
  if (template === undefined) return `[${key}]`;
  return interpolate(template, merged);
}

const STATIC_ATTRIBUTE_MAP = [
  ['data-i18n-placeholder', 'placeholder'],
  ['data-i18n-title', 'title'],
  ['data-i18n-aria-label', 'aria-label'],
  ['data-i18n-alt', 'alt'],
];

// Applies dictionary text to every annotated node under `root`. The inline English in index.html stays as
// the pre-JS fallback (boot watchdog renders before modules load); en apply is a value-level no-op.
export function applyStaticTranslations(root = document) {
  const scope = root ?? document;
  for (const node of scope.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.getAttribute('data-i18n'));
  }
  for (const [attribute, target] of STATIC_ATTRIBUTE_MAP) {
    for (const node of scope.querySelectorAll(`[${attribute}]`)) {
      node.setAttribute(target, t(node.getAttribute(attribute)));
    }
  }
}
