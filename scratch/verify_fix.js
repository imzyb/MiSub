import { generateBuiltinQuanxConfig } from '../functions/modules/subscription/builtin-quanx-generator.js';
import { generateBuiltinSurgeConfig } from '../functions/modules/subscription/builtin-surge-generator.js';
import { generateBuiltinLoonConfig } from '../functions/modules/subscription/builtin-loon-generator.js';

const testNodes = `
vless://67d08f0c-d864-4c58-8491-ffa03097c60b@cf.tencentapp.cn:443?encryption=none&security=tls&sni=uk.xxxxxxxxxxxx.xx.kg&fp=firefox&insecure=1&allowInsecure=1&type=xhttp&host=uk.xxxxxxxxxxxx.xx.kg&path=%2Fargo&mode=auto#UK-Argo-XHTTP
vless://67d08f0c-d864-4c58-8491-ffa03097c60b@185.184.70.120:9527?encryption=none&security=reality&sni=addons.mozilla.org&fp=chrome&pbk=fu0zZs03o3f_5PMD_Lx6mQ_R5VqcsUb46Yb28gN6QAI&sid=3fe385dc545cc018&type=xhttp&path=%2F&mode=auto#UK-Reality-XHTTP
`;

console.log('--- Quantumult X Output ---');
console.log(generateBuiltinQuanxConfig(testNodes));

console.log('\n--- Surge Output ---');
console.log(generateBuiltinSurgeConfig(testNodes));

console.log('\n--- Loon Output ---');
console.log(generateBuiltinLoonConfig(testNodes));
