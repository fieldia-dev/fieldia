import { blankPage, createBrowserLookStore, createDesigner, createMemoryLookStore, type SavedLook } from './designer';
import { LOOK_PRESETS, sameLook, savedLookOf } from './look-presets';

/**
 * Looks of one's own, kept by name to use again on other pages, as SurveyJS
 * and Vueform save named themes: an app keeps them for a whole workspace in
 * a store of its own; Fieldia ships one in memory and one in this browser.
 * Put on a page, one is a preset's whole look as one undo step.
 */

const brand: SavedLook = { id: 'brand', name: 'Brand', look: { accent: '#c4320a', font: 'serif', density: 'compact', corners: 'square', scheme: 'light' } };

afterEach(() => window.localStorage.clear());

describe('a store in memory', () => {
  it('keeps a look, gives copies, puts a renamed one in its place, and lets one go', async () => {
    const store = createMemoryLookStore();
    expect(await store.list()).toEqual([]);
    await store.save(brand);
    await store.save({ id: 'night-shift', name: 'Night shift', look: { scheme: 'dark' } });
    const listed = await store.list();
    expect(listed.map((l) => l.name)).toEqual(['Brand', 'Night shift']);
    listed[0].look.font = 'rounded';
    expect((await store.list())[0].look.font).toBe('serif');
    await store.save({ ...brand, name: 'Brand 2026' });
    expect((await store.list()).map((l) => [l.id, l.name])).toEqual([
      ['brand', 'Brand 2026'],
      ['night-shift', 'Night shift'],
    ]);
    await store.remove('brand');
    expect((await store.list()).map((l) => l.id)).toEqual(['night-shift']);
  });
});

