import { I18N_STRINGS, I18N_LOCALES } from './i18n-strings.mjs?v=289';

const I18N_STORAGE_KEY = 'platho.locale.v1';
const DEFAULT_LOCALE = 'en';

let activeLocale = DEFAULT_LOCALE;

export { I18N_LOCALES };

function normalizeLocaleCode(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return null;
  const base = raw.split(/[-_]/)[0];
  return I18N_STRINGS[base] ? base : null;
}

export function detectPreferredLocale() {
  try {
    const stored = normalizeLocaleCode(localStorage.getItem(I18N_STORAGE_KEY));
    if (stored) return stored;
  } catch { }
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

export function setLocale(code) {
  const normalized = normalizeLocaleCode(code) ?? DEFAULT_LOCALE;
  activeLocale = normalized;
  try { localStorage.setItem(I18N_STORAGE_KEY, normalized); } catch { }
  reflectDocumentLocale();
  return normalized;
}

function reflectDocumentLocale() {
  try { document.documentElement.lang = activeLocale; } catch { }
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

export function t(key, params = null) {
  const template = lookup(key, activeLocale) ?? lookup(key, DEFAULT_LOCALE);
  if (template === undefined) return `[${key}]`;
  return interpolate(template, params);
}

export function tPlural(key, count, params = null) {
  const merged = { count, ...(params ?? {}) };
  let category = 'other';
  try {
    category = new Intl.PluralRules(activeLocale).select(count);
  } catch { }
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
