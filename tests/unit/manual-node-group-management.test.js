import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useDataStore } from '../../src/stores/useDataStore.js';
import { useManualNodes } from '../../src/composables/useManualNodes.js';

describe('手动节点分组管理', () => {
  let dataStore;
  let markDirty;
  let manualNodes;

  beforeEach(() => {
    setActivePinia(createPinia());
    dataStore = useDataStore();
    markDirty = () => {};
    
    // 初始化测试数据：3个分组，每组2个节点
    dataStore.subscriptions = [
      { id: 'n1', url: 'ss://test1', name: 'Node1', group: 'USA', enabled: true },
      { id: 'n2', url: 'ss://test2', name: 'Node2', group: 'USA', enabled: true },
      { id: 'n3', url: 'ss://test3', name: 'Node3', group: 'Japan', enabled: true },
      { id: 'n4', url: 'ss://test4', name: 'Node4', group: 'Japan', enabled: true },
      { id: 'n5', url: 'ss://test5', name: 'Node5', group: 'HK', enabled: true },
      { id: 'n6', url: 'ss://test6', name: 'Node6', group: 'HK', enabled: true }
    ];

    manualNodes = useManualNodes(markDirty);
  });

  it('分组顺序默认按节点首次出现顺序推导', () => {
    const groups = manualNodes.manualNodeGroups.value;
    
    // 节点顺序：USA, USA, Japan, Japan, HK, HK
    // 首次出现顺序：USA, Japan, HK
    expect(groups).toEqual(['USA', 'Japan', 'HK']);
  });

  it('可以调整分组顺序（不影响节点顺序）', () => {
    // 用户想把 HK 移到第一位
    manualNodes.reorderGroups(['HK', 'USA', 'Japan']);

    const groups = manualNodes.manualNodeGroups.value;
    expect(groups).toEqual(['HK', 'USA', 'Japan']);

    // 节点顺序不变
    const nodeGroups = dataStore.subscriptions.map(n => n.group);
    expect(nodeGroups).toEqual(['USA', 'USA', 'Japan', 'Japan', 'HK', 'HK']);
  });

  it('调整分组顺序后，新增分组自动追加到末尾', () => {
    manualNodes.reorderGroups(['HK', 'USA', 'Japan']);

    // 添加新分组 Singapore
    dataStore.addSubscription({ id: 'n7', url: 'ss://test7', name: 'Node7', group: 'Singapore', enabled: true });

    const groups = manualNodes.manualNodeGroups.value;
    expect(groups).toEqual(['HK', 'USA', 'Japan', 'Singapore']);
  });

  it('删除分组时，从自定义排序中移除', () => {
    manualNodes.reorderGroups(['HK', 'USA', 'Japan']);
    manualNodes.deleteGroup('USA');

    const groups = manualNodes.manualNodeGroups.value;
    expect(groups).toEqual(['HK', 'Japan']);
  });

  it('重命名分组时，在自定义排序中同步更新', () => {
    manualNodes.reorderGroups(['HK', 'USA', 'Japan']);
    manualNodes.renameGroup('USA', 'America');

    const groups = manualNodes.manualNodeGroups.value;
    expect(groups).toEqual(['HK', 'America', 'Japan']);
  });

  it('重命名不存在的分组应不产生影响', () => {
    manualNodes.reorderGroups(['HK', 'USA', 'Japan']);
    const beforeGroups = [...manualNodes.manualNodeGroups.value];
    
    manualNodes.renameGroup('NonExistent', 'NewName');

    const afterGroups = manualNodes.manualNodeGroups.value;
    expect(afterGroups).toEqual(beforeGroups);
  });

  it('删除不存在的分组应不产生影响', () => {
    manualNodes.reorderGroups(['HK', 'USA', 'Japan']);
    const beforeGroups = [...manualNodes.manualNodeGroups.value];
    
    manualNodes.deleteGroup('NonExistent');

    const afterGroups = manualNodes.manualNodeGroups.value;
    expect(afterGroups).toEqual(beforeGroups);
  });

  it('重命名为空字符串应被忽略', () => {
    manualNodes.reorderGroups(['HK', 'USA', 'Japan']);
    const beforeGroups = [...manualNodes.manualNodeGroups.value];
    
    manualNodes.renameGroup('USA', '');

    const afterGroups = manualNodes.manualNodeGroups.value;
    expect(afterGroups).toEqual(beforeGroups);
  });

  it('对子集排序时只替换可见节点顺序并保留隐藏节点和订阅', () => {
    dataStore.subscriptions = [
      { id: 'a1', url: 'ss://a1', name: 'A1', group: 'A', enabled: true },
      { id: 'b1', url: 'ss://b1', name: 'B1', group: 'B', enabled: true },
      { id: 'a2', url: 'ss://a2', name: 'A2', group: 'A', enabled: true },
      { id: 's1', url: 'https://subscription.example/sub', name: 'Remote sub', enabled: true }
    ];

    manualNodes.reorderManualNodes([
      { id: 'a2', url: 'ss://a2', name: 'A2', group: 'A', enabled: true },
      { id: 'a1', url: 'ss://a1', name: 'A1', group: 'A', enabled: true }
    ]);

    expect(dataStore.subscriptions.map(node => node.id)).toEqual(['a2', 'b1', 'a1', 's1']);
  });

  it('重命名为相同名称应被忽略', () => {
    manualNodes.reorderGroups(['HK', 'USA', 'Japan']);
    const beforeGroups = [...manualNodes.manualNodeGroups.value];
    
    manualNodes.renameGroup('USA', 'USA');

    const afterGroups = manualNodes.manualNodeGroups.value;
    expect(afterGroups).toEqual(beforeGroups);
  });
});
