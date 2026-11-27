/**
 * 功能组件模块
 * @author MiSub Team
 */

// 导出Dashboard相关组件
import Dashboard from './Dashboard/Dashboard.vue';
export { Dashboard };
import DashboardContainer from './Dashboard/DashboardContainer.vue';
export { DashboardContainer };
import SaveIndicator from './Dashboard/SaveIndicator.vue';
export { SaveIndicator };
import Overview from './Dashboard/Overview.vue';
export { Overview };

// 导出其他功能组件
import ThemeToggle from './ThemeToggle.vue';
export { ThemeToggle };

// 组件列表
export const FeatureComponents = {
    // Dashboard组件
    Dashboard,
    DashboardContainer,
    SaveIndicator,
    Overview,

    // 其他功能组件
    ThemeToggle,
};

// 默认导出
export default FeatureComponents;
