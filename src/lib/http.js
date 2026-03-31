/**
 * Shared HTTP helpers for API requests.
 * Centralizes JSON handling, credentials, and error normalization.
 */

export class APIError extends Error {
  constructor(message, status = 500, data = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}

const buildHeaders = (headers, body) => {
  if (headers instanceof Headers) {
    return headers;
  }
  const resolved = new Headers(headers || {});
  if (!resolved.has('Content-Type') && body !== undefined) {
    resolved.set('Content-Type', 'application/json');
  }
  return resolved;
};

const parseJson = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    return text;
  }
};

export async function request(url, options = {}) {
  const { headers, body, ...rest } = options;
  const response = await fetch(url, {
    credentials: 'include',
    ...rest,
    body,
    headers: buildHeaders(headers, body)
  });

  const data = await parseJson(response);
  if (!response.ok) {
    const message = data?.message || data?.error || `HTTP ${response.status}`;
    throw new APIError(message, response.status, data);
  }

  return data;
}

const stringifyBody = (data) => (data === undefined ? undefined : JSON.stringify(data));

export const api = {
  get: (url, options = {}) => request(url, { ...options, method: 'GET' }),
  post: (url, data, options = {}) => request(url, { ...options, method: 'POST', body: stringifyBody(data) }),
  put: (url, data, options = {}) => request(url, { ...options, method: 'PUT', body: stringifyBody(data) }),
  patch: (url, data, options = {}) => request(url, { ...options, method: 'PATCH', body: stringifyBody(data) }),
  del: (url, options = {}) => request(url, { ...options, method: 'DELETE' })
};
