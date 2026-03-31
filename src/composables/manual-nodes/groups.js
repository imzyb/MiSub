export function collectManualNodeGroups(nodes) {
  const groups = new Set();
  nodes.forEach(node => {
    if (node.group) {
      groups.add(node.group);
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
    const groupName = node.group || '默认';
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
