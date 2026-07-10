import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    class MockAPIError extends Error {
        constructor(message, status = 500, data = null) {
            super(message);
            this.name = 'APIError';
            this.status = status;
            this.data = data;
        }
    }

    return {
        post: vi.fn(),
        APIError: MockAPIError
    };
});

vi.mock('../../src/lib/http.js', () => ({
    api: {
        post: mocks.post
    },
    APIError: mocks.APIError
}));

describe('fetchNodeCount feedback normalization', () => {
    beforeEach(() => {
        mocks.post.mockReset();
    });

    it('treats backend success false payloads as failed updates', async () => {
        mocks.post.mockResolvedValue({
            success: false,
            error: 'HTTP 403: Forbidden',
            errorType: 'server',
            count: 0,
            userInfo: null
        });

        const { fetchNodeCount } = await import('../../src/lib/api.js');
        const result = await fetchNodeCount('https://airport.example/sub');

        expect(result.success).toBe(false);
        expect(result.error).toBe('HTTP 403: Forbidden');
        expect(result.status).toBe(403);
    });

    it('keeps real HTTP status codes from failed API responses', async () => {
        const error = new mocks.APIError('Forbidden', 403, { error: 'Forbidden' });
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mocks.post.mockRejectedValue(error);

        const { fetchNodeCount } = await import('../../src/lib/api.js');
        try {
            const result = await fetchNodeCount('https://airport.example/sub');

            expect(result.success).toBe(false);
            expect(result.error).toBe('HTTP 403: Forbidden');
            expect(result.status).toBe(403);
            expect(errorSpy).toHaveBeenCalledWith('[API Error - fetchNodeCount]', error);
        } finally {
            errorSpy.mockRestore();
        }
    });

    it('does not duplicate HTTP status prefixes from APIError messages', async () => {
        const error = new mocks.APIError('HTTP 403: Forbidden', 403, { error: 'Forbidden' });
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mocks.post.mockRejectedValue(error);

        const { fetchNodeCount } = await import('../../src/lib/api.js');
        try {
            const result = await fetchNodeCount('https://airport.example/sub');

            expect(result.success).toBe(false);
            expect(result.error).toBe('HTTP 403: Forbidden');
            expect(result.error).not.toContain('HTTP 403: HTTP 403');
            expect(result.status).toBe(403);
            expect(errorSpy).toHaveBeenCalledWith('[API Error - fetchNodeCount]', error);
        } finally {
            errorSpy.mockRestore();
        }
    });
});
