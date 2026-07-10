import { describe, it, expect } from 'vitest';
import { validateProfile } from '../../src/utils/validation-utils.js';

describe('Issue #380: SubConverter 配置文件自定义无法使用', () => {
  it('应该允许 custom: 前缀的模板名称（不验证为 URL）', () => {
    const profile = {
      name: 'Test Profile',
      customId: 'test',
      transformConfigMode: 'custom_template',
      transformConfig: 'custom:我的自定义规则'
    };

    const result = validateProfile(profile);

    expect(result.isValid).toBe(true);
    expect(result.errors.transformConfig).toBeUndefined();
  });

  it('应该允许 builtin: 前缀的预设模板名称', () => {
    const profile = {
      name: 'Test Profile',
      customId: 'test',
      transformConfigMode: 'preset',
      transformConfig: 'builtin:ACL4SSR_Online_Full'
    };

    const result = validateProfile(profile);

    expect(result.isValid).toBe(true);
    expect(result.errors.transformConfig).toBeUndefined();
  });

  it('custom 模式下应该要求有效的 URL', () => {
    const profile = {
      name: 'Test Profile',
      customId: 'test',
      transformConfigMode: 'custom',
      transformConfig: 'not-a-url'
    };

    const result = validateProfile(profile);

    expect(result.isValid).toBe(false);
    expect(result.errors.transformConfig).toBeDefined();
    expect(result.errors.transformConfig[0]).toContain('URL');
  });

  it('custom 模式下应该接受有效的 URL', () => {
    const profile = {
      name: 'Test Profile',
      customId: 'test',
      transformConfigMode: 'custom',
      transformConfig: 'https://example.com/config.ini'
    };

    const result = validateProfile(profile);

    expect(result.isValid).toBe(true);
    expect(result.errors.transformConfig).toBeUndefined();
  });

  it('应该拒绝 custom: 后面为空的模板名称', () => {
    const profile = {
      name: 'Test Profile',
      customId: 'test',
      transformConfigMode: 'custom_template',
      transformConfig: 'custom:'
    };

    const result = validateProfile(profile);

    expect(result.isValid).toBe(false);
    expect(result.errors.transformConfig).toBeDefined();
    expect(result.errors.transformConfig[0]).toContain('模板名称不能为空');
  });

  it('应该拒绝 custom: 后面只有空格的模板名称', () => {
    const profile = {
      name: 'Test Profile',
      customId: 'test',
      transformConfigMode: 'custom_template',
      transformConfig: 'custom:   '
    };

    const result = validateProfile(profile);

    expect(result.isValid).toBe(false);
    expect(result.errors.transformConfig).toBeDefined();
    expect(result.errors.transformConfig[0]).toContain('模板名称不能为空');
  });

  it('应该拒绝 builtin: 后面为空的模板名称', () => {
    const profile = {
      name: 'Test Profile',
      customId: 'test',
      transformConfigMode: 'preset',
      transformConfig: 'builtin:'
    };

    const result = validateProfile(profile);

    expect(result.isValid).toBe(false);
    expect(result.errors.transformConfig).toBeDefined();
    expect(result.errors.transformConfig[0]).toContain('模板名称不能为空');
  });
});
