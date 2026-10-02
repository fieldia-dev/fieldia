import { browserPreferences, memoryPreferences } from './preferences';

describe('preferences', () => {
  afterEach(() => localStorage.clear());

  it('keeps a value in the browser under the fieldia: prefix and gives it back', () => {
    const store = browserPreferences();
    expect(store.get('order.f-lines.columns')).toBeNull();
    store.set('order.f-lines.columns', [{ colId: 'qty', width: 140 }]);
    expect(localStorage.getItem('fieldia:order.f-lines.columns')).toBe('[{"colId":"qty","width":140}]');
    expect(browserPreferences().get('order.f-lines.columns')).toEqual([{ colId: 'qty', width: 140 }]);
  });

  it('never throws when the browser refuses storage or holds something unreadable', () => {
    localStorage.setItem('fieldia:broken', '{not json');
    expect(browserPreferences().get('broken')).toBeNull();
    const refusing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } } as unknown as Storage;
    const store = browserPreferences(refusing);
    expect(() => store.set('a', 1)).not.toThrow();
    expect(store.get('a')).toBeNull();
  });

  it('keeps values in memory for tests and pages that must not touch the browser', () => {
    const store = memoryPreferences();
    store.set('a', { hide: true });
    expect(store.get('a')).toEqual({ hide: true });
    expect(store.get('b')).toBeNull();
  });
});
