<script setup>
    import { ref } from 'vue';

    defineProps({
        textSizeClass: {
            type: String,
            default: 'text-lg',
        },
        iconSize: {
            type: Number,
            default: 28,
        },
        // 跳转目标：已登录时由调用方传入 /dashboard，避免先落到 "/" 再被重定向，
        // 造成仪表盘组件树卸载后重新挂载（定时器重启、数据重复校验、界面闪烁）。
        to: {
            type: String,
            default: '/',
        },
    });

    // 走打包产物（/assets/logo-*.png）而不是 public 下的 /logo.png：
    // 后者在伪装开启时对未鉴权请求会被服务端 404（有意的指纹防护），
    // 登录页与公开页因此长期拿不到图标，控制台还会刷 404。
    import logoUrl from '../../assets/logo.png';

    // 极端情况下（资源被 CDN 拦截）降级为内联图标，保持视觉完整。
    const logoFailed = ref(false);
</script>

<template>
    <router-link :to="to" class="nav-brand-wrap">
        <div class="nav-brand-badge nav-brand-badge-sm" aria-hidden="true">
            <img
                v-if="!logoFailed"
                :width="iconSize"
                :height="iconSize"
                :src="logoUrl"
                alt="MiSub"
                @error="logoFailed = true"
            />
            <svg
                v-else
                :width="iconSize"
                :height="iconSize"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <circle cx="12" cy="12" r="9" />
                <path d="M3.6 9h16.8M3.6 15h16.8" />
                <path d="M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
            </svg>
        </div>
        <span class="nav-brand-text" :class="textSizeClass">MiSub</span>
    </router-link>
</template>
