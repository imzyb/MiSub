import { ref, watch } from 'vue';

/**
 * 一个Vue组合式函数，接收一个响应式数字，返回一个带动画效果的响应式数字。
 * @param {import('vue').Ref<number>} targetValue - 目标数字 (必须是一个ref或computed)
 * @returns {import('vue').Ref<number>} - 一个会从旧值动画到新值的ref
 */
export function useAnimatedCounter(targetValue) {
  const displayValue = ref(targetValue.value || 0);
  let animationFrameId = null;

  const animate = (from, to) => {
    const duration = 700; // 动画持续时间 (毫秒)
    const start = performance.now();

    const update = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      
      // 使用缓动函数让动画效果更自然 (ease-out)
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      
      displayValue.value = Math.round(from + (to - from) * easedProgress);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(update);
      }
    };
    animationFrameId = requestAnimationFrame(update);
  };

  // 监听目标值的变化，一旦变化就触发动画
  watch(targetValue, (newValue, oldValue) => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    animate(oldValue || 0, newValue || 0);
  });

  return displayValue;
}