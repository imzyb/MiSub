<script setup>
</script>

<template>
  <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 misub-radius-md p-3">
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
</template>
