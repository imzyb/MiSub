
import { renderLoonFromTemplateModel } from '../functions/modules/subscription/template-renderers/render-loon.js';

const mockModel = {
    proxies: [
        {
            name: 'TUIC-Node',
            type: 'tuic',
            server: '1.2.3.4',
            port: 443,
            password: 'my-password',
            uuid: 'my-uuid-123',
            sni: 'example.com',
            alpn: ['h3'],
            'congestion-control': 'bbr'
        }
    ],
    groups: [],
    rules: []
};

const result = renderLoonFromTemplateModel(mockModel);
console.log('--- Loon TUIC Output ---');
console.log(result);

const expectedPattern = 'TUIC-Node = tuic, 1.2.3.4, 443, my-password, my-uuid-123, version=5, sni=example.com, alpn=h3, congestion-control=bbr, reduce-rtt=true';
if (result.includes(expectedPattern)) {
    console.log('\nSUCCESS: Loon TUIC syntax is correct!');
} else {
    console.error('\nFAILURE: Loon TUIC syntax is incorrect!');
    process.exit(1);
}
