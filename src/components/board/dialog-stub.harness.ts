import { defineComponent, h } from 'vue';

export const DialogStub = defineComponent({
  props: {
    open: { type: Boolean, default: false },
    title: { type: String, default: '' },
  },
  emits: ['close'],
  setup(props, { slots }) {
    return () => (props.open ? h('div', { class: 'dialog-stub', 'data-title': props.title }, slots.default?.()) : null);
  },
});
