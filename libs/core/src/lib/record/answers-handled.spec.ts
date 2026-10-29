import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { installZonePromises } from '../../../../../testing/zone-promises';
import { createForm, createMemoryDataSource, type DataSource, type Page } from '../../index';
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

/**
 * The app's own hooks, as a form made alone takes them — its `onAction`, its `confirm`, its own host (open, ask, file,
 * print, post), its outbox's store: each answer handled the moment it is given (deadline.ts, `answerOf`), refused at once
 * or before it was asked, never said unhandled while Fieldia's `await` comes to it a microtask late. Each stops the steps
 * it is part of, or keeps the work, as a refusal does.
 */
describe('the app’s hooks, each answer handled where it is given', () => {
  const page = {
    fieldia: '0.13',
    id: 'order',
    data: { kind: 'record', model: 'sale.order' },
    fields: { name: { type: 'char', label: 'Order' } },
    layout: { type: 'sections', id: 'all', children: [{ type: 'field', id: 'f-name', field: 'name' }] },
  } as unknown as Page;
  const refused = (what: string) => () => Promise.reject(new Error(`${what} refused`));
  /** Refused before it was asked, in an earlier turn, its first asker having handled it: what the app kept. */
  const already = async (what: string) => {
    const kept = Promise.reject(new Error(`${what} refused`));
    kept.then(undefined, () => undefined);
    await turns(2);
    return () => kept;
  };
  const host = (answers: Partial<Record<'open' | 'ask' | 'file' | 'print' | 'post', () => Promise<never>>>) => ({ say: () => undefined, open: refused('open'), ask: refused('ask'), ...answers });

  it.each([['at once', refused('onAction')], ['already', null]] as const)('a call step’s onAction, refused %s', async (_, given) => {
    const onAction = given ?? (await already('onAction'));
    const form = createForm({ page, recordId: null, onAction });
    const result = await form.run([{ do: 'call', action: 'price' }, { do: 'set', field: 'name', value: "'never'" }]);
    expect([result.done, result.message]).toEqual([false, 'onAction refused']);
    await turns();
    expect(said()).toEqual([]);
  });

  it.each(['open', 'ask', 'print', 'post'] as const)('its own host’s %s, refused at once', async (member) => {
    const form = createForm({ page, recordId: null, host: host({ [member]: refused(member), file: refused('file'), print: refused('print'), post: refused('post') }) as never });
    const step = { open: { do: 'open', page: 'customer' }, ask: { do: 'ask', message: 'Sure?' }, print: { do: 'print' }, post: { do: 'post', message: 'Priced' } }[member];
    const result = await form.run([step as never, { do: 'set', field: 'name', value: "'never'" }]);
    expect(result.done).toBe(false);
    expect(form.getState().values['name']).not.toBe('never');
    await turns();
    expect(said()).toEqual([]);
  });

  it('its own host’s file, for a call’s answer, refused at once', async () => {
    const form = createForm({ page, recordId: null, onAction: () => ({ file: { name: 'quote.pdf', url: 'https://example.com/quote.pdf' } }) as never, host: host({ file: refused('file') }) as never });
    await form.run([{ do: 'call', action: 'quote' }]).catch(() => undefined);
    await turns();
    expect(said()).toEqual([]);
  });

  it.each([['at once', refused('confirm')], ['already', null]] as const)('its confirm, asked whether a change may go, refused %s: the change kept', async (_, given) => {
    const confirm = given ?? (await already('confirm'));
    const form = createForm({ page, recordId: null, confirm: confirm as never });
    form.setValue('name', 'S00001');
    // The one way out, every change counting, asks whether the change may go: a refusal keeps it.
    expect(await form.leave({ changes: true })).toBe(false);
    expect(form.getState().values['name']).toBe('S00001');
    await turns();
    expect(said()).toEqual([]);
  });

  it('its outbox’s store, refused at once: the send said, nothing left unhandled', async () => {
    const visit = { ...page, id: 'visit', data: { kind: 'responses' }, outbox: true } as unknown as Page;
    const store = { list: refused('list'), put: refused('put'), delete: refused('delete'), claim: refused('claim') };
    const form = createForm({ page: visit, dataSource: { submit: () => Promise.reject(Object.assign(new TypeError('Failed to fetch'), { name: 'TypeError' })) } as unknown as DataSource, outbox: store as never });
    form.setValue('name', 'B-12');
    await form.save().catch(() => undefined);
    await form.joined('outbox')?.send().catch(() => undefined);
    await turns();
    expect(said()).toEqual([]);
  });
});

describe('the app’s own payment step', () => {
  it('refused at once: nothing paid, nothing sent, nothing left unhandled', async () => {
    const enquiry = {
      fieldia: '0.13',
      id: 'enquiry',
      data: { kind: 'responses' },
      payment: { label: 'Reservation fee', amount: 10000, currency: 'EGP' },
      fields: { name: { type: 'char', label: 'Your name' } },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }] },
    } as unknown as Page;
    const dataSource = createMemoryDataSource();
    const form = createForm({
      page: enquiry,
      dataSource,
      host: { open: async () => ({ saved: false }), say: () => undefined, ask: async () => true, pay: () => Promise.reject(new Error('The card was declined')) } as never,
    });
    form.setValue('name', 'Hana');
    expect(await form.save()).toBe(false);
    expect(dataSource.responses).toEqual([]);
    await turns();
    expect(said()).toEqual([]);
  });
});

describe('the app’s own function, asking its server', () => {
  it.each([['at once', () => Promise.reject(new Error('price refused'))], ['already', null]] as const)('refused %s: its value empty, the form goes on, nothing left unhandled', async (_, given) => {
    let kept: Promise<never> | null = null;
    if (!given) {
      kept = Promise.reject(new Error('price refused'));
      kept.then(undefined, () => undefined);
      await turns(2);
    }
    const priced = {
      fieldia: '0.13',
      id: 'priced',
      data: { kind: 'responses' },
      fields: { qty: { type: 'integer', label: 'Quantity' }, price: { type: 'monetary', label: 'Price', currency: 'EGP', compute: 'unitPrice(qty)' } },
      layout: { type: 'sections', id: 'all', children: [{ type: 'field', id: 'f-qty', field: 'qty' }, { type: 'field', id: 'f-price', field: 'price' }] },
    } as unknown as Page;
    const form = createForm({ page: priced, functions: { unitPrice: () => (given ? given() : (kept as Promise<never>)) } });
    form.setValue('qty', 2);
    await form.settled();
    await turns();
    expect(form.getState().values['price'] ?? null).toBeNull();
    expect(said()).toEqual([]);
  });
});
