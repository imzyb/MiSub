import globals from 'globals';
import vueParser from 'vue-eslint-parser';

// 只开 no-undef：这正是「漏 import 导致线上 500」那一类问题的静态拦截。
// 业务规则/代码风格不在这里管，交给 Prettier 与各模块自己的测试。
const browserGlobals = {
    ...globals.browser,
    ...globals.es2024,
};

export default [
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            '.tmp-lint/**',
            '.tmp-shots/**',
            'public/**',
            'coverage/**',
        ],
    },
    {
        files: ['functions/**/*.js'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            globals: {
                ...globals.worker,
                ...browserGlobals,
                // Cloudflare Pages Functions 开启了 nodejs_compat；
                // Buffer 只出现在 btoa/atob 缺失时的兜底分支。
                Buffer: 'readonly',
            },
        },
        rules: { 'no-undef': 'error' },
    },
    {
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            globals: browserGlobals,
        },
        rules: { 'no-undef': 'error' },
    },
    {
        files: ['src/**/*.vue'],
        languageOptions: {
            parser: vueParser,
            ecmaVersion: 2024,
            sourceType: 'module',
            parserOptions: {
                ecmaVersion: 2024,
                sourceType: 'module',
            },
            globals: {
                ...browserGlobals,
                defineProps: 'readonly',
                defineEmits: 'readonly',
                defineExpose: 'readonly',
                defineModel: 'readonly',
                withDefaults: 'readonly',
            },
        },
        rules: { 'no-undef': 'error' },
    },
];
