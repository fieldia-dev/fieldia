import { createMemoryDataSource, type DataSource, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * A page's opening, closing and limits, and Continue later, as a person meets them: a closed form's words in place of
 * its questions before anything is typed — when it opens, when it closed, full, sent already — with the page's own
 * words; a form closing on typed answers keeps them, a banner saying they can no longer be sent; Continue later beside
 * Submit and Next, what it kept and the link to continue from; a draft's key that names none, said.
 */

const signup = (more: Partial<Page> = {}): Page =>
  ({
    fieldia: '0.6',
    id: 'event-signup',
    title: 'Workshop sign-up',
    timeZone: 'UTC',
    data: { kind: 'responses' },
    fields: {
      name: { type: 'char', label: 'Name', required: true },
      session: { type: 'selection', label: 'Session', options: [{ value: 'am', label: 'Morning workshop', seats: 30 }, { value: 'pm', label: 'Afternoon workshop', seats: 20 }], widget: undefined },
    },
    layout: { type: 'sections', id: 's', children: [{ type: 'section', id: 'g', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-session', field: 'session', widget: 'radio' }] }] },
    limits: { opens: '2026-11-01T09:00', closes: '2026-11-20', message: 'Ask us at hello@example.com.' },
    ...more,
  }) as Page;

const intake = (more: Partial<Page> = {}): Page =>
  ({
    fieldia: '0.6',
    id: 'patient-intake',
    data: { kind: 'responses' },
    continueLater: true,
    fields: { name: { type: 'char', label: 'Full name' }, allergies: { type: 'text', label: 'Allergies' } },
    layout: {
      type: 'wizard',
      id: 'w',
      children: [
        { type: 'step', id: 'about', label: 'About you', children: [{ type: 'field', id: 'f-name', field: 'name' }] },
        { type: 'step', id: 'health', label: 'Health', children: [{ type: 'field', id: 'f-allergies', field: 'allergies' }] },
      ],
    },
    ...more,
  }) as Page;

let handle: ViewerHandle | null = null;
let host: HTMLElement;
let now = Date.parse('2026-11-10T10:00:00Z');
beforeEach(() => jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] }));
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
  jest.useRealTimers();
  now = Date.parse('2026-11-10T10:00:00Z');
});
const pass = (ms = 0) => jest.advanceTimersByTimeAsync(ms);

