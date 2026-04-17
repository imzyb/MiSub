<script setup>
import { computed } from 'vue';
import { parseCustomPageSource } from '../../../utils/custom-page-source.js';
import Switch from '../../ui/Switch.vue';

const props = defineProps({
  settings: {
    type: Object,
    required: true
  }
});

if (!props.settings.customPage) {
  props.settings.customPage = {
    enabled: false,
    type: 'html',
    content: '',
    css: '',
    useDefaultLayout: true,
    allowExternalStylesheets: false,
    allowScripts: false,
    hideBranding: false,
    hideHeader: false,
    hideFooter: false
  };
}

if (props.settings.customPage.type !== 'html') {
  props.settings.customPage.type = 'html';
}

const cp = props.settings.customPage;
if (typeof cp.allowExternalStylesheets !== 'boolean') cp.allowExternalStylesheets = false;
if (typeof cp.allowScripts !== 'boolean') cp.allowScripts = false;
if (typeof cp.hideBranding !== 'boolean') cp.hideBranding = false;
if (typeof cp.hideHeader !== 'boolean') cp.hideHeader = false;
if (typeof cp.hideFooter !== 'boolean') cp.hideFooter = false;

const customPage = computed(() => props.settings.customPage);

const insertPlaceholder = (placeholder) => {
  props.settings.customPage.content = (customPage.value.content || '') + `{{${placeholder}}}`;
};

