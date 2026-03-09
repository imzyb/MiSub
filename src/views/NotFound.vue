<template>
  <div class="not-found-container font-sans text-gray-100 dark:text-gray-100">
    <!-- Cosmic Background Elements -->
    <div class="absolute inset-0 bg-gray-900 overflow-hidden">
        <div class="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
        <div class="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/30 blur-[120px] animate-pulse-slow"></div>
        <div class="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/20 blur-[100px] animate-pulse-slow" style="animation-delay: -2s;"></div>
    </div>

    <!-- Content Card -->
    <div class="relative z-10 glass-panel border border-white/10 misub-radius-lg p-12 max-w-lg w-[90%] text-center shadow-2xl backdrop-blur-xl animate-fade-in-up">
      <div class="font-display font-bold text-9xl bg-gradient-to-b from-white to-white/10 bg-clip-text text-transparent drop-shadow-lg mb-4 animate-float">
        404
      </div>
      
      <h1 class="text-3xl font-bold mb-4 tracking-tight">页面迷失在星际中</h1>
      <p class="text-lg text-gray-400 mb-10 leading-relaxed">
        抱歉，您访问的页面似乎已漂流至已知宇宙之外。<br>
        如需登录，请访问 <span class="text-primary-400 font-semibold">/login</span> 或已配置的自定义登录路径。
      </p>
      
      <router-link to="/" class="inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-white bg-primary-600 hover:bg-primary-500 rounded-full transition-all duration-300 shadow-lg shadow-primary-500/30 hover:-translate-y-1 hover:shadow-primary-500/50">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clip-rule="evenodd" />
        </svg>
        返回首页
      </router-link>
    </div>
  </div>
</template>

<script setup>
// No script needed
</script>

<style scoped>
.not-found-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  width: 100vw;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9999;
  overflow: hidden;
}

.glass-panel {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-15px); }
}

@keyframes pulse-slow {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.1); }
}

@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-float {
  animation: float 6s ease-in-out infinite;
}

.animate-pulse-slow {
  animation: pulse-slow 8s ease-in-out infinite;
}

.animate-fade-in-up {
  animation: fade-in-up 0.8s ease-out forwards;
}
</style>
