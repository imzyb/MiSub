export function buildAutoSortedSubscriptions(allSubscriptions, manualNodes) {
  const subs = allSubscriptions.filter(s => s.url && /^https?:\/\//.test(s.url));
  const nodes = [...manualNodes];

  const regionKeywords = { HK: [/香港/, /HK/, /Hong Kong/i], TW: [/台湾/, /TW/, /Taiwan/i], SG: [/新加坡/, /SG/, /狮城/, /Singapore/i], JP: [/日本/, /JP/, /Japan/i], US: [/美国/, /US/, /United States/i], KR: [/韩国/, /KR/, /Korea/i], GB: [/英国/, /GB/, /UK/, /United Kingdom/i], DE: [/德国/, /DE/, /Germany/i], FR: [/法国/, /FR/, /France/i], CA: [/加拿大/, /CA/, /Canada/i], AU: [/澳大利亚/, /AU/, /Australia/i], };
  const regionOrder = ['HK', 'TW', 'SG', 'JP', 'US', 'KR', 'GB', 'DE', 'FR', 'CA', 'AU'];
  const getRegionCode = (name) => { for (const code in regionKeywords) { for (const keyword of regionKeywords[code]) { if (keyword.test(name)) return code; } } return 'ZZ'; };

  nodes.sort((a, b) => {
    const regionA = getRegionCode(a.name);
    const regionB = getRegionCode(b.name);
    const indexA = regionOrder.indexOf(regionA);
    const indexB = regionOrder.indexOf(regionB);
    const effectiveIndexA = indexA === -1 ? Infinity : indexA;
    const effectiveIndexB = indexB === -1 ? Infinity : indexB;

    // Primary Sort: Group
    const groupA = a.group || '';
    const groupB = b.group || '';
    if (groupA !== groupB) {
      if (!groupA) return 1; // Empty group last
      if (!groupB) return -1;
      return groupA.localeCompare(groupB, 'zh-CN');
    }

    if (effectiveIndexA !== effectiveIndexB) return effectiveIndexA - effectiveIndexB;
    return a.name.localeCompare(b.name, 'zh-CN');
  });

  return [...nodes, ...subs];
}
