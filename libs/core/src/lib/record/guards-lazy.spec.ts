import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '../format/page';

/**
 * The parts that guard a send fail closed (audit R-H1, S-M7): a payment, a code check, a time limit's clock, a link's
 * hidden fields, a record's approvals, options by condition, a text's languages and a page's limits each come in a part
 * of their own. One that could not come — offline, or refused as another version's — never lets a send go unchecked:
 * the send waits for it, asks for it once more, and then refuses in words naming it, nothing sent, the typing kept.
 * Each case fails one part in turn (its module throws as it loads, as a chunk does offline); this file starts with no
 * part loaded, and every case with fresh modules.
 */

/** How many times each part's module throws before it loads: the next asks for it fail that many times. */
const mockFailing: Record<string, number> = {};
const mockPart = (name: string, path: string) => {
  if ((mockFailing[name] ?? 0) > 0) {
    mockFailing[name]--;
    throw new Error(`Loading chunk fieldia.${name}.js failed`);
  }
  return jest.requireActual(path);
};
jest.mock('./pay-part', () => mockPart('pay', './pay-part'));
jest.mock('./verify-part', () => mockPart('verify', './verify-part'));
jest.mock('./prefill-part', () => mockPart('prefill', './prefill-part'));
jest.mock('./surveyflow-part', () => mockPart('surveyflow', './surveyflow-part'));
jest.mock('./approvals-part', () => mockPart('approvals', './approvals-part'));
jest.mock('./languages-part', () => mockPart('languages', './languages-part'));
jest.mock('./limits-part', () => mockPart('limits', './limits-part'));
jest.mock('../format/options-part', () => mockPart('options', '../format/options-part'));

beforeEach(() => {
  jest.resetModules();
  for (const name of Object.keys(mockFailing)) delete mockFailing[name];
});

/** The form and memory source, made afresh: each part asked for anew. */
async function fresh() {
  const { createForm } = await import('./form');
  const { createMemoryDataSource } = await import('./memory-data-source');
  const { formJoins, joinGuards } = await import('./joins');
  const { checkSubmission } = await import('./submission');
  return { createForm, createMemoryDataSource, formJoins, joinGuards, checkSubmission };
}
type Fresh = Awaited<ReturnType<typeof fresh>>;

const responses = (more: Partial<Page>, fields: Page['fields'] = {}, nodes: object[] = []): Page =>
  ({
    fieldia: '0.13',
    id: 'enquiry',
    data: { kind: 'responses' },
    fields: { name: { type: 'char', label: 'Name', required: true }, ...fields },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }, ...nodes] },
    ...more,
  }) as Page;

