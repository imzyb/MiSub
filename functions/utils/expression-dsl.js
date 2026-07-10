/**
 * Restricted expression DSL for MiSub node transformations.
 * This intentionally avoids eval/new Function and supports only declarative
 * templates, field comparisons and a small helper call grammar.
 */

const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const STRING_RE = /^(?:'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)")$/;
const NUMBER_RE = /^-?\d+(?:\.\d+)?$/;

function unquote(value) {
    const text = String(value || '').trim();
    const match = text.match(STRING_RE);
    if (!match) return text;
    const raw = match[1] ?? match[2] ?? '';
    return raw.replace(/\\(['"\\nrt])/g, (_, ch) => {
        switch (ch) {
            case 'n': return '\n';
            case 'r': return '\r';
            case 't': return '\t';
            default: return ch;
        }
    });
}

function splitArgs(input) {
    const args = [];
    let current = '';
    let quote = '';
    let escaped = false;
    let depth = 0;
    for (const char of String(input || '')) {
        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }
        if (char === '\\') {
            current += char;
            escaped = true;
            continue;
        }
        if (quote) {
            current += char;
            if (char === quote) quote = '';
            continue;
        }
        if (char === '\'' || char === '"') {
            quote = char;
            current += char;
            continue;
        }
        if (char === '(') depth++;
        if (char === ')') depth = Math.max(0, depth - 1);
        if (char === ',' && depth === 0) {
            args.push(current.trim());
            current = '';
            continue;
        }
        current += char;
    }
    if (current.trim() || input === '') args.push(current.trim());
    return args;
}

function getField(ctx, name) {
    if (!IDENTIFIER_RE.test(String(name || ''))) return '';
    if (Object.prototype.hasOwnProperty.call(ctx, name)) return ctx[name];
    return '';
}

function safeTitle(value) {
    const text = String(value || '');
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function safeMatch(value, pattern, flags = 'i') {
    try {
        return new RegExp(String(pattern || ''), String(flags || 'i')).test(String(value || ''));
    } catch {
        return false;
    }
}

function safeReplace(value, pattern, replacement = '', flags = 'g') {
    try {
        return String(value || '').replace(new RegExp(String(pattern || ''), String(flags || 'g')), String(replacement || ''));
    } catch {
        return String(value || '');
    }
}

function fallback(...values) {
    for (const value of values) {
        if (value !== null && value !== undefined && String(value).trim() !== '') return value;
    }
    return '';
}

function pick(condition, truthyValue, falsyValue = '') {
    return condition ? truthyValue : falsyValue;
}

function evalValue(expr, ctx) {
    const text = String(expr || '').trim();
    if (!text) return '';
    if (STRING_RE.test(text)) return unquote(text);
    if (NUMBER_RE.test(text)) return Number(text);
    if (text === 'true') return true;
    if (text === 'false') return false;
    if (text === 'null') return null;

    const call = text.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\((.*)\)$/s);
    if (call) {
        const [, fn, rawArgs] = call;
        const args = splitArgs(rawArgs).map(arg => evalValue(arg, ctx));
        switch (fn) {
            case 'upper': return String(args[0] || '').toUpperCase();
            case 'lower': return String(args[0] || '').toLowerCase();
            case 'title': return safeTitle(args[0]);
            case 'trim': return String(args[0] || '').trim();
            case 'replace': return safeReplace(args[0], args[1], args[2], args[3]);
            case 'contains': return String(args[0] || '').toLowerCase().includes(String(args[1] || '').toLowerCase());
            case 'match': return safeMatch(args[0], args[1], args[2] || 'i');
            case 'fallback': return fallback(...args);
            case 'pick': return pick(Boolean(args[0]), args[1], args[2] ?? '');
            default: return '';
        }
    }

    return getField(ctx, text);
}

export function evaluateDslExpression(expression, ctx = {}) {
    const expr = String(expression || '').trim();
    if (!expr) return true;

    const logicalOr = expr.split(/\s+\|\|\s+/);
    if (logicalOr.length > 1) return logicalOr.some(part => evaluateDslExpression(part, ctx));
    const logicalAnd = expr.split(/\s+&&\s+/);
    if (logicalAnd.length > 1) return logicalAnd.every(part => evaluateDslExpression(part, ctx));

    const comparison = expr.match(/^(.+?)\s*(===|!==|>=|<=|>|<)\s*(.+)$/s);
    if (comparison) {
        const left = evalValue(comparison[1], ctx);
        const right = evalValue(comparison[3], ctx);
        switch (comparison[2]) {
            case '===': return String(left) === String(right);
            case '!==': return String(left) !== String(right);
            case '>=': return Number(left) >= Number(right);
            case '<=': return Number(left) <= Number(right);
            case '>': return Number(left) > Number(right);
            case '<': return Number(left) < Number(right);
            default: return false;
        }
    }

    return Boolean(evalValue(expr, ctx));
}

export function renderDslTemplate(template, ctx = {}) {
    return String(template || '').replace(/\{([^{}]+)\}/g, (_, inner) => {
        const value = evalValue(inner, ctx);
        return value == null ? '' : String(value);
    }).trim();
}

export function matchesDslCondition(record, condition = {}) {
    if (typeof condition === 'string') return evaluateDslExpression(condition, record);
    if (!condition || typeof condition !== 'object') return true;
    const actual = getField(record, condition.field || 'name');
    const expected = condition.value ?? '';
    const op = String(condition.op || 'contains').toLowerCase();
    switch (op) {
        case 'eq':
        case 'equals': return String(actual) === String(expected);
        case 'ne':
        case 'not_equals': return String(actual) !== String(expected);
        case 'contains': return String(actual || '').toLowerCase().includes(String(expected || '').toLowerCase());
        case 'not_contains': return !String(actual || '').toLowerCase().includes(String(expected || '').toLowerCase());
        case 'match':
        case 'regex': return safeMatch(actual, expected, condition.flags || 'i');
        case 'in': return Array.isArray(expected) && expected.map(String).includes(String(actual));
        default: return false;
    }
}
