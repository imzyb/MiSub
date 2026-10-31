<script setup>
    import { useI18n } from '../../../i18n/index.js';

    const { t } = useI18n();
</script>

<template>
    <div
        class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 misub-radius-md p-3"
    >
        <h4 class="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
            {{ t('formatDetector.heading') }}
        </h4>
        <ul class="text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <li>
                • <strong>{{ t('formatDetector.base64') }}</strong
                >：{{ t('formatDetector.base64Desc') }}
            </li>
            <li>
                • <strong>{{ t('formatDetector.clash') }}</strong
                >：{{ t('formatDetector.clashDesc') }}
            </li>
            <li>
                • <strong>{{ t('formatDetector.singbox') }}</strong
                >：{{ t('formatDetector.singboxDesc') }}
            </li>
            <li>
                • <strong>{{ t('formatDetector.surge') }}</strong
                >：{{ t('formatDetector.surgeDesc') }}
            </li>
            <li>
                • <strong>{{ t('formatDetector.quantumultx') }}</strong
                >：{{ t('formatDetector.quantumultxDesc') }}
            </li>
            <li>
                • <strong>{{ t('formatDetector.plainText') }}</strong
                >：{{ t('formatDetector.plainTextDesc') }}
            </li>
            <li>
                •
                <strong>{{ t('formatDetector.protocols') }}</strong
                >：VMess、VLESS、Trojan、Shadowsocks、ShadowsocksR、Hysteria、TUIC、SOCKS5、HTTP
            </li>
        </ul>
    </div>
</template>
