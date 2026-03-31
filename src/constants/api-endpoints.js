/**
 * API端点定义常量
 * @author MiSub Team
 */

export const API_ENDPOINTS = {
    // 认证相关
    LOGIN: '/api/login',
    LOGOUT: '/api/logout',

    // 数据相关
    DATA: '/api/data',
    MISUBS: '/api/misubs',
    SETTINGS: '/api/settings',

    // 订阅相关
    SUB_NODES: '/api/subscription_nodes',
    NODE_COUNT: '/api/node_count',
    FETCH_EXTERNAL: '/api/fetch_external_url',
    BATCH_UPDATE: '/api/batch_update_nodes',
    DEBUG_SUB: '/api/debug_subscription',

    // VPS Monitor
    VPS_REPORT: '/api/vps/report',
    VPS_NODES: '/api/vps/nodes',
    VPS_ALERTS: '/api/vps/alerts',
    VPS_NETWORK_TARGETS: '/api/vps/network_targets',
    VPS_NETWORK_CHECK: '/api/vps/network_check',
    VPS_CONFIG: '/api/vps/config',

    // 迁移相关
    MIGRATE: '/api/migrate',
    MIGRATE_TO_D1: '/api/migrate_to_d1',

    // 订阅访问
    SUB_BASE: '/sub',
    SUB_PROFILE: '/sub/:token/:profileId',
    SUB_DIRECT: '/sub/:token'
};
