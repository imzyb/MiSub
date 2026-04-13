
import { urlsToClashProxies } from '../functions/utils/url-to-clash.js';
import { renderLoonFromTemplateModel } from '../functions/modules/subscription/template-renderers/render-loon.js';

const testUrl = 'tuic://uuid-123:pass-456@server.com:443?sni=sni.com&congestion_control=bbr&udp_relay_mode=native&reduce_rtt=1&fast_open=1#LoonTest';

console.log('--- Testing TUIC v5 Conversion for Loon ---');
console.log('Input URL:', testUrl);

const proxies = urlsToClashProxies([testUrl]);
console.log('Intermediate Proxy Object:', JSON.stringify(proxies[0], null, 2));

const model = {
    proxies: proxies,
    groups: [],
    rules: []
};

const loonConfig = renderLoonFromTemplateModel(model);
console.log('\n--- Generated Loon Config ---');
console.log(loonConfig);
