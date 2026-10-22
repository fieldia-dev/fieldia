import { blankPage, createDesigner } from './designer';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';
import { mountScreenEditor, type ScreenEditorHandle } from './screen-editor';

/**
 * A phone's bar: one row — the title, Publish and More — the rest under More. Which parts show is the stylesheet's
 * (by the bar's width, in the browser: e2e/designer-phone.spec.ts); what More does is here.
 */
let handle: SurveyEditorHandle | ScreenEditorHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

function mount(screen = false) {
  const host = document.createElement('div');
  document.body.append(host);
  const designer = createDesigner({ page: screen ? blankPage('screen', 'Site visit') : blankPage('survey', 'Event feedback') });
  handle = screen ? mountScreenEditor(host, { designer }) : mountSurveyEditor(host, { designer });
  const bar = host.querySelector('.fd-designer-bar') as HTMLElement;
  const more = bar.querySelector('.fd-bar-more') as HTMLButtonElement;
  const rest = bar.querySelector('.fd-bar-rest') as HTMLElement;
  return { host, bar, more, rest };
}
const key = (target: Element, name: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));

describe('the bar’s More', () => {
  it('holds every part of the bar but the title and Publish, and says what it holds and whether it is open', () => {
    const { bar, more, rest } = mount(true);
    expect([...bar.children].map((part) => part.className)).toEqual(['fd-input fd-designer-title fd-growing', 'fd-bar-rest', 'fd-button fd-button-primary', 'fd-button fd-bar-more']);
    expect(rest.querySelector('.fd-designer-status')).not.toBeNull();
    expect(rest.querySelector('[data-checks]')).not.toBeNull();
    expect(rest.querySelector('.fd-mode-switch')).not.toBeNull();
    expect([...rest.querySelectorAll('[data-mode]')].map((b) => b.textContent?.trim())).toEqual(['Simple', 'Advanced', 'Design', 'Try it', 'JSON', 'Translations', 'Rules']);
    expect(more.getAttribute('aria-label')).toBe('More');
    expect(more.getAttribute('aria-controls')).toBe(rest.id);
    expect(more.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens with the keys going in, and goes on Escape, the keys back on More', () => {
    const { bar, more, rest } = mount();
    more.click();
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(bar.classList.contains('fd-bar-unfolded')).toBe(true);
    // jsdom lays nothing out, so nothing in it can be said to be shown: the focus stays put there.
    key(rest.querySelector('.fd-designer-status') as HTMLElement, 'Escape');
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(more);
    more.click();
    more.click();
    expect(bar.classList.contains('fd-bar-unfolded')).toBe(false);
  });

  it('goes once a view is picked, and at a press anywhere but the bar', () => {
    const { host, bar, more, rest } = mount();
    more.click();
    (rest.querySelector('[data-mode="json"]') as HTMLButtonElement).click();
    expect(bar.classList.contains('fd-bar-unfolded')).toBe(false);
    more.click();
    (rest.querySelector('[data-mode="design"]') as HTMLButtonElement).click();
    more.click();
    host.querySelector('.fd-survey-head')?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(bar.classList.contains('fd-bar-unfolded')).toBe(false);
    // A press in it — Undo, say, pressed more than once — keeps it open.
    more.click();
    rest.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(bar.classList.contains('fd-bar-unfolded')).toBe(true);
  });

  it('the survey’s Look goes in it, before Checks', () => {
    const { rest } = mount();
    const look = rest.querySelector('.fd-look-button') as HTMLElement;
    expect(look).not.toBeNull();
    expect(look.nextElementSibling?.hasAttribute('data-checks')).toBe(true);
  });
});
