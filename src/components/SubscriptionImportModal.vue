<script setup>
import { ref, watch } from 'vue';
import { useToastStore } from '../stores/toast.js';
import Modal from './Modal.vue';
import yaml from 'js-yaml'; // js-yaml is already in package.json
import { extractNodeName } from '../lib/utils.js';

const props = defineProps({
  show: Boolean,
  addNodesFromBulk: Function, // New prop
});

const emit = defineEmits(['update:show']);

const subscriptionContent = ref(''); // Changed from subscriptionUrl
const isLoading = ref(false);
const errorMessage = ref('');

const toastStore = useToastStore();

watch(() => props.show, (newVal) => {
  if (!newVal) { // If modal is being hidden
    subscriptionContent.value = ''; // Changed from subscriptionUrl
    errorMessage.value = '';
    isLoading.value = false;
  }
});

const isValidUrl = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

const parseNodes = (content) => {
  const nodes = [];
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');

  // Try Base64 decode first
  try {
    const decodedContent = atob(content);
    const decodedLines = decodedContent.split(/\r?\n/).filter(line => line.trim() !== '');
    if (decodedLines.some(line => line.includes('://'))) { // Heuristic: if decoded content looks like URLs
      for (const line of decodedLines) {
        if (line.startsWith('ssr://')) {
          // Special handling for SSR links from Base64
          try {
            const ssrUrl = parseSsrLink(line);
            if (ssrUrl) {
              nodes.push({ id: crypto.randomUUID(), name: extractNodeName(ssrUrl) || `Imported Node ${nodes.length + 1}`, url: ssrUrl, enabled: true });
            }
          } catch (e) {
            console.warn("Failed to parse SSR link from Base64:", line, e);
          }
        } else if (line.includes('://')) {
          nodes.push({ id: crypto.randomUUID(), name: extractNodeName(line) || `Imported Node ${nodes.length + 1}`, url: line, enabled: true });
        }
      }
      if (nodes.length > 0) return nodes;
    }
  } catch (e) {
    // Not base64 or not a list of URLs after base64 decode
  }

  // Helper function to parse SSR links (simplified, may need more robust implementation)
  const parseSsrLink = (ssrLink) => {
    try {
      const cleanedLink = ssrLink.replace('ssr://', '');
      const parts = cleanedLink.split('/?');
      const mainPartEncoded = parts[0];
      const queryPart = parts[1] || '';

      // Decode main part
      const decodedMainPart = atob(mainPartEncoded);
      const [server, port, protocol, method, obfs, passwordEncoded] = decodedMainPart.split(':');
      const password = atob(passwordEncoded);

      let newSsrLink = `ssr://${btoa(`${server}:${port}:${protocol}:${method}:${obfs}:${btoa(password)}`)}`;

      const params = new URLSearchParams(queryPart);
      let queryParams = [];

      // Handle obfsparam
      const obfsparamEncoded = params.get('obfsparam');
      if (obfsparamEncoded) {
        queryParams.push(`obfsparam=${obfsparamEncoded}`); // Keep as Base64
      }

      // Handle protoparam
      const protoparamEncoded = params.get('protoparam');
      if (protoparamEncoded) {
        queryParams.push(`protoparam=${protoparamEncoded}`); // Keep as Base64
      }

      // Handle remarks
      const remarksEncoded = params.get('remarks');
      if (remarksEncoded) {
        try {
          // Decode Base64, then decode URI component for UTF-8 characters
          const decodedRemarks = decodeURIComponent(escape(atob(remarksEncoded)));
          queryParams.push(`remarks=${encodeURIComponent(decodedRemarks)}`);
        } catch (e) {
          console.warn("Failed to decode SSR remarks (Base64 or URI error):", remarksEncoded, e);
          queryParams.push(`remarks=${remarksEncoded}`); // Fallback to encoded if decode fails
        }
      }

      if (queryParams.length > 0) {
        newSsrLink += `?${queryParams.join('&')}`;
      }
      return newSsrLink;
    } catch (e) {
      console.error("Error parsing SSR link:", ssrLink, e);
      return null;
    }
  };

  // Try YAML parsing
  try {
    const parsedYaml = yaml.load(content);

    if (parsedYaml && typeof parsedYaml === 'object') {
      let potentialProxies = [];

      if (parsedYaml.proxies && Array.isArray(parsedYaml.proxies)) {
        potentialProxies = parsedYaml.proxies;
      } else if (parsedYaml['proxy-providers'] && typeof parsedYaml['proxy-providers'] === 'object') {
        // Iterate through proxy-providers and extract inline proxies
        for (const providerName in parsedYaml['proxy-providers']) {
          const provider = parsedYaml['proxy-providers'][providerName];
          if (provider.proxies && Array.isArray(provider.proxies)) {
            potentialProxies.push(...provider.proxies);
          }
        }
      } else if (Array.isArray(parsedYaml)) {
        // Sometimes the YAML might just be a direct array of proxy objects
        potentialProxies = parsedYaml;
      }

      if (potentialProxies.length > 0) {
        potentialProxies.forEach(proxy => {
          if (typeof proxy === 'object' && proxy.name && proxy.type) {
            let url = '';
            const type = proxy.type.toLowerCase();
            const name = proxy.name || 'Unnamed Node';

            switch (type) {
              case 'vmess':
                try {
                  const vmessConfig = {
                    v: "2", // Protocol version
                    ps: name,
                    add: proxy.server,
                    port: proxy.port,
                    id: proxy.uuid || proxy.id, // uuid or id
                    aid: proxy.alterId || proxy.aid || "0",
                    scy: proxy.cipher || "auto", // security
                    net: proxy.network || "tcp",
                    type: proxy.network || "none", // for http/ws
                    host: proxy.wsHeaders && proxy.wsHeaders.Host ? proxy.wsHeaders.Host : (proxy.host || ""),
                    path: proxy.wsPath || proxy.path || "",
                    tls: proxy.tls ? "tls" : "",
                    sni: proxy.sni || "",
                    alpn: proxy.alpn ? proxy.alpn.join(',') : ""
                  };
                  // Clean up empty fields
                  Object.keys(vmessConfig).forEach(key => {
                    if (vmessConfig[key] === "" || vmessConfig[key] === undefined || vmessConfig[key] === null) {
                      delete vmessConfig[key];
                    }
                  });
                  url = `vmess://${btoa(unescape(encodeURIComponent(JSON.stringify(vmessConfig))))}`;
                } catch (e) {
                  console.warn("Failed to construct full VMess URL from YAML proxy:", proxy, e);
                  // Fallback to basic if full construction fails
                  if (proxy.server && proxy.port) {
                    url = `vmess://${proxy.server}:${proxy.port}`;
                  }
                }
                break;
              case 'vless':
                if (proxy.uuid && proxy.server && proxy.port) {
                  let params = [];
                  if (proxy.network) params.push(`type=${proxy.network}`);
                  if (proxy.tls) params.push(`security=tls`);
                  if (proxy.flow) params.push(`flow=${proxy.flow}`);
                  if (proxy.fingerprint) params.push(`fp=${proxy.fingerprint}`);
                  if (proxy.publicKey) params.push(`pbk=${proxy.publicKey}`);
                  if (proxy.spiderX) params.push(`spx=${proxy.spiderX}`);
                  if (proxy.sni) params.push(`sni=${proxy.sni}`);
                  if (proxy.alpn && proxy.alpn.length > 0) params.push(`alpn=${proxy.alpn.join(',')}`);
                  if (proxy.path) params.push(`path=${encodeURIComponent(proxy.path)}`);
                  if (proxy.host) params.push(`host=${encodeURIComponent(proxy.host)}`);
                  if (proxy.encryption) params.push(`encryption=${proxy.encryption}`);

                  url = `vless://${proxy.uuid}@${proxy.server}:${proxy.port}`;
                  if (params.length > 0) {
                    url += `?${params.join('&')}`;
                  }
                  url += `#${encodeURIComponent(name)}`;
                }
                break;
              case 'trojan':
                if (proxy.password && proxy.server && proxy.port) {
                  let params = [];
                  if (proxy.network) params.push(`type=${proxy.network}`);
                  if (proxy.tls) params.push(`security=tls`);
                  if (proxy.sni) params.push(`sni=${proxy.sni}`);
                  if (proxy.alpn && proxy.alpn.length > 0) params.push(`alpn=${proxy.alpn.join(',')}`);
                  if (proxy.path) params.push(`path=${encodeURIComponent(proxy.path)}`);
                  if (proxy.host) params.push(`host=${encodeURIComponent(proxy.host)}`);
                  url = `trojan://${proxy.password}@${proxy.server}:${proxy.port}`;
                  if (params.length > 0) {
                    url += `?${params.join('&')}`;
                  }
                  url += `#${encodeURIComponent(name)}`;
                }
                break;
              case 'ss':
                if (proxy.cipher && proxy.password && proxy.server && proxy.port) {
                  const userInfo = `${proxy.cipher}:${proxy.password}`;
                  const encodedUserInfo = btoa(userInfo);
                  url = `ss://${encodedUserInfo}@${proxy.server}:${proxy.port}#${encodeURIComponent(name)}`;
                }
                break;
              case 'ssr':
                if (proxy.server && proxy.port && proxy.password && proxy.method && proxy.protocol && proxy.obfs) {
                  url = `ssr://${btoa(`${proxy.server}:${proxy.port}:${proxy.protocol}:${proxy.method}:${proxy.obfs}:${btoa(proxy.password)}/?obfsparam=${btoa(proxy.obfsparam || '')}&protoparam=${btoa(proxy.protoparam || '')}&remarks=${btoa(name)}`)}`;
                }
                break;
              case 'tuic':
              case 'hysteria':
              case 'hysteria2':
                if (proxy.server && proxy.port) {
                  url = `${type}://${proxy.server}:${proxy.port}#${encodeURIComponent(name)}`;
                }
                break;
              default:
                break;
            }
            if (url) {
              nodes.push({ id: crypto.randomUUID(), name: extractNodeName(url) || `Imported Node ${nodes.length + 1}`, url: url, enabled: true });
            }
          }
        });
        // If nodes were found from YAML, return them immediately
        if (nodes.length > 0) {
          return nodes;
        }
      }
    }
      } catch (e) {
        console.error("YAML parsing failed:", e);
        // Not valid YAML or not a recognized structure
      }

  // Fallback to plain text (one URL per line)
  for (const line of lines) {
    if (line.includes('://')) { // Basic check for protocol
      nodes.push({ id: crypto.randomUUID(), name: extractNodeName(line) || `Imported Node ${nodes.length + 1}`, url: line, enabled: true });
    }
  }

  return nodes;
};