/** Each part that guards a send, a page that asks for it, and what the person is told when it never came. */
const CASES: { part: string; page: () => Page; record?: boolean; words: string; sent: (source: ReturnType<Fresh['createMemoryDataSource']>) => number; url?: string }[] = [
  { part: 'pay', page: () => responses({ payment: { label: 'Reservation fee', amount: 500, currency: 'EGP' } }), words: 'The payment step could not load, so nothing was sent.', sent: (source) => source.responses.length },
  {
    part: 'verify',
    page: () => responses({}, { phone: { type: 'char', label: 'Mobile' } }, [{ type: 'field', id: 'f-phone', field: 'phone', widget: 'phone', options: { verify: true } }]),
    words: 'The code check could not load, so nothing was sent.',
    sent: (source) => source.responses.length,
  },
  { part: 'surveyflow', page: () => responses({ timeLimit: { minutes: 10 } }), words: 'The time limit could not load, so nothing was sent.', sent: (source) => source.responses.length },
  { part: 'prefill', page: () => responses({ prefill: { fromUrl: ['agent_code'] } }, { agent_code: { type: 'char', label: 'Agent' } }), url: '?agent_code=mona', words: 'The answers from the link could not load, so nothing was sent.', sent: (source) => source.responses.length },
  {
    part: 'options',
    page: () =>
      responses({}, { extras: { type: 'selection', label: 'Extras', multiple: true, options: [{ value: 'garden', label: 'Garden', invisible: "name != 'villa'" }, { value: 'lift', label: 'Lift' }] } }, [{ type: 'field', id: 'f-extras', field: 'extras' }]),
    words: 'The check of the choices could not load, so nothing was sent.',
    sent: (source) => source.responses.length,
  },
  { part: 'limits', page: () => responses({ limits: { closes: '2026-11-20' } }), words: 'The check of whether this form takes answers could not load, so nothing was sent.', sent: (source) => source.responses.length },
  {
    part: 'languages',
    record: true,
    page: () => ({ ...responses({}), data: { kind: 'record', model: 'service' }, fields: { name: { type: 'char', label: 'Name', required: true, translate: ['en', 'ar'] } } }) as Page,
    words: 'The check of each language could not load, so nothing was saved.',
    sent: (source) => source.calls.filter((call) => call.method === 'save').length,
  },
  {
    part: 'approvals',
    record: true,
    page: () => ({ ...responses({ approval: {} }), data: { kind: 'record', model: 'service' } }) as Page,
    words: 'The approvals could not load, so nothing was saved.',
    sent: (source) => source.calls.filter((call) => call.method === 'save').length,
  },
];

const source = (make: Fresh['createMemoryDataSource']) =>
  make({
    records: { service: { 1: { name: 'Teeth cleaning' } } },
    approvals: { service: () => ({ levels: [{ id: 'finance', name: 'Finance', approvers: [{ id: 21, name: 'Mona Adel' }] }], asked: false }) },
  });

