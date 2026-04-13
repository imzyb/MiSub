/**
 * Cron Triggers 定时同步服务
 * 使用 Cloudflare Pages Functions 的 Cron Triggers 功能
 */

export async function onRequest(context) {
    // 只有在 Cron 触发时才执行
    if (context.request.headers.get('CF-Cron') !== 'true') {
        return new Response('Not a cron request', { status: 400 });
    }

    const results = {
        timestamp: new Date().toISOString(),
        subscriptionSync: null
    };

    try {
        // 执行订阅同步逻辑
        results.subscriptionSync = await performSubscriptionSync(context.env);
    } catch (error) {
        console.error('Cron subscription sync failed:', error);
        results.subscriptionSync = { error: error.message };
    }

    return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * 执行订阅同步
 */
export async function performSubscriptionSync(env, config = {}) {
    const {
        maxSyncCount = 50,
        timeout = 30000,
        concurrency = 5
    } = config;

    const results = {
        timestamp: new Date().toISOString(),
        totalSubscriptions: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        details: [],
        config: {
            maxSyncCount,
            timeout,
            concurrency
        }
    };

    try {
        // 获取所有需要同步的订阅
        const subscriptions = await getSubscriptionsToSync(env);

        results.totalSubscriptions = subscriptions.length;

        // 并发执行同步，但限制并发数
        const BATCH_SIZE = concurrency;
        for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
            const batch = subscriptions.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(sub => syncSingleSubscription(sub, env, timeout));

            const batchResults = await Promise.allSettled(batchPromises);

            batchResults.forEach((result, index) => {
                const subscription = batch[index];
                if (result.status === 'fulfilled') {
                    results.successfulSyncs++;
                    results.details.push({
                        name: subscription.name,
                        url: subscription.url,
                        status: 'success',
                        nodeCount: result.value.nodeCount
                    });
                } else {
                    results.failedSyncs++;
                    results.details.push({
                        name: subscription.name,
                        url: subscription.url,
                        status: 'failed',
                        error: result.reason.message
                    });
                }
            });
        }

    } catch (error) {
        console.error('Subscription sync error:', error);
        results.error = error.message;
    }

    return results;
}

/**
 * 获取需要同步的订阅列表
 */
async function getSubscriptionsToSync(env) {
    // 这里应该从你的存储（KV/D1）中获取订阅列表
    // 示例实现
    const subscriptions = [];

    // 从 KV 存储获取
    if (env.KV_STORAGE) {
        const data = await env.KV_STORAGE.get('subscriptions');
        if (data) {
            const parsed = JSON.parse(data);
            subscriptions.push(...parsed);
        }
    }

    // 从 D1 数据库获取
    if (env.DB) {
        const { results } = await env.DB.prepare(
            "SELECT * FROM subscriptions WHERE auto_sync = 1"
        ).all();
        subscriptions.push(...results);
    }

    return subscriptions;
}

/**
 * 同步单个订阅
 */
async function syncSingleSubscription(subscription, env) {
    const { url, userAgent = 'clash-meta/2.5.0', timeout = 30000 } = subscription;

    console.log(`[Cron Sync] Syncing subscription: ${subscription.name}`);

    // 使用重试机制获取订阅
    const response = await fetch(url, {
        headers: {
            'User-Agent': userAgent
        },
        signal: AbortSignal.timeout(timeout)
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.text();

    // 解析订阅内容
    const nodes = await parseSubscriptionContent(content);

    // 更新存储
    await updateSubscriptionData(subscription, nodes, env);

    return {
        nodeCount: nodes.length,
        contentLength: content.length
    };
}

/**
 * 解析订阅内容
 */
async function parseSubscriptionContent(content) {
    // 这里应该调用你的订阅解析逻辑
    // 简单示例：假设是 Clash 格式
    try {
        const config = jsyaml.load(content);
        return config.proxies || [];
    } catch (error) {
        // 尝试 base64 解码
        try {
            const decoded = atob(content.trim());
            const config = jsyaml.load(decoded);
            return config.proxies || [];
        } catch (decodeError) {
            throw new Error('Unable to parse subscription content');
        }
    }
}

/**
 * 更新订阅数据到存储
 */
async function updateSubscriptionData(subscription, nodes, env) {
    // 更新 KV 存储
    if (env.KV_STORAGE) {
        const key = `subscription_${subscription.id}`;
        await env.KV_STORAGE.put(key, JSON.stringify({
            ...subscription,
            nodes,
            lastSync: new Date().toISOString(),
            nodeCount: nodes.length
        }));
    }

    // 更新 D1 数据库
    if (env.DB) {
        await env.DB.prepare(
            `UPDATE subscriptions
             SET nodes = ?, node_count = ?, last_sync = ?
             WHERE id = ?`
        ).bind(
            JSON.stringify(nodes),
            nodes.length,
            new Date().toISOString(),
            subscription.id
        ).run();
    }
}
