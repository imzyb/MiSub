const REDACTED = '[REDACTED]';

const SENSITIVE_KEY_PATTERN = /(token|secret|password|passwd|pwd|key|cookie|authorization|auth|credential|webhook|uuid|url)$/i;
const URL_KEY_PATTERN = /(url|uri|link|endpoint)$/i;
const ALLOWED_FETCH_PROTOCOLS = new Set(['http:', 'https:']);
const MAX_SAFE_REDIRECTS = 3;

export function redactSensitiveValue(value) {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') return REDACTED;
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.map(redactSensitiveValue);
    if (typeof value === 'object') return redactSensitiveObject(value);
    return REDACTED;
}

export function redactSensitiveObject(value, seen = new WeakSet()) {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map(item => redactSensitiveObject(item, seen));
    if (typeof value !== 'object') return value;
    if (seen.has(value)) return REDACTED;
    seen.add(value);

    const output = {};
    for (const [key, item] of Object.entries(value)) {
        if (SENSITIVE_KEY_PATTERN.test(key)) {
            output[key] = redactSensitiveValue(item);
            continue;
        }
        if (URL_KEY_PATTERN.test(key) && typeof item === 'string') {
            output[key] = redactUrl(item);
            continue;
        }
        output[key] = redactSensitiveObject(item, seen);
    }
    return output;
}

export function redactUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return value;
    try {
        const url = new URL(value);
        if (url.username) url.username = REDACTED;
        if (url.password) url.password = REDACTED;
        if (url.search) url.search = '';
        const pathParts = url.pathname.split('/').map(part => {
            if (!part) return part;
            if (part.length >= 12 || /^[A-Za-z0-9_-]{8,}$/.test(part)) return REDACTED;
            return part;
        });
        url.pathname = pathParts.join('/');
        url.hash = '';
        return url.toString();
    } catch (_) {
        return REDACTED;
    }
}

export function validatePublicFetchUrl(value) {
    let url;
    try {
        url = new URL(String(value || '').trim());
    } catch (_) {
        return { ok: false, error: 'Invalid or missing URL parameter. Must be a valid HTTP/HTTPS URL.' };
    }

    if (!ALLOWED_FETCH_PROTOCOLS.has(url.protocol)) {
        return { ok: false, error: 'Only HTTP/HTTPS URLs are allowed.' };
    }
    if (!url.hostname) {
        return { ok: false, error: 'URL host is required.' };
    }
    if (isBlockedHostname(url.hostname)) {
        return { ok: false, error: 'URL host is not allowed.' };
    }
    if (!isIpLiteral(url.hostname) && !isAllowedExternalHostname(url.hostname)) {
        return { ok: false, error: 'URL host must be a public IP literal or explicitly allowed external hostname.' };
    }
    return { ok: true, url };
}

export async function safeFetchPublicUrl(inputUrl, init = {}, options = {}) {
    const maxRedirects = options.maxRedirects ?? MAX_SAFE_REDIRECTS;
    const validation = validatePublicFetchUrl(inputUrl);
    if (!validation.ok) {
        const error = new Error(validation.error);
        error.status = 400;
        throw error;
    }

    let currentUrl = validation.url.toString();
    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
        const response = await fetch(new Request(currentUrl, {
            ...init,
            redirect: 'manual'
        }));

        if (!isRedirectStatus(response.status)) {
            return response;
        }

        const location = response.headers.get('Location');
        if (!location) {
            return response;
        }
        if (redirectCount >= maxRedirects) {
            const error = new Error('Too many redirects');
            error.status = 400;
            throw error;
        }

        const nextUrl = new URL(location, currentUrl);
        const nextValidation = validatePublicFetchUrl(nextUrl.toString());
        if (!nextValidation.ok) {
            const error = new Error(nextValidation.error);
            error.status = 400;
            throw error;
        }
        currentUrl = nextValidation.url.toString();
    }

    const error = new Error('Too many redirects');
    error.status = 400;
    throw error;
}

export function validatePublicNetworkUrl(value) {
    let url;
    try {
        url = new URL(String(value || '').trim());
    } catch (_) {
        return { ok: false, error: 'Invalid or missing URL parameter. Must be a valid HTTP/HTTPS URL.' };
    }

    if (!ALLOWED_FETCH_PROTOCOLS.has(url.protocol)) {
        return { ok: false, error: 'Only HTTP/HTTPS URLs are allowed.' };
    }
    if (!url.hostname) {
        return { ok: false, error: 'URL host is required.' };
    }
    if (isBlockedHostname(url.hostname)) {
        return { ok: false, error: 'URL host is not allowed.' };
    }
    return { ok: true, url };
}

export function assertPublicFetchUrl(inputUrl) {
    const validation = validatePublicFetchUrl(inputUrl);
    if (!validation.ok) {
        const error = new Error(validation.error);
        error.status = 400;
        throw error;
    }
    return validation.url;
}

