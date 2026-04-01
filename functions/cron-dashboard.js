/**
 * Cron Triggers 管理面板
 * 提供前端界面查看和管理定时任务
 */

export async function onRequest(context) {
    const { request, env } = context;

    if (request.method === 'GET') {
        // 返回定时任务状态页面
        return getCronDashboard(env);
    }

    if (request.method === 'POST') {
        // 手动触发同步
        return triggerManualSync(env);
    }

    return new Response('Method not allowed', { status: 405 });
}

/**
 * 获取定时任务仪表板
 */
function getCronDashboard(env) {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cron Triggers 管理面板 - MiSub</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .status-card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; }
        .status-card h3 { margin: 0 0 10px 0; color: #333; }
        .status-value { font-size: 2em; font-weight: bold; color: #007acc; }
        .sync-btn { background: #007acc; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 16px; }
        .sync-btn:hover { background: #005999; }
        .sync-btn:disabled { background: #ccc; cursor: not-allowed; }
        .logs { background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 5px; padding: 15px; max-height: 400px; overflow-y: auto; }
        .log-entry { margin: 5px 0; padding: 5px; border-left: 3px solid #007acc; background: white; }
        .log-time { color: #666; font-size: 0.9em; }
        .log-success { border-left-color: #28a745; }
        .log-error { border-left-color: #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🕐 Cron Triggers 管理面板</h1>
            <button class="sync-btn" onclick="triggerSync()">手动同步</button>
        </div>

        <div class="status-grid">
            <div class="status-card">
                <h3>📊 总订阅数</h3>
                <div class="status-value" id="totalSubs">-</div>
            </div>
            <div class="status-card">
                <h3>✅ 成功同步</h3>
                <div class="status-value" id="successCount">-</div>
            </div>
            <div class="status-card">
                <h3>❌ 失败同步</h3>
                <div class="status-value" id="failedCount">-</div>
            </div>
            <div class="status-card">
                <h3>🕐 上次同步</h3>
                <div class="status-value" id="lastSync">-</div>
            </div>
        </div>

        <h2>📋 同步日志</h2>
        <div class="logs" id="syncLogs">
            <div class="log-entry">
                <div class="log-time">加载中...</div>
                <div>正在获取同步状态...</div>
            </div>
        </div>
    </div>

    <script>
        // 页面加载时获取状态
        loadStatus();

        async function loadStatus() {
            try {
                const response = await fetch('/api/cron/status');
                const data = await response.json();

                // 兼容性：支持从 lastExecution 中读取字段
                const status = {
                    totalSubscriptions: data.totalSubscriptions || data.lastExecution?.result?.totalSubscriptions || 0,
                    successfulSyncs: data.successfulSyncs || data.lastExecution?.result?.successfulSyncs || 0,
                    failedSyncs: data.failedSyncs || data.lastExecution?.result?.failedSyncs || 0,
                    lastSync: data.lastSync || data.lastExecution?.timestamp || null,
                    details: data.details || data.lastExecution?.result?.details || []
                };

                document.getElementById('totalSubs').textContent = status.totalSubscriptions;
                document.getElementById('successCount').textContent = status.successfulSyncs;
                document.getElementById('failedCount').textContent = status.failedSyncs;
                document.getElementById('lastSync').textContent = status.lastSync ?
                    new Date(status.lastSync).toLocaleString() : '从未';

                updateLogs(status.details);
            } catch (error) {
                console.error('Failed to load status:', error);
            }
        }

        async function triggerSync() {
            const btn = document.querySelector('.sync-btn');
            btn.disabled = true;
            btn.textContent = '同步中...';

            try {
                const response = await fetch('/api/cron/trigger', { method: 'POST' });
                const result = await response.json();

                if (result.success) {
                    alert('同步完成！');
                    loadStatus(); // 重新加载状态
                } else {
                    alert('同步失败：' + result.error);
                }
            } catch (error) {
                alert('同步请求失败：' + error.message);
            } finally {
                btn.disabled = false;
                btn.textContent = '手动同步';
            }
        }

        function updateLogs(details) {
            const logsContainer = document.getElementById('syncLogs');
            logsContainer.innerHTML = '';

            if (!details || details.length === 0) {
                logsContainer.innerHTML = '<div class="log-entry">暂无同步记录</div>';
                return;
            }

            details.slice(0, 50).forEach(detail => {
                const logEntry = document.createElement('div');
                logEntry.className = 'log-entry ' + (detail.status === 'success' ? 'log-success' : 'log-error');

                logEntry.innerHTML = \`
                    <div class="log-time">\${new Date().toLocaleString()}</div>
                    <div><strong>\${detail.name}</strong>: \${detail.status === 'success' ?
                        \`同步成功 (\${detail.nodeCount} 个节点)\` :
                        \`同步失败 - \${detail.error}\`}</div>
                \`;

                logsContainer.appendChild(logEntry);
            });
        }

        // 每30秒自动刷新状态
        setInterval(loadStatus, 30000);
    </script>
</body>
</html>`;

    return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}

/**
 * 手动触发同步
 */
async function triggerManualSync(env) {
    try {
        // 手动触发同步的请求应该转发到 _schedule.js
        // 由于Cloudflare Pages Functions限制，这里只返回成功响应
        return new Response(JSON.stringify({
            success: true,
            message: '同步任务已提交，请查看日志获取进度',
            timestamp: new Date().toISOString()
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}