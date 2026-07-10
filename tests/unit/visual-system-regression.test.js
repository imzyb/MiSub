import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import Button from '../../src/components/ui/Button.vue';
import Input from '../../src/components/ui/Input.vue';
import FormModal from '../../src/components/shared/FormModal.vue';

const readSource = async (path) => await import('node:fs/promises').then(({ readFile }) => readFile(path, 'utf8'));

describe('MiSub visual system regression', () => {
  it('keeps global UI tokens aligned with the clean dashboard design system', async () => {
    const css = await readSource('src/assets/main.css');

    expect(css).toContain('--bg-page-dark: #08090a');
    expect(css).toContain('--surface-panel-dark: #0f1011');
    expect(css).toContain('--surface-card-dark: rgba(255, 255, 255, 0.035)');
    expect(css).toContain('--text-primary-dark: #f7f8f8');
    expect(css).toContain('--text-secondary-dark: #d0d6e0');
    expect(css).toContain('--text-muted-dark: #8a8f98');
    expect(css).toContain('--border-subtle-dark: rgba(255, 255, 255, 0.08)');
    expect(css).toContain('--focus-ring: 0 0 0 3px rgba(113, 112, 255, 0.28)');
    expect(css).toContain('--misub-radius-sm: 0.375rem');
    expect(css).toContain('--misub-radius-md: 0.5rem');
    expect(css).toContain('--misub-radius-lg: 0.75rem');
    expect(css).toContain('font-family: var(--font-body)');
    expect(css).toContain('font-feature-settings: "cv01", "ss03"');
    expect(css).not.toContain('COSMIC GLASS DESIGN SYSTEM');
    expect(css).not.toContain('Premium, Deep, and Fluid');
  });

  it('uses subdued, consistent button variant classes', () => {
    const primary = mount(Button, { slots: { default: '保存' } });
    expect(primary.classes().join(' ')).toContain('rounded-[var(--misub-radius-md)]');
    expect(primary.classes().join(' ')).toContain('duration-150');

    const primaryButton = primary.find('button');
    expect(primaryButton.classes().join(' ')).toContain('bg-primary-600');
    expect(primaryButton.classes().join(' ')).not.toContain('bg-gradient-to-r');
    expect(primaryButton.classes().join(' ')).not.toContain('shadow-primary-500/20');

    const secondary = mount(Button, { props: { variant: 'secondary' }, slots: { default: '取消' } });
    expect(secondary.find('button').classes().join(' ')).toContain('border-white/10');
    expect(secondary.find('button').classes().join(' ')).toContain('dark:bg-white/[0.04]');
  });

  it('uses the shared surface and focus treatment for inputs and modals', () => {
    const input = mount(Input, { props: { label: '名称', modelValue: '', placeholder: '输入名称' } });
    const inputClasses = input.find('input').classes().join(' ');
    expect(inputClasses).toContain('dark:bg-white/[0.035]');
    expect(inputClasses).toContain('dark:border-white/10');
    expect(inputClasses).toContain('focus:ring-primary-500/30');

    const modal = mount(FormModal, {
      props: { show: true, title: '编辑订阅' },
      attachTo: document.body,
      slots: { default: '<div>content</div>' }
    });
    const html = document.body.innerHTML;
    expect(html).toContain('dark:bg-[#0f1011]');
    expect(html).toContain('dark:border-white/10');
    expect(html).toContain('backdrop-blur-sm');
    modal.unmount();
  });
});
