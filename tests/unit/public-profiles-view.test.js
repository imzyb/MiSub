import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import PublicProfilesView from '../../src/views/PublicProfilesView.vue';

vi.mock('../../src/lib/http.js', () => ({
    api: {
        get: vi.fn(),
    },
}));

vi.mock('../../src/stores/toast.js', () => ({
    useToastStore: () => ({
        showToast: vi.fn(),
    }),
}));

vi.mock('../../src/components/modals/NodePreview/NodePreviewModal.vue', () => ({
    default: { template: '<div />' },
}));
vi.mock('../../src/components/features/AnnouncementCard.vue', () => ({
    default: { template: '<div />' },
}));
vi.mock('../../src/components/modals/GuestbookModal.vue', () => ({
    default: { template: '<div />' },
}));
vi.mock('../../src/components/modals/QuickImportModal.vue', () => ({
    default: { template: '<div />' },
}));

import { api } from '../../src/lib/http.js';

describe('PublicProfilesView hero loading state', () => {
    let wrapper;

    beforeEach(() => {
        api.get.mockReset();
        api.get.mockImplementation((url) => {
            if (url === '/api/clients') {
                return Promise.resolve({ success: true, data: [] });
            }
            return Promise.resolve({ success: true, data: [] });
        });
    });

    afterEach(async () => {
        await vi.dynamicImportSettled();
        wrapper?.unmount();
        vi.clearAllMocks();
    });

    it('does not flash fallback hero text before the public profile config loads', async () => {
        let resolveProfiles;
        api.get.mockImplementation((url) => {
            if (url === '/api/public/profiles') {
                return new Promise((resolve) => {
                    resolveProfiles = resolve;
                });
            }
            if (url === '/api/clients') {
                return Promise.resolve({ success: true, data: [] });
            }
            return Promise.resolve({ success: true, data: [] });
        });

        wrapper = mount(PublicProfilesView, {
            global: {
                stubs: {
                    ProfileGrid: true,
                    BaseIcon: true,
                    AnnouncementCard: true,
                    GuestbookModal: true,
                    QuickImportModal: true,
                    NodePreviewModal: true,
                },
            },
        });

        expect(wrapper.text()).not.toContain('发现');
        expect(wrapper.text()).not.toContain('优质订阅');

        resolveProfiles({
            success: true,
            data: [{ id: '1', name: 'Demo', enabled: true }],
            config: {
                hero: {
                    title1: '自定义发现',
                    title2: '自定义订阅',
                    description: '自定义描述',
                },
            },
        });

        await flushPromises();
        await vi.dynamicImportSettled();

        expect(wrapper.text()).toContain('自定义发现');
        expect(wrapper.text()).toContain('自定义订阅');
        expect(wrapper.text()).toContain('自定义描述');
    });

    it('does not flash the default public page before custom page config loads', async () => {
        let resolveProfiles;
        api.get.mockImplementation((url) => {
            if (url === '/api/public/profiles') {
                return new Promise((resolve) => {
                    resolveProfiles = resolve;
                });
            }
            if (url === '/api/clients') {
                return Promise.resolve({ success: true, data: [] });
            }
            return Promise.resolve({ success: true, data: [] });
        });

        wrapper = mount(PublicProfilesView, {
            global: {
                stubs: {
                    ProfileGrid: true,
                    BaseIcon: true,
                    AnnouncementCard: true,
                    GuestbookModal: true,
                    QuickImportModal: true,
                    NodePreviewModal: true,
                    CustomPublicRenderer: {
                        template: '<div class="custom-renderer-stub">自定义公开页</div>',
                    },
                },
            },
        });

        expect(wrapper.text()).not.toContain('Cosmic Selection');
        expect(wrapper.text()).not.toContain('发现');
        expect(wrapper.text()).not.toContain('优质订阅');

        resolveProfiles({
            success: true,
            data: [{ id: '1', name: 'Demo', enabled: true }],
            config: {
                customPage: {
                    enabled: true,
                    content: '<div>{{profiles}}</div>',
                    css: '',
                    useDefaultLayout: true,
                },
            },
        });

        await flushPromises();
        await vi.dynamicImportSettled();

        expect(wrapper.text()).toContain('自定义公开页');
        expect(wrapper.text()).not.toContain('Cosmic Selection');
    });

    it('renders custom public page as full-bleed when default layout is disabled', async () => {
        api.get.mockImplementation((url) => {
            if (url === '/api/public/profiles') {
                return Promise.resolve({
                    success: true,
                    data: [{ id: '1', name: 'Demo', enabled: true }],
                    config: {
                        customPage: {
                            enabled: true,
                            content: '<section>Immersive</section>',
                            css: '',
                            useDefaultLayout: false,
                        },
                    },
                });
            }
            if (url === '/api/clients') {
                return Promise.resolve({ success: true, data: [] });
            }
            return Promise.resolve({ success: true, data: [] });
        });

        wrapper = mount(PublicProfilesView, {
            global: {
                stubs: {
                    ProfileGrid: true,
                    BaseIcon: true,
                    AnnouncementCard: true,
                    GuestbookModal: true,
                    QuickImportModal: true,
                    NodePreviewModal: true,
                    CustomPublicRenderer: {
                        inheritAttrs: false,
                        template:
                            '<div class="custom-renderer-stub" :class="$attrs.class">自定义公开页</div>',
                    },
                },
            },
        });

        await flushPromises();
        await vi.dynamicImportSettled();

        const renderer = wrapper.find('.custom-renderer-stub');
        expect(renderer.exists()).toBe(true);
        expect(renderer.classes()).toContain('min-h-[100dvh]');
        expect(renderer.classes()).toContain('w-full');
        expect(renderer.classes()).not.toContain('max-w-7xl');
    });

    it('applies the server default locale for visitors without an explicit preference', async () => {
        localStorage.clear();
        api.get.mockImplementation((url) => {
            if (url === '/api/public/profiles') {
                return Promise.resolve({
                    success: true,
                    data: [{ id: '1', name: 'Demo', enabled: true }],
                    config: { defaultLocale: 'en-US' },
                });
            }
            return Promise.resolve({ success: true, data: [] });
        });

        wrapper = mount(PublicProfilesView, {
            global: {
                stubs: {
                    ProfileGrid: true,
                    BaseIcon: true,
                    AnnouncementCard: true,
                    GuestbookModal: true,
                    QuickImportModal: true,
                    NodePreviewModal: true,
                },
            },
        });

        await flushPromises();
        await vi.dynamicImportSettled();

        expect(localStorage.getItem('misub:locale')).toBe('en-US');
    });

    it('does not override a visitor explicit locale with the server default', async () => {
        localStorage.setItem('misub:locale', 'zh-CN');
        api.get.mockImplementation((url) => {
            if (url === '/api/public/profiles') {
                return Promise.resolve({
                    success: true,
                    data: [{ id: '1', name: 'Demo', enabled: true }],
                    config: { defaultLocale: 'en-US' },
                });
            }
            return Promise.resolve({ success: true, data: [] });
        });

        wrapper = mount(PublicProfilesView, {
            global: {
                stubs: {
                    ProfileGrid: true,
                    BaseIcon: true,
                    AnnouncementCard: true,
                    GuestbookModal: true,
                    QuickImportModal: true,
                    NodePreviewModal: true,
                },
            },
        });

        await flushPromises();
        await vi.dynamicImportSettled();

        expect(localStorage.getItem('misub:locale')).toBe('zh-CN');
    });

    it.each([false, true])(
        'shows a safe retryable API error for default/custom layout (custom=%s)',
        async (custom) => {
            api.get.mockImplementation((url) =>
                url === '/api/public/profiles'
                    ? Promise.resolve({
                          success: false,
                          message: 'SECRET server detail',
                          config: custom ? { customPage: { enabled: true } } : {},
                      })
                    : Promise.resolve({ success: true, data: [] })
            );
            wrapper = mount(PublicProfilesView, {
                global: {
                    stubs: {
                        ProfileGrid: true,
                        BaseIcon: true,
                        AnnouncementCard: true,
                        GuestbookModal: true,
                        QuickImportModal: true,
                        NodePreviewModal: true,
                        CustomPublicRenderer: { template: '<div><slot name="profiles" /></div>' },
                    },
                },
            });
            await flushPromises();
            expect(wrapper.text()).toContain('Failed to load public profiles. Please try again.');
            expect(wrapper.text()).not.toContain('SECRET');
            expect(wrapper.find('button').text()).toContain('Retry');
        }
    );

    it.each([false, true])(
        'shows safe error on request exception and retries successfully (custom=%s)',
        async (custom) => {
            let attempts = 0;
            api.get.mockImplementation((url) => {
                if (url === '/api/public/profiles') {
                    attempts += 1;
                    if (attempts === 1) return Promise.reject(new Error('SECRET exception detail'));
                    return Promise.resolve({
                        success: true,
                        data: [],
                        config: custom ? { customPage: { enabled: true } } : {},
                    });
                }
                return Promise.resolve({ success: true, data: [] });
            });
            wrapper = mount(PublicProfilesView, {
                global: {
                    stubs: {
                        ProfileGrid: true,
                        BaseIcon: true,
                        AnnouncementCard: true,
                        GuestbookModal: true,
                        QuickImportModal: true,
                        NodePreviewModal: true,
                        CustomPublicRenderer: { template: '<div><slot name="profiles" /></div>' },
                    },
                },
            });
            await flushPromises();
            expect(wrapper.text()).toContain('Failed to load public profiles. Please try again.');
            expect(wrapper.text()).not.toContain('SECRET');
            await wrapper.find('button').trigger('click');
            await flushPromises();
            expect(wrapper.text()).toContain('No public profiles available');
        }
    );

    it.each([false, true])(
        'shows explicit empty state after successful empty response (custom=%s)',
        async (custom) => {
            api.get.mockImplementation((url) =>
                url === '/api/public/profiles'
                    ? Promise.resolve({
                          success: true,
                          data: [],
                          config: custom ? { customPage: { enabled: true } } : {},
                      })
                    : Promise.resolve({ success: true, data: [] })
            );
            wrapper = mount(PublicProfilesView, {
                global: {
                    stubs: {
                        ProfileGrid: true,
                        BaseIcon: true,
                        AnnouncementCard: true,
                        GuestbookModal: true,
                        QuickImportModal: true,
                        NodePreviewModal: true,
                        CustomPublicRenderer: { template: '<div><slot name="profiles" /></div>' },
                    },
                },
            });
            await flushPromises();
            expect(wrapper.text()).toContain('No public profiles available');
        }
    );
});
