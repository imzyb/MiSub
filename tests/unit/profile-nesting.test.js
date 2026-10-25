import { computed, defineComponent } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { wouldCreateCycle } from '../../src/utils/profile-graph.js';
import SubProfileSelector from '../../src/components/modals/ProfileModal/SubProfileSelector.vue';
import ProfileCard from '../../src/components/profiles/ProfileCard.vue';
import { createI18n } from '../../src/i18n/index.js';
import { handleProfileMode } from '../../functions/modules/subscription/profile-handler.js';
import { handleMisubRequest } from '../../functions/modules/subscription/main-handler.js';
import { generateCombinedNodeList } from '../../functions/services/subscription-service.js';

describe('Profile Nesting - Cycle Detection (wouldCreateCycle)', () => {
    it('detects direct self-reference as a cycle', () => {
        const profiles = [{ id: 'p1', name: 'Profile 1', subProfiles: [] }];
        expect(wouldCreateCycle('p1', 'p1', profiles)).toBe(true);
    });

    it('detects direct mutual cycle (A -> B, B -> A)', () => {
        const profiles = [
            { id: 'p1', name: 'Profile 1', subProfiles: [] },
            { id: 'p2', name: 'Profile 2', subProfiles: ['p1'] },
        ];
        // If p1 selects p2, it forms p1 -> p2 -> p1
        expect(wouldCreateCycle('p1', 'p2', profiles)).toBe(true);
        // If p2 selects p1, it also forms a cycle because p2 already contains p1
        expect(wouldCreateCycle('p2', 'p1', profiles)).toBe(false); // candidate p1 does not reach p2
    });

    it('detects indirect deep cycle (p1 -> p2 -> p3, then p3 -> p1)', () => {
        const profiles = [
            { id: 'p1', name: 'Profile 1', subProfiles: ['p2'] },
            { id: 'p2', name: 'Profile 2', subProfiles: ['p3'] },
            { id: 'p3', name: 'Profile 3', subProfiles: [] },
        ];
        // p3 selecting p1 would close the loop: p3 -> p1 -> p2 -> p3
        expect(wouldCreateCycle('p3', 'p1', profiles)).toBe(true);
    });

    it('allows valid diamond DAG dependency without cycles (A -> B, C; B -> D; C -> D)', () => {
        const profiles = [
            { id: 'pA', name: 'Profile A', subProfiles: ['pB'] },
            { id: 'pB', name: 'Profile B', subProfiles: ['pD'] },
            { id: 'pC', name: 'Profile C', subProfiles: ['pD'] },
            { id: 'pD', name: 'Profile D', subProfiles: [] },
        ];
        // pA can safely also select pC
        expect(wouldCreateCycle('pA', 'pC', profiles)).toBe(false);
    });

    it('handles matching by customId', () => {
        const profiles = [
            { id: 'uuid-1', customId: 'my-alias', subProfiles: ['uuid-2'] },
            { id: 'uuid-2', customId: 'other-alias', subProfiles: ['my-alias'] },
        ];
        expect(wouldCreateCycle('uuid-1', 'uuid-2', profiles)).toBe(true);
    });
});

