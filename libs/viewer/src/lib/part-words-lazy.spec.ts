import { customers } from './test-list';
import { ar as arMessages } from '../../../core/src/lib/record/locales/ar';
import { ar as arWidgets } from '../../../widgets/src/lib/locales/ar';
import { ar as arViewer } from './locales/ar';
import type { LanguageWords } from './add-language';
import type { ViewerLabels } from './labels';

/**
 * A part's own words in the one-tag script (tools/part-words.mjs): its main script's English leaves out the words only
 * a part reads, and the part puts them in every language's table as it comes (`partWords`) — where a table has no such
 * word yet, never over one it has. Here Fieldia is as that script has it: English alone, a part's words taken out.
 * The packages keep every word; nothing here changes them.
 */

/** The modules that fetch every language besides English: the script bundle builds each as an empty one. */
const OTHER_LANGUAGES = ['../../../core/src/lib/record/locales/later', '../../../widgets/src/lib/locales/later', './locales/later'];

/** Some of the list part's own words, and a widget's. */
const LIST_WORDS = ['nextPage', 'previousPage', 'importReady', 'importReadyOne', 'importTitle'] as const;
const ARABIC = { messages: arMessages, widgets: arWidgets, viewer: arViewer };

type Viewer = typeof import('../index');
type OneTag = Viewer &
  Pick<typeof import('@fieldia/core'), 'MESSAGES' | 'createMemoryDataSource'> &
  Pick<typeof import('@fieldia/widgets'), 'WIDGET_LABELS'> & { partWords: (words: LanguageWords) => void; english: LanguageWords };

/** Fieldia as the one-tag script carries it, in a module registry of its own: English alone, without the words of LIST_WORDS and `phoneCall`. */
async function oneTag(): Promise<OneTag> {
  let fieldia!: OneTag;
  await jest.isolateModulesAsync(async () => {
    for (const path of OTHER_LANGUAGES) jest.doMock(path, () => ({ LATER: {} }));
    const [viewer, core, widgets, added] = await Promise.all([import('../index'), import('@fieldia/core'), import('@fieldia/widgets'), import('./add-language')]);
    const english: LanguageWords = { viewer: Object.fromEntries(LIST_WORDS.map((key) => [key, viewer.VIEWER_LABELS.en[key]])), widgets: { phoneCall: widgets.WIDGET_LABELS.en.phoneCall } };
    for (const key of LIST_WORDS) delete (viewer.VIEWER_LABELS.en as Partial<ViewerLabels>)[key];
    delete (widgets.WIDGET_LABELS.en as Partial<typeof widgets.WIDGET_LABELS.en>).phoneCall;
    fieldia = { ...viewer, MESSAGES: core.MESSAGES, createMemoryDataSource: core.createMemoryDataSource, WIDGET_LABELS: widgets.WIDGET_LABELS, partWords: added.partWords, english };
  });
  for (const path of OTHER_LANGUAGES) jest.dontMock(path);
  return fieldia;
}

const records = (fieldia: OneTag) =>
  fieldia.createMemoryDataSource({
    records: {
      partner: {
        1: { name: 'Nile Traders', state: 'active' },
        2: { name: 'Amira Clinics', state: 'draft' },
        3: { name: 'Petra Tours', state: 'active' },
      },
    },
  });

let warn: jest.SpyInstance;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  warn.mockRestore();
  document.body.replaceChildren();
});

describe('a part’s own words in the one-tag script', () => {
  it('are not in the main script’s English until the part brings them, then are, in English', async () => {
    const fieldia = await oneTag();
    expect('nextPage' in fieldia.VIEWER_LABELS.en).toBe(false);
    fieldia.partWords(fieldia.english);
    expect(fieldia.VIEWER_LABELS.en.nextPage).toBe('Next page');
    expect(fieldia.VIEWER_LABELS.en.importReadyOne).toBe('{n} row can be imported.');
    expect(fieldia.WIDGET_LABELS.en.phoneCall).toBe('Call');
  });

  it('never go over a word a table has: an app’s own, or another part’s that brought it first', async () => {
    const fieldia = await oneTag();
    fieldia.VIEWER_LABELS.en.nextPage = 'Onward';
    fieldia.partWords(fieldia.english);
    expect(fieldia.VIEWER_LABELS.en.nextPage).toBe('Onward');
    expect(fieldia.VIEWER_LABELS.en.previousPage).toBe('Previous page');
    fieldia.partWords({ viewer: { previousPage: 'Back a page' } });
    expect(fieldia.VIEWER_LABELS.en.previousPage).toBe('Previous page');
  });

  it('in Arabic whichever came first, the add-on or the part: addLanguage keeps the add-on’s words for a part’s keys', async () => {
    const before = await oneTag();
    before.addLanguage('ar', ARABIC);
    // The main script's English lacks them, but the add-on's words are kept whole.
    expect(before.VIEWER_LABELS.ar.nextPage).toBe(arViewer.nextPage);
    before.partWords(before.english);
    for (const key of LIST_WORDS) expect(before.VIEWER_LABELS.ar[key]).toBe(arViewer[key]);
    expect(before.WIDGET_LABELS.ar.phoneCall).toBe(arWidgets.phoneCall);

    const after = await oneTag();
    after.partWords(after.english);
    after.addLanguage('ar', ARABIC);
    for (const key of LIST_WORDS) expect(after.VIEWER_LABELS.ar[key]).toBe(arViewer[key]);
    expect(after.WIDGET_LABELS.ar.phoneCall).toBe(arWidgets.phoneCall);
    expect(after.VIEWER_LABELS.en.nextPage).toBe('Next page');
  });

  it('for a language that leaves one out: English, but its own words for a count stand for one, as addLanguage says it', async () => {
    const fieldia = await oneTag();
    fieldia.addLanguage('de', { viewer: { importReady: '{n} Zeilen bereit.' } });
    fieldia.partWords(fieldia.english);
    expect(fieldia.VIEWER_LABELS.de.importReady).toBe('{n} Zeilen bereit.');
    expect(fieldia.VIEWER_LABELS.de.importReadyOne).toBe('{n} Zeilen bereit.');
    expect(fieldia.VIEWER_LABELS.de.importTitle).toBe(fieldia.VIEWER_LABELS.en.importTitle);
    // A language given again takes its new words, a part's among them.
    fieldia.addLanguage('de', { viewer: { importTitle: 'Datensätze importieren' } });
    expect(fieldia.VIEWER_LABELS.de.importTitle).toBe('Datensätze importieren');
    expect(fieldia.VIEWER_LABELS.de.importReady).toBe(fieldia.VIEWER_LABELS.en.importReady);
  });

  it('a part’s sentence in a page’s words for its records: never English beside a language that gave its plain one', async () => {
    const fieldia = await oneTag();
    fieldia.addLanguage('de', { viewer: { importReady: '{n} Zeilen bereit.' } });
    fieldia.partWords({ viewer: { importReady: fieldia.VIEWER_LABELS.en.importReady, importReadyNoun: '{n} {records} ready.' } as Partial<ViewerLabels> });
    expect('importReadyNoun' in fieldia.VIEWER_LABELS.de).toBe(false);
    expect((fieldia.VIEWER_LABELS.en as unknown as Record<string, string>)['importReadyNoun']).toBe('{n} {records} ready.');
  });
});

