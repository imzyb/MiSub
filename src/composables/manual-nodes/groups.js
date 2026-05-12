export function normalizeManualNodeGroupName(groupName) {
  return typeof groupName === 'string' ? groupName.trim() : '';
}

export function collectManualNodeGroups(nodes) {
  const groups = new Set();
  nodes.forEach(node => {
    const group = normalizeManualNodeGroupName(node.group);
    if (group) {
      groups.add(group);
    }
  });
  return Array.from(groups).sort();
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
