import { assistStandIn, createMemoryDataSource, type DataSource, type MemoryDataSource, type Page, type RewriteRequest, type RewriteResult, type SuggestRequest, type SuggestResult } from '@fieldia/core';
import { assistPart } from './viewer-parts';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * AI help on a form, as a person meets it: Fill from text proposes values from words pasted, each shown on its field —
 * the value it would take the place of, the new one, Accept and Reject — with Accept all over the page, nothing written
 * until it is accepted, and Undo after. A text field's Draft and Polish propose its words the same way. A proposal for
 * a record no longer shown is laid nowhere; a field typed in while it was asked keeps what was typed.
 */

const SIGNATURE = ['Kind regards,', 'Mona Adel', 'Sales Director | Nile Traders', 'T: +20 2 2345 6789', 'mona.adel@niletraders.example', 'www.niletraders.example', '12 Corniche St, Garden City, Cairo, Egypt'].join('\n');

const page = (more: Partial<Page> = {}): Page =>
  ({
    fieldia: '0.11',
    id: 'company',
    title: 'Company',
    data: { kind: 'record', model: 'partner' },
    fields: {
      name: { type: 'char', label: 'Company' },
      email: { type: 'char', label: 'Email' },
      phone: { type: 'char', label: 'Phone' },
      website: { type: 'char', label: 'Website' },
      city: { type: 'char', label: 'City' },
      country_id: { type: 'many2one', label: 'Country', relation: 'country' },
      notes: { type: 'text', label: 'Notes' },
      contacts: {
        type: 'one2many',
        label: 'Contacts',
        relation: 'partner.contact',
        fields: { name: { type: 'char', label: 'Name' }, function: { type: 'char', label: 'Job title' }, email: { type: 'char', label: 'Email' } },
      },
    },
    layout: {
      type: 'sections',
      id: 's',
      children: [
        {
          type: 'section',
          id: 'g',
          children: [
            ...['name', 'email', 'phone', 'website', 'city', 'country_id'].map((field) => ({ type: 'field', id: `f-${field}`, field })),
            { type: 'field', id: 'f-notes', field: 'notes', options: { rewrite: ['draft', 'polish'] } },
            { type: 'field', id: 'f-contacts', field: 'contacts', columns: ['name', 'function', 'email'] },
          ],
        },
      ],
    },
    suggest: {},
    ...more,
  }) as Page;

const records = () => ({ partner: { 1: { name: 'Delta Foods', email: 'orders@deltafoods.example', notes: '' }, 2: { name: 'Sinai Outfitters' } }, country: { 1: { name: 'Egypt' }, 2: { name: 'Jordan' } } });
const source = (more: Parameters<typeof createMemoryDataSource>[0] = {}) => createMemoryDataSource({ records: records(), assist: assistStandIn({ drafts: { 'partner.notes': (values) => `Met ${values['name']} at the fair.` } }), ...more });

let handle: ViewerHandle | null = null;
let host: HTMLElement;
beforeAll(() => assistPart.load());
beforeEach(() => jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] }));
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
  jest.useRealTimers();
});
const pass = (ms = 0) => jest.advanceTimersByTimeAsync(ms);

async function mount(options: Partial<ViewerOptions> & { dataSource: DataSource }, shown: Page = page()) {
  host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page: shown, ...options });
  await pass(0);
  await pass(0);
  return handle;
}
const button = (name: string, within: ParentNode = host) => [...within.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === name && !b.closest('[hidden]') && !b.hidden) ?? null;
const proposal = (field: string) => host.querySelector<HTMLElement>(`.fd-field[data-path="${field}"] .fd-proposal`);
const review = () => host.querySelector<HTMLElement>('.fd-assist-review');
const values = () => handle?.form.getState().values ?? {};
const dialog = () => host.querySelector<HTMLElement>('.fd-assist-dialog');