describe('Profile Nesting - Backend Node Aggregation and Loop Breaker', () => {
    const createMockEnv = (profiles, nodes) => {
        const store = new Map([
            ['misub_profiles_v1', JSON.stringify(profiles)],
            ['misub_subscriptions_v1', JSON.stringify(nodes)],
            ['worker_settings_v1', JSON.stringify({})],
        ]);
        return {
            MISUB_KV: {
                get: vi.fn(async (key) => store.get(key) || null),
                put: vi.fn(async (key, val) => store.set(key, val)),
                delete: vi.fn(async (key) => store.delete(key)),
            },
        };
    };

    it('recursively gathers nodes from subProfiles with isSubProfile tag', async () => {
        const allProfiles = [
            {
                id: 'parent',
                name: 'Parent Profile',
                enabled: true,
                subscriptions: [],
                manualNodes: ['node-parent'],
                subProfiles: ['child'],
            },
            {
                id: 'child',
                name: 'Child Profile',
                enabled: true,
                subscriptions: [],
                manualNodes: ['node-child-1', 'node-child-2'],
                subProfiles: [],
            },
        ];

        const mockAllNodes = [
            {
                id: 'node-parent',
                name: 'Parent Node',
                url: 'ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTpwYXNzQDEuMS4xLjE6NDQz#Parent%20Node',
                enabled: true,
            },
            {
                id: 'node-child-1',
                name: 'Child Node 1',
                url: 'ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTpwYXNzQDEuMS4xLjE6NDQz#Child%20Node%201',
                enabled: true,
            },
            {
                id: 'node-child-2',
                name: 'Child Node 2',
                url: 'trojan://pass@1.1.1.1:443#Child%20Node%202',
                enabled: true,
            },
        ];

        const mockEnv = createMockEnv(allProfiles, mockAllNodes);

        const result = await handleProfileMode(null, mockEnv, 'parent', 'test-ua', false);

        expect(result.success).toBe(true);
        expect(result.profileName).toBe('Parent Profile');
        expect(result.nodes.length).toBe(3);
        const subProfileResults = result.subscriptions.filter((s) => s.isSubProfile);
        expect(subProfileResults.length).toBe(1);
        expect(subProfileResults[0].subscriptionName).toBe('Child Profile');
        expect(subProfileResults[0].nodes.length).toBe(2);
    });

    it('prevents infinite recursion if circular references exist in data', async () => {
        const circularProfiles = [
            {
                id: 'p1',
                name: 'Loop 1',
                enabled: true,
                subscriptions: [],
                manualNodes: ['n1'],
                subProfiles: ['p2'],
            },
            {
                id: 'p2',
                name: 'Loop 2',
                enabled: true,
                subscriptions: [],
                manualNodes: ['n2'],
                subProfiles: ['p1'], // Loop back to p1
            },
        ];

        const mockNodes = [
            {
                id: 'n1',
                name: 'Node 1',
                url: 'ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTpwYXNzQDEuMS4xLjE6NDQz#Node%201',
                enabled: true,
            },
            {
                id: 'n2',
                name: 'Node 2',
                url: 'ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTpwYXNzQDEuMS4xLjE6NDQz#Node%202',
                enabled: true,
            },
        ];

        const mockEnv = createMockEnv(circularProfiles, mockNodes);

        // Should terminate cleanly and not crash or loop indefinitely
        const result = await handleProfileMode(null, mockEnv, 'p1', 'test-ua', false);

        expect(result.success).toBe(true);
        expect(result.nodes.length).toBe(2);
    });

    it('skips manualNodePrefix for nodes coming from subProfiles in generateCombinedNodeList', async () => {
        const misubs = [
            {
                name: 'Direct Manual Node',
                url: 'ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTpwYXNzQDEuMS4xLjE6NDQz#Direct%20Manual%20Node',
                isFromSubProfile: false,
            },
            {
                name: 'SubProfile Clean Node',
                url: 'ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTpwYXNzQDEuMS4xLjE6NDQz#SubProfile%20Clean%20Node',
                isFromSubProfile: true,
            },
        ];

        const prefixSettings = {
            enableManualNodes: true,
            manualNodePrefix: '自定义前缀: ',
        };

        const combined = await generateCombinedNodeList(
            {},
            {},
            'test-ua',
            misubs,
            '',
            prefixSettings
        );

        const decoded = decodeURIComponent(combined);
        // Direct manual node should get prefix
        expect(decoded).toContain('自定义前缀:');
        expect(decoded).toContain('Direct Manual Node');
        // SubProfile node should NOT get prefixed as manual node
        expect(decoded).toContain('SubProfile Clean Node');
        expect(decoded).not.toMatch(/自定义前缀:[^\n]*SubProfile Clean Node/);
    });
});

