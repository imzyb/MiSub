import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { useSubscriptionForms } from '../../src/composables/useSubscriptionForms.js';
import AdvancedOptions from '../../src/components/modals/SubscriptionEditModal/AdvancedOptions.vue';
import Card from '../../src/components/ui/Card.vue';

vi.mock('../../src/stores/toast.js', () => ({
  useToastStore: () => ({
    showToast: vi.fn()
  })
}));

describe('subscription official website field', () => {
  it('initializes official website as an independent field for new subscriptions', () => {
    const { openAdd, editingSubscription } = useSubscriptionForms({
      addSubscription: vi.fn(),
      updateSubscription: vi.fn()
    });

    openAdd();

    expect(editingSubscription.value.website).toBe('');
  });

  it('renders website input above notes in advanced options', () => {
    const wrapper = mount(AdvancedOptions, {
      props: {
        editingSubscription: {
          customUserAgent: '',
          website: '',
          notes: '',
          enableNodeCache: false,
          plusAsSpace: false
        }
      }
    });

    const websiteInput = wrapper.get('#sub-edit-website');
    const notesTextarea = wrapper.get('textarea');

    expect(wrapper.text()).toContain('官网');
    expect(websiteInput.attributes('placeholder')).toBe('https://example.com');
    expect(websiteInput.element.compareDocumentPosition(notesTextarea.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('uses the explicit website field for the card website link instead of parsing notes', () => {
    const wrapper = mount(Card, {
      props: {
        misub: {
          id: 'sub_1',
          name: '测试机场',
          url: 'https://api.example.com/sub?target=clash',
          website: 'wd-gold.net/clientarea.php',
          notes: '备注里没有可识别官网',
          enabled: true,
          nodeCount: 0
        }
      },
      global: {
        stubs: {
          Switch: { template: '<button class="switch-stub"></button>' }
        }
      }
    });

    const link = wrapper.get('[data-testid="subscription-website-link"]');
    expect(link.attributes('href')).toBe('https://wd-gold.net/clientarea.php');
    expect(link.text()).toContain('官网');
  });

  it('shows the website link before notes on the subscription card', () => {
    const wrapper = mount(Card, {
      props: {
        misub: {
          id: 'sub_1',
          name: '测试机场',
          url: 'https://api.example.com/sub?target=clash',
          website: 'https://wd-gold.net/clientarea.php',
          notes: '30/月 IPLC专线',
          enabled: true,
          nodeCount: 0
        }
      },
      global: {
        stubs: {
          Switch: { template: '<button class="switch-stub"></button>' }
        }
      }
    });

    const meta = wrapper.get('[data-testid="subscription-footer-meta"]');
    const websiteLink = wrapper.get('[data-testid="subscription-website-link"]');
    const notes = wrapper.get('[data-testid="subscription-notes"]');

    expect(websiteLink.element.compareDocumentPosition(notes.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(meta.text()).toMatch(/^官网\s*30\/月 IPLC专线/);
  });
});
