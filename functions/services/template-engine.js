/**
 * 模板生成引擎
 * 借鉴miaomiaowu的模板系统，适配Cloudflare Pages
 */

class TemplateEngine {
    constructor() {
        this.templates = new Map();
        this.cache = new Map();
        this.cacheTTL = 10 * 60 * 1000; // 10分钟缓存
    }

    /**
     * 注册模板
     * @param {string} name - 模板名称
     * @param {string} template - 模板内容
     */
    registerTemplate(name, template) {
        this.templates.set(name, template);
        console.log(`[TemplateEngine] 注册模板: ${name}`);
    }

    /**
     * 获取模板
     * @param {string} name - 模板名称
     * @returns {string|null}
     */
    getTemplate(name) {
        return this.templates.get(name) || null;
    }

    /**
     * 渲染模板
     * @param {string} templateName - 模板名称
     * @param {Object} context - 渲染上下文
     * @returns {string}
     */
    render(templateName, context = {}) {
        const cacheKey = `${templateName}_${JSON.stringify(context)}`;

        // 检查缓存
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.result;
        }

        const template = this.getTemplate(templateName);
        if (!template) {
            throw new Error(`模板不存在: ${templateName}`);
        }

        let result = template;

        // 简单变量替换
        Object.entries(context).forEach(([key, value]) => {
            const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
            result = result.replace(regex, String(value));
        });

        // 缓存结果
        this.cache.set(cacheKey, {
            result,
            timestamp: Date.now()
        });

        return result;
    }

    /**
     * 渲染Clash配置模板
     * @param {Array} proxies - 代理节点列表
     * @param {Object} options - 配置选项
     * @returns {string}
     */
    renderClashConfig(proxies = [], options = {}) {
        const context = {
            proxies: JSON.stringify(proxies, null, 2),
            rules: options.rules || 'MATCH,DIRECT',
            ...options
        };

        // 使用普通字符串而不是模板字符串，避免esbuild解析问题
        let template = this.getTemplate('clash');
        if (!template) {
            template = 'port: 7890\n' +
                'socks-port: 7891\n' +
                'allow-lan: true\n' +
                'mode: Rule\n' +
                'log-level: info\n' +
                'external-controller: :9090\n\n' +
                'proxies: ${proxies}\n\n' +
                'proxy-groups:\n' +
                '  - name: 🚀 节点选择\n' +
                '    type: select\n' +
                '    proxies:\n' +
                '      - ♻️ 自动选择\n' +
                '      ${proxies}\n\n' +
                '  - name: ♻️ 自动选择\n' +
                '    type: url-test\n' +
                '    url: http://www.gstatic.com/generate_204\n' +
                '    interval: 300\n' +
                '    proxies:\n' +
                '      ${proxies}\n\n' +
                'rules: ${rules}';
        }

        return this.render('clash_template', context);
    }

    /**
     * 清理过期缓存
     */
    cleanupCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.cacheTTL) {
                this.cache.delete(key);
            }
        }
    }
}

export const templateEngine = new TemplateEngine();

// 注册默认模板
const clashTemplate = 'port: 7890\n' +
    'socks-port: 7891\n' +
    'allow-lan: true\n' +
    'mode: Rule\n' +
    'log-level: info\n' +
    'external-controller: :9090\n\n' +
    'proxies: ${proxies}\n\n' +
    'proxy-groups:\n' +
    '  - name: 🚀 节点选择\n' +
    '    type: select\n' +
    '    proxies:\n' +
    '      - ♻️ 自动选择\n' +
    '      ${proxies}\n\n' +
    '  - name: ♻️ 自动选择\n' +
    '    type: url-test\n' +
    '    url: http://www.gstatic.com/generate_204\n' +
    '    interval: 300\n' +
    '    proxies:\n' +
    '      ${proxies}\n\n' +
    'rules: ${rules}';

templateEngine.registerTemplate('clash', clashTemplate);

// 定期清理缓存
setInterval(() => {
    templateEngine.cleanupCache();
}, 30 * 60 * 1000); // 每30分钟清理一次