describe('SubProfileSelector Component', () => {
    const DraggableStub = defineComponent({
        name: 'Draggable',
        props: ['modelValue'],
        emits: ['update:modelValue'],
        template:
            '<div data-test="draggable"><slot :element="el" v-for="el in modelValue" /></div>',
    });

    it('disables candidate profiles that would cause a cycle', () => {
        const allProfiles = [
            { id: 'p1', name: 'Profile A', subProfiles: [] },
            { id: 'p2', name: 'Profile B', subProfiles: ['p1'] }, // p2 already includes p1
            { id: 'p3', name: 'Profile C', subProfiles: [] },
        ];

        const wrapper = mount(SubProfileSelector, {
            props: {
                profiles: [allProfiles[1], allProfiles[2]],
                filteredProfiles: [allProfiles[1], allProfiles[2]],
                selectedIds: [],
                targetProfileId: 'p1',
                allProfiles,
            },
            global: {
                plugins: [createI18n()],
                stubs: {
                    draggable: DraggableStub,
                },
            },
        });

        // Profile B would cause cycle, so its checkbox should be disabled
        const checkboxes = wrapper.findAll('input[type="checkbox"]');
        expect(checkboxes.length).toBe(2);
        expect(checkboxes[0].attributes('disabled')).toBeDefined();
        expect(checkboxes[1].attributes('disabled')).toBeUndefined();
    });
});

describe('ProfileCard Component - subProfiles badge', () => {
    it('displays sub-profile count badge when profile contains subProfiles', () => {
        const wrapper = mount(ProfileCard, {
            props: {
                profile: {
                    id: 'p1',
                    name: 'Composite Profile',
                    enabled: true,
                    subscriptions: ['sub-1'],
                    manualNodes: [],
                    subProfiles: ['subprofile-a', 'subprofile-b'],
                },
            },
            global: {
                plugins: [createI18n()],
                stubs: {
                    Switch: true,
                },
            },
        });

        expect(wrapper.text()).toContain('Composite Profile');
        // Should display the count badge (e.g. 2 个组合 or 2 profiles)
        expect(wrapper.text()).toMatch(/2/);
    });
});

describe('Profile Nesting - Full Subscription Request via handleMisubRequest', () => {
    it('successfully processes top-level composite profile containing only subProfiles without TDZ error', async () => {
        const topProfile = {
            id: 'top-composite',
            name: 'Top Composite',
            enabled: true,
            subscriptions: [],
            manualNodes: [],
            subProfiles: ['sub-profile-1'],
        };

        const subProfile1 = {
            id: 'sub-profile-1',
            name: 'Sub Profile 1',
            enabled: true,
            subscriptions: [],
            manualNodes: ['manual-node-1'],
            subProfiles: [],
        };

        const manualNode1 = {
            id: 'manual-node-1',
            name: 'Direct SS Node',
            url: 'ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTpwYXNzQDEuMS4xLjE6NDQz#Direct%20SS%20Node',
            enabled: true,
        };

        const store = new Map([
            ['misub_profiles_v1', JSON.stringify([topProfile, subProfile1])],
            ['misub_subscriptions_v1', JSON.stringify([manualNode1])],
            ['worker_settings_v1', JSON.stringify({ profileToken: 'profiles' })],
        ]);

        const mockEnv = {
            MISUB_KV: {
                get: vi.fn(async (key) => store.get(key) || null),
                put: vi.fn(async (key, val) => store.set(key, val)),
                delete: vi.fn(async (key) => store.delete(key)),
            },
        };

        const req = new Request('https://example.com/profiles/top-composite', {
            headers: {
                'User-Agent': 'ClashMeta/1.18.0',
            },
        });

        const context = {
            request: req,
            env: mockEnv,
            waitUntil: () => {},
        };

        const res = await handleMisubRequest(context);
        expect(res.status).toBe(200);
        expect(res.headers.get('x-node-count')).toBe('1');
        const text = await res.text();
        expect(text).toContain('Direct SS Node');
    });
});
