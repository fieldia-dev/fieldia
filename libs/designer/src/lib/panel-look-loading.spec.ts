import { loadingPart } from '@fieldia/widgets';
import { blankPage, createDesigner } from './designer';
import { pageChanges } from './page-checks';
import { mount, openTab } from './test-editor';

/**
 * The Look tab's section on waiting: each moment's way chosen with no JSON, beside a preview waiting that way; the
 * looks, the timing and a failure's way; Fieldia's default chosen again gives the setting back, and the page says no
 * `loading` once nothing is left in it.
 */

function lookTab() {
  const designer = createDesigner({ page: blankPage('screen', 'Customer') });
  designer.addQuestion('short-answer', { parent: 'section-1' });
  designer.select(null);
  const { host } = mount(designer, { mode: 'advanced' });
  openTab(host, 'Look');
  const shown = () => host.querySelector('.fd-properties [role="tabpanel"]:not([hidden])') as HTMLElement;
  const row = (name: string) => shown().querySelector(`[data-setting="${name}"]`) as HTMLElement;
  const choose = (name: string, value: string) => {
    const select = row(name).querySelector('select') as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const preview = (name: string) => row(name).querySelector('.fd-insp-loading-preview') as HTMLElement;
  return { designer, host, row, choose, preview, loading: () => designer.getPage().loading };
}

describe('the Look tab’s section on waiting', () => {
  beforeAll(() => loadingPart.load());

  it('offers each moment its own ways, Fieldia’s default marked, and previews the one chosen at once', () => {
    const { row, preview } = lookTab();
    expect([...row('Loading: drawn the first time').querySelectorAll('option')].map((o) => o.textContent)).toEqual(['Skeleton (default)', 'Spinner', 'Progress bar', 'Words', 'Nothing', 'The app’s own']);
    expect([...row('Loading: asked again').querySelectorAll('option')].map((o) => o.textContent)).toEqual(['Keep it, a bar over it (default)', 'Dim it', 'Skeleton', 'Spinner', 'Nothing', 'The app’s own']);
    expect(row('Loading: a save or a button').querySelector('select')?.value).toBe('button');
    // A picture of what waits, never read out: the one machine drawing the moment's way, at once.
    expect(preview('Loading: drawn the first time').getAttribute('aria-hidden')).toBe('true');
    expect(preview('Loading: drawn the first time').querySelector('[data-fd-way]')?.getAttribute('data-fd-way')).toBe('skeleton');
    expect(preview('Loading: asked again').querySelector('.fd-loader[data-way="keep"] .fd-bar')).not.toBeNull();
    expect(preview('Loading: the next rows').querySelector('.fd-loader[data-way="row"]')?.textContent).toBe('Loading more…');
    expect(preview('Loading: a search').querySelector('.fd-loader[data-way="inline"]')?.textContent).toBe('Searching…');
    expect(preview('Loading: a save or a button').querySelector('.fd-button[aria-busy="true"]')).not.toBeNull();
  });

  it('sets a moment’s way on the page, its preview drawn anew; the default chosen again gives it back', () => {
    const { choose, preview, loading } = lookTab();
    choose('Loading: drawn the first time', 'spinner');
    expect(loading()).toEqual({ first: 'spinner' });
    expect(preview('Loading: drawn the first time').querySelector('.fd-loader[data-way="spinner"] .fd-spin')).not.toBeNull();
    choose('Loading: asked again', 'dim');
    choose('Loading: a save or a button', 'overlay');
    expect(loading()).toEqual({ first: 'spinner', refresh: 'dim', action: 'overlay' });
    expect(preview('Loading: a save or a button').querySelector('.fd-loader[data-way="overlay"]')).not.toBeNull();
    choose('Loading: drawn the first time', 'skeleton');
    choose('Loading: asked again', 'keep');
    choose('Loading: a save or a button', 'button');
    expect(loading()).toBeUndefined();
  });

  it('sets the looks, the timing and a failure’s way, each given back as it is pressed again or emptied', () => {
    const { row, loading, designer } = lookTab();
    const press = (name: string, words: string) => [...row(name).querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === words)?.click();
    press('Loading looks', 'Pulse');
    press('Loading looks', 'Dots');
    press('When loading fails', 'A toast');
    expect(loading()).toEqual({ skeleton: 'pulse', spinner: 'dots', error: 'toast' });
    const box = (label: string) => row('Loading times').querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
    const typeIn = (input: HTMLInputElement, text: string) => {
      input.focus();
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.blur();
    };
    expect(box('Wait before showing').value).toBe('150');
    typeIn(box('Wait before showing'), '300');
    typeIn(box('Give up after'), '20000');
    expect(loading()).toEqual({ skeleton: 'pulse', spinner: 'dots', error: 'toast', delay: 300, timeout: 20000 });
    // Said among the changes before publishing.
    expect(pageChanges({ ...designer.getPage(), loading: undefined }, designer.getPage())).toContain('How the page waits changed');
    press('Loading looks', 'Pulse');
    press('Loading looks', 'Dots');
    press('When loading fails', 'A toast');
    typeIn(box('Wait before showing'), '');
    typeIn(box('Give up after'), '');
    expect(loading()).toBeUndefined();
  });
});
