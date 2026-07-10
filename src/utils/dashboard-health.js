const DEFAULT_NOW = () => Date.now();

function getTokenState(settings = {}) {
  const token = settings.mytoken;
  if (!token) return 'missing';
  if (token === 'auto') return 'auto';
  return 'stable';
}

function getTrafficState(sub, now) {
  const info = sub?.userInfo;
  if (!sub?.enabled || !info) return null;

  const total = Number(info.total || 0);
  const used = Number(info.upload || 0) + Number(info.download || 0);
  const expire = Number(info.expire || 0);

  if (expire > 0 && expire * 1000 < now) {
    return 'expired';
  }

  if (total > 0) {
    const remainingRatio = Math.max(0, total - used) / total;
    if (remainingRatio <= 0.2) return 'low';
  }

  return null;
}

export function shouldShowFullGuide({ subscriptions = [], profiles = [] } = {}) {
  return subscriptions.length === 0 || profiles.length === 0;
}

export function getDashboardHealthItems({
  subscriptions = [],
  profiles = [],
  settings = {},
  totalNodesCount = null,
  now = DEFAULT_NOW()
} = {}) {
  const items = [];
  const enabledSubscriptions = subscriptions.filter(sub => sub.enabled);
  const disabledSubscriptions = subscriptions.filter(sub => !sub.enabled);
  const activeProfiles = profiles.filter(profile => profile.enabled !== false);
  const tokenState = getTokenState(settings);
  const resolvedTotalNodes = totalNodesCount ?? subscriptions.reduce((sum, sub) => sum + Number(sub.nodeCount || 0), 0);
  const errorSubscriptions = subscriptions.filter(sub => Boolean(sub.lastError));
  const expiredSubscriptions = subscriptions.filter(sub => getTrafficState(sub, now) === 'expired');
  const lowTrafficSubscriptions = subscriptions.filter(sub => getTrafficState(sub, now) === 'low');

  if (subscriptions.length === 0) {
    items.push({
      id: 'missing-subscriptions',
      tone: 'warning',
      title: '还没有机场订阅',
      description: '先添加一个机场订阅，MiSub 才能获取节点并生成可用链接。',
      actionLabel: '添加机场订阅',
      actionRoute: '/dashboard/subscriptions',
      actionQuery: { status: 'missing' }
    });
  } else if (enabledSubscriptions.length === 0) {
    items.push({
      id: 'no-enabled-subscriptions',
      tone: 'danger',
      title: '没有启用的机场订阅',
      description: '当前订阅都处于停用状态，生成的默认订阅可能为空。',
      actionLabel: '检查机场订阅',
      actionRoute: '/dashboard/subscriptions',
      actionQuery: { status: 'disabled' }
    });
  }

  if (profiles.length === 0) {
    items.push({
      id: 'missing-profiles',
      tone: 'warning',
      title: '还没有组合订阅',
      description: '创建组合订阅后，可以按用途输出不同客户端链接。',
      actionLabel: '创建组合订阅',
      actionRoute: '/dashboard/subscriptions',
      actionQuery: { focus: 'profiles' }
    });
  } else if (activeProfiles.length === 0) {
    items.push({
      id: 'no-active-profiles',
      tone: 'warning',
      title: '组合订阅均未启用',
      description: '公开页和分享链接可能没有可用组合。',
      actionLabel: '检查我的订阅',
      actionRoute: '/dashboard/subscriptions',
      actionQuery: { status: 'profiles-disabled' }
    });
  }

  if (tokenState === 'missing') {
    items.push({
      id: 'missing-token',
      tone: 'danger',
      title: '主 Token 未配置',
      description: '固定主 Token 后，默认订阅链接才会稳定可复制。',
      actionLabel: '去设置 Token',
      actionRoute: '/dashboard/settings',
      actionQuery: { focus: 'mytoken' }
    });
  } else if (tokenState === 'auto') {
    items.push({
      id: 'auto-token',
      tone: 'warning',
      title: '主 Token 仍为自动模式',
      description: '自动 Token 可能变化，建议改成固定 Token 以避免客户端链接失效。',
      actionLabel: '固定 Token',
      actionRoute: '/dashboard/settings',
      actionQuery: { focus: 'mytoken' }
    });
  }

  if (subscriptions.length > 0 && resolvedTotalNodes === 0) {
    items.push({
      id: 'zero-nodes',
      tone: 'danger',
      title: '当前没有可用节点',
      description: '请刷新订阅或检查订阅源、代理和 User-Agent 设置。',
      actionLabel: '检查机场订阅',
      actionRoute: '/dashboard/subscriptions',
      actionQuery: { status: 'zero-nodes' }
    });
  }

  if (errorSubscriptions.length > 0) {
    items.push({
      id: 'subscription-errors',
      tone: 'danger',
      title: `${errorSubscriptions.length} 个订阅最近更新失败`,
      description: '建议查看错误详情或进入订阅日志排查。',
      actionLabel: '查看失败订阅',
      actionRoute: '/dashboard/subscriptions',
      actionQuery: { status: 'error' },
      secondaryActionLabel: '打开日志',
      secondaryAction: 'openLog',
      count: errorSubscriptions.length
    });
  }

  if (expiredSubscriptions.length > 0) {
    items.push({
      id: 'expired-subscriptions',
      tone: 'danger',
      title: `${expiredSubscriptions.length} 个订阅已过期`,
      description: '过期订阅可能无法继续提供节点。',
      actionLabel: '检查机场订阅',
      actionRoute: '/dashboard/subscriptions',
      actionQuery: { status: 'expired' },
      count: expiredSubscriptions.length
    });
  }

  if (lowTrafficSubscriptions.length > 0) {
    items.push({
      id: 'low-traffic',
      tone: 'warning',
      title: `${lowTrafficSubscriptions.length} 个订阅流量不足`,
      description: '剩余流量低于 20%，建议及时续费或切换来源。',
      actionLabel: '检查流量',
      actionRoute: '/dashboard/subscriptions',
      actionQuery: { status: 'low-traffic' },
      count: lowTrafficSubscriptions.length
    });
  }

  if (disabledSubscriptions.length > 0 && enabledSubscriptions.length > 0) {
    items.push({
      id: 'disabled-subscriptions',
      tone: 'info',
      title: `${disabledSubscriptions.length} 个订阅已停用`,
      description: '如需加入默认订阅，请前往机场订阅重新启用。',
      actionLabel: '管理订阅',
      actionRoute: '/dashboard/subscriptions',
      actionQuery: { status: 'disabled' },
      count: disabledSubscriptions.length
    });
  }

  return items.slice(0, 4);
}
