/**
 * 伪装页面渲染模块
 * 当浏览器访问订阅链接时显示的伪装页面
/**
 * 伪装页面渲染模块
 * 当浏览器访问订阅链接时显示的伪装页面
 */

/**
 * 渲染默认伪装页面
 * @returns {Response} HTML响应
 */
export function renderDisguisePage() {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404 Not Found</title>
    <style>
        :root {
            --bg-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            --glass-bg: rgba(255, 255, 255, 0.1);
            --glass-border: rgba(255, 255, 255, 0.2);
            --text-color: #ffffff;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg-gradient);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            color: var(--text-color);
        }

        .container {
            text-align: center;
            position: relative;
            z-index: 10;
            padding: 2rem;
            max-width: 600px;
            width: 90%;
        }

        /* Glassmorphism Card Effect */
        .glass-card {
            background: var(--glass-bg);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid var(--glass-border);
            border-radius: 24px;
            padding: 4rem 2rem;
            box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
            animation: fadeInUp 0.8s ease-out;
        }

        .error-code {
            font-size: 120px;
            font-weight: 800;
            line-height: 1;
            margin-bottom: 1rem;
            background: linear-gradient(to bottom, #ffffff, rgba(255,255,255,0.5));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            filter: drop-shadow(0 4px 10px rgba(0,0,0,0.2));
            animation: float 6s ease-in-out infinite;
        }

        h1 {
            font-size: 2rem;
            margin-bottom: 1rem;
            font-weight: 600;
            letter-spacing: 0.5px;
        }

        p {
            font-size: 1.1rem;
            opacity: 0.8;
            margin-bottom: 2.5rem;
            line-height: 1.6;
        }

        .home-link {
            display: inline-flex;
            align-items: center;
            padding: 14px 36px;
            background: #ffffff;
            color: #764ba2;
            text-decoration: none;
            border-radius: 50px;
            font-weight: 600;
            font-size: 1rem;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }

        .home-link:hover {
            transform: translateY(-3px) scale(1.02);
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
            background: #f8f9fa;
        }

        .home-link:active {
            transform: translateY(-1px);
        }

        /* Ambient Background Shapes */
        .shape {
            position: absolute;
            border-radius: 50%;
            filter: blur(80px);
            z-index: 0;
            opacity: 0.6;
            animation: pulse 10s infinite alternate;
        }

        .shape-1 {
            top: -10%;
            left: -10%;
            width: 300px;
            height: 300px;
            background: #43e97b;
        }

        .shape-2 {
            bottom: -10%;
            right: -10%;
            width: 400px;
            height: 400px;
            background: #fa709a;
            animation-delay: -5s;
        }

        @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-20px); }
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes pulse {
            0% { transform: scale(1); opacity: 0.4; }
            100% { transform: scale(1.2); opacity: 0.7; }
        }

        @media (max-width: 768px) {
            .error-code { font-size: 80px; }
            h1 { font-size: 1.5rem; }
            .glass-card { padding: 3rem 1.5rem; }
        }
    </style>
</head>
<body>
    <div class="shape shape-1"></div>
    <div class="shape shape-2"></div>
    
    <div class="container">
        <div class="glass-card">
            <div class="error-code">404</div>
            <h1>页面未找到</h1>
            <p>抱歉，您访问的页面不存在或已被移除。<br>仿佛进入了数字荒原。</p>
            <a href="/" class="home-link">返回首页</a>
        </div>
    </div>
</body>
</html>
    `;

    return new Response(html, {
        status: 404,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache'
        }
    });
}

/**
 * 根据配置生成伪装响应 (Redirect 或 404 Page)
 * @param {Object} disguiseConfig 
 * @param {string} [baseUrl]
 * @returns {Response}
 */
export function createDisguiseResponse(disguiseConfig, baseUrl) {
    if (disguiseConfig && disguiseConfig.pageType === 'redirect' && disguiseConfig.redirectUrl) {
        const redirectUrl = normalizeRedirectUrl(disguiseConfig.redirectUrl, baseUrl);
        if (redirectUrl) {
            return new Response(null, {
                status: 302,
                headers: { Location: redirectUrl }
            });
        }
    }
    return renderDisguisePage();
}

function normalizeRedirectUrl(rawUrl, baseUrl) {
    if (typeof rawUrl !== 'string') {
        return null;
    }

    const trimmed = rawUrl.trim();
    if (!trimmed) {
        return null;
    }

    let candidate = trimmed;
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(candidate);
    if (!hasScheme && !candidate.startsWith('/') && !candidate.startsWith('//')) {
        candidate = `https://${candidate}`;
    }

    try {
        const normalized = encodeURI(candidate);
        const resolved = baseUrl ? new URL(normalized, baseUrl) : new URL(normalized);
        if (!['http:', 'https:'].includes(resolved.protocol)) {
            return null;
        }
        return resolved.toString();
    } catch (error) {
        return null;
    }
}