describe('a store in this browser', () => {
  it('outlives the page: a store made later, by the same key, has the looks', async () => {
    await createBrowserLookStore().save(brand);
    expect(await createBrowserLookStore().list()).toEqual([brand]);
    expect(await createBrowserLookStore('another.workspace').list()).toEqual([]);
    await createBrowserLookStore().remove('brand');
    expect(await createBrowserLookStore().list()).toEqual([]);
  });

  it('reads only well-made looks, whatever else the browser holds', async () => {
    window.localStorage.setItem('fieldia.designer.looks', JSON.stringify([brand, { id: 'x' }, 'nonsense', { id: 'odd', name: 'Odd', look: { accent: 'red', font: 'comic', corners: 'round', labels: 'beside' } }]));
    expect(await createBrowserLookStore().list()).toEqual([brand, { id: 'odd', name: 'Odd', look: { corners: 'round' } }]);
    window.localStorage.setItem('fieldia.designer.looks', '{not json');
    expect(await createBrowserLookStore().list()).toEqual([]);
  });

  it('keeps the looks in memory for the visit when the browser keeps nothing', async () => {
    const storage = Object.getPrototypeOf(window.localStorage) as Storage;
    const get = jest.spyOn(storage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const set = jest.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    try {
      const store = createBrowserLookStore();
      await store.save(brand);
      expect(await store.list()).toEqual([brand]);
      await store.remove('brand');
      expect(await store.list()).toEqual([]);
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });

  it('keeps a look it could not write, for the visit', async () => {
    const store = createBrowserLookStore();
    await store.save(brand);
    const set = jest.spyOn(Object.getPrototypeOf(window.localStorage) as Storage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    try {
      await store.save({ ...brand, id: 'second', name: 'Second' });
      expect((await store.list()).map((l) => l.name)).toEqual(['Brand', 'Second']);
    } finally {
      set.mockRestore();
    }
  });
});

describe('the designer’s looks', () => {
  it('are kept in the app’s store when it gives one, else in this browser, one store for every designer on the page', () => {
    const looks = createMemoryLookStore();
    expect(createDesigner({ page: blankPage('screen', 'Visit'), looks }).looks()).toBe(looks);
    const one = createDesigner({ page: blankPage('screen', 'Visit') }).looks();
    const other = createDesigner({ page: blankPage('survey', 'Feedback') }).looks();
    expect(one).toBe(other);
    expect(one).not.toBe(looks);
  });

  it('opened from a page store, keeps the app’s looks', async () => {
    const looks = createMemoryLookStore();
    const { createMemoryPageStore } = await import('./designer');
    const store = createMemoryPageStore();
    await store.saveDraft(blankPage('screen', 'Visit'));
    expect((await createDesigner.open('visit', store, { looks })).looks()).toBe(looks);
  });
});

describe('a look put on the page', () => {
  it('sets a preset’s five values as one undo step, gives back to the skin what it leaves unset, and keeps where labels sit', () => {
    const designer = createDesigner({ page: { ...blankPage('screen', 'Visit'), look: { labels: 'beside', labelWidth: 160, font: 'rounded', scheme: 'dark' } } });
    expect(designer.useLook({ accent: '#c4320a', corners: 'square' })).toBe(true);
    expect(designer.getPage().look).toEqual({ labels: 'beside', labelWidth: 160, accent: '#c4320a', corners: 'square' });
    expect(designer.useLook(brand.look)).toBe(true);
    expect(designer.getPage().look).toEqual({ labels: 'beside', labelWidth: 160, ...brand.look });
    designer.undo();
    expect(designer.getPage().look).toEqual({ labels: 'beside', labelWidth: 160, accent: '#c4320a', corners: 'square' });
    designer.undo();
    expect(designer.getPage().look).toEqual({ labels: 'beside', labelWidth: 160, font: 'rounded', scheme: 'dark' });
  });

  it('takes only what a preset sets: where labels sit stays the page’s', () => {
    const designer = createDesigner({ page: { ...blankPage('screen', 'Visit'), look: { labels: 'above' } } });
    designer.useLook({ ...brand.look, labels: 'hidden', labelWidth: 200 });
    expect(designer.getPage().look).toEqual({ labels: 'above', ...brand.look });
  });

  it('is refused, saying why, for a colour that is not one', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit') });
    expect(designer.useLook({ accent: 'red' })).toBe(false);
    expect(designer.getState().issues).toEqual(['A colour is written #rrggbb, such as #1f7a4d']);
    expect(designer.getPage().look).toBeUndefined();
  });
});

describe('which look a page wears', () => {
  it('is the same look by the five values a preset sets, the accent in either case and unset as unset', () => {
    expect(sameLook({ ...brand.look, accent: '#C4320A', labels: 'beside' }, brand.look)).toBe(true);
    expect(sameLook({ accent: '#c4320a' }, { accent: '#c4320a', font: 'system' })).toBe(false);
    expect(sameLook({ scheme: 'dark' }, { scheme: 'dark' })).toBe(true);
    expect(sameLook(undefined, {})).toBe(true);
  });

  it('is found among the looks kept, by those values', () => {
    const night = { id: 'n', name: 'Night shift', look: { ...LOOK_PRESETS[4].look, accent: '#0e7c86' } };
    expect(savedLookOf({ ...brand.look, labels: 'beside' }, [night, brand])).toBe(brand);
    expect(savedLookOf({ ...brand.look, corners: 'round' }, [night, brand])).toBeNull();
    expect(savedLookOf(undefined, [night, brand])).toBeNull();
  });
});

describe('the looks every editor on the page shares', () => {
  it('keep a look saved, or removed, while the store was still listing them', async () => {
    const { looksHub } = await import('./look-hub');
    const store = createMemoryLookStore([brand]);
    let answer: (looks: SavedLook[]) => void = () => undefined;
    store.list = () => new Promise((resolve) => (answer = resolve));
    const hub = looksHub(store);
    hub.ensure();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const night = { id: 'night-shift', name: 'Night shift', look: { scheme: 'dark' as const } };
    await hub.save(night);
    await hub.remove('brand');
    // The answer the store gave from before both.
    answer([brand]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(hub.looks).toEqual([night]);
  });
});
