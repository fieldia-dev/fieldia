import { blankPage, createDesigner } from './designer';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';

/** The survey designer's Look: a button in the bar opens the page's look in a sheet at the side, and the cards wear it as it is set. */

let handle: SurveyEditorHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

function survey() {
  const designer = createDesigner({ page: blankPage('survey', 'Event feedback') });
  designer.addQuestion('short-answer');
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountSurveyEditor(host, { designer });
  const opener = host.querySelector('.fd-designer-bar button[aria-label="Look"]') as HTMLButtonElement;
  const sheet = () => host.querySelector('[role="dialog"][aria-label="Look"]') as HTMLElement | null;
  const press = (name: string, words: string) => [...(sheet()?.querySelectorAll<HTMLButtonElement>(`[role="group"][aria-label="${name}"] button`) ?? [])].find((b) => b.textContent === words)?.click();
  const cards = host.querySelector('.fd-survey-canvas') as HTMLElement;
  return { designer, host, opener, sheet, press, cards };
}

describe('the survey designer’s Look', () => {
  it('opens from the bar, beside the Checks, with the page’s look in it', () => {
    const { host, opener, sheet } = survey();
    expect(opener).not.toBeNull();
    expect(opener.nextElementSibling?.hasAttribute('data-checks')).toBe(true);
    expect(opener.getAttribute('aria-expanded')).toBe('false');
    expect(sheet()).toBeNull();
    opener.click();
    expect(opener.getAttribute('aria-expanded')).toBe('true');
    expect(sheet()).not.toBeNull();
    expect([...(sheet() as HTMLElement).querySelectorAll('[data-setting]')].filter((r) => !(r as HTMLElement).hidden).map((r) => r.getAttribute('data-setting'))).toEqual(['Look presets', 'Accent colour', 'Font', 'Spacing', 'Corners', 'Labels', 'Help', 'Colours', 'Each kind of part']);
    expect(host.querySelector('.fd-designer-bar')?.contains(sheet())).toBe(false);
  });

  it('shows each setting on the cards as it is set, and follows undo', () => {
    const { designer, opener, press, cards, sheet } = survey();
    opener.click();
    press('Font', 'Serif');
    press('Corners', 'Round');
    expect(designer.getPage().look).toEqual({ font: 'serif', corners: 'round' });
    expect(cards.classList.contains('fd-form')).toBe(true);
    expect([cards.getAttribute('data-font'), cards.getAttribute('data-corners')]).toEqual(['serif', 'round']);
    designer.undo();
    expect(cards.hasAttribute('data-corners')).toBe(false);
    expect([...(sheet() as HTMLElement).querySelectorAll('[role="group"][aria-label="Corners"] [aria-pressed="true"]')]).toHaveLength(0);
  });

  it('closes with Escape or its close button, the cursor back on Look', () => {
    const { opener, sheet } = survey();
    opener.click();
    const inside = sheet()?.querySelector('[data-choice="serif"]') as HTMLButtonElement;
    inside.focus();
    inside.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(sheet()).toBeNull();
    expect(document.activeElement).toBe(opener);
    opener.click();
    (sheet()?.querySelector('button[aria-label="Close"]') as HTMLButtonElement).click();
    expect(sheet()).toBeNull();
    expect(opener.getAttribute('aria-expanded')).toBe('false');
    opener.click();
    opener.click();
    expect(sheet()).toBeNull();
  });
});
