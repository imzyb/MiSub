import { afterEach, describe, expect, it, vi } from 'vitest';

describe('notification-service IP geolocation fallback', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    it('uses ip.cn location and supplements ASN from the next provider', async () => {
        const testIp = '111.247.40.93';
        const ipCnHtml = `
      <meta name="description" content="ip.cn提供IP地址免费在线查询，${testIp}归属地为：中国 台湾 中華電信，提供精准的IP地址归属地查询服务">
      <th><span>所在地理位置</span></th><td><span>中国 台湾</span></td>`;
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                new Response(ipCnHtml, { status: 200, headers: { 'Content-Type': 'text/html' } })
            )
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        success: true,
                        country: 'China',
                        city: 'Fallback City',
                        connection: { org: 'Fallback ISP', asn: 9808 },
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                )
            )
            .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);

        const { sendEnhancedTgNotification } =
            await import('../../functions/services/notification-service.js');
        const sent = await sendEnhancedTgNotification(
            { BotToken: 'bot-token', ChatID: 'chat-id' },
            '<b>订阅被访问</b>',
            testIp
        );

        expect(sent).toBe(true);
        expect(fetchMock.mock.calls[0][0]).toBe(`https://ip.cn/ip/${testIp}.html`);
        expect(fetchMock.mock.calls[0][1]).toMatchObject({
            redirect: 'manual',
            headers: expect.objectContaining({ Referer: 'https://ip.cn/' }),
        });
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            `https://ipwho.is/${testIp}`,
            expect.any(Object)
        );
        const telegramPayload = JSON.parse(fetchMock.mock.calls[2][1].body);
        expect(telegramPayload.text).toContain('中国');
        expect(telegramPayload.text).toContain('台湾');
        expect(telegramPayload.text).toContain('中華電信');
        expect(telegramPayload.text).toContain('AS9808');
        expect(telegramPayload.text).not.toContain('Fallback City');
        expect(telegramPayload.text).not.toContain('Fallback ISP');
    });

    it('keeps the table location clean when the description carrier is unknown', async () => {
        const testIp = '111.247.40.93';
        const ipCnHtml = `
      <meta name="description" content="ip.cn提供IP地址免费在线查询，${testIp}归属地为：中国 台湾 未知接入商，提供精准的IP地址归属地查询服务">
      <th><span>所在地理位置</span></th><td><span>中国 台湾</span></td>`;
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                new Response(ipCnHtml, { status: 200, headers: { 'Content-Type': 'text/html' } })
            )
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        success: true,
                        country: 'China',
                        city: 'Fallback City',
                        connection: { org: 'Fallback ISP', asn: 9808 },
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                )
            )
            .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);

        const { sendEnhancedTgNotification } =
            await import('../../functions/services/notification-service.js');
        expect(
            await sendEnhancedTgNotification(
                { BotToken: 'bot-token', ChatID: 'chat-id' },
                '<b>订阅被访问</b>',
                testIp
            )
        ).toBe(true);

        const telegramPayload = JSON.parse(fetchMock.mock.calls[2][1].body);
        expect(telegramPayload.text).toContain('中国');
        expect(telegramPayload.text).toContain('台湾');
        expect(telegramPayload.text).toContain('Fallback ISP');
        expect(telegramPayload.text).toContain('AS9808');
        expect(telegramPayload.text).not.toContain('未知接入商');
        expect(telegramPayload.text).not.toContain('Fallback City');
    });

    it('falls back to ipapi.co when ip.cn is blocked and ipwho.is fails', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                new Response('', { status: 302, headers: { Location: 'http://127.0.0.1/' } })
            )
            .mockResolvedValueOnce(new Response('', { status: 503 }))
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        country_name: 'China',
                        city: 'Shanghai',
                        org: 'Example ISP',
                        asn: 'AS64500',
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                )
            )
            .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);

        const { sendEnhancedTgNotification } =
            await import('../../functions/services/notification-service.js');
        const sent = await sendEnhancedTgNotification(
            { BotToken: 'bot-token', ChatID: 'chat-id' },
            '<b>订阅被访问</b>',
            '1.2.3.4',
            '<b>节点数:</b> <code>2</code>'
        );

        expect(sent).toBe(true);
        expect(fetchMock.mock.calls[0][0]).toBe('https://ip.cn/ip/1.2.3.4.html');
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            'https://ipwho.is/1.2.3.4',
            expect.any(Object)
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            3,
            'https://ipapi.co/1.2.3.4/json/',
            expect.any(Object)
        );
        const telegramPayload = JSON.parse(fetchMock.mock.calls[3][1].body);
        expect(telegramPayload.text).toContain('China');
        expect(telegramPayload.text).toContain('Shanghai');
        expect(telegramPayload.text).toContain('Example ISP');
        expect(telegramPayload.text).toContain('AS64500');
    });
});
