import { describe, it, expect } from 'vitest';

/**
 * 按延迟排序的核心规则（与 useManualNodes.sortNodesByLatency 保持一致）：
 *  - status === 'ok' 且 latency 有限 → 按延迟升序
 *  - 未测出 / 失败 / 超时 → 排在最后
 *  - 延迟相同按名称稳定排序
 */
function sortByLatency(nodes, results) {
    const latencyOf = (node) => {
        const r = results[node.id];
        return r && r.status === 'ok' && Number.isFinite(r.latency) ? r.latency : Infinity;
    };
    return [...nodes].sort((a, b) => {
        const la = latencyOf(a);
        const lb = latencyOf(b);
        if (la !== lb) return la - lb;
        return (a.name || '').localeCompare(b.name || '', 'zh-CN');
    });
}

const N = (id, name) => ({ id, name });

describe('latency sorting', () => {
    it('orders nodes from lowest to highest latency', () => {
        const nodes = [N('a', 'A'), N('b', 'B'), N('c', 'C')];
        const results = {
            a: { status: 'ok', latency: 300 },
            b: { status: 'ok', latency: 50 },
            c: { status: 'ok', latency: 120 },
        };
        expect(sortByLatency(nodes, results).map((n) => n.id)).toEqual(['b', 'c', 'a']);
    });

    it('pushes failed / timeout / untested nodes to the end', () => {
        const nodes = [N('a', 'A'), N('b', 'B'), N('c', 'C'), N('d', 'D')];
        const results = {
            a: { status: 'error', latency: -1 },
            b: { status: 'ok', latency: 80 },
            c: { status: 'timeout', latency: 3000 },
            // d 未测试
        };
        expect(sortByLatency(nodes, results).map((n) => n.id)[0]).toBe('b');
        const tail = sortByLatency(nodes, results)
            .map((n) => n.id)
            .slice(1);
        expect(tail.sort()).toEqual(['a', 'c', 'd']);
    });

    it('falls back to name ordering when latency ties', () => {
        const nodes = [N('x', 'Zulu'), N('y', 'Alpha')];
        const results = {
            x: { status: 'ok', latency: 100 },
            y: { status: 'ok', latency: 100 },
        };
        expect(sortByLatency(nodes, results).map((n) => n.name)).toEqual(['Alpha', 'Zulu']);
    });

    it('does not mutate the input array', () => {
        const nodes = [N('a', 'A'), N('b', 'B')];
        const results = { a: { status: 'ok', latency: 200 }, b: { status: 'ok', latency: 10 } };
        const snapshot = nodes.map((n) => n.id);
        sortByLatency(nodes, results);
        expect(nodes.map((n) => n.id)).toEqual(snapshot);
    });
});
