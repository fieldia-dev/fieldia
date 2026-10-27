import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { installZonePromises } from '../../../../../testing/zone-promises';
import { createForm, type DataSource, type Page } from '../../index';
import { withDeadlines } from './deadline';

/**
 * Every answer of the app's data source — a promise it gives, refused at once, later, or kept — reaches Fieldia as a
 * promise of the engine's own, the app's handled where it is made: the one door every request of a form and a viewer
 * goes through (`withDeadlines`). So a refusal at once is never said unhandled by a zone that watches its own promises
 * (Angular's: `NgZone.onError`) while Fieldia's `await`, code Angular did not compile, comes to it a microtask late.
 * Promises here are kept as that zone keeps them (testing/zone-promises.ts).
 */

/** The engine's own promise, whatever `Promise` is: an async function's. */
const OwnPromise = (async () => undefined)().constructor;
/** Every member of a data source, from its interface: one added is held here by itself. */
const MEMBERS = [...(/export interface DataSource \{([\s\S]*?)\n\}/.exec(readFileSync(join(__dirname, 'data-source.ts'), 'utf8'))?.[1] ?? '').matchAll(/^ {2}(\w+)\?\(/gm)].map(([, name]) => name);

let zone: ReturnType<typeof installZonePromises>;
beforeEach(() => {
  zone = installZonePromises();
});
afterEach(() => zone.restore());
const said = () => zone.said.map((reason) => (reason as Error)?.message ?? String(reason));
const turns = async (n = 10) => {
  for (let i = 0; i < n; i++) await new Promise((done) => setTimeout(done, 1));
};

describe('every member of a data source, as Fieldia awaits it', () => {
  it('reads every member the interface has', () => {
    expect(MEMBERS).toEqual(expect.arrayContaining(['load', 'save', 'onchange', 'search', 'submit', 'options', 'upload', 'list', 'merge', 'pay']));
    expect(MEMBERS.length).toBeGreaterThan(40);
  });

  it.each(MEMBERS)('%s: refused at once, handled where it is made, and Fieldia’s promise the engine’s own', async (member) => {
    const app = { [member]: () => Promise.reject(new Error(member)) } as unknown as DataSource;
    const source = withDeadlines(app, undefined, 'No answer') as unknown as Record<string, (request: object) => Promise<unknown>>;
    const answer = source[member]({});
    expect(answer.constructor).toBe(OwnPromise);
    // Awaited as Fieldia's own code awaits: natively, in an async function of the engine's.
    await expect((async () => await answer)()).rejects.toThrow(member);
    await turns();
    expect(said()).toEqual([]);
  });

  it.each(MEMBERS)('%s: a value and a refusal later reach Fieldia as the app gave them', async (member) => {
    const value = { member };
    const kept = withDeadlines({ [member]: () => Promise.resolve(value) } as unknown as DataSource, undefined, 'No answer') as unknown as Record<string, (request: object) => Promise<unknown>>;
    await expect(kept[member]({})).resolves.toBe(value);
    const later = withDeadlines({ [member]: () => new Promise((_, reject) => setTimeout(() => reject(new Error(`${member} later`)), 2)) } as unknown as DataSource, undefined, 'No answer') as unknown as Record<string, (request: object) => Promise<unknown>>;
    await expect(later[member]({})).rejects.toThrow(`${member} later`);
    await turns();
    expect(said()).toEqual([]);
  });
});

describe('an answer the engine’s own already', () => {
  it.each(['upload', 'merge', 'pay'])('%s: handed to Fieldia as it is, its answer not a moment later', async (member) => {
    const own = (OwnPromise as PromiseConstructor).resolve({ member });
    const source = withDeadlines({ [member]: () => own } as unknown as DataSource, undefined, 'No answer') as unknown as Record<string, (request: object) => Promise<unknown>>;
    expect(source[member]({})).toBe(own);
  });
});

describe('a form’s requests refused at once: said by the form, never left unhandled', () => {
  const page = {
    fieldia: '0.13',
    id: 'order',
    data: { kind: 'record', model: 'sale.order' },
    fields: {
      qty: { type: 'integer', label: 'Quantity' },
      branch: { type: 'selection', label: 'Branch', options: [], optionsFrom: { list: 'branches' } },
      partner: { type: 'many2one', label: 'Customer', relation: 'res.partner' },
    },
    layout: { type: 'sections', id: 'all', children: [{ type: 'field', id: 'f-qty', field: 'qty' }, { type: 'field', id: 'f-branch', field: 'branch' }, { type: 'field', id: 'f-partner', field: 'partner' }] },
  } as unknown as Page;
  const refused = (what: string) => () => Promise.reject(new Error(`${what} refused`));

  it('its record’s load, its choices, a search, its onchange and its save', async () => {
    const form = createForm({
      page,
      recordId: 7,
      dataSource: { load: refused('load'), options: refused('options'), search: refused('search'), onchange: refused('onchange'), save: refused('save') } as unknown as DataSource,
    });
    await form.load().catch(() => undefined);
    form.loadChoices('branch');
    await form.search('partner', 'Ac').catch(() => undefined);
    form.setValue('qty', 3);
    await form.settled();
    expect(await form.save()).toBe(false);
    await turns();
    expect(said()).toEqual([]);
  });

  it('a response’s send', async () => {
    const form = createForm({ page: { ...page, data: { kind: 'responses' } } as Page, dataSource: { submit: refused('submit') } as unknown as DataSource });
    form.setValue('qty', 2);
    expect(await form.save()).toBe(false);
    await turns();
    expect(said()).toEqual([]);
  });
});