const navTemplate = [
  '<!DOCTYPE html>',
  '<html lang="zh-CN">',
  '<head>',
  '<meta charset="UTF-8" />',
  '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
  '<title>Start · Apple Level</title>',
  '<style>',
  '*{margin:0;padding:0;box-sizing:border-box}',
  ':root{--bg:#f5f5f7;--text:#1d1d1f;--sub:#6e6e73;--card:rgba(255,255,255,.72);--card-border:rgba(0,0,0,.06);--card-shadow:0 20px 50px rgba(0,0,0,.08);--focus:#0071e3}',
  'html,body{margin:0;padding:0;min-height:100%;background:#f5f5f7}',
  'body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;background:radial-gradient(1200px 600px at 50% -10%, #ffffff 0%, #f5f5f7 58%, #ececf1 100%);color:var(--text)}',
  '.page{min-height:100dvh;padding:72px 20px 88px}',
  '.wrapper{width:100%;max-width:980px;margin:0 auto;text-align:center}',
  'h1{font-size:clamp(40px,6vw,56px);font-weight:600;letter-spacing:-1.2px;margin-bottom:14px;color:var(--text)}',
  '.subtitle{font-size:18px;color:var(--sub);margin-bottom:44px}',
  '.search{margin:0 auto 68px}.search input{width:520px;max-width:100%;padding:18px 26px;border-radius:999px;border:1px solid #d2d2d7;font-size:17px;background:rgba(255,255,255,.92);color:var(--text);outline:none;transition:.25s ease;box-shadow:0 8px 24px rgba(0,0,0,.04)}',
  '.search input::placeholder{color:#8e8e93}.search input:focus{border-color:var(--focus);box-shadow:0 0 0 6px rgba(0,113,227,.12)}',
  '.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:22px}',
  '.card{text-decoration:none;color:var(--text);padding:22px 12px 18px;border-radius:26px;background:var(--card);border:1px solid var(--card-border);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);transition:transform .28s cubic-bezier(.4,0,.2,1), box-shadow .28s ease, border-color .28s ease;box-shadow:0 10px 30px rgba(0,0,0,.04)}',
  '.card:hover{transform:translateY(-8px) scale(1.03);box-shadow:var(--card-shadow);border-color:rgba(0,0,0,.08)}',
  '.card:active{transform:translateY(-2px) scale(.99)}',
  '.icon{width:56px;height:56px;border-radius:18px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#fff 0%,#f3f3f5 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 8px 20px rgba(0,0,0,.06)}',
  '.icon img{width:30px;height:30px;display:block}.name{font-size:14px;font-weight:500;color:#4a4a4f}.footer{margin-top:72px;font-size:12px;color:#86868b;letter-spacing:.2px}',
  '@media (max-width:640px){.page{padding-top:48px;padding-bottom:56px}.subtitle{font-size:16px;margin-bottom:32px}.search{margin-bottom:42px}.search input{font-size:16px;padding:16px 20px}.grid{gap:16px}.card{border-radius:22px;padding:18px 10px 16px}.icon{width:52px;height:52px;border-radius:16px;margin-bottom:12px}}',
  '</style>',
  '</head>',
  '<body>',
  '<div class="page"><div class="wrapper"><h1>Start</h1><div class="subtitle">A calm place to begin</div><div class="search"><input id="search" placeholder="Search or type URL" autocomplete="off" /></div><div class="grid"><a class="card" href="https://www.apple.com" target="_blank" rel="noreferrer"><div class="icon"><img src="https://www.google.com/s2/favicons?sz=64&domain=apple.com" alt="Apple"></div><div class="name">Apple</div></a><a class="card" href="https://www.google.com" target="_blank" rel="noreferrer"><div class="icon"><img src="https://www.google.com/s2/favicons?sz=64&domain=google.com" alt="Google"></div><div class="name">Google</div></a><a class="card" href="https://www.youtube.com" target="_blank" rel="noreferrer"><div class="icon"><img src="https://www.google.com/s2/favicons?sz=64&domain=youtube.com" alt="YouTube"></div><div class="name">YouTube</div></a><a class="card" href="https://chat.openai.com" target="_blank" rel="noreferrer"><div class="icon"><img src="https://www.google.com/s2/favicons?sz=64&domain=openai.com" alt="ChatGPT"></div><div class="name">ChatGPT</div></a><a class="card" href="https://github.com" target="_blank" rel="noreferrer"><div class="icon"><img src="https://www.google.com/s2/favicons?sz=64&domain=github.com" alt="GitHub"></div><div class="name">GitHub</div></a><a class="card" href="https://www.notion.so" target="_blank" rel="noreferrer"><div class="icon"><img src="https://www.google.com/s2/favicons?sz=64&domain=notion.so" alt="Notion"></div><div class="name">Notion</div></a><a class="card" href="https://www.figma.com" target="_blank" rel="noreferrer"><div class="icon"><img src="https://www.google.com/s2/favicons?sz=64&domain=figma.com" alt="Figma"></div><div class="name">Figma</div></a><a class="card" href="https://mail.google.com" target="_blank" rel="noreferrer"><div class="icon"><img src="https://www.google.com/s2/favicons?sz=64&domain=gmail.com" alt="Gmail"></div><div class="name">Gmail</div></a><a class="card" href="https://drive.google.com" target="_blank" rel="noreferrer"><div class="icon"><img src="https://www.google.com/s2/favicons?sz=64&domain=drive.google.com" alt="Drive"></div><div class="name">Drive</div></a><a class="card" href="https://www.reddit.com" target="_blank" rel="noreferrer"><div class="icon"><img src="https://www.google.com/s2/favicons?sz=64&domain=reddit.com" alt="Reddit"></div><div class="name">Reddit</div></a><a class="card" href="https://twitter.com" target="_blank" rel="noreferrer"><div class="icon"><img src="https://www.google.com/s2/favicons?sz=64&domain=twitter.com" alt="X"></div><div class="name">X</div></a><a class="card" href="https://www.bilibili.com" target="_blank" rel="noreferrer"><div class="icon"><img src="https://www.google.com/s2/favicons?sz=64&domain=bilibili.com" alt="Bilibili"></div><div class="name">Bilibili</div></a></div><div class="footer">Designed with space, rhythm, and calm</div></div></div>',
  '<scr' + 'ipt>',
  'function openSearch(){const input=document.getElementById("search");const raw=(input.value||"").trim();if(!raw)return;const isUrl=/^https?:\\/\\//i.test(raw)||/^[\\w-]+\\.[\\w.-]+(?:\\/.*)?$/i.test(raw);const target=/^https?:\\/\\//i.test(raw)?raw:isUrl?"https://"+raw:"https://www.google.com/search?q="+encodeURIComponent(raw);window.open(target,"_blank","noopener,noreferrer")}',
  'document.getElementById("search").addEventListener("keydown",function(e){if(e.key==="Enter")openSearch()});',
  '</scr' + 'ipt>',
  '</body>',
  '</html>'
].join('');

