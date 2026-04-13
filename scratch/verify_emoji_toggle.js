
import { applyNodeTransformPipeline } from '../functions/utils/node-transformer.js';

const nodeUrls = [
    'ss://YWVzLTEyOC1nY206cGFzczEyMw@1.1.1.1:8888#HK-Node',
    'ss://YWVzLTEyOC1nY206cGFzczEyMw@2.2.2.2:8888#US-Server',
    'ss://YWVzLTEyOC1nY206cGFzczE0NQ@3.3.3.3:8888#Cloudflare-Anycast'
];

const transformConfig = {
    enabled: true,
    rename: {
        template: {
            enabled: true,
            template: '{emoji}{name}'
        }
    }
};

console.log('--- Case 1: Flag Emoji ENABLED ---');
const result1 = applyNodeTransformPipeline(nodeUrls, { ...transformConfig, enableEmoji: true });
result1.forEach(url => console.log(decodeURIComponent(url.split('#')[1])));

console.log('\n--- Case 2: Flag Emoji DISABLED ---');
const result2 = applyNodeTransformPipeline(nodeUrls, { ...transformConfig, enableEmoji: false });
result2.forEach(url => console.log(decodeURIComponent(url.split('#')[1])));

console.log('\n--- Case 3: Mixed (Loon-style manual check) ---');
// In profile-handler, we pass: settings.enableFlagEmoji !== false && templateEnabled
const result3 = applyNodeTransformPipeline(nodeUrls, { 
    ...transformConfig, 
    enableEmoji: true // settings.enableFlagEmoji = true
});
result3.forEach(url => console.log(decodeURIComponent(url.split('#')[1])));