const importSubscription = async () => {
  errorMessage.value = '';
  isLoading.value = true;

  let contentToParse = '';

  if (isValidUrl(subscriptionContent.value)) {
    // If it's a URL, fetch the content
    try {
      const response = await fetch('/api/fetch_external_url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: subscriptionContent.value })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      contentToParse = await response.text();
    } catch (error) {
      console.error('导入订阅失败:', error);
      errorMessage.value = `导入失败: ${error.message}`;
      toastStore.showToast(`导入失败: ${error.message}`, 'error');
      isLoading.value = false;
      return;
    }
  } else {
    // If it's not a URL, treat as direct content
    contentToParse = subscriptionContent.value;
  }

  const newNodes = parseNodes(contentToParse);

  if (newNodes.length > 0) {
    props.addNodesFromBulk(newNodes);
    toastStore.showToast(`成功添加了 ${newNodes.length} 个节点。`, 'success');
    emit('update:show', false); // Changed from emit('close') to match modal prop
  } else {
    errorMessage.value = '未能从内容中解析出任何节点。请检查输入内容。';
  }
  isLoading.value = false;
};


</script>

<template>
  <Modal
    :show="show"
    @update:show="emit('update:show', $event)"
    @confirm="importSubscription"
    confirm-text="导入"
    :confirm-disabled="isLoading"
  >
    <template #title>导入订阅</template>
    <template #body>
      <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">
        请输入订阅链接或直接粘贴 Base64/YAML/纯文本节点内容，系统将尝试解析其中的节点信息。
      </p>
      <textarea
        v-model="subscriptionContent"
        rows="20"
        placeholder="https://example.com/your-subscription-link 或直接粘贴 Base64/YAML/纯文本节点内容"
        class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      ></textarea>
      <p v-if="errorMessage" class="text-red-500 text-sm mt-2">{{ errorMessage }}</p>
    </template>
  </Modal>
</template>