/** Fill from text pressed, the words pasted, Propose values pressed: once the answer is in. */
async function fillFrom(text: string) {
  button('Fill from text')?.click();
  const box = dialog()?.querySelector('textarea') as HTMLTextAreaElement;
  box.value = text;
  button('Propose values', dialog() as HTMLElement)?.click();
  await pass(0);
  await pass(0);
}

describe('Fill from text', () => {
  it('says what to do where Propose values is pressed with nothing pasted or added, and lets it go as words come', async () => {
    // The owner's walk of 0.29: pressed empty, it did nothing and said nothing.
    const ds = source();
    await mount({ dataSource: ds });
    button('Fill from text')?.click();
    button('Propose values', dialog() as HTMLElement)?.click();
    await pass(0);
    const said = dialog()?.querySelector<HTMLElement>('.fd-assist-problem');
    expect([said?.hidden, said?.textContent]).toEqual([false, 'Paste or add what to fill from']);
    expect(ds.calls.filter((call) => call.method === 'suggest')).toEqual([]);
    const box = dialog()?.querySelector('textarea') as HTMLTextAreaElement;
    expect(document.activeElement).toBe(box);
    box.value = 'Lina';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    expect(said?.hidden).toBe(true);
  });

  it('is offered where the page asks and the source can answer — hidden, never disabled, where it cannot', async () => {
    await mount({ dataSource: source() });
    expect(button('Fill from text')).not.toBeNull();
    handle?.destroy();
    const plain = createMemoryDataSource({ records: records() });
    await mount({ dataSource: plain });
    expect(button('Fill from text')).toBeNull();
    expect(host.querySelector('.fd-assist-bar')?.hasAttribute('hidden')).toBe(true);
    // No tools on the notes either, where the source has no rewrite.
    expect(host.querySelector('.fd-assist-tools')).toBeNull();
  });

  it('shows each value proposed on its field, old and new, writing none until it is accepted', async () => {
    const ds = source();
    await mount({ dataSource: ds, recordId: 1 });
    await fillFrom(SIGNATURE);
    expect(dialog()).toBeNull();
    // Nothing written: the record holds what it held.
    expect(values()['name']).toBe('Delta Foods');
    expect(proposal('name')?.textContent).toContain('Delta Foods → ');
    expect(proposal('name')?.querySelector('ins')?.textContent).toBe('Nile Traders');
    expect(proposal('email')?.querySelector('del')?.textContent).toBe('orders@deltafoods.example');
    // An empty field: the new value alone.
    expect(proposal('phone')?.querySelector('del')).toBeNull();
    expect(proposal('phone')?.querySelector('ins')?.textContent).toBe('+20 2 2345 6789');
    // A link by its name, looked for as a name typed is: the record so called.
    expect(proposal('country_id')?.querySelector('ins')?.textContent).toBe('Egypt');
    // The person as a line to add.
    expect(proposal('contacts')?.textContent).toContain('1 line to add');
    expect(proposal('contacts')?.textContent).toContain('Mona Adel · Sales Director · mona.adel@niletraders.example');
    expect(review()?.querySelector('.fd-assist-review-text')?.textContent).toBe('7 values proposed. Review each on its field, or accept them all. Nothing is kept until you accept it.');
    // The app's why under it: here the stand-in's, which says what it is.
    expect(review()?.querySelector('.fd-assist-review-why')?.textContent).toMatch(/^Stand-in AI, no model: read by its patterns/);
    expect(handle?.form.getState().dirty).toEqual([]);
    // The source was asked with the fields the person can set, and the words pasted.
    const asked = ds.calls.find((call) => call.method === 'suggest')?.request as SuggestRequest;
    expect(asked.fields).toEqual(['name', 'email', 'phone', 'website', 'city', 'country_id', 'notes', 'contacts']);
    expect(asked.from).toEqual({ text: SIGNATURE });
    expect(asked.recordId).toBe(1);
  });

  it('keeps one on Accept, lets one go on Reject, and Undo puts back what was there', async () => {
    await mount({ dataSource: source(), recordId: 1 });
    await fillFrom(SIGNATURE);
    button('Accept', proposal('email') as HTMLElement)?.click();
    expect(values()['email']).toBe('mona.adel@niletraders.example');
    expect(handle?.form.getState().dirty).toEqual(['email']);
    expect(proposal('email')?.textContent).toContain('Proposal kept');
    button('Reject', proposal('name') as HTMLElement)?.click();
    expect(proposal('name')).toBeNull();
    expect(values()['name']).toBe('Delta Foods');
    button('Undo', proposal('email') as HTMLElement)?.click();
    expect(values()['email']).toBe('orders@deltafoods.example');
    expect(proposal('email')).toBeNull();
  });

  it('is one change to undo, whichever Undo is pressed — its own or the record’s, Ctrl+Z (0.31)', async () => {
    await mount({ dataSource: source(), recordId: 1 });
    const form = handle!.form;
    const poll = async (check: () => unknown) => {
      for (let turn = 0; turn < 200 && !check(); turn++) await new Promise((done) => setTimeout(done, 5));
      expect(check()).toBeTruthy();
    };
    await fillFrom(SIGNATURE);
    button('Accept', proposal('email') as HTMLElement)?.click();
    await poll(() => form.history().undo);
    expect(form.history().undo).toMatchObject({ field: 'email' });
    // Its own Undo takes the change back in the record's history: nothing left there to take back again, Redo makes it again.
    button('Undo', proposal('email') as HTMLElement)?.click();
    expect(values()['email']).toBe('orders@deltafoods.example');
    expect(form.history()).toMatchObject({ undo: null, redo: { field: 'email' } });
    // Accepted again, then the record's Undo: the value back, and the proposal's note with its Undo gone with it.
    await fillFrom(SIGNATURE);
    button('Accept', proposal('email') as HTMLElement)?.click();
    expect(values()['email']).toBe('mona.adel@niletraders.example');
    expect(form.undo()).toMatchObject({ field: 'email' });
    expect(values()['email']).toBe('orders@deltafoods.example');
    expect(proposal('email')).toBeNull();
  });

  it('keeps them all on Accept all — a line added, a link by its record — and Undo all puts them back', async () => {
    await mount({ dataSource: source(), recordId: 1 });
    await fillFrom(SIGNATURE);
    button('Accept all')?.click();
    expect(values()).toMatchObject({ name: 'Nile Traders', email: 'mona.adel@niletraders.example', phone: '+20 2 2345 6789', website: 'https://www.niletraders.example', city: 'Cairo', country_id: { id: 1, label: 'Egypt' } });
    expect((values()['contacts'] as { values: unknown }[]).map((line) => line.values)).toEqual([{ name: 'Mona Adel', function: 'Sales Director', email: 'mona.adel@niletraders.example' }]);
    expect(review()?.textContent).toContain('Kept 7 values');
    expect(host.querySelectorAll('.fd-proposal')).toHaveLength(0);
    button('Undo', review() as HTMLElement)?.click();
    expect(values()).toMatchObject({ name: 'Delta Foods', email: 'orders@deltafoods.example', phone: null, country_id: null });
    expect(values()['contacts']).toEqual([]);
    expect(handle?.form.getState().dirty).toEqual([]);
  });

  it('never proposes — nor keeps on Accept all — a value for a field the page does not draw (S-L2: pasted words steering a model)', async () => {
    const hidden = page({ suggest: { fields: ['name', 'email', 'phone', 'city'] } });
    const sections = hidden.layout as unknown as { children: { children: { field?: string; invisible?: unknown }[] }[] };
    sections.children[0].children.find((node) => node.field === 'email')!.invisible = true;
    await mount({ dataSource: source(), recordId: 1 }, hidden);
    await fillFrom(SIGNATURE);
    expect(proposal('email')).toBeNull();
    expect(review()?.textContent).toContain('Email');
    button('Accept all')?.click();
    expect(values()).toMatchObject({ name: 'Nile Traders', city: 'Cairo', email: 'orders@deltafoods.example' });
  });

  it('lets the rest go on Reject all, what was kept keeping its Undo', async () => {
    await mount({ dataSource: source(), recordId: 1 });
    await fillFrom(SIGNATURE);
    button('Accept', proposal('city') as HTMLElement)?.click();
    button('Reject all')?.click();
    expect(host.querySelectorAll('.fd-proposal:not(.fd-proposal-kept)')).toHaveLength(0);
    expect(values()['city']).toBe('Cairo');
    expect(values()['email']).toBe('orders@deltafoods.example');
    button('Undo', proposal('city') as HTMLElement)?.click();
    expect(values()['city']).toBeNull();
  });

  it('leaves a field typed in while it was asked as the person typed it, and says so', async () => {
    let answer: (result: SuggestResult) => void = () => undefined;
    const ds = source();
    const slow = { ...ds, suggest: () => new Promise<SuggestResult>((resolve) => (answer = resolve)) };
    await mount({ dataSource: slow, recordId: 1 });
    await fillFrom('anything');
    // Typed meanwhile, as the app's model reads.
    handle?.form.setValue('email', 'mine@delta.example');
    answer({ values: { email: 'theirs@nile.example', city: 'Cairo' } });
    await pass(0);
    await pass(0);
    expect(proposal('email')).toBeNull();
    expect(proposal('city')?.querySelector('ins')?.textContent).toBe('Cairo');
    expect(review()?.textContent).toContain('Left as you typed: Email');
    expect(values()['email']).toBe('mine@delta.example');
  });

  it('lets a proposal go as the person types in its field', async () => {
    await mount({ dataSource: source(), recordId: 1 });
    await fillFrom(SIGNATURE);
    const box = host.querySelector('.fd-field[data-path="city"] input') as HTMLInputElement;
    box.value = 'Giza';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(values()['city']).toBe('Giza');
    expect(proposal('city')).toBeNull();
    expect(proposal('email')).not.toBeNull();
  });

  it('lays an answer for a record no longer shown nowhere, and lets go what was proposed when another is shown', async () => {
    let answer: (result: SuggestResult) => void = () => undefined;
    const slow = { ...source(), suggest: () => new Promise<SuggestResult>((resolve) => (answer = resolve)) };
    await mount({ dataSource: slow, recordId: 1 });
    await fillFrom('anything');
    await handle?.form.openRecord(2);
    await pass(0);
    answer({ values: { city: 'Cairo' } });
    await pass(0);
    expect(host.querySelectorAll('.fd-proposal')).toHaveLength(0);
    expect(values()['city']).toBeNull();
    // Proposed, then another shown: they go.
    handle?.destroy();
    await mount({ dataSource: source(), recordId: 1 });
    await fillFrom(SIGNATURE);
    expect(host.querySelectorAll('.fd-proposal').length).toBeGreaterThan(0);
    await handle?.form.openRecord(2);
    await pass(0);
    expect(host.querySelectorAll('.fd-proposal')).toHaveLength(0);
    expect(review()?.hidden).toBe(true);
  });

  it('lets go what was proposed on the person’s Discard', async () => {
    await mount({ dataSource: source(), recordId: 1 });
    await fillFrom(SIGNATURE);
    button('Accept', proposal('city') as HTMLElement)?.click();
    handle?.form.reset();
    await pass(0);
    expect(host.querySelectorAll('.fd-proposal')).toHaveLength(0);
    expect(values()['city']).toBeNull();
  });

  it('says a name no record has, and nothing it can fill, without laying either', async () => {
    const odd = { ...source(), suggest: async (): Promise<SuggestResult> => ({ values: { country_id: 'Egyptt', logo: 'x' } }) };
    await mount({ dataSource: odd, recordId: 1 });
    await fillFrom('anything');
    expect(dialog()?.querySelector('.fd-assist-problem')?.textContent).toBe('Nothing in it fills this form.');
    const none = { ...source(), suggest: async (): Promise<SuggestResult> => ({ values: { country_id: 'Egyptt', city: 'Luxor' } }) };
    handle?.destroy();
    await mount({ dataSource: none, recordId: 1 });
    await fillFrom('anything');
    expect(review()?.textContent).toContain('Not used: Country (nothing is called “Egyptt”)');
    expect(proposal('city')).not.toBeNull();
  });

  it('says why when the source fails, keeping the words pasted', async () => {
    const failing = { ...source(), suggest: async (): Promise<SuggestResult> => Promise.reject(new Error('The model is busy')) };
    await mount({ dataSource: failing, recordId: 1 });
    await fillFrom('some words');
    expect(dialog()?.querySelector('.fd-assist-problem')?.textContent).toBe('Nothing could be proposed: The model is busy');
    expect((dialog()?.querySelector('textarea') as HTMLTextAreaElement).value).toBe('some words');
  });
});

