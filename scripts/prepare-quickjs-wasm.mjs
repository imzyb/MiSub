import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(
    projectRoot,
    'node_modules/@jitl/quickjs-wasmfile-release-sync/dist/emscripten-module.wasm'
);
const destination = resolve(
    projectRoot,
    'functions/vendor/quickjs-release-sync.wasm'
);

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
console.log('Prepared QuickJS Wasm for Cloudflare Pages Functions.');
