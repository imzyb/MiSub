import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import CustomPublicRenderer from '../../src/components/public/CustomPublicRenderer.vue';

describe('CustomPublicRenderer iframe mode', () => {
  it('renders srcdoc iframe for iframe-srcdoc mode', () => {
    const wrapper = mount(CustomPublicRenderer, {
      props: {
        content: '<!DOCTYPE html><html><head><title>Demo</title></head><body><div>Hello</div></body></html>',
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
    expect(iframe.attributes('style')).toContain('80vh');
    expect(iframe.attributes('style')).toContain('20px');
    expect(wrapper.find('.iframe-host').attributes('style')).toContain('12px');
    expect(iframe.classes()).toContain('iframe-shadow');
  });

  it('renders url iframe for iframe-url mode', () => {
    const wrapper = mount(CustomPublicRenderer, {
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
    expect(iframe.attributes('allowfullscreen')).toBeUndefined();
  });
});