export function assertPublicNetworkUrl(inputUrl) {
    const validation = validatePublicNetworkUrl(inputUrl);
    if (!validation.ok) {
        const error = new Error(validation.error);
        error.status = 400;
        throw error;
    }
    return validation.url;
}

function isRedirectStatus(status) {
    return [301, 302, 303, 307, 308].includes(status);
}

function normalizeHostname(hostname) {
    return String(hostname || '').trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

function isAllowedExternalHostname(hostname) {
    const normalized = normalizeHostname(hostname);
    return normalized === 'raw.githubusercontent.com'
        || normalized === 'github.com'
        || normalized === 'gist.githubusercontent.com'
        || normalized === 'api.github.com'
        || normalized.endsWith('.githubusercontent.com')
        || normalized.endsWith('.github.com')
        || normalized.endsWith('.github.io');
}

function isIpLiteral(hostname) {
    const normalized = normalizeHostname(hostname);
    return Boolean(parseIpv4(normalized)) || normalized.includes(':');
}

function isBlockedHostname(hostname) {
    const normalized = normalizeHostname(hostname);
    if (!normalized) return true;
    if (normalized === 'localhost' || normalized.endsWith('.localhost')) return true;
    if (normalized === 'metadata.google.internal') return true;
    if (normalized.endsWith('.local') || normalized.endsWith('.internal')) return true;

    const ipv4 = parseIpv4(normalized);
    if (ipv4) return isBlockedIpv4(ipv4);

    if (normalized.includes(':')) return isBlockedIpv6(normalized);
    return false;
}

function parseIpv4(hostname) {
    const parts = hostname.split('.');
    if (parts.length !== 4) return null;
    const nums = parts.map(part => {
        if (!/^\d+$/.test(part)) return NaN;
        return Number(part);
    });
    if (nums.some(num => !Number.isInteger(num) || num < 0 || num > 255)) return null;
    return nums;
}

function isBlockedIpv4(parts) {
    const [a, b] = parts;
    return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 198 && (b === 18 || b === 19)) ||
        a >= 224
    );
}

function isBlockedIpv6(hostname) {
    const hextets = parseIpv6(hostname);
    if (!hextets) return true;

    const [first, second] = hextets;
    if (hextets.every(part => part === 0)) return true;
    if (hextets.slice(0, 7).every(part => part === 0) && hextets[7] === 1) return true;

    // IANA special-purpose / non-global ranges. Public fetch should only allow
    // global IPv6 literals; GitHub allowlisted hostnames cover needed DNS use.
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((first & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
    if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
    if ((first & 0xffc0) === 0x0000) return true; // ::/10 incl. compatible/unspecified/loopback family
    if (first === 0x0064 && second === 0xff9b) return true; // 64:ff9b::/96 NAT64 well-known prefix
    if (first === 0x2001) return true; // 2001::/16 contains Teredo/docs/benchmark/special-use ranges
    if (first === 0x2002) return true; // 2002::/16 6to4 may embed private IPv4
    if (first === 0x3fff) return true; // 3fff::/20 documentation range (coarse block)

    const mapped = parseEmbeddedIpv4(hextets);
    return mapped ? isBlockedIpv4(mapped) : false;
}

function parseIpv6(value) {
    const input = String(value || '').toLowerCase();
    if (!/^[0-9a-f:.]+$/i.test(input)) return null;
    const [leftRaw, rightRaw, extra] = input.split('::');
    if (extra !== undefined) return null;

    const parseSide = (side) => {
        if (!side) return [];
        const parts = side.split(':');
        const output = [];
        for (const part of parts) {
            if (!part) return null;
            if (part.includes('.')) {
                const ipv4 = parseIpv4(part);
                if (!ipv4) return null;
                output.push((ipv4[0] << 8) | ipv4[1], (ipv4[2] << 8) | ipv4[3]);
                continue;
            }
            if (!/^[0-9a-f]{1,4}$/i.test(part)) return null;
            output.push(parseInt(part, 16));
        }
        return output;
    };

    const left = parseSide(leftRaw);
    const right = parseSide(rightRaw || '');
    if (!left || !right) return null;
    const missing = input.includes('::') ? 8 - left.length - right.length : 0;
    if (missing < 0) return null;
    const hextets = input.includes('::') ? [...left, ...Array(missing).fill(0), ...right] : left;
    return hextets.length === 8 ? hextets : null;
}

function parseEmbeddedIpv4(hextets) {
    if (!Array.isArray(hextets) || hextets.length !== 8) return null;
    if (hextets.slice(0, 5).every(part => part === 0) && hextets[5] === 0xffff) {
        return [(hextets[6] >> 8) & 255, hextets[6] & 255, (hextets[7] >> 8) & 255, hextets[7] & 255];
    }
    if (hextets.slice(0, 6).every(part => part === 0)) {
        return [(hextets[6] >> 8) & 255, hextets[6] & 255, (hextets[7] >> 8) & 255, hextets[7] & 255];
    }
    return null;
}
