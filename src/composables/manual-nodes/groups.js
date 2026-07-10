export function normalizeManualNodeGroupName(groupName) {
  return typeof groupName === 'string' ? groupName.trim() : '';
}

export function collectManualNodeGroups(nodes, customOrder = []) {
  const groups = new Set();
  nodes.forEach(node => {
    const group = normalizeManualNodeGroupName(node.group);
    if (group) {
      groups.add(group);
    }
  });
  
  const allGroups = Array.from(groups);
  
  // 如果有自定义顺序，按自定义顺序排列，然后追加新出现的分组
  if (customOrder && customOrder.length > 0) {
    const orderedGroups = [];
    const remaining = new Set(allGroups);
    
    // 先按自定义顺序添加
    customOrder.forEach(group => {
      if (remaining.has(group)) {
        orderedGroups.push(group);
        remaining.delete(group);
      }
    });
    
    // 追加新分组（保持首次出现顺序）
    allGroups.forEach(group => {
      if (remaining.has(group)) {
        orderedGroups.push(group);
      }
    });
    
    return orderedGroups;
  }
  
  // 默认保留首次出现顺序
  return allGroups;
}

export function buildGroupedManualNodes(nodesToDisplay, manualNodeGroups) {
  const groups = {};
  // Initialize groups
  manualNodeGroups.forEach(group => {
    groups[group] = [];
  });
  groups['默认'] = []; // Default group for ungrouped nodes

  nodesToDisplay.forEach(node => {
    const groupName = normalizeManualNodeGroupName(node.group) || '默认';
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(node);
  });

  const result = {};
  Object.keys(groups).forEach(key => {
    if (groups[key].length > 0) {
      result[key] = groups[key];
    }
  });

  return result;
}
