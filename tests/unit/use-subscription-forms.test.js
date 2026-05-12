import { describe, it, expect, vi } from 'vitest';
import { useSubscriptionForms } from '../../src/composables/useSubscriptionForms.js';

vi.mock('../../src/stores/toast.js', () => ({
  useToastStore: () => ({
    showToast: vi.fn()
  })
}));

describe('useSubscriptionForms', () => {
  it('新增机场订阅时默认使用默认 UA（customUserAgent 为空）', () => {
    const { openAdd, editingSubscription } = useSubscriptionForms({
      addSubscription: vi.fn(),
      updateSubscription: vi.fn()
    });

    openAdd();

    expect(editingSubscription.value.customUserAgent).toBe('');
  });

  it('新增机场订阅时保护性缓存节点默认关闭', () => {
    const { openAdd, editingSubscription } = useSubscriptionForms({
      addSubscription: vi.fn(),
      updateSubscription: vi.fn()
    });

    openAdd();

    expect(editingSubscription.value.enableNodeCache).toBe(false);
  });
});
