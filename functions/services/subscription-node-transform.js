/**
 * 机场订阅级别的节点治理：算子链 + include/exclude 过滤。
 *
 * 这里是「机场订阅」这个数据来源的唯一处理入口：
 * - 订阅组输出时用它处理实时拉取的节点；
 * - 节点持久化写库时也用它，保证库里存的就是用户设置后的结果，
 *   而不是把原始垃圾节点整包存进去。
 */

import { parseNodeInfo } from '../modules/utils/geo-utils.js';
import { runOperatorChain } from '../utils/operator-runner.js';
import { parseFilterRuleText } from '../modules/utils/node-cleaner.js';

function ensureArray(value) {
    return Array.isArray(value) ? value : [];
}

/**
 * 应用过滤规则（exclude / include，支持 --- 分隔与 keep: 前缀）
 */
export function applyFilterRules(validNodes, sub) {
    const ruleText = sub?.exclude;
    if (!ruleText || ruleText.trim() === '') return validNodes;

    // 规则文本解析复用 node-cleaner 的实现（分隔符 / keep: 语义一致），避免三份重复逻辑
    const { includeRules: keepRules, excludeRules } = parseFilterRuleText(ruleText);

    let result = validNodes;
    if (keepRules.hasRules) result = filterNodes(result, keepRules, 'include');
    if (excludeRules.hasRules) result = filterNodes(result, excludeRules, 'exclude');
    return result;
}

/**
 * 订阅源级转换：算子链 + 文本过滤。
 * @param {string[]} nodeUrls
 * @param {Object} sub 机场订阅对象
 * @param {{ userAgent?: string, config?: Object }} [context]
 */
export async function applySubscriptionTransforms(nodeUrls, sub, context = {}) {
    if (!Array.isArray(nodeUrls) || nodeUrls.length === 0) return [];

    let processed = [...nodeUrls];

    let operators = ensureArray(sub?.operators);
    if (!operators.length && sub?.nodeTransform?.enabled && sub.nodeTransform.operators) {
        operators = ensureArray(sub.nodeTransform.operators);
    }

    if (operators.length > 0) {
        processed = await runOperatorChain(processed, operators, {
            subName: sub?.name,
            userAgent: context.userAgent,
            config: context.config,
        });
    }

    processed = applyFilterRules(processed, sub);
    return processed;
}


function filterNodes(nodes, rules, mode = 'exclude') {
    if (!rules || !rules.hasRules) return nodes;
    const isInclude = mode === 'include';

    return nodes.filter((nodeLink) => {
        const nodeInfo = parseNodeInfo(nodeLink);
        const protocol = nodeInfo.protocol || '';
        const nodeName = nodeInfo.name || '';
        const regionZh = nodeInfo.region || '';

        const protocolHit = protocol && rules.protocols.has(protocol);
        let nameHit = false;
        if (rules.nameRegex) {
            nameHit = rules.nameRegex.test(nodeName) || rules.nameRegex.test(regionZh);
        }

        if (isInclude) return protocolHit || nameHit;
        return !(protocolHit || nameHit);
    });
}
