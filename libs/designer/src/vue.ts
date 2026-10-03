import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue';
import type { Skin } from '@fieldia/viewer';
import type { Designer } from './lib/designer';
import { mountScreenEditor, type ScreenEditorHandle } from './lib/screen-editor';
import { mountSurveyEditor, type SurveyEditorHandle } from './lib/survey-editor';

/**
 * The designer's editors as Vue components: `@fieldia/designer/vue`. Each
 * mounts the plain-DOM editor into its own element and takes it down when it
 * goes; a new designer, skin or kit mounts it again. `ready` hands out the
 * handle.
 */

export const SurveyEditor = defineComponent({
  name: 'FieldiaSurveyEditor',
  props: {
    designer: { type: Object as PropType<Designer>, required: true },
    skin: { type: String as PropType<Skin>, default: undefined },
    /** The preview beside the editor. */
    preview: { type: Boolean, default: true },
  },
  emits: { ready: (_handle: SurveyEditorHandle) => true },
  setup(props, { emit, expose }) {
    const host = ref<HTMLElement>();
    let handle: SurveyEditorHandle | null = null;
    const mount = () => {
      handle?.destroy();
      handle = mountSurveyEditor(host.value as HTMLElement, { designer: props.designer, skin: props.skin, preview: props.preview });
      emit('ready', handle);
    };
    onMounted(mount);
    watch(() => [props.designer, props.skin, props.preview], mount);
    onBeforeUnmount(() => handle?.destroy());
    expose({ handle: () => handle });
    return () => h('div', { ref: host });
  },
});

export const ScreenEditor = defineComponent({
  name: 'FieldiaScreenEditor',
  props: {
    designer: { type: Object as PropType<Designer>, required: true },
    skin: { type: String as PropType<Skin>, default: undefined },
  },
  emits: { ready: (_handle: ScreenEditorHandle) => true },
  setup(props, { emit, expose }) {
    const host = ref<HTMLElement>();
    let handle: ScreenEditorHandle | null = null;
    const mount = () => {
      handle?.destroy();
      handle = mountScreenEditor(host.value as HTMLElement, { designer: props.designer, skin: props.skin });
      emit('ready', handle);
    };
    onMounted(mount);
    watch(() => [props.designer, props.skin], mount);
    onBeforeUnmount(() => handle?.destroy());
    expose({ handle: () => handle });
    return () => h('div', { ref: host });
  },
});
