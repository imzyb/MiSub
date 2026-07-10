import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import CustomPublicRenderer from '../../src/components/public/CustomPublicRenderer.vue';

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/public' }),
}));

const mountRenderer = (options) => mount(CustomPublicRenderer, {
  ...options,
  global: {
    plugins: [createPinia()],
    ...(options.global || {}),
  },
});

describe('CustomPublicRenderer iframe mode', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation((message, ...args) => {
      if (String(message).includes('Teleport target')) return;
      return undefined;
    });
  });
  it('renders sanitized srcdoc iframe for iframe-srcdoc mode with sandbox enabled', () => {
    const wrapper = mountRenderer({
      props: {
        content: '<!DOCTYPE html><html><head><title>Demo</title></head><body><div onclick="alert(1)">Hello</div><script>alert(1)</script></body></html>',
        css: '',
        config: {
          customPage: {
            type: 'iframe-srcdoc',
            iframeHeight: '80vh',
            iframeFullWidth: false,
            iframeAllowFullscreen: true,
            iframePaddingY: '12px',
            iframeRadius: '20px',
            iframeShadow: true
          }
        }
      }
    });

    const iframe = wrapper.find('iframe');
    expect(iframe.exists()).toBe(true);
    expect(iframe.attributes('srcdoc')).toContain('<div>Hello</div>');
    expect(iframe.attributes('srcdoc')).not.toContain('<script');
    expect(iframe.attributes('srcdoc')).not.toContain('onclick');
    expect(iframe.attributes('sandbox')).toBe('allow-forms allow-popups allow-popups-to-escape-sandbox');
    expect(iframe.attributes('style')).toContain('80vh');
    expect(iframe.attributes('style')).toContain('20px');
    expect(wrapper.find('.iframe-host').attributes('style')).toContain('12px');
    expect(iframe.classes()).toContain('iframe-shadow');
  });

  it('renders url iframe for iframe-url mode with sandbox enabled', () => {
    const wrapper = mountRenderer({
      props: {
        content: '',
        css: '',
        config: {
          customPage: {
            type: 'iframe-url',
            iframeUrl: 'https://example.com/panel',
            iframeHeight: '900px',
            iframeFullWidth: true,
            iframeAllowFullscreen: false
          }
        }
      }
    });

    const iframe = wrapper.find('iframe');
    expect(iframe.exists()).toBe(true);
    expect(iframe.attributes('src')).toBe('https://example.com/panel');
    expect(iframe.attributes('sandbox')).toBe('allow-forms allow-popups allow-popups-to-escape-sandbox');
    expect(iframe.attributes('allowfullscreen')).toBeUndefined();
  });

  it('uses dynamic viewport height by default for immersive iframe pages', () => {
    const wrapper = mountRenderer({
      props: {
        content: '',
        css: '',
        config: {
          customPage: {
            type: 'iframe-srcdoc'
          }
        }
      }
    });

    const iframe = wrapper.find('iframe');
    expect(iframe.exists()).toBe(true);
    expect(iframe.classes()).toContain('iframe-immersive-default');
    expect(iframe.attributes('style')).toContain('width: 100%');
  });

  it('blocks non-http iframe urls', () => {
    const wrapper = mountRenderer({
      props: {
        content: '',
        css: '',
        config: {
          customPage: {
            type: 'iframe-url',
            iframeUrl: 'javascript:alert(1)'
          }
        }
      }
    });

    const iframe = wrapper.find('iframe');
    expect(iframe.exists()).toBe(true);
    expect(iframe.attributes('src')).toBe('');
  });

  it('sanitizes inline custom HTML before v-html rendering', () => {
    const wrapper = mountRenderer({
      props: {
        content: '<div onclick="alert(1)">Hello <img src=x onerror="alert(2)"></div><script>alert(3)</script>{{ profiles }}',
        css: '',
        config: { customPage: { type: 'html' } }
      }
    });

    const containerHtml = wrapper.find('.custom-html-container').html();
    expect(containerHtml).toContain('Hello');
    expect(containerHtml).toContain('data-slot="profiles"');
    expect(containerHtml).not.toContain('onclick');
    expect(containerHtml).not.toContain('onerror');
    expect(containerHtml).not.toContain('<script');
  });

  it('does not inject external stylesheets even when legacy flag is enabled', () => {
    mountRenderer({
      props: {
        content: '<div>Hello</div>',
        css: '',
        config: { customPage: { type: 'html', allowExternalStylesheets: true } }
      }
    });

    expect(document.querySelector('link[data-custom-page-stylesheet="true"]')).toBeNull();
  });

  it('does not execute custom page scripts even when legacy flag is enabled', async () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    mountRenderer({
      props: {
        content: '<div>Hello</div><script>window.__misub_xss = true</script>',
        css: '',
        config: { customPage: { type: 'html', allowScripts: true } }
      }
    });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(appendSpy).not.toHaveBeenCalledWith(expect.objectContaining({ tagName: 'SCRIPT' }));
    expect(window.__misub_xss).toBeUndefined();
  });
});
