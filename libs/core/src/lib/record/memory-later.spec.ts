import { createMemoryDataSource as wholeSource } from './memory-data-source';
import { createMemoryDataSource, MEMORY_MEMBERS, memoryPart } from './memory-later';

/**
 * The one-tag script's memory source (memory-later.ts): what it keeps there at once, its members answering once the
 * memory part has come — the same members, on the same records, as the packages' source.
 */
describe("the one-tag script's memory source", () => {
  it('answers every member the packages’ source has, and keeps what it keeps at once', async () => {
    expect(memoryPart.loaded).toBeUndefined();
    const source = createMemoryDataSource({ records: { partner: { 1: { name: 'Nile Traders' } } }, versions: { by: 'Me' } });
    // Every member a whole source has, and only those.
    const whole = wholeSource();
    const functions = (of: object) => Object.keys(of).filter((key) => typeof (of as Record<string, unknown>)[key] === 'function').sort();
    expect(functions(source)).toEqual(functions(whole));
    // What it does at once besides: someone else's change and response.
    const atOnce = ['changeElsewhere', 'answeredElsewhere'];
    expect([...MEMORY_MEMBERS].sort()).toEqual(functions(whole).filter((name) => !atOnce.includes(name)));
    // Templates and live members only where their options say, as the packages' source has them.
    const given = { templates: {}, live: true };
    expect(functions(createMemoryDataSource(given))).toEqual(functions(wholeSource(given)));
    expect(functions(wholeSource(given)).filter((name) => !functions(whole).includes(name))).toEqual(['arrive', 'deleteTemplate', 'leave', 'presence', 'saveTemplate', 'subscribe', 'templates']);
    // What it keeps, and someone else's change, at once — before its part was asked for.
    expect(source.records['partner']['1']).toEqual({ name: 'Nile Traders' });
    expect(source.changeElsewhere('partner', 1, { name: 'Nile Traders Co.' }, { by: 'Mona', at: '2026-10-20T09:00:00.000Z' })).toEqual({ token: '1', by: 'Mona', at: '2026-10-20T09:00:00.000Z' });
    source.answeredElsewhere('p', { a: 1 });
    expect(memoryPart.loaded).toBeUndefined();
    // A member called: its part asked for, the call answered once it came, on the same records and versions.
    const loaded = await source.load({ model: 'partner', id: 1, fields: {} });
    expect(memoryPart.loaded).toBeDefined();
    expect(loaded).toMatchObject({ values: { name: 'Nile Traders Co.' }, version: { token: '1', by: 'Mona' } });
    const saved = await source.save({ model: 'partner', id: 1, fields: {}, changes: { values: { name: 'Nile' }, lines: {}, links: {} }, values: { name: 'Nile' }, version: { token: '1' } });
    expect(saved).toMatchObject({ id: 1, version: { token: '2', by: 'Me' } });
    expect(source.records['partner']['1']['name']).toBe('Nile');
    expect(source.calls.map((call) => call.method)).toEqual(['load', 'save']);
    // Counted with the response someone else sent before the part came.
    expect(await source.limits({ pageId: 'p', model: '', recordId: null, fields: [] })).toMatchObject({ responses: 1, mine: 0 });
  });

  it('is made whole at once once its part has come', async () => {
    await memoryPart.load();
    const source = createMemoryDataSource({ records: { partner: { 1: { name: 'Nile Traders' } } } });
    const whole = memoryPart.loaded?.createMemoryDataSource({});
    expect(Object.keys(source).sort()).toEqual(Object.keys(whole ?? {}).sort());
    expect(await source.search({ model: 'partner', query: 'nile', limit: 5 })).toEqual([{ id: 1, label: 'Nile Traders' }]);
  });
});
