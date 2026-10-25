import type { Page } from '@fieldia/core';

/**
 * Words that come after a page was drawn (0.35): a language's chunk that came past the wait for it (30 s, words-chunks.ts
 * in @fieldia/core), so the page drew in English. The quick way a change is worked out keeps a problem found, and a part
 * drawn, for as long as what they were worked out from is the same — and the words they say are among that now
 * (`wordsVersion`): once the words come, the problems shown are said again in them and every part is drawn again, as
 * the plain way (`recomputeInFull`) draws them. The Arabic chunks of core, the widgets and the viewer are held here,
 * and let go once the page has drawn.
 */

const page: Page = {
  fieldia: '0.13',
  id: 'call',
  data: { kind: 'responses' },
  fields: {
    name: { type: 'char', label: 'Your name', required: true },
    seats: { type: 'integer', label: 'Seats', min: 1 },
    city: { type: 'selection', label: 'City', options: [{ value: 'cairo', label: 'Cairo' }, { value: 'giza', label: 'Giza' }] },
    agree: { type: 'boolean', label: 'Agree' },
    notes: { type: 'char', label: 'Notes' },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      {
        type: 'section',
        id: 's',
        children: [
          { type: 'field', id: 'n', field: 'name' },
          { type: 'field', id: 'q', field: 'seats' },
          { type: 'field', id: 'c', field: 'city' },
          { type: 'field', id: 'a', field: 'agree' },
          { type: 'field', id: 'o', field: 'notes' },
        ],
      },
    ],
  },
};

type Packages = typeof import('../index') & typeof import('@fieldia/core') & Pick<typeof import('@fieldia/widgets'), 'WIDGET_LABELS'>;

/** The packages in a module registry of their own, their Arabic held until `release`. */
async function heldArabic(): Promise<{ fieldia: Packages; release: () => void }> {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const hold = (path: string) =>
    jest.doMock(path, () => {
      const actual = jest.requireActual(path) as { LATER: Record<string, () => Promise<unknown>> };
      return { LATER: { ...actual.LATER, ar: () => held.then(() => actual.LATER['ar']()) } };
    });
  let fieldia!: Packages;
  await jest.isolateModulesAsync(async () => {
    hold('./locales/later');
    hold('../../../widgets/src/lib/locales/later');
    hold('../../../core/src/lib/record/locales/later');
    const [viewer, core, widgets] = await Promise.all([import('../index'), import('@fieldia/core'), import('@fieldia/widgets')]);
    fieldia = { ...core, ...viewer, WIDGET_LABELS: widgets.WIDGET_LABELS };
  });
  return { fieldia, release };
}

/** A page drawn, its ids alike whichever viewer drew it. */
const drawn = (host: Element) => host.innerHTML.replace(/fd\d+-/g, 'fd-').replace(/(fd-[a-z]+(?:-[a-z]+)*-)\d+(?=[-"])/g, '$1N');
const problems = (host: Element) => [...host.querySelectorAll('.fd-error')].map((error) => error.textContent).filter(Boolean);

let warn: jest.SpyInstance;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  warn.mockRestore();
  document.body.replaceChildren();
});

describe('words that come after a page drew in English', () => {
  it('say its problems again in them and draw every part again, the quick way as the plain way', async () => {
    const { fieldia, release } = await heldArabic();
    const mount = (full: boolean) => {
      const host = document.createElement('div');
      document.body.append(host);
      fieldia.recomputeInFull(full);
      const handle = fieldia.mountViewer(host, { page, locale: 'ar' });
      fieldia.recomputeInFull(false);
      return { host, handle, full };
    };
    const [plain, quick] = [mount(true), mount(false)];
    // Past the wait for the words: drawn in English.
    await jest.advanceTimersByTimeAsync(31_000);
    await Promise.all([plain.handle.drawn, quick.handle.drawn]);
    // Still coming: the page drew without them.
    expect(fieldia.wordsComing('ar')).toBe(true);
    expect(quick.host.querySelector('.fd-form')?.getAttribute('aria-busy')).toBeNull();
    const english = fieldia.fill(fieldia.MESSAGES.en.required, { label: 'Your name' });
    for (const side of [plain, quick]) {
      fieldia.recomputeInFull(side.full);
      side.handle.form.setValue('seats', 0);
      void side.handle.form.validate();
      fieldia.recomputeInFull(false);
      await jest.advanceTimersByTimeAsync(0);
      expect(problems(side.host)).toContain(english);
    }
    const version = fieldia.wordsVersion();
    // The words come.
    release();
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(0);
    expect(fieldia.wordsVersion()).toBeGreaterThan(version);
    const arabic = fieldia.fill(fieldia.MESSAGES.ar.required, { label: 'Your name' });
    expect(arabic).not.toBe(english);
    for (const side of [plain, quick]) {
      // Said again in them at once, nothing typed: the form's problems, and every part drawn again.
      expect(problems(side.host)).toContain(arabic);
      expect(problems(side.host)).not.toContain(english);
      expect(Object.values(side.handle.form.getState().errors)).toContain(arabic);
    }
    expect(drawn(quick.host)).toBe(drawn(plain.host));
    // And a key typed elsewhere, which the quick way works out alone: what it drew in the words stays drawn in them.
    for (const side of [plain, quick]) {
      fieldia.recomputeInFull(side.full);
      side.handle.form.setValue('notes', 'x');
      fieldia.recomputeInFull(false);
      await jest.advanceTimersByTimeAsync(0);
    }
    expect(drawn(quick.host)).toBe(drawn(plain.host));
    expect(problems(quick.host)).toContain(arabic);
    for (const side of [plain, quick]) side.handle.destroy();
  });

  it('a wait it said to a screen reader while they were held is said in them once they come', async () => {
    const { fieldia, release } = await heldArabic();
    const host = document.createElement('div');
    document.body.append(host);
    // A record that answers in 20 s (inside its deadline): its wait goes on as the words are held, and after they came.
    const dataSource = fieldia.createMemoryDataSource({ records: { call: { 1: { name: 'Mona', seats: 2 } } }, delayMs: 20_000 });
    const handle = fieldia.mountViewer(host, { page: { ...page, data: { kind: 'record', model: 'call' } } as Page, locale: 'ar', dataSource, recordId: 1 });
    await jest.advanceTimersByTimeAsync(1_000);
    const voice = () => host.querySelector('.fd-loading-said')?.textContent;
    // Said in the words there were: English's, the Arabic held.
    expect(voice()).toBe(fieldia.WIDGET_LABELS.en.loading);
    release();
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(0);
    await handle.drawn;
    expect(fieldia.WIDGET_LABELS.ar.loading).not.toBe(fieldia.WIDGET_LABELS.en.loading);
    expect(voice()).toBe(fieldia.WIDGET_LABELS.ar.loading);
    await jest.advanceTimersByTimeAsync(20_000);
    expect(handle.form.getState().values['name']).toBe('Mona');
    expect((host.querySelector('[data-node="n"] input') as HTMLInputElement).value).toBe('Mona');
    handle.destroy();
  });
});
