import { createRouter, createWebHistory } from 'vue-router';

// Lazy load views for better performance
const DashboardView = () => import('../views/DashboardView.vue');
const SubscriptionGroupsView = () => import('../views/SubscriptionGroupsView.vue');
const ManualNodesView = () => import('../views/ManualNodesView.vue');
const MySubscriptionsView = () => import('../views/MySubscriptionsView.vue');
const SettingsView = () => import('../views/SettingsView.vue');
const VpsMonitorView = () => import('../views/VpsMonitorView.vue');
const PublicVpsMonitorView = () => import('../views/PublicVpsMonitorView.vue');

const HomeView = () => import('../views/HomeView.vue'); // [NEW] Wrapper View

const routes = [
    {
        path: '/',  // Root path is HomeView (Smart Wrapper)
        name: 'Home',
        component: HomeView,
        meta: { title: '首页', isPublic: true } // Publicly accessible, view handles content
    },
    {
        path: '/explore',
        name: 'Explore',
        component: HomeView,
        meta: { title: '公开页', isPublic: true }
    },
    {
        path: '/dashboard', // Explicit dashboard route redirects to home or is alias
        redirect: '/'
    },
    {
        path: '/groups',
        name: 'SubscriptionGroups',
        component: SubscriptionGroupsView,
        meta: { title: '订阅组' }
    },
    {
        path: '/nodes',
        name: 'ManualNodes',
        component: ManualNodesView,
        meta: { title: '手工节点' }
    },
    {
        path: '/subscriptions',
        name: 'MySubscriptions',
        component: MySubscriptionsView,
        meta: { title: '我的订阅' }
    },
    {
        path: '/monitor',
        name: 'VpsMonitor',
        component: VpsMonitorView,
        meta: { title: 'VPS探针' }
    },
    {
        path: '/vps',
        name: 'PublicVpsMonitor',
        component: PublicVpsMonitorView,
        meta: { title: 'VPS探针公开页', isPublic: true }
    },
    {
        path: '/settings',
        name: 'Settings',
        component: SettingsView,
        meta: { title: '设置' }
    },
    /* 
    // [REMOVED] Static /login route. 
    // Handled dynamically by Catch-All route (Entrance.vue) to support Custom Login Path.
    {
        path: '/login',
        name: 'Login',
        component: () => import('../components/modals/Login.vue'),
        meta: { title: '登录', isPublic: false } 
    }, 
    */
    {
        // Catch-all route for Custom Login Path or 404
        path: '/:pathMatch(.*)*',
        name: 'Entrance',
        component: () => import('../views/Entrance.vue'),
        meta: { title: 'MiSub', isPublic: true } // Public, so Entrance.vue can decide what to render
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior(to, from, savedPosition) {
        if (savedPosition) {
            return savedPosition;
        } else {
            return { top: 0 };
        }
    }
});

// 自动恢复动态 chunk 加载失败导致的白屏
router.onError((error) => {
    const message = error?.message || '';
    if (message.includes('Failed to fetch dynamically imported module')
        || message.includes('error loading dynamically imported module')) {
        const reloadKey = 'misub:chunk-reload';
        if (sessionStorage.getItem(reloadKey) !== '1') {
            sessionStorage.setItem(reloadKey, '1');
            window.location.reload();
        }
    }
});

// Navigation guard
router.beforeEach(async (to, from, next) => {
    // Update title
    if (typeof document !== 'undefined') {
        document.title = to.meta.title ? `${to.meta.title} - MISUB` : 'MISUB';
    }

    // Simple auth check: check if the user is visiting a protected route
    // We rely on the session store state or a quick check.
    // However, pinia stores are only available after app is mounted or inside guards if pinia instance is passed?
    // Pinia is installed in main.js, so using it inside router.beforeEach (which is imported by main.js) might be tricky if called before app mount.
    // BUT, router.beforeEach is called on navigation.

    // Better approach: Check if we are on the login page. If not, and we don't have a flagged session, maybe redirect?
    // Actually, the sessionStore handles the initial check.
    // Let's just rely on the API 401 response to kick the user out (handled in api.js -> sessionStore).
    // BUT the user wants to populate the "enter operation interface" issue.
    // The most reliable way is: if "not logged in" state is known, block access.

    // Ideally, we'd import the session store here, but circular dependencies might occur.
    // Let's keep it simple: if the session check fails (which happens in App.vue or main.js), it redirects.
    // But to prevent "flash of content", we can add a simple check if we are SURE we aren't logged in.

    // For now, let's stick to the title update as the primary router responsibility, 
    // and rely on the Backend Redirect (implemented in Step 1) and API 401 handling for security.
    // The backend redirect covers the "refresh/direct link" case.
    // The API 401 covers the "token expired while using" case.

    next();
});

export default router;
