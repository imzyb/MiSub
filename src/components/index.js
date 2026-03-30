/**
 * MiSub Components 主导出文件
 * @author MiSub Team
 *
 * 统一导出所有组件，提供清晰的组件访问接口
 */

// 导出共享组件库
export * from './shared';

// 导出布局组件
export * from './layout';

// 导出功能组件
export * from './features';

// 导出UI组件
export * from './ui';

// 导出表单组件
export * from './forms';

// 导出模态框组件
export * from './modals';

// 导出节点组件
export * from './nodes';

// 导出订阅组件
export * from './subscriptions';

// 导出配置文件组件
export * from './profiles';

// 组件映射表，方便按需导入
export const ComponentMap = {
  // 布局组件
  Layout: {
    Header: () => import('./layout/Header.vue'),
    Footer: () => import('./layout/Footer.vue'),
    AdaptiveGrid: () => import('./layout/AdaptiveGrid.vue'),
    DashboardSkeleton: () => import('./layout/DashboardSkeleton.vue')
  },

  // 功能组件
  Features: {
    Dashboard: () => import('./features/Dashboard/Dashboard.vue'),
    DashboardContainer: () => import('./features/Dashboard/DashboardContainer.vue'),
    SaveIndicator: () => import('./features/Dashboard/SaveIndicator.vue'),
    Overview: () => import('./features/Dashboard/Overview.vue'),
    ThemeToggle: () => import('./features/ThemeToggle.vue')
  },

  // UI组件
  UI: {
    Card: () => import('./ui/Card.vue'),
    LoadingSpinner: () => import('./ui/LoadingSpinner.vue'),
    EmptyState: () => import('./ui/EmptyState.vue'),
    StatusIndicator: () => import('./ui/StatusIndicator.vue'),
    FluidButton: () => import('./ui/FluidButton.vue'),
    ProgressiveDisclosure: () => import('./ui/ProgressiveDisclosure.vue'),
    Toast: () => import('./ui/Toast.vue'),
    SkeletonLoader: () => import('./ui/SkeletonLoader.vue'),
    SkeletonCard: () => import('./ui/SkeletonCard.vue')
  },

  // 表单组件
  Forms: {
    Modal: () => import('./forms/Modal.vue'),
    SmartSearch: () => import('./forms/SmartSearch.vue')
  },

  // 模态框组件
  Modals: {
    Login: () => import('./modals/Login.vue'),
    SettingsModal: () => import('./modals/SettingsModal.vue'),
    ProfileModal: () => import('./modals/ProfileModal.vue'),
    BulkImportModal: () => import('./modals/BulkImportModal.vue'),
    SubscriptionImportModal: () => import('./modals/SubscriptionImportModal.vue'),
    NodePreviewModal: () => import('./modals/NodePreview/NodePreviewModal.vue'),
    NodePreviewContainer: () => import('./modals/NodePreview/NodePreviewContainer.vue'),
    NodePreviewHeader: () => import('./modals/NodePreview/NodePreviewHeader.vue'),
    NodeFilterControls: () => import('./modals/NodePreview/NodeFilterControls.vue'),
    NodeListView: () => import('./modals/NodePreview/NodeListView.vue'),
    NodeCardView: () => import('./modals/NodePreview/NodeCardView.vue'),
    NodePagination: () => import('./modals/NodePreview/NodePagination.vue')
  },

  // 节点组件
  Nodes: {
    ManualNodeCard: () => import('./nodes/ManualNodeCard.vue'),
    ManualNodeList: () => import('./nodes/ManualNodeList.vue'),
    ManualNodePanel: () => import('./nodes/ManualNodePanel.vue')
  },

  // 订阅组件
  Subscriptions: {
    SubscriptionPanel: () => import('./subscriptions/SubscriptionPanel.vue')
  },

  // 配置文件组件
  Profiles: {
    ProfileCard: () => import('./profiles/ProfileCard.vue'),
    ProfilePanel: () => import('./profiles/ProfilePanel.vue'),
    RightPanel: () => import('./profiles/RightPanel.vue')
  },

  // 共享组件
  Shared: {
    FormModal: () => import('./shared/FormModal.vue'),
    DataGrid: () => import('./shared/DataGrid.vue'),
    FilterPanel: () => import('./shared/FilterPanel.vue'),
    DragDropList: () => import('./shared/DragDropList.vue')
  }
};

// 默认导出所有组件映射
export default ComponentMap;