describe('a part that guards a send, never come', () => {
  it.each(CASES)('$part: the form is made and keeps the typing; the send waits, asks once more, and is refused in words', async (one) => {
    // Fails as the form asks for it, and again as the send asks once more.
    mockFailing[one.part] = 2;
    const { createForm, createMemoryDataSource } = await fresh();
    const dataSource = source(createMemoryDataSource);
    const form = createForm({ page: one.page(), dataSource, ...(one.record ? { recordId: 1 } : {}), ...(one.url ? { url: one.url } : {}), now: () => new Date('2026-11-01T10:00:00Z') });
    if (one.record) await form.load();
    const typed = one.part === 'languages' ? { en: 'Teeth cleaning', ar: 'تنظيف الأسنان' } : 'Mona';
    form.setValue('name', typed);
    expect(await form.save()).toBe(false);
    expect(one.sent(dataSource)).toBe(0);
    const state = form.getState();
    // Said in words, with what to do — the module comes by import() here, which a page keeps failed: a reload brings it.
    expect(state.saveProblem).toEqual({ kind: 'other', message: `${one.words} Reload the page and try again.` });
    expect(state.status).toBe('error');
    expect(state.values['name']).toEqual(typed);
    expect(state.sent ?? null).toBeNull();
  });

  it.each(CASES)('$part: one that failed as the form asked comes as the send asks once more, and the send goes through it', async (one) => {
    mockFailing[one.part] = 1;
    const { createForm, createMemoryDataSource } = await fresh();
    const dataSource = source(createMemoryDataSource);
    const form = createForm({ page: one.page(), dataSource, ...(one.record ? { recordId: 1 } : {}), ...(one.url ? { url: one.url } : {}), now: () => new Date('2026-11-01T10:00:00Z') });
    if (one.record) await form.load();
    form.setValue('name', one.part === 'languages' ? { en: 'Teeth cleaning', ar: 'تنظيف الأسنان' } : 'villa');
    if (one.part === 'verify') form.setValue('phone', '+201012345678');
    const saved = await form.save();
    if (one.part === 'pay') {
      // The payment asked for and taken: the send carries it.
      expect(saved).toBe(true);
      expect(dataSource.payments).toHaveLength(1);
      expect(dataSource.responses[0].payment).toMatchObject({ amount: 500, currency: 'EGP' });
    } else if (one.part === 'verify') {
      // The phone not proved: said under it, nothing sent.
      expect(saved).toBe(false);
      expect(form.getState().errors['phone']).toBe('Mobile is not confirmed: send a code and type it in');
      expect(one.sent(dataSource)).toBe(0);
    } else if (one.part === 'approvals') {
      expect(saved).toBe(true);
      expect(form.getState().approval).toBeTruthy();
    } else {
      expect([saved, form.getState().saveProblem, form.getState().errors]).toEqual([true, null, {}]);
      expect(one.sent(dataSource)).toBe(1);
    }
    if (one.part === 'surveyflow') expect(form.joined('surveyflow')).not.toBeNull();
    if (one.part === 'prefill') expect(dataSource.responses[0].values['agent_code']).toBe('mona');
    expect(form.getState().saveProblem).toBeNull();
  });

  it('a part that guards nothing (an outbox) never stops a send: it goes as it would have', async () => {
    mockFailing['outbox'] = 9;
    jest.doMock('./outbox-part', () => mockPart('outbox', './outbox-part'));
    const { createForm, createMemoryDataSource } = await fresh();
    const dataSource = createMemoryDataSource();
    const form = createForm({ page: responses({ outbox: true }), dataSource });
    form.setValue('name', 'Mona');
    expect(await form.save()).toBe(true);
    expect(dataSource.responses).toHaveLength(1);
  });

  it('a server’s check of the answers (`checkSubmission`) loads the parts it needs, and one that cannot load is a problem, never a check skipped', async () => {
    mockFailing['pay'] = 1;
    const { checkSubmission } = await fresh();
    const check = await checkSubmission(responses({ payment: { label: 'Reservation fee', amount: 500, currency: 'EGP' } }), { name: 'Mona' });
    expect(check).toMatchObject({ ok: false, problems: ['The answers could not be checked: pay could not load (Loading chunk fieldia.pay.js failed)'] });
    // Come the next time: the fee worked out, and none carried.
    expect(await checkSubmission(responses({ payment: { label: 'Reservation fee', amount: 500, currency: 'EGP' } }), { name: 'Mona' })).toMatchObject({ ok: false, due: { amount: 500, currency: 'EGP' }, problems: ['Reservation fee of 500 EGP is due, and the answers carry none'] });
  });

  it('every part that joins a form says whether it guards a send: a new one cannot leave it unsaid', async () => {
    const { joinGuards } = await fresh();
    expect(joinGuards()).toEqual([
      { name: 'outbox', guards: false },
      { name: 'prefill', guards: true },
      { name: 'verify', guards: true },
      { name: 'pay', guards: true },
      { name: 'surveyflow', guards: true },
      { name: 'approvals', guards: true },
      { name: 'live', guards: false },
    ]);
  });

  it('every part the form asks for is one `guardsIn` holds a send for, or one said to guard nothing', () => {
    const source = readFileSync(join(__dirname, 'form.ts'), 'utf8');
    const start = source.indexOf('async function guardsIn(');
    const body = source.slice(start, source.indexOf('\n  }\n', start));
    const asked = new Set([...source.matchAll(/(\w+Part)\.load\(/g)].map((found) => found[1]));
    // Ctrl+Z's own part: a change is kept until it comes, and a send never waits for an undo. The steps' own (the acts
    // part): a send waits for it only through its page's beforeSave steps, whose run stops the save where it cannot come.
    const guardsNothing = new Set(['pressUndoPart', 'formActsPart']);
    expect([...asked].filter((part) => !guardsNothing.has(part) && !body.includes(part))).toEqual([]);
    // The parts that join the form: every one whose `joinGate` names it, the same way.
    expect(body).toContain('joinGate(part, page, options)');
  });
});