const templates = [
  {
    name: '极简导航',
    content: navTemplate,
    css: ''
  },
  {
    name: '个人主页',
    content: '<section class="bento-home">\n  <div class="bento-container">\n    <!-- Header -->\n    <header class="bento-header">\n      <div class="brand">MiSub<span>.Identity</span></div>\n      <nav>首页 / 动态 / 联系</nav>\n    </header>\n\n    <!-- Bento Grid Section -->\n    <div class="bento-grid">\n      <!-- Hero Identity Card -->\n      <div class="bento-card hero-card">\n        <div class="card-content">\n          <div class="avatar-wrapper">\n            <div class="avatar">M</div>\n            <div class="status-dot"></div>\n          </div>\n          <div class="hero-text">\n            <span class="label">Digital Creator</span>\n            <h1>Hello, I\'m MiSub User</h1>\n            <p>探索、整理并分享优质的数字资源。这是一个利用 Bento 风格构建的个人沉浸式主页。</p>\n          </div>\n        </div>\n        <div class="card-footer">\n          <a href="#" class="btn-primary">关注我的动态</a>\n          <div class="social-icons">\n            <i class="icon-github"></i>\n            <i class="icon-twitter"></i>\n          </div>\n        </div>\n      </div>\n\n      <!-- Bio / About Card -->\n      <div class="bento-card bio-card">\n        <span class="card-label">About</span>\n        <h3>热爱生活与技术</h3>\n        <p>在这里记录我发现的有趣事物。通过 MiSub，我可以轻松地管理和分享我的订阅组合，保持简洁。 </p>\n      </div>\n\n      <!-- Announcement Card (Placeheld) -->\n      <div class="bento-card announce-card">\n        <span class="card-label">Updates</span>\n        {{announcements}}\n      </div>\n\n      <!-- Small Link Card -->\n      <div class="bento-card link-card">\n        <span class="card-label">Links</span>\n        <div class="link-grid">\n          <a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>\n          <a href="#" target="_blank">Blog</a>\n          <a href="#" target="_blank">Portfolio</a>\n        </div>\n      </div>\n    </div>\n\n    <!-- Profiles Section (Primary Content) -->\n    <div class="profiles-section">\n      <div class="section-header">\n        <span class="label">Curated Collection</span>\n        <h2>精选订阅库</h2>\n        <p>由我亲手挑选并持续维护的各种订阅组合，旨在为您提供最稳定的连接体验。</p>\n      </div>\n      {{profiles}}\n    </div>\n\n    <!-- Footer / Guestbook Section -->\n    <footer class="bento-footer">\n      <div class="footer-cta">\n        <h2>想跟我聊聊？</h2>\n        <p>如果您有任何建议或单纯想打个招呼，欢迎在下方留言。</p>\n        {{guestbook}}\n      </div>\n      <div class="footer-bottom">\n        <p>&copy; 2026 Crafted with Space & MiSub</p>\n      </div>\n    </footer>\n  </div>\n</section>',
    css: '/* Bento Home Theme - Glassmorphism */\n.bento-home { --primary: #7c3aed; --accent: #ff4d4d; --bg: #030712; --card-bg: rgba(255, 255, 255, 0.04); --card-border: rgba(255, 255, 255, 0.1); --text-main: #f8fafc; --text-dim: #94a3b8; font-family: "Outfit", "SF Pro Display", -apple-system, sans-serif; background: var(--bg); color: var(--text-main); min-height: 100vh; overflow-x: hidden; }\n.bento-home * { box-sizing: border-box; }\n.bento-container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }\n\n/* Header */\n.bento-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }\n.bento-header .brand { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }\n.bento-header .brand span { color: var(--primary); }\n.bento-header nav { font-size: 14px; color: var(--text-dim); font-weight: 500; }\n\n/* Bento Grid */\n.bento-grid { display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: minmax(160px, auto); gap: 20px; margin-bottom: 60px; }\n.bento-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 32px; padding: 32px; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: hidden; }\n.bento-card:hover { transform: translateY(-5px) scale(1.01); border-color: rgba(255, 255, 255, 0.2); box-shadow: 0 20px 40px rgba(0,0,0,0.4); }\n\n/* Hero Card (Double Wide and High) */\n.hero-card { grid-column: span 3; grid-row: span 2; display: flex; flex-direction: column; justify-content: space-between; background: linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(255, 255, 255, 0.04) 100%); }\n.avatar-wrapper { position: relative; width: 80px; height: 80px; margin-bottom: 24px; }\n.avatar { width: 100%; height: 100%; background: linear-gradient(135deg, var(--primary), #4f46e5); border-radius: 24px; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 800; color: white; box-shadow: 0 10px 30px rgba(124, 58, 237, 0.3); }\n.status-dot { position: absolute; bottom: -4px; right: -4px; width: 20px; height: 20px; background: #10b981; border: 4px solid var(--bg); border-radius: 50%; shadow: 0 0 10px #10b981; }\n.hero-text .label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: var(--primary); margin-bottom: 12px; display: block; }\n.hero-text h1 { font-size: clamp(32px, 5vw, 56px); font-weight: 900; line-height: 1.1; margin: 0 0 16px; letter-spacing: -1.5px; }\n.hero-text p { font-size: 18px; color: var(--text-dim); line-height: 1.6; max-width: 500px; }\n.hero-card .card-footer { display: flex; align-items: center; gap: 20px; margin-top: 32px; }\n.btn-primary { background: white; color: black; text-decoration: none; padding: 12px 24px; border-radius: 999px; font-weight: 700; font-size: 14px; transition: transform 0.2s; }\n.btn-primary:hover { transform: scale(1.05); }\n\n/* Bio Card */\n.bio-card { grid-column: span 1; grid-row: span 2; }\n.card-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--text-dim); display: block; margin-bottom: 16px; }\n.bio-card h3 { font-size: 24px; margin: 0 0 12px; }\n.bio-card p { font-size: 15px; color: var(--text-dim); line-height: 1.7; }\n\n/* Link Card */\n.link-card { grid-column: span 2; }\n.link-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }\n.link-grid a { background: rgba(255,255,255,0.05); text-decoration: none; color: white; padding: 10px; text-align: center; border-radius: 12px; font-size: 13px; font-weight: 600; transition: background 0.2s; }\n.link-grid a:hover { background: rgba(255,255,255,0.1); }\n\n/* Announce Card */\n.announce-card { grid-column: span 2; }\n\n/* Profiles Section */\n.profiles-section { margin-top: 80px; }\n.section-header { margin-bottom: 40px; text-align: left; }\n.section-header .label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: var(--primary); }\n.section-header h2 { font-size: 40px; font-weight: 800; margin: 8px 0; }\n.section-header p { color: var(--text-dim); max-width: 600px; }\n\n/* Profile Grid Adjustments for Dark Theme */\n.bento-home .misub-radius-lg { border-radius: 24px !important; }\n.bento-home .bg-white, .bento-home .bg-white/80 { background: var(--card-bg) !important; border: 1px solid var(--card-border) !important; backdrop-filter: blur(20px); }\n.bento-home h3, .bento-home .text-gray-900 { color: white !important; }\n.bento-home .text-gray-500, .bento-home .text-gray-600 { color: var(--text-dim) !important; }\n\n/* Footer */\n.bento-footer { margin-top: 100px; text-align: center; }\n.footer-cta { background: linear-gradient(to bottom, var(--card-bg), transparent); padding: 60px 20px; border-top: 1px solid var(--card-border); border-radius: 60px 60px 0 0; }\n.footer-cta h2 { font-size: 32px; margin-bottom: 12px; }\n.footer-cta p { color: var(--text-dim); margin-bottom: 32px; }\n.footer-bottom { padding: 32px; font-size: 12px; color: var(--text-dim); opacity: 0.6; }\n\n/* Responsive */\n@media (max-width: 900px) {\n  .bento-grid { grid-template-columns: 1fr; grid-auto-rows: auto; }\n  .hero-card, .bio-card, .link-card, .announce-card { grid-column: span 1; grid-row: auto; }\n  .hero-text h1 { font-size: 32px; }\n  .link-grid { grid-template-columns: 1fr; }\n}'
  }
];

