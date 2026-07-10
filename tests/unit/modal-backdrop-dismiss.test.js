import { nextTick } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import FormModal from '../../src/components/shared/FormModal.vue';
import Modal from '../../src/components/forms/Modal.vue';
import QRCodeOverlay from '../../src/components/public/QRCodeOverlay.vue';
import { useBackdropDismiss } from '../../src/composables/useBackdropDismiss.js';

const dispatchBubbled = async (element, type) => {
  element.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
  await nextTick();
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('modal backdrop dismiss behavior', () => {
  it('only dismisses after pointerdown starts on the backdrop', () => {
    const dismiss = vi.fn();
    const backdrop = document.createElement('div');
    const panel = document.createElement('div');
    backdrop.append(panel);

    const { handleBackdropPointerDown, handleBackdropClick } = useBackdropDismiss(dismiss);

    handleBackdropPointerDown({ target: panel, currentTarget: backdrop });
    handleBackdropClick({ target: backdrop, currentTarget: backdrop });
    expect(dismiss).not.toHaveBeenCalled();

    handleBackdropPointerDown({ target: backdrop, currentTarget: backdrop });
    handleBackdropClick({ target: backdrop, currentTarget: backdrop });
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('keeps the shared form modal open when dragging from inside to the backdrop', async () => {
    const wrapper = mount(FormModal, {
      props: { show: true, title: 'Edit' },
      attachTo: document.body,
      slots: { default: '<input data-testid="field" />' }
    });

    await nextTick();
    const backdrop = document.body.querySelector('.flex.min-h-full');
    const input = document.body.querySelector('[data-testid="field"]');

    await dispatchBubbled(input, 'pointerdown');
    await dispatchBubbled(backdrop, 'click');
    expect(wrapper.emitted('update:show')).toBeUndefined();

    await dispatchBubbled(backdrop, 'pointerdown');
    await dispatchBubbled(backdrop, 'click');
    expect(wrapper.emitted('update:show')).toEqual([[false]]);

    wrapper.unmount();
  });

  it('keeps the generic modal open when dragging from inside to the backdrop', async () => {
    const wrapper = mount(Modal, {
      props: { show: true },
      attachTo: document.body,
      slots: { body: '<input data-testid="field" />' }
    });

    await nextTick();
    const backdrop = document.body.querySelector('[role="dialog"]');
    const input = document.body.querySelector('[data-testid="field"]');

    await dispatchBubbled(input, 'pointerdown');
    await dispatchBubbled(backdrop, 'click');
    expect(wrapper.emitted('update:show')).toBeUndefined();

    await dispatchBubbled(backdrop, 'pointerdown');
    await dispatchBubbled(backdrop, 'click');
    expect(wrapper.emitted('update:show')).toEqual([[false]]);

    wrapper.unmount();
  });

  it('keeps the QR overlay open when dragging from inside to the backdrop', async () => {
    const wrapper = mount(QRCodeOverlay, {
      props: {
        isExpanded: true,
        profile: { id: 'profile-1', name: 'Demo' }
      },
      attachTo: document.body
    });

    await nextTick();
    const backdrop = document.body.querySelector('.fixed.inset-0');
    const panel = backdrop.querySelector('.relative');

    await dispatchBubbled(panel, 'pointerdown');
    await dispatchBubbled(backdrop, 'click');
    expect(wrapper.emitted('close')).toBeUndefined();

    await dispatchBubbled(backdrop, 'pointerdown');
    await dispatchBubbled(backdrop, 'click');
    expect(wrapper.emitted('close')).toHaveLength(1);

    wrapper.unmount();
  });
});
