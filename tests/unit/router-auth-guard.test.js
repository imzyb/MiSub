import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import router, { configureAuthGuard } from '../../src/router/index.js';

describe('router authentication guard', () => {
    beforeEach(async () => {
        configureAuthGuard(() => ({ state: 'loggedOut', loginPath: '/admin-login' }));
        await router.replace('/');
    });

    afterEach(() => {
        configureAuthGuard(() => ({ state: 'loading', loginPath: '/login' }));
    });

    it('redirects unauthenticated users to the configured login path', async () => {
        await router.push('/dashboard');

        expect(router.currentRoute.value.path).toBe('/admin-login');
        expect(router.currentRoute.value.query.redirect).toBe('/dashboard');
    });

    it('allows authenticated users to enter protected routes', async () => {
        configureAuthGuard(() => ({ state: 'loggedIn', loginPath: '/admin-login' }));

        await router.push('/dashboard');

        expect(router.currentRoute.value.path).toBe('/dashboard');
    });

    it('does not block public routes while the session is loading', async () => {
        configureAuthGuard(() => ({ state: 'loading', loginPath: '/admin-login' }));

        await router.push('/explore');

        expect(router.currentRoute.value.path).toBe('/explore');
    });
});
