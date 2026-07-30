const COMMON_REGION_CODES = ['HK', 'US', 'JP', 'SG', 'TW', 'KR', 'UK', 'DE'];

export const REGIONAL_PROTOCOL_RENAME_DSL = [
  {
    action: 'rename',
    when: [
      {
        field: 'regionCode',
        op: 'in',
        value: COMMON_REGION_CODES
      },
      {
        field: 'name',
        op: 'regex',
        value: '移动优选|联通优选|电信优选|cloudflare',
        flags: 'i'
      }
    ],
    template: '☁CF-{regionCode}-{index}',
    groupBy: 'CF|{regionCode}',
    rank: 0
  },
  {
    action: 'rename',
    when: {
      field: 'regionCode',
      op: 'in',
      value: COMMON_REGION_CODES
    },
    unless: {
      field: 'name',
      op: 'regex',
      value: '^☁CF-'
    },
    template: '{emoji}{regionCode}-{protocolLabel(name, protocol)}-{index}',
    groupBy: '{regionCode}|{protocolLabel(name, protocol)}',
    rank: 1
  },
  {
    action: 'sort',
    field: '_dslRank',
    order: 'asc',
    missing: 'last'
  }
];

export function createRegionalProtocolRenameDsl() {
  return JSON.parse(JSON.stringify(REGIONAL_PROTOCOL_RENAME_DSL));
}
