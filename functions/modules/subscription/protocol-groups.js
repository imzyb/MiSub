export const PROTOCOL_GROUP_PATTERNS = [
    { name: 'VLESS 节点', pattern: /\bvless\b/i },
    { name: 'Trojan 节点', pattern: /\btrojan\b/i },
    { name: 'VMess 节点', pattern: /\bvmess\b/i },
    { name: 'Hysteria2 节点', pattern: /\b(?:hysteria2|hy2)\b/i },
    { name: 'Shadowsocks 节点', pattern: /\b(?:ss|shadowsocks)\b/i },
    { name: 'TUIC 节点', pattern: /\btuic\b/i },
    { name: 'AnyTLS 节点', pattern: /\banytls\b/i }
];

export function groupNodeLinesByProtocol(nodeLines = []) {
    const grouped = [];
    for (const { name, pattern } of PROTOCOL_GROUP_PATTERNS) {
        const matched = nodeLines.filter(({ line }) => pattern.test(line));
        if (matched.length > 0) {
            grouped.push({
                name,
                lines: matched.map(item => item.line),
                count: matched.length
            });
        }
    }
    return grouped;
}
