/**
 * 功能组件模块
 * @author MiSub Team
 */

// 导出Dashboard相关组件
export { default as Dashboard } from './Dashboard/Dashboard.vue';
export { default as DashboardContainer } from './Dashboard/DashboardContainer.vue';
export { default as SaveIndicator } from './Dashboard/SaveIndicator.vue';
export { default as Overview } from './Dashboard/Overview.vue';

// 导出其他功能组件
export { default as ThemeToggle } from './ThemeToggle.vue';

// 组件列表
export const FeatureComponents = {
  // Dashboard组件
  Dashboard,
  DashboardContainer,
  SaveIndicator,
  Overview,


  // 其他功能组件
  ThemeToggle
};

// 默认导出
export default FeatureComponents;
