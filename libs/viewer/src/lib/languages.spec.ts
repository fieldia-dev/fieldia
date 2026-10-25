import type { Page } from '@fieldia/core';
import { MESSAGES, wordsReady } from '@fieldia/core';
import { WIDGET_LABELS } from '@fieldia/widgets';
import * as packaged from '../index';
import { ar as arMessages } from '../../../core/src/lib/record/locales/ar';
import { fr as frMessages } from '../../../core/src/lib/record/locales/fr';
import { ar as arWidgets } from '../../../widgets/src/lib/locales/ar';
import { fr as frWidgets } from '../../../widgets/src/lib/locales/fr';
import { ar as arViewer } from './locales/ar';
import { fr as frViewer } from './locales/fr';

/**
 * Fieldia's own words in a language. English is always there. The packages
 * carry Arabic, German, French, Turkish, Persian, Urdu and Spanish too; the
 * one-tag script carries English alone, and a page adds another language with
 * that language's script (fieldia.ar.js, …), which hands its words to
 * `addLanguage`.
 */

const page: Page = {
  fieldia: '0.1',
  id: 'call',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Your name', required: true } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'section', id: 's', children: [{ type: 'field', id: 'n', field: 'name' }] }] },
};

/** The modules that fetch every language besides English: the script bundle builds each as an empty one. */
const OTHER_LANGUAGES = ['../../../core/src/lib/record/locales/later', '../../../widgets/src/lib/locales/later', './locales/later'];

type Fieldia = typeof packaged & Pick<typeof import('@fieldia/core'), 'MESSAGES'> & Pick<typeof import('@fieldia/widgets'), 'WIDGET_LABELS'>;

/** Fieldia as the one-tag script carries it: English alone, in a module registry of its own. */
async function englishOnly(): Promise<Fieldia> {
  let fieldia!: Fieldia;
  await jest.isolateModulesAsync(async () => {
    for (const path of OTHER_LANGUAGES) jest.doMock(path, () => ({ LATER: {} }));
    const [viewer, core, widgets] = await Promise.all([import('../index'), import('@fieldia/core'), import('@fieldia/widgets')]);
    fieldia = { ...viewer, MESSAGES: core.MESSAGES, WIDGET_LABELS: widgets.WIDGET_LABELS };
  });
  for (const path of OTHER_LANGUAGES) jest.dontMock(path);
  return fieldia;
}

/** A language's words as its add-on script carries them. */
const ARABIC = { messages: arMessages, widgets: arWidgets, viewer: arViewer };
const FRENCH = { messages: frMessages, widgets: frWidgets, viewer: frViewer };

function show(fieldia: Pick<Fieldia, 'mountViewer'>, locale: string) {
  const host = document.createElement('div');
  document.body.append(host);
  const handle = fieldia.mountViewer(host, { page, locale });
  const submit = host.querySelector('button[type="submit"]');
  return { host, handle, submit: submit?.textContent?.trim() };
}

let warn: jest.SpyInstance;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  warn.mockRestore();
  document.body.replaceChildren();
  delete (globalThis as { __FIELDIA_VERSION__?: string }).__FIELDIA_VERSION__;
});

