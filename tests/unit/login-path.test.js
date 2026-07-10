import { describe, expect, it } from 'vitest';
import { isValidCustomLoginPath } from '../../src/utils/login-path.js';

describe('isValidCustomLoginPath', () => {
  it('treats login as the default path instead of a custom-only route', () => {
    expect(isValidCustomLoginPath('login')).toBe(false);
    expect(isValidCustomLoginPath('/login')).toBe(false);
    expect(isValidCustomLoginPath(' /login ')).toBe(false);
  });

  it('rejects empty and slash-only values', () => {
    expect(isValidCustomLoginPath('')).toBe(false);
    expect(isValidCustomLoginPath('/')).toBe(false);
    expect(isValidCustomLoginPath('   ')).toBe(false);
  });

  it('accepts non-login custom paths', () => {
    expect(isValidCustomLoginPath('admin-login')).toBe(true);
    expect(isValidCustomLoginPath('/admin-login')).toBe(true);
  });
});
