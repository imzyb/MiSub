import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// 回归背景：main-handler 曾调用 maybeContinueBackfill 却没有从
// node-persistence-service 导入，开启 D1 节点持久化后订阅输出直接 500：
// {"error":"Internal Server Error","message":"maybeContinueBackfill is not defined"}。
// 这里做静态完整性检查：凡是引用了该服务导出的模块，都必须把用到的导出真正导入。

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const functionsDir = resolve(rootDir, 'functions');
const persistencePath = resolve(functionsDir, 'services/node-persistence-service.js');

function stripComments(source) {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function listJsFiles(dir, collected = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) listJsFiles(fullPath, collected);
        else if (entry.name.endsWith('.js')) collected.push(fullPath);
    }
    return collected;
}

function relativePath(file) {
    return file.slice(rootDir.length + 1).replace(/\\/g, '/');
}

const persistenceExports = [
    ...stripComments(readFileSync(persistencePath, 'utf8')).matchAll(
        /^export\s+(?:async\s+)?function\s+(\w+)/gm
    ),
].map((match) => match[1]);

describe('node-persistence-service 导入完整性', () => {
    it('引用了该服务导出的模块必须全部导入', () => {
        expect(persistenceExports.length).toBeGreaterThan(0);

        const problems = [];
        for (const file of listJsFiles(functionsDir)) {
            if (file === persistencePath) continue;
            const source = stripComments(readFileSync(file, 'utf8'));
            const imports = [
                ...source.matchAll(
                    /import\s*\{([^}]*)\}\s*from\s*['"][^'"]*node-persistence-service\.js['"]/g
                ),
            ];
            if (imports.length === 0) continue;

            const importedNames = imports
                .flatMap((match) => match[1].split(','))
                .map((name) =>
                    name
                        .trim()
                        .split(/\s+as\s+/)[0]
                        .trim()
                )
                .filter(Boolean);

            for (const name of persistenceExports) {
                const used = new RegExp(`\\b${name}\\s*\\(`).test(source);
                if (used && !importedNames.includes(name)) {
                    problems.push(`${relativePath(file)} 调用了 ${name} 但没有导入`);
                }
            }
        }

        expect(problems).toEqual([]);
    });
});
