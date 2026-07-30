import { newQuickJSWASMModuleFromVariant, newVariant } from 'quickjs-emscripten-core';
import RELEASE_SYNC from '@jitl/quickjs-wasmfile-release-sync';

const DEFAULT_LIMITS = Object.freeze({
    maxScriptBytes: 32 * 1024,
    maxInputBytes: 2 * 1024 * 1024,
    maxOutputBytes: 2 * 1024 * 1024,
    maxNodes: 10_000,
    memoryBytes: 16 * 1024 * 1024,
    stackBytes: 512 * 1024,
    timeoutMs: 100
});

const textEncoder = new TextEncoder();
let quickJsModulePromise;

async function createQuickJsModule() {
    let variant = RELEASE_SYNC;
    if (globalThis.navigator?.userAgent === 'Cloudflare-Workers') {
        const importedWasm = await import('../vendor/quickjs-release-sync.wasm');
        const wasmModule = importedWasm.default;
        variant = newVariant(RELEASE_SYNC, { wasmModule });
    }
    return newQuickJSWASMModuleFromVariant(variant);
}

function getQuickJsModule() {
    if (!quickJsModulePromise) {
        quickJsModulePromise = createQuickJsModule();
    }
    return quickJsModulePromise;
}

function byteLength(value) {
    return textEncoder.encode(value).byteLength;
}

function getSafeContext(context = {}) {
    return {
        subName: typeof context.subName === 'string' ? context.subName : '',
        target: typeof context.target === 'string' ? context.target : '',
        userAgent: typeof context.userAgent === 'string' ? context.userAgent : '',
        isClash: context.isClash === true,
        isSurge: context.isSurge === true,
        isQuanX: context.isQuanX === true,
        isLoon: context.isLoon === true,
        isShadowrocket: context.isShadowrocket === true,
        isSingBox: context.isSingBox === true
    };
}

function buildGuestProgram(code) {
    const declaresOperator = /\b(?:async\s+)?function\s+operator\b|\b(?:const|let|var)\s+operator\s*=/.test(code);
    const invocation = declaresOperator
        ? `(() => {
            ${code}
            if (typeof operator !== 'function') {
                throw new TypeError('operator must be a function');
            }
            return operator(__nodes, __context, $utils);
        })()`
        : `(function ($proxies, $context, $utils) {
            ${code}
        })(__nodes, __context, $utils)`;

    return `
        "use strict";
        const __nodes = JSON.parse(globalThis.__MISUB_NODES_JSON__);
        const __context = JSON.parse(globalThis.__MISUB_CONTEXT_JSON__);
        const $proxies = __nodes;
        const $nodes = __nodes;
        const $context = __context;
        const $utils = Object.freeze({
            decodeURI,
            encodeURI,
            decodeURIComponent,
            encodeURIComponent,
            jsonStringify: JSON.stringify,
            jsonParse: JSON.parse,
            getHost(value) {
                const match = String(value || '').match(/^[a-z][a-z0-9+.-]*:\\/\\/([^/?#]+)/i);
                if (!match) return '';
                const authority = match[1].replace(/^[^@]*@/, '');
                return authority.startsWith('[')
                    ? authority.slice(1, authority.indexOf(']'))
                    : authority.replace(/:\\d+$/, '');
            }
        });
        let __result = ${invocation};
        if (typeof __result === 'function') {
            __result = __result(__nodes, __context, $utils);
        }
        if (__result && typeof __result.then === 'function') {
            throw new TypeError('Async scripts are not supported in the sandbox');
        }
        JSON.stringify(__result);
    `;
}

function setGlobalString(vm, name, value) {
    const handle = vm.newString(value);
    try {
        vm.setProp(vm.global, name, handle);
    } finally {
        handle.dispose();
    }
}

function validateNodes(value, inputCount, limits) {
    if (!Array.isArray(value)) {
        throw new TypeError('Script result must be an array');
    }
    const maxOutputNodes = Math.min(limits.maxNodes, Math.max(inputCount * 4, inputCount + 100));
    if (value.length > maxOutputNodes) {
        throw new RangeError(`Script returned too many nodes (${value.length} > ${maxOutputNodes})`);
    }
    for (const node of value) {
        if (!node || typeof node !== 'object' || Array.isArray(node)) {
            throw new TypeError('Every script result item must be a node object');
        }
        if (typeof node.url !== 'string' || typeof node.protocol !== 'string') {
            throw new TypeError('Every script result node must contain string url and protocol fields');
        }
        if (node.name !== undefined && typeof node.name !== 'string') {
            throw new TypeError('Node name must be a string');
        }
    }
    return value;
}

/**
 * Execute synchronous user JavaScript inside an isolated QuickJS/Wasm runtime.
 * No host functions, storage bindings, network APIs, or environment objects are exposed.
 */
export async function runQuickJsNodeScript(code, nodes, context = {}, customLimits = {}) {
    const limits = { ...DEFAULT_LIMITS, ...customLimits };
    const scriptCode = typeof code === 'string' ? code.trim() : '';
    if (!scriptCode) return nodes;
    if (byteLength(scriptCode) > limits.maxScriptBytes) {
        throw new RangeError(`Script exceeds ${limits.maxScriptBytes} bytes`);
    }
    if (!Array.isArray(nodes) || nodes.length > limits.maxNodes) {
        throw new RangeError(`Script input exceeds ${limits.maxNodes} nodes`);
    }

    const nodesJson = JSON.stringify(nodes);
    const contextJson = JSON.stringify(getSafeContext(context));
    if (byteLength(nodesJson) > limits.maxInputBytes) {
        throw new RangeError(`Script input exceeds ${limits.maxInputBytes} bytes`);
    }

    const QuickJS = await getQuickJsModule();
    const runtime = QuickJS.newRuntime();
    runtime.setMemoryLimit(limits.memoryBytes);
    runtime.setMaxStackSize(limits.stackBytes);
    const deadline = Date.now() + limits.timeoutMs;
    runtime.setInterruptHandler(() => Date.now() > deadline);

    const vm = runtime.newContext();
    try {
        setGlobalString(vm, '__MISUB_NODES_JSON__', nodesJson);
        setGlobalString(vm, '__MISUB_CONTEXT_JSON__', contextJson);

        const evaluation = vm.evalCode(buildGuestProgram(scriptCode), 'misub-operator.js');
        if (evaluation.error) {
            const guestError = vm.dump(evaluation.error);
            evaluation.error.dispose();
            const message = guestError?.message || String(guestError || 'Unknown sandbox error');
            throw new Error(`Sandbox script failed: ${message}`);
        }

        const outputJson = vm.getString(evaluation.value);
        evaluation.value.dispose();
        if (byteLength(outputJson) > limits.maxOutputBytes) {
            throw new RangeError(`Script output exceeds ${limits.maxOutputBytes} bytes`);
        }
        return validateNodes(JSON.parse(outputJson), nodes.length, limits);
    } finally {
        vm.dispose();
        runtime.dispose();
    }
}

export { DEFAULT_LIMITS as QUICKJS_SANDBOX_LIMITS };
