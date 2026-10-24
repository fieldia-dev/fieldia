import type { Page } from '@fieldia/core';

/**
 * The packages' Turkish, Persian, Urdu and Spanish: each in a chunk of its own, fetched where it is spoken
 * (@fieldia/core's `wordsReady`). `mountViewer` asks for the page's language's first and draws once they have come, so
 * its first paint is in its language — never an English word drawn and then swapped — and every word it made before
 * they came (a hidden banner's, the thanks after a send) reads in it too. What does not wait gets English, said once.
 */

const page: Page = {
  fieldia: '0.12',
  id: 'call',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Your name', required: true }, seats: { type: 'integer', label: 'Seats' }, agree: { type: 'boolean', label: 'Agree' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'section', id: 's', children: [{ type: 'field', id: 'n', field: 'name' }, { type: 'field', id: 'q', field: 'seats' }, { type: 'field', id: 'a', field: 'agree' }] }] },
};

type Packages = typeof import('../index') & typeof import('@fieldia/core') & Pick<typeof import('@fieldia/widgets'), 'WIDGET_LABELS'> & Pick<typeof import('./labels'), 'ownLocale'>;

/** The packages in a module registry of their own: no language fetched yet. */
async function fresh(): Promise<Packages> {
  let packages!: Packages;
  await jest.isolateModulesAsync(async () => {
    const [viewer, core, widgets, labels] = await Promise.all([import('../index'), import('@fieldia/core'), import('@fieldia/widgets'), import('./labels')]);
    packages = { ...core, ...viewer, WIDGET_LABELS: widgets.WIDGET_LABELS, ownLocale: labels.ownLocale };
  });
  return packages;
}

/** Every word in an element: its text, and the words of its attributes a person or a screen reader meets. */
function wordsIn(root: Element): Set<string> {
  const found = new Set<string>();
  for (const element of [root, ...root.querySelectorAll('*')]) {
    for (const node of element.childNodes) if (node.nodeType === 3 && node.textContent?.trim()) found.add(node.textContent.trim());
    for (const name of ['aria-label', 'title', 'placeholder', 'aria-description', 'alt']) {
      const value = element.getAttribute(name)?.trim();
      if (value) found.add(value);
    }
  }
  return found;
}

let warn: jest.SpyInstance;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  warn.mockRestore();
  document.body.replaceChildren();
});

describe.each(['tr', 'fa', 'ur', 'es'])('a page in %s', (locale) => {
  it('is drawn once its words have come, in them from its first paint, every word made before them in them too', async () => {
    const fieldia = await fresh();
    expect(fieldia.wordsComing(locale)).toBe(true);
    expect(Object.keys(fieldia.VIEWER_LABELS).sort()).toEqual(['ar', 'de', 'en', 'fr']);
    const host = document.createElement('div');
    document.body.append(host);
    const handle = fieldia.mountViewer(host, { page, locale });
    // Nothing drawn yet: no English word to swap for its own.
    const root = host.querySelector('.fd-form') as HTMLElement;
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(root.querySelector('button[type="submit"]')).toBeNull();
    await handle.drawn;
    expect(fieldia.wordsComing(locale)).toBe(false);
    const viewer = fieldia.VIEWER_LABELS[locale as 'tr'];
    expect(root.querySelector('button[type="submit"]')?.textContent?.trim()).toBe(viewer.submit);
    expect(root.getAttribute('lang')).toBe(locale);
    // Every word, hidden ones too, in the language: none of English's that the language says otherwise.
    const english = [fieldia.VIEWER_LABELS.en, fieldia.WIDGET_LABELS.en, fieldia.MESSAGES.en].flatMap((table) => Object.entries(table as unknown as Record<string, unknown>));
    const own = { ...fieldia.VIEWER_LABELS[locale as 'tr'], ...fieldia.WIDGET_LABELS[locale as 'tr'], ...fieldia.MESSAGES[locale as 'tr'] } as unknown as Record<string, unknown>;
    const englishOnly = new Set(english.filter(([key, words]) => typeof words === 'string' && words.length > 3 && !/\{/.test(words) && own[key] !== words).map(([, words]) => words as string));
    expect([...wordsIn(root)].filter((words) => englishOnly.has(words))).toEqual([]);
    // Its messages in it: a required answer left out.
    handle.check();
    expect(root.querySelector('.fd-error')?.textContent).toBe(fieldia.fill(fieldia.MESSAGES[locale as 'tr'].required, { label: 'Your name' }));
    expect(warn).not.toHaveBeenCalled();
    handle.destroy();
  });
});

describe('what does not wait for a language’s words', () => {
  it('gets English, said once, and the language’s words once they have come', async () => {
    const fieldia = await fresh();
    expect(fieldia.ownLocale('tr')).toBe('tr');
    expect(fieldia.VIEWER_LABELS.tr.submit).toBe(fieldia.VIEWER_LABELS.en.submit);
    fieldia.ownLocale('tr-TR');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("wordsReady('tr')");
    await fieldia.wordsReady('tr');
    expect(fieldia.VIEWER_LABELS.tr.submit).not.toBe(fieldia.VIEWER_LABELS.en.submit);
    // Arabic, German and French are there at once, as before.
    expect(fieldia.wordsComing('ar')).toBe(false);
    expect(fieldia.VIEWER_LABELS.ar.submit).toBe('إرسال');
  });
});
