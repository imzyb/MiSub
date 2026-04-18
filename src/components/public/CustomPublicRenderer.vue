<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useThemeStore } from '../../stores/theme.js';
import { parseCustomPageSource } from '../../utils/custom-page-source.js';

const route = useRoute();
const themeStore = useThemeStore();

const props = defineProps({
  content: {
    type: String,
    default: ''
  },
  css: {
    type: String,
    default: ''
  },
  config: {
    type: Object,
    default: () => ({})
  },
  profiles: {
    type: Array,
    default: () => []
  }
});

const styleId = 'custom-public-page-styles';
const stylesheetDataAttr = 'data-custom-page-stylesheet';
const scriptDataAttr = 'data-custom-page-script';
const disableTeleport = ref(false);
const isReady = ref(false);

const removeStyles = () => {
  const styleEl = document.getElementById(styleId);
  if (styleEl) {
    styleEl.remove();
  }
};

const removeExternalStylesheets = () => {
  document.querySelectorAll(`[${stylesheetDataAttr}="true"]`).forEach(node => node.remove());
};

const removeScripts = () => {
  document.querySelectorAll(`[${scriptDataAttr}="true"]`).forEach(node => node.remove());
};

// 处理占位符
// 我们将 {{placeholder}} 替换为 <div data-slot="placeholder"></div>
// 然后在模板中使用 Teleport 将真正的组件传送到这些位置
const parsedSource = computed(() => parseCustomPageSource(props.content, props.css));
const escapeHtml = (value) => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

const renderedHtml = computed(() => {
  let html = parsedSource.value.html || '';
  
  // 1. 文本占位符替换
  const nodeCount = props.profiles.reduce((sum, p) => sum + (p.subscriptionCount || 0) + (p.manualNodeCount || 0), 0);
  const textVars = {
    version: '2.6.4',
    title: props.config?.hero?.title1 || '',
    description: props.config?.hero?.description || '',
    profile_count: props.profiles.length,
    node_count: nodeCount
  };
  
  for (const [key, val] of Object.entries(textVars)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
    html = html.replace(regex, escapeHtml(val));
  }
  
  // 2. 组件占位符替换 (转换为 data-slot div)
  const placeholders = ['profiles', 'announcement', 'announcements', 'hero', 'guestbook', 'theme_toggle'];
  placeholders.forEach(p => {
    // 使用 gi 确保不区分大小写
    const regex = new RegExp(`{{\\s*${p}\\s*}}`, 'gi');
    html = html.replace(regex, `<div data-slot="${p}"></div>`);
  });
  
  return html;
});

// 用于检测占位符是否在 HTML 中的辅助函数
const hasSlot = (name) => {
  return renderedHtml.value.includes(`data-slot="${name}"`);
};

// 监听内容变化，确保 DOM 更新后才开启 Teleport
watch(renderedHtml, async () => {
  isReady.value = false;
  await nextTick();
  isReady.value = true;
}, { immediate: true });

const injectStyles = () => {
  let styleEl = document.getElementById(styleId);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = parsedSource.value.css;
};

const injectExternalStylesheets = () => {
  removeExternalStylesheets();

  if (props.config?.customPage?.allowExternalStylesheets !== true) {
    return;
  }

  parsedSource.value.stylesheets.forEach((href, index) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute(stylesheetDataAttr, 'true');
    link.setAttribute('data-custom-page-order', String(index));
    document.head.appendChild(link);
  });
};

const executeScripts = async () => {
  removeScripts();

  if (props.config?.customPage?.allowScripts !== true) {
    return;
  }

  await nextTick();

  for (const [index, scriptDef] of parsedSource.value.scripts.entries()) {
    const script = document.createElement('script');
    script.async = false;
    script.setAttribute(scriptDataAttr, 'true');
    script.setAttribute('data-custom-page-order', String(index));

    if (scriptDef.src) {
      script.src = scriptDef.src;
      await new Promise((resolve, reject) => {
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${scriptDef.src}`));
        document.body.appendChild(script);
      }).catch((error) => {
        console.error('[CustomPublicRenderer] Script load failed', error);
      });
      continue;
    }

    script.textContent = scriptDef.content;
    document.body.appendChild(script);
  }
};

onMounted(injectStyles);
watch(parsedSource, injectStyles, { deep: true });
onMounted(injectExternalStylesheets);
watch(parsedSource, injectExternalStylesheets, { deep: true });
onMounted(() => { executeScripts(); });
watch(parsedSource, () => { executeScripts(); }, { deep: true });
onUnmounted(() => {
  removeStyles();
  removeExternalStylesheets();
  removeScripts();
});

// 监听路由变化，在切走前提前关闭 Teleport，防止 Vue 在销毁 DOM 时因找不到目标节点而报错
watch(() => route.path, (newPath, oldPath) => {
  if (oldPath && newPath !== oldPath) {
    isReady.value = false;
    disableTeleport.value = true;
  }
});

</script>

<template>
  <div class="custom-public-renderer">
    <!-- 渲染用户 HTML -->
    <div v-html="renderedHtml" class="custom-html-container"></div>

    <!-- 使用 Teleport 将原始组件插槽传送到对应的占位符 div 中 -->
    <!-- 仅在 isReady 为 true 时挂载，确保 data-slot 节点已存在于 DOM -->
    <template v-if="isReady">
      <Teleport v-if="hasSlot('profiles')" to='[data-slot="profiles"]' :disabled="disableTeleport">
        <slot name="profiles"></slot>
      </Teleport>

      <Teleport v-if="hasSlot('announcements')" to='[data-slot="announcements"]' :disabled="disableTeleport">
        <slot name="announcements"></slot>
      </Teleport>

      <Teleport v-if="hasSlot('hero')" to='[data-slot="hero"]' :disabled="disableTeleport">
        <slot name="hero"></slot>
      </Teleport>

      <Teleport v-if="hasSlot('guestbook')" to='[data-slot="guestbook"]' :disabled="disableTeleport">
        <slot name="guestbook"></slot>
      </Teleport>

      <Teleport v-if="hasSlot('theme_toggle')" to='[data-slot="theme_toggle"]' :disabled="disableTeleport">
        <button @click="themeStore.toggleTheme" 
                class="theme-toggle-btn p-2 rounded-full border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-black/40 backdrop-blur-md shadow-sm transition-all active:scale-90"
                :title="themeStore.theme === 'dark' ? '切换到浅色' : '切换到深色'">
          <svg v-if="themeStore.theme === 'dark'" class="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 9H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <svg v-else class="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        </button>
      </Teleport>
    </template>
  </div>
</template>

<style>
/* 允许用户的 HTML 撑开容器 */
.custom-public-renderer {
  width: 100%;
  min-height: 100vh;
}

.custom-html-container {
  width: 100%;
}

/* 确保 Teleport 的目标容器不会坍塌 */
[data-slot] {
  min-height: 10px;
}
</style>
