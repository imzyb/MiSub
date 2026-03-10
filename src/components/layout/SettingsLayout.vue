<script setup>
// SettingsLayout.vue
// 统一的设置界面布局容器，供页面视图和悬浮模态框复用
</script>

<template>
  <div class="h-full w-full bg-white/90 dark:bg-gray-900/70 md:shadow-sm md:misub-radius-lg md:border md:border-gray-100/80 md:dark:border-white/10 flex flex-col md:flex-row relative">
    
    <!-- Sidebar -->
    <aside class="md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-gray-100/80 dark:border-white/10 p-2 md:p-3 overflow-y-auto">
      <slot name="sidebar"></slot>
    </aside>

    <!-- Main Content Area -->
    <main class="flex-1 flex flex-col min-w-0 min-h-[500px]">
      
      <!-- Scrollable Content -->
      <div class="flex-1 p-4 md:p-6 overflow-y-auto">
        <slot></slot>
      </div>

      <!-- Sticky Footer Area -->
      <div class="shrink-0 px-6 py-4 bg-white/80 dark:bg-gray-900/70 border-t border-gray-100/70 dark:border-white/10 flex justify-end sticky bottom-0 z-10 backdrop-blur-sm md:rounded-br-2xl md:rounded-bl-none">
        <slot name="footer"></slot>
      </div>

    </main>
  </div>
</template>

<style scoped>
/* Any layout specific styles can go here, relying mostly on utility classes above */
</style>
