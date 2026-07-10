import { describe, it, expect } from 'vitest';
import { collectManualNodeGroups, buildGroupedManualNodes, normalizeManualNodeGroupName } from '../../src/composables/manual-nodes/groups.js';

describe('空分组名处理一致性', () => {
  it('normalizeManualNodeGroupName 应将空值、空字符串、空格规范化为空字符串', () => {
    expect(normalizeManualNodeGroupName('')).toBe('');
    expect(normalizeManualNodeGroupName('   ')).toBe('');
    expect(normalizeManualNodeGroupName(null)).toBe('');
    expect(normalizeManualNodeGroupName(undefined)).toBe('');
  });

  it('collectManualNodeGroups 应跳过空分组名的节点', () => {
    const nodes = [
      { id: 'n1', url: 'ss://test1', group: 'USA' },
      { id: 'n2', url: 'ss://test2', group: '' },
      { id: 'n3', url: 'ss://test3', group: '   ' },
      { id: 'n4', url: 'ss://test4', group: null },
      { id: 'n5', url: 'ss://test5', group: 'Japan' }
    ];

    const groups = collectManualNodeGroups(nodes);

    // 只应包含非空分组
    expect(groups).toEqual(['USA', 'Japan']);
    expect(groups).not.toContain('');
  });

  it('buildGroupedManualNodes 应将空分组名节点归入"默认"分组', () => {
    const nodes = [
      { id: 'n1', url: 'ss://test1', group: 'USA' },
      { id: 'n2', url: 'ss://test2', group: '' },
      { id: 'n3', url: 'ss://test3', group: '   ' },
      { id: 'n4', url: 'ss://test4', group: null }
    ];

    const manualNodeGroups = ['USA']; // collectManualNodeGroups 的输出
    const grouped = buildGroupedManualNodes(nodes, manualNodeGroups);

    // 空分组名节点应归入"默认"
    expect(grouped['默认']).toHaveLength(3);
    expect(grouped['默认'].map(n => n.id)).toEqual(['n2', 'n3', 'n4']);
    
    // USA 分组正常
    expect(grouped['USA']).toHaveLength(1);
    expect(grouped['USA'][0].id).toBe('n1');
  });

  it('完整流程：空分组名节点应始终显示在"默认"分组', () => {
    const nodes = [
      { id: 'n1', url: 'ss://test1', group: 'HK' },
      { id: 'n2', url: 'ss://test2', group: '' },
      { id: 'n3', url: 'ss://test3', group: 'USA' },
      { id: 'n4', url: 'ss://test4', group: null }
    ];

    // Step 1: 收集分组列表
    const groups = collectManualNodeGroups(nodes);
    expect(groups).toEqual(['HK', 'USA']);

    // Step 2: 构建分组节点映射
    const grouped = buildGroupedManualNodes(nodes, groups);

    // 验证空分组名节点归入"默认"
    expect(grouped['默认']).toBeDefined();
    expect(grouped['默认']).toHaveLength(2);
    expect(grouped['默认'].map(n => n.id)).toEqual(['n2', 'n4']);

    // 验证命名分组正常
    expect(grouped['HK']).toHaveLength(1);
    expect(grouped['USA']).toHaveLength(1);
  });

  it('自定义分组顺序不应包含空字符串', () => {
    const nodes = [
      { id: 'n1', url: 'ss://test1', group: 'USA' },
      { id: 'n2', url: 'ss://test2', group: '' },
      { id: 'n3', url: 'ss://test3', group: 'Japan' }
    ];

    // 错误的自定义顺序（包含空字符串）
    const customOrder = ['Japan', '', 'USA'];

    const groups = collectManualNodeGroups(nodes, customOrder);

    // 空字符串不应出现在结果中
    expect(groups).not.toContain('');
    expect(groups).toEqual(['Japan', 'USA']);
  });
});