describe('a text field’s Draft and Polish', () => {
  const tools = () => [...host.querySelectorAll<HTMLButtonElement>('.fd-field[data-path="notes"] .fd-assist-tool')].filter((b) => !b.hidden).map((b) => b.textContent);

  it('offers Draft, and Polish once the field holds words; each proposal shown under it to accept', async () => {
    const ds = source();
    await mount({ dataSource: ds, recordId: 1 });
    expect(tools()).toEqual(['Draft']);
    button('Draft')?.click();
    await pass(0);
    await pass(0);
    expect(proposal('notes')?.querySelector('ins')?.textContent).toBe('Met Delta Foods at the fair.');
    expect(values()['notes']).toBe('');
    button('Accept', proposal('notes') as HTMLElement)?.click();
    expect(values()['notes']).toBe('Met Delta Foods at the fair.');
    expect(tools()).toEqual(['Draft', 'Polish']);
    handle?.form.setValue('notes', 'met them , pls call asap');
    button('Polish')?.click();
    await pass(0);
    await pass(0);
    expect(proposal('notes')?.querySelector('ins')?.textContent).toBe('Met them, please call as soon as possible.');
    const asked = ds.calls.filter((call) => call.method === 'rewrite').map((call) => (call.request as RewriteRequest).how);
    expect(asked).toEqual(['draft', 'polish']);
  });

  it('lets an answer go when the person typed in the field meanwhile', async () => {
    let answer: (result: RewriteResult) => void = () => undefined;
    const slow = { ...source(), rewrite: () => new Promise<RewriteResult>((resolve) => (answer = resolve)) };
    await mount({ dataSource: slow, recordId: 1 });
    button('Draft')?.click();
    await pass(0);
    expect(host.querySelector('.fd-assist-tool[aria-busy="true"]')?.textContent).toBe('Writing…');
    handle?.form.setValue('notes', 'my own words');
    answer({ text: 'Their words.' });
    await pass(0);
    await pass(0);
    expect(proposal('notes')).toBeNull();
    expect(values()['notes']).toBe('my own words');
  });

  it('says under its tools why no words came, and lets that go as it is asked again', async () => {
    let fail = true;
    const failing = { ...source(), rewrite: async (request: RewriteRequest): Promise<RewriteResult> => (fail ? Promise.reject(new Error('The model is busy')) : { text: `Drafted for ${request.field}.` }) };
    await mount({ dataSource: failing, recordId: 1 });
    button('Draft')?.click();
    await pass(0);
    await pass(0);
    expect(host.querySelector('.fd-field[data-path="notes"] .fd-assist-failed')?.textContent).toBe('No words came back: The model is busy');
    expect(values()['notes']).toBe('');
    fail = false;
    button('Draft')?.click();
    await pass(0);
    await pass(0);
    expect(host.querySelector('.fd-assist-failed')).toBeNull();
    expect(proposal('notes')?.querySelector('ins')?.textContent).toBe('Drafted for notes.');
  });

  it('hides its tools on a record the person can only read', async () => {
    await mount({ dataSource: source(), recordId: 1, readonly: true });
    expect(tools()).toEqual([]);
    expect(button('Fill from text')).toBeNull();
  });
});

