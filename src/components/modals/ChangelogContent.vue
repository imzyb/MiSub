<script setup>
    import { computed, h } from 'vue';
    import { parseChangelog } from '../../utils/changelog.js';

    const props = defineProps({
        text: {
            type: String,
            default: '',
        },
    });

    const blocks = computed(() => parseChangelog(props.text));

    // 行内片段（加粗 / 代码 / 链接）用渲染函数拼装，避免 v-html。
    const Inline = (inlineProps) =>
        (inlineProps.segments || []).map((segment) => {
            if (segment.type === 'strong') {
                return h(
                    'strong',
                    { class: 'font-semibold text-gray-900 dark:text-white' },
                    segment.text
                );
            }
            if (segment.type === 'code') {
                return h(
                    'code',
                    {
                        class: 'rounded bg-gray-200/70 px-1 py-0.5 font-mono text-[0.8125rem] text-gray-800 dark:bg-white/10 dark:text-gray-100',
                    },
                    segment.text
                );
            }
            if (segment.type === 'link') {
                return h(
                    'a',
                    {
                        class: 'font-medium text-primary-600 underline decoration-primary-500/30 underline-offset-2 hover:text-primary-500 hover:decoration-primary-500 dark:text-primary-400 dark:hover:text-primary-300',
                        href: segment.href,
                        target: '_blank',
                        rel: 'noopener noreferrer',
                    },
                    segment.text
                );
            }
            return segment.text;
        });
</script>

<template>
    <!--
        更新日志正文只负责「排版」，不负责「滚动」：
        整个弹窗 body 是唯一的滚动容器，这里不再出现定高 / overflow 容器，
        所以不会再有第二根滚动条。
    -->
    <div class="space-y-3 text-sm leading-6 break-words text-gray-600 dark:text-gray-300">
        <template v-for="(block, index) in blocks" :key="`changelog-block-${index}`">
            <h4
                v-if="block.type === 'heading'"
                class="text-[0.9375rem] font-semibold text-gray-900 dark:text-white"
            >
                <Inline :segments="block.segments" />
            </h4>

            <p
                v-else-if="block.type === 'paragraph'"
                :class="
                    index === 0
                        ? 'text-[0.9375rem] font-medium text-gray-800 dark:text-gray-100'
                        : 'text-gray-600 dark:text-gray-300'
                "
            >
                <Inline :segments="block.segments" />
            </p>

            <ul v-else-if="block.type === 'list' && !block.ordered" class="space-y-2.5">
                <li
                    v-for="(item, itemIndex) in block.items"
                    :key="itemIndex"
                    class="flex items-start gap-2.5"
                >
                    <span
                        aria-hidden="true"
                        class="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400 dark:bg-primary-400/80"
                    ></span>
                    <span class="min-w-0 flex-1">
                        <Inline :segments="item.segments" />
                    </span>
                </li>
            </ul>

            <ol v-else-if="block.type === 'list'" class="space-y-2.5">
                <li
                    v-for="(item, itemIndex) in block.items"
                    :key="itemIndex"
                    class="flex items-start gap-2.5"
                >
                    <span
                        aria-hidden="true"
                        class="w-5 shrink-0 text-right text-xs font-semibold leading-6 tabular-nums text-primary-500 dark:text-primary-400"
                    >
                        {{ itemIndex + 1 }}.
                    </span>
                    <span class="min-w-0 flex-1">
                        <Inline :segments="item.segments" />
                    </span>
                </li>
            </ol>
        </template>
    </div>
</template>