describe('a page mounted before its part came', () => {
  /** The customers' list mounted at once, its part's words brought while the viewer waits for the part. */
  async function listed(fieldia: OneTag, more: { locale?: string; labels?: Partial<ViewerLabels> } = {}) {
    const host = document.createElement('div');
    document.body.append(host);
    const handle = fieldia.mountViewer(host, { page: customers, dataSource: records(fieldia), ...more });
    expect(host.querySelector('.fd-list')).toBeNull();
    fieldia.partWords(fieldia.english);
    await handle.drawn;
    for (let turn = 0; turn < 50 && !host.querySelector('.fd-list-row'); turn++) await new Promise((done) => setTimeout(done, 0));
    return { host, handle, next: host.querySelector('.fd-pager-button:last-of-type')?.getAttribute('aria-label'), previous: host.querySelector('.fd-pager-button')?.getAttribute('aria-label') };
  }

  it('draws the part’s words, read as they are drawn — never a key’s name, never undefined', async () => {
    const fieldia = await oneTag();
    const { host, next, previous } = await listed(fieldia);
    expect(host.querySelector('.fd-list-row')).not.toBeNull();
    expect([previous, next]).toEqual(['Previous page', 'Next page']);
    expect(host.innerHTML).not.toMatch(/undefined|nextPage|previousPage/);
  });

  it('in Arabic with its add-on: the add-on’s words', async () => {
    const fieldia = await oneTag();
    fieldia.addLanguage('ar', ARABIC);
    const { next, previous } = await listed(fieldia, { locale: 'ar' });
    expect([previous, next]).toEqual([arViewer.previousPage, arViewer.nextPage]);
  });

  it('with the app’s own words: the app’s, over the part’s; the rest the part’s', async () => {
    const fieldia = await oneTag();
    const { next, previous } = await listed(fieldia, { labels: { nextPage: 'Onward' } });
    expect([previous, next]).toEqual(['Previous page', 'Onward']);
  });

  it('with the app’s whole labels object, made from the main script’s English before the part came: its words, the part’s for the rest', async () => {
    const fieldia = await oneTag();
    const own = { ...fieldia.VIEWER_LABELS.en, save: 'Keep' };
    const { next } = await listed(fieldia, { labels: own });
    expect(next).toBe('Next page');
  });
});

describe('the viewer’s words for a page (viewerWords)', () => {
  it('read as the words they hold: spread, keyed and listed, the app’s own over the language’s, the language’s as it is now', async () => {
    const { viewerWords, VIEWER_LABELS } = await import('./labels');
    const words = viewerWords('en', { save: 'Keep' });
    expect(words.save).toBe('Keep');
    expect(words.submit).toBe(VIEWER_LABELS.en.submit);
    expect({ ...words }.save).toBe('Keep');
    expect(Object.keys(words)).toEqual(Object.keys(VIEWER_LABELS.en));
    expect('submit' in words && 'save' in words).toBe(true);
    expect(JSON.parse(JSON.stringify(words)).next).toBe('Next');
    // A word written to them is theirs.
    words.next = 'Onward';
    expect(words.next).toBe('Onward');
    expect(VIEWER_LABELS.en.next).toBe('Next');
    // Another language: its own, as the packages have it once its words have come (a chunk of its own).
    await (await import('@fieldia/core')).wordsReady('ar');
    expect(viewerWords('ar').submit).toBe(VIEWER_LABELS.ar.submit);
  });
});
