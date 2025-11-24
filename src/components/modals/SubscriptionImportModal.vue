<script setup>
import { ref, watch } from 'vue';
import { useToastStore } from '../../stores/toast.js';
import Modal from '../forms/Modal.vue';
import yaml from 'js-yaml';
import { extractNodeName } from '../../lib/utils.js';
import { convertClashProxyToUrl, batchConvertClashProxies, validateGeneratedUrl, parseSurgeConfig, parseQuantumultXConfig } from '../../utils/protocolConverter.js';
import { handleError } from '../../utils/errorHandler.js';

const props = defineProps({
  show: Boolean,
  addNodesFromBulk: Function,
});

const emit = defineEmits(['update:show']);

const subscriptionUrl = ref('');
const isLoading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const parseStatus = ref('');

const toastStore = useToastStore();

watch(() => props.show, (newVal) => {
  if (!newVal) {
    // 重置所有状态
    subscriptionUrl.value = '';
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

  // 检查是否为有效的Base64
  if (/^[A-Za-z0-9+\/=]+$/.test(cleanText) && cleanText.length % 4 === 0) {
    try {
      return atob(cleanText);
    } catch (e) {
      return text;
    }
  }

  // 尝试URL编码后Base64解码
  try {
    const urlDecoded = decodeURIComponent(cleanText);
    if (/^[A-Za-z0-9+\/=]+$/.test(urlDecoded)) {
      return atob(urlDecoded);
    }
  } catch (e) {
    // 忽略URL解码错误
  }

  return text;
};

/**
 * 解析单个节点URL
 */
const parseSingleUrl = (url) => {
  const supportedProtocols = ['vmess', 'vless', 'trojan', 'ss', 'ssr', 'hysteria', 'hysteria2', 'tuic', 'socks5', 'http'];

  // 基础URL格式检查
  if (!url.includes('://')) {
    return null;
  }

  const protocol = url.split('://')[0].toLowerCase();

  if (!supportedProtocols.includes(protocol)) {
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
    id: crypto.randomUUID(),
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
      console.log(`[YAML Parser] Found Clash format with ${proxies.length} proxies`);
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
      console.log(`[YAML Parser] Found Sing-Box format with ${proxies.length} outbounds`);
    }

    // 其他格式 - 尝试查找包含代理信息的字段
    else {
      const possibleFields = ['proxies', 'outbounds', 'nodes', 'servers', 'rules'];
      for (const field of possibleFields) {
        if (parsedYaml[field] && Array.isArray(parsedYaml[field])) {
          proxies = parsedYaml[field];
          console.log(`[YAML Parser] Found ${field} with ${proxies.length} entries`);
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
      const node = {
        id: crypto.randomUUID(),
        name: proxy.name || 'Unknown',
        url: proxy.url,
        enabled: true,
        protocol: proxy.type,
        source: 'yaml',
        original: proxy.original
      };

      nodes.push(node);
    }

    console.log(`[YAML Parser] Successfully converted ${nodes.length} nodes`);
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
    console.log(`[Surge Parser] Found ${nodes.length} nodes`);
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
    console.log(`[QuantumultX Parser] Found ${nodes.length} nodes`);
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

  console.log(`[Parser] Starting to parse ${content.length} characters`);

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

  console.log(`[Parser] Result: ${method} -> ${nodes.length} nodes`);
  return { nodes, method };
};

/**
 * 导入订阅
 */
const importSubscription = async () => {
  errorMessage.value = '';
  successMessage.value = '';
  parseStatus.value = '';

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

    const response = await fetch('/api/fetch_external_url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: subscriptionUrl.value,
        timeout: 15000
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error || `HTTP ${response.status}`;

      // 根据错误类型提供友好的错误信息
      if (response.status === 408 || errorMsg.includes('timeout')) {
        throw new Error('请求超时，请检查网络连接或稍后重试');
      } else if (response.status === 413 || errorMsg.includes('too large')) {
        throw new Error('订阅内容过大，请使用较小的订阅链接');
      } else if (errorMsg.includes('DNS')) {
        throw new Error('域名解析失败，请检查订阅链接是否正确');
      } else if (response.status >= 500) {
        throw new Error('服务器错误，请稍后重试');
      } else {
        throw new Error(errorMsg);
      }
    }

    const responseData = await response.json();

    if (!responseData.success) {
      throw new Error(responseData.error || '获取订阅内容失败');
    }

    parseStatus.value = `正在解析订阅内容...`;

    const { nodes, method } = parseNodes(responseData.content);

    if (nodes.length > 0) {
      // 去重处理
      const uniqueNodes = nodes.filter((node, index, self) =>
        index === self.findIndex(n => n.url === node.url)
      );

      const duplicateCount = nodes.length - uniqueNodes.length;

      props.addNodesFromBulk(uniqueNodes);

      const successMsg = `成功添加 ${uniqueNodes.length} 个节点${duplicateCount > 0 ? `（去重 ${duplicateCount} 个重复节点）` : ''}`;
      successMessage.value = successMsg;

      toastStore.showToast(successMsg, 'success');
      console.log(`[Import] Success: ${method}, ${uniqueNodes.length} unique nodes, ${duplicateCount} duplicates`);

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
  <Modal
    :show="show"
    @update:show="emit('update:show', $event)"
    @confirm="importSubscription"
    confirm-text="导入"
    :confirm-disabled="isLoading || !subscriptionUrl.trim()"
  >
    <template #title>导入订阅</template>
    <template #body>
      <div class="space-y-4">
        <!-- 说明信息 -->
        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <h4 class="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">支持的订阅格式：</h4>
          <ul class="text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <li>• <strong>Base64编码</strong>：标准节点列表编码</li>
            <li>• <strong>Clash配置</strong>：proxies/outbounds配置 (YAML)</li>
            <li>• <strong>Sing-Box配置</strong>：outbounds配置 (YAML)</li>
            <li>• <strong>Surge配置</strong>：代理节点配置</li>
            <li>• <strong>Quantumult X配置</strong>：shadowsocks、vmess等配置</li>
            <li>• <strong>纯文本格式</strong>：每行一个完整节点URL</li>
            <li>• <strong>支持协议</strong>：VMess、VLESS、Trojan、Shadowsocks、ShadowsocksR、Hysteria、TUIC、SOCKS5、HTTP</li>
          </ul>
        </div>

        <!-- URL输入 -->
        <div>
          <label for="subscription-url" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            订阅链接
          </label>
          <input
            id="subscription-url"
            v-model="subscriptionUrl"
            type="url"
            placeholder="https://example.com/subscription-link"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
            @keyup.enter="importSubscription"
            :disabled="isLoading"
          />
        </div>

        <!-- 状态信息 -->
        <div v-if="isLoading || parseStatus || errorMessage || successMessage" class="space-y-2">
          <!-- 加载状态 -->
          <div v-if="isLoading" class="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>{{ parseStatus || '正在处理...' }}</span>
          </div>

          <!-- 成功信息 -->
          <div v-if="successMessage" class="flex items-center space-x-2 text-sm text-green-600 dark:text-green-400">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            <span>{{ successMessage }}</span>
          </div>

          <!-- 错误信息 -->
          <div v-if="errorMessage" class="flex items-start space-x-2 text-sm text-red-600 dark:text-red-400">
            <svg class="h-4 w-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
            <span>{{ errorMessage }}</span>
          </div>
        </div>

        <!-- 提示信息 -->
        <div class="text-xs text-gray-500 dark:text-gray-400">
          <p>提示：导入的节点将被添加到手动节点列表，请确保节点链接格式正确。</p>
        </div>
      </div>
    </template>
  </Modal>
</template>