describe('the app’s own proposal', () => {
  it('shows values an app proposes the same way, on a page that asks for no AI help', async () => {
    const plain = createMemoryDataSource({ records: records() });
    const asksNone = page({ suggest: undefined });
    delete (asksNone.layout as { children: { children: { options?: unknown }[] }[] }).children[0].children[6].options;
    await mount({ dataSource: plain, recordId: 1 }, asksNone);
    expect(host.querySelector('.fd-assist-bar')).toBeNull();
    const laid = await handle?.propose({ city: 'Alexandria', email: 'orders@deltafoods.example', nope: 1 }, { why: 'From the agent’s last call.' });
    expect(laid).toBe(1);
    expect(proposal('city')?.querySelector('ins')?.textContent).toBe('Alexandria');
    expect(review()?.textContent).toContain('1 value proposed');
    expect(review()?.textContent).toContain('From the agent’s last call.');
    expect(review()?.textContent).toContain('Not used: nope');
    button('Accept all')?.click();
    expect(values()['city']).toBe('Alexandria');
  });

  it('proposes nothing on a list', async () => {
    const list = { ...page({ suggest: undefined }), layout: { type: 'list', id: 'l', columns: ['name'] } } as Page;
    await mount({ dataSource: source() as MemoryDataSource }, list);
    expect(await handle?.propose({ name: 'x' })).toBe(0);
  });
});

