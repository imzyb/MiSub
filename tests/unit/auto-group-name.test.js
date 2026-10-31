import { describe, it, expect } from 'vitest';
import {
    buildAutoGroupName,
    groupNameFromFile,
    groupNameFromTime,
} from '../../src/utils/auto-group-name.js';

/**
 * 自动分组命名测试。
 *
 * 需求：用户粘贴/上传一批节点后无需手填分组，系统自动给出可读、可区分批次的名字。
 */
describe('自动分组命名', () => {
    it('有文件名时用文件名（去掉扩展名）', () => {
        expect(groupNameFromFile('nodes.txt')).toBe('导入 nodes');
        expect(groupNameFromFile('我的节点.json')).toBe('导入 我的节点');
        expect(groupNameFromFile('sub.yaml')).toBe('导入 sub');
    });

    it('文件名缺失时回退到时间戳', () => {
        const now = new Date(2026, 8, 15, 18, 30); // 2026-09-15 18:30
        expect(groupNameFromTime(now)).toBe('导入 09-15 18:30');
    });

    it('buildAutoGroupName 优先文件名，其次时间', () => {
        const now = new Date(2026, 8, 15, 9, 5);
        expect(buildAutoGroupName({ fileName: 'clash.yaml', now })).toBe('导入 clash');
        expect(buildAutoGroupName({ fileName: '', now })).toBe('导入 09-15 09:05');
        expect(buildAutoGroupName({ now })).toBe('导入 09-15 09:05');
    });

    it('超长文件名被截断，避免污染分组名', () => {
        const long = 'a'.repeat(80) + '.txt';
        const name = groupNameFromFile(long);
        expect(name.length).toBeLessThanOrEqual(24 + '导入 '.length);
    });

    it('空输入安全返回', () => {
        expect(groupNameFromFile('')).toBe('');
        expect(groupNameFromFile(null)).toBe('');
        expect(buildAutoGroupName({ fileName: '' })).toMatch(/^导入 \d{2}-\d{2} \d{2}:\d{2}$/);
    });

    it('时间戳格式补零正确', () => {
        const now = new Date(2026, 0, 3, 7, 8); // 01-03 07:08
        expect(groupNameFromTime(now)).toBe('导入 01-03 07:08');
    });
});
