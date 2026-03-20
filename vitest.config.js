import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    plugins: [vue()],
    test: {
        globals: true,
        environment: 'happy-dom',
        passWithNoTests: true,
        include: ['tests/**/*.{test,spec}.{js,ts}'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.{js,vue}', 'functions/**/*.js'],
            exclude: ['node_modules', 'dist', 'dev-dist']
        }
    },
    resolve: {
        alias: {
            '@': '/src'
        }
    }
})
