<script setup>
    import { ref, watch } from 'vue';
    import { api } from '../../lib/http.js';
    import Modal from '../forms/Modal.vue';
    import { useI18n } from '../../i18n/index.js';

    const { t } = useI18n();

    const props = defineProps({
        show: {
            type: Boolean,
            default: false,
        },
        config: {
            type: Object,
            default: () => ({ enabled: false }),
        },
    });

    const emit = defineEmits(['close']);

    const form = ref({
        nickname: '',
        content: '',
        type: 'general', // general, feature, bug
        captcha: '',
    });

    const captcha = ref({
        num1: 0,
        num2: 0,
        operator: '+',
        answer: 0,
    });

    const submitting = ref(false);
    const showSuccess = ref(false);
    const errorMsg = ref('');

    const generateCaptcha = () => {
        const operators = ['+', '-'];
        const operator = operators[Math.floor(Math.random() * operators.length)];
        let num1 = Math.floor(Math.random() * 20) + 1;
        let num2 = Math.floor(Math.random() * 20) + 1;

        // Ensure positive result for subtraction
        if (operator === '-' && num1 < num2) {
            [num1, num2] = [num2, num1];
        }

        captcha.value = {
            num1,
            num2,
            operator,
            answer: operator === '+' ? num1 + num2 : num1 - num2,
        };
        form.value.captcha = '';
    };

    // Reset form when modal opens
    const resetForm = () => {
        form.value = { nickname: '', content: '', type: 'general', captcha: '' };
        showSuccess.value = false;
        errorMsg.value = '';
        generateCaptcha();
    };

    watch(
        () => props.show,
        (newVal) => {
            if (newVal) {
                resetForm();
            }
        }
    );

    const closeModal = () => {
        emit('close');
    };

    const submitMessage = async () => {
        errorMsg.value = '';

        if (!form.value.content || !form.value.content.trim()) {
            errorMsg.value = t('guestbook.contentRequired');
            return;
        }

        if (parseInt(form.value.captcha) !== captcha.value.answer) {
            errorMsg.value = t('guestbook.captchaError');
            generateCaptcha();
            return;
        }

        submitting.value = true;
        try {
            const data = await api.post('/api/public/guestbook', {
                nickname: form.value.nickname,
                content: form.value.content,
                type: form.value.type,
            });

            if (data.success) {
                showSuccess.value = true;
            } else {
                errorMsg.value = data.message || t('guestbook.submitFailed');
                generateCaptcha();
            }
        } catch (e) {
            console.error('Submit guestbook error', e);
            errorMsg.value = t('guestbook.networkError');
        } finally {
            submitting.value = false;
        }
    };
</script>

<template>
    <Modal :show="show" size="lg" @update:show="(value) => !value && closeModal()">
        <template #title>
            <div class="pr-10">
                <h3 class="text-lg font-bold text-gray-900 dark:text-white">
                    {{ showSuccess ? t('guestbook.submitSuccess') : t('guestbook.submitFeedback') }}
                </h3>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {{ showSuccess ? t('guestbook.thanksShort') : t('guestbook.feedbackNote') }}
                </p>
            </div>
        </template>

        <template #body>
            <div
                v-if="showSuccess"
                class="flex flex-col items-center justify-center py-8 text-center animate-fade-in"
            >
                <div
                    class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30"
                >
                    <svg
                        class="w-8 h-8 text-green-600 dark:text-green-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M5 13l4 4L19 7"
                        />
                    </svg>
                </div>
                <p class="max-w-xs text-gray-500 dark:text-gray-400">
                    {{ t('guestbook.thanksMessage') }}
                </p>
            </div>

            <div v-else class="space-y-4">
                <div>
                    <label
                        class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >{{ t('guestbook.feedbackType') }}</label
                    >
                    <select
                        v-model="form.type"
                        class="block w-full misub-radius-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus-visible:ring-indigo-500 bg-white dark:bg-gray-700 dark:text-white py-2 px-3 text-sm"
                    >
                        <option value="general">💬 {{ t('guestbook.typeGeneral') }}</option>
                        <option value="feature">✨ {{ t('guestbook.typeFeature') }}</option>
                        <option value="bug">🐛 {{ t('guestbook.typeBug') }}</option>
                    </select>
                </div>

                <div>
                    <label
                        class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >{{ t('guestbook.nicknameOptional') }}</label
                    >
                    <input
                        type="text"
                        v-model="form.nickname"
                        :placeholder="t('guestbook.nicknamePlaceholder')"
                        class="block w-full misub-radius-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus-visible:ring-indigo-500 bg-white dark:bg-gray-700 dark:text-white py-2 px-3 text-sm"
                        :aria-label="t('settings.guestbookNickname')"
                    />
                </div>

                <div>
                    <label
                        class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >{{ t('guestbook.contentLabel') }}</label
                    >
                    <textarea
                        v-model="form.content"
                        rows="4"
                        :placeholder="t('guestbook.contentPlaceholder')"
                        class="block w-full misub-radius-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus-visible:ring-indigo-500 bg-white dark:bg-gray-700 dark:text-white py-2 px-3 text-sm resize-none"
                    ></textarea>
                </div>

                <div>
                    <label
                        class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >{{ t('guestbook.captchaLabel') }}</label
                    >
                    <div class="flex items-center gap-3">
                        <div
                            class="min-w-[80px] select-none rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-center font-mono font-bold text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
                        >
                            {{ captcha.num1 }} {{ captcha.operator }} {{ captcha.num2 }} = ?
                        </div>
                        <input
                            type="number"
                            v-model="form.captcha"
                            :placeholder="t('guestbook.captchaPlaceholder')"
                            class="block w-24 misub-radius-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus-visible:ring-indigo-500 bg-white dark:bg-gray-700 dark:text-white py-2 px-3 text-sm"
                            @keydown.enter="submitMessage"
                            :aria-label="t('settings.guestbookCaptchaAnswer')"
                        />
                        <button
                            type="button"
                            @click="generateCaptcha"
                            class="p-1 text-gray-500 dark:text-gray-400 transition-colors hover:text-indigo-500 touch-target"
                            :title="t('common.refreshCaptcha')"
                            :aria-label="t('common.refreshCaptcha')"
                        >
                            <svg
                                class="w-5 h-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                            </svg>
                        </button>
                    </div>
                </div>

                <div v-if="errorMsg" class="flex items-center gap-1 text-sm text-red-500">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    {{ errorMsg }}
                </div>
            </div>
        </template>

        <template #footer>
            <div class="flex w-full justify-end gap-3">
                <button
                    @click="closeModal"
                    class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 misub-radius-md hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
                >
                    {{ showSuccess ? t('common.close') : t('actions.cancel') }}
                </button>
                <button
                    v-if="!showSuccess"
                    @click="submitMessage"
                    :disabled="submitting || !form.content"
                    class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent misub-radius-md hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md active:scale-95"
                >
                    {{ submitting ? t('guestbook.submitting') : t('guestbook.submitFeedback') }}
                </button>
            </div>
        </template>
    </Modal>
</template>

<style scoped>
    .animate-fade-in {
        animation: fadeIn 0.3s ease-out;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(10px);
        }

        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
    }

    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }

    .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: color-mix(in srgb, var(--color-gray-400) 50%, transparent);
        border-radius: 3px;
    }
</style>
