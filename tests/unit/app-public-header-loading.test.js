import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { reactive, ref } from 'vue';
import App from '../../src/App.vue';

const routeState = reactive({
  name: 'PublicVpsMonitor',
  path: '/vps',
  meta: { isPublic: true },
  fullPath: '/vps'
});
const sessionStateRef = ref('loading');
const publicHeaderFooterRef = ref({ vpsPublicHeaderEnabled: true, vpsPublicFooterEnabled: true });

vi.mock('vue-router', () => ({
  useRoute: () => routeState
}));

vi.mock('../../src/stores/theme', () => ({
  useThemeStore: () => ({
    theme: ref(''),
    initTheme: vi.fn()
  })
}));

vi.mock('../../src/stores/session', () => ({
  useSessionStore: () => ({
    sessionState: sessionStateRef,
    publicHeaderFooter: publicHeaderFooterRef,
    publicConfig: { customLoginPath: '' },
    subscriptionConfig: { isDefaultPassword: false },
    checkSession: vi.fn().mockResolvedValue(undefined),
    login: vi.fn(),
    logout: vi.fn()
  })
}));

vi.mock('../../src/stores/toast', () => ({
  useToastStore: () => ({
    showToast: vi.fn()
  })
}));

vi.mock('../../src/stores/useDataStore', () => ({
  useDataStore: () => ({
    fetchData: vi.fn().mockResolvedValue(undefined),
    saveData: vi.fn().mockResolvedValue(undefined),
    isDirty: ref(false),
    saveState: ref('idle')
  })
}));

vi.mock('../../src/stores/ui', () => ({
  useUIStore: () => ({
    layoutMode: ref('classic')
  })
}));

const mountApp = () => mount(App, {
  global: {
    stubs: {
      NavBar: true,
      Header: { template: '<div data-testid="header">header</div>' },
      Footer: { template: '<div data-testid="footer">footer</div>' },
      Toast: true,
      SavePrompt: true,
      ScrollToTop: true,
      Dashboard: true,
      RouteErrorBoundary: { template: '<slot />' },
      'router-view': { template: '<div />' }
    }
  }
});

beforeEach(() => {
  routeState.name = 'PublicVpsMonitor';
  routeState.path = '/vps';
  routeState.fullPath = '/vps';
  routeState.meta = { isPublic: true };
  sessionStateRef.value = 'loading';
  publicHeaderFooterRef.value = { vpsPublicHeaderEnabled: true, vpsPublicFooterEnabled: true };
});

describe('App public loading state', () => {
  it('does not render the public header while session config is still loading', () => {
    const wrapper = mountApp();

    expect(wrapper.find('[data-testid="header"]').exists()).toBe(false);
  });

  it('keeps the original public page header and footer visible when only the VPS public chrome is disabled', () => {
    routeState.name = 'Home';
    routeState.path = '/';
    routeState.fullPath = '/';
    sessionStateRef.value = 'loggedOut';
    publicHeaderFooterRef.value = { vpsPublicHeaderEnabled: false, vpsPublicFooterEnabled: false };

    const wrapper = mountApp();

    expect(wrapper.find('[data-testid="header"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="footer"]').exists()).toBe(true);
  });
});