describe('AI help on a text kept in two languages', () => {
  // A company's name and notes typed in English and Arabic (`translate`): a proposal fills the language the person is
  // looking at — the reader's, until they switch — never the other: each language is typed by a person.
  const bilingual = (): Page => {
    const shown = page();
    shown.fields['name'] = { type: 'char', label: 'Company', translate: ['en', 'ar'] } as Page['fields'][string];
    shown.fields['notes'] = { type: 'text', label: 'Notes', translate: ['en', 'ar'] } as Page['fields'][string];
    return shown;
  };
  const twoLanguages = () => ({ partner: { 1: { name: { ar: 'نيل تريدرز' }, notes: { en: 'met them at the fair pls call', ar: 'قابلناهم في المعرض' } } }, country: records().country });
  const tab = (field: string, lang: string) => host.querySelector<HTMLButtonElement>(`.fd-field[data-path="${field}"] .fd-lang-tab[lang="${lang}"]`);

  it('fills the reader’s language alone, says which, and leaves the other as it was', async () => {
    const ds = source({ records: twoLanguages() });
    await mount({ dataSource: ds, recordId: 1 }, bilingual());
    await fillFrom(SIGNATURE);
    const asked = ds.calls.find((call) => call.method === 'suggest')?.request as SuggestRequest;
    expect(asked.languages).toEqual({ name: 'en', notes: 'en' });
    expect(proposal('name')?.querySelector('strong')?.textContent).toBe('Proposed in English: ');
    expect(proposal('name')?.querySelector('ins')?.getAttribute('lang')).toBe('en');
    expect(proposal('name')?.querySelector('ins')?.textContent).toBe('Nile Traders');
    // Nothing in English yet: no old value struck through — the Arabic is not this language's.
    expect(proposal('name')?.querySelector('del')).toBeNull();
    // The stand-in says it filled one language alone.
    expect(review()?.querySelector('.fd-assist-review-why')?.textContent).toContain("Company in English only: each other language is a person's to type.");
    button('Accept', proposal('name') as HTMLElement)?.click();
    expect(values()['name']).toEqual({ ar: 'نيل تريدرز', en: 'Nile Traders' });
  });

  it('fills the language the person switched to, and takes no other from an answer that gives both', async () => {
    const answer = jest.fn(async (request: SuggestRequest): Promise<SuggestResult> => ({ values: { name: { ar: 'شركة النيل', en: 'Nile Company' } }, why: `Filled ${JSON.stringify(request.languages)}` }));
    const ds = createMemoryDataSource({ records: twoLanguages(), assist: { suggest: answer } });
    await mount({ dataSource: ds, recordId: 1 }, bilingual());
    tab('name', 'ar')?.click();
    await pass(0);
    await fillFrom('Nile Company, Cairo');
    expect(answer.mock.calls[0][0].languages).toEqual({ name: 'ar', notes: 'en' });
    expect(proposal('name')?.querySelector('strong')?.textContent).toBe('Proposed in Arabic: ');
    expect(proposal('name')?.querySelector('del')?.textContent).toBe('نيل تريدرز');
    expect(proposal('name')?.querySelector('ins')?.textContent).toBe('شركة النيل');
    button('Accept all')?.click();
    // The English the answer gave too is never taken: a person types it.
    expect(values()['name']).toEqual({ ar: 'شركة النيل' });
  });

  it('polishes the words of the language shown, and fills that language alone', async () => {
    const ds = source({ records: twoLanguages() });
    await mount({ dataSource: ds, recordId: 1 }, bilingual());
    button('Polish')?.click();
    await pass(0);
    await pass(0);
    const asked = ds.calls.find((call) => call.method === 'rewrite')?.request as RewriteRequest;
    expect([asked.text, asked.language]).toEqual(['met them at the fair pls call', 'en']);
    expect(proposal('notes')?.querySelector('strong')?.textContent).toBe('Proposed in English: ');
    expect(proposal('notes')?.querySelector('.fd-proposal-why')?.textContent).toContain('Written in English only');
    button('Accept', proposal('notes') as HTMLElement)?.click();
    expect(values()['notes']).toEqual({ en: 'Met them at the fair please call.', ar: 'قابلناهم في المعرض' });
  });
});

