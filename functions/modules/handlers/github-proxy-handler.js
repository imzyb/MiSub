
import { createJsonResponse, createErrorResponse } from '../utils.js';
import { StorageFactory, STORAGE_TYPES } from '../../storage-adapter.js';

/**
 * Handle proxied GitHub release requests with caching
 * GET /api/github/release?repo=owner/repo
 */
export async function handleGithubReleaseRequest(request, env) {
    const url = new URL(request.url);
    const repo = url.searchParams.get('repo');

    if (!repo || !/^[\w\-\.]+\/[\w\-\.]+$/.test(repo)) {
        return createErrorResponse('Invalid repo parameter. Format: owner/repo', 400);
    }

    const CACHE_KEY = `github_release_${repo}`;
    const CACHE_TTL_MS = 24 * 3600 * 1000; // 24 hours

    try {
        const storage = StorageFactory.createAdapter(env, STORAGE_TYPES.KV);

        // Try to get from cache
        const cachedWrapper = await storage.get(CACHE_KEY);

        if (cachedWrapper && cachedWrapper.timestamp) {
            const age = Date.now() - cachedWrapper.timestamp;
            if (age < CACHE_TTL_MS) {
                return createJsonResponse(cachedWrapper.data, 200, {
                    'X-Cache-Status': 'HIT',
                    'Cache-Control': 'public, max-age=86400'
                });
            }
        }

        // Fetch from GitHub
        const githubUrl = `https://api.github.com/repos/${repo}/releases/latest`;
        const response = await fetch(githubUrl, {
            headers: {
                'User-Agent': 'MiSub-Proxy/1.0',
                'Accept': 'application/vnd.github.v3+json'
            },
            cf: {
                cacheTtl: 86400,
                cacheEverything: true
            }
        });

        if (!response.ok) {
            // Handle rate limit or not found
            if (response.status === 403 || response.status === 429) {
                // return cached stale data if available
                if (cachedWrapper) {
                    return createJsonResponse(cachedWrapper.data, 200, {
                        'X-Cache-Status': 'STALE',
                        'Cache-Control': 'public, max-age=60'
                    });
                }
                // No cache available, return empty data instead of error
                // to prevent frontend errors
                console.warn(`[GitHub Proxy] Rate limited for ${repo}, no cache available`);
                return createJsonResponse({ tag_name: null, rate_limited: true }, 200, {
                    'X-Cache-Status': 'RATE_LIMITED',
                    'Cache-Control': 'public, max-age=300' // Retry after 5 min
                });
            }
            // For other errors (404, etc.), also return gracefully
            if (response.status === 404) {
                return createJsonResponse({ tag_name: null, not_found: true }, 200, {
                    'X-Cache-Status': 'NOT_FOUND',
                    'Cache-Control': 'public, max-age=3600'
                });
            }
            return createErrorResponse(`GitHub API Error: ${response.statusText}`, response.status);
        }

        const data = await response.json();

        // Extract only needed fields
        const simplifiedData = {
            tag_name: data.tag_name,
            html_url: data.html_url,
            published_at: data.published_at,
            name: data.name
        };

        const cachePayload = {
            data: simplifiedData,
            timestamp: Date.now()
        };

        await storage.put(CACHE_KEY, cachePayload);

        return createJsonResponse(simplifiedData, 200, {
            'X-Cache-Status': 'MISS',
            'Cache-Control': 'public, max-age=86400'
        });

    } catch (error) {
        console.error(`[GitHub Proxy] Error fetching ${repo}:`, error);
        return createErrorResponse('Internal Server Error', 500);
    }
}
