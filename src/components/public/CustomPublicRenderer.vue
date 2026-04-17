<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { parseCustomPageSource } from '../../utils/custom-page-source.js';

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
  }
});

const styleId = 'custom-public-page-styles';
const stylesheetDataAttr = 'data-custom-page-stylesheet';
const scriptDataAttr = 'data-custom-page-script';
const disableTeleport = ref(false);

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
  
  const placeholders = ['profiles', 'announcements', 'hero', 'guestbook'];
  placeholders.forEach(p => {
    const regex = new RegExp(`{{\\s*${p}\\s*}}`, 'g');
    html = html.replace(regex, `<div data-slot="${p}"></div>`);
  });
  
  return html;
});

// 用于检测占位符是否在 HTML 中的辅助函数
const hasSlot = (name) => {
  return renderedHtml.value.includes(`data-slot="${name}"`);
};

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

onBeforeRouteLeave(async () => {
  // 路由切走前先禁用 Teleport，让插槽内容回到当前组件树，
  // 避免目标占位符先被移除时触发 Vue 在卸载 Teleport 时访问空节点。
  disableTeleport.value = true;
  await nextTick();
});

</script>

<template>
  <div class="custom-public-renderer">
    <!-- 渲染用户 HTML -->
    <div v-html="renderedHtml" class="custom-html-container"></div>

    <!-- 使用 Teleport 将原始组件插槽传送到对应的占位符 div 中 -->
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
