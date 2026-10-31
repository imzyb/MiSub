/**
 * 文件导入辅助：把用户上传的本地文件读取为文本，交给后端 /api/parse_subscription 解析。
 *
 * 覆盖常见节点/订阅文件形态：
 *  - 纯文本节点列表（每行一个 ss:// vmess:// vless:// trojan:// ...）
 *  - Base64 编码的订阅体（v2rayN / Shadowrocket 等导出的 .txt）
 *  - Clash / Mihomo YAML（proxies: 列表）
 *  - Surge / Loon / QuantumultX 配置片段
 *  - JSON（clash meta 配置、或 [ {..} ] 形式的节点数组）
 *
 * 这些格式后端 parseNodeList 已能识别，因此这里只负责「拿到正确文本」：
 * 必要的解包（base64 包裹、JSON 外壳）交给后端，避免前端重复实现解析器。
 */
import { t } from '../i18n/index.js';

/** 单个文件大小上限（字节）——后端 JSON body 限制为 2MB，留出余量。 */
export const MAX_IMPORT_FILE_SIZE = 1.5 * 1024 * 1024;

/** 允许的扩展名 / MIME 提示（仅用于 文件选择框 过滤，不做强校验）。 */
export const IMPORT_FILE_ACCEPT = [
    '.txt',
    '.yaml',
    '.yml',
    '.json',
    '.conf',
    '.config',
    '.ini',
    '.list',
    '.text',
].join(',');

/**
 * 把 File 读成文本。
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error(t('fileImport.readFailed')));
        reader.readAsText(file);
    });
}

/**
 * 校验文件大小，超限时抛出可展示的错误。
 * @param {File} file
 */
export function assertFileSize(file) {
    if (file && typeof file.size === 'number' && file.size > MAX_IMPORT_FILE_SIZE) {
        const mb = (MAX_IMPORT_FILE_SIZE / 1024 / 1024).toFixed(1);
        throw new Error(
            t('fileImport.tooLarge', {
                size: (file.size / 1024 / 1024).toFixed(1),
                limit: mb,
            })
        );
    }
}

/**
 * 把多个文件的内容合并成一个文本块（后端逐行解析，天然支持多文件追加）。
 * @param {File[]} files
 * @returns {Promise<{ text: string, fileCount: number, byteSize: number }>}
 */
export async function readFilesAsText(files) {
    const list = Array.from(files || []);
    const chunks = [];
    let byteSize = 0;

    for (const file of list) {
        assertFileSize(file);
        const text = await readFileAsText(file);
        byteSize += file.size || text.length;
        chunks.push(text.trim());
    }

    return {
        text: chunks.filter(Boolean).join('\n'),
        fileCount: list.length,
        byteSize,
    };
}
