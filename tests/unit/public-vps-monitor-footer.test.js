import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import PublicVpsMonitorView from '../../src/views/PublicVpsMonitorView.vue';

vi.mock('../../src/lib/api.js', () => ({
  fetchVpsPublicSnapshot: vi.fn(),
  fetchVpsPublicNodeDetail: vi.fn()
}));

import { fetchVpsPublicNodeDetail, fetchVpsPublicSnapshot } from '../../src/lib/api.js';

describe('PublicVpsMonitorView', () => {
  let wrapper;
  let router;

  beforeEach(async () => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});

    fetchVpsPublicSnapshot.mockResolvedValue({
      success: true,
      data: {
        data: [],
        theme: {
          footerText: '自定义页脚文案'
        },
        layout: {
          headerEnabled: true,
          footerEnabled: false
        }
      }
    });
    fetchVpsPublicNodeDetail.mockResolvedValue({ success: true, data: {} });

    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/vps', component: PublicVpsMonitorView }]
    });
    router.push('/vps');
    await router.isReady();
  });

  afterEach(() => {
    wrapper?.unmount();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('shows the configured footer copy on the public page when the MiSub footer is disabled', async () => {
    wrapper = mount(PublicVpsMonitorView, {
      global: {
        plugins: [router],
        stubs: {
          VpsMetricChart: true,
          VpsLatencyChart: true,
          ThemeToggle: true,
          Switch: true
        }
      }
    });

    await flushPromises();

    expect(fetchVpsPublicSnapshot).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('自定义页脚文案');
  });

  it('does not flash fallback hero text before the public theme config loads', async () => {
    let resolveSnapshot;
    fetchVpsPublicSnapshot.mockReturnValueOnce(new Promise((resolve) => {
      resolveSnapshot = resolve;
    }));

    wrapper = mount(PublicVpsMonitorView, {
      global: {
        plugins: [router],
        stubs: {
          VpsMetricChart: true,
          VpsLatencyChart: true,
          ThemeToggle: true,
          Switch: true
        }
      }
    });

    expect(wrapper.text()).not.toContain('VPS 探针公开视图');
    expect(wrapper.text()).not.toContain('对外展示节点健康、资源负载与在线率。所有关键指标以清晰、可信的方式汇总呈现。');

    resolveSnapshot({
      success: true,
      data: {
        data: [],
        theme: {
          title: '自定义标题',
          subtitle: '自定义副标题'
        },
        layout: {
          headerEnabled: false,
          footerEnabled: false
        }
      }
    });

    await flushPromises();

    expect(wrapper.text()).toContain('自定义标题');
    expect(wrapper.text()).toContain('自定义副标题');
  });

  it('syncs the browser tab title with the configured public page title', async () => {
    fetchVpsPublicSnapshot.mockResolvedValueOnce({
      success: true,
      data: {
        data: [],
        theme: {
          title: '我的探针状态页'
        },
        layout: {
          headerEnabled: true,
          footerEnabled: true
        }
      }
    });

    wrapper = mount(PublicVpsMonitorView, {
      global: {
        plugins: [router],
        stubs: {
          VpsMetricChart: true,
          VpsLatencyChart: true,
          ThemeToggle: true,
          Switch: true
        }
      }
    });

    await flushPromises();

    expect(document.title).toBe('我的探针状态页 - MISUB');
  });
});
