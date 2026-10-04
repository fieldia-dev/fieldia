import { blankPage, createDesigner } from './designer';
import { designerIcon } from './icons';
import { mountSurveyEditor } from './survey-editor';
import { mount } from './test-editor';

/**
 * The Rules view's own icon: a branching mark, not the "shows sometimes"
 * eye-slash a field's rule wears. The same in the bar and in Find anything,
 * in both editors.
 */

const drawing = (name: string) => designerIcon(document, name).innerHTML;

describe('the Rules view’s icon', () => {
  afterEach(() => document.body.replaceChildren());

  it('is a drawing of its own', () => {
    expect(drawing('rules')).not.toBe(drawing('when'));
    expect(drawing('rules')).not.toBe(drawing('short-answer'));
  });

  it('is on the Rules button in the bar, and on Rules in Find anything', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit') });
    designer.addQuestion('short-answer', { parent: 'section-1' });
    const { host } = mount(designer, { mode: 'advanced' });
    const toggle = host.querySelector('.fd-mode-button[data-mode="rules"]') as HTMLButtonElement;
    expect(toggle.querySelector('svg')?.innerHTML).toBe(drawing('rules'));
    (host.querySelector('.fd-find-button') as HTMLButtonElement).click();
    const option = [...document.querySelectorAll('.fd-find-option')].find((o) => o.querySelector('.fd-find-label')?.textContent === 'Rules') as HTMLElement;
    expect(option.querySelector('svg')?.innerHTML).toBe(drawing('rules'));
    // Only what has an icon of its own draws one; the rest keep its room, so the words line up.
    const other = [...document.querySelectorAll('.fd-find-option')].find((o) => o !== option) as HTMLElement;
    expect(other.querySelector('svg')).toBeNull();
    expect(other.firstElementChild?.className).toBe('fd-find-icon-room');
  });

  it('is the survey editor’s too', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const designer = createDesigner({ page: blankPage('survey', 'Event') });
    const handle = mountSurveyEditor(host, { designer });
    expect(host.querySelector('.fd-mode-button[data-mode="rules"] svg')?.innerHTML).toBe(drawing('rules'));
    handle.destroy();
  });
});
