import { act, render } from '@testing-library/react';
import { createElement, createRef } from 'react';
import { blankPage, createDesigner } from './lib/designer';
import type { SurveyEditorHandle } from './lib/survey-editor';
import { fakeGrafloria } from './lib/test-screen';
import { ScreenEditor, SurveyEditor } from './react';

describe('the editors in React', () => {
  it('mounts the survey editor, hands out its handle, and takes it down when it goes', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Event feedback') });
    const ref = createRef<SurveyEditorHandle>();
    const { container, unmount } = render(createElement(SurveyEditor, { designer, ref, preview: false }));
    expect(container.querySelector('.fd-designer')).not.toBeNull();
    expect(ref.current?.element.classList.contains('fd-designer')).toBe(true);
    // An edit made through the model shows in the editor.
    act(() => void designer.addQuestion('short-answer'));
    expect(container.querySelectorAll('.fd-q')).toHaveLength(1);
    unmount();
    expect(container.querySelector('.fd-designer')).toBeNull();
  });

  it('mounts the screen editor with the Grafloria kit it is given, and again for another designer', () => {
    const grafloria = fakeGrafloria();
    const first = createDesigner({ page: blankPage('screen', 'Visit') });
    first.addQuestion('short-answer');
    const { container, rerender } = render(createElement(ScreenEditor, { designer: first, grafloria: grafloria.kit }));
    expect(container.querySelector('.fd-screen-designer')).not.toBeNull();
    expect(grafloria.live()).toHaveLength(1);
    const second = createDesigner({ page: blankPage('screen', 'Other') });
    rerender(createElement(ScreenEditor, { designer: second, grafloria: grafloria.kit }));
    expect(container.querySelectorAll('.fd-screen-designer')).toHaveLength(1);
    expect((container.querySelector('input[aria-label="Screen title"]') as HTMLInputElement).value).toBe('Other');
  });
});