async function mount(page: Page, options: Partial<ViewerOptions> = {}) {
  host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, now: () => new Date(now), ...options });
  await pass(0);
  await pass(0);
  return handle;
}
const shown = (selector: string) => [...host.querySelectorAll<HTMLElement>(selector)].find((element) => !element.closest('[hidden]')) ?? null;
const questions = () => shown('.fd-content .fd-field');
const closedWords = () => [...(shown('.fd-closed')?.querySelectorAll('p') ?? [])].filter((p) => !p.hidden).map((p) => p.textContent);
const button = (name: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === name && !b.closest('[hidden]'));
function type(field: string, text: string) {
  const input = host.querySelector(`.fd-field[data-path="${field}"] :is(input, textarea)`) as HTMLInputElement;
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('a page that takes no answers now says so as it opens', () => {
  it('before it opens: when, and the page’s own words, in place of its questions — then its questions as it opens', async () => {
    now = Date.parse('2026-10-31T12:00:00Z');
    await mount(signup());
    expect(questions()).toBeNull();
    expect(shown('.fd-page-title')?.textContent).toBe('Workshop sign-up');
    expect(closedWords()).toEqual([expect.stringMatching(/^This form opens on November 1, 2026(,| at) 09:00\.$/), 'Ask us at hello@example.com.']);
    expect(shown('.fd-closed')?.getAttribute('role')).toBe('status');
    // Left open as it opens.
    now = Date.parse('2026-11-01T09:00:01Z');
    await pass(22 * 3600_000);
    expect(questions()).not.toBeNull();
    expect(shown('.fd-closed')).toBeNull();
  });

  it('after it closed', async () => {
    now = Date.parse('2026-11-21T00:00:00Z');
    await mount(signup());
    expect(questions()).toBeNull();
    expect(closedWords()[0]).toBe('This form closed on November 20, 2026.');
  });

  it('closing on answers typed keeps them, says they can no longer be sent, and refuses them as they go', async () => {
    const source = createMemoryDataSource();
    now = Date.parse('2026-11-20T23:59:00Z');
    await mount(signup(), { dataSource: source });
    type('name', 'Mona Adel');
    now = Date.parse('2026-11-21T00:00:30Z');
    await pass(120_000);
    expect(questions()).not.toBeNull();
    expect(shown('.fd-closed-banner')?.textContent).toBe('This form closed on November 20, 2026. Your answers can no longer be sent.');
    button('Submit')?.click();
    await pass(0);
    await pass(0);
    expect(source.responses).toEqual([]);
  });

  it('full, or sent by this person already, once the source told; its questions wait while it asks', async () => {
    const source = createMemoryDataSource({ delayMs: 200, limits: { 'event-signup': { responses: 50 } } });
    await mount(signup({ limits: { maxResponses: 50 } }), { dataSource: source });
    expect(questions()).toBeNull();
    expect(shown('.fd-closed[aria-busy]')?.textContent).toBe('Loading…');
    await pass(200);
    expect(closedWords()).toEqual(['This form has all the responses it takes.']);
  });

  it('takes one from each person: Thank you, with no other response offered', async () => {
    const source = createMemoryDataSource();
    await mount(signup({ limits: { onePerPerson: true } }), { dataSource: source });
    type('name', 'Mona Adel');
    button('Submit')?.click();
    await pass(0);
    await pass(0);
    await pass(0);
    expect(shown('.fd-done')?.textContent).toContain('Thank you');
    expect(button('Submit another response')).toBeUndefined();
    expect(shown('.fd-closed')).toBeNull();
    expect(handle?.form.getState().limits?.state).toBe('sent');
  });

  it('shows each choice’s places as the source tells them', async () => {
    const source = createMemoryDataSource({ limits: { 'event-signup': { perChoice: { session: { pm: 20 } } } } });
    await mount(signup({ limits: undefined }), { dataSource: source });
    expect([...host.querySelectorAll('.fd-seats')].map((mark) => mark.textContent)).toEqual(['30 left', 'Full']);
  });
});

describe('Continue later', () => {
  it('sits beside Next where the source keeps drafts, keeps the answers, and shows the app’s link with Copy', async () => {
    const source = createMemoryDataSource({ draftLink: (key) => `https://clinic.example/intake?resume=${key}` });
    await mount(intake(), { dataSource: source });
    type('name', 'Mona Adel');
    button('Continue later')?.click();
    await pass(0);
    await pass(0);
    expect(source.drafts['draft-1']).toMatchObject({ values: { name: 'Mona Adel' }, step: 'about', later: true });
    expect(questions()).toBeNull();
    expect(shown('.fd-later-title')?.textContent).toBe('Your answers are saved');
    expect((shown('.fd-later-link') as HTMLInputElement).value).toBe('https://clinic.example/intake?resume=draft-1');
    expect(button('Copy link')).toBeDefined();
    expect(document.activeElement).toBe(shown('.fd-later-title'));
    button('Keep going')?.click();
    expect(questions()).not.toBeNull();
    expect(shown('.fd-later')).toBeNull();
  });

  it('is not offered where the source keeps no drafts', async () => {
    const { saveDraft: _save, loadDraft: _load, ...rest } = createMemoryDataSource();
    await mount(intake(), { dataSource: rest as DataSource });
    expect(button('Continue later')).toBeUndefined();
  });

  it('opens a draft by its key at its step, and says so when the key names none', async () => {
    const source = createMemoryDataSource({ drafts: { abc: { pageId: 'patient-intake', values: { name: 'Mona Adel' }, step: 'health', savedAt: '2026-10-19T10:42:00Z' } } });
    await mount(intake(), { dataSource: source, resume: 'abc' });
    expect(shown('.fd-step-title')?.textContent).toBe('Health');
    handle?.destroy();
    await mount(intake(), { dataSource: source, resume: 'gone' });
    expect(shown('.fd-resume-missing')?.textContent).toContain('These saved answers could not be found');
    expect(shown('.fd-step-title')?.textContent).toBe('About you');
  });
});
