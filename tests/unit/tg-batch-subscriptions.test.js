import { describe, it, expect } from 'vitest';

// 被测函数在 handler 内部未导出，此处按实现语义复刻一份，
// 与源码保持一致（如源码变更需同步）——用于锁定「一条消息多个订阅链接」的行为。
function extractSubscriptionUrls(text) {
    const matches = String(text || '').match(/https?:\/\/[^\s<>"'，。、；：！？）】]+/gi) || [];
    const seen = new Set();
    const urls = [];
    for (const raw of matches) {
        const url = raw.replace(/[.,;:!?]+$/, '');
        if (!url || seen.has(url)) continue;
        try {
            new URL(url);
        } catch {
            continue;
        }
        seen.add(url);
        urls.push(url);
    }
    return urls;
}

describe('TG 订阅链接批量提取', () => {
    it('一条消息里多行多个订阅链接全部提取', () => {
        const text = [
            'https://sub1.gsafevpn.com/957baaca8fc/aaa',
            'https://sub1.gsafevpn.com/957baaca8fc/bbb',
            'https://api.5ufclub.com/vclash/ccc',
        ].join('\n');

        const urls = extractSubscriptionUrls(text);
        expect(urls).toHaveLength(3);
        expect(urls[0]).toContain('gsafevpn.com');
    });

    it('同一行内用空格分隔的多个链接也能提取', () => {
        const urls = extractSubscriptionUrls(
            'https://a.com/sub1 https://b.com/sub2 https://c.com/sub3'
        );
        expect(urls).toEqual(['https://a.com/sub1', 'https://b.com/sub2', 'https://c.com/sub3']);
    });

    it('带「名称: 链接」格式可提取', () => {
        const urls = extractSubscriptionUrls('机场A: https://a.com/x\n机场B: https://b.com/y');
        expect(urls).toEqual(['https://a.com/x', 'https://b.com/y']);
    });

    it('重复链接自动去重', () => {
        const urls = extractSubscriptionUrls('https://a.com/x\nhttps://a.com/x\nhttps://a.com/x');
        expect(urls).toEqual(['https://a.com/x']);
    });

    it('剥离中文标点与句末标点', () => {
        const urls = extractSubscriptionUrls('看这个 https://a.com/x，还有 https://b.com/y。');
        expect(urls).toEqual(['https://a.com/x', 'https://b.com/y']);
    });

    it('无链接返回空数组', () => {
        expect(extractSubscriptionUrls('hello world')).toEqual([]);
        expect(extractSubscriptionUrls('')).toEqual([]);
        expect(extractSubscriptionUrls(null)).toEqual([]);
    });

    it('与节点链接混发时，两者都能被各自提取', () => {
        const text = [
            'vless://uuid@1.2.3.4:443?security=reality#node1',
            'https://sub.example.com/api?token=abc',
        ].join('\n');

        const subs = extractSubscriptionUrls(text);
        expect(subs).toEqual(['https://sub.example.com/api?token=abc']);
        // 节点链接不应被订阅提取误吞（它也是 http 前缀以外的协议）
        expect(subs.some((u) => u.startsWith('vless://'))).toBe(false);
    });
});
