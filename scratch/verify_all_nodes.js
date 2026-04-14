import { generateBuiltinClashConfig } from '../functions/modules/subscription/builtin-clash-generator.js';
import { generateBuiltinSingboxConfig } from '../functions/modules/subscription/builtin-singbox-generator.js';
import { generateBuiltinLoonConfig } from '../functions/modules/subscription/builtin-loon-generator.js';
import { generateBuiltinSurgeConfig } from '../functions/modules/subscription/builtin-surge-generator.js';
import { generateBuiltinQuanxConfig } from '../functions/modules/subscription/builtin-quanx-generator.js';

const testNodes = `
vless://67d08f0c-d864-4c58-8491-ffa03097c60b@cf.tencentapp.cn:443?encryption=none&security=tls&sni=uk.xxxxxxxxxxxx.xx.kg&fp=firefox&insecure=1&allowInsecure=1&type=xhttp&host=uk.xxxxxxxxxxxx.xx.kg&path=%2Fargo&mode=auto#UK-Argo-XHTTP
vless://67d08f0c-d864-4c58-8491-ffa03097c60b@185.184.70.120:9527?encryption=none&security=reality&sni=addons.mozilla.org&fp=chrome&pbk=fu0zZs03o3f_5PMD_Lx6mQ_R5VqcsUb46Yb28gN6QAI&sid=3fe385dc545cc018&type=xhttp&path=%2F&mode=auto#UK-Reality-XHTTP
`;

function extractProxies(client, configStr) {
    if (!configStr) return "Failed to generate config.";
    
    if (client === 'Clash') {
        const match = configStr.match(/proxies:[\s\S]*?(?=proxy-groups:)/i);
        return match ? match[0].trim() : "No proxies section found.";
    }
    
    if (client === 'Sing-box') {
        try {
            const json = JSON.parse(configStr);
            const outbounds = json.outbounds.filter(o => !['selector', 'urltest', 'direct', 'block', 'dns-out'].includes(o.type));
            return JSON.stringify(outbounds, null, 2);
        } catch (e) {
            return "Failed to parse JSON: " + e.message;
        }
    }
    
    if (client === 'Loon' || client === 'Surge') {
        const match = configStr.match(/\[Proxy\]([\s\S]*?)(?=\n\n\[|$)/i);
        return match ? match[0].trim() : "No proxy section found.";
    }
    
    if (client === 'Quantumult X') {
        const match = configStr.match(/\[server_local\]([\s\S]*?)(?=\n\n\[|$)/i);
        return match ? match[0].trim() : "No server_local section found.";
    }
    
    return configStr;
}

const clients = [
    { name: 'Clash (Mihomo)', generate: generateBuiltinClashConfig },
    { name: 'Sing-box', generate: generateBuiltinSingboxConfig },
    { name: 'Loon', generate: generateBuiltinLoonConfig },
    { name: 'Surge', generate: generateBuiltinSurgeConfig },
    { name: 'Quantumult X', generate: generateBuiltinQuanxConfig }
];

console.log("==================================================");
console.log("VLESS XHTTP / Reality 节点解析结果综合审查");
console.log("==================================================\n");

for (const client of clients) {
    console.log(`\n### 🟢 ${client.name}`);
    try {
        const configStr = client.generate(testNodes);
        console.log(extractProxies(client.name, configStr));
    } catch (e) {
        console.error(`Error generating for ${client.name}:`, e);
    }
    console.log("\n--------------------------------------------------");
}