describe('the packages', () => {
  it('give four languages with no extra import, and Turkish, Persian, Urdu and Spanish each in a chunk once asked for', async () => {
    expect(Object.keys(MESSAGES).sort()).toEqual(['ar', 'de', 'en', 'fr']);
    expect(Object.keys(WIDGET_LABELS).sort()).toEqual(['ar', 'de', 'en', 'fr']);
    expect(Object.keys(packaged.VIEWER_LABELS).sort()).toEqual(['ar', 'de', 'en', 'fr']);
    await Promise.all(['tr', 'fa', 'ur', 'es'].map(wordsReady));
    expect(Object.keys(MESSAGES).sort()).toEqual(['ar', 'de', 'en', 'es', 'fa', 'fr', 'tr', 'ur']);
    expect(Object.keys(WIDGET_LABELS).sort()).toEqual(['ar', 'de', 'en', 'es', 'fa', 'fr', 'tr', 'ur']);
    expect(Object.keys(packaged.VIEWER_LABELS).sort()).toEqual(['ar', 'de', 'en', 'es', 'fa', 'fr', 'tr', 'ur']);
    expect(MESSAGES.ar.required).toBe('{label} مطلوب');
    expect(WIDGET_LABELS.de.search).toBe('Suchen…');
    expect(packaged.VIEWER_LABELS.fr.submit).toBe('Envoyer');
  });

  it('show a page in Arabic with no warning', () => {
    const { host, submit } = show(packaged, 'ar');
    expect(submit).toBe('إرسال');
    expect(host.querySelector('.fd-form')?.getAttribute('dir')).toBe('rtl');
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('the one-tag script, English alone', () => {
  it('holds English words only until a language is added', async () => {
    const fieldia = await englishOnly();
    expect(Object.keys(fieldia.MESSAGES)).toEqual(['en']);
    expect(Object.keys(fieldia.WIDGET_LABELS)).toEqual(['en']);
    expect(Object.keys(fieldia.VIEWER_LABELS)).toEqual(['en']);
    expect(typeof fieldia.addLanguage).toBe('function');
  });

  it('shows English words for a language not added, right to left still, and says once which script to add', async () => {
    const fieldia = await englishOnly();
    // As the one-tag script runs, its build having written its version in.
    (globalThis as { __FIELDIA_VERSION__?: string }).__FIELDIA_VERSION__ = '0.34.0';
    const first = show(fieldia, 'ar');
    expect(first.submit).toBe('Submit');
    expect(first.host.querySelector('.fd-form')?.getAttribute('dir')).toBe('rtl');
    first.handle.check();
    expect(first.host.querySelector('.fd-error')?.textContent).toBe('Your name is required');
    show(fieldia, 'ar-EG');
    expect(warn).toHaveBeenCalledTimes(1);
    // The script of its own version, never the newest.
    expect(warn.mock.calls[0][0]).toContain('from its version (0.34.0): <script src="https://cdn.jsdelivr.net/npm/@fieldia/viewer@0.34.0/bundle/fieldia.ar.js" crossorigin="anonymous"></script>');
    expect(warn.mock.calls[0][0]).not.toMatch(/@fieldia\/viewer\/bundle/);
    // Each language missing is said once.
    show(fieldia, 'de');
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[1][0]).toContain('@fieldia/viewer@0.34.0/bundle/fieldia.de.js');
  });

  it('says nothing for a language Fieldia has no words for in any form', async () => {
    const fieldia = await englishOnly();
    expect(show(fieldia, 'it').submit).toBe('Submit');
    expect(warn).not.toHaveBeenCalled();
  });

  it('uses a language once it is added: the viewer’s words, the messages and the widgets’', async () => {
    const fieldia = await englishOnly();
    fieldia.addLanguage('ar', ARABIC);
    const { host, handle, submit } = show(fieldia, 'ar');
    expect(submit).toBe('إرسال');
    handle.check();
    expect(host.querySelector('.fd-error')?.textContent).toBe('Your name مطلوب');
    expect(fieldia.WIDGET_LABELS.ar.search).toBe('بحث…');
    expect(warn).not.toHaveBeenCalled();
  });

  it('takes a language added twice, the second time as the first', async () => {
    const fieldia = await englishOnly();
    fieldia.addLanguage('fr', FRENCH);
    fieldia.addLanguage('fr', FRENCH);
    expect(show(fieldia, 'fr').submit).toBe('Envoyer');
    expect(warn).not.toHaveBeenCalled();
  });

  it('fills the words a language leaves out with English', async () => {
    const fieldia = await englishOnly();
    fieldia.addLanguage('de', { viewer: { submit: 'Absenden' } });
    const { host, handle, submit } = show(fieldia, 'de');
    expect(submit).toBe('Absenden');
    handle.check();
    expect(host.querySelector('.fd-error')?.textContent).toBe('Your name is required');
    expect(fieldia.WIDGET_LABELS.de.search).toBe('Search…');
    expect(fieldia.VIEWER_LABELS.de.next).toBe('Next');
  });
});

describe('a language added with its words for a count, not those for one', () => {
  it('says one in its own words, never in English', async () => {
    const { addLanguage } = await import('./add-language');
    const { inPlural } = await import('@fieldia/widgets');
    // An add-on with fewer words than the package's own German: its count's words, none for one.
    addLanguage('de', { widgets: { pastedCells: 'In {n} Zellen eingefügt.' }, messages: { overBy: '{label}: {over} Zeichen über {max}' } });
    expect(inPlural(WIDGET_LABELS.de.pastedCells, WIDGET_LABELS.de.pastedCellsOne, 1, 'de')).toBe('In 1 Zellen eingefügt.');
    expect(MESSAGES.de.overByOne).toBe('{label}: {over} Zeichen über {max}');
    // A word it left out altogether is still English.
    expect(WIDGET_LABELS.de.pasteBeyondLinesOne).toBe(WIDGET_LABELS.en.pasteBeyondLinesOne);
  });
});
