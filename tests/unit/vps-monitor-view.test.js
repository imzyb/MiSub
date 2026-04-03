import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import VpsMonitorView from '../../src/views/VpsMonitorView.vue';

vi.mock('../../src/lib/api.js', () => ({
  fetchVpsNodes: vi.fn(),
  createVpsNode: vi.fn(),
  updateVpsNode: vi.fn(),
  deleteVpsNode: vi.fn(),
  fetchVpsAlerts: vi.fn(),
  clearVpsAlerts: vi.fn(),
  fetchVpsNodeDetail: vi.fn(),
  saveSettings: vi.fn(),
  fetchSettings: vi.fn(),
  requestVpsNetworkCheck: vi.fn()
}));

vi.mock('../../src/stores/toast.js', () => ({
  useToastStore: () => ({
    showToast: vi.fn()
  })
}));

vi.mock('../../src/stores/settings.js', () => ({
  useSettingsStore: () => ({
    config: ref({
      vpsMonitor: {
        publicPageToken: '',
        networkTargetsLimit: 3
      }
    }),
    updateConfig: vi.fn()
  })
}));

import {
  fetchVpsNodes,
  fetchVpsAlerts,
  fetchVpsNodeDetail,
  fetchSettings
} from '../../src/lib/api.js';

describe('VpsMonitorView', () => {
  let wrapper;

  beforeEach(() => {
    fetchVpsNodes.mockResolvedValue({
      success: true,
      data: {
        data: [
          {
            id: 'node-1',
            name: 'Tokyo-01',
            status: 'online',
            region: 'Tokyo',
            enabled: true,
            useGlobalTargets: false,
            trafficLimitGb: 0,
            totalRx: 0,
            totalTx: 0,
            latest: {
              cpuPercent: 20,
              memPercent: 35,
              diskPercent: 40
            },
            lastSeenAt: '2026-03-31T12:00:00.000Z'
          }
        ]
      }
    });
    fetchVpsAlerts.mockResolvedValue({ success: true, data: { data: [] } });
    fetchSettings.mockResolvedValue({ success: true, data: {} });
    fetchVpsNodeDetail.mockResolvedValue({
      success: true,
      data: {
        data: {
          id: 'node-1',
          name: 'Tokyo-01',
          status: 'online',
          useGlobalTargets: false,
          latest: {
            cpuPercent: 20,
            memPercent: 35,
            diskPercent: 40
          }
        },
        reports: [],
        networkSamples: [],
        targets: [
          {
            id: 'target-1',
            type: 'icmp',
            target: '1.1.1.1',
            enabled: true
          }
        ]
      }
    });
  });

  afterEach(() => {
    wrapper?.unmount();
    vi.clearAllMocks();
  });

  it('opens node details and renders the network target section for the selected VPS node', async () => {
    wrapper = mount(VpsMonitorView, {
      global: {
        stubs: {
          DataGrid: {
            props: ['data'],
            template: `
              <div>
                <div v-for="row in data" :key="row.id">
                  <slot name="column-actions" :row="row" />
                </div>
              </div>
            `
          },
          Modal: {
            props: ['show'],
            template: '<div v-if="show"><slot name="title" /><slot name="body" /></div>'
          },
          VpsMetricChart: true,
          VpsLatencyChart: true,
          VpsMonitorSettingsModal: true,
          VpsNetworkTargets: {
            template: '<div>网络监测目标占位</div>'
          },
          Switch: true
        }
      }
    });

    await flushPromises();

    const detailButton = wrapper.findAll('button').find((button) => button.text() === '详情');
    expect(detailButton).toBeTruthy();

    await detailButton.trigger('click');
    await flushPromises();

    expect(fetchVpsNodeDetail).toHaveBeenCalledWith('node-1');
    expect(wrapper.text()).toContain('网络监测目标占位');
  });
});
