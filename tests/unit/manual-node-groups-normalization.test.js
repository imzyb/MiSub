import { describe, expect, it } from 'vitest';
import { collectManualNodeGroups, normalizeManualNodeGroupName } from '../../src/composables/manual-nodes/groups.js';

describe('manual node group normalization', () => {
  it('规范化分组名时去掉首尾空白', () => {
    expect(normalizeManualNodeGroupName('  S5  ')).toBe('S5');
    expect(normalizeManualNodeGroupName('\tFreezeHost\n')).toBe('FreezeHost');
    expect(normalizeManualNodeGroupName(null)).toBe('');
  });

  it('收集手动节点分组时按 trim 后的名称去重，避免肉眼同名分组', () => {
    const groups = collectManualNodeGroups([
      { id: 'n1', group: 'S5' },
      { id: 'n2', group: ' S5 ' },
      { id: 'n3', group: 'FreezeHost' },
      { id: 'n4', group: '' }
    ]);

    expect(groups).toEqual(['FreezeHost', 'S5']);
  });
});
