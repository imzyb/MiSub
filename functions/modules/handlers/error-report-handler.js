/**
 * 错误上报处理器
 * 接收前端错误上报并写入 KV
 */

import { createJsonResponse, createErrorResponse } from '../utils.js';

const ERROR_REPORT_KV_KEY = 'misub_error_reports';
const MAX_REPORT_ENTRIES = 200;
const MAX_MESSAGE_LENGTH = 500;
const MAX_STACK_LENGTH = 2000;
const MAX_ADDITIONAL_LENGTH = 2000;

function getKV(env) {
    if (env?.MISUB_KV) return env.MISUB_KV;
    try { if (typeof MISUB_KV !== 'undefined' && MISUB_KV) return MISUB_KV; } catch (_) {} // eslint-disable-line no-undef
    return null;
}

function safeString(value, limit) {
    if (value === undefined || value === null) return '';
    const text = String(value);
    return text.length > limit ? text.slice(0, limit) : text;
}

function safeAdditionalData(value) {
    if (!value) return null;
    try {
        const json = JSON.stringify(value);
        if (json.length > MAX_ADDITIONAL_LENGTH) return null;
        return value;
    } catch {
        return null;
    }
}

export async function handleErrorReportRequest(request, env) {
    if (request.method !== 'POST') {
        return createErrorResponse('Method Not Allowed', 405);
    }

    // 无 KV 时静默成功（不阻塞前端）
    const kv = getKV(env);
    if (!kv) {
        return createJsonResponse({ success: true });
    }

    try {
        const body = await request.json();
        const report = {
            id: crypto.randomUUID(),
            receivedAt: new Date().toISOString(),
            message: safeString(body?.message, MAX_MESSAGE_LENGTH) || 'Unknown error',
            context: safeString(body?.context, 200),
            stack: safeString(body?.stack, MAX_STACK_LENGTH),
            url: safeString(body?.url, 500),
            userAgent: safeString(body?.userAgent, 300),
            additionalData: safeAdditionalData(body?.additionalData),
            origin: safeString(request.headers.get('Origin'), 200),
            ip: safeString(request.headers.get('CF-Connecting-IP')
                || request.headers.get('X-Real-IP')
                || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim(), 100)
        };

        const raw = await kv.get(ERROR_REPORT_KV_KEY);
        let reports = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(reports)) reports = [];

        reports.unshift(report);
        if (reports.length > MAX_REPORT_ENTRIES) {
            reports = reports.slice(0, MAX_REPORT_ENTRIES);
        }

        await kv.put(ERROR_REPORT_KV_KEY, JSON.stringify(reports));

        return createJsonResponse({ success: true });
    } catch (error) {
        console.error('[ErrorReport] Failed to save report:', error);
        return createErrorResponse('Failed to save error report', 500);
    }
}
