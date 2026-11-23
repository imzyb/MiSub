# 导航组件架构说明

本文档描述 MiSub 当前导航相关组件的职责拆分，便于后续迭代时避免重复实现和风格漂移。

## 组件分层

- `src/components/layout/NavBar.vue`
    - 现代布局导航容器（`layoutMode === 'modern'` 且已登录时由 `App.vue` 挂载）
    - 桌面端为顶部吸顶横幅（`app-nav-bar` + `nav-tab-shell`），移动端为顶部品牌/动作栏（`md:hidden`）
    - 登录后额外挂载移动端底部标签栏（`mobile-nav-glass`）；未登录时不渲染底部导航
    - 负责路由导航项渲染与 active 判定：`/`、`/dashboard` 精确匹配，其余按路径前缀匹配
    - 品牌 Logo 固定指向 `/dashboard`；`publicConfig.enablePublicPage` 为真时展示公开页入口；`customPage.hideBranding` 为真时隐藏仓库外链
- `src/components/layout/Header.vue`
    - 经典布局头部容器，同时承担未登录公开页的头部
    - 负责经典布局下的品牌区和动作区挂载，含 iOS 安全区（`safe-top-inset`、`ios-status-overlay`、`ios-fixed-header`）
    - `hideBranding` 为真时用「首页」文本链接替代 Logo；`customLoginPath` 配置为自定义路径时隐藏登录按钮
- `src/components/layout/BrandLogo.vue`
    - 品牌 Logo 原子组件（图标 + 文案）
    - 两种布局共用；props：`to`（默认 `/`，登录态由调用方传 `/dashboard`）、`textSizeClass`、`iconSize`
    - Logo 读取打包资源 `src/assets/logo.png`，加载失败时降级为内联 SVG
- `src/components/layout/NavActionGroup.vue`
    - 顶部动作区组合组件（公开页、反馈、语言切换、主题切换、设置、切换布局、退出登录、GitHub 外链、登录）
    - 通过 props 控制不同场景展示：`isLoggedIn`、`showExplore`、`showSettings`、`showLoginButton`、`roundedClass`、`withFocusRing`、`showDivider`、`hideExternalRepo`
    - 公开页反馈按钮仅在未登录且当前路由为 `Home` / `Explore` 时出现，点击派发 `open-guestbook` 自定义事件供公开页消费
    - 向上 emit：`openSettings`、`toggleLayout`、`logout`
- `src/components/layout/LoginEntryButton.vue`
    - 登录入口按钮原子组件；跳转目标优先取 `publicConfig.customLoginPath`，否则为 `/login`
- `src/components/layout/ExternalRepoButton.vue`
    - GitHub 外链按钮原子组件
- `src/components/layout/LanguageSwitcher.vue`
    - 全站中英切换按钮（`zh-CN` ↔ `en-US`），语言偏好写入 `localStorage` 的 `misub:locale`
- `src/components/features/ThemeToggle.vue`
    - 明暗主题切换按钮（由 `NavActionGroup` 挂载），带 `aria-pressed` 状态
- `src/components/layout/index.js`
    - 布局组件桶导出，供页面按需引入

## 样式来源

统一使用 `src/assets/main.css` 的导航 token：

- 品牌区：`nav-brand-*`
- 动作按钮：`nav-action-btn`、`nav-action-btn-neutral`、`nav-action-btn-danger`、`nav-action-focus`、`nav-action-focus-danger`
- 导航链接：`nav-tab`、`nav-tab-shell`、`nav-tab-active/inactive`、`nav-tab-active-pill`；移动底栏 `nav-mobile-item*`、`nav-mobile-icon-wrap`
- 布局容器：`app-nav-bar`（圆角归零）、`mobile-nav-glass`、`mobile-nav-inner`
- 圆角：`misub-radius-*`（动作区通过 `roundedClass` 传入）
- iOS 安全区：`safe-top-inset`、`safe-bottom-inset`、`ios-status-overlay`、`ios-fixed-header`
- 触控目标：`@media (pointer: coarse)` 下的 `touch-target`（44px）、`touch-target-min`（24px），`.nav-action-btn` 同步放大
- 动效降级：`@media (prefers-reduced-motion: reduce)` 下关闭导航动画与过渡

## 配置来源

- 导航菜单与图标常量：`src/constants/navigation.js`
    - `MAIN_NAV_ITEMS`：`key`（i18n key）、`name`（中文回退值，不参与渲染）、`path`、`iconPath`
    - `NAV_ICONS`：导航项与动作按钮共用的图标路径常量
- 导航文案：`src/i18n/messages.js` 的 `nav.*`、`actions.*`、`common.*`；组件通过 `useI18n().t(key)` 渲染
- 布局偏好：`src/stores/ui.js` 的 `layoutMode`（`modern` / `legacy`），经 `src/utils/local-preference.js` 持久化；`toggleLayout()` 写入偏好后跳转 `/`，以整页刷新完成布局切换
- 公开页与伪装：`sessionStore.publicConfig`
    - `enablePublicPage`：是否展示公开页入口
    - `customLoginPath`：自定义登录路径（登录入口与路由守卫共用）
    - `customPage.enabled` / `hideBranding` / `hideHeader` / `hideFooter`：公开页伪装开关
- 路由名称：`src/router/index.js` 的 `Home` / `Explore`，用于判定公开页反馈按钮是否出现

## 使用建议

- 新增导航项时，同时更新 `MAIN_NAV_ITEMS`、`NAV_ICONS` 与 `src/i18n/messages.js` 的 `nav.*`（中英各一份），不要只写死中文 `name`。
- 新增导航动作时，优先扩展 `NavActionGroup.vue`，用 props 控制显隐，不要在容器组件里直接堆按钮。
- 修改品牌视觉时，优先改 `BrandLogo.vue` 与 `nav-brand-*` token。
- 修改 hover/focus/active 交互时，优先改 `main.css` 中对应 token，并沿用 `--focus-ring`。
- 避免在 `Header.vue` / `NavBar.vue` 里重新写一套样式，保持两种布局一致。
- 新增图标按钮必须带可翻译的 `aria-label`，并确认在 `pointer: coarse` 设备上点击区域不小于 44px。
- 调整布局挂载条件时改 `App.vue` 的 `showModernNavBar` / `showLegacyHeader`，不要在容器组件内部判断。

## 回归检查

请配合文档 `docs/ui-navigation-regression-checklist.md` 进行发布前检查。
