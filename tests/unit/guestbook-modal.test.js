import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import GuestbookModal from '../../src/components/modals/GuestbookModal.vue';

const { post } = vi.hoisted(() => ({
  post: vi.fn()
}));

vi.mock('../../src/lib/http.js', () => ({
  api: {
    post
  }
}));

describe('GuestbookModal', () => {
  beforeEach(() => {
    post.mockReset();
  });

  it('submits successfully and stays inside shared Modal flow', async () => {
    post.mockResolvedValue({ success: true });

    const wrapper = mount(GuestbookModal, {
      props: {
        show: true,
        config: { enabled: true }
      },
      global: {
        stubs: {
          Teleport: true
        }
      }
    });

    wrapper.vm.form.content = '反馈内容';
    wrapper.vm.form.captcha = String(wrapper.vm.captcha.answer);

    await wrapper.vm.submitMessage();
    await flushPromises();

    expect(post).toHaveBeenCalledWith('/api/public/guestbook', {
      nickname: '',
      content: '反馈内容',
      type: 'general'
    });
    expect(wrapper.text()).toContain('提交成功');
  });
});
