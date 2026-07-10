import { describe, expect, it, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  createI18n,
  detectInitialLocale,
  i18n,
  setLocale,
  t
} from '../../src/i18n/index.js';
import LanguageSwitcher from '../../src/components/layout/LanguageSwitcher.vue';

const routerLinkStub = {
  props: ['to'],
  template: '<a><slot /></a>'
};

beforeEach(() => {
  localStorage.clear();
  setLocale(DEFAULT_LOCALE);
});

describe('MiSub i18n contract', () => {
  it('ships Simplified Chinese and English locale metadata', () => {
    expect(DEFAULT_LOCALE).toBe('zh-CN');
    expect(SUPPORTED_LOCALES.map((item) => item.code)).toEqual(['zh-CN', 'en-US']);
    expect(t('nav.dashboard')).toBe('仪表盘');
    expect(t('nav.dashboard', {}, 'en-US')).toBe('Dashboard');
  });

  it('falls back to the key when a translation is missing', () => {
    expect(t('missing.translation.key', {}, 'en-US')).toBe('missing.translation.key');
  });

  it('translates dashboard header strings used by the traditional dashboard', () => {
    expect(t('dashboard.totalRemainingTraffic', { traffic: '12 GB' }, 'zh-CN')).toBe('剩余总流量: 12 GB');
    expect(t('dashboard.dashboardHint', {}, 'zh-CN')).not.toBe('dashboard.dashboardHint');
    expect(t('dashboard.totalRemainingTraffic', { traffic: '12 GB' }, 'en-US')).toBe('Remaining traffic: 12 GB');
    expect(t('dashboard.dashboardHint', {}, 'en-US')).not.toBe('dashboard.dashboardHint');
  });

  it('detects locale from persisted preference before browser language', () => {
    localStorage.setItem('misub:locale', 'en-US');
    expect(detectInitialLocale(['zh-CN'])).toBe('en-US');
  });

  it('normalizes unsupported locales to the default language', () => {
    expect(detectInitialLocale(['fr-FR'])).toBe(DEFAULT_LOCALE);
  });

  it('installs a global translator and reactive locale switcher', async () => {
    const appI18n = createI18n({ initialLocale: 'zh-CN' });
    const wrapper = mount(LanguageSwitcher, {
      global: {
        plugins: [appI18n],
        stubs: { RouterLink: routerLinkStub }
      }
    });

    // Language switcher is now an icon button (not a <select>).
    // The button has no visible text — locale info is in title/aria-label.
    const button = wrapper.get('button');
    expect(button.attributes('aria-label')).toContain('English');

    await button.trigger('click');
    await nextTick();

    expect(appI18n.locale.value).toBe('en-US');
    expect(localStorage.getItem('misub:locale')).toBe('en-US');
    // After toggling to en-US the button title switches to Chinese.
    expect(button.attributes('aria-label')).toContain('中文');
  });

  it('exposes the shared singleton for non-component code', () => {
    setLocale('en-US');
    expect(i18n.locale.value).toBe('en-US');
    expect(t('actions.logout')).toBe('Log out');
  });
});
