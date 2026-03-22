<script setup>
import { ref, watch } from 'vue';
import { useToastStore } from '../../stores/toast.js';
import Modal from '../forms/Modal.vue';
import yaml from 'js-yaml';
import { extractNodeName } from '../../lib/utils.js';
import { convertClashProxyToUrl, batchConvertClashProxies, validateGeneratedUrl, parseSurgeConfig, parseQuantumultXConfig } from '../../utils/protocolConverter.js';
import { handleError } from '../../utils/errorHandler.js';
import { generateNodeId } from '../../utils/id.js';
import { api, APIError } from '../../lib/http.js';
import { COMMON_NODE_PROTOCOLS } from '../../constants/nodeProtocols.js';
import FormatDetector from './SubscriptionImport/FormatDetector.vue';
import ImportForm from './SubscriptionImport/ImportForm.vue';
import ParseResult from './SubscriptionImport/ParseResult.vue';
import GroupSelector from '../ui/GroupSelector.vue'; // Added

const isDev = import.meta.env.DEV;

const props = defineProps({
  show: Boolean,
  addNodesFromBulk: Function,
  groups: { // Added
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:show']);

const subscriptionUrl = ref('');
const isLoading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const parseStatus = ref('');
const groupName = ref(''); // Added
const DIRECT_URL_PROTOCOLS = COMMON_NODE_PROTOCOLS.filter(protocol =>
  ['vmess', 'vless', 'trojan', 'ss', 'ssr', 'hysteria', 'hysteria2', 'tuic', 'socks5', 'http', 'snell', 'wireguard'].includes(protocol)
);

const toastStore = useToastStore();

watch(() => props.show, (newVal) => {
  if (!newVal) {
    // 重置所有状态
    subscriptionUrl.value = '';
    groupName.value = ''; // Added
    errorMessage.value = '';
    successMessage.value = '';
    parseStatus.value = '';
    isLoading.value = false;
  }
});

/**
 * 验证URL格式
 */
const isValidUrl = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * 智能Base64解码
 */
const smartBase64Decode = (text) => {
  const cleanText = text.trim().replace(/\s/g, '');

  const normalizeBase64 = (value) => {
    let normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4;
    if (padding) {
      normalized += '='.repeat(4 - padding);
    }
    return normalized;
  };

  // 尝试标准 Base64 解码
  const normalizedText = normalizeBase64(cleanText);
  if (/^[A-Za-z0-9+/=]+$/.test(normalizedText)) {
    try {
      return atob(normalizedText);
    } catch (e) {
      return text;
    }
  }

  // 尝试 URL 解码后再做 Base64 解码
  try {
    const urlDecoded = decodeURIComponent(cleanText);
    const normalizedDecoded = normalizeBase64(urlDecoded);
    if (/^[A-Za-z0-9+/=]+$/.test(normalizedDecoded)) {
      return atob(normalizedDecoded);
    }
  } catch (e) {
    if (isDev) {
      console.debug('[Parser] URL decode failed, using raw text:', e);
    }
  }

  return text;
};

/**
 * 解析单个节点URL
 */
const parseSingleUrl = (url) => {
  // 基础URL格式检查
  if (!url.includes('://')) {
    return null;
  }

  const protocol = url.split('://')[0].toLowerCase();

  if (!DIRECT_URL_PROTOCOLS.includes(protocol)) {
    console.warn(`不支持的协议: ${protocol}`);
    return null;
  }

  // 尝试修复常见的URL格式问题
  let fixedUrl = url;

  // 修复vmess URL格式
  if (protocol === 'vmess' && !url.includes('://')) {
    // 可能是旧的vmess格式
    fixedUrl = `vmess://${url}`;
  }

  // 验证生成的URL
  if (!validateGeneratedUrl(fixedUrl)) {
    return null;
  }

  return {
    id: generateNodeId(),
    name: extractNodeName(fixedUrl) || `${protocol.toUpperCase()}节点`,
    url: fixedUrl,
    enabled: true,
    protocol: protocol,
    source: 'direct'
  };
};

/**
 * 解析YAML配置文件
 */
const parseYamlConfig = (content) => {
  const nodes = [];

  try {
    const parsedYaml = yaml.load(content);

    if (!parsedYaml || typeof parsedYaml !== 'object') {
      return nodes;
    }

    // 处理不同的YAML格式
    let proxies = [];

    // Clash格式
    if (parsedYaml.proxies && Array.isArray(parsedYaml.proxies)) {
      proxies = parsedYaml.proxies;
      if (isDev) {
        console.debug(`[YAML Parser] Found Clash format with ${proxies.length} proxies`);
      }
    }

    // Sing-Box格式
    else if (parsedYaml.outbounds && Array.isArray(parsedYaml.outbounds)) {
      proxies = parsedYaml.outbounds.filter(outbound =>
        outbound.type !== 'direct' &&
        outbound.type !== 'block' &&
        outbound.type !== 'dns' &&
        outbound.type !== 'selector' &&
        outbound.type !== 'urltest'
      );
      if (isDev) {
        console.debug(`[YAML Parser] Found Sing-Box format with ${proxies.length} outbounds`);
      }
    }

    // 其他格式 - 尝试查找包含代理信息的字段
    else {
      const possibleFields = ['proxies', 'outbounds', 'nodes', 'servers', 'rules'];
      for (const field of possibleFields) {
        if (parsedYaml[field] && Array.isArray(parsedYaml[field])) {
          proxies = parsedYaml[field];
          if (isDev) {
            console.debug(`[YAML Parser] Found ${field} with ${proxies.length} entries`);
          }
          break;
        }
      }
    }

    if (proxies.length === 0) {
      return nodes;
    }

    // 批量转换
    const convertedProxies = batchConvertClashProxies(proxies);

    for (const proxy of convertedProxies) {
      // [FIX] 验证生成的URL
      if (!validateGeneratedUrl(proxy.url)) {
        console.warn(`[YAML Parser] 跳过无效节点: ${proxy.name}`);
        continue;
      }

      const node = {
        id: generateNodeId(),
        name: proxy.name || 'Unknown',
        url: proxy.url,
        enabled: true,
        protocol: proxy.type,
        source: 'yaml',
        original: proxy.original
      };

      nodes.push(node);
    }

    if (isDev) {
      console.debug(`[YAML Parser] Successfully converted ${nodes.length} nodes`);
    }
    return nodes;

  } catch (e) {
    console.error('YAML解析失败:', e);
    return nodes;
  }
};

/**
 * 解析Surge配置文件
 */
const parseSurgeConfigFile = (content) => {
  try {
    const nodes = parseSurgeConfig(content);
    if (isDev) {
      console.debug(`[Surge Parser] Found ${nodes.length} nodes`);
    }
    return nodes;
  } catch (e) {
    console.error('Surge解析失败:', e);
    return [];
  }
};

/**
 * 解析Quantumult X配置文件
 */
const parseQuantumultXConfigFile = (content) => {
  try {
    const nodes = parseQuantumultXConfig(content);
    if (isDev) {
      console.debug(`[QuantumultX Parser] Found ${nodes.length} nodes`);
    }
    return nodes;
  } catch (e) {
    console.error('QuantumultX解析失败:', e);
    return [];
  }
};

/**
 * 解析文本内容中的节点
 */
const parseTextNodes = (content) => {
  const nodes = [];
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');

  for (const line of lines) {
    const trimmedLine = line.trim();

    // 跳过注释和空行
    if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
      continue;
    }

    // 尝试解析单个URL
    const node = parseSingleUrl(trimmedLine);
    if (node) {
      nodes.push(node);
    }
  }

  return nodes;
};

/**
 * 主要解析函数
 */
const parseNodes = (content) => {
  const nodes = [];
  let method = '';

  if (isDev) {
    console.debug(`[Parser] Starting to parse ${content.length} characters`);
  }

  // 方法1: 尝试Base64解码后解析
  try {
    const decodedContent = smartBase64Decode(content);
    if (decodedContent !== content) {
      method = 'Base64解码';
      parseStatus.value = `检测到Base64编码，正在解码...`;

      // 解码后尝试多种格式解析
      const allParsedNodes = [];

      // 尝试YAML解析
      const yamlNodes = parseYamlConfig(decodedContent);
      if (yamlNodes.length > 0) {
        method += ' + YAML解析';
        allParsedNodes.push(...yamlNodes);
      }

      // 尝试Surge解析
      const surgeNodes = parseSurgeConfigFile(decodedContent);
      if (surgeNodes.length > 0) {
        method += ' + Surge解析';
        allParsedNodes.push(...surgeNodes);
      }

      // 尝试QuantumultX解析
      const quantumultXNodes = parseQuantumultXConfigFile(decodedContent);
      if (quantumultXNodes.length > 0) {
        method += ' + QuantumultX解析';
        allParsedNodes.push(...quantumultXNodes);
      }

      // 如果格式解析都没有结果，尝试文本解析
      if (allParsedNodes.length === 0) {
        method += ' + 文本解析';
        allParsedNodes.push(...parseTextNodes(decodedContent));
      }

      nodes.push(...allParsedNodes);
    }
  } catch (e) {
    console.error('Base64解码失败:', e);
  }

  // 如果Base64解码没有结果，尝试直接解析各种格式
  if (nodes.length === 0) {
    const allParsedNodes = [];

    // 尝试YAML解析
    try {
      method = 'YAML解析';
      parseStatus.value = `尝试YAML格式解析...`;
      const yamlNodes = parseYamlConfig(content);
      if (yamlNodes.length > 0) {
        nodes.push(...yamlNodes);
      }
    } catch (e) {
      console.error('YAML解析失败:', e);
    }

    // 尝试Surge解析
    if (nodes.length === 0) {
      try {
        method = 'Surge解析';
        parseStatus.value = `尝试Surge格式解析...`;
        const surgeNodes = parseSurgeConfigFile(content);
        if (surgeNodes.length > 0) {
          nodes.push(...surgeNodes);
        }
      } catch (e) {
        console.error('Surge解析失败:', e);
      }
    }

    // 尝试QuantumultX解析
    if (nodes.length === 0) {
      try {
        method = 'QuantumultX解析';
        parseStatus.value = `尝试QuantumultX格式解析...`;
        const quantumultXNodes = parseQuantumultXConfigFile(content);
        if (quantumultXNodes.length > 0) {
          nodes.push(...quantumultXNodes);
        }
      } catch (e) {
        console.error('QuantumultX解析失败:', e);
      }
    }

    // 最后尝试纯文本解析
    if (nodes.length === 0) {
      method = '文本解析';
      parseStatus.value = `尝试文本格式解析...`;
      nodes.push(...parseTextNodes(content));
    }
  }

  if (isDev) {
    console.debug(`[Parser] Result: ${method} -> ${nodes.length} nodes`);
  }
  return { nodes, method };
};

/**
 * 导入订阅
 */
const importSubscription = async () => {
  const targetGroupName = groupName.value; // Capture immediately to avoid reset by watcher when modal closes

  // 验证URL
  if (!isValidUrl(subscriptionUrl.value)) {
    errorMessage.value = '请输入有效的 HTTP 或 HTTPS 订阅链接。';
    return;
  }

  isLoading.value = true;
  parseStatus.value = '正在获取订阅内容...';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20秒超时

    let responseData;
    try {
      responseData = await api.post('/api/fetch_external_url', {
        url: subscriptionUrl.value,
        timeout: 15000
      }, {
        signal: controller.signal
      });
    } catch (error) {
      if (error instanceof APIError) {
        const errorMsg = error.data?.error || error.data?.message || error.message || `HTTP ${error.status}`;

        // 根据错误类型提供友好的错误信息
        if (error.status === 408 || errorMsg.includes('timeout')) {
          throw new Error('请求超时，请检查网络连接或稍后重试');
        } else if (error.status === 413 || errorMsg.includes('too large')) {
          throw new Error('订阅内容过大，请使用较小的订阅链接');
        } else if (errorMsg.includes('DNS')) {
          throw new Error('域名解析失败，请检查订阅链接是否正确');
        } else if (error.status >= 500) {
          throw new Error('服务器错误，请稍后重试');
        }
        throw new Error(errorMsg);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!responseData.success) {
      throw new Error(responseData.error || '获取订阅内容失败');
    }

    parseStatus.value = `正在解析订阅内容...`;

    // [重构] 调用后端解析API
    const parseResult = await api.post('/api/parse_subscription', {
      content: responseData.content
    });

    if (!parseResult.success) {
      throw new Error(parseResult.error || '解析订阅失败');
    }

    const backendNodes = parseResult.data.nodes || [];

    if (backendNodes.length > 0) {
      // 转换为前端格式
      const nodes = backendNodes.map(node => ({
        id: generateNodeId(),
        name: node.name || 'Unknown',
        url: node.url,
        enabled: true,
        protocol: node.protocol || 'unknown',
        source: 'import'
      }));

      // 去重处理
      const uniqueNodes = nodes.filter((node, index, self) =>
        index === self.findIndex(n => n.url === node.url)
      );

      const duplicateCount = nodes.length - uniqueNodes.length;

      props.addNodesFromBulk(uniqueNodes, targetGroupName); // Updated

      const successMsg = `成功添加 ${uniqueNodes.length} 个节点` + 
        (targetGroupName ? ` 到分组 "${targetGroupName}"` : '') +
        (duplicateCount > 0 ? `（去重 ${duplicateCount} 个重复节点）` : '');
      successMessage.value = successMsg;

      toastStore.showToast(successMsg, 'success');
      if (isDev) {
        console.debug(`[Import] Success: Backend API, ${uniqueNodes.length} unique nodes, ${duplicateCount} duplicates`);
      }

      setTimeout(() => {
        emit('update:show', false);
      }, 2000);

    } else {
      parseStatus.value = '';
      throw new Error('未能从订阅链接中解析出任何有效节点。请检查链接内容是否包含支持的节点格式。');
    }

  } catch (error) {
    console.error('导入订阅失败:', error);
    handleError(error, 'Subscription Import Error', {
      url: subscriptionUrl.value,
      parseStatus: parseStatus.value
    });

    errorMessage.value = error.message || '导入失败';
    toastStore.showToast(`导入失败: ${error.message}`, 'error');

  } finally {
    isLoading.value = false;
  }
};

</script>

<template>
  <Modal :show="show" @update:show="emit('update:show', $event)" @confirm="importSubscription" confirm-text="导入"
    :confirm-disabled="isLoading || !subscriptionUrl.trim()">
    <template #title>导入订阅</template>
    <template #body>
      <div class="space-y-4">
        <FormatDetector />
        
        <!-- Group Selector Added -->
        <div class="relative">
          <label class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 ml-1 block">
             导入分组
          </label>
          <GroupSelector
             v-model="groupName"
             :groups="groups"
             placeholder="选择或输入分组（可选）"
             class="w-full"
          />
        </div>

        <ImportForm
          :subscription-url="subscriptionUrl"
          :is-loading="isLoading"
          @update:subscription-url="subscriptionUrl = $event"
          @submit="importSubscription"
        />
        <ParseResult
          :is-loading="isLoading"
          :parse-status="parseStatus"
          :error-message="errorMessage"
          :success-message="successMessage"
        />
      </div>
    </template>
  </Modal>
</template>
