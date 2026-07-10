import { computed, inject, readonly, ref } from 'vue';
import { messages } from './messages.js';

export const DEFAULT_LOCALE = 'zh-CN';
export const LOCALE_STORAGE_KEY = 'misub:locale';
export const SUPPORTED_LOCALES = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en-US', label: 'English' }
];

const supportedCodes = new Set(SUPPORTED_LOCALES.map((item) => item.code));
const I18N_KEY = Symbol('misub-i18n');

function canUseLocalStorage() {
  return typeof localStorage !== 'undefined';
}

function readStoredLocale() {
  if (!canUseLocalStorage()) return '';
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function writeStoredLocale(locale) {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore storage failures in private/incognito contexts.
  }
}

export function normalizeLocale(locale) {
  if (!locale || typeof locale !== 'string') return DEFAULT_LOCALE;
  if (supportedCodes.has(locale)) return locale;
  const lower = locale.toLowerCase();
  if (lower.startsWith('zh')) return 'zh-CN';
  if (lower.startsWith('en')) return 'en-US';
  return DEFAULT_LOCALE;
}

export function detectInitialLocale(browserLanguages = []) {
  const stored = readStoredLocale();
  if (supportedCodes.has(stored)) return stored;

  const candidates = Array.isArray(browserLanguages) && browserLanguages.length > 0
    ? browserLanguages
    : (typeof navigator !== 'undefined' ? [navigator.language, ...(navigator.languages || [])] : []);

  for (const candidate of candidates) {
    const normalized = normalizeLocale(candidate);
    if (supportedCodes.has(normalized) && normalized !== DEFAULT_LOCALE) return normalized;
  }

  return DEFAULT_LOCALE;
}

function lookupMessage(locale, key) {
  return key.split('.').reduce((current, part) => {
    if (!current || typeof current !== 'object') return undefined;
    return current[part];
  }, messages[locale]);
}

function interpolate(template, params = {}) {
  if (typeof template !== 'string') return template;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
}

export function createI18n(options = {}) {
  const locale = ref(normalizeLocale(options.initialLocale || detectInitialLocale()));

  const translate = (key, params = {}, forcedLocale) => {
    const targetLocale = normalizeLocale(forcedLocale || locale.value);
    const resolved = lookupMessage(targetLocale, key) ?? lookupMessage(DEFAULT_LOCALE, key);
    return resolved === undefined ? key : interpolate(resolved, params);
  };

  const set = (nextLocale) => {
    const normalized = normalizeLocale(nextLocale);
    locale.value = normalized;
    writeStoredLocale(normalized);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = normalized;
    }
  };

  const instance = {
    locale,
    supportedLocales: SUPPORTED_LOCALES,
    t: translate,
    setLocale: set,
    install(app) {
      app.provide(I18N_KEY, instance);
      app.config.globalProperties.$t = translate;
      app.config.globalProperties.$locale = readonly(locale);
      if (typeof document !== 'undefined') {
        document.documentElement.lang = locale.value;
      }
    }
  };

  return instance;
}

export const i18n = createI18n();

export function t(key, params = {}, forcedLocale) {
  return i18n.t(key, params, forcedLocale);
}

export function setLocale(locale) {
  i18n.setLocale(locale);
}

export function useI18n() {
  const instance = inject(I18N_KEY, i18n);
  return {
    locale: instance.locale,
    supportedLocales: instance.supportedLocales,
    t: instance.t,
    setLocale: instance.setLocale,
    currentLocaleLabel: computed(() => SUPPORTED_LOCALES.find((item) => item.code === instance.locale.value)?.label || instance.locale.value)
  };
}
