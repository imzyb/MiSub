/**
 * 模态框组件模块
 * @author MiSub Team
 */

// 导入主模态框组件
import Login from './Login.vue';
export { Login };
import SettingsModal from './SettingsModal.vue';
export { SettingsModal };
import ProfileModal from './ProfileModal.vue';
export { ProfileModal };
import BulkImportModal from './BulkImportModal.vue';
export { BulkImportModal };
import SubscriptionImportModal from './SubscriptionImportModal.vue';
export { SubscriptionImportModal };

// 导入NodePreview相关组件
import NodePreviewModal from './NodePreview/NodePreviewModal.vue';
export { NodePreviewModal };
import NodePreviewContainer from './NodePreview/NodePreviewContainer.vue';
export { NodePreviewContainer };
import NodePreviewHeader from './NodePreview/NodePreviewHeader.vue';
export { NodePreviewHeader };
import NodeFilterControls from './NodePreview/NodeFilterControls.vue';
export { NodeFilterControls };
import NodeListView from './NodePreview/NodeListView.vue';
export { NodeListView };
import NodeCardView from './NodePreview/NodeCardView.vue';
export { NodeCardView };
import NodePagination from './NodePreview/NodePagination.vue';
export { NodePagination };

// 导入composable
import { useNodePreview } from '@/composables/useNodePreview.js';
export { useNodePreview };

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
    useNodePreview,
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
    useNodePreview,
};

// 默认导出
export default ModalComponents;
