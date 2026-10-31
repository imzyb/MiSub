<script setup>
    import { onMounted, onUnmounted } from 'vue';
    import Modal from '../forms/Modal.vue';
    import { useI18n } from '../../i18n/index.js';
    import {
        setConfirmHost,
        settleConfirm,
        useConfirmState,
    } from '../../composables/useConfirm.js';

    const { t } = useI18n();
    const pending = useConfirmState();

    // 标记宿主已就绪：无宿主时 confirmAction 会回退到原生 window.confirm()
    onMounted(() => setConfirmHost(true));
    onUnmounted(() => setConfirmHost(false));

    const handleConfirm = () => settleConfirm(true);
    const handleDismiss = () => settleConfirm(false);
</script>

<template>
    <Modal
        :show="Boolean(pending)"
        size="sm"
        :confirm-text="pending ? pending.confirmText : ''"
        :cancel-text="pending ? pending.cancelText : ''"
        :confirm-variant="pending ? pending.variant : 'primary'"
        @update:show="handleDismiss"
        @confirm="handleConfirm"
    >
        <template #title>
            <h3 class="text-lg font-bold text-gray-900 dark:text-white">
                {{ pending && pending.title ? pending.title : t('common.confirmAction') }}
            </h3>
        </template>
        <template #body>
            <p class="text-sm leading-relaxed text-gray-600 whitespace-pre-line dark:text-gray-300">
                {{ pending ? pending.message : '' }}
            </p>
        </template>
    </Modal>
</template>