const applyTemplate = (tpl) => {
  if (confirm(`确定要应用模板 "${tpl.name}" 吗？这会覆盖当前的自定义内容。`)) {
    const parsed = parseCustomPageSource(tpl.content, tpl.css || '');
    props.settings.customPage.type = 'html';
    props.settings.customPage.content = parsed.html;
    props.settings.customPage.css = parsed.css;
    
    // 自动开启权限
    if (parsed.extractedStyles || parsed.stylesheets.length > 0) {
      props.settings.customPage.allowExternalStylesheets = true;
    }
    if (parsed.strippedScripts || parsed.scripts.length > 0) {
      props.settings.customPage.allowScripts = true;
    }
  }
};

const normalizeFullPageSource = () => {
  const parsed = parseCustomPageSource(props.settings.customPage.content, props.settings.customPage.css);
  props.settings.customPage.content = parsed.html;
  props.settings.customPage.css = parsed.css;
};
</script>

<template>
  <div class="space-y-6 animate-fade-in">
    <div class="bg-white dark:bg-gray-800 misub-radius-lg p-6 shadow-sm border border-gray-100 dark:border-gray-700">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-lg font-bold text-gray-900 dark:text-white">自定义公开页</h2>
          <p class="text-sm text-gray-500">通过自定义 HTML/CSS 打造独一无二的公开主页。</p>
        </div>
        <div class="flex items-center gap-2">
          <Switch v-model="props.settings.customPage.enabled" />
        </div>
      </div>

      <div v-if="customPage.enabled" class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="flex flex-col gap-2 md:col-span-2 p-4 bg-white/70 dark:bg-gray-900/50 border border-gray-200/70 dark:border-white/10 misub-radius-lg">
            <p class="text-sm font-medium text-gray-900 dark:text-gray-200">渲染方式</p>
            <div class="flex items-center gap-2 mt-1">
              <span class="px-3 py-1.5 rounded-xl bg-primary-600 text-white border border-primary-600 text-xs font-medium">HTML / CSS 渲染</span>
            </div>
            <p class="text-xs text-gray-500 mt-1">通过标准 HTML 和 CSS 灵活定制您的页面，支持内置占位符。</p>
          </div>

          <div class="flex items-center justify-between p-4 bg-white/70 dark:bg-gray-900/50 border border-gray-200/70 dark:border-white/10 misub-radius-lg">
            <div class="flex-1 mr-4">
              <p class="text-sm font-medium text-gray-900 dark:text-gray-200">使用默认布局基础</p>
              <p class="text-xs text-gray-500 mt-0.5">保留原本的背景色、响应式容器等基础结构，只改变内部内容。</p>
            </div>
            <Switch v-model="props.settings.customPage.useDefaultLayout" />
          </div>

          <div class="flex items-center justify-between p-4 bg-white/70 dark:bg-gray-900/50 border border-gray-200/70 dark:border-white/10 misub-radius-lg">
            <div class="flex-1 mr-4">
              <p class="text-sm font-medium text-gray-900 dark:text-gray-200">隐藏品牌标识</p>
              <p class="text-xs text-gray-500 mt-0.5">隐藏公开页中的品牌文案和浏览器标题后缀。</p>
            </div>
            <Switch v-model="props.settings.customPage.hideBranding" />
          </div>

          <div class="flex items-center justify-between p-4 bg-white/70 dark:bg-gray-900/50 border border-gray-200/70 dark:border-white/10 misub-radius-lg">
            <div class="flex-1 mr-4">
              <p class="text-sm font-medium text-gray-900 dark:text-gray-200">隐藏页头</p>
              <p class="text-xs text-gray-500 mt-0.5">适合个人主页或独立落地页。</p>
            </div>
            <Switch v-model="props.settings.customPage.hideHeader" />
          </div>

          <div class="flex items-center justify-between p-4 bg-white/70 dark:bg-gray-900/50 border border-gray-200/70 dark:border-white/10 misub-radius-lg">
            <div class="flex-1 mr-4">
              <p class="text-sm font-medium text-gray-900 dark:text-gray-200">隐藏页脚</p>
              <p class="text-xs text-gray-500 mt-0.5">不再显示全局版权页脚。</p>
            </div>
            <Switch v-model="props.settings.customPage.hideFooter" />
          </div>

          <div class="flex items-center justify-between p-4 bg-white/70 dark:bg-gray-900/50 border border-gray-200/70 dark:border-white/10 misub-radius-lg">
            <div class="flex-1 mr-4">
              <p class="text-sm font-medium text-gray-900 dark:text-gray-200">允许外链样式表</p>
              <p class="text-xs text-gray-500 mt-0.5">允许加载样式表 Link 标签。</p>
            </div>
            <Switch v-model="props.settings.customPage.allowExternalStylesheets" />
          </div>

          <div class="flex items-center justify-between p-4 bg-white/70 dark:bg-gray-900/50 border border-gray-200/70 dark:border-white/10 misub-radius-lg">
            <div class="flex-1 mr-4">
              <p class="text-sm font-medium text-gray-900 dark:text-gray-200">允许脚本执行</p>
              <p class="text-xs text-gray-500 mt-0.5">高风险功能，允许执行内联和外链脚本。</p>
            </div>
            <Switch v-model="props.settings.customPage.allowScripts" />
          </div>
        </div>

        <hr class="border-gray-100 dark:border-gray-700">

        <div class="space-y-4">
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-bold text-gray-700 dark:text-gray-300">HTML 内容</label>
              <div class="flex gap-2">
                <button @click="normalizeFullPageSource" class="text-[10px] px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded border border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 transition-colors">整理整页源码</button>
                <button v-for="p in ['profiles', 'announcements', 'hero', 'guestbook']" :key="p" @click="insertPlaceholder(p)" class="text-[10px] px-2 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded border border-primary-100 dark:border-primary-800 hover:bg-primary-100 transition-colors">{&#123;{{p}}&#125;}</button>
              </div>
            </div>
            <textarea v-model="props.settings.customPage.content" rows="12" class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 font-mono text-sm leading-relaxed outline-none transition-all" placeholder="支持直接粘贴整份 HTML 源码，点击「整理整页源码」可自动提取 CSS。" />
          </div>

          <div>
            <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">自定义 CSS</label>
            <textarea v-model="props.settings.customPage.css" rows="6" class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 font-mono text-sm leading-relaxed outline-none transition-all" placeholder="请输入自定义 CSS 样式..." />
          </div>
        </div>

        <div class="bg-primary-50/50 dark:bg-primary-900/5 p-4 rounded-2xl border border-primary-100/50 dark:border-primary-800/30">
          <h3 class="text-sm font-bold text-primary-900 dark:text-primary-400 mb-3 flex items-center gap-2"><span class="text-lg">✨</span> 快速应用模板</h3>
          <div class="flex flex-wrap gap-3">
            <button v-for="tpl in templates" :key="tpl.name" @click="applyTemplate(tpl)" class="px-4 py-2 bg-white dark:bg-gray-800 border border-primary-200 dark:border-primary-800 rounded-xl text-sm font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all active:scale-95 shadow-sm">{{ tpl.name }}</button>
          </div>
        </div>

        <div class="flex gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 misub-radius-lg">
          <div class="text-amber-500 shrink-0">💡</div>
          <div class="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            <p class="font-bold mb-1">占位符功能说明：</p>
            <ul class="list-disc list-inside space-y-1">
              <li><strong>{&#123;profiles&#125;}</strong>: 渲染订阅组网格。</li>
              <li><strong>{&#123;announcements&#125;}</strong>: 渲染系统公告卡片。</li>
              <li><strong>{&#123;hero&#125;}</strong>: 渲染系统默认巨幕区域。</li>
              <li><strong>{&#123;guestbook&#125;}</strong>: 渲染留言板入口。</li>
            </ul>
            <p class="mt-2 opacity-80">当前仅支持 `HTML / CSS` 模式，该模式能完美契合内置占位符体系，为您提供最佳的灵活性与渲染性能。</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
