import { describe, expect, it, vi } from 'vitest';
import yaml from 'js-yaml';
import {
    normalizeCustomRuleTemplates,
    resolveRuleTemplateSource,
    handleRuleTemplatesRequest
} from '../../functions/modules/rule-template-handler.js';
import { ProcessorService } from '../../functions/services/processor-service.js';

const NODE_LIST = 'trojan://pass@1.1.1.1:443#HK-01';

function createMemoryStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        get: vi.fn(async key => data.has(key) ? data.get(key) : null),
        put: vi.fn(async (key, value) => {
            data.set(key, value);
            return true;
        }),
        delete: vi.fn(async key => data.delete(key)),
        dump: () => Object.fromEntries(data.entries())
    };
}

describe('自定义规则模板 Phase 1 后端模型/API/渲染', () => {
    it('normalizes templates and rejects invalid content', () => {
        const templates = normalizeCustomRuleTemplates([
            {
                id: ' tpl 01 ',
                name: ' 我的模板 ',
                type: 'ini',
                content: '[Proxy Group]\n🚀 节点选择 = select, []AUTO, DIRECT\n\n[Rule]\nMATCH,🚀 节点选择',
                description: ' demo ',
                enabled: true
            },
            { id: 'bad', name: 'bad', content: '' }
        ]);

        expect(templates).toHaveLength(1);
        expect(templates[0]).toMatchObject({
            id: 'tpl-01',
            name: '我的模板',
            type: 'ini',
            description: 'demo',
            enabled: true
        });
        expect(templates[0].content).toContain('[Proxy Group]');
        expect(templates[0].updatedAt).toEqual(expect.any(String));
    });

    it('provides authenticated CRUD API for custom rule templates', async () => {
        const storage = createMemoryStorage();
        const env = { __TEST_STORAGE_ADAPTER: storage };

        const saveReq = new Request('https://example.com/api/rule_templates', {
            method: 'POST',
            body: JSON.stringify({
                templates: [{
                    id: 'tpl-a',
                    name: '自定义规则模板 A',
                    content: '[Proxy Group]\n🚀 节点选择 = select, []AUTO, DIRECT\n\n[Rule]\nMATCH,🚀 节点选择'
                }]
            })
        });

        const saveResp = await handleRuleTemplatesRequest(saveReq, env);
        const saveJson = await saveResp.json();
        expect(saveJson.success).toBe(true);
        expect(saveJson.data).toHaveLength(1);
        expect(storage.put).toHaveBeenCalledWith('misub_rule_templates_v1', expect.any(Array));

        const getResp = await handleRuleTemplatesRequest(new Request('https://example.com/api/rule_templates'), env);
        const getJson = await getResp.json();
        expect(getJson.success).toBe(true);
        expect(getJson.data[0].name).toBe('自定义规则模板 A');
    });

    it('resolves custom template source and renders clash yaml without remote fetch', async () => {
        const storageAdapter = createMemoryStorage({
            misub_rule_templates_v1: [{
                id: 'tpl-a',
                name: '本地模板',
                type: 'ini',
                content: '[Proxy Group]\n🚀 节点选择 = select, []AUTO, DIRECT\n\n[Rule]\nMATCH,🚀 节点选择'
            }]
        });
        global.fetch = vi.fn();

        const source = await resolveRuleTemplateSource(storageAdapter, { kind: 'custom', value: 'tpl-a' });
        expect(source.content).toContain('[Proxy Group]');

        const result = await ProcessorService.renderOutput({
            targetFormat: 'clash',
            combinedNodeList: NODE_LIST,
            subName: 'Demo',
            config: { UpdateInterval: 86400 },
            builtinOptions: { ruleLevel: 'none', enableUdp: true, skipCertVerify: false },
            templateSource: { kind: 'custom', value: 'tpl-a' },
            managedConfigUrl: 'https://example.com/sub',
            storageAdapter
        });

        expect(fetch).not.toHaveBeenCalled();
        expect(result.contentType).toBe('application/x-yaml; charset=utf-8');
        const parsed = yaml.load(result.content);
        expect(parsed['proxy-groups'].some(group => group.name === '🚀 节点选择')).toBe(true);
        expect(parsed.rules).toContain('MATCH,🚀 节点选择');
    });
});
