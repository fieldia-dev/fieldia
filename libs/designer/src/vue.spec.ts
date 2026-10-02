import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { blankPage, createDesigner } from './lib/designer';
import { fakeGrafloria } from './lib/test-screen';
import { ScreenEditor, SurveyEditor } from './vue';

describe('the editors in Vue', () => {
  it('mounts the survey editor, says when it is ready, and takes it down when it goes', async () => {
    const designer = createDesigner({ page: blankPage('survey', 'Event feedback') });
    const wrapper = mount(SurveyEditor, { props: { designer, preview: false }, attachTo: document.body });
    expect(wrapper.find('.fd-designer').exists()).toBe(true);
    expect(wrapper.emitted('ready')).toHaveLength(1);
    designer.addQuestion('short-answer');
    await nextTick();
    expect(wrapper.findAll('.fd-q')).toHaveLength(1);
    wrapper.unmount();
    expect(document.querySelector('.fd-designer')).toBeNull();
  });

  it('mounts the screen editor, and again for another designer', async () => {
    const grafloria = fakeGrafloria();
    const first = createDesigner({ page: blankPage('screen', 'Visit') });
    const wrapper = mount(ScreenEditor, { props: { designer: first, grafloria: grafloria.kit }, attachTo: document.body });
    expect(wrapper.find('.fd-screen-designer').exists()).toBe(true);
    await wrapper.setProps({ designer: createDesigner({ page: blankPage('screen', 'Other') }) });
    expect(wrapper.findAll('.fd-screen-designer')).toHaveLength(1);
    expect(wrapper.emitted('ready')).toHaveLength(2);
    wrapper.unmount();
  });
});
