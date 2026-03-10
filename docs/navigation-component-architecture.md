# 导航组件架构说明

本文档描述 MiSub 当前导航相关组件的职责拆分，便于后续迭代时避免重复实现和风格漂移。

## 组件分层

- `src/components/layout/NavBar.vue`
  - 现代布局导航容器（桌面浮岛 + 移动顶部/底部）
  - 负责路由导航项渲染
- `src/components/layout/Header.vue`
  - 经典布局头部容器
  - 负责经典布局下的品牌区和动作区挂载
- `src/components/layout/BrandLogo.vue`
  - 品牌 Logo 原子组件（图标 + 文案）
  - 两种布局共用
- `src/components/layout/NavActionGroup.vue`
  - 顶部动作区组合组件（主题、设置、切换布局、登出、外链、登录）
  - 通过 props 控制不同场景展示
- `src/components/layout/LoginEntryButton.vue`
  - 登录入口按钮原子组件
- `src/components/layout/ExternalRepoButton.vue`
  - GitHub 外链按钮原子组件

## 样式来源

统一使用 `src/assets/main.css` 的导航 token：

- 品牌区：`nav-brand-*`
- 动作按钮：`nav-action-*`
- 导航链接：`nav-tab*`、`nav-mobile-item*`
- iOS 安全区：`safe-top-inset`、`safe-bottom-inset`、`ios-*`

## 配置来源

- 导航菜单与图标常量：`src/constants/navigation.js`
  - `MAIN_NAV_ITEMS`
  - `NAV_ICONS`

## 使用建议

- 新增导航按钮时，优先扩展 `NavActionGroup.vue`，不要在容器组件里直接堆按钮。
- 修改品牌视觉时，优先改 `BrandLogo.vue` 与 `nav-brand-*` token。
- 修改 hover/focus/active 交互时，优先改 `main.css` 中对应 token。
- 避免在 `Header.vue` / `NavBar.vue` 里重新写一套样式，保持两种布局一致。

## 回归检查

请配合文档 `docs/ui-navigation-regression-checklist.md` 进行发布前检查。
