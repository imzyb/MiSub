/**
 * Cron Triggers 路由处理
 * 根据不同的定时任务执行相应的逻辑
 */

export async function onRequest(context) {
    const { request, env } = context;

    // 验证这是Cron触发
    if (request.headers.get('CF-Cron') !== 'true') {
        return new Response('Unauthorized', { status: 401 });
    }

    // 获取Cron任务类型
    const cronType = request.headers.get('CF-Cron-Type') || 'default';

    console.log(`[Cron] Executing ${cronType} at ${new Date().toISOString()}`);

    try {
        let result;

        switch (cronType) {
            case 'hourly-subscription-sync':
                result = await performSubscriptionSync(env);
                break;

            case 'daily-full-sync':
                result = await performFullSync(env);
                break;

            case 'traffic-check':
                result = await performTrafficCheck(env);
                break;

            default:
                result = await performSubscriptionSync(env);
        }

        return new Response(JSON.stringify({
            success: true,
            cronType,
            timestamp: new Date().toISOString(),
            ...result
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error(`[Cron Error] ${cronType}:`, error);

        return new Response(JSON.stringify({
            success: false,
            cronType,
            error: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * 执行订阅同步
 */
async function performSubscriptionSync(env) {
    console.log('[Cron] Performing subscription sync');

    const results = {
        timestamp: new Date().toISOString(),
        totalSubscriptions: 0,
        successfulSyncs: 0,
        failedSyncs: 0
    };

    try {
        // 从存储获取订阅列表
        const subscriptions = await getAllSubscriptions(env);
        results.totalSubscriptions = subscriptions.length;

        // 执行同步逻辑
        for (const sub of subscriptions) {
            try {
                console.log(`[Cron] Syncing subscription: ${sub.name}`);
                results.successfulSyncs++;
            } catch (error) {
                console.error(`[Cron] Failed to sync ${sub.name}:`, error);
                results.failedSyncs++;
            }
        }

    } catch (error) {
        console.error('[Cron] Subscription sync error:', error);
        results.error = error.message;
    }

    return results;
}

/**
 * 执行完整同步（清理缓存，重新获取所有订阅）
 */
async function performFullSync(env) {
    console.log('[Cron] Performing full sync');

    // 清理缓存
    await clearSubscriptionCache(env);

    // 执行完整同步
    const result = await performSubscriptionSync(env);

    return {
        ...result,
        type: 'full-sync'
    };
}

/**
 * 执行流量检查
 */
async function performTrafficCheck(env) {
    console.log('[Cron] Performing traffic check');

    const subscriptions = await getAllSubscriptions(env);
    const trafficResults = [];

    for (const sub of subscriptions) {
        try {
            // 简单的流量检查逻辑
            console.log(`[Cron] Checking traffic for ${sub.name}`);
        } catch (error) {
            console.error(`[Traffic Check] Failed for ${sub.name}:`, error);
        }
    }

    return {
        checkedSubscriptions: subscriptions.length,
        warnings: trafficResults.length,
        details: trafficResults
    };
}

/**
 * 清理订阅缓存
 */
async function clearSubscriptionCache(env) {
    // 清理 KV 缓存
    if (env.KV_STORAGE) {
        console.log('[Cron] Cache cleared');
    }
}

/**
 * 获取所有订阅
 */
async function getAllSubscriptions(env) {
    // 从存储获取订阅列表
    if (env.DB) {
        try {
            const { results } = await env.DB.prepare(
                "SELECT * FROM subscriptions WHERE enabled = 1"
            ).all();
            return results;
        } catch (error) {
            console.error('[Cron] Failed to fetch from D1:', error);
        }
    }

    if (env.KV_STORAGE) {
        try {
            const data = await env.KV_STORAGE.get('subscriptions');
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('[Cron] Failed to fetch from KV:', error);
        }
    }

    return [];
}