describe('AI help beside the other 0.29 fields', () => {
  it('fills a field scanned into with the camera as any text, its Scan button kept beside its box', async () => {
    const scanned = page();
    const children = (scanned.layout as { children: { children: { field?: string; options?: Record<string, unknown> }[] }[] }).children[0].children;
    children.find((node) => node.field === 'email')!.options = { scan: true };
    await mount({ dataSource: source(), recordId: 1 }, scanned);
    expect(host.querySelector('.fd-field[data-path="email"] .fd-scan-button')).not.toBeNull();
    await fillFrom(SIGNATURE);
    expect(proposal('email')?.querySelector('ins')?.textContent).toBe('mona.adel@niletraders.example');
    button('Accept', proposal('email') as HTMLElement)?.click();
    expect(values()['email']).toBe('mona.adel@niletraders.example');
    expect(host.querySelector('.fd-field[data-path="email"] .fd-scan-button')).not.toBeNull();
    expect((host.querySelector('.fd-field[data-path="email"] input') as HTMLInputElement).value).toBe('mona.adel@niletraders.example');
  });

  it('never proposes a photo set’s photos, as it never proposes a file', async () => {
    const withPhotos = page({ suggest: {} });
    withPhotos.fields['photos'] = { type: 'image', label: 'Photos', multiple: true } as Page['fields'][string];
    (withPhotos.layout as { children: { children: unknown[] }[] }).children[0].children.push({ type: 'field', id: 'f-photos', field: 'photos', widget: 'photos' });
    const ds = source();
    await mount({ dataSource: ds, recordId: 1 }, withPhotos);
    await fillFrom(SIGNATURE);
    expect((ds.calls.find((call) => call.method === 'suggest')?.request as SuggestRequest).fields).not.toContain('photos');
    expect(await handle?.propose({ photos: [{ name: 'a.jpg' }] })).toBe(0);
    expect(proposal('photos')).toBeNull();
  });
});
