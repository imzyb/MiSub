/**
 * 共享组件库入口文件
 * @author MiSub Team
 */

// 基础组件
export { default as FormModal } from './FormModal.vue';
export { default as DataGrid } from './DataGrid.vue';
export { default as FilterPanel } from './FilterPanel.vue';
export { default as DragDropList } from './DragDropList.vue';

// 如果需要，可以在这里添加更多导出
// export { default as ComponentName } from './ComponentName.vue';

// 组件映射对象，方便批量注册
export const SharedComponents = {
    FormModal,
    DataGrid,
    FilterPanel,
    DragDropList,
};

// 默认导出
export default SharedComponents;
