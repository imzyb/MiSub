/**
 * 模态框组件模块
 * @author MiSub Team
 */

// 导入主模态框组件
export { default as Login } from './Login.vue';
export { default as SettingsModal } from './SettingsModal.vue';
export { default as ProfileModal } from './ProfileModal.vue';
export { default as BulkImportModal } from './BulkImportModal.vue';
export { default as SubscriptionImportModal } from './SubscriptionImportModal.vue';

// 导入NodePreview相关组件
export { default as NodePreviewModal } from './NodePreview/NodePreviewModal.vue';
export { default as NodePreviewContainer } from './NodePreview/NodePreviewContainer.vue';
export { default as NodePreviewHeader } from './NodePreview/NodePreviewHeader.vue';
export { default as NodeFilterControls } from './NodePreview/NodeFilterControls.vue';
export { default as NodeListView } from './NodePreview/NodeListView.vue';
export { default as NodeCardView } from './NodePreview/NodeCardView.vue';
export { default as NodePagination } from './NodePreview/NodePagination.vue';

// 导入composable
export { useNodePreview } from '@/composables/useNodePreview.js';

// 组件列表
export const ModalComponents = {
  // 通用模态框
  Login,
  SettingsModal,
  ProfileModal,
  BulkImportModal,
  SubscriptionImportModal,

  // 节点预览相关
  NodePreviewModal,
  NodePreviewContainer,
  NodePreviewHeader,
  NodeFilterControls,
  NodeListView,
  NodeCardView,
  NodePagination,

  // Composables
  useNodePreview
};

// NodePreview子模块
export const NodePreviewComponents = {
  NodePreviewModal,
  NodePreviewContainer,
  NodePreviewHeader,
  NodeFilterControls,
  NodeListView,
  NodeCardView,
  NodePagination,
  useNodePreview
};

// 默认导出
export default ModalComponents;
