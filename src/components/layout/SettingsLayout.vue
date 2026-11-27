<script setup>
    // SettingsLayout.vue
    // 统一的设置界面布局容器，供页面视图和悬浮模态框复用
</script>

<template>
    <div
        class="h-full w-full bg-white/90 dark:bg-gray-900/70 md:shadow-sm md:misub-radius-lg md:border md:border-gray-100/80 md:dark:border-white/10 flex flex-col md:flex-row relative"
    >
        <!-- Sidebar -->
        <aside
            class="md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-gray-100/80 dark:border-white/10 p-2 md:p-3 overflow-y-auto"
        >
            <slot name="sidebar"></slot>
        </aside>

        <!-- Main Content Area -->
        <main class="flex-1 flex flex-col min-w-0 min-h-[520px] relative">
            <!-- Scrollable Content -->
            <div class="flex-1 p-4 pb-8 md:p-6 overflow-y-auto">
                <slot></slot>
            </div>

            <!-- Sticky Footer Area：移动端要浮在底部导航之上，否则「保存修改」会被导航栏整条盖住 -->
            <div
                class="shrink-0 px-4 md:px-6 py-3 bg-white/95 dark:bg-gray-900/90 border-t border-gray-100/70 dark:border-white/10 flex justify-end sticky bottom-0 z-10 backdrop-blur-sm md:rounded-br-2xl md:rounded-bl-none max-md:bottom-[var(--mobile-nav-height)] max-md:rounded-t-2xl max-md:shadow-[0_-10px_28px_rgba(17,24,39,0.10)] dark:max-md:shadow-[0_-10px_28px_rgba(0,0,0,0.38)]"
            >
                <slot name="footer"></slot>
            </div>
        </main>
    </div>
</template>

<style scoped>
    /* Any layout specific styles can go here, relying mostly on utility classes above */
</style